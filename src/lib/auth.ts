type AuthUser = {
  fullName: string;
  email: string;
  password?: string;
  company?: string;
  country?: string;
  countryCode?: string;
  phoneCountryCode?: string;
  phone?: string;
  emailVerified?: boolean;
  onboardingCompleted?: boolean;
  organizationName?: string;
  projectName?: string;
  selectedRegion?: string;
  useCase?: string;
  alreadyUsesCloudProvider?: string;
  productsInterest?: string[];
};

type SignUpPayload = {
  fullName: string;
  email: string;
  password: string;
  company: string;
  country?: string;
  countryCode?: string;
  phoneCountryCode?: string;
  phone?: string;
};

const USERS_KEY = "htgclouds_users";
const SESSION_KEY = "htgclouds_session_email";
const PENDING_EMAIL_KEY = "htgclouds_pending_email";

const demoUser: AuthUser = {
  fullName: "HTGClouds Demo",
  email: "demo@htgclouds.com",
  password: "password123",
  company: "HTGClouds",
  emailVerified: true,
  onboardingCompleted: true,
  organizationName: "HTGClouds",
  projectName: "My First Project",
  selectedRegion: "US-East",
  useCase: "Work",
  alreadyUsesCloudProvider: "No",
  productsInterest: ["Elastic Cloud Server", "Storage"]
};

export async function signUp(payload: SignUpPayload) {
  const apiResult = await tryApi("/api/signup", {
    method: "POST",
    body: JSON.stringify(payload)
  });
  if (apiResult) return apiResult;

  const email = normalizeEmail(payload.email);
  const users = readUsers();
  if (users.some((user) => normalizeEmail(user.email) === email)) {
    throw new Error("An account with this email already exists.");
  }

  users.push({
    ...payload,
    email,
    emailVerified: false,
    onboardingCompleted: false,
    organizationName: payload.company,
    projectName: "My First Project",
    selectedRegion: "US-East",
    productsInterest: []
  });
  writeUsers(users);
  writeStorage(PENDING_EMAIL_KEY, email);
  console.info(`[HTGClouds verification] ${email}: any 6-digit code`);

  return { ok: true, email };
}

export async function verifyEmail({ email, code }: { email: string; code: string }) {
  const apiResult = await tryApi("/api/verify-email", {
    method: "POST",
    body: JSON.stringify({ email, code })
  });
  if (apiResult) return apiResult;

  const normalizedEmail = normalizeEmail(email || readStorage(PENDING_EMAIL_KEY) || "");
  if (!normalizedEmail || !/^\d{6}$/.test(code)) {
    throw new Error("Enter a valid 6-digit verification code.");
  }

  const users = readUsers();
  const index = users.findIndex((user) => normalizeEmail(user.email) === normalizedEmail);
  if (index === -1) {
    throw new Error("No pending account was found for this email.");
  }

  users[index] = { ...users[index], emailVerified: true };
  writeUsers(users);
  writeStorage(SESSION_KEY, normalizedEmail);
  removeStorage(PENDING_EMAIL_KEY);

  return {
    ok: true,
    email: normalizedEmail,
    onboardingCompleted: Boolean(users[index].onboardingCompleted)
  };
}

export async function signInWithPassword(email: string, password: string) {
  const apiResult = await tryApi("/api/signin", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
  if (apiResult?.user) return apiResult.user;

  const normalizedEmail = normalizeEmail(email);
  const user = readUsers().find((item) => normalizeEmail(item.email) === normalizedEmail);
  if (!user || user.password !== password) {
    throw new Error("Email or password is incorrect.");
  }

  if (!user.emailVerified) {
    writeStorage(PENDING_EMAIL_KEY, normalizedEmail);
    throw new Error("Please verify your email before signing in.");
  }

  writeStorage(SESSION_KEY, normalizedEmail);
  return withoutPassword(user);
}

export async function getCurrentUser() {
  const apiResult = await tryApi("/api/me", { method: "GET" });
  if (apiResult?.user) return apiResult.user;

  const email = readStorage(SESSION_KEY);
  if (!email) return null;

  const user = readUsers().find((item) => normalizeEmail(item.email) === normalizeEmail(email));
  return user ? withoutPassword(user) : null;
}

export async function saveOnboarding(payload: Partial<AuthUser>) {
  const apiResult = await tryApi("/api/onboarding", {
    method: "POST",
    body: JSON.stringify(payload)
  });
  if (apiResult) return apiResult;

  const email = readStorage(SESSION_KEY);
  if (!email) throw new Error("Authentication required.");

  const users = readUsers();
  const index = users.findIndex((user) => normalizeEmail(user.email) === normalizeEmail(email));
  if (index === -1) throw new Error("Authentication required.");

  users[index] = {
    ...users[index],
    ...payload,
    onboardingCompleted: true,
    productsInterest: Array.isArray(payload.productsInterest) ? payload.productsInterest : []
  };
  writeUsers(users);

  return { ok: true, user: withoutPassword(users[index]) };
}

export async function resetPassword({ email, password }: { email: string; password: string }) {
  const apiResult = await tryApi("/api/reset-password", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
  if (apiResult) return apiResult;

  const normalizedEmail = normalizeEmail(email);
  const users = readUsers();
  const index = users.findIndex((user) => normalizeEmail(user.email) === normalizedEmail);
  if (index === -1) throw new Error("No account was found for that email.");

  users[index] = { ...users[index], password };
  writeUsers(users);
  return { ok: true };
}

export async function logout() {
  await tryApi("/api/logout", { method: "POST" });
  removeStorage(SESSION_KEY);
}

async function tryApi(path: string, options: RequestInit) {
  try {
    const response = await fetch(path, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      }
    });
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) return null;
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Request failed.");
    return data;
  } catch {
    return null;
  }
}

function readUsers() {
  ensureDemoUser();
  return parseUsers(readStorage(USERS_KEY));
}

function writeUsers(users: AuthUser[]) {
  writeStorage(USERS_KEY, JSON.stringify(users));
}

function ensureDemoUser() {
  const users = parseUsers(readStorage(USERS_KEY));
  const index = users.findIndex((user) => normalizeEmail(user.email) === demoUser.email);
  if (index === -1) {
    writeStorage(USERS_KEY, JSON.stringify([demoUser, ...users]));
    return;
  }

  users[index] = { ...users[index], ...demoUser };
  writeStorage(USERS_KEY, JSON.stringify(users));
}

function parseUsers(value: string | null) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? (parsed as AuthUser[]) : [];
  } catch {
    return [];
  }
}

function withoutPassword(user: AuthUser) {
  const { password, ...safeUser } = user;
  return safeUser;
}

function normalizeEmail(email: string) {
  return String(email || "").trim().toLowerCase();
}

function readStorage(key: string) {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(key);
}

function writeStorage(key: string, value: string) {
  if (typeof window !== "undefined") window.localStorage.setItem(key, value);
}

function removeStorage(key: string) {
  if (typeof window !== "undefined") window.localStorage.removeItem(key);
}
