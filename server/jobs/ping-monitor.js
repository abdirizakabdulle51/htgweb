import "dotenv/config";
import { spawn } from "child_process";

const CRM_TARGETS_URL = "https://crm-api.102-203-134-106.sslip.io/ping-targets/list";
const CRM_RESULTS_URL = "https://crm-api.102-203-134-106.sslip.io/ping-results/sync";
const PING_MONITOR_REQUEST_TIMEOUT_MS = 30000;
const PING_TIMEOUT_MS = 3000;
const MAX_TARGETS_PER_RUN = 50;

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

async function fetchTextWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PING_MONITOR_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    const text = await response.text();
    return { response, text };
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`HTTP request timed out after ${PING_MONITOR_REQUEST_TIMEOUT_MS}ms`);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function parseJson(text, label) {
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`${label} returned invalid JSON`);
  }
}

function normalizeTargets(body) {
  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.targets)) return body.targets;
  if (Array.isArray(body?.data)) return body.data;
  return [];
}

function targetId(target) {
  return target?.targetId || target?.id || target?._id || null;
}

function targetIp(target) {
  return target?.ip || target?.ipAddress || target?.address || target?.host || null;
}

function parseLatencyMs(output) {
  const match = output.match(/time[=<]([0-9.]+)\s*ms/i);
  if (!match) return null;

  const latency = Number(match[1]);
  return Number.isFinite(latency) ? latency : null;
}

function pingTarget(target) {
  const id = targetId(target);
  const ip = targetIp(target);
  const checkedAt = Date.now();

  return new Promise((resolve) => {
    if (!id || !ip) {
      resolve({
        targetId: id,
        success: false,
        latencyMs: null,
        error: "target is missing targetId or ip",
        checkedAt
      });
      return;
    }

    const child = spawn("ping", ["-c", "1", "-W", "2", ip], {
      windowsHide: true
    });
    let output = "";
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGKILL");
      resolve({
        targetId: id,
        success: false,
        latencyMs: null,
        error: `ping timed out after ${PING_TIMEOUT_MS}ms`,
        checkedAt
      });
    }, PING_TIMEOUT_MS);

    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      output += chunk.toString();
    });

    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve({
        targetId: id,
        success: false,
        latencyMs: null,
        error: error.message,
        checkedAt
      });
    });

    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);

      const latencyMs = parseLatencyMs(output);
      const success = code === 0;
      resolve({
        targetId: id,
        success,
        latencyMs,
        error: success ? null : output.trim().slice(0, 500) || `ping exited with code ${code}`,
        checkedAt
      });
    });
  });
}

async function fetchTargets(syncSecret) {
  const { response, text } = await fetchTextWithTimeout(CRM_TARGETS_URL, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "X-Sync-Secret": syncSecret
    }
  });

  const body = parseJson(text, "CRM ping targets response");
  if (!response.ok) {
    throw new Error(`CRM ping targets fetch failed: HTTP ${response.status}${text ? ` ${text}` : ""}`);
  }

  return normalizeTargets(body);
}

async function pushResults(syncSecret, results) {
  const { response, text } = await fetchTextWithTimeout(CRM_RESULTS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-Sync-Secret": syncSecret
    },
    body: JSON.stringify(results)
  });

  if (!response.ok) {
    throw new Error(`CRM ping results sync failed: HTTP ${response.status}${text ? ` ${text}` : ""}`);
  }
}

async function main() {
  const syncSecret = requireEnv("CLOUD_HEALTH_SYNC_SECRET");
  const targets = await fetchTargets(syncSecret);
  const limitedTargets = targets.slice(0, MAX_TARGETS_PER_RUN);

  if (targets.length > MAX_TARGETS_PER_RUN) {
    console.warn(
      `[PING MONITOR] target cap applied: processing ${MAX_TARGETS_PER_RUN}/${targets.length} target(s)`
    );
  }

  const results = [];
  for (let index = 0; index < limitedTargets.length; index += 1) {
    const target = limitedTargets[index];
    console.log(`[PING MONITOR] checking target ${index + 1}/${limitedTargets.length}: ${targetIp(target) || "<no-ip>"}`);
    results.push(await pingTarget(target));
  }

  await pushResults(syncSecret, results);
  const successes = results.filter((result) => result.success).length;
  console.log(`[PING MONITOR] completed: ${successes}/${results.length} target(s) reachable`);
}

main().catch((error) => {
  console.error(
    `[PING MONITOR] failed: ${
      error instanceof Error ? error.stack || error.message : String(error || "Unknown error")
    }`
  );
  process.exitCode = 1;
});
