import { randomUUID } from "node:crypto";
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

// 시연용 데이터 (단계 8). 모든 계정은 @kemi.test 이메일이라 운영 지표에서 빠지고, 이름에 [시연]이 붙는다.
// 거래는 실제 서비스 함수를 거쳐 만든다(조건서 해시·대화방·알림이 실제 흐름과 같다).
// 결제만 Toss를 부르지 않고 "시연 결제" 성공 기록을 넣는다(실제 돈·Sandbox 호출 없음).

const DAY_MS = 24 * 60 * 60 * 1000;
const BCRYPT_COST = 12;

export class SeedAlreadyAppliedError extends Error {
  constructor() {
    super("시연 데이터가 이미 있습니다. 다시 넣지 않습니다.");
    this.name = "SeedAlreadyAppliedError";
  }
}

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

export async function seedDemo(
  prisma: PrismaClient,
  { password, now = () => new Date() }: { password: string; now?: () => Date },
): Promise<SeedSummary> {
  const existing = await prisma.user.count({
    where: { email: { endsWith: `@${TEST_EMAIL_DOMAIN}` } },
  });
  if (existing > 0) throw new SeedAlreadyAppliedError();

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  const makeUser = async (
    key: string,
    name: string,
    role: "CLIENT" | "CREATOR",
  ): Promise<AuthUser> => {
    const row = await prisma.user.create({
      data: {
        email: `${key}@${TEST_EMAIL_DOMAIN}`,
        passwordHash,
        name: `[시연] ${name}`,
        role,
      },
    });
    return {
      id: row.id.toString(),
      email: row.email,
      name: row.name,
      role,
      status: "ACTIVE",
    };
  };
  const client = await makeUser("demo-client", "김의뢰", "CLIENT");
  const client2 = await makeUser("demo-client2", "이가족", "CLIENT");
  const creator = await makeUser("demo-creator", "박편집", "CREATOR");
  const creator2 = await makeUser("demo-creator2", "최촬영", "CREATOR");

  const catalog = createCatalogService({ prisma, now });
  const projects = createProjectService({ prisma, now });
  const applications = createApplicationService({ prisma, now });
  const terms = createTermsService({ prisma, now });
  const production = createProductionService({ prisma, now });
  const delivery = createDeliveryService({ prisma, now });
  const direct = createDirectRequestService({ prisma, now });

  // ─── 제작자: 프로필·패키지·작업물·서비스 공개 ───
  const fakeFile = async (
    owner: AuthUser,
    purpose: string,
    mimeType: string,
    workRequestId: bigint | null = null,
  ) =>
    (
      await prisma.file.create({
        data: {
          ownerId: BigInt(owner.id),
          purpose,
          mimeType,
          fileName: mimeType.startsWith("video") ? "demo.mp4" : "demo.png",
          sizeBytes: 1024n,
          // 저장소에 실제 파일이 없으므로 재생 주소는 열리지 않는다(시연 화면은 썸네일 자리 표시).
          storagePath: `seed/${randomUUID()}`,
          status: "READY",
          workRequestId,
          completedAt: now(),
        },
      })
    ).id.toString();

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
    await prisma.creatorProfile.upsert({
      where: { userId: BigInt(user.id) },
      create: {
        userId: BigInt(user.id),
        introduction: profile.introduction,
        niche: profile.niche,
        isAvailable: true,
      },
      update: {
        introduction: profile.introduction,
        niche: profile.niche,
        isAvailable: true,
      },
    });
    const created = await catalog.createPackage(user, {
      ...pkg,
      description: `${pkg.title}을 정성껏 만들어 드립니다. (시연 데이터)`,
      revisionCount: 2,
      includes: ["영상 1편", "자막", "배경음악"],
    });
    const packageId = BigInt(created.id);
    await catalog.setPackageStatus(user, packageId, true);
    await catalog.makeRepresentative(user, packageId);
    await catalog.setServiceStatus(user, true);
    const portfolio = await catalog.createPortfolio(user, {
      ...work,
      description: "시연용 작업물입니다.",
      source: "OWN_WORK",
      videoFileId: await fakeFile(user, "PORTFOLIO", "video/mp4"),
      thumbnailFileId: await fakeFile(user, "PORTFOLIO", "image/png"),
      packageId: created.id,
    });
    await catalog.setPortfolioStatus(user, BigInt(portfolio.id), true);
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

  // ─── 모집 중 공고 + 대기 중 지원 ───
  const at = now();
  const kstDate = (offsetDays: number) =>
    new Date(at.getTime() + offsetDays * DAY_MS).toISOString().slice(0, 10);
  const open = await projects.create(client, {
    title: "[시연] 부모님 결혼 30주년 영상",
    description: "가족사진과 짧은 영상으로 감사 영상을 만들고 싶습니다.",
    purpose: "THANKS_CELEBRATION",
    styles: ["EMOTIONAL"],
    budget: 150_000,
    recruitmentEndAt: new Date(at.getTime() + 7 * DAY_MS).toISOString(),
    deliveryDueDate: kstDate(21),
  });
  await applications.apply(creator2, BigInt(open.id), {
    message: "가족 영상 경험이 많습니다. 일주일 안에 만들어 드릴게요.",
    proposedAmount: 150_000,
    expectedDays: 7,
  });

  // ─── 처음부터 끝까지 끝난 공개 모집 거래 ───
  const done = await projects.create(client2, {
    title: "[시연] 돌잔치 성장영상",
    description: "아이의 첫 생일에 상영할 성장영상을 만들고 싶습니다.",
    purpose: "CHILD_FAMILY",
    styles: ["EMOTIONAL"],
    budget: 200_000,
    recruitmentEndAt: new Date(at.getTime() + 3 * DAY_MS).toISOString(),
    deliveryDueDate: kstDate(14),
  });
  const application = await applications.apply(creator, BigInt(done.id), {
    message: "감성적인 성장영상을 5일 안에 만들어 드릴게요.",
    proposedAmount: 200_000,
    expectedDays: 5,
  });
  const requestId = BigInt(application.id);
  await applications.requestDiscussion(client2, requestId);
  await terms.saveVersion(client2, requestId, {
    commandId: randomUUID(),
    baseVersionNo: 0,
    values: TERMS,
  });
  const signing = await terms.requestSigning(client2, requestId, 1);
  const signBody = {
    signerName: "시연 서명",
    consent: true,
    termsHash: signing.termsHash,
  };
  await terms.sign(creator, requestId, 1, signBody);
  const signed = await terms.sign(client2, requestId, 1, signBody);
  const { contract } = signed.result;
  if (!contract) throw new Error("시연 계약이 만들어지지 않았습니다.");
  const contractId = BigInt(contract.id);
  await prisma.payment.create({
    data: {
      contractId,
      orderId: randomUUID(),
      amountKrw: 200_000n,
      orderName: "[시연] 돌잔치 성장영상 (시연 결제)",
      status: "SUCCEEDED",
      method: "시연",
      paymentKey: `seed_${randomUUID()}`,
      approvedAt: now(),
      createdBy: BigInt(client2.id),
    },
  });
  await production.addMaterial(client2, contractId, {
    kind: "NOTE",
    note: "사진 50장은 대화방 첨부로 보냈습니다.",
  });
  const prepared = await production.get(creator, contractId);
  await Promise.all(
    prepared.materials.map((m) =>
      production.confirmMaterial(creator, contractId, BigInt(m.id)),
    ),
  );
  await production.start(creator, contractId);
  const deliverableFile = () =>
    fakeFile(creator, "DELIVERABLE", "video/mp4", requestId);
  const review1 = await delivery.submit(creator, contractId, {
    commandId: randomUUID(),
    kind: "REVIEW",
    fileIds: [await deliverableFile()],
  });
  await delivery.requestRevision(
    client2,
    contractId,
    BigInt(review1.deliverables[0]?.id ?? "0"),
    {
      commandId: randomUUID(),
      type: "GENERAL",
      items: [
        {
          position: "01:10",
          problem: "배경음악이 큽니다.",
          desired: "목소리가 들리게 줄여주세요.",
        },
      ],
    },
  );
  const review2 = await delivery.submit(creator, contractId, {
    commandId: randomUUID(),
    kind: "REVIEW",
    fileIds: [await deliverableFile()],
  });
  await delivery.approve(
    client2,
    contractId,
    BigInt(review2.deliverables.at(-1)?.id ?? "0"),
  );
  const final = await delivery.submit(creator, contractId, {
    commandId: randomUUID(),
    kind: "FINAL",
    fileIds: [await deliverableFile()],
  });
  await delivery.receive(
    client2,
    contractId,
    BigInt(final.deliverables.at(-1)?.id ?? "0"),
  );
  await delivery.review(client2, contractId, {
    rating: 5,
    comment: "가족 모두 감동했어요. (시연 리뷰)",
  });
  await delivery.review(creator, contractId, {
    rating: 5,
    comment: "자료를 빠르게 보내주셨어요. (시연 리뷰)",
  });

  // ─── 답을 기다리는 직접 의뢰 ───
  const sent = await direct.create(client, weddingPackage, {
    message: "다음 달 결혼식 하이라이트 영상을 부탁드리고 싶어요.",
    eventDate: kstDate(30),
  });

  return {
    users: [client, client2, creator, creator2].map((u) => ({
      email: u.email ?? "",
      role: u.role,
    })),
    openProjectId: open.id,
    completedContractId: contract.id,
    directRequestId: sent.id,
  };
}
