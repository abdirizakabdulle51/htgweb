-- Add ManageOne provisioning state and encrypted signup-to-onboarding
-- password handoff fields. IF NOT EXISTS keeps this deployable on staging
-- environments where early columns may already have been added manually.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "manageOneVdcId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "manageOneDomainId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "manageOneGroupId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "manageOneUserId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "provisioningStatus" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "provisioningError" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "provisioningUsername" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "provisioningPasswordCiphertext" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "provisionedAt" TIMESTAMP(3);
