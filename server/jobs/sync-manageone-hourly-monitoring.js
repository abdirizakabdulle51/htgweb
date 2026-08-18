import "dotenv/config";
import { authenticate, listAllVdcs } from "../manageone.js";

const DEFAULT_MANAGEONE_BASE_URL = "https://10.20.24.9:26335/rest/vdc";
const RESOURCE_USAGE_REQUEST_DELAY_MS = Number(
  process.env.MANAGEONE_HOURLY_MONITORING_DELAY_MS || 1000,
);
const MANAGEONE_READ_TIMEOUT_MS = Number(
  process.env.MANAGEONE_HOURLY_MONITORING_TIMEOUT_MS || 30000,
);
const RESOURCE_PAGE_LIMIT = 100;
const RESOURCE_MAX_PAGES = 20;
const PROJECT_PAGE_LIMIT = 100;
const PROJECT_MAX_PAGES = 20;
const NATIVE_RESOURCE_PAGE_LIMIT = 500;
const NATIVE_RESOURCE_MAX_PAGES = 10;
const NAT_RESOURCE_TYPE_NAME = "CLOUD_NAT_INSTANCE";
const BMS_RESOURCE_TYPE_NAME = "CLOUD_BMS_INSTANCE";
const CCE_NODE_RESOURCE_TYPE_NAME = "CLOUD_CCE_NODE";
const PROJECT_NATIVE_RESOURCE_PROBES = [
  { key: "ecs", serviceId: "ecs", resourceTypeName: "CLOUD_ECS_INSTANCE", required: false },
  { key: "cce", serviceId: "cce", resourceTypeName: "CLOUD_CCE_NODE", required: false },
  { key: "cceCloudNode", serviceId: "cce", resourceTypeName: "CLOUD_NODE", required: false },
  { key: "evs", serviceId: "evs", resourceTypeName: "CLOUD_EVS_INSTANCE", required: false },
  { key: "bms", serviceId: "bms", resourceTypeName: "CLOUD_BMS_INSTANCE", required: false },
];
const DEFAULT_CAPACITY_BASE_URL = "https://10.20.24.9:26335";
const OBS_CAPACITY_REGIONS = [
  {
    regionId: "3A462C0E713B3BF389CC4359D2618F9D",
    regionCode: "htgcloud-region-02",
    regionName: "Mogadishu-region-hq3",
  },
  {
    regionId: "3A03042C29813F5DBA6DBDC2E95CB101",
    regionCode: "hoa-mogadishu-2",
    regionName: "Hoa-Mogadishu-2",
  },
];
const TENANT_FILTER = String(
  process.env.MANAGEONE_HOURLY_MONITORING_TENANT_FILTER || "",
)
  .trim()
  .toLowerCase();
const REGION_FILTER = String(
  process.env.MANAGEONE_HOURLY_MONITORING_REGION_FILTER || "",
)
  .trim()
  .toLowerCase();
const INCLUDE_NAT_GATEWAYS =
  process.env.MANAGEONE_HOURLY_MONITORING_NAT_GATEWAYS === "true";
const SYNC_URL = String(process.env.MANAGEONE_HOURLY_SYNC_URL || "").trim();
const SYNC_SECRET = String(process.env.MANAGEONE_HOURLY_SYNC_SECRET || "").trim();

class HttpStatusError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "HttpStatusError";
    this.status = status;
  }
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function stripTrailingSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "");
}

function numberOrNull(value) {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizedKey(value) {
  return String(value || "").trim().toLowerCase();
}

function tenantMatchesFilter(vdc, filter) {
  if (!filter) return true;
  if (filter === "__all__") return true;

  const haystack = `${vdc?.name || ""} ${vdc?.id || ""} ${vdc?.domain_id || ""}`.toLowerCase();
  return commaFilterMatches(filter, haystack);
}

function regionMatchesFilter(region, filter) {
  if (!filter) return true;
  if (filter === "__all__") return true;

  const haystack = `${region?.regionName || ""} ${region?.regionId || ""}`.toLowerCase();
  return commaFilterMatches(filter, haystack);
}

function commaFilterMatches(filter, haystack) {
  return filter
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .some((filterItem) => haystack.includes(filterItem));
}

function manageOneRootUrl() {
  return stripTrailingSlash(process.env.MANAGEONE_BASE_URL || DEFAULT_MANAGEONE_BASE_URL).replace(/\/rest\/vdc$/, "");
}

function vdcEndpointBaseUrl() {
  return stripTrailingSlash(process.env.MANAGEONE_BASE_URL || DEFAULT_MANAGEONE_BASE_URL);
}

function resourceEndpointBaseUrl() {
  return `${manageOneRootUrl()}/rest/resource`;
}

function capacityBaseUrl() {
  return stripTrailingSlash(process.env.MANAGEONE_CAPACITY_BASE_URL || DEFAULT_CAPACITY_BASE_URL);
}

async function fetchTextWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MANAGEONE_READ_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    const text = await response.text();
    return { response, text };
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`HTTP request timed out after ${MANAGEONE_READ_TIMEOUT_MS}ms`);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function listFromResponse(body, keys) {
  for (const key of keys) {
    const value = body?.[key] || body?.data?.[key];
    if (Array.isArray(value)) return value;
  }

  return [];
}

function parseJsonResponse(text, label) {
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`${label} returned invalid JSON: ${String(text || "").slice(0, 300)}`);
  }
}

function normalizeObsIdentity(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function obsTenantRows(body) {
  if (Array.isArray(body?.tenant)) return body.tenant;
  if (Array.isArray(body?.obs?.tenant)) return body.obs.tenant;
  if (Array.isArray(body?.OBSCapacity?.tenant)) return body.OBSCapacity.tenant;
  if (Array.isArray(body?.data?.tenant)) return body.data.tenant;
  if (Array.isArray(body?.data?.obs?.tenant)) return body.data.obs.tenant;
  if (Array.isArray(body?.data?.OBSCapacity?.tenant)) return body.data.OBSCapacity.tenant;
  if (Array.isArray(body?.tenants)) return body.tenants;
  if (Array.isArray(body?.data?.tenants)) return body.data.tenants;
  if (Array.isArray(body?.rows)) return body.rows;
  if (Array.isArray(body?.data?.rows)) return body.data.rows;
  if (Array.isArray(body?.items)) return body.items;
  if (Array.isArray(body?.data?.items)) return body.data.items;
  return [];
}

function obsTenantRowMatches(row, tenant) {
  const tenantKeys = [
    tenant?.name,
    tenant?.id,
    tenant?.domain_id,
    tenant?.domainId,
    tenant?.vdcId,
    tenant?.tenantName,
  ].map(normalizeObsIdentity);
  const rowKeys = [
    row?.tenantName,
    row?.tenant_name,
    row?.name,
    row?.tenantId,
    row?.tenant_id,
    row?.vdcId,
    row?.vdc_id,
    row?.domainId,
    row?.domain_id,
  ].map(normalizeObsIdentity);
  return rowKeys.some((rowKey) => rowKey && tenantKeys.includes(rowKey));
}

function obsBucketUsedMb(row) {
  const value = firstDefined(row?.bucketUsed, row?.bucket_used, row?.usedMb, row?.used_mb, row?.used, row?.usage);
  const numericValue = numberOrNull(value);
  if (numericValue !== null) return numericValue;

  const match = String(value || "")
    .trim()
    .match(/^(-?\d+(?:\.\d+)?)\s*([a-z]+)?$/i);
  if (!match) return null;

  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) return null;

  const unit = String(match[2] || "MB").toLowerCase();
  if (unit === "gb" || unit === "gib") return amount * 1024;
  if (unit === "kb" || unit === "kib") return amount / 1024;
  if (unit === "b" || unit === "byte" || unit === "bytes") return amount / (1024 * 1024);
  return amount;
}

function obsBucketUsedGb(row) {
  const usedMb = obsBucketUsedMb(row);
  if (usedMb === null || usedMb <= 0) return 0;
  return Math.round((usedMb / 1024) * 1000) / 1000;
}

function obsCapacityRowSample(row) {
  return {
    tenantName: firstDefined(row?.tenantName, row?.tenant_name, row?.name) ?? null,
    tenantId: firstDefined(row?.tenantId, row?.tenant_id) ?? null,
    vdcId: firstDefined(row?.vdcId, row?.vdc_id) ?? null,
    domainId: firstDefined(row?.domainId, row?.domain_id) ?? null,
    bucketUsed: firstDefined(row?.bucketUsed, row?.bucket_used, row?.usedMb, row?.used_mb, row?.used, row?.usage) ?? null,
  };
}

async function fetchObsCapacity(region, session) {
  const url = `${capacityBaseUrl()}/rest/capacity/v1/capbase/regions/${encodeURIComponent(
    region.regionId,
  )}/resource-types/obs/current-capacities`;
  const { response, text } = await fetchTextWithTimeout(url, {
    method: "GET",
    headers: {
      Accept: "application/json, text/plain, */*",
      "Content-Type": "application/json",
      "X-Auth-Token": session.token,
    },
    redirect: "manual",
  });

  if (!response.ok) {
    throw new HttpStatusError(response.status, `HTTP ${response.status}${text ? ` ${text.slice(0, 500)}` : ""}`);
  }

  return obsTenantRows(parseJsonResponse(text, `OBS capacity for ${region.regionName}`));
}

async function fetchObsGbByTenant(session, vdcs) {
  const obsGbByVdcRegion = new Map();

  for (const region of OBS_CAPACITY_REGIONS) {
    try {
      const rows = await fetchObsCapacity(region, session);
      console.log(`[MANAGEONE HOURLY] OBS3 capacity probe for ${region.regionName}: ${rows.length} tenant bucket row(s)`);

      let regionMatchCount = 0;
      for (const vdc of vdcs) {
        const matches = rows.filter((row) => obsTenantRowMatches(row, vdc));
        if (matches.length === 0) continue;

        const totalGb = matches.reduce((total, row) => total + obsBucketUsedGb(row), 0);
        if (totalGb <= 0) continue;

        regionMatchCount += matches.length;
        const key = `${String(vdc.id)}|${regionKey(region)}`;
        obsGbByVdcRegion.set(key, Math.round(((obsGbByVdcRegion.get(key) || 0) + totalGb) * 1000) / 1000);
      }

      if (rows.length > 0 && regionMatchCount === 0) {
        console.warn(
          `[MANAGEONE HOURLY] OBS3 capacity rows for ${region.regionName} did not match selected tenants; sample ${JSON.stringify(
            rows.slice(0, 3).map(obsCapacityRowSample),
          )}`,
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error || "Unknown error");
      console.warn(`[MANAGEONE HOURLY] OBS3 capacity probe skipped for ${region.regionName}: ${message}`);
    }
  }

  return obsGbByVdcRegion;
}

function obsGbForRegion(obsGbByVdcRegion, vdc, region) {
  const exact = obsGbByVdcRegion.get(`${String(vdc.id)}|${regionKey(region)}`);
  if (exact !== undefined) return exact;

  const regionName = normalizedKey(region?.regionName);
  if (!regionName) return undefined;

  for (const [key, value] of obsGbByVdcRegion.entries()) {
    if (key.startsWith(`${String(vdc.id)}|`) && key.endsWith(`|${regionName}`)) {
      return value;
    }
  }

  return undefined;
}

function totalObsGbForTenant(obsGbByVdcRegion, vdc) {
  let total = 0;
  for (const [key, value] of obsGbByVdcRegion.entries()) {
    if (key.startsWith(`${String(vdc.id)}|`)) {
      total += numberOrNull(value) || 0;
    }
  }

  return total > 0 ? Math.round(total * 1000) / 1000 : undefined;
}

function responseTotal(body) {
  const total = Number(body?.total ?? body?.totalNum);
  return Number.isFinite(total) ? total : null;
}

function shouldFetchNextPage({ reportedTotal, start, pageSize, pageResourceCount }) {
  if (pageResourceCount === 0) return false;
  if (reportedTotal !== null && reportedTotal > start + pageResourceCount) return true;

  return pageResourceCount >= pageSize;
}

function parseLocalizedName(value) {
  if (!value) return null;
  if (typeof value === "object") {
    return value.en_us || value.en_US || value["en-us"] || value.zh_cn || value.zh_CN || null;
  }

  if (typeof value !== "string") return null;

  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === "object") {
      return parsed.en_us || parsed.en_US || parsed["en-us"] || parsed.zh_cn || parsed.zh_CN || value;
    }
  } catch {
    return value;
  }

  return value;
}

function extractTenantRegion(detail) {
  const body = detail?.vdc || detail?.VDC || detail;
  const regions = Array.isArray(body?.regions) ? body.regions : [];
  const region = regions[0];
  if (!region) return null;

  const regionId = region.region_id || region.regionId || region.id;
  const regionName = parseLocalizedName(region.region_name || region.regionName || region.name);
  if (!regionId && !regionName) return null;

  return {
    ...(regionId ? { regionId: String(regionId) } : {}),
    ...(regionName ? { regionName: String(regionName) } : {}),
  };
}

function extractProjectRegions(project) {
  const regions = Array.isArray(project?.regions) ? project.regions : [];

  return regions
    .map((region) => ({
      regionId: firstDefined(region.region_id, region.regionId, region.id),
      regionName: parseLocalizedName(firstDefined(region.region_name, region.regionName, region.name)),
    }))
    .filter((region) => region.regionId || region.regionName)
    .map((region) => ({
      ...(region.regionId ? { regionId: String(region.regionId) } : {}),
      ...(region.regionName ? { regionName: String(region.regionName) } : {}),
    }));
}

function projectId(project) {
  const value = firstDefined(project?.id, project?.project_id, project?.projectId);
  return value ? String(value) : null;
}

function projectName(project) {
  return String(
    firstDefined(
      project?.resource_space_name,
      project?.resourceSpaceName,
      project?.display_name,
      project?.displayName,
      project?.iam_project_name,
      project?.name,
      project?.id,
      "unknown",
    ),
  );
}

function regionKey(region) {
  return `${normalizedKey(region?.regionId)}|${normalizedKey(region?.regionName)}`;
}

function mergeRegion(existing, next) {
  return {
    ...(existing?.regionId || next?.regionId ? { regionId: existing?.regionId || next?.regionId } : {}),
    ...(existing?.regionName || next?.regionName ? { regionName: existing?.regionName || next?.regionName } : {}),
  };
}

async function fetchProjectPage(vdc, session, start, limit) {
  const url = `${vdcEndpointBaseUrl()}/v3.1/vdcs/${encodeURIComponent(vdc.id)}/projects?start=${start}&limit=${limit}`;
  const { response, text } = await fetchTextWithTimeout(url, {
    method: "GET",
    headers: {
      Accept: "application/json, text/plain, */*",
      "X-Auth-Token": session.token,
    },
    redirect: "manual",
  });

  if (!response.ok) {
    throw new HttpStatusError(response.status, `HTTP ${response.status}${text ? ` ${text}` : ""}`);
  }

  return text ? JSON.parse(text) : {};
}

async function listTenantProjects(vdc, session) {
  const projects = [];
  let start = 0;
  let page = 0;
  let hasNextPage = true;

  while (hasNextPage) {
    page += 1;
    if (page > PROJECT_MAX_PAGES) {
      throw new Error(`Project pagination exceeded ${PROJECT_MAX_PAGES} page(s) for ${vdc.name || vdc.id}`);
    }

    const body = await fetchProjectPage(vdc, session, start, PROJECT_PAGE_LIMIT);
    const pageProjects = listFromResponse(body, ["projects", "project_list"]);
    projects.push(...pageProjects);
    const reportedTotal = responseTotal(body);
    hasNextPage = shouldFetchNextPage({
      reportedTotal,
      start,
      pageSize: PROJECT_PAGE_LIMIT,
      pageResourceCount: pageProjects.length,
    });
    start += PROJECT_PAGE_LIMIT;

    if (hasNextPage) {
      await delay(RESOURCE_USAGE_REQUEST_DELAY_MS);
    }
  }

  return projects;
}

function projectRegionGroups(projects, fallbackRegion) {
  const groups = new Map();

  for (const project of projects) {
    const regions = extractProjectRegions(project);
    const region = regions[0] || fallbackRegion || {};
    const key = regionKey(region);
    if (key === "|") continue;

    const existing = groups.get(key) || {
      region: {},
      projects: [],
    };
    existing.region = mergeRegion(existing.region, region);
    existing.projects.push(project);
    groups.set(key, existing);
  }

  return [...groups.values()];
}

async function fetchTenantRegion(vdc, session) {
  const url = `${vdcEndpointBaseUrl()}/v3.0/vdcs/${encodeURIComponent(vdc.id)}`;
  const { response, text } = await fetchTextWithTimeout(url, {
    method: "GET",
    headers: {
      Accept: "application/json, text/plain, */*",
      "X-Auth-Token": session.token,
    },
    redirect: "manual",
  });

  if (!response.ok) {
    throw new HttpStatusError(response.status, `HTTP ${response.status}${text ? ` ${text}` : ""}`);
  }

  return extractTenantRegion(text ? JSON.parse(text) : {}) || {};
}

async function fetchTenantResourceUsage(vdcId, session) {
  const url = `${vdcEndpointBaseUrl()}/v3.0/capacity/${encodeURIComponent(vdcId)}/statics?inherit=true`;
  const { response, text } = await fetchTextWithTimeout(url, {
    method: "GET",
    headers: {
      Accept: "application/json, text/plain, */*",
      "X-Auth-Token": session.token,
    },
    redirect: "manual",
  });

  if (!response.ok) {
    throw new HttpStatusError(response.status, `HTTP ${response.status}${text ? ` ${text}` : ""}`);
  }

  return text ? JSON.parse(text) : {};
}

function flattenResourceUsage(resourceUsage) {
  const resources = [];

  function walk(value, serviceId = null) {
    if (!value || typeof value !== "object") return;

    if (Array.isArray(value)) {
      for (const item of value) {
        walk(item, serviceId);
      }
      return;
    }

    const currentServiceId = firstDefined(value.service_id, value.serviceId, serviceId);
    const resource = firstDefined(value.resource, value.resource_name, value.resourceName, value.name);
    const used = firstDefined(value.used, value.used_value, value.usedValue);

    if (currentServiceId && resource && used !== undefined && used !== null && used !== "") {
      resources.push({
        serviceId: String(currentServiceId),
        resource: String(resource),
        used: numberOrNull(used),
      });
    }

    for (const child of Object.values(value)) {
      walk(child, currentServiceId);
    }
  }

  walk(resourceUsage);
  return resources;
}

function resourceUsed(resources, serviceId, resourceName) {
  const expectedServiceId = normalizedKey(serviceId);
  const expectedResourceName = normalizedKey(resourceName);
  const match = resources.find(
    (resource) =>
      normalizedKey(resource.serviceId) === expectedServiceId &&
      normalizedKey(resource.resource) === expectedResourceName,
  );

  return numberOrNull(match?.used) || 0;
}

function resourceUsedAny(resources, serviceId, resourceNames) {
  return resourceNames.reduce((total, resourceName) => total + resourceUsed(resources, serviceId, resourceName), 0);
}

function resourceUsedByPattern(resources, serviceIdPattern, resourcePattern) {
  const match = resources.find(
    (resource) =>
      serviceIdPattern.test(normalizedKey(resource.serviceId)) &&
      resourcePattern.test(normalizedKey(resource.resource)),
  );

  return numberOrNull(match?.used) || 0;
}

function obsGbFromResources(resources) {
  return (
    resourceUsed(resources, "obsv3", "capacity") ||
    resourceUsedByPattern(resources, /obs|obsv3/, /capacity|storage|gigabytes/)
  );
}

function sfsGbFromResources(resources) {
  return resourceUsed(resources, "sfs", "gigabytes") || resourceUsedByPattern(resources, /sfs/, /gigabytes|capacity|storage/);
}

function csbsGbFromResources(resources) {
  return (
    resourceUsed(resources, "csbs", "backup_capacity") ||
    resourceUsedByPattern(resources, /csbs/, /backup.*capacity|capacity|gigabytes/)
  );
}

function vbsGbFromResources(resources) {
  return (
    resourceUsed(resources, "vbs", "volume_backup_capacity") ||
    resourceUsedByPattern(resources, /vbs/, /volume.*backup.*capacity|backup.*capacity|capacity|gigabytes/)
  );
}

function vpcepEndpointsFromResources(resources) {
  return resourceUsedAny(resources, "vpc", ["endpoint", "endpoint_service"]);
}

function wafInstancesFromResources(resources) {
  const tieredWaf =
    resourceUsedAny(resources, "waf", ["waf.instance.100", "waf.instance.500"]) ||
    resourceUsedByPattern(resources, /waf/, /waf\.instance\.(100|500)|basic|enterprise/);
  return tieredWaf || resourceUsed(resources, "waf", "waf.instance") || resourceUsedByPattern(resources, /waf/, /instance/);
}

function wafBasicInstancesFromResources(resources) {
  return resourceUsed(resources, "waf", "waf.instance.100") || resourceUsedByPattern(resources, /waf/, /waf\.instance\.100|basic/);
}

function wafEnterpriseInstancesFromResources(resources) {
  return (
    resourceUsed(resources, "waf", "waf.instance.500") ||
    resourceUsedByPattern(resources, /waf/, /waf\.instance\.500|enterprise/)
  );
}

function nativeResourceIdentity(resource) {
  return firstDefined(
    resource?.id,
    resource?.resource_id,
    resource?.resourceId,
    resource?.native_resource_id,
    resource?.nativeResourceId,
    resource?.uuid,
    resource?.properties?.id,
    resource?.properties?.resource_id,
    resource?.properties?.resourceId,
  );
}

function recordsFromResponses(responses) {
  return responses.flatMap((body) => listFromResponse(body, ["resources", "resource_list", "native_resources"]));
}

async function fetchNativeResourcePage(vdc, projectId, probe, session, start, limit) {
  const params = new URLSearchParams({
    service_id: probe.serviceId,
    resource_type_name: probe.resourceTypeName,
    project_id: projectId,
    start: String(start),
    limit: String(limit),
  });
  const url = `${resourceEndpointBaseUrl()}/v3.0/native/resources?${params}`;
  const { response, text } = await fetchTextWithTimeout(url, {
    method: "GET",
    headers: {
      Accept: "application/json, text/plain, */*",
      "X-Auth-Token": session.token,
    },
    redirect: "manual",
  });

  if (!response.ok) {
    throw new HttpStatusError(response.status, `HTTP ${response.status}${text ? ` ${text}` : ""}`);
  }

  return text ? JSON.parse(text) : {};
}

async function fetchProjectNativeResources(vdc, projectId, probe, session) {
  const responses = [];
  let start = 0;
  let page = 0;
  let hasNextPage = true;

  while (hasNextPage) {
    page += 1;
    if (page > NATIVE_RESOURCE_MAX_PAGES) {
      throw new Error(
        `Native ${probe.key} pagination exceeded ${NATIVE_RESOURCE_MAX_PAGES} page(s) for ${vdc.name || vdc.id} project ${projectId}`,
      );
    }

    const body = await fetchNativeResourcePage(vdc, projectId, probe, session, start, NATIVE_RESOURCE_PAGE_LIMIT);
    responses.push(body);
    const pageResources = listFromResponse(body, ["resources", "resource_list", "native_resources"]);
    const reportedTotal = responseTotal(body);
    hasNextPage = shouldFetchNextPage({
      reportedTotal,
      start,
      pageSize: NATIVE_RESOURCE_PAGE_LIMIT,
      pageResourceCount: pageResources.length,
    });
    start += NATIVE_RESOURCE_PAGE_LIMIT;

    if (hasNextPage) {
      await delay(RESOURCE_USAGE_REQUEST_DELAY_MS);
    }
  }

  return responses;
}

function parseEcsFlavor(rawFlavor) {
  if (typeof rawFlavor !== "string") return null;

  const [vcpusValue, ramMbValue, ...nameParts] = rawFlavor.split("|");
  const flavorName = nameParts.join("|").trim();
  if (!flavorName || flavorName.toLowerCase().startsWith("waf.")) return null;

  return {
    flavorName,
    vcpus: numberOrNull(vcpusValue),
    ramMb: numberOrNull(ramMbValue),
  };
}

function parseEvsVolume(volume) {
  const properties = volume?.properties || {};
  const diskSize = numberOrNull(
    firstDefined(
      properties.disk_size,
      properties.diskSize,
      properties.size,
      properties.volume_size,
      properties.volumeSize,
      volume?.disk_size,
      volume?.diskSize,
      volume?.size,
    ),
  );
  return diskSize === null ? null : { diskSize };
}

function projectScopedTotals() {
  return {
    ecsInstances: 0,
    cceNodes: 0,
    ecsCores: 0,
    ecsRamGb: 0,
    evsGb: 0,
    bmsInstances: 0,
  };
}

function addUniqueRecord(seen, resource) {
  const identity = nativeResourceIdentity(resource);
  if (!identity) return true;

  const key = String(identity);
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
}

async function fetchProjectScopedTotals(vdc, projects, session) {
  const totals = projectScopedTotals();
  const seen = {
    ecs: new Set(),
    cce: new Set(),
    evs: new Set(),
    bms: new Set(),
  };

  for (const project of projects) {
    const id = projectId(project);
    if (!id) continue;

    for (const probe of PROJECT_NATIVE_RESOURCE_PROBES) {
      let records = [];
      try {
        const responses = await fetchProjectNativeResources(vdc, id, probe, session);
        records = recordsFromResponses(responses);
      } catch (error) {
        if (probe.required) {
          throw error;
        }
        const message = error instanceof Error ? error.message : String(error || "Unknown error");
        console.warn(
          `[MANAGEONE HOURLY] optional ${probe.key} project lookup skipped for ${vdc.name || vdc.id} / ${projectName(
            project,
          )}: ${message}`,
        );
      }

      for (const record of records) {
        if (probe.key === "ecs" && addUniqueRecord(seen.ecs, record)) {
          const flavor = parseEcsFlavor(record?.properties?.flavor);
          totals.ecsInstances += 1;
          totals.ecsCores += numberOrNull(flavor?.vcpus) || 0;
          totals.ecsRamGb += Math.round(((numberOrNull(flavor?.ramMb) || 0) / 1024) * 1000) / 1000;
        } else if ((probe.key === "cce" || probe.key === "cceCloudNode") && addUniqueRecord(seen.cce, record)) {
          totals.cceNodes += 1;
        } else if (probe.key === "evs" && addUniqueRecord(seen.evs, record)) {
          const volume = parseEvsVolume(record);
          totals.evsGb += numberOrNull(volume?.diskSize) || 0;
        } else if (probe.key === "bms" && addUniqueRecord(seen.bms, record)) {
          totals.bmsInstances += 1;
        }
      }
    }
  }

  totals.ecsRamGb = Math.round(totals.ecsRamGb * 1000) / 1000;
  totals.evsGb = Math.round(totals.evsGb * 1000) / 1000;
  return totals;
}

function hasProjectScopedUsage(totals) {
  return Object.values(totals).some((value) => Number(value) > 0);
}

function resourceIndexScopes(vdc) {
  return [
    {
      key: "domainId",
      extendParam: { domain_id: String(vdc.domain_id || "") },
    },
    {
      key: "vdcId",
      extendParam: { vdc_id: String(vdc.id || "") },
    },
    {
      key: "domainAndVdc",
      extendParam: {
        domain_id: String(vdc.domain_id || ""),
        vdc_id: String(vdc.id || ""),
      },
    },
  ];
}

async function fetchResourceIndexPage(vdc, scope, query, session, start, limit) {
  const params = new URLSearchParams({
    start: String(start),
    limit: String(limit),
    extendParam: JSON.stringify({
      ...query,
      ...scope.extendParam,
    }),
  });
  const url = `${resourceEndpointBaseUrl()}/v3.0/resources?${params}`;
  const { response, text } = await fetchTextWithTimeout(url, {
    method: "GET",
    headers: {
      Accept: "application/json, text/plain, */*",
      "X-Auth-Token": session.token,
    },
    redirect: "manual",
  });

  if (!response.ok) {
    throw new HttpStatusError(response.status, `HTTP ${response.status}${text ? ` ${text}` : ""}`);
  }

  return text ? JSON.parse(text) : {};
}

async function fetchResourceIndexResources(vdc, scope, query, session) {
  let start = 0;
  const responses = [];
  let page = 0;
  let hasNextPage = true;

  while (hasNextPage) {
    page += 1;
    if (page > RESOURCE_MAX_PAGES) {
      throw new Error(`Resource index pagination exceeded ${RESOURCE_MAX_PAGES} pages for ${vdc.name || vdc.id}`);
    }

    const body = await fetchResourceIndexPage(vdc, scope, query, session, start, RESOURCE_PAGE_LIMIT);
    responses.push(body);
    const pageResources = listFromResponse(body, ["resources", "resource_list", "native_resources"]);
    const reportedTotal = responseTotal(body);
    hasNextPage = shouldFetchNextPage({
      reportedTotal,
      start,
      pageSize: RESOURCE_PAGE_LIMIT,
      pageResourceCount: pageResources.length,
    });
    start += RESOURCE_PAGE_LIMIT;

    if (hasNextPage) {
      await delay(RESOURCE_USAGE_REQUEST_DELAY_MS);
    }
  }

  return responses;
}

function summarizeNatGateway(gateway) {
  const status = String(firstDefined(gateway?.status, gateway?.resource_status, "")).toLowerCase();
  if (status === "deleted") return null;

  return String(firstDefined(gateway?.id, gateway?.name, gateway?.resource_id, "")).trim();
}

function summarizeResourceIndexInstance(resource) {
  const status = String(firstDefined(resource?.status, resource?.resource_status, "")).toLowerCase();
  if (status === "deleted") return null;

  return String(firstDefined(resource?.id, resource?.resource_id, resource?.name, resource?.resource_name, "")).trim();
}

async function fetchTenantNatGatewayCount(vdc, session) {
  if (!INCLUDE_NAT_GATEWAYS || !vdc?.domain_id) return 0;

  const gatewayIds = new Set();
  for (const scope of resourceIndexScopes(vdc)) {
    try {
      const responses = await fetchResourceIndexResources(
        vdc,
        scope,
        { resource_type_name: NAT_RESOURCE_TYPE_NAME },
        session,
      );
      for (const resource of responses.flatMap((body) =>
        listFromResponse(body, ["resources", "resource_list", "native_resources"]),
      )) {
        const id = summarizeNatGateway(resource);
        if (id) gatewayIds.add(id);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error || "Unknown error");
      console.warn(`[MANAGEONE HOURLY] NAT scope skipped for ${vdc.name || vdc.id} / ${scope.key}: ${message}`);
    }
  }

  return gatewayIds.size;
}

async function fetchTenantBmsInstanceCount(vdc, session) {
  return fetchTenantResourceIndexCount(vdc, session, BMS_RESOURCE_TYPE_NAME, "BMS");
}

async function fetchTenantCceNodeCount(vdc, session) {
  return fetchTenantResourceIndexCount(vdc, session, CCE_NODE_RESOURCE_TYPE_NAME, "CCE node");
}

async function fetchTenantResourceIndexCount(vdc, session, resourceTypeName, label) {
  if (!vdc?.domain_id) return 0;

  const instanceIds = new Set();
  for (const scope of resourceIndexScopes(vdc)) {
    try {
      const responses = await fetchResourceIndexResources(
        vdc,
        scope,
        { resource_type_name: resourceTypeName },
        session,
      );
      for (const resource of responses.flatMap((body) =>
        listFromResponse(body, ["resources", "resource_list", "native_resources"]),
      )) {
        const id = summarizeResourceIndexInstance(resource);
        if (id) instanceIds.add(id);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error || "Unknown error");
      console.warn(`[MANAGEONE HOURLY] ${label} scope skipped for ${vdc.name || vdc.id} / ${scope.key}: ${message}`);
    }
  }

  return instanceIds.size;
}

function mapMonitoringRow({
  vdc,
  region,
  resourceUsage,
  obsGb,
  natGateways,
  bmsInstances,
  cceNodes,
  capturedAt,
  projectScopedTotals: scopedTotals,
}) {
  const resources = flattenResourceUsage(resourceUsage);
  const cceNodeCount =
    scopedTotals?.cceNodes ??
    (cceNodes ||
      resourceUsed(resources, "cce", "hybrid.resource.type.cce.cluster") ||
      resourceUsedByPattern(resources, /cce/, /node|cluster/));
  const bmsInstanceCount =
    scopedTotals?.bmsInstances ??
    (bmsInstances || resourceUsed(resources, "bms", "instances") || resourceUsedByPattern(resources, /bms/, /instance/));

  return {
    vdcId: String(vdc.id),
    ...(vdc.domain_id ? { domainId: String(vdc.domain_id) } : {}),
    tenantName: String(vdc.name || vdc.id),
    ...(region.regionId ? { regionId: region.regionId } : {}),
    ...(region.regionName ? { regionName: region.regionName } : {}),
    capturedAt,
    ecsInstances: scopedTotals?.ecsInstances ?? resourceUsed(resources, "ecs", "instances"),
    cceNodes: cceNodeCount,
    ecsCores: scopedTotals?.ecsCores ?? resourceUsed(resources, "ecs", "cores"),
    ecsRamGb: scopedTotals?.ecsRamGb ?? resourceUsed(resources, "ecs", "ram"),
    evsGb: scopedTotals?.evsGb ?? resourceUsed(resources, "evs", "gigabytes"),
    sfsGb: sfsGbFromResources(resources),
    csbsGb: csbsGbFromResources(resources),
    vbsGb: vbsGbFromResources(resources),
    obsGb: obsGb ?? obsGbFromResources(resources),
    publicIps: resourceUsed(resources, "vpc", "publicIp"),
    vpcepEndpoints: vpcepEndpointsFromResources(resources),
    bmsInstances: bmsInstanceCount,
    loadBalancers: resourceUsedByPattern(resources, /elb|vpc/, /load.?balancer|elb/),
    vpnGateways: resourceUsedByPattern(resources, /vpc/, /vpn/),
    natGateways,
    wafInstances: wafInstancesFromResources(resources),
    wafBasicInstances: wafBasicInstancesFromResources(resources),
    wafEnterpriseInstances: wafEnterpriseInstancesFromResources(resources),
    rawMetrics: {
      resourceUsage,
    },
  };
}

const TENANT_TOTAL_RECONCILE_FIELDS = [
  "sfsGb",
  "csbsGb",
  "vbsGb",
  "obsGb",
  "publicIps",
  "vpcepEndpoints",
  "loadBalancers",
  "vpnGateways",
  "natGateways",
  "wafInstances",
  "wafBasicInstances",
  "wafEnterpriseInstances",
];

function rowFieldValue(row, field) {
  return numberOrNull(row?.[field]) || 0;
}

function roundedMetric(value) {
  return Math.round((numberOrNull(value) || 0) * 1000) / 1000;
}

function rowRegion(row) {
  return {
    ...(row?.regionId ? { regionId: row.regionId } : {}),
    ...(row?.regionName ? { regionName: row.regionName } : {}),
  };
}

function primaryRegionRowIndex(rows, primaryRegion) {
  const key = regionKey(primaryRegion);
  if (key !== "|") {
    const index = rows.findIndex((row) => regionKey(rowRegion(row)) === key);
    if (index >= 0) return index;
  }

  return 0;
}

function sumRows(rows, field) {
  return rows.reduce((total, row) => total + rowFieldValue(row, field), 0);
}

async function tenantLevelMonitoringRow({ vdc, region, resourceUsage, obsGbByVdcRegion, session, capturedAt }) {
  const [natGateways, bmsInstances, cceNodes] = await Promise.all([
    fetchTenantNatGatewayCount(vdc, session),
    fetchTenantBmsInstanceCount(vdc, session),
    fetchTenantCceNodeCount(vdc, session),
  ]);

  return mapMonitoringRow({
    vdc,
    region,
    resourceUsage,
    obsGb: totalObsGbForTenant(obsGbByVdcRegion, vdc),
    natGateways,
    bmsInstances,
    cceNodes,
    capturedAt,
  });
}

async function reconcileRowsWithTenantTotals({
  vdc,
  rows,
  primaryRegion,
  resourceUsage,
  obsGbByVdcRegion,
  session,
  capturedAt,
}) {
  if (rows.length <= 1) return rows;

  const tenantTotals = await tenantLevelMonitoringRow({
    vdc,
    region: primaryRegion,
    resourceUsage,
    obsGbByVdcRegion,
    session,
    capturedAt,
  });
  const targetIndex = primaryRegionRowIndex(rows, primaryRegion);
  const target = rows[targetIndex];
  const applied = [];

  for (const field of TENANT_TOTAL_RECONCILE_FIELDS) {
    const expectedTotal = rowFieldValue(tenantTotals, field);
    const currentTotal = sumRows(rows, field);
    const missing = roundedMetric(expectedTotal - currentTotal);

    if (missing > 0) {
      target[field] = roundedMetric(rowFieldValue(target, field) + missing);
      applied.push(`${field} +${missing}`);
    }
  }

  if (applied.length > 0) {
    console.log(
      `[MANAGEONE HOURLY] reconciled tenant-level totals for ${vdc.name || vdc.id}: ${applied.join(", ")}`,
    );
  }

  return rows;
}

async function buildMonitoringRowsForTenant({ vdc, region, resourceUsage, obsGbByVdcRegion, session, capturedAt }) {
  let projects = [];
  try {
    projects = await listTenantProjects(vdc, session);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || "Unknown error");
    console.warn(`[MANAGEONE HOURLY] resource-space lookup skipped for ${vdc.name || vdc.id}: ${message}`);
  }

  const regionGroups = projectRegionGroups(projects, region);
  const visibleRegionGroups = REGION_FILTER
    ? regionGroups.filter((group) => regionMatchesFilter(group.region, REGION_FILTER))
    : regionGroups;

  if (regionGroups.length <= 1) {
    if (!regionMatchesFilter(region, REGION_FILTER)) {
      console.log(
        `[MANAGEONE HOURLY] tenant skipped by region filter: ${vdc.name || vdc.id} ` +
          `(${region.regionName || region.regionId || "unknown region"})`,
      );
      return [];
    }

    const [natGateways, bmsInstances, cceNodes] = await Promise.all([
      fetchTenantNatGatewayCount(vdc, session),
      fetchTenantBmsInstanceCount(vdc, session),
      fetchTenantCceNodeCount(vdc, session),
    ]);

    return [
      mapMonitoringRow({
        vdc,
        region,
        resourceUsage,
        obsGb: totalObsGbForTenant(obsGbByVdcRegion, vdc),
        natGateways,
        bmsInstances,
        cceNodes,
        capturedAt,
      }),
    ];
  }

  if (visibleRegionGroups.length === 0) {
    console.log(
      `[MANAGEONE HOURLY] tenant skipped by region filter: ${vdc.name || vdc.id} ` +
        `(${regionGroups.map((group) => group.region.regionName || group.region.regionId || "unknown").join(", ")})`,
    );
    return [];
  }

  console.log(
    `[MANAGEONE HOURLY] tenant has ${regionGroups.length} resource-space region(s): ${vdc.name || vdc.id} ` +
      `(${regionGroups.map((group) => group.region.regionName || group.region.regionId || "unknown").join(", ")})`,
  );

  const rows = [];
  for (const group of visibleRegionGroups) {
    const scopedTotals = await fetchProjectScopedTotals(vdc, group.projects, session);
    const regionObsGb = obsGbForRegion(obsGbByVdcRegion, vdc, group.region);

    if (!hasProjectScopedUsage(scopedTotals) && !regionObsGb) {
      rows.push(
        mapMonitoringRow({
          vdc,
          region: group.region,
          resourceUsage: {},
          obsGb: 0,
          natGateways: 0,
          bmsInstances: 0,
          cceNodes: 0,
          capturedAt,
          projectScopedTotals: scopedTotals,
        }),
      );
      continue;
    }

    rows.push(
      mapMonitoringRow({
        vdc,
        region: group.region,
        resourceUsage: {},
        obsGb: regionObsGb ?? 0,
        natGateways: 0,
        bmsInstances: 0,
        cceNodes: 0,
        capturedAt,
        projectScopedTotals: scopedTotals,
      }),
    );
  }

  return reconcileRowsWithTenantTotals({
    vdc,
    rows,
    primaryRegion: region,
    resourceUsage,
    obsGbByVdcRegion,
    session,
    capturedAt,
  });
}

async function pushRowsToCrm(rows, startedAt) {
  if (!SYNC_URL || !SYNC_SECRET) {
    console.log("[MANAGEONE HOURLY] CRM push skipped: MANAGEONE_HOURLY_SYNC_URL or secret is not configured");
    console.log(JSON.stringify({ success: true, dryRun: true, rows }, null, 2));
    return;
  }

  const response = await fetch(SYNC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Sync-Secret": SYNC_SECRET,
    },
    body: JSON.stringify({ startedAt, rows }),
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`CRM hourly monitoring push failed: HTTP ${response.status}${body ? ` ${body}` : ""}`);
  }

  console.log(`[MANAGEONE HOURLY] CRM push success: ${body || `${rows.length} row(s)`}`);
}

async function syncManageOneHourlyMonitoring() {
  const startedAt = Date.now();
  const allVdcs = await listAllVdcs({ upper_vdc_id: "0", used: "true" });
  const vdcs = TENANT_FILTER ? allVdcs.filter((vdc) => tenantMatchesFilter(vdc, TENANT_FILTER)) : allVdcs;
  const session = await authenticate();
  const rows = [];

  if (TENANT_FILTER) {
    console.log(
      `[MANAGEONE HOURLY] tenant filter active: ${TENANT_FILTER}; selected ${vdcs.length}/${allVdcs.length} tenant(s)`,
    );
  }
  if (REGION_FILTER) {
    console.log(`[MANAGEONE HOURLY] region filter active: ${REGION_FILTER}`);
  }

  const obsGbByVdcRegion = await fetchObsGbByTenant(session, vdcs);

  for (let index = 0; index < vdcs.length; index += 1) {
    const vdc = vdcs[index];
    console.log(`[MANAGEONE HOURLY] checking tenant ${index + 1}/${vdcs.length}: ${vdc.name || vdc.id}`);

    if (index > 0) {
      await delay(RESOURCE_USAGE_REQUEST_DELAY_MS);
    }

    try {
      const region = await fetchTenantRegion(vdc, session).catch((error) => {
        const message = error instanceof Error ? error.message : String(error || "Unknown error");
        console.warn(`[MANAGEONE HOURLY] tenant region skipped for ${vdc.name || vdc.id}: ${message}`);
        return {};
      });

      const resourceUsage = await fetchTenantResourceUsage(vdc.id, session);
      rows.push(
        ...(await buildMonitoringRowsForTenant({
          vdc,
          region,
          resourceUsage,
          obsGbByVdcRegion,
          session,
          capturedAt: startedAt,
        })),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error || "Unknown error");
      console.error(`[MANAGEONE HOURLY] tenant skipped for ${vdc.name || vdc.id}: ${message}`);
    }
  }

  await pushRowsToCrm(rows, startedAt);
  console.log(`[MANAGEONE HOURLY] success: ${rows.length} tenant snapshot(s) collected`);
}

syncManageOneHourlyMonitoring().catch((error) => {
  const message = error instanceof Error ? error.message : String(error || "Unknown error");
  console.error("[MANAGEONE HOURLY] failed:", message);
  process.exitCode = 1;
});
