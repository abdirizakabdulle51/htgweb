import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const passwordHash = await bcrypt.hash("password123", 12);

await prisma.user.upsert({
  where: { email: "demo@htgclouds.com" },
  update: {
    passwordHash,
    emailVerified: true,
    onboardingCompleted: true,
    onboarding: {
      upsert: {
        update: {
          useCase: "Work",
          usesCloudProvider: "No",
          selectedProducts: ["Elastic Cloud Server", "Storage"]
        },
        create: {
          useCase: "Work",
          usesCloudProvider: "No",
          selectedProducts: ["Elastic Cloud Server", "Storage"]
        }
      }
    }
  },
  create: {
    fullName: "HTGClouds Demo",
    email: "demo@htgclouds.com",
    passwordHash,
    companyName: "HTGClouds",
    country: "Somalia",
    phoneNumber: "+252 61 1234567",
    emailVerified: true,
    onboardingCompleted: true,
    onboarding: {
      create: {
        useCase: "Work",
        usesCloudProvider: "No",
        selectedProducts: ["Elastic Cloud Server", "Storage"]
      }
    }
  }
});

console.log("Seeded demo account demo@htgclouds.com / password123");

await prisma.$disconnect();
