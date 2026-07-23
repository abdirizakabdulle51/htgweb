export const manageOneUsernameMessage =
  "Username must be 3-32 characters, start with a letter, and use only lowercase letters, numbers, underscores, or hyphens.";

export function normalizeManageOneUsername(value) {
  return String(value || "").trim().toLowerCase();
}

export function validateManageOneUsername(value) {
  const username = normalizeManageOneUsername(value);
  return /^[a-z][a-z0-9_-]{2,31}$/.test(username);
}
