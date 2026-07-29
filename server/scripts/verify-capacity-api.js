import "dotenv/config";
import { authenticate } from "../manageone.js";

// Temporary manual verification script for the ManageOne region capacity API.
// Safe to delete once the real Cloud Health sync job is built.

const REGION_ID = "3A462C0E713B3BF389CC4359D2618F9D";
const REGION_NAME = "Mogadishu-region-hq3";
const CAPACITY_URL = `https://10.20.24.9:26335/rest/capacity/v1/capbase/regions/${REGION_ID}/resource-types/cpu,memory,storage-pool/current-capacities`;
const REQUEST_TIMEOUT_MS = Number(process.env.MANAGEONE_TIMEOUT_MS || 30000);
const MAX_BODY_PRINT_CHARS = 2000;

function truncate(value) {
  if (!value || value.length <= MAX_BODY_PRINT_CHARS) return value || "";
  return `${value.slice(0, MAX_BODY_PRINT_CHARS)}\n...[truncated after ${MAX_BODY_PRINT_CHARS} chars]`;
}

function classifyNetworkError(error) {
  if (error?.name === "AbortError") {
    return `network timeout after ${REQUEST_TIMEOUT_MS}ms`;
  }

  const code = error?.cause?.code || error?.code;
  if (code) {
    return `network failure (${code})`;
  }

  return `network failure (${error instanceof Error ? error.message : String(error || "unknown error")})`;
}

function looksLikeJsonPayload(parsed) {
  return parsed !== null && (Array.isArray(parsed) || typeof parsed === "object");
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function main() {
  console.log(`[CAPACITY VERIFY] Region: ${REGION_NAME} (${REGION_ID})`);
  console.log(`[CAPACITY VERIFY] GET ${CAPACITY_URL}`);

  let session;
  try {
    session = await authenticate();
  } catch (error) {
    console.error(
      `[CAPACITY VERIFY] FAILURE: could not authenticate with ManageOne: ${
        error instanceof Error ? error.message : String(error || "unknown error")
      }`
    );
    process.exitCode = 1;
    return;
  }

  let response;
  let bodyText = "";
  try {
    response = await fetchWithTimeout(CAPACITY_URL, {
      method: "GET",
      headers: {
        Accept: "application/json, text/plain, */*",
        "Content-Type": "application/json",
        "X-Auth-Token": session.token
      },
      redirect: "manual"
    });
    bodyText = await response.text();
  } catch (error) {
    console.error(`[CAPACITY VERIFY] HTTP status: no response`);
    console.error(`[CAPACITY VERIFY] Raw response:`);
    console.error("");
    console.error(`[CAPACITY VERIFY] FAILURE: ${classifyNetworkError(error)}`);
    process.exitCode = 1;
    return;
  }

  console.log(`[CAPACITY VERIFY] HTTP status: ${response.status}`);
  console.log("[CAPACITY VERIFY] Raw response:");
  console.log(truncate(bodyText));

  if (response.status === 401 || response.status === 403) {
    console.error(`[CAPACITY VERIFY] FAILURE: authentication/authorization failure (${response.status})`);
    process.exitCode = 1;
    return;
  }

  if (!response.ok) {
    console.error(`[CAPACITY VERIFY] FAILURE: unexpected HTTP status ${response.status}`);
    process.exitCode = 1;
    return;
  }

  let parsed;
  try {
    parsed = bodyText ? JSON.parse(bodyText) : null;
  } catch {
    console.error("[CAPACITY VERIFY] FAILURE: response was HTTP 2xx but not valid JSON");
    process.exitCode = 1;
    return;
  }

  if (!looksLikeJsonPayload(parsed)) {
    console.error("[CAPACITY VERIFY] FAILURE: response was JSON but did not look like an object/array payload");
    process.exitCode = 1;
    return;
  }

  console.log("[CAPACITY VERIFY] SUCCESS: capacity API returned HTTP 2xx with a JSON payload");
}

main().catch((error) => {
  console.error(
    `[CAPACITY VERIFY] FAILURE: unexpected script error: ${
      error instanceof Error ? error.stack || error.message : String(error || "unknown error")
    }`
  );
  process.exitCode = 1;
});
