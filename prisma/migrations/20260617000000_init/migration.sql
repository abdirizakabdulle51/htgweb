CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "country" TEXT,
    "countryCode" TEXT,
    "phoneCountryCode" TEXT,
    "phone" TEXT,
    "company" TEXT,
    "emailVerified" TIMESTAMP(3),
    "verificationCode" TEXT,
    "verificationCodeExpiresAt" TIMESTAMP(3),
    "verificationLoginToken" TEXT,
    "verificationLoginTokenExpiresAt" TIMESTAMP(3),
    "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
    "organizationName" TEXT,
    "projectName" TEXT,
    "selectedRegion" TEXT,
    "useCase" TEXT,
    "alreadyUsesCloudProvider" TEXT,
    "productsInterest" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_verificationLoginToken_key" ON "User"("verificationLoginToken");
