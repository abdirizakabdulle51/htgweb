import "dotenv/config";
import { authenticate } from "../manageone.js";

const CRM_SYNC_URL = "https://crm-api.102-203-134-106.sslip.io/cloud-capacity/sync";
const CRM_SNAPSHOT_URL = "https://crm-api.102-203-134-106.sslip.io/cloud-capacity/snapshot";
const CAPACITY_REQUEST_TIMEOUT_MS = Number(process.env.MANAGEONE_TIMEOUT_MS || 30000);
const CAPACITY_BASE_URL = (process.env.MANAGEONE_CAPACITY_BASE_URL || "https://10.20.24.9:26335").replace(
  /\/+$/,
  ""
);
const PRODUCT_BASE_URL = (process.env.MANAGEONE_PRODUCT_BASE_URL || "https://10.20.24.9:26335").replace(/\/+$/, "");
const CAPACITY_RESOURCE_TYPES = "cpu,memory,storage-pool";
const TB_TO_GB = 1024;
const PB_TO_GB = 1024 * 1024;
const REGIONS = [
  {
    regionId: "3A462C0E713B3BF389CC4359D2618F9D",
    regionCode: "htgcloud-region-02",
    regionName: "Mogadishu-region-hq3",
    cloudInfraId: "FUSION_CLOUD_htgcloud-region-02"
  },
  {
    regionId: "3A03042C29813F5DBA6DBDC2E95CB101",
    regionCode: "hoa-mogadishu-2",
    regionName: "Hoa-Mogadishu-2",
    cloudInfraId: "FUSION_CLOUD_hoa-mogadishu-2"
  }
];
const TARGET_FLAVORS = [
  { name: "S6_large.1", vcpus: 2, ramGb: 2, cpuVendor: "Intel" },
  { name: "C6_large.2", vcpus: 2, ramGb: 4, cpuVendor: "Intel" },
  { name: "S6_large.2", vcpus: 2, ramGb: 4, cpuVendor: "Intel" },
  { name: "C6_large.4", vcpus: 2, ramGb: 8, cpuVendor: "Intel" },
  { name: "S6_large.4", vcpus: 2, ramGb: 8, cpuVendor: "Intel" },
  { name: "C6_xlarge.2", vcpus: 4, ramGb: 8, cpuVendor: "Intel" },
  { name: "S6_xlarge.2", vcpus: 4, ramGb: 8, cpuVendor: "Intel" },
  { name: "S6_4U_12G", vcpus: 4, ramGb: 12, cpuVendor: "Intel" },
  { name: "C6_xlarge.4", vcpus: 4, ramGb: 16, cpuVendor: "Intel" },
  { name: "S6_xlarge.4", vcpus: 4, ramGb: 16, cpuVendor: "Intel" },
  { name: "S6_4U_32G", vcpus: 4, ramGb: 32, cpuVendor: "Intel" },
  { name: "S6_2xlarge.2", vcpus: 8, ramGb: 16, cpuVendor: "Intel" },
  { name: "S6_8U_24G", vcpus: 8, ramGb: 24, cpuVendor: "Intel" },
  { name: "C6_2xlarge.2", vcpus: 8, ramGb: 26, cpuVendor: "Intel" },
  { name: "C6_2xlarge.4", vcpus: 8, ramGb: 32, cpuVendor: "Intel" },
  { name: "S6_2xlarge.4", vcpus: 8, ramGb: 32, cpuVendor: "Intel" },
  { name: "C6_2xlarge.8", vcpus: 8, ramGb: 64, cpuVendor: "Intel" },
  { name: "C6_3xlarge.2", vcpus: 12, ramGb: 24, cpuVendor: "Intel" },
  { name: "C6_3xlarge.4", vcpus: 12, ramGb: 36, cpuVendor: "Intel" },
  { name: "S6_12U_64G", vcpus: 12, ramGb: 64, cpuVendor: "Intel" },
  { name: "C6_4xlarge.2", vcpus: 16, ramGb: 24, cpuVendor: "Intel" },
  { name: "S6_4xlarge.2", vcpus: 16, ramGb: 32, cpuVendor: "Intel" },
  { name: "C6_4xlarge.4", vcpus: 16, ramGb: 48, cpuVendor: "Intel" },
  { name: "S6_16U_64G", vcpus: 16, ramGb: 64, cpuVendor: "Intel" },
  { name: "C6_6xlarge.2", vcpus: 24, ramGb: 48, cpuVendor: "Intel" },
  { name: "C6_6xlarge.4", vcpus: 24, ramGb: 96, cpuVendor: "Intel" },
  { name: "S6_32U_64G", vcpus: 32, ramGb: 64, cpuVendor: "Intel" },
  { name: "S6_32U_128G", vcpus: 32, ramGb: 128, cpuVendor: "Intel" },
  { name: "C6_12xlarge.2", vcpus: 48, ramGb: 96, cpuVendor: "Intel" },
  { name: "S6_48U_160G", vcpus: 48, ramGb: 160, cpuVendor: "Intel" },
  { name: "C6_12xlarge.4", vcpus: 48, ramGb: 192, cpuVendor: "Intel" },
  { name: "C6_16xlarge.2", vcpus: 64, ramGb: 128, cpuVendor: "Intel" },
  { name: "S6_64U_256G", vcpus: 64, ramGb: 256, cpuVendor: "Intel" },
  { name: "C6_16xlarge.4", vcpus: 64, ramGb: 256, cpuVendor: "Intel" }
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

function normalizeName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, "_");
}

function extractFlavors(body) {
  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.flavors)) return body.flavors;
  if (typeof body?.flavors === "string") {
    try {
      const parsed = JSON.parse(body.flavors);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  if (Array.isArray(body?.records)) return body.records;
  if (Array.isArray(body?.items)) return body.items;
  return [];
}

function flavorName(flavor) {
  return (
    flavor?.flavor_name ||
    flavor?.flavorName ||
    flavor?.name ||
    flavor?.display_name ||
    flavor?.id ||
    flavor?.flavor_id ||
    ""
  );
}

function regionIdCandidates(region) {
  return [...new Set([region.regionCode, region.regionId, region.regionName].filter(Boolean))];
}

function queryParamVariants(region) {
  return [
    { start: "0", limit: "500", vdc_level: "0", cloud_infra_id: region.cloudInfraId },
    { start: "0", limit: "500", cloud_infra_id: region.cloudInfraId },
    { start: "0", limit: "500" }
  ];
}

function estimateFlavorFit(capacity, flavor) {
  const cpuFree = Math.max(capacity.cpuTotal - capacity.cpuUsed, 0);
  const memoryFreeGb = Math.max(capacity.memoryTotalGb - capacity.memoryUsedGb, 0);
  return Math.max(0, Math.min(Math.floor(cpuFree / flavor.vcpus), Math.floor(memoryFreeGb / flavor.ramGb)));
}

function mapFlavorAvailability(capacity, flavors) {
  const availableNames = new Map();
  for (const flavor of flavors) {
    const name = flavorName(flavor);
    if (name) availableNames.set(normalizeName(name), flavor);
  }

  return TARGET_FLAVORS.map((target) => {
    const match = availableNames.get(normalizeName(target.name));
    const estimatedFitCount = match ? estimateFlavorFit(capacity, target) : 0;
    return {
      ...target,
      available: Boolean(match),
      matchedName: match ? flavorName(match) : undefined,
      availabilityZones: Array.isArray(match?.availability_zone) ? match.availability_zone : [],
      estimatedFitCount,
      status: !match ? "not_offered" : estimatedFitCount < 1 ? "low_capacity" : "available"
    };
  });
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

async function fetchRegionFlavorAvailability(region, session, capacity) {
  const attempts = [];

  for (const regionId of regionIdCandidates(region)) {
    for (const flavorQueryParams of queryParamVariants(region)) {
      const search = new URLSearchParams({
        region_id: regionId,
        resource_pool_id: region.cloudInfraId,
        service_id: "nova-ext",
        flavor_query_params: JSON.stringify(flavorQueryParams)
      });
      const url = `${PRODUCT_BASE_URL}/rest/product/v3.0/flavor?${search.toString()}`;

      try {
        const { response, text } = await fetchTextWithTimeout(url, {
          method: "GET",
          headers: {
            Accept: "application/json, text/plain, */*",
            "Content-Type": "application/json",
            "X-Auth-Token": session.token,
            "X-Language": "en-us"
          },
          redirect: "manual"
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}${text ? ` ${text.slice(0, 500)}` : ""}`);
        }

        const body = parseJson(text, `ECS flavor list for ${region.regionName}`);
        return {
          status: "verified",
          message: `ManageOne returned ${extractFlavors(body).length} ECS flavor(s).`,
          flavors: mapFlavorAvailability(capacity, extractFlavors(body))
        };
      } catch (error) {
        attempts.push(error instanceof Error ? error.message : String(error || "Unknown error"));
      }
    }
  }

  throw new Error(attempts[0] || `No flavor query attempt succeeded for ${region.regionName}`);
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
      try {
        const flavorAvailability = await fetchRegionFlavorAvailability(region, session, capacity);
        capacity.ecsFlavorAvailabilityStatus = flavorAvailability.status;
        capacity.ecsFlavorAvailabilityMessage = flavorAvailability.message;
        capacity.ecsFlavorAvailability = flavorAvailability.flavors;
        const availableCount = flavorAvailability.flavors.filter((flavor) => flavor.available).length;
        console.log(
          `[CLOUD CAPACITY] ECS flavor availability for ${region.regionName}: ${availableCount}/${flavorAvailability.flavors.length} target flavor(s)`
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error || "Unknown error");
        capacity.ecsFlavorAvailabilityStatus = "unavailable";
        capacity.ecsFlavorAvailabilityMessage = message;
        console.error(`[CLOUD CAPACITY] ECS flavor availability unavailable for ${region.regionName}: ${message}`);
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
