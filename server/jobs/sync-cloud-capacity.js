import "dotenv/config";
import { authenticate } from "../manageone.js";

const CRM_SYNC_URL = "https://crm-api.102-203-134-106.sslip.io/cloud-capacity/sync";
const CAPACITY_REQUEST_TIMEOUT_MS = Number(process.env.MANAGEONE_TIMEOUT_MS || 30000);
const CAPACITY_RESOURCE_TYPES = "cpu,memory,storage-pool";
const REGIONS = [
  {
    regionId: "3A462C0E713B3BF389CC4359D2618F9D",
    regionName: "Mogadishu-region-hq3"
  },
  {
    regionId: "3A03042C29813F5DBA6DBDC2E95CB101",
    regionName: "Hoa-Mogadishu-2"
  }
];

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

async function fetchTextWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CAPACITY_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    const text = await response.text();
    return { response, text };
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`HTTP request timed out after ${CAPACITY_REQUEST_TIMEOUT_MS}ms`);
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

function recordsFromCapacityResponse(body) {
  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.records)) return body.records;
  if (Array.isArray(body?.resources)) return body.resources;
  if (Array.isArray(body?.resourceTypes)) return body.resourceTypes;
  if (Array.isArray(body?.data)) return body.data;
  if (body && typeof body === "object") return Object.values(body).filter((value) => value && typeof value === "object");
  return [];
}

function resourceTypeOf(record) {
  return String(
    record?.resourceType ||
      record?.resource_type ||
      record?.resourceTypeName ||
      record?.resource_type_name ||
      record?.type ||
      record?.name ||
      record?.id ||
      ""
  ).toLowerCase();
}

function findCapacityRecord(records, resourceType) {
  const expected = resourceType.toLowerCase();
  return records.find((record) => resourceTypeOf(record) === expected || resourceTypeOf(record).includes(expected));
}

function numberFrom(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new Error(`${label} missing or non-numeric`);
  }
  return number;
}

function capacityValues(record, label) {
  return {
    used: numberFrom(record?.actualCapacity?.usedCapacity, `${label}.actualCapacity.usedCapacity`),
    total: numberFrom(record?.actualCapacity?.totalCapacity, `${label}.actualCapacity.totalCapacity`),
    oversubscriptionTotal: numberFrom(
      record?.oversubscriptionCapacity?.totalCapacity,
      `${label}.oversubscriptionCapacity.totalCapacity`
    )
  };
}

function transformCapacity(region, body) {
  const records = recordsFromCapacityResponse(body);
  const cpu = capacityValues(findCapacityRecord(records, "cpu"), "cpu");
  const memory = capacityValues(findCapacityRecord(records, "memory"), "memory");
  const storage = capacityValues(findCapacityRecord(records, "storage-pool"), "storage-pool");

  return {
    regionId: region.regionId,
    regionName: region.regionName,
    cpuUsed: cpu.used,
    cpuTotal: cpu.total,
    cpuOversubscriptionCapacity: cpu.oversubscriptionTotal,
    memoryUsedGb: memory.used,
    memoryTotalGb: memory.total,
    memoryOversubscriptionCapacityGb: memory.oversubscriptionTotal,
    storageUsedGb: storage.used,
    storageTotalGb: storage.total,
    storageOversubscriptionCapacityGb: storage.oversubscriptionTotal
  };
}

async function fetchRegionCapacity(region, session) {
  const url = `https://10.20.24.9:26335/rest/capacity/v1/capbase/regions/${encodeURIComponent(
    region.regionId
  )}/resource-types/${CAPACITY_RESOURCE_TYPES}/current-capacities`;

  const { response, text } = await fetchTextWithTimeout(url, {
    method: "GET",
    headers: {
      Accept: "application/json, text/plain, */*",
      "Content-Type": "application/json",
      "X-Auth-Token": session.token
    },
    redirect: "manual"
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}${text ? ` ${text}` : ""}`);
  }

  return transformCapacity(region, parseJson(text, `ManageOne capacity response for ${region.regionName}`));
}

async function pushCapacityToCrm(syncSecret, payload) {
  const { response, text } = await fetchTextWithTimeout(CRM_SYNC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-Sync-Secret": syncSecret
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`CRM capacity sync failed: HTTP ${response.status}${text ? ` ${text}` : ""}`);
  }
}

async function main() {
  const syncSecret = requireEnv("CLOUD_HEALTH_SYNC_SECRET");
  const session = await authenticate();
  const payload = [];
  const failures = [];

  for (let index = 0; index < REGIONS.length; index += 1) {
    const region = REGIONS[index];
    console.log(`[CLOUD CAPACITY] syncing region ${index + 1}/${REGIONS.length}: ${region.regionName}`);

    try {
      payload.push(await fetchRegionCapacity(region, session));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error || "Unknown error");
      failures.push(`${region.regionName}: ${message}`);
      console.error(`[CLOUD CAPACITY] region skipped for ${region.regionName}: ${message}`);
    }
  }

  if (payload.length > 0) {
    await pushCapacityToCrm(syncSecret, payload);
  } else {
    console.warn("[CLOUD CAPACITY] CRM push skipped: no region capacity payloads were collected");
  }

  console.log(
    `[CLOUD CAPACITY] completed: ${payload.length}/${REGIONS.length} region(s) synced, ${failures.length} failure(s)`
  );

  if (failures.length > 0) {
    console.warn(`[CLOUD CAPACITY] failures: ${failures.join("; ")}`);
  }
}

main().catch((error) => {
  console.error(
    `[CLOUD CAPACITY] failed: ${
      error instanceof Error ? error.stack || error.message : String(error || "Unknown error")
    }`
  );
  process.exitCode = 1;
});
