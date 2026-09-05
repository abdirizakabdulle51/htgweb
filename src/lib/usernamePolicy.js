export const manageOneUsernameMessage =
  "Username must be 3-32 characters, start with a letter, and use only lowercase letters, numbers, underscores, or hyphens.";

export function normalizeManageOneUsername(value) {
  return String(value || "").trim().toLowerCase();
}

export function validateManageOneUsername(value) {
  const username = normalizeManageOneUsername(value);
  return /^[a-z][a-z0-9_-]{2,31}$/.test(username);
}

export const manageOneTenantNameMessage =
  "Company name must produce a tenant name that starts with a letter and uses only letters, numbers, hyphens, or underscores.";

export function normalizeManageOneTenantName(value) {
  const cleaned = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return cleaned || `tenant-${Date.now()}`;
}

export function validateManageOneTenantName(value) {
  const tenantName = normalizeManageOneTenantName(value);
  return /^[a-z][a-z0-9_-]*$/.test(tenantName) && !/^(op_|shadow_)/.test(tenantName);
}
