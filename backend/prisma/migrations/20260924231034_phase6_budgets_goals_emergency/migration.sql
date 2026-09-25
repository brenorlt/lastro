-- AlterEnum
ALTER TYPE "notification_type" ADD VALUE 'GOAL_COMPLETED';

-- AlterTable
ALTER TABLE "budgets" ADD COLUMN     "fired_thresholds" INTEGER[] DEFAULT ARRAY[]::INTEGER[];

-- AlterTable
ALTER TABLE "emergency_funds" ADD COLUMN     "custom_target" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "monthly_contribution" DECIMAL(18,2);
