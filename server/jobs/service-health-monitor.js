import "dotenv/config";
import dns from "dns/promises";
import net from "net";

const CRM_TARGETS_URL = "https://crm-api.102-203-134-106.sslip.io/service-health-targets/list";
const CRM_RESULTS_URL = "https://crm-api.102-203-134-106.sslip.io/service-health-results/sync";
const SERVICE_HEALTH_REQUEST_TIMEOUT_MS = 30000;
const CHECK_TIMEOUT_MS = 8000;
const MAX_TARGETS_PER_RUN = 50;

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

async function fetchTextWithTimeout(url, options = {}, timeoutMs = SERVICE_HEALTH_REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    const text = await response.text();
    return { response, text };
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`HTTP request timed out after ${timeoutMs}ms`);
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

function targetValue(target) {
  return target?.target || target?.url || target?.host || target?.hostname || target?.address || null;
}

function checkedAt() {
  return Date.now();
}

function baseResult(target) {
  return {
    targetId: targetId(target),
    checkedAt: checkedAt()
  };
}

function compactResult(result) {
  return Object.fromEntries(
    Object.entries(result).filter(([, value]) => value !== undefined && value !== null)
  );
}

function expectedStatusCode(target) {
  const statusCode = Number(target?.expectedStatusCode);
  return Number.isInteger(statusCode) ? statusCode : null;
}

async function checkHttpTarget(target) {
  const id = targetId(target);
  const url = targetValue(target);
  const result = baseResult(target);

  if (!id || !url) {
    return compactResult({
      ...result,
      success: false,
      latencyMs: 0,
      error: "HTTP target is missing targetId or target"
    });
  }

  const startedAt = Date.now();
  try {
    const { response, text } = await fetchTextWithTimeout(
      url,
      {
        method: "GET",
        headers: {
          Accept: "text/plain, text/html, application/json, */*"
        },
        redirect: "follow"
      },
      CHECK_TIMEOUT_MS
    );
    const latencyMs = Date.now() - startedAt;
    const expectedStatus = expectedStatusCode(target);
    const expectedBody = target?.expectedResponseContains;
    const statusMatches = expectedStatus ? response.status === expectedStatus : response.ok;
    const bodyMatches = expectedBody ? text.includes(String(expectedBody)) : true;
    const success = statusMatches && bodyMatches;

    return compactResult({
      ...result,
      success,
      latencyMs,
      statusCode: response.status,
      error: success
        ? null
        : [
            statusMatches ? null : `expected status ${expectedStatus || "2xx"}, got ${response.status}`,
            bodyMatches ? null : "expected response text was not found"
          ]
            .filter(Boolean)
            .join("; ")
    });
  } catch (error) {
    return compactResult({
      ...result,
      success: false,
      latencyMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error || "Unknown HTTP error")
    });
  }
}

function parseTcpTarget(value) {
  if (!value) return null;

  try {
    const parsed = value.includes("://") ? new URL(value) : new URL(`tcp://${value}`);
    const port = Number(parsed.port);
    if (!parsed.hostname || !Number.isInteger(port) || port <= 0) return null;
    return { host: parsed.hostname, port };
  } catch {
    const match = String(value).match(/^(.+):(\d+)$/);
    if (!match) return null;
    const port = Number(match[2]);
    if (!Number.isInteger(port) || port <= 0) return null;
    return { host: match[1], port };
  }
}

function checkTcpTarget(target) {
  const id = targetId(target);
  const parsedTarget = parseTcpTarget(targetValue(target));
  const result = baseResult(target);

  return new Promise((resolve) => {
    if (!id || !parsedTarget) {
      resolve(
        compactResult({
          ...result,
          success: false,
          latencyMs: 0,
          error: "TCP target is missing targetId or valid host:port target"
        })
      );
      return;
    }

    const startedAt = Date.now();
    const socket = net.createConnection(parsedTarget);
    let settled = false;

    const finish = (success, error) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(
        compactResult({
          ...result,
          success,
          latencyMs: Date.now() - startedAt,
          error
        })
      );
    };

    socket.setTimeout(CHECK_TIMEOUT_MS);
    socket.once("connect", () => finish(true, null));
    socket.once("timeout", () => finish(false, `TCP connection timed out after ${CHECK_TIMEOUT_MS}ms`));
    socket.once("error", (error) => finish(false, error.message));
  });
}

async function checkDnsTarget(target) {
  const id = targetId(target);
  const hostname = targetValue(target);
  const result = baseResult(target);

  if (!id || !hostname) {
    return compactResult({
      ...result,
      success: false,
      latencyMs: 0,
      error: "DNS target is missing targetId or target"
    });
  }

  const startedAt = Date.now();
  try {
    const records = await Promise.race([
      dns.lookup(hostname, { all: true }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`DNS lookup timed out after ${CHECK_TIMEOUT_MS}ms`)), CHECK_TIMEOUT_MS)
      )
    ]);
    const latencyMs = Date.now() - startedAt;
    const resolvedValues = records.map((record) => record.address);
    const resolvedValue = resolvedValues.join(",");
    const expectedIp = target?.expectedIp ? String(target.expectedIp) : null;
    const success = expectedIp ? resolvedValues.includes(expectedIp) : resolvedValues.length > 0;

    return compactResult({
      ...result,
      success,
      latencyMs,
      resolvedValue,
      error: success ? null : `expected ${expectedIp}, got ${resolvedValue || "no records"}`
    });
  } catch (error) {
    return compactResult({
      ...result,
      success: false,
      latencyMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error || "Unknown DNS error")
    });
  }
}

async function checkTarget(target) {
  const checkType = String(target?.checkType || "").toLowerCase();

  if (checkType === "http") return checkHttpTarget(target);
  if (checkType === "tcp") return checkTcpTarget(target);
  if (checkType === "dns") return checkDnsTarget(target);

  return compactResult({
    ...baseResult(target),
    success: false,
    latencyMs: 0,
    error: `unsupported checkType: ${target?.checkType || "<missing>"}`
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

  const body = parseJson(text, "CRM service health targets response");
  if (!response.ok) {
    throw new Error(`CRM service health targets fetch failed: HTTP ${response.status}${text ? ` ${text}` : ""}`);
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
    throw new Error(`CRM service health results sync failed: HTTP ${response.status}${text ? ` ${text}` : ""}`);
  }
}

async function main() {
  const syncSecret = requireEnv("CLOUD_HEALTH_SYNC_SECRET");
  const targets = await fetchTargets(syncSecret);
  const limitedTargets = targets.slice(0, MAX_TARGETS_PER_RUN);

  if (targets.length > MAX_TARGETS_PER_RUN) {
    console.warn(
      `[SERVICE HEALTH] target cap applied: processing ${MAX_TARGETS_PER_RUN}/${targets.length} target(s)`
    );
  }

  const results = [];
  for (let index = 0; index < limitedTargets.length; index += 1) {
    const target = limitedTargets[index];
    console.log(
      `[SERVICE HEALTH] checking target ${index + 1}/${limitedTargets.length}: ${
        target?.checkType || "<no-type>"
      } ${targetValue(target) || "<no-target>"}`
    );
    results.push(await checkTarget(target));
  }

  await pushResults(syncSecret, results);
  const successes = results.filter((result) => result.success).length;
  console.log(`[SERVICE HEALTH] completed: ${successes}/${results.length} target(s) healthy`);
}

main().catch((error) => {
  console.error(
    `[SERVICE HEALTH] failed: ${
      error instanceof Error ? error.stack || error.message : String(error || "Unknown error")
    }`
  );
  process.exitCode = 1;
});
