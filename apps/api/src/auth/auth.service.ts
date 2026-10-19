import {
  type AuthUser,
  loginRequestSchema,
  signupRequestSchema,
  userRoleSchema,
  userStatusSchema,
} from "@kemi/shared";
import bcrypt from "bcrypt";
import AppError from "../http/app-error.js";
import { Prisma, type PrismaClient } from "../generated/prisma/client.js";
import {
  ACCESS_TOKEN_TTL_SECONDS,
  createRefreshToken,
  hashRefreshToken,
  SESSION_TTL_MS,
  signAccessToken,
  verifyAccessToken,
} from "./tokens.js";

const BCRYPT_COST = 12;
// 이미 사용한 Refresh 토큰이 이 시간 안에 다시 오면 동시 요청으로 보고, 지나면 재사용(탈취 의심)으로 본다.
const REFRESH_REUSE_GRACE_MS = 10_000;
const REFRESH_RETRY_AFTER_MS = 500;

// 회전 경합에서 진 요청을 트랜잭션 밖으로 알리는 표시
class RotationConflict extends Error {}

export interface AuthResult {
  accessToken: string;
  accessTokenExpiresIn: number;
  refreshToken: string;
  // Refresh 쿠키 만료 시각 = 세션 만료 시각
  sessionExpiresAt: Date;
  user: AuthUser;
}

export interface AuthServiceOptions {
  prisma: PrismaClient;
  accessTokenSecret: string;
  // 테스트 전용: 회전 트랜잭션 안에서 토큰 행을 잠근 뒤, 커밋 직전에 호출된다.
  // 동시 요청이 실제로 겹치는지 확인하거나, 중간 실패 시 롤백되는지 확인하는 데 쓴다.
  beforeRotationCommit?: () => Promise<void>;
}

interface UserRow {
  id: bigint;
  email: string | null;
  name: string;
  role: string;
  status: string;
}

function toAuthUser(user: UserRow): AuthUser {
  return {
    id: user.id.toString(),
    email: user.email,
    name: user.name,
    role: userRoleSchema.parse(user.role),
    status: userStatusSchema.parse(user.status),
  };
}

function invalidCredentials(): AppError {
  return new AppError(
    401,
    "INVALID_CREDENTIALS",
    "이메일 또는 비밀번호가 올바르지 않습니다.",
  );
}

function sessionRevoked(): AppError {
  return new AppError(
    401,
    "SESSION_REVOKED",
    "로그인이 만료되었습니다. 다시 로그인해주세요.",
  );
}

function assertActive(user: UserRow): void {
  if (user.status !== "ACTIVE") {
    throw new AppError(403, "FORBIDDEN", "이용이 제한된 계정입니다.");
  }
}

export function createAuthService({
  prisma,
  accessTokenSecret,
  beforeRotationCommit,
}: AuthServiceOptions) {
  const secret = new TextEncoder().encode(accessTokenSecret);
  // 없는 이메일·소셜 전용 계정도 bcrypt 비교를 한 번 해서, 응답 시간으로 가입 여부가 드러나지 않게 한다.
  const dummyPasswordHash = bcrypt.hash("dummy-password", BCRYPT_COST);

  async function issueTokens(
    user: UserRow,
    sessionId: bigint,
    sessionExpiresAt: Date,
    refreshToken: string,
  ): Promise<AuthResult> {
    return {
      accessToken: await signAccessToken(
        { userId: user.id, sessionId },
        secret,
      ),
      accessTokenExpiresIn: ACCESS_TOKEN_TTL_SECONDS,
      refreshToken,
      sessionExpiresAt,
      user: toAuthUser(user),
    };
  }

  async function startSession(user: UserRow): Promise<AuthResult> {
    const refreshToken = createRefreshToken();
    const session = await prisma.authSession.create({
      data: {
        userId: user.id,
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
        refreshTokens: {
          create: { tokenHash: hashRefreshToken(refreshToken) },
        },
      },
    });
    return issueTokens(user, session.id, session.expiresAt, refreshToken);
  }

  async function signup(input: unknown): Promise<AuthResult> {
    const { email, password, name, role } = signupRequestSchema.parse(input);
    const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
    try {
      const user = await prisma.user.create({
        data: { email, passwordHash, name, role },
      });
      return await startSession(user);
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        throw new AppError(
          409,
          "EMAIL_ALREADY_EXISTS",
          "이미 가입된 이메일입니다.",
        );
      }
      throw err;
    }
  }

  async function login(input: unknown): Promise<AuthResult> {
    const { email, password } = loginRequestSchema.parse(input);
    const user = await prisma.user.findUnique({ where: { email } });
    const passwordMatches = await bcrypt.compare(
      password,
      user?.passwordHash ?? (await dummyPasswordHash),
    );
    if (!user?.passwordHash || !passwordMatches) {
      throw invalidCredentials();
    }
    assertActive(user);
    return startSession(user);
  }

  async function rotate(
    tokenId: bigint,
    sessionId: bigint,
    sessionExpiresAt: Date,
    user: UserRow,
  ): Promise<AuthResult> {
    const now = new Date();
    const refreshToken = createRefreshToken();
    // 세션이 그사이 폐기·만료됐는지 확인하면서 세션 행을 잠근다(로그아웃과 동시에 일어나는 경우 대비).
    const rotated = await prisma.$transaction(async (tx) => {
      const session = await tx.authSession.updateMany({
        where: { id: sessionId, revokedAt: null, expiresAt: { gt: now } },
        data: { lastUsedAt: now },
      });
      if (session.count === 0) {
        return false;
      }
      const next = await tx.authRefreshToken.create({
        data: { sessionId, tokenHash: hashRefreshToken(refreshToken) },
      });
      // 아직 사용되지 않은 경우에만 사용 처리한다. 같은 토큰의 다른 요청은 이 행이 풀릴 때까지 기다린 뒤
      // 조건(usedAt = null)이 맞지 않아 0건이 된다.
      const used = await tx.authRefreshToken.updateMany({
        where: { id: tokenId, usedAt: null },
        data: { usedAt: now, replacedById: next.id },
      });
      if (used.count === 0) {
        throw new RotationConflict();
      }
      await beforeRotationCommit?.();
      return true;
    });
    if (!rotated) {
      throw sessionRevoked();
    }
    return issueTokens(user, sessionId, sessionExpiresAt, refreshToken);
  }

  async function refresh(
    refreshToken: string | undefined,
  ): Promise<AuthResult> {
    if (!refreshToken) {
      throw sessionRevoked();
    }
    const tokenHash = hashRefreshToken(refreshToken);
    const findToken = () =>
      prisma.authRefreshToken.findUnique({
        where: { tokenHash },
        include: { session: { include: { user: true } } },
      });

    let token = await findToken();
    if (!token) {
      throw sessionRevoked();
    }
    const { session } = token;
    if (session.revokedAt || session.expiresAt <= new Date()) {
      throw sessionRevoked();
    }
    assertActive(session.user);

    if (!token.usedAt) {
      try {
        return await rotate(
          token.id,
          session.id,
          session.expiresAt,
          session.user,
        );
      } catch (err) {
        if (!(err instanceof RotationConflict)) {
          throw err;
        }
        // 다른 요청이 먼저 회전했다. 사용 시각을 다시 읽어 아래 규칙으로 판정한다.
        token = await findToken();
        if (!token) {
          throw sessionRevoked();
        }
      }
    }

    if (!token.usedAt) {
      throw sessionRevoked();
    }
    if (Date.now() - token.usedAt.getTime() <= REFRESH_REUSE_GRACE_MS) {
      // 정상적인 동시 갱신: 새 토큰을 주지 않고, 세션도 폐기하지 않는다.
      throw new AppError(
        409,
        "REFRESH_RACE",
        "다른 요청이 먼저 갱신했습니다. 잠시 후 다시 시도해주세요.",
        { retryAfterMs: REFRESH_RETRY_AFTER_MS },
      );
    }
    // 유예 시간이 지난 재사용: 탈취 의심으로 세션 전체를 폐기한다.
    await prisma.authSession.updateMany({
      where: { id: token.sessionId, revokedAt: null },
      data: { revokedAt: new Date(), revokeReason: "REUSE_DETECTED" },
    });
    throw sessionRevoked();
  }

  async function logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) {
      return;
    }
    const token = await prisma.authRefreshToken.findUnique({
      where: { tokenHash: hashRefreshToken(refreshToken) },
    });
    if (!token) {
      return;
    }
    await prisma.authSession.updateMany({
      where: { id: token.sessionId, revokedAt: null },
      data: { revokedAt: new Date(), revokeReason: "LOGOUT" },
    });
  }

  // Access 토큰 검증: 서명·만료 + 세션 폐기·만료 + 회원 상태
  async function authenticate(
    accessToken: string | undefined,
  ): Promise<AuthUser> {
    if (!accessToken) {
      throw new AppError(401, "UNAUTHENTICATED", "로그인이 필요합니다.");
    }
    const { userId, sessionId } = await verifyAccessToken(accessToken, secret);
    const session = await prisma.authSession.findUnique({
      where: { id: sessionId },
      include: { user: true },
    });
    if (
      !session ||
      session.userId !== userId ||
      session.revokedAt ||
      session.expiresAt <= new Date()
    ) {
      throw sessionRevoked();
    }
    assertActive(session.user);
    return toAuthUser(session.user);
  }

  return { signup, login, refresh, logout, authenticate };
}

export type AuthService = ReturnType<typeof createAuthService>;
