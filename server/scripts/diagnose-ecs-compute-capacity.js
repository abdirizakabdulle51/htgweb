import "dotenv/config";
import { authenticate } from "../manageone.js";

const CAPACITY_BASE_URL = (process.env.MANAGEONE_CAPACITY_BASE_URL || "https://10.20.24.9:26335").replace(
  /\/+$/,
  ""
);
const SERVICE_ACCESS_BASE_URL = (process.env.MANAGEONE_AUTH_BASE_URL || "https://10.20.24.9:26335").replace(
  /\/+$/,
  ""
);
const REQUEST_TIMEOUT_MS = Number(process.env.MANAGEONE_TIMEOUT_MS || 30000);

const REGIONS = [
  {
    regionId: "3A462C0E713B3BF389CC4359D2618F9D",
    regionName: "Mogadishu-region-hq3",
    cloudInfraId: "FUSION_CLOUD_htgcloud-region-02"
  },
  {
    regionId: "3A03042C29813F5DBA6DBDC2E95CB101",
    regionName: "Hoa-Mogadishu-2",
    cloudInfraId: "FUSION_CLOUD_hoa-mogadishu-2"
  }
];

const DEFAULT_FLAVORS = [
  { name: "S6_4U_32G", vcpus: 4, ramGb: 32 },
  { name: "S6_8U_24G", vcpus: 8, ramGb: 24 },
  { name: "C6_2xlarge.8", vcpus: 8, ramGb: 16 },
  { name: "custom-8U-32G", vcpus: 8, ramGb: 32 }
];

function parseFlavorList() {
  const raw = process.env.MANAGEONE_COMPUTE_FLAVORS;
  if (!raw) return DEFAULT_FLAVORS;

  return raw
    .split(",")
    .map((item) => {
      const [name, vcpus, ramGb] = item.split(":").map((part) => part?.trim());
      const parsedVcpus = Number(vcpus);
      const parsedRamGb = Number(ramGb);
      if (!name || !Number.isFinite(parsedVcpus) || !Number.isFinite(parsedRamGb)) return null;
      return { name, vcpus: parsedVcpus, ramGb: parsedRamGb };
    })
    .filter(Boolean);
}

function numberFrom(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function capacityValue(value) {
  if (value && typeof value === "object") {
    return numberFrom(value.capacityValue);
  }

  return numberFrom(value);
}

function capacityToGb(value) {
  if (!value || typeof value !== "object") {
    return numberFrom(value);
  }

  const numericValue = numberFrom(value.capacityValue);
  if (numericValue === undefined) return undefined;

  const unit = String(value.unit || "GB").trim().toUpperCase();
  if (unit === "PB") return numericValue * 1024 * 1024;
  if (unit === "TB") return numericValue * 1024;
  if (unit === "MB") return numericValue / 1024;
  if (unit === "KB") return numericValue / 1024 / 1024;
  return numericValue;
}

function listFromResponse(body, keys) {
  if (!body || typeof body !== "object") return [];
  if (Array.isArray(body)) return body;

  for (const key of keys) {
    if (Array.isArray(body[key])) return body[key];
  }

  return [];
}

function parseJson(text, label) {
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`${label} returned invalid JSON`);
  }
}

async function fetchJson(url, session, label) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json, text/plain, */*",
        "Content-Type": "application/json",
        "X-Auth-Token": session.token,
        "X-Language": "en-us"
      },
      redirect: "manual",
      signal: controller.signal
    });
    const text = await response.text();

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}${text ? ` ${text.slice(0, 500)}` : ""}`);
    }

    return parseJson(text, label);
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`HTTP request timed out after ${REQUEST_TIMEOUT_MS}ms`);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function computeCapacity(record) {
  if (!record || typeof record !== "object") return null;

  const cpu = record.cpu || record?.bms?.cpu;
  const memory = record.memory || record?.bms?.memory;
  if (!cpu || !memory) return null;

  const cpuCapacity = cpu.capacity || cpu;
  const memoryCapacity = memory.capacity || memory;
  const cpuActual = cpuCapacity.actualCapacity || {};
  const cpuOversubscription = cpuCapacity.oversubscriptionCapacity || {};
  const memoryActual = memoryCapacity.actualCapacity || {};
  const memoryOversubscription = memoryCapacity.oversubscriptionCapacity || {};

  const cpuActualTotal = capacityValue(cpuActual.totalCapacity);
  const cpuActualUsed = capacityValue(cpuActual.usedCapacity);
  const cpuActualFree = capacityValue(cpuActual.freeCapacity);
  const cpuOverTotal = capacityValue(cpuOversubscription.totalCapacity);
  const cpuOverUsed = capacityValue(cpuOversubscription.allocatedCapacity);
  const cpuOverFree = capacityValue(cpuOversubscription.freeCapacity);

  const memoryActualTotalGb = capacityToGb(memoryActual.totalCapacity);
  const memoryActualUsedGb = capacityToGb(memoryActual.usedCapacity);
  const memoryActualFreeGb = capacityToGb(memoryActual.freeCapacity);
  const memoryOverTotalGb = capacityToGb(memoryOversubscription.totalCapacity);
  const memoryOverUsedGb = capacityToGb(memoryOversubscription.allocatedCapacity);
  const memoryOverFreeGb = capacityToGb(memoryOversubscription.freeCapacity);

  return {
    cpuActualTotal,
    cpuActualUsed,
    cpuActualFree,
    cpuOversubscriptionTotal: cpuOverTotal,
    cpuOversubscriptionUsed: cpuOverUsed,
    cpuOversubscriptionFree: cpuOverFree,
    memoryActualTotalGb,
    memoryActualUsedGb,
    memoryActualFreeGb,
    memoryOversubscriptionTotalGb: memoryOverTotalGb,
    memoryOversubscriptionUsedGb: memoryOverUsedGb,
    memoryOversubscriptionFreeGb: memoryOverFreeGb,
    cpuUsedForFit: cpuOverFree ?? cpuActualFree,
    memoryGbUsedForFit: memoryOverFreeGb ?? memoryActualFreeGb,
    sourceForFit: cpuOverFree !== undefined || memoryOverFreeGb !== undefined ? "oversubscriptionFree" : "actualFree"
  };
}

function summarizeShape(value, depth = 0) {
  if (value === null) {
    return "null";
  }

  if (value === undefined) {
    return "undefined";
  }

  if (typeof value !== "object") {
    return typeof value;
  }

  if (depth >= 2) {
    return Array.isArray(value) ? `array(${value.length})` : Object.keys(value).sort();
  }

  if (Array.isArray(value)) {
    return value.length > 0 ? [`array(${value.length})`, summarizeShape(value[0], depth + 1)] : ["array(0)"];
  }

  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, summarizeShape(value[key], depth + 1)])
  );
}

function fitFlavors(capacity, flavors) {
  if (!capacity || capacity.cpuUsedForFit === undefined || capacity.memoryGbUsedForFit === undefined) {
    return flavors.map((flavor) => ({
      ...flavor,
      status: "UNKNOWN",
      reason: "CPU/RAM free capacity fields were not present in the ManageOne response."
    }));
  }

  return flavors.map((flavor) => {
    const cpuFit = Math.floor(capacity.cpuUsedForFit / flavor.vcpus);
    const memoryFit = Math.floor(capacity.memoryGbUsedForFit / flavor.ramGb);
    const maxInstances = Math.max(0, Math.min(cpuFit, memoryFit));

    return {
      ...flavor,
      maxInstances,
      status: maxInstances > 0 ? "PASS_ESTIMATE" : "FAIL_ESTIMATE",
      reason:
        maxInstances > 0
          ? `Enough aggregate free CPU/RAM for about ${maxInstances} instance(s).`
          : "Aggregate free CPU/RAM is below this flavor requirement."
    };
  });
}

async function discoverCloudInfras(session, region) {
  const url = `${SERVICE_ACCESS_BASE_URL}/rest/serviceaccess/v3.0/cloud-infras?region_id=${encodeURIComponent(
    region.regionId
  )}`;
  const body = await fetchJson(url, session, `cloud infras for ${region.regionName}`);
  return listFromResponse(body, ["records", "cloud_infras", "cloudInfras"]).filter((item) => {
    const id = String(item?.id || item?.cloud_infra_id || "");
    const name = String(item?.name || "");
    return id === region.cloudInfraId || name === region.cloudInfraId || item?.region_id === region.regionId;
  });
}

async function discoverAzones(session, region, cloudInfraId) {
  const url = `${SERVICE_ACCESS_BASE_URL}/rest/serviceaccess/v3.0/available-zones?cloud_infra_id=${encodeURIComponent(
    cloudInfraId
  )}`;
  const body = await fetchJson(url, session, `available zones for ${region.regionName}`);
  return listFromResponse(body, ["records", "available_zones", "availableZones"]).map((item) => ({
    id: String(item?.id || item?.azone_id || item?.azoneId || item?.name || ""),
    name: String(item?.name || item?.azone_name || item?.azoneName || item?.id || ""),
    type: String(item?.type || item?.azone_type || item?.azoneType || ""),
    status: String(item?.status || item?.state || "")
  })).filter((item) => item.id);
}

async function fetchCapacityByScope(session, scope) {
  const url = `${CAPACITY_BASE_URL}/rest/capacity/v1/capbase/${scope.path}/${encodeURIComponent(
    scope.id
  )}/resource-types/cpu,memory/current-capacities`;
  const body = await fetchJson(url, session, `${scope.scopeType} capacity ${scope.name}`);

  return {
    ...scope,
    capacity: computeCapacity(body),
    rawKeys: body && typeof body === "object" ? Object.keys(body).sort() : [],
    shape: {
      cpu: summarizeShape(body?.cpu),
      memory: summarizeShape(body?.memory),
      bmsCpu: summarizeShape(body?.bms?.cpu),
      bmsMemory: summarizeShape(body?.bms?.memory)
    }
  };
}

async function diagnoseRegion(session, region, flavors) {
  const result = {
    region,
    scopes: [],
    errors: []
  };

  const regionScope = {
    scopeType: "region",
    path: "regions",
    id: region.regionId,
    name: region.regionName
  };

  try {
    result.scopes.push(await fetchCapacityByScope(session, regionScope));
  } catch (error) {
    result.errors.push(`region ${region.regionName}: ${error instanceof Error ? error.message : String(error)}`);
  }

  let cloudInfras = [];
  try {
    cloudInfras = await discoverCloudInfras(session, region);
  } catch (error) {
    result.errors.push(`cloud-infras ${region.regionName}: ${error instanceof Error ? error.message : String(error)}`);
  }

  const resourcePoolIds = new Set([region.cloudInfraId, ...cloudInfras.map((item) => item?.id).filter(Boolean)]);
  for (const resourcePoolId of resourcePoolIds) {
    const poolScope = {
      scopeType: "resourcePool",
      path: "resource-pools",
      id: String(resourcePoolId),
      name: String(resourcePoolId)
    };

    try {
      result.scopes.push(await fetchCapacityByScope(session, poolScope));
    } catch (error) {
      result.errors.push(
        `resource pool ${region.regionName}/${resourcePoolId}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  try {
    const azones = await discoverAzones(session, region, region.cloudInfraId);
    result.azones = azones;

    for (const azone of azones) {
      const azoneScope = {
        scopeType: "azone",
        path: "azones",
        id: azone.id,
        name: azone.name || azone.id,
        azone
      };

      try {
        result.scopes.push(await fetchCapacityByScope(session, azoneScope));
      } catch (error) {
        result.errors.push(
          `azone ${region.regionName}/${azone.id}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  } catch (error) {
    result.errors.push(`available-zones ${region.regionName}: ${error instanceof Error ? error.message : String(error)}`);
  }

  result.scopes = result.scopes.map((scope) => ({
    ...scope,
    fit: fitFlavors(scope.capacity, flavors)
  }));

  return result;
}

function selectedRegions() {
  const filter = String(process.env.MANAGEONE_COMPUTE_REGION_FILTER || "").trim().toLowerCase();
  if (!filter) return REGIONS;

  return REGIONS.filter(
    (region) =>
      region.regionName.toLowerCase().includes(filter) ||
      region.regionId.toLowerCase().includes(filter) ||
      region.cloudInfraId.toLowerCase().includes(filter)
  );
}

function printHumanSummary(report) {
  console.log("\n================ ECS COMPUTE CAPACITY SUMMARY ================");
  for (const region of report.regions) {
    console.log(`\n${region.region.regionName}`);
    for (const scope of region.scopes) {
      const capacity = scope.capacity;
      console.log(
        `- ${scope.scopeType} ${scope.name}: CPU free ${capacity?.cpuUsedForFit ?? "?"}, RAM free ${
          capacity?.memoryGbUsedForFit?.toFixed ? capacity.memoryGbUsedForFit.toFixed(1) : capacity?.memoryGbUsedForFit ?? "?"
        } GB, fit source ${capacity?.sourceForFit || "unknown"}`
      );
      for (const flavor of scope.fit) {
        console.log(`  ${flavor.name} (${flavor.vcpus} vCPU/${flavor.ramGb} GB): ${flavor.status} - ${flavor.reason}`);
      }
    }
    for (const error of region.errors) {
      console.log(`  ERROR: ${error}`);
    }
  }
}

async function main() {
  console.log("[ECS COMPUTE CAPACITY] read-only diagnostic started");
  console.log("[ECS COMPUTE CAPACITY] no DB writes, no CRM push, no API response changes");

  const session = await authenticate();
  const flavors = parseFlavorList();
  const regions = selectedRegions();
  const report = {
    generatedAt: new Date().toISOString(),
    note:
      "This is an aggregate CPU/RAM fit estimate. A real ECS create can still fail because of scheduler rules, host fragmentation, quota, AZ policy, image constraints, or storage/network constraints.",
    flavors,
    regionCount: regions.length,
    regions: []
  };

  for (const region of regions) {
    console.log(`[ECS COMPUTE CAPACITY] diagnosing ${region.regionName}`);
    report.regions.push(await diagnoseRegion(session, region, flavors));
  }

  printHumanSummary(report);
  console.log("\n================ ECS COMPUTE CAPACITY REPORT ================");
  console.log(JSON.stringify(report, null, 2));
  console.log("================ END ECS COMPUTE CAPACITY REPORT ================");
}

main().catch((error) => {
  console.error(
    `[ECS COMPUTE CAPACITY] failed: ${
      error instanceof Error ? error.stack || error.message : String(error || "Unknown error")
    }`
  );
  process.exitCode = 1;
});
