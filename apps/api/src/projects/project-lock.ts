import type { Prisma } from "../generated/prisma/client.js";

// 프로젝트 행을 잠근다. 지원·선정·거절·마감·삭제는 모두 이 잠금 뒤에 상태를 다시 읽고 판단한다.
// 그래서 "마감 직후의 지원", "두 지원자 동시 선정" 같은 경합이 하나씩 순서대로 처리된다.
export default async function lockProject(
  tx: Prisma.TransactionClient,
  projectId: bigint,
) {
  await tx.$queryRaw`SELECT id FROM projects WHERE id = ${projectId} FOR UPDATE`;
  return tx.project.findUnique({ where: { id: projectId } });
}
