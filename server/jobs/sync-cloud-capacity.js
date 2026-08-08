import "dotenv/config";
import { authenticate } from "../manageone.js";

const CRM_SYNC_URL = "https://crm-api.102-203-134-106.sslip.io/cloud-capacity/sync";
const CRM_SNAPSHOT_URL = "https://crm-api.102-203-134-106.sslip.io/cloud-capacity/snapshot";
const CAPACITY_REQUEST_TIMEOUT_MS = Number(process.env.MANAGEONE_TIMEOUT_MS || 30000);
const CAPACITY_BASE_URL = (process.env.MANAGEONE_CAPACITY_BASE_URL || "https://10.20.24.9:26335").replace(
  /\/+$/,
  ""
);
const CAPACITY_RESOURCE_TYPES = "cpu,memory,storage-pool";
const TB_TO_GB = 1024;
const PB_TO_GB = 1024 * 1024;
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

function numberFrom(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new Error(`${label} missing or non-numeric`);
  }
  return number;
}

function capacityNumber(value, label) {
  if (value && typeof value === "object" && "capacityValue" in value) {
    return numberFrom(value.capacityValue, `${label}.capacityValue`);
  }

  return numberFrom(value, label);
}

function capacityToGb(value, label) {
  if (!value || typeof value !== "object") {
    return numberFrom(value, label);
  }

  const capacityValue = numberFrom(value.capacityValue, `${label}.capacityValue`);
  const unit = String(value.unit || "GB").trim().toUpperCase();

  if (unit === "PB") {
    return capacityValue * PB_TO_GB;
  }
  if (unit === "TB") {
    return capacityValue * TB_TO_GB;
  }
  if (unit === "MB") {
    return capacityValue / 1024;
  }

  return capacityValue;
}

function capacityValues(record, label) {
  if (!record) {
    throw new Error(`${label} capacity record missing`);
  }

  const total = capacityNumber(record?.actualCapacity?.totalCapacity, `${label}.actualCapacity.totalCapacity`);
  const usedRatio = numberFrom(record?.actualCapacity?.usedCapacity?.ratio, `${label}.actualCapacity.usedCapacity.ratio`);

  return {
    used: total * (usedRatio / 100),
    total,
    oversubscriptionTotal: capacityNumber(
      record?.oversubscriptionCapacity?.totalCapacity,
      `${label}.oversubscriptionCapacity.totalCapacity`
    ),
    oversubscriptionRatio: numberFrom(
      record?.oversubscriptionCapacity?.allocatedCapacity?.ratio,
      `${label}.oversubscriptionCapacity.allocatedCapacity.ratio`
    )
  };
}

function optionalCapacityToGb(value, label) {
  if (value == null) {
    return undefined;
  }

  return capacityToGb(value, label);
}

function optionalNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function getDimensionValue(dimensions, dimensionType) {
  if (!Array.isArray(dimensions)) {
    return undefined;
  }

  const match = dimensions.find((dimension) => dimension?.dimensionType === dimensionType);
  return match?.dimensionValue;
}

function transformStoragePools(body) {
  const capacityList = Array.isArray(body?.capacityList) ? body.capacityList : [];

  return capacityList
    .map((item) => {
      const volumeType = getDimensionValue(item?.dimensions, "volumeTypeName");
      const actualCapacity = item?.capacity?.actualCapacity;
      if (!volumeType || !actualCapacity) {
        return null;
      }

      return {
        volumeType: String(volumeType),
        usedGb: capacityToGb(actualCapacity?.usedCapacity, `storagePools.${volumeType}.usedCapacity`),
        totalGb: capacityToGb(actualCapacity?.totalCapacity, `storagePools.${volumeType}.totalCapacity`),
        freeGb: capacityToGb(actualCapacity?.freeCapacity, `storagePools.${volumeType}.freeCapacity`),
        usedRatio: numberFrom(actualCapacity?.usedCapacity?.ratio, `storagePools.${volumeType}.usedCapacity.ratio`),
        ...(optionalCapacityToGb(
          item?.capacity?.oversubscriptionCapacity?.totalCapacity,
          `storagePools.${volumeType}.oversubscriptionCapacity.totalCapacity`
        ) !== undefined
          ? {
              oversubscriptionTotalGb: optionalCapacityToGb(
                item?.capacity?.oversubscriptionCapacity?.totalCapacity,
                `storagePools.${volumeType}.oversubscriptionCapacity.totalCapacity`
              )
            }
          : {}),
        ...(optionalCapacityToGb(
          item?.capacity?.oversubscriptionCapacity?.allocatedCapacity,
          `storagePools.${volumeType}.oversubscriptionCapacity.allocatedCapacity`
        ) !== undefined
          ? {
              oversubscriptionAllocatedGb: optionalCapacityToGb(
                item?.capacity?.oversubscriptionCapacity?.allocatedCapacity,
                `storagePools.${volumeType}.oversubscriptionCapacity.allocatedCapacity`
              )
            }
          : {}),
        ...(optionalCapacityToGb(
          item?.capacity?.oversubscriptionCapacity?.freeCapacity,
          `storagePools.${volumeType}.oversubscriptionCapacity.freeCapacity`
        ) !== undefined
          ? {
              oversubscriptionFreeGb: optionalCapacityToGb(
                item?.capacity?.oversubscriptionCapacity?.freeCapacity,
                `storagePools.${volumeType}.oversubscriptionCapacity.freeCapacity`
              )
            }
          : {}),
        ...(optionalNumber(item?.capacity?.oversubscriptionCapacity?.allocatedCapacity?.ratio) !== undefined
          ? {
              oversubscriptionAllocatedRatio: optionalNumber(
                item?.capacity?.oversubscriptionCapacity?.allocatedCapacity?.ratio
              )
            }
          : {})
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.volumeType.localeCompare(b.volumeType));
}

function transformCapacity(region, body) {
  const cpu = capacityValues(body?.cpu, "cpu");
  const memory = capacityValues(body?.memory, "memory");
  const storage = capacityValues(body?.storagePool || body?.storage_pool || body?.["storage-pool"], "storagePool");

  return {
    regionId: region.regionId,
    regionName: region.regionName,
    cpuUsed: cpu.used,
    cpuTotal: cpu.total,
    cpuOversubscriptionCapacity: cpu.oversubscriptionTotal,
    cpuOversubscriptionRatio: cpu.oversubscriptionRatio,
    memoryUsedGb: memory.used,
    memoryTotalGb: memory.total,
    memoryOversubscriptionCapacityGb: memory.oversubscriptionTotal,
    memoryOversubscriptionRatio: memory.oversubscriptionRatio,
    storageUsedGb: storage.used * TB_TO_GB,
    storageTotalGb: storage.total * TB_TO_GB,
    storageOversubscriptionCapacityGb: storage.oversubscriptionTotal * TB_TO_GB,
    storageOversubscriptionRatio: storage.oversubscriptionRatio
  };
}

async function fetchRegionCapacity(region, session) {
  const url = `${CAPACITY_BASE_URL}/rest/capacity/v1/capbase/regions/${encodeURIComponent(
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

async function fetchRegionStoragePools(region, session) {
  const url = `${CAPACITY_BASE_URL}/rest/capacity/v1/capbase/regions/${encodeURIComponent(
    region.regionId
  )}/resource-types/storage-pool/dimension-types/volumeTypeName/capacities?limit=100&offset=0&sort=-storPoolUsageRatio`;

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

  return transformStoragePools(parseJson(text, `ManageOne storage pool capacity response for ${region.regionName}`));
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

async function pushCapacitySnapshotToCrm(syncSecret, payload) {
  const snapshotAt = Date.now();
  const snapshotPayload = payload.map((region) => ({
    ...region,
    snapshotAt
  }));

  const { response, text } = await fetchTextWithTimeout(CRM_SNAPSHOT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-Sync-Secret": syncSecret
    },
    body: JSON.stringify(snapshotPayload)
  });

  if (!response.ok) {
    throw new Error(`CRM capacity snapshot sync failed: HTTP ${response.status}${text ? ` ${text}` : ""}`);
  }

  console.log(`[CLOUD CAPACITY] snapshot push success: ${snapshotPayload.length} region snapshot(s) sent`);
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
      const capacity = await fetchRegionCapacity(region, session);
      try {
        const storagePools = await fetchRegionStoragePools(region, session);
        capacity.storagePools = storagePools;
        console.log(`[CLOUD CAPACITY] storage pool breakdown for ${region.regionName}: ${storagePools.length} type(s)`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error || "Unknown error");
        console.error(`[CLOUD CAPACITY] storage pool breakdown skipped for ${region.regionName}: ${message}`);
      }
      payload.push(capacity);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error || "Unknown error");
      failures.push(`${region.regionName}: ${message}`);
      console.error(`[CLOUD CAPACITY] region skipped for ${region.regionName}: ${message}`);
    }
  }

  if (payload.length > 0) {
    await pushCapacityToCrm(syncSecret, payload);
    try {
      await pushCapacitySnapshotToCrm(syncSecret, payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error || "Unknown error");
      console.error(`[CLOUD CAPACITY] snapshot push failed: ${message}`);
    }
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
