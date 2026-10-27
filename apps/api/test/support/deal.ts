import { randomUUID } from "node:crypto";
import { VIDEO_PURPOSES, VIDEO_STYLES } from "@kemi/shared";
import type { Express } from "express";
import request from "supertest";
import { expect } from "vitest";
import type { PrismaClient } from "../../src/lib/prisma.js";

// 거래 흐름 테스트 도우미: 가입 → 공고 → 지원 → 협의 요청 → 조건서 → 양측 서명 → (결제 기록)
export const DAY_MS = 24 * 60 * 60 * 1000;
export const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

export interface Party {
  token: string;
  userId: bigint;
}

export async function signup(
  app: Express,
  role: "CLIENT" | "CREATOR",
  index = 1,
): Promise<Party> {
  const res = await request(app)
    .post("/api/auth/signup")
    .send({
      email: `${role.toLowerCase()}-${index}@example.com`,
      password: "correct-horse-battery",
      name: `${role} ${index}`,
      role,
    });
  expect(res.status).toBe(201);
  return {
    token: String(res.body.accessToken),
    userId: BigInt(String(res.body.user.id)),
  };
}

export const FULL_TERMS = {
  amountKrw: 200_000,
  specification: "3분 성장영상 1편 (가로 1080p)",
  scope: "사진·클립 편집, 자막, 배경음악",
  materials: "사진 50장, 클립 10개",
  deadline: "자료를 확인한 날부터 5일",
  revisions: "일반 수정 2회",
  usageRights: "가족 행사 상영과 개인 SNS 게시",
  cancellation: "제작 시작 전 전액 환불",
};

// 양측 서명으로 계약까지 만든다. paid면 결제 성공 기록도 넣는다(Toss 없이).
export async function signedDeal(
  app: Express,
  prisma: PrismaClient,
  { paid = false, expectedDays = 5 } = {},
) {
  const client = await signup(app, "CLIENT");
  const creator = await signup(app, "CREATOR");
  const recruitmentEndAt = new Date(Date.now() + 3 * DAY_MS);
  const project = await prisma.project.create({
    data: {
      clientId: client.userId,
      title: "돌잔치 성장영상",
      description: "아이의 첫 생일에 상영할 성장영상을 만들고 싶습니다.",
      purpose: VIDEO_PURPOSES[0],
      styles: [VIDEO_STYLES[0]],
      budget: 200_000n,
      recruitmentEndAt,
      deliveryDueDate: new Date(recruitmentEndAt.getTime() + 14 * DAY_MS),
    },
  });
  const applied = await request(app)
    .post(`/api/projects/${project.id}/applications`)
    .set(auth(creator.token))
    .send({
      message: "감성적인 성장영상을 5일 안에 만들어 드릴게요.",
      proposedAmount: 200_000,
      expectedDays,
    });
  const workRequestId = String(applied.body.id);
  await request(app)
    .post(`/api/applications/${workRequestId}/discuss`)
    .set(auth(client.token));
  await request(app)
    .post(`/api/work-requests/${workRequestId}/terms/versions`)
    .set(auth(client.token))
    .send({ commandId: randomUUID(), baseVersionNo: 0, values: FULL_TERMS });
  const signing = await request(app)
    .post(`/api/work-requests/${workRequestId}/terms/versions/1/signing`)
    .set(auth(client.token));
  const sign = (token: string) =>
    request(app)
      .post(`/api/work-requests/${workRequestId}/terms/versions/1/signatures`)
      .set(auth(token))
      .send({
        signerName: "서명자",
        consent: true,
        termsHash: signing.body.termsHash,
      });
  await sign(creator.token);
  const signed = await sign(client.token);
  const contractId = String(signed.body.contract.id);
  expect(contractId).toMatch(/^\d+$/);
  if (paid) {
    await prisma.payment.create({
      data: {
        contractId: BigInt(contractId),
        orderId: randomUUID(),
        amountKrw: 200_000n,
        orderName: "돌잔치 성장영상",
        status: "SUCCEEDED",
        paymentKey: `pk_${randomUUID()}`,
        approvedAt: new Date(),
        createdBy: client.userId,
      },
    });
  }
  return { client, creator, project, workRequestId, contractId };
}
