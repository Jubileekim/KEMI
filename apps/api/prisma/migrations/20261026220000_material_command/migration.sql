-- 제작 자료 재전송 멱등성 (#58 리뷰). 화면이 만든 요청 식별자로 같은 자료가 두 번 생기지 않게 한다.
-- production_materials는 이 PR 묶음에서 처음 만드는 테이블이라 기존 행이 없다(NOT NULL 추가 가능).

-- AlterTable
ALTER TABLE "production_materials" ADD COLUMN     "command_id" UUID NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "production_materials_command_id_key" ON "production_materials"("command_id");
