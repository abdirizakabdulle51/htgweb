import "dotenv/config";
import bcrypt from "bcrypt";
import cookieParser from "cookie-parser";
import cors from "cors";
import crypto from "crypto";
import express from "express";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import { generateInvoicePdf, invoicePdfFilename } from "./invoicePdf.js";
import { sendVerificationCodeEmail, sendPasswordResetEmail, sendRelayEmail } from "./mailer.js";
import * as manageOne from "./manageone.js";
import { validateManageOnePassword } from "../src/lib/passwordPolicy.js";
import {
  normalizePhoneNumberForCountry,
  phoneValidationMessage,
  validatePhoneNumberForCountry
} from "../src/lib/phone.js";
import {
  manageOneUsernameMessage,
  normalizeManageOneUsername,
  validateManageOneUsername
} from "../src/lib/usernamePolicy.js";

const app = express();
const prisma = new PrismaClient();
const serverPort = Number(process.env.PORT || process.env.SERVER_PORT || 4001);
const productionClientUrl = "https://htgweb.abdirizak-abdulle.workers.dev";
const localClientUrl = "http://localhost:5180";
const clientUrl =
  process.env.CLIENT_URL || (process.env.NODE_ENV === "production" ? productionClientUrl : localClientUrl);
const devResetTokenEndpointEnabled =
  process.env.ENABLE_DEV_RESET_TOKEN_ENDPOINT === "true" && process.env.NODE_ENV !== "production";
const jwtSecret = process.env.JWT_SECRET || "replace-with-secure-random-secret";
const authCookieName = "htgclouds_token";
const provisioningPasswordKey = crypto.scryptSync(jwtSecret, "manageone-provisioning", 32);
const mailRelayRateLimitWindowMs = 60 * 1000;
const mailRelayRateLimitMax = 30;
const mailRelayRequests = [];
const allowedOrigins = new Set([
  clientUrl,
  "https://htgclouds.com",
  "https://www.htgclouds.com",
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
app.use("/internal/send-invoice-email", express.json({ limit: "1mb" }));
app.use(express.json({ limit: "200kb" }));
app.use(cookieParser());

app.get("/", (_request, response) => {
  response.type("text/plain").send("HTGCloud API is running");
});

app.get("/api/health", (_request, response) => {
  response.json({ status: "ok" });
});

app.post("/internal/send-email", async (request, response) => {
  const configuredSecret = process.env.MAIL_RELAY_SECRET;
  const providedSecret = request.get("X-Mail-Relay-Secret");

  if (!configuredSecret || providedSecret !== configuredSecret) {
    return response.status(401).json({ success: false, error: "Unauthorized." });
  }

  if (!allowMailRelayRequest()) {
    return response.status(429).json({ success: false, error: "Email relay rate limit exceeded." });
  }

  try {
    const to = clean(request.body?.to).toLowerCase();
    const subject = clean(request.body?.subject);
    const html = typeof request.body?.html === "string" ? request.body.html.trim() : "";
    const text = typeof request.body?.text === "string" ? request.body.text.trim() : "";

    if (!isEmail(to)) {
      throw new HttpError("Enter a valid recipient email address.", 400);
    }

    if (!subject) {
      throw new HttpError("Email subject is required.", 400);
    }

    if (!html) {
      throw new HttpError("Email HTML body is required.", 400);
    }

    if (Buffer.byteLength(html, "utf8") > 200 * 1024) {
      throw new HttpError("Email HTML body must be 200KB or smaller.", 400);
    }

    await sendRelayEmail({ to, subject, html, text });
    return response.json({ success: true });
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 502;
    const message = error instanceof Error ? error.message : "Email delivery failed.";

    if (status === 502) {
      const to = clean(request.body?.to).toLowerCase();
      const subject = clean(request.body?.subject);
      console.error(`[MAIL RELAY] Failed to send to ${to || "[missing recipient]"} subject="${subject || "[missing subject]"}":`, error);
    }

    return response.status(status).json({ success: false, error: message });
  }
});

app.post("/internal/send-invoice-email", async (request, response) => {
  const configuredSecret = process.env.MAIL_RELAY_SECRET;
  const providedSecret = request.get("X-Mail-Relay-Secret");

  if (!configuredSecret || providedSecret !== configuredSecret) {
    return response.status(401).json({ success: false, error: "Unauthorized." });
  }

  if (!allowMailRelayRequest()) {
    return response.status(429).json({ success: false, error: "Email relay rate limit exceeded." });
  }

  try {
    const to = clean(request.body?.to).toLowerCase();
    const subject = clean(request.body?.subject);
    const html = typeof request.body?.html === "string" ? request.body.html.trim() : "";
    const text = typeof request.body?.text === "string" ? request.body.text.trim() : "";
    const invoice = request.body?.invoice;

    if (!isEmail(to)) {
      throw new HttpError("Enter a valid recipient email address.", 400);
    }

    if (!subject) {
      throw new HttpError("Email subject is required.", 400);
    }

    if (!html) {
      throw new HttpError("Email HTML body is required.", 400);
    }

    if (Buffer.byteLength(html, "utf8") > 200 * 1024) {
      throw new HttpError("Email HTML body must be 200KB or smaller.", 400);
    }

    const requestStartedAt = Date.now();
    validateInvoiceSnapshot(invoice);

    const pdfStartedAt = Date.now();
    const pdfBuffer = await generateInvoicePdf(invoice);
    const pdfDurationMs = Date.now() - pdfStartedAt;
    if (pdfBuffer.byteLength > 5 * 1024 * 1024) {
      throw new HttpError("Generated invoice PDF must be 5MB or smaller.", 400);
    }

    await sendRelayEmail({
      to,
      subject,
      html,
      text,
      attachments: [
        {
          filename: invoicePdfFilename(invoice.invoiceNumber),
          content: pdfBuffer,
          contentType: "application/pdf"
        }
      ]
    });

    console.log(
      `[INVOICE MAIL RELAY] Sent ${clean(invoice.invoiceNumber) || "[invoice]"} to ${to} ` +
        `in ${Date.now() - requestStartedAt}ms (pdf=${pdfDurationMs}ms, size=${pdfBuffer.byteLength} bytes).`
    );

    return response.json({ success: true });
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 502;
    const message = error instanceof Error ? error.message : "Invoice email delivery failed.";

    if (status === 502) {
      const to = clean(request.body?.to).toLowerCase();
      const subject = clean(request.body?.subject);
      console.error(
        `[INVOICE MAIL RELAY] Failed to send to ${to || "[missing recipient]"} subject="${subject || "[missing subject]"}":`,
        error
      );
    }

    return response.status(status).json({ success: false, error: message });
  }
});

app.post("/api/auth/signup", async (request, response) => {
  try {
    const fullName = clean(request.body.fullName);
    const email = clean(request.body.email).toLowerCase();
    const password = request.body.password || "";
    const country = clean(request.body.country) || null;
    let phoneNumber = clean(request.body.phoneNumber) || null;
    const companyName = clean(request.body.companyName) || null;
    let username = clean(request.body.username) || null;

    console.log("[AUTH] Signup request:", email);

    if (!fullName || !email || !password || !companyName) {
      throw new HttpError("Please complete the required fields.", 400);
    }

    if (!isEmail(email)) {
      throw new HttpError("Enter a valid email address.", 400);
    }

    const provisioningEnabled = process.env.MANAGEONE_ENABLED === "true";
    if (provisioningEnabled) {
      username = normalizeManageOneUsername(username);
      if (!validateManageOneUsername(username)) {
        throw new HttpError(manageOneUsernameMessage, 400);
      }

      try {
        await manageOne.assertTenantUsernameAvailable(username);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error || "");
        if (/already exists in ManageOne|username already exists|movdc-01109/i.test(message)) {
          throw new HttpError("This username is already used by another cloud account. Choose a different username.", 409);
        }

        console.warn(`[AUTH] ManageOne username preflight skipped for ${username}: ${safeProvisioningError(error)}`);
      }
    }

    const passwordValidation = validateManageOnePassword(password, {
      username,
      email,
      phone: phoneNumber
    });

    if (!passwordValidation.valid) {
      throw new HttpError("Password must meet the HTG Clouds console password requirements.", 400);
    }

    if (phoneNumber && !validatePhoneNumberForCountry(phoneNumber, country)) {
      throw new HttpError(phoneValidationMessage(country), 400);
    }
    phoneNumber = phoneNumber ? normalizePhoneNumberForCountry(phoneNumber, country) : null;

    if (provisioningEnabled && phoneNumber) {
      try {
        await manageOne.assertTenantPhoneAvailable(phoneNumber);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error || "");
        if (/phone number already exists in ManageOne|phone number already exists|movdc-01111/i.test(message)) {
          throw new HttpError(
            "This phone number is already linked to another cloud account. Use a different number or contact support.",
            409
          );
        }

        console.warn(`[AUTH] ManageOne phone preflight skipped for ${phoneNumber}: ${safeProvisioningError(error)}`);
      }
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser?.emailVerified) {
      throw new HttpError("An account with this email already exists.", 409);
    }

    const code = verificationCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    const provisioningPasswordCiphertext = provisioningEnabled ? encryptProvisioningPassword(password) : null;
    const provisioningUsername = provisioningEnabled ? username || email : null;
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
          provisioningStatus: provisioningPasswordCiphertext ? "pending_onboarding" : existingUser.provisioningStatus,
          provisioningError: provisioningPasswordCiphertext ? null : existingUser.provisioningError,
          provisioningPasswordCiphertext,
          provisioningUsername,
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
          provisioningStatus: provisioningPasswordCiphertext ? "pending_onboarding" : null,
          provisioningPasswordCiphertext,
          provisioningUsername,
          verificationCodes: {
            create: { code, expiresAt }
          }
        }
      });
    }

    console.log("[AUTH] User created");

    await sendVerificationCodeEmail({ to: email, code, fullName });

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
  if (!devResetTokenEndpointEnabled) {
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

    await sendVerificationCodeEmail({ to: email, code, fullName: user.fullName });

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

    const resetUrl = passwordResetUrl(token);
    console.log("[AUTH] Password reset token generated for:", email);
    await deliverPasswordReset({ email, resetUrl });

    return response.json(genericResponse);
  } catch (error) {
    console.error("[AUTH] Forgot password error:", error);
    return response.json(genericResponse);
  }
});

app.get("/api/auth/dev-reset-token", async (request, response) => {
  if (!devResetTokenEndpointEnabled) {
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
    resetLink: passwordResetUrl(savedToken.developmentToken),
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
  const accountType = clean(request.body.accountType) || null;
  const budget = clean(request.body.budget) || null;
  const timeline = clean(request.body.timeline) || null;
  const selectedProducts = Array.isArray(request.body.selectedProducts)
    ? request.body.selectedProducts.filter((product) => typeof product === "string")
    : [];

  let user = await prisma.$transaction(async (tx) => {
    await tx.onboarding.upsert({
      where: { userId: request.user.id },
      update: {
        useCase,
        usesCloudProvider,
        accountType,
        budget,
        timeline,
        selectedProducts
      },
      create: {
        userId: request.user.id,
        useCase,
        usesCloudProvider,
        accountType,
        budget,
        timeline,
        selectedProducts
      }
    });

    return tx.user.update({
      where: { id: request.user.id },
      data: { onboardingCompleted: true },
      include: { onboarding: true }
    });
  });

  if (process.env.MANAGEONE_ENABLED === "true" && !user.manageOneUserId) {
    const provisioningLock = await prisma.user.updateMany({
      where: {
        id: user.id,
        manageOneUserId: null,
        NOT: {
          provisioningStatus: "provisioning"
        }
      },
      data: {
        provisioningStatus: "provisioning",
        provisioningError: null
      }
    });

    if (provisioningLock.count === 0) {
      user = await prisma.user.findUnique({
        where: { id: user.id },
        include: { onboarding: true }
      });
      console.log(`[MANAGEONE] Provisioning already in progress for ${user.email}`);
      return response.json({ ok: true, user: userSummary(user) });
    }

    try {
      if (!user.provisioningPasswordCiphertext) {
        throw new Error("Missing encrypted provisioning password handoff.");
      }

      const provisioningResult = await manageOne.provisionTenant({
        companyName: user.companyName,
        fullName: user.fullName,
        email: user.email,
        phoneNumber: user.phoneNumber,
        username: user.provisioningUsername || user.email,
        plaintextPassword: decryptProvisioningPassword(user.provisioningPasswordCiphertext)
      });

      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          manageOneVdcId: provisioningResult.vdcId,
          manageOneDomainId: provisioningResult.domainId,
          manageOneGroupId: provisioningResult.groupId,
          manageOneUserId: provisioningResult.userId,
          provisioningStatus: "provisioned",
          provisioningError: null,
          provisioningPasswordCiphertext: null,
          provisionedAt: new Date()
        },
        include: { onboarding: true }
      });
      console.log(`[MANAGEONE] Tenant provisioned for ${user.email}`);
    } catch (error) {
      const provisioningError = safeProvisioningError(error);
      console.error("[MANAGEONE] Tenant provisioning failed:", provisioningError);

      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          provisioningStatus: "failed",
          provisioningError
        },
        include: { onboarding: true }
      });
    }
  }

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
    provisioningStatus: user.provisioningStatus,
    provisioningUsername: user.provisioningUsername,
    manageOneUserId: user.manageOneUserId,
    manageOneVdcId: user.manageOneVdcId,
    manageOneDomainId: user.manageOneDomainId,
    provisionedAt: user.provisionedAt,
    useCase: user.onboarding?.useCase || null,
    alreadyUsesCloudProvider: user.onboarding?.usesCloudProvider || null,
    productsInterest: user.onboarding?.selectedProducts || []
  };
}

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function validateInvoiceSnapshot(invoice) {
  if (!invoice || typeof invoice !== "object" || Array.isArray(invoice)) {
    throw new HttpError("Invoice snapshot is required.", 400);
  }

  if (!clean(invoice.invoiceNumber)) {
    throw new HttpError("Invoice number is required.", 400);
  }

  if (!clean(invoice.companyName) && !clean(invoice.customerName)) {
    throw new HttpError("Invoice customer name is required.", 400);
  }

  if (!Array.isArray(invoice.lineItems) || invoice.lineItems.length === 0) {
    throw new HttpError("Invoice line items are required.", 400);
  }

  if (invoice.lineItems.length > 12) {
    throw new HttpError("Invoice PDF email supports up to 12 line items.", 400);
  }

  invoice.lineItems.forEach((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new HttpError(`Invoice line item ${index + 1} is invalid.`, 400);
    }

    if (!clean(item.itemName) && !clean(item.description)) {
      throw new HttpError(`Invoice line item ${index + 1} description is required.`, 400);
    }

    const quantity = Number(item.quantity);
    const unitPrice = Number(item.unitPrice ?? item.rate ?? 0);
    const amount = Number(item.monthlyTotal ?? item.amount ?? quantity * unitPrice);

    if (!Number.isFinite(quantity) || quantity < 0) {
      throw new HttpError(`Invoice line item ${index + 1} quantity is invalid.`, 400);
    }

    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      throw new HttpError(`Invoice line item ${index + 1} unit price is invalid.`, 400);
    }

    if (!Number.isFinite(amount) || amount < 0) {
      throw new HttpError(`Invoice line item ${index + 1} amount is invalid.`, 400);
    }
  });
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function allowMailRelayRequest() {
  const now = Date.now();
  while (mailRelayRequests.length && mailRelayRequests[0] <= now - mailRelayRateLimitWindowMs) {
    mailRelayRequests.shift();
  }

  if (mailRelayRequests.length >= mailRelayRateLimitMax) {
    return false;
  }

  mailRelayRequests.push(now);
  return true;
}

function verificationCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function passwordResetToken() {
  return crypto.randomBytes(32).toString("hex");
}

function passwordResetUrl(token) {
  return `${clientUrl.replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(token)}`;
}

async function deliverPasswordReset({ email, resetUrl }) {
  await sendPasswordResetEmail({ to: email, resetUrl });
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function encryptProvisioningPassword(password) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", provisioningPasswordKey, iv);
  const encrypted = Buffer.concat([cipher.update(password, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `v1:${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

function decryptProvisioningPassword(ciphertext) {
  const [version, ivHex, authTagHex, encryptedHex] = String(ciphertext || "").split(":");
  if (version !== "v1" || !ivHex || !authTagHex || !encryptedHex) {
    throw new Error("Invalid encrypted provisioning password format.");
  }

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    provisioningPasswordKey,
    Buffer.from(ivHex, "hex")
  );
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, "hex")),
    decipher.final()
  ]).toString("utf8");
}

function safeProvisioningError(error) {
  const message = error instanceof Error ? error.message : String(error || "Unknown ManageOne error");
  return message
    .replace(/("password"\s*:\s*")[^"]+/gi, "$1[REDACTED]")
    .replace(/(password=)[^&\s]+/gi, "$1[REDACTED]")
    .replace(/(Cookie:\s*)[^\n]+/gi, "$1[REDACTED]")
    .slice(0, 1000);
}

class HttpError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}
