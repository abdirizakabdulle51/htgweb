import "dotenv/config";
import bcrypt from "bcrypt";
import cookieParser from "cookie-parser";
import cors from "cors";
import crypto from "crypto";
import express from "express";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

const app = express();
const prisma = new PrismaClient();
const serverPort = Number(process.env.PORT || process.env.SERVER_PORT || 4001);
const clientUrl = process.env.CLIENT_URL || "http://localhost:5180";
const jwtSecret = process.env.JWT_SECRET || "replace-with-secure-random-secret";
const authCookieName = "htgclouds_token";
const allowedOrigins = new Set([
  clientUrl,
  "https://htgweb.abdirizak-abdulle.workers.dev",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5174",
  "http://localhost:5180",
  "http://127.0.0.1:5180"
]);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Origin is not allowed by CORS."));
    },
    credentials: true
  })
);
app.use(express.json());
app.use(cookieParser());

app.get("/", (_request, response) => {
  response.type("text/plain").send("HTGCloud API is running");
});

app.get("/api/health", (_request, response) => {
  response.json({ status: "ok" });
});

app.post("/api/auth/signup", async (request, response) => {
  try {
    const fullName = clean(request.body.fullName);
    const email = clean(request.body.email).toLowerCase();
    const password = request.body.password || "";
    const country = clean(request.body.country) || null;
    const phoneNumber = clean(request.body.phoneNumber) || null;
    const companyName = clean(request.body.companyName) || null;

    console.log("[AUTH] Signup request:", email);

    if (!fullName || !email || !password || !companyName) {
      throw new HttpError("Please complete the required fields.", 400);
    }

    if (!isEmail(email)) {
      throw new HttpError("Enter a valid email address.", 400);
    }

    if (password.length < 8) {
      throw new HttpError("Password must be at least 8 characters.", 400);
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser?.emailVerified) {
      throw new HttpError("An account with this email already exists.", 409);
    }

    const code = verificationCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    let user = existingUser;

    if (existingUser) {
      await prisma.verificationCode.updateMany({
        where: { userId: existingUser.id, used: false },
        data: { used: true }
      });

      user = await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          fullName,
          country,
          phoneNumber,
          companyName,
          verificationCodes: {
            create: { code, expiresAt }
          }
        }
      });
    } else {
      const passwordHash = await bcrypt.hash(password, 12);
      user = await prisma.user.create({
        data: {
          fullName,
          email,
          passwordHash,
          country,
          phoneNumber,
          companyName,
          verificationCodes: {
            create: { code, expiresAt }
          }
        }
      });
    }

    console.log("[AUTH] User created");
    console.log("========================================");
    console.log("[AUTH] Verification code for", email, ":", code);
    console.log("========================================");

    return response.status(201).json({
      ok: true,
      email: user.email
    });
  } catch (error) {
    console.error("[AUTH] Signup error:", error);
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Signup failed.";
    return response.status(status).json({ error: message });
  }
});

app.get("/api/auth/dev-code", async (request, response) => {
  const email = clean(request.query.email).toLowerCase();

  if (!isEmail(email)) {
    return response.status(400).json({ error: "Enter a valid email address." });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return response.status(404).json({ error: "No user found for that email." });
  }

  const savedCode = await prisma.verificationCode.findFirst({
    where: {
      userId: user.id,
      used: false,
      expiresAt: { gt: new Date() }
    },
    orderBy: { createdAt: "desc" }
  });

  if (!savedCode) {
    return response.status(404).json({ error: "No unused verification code found." });
  }

  return response.json({
    email,
    code: savedCode.code,
    expiresAt: savedCode.expiresAt
  });
});

app.post("/api/auth/resend-verification", async (request, response) => {
  try {
    const email = clean(request.body.email).toLowerCase();

    if (!isEmail(email)) {
      throw new HttpError("Enter a valid email address.", 400);
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new HttpError("No user found for that email.", 404);
    }

    if (user.emailVerified) {
      return response.json({
        success: true,
        ok: true,
        message: "Email already verified"
      });
    }

    const code = verificationCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await prisma.$transaction(async (tx) => {
      await tx.verificationCode.updateMany({
        where: { userId: user.id, used: false },
        data: { used: true, expiresAt: new Date() }
      });

      await tx.verificationCode.create({
        data: {
          userId: user.id,
          code,
          expiresAt
        }
      });
    });

    console.log(`[AUTH] Resent verification code for ${email}: ${code}`);

    return response.json({
      success: true,
      ok: true,
      message: "New verification code generated"
    });
  } catch (error) {
    console.error("[AUTH] Resend verification error:", error);
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Could not resend verification code.";
    return response.status(status).json({ error: message });
  }
});

app.post("/api/auth/forgot-password", async (request, response) => {
  const email = clean(request.body.email).toLowerCase();
  const genericResponse = {
    success: true,
    ok: true,
    message: "If the email exists in our system, a reset link has been generated."
  };

  try {
    console.log("[AUTH] Forgot password request:", email);

    if (!isEmail(email)) {
      return response.json(genericResponse);
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      console.log("[AUTH] Forgot password user found:", false);
      return response.json(genericResponse);
    }

    const token = passwordResetToken();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    const isProduction = process.env.NODE_ENV === "production";

    await prisma.$transaction(async (tx) => {
      await tx.passwordResetToken.updateMany({
        where: {
          userId: user.id,
          usedAt: null,
          expiresAt: { gt: new Date() }
        },
        data: { usedAt: new Date() }
      });

      await tx.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          developmentToken: isProduction ? null : token,
          expiresAt
        }
      });
    });

    const resetLink = `${clientUrl}/reset-password?token=${encodeURIComponent(token)}`;
    console.log("[AUTH] Password reset token generated for:", email);
    if (!isProduction) {
      console.log("========================================");
      console.log("[AUTH] Password reset link for", email, ":", resetLink);
      console.log("========================================");
    }

    return response.json(genericResponse);
  } catch (error) {
    console.error("[AUTH] Forgot password error:", error);
    return response.json(genericResponse);
  }
});

app.get("/api/auth/dev-reset-token", async (request, response) => {
  if (process.env.NODE_ENV === "production") {
    return response.status(404).json({ error: "Not found." });
  }

  const email = clean(request.query.email).toLowerCase();

  if (!isEmail(email)) {
    return response.status(400).json({ error: "Enter a valid email address." });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return response.status(404).json({ error: "No user found for that email." });
  }

  const savedToken = await prisma.passwordResetToken.findFirst({
    where: {
      userId: user.id,
      usedAt: null,
      expiresAt: { gt: new Date() },
      developmentToken: { not: null }
    },
    orderBy: { createdAt: "desc" }
  });

  if (!savedToken?.developmentToken) {
    return response.status(404).json({ error: "No active password reset token found." });
  }

  return response.json({
    email,
    token: savedToken.developmentToken,
    resetLink: `${clientUrl}/reset-password?token=${encodeURIComponent(savedToken.developmentToken)}`,
    expiresAt: savedToken.expiresAt
  });
});

app.post("/api/auth/reset-password", async (request, response) => {
  try {
    const token = clean(request.body.token);
    const password = request.body.password || "";

    console.log("[AUTH] Reset password request received");

    if (!token) {
      throw new HttpError("Password reset token is required.", 400);
    }

    if (password.length < 8) {
      throw new HttpError("Password must be at least 8 characters.", 400);
    }

    const tokenHash = hashToken(token);
    const savedToken = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true }
    });

    if (!savedToken || savedToken.usedAt || savedToken.expiresAt <= new Date()) {
      throw new HttpError("Password reset link is invalid or expired.", 400);
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: savedToken.userId },
        data: { passwordHash }
      });

      await tx.passwordResetToken.update({
        where: { id: savedToken.id },
        data: { usedAt: new Date() }
      });
    });

    console.log("[AUTH] Password reset successful for:", savedToken.user.email);

    return response.json({
      success: true,
      ok: true,
      message: "Password reset successfully."
    });
  } catch (error) {
    console.error("[AUTH] Reset password error:", error);
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Password reset failed.";
    return response.status(status).json({ error: message });
  }
});

app.post("/api/auth/verify-email", async (request, response) => {
  const email = clean(request.body.email).toLowerCase();
  const code = clean(request.body.code);

  console.log("[AUTH] Verify request received");

  if (!isEmail(email) || !/^\d{6}$/.test(code)) {
    return response.status(400).json({ error: "Enter a valid 6-digit verification code." });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return response.status(400).json({ error: "Verification code is invalid or expired." });
  }

  const savedCode = await prisma.verificationCode.findFirst({
    where: {
      userId: user.id,
      code,
      used: false,
      expiresAt: { gt: new Date() }
    },
    orderBy: { createdAt: "desc" }
  });

  if (!savedCode) {
    return response.status(400).json({ error: "Verification code is invalid or expired." });
  }

  console.log("[AUTH] Code matched");

  const updatedUser = await prisma.$transaction(async (tx) => {
    await tx.verificationCode.update({
      where: { id: savedCode.id },
      data: { used: true }
    });

    return tx.user.update({
      where: { id: user.id },
      data: { emailVerified: true },
      include: { onboarding: true }
    });
  });

  setAuthCookie(response, updatedUser);

  console.log("[AUTH] Email verified successfully");

  return response.json({
    success: true,
    ok: true,
    user: userSummary(updatedUser),
    onboardingCompleted: updatedUser.onboardingCompleted,
    emailVerified: updatedUser.emailVerified
  });
});

app.post("/api/auth/signin", async (request, response) => {
  const email = clean(request.body.email).toLowerCase();
  const password = request.body.password || "";

  console.log("[AUTH] Signin request:", email);

  if (!isEmail(email) || !password) {
    return response.status(400).json({ error: "Email and password are required." });
  }

  const user = await prisma.user.findUnique({
    where: { email },
    include: { onboarding: true }
  });

  console.log("[AUTH] User found:", Boolean(user));
  if (!user) {
    console.log("[AUTH] Password valid:", false);
    return response.status(401).json({ error: "Email or password is incorrect." });
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);
  console.log("[AUTH] Password valid:", passwordMatches);
  if (!passwordMatches) {
    return response.status(401).json({ error: "Email or password is incorrect." });
  }

  console.log("[AUTH] Email verified:", user.emailVerified);
  if (!user.emailVerified) {
    return response.status(403).json({ error: "Please verify your email before signing in." });
  }

  setAuthCookie(response, user);

  const redirectTarget = user.onboardingCompleted ? "/dashboard" : "/onboarding";
  console.log("[AUTH] Token issued");
  console.log("[AUTH] Redirect target:", redirectTarget);
  console.log(`[AUTH] Login success for ${email}`);

  return response.json({
    success: true,
    ok: true,
    user: userSummary(user),
    onboardingCompleted: user.onboardingCompleted,
    emailVerified: user.emailVerified
  });
});

app.post("/api/auth/logout", (_request, response) => {
  response.clearCookie(authCookieName, cookieOptions());
  response.json({ ok: true });
});

app.get("/api/auth/me", requireAuth, async (request, response) => {
  const user = userSummary(request.user);
  console.log(
    `[AUTH] /api/auth/me response for ${user.email}: onboardingCompleted=${user.onboardingCompleted}`
  );
  response.json({
    success: true,
    ok: true,
    user,
    onboardingCompleted: user.onboardingCompleted,
    emailVerified: user.emailVerified
  });
});

app.get("/api/auth/debug-user", async (request, response) => {
  if (process.env.NODE_ENV === "production") {
    return response.status(404).json({ error: "Not found." });
  }

  const email = clean(request.query.email).toLowerCase();

  if (!isEmail(email)) {
    return response.status(400).json({ error: "Enter a valid email address." });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return response.status(404).json({ error: "No user found for that email." });
  }

  return response.json({
    email: user.email,
    emailVerified: user.emailVerified,
    onboardingCompleted: user.onboardingCompleted,
    hasPasswordHash: Boolean(user.passwordHash)
  });
});

app.post("/api/onboarding", requireAuth, async (request, response) => {
  const useCase = clean(request.body.useCase) || null;
  const usesCloudProvider = clean(request.body.usesCloudProvider) || null;
  const selectedProducts = Array.isArray(request.body.selectedProducts)
    ? request.body.selectedProducts.filter((product) => typeof product === "string")
    : [];

  const user = await prisma.$transaction(async (tx) => {
    await tx.onboarding.upsert({
      where: { userId: request.user.id },
      update: {
        useCase,
        usesCloudProvider,
        selectedProducts
      },
      create: {
        userId: request.user.id,
        useCase,
        usesCloudProvider,
        selectedProducts
      }
    });

    return tx.user.update({
      where: { id: request.user.id },
      data: { onboardingCompleted: true },
      include: { onboarding: true }
    });
  });

  response.json({ ok: true, user: userSummary(user) });
});

app.use((error, _request, response, _next) => {
  console.error(error);
  response.status(500).json({ error: "Internal server error." });
});

const server = app.listen(serverPort, () => {
  console.log(`[SERVER] HTGCloud API running on http://localhost:${serverPort}`);
});

server.on("error", (error) => {
  console.error("[SERVER] Failed to start HTGCloud API", error);
});

async function requireAuth(request, response, next) {
  const token = request.cookies?.[authCookieName];

  if (!token) {
    return response.status(401).json({ error: "Authentication required." });
  }

  try {
    const payload = jwt.verify(token, jwtSecret);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: { onboarding: true }
    });

    if (!user) {
      return response.status(401).json({ error: "Authentication required." });
    }

    request.user = user;
    return next();
  } catch {
    return response.status(401).json({ error: "Authentication required." });
  }
}

function setAuthCookie(response, user) {
  const token = jwt.sign(
    {
      email: user.email
    },
    jwtSecret,
    {
      subject: user.id,
      expiresIn: "7d"
    }
  );

  response.cookie(authCookieName, token, cookieOptions());
  console.log("[AUTH] Cookie set");
}

function cookieOptions() {
  const isProduction = process.env.NODE_ENV === "production";

  return {
    httpOnly: true,
    sameSite: isProduction ? "none" : "lax",
    secure: isProduction,
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000
  };
}

function userSummary(user) {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    country: user.country,
    phoneNumber: user.phoneNumber,
    companyName: user.companyName,
    company: user.companyName,
    organizationName: user.companyName || user.fullName,
    projectName: "My First Project",
    selectedRegion: "US-East",
    emailVerified: user.emailVerified,
    onboardingCompleted: user.onboardingCompleted,
    useCase: user.onboarding?.useCase || null,
    alreadyUsesCloudProvider: user.onboarding?.usesCloudProvider || null,
    productsInterest: user.onboarding?.selectedProducts || []
  };
}

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function verificationCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function passwordResetToken() {
  return crypto.randomBytes(32).toString("hex");
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

class HttpError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}
