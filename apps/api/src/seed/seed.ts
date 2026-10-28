import { createHash } from "node:crypto";
import { type AuthUser, TEST_EMAIL_DOMAIN } from "@kemi/shared";
import bcrypt from "bcrypt";
import type { PrismaClient } from "../generated/prisma/client.js";
import { createApplicationService } from "../applications/application.service.js";
import { createCatalogService } from "../catalog/catalog.service.js";
import { createDeliveryService } from "../delivery/delivery.service.js";
import { createDirectRequestService } from "../direct/direct.service.js";
import { createProductionService } from "../production/production.service.js";
import { createProjectService } from "../projects/project.service.js";
import { createTermsService } from "../terms/terms.service.js";
import { SeedTargetError } from "./target.js";

// 시연용 데이터 (단계 8). 전용 시연 DB에서만 쓴다(실행 대상 확인은 run.ts·target.ts).
// - 모든 계정은 @kemi.test 이메일이라 운영 지표에서 빠지고, 이름에 [시연]이 붙는다.
// - 거래는 실제 서비스 함수를 거쳐 만든다(조건서 해시·대화방·알림이 실제 흐름과 같다).
// - 결제만 Toss를 부르지 않고 "시연 결제" 성공 기록을 넣는다(실제 돈·Sandbox 호출 없음). 실제 결제를 검증한 것이 아니다.
// - 작업물·납품 파일은 DB 행만 있고 저장소에 바이트가 없다(재생·다운로드 주소는 열리지 않는다).
//
// 단계마다 "이미 있으면 그대로 쓰고, 없으면 만든다"로 진행한다. 중간에 실패해도 다시 실행하면 남은 단계만 이어서
// 만들고, 다 만든 뒤 다시 실행하면 아무것도 바꾸지 않는다. 요청 식별자(commandId)는 단계 이름에서 고정값으로 만들어
// 재실행이 서비스의 멱등 처리로 같은 결과를 받는다. 아무것도 지우지 않는다.
//
// 실사용자와 함께 쓰는 DB(sharedDatabase, 운영 DB 1회성 예외)에서는 더 조심한다.
// - 같은 이메일의 시연 계정이 이미 있는데 시드가 만든 계정(이름·역할이 같음)이 아니면 아무것도 쓰기 전에 멈춘다.
// - 이미 있는 제작자 프로필은 덮어쓰지 않는다.
// - 작업물은 비공개(DRAFT)로 둔다. 파일 행만 있고 영상이 없어 공개 피드에 재생되지 않는 카드가 생기기 때문이다.

const DAY_MS = 24 * 60 * 60 * 1000;
const BCRYPT_COST = 12;

const DEMO_USERS = {
  client: { key: "demo-client", name: "김의뢰", role: "CLIENT" },
  client2: { key: "demo-client2", name: "이가족", role: "CLIENT" },
  creator: { key: "demo-creator", name: "박편집", role: "CREATOR" },
  creator2: { key: "demo-creator2", name: "최촬영", role: "CREATOR" },
} as const;
type DemoUser = (typeof DEMO_USERS)[keyof typeof DEMO_USERS];
const demoEmail = (user: DemoUser) => `${user.key}@${TEST_EMAIL_DOMAIN}`;
const demoName = (user: DemoUser) => `[시연] ${user.name}`;

export interface SeedSummary {
  users: { email: string; role: string }[];
  openProjectId: string;
  completedContractId: string;
  directRequestId: string;
}

const TERMS = {
  amountKrw: 200_000,
  specification: "3분 성장영상 1편 (가로 1080p)",
  scope: "사진·클립 편집, 자막, 배경음악",
  materials: "사진 50장, 클립 10개",
  deadline: "자료를 확인한 날부터 5일",
  revisions: "일반 수정 2회",
  usageRights: "가족 행사 상영과 개인 SNS 게시",
  cancellation: "제작 시작 전 전액 환불",
};

// 단계 이름으로 고정 UUID를 만든다(재실행해도 같은 요청 식별자).
export function seedCommandId(name: string): string {
  const hex = createHash("sha256").update(`kemi-seed:${name}`).digest("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `4${hex.slice(13, 16)}`,
    `8${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ].join("-");
}

export async function seedDemo(
  prisma: PrismaClient,
  {
    password,
    now = () => new Date(),
    onStep = () => undefined,
    sharedDatabase = false,
  }: {
    password: string;
    now?: () => Date;
    // 실사용자와 함께 쓰는 DB. 기존 계정·프로필을 덮어쓰지 않고 작업물을 공개하지 않는다.
    sharedDatabase?: boolean;
    // 단계가 끝날 때마다 불린다(진행 표시, 부분 실패 테스트).
    onStep?: (name: string) => void;
  },
): Promise<SeedSummary> {
  const step = (name: string) => onStep(name);
  const catalog = createCatalogService({ prisma, now });
  const projects = createProjectService({ prisma, now });
  const applications = createApplicationService({ prisma, now });
  const terms = createTermsService({ prisma, now });
  const production = createProductionService({ prisma, now });
  const delivery = createDeliveryService({ prisma, now });
  const direct = createDirectRequestService({ prisma, now });

  // ─── 계정 ───
  if (sharedDatabase) {
    const demoUsers = Object.values(DEMO_USERS);
    const existing = await prisma.user.findMany({
      where: { email: { in: demoUsers.map(demoEmail) } },
      select: { email: true, name: true, role: true },
    });
    const foreign = existing.filter(
      (row) =>
        !demoUsers.some(
          (user) =>
            demoEmail(user) === row.email &&
            demoName(user) === row.name &&
            user.role === row.role,
        ),
    );
    if (foreign.length > 0) {
      throw new SeedTargetError(
        `시드가 만들지 않은 같은 이메일 계정이 있어 아무것도 바꾸지 않고 멈춥니다: ${foreign
          .map((row) => row.email)
          .join(", ")}`,
      );
    }
  }
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  const ensureUser = async (user: DemoUser): Promise<AuthUser> => {
    const email = demoEmail(user);
    const { role } = user;
    const row =
      (await prisma.user.findUnique({ where: { email } })) ??
      (await prisma.user.create({
        data: { email, passwordHash, name: demoName(user), role },
      }));
    if (row.role !== role) {
      throw new Error(`시연 계정 ${email}의 역할이 예상과 다릅니다.`);
    }
    return {
      id: row.id.toString(),
      email,
      name: row.name,
      role,
      status: "ACTIVE",
    };
  };
  const client = await ensureUser(DEMO_USERS.client);
  const client2 = await ensureUser(DEMO_USERS.client2);
  const creator = await ensureUser(DEMO_USERS.creator);
  const creator2 = await ensureUser(DEMO_USERS.creator2);
  step("users");

  // 저장 경로를 이름으로 고정해 재실행 때 같은 파일 행을 쓴다.
  const fakeFile = async (
    owner: AuthUser,
    name: string,
    purpose: string,
    mimeType: string,
    workRequestId: bigint | null = null,
  ) => {
    const storagePath = `seed/${name}`;
    const row =
      (await prisma.file.findFirst({ where: { storagePath } })) ??
      (await prisma.file.create({
        data: {
          ownerId: BigInt(owner.id),
          purpose,
          mimeType,
          fileName: mimeType.startsWith("video") ? "demo.mp4" : "demo.png",
          sizeBytes: 1024n,
          storagePath,
          status: "READY",
          workRequestId,
          completedAt: now(),
        },
      }));
    return row.id.toString();
  };

  // ─── 제작자: 프로필·패키지·작업물·서비스 공개 ───
  const publishCreator = async (
    user: AuthUser,
    profile: { introduction: string; niche: string },
    pkg: {
      title: string;
      purpose: string;
      priceKrw: number;
      deliveryDays: number;
    },
    work: { title: string; purpose: string; styles: string[]; roles: string[] },
  ) => {
    const creatorId = BigInt(user.id);
    await prisma.creatorProfile.upsert({
      where: { userId: creatorId },
      create: { userId: creatorId, ...profile, isAvailable: true },
      update: sharedDatabase ? {} : { ...profile, isAvailable: true },
    });
    const existingPackage = await prisma.servicePackage.findFirst({
      where: { creatorId, title: pkg.title },
    });
    const packageId =
      existingPackage?.id ??
      BigInt(
        (
          await catalog.createPackage(user, {
            ...pkg,
            description: `${pkg.title}을 정성껏 만들어 드립니다. (시연 데이터)`,
            revisionCount: 2,
            includes: ["영상 1편", "자막", "배경음악"],
          })
        ).id,
      );
    if (existingPackage?.status !== "PUBLIC") {
      await catalog.setPackageStatus(user, packageId, true);
    }
    if (!existingPackage?.isRepresentative) {
      await catalog.makeRepresentative(user, packageId);
    }
    await catalog.setServiceStatus(user, true);
    const existingWork = await prisma.portfolio.findFirst({
      where: { creatorId, title: work.title },
    });
    const portfolioId =
      existingWork?.id ??
      BigInt(
        (
          await catalog.createPortfolio(user, {
            ...work,
            description: "시연용 작업물입니다.",
            source: "OWN_WORK",
            videoFileId: await fakeFile(
              user,
              `${user.email}/portfolio.mp4`,
              "PORTFOLIO",
              "video/mp4",
            ),
            thumbnailFileId: await fakeFile(
              user,
              `${user.email}/portfolio.png`,
              "PORTFOLIO",
              "image/png",
            ),
            packageId: packageId.toString(),
          })
        ).id,
      );
    if (!sharedDatabase && existingWork?.status !== "PUBLIC") {
      await catalog.setPortfolioStatus(user, portfolioId, true);
    }
    return packageId;
  };
  await publishCreator(
    creator,
    {
      introduction: "가족 행사 영상을 따뜻하게 편집합니다.",
      niche: "LIFESTYLE",
    },
    {
      title: "돌잔치 성장영상 기본",
      purpose: "CHILD_FAMILY",
      priceKrw: 200_000,
      deliveryDays: 5,
    },
    {
      title: "첫 생일 성장영상",
      purpose: "CHILD_FAMILY",
      styles: ["EMOTIONAL"],
      roles: ["EDITING"],
    },
  );
  const weddingPackage = await publishCreator(
    creator2,
    {
      introduction: "웨딩·여행 영상을 촬영하고 편집합니다.",
      niche: "LIFESTYLE",
    },
    {
      title: "웨딩 하이라이트",
      purpose: "WEDDING_COUPLE",
      priceKrw: 350_000,
      deliveryDays: 10,
    },
    {
      title: "제주 스냅 웨딩",
      purpose: "WEDDING_COUPLE",
      styles: ["CINEMATIC"],
      roles: ["FILMING", "EDITING"],
    },
  );
  step("creators");

  // ─── 공고와 지원 ───
  const at = now();
  const kstDate = (offsetDays: number) =>
    new Date(at.getTime() + offsetDays * DAY_MS).toISOString().slice(0, 10);
  const ensureProject = async (
    owner: AuthUser,
    input: Record<string, unknown> & { title: string },
  ) => {
    const found = await prisma.project.findFirst({
      where: { clientId: BigInt(owner.id), title: input.title },
    });
    return found?.id ?? BigInt((await projects.create(owner, input)).id);
  };
  const ensureApplication = async (
    applicant: AuthUser,
    projectId: bigint,
    input: { message: string; proposedAmount: number; expectedDays: number },
  ) => {
    const found = await prisma.workRequest.findFirst({
      where: { projectId, creatorId: BigInt(applicant.id) },
    });
    return (
      found?.id ??
      BigInt((await applications.apply(applicant, projectId, input)).id)
    );
  };

  const openProjectId = await ensureProject(client, {
    title: "[시연] 부모님 결혼 30주년 영상",
    description: "가족사진과 짧은 영상으로 감사 영상을 만들고 싶습니다.",
    purpose: "THANKS_CELEBRATION",
    styles: ["EMOTIONAL"],
    budget: 150_000,
    recruitmentEndAt: new Date(at.getTime() + 7 * DAY_MS).toISOString(),
    deliveryDueDate: kstDate(21),
  });
  await ensureApplication(creator2, openProjectId, {
    message: "가족 영상 경험이 많습니다. 일주일 안에 만들어 드릴게요.",
    proposedAmount: 150_000,
    expectedDays: 7,
  });
  step("open-project");

  // ─── 처음부터 끝까지 끝난 공개 모집 거래 ───
  const doneProjectId = await ensureProject(client2, {
    title: "[시연] 돌잔치 성장영상",
    description: "아이의 첫 생일에 상영할 성장영상을 만들고 싶습니다.",
    purpose: "CHILD_FAMILY",
    styles: ["EMOTIONAL"],
    budget: 200_000,
    recruitmentEndAt: new Date(at.getTime() + 3 * DAY_MS).toISOString(),
    deliveryDueDate: kstDate(14),
  });
  const requestId = await ensureApplication(creator, doneProjectId, {
    message: "감성적인 성장영상을 5일 안에 만들어 드릴게요.",
    proposedAmount: 200_000,
    expectedDays: 5,
  });
  const request = await prisma.workRequest.findUniqueOrThrow({
    where: { id: requestId },
  });
  if (request.status === "PENDING") {
    await applications.requestDiscussion(client2, requestId);
  }
  step("discussion");

  // 조건서: 저장 → 서명 요청 → 양측 서명(같은 버전에 둘 다 서명하면 계약·선정)
  const findContract = () =>
    prisma.contract.findFirst({ where: { workRequestId: requestId } });
  if (!(await findContract())) {
    const latest = await prisma.termsVersion.findFirst({
      where: { workRequestId: requestId },
      orderBy: { versionNo: "desc" },
    });
    if (!latest) {
      await terms.saveVersion(client2, requestId, {
        commandId: seedCommandId("terms-v1"),
        baseVersionNo: 0,
        values: TERMS,
      });
    }
    const version = await prisma.termsVersion.findFirstOrThrow({
      where: { workRequestId: requestId },
      orderBy: { versionNo: "desc" },
    });
    if (version.status === "DRAFT") {
      await terms.requestSigning(client2, requestId, version.versionNo);
    } else if (version.status !== "SIGNING") {
      throw new Error(
        `시연 조건서가 이어서 진행할 수 없는 상태(${version.status})입니다.`,
      );
    }
    const signing = await prisma.termsVersion.findUniqueOrThrow({
      where: { id: version.id },
    });
    const signed = new Set(
      (
        await prisma.signature.findMany({
          where: { termsVersionId: version.id },
          select: { userId: true },
        })
      ).map((s) => s.userId.toString()),
    );
    const signBody = {
      signerName: "시연 서명",
      consent: true,
      termsHash: signing.termsHash,
    };
    // 크리에이터 → 의뢰인 순서로 서명한다(순서대로 해야 하므로 reduce로 잇는다).
    await [creator, client2]
      .filter((party) => !signed.has(party.id))
      .reduce(
        (previous, party) =>
          previous.then(async () => {
            await terms.sign(party, requestId, version.versionNo, signBody);
          }),
        Promise.resolve(),
      );
  }
  const contract = await findContract();
  if (!contract) throw new Error("시연 계약이 만들어지지 않았습니다.");
  const contractId = contract.id;
  step("contract");

  const paid = await prisma.payment.findFirst({
    where: { contractId, status: "SUCCEEDED" },
  });
  if (!paid) {
    await prisma.payment.create({
      data: {
        contractId,
        orderId: seedCommandId("payment"),
        amountKrw: 200_000n,
        orderName: "[시연] 돌잔치 성장영상 (시연 결제)",
        status: "SUCCEEDED",
        method: "시연",
        paymentKey: `seed_${seedCommandId("payment-key")}`,
        approvedAt: now(),
        createdBy: BigInt(client2.id),
      },
    });
  }
  step("payment");

  // ─── 제작 ───
  await production.addMaterial(client2, contractId, {
    commandId: seedCommandId("material-1"),
    kind: "NOTE",
    note: "사진 50장은 대화방 첨부로 보냈습니다.",
  });
  const prepared = await production.get(creator, contractId);
  await Promise.all(
    prepared.materials
      .filter((m) => m.status === "SUBMITTED")
      .map((m) =>
        production.confirmMaterial(creator, contractId, BigInt(m.id)),
      ),
  );
  if ((await production.get(creator, contractId)).status === "PREPARING") {
    await production.start(creator, contractId);
  }
  step("production");

  // ─── 납품: 검토본 → 수정 요청 → 수정본 → 승인 → 최종본 → 수령 ───
  const deliverableFile = (name: string) =>
    fakeFile(
      creator,
      `${contractId}/${name}.mp4`,
      "DELIVERABLE",
      "video/mp4",
      requestId,
    );
  const review1 = await delivery.submit(creator, contractId, {
    commandId: seedCommandId("review-1"),
    kind: "REVIEW",
    fileIds: [await deliverableFile("review-1")],
  });
  const review1Id = BigInt(review1.deliverables[0]?.id ?? "0");
  await delivery.requestRevision(client2, contractId, review1Id, {
    commandId: seedCommandId("revision-1"),
    type: "GENERAL",
    items: [
      {
        position: "01:10",
        problem: "배경음악이 큽니다.",
        desired: "목소리가 들리게 줄여주세요.",
      },
    ],
  });
  const review2 = await delivery.submit(creator, contractId, {
    commandId: seedCommandId("review-2"),
    kind: "REVIEW",
    fileIds: [await deliverableFile("review-2")],
  });
  const review2Row = review2.deliverables.find(
    (d) => d.kind === "REVIEW" && d.versionNo === 2,
  );
  if (review2Row?.status === "SUBMITTED") {
    await delivery.approve(client2, contractId, BigInt(review2Row.id));
  }
  const final = await delivery.submit(creator, contractId, {
    commandId: seedCommandId("final"),
    kind: "FINAL",
    fileIds: [await deliverableFile("final")],
  });
  const finalRow = final.deliverables.find((d) => d.kind === "FINAL");
  if (finalRow?.status === "SUBMITTED") {
    await delivery.receive(client2, contractId, BigInt(finalRow.id));
  }
  step("delivery");

  const reviewed = new Set(
    (
      await prisma.review.findMany({
        where: { contractId },
        select: { reviewerId: true },
      })
    ).map((r) => r.reviewerId.toString()),
  );
  if (!reviewed.has(client2.id)) {
    await delivery.review(client2, contractId, {
      rating: 5,
      comment: "가족 모두 감동했어요. (시연 리뷰)",
    });
  }
  if (!reviewed.has(creator.id)) {
    await delivery.review(creator, contractId, {
      rating: 5,
      comment: "자료를 빠르게 보내주셨어요. (시연 리뷰)",
    });
  }
  step("reviews");

  // ─── 답을 기다리는 직접 의뢰 ───
  const existingDirect = await prisma.workRequest.findFirst({
    where: {
      requestType: "DIRECT_REQUEST",
      clientId: BigInt(client.id),
      creatorId: BigInt(creator2.id),
    },
  });
  const directRequestId =
    existingDirect?.id.toString() ??
    (
      await direct.create(client, weddingPackage, {
        message: "다음 달 결혼식 하이라이트 영상을 부탁드리고 싶어요.",
        eventDate: kstDate(30),
      })
    ).id;
  step("direct-request");

  return {
    users: [client, client2, creator, creator2].map((u) => ({
      email: u.email ?? "",
      role: u.role,
    })),
    openProjectId: openProjectId.toString(),
    completedContractId: contractId.toString(),
    directRequestId,
  };
}
