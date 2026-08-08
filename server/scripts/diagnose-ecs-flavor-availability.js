import "dotenv/config";
import { authenticate } from "../manageone.js";

const PRODUCT_BASE_URL = (process.env.MANAGEONE_PRODUCT_BASE_URL || "https://10.20.24.9:26335").replace(/\/+$/, "");
const REQUEST_TIMEOUT_MS = Number(process.env.MANAGEONE_TIMEOUT_MS || 30000);

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

function normalizeName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, "_");
}

function parseJson(text, label) {
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`${label} returned invalid JSON`);
  }
}

async function fetchText(url, session) {
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

    return text;
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`HTTP request timed out after ${REQUEST_TIMEOUT_MS}ms`);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
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

function compareTargetFlavors(flavors) {
  const availableNames = new Map();
  for (const flavor of flavors) {
    const name = flavorName(flavor);
    if (name) availableNames.set(normalizeName(name), flavor);
  }

  return TARGET_FLAVORS.map((target) => {
    const match = availableNames.get(normalizeName(target.name));
    return {
      ...target,
      available: Boolean(match),
      matchedName: match ? flavorName(match) : null,
      availabilityZones: Array.isArray(match?.availability_zone) ? match.availability_zone : []
    };
  });
}

function selectedRegions() {
  const filter = String(process.env.MANAGEONE_FLAVOR_REGION_FILTER || "").trim().toLowerCase();
  if (!filter) return REGIONS;

  return REGIONS.filter(
    (region) =>
      region.regionName.toLowerCase().includes(filter) ||
      region.regionCode.toLowerCase().includes(filter) ||
      region.regionId.toLowerCase().includes(filter)
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

async function queryFlavorsForRegion(session, region) {
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
        const text = await fetchText(url, session);
        const body = parseJson(text, `ECS flavor list for ${region.regionName}`);
        const flavors = extractFlavors(body);

        return {
          region,
          request: {
            regionId,
            resourcePoolId: region.cloudInfraId,
            flavorQueryParams
          },
          total: body?.total ?? flavors.length,
          flavorCount: flavors.length,
          matchedTargets: compareTargetFlavors(flavors),
          sampleFlavorNames: flavors.slice(0, 20).map(flavorName).filter(Boolean),
          attempts
        };
      } catch (error) {
        attempts.push({
          regionId,
          flavorQueryParams,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }

  return {
    region,
    request: null,
    total: 0,
    flavorCount: 0,
    matchedTargets: TARGET_FLAVORS.map((target) => ({ ...target, available: false })),
    sampleFlavorNames: [],
    attempts,
    error: `No flavor query attempt succeeded for ${region.regionName}`
  };
}

function printHumanSummary(report) {
  console.log("\n================ ECS FLAVOR AVAILABILITY SUMMARY ================");

  for (const region of report.regions) {
    const available = region.matchedTargets.filter((item) => item.available);
    const missing = region.matchedTargets.filter((item) => !item.available);
    console.log(`\n${region.region.regionName}`);
    if (region.error) console.log(`ERROR: ${region.error}`);
    if (region.request) {
      console.log(
        `request: region_id=${region.request.regionId} resource_pool_id=${region.request.resourcePoolId} returned ${region.flavorCount} flavor(s)`
      );
    }
    console.log(`available target flavors: ${available.length}/${region.matchedTargets.length}`);
    console.log(`available: ${available.map((item) => item.name).join(", ") || "none"}`);
    console.log(`missing: ${missing.map((item) => item.name).join(", ") || "none"}`);
  }
}

async function main() {
  console.log("[ECS FLAVOR AVAILABILITY] read-only diagnostic started");
  console.log("[ECS FLAVOR AVAILABILITY] no DB writes, no CRM push, no API response changes");

  const session = await authenticate();
  const regions = selectedRegions();
  const report = {
    generatedAt: new Date().toISOString(),
    note:
      "This checks whether ManageOne exposes ECS flavors for each region/resource pool. It does not guarantee successful ECS creation; combine with capacity, quota, image, storage, network, and scheduler checks.",
    targetFlavorCount: TARGET_FLAVORS.length,
    regions: []
  };

  for (const region of regions) {
    console.log(`[ECS FLAVOR AVAILABILITY] diagnosing ${region.regionName}`);
    report.regions.push(await queryFlavorsForRegion(session, region));
  }

  printHumanSummary(report);
  console.log("\n================ ECS FLAVOR AVAILABILITY REPORT ================");
  console.log(JSON.stringify(report, null, 2));
  console.log("================ END ECS FLAVOR AVAILABILITY REPORT ================");
}

main().catch((error) => {
  console.error(
    `[ECS FLAVOR AVAILABILITY] failed: ${
      error instanceof Error ? error.stack || error.message : String(error || "Unknown error")
    }`
  );
  process.exitCode = 1;
});
