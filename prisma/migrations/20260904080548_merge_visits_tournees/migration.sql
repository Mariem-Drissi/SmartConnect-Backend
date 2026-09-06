/*
  Warnings:

  - You are about to drop the `visit_plan_items` table. If the table is not empty, all the data it contains will be lost.
  - Made the column `visitPlanId` on table `visits` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "visit_plan_items" DROP CONSTRAINT "visit_plan_items_clientId_fkey";

-- DropForeignKey
ALTER TABLE "visit_plan_items" DROP CONSTRAINT "visit_plan_items_visitPlanId_fkey";

-- DropForeignKey
ALTER TABLE "visits" DROP CONSTRAINT "visits_visitPlanId_fkey";

-- AlterTable
ALTER TABLE "visits" ADD COLUMN     "distanceKm" DOUBLE PRECISION,
ADD COLUMN     "order" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "visitPlanId" SET NOT NULL;

-- DropTable
DROP TABLE "visit_plan_items";

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_visitPlanId_fkey" FOREIGN KEY ("visitPlanId") REFERENCES "visit_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
