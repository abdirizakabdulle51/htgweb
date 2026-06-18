ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phoneNumber" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "companyName" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerifiedNew" BOOLEAN NOT NULL DEFAULT false;

UPDATE "User" SET "phoneNumber" = "phone" WHERE "phoneNumber" IS NULL AND EXISTS (
  SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'phone'
);

UPDATE "User" SET "companyName" = "company" WHERE "companyName" IS NULL AND EXISTS (
  SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'company'
);

UPDATE "User" SET "emailVerifiedNew" = ("emailVerified" IS NOT NULL) WHERE EXISTS (
  SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'emailVerified'
);

ALTER TABLE "User" DROP COLUMN IF EXISTS "countryCode";
ALTER TABLE "User" DROP COLUMN IF EXISTS "phoneCountryCode";
ALTER TABLE "User" DROP COLUMN IF EXISTS "phone";
ALTER TABLE "User" DROP COLUMN IF EXISTS "company";
ALTER TABLE "User" DROP COLUMN IF EXISTS "emailVerified";
ALTER TABLE "User" DROP COLUMN IF EXISTS "verificationCode";
ALTER TABLE "User" DROP COLUMN IF EXISTS "verificationCodeExpiresAt";
ALTER TABLE "User" DROP COLUMN IF EXISTS "verificationLoginToken";
ALTER TABLE "User" DROP COLUMN IF EXISTS "verificationLoginTokenExpiresAt";
ALTER TABLE "User" DROP COLUMN IF EXISTS "organizationName";
ALTER TABLE "User" DROP COLUMN IF EXISTS "projectName";
ALTER TABLE "User" DROP COLUMN IF EXISTS "selectedRegion";
ALTER TABLE "User" DROP COLUMN IF EXISTS "useCase";
ALTER TABLE "User" DROP COLUMN IF EXISTS "alreadyUsesCloudProvider";
ALTER TABLE "User" DROP COLUMN IF EXISTS "productsInterest";
ALTER TABLE "User" RENAME COLUMN "emailVerifiedNew" TO "emailVerified";

CREATE TABLE IF NOT EXISTS "VerificationCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VerificationCode_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Onboarding" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "useCase" TEXT,
    "usesCloudProvider" TEXT,
    "selectedProducts" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Onboarding_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "VerificationCode_userId_code_idx" ON "VerificationCode"("userId", "code");
CREATE UNIQUE INDEX IF NOT EXISTS "Onboarding_userId_key" ON "Onboarding"("userId");

ALTER TABLE "VerificationCode"
  ADD CONSTRAINT "VerificationCode_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Onboarding"
  ADD CONSTRAINT "Onboarding_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
