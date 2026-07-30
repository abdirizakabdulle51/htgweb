import "dotenv/config";
import { authenticate, listAllVdcs } from "../manageone.js";

// Temporary manual verification script for Cloud Health drill-down research.
// Safe to delete after AZ capacity, tenant region mapping, and alarm reachability are confirmed.

const DEFAULT_AUTH_BASE_URL = "https://10.20.24.9:26335";
const DEFAULT_MANAGEONE_BASE_URL = "https://10.20.24.9:26335/rest/vdc";
const REQUEST_TIMEOUT_MS = Number(process.env.MANAGEONE_TIMEOUT_MS || 30000);
const MAX_BODY_PRINT_CHARS = 6000;

const REGIONS = [
  {
    regionId: "3A462C0E713B3BF389CC4359D2618F9D",
    regionName: "Mogadishu-region-hq3",
    cloudInfraId: "FUSION_CLOUD_htgcloud-region-02",
    azoneCandidates: ["3A462C0E713B3BF389CC4359D2618F9D", "az1.hq3", "az2.hq3"]
  },
  {
    regionId: "3A03042C29813F5DBA6DBDC2E95CB101",
    regionName: "Hoa-Mogadishu-2",
    cloudInfraId: "FUSION_CLOUD_hoa-mogadishu-2",
    azoneCandidates: ["3A03042C29813F5DBA6DBDC2E95CB101", "az1.cls", "az2.cls"]
  }
];

const REGION_FIELD_KEYS = [
  "region_id",
  "regionId",
  "region_name",
  "regionName",
  "logicalRegionId",
  "logicalRegionName",
  "cloud_infra_id",
  "cloudInfraId",
  "azone_id",
  "azoneId",
  "azone_name",
  "azoneName",
  "az_code",
  "available_zone",
  "availability_zone",
  "availableZone"
];

function stripTrailingSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

function authBaseUrl() {
  return stripTrailingSlash(process.env.MANAGEONE_AUTH_BASE_URL || DEFAULT_AUTH_BASE_URL);
}

function vdcBaseUrl() {
  return stripTrailingSlash(process.env.MANAGEONE_BASE_URL || DEFAULT_MANAGEONE_BASE_URL);
}

function truncate(value) {
  if (!value || value.length <= MAX_BODY_PRINT_CHARS) return value || "";
  return `${value.slice(0, MAX_BODY_PRINT_CHARS)}\n...[truncated after ${MAX_BODY_PRINT_CHARS} chars]`;
}

function classifyStatus(status) {
  if (status === 401 || status === 403) return "auth/permission";
  if (status === 404) return "not found";
  if (status >= 200 && status < 300) return "ok";
  return "unexpected";
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

async function fetchTextWithTimeout(url, session, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "GET",
      ...options,
      headers: {
        Accept: "application/json, text/plain, */*",
        "Content-Type": "application/json",
        "X-Auth-Token": session.token,
        ...(options.headers || {})
      },
      redirect: "manual",
      signal: controller.signal
    });
    const text = await response.text();
    return { response, text };
  } finally {
    clearTimeout(timeout);
  }
}

function parseJson(text) {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

function logHttpResult(label, result) {
  if (result.error) {
    console.log(`[${label}] HTTP status: no response`);
    console.log(`[${label}] ${result.error}`);
    return;
  }

  console.log(`[${label}] HTTP status: ${result.response.status} (${classifyStatus(result.response.status)})`);
  console.log(`[${label}] Raw response:`);
  console.log(truncate(result.text));
}

async function tryGet(label, url, session) {
  console.log(`\n--- ${label}`);
  console.log(`GET ${url}`);

  try {
    const result = await fetchTextWithTimeout(url, session);
    logHttpResult(label, result);
    return { ...result, parsed: parseJson(result.text) };
  } catch (error) {
    const result = { error: classifyNetworkError(error) };
    logHttpResult(label, result);
    return result;
  }
}

function listFromResponse(body, keys) {
  if (!body || typeof body !== "object") return [];
  if (Array.isArray(body)) return body;

  for (const key of keys) {
    if (Array.isArray(body[key])) return body[key];
  }

  return [];
}

function capacityShapeSummary(body) {
  return {
    hasCpuMemoryCpu: !!body?.cpuMemory?.cpu,
    hasCpuMemoryMemory: !!body?.cpuMemory?.memory,
    hasStorageCapacityList: Array.isArray(body?.storage?.capacityList),
    storageCapacityCount: Array.isArray(body?.storage?.capacityList) ? body.storage.capacityList.length : 0,
    hasVolumeTypeDimension: Array.isArray(body?.storage?.capacityList)
      ? body.storage.capacityList.some((item) =>
          Array.isArray(item?.dimensions) &&
          item.dimensions.some((dimension) => dimension?.dimensionType === "volumeTypeName")
        )
      : false,
    volumeTypeValues: Array.isArray(body?.storage?.capacityList)
      ? [
          ...new Set(
            body.storage.capacityList.flatMap((item) =>
              Array.isArray(item?.dimensions)
                ? item.dimensions
                    .filter((dimension) => dimension?.dimensionType === "volumeTypeName")
                    .map((dimension) => dimension.dimensionValue || dimension.volumeTypeOriginal)
                    .filter(Boolean)
                : []
            )
          )
        ]
      : [],
    hasVmCountVm: !!body?.vmCount?.vm
  };
}

async function discoverAvailableZones(session) {
  const discovered = [];

  for (const region of REGIONS) {
    const url = `${authBaseUrl()}/rest/serviceaccess/v3.0/available-zones?cloud_infra_id=${encodeURIComponent(
      region.cloudInfraId
    )}`;
    const result = await tryGet(`AZ DISCOVERY ${region.regionName}`, url, session);
    const records = listFromResponse(result.parsed, ["records", "available_zones", "availableZones"]);

    for (const record of records) {
      const id = record?.id || record?.azone_id || record?.azoneId || record?.name;
      if (!id) continue;

      discovered.push({
        source: "available-zones",
        region,
        azoneId: String(id),
        cloudInfraId: region.cloudInfraId,
        record
      });
    }
  }

  return discovered;
}

async function verifyAzCapacity(session) {
  const candidates = await discoverAvailableZones(session);

  for (const region of REGIONS) {
    for (const azoneId of region.azoneCandidates) {
      candidates.push({
        source: azoneId === region.regionId ? "direct-region-id-as-azone" : "configured-az-candidate",
        region,
        azoneId,
        cloudInfraId: region.cloudInfraId
      });
    }
  }

  const seen = new Set();

  for (const candidate of candidates) {
    const key = `${candidate.cloudInfraId}|${candidate.azoneId}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const url = `${vdcBaseUrl()}/v3.0/capacity/azone/${encodeURIComponent(
      candidate.azoneId
    )}?cloud_infra_id=${encodeURIComponent(candidate.cloudInfraId)}`;
    const result = await tryGet(
      `AZ CAPACITY ${candidate.region.regionName} via ${candidate.source}`,
      url,
      session
    );

    if (result.response?.ok) {
      const summary = capacityShapeSummary(result.parsed);
      console.log("[AZ CAPACITY] Shape summary:");
      console.log(JSON.stringify(summary, null, 2));

      return {
        status: "working",
        realDataConfirmed:
          summary.hasCpuMemoryCpu &&
          summary.hasCpuMemoryMemory &&
          summary.hasStorageCapacityList &&
          summary.hasVmCountVm,
        approach: candidate.source,
        azoneId: candidate.azoneId,
        cloudInfraId: candidate.cloudInfraId,
        summary
      };
    }
  }

  return {
    status: "broken",
    realDataConfirmed: false,
    approach: "none"
  };
}

function collectFields(value, path = "", matches = []) {
  if (!value || typeof value !== "object") return matches;

  if (Array.isArray(value)) {
    value.forEach((item, index) => collectFields(item, `${path}[${index}]`, matches));
    return matches;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    const currentPath = path ? `${path}.${key}` : key;
    if (REGION_FIELD_KEYS.includes(key)) {
      matches.push({ path: currentPath, value: nestedValue });
    }
    collectFields(nestedValue, currentPath, matches);
  }

  return matches;
}

async function pickTenant(session) {
  const envVdcId = process.env.MANAGEONE_VERIFY_VDC_ID;
  const vdcs = await listAllVdcs({ upper_vdc_id: "0", used: "true" });
  const selected = envVdcId
    ? vdcs.find((vdc) => String(vdc.id) === envVdcId || String(vdc.vdc_id) === envVdcId)
    : vdcs.find((vdc) => vdc?.id && vdc?.domain_id) || vdcs.find((vdc) => vdc?.id);

  if (!selected) {
    console.log("[TENANT REGION] No VDC found from listAllVdcs; skipping tenant mapping and tenant alarm checks");
    return { vdc: null, projects: [] };
  }

  console.log(`\n[TENANT REGION] Selected VDC: ${selected.name || selected.id} (${selected.id})`);

  const projectsUrl = `${vdcBaseUrl()}/v3.1/vdcs/${encodeURIComponent(selected.id)}/projects?start=0&limit=10`;
  const projectsResult = await tryGet("TENANT PROJECTS", projectsUrl, session);
  const projects = listFromResponse(projectsResult.parsed, ["projects", "project_list"]);

  return { vdc: selected, projects };
}

async function verifyTenantRegionMapping(session, tenantContext) {
  const { vdc, projects } = tenantContext;
  if (!vdc) return { status: "not found", field: "" };

  const candidates = [
    `${vdcBaseUrl()}/v3.0/vdcs/${encodeURIComponent(vdc.id)}`,
    `${vdcBaseUrl()}/v3.1/vdcs/${encodeURIComponent(vdc.id)}`,
    `${vdcBaseUrl()}/v3.2/vdcs/${encodeURIComponent(vdc.id)}`,
    `${vdcBaseUrl()}/v3.1/vdcs/${encodeURIComponent(vdc.id)}/projects?start=0&limit=10`
  ];

  const allMatches = [];

  for (const url of candidates) {
    const result = await tryGet("TENANT REGION CANDIDATE", url, session);
    if (!result.response?.ok) continue;

    const matches = collectFields(result.parsed);
    if (matches.length > 0) {
      allMatches.push({ url, matches });
    }
  }

  if (projects.length > 0) {
    console.log("[TENANT REGION] Project records found:");
    console.log(JSON.stringify(projects, null, 2));
  }

  if (allMatches.length > 0) {
    console.log("[TENANT REGION] Region/AZ-like fields found:");
    console.log(JSON.stringify(allMatches, null, 2));
    const first = allMatches[0].matches[0];
    return { status: "found", field: first.path };
  }

  console.log("[TENANT REGION] No region/AZ-like field found in tested VDC/project detail responses");
  return { status: "not found", field: "" };
}

async function discoverApplicationId(session) {
  const urls = [
    `${authBaseUrl()}/rest/application/v3.0/applications?start=0&limit=5`,
    `${authBaseUrl()}/rest/application/v3.0/applications`
  ];

  for (const url of urls) {
    const result = await tryGet("APPLICATION LIST", url, session);
    if (!result.response?.ok) continue;

    const apps = listFromResponse(result.parsed, ["applications", "apps", "data", "records"]);
    const app = apps.find((item) => item?.id || item?.application_id || item?.applicationId);
    if (app) {
      const id = app.id || app.application_id || app.applicationId;
      console.log(`[ALARMS] Application id discovered from application list: ${id}`);
      return String(id);
    }
  }

  const envApplicationId = process.env.MANAGEONE_VERIFY_APPLICATION_ID;
  if (envApplicationId) {
    console.log(`[ALARMS] Using MANAGEONE_VERIFY_APPLICATION_ID=${envApplicationId}`);
    return envApplicationId;
  }

  console.log("[ALARMS] No application id discovered; set MANAGEONE_VERIFY_APPLICATION_ID to test application current-alarms");
  return "";
}

async function verifyAlarms(session, tenantContext) {
  const outcomes = [];
  const applicationId = await discoverApplicationId(session);

  if (applicationId) {
    const condition = encodeURIComponent(JSON.stringify({ start: 0, limit: 5 }));
    const appAlarmUrl = `${authBaseUrl()}/rest/application/v3.0/applications/${encodeURIComponent(
      applicationId
    )}/current-alarms?condition=${condition}`;
    const result = await tryGet("APPLICATION CURRENT ALARMS", appAlarmUrl, session);
    outcomes.push({ endpoint: "application-current-alarms", status: result.response?.status, ok: result.response?.ok });
  } else {
    outcomes.push({ endpoint: "application-current-alarms", status: "no application id", ok: false });
  }

  const projectIds = [
    ...(tenantContext.projects || []).map((project) => project?.id || project?.project_id || project?.projectId),
    tenantContext.vdc?.domain_id,
    tenantContext.vdc?.id
  ]
    .filter(Boolean)
    .map(String);

  for (const projectId of [...new Set(projectIds)].slice(0, 3)) {
    const alarmsUrl = `${authBaseUrl()}/V1.0/${encodeURIComponent(projectId)}/alarms?start=0&limit=5`;
    const result = await tryGet(`CES ALARMS project_id=${projectId}`, alarmsUrl, session);
    outcomes.push({ endpoint: "ces-alarms", projectId, status: result.response?.status, ok: result.response?.ok });
  }

  if (outcomes.some((outcome) => outcome.ok)) return { status: "reachable", outcomes };
  if (outcomes.some((outcome) => outcome.status === 401 || outcome.status === 403)) return { status: "permission denied", outcomes };
  if (outcomes.some((outcome) => outcome.status === 404)) return { status: "not found", outcomes };

  return { status: "unknown", outcomes };
}

async function main() {
  console.log("[DRILLDOWN VERIFY] Starting ManageOne Cloud Health drill-down verification");

  const session = await authenticate();

  const azCapacity = await verifyAzCapacity(session);
  const tenantContext = await pickTenant(session);
  const tenantRegionMapping = await verifyTenantRegionMapping(session, tenantContext);
  const alarms = await verifyAlarms(session, tenantContext);

  console.log("\n================ SUMMARY ================");
  console.log(
    `AZ_CAPACITY: ${azCapacity.status}, real data confirmed ${azCapacity.realDataConfirmed ? "yes" : "no"}${
      azCapacity.azoneId ? `, approach=${azCapacity.approach}, azone_id=${azCapacity.azoneId}, cloud_infra_id=${azCapacity.cloudInfraId}` : ""
    }`
  );
  console.log(
    `TENANT_REGION_MAPPING: ${tenantRegionMapping.status}${
      tenantRegionMapping.field ? `, field=${tenantRegionMapping.field}` : ""
    }`
  );
  console.log(`ALARMS: ${alarms.status}`);
  console.log("=========================================");
}

main().catch((error) => {
  console.error(
    `[DRILLDOWN VERIFY] FAILURE: ${
      error instanceof Error ? error.stack || error.message : String(error || "unknown error")
    }`
  );
  process.exitCode = 1;
});
