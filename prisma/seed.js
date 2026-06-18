import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const passwordHash = await bcrypt.hash("password123", 12);

await prisma.user.upsert({
  where: { email: "demo@htgclouds.com" },
  update: {
    passwordHash,
    emailVerified: new Date(),
    onboardingCompleted: true,
    organizationName: "HTGClouds",
    projectName: "My First Project",
    selectedRegion: "US-East",
    useCase: "Work",
    alreadyUsesCloudProvider: "No",
    productsInterest: ["Elastic Cloud Server", "Storage"]
  },
  create: {
    fullName: "HTGClouds Demo",
    email: "demo@htgclouds.com",
    passwordHash,
    company: "HTGClouds",
    country: "Somalia",
    countryCode: "SO",
    phoneCountryCode: "+252",
    emailVerified: new Date(),
    onboardingCompleted: true,
    organizationName: "HTGClouds",
    projectName: "My First Project",
    selectedRegion: "US-East",
    useCase: "Work",
    alreadyUsesCloudProvider: "No",
    productsInterest: ["Elastic Cloud Server", "Storage"]
  }
});

console.log("Seeded demo account demo@htgclouds.com / password123");

await prisma.$disconnect();
