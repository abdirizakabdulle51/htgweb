import "dotenv/config";
import { authenticate } from "../manageone.js";

const OC_ALARMS_BASE_URL = process.env.MANAGEONE_ALARMS_BASE_URL || "https://oc.htgclouds.com:26335";
const CRM_ALARMS_SYNC_URL =
  process.env.CRM_ALARMS_SYNC_URL || "https://crm-api.102-203-134-106.sslip.io/cloud-alarms/sync";
const ALARM_REQUEST_TIMEOUT_MS = Number(process.env.MANAGEONE_TIMEOUT_MS || 30000);
const ALARM_QUERY_SIZE = Number(process.env.MANAGEONE_ALARM_QUERY_SIZE || 1000);
const ALARM_DETAIL_BATCH_SIZE = Number(process.env.MANAGEONE_ALARM_DETAIL_BATCH_SIZE || 50);
const DEFAULT_ALARM_SEVERITIES = ["1", "2"];

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

async function fetchTextWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ALARM_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    const text = await response.text();
    return { response, text };
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`HTTP request timed out after ${ALARM_REQUEST_TIMEOUT_MS}ms`);
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

function alarmSeverities() {
  const configured = process.env.MANAGEONE_ALARM_SEVERITIES;
  if (!configured) return DEFAULT_ALARM_SEVERITIES;

  const values = configured
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return values.length > 0 ? values : DEFAULT_ALARM_SEVERITIES;
}

function numberValue(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function stringValue(value) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function normalizeCsnList(body) {
  if (Array.isArray(body)) return body.map((value) => numberValue(value)).filter((value) => value > 0);
  if (Array.isArray(body?.csns)) return body.csns.map((value) => numberValue(value)).filter((value) => value > 0);
  if (Array.isArray(body?.data?.csns)) {
    return body.data.csns.map((value) => numberValue(value)).filter((value) => value > 0);
  }
  return [];
}

function normalizeAlarmList(body) {
  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.alarms)) return body.alarms;
  if (Array.isArray(body?.currentAlarms)) return body.currentAlarms;
  if (Array.isArray(body?.records)) return body.records;
  if (Array.isArray(body?.data)) return body.data;
  if (Array.isArray(body?.data?.alarms)) return body.data.alarms;
  if (Array.isArray(body?.data?.records)) return body.data.records;
  return [];
}

function normalizeAlarm(alarm, syncedAt) {
  return {
    csn: numberValue(alarm?.csn ?? alarm?.CSN),
    alarmId: stringValue(alarm?.alarmId ?? alarm?.alarmID),
    alarmName: stringValue(alarm?.alarmName),
    severity: numberValue(alarm?.severity),
    cleared: numberValue(alarm?.cleared),
    acked: numberValue(alarm?.acked),
    category: numberValue(alarm?.category),
    eventType: numberValue(alarm?.eventType),
    meName: stringValue(alarm?.meName),
    meCategory: stringValue(alarm?.meCategory),
    meType: stringValue(alarm?.meType),
    moc: stringValue(alarm?.moc),
    address: stringValue(alarm?.address),
    logicalRegionId: stringValue(alarm?.logicalRegionId),
    logicalRegionName: stringValue(alarm?.logicalRegionName),
    vdcId: stringValue(alarm?.vdcId),
    vdcName: stringValue(alarm?.vdcName),
    tenantId: stringValue(alarm?.tenantId),
    tenant: stringValue(alarm?.tenant),
    additionalInformation: stringValue(alarm?.additionalInformation),
    probableCause: stringValue(alarm?.probableCause),
    occurUtc: numberValue(alarm?.occurUtc),
    arriveUtc: numberValue(alarm?.arriveUtc),
    latestOccurUtc: numberValue(alarm?.latestOccurUtc),
    rawPayload: alarm || {},
    lastSyncedAt: syncedAt
  };
}

async function fetchAlarmCsnsForSeverity(session, severity) {
  const { response, text } = await fetchTextWithTimeout(`${OC_ALARMS_BASE_URL}/rest/fault/v1/current-alarms/csns`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-Auth-Token": session.token
    },
    body: JSON.stringify({
      query: {
        filters: [
          {
            name: "severity",
            field: "severity",
            operator: "in",
            values: [severity]
          }
        ],
        expression: "and"
      },
      sort: [
        {
          field: "CSN",
          order: "desc"
        }
      ],
      size: ALARM_QUERY_SIZE
    })
  });

  const body = parseJson(text, "ManageOne alarm CSN response");
  if (!response.ok) {
    throw new Error(
      `ManageOne alarm CSN query failed for severity ${severity}: HTTP ${response.status}${text ? ` ${text}` : ""}`
    );
  }

  if (body?.sizeExceeded) {
    throw new Error(
      `ManageOne alarm CSN query for severity ${severity} exceeded requested size ${ALARM_QUERY_SIZE}; refusing to push a partial alarm sync`
    );
  }

  return normalizeCsnList(body);
}

async function fetchAlarmCsns(session) {
  const csns = [];
  const severities = alarmSeverities();

  for (const severity of severities) {
    const severityCsns = await fetchAlarmCsnsForSeverity(session, severity);
    console.log(`[MANAGEONE ALARMS] severity ${severity}: fetched ${severityCsns.length} active alarm CSN(s)`);
    csns.push(...severityCsns);
  }

  return [...new Set(csns)];
}

async function fetchAlarmDetails(session, csns) {
  if (csns.length === 0) return [];

  const alarms = [];
  for (let index = 0; index < csns.length; index += ALARM_DETAIL_BATCH_SIZE) {
    const batch = csns.slice(index, index + ALARM_DETAIL_BATCH_SIZE);
    const params = new URLSearchParams();
    for (const csn of batch) {
      params.append("csns", String(csn));
    }

    const { response, text } = await fetchTextWithTimeout(
      `${OC_ALARMS_BASE_URL}/rest/fault/v1/current-alarms?${params}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-Auth-Token": session.token
        }
      }
    );

    const body = parseJson(text, "ManageOne alarm detail response");
    if (!response.ok) {
      throw new Error(`ManageOne alarm detail fetch failed: HTTP ${response.status}${text ? ` ${text}` : ""}`);
    }

    alarms.push(...normalizeAlarmList(body));
  }

  return alarms;
}

async function pushAlarmsToCrm(syncSecret, payload) {
  const { response, text } = await fetchTextWithTimeout(CRM_ALARMS_SYNC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-Sync-Secret": syncSecret
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`CRM alarm sync failed: HTTP ${response.status}${text ? ` ${text}` : ""}`);
  }

  return parseJson(text, "CRM alarm sync response");
}

async function main() {
  const syncSecret = requireEnv("MANAGEONE_ALARMS_SYNC_SECRET");
  const syncedAt = Date.now();
  const session = await authenticate();

  console.log(`[MANAGEONE ALARMS] querying active alarm CSNs for severities ${alarmSeverities().join(",")}`);
  const csns = await fetchAlarmCsns(session);
  console.log(`[MANAGEONE ALARMS] fetched ${csns.length} active alarm CSN(s)`);

  const rawAlarms = await fetchAlarmDetails(session, csns);
  const alarms = rawAlarms
    .map((alarm) => normalizeAlarm(alarm, syncedAt))
    .filter((alarm) => alarm.csn > 0);

  const returnedCsns = new Set(alarms.map((alarm) => alarm.csn));
  const missingCsns = csns.filter((csn) => !returnedCsns.has(csn));
  if (missingCsns.length > 0) {
    throw new Error(
      `ManageOne alarm detail response was incomplete; missing ${missingCsns.length} CSN detail(s): ${missingCsns
        .slice(0, 10)
        .join(",")}`
    );
  }

  if (rawAlarms.length !== alarms.length) {
    console.warn(`[MANAGEONE ALARMS] skipped ${rawAlarms.length - alarms.length} alarm(s) without a valid CSN`);
  }

  const result = await pushAlarmsToCrm(syncSecret, {
    syncedAt,
    alarms
  });

  console.log(
    `[MANAGEONE ALARMS] completed: ${alarms.length} alarm(s) pushed, CRM received ${
      result?.received ?? "unknown"
    }, upserted ${result?.upserted ?? "unknown"}, deactivated ${result?.deactivated ?? "unknown"}`
  );
}

main().catch((error) => {
  console.error(
    `[MANAGEONE ALARMS] failed: ${
      error instanceof Error ? error.stack || error.message : String(error || "Unknown error")
    }`
  );
  process.exitCode = 1;
});
