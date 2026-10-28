import { TEST_EMAIL_DOMAIN } from "@kemi/shared";
import type { PrismaClient } from "../generated/prisma/client.js";

// 기본: 접속 주소 신원·허용 목록·직접 확인값·실제 사용자 여부를 모두 확인한 후에만 실행한다.
// KEMI 운영·공유 DB만 PM의 1회성 명시 승인으로 예외 허용한다. 기본은 계속 거부(fail-closed).
// 이 예외는 DB 전체 권한(RLS)을 바꾸지 않으며 db:seed 명령에만 적용된다.
const SHARED_PRODUCTION_IDENTITY = "supabase:nibqyycfknurkncdgqps";
const FORBIDDEN_SEED_IDENTITIES = new Set([SHARED_PRODUCTION_IDENTITY]);
export const SHARED_PRODUCTION_SEED_ACK =
  "I_ACKNOWLEDGE_LIVE_KEMI_DB_FAKE_PAYMENTS_AND_MEDIA";

export class SeedTargetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SeedTargetError";
  }
}

// 접속 주소의 DB 신원. 비밀번호는 쓰지 않는다.
// - Supabase: 프로젝트 ref (pooler 사용자 postgres.<ref> 또는 직접 연결 db.<ref>.supabase.co) → supabase:<ref>
// - 그 밖: host:port/dbname
export function databaseIdentity(databaseUrl: string): string {
  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    throw new SeedTargetError("DATABASE_URL을 해석할 수 없습니다.");
  }
  const host = url.hostname.toLowerCase();
  if (host.endsWith(".supabase.com") || host.endsWith(".supabase.co")) {
    const fromUser = /^postgres\.([a-z0-9]+)$/.exec(
      decodeURIComponent(url.username),
    )?.[1];
    const fromHost = /^db\.([a-z0-9]+)\.supabase\.co$/.exec(host)?.[1];
    const ref = fromUser ?? fromHost;
    if (!ref) {
      throw new SeedTargetError("Supabase 프로젝트 ref를 찾을 수 없습니다.");
    }
    return `supabase:${ref}`;
  }
  const database = url.pathname.replace(/^\//, "") || "postgres";
  return `${host}:${url.port || "5432"}/${database}`;
}

export interface SeedTargetEnv {
  DATABASE_URL: string;
  NODE_ENV?: string;
  // 시드를 허용한 DB 신원 목록(쉼표 구분). 전용 개발·시연 DB만 넣는다.
  SEED_ALLOWED_TARGETS?: string;
  // 이번 실행 대상의 신원을 직접 적은 값. 허용 목록에 있고 실제 접속 대상과 같아야 한다.
  SEED_CONFIRM_TARGET?: string;
  // 운영·공유 DB에서 시연 계정·가상 성공결제·가짜 파일 행을 만드는 위험을 1회성으로 명시 확인.
  // Render의 상시 환경변수로 보관하지 말고 수동 작업 시에만 전달한다.
  SEED_PRODUCTION_ACK?: string;
}

// 운영 DB 예외는 실제 DB 신원+허용 목록+확인값+명시적 위험 승인이 모두 일치할 때만 성립한다.
export function allowSharedProductionDemoSeed(
  env: SeedTargetEnv,
  identity: string,
): boolean {
  const allowed = (env.SEED_ALLOWED_TARGETS ?? "")
    .split(",")
    .map((value) => value.trim());
  return (
    identity === SHARED_PRODUCTION_IDENTITY &&
    env.SEED_PRODUCTION_ACK === SHARED_PRODUCTION_SEED_ACK &&
    env.SEED_CONFIRM_TARGET === identity &&
    allowed.includes(identity)
  );
}

// 환경 변수만으로 판단할 수 있는 조건. 하나라도 어긋나면 DB에 접속하지 않고 멈춘다.
export function checkSeedTarget(env: SeedTargetEnv): string {
  const identity = databaseIdentity(env.DATABASE_URL);
  const explicitlyApproved = allowSharedProductionDemoSeed(env, identity);
  if (env.NODE_ENV === "production" && !explicitlyApproved) {
    throw new SeedTargetError(
      "NODE_ENV=production에서는 명시적 KEMI 공유 DB 승인 없이 시연 데이터를 넣지 않습니다.",
    );
  }
  if (FORBIDDEN_SEED_IDENTITIES.has(identity) && !explicitlyApproved) {
    throw new SeedTargetError(
      "KEMI 운영·공유 Supabase DB에는 1회성 PM 명시 승인 없이 시연 데이터를 넣지 않습니다.",
    );
  }
  const allowed = (env.SEED_ALLOWED_TARGETS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  if (allowed.length === 0) {
    throw new SeedTargetError(
      "SEED_ALLOWED_TARGETS(시드를 허용한 전용 DB 신원 목록)가 없습니다.",
    );
  }
  if (!allowed.includes(identity)) {
    throw new SeedTargetError(
      `접속 대상(${identity})이 SEED_ALLOWED_TARGETS에 없습니다.`,
    );
  }
  if (env.SEED_CONFIRM_TARGET !== identity) {
    throw new SeedTargetError(
      `SEED_CONFIRM_TARGET이 접속 대상(${identity})과 다릅니다. 대상을 확인하고 같은 값을 적어주세요.`,
    );
  }
  return identity;
}

// DB에 접속해서 확인하는 조건: 시연 계정(@kemi.test)이 아닌 사용자가 한 명이라도 있으면 실제 서비스 DB로 보고 멈춘다.
export async function assertSeedDatabase(
  prisma: PrismaClient,
  { allowExistingUsers = false }: { allowExistingUsers?: boolean } = {},
): Promise<void> {
  const realUsers = await prisma.user.count({
    where: {
      OR: [
        { email: null },
        { NOT: { email: { endsWith: `@${TEST_EMAIL_DOMAIN}` } } },
      ],
    },
  });
  if (realUsers > 0 && !allowExistingUsers) {
    throw new SeedTargetError(
      "시연 계정이 아닌 사용자가 있는 DB입니다. 실제 서비스 DB에는 시연 데이터를 넣지 않습니다.",
    );
  }
}
