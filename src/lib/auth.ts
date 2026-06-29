type AuthUser = {
  id?: string;
  fullName: string;
  email: string;
  company?: string;
  companyName?: string;
  country?: string;
  phoneNumber?: string;
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

const LOCAL_API_BASE_URL = "http://localhost:4001";
const PRODUCTION_API_BASE_URL = "https://htgweb.onrender.com";
const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL || "";
const configuredApiIsLocal =
  configuredApiBaseUrl.includes("localhost") || configuredApiBaseUrl.includes("127.0.0.1");

const API_BASE_URL = (
  import.meta.env.PROD && (!configuredApiBaseUrl || configuredApiIsLocal)
    ? PRODUCTION_API_BASE_URL
    : configuredApiBaseUrl || LOCAL_API_BASE_URL
).replace(/\/$/, "");

export async function signUp(payload: SignUpPayload) {
  return apiRequest("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify({
      fullName: payload.fullName,
      email: payload.email,
      password: payload.password,
      country: payload.country,
      phoneNumber: payload.phone,
      companyName: payload.company
    })
  });
}

export async function verifyEmail({ email, code }: { email: string; code: string }) {
  return apiRequest("/api/auth/verify-email", {
    method: "POST",
    body: JSON.stringify({ email, code })
  });
}

export async function resendVerificationEmail(email: string) {
  return apiRequest("/api/auth/resend-verification", {
    method: "POST",
    body: JSON.stringify({ email })
  });
}

export async function requestPasswordReset(email: string) {
  return apiRequest("/api/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email })
  });
}

export async function getDevResetToken(email: string) {
  return apiRequest(`/api/auth/dev-reset-token?email=${encodeURIComponent(email)}`, {
    method: "GET"
  });
}

export async function signInWithPassword(email: string, password: string) {
  return apiRequest("/api/auth/signin", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
}

export async function getCurrentUser() {
  try {
    const data = await apiRequest("/api/auth/me", { method: "GET" });
    return data.user || null;
  } catch (error) {
    if (error instanceof AuthApiError && error.status === 401) return null;
    throw error;
  }
}

export async function saveOnboarding(payload: Partial<AuthUser>) {
  return apiRequest("/api/onboarding", {
    method: "POST",
    body: JSON.stringify({
      useCase: payload.useCase,
      usesCloudProvider: payload.alreadyUsesCloudProvider,
      selectedProducts: payload.productsInterest || []
    })
  });
}

export async function resetPassword({ token, password }: { token: string; password: string }) {
  return apiRequest("/api/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, password })
  });
}

export async function logout() {
  try {
    await apiRequest("/api/auth/logout", { method: "POST" });
  } catch (error) {
    if (!(error instanceof AuthApiError && error.status === 401)) throw error;
  }
}

async function apiRequest(path: string, options: RequestInit) {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      }
    });
  } catch (error) {
    console.error(`HTGCloud API request failed: ${API_BASE_URL}${path}`, error);
    throw new AuthApiError(
      `Cannot reach HTGCloud API at ${API_BASE_URL}. Start the backend with npm run server.`,
      0
    );
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new AuthApiError(data.error || "Request failed.", response.status);
  }

  return data;
}

class AuthApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AuthApiError";
    this.status = status;
  }
}
