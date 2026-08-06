import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { authenticate, listAllVdcs } from "../manageone.js";

const prisma = new PrismaClient();
const DEFAULT_MANAGEONE_BASE_URL = "https://10.20.24.9:26335/rest/vdc";
const TENANT_USAGE_SYNC_URL = "https://crm-api.102-203-134-106.sslip.io/tenant-usage/sync";
const RESOURCE_USAGE_REQUEST_DELAY_MS = 2000;
const RESOURCE_USAGE_RATE_LIMIT_RETRIES = 2;
const RESOURCE_USAGE_RATE_LIMIT_RETRY_DELAY_MS = 5000;
const MANAGEONE_READ_TIMEOUT_MS = 30000;
const PROJECT_PAGE_LIMIT = 100;
const PROJECT_MAX_PAGES = 20;
const NATIVE_RESOURCE_PAGE_LIMIT = 1000;
const NATIVE_RESOURCE_MAX_PAGES = 20;
const USE_DOMAIN_NATIVE_BREAKDOWN = process.env.MANAGEONE_SYNC_DOMAIN_NATIVE_BREAKDOWN === "true";

class HttpStatusError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "HttpStatusError";
    this.status = status;
  }
}

function parseExtra(value) {
  if (!value) return {};
  if (typeof value === "object") return value;

  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function parseJsonObject(value) {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value;

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function numberOrNull(value) {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function integerOrNull(value) {
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) ? number : null;
}

function booleanOrNull(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return null;
}

function dateFromMilliseconds(value) {
  const milliseconds = Number(value);
  if (!Number.isFinite(milliseconds)) return null;

  const date = new Date(milliseconds);
  return Number.isNaN(date.getTime()) ? null : date;
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

function resourceTotal(value) {
  if (value === undefined || value === null || value === "") return undefined;
  const total = numberOrNull(value);
  return total === null || total === -1 ? undefined : total;
}

function manageOneRootUrl() {
  return stripTrailingSlash(process.env.MANAGEONE_BASE_URL || DEFAULT_MANAGEONE_BASE_URL).replace(/\/rest\/vdc$/, "");
}

function resourceEndpointBaseUrl() {
  return `${manageOneRootUrl()}/rest/resource`;
}

function vdcEndpointBaseUrl() {
  return stripTrailingSlash(process.env.MANAGEONE_BASE_URL || DEFAULT_MANAGEONE_BASE_URL);
}

async function fetchTextWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MANAGEONE_READ_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
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

function responseTotal(body) {
  const total = Number(body?.total ?? body?.totalNum);
  return Number.isFinite(total) ? total : null;
}

function shouldFetchNextNativePage({ reportedTotal, start, pageSize, pageResourceCount }) {
  if (pageResourceCount === 0) return false;
  if (reportedTotal !== null && reportedTotal > start + pageResourceCount) return true;

  return pageResourceCount >= pageSize;
}

function resourceUsageIndicatesEcs(resourceUsage) {
  return flattenResourceUsage(resourceUsage).some((resource) => {
    const serviceId = String(resource.serviceId || "").toLowerCase();
    const resourceName = String(resource.resource || "").toLowerCase();
    return serviceId.includes("ecs") && resourceName.includes("instance") && Number(resource.used) > 0;
  });
}

function resourceUsageIndicatesEvs(resourceUsage) {
  return flattenResourceUsage(resourceUsage).some((resource) => {
    const serviceId = String(resource.serviceId || "").toLowerCase();
    const resourceName = String(resource.resource || "").toLowerCase();
    return serviceId.includes("evs") && /(volume|gigabyte)/i.test(resourceName) && Number(resource.used) > 0;
  });
}

function shouldFetchEcsFlavorBreakdown(vdc, resourceUsage) {
  const ecsUsed = numberOrNull(vdc.ecs_used);
  return (ecsUsed !== null && ecsUsed > 0) || resourceUsageIndicatesEcs(resourceUsage);
}

function shouldFetchEvsVolumeTypeBreakdown(vdc, resourceUsage) {
  const evsUsed = numberOrNull(vdc.evs_used);
  return (evsUsed !== null && evsUsed > 0) || resourceUsageIndicatesEvs(resourceUsage);
}

function parseEcsFlavor(rawFlavor) {
  if (typeof rawFlavor !== "string") return null;

  const [vcpusValue, ramMbValue, ...nameParts] = rawFlavor.split("|");
  const flavorName = nameParts.join("|").trim();
  if (!flavorName || flavorName.toLowerCase().startsWith("waf.")) return null;

  return {
    flavorName,
    vcpus: numberOrNull(vcpusValue),
    ramMb: numberOrNull(ramMbValue)
  };
}

function aggregateEcsFlavorBreakdown(nativeResourceResponses) {
  const flavorsByName = new Map();

  for (const response of nativeResourceResponses) {
    const resources = listFromResponse(response, ["resources", "resource_list", "native_resources"]);

    for (const resource of resources) {
      const parsed = parseEcsFlavor(resource?.properties?.flavor);
      if (!parsed) continue;

      const existing = flavorsByName.get(parsed.flavorName);
      if (existing) {
        existing.count += 1;
      } else {
        flavorsByName.set(parsed.flavorName, {
          ...parsed,
          count: 1
        });
      }
    }
  }

  return [...flavorsByName.values()].sort((a, b) => a.flavorName.localeCompare(b.flavorName));
}

function countNativeRecords(nativeResourceResponses) {
  return nativeResourceResponses.reduce(
    (total, response) => total + listFromResponse(response, ["resources", "resource_list", "native_resources"]).length,
    0
  );
}

function parseEvsVolume(volume) {
  const properties = volume?.properties || {};
  const rawVolumeType = properties.volume_type;
  const volumeType = typeof rawVolumeType === "string" ? rawVolumeType.trim() : "";
  if (!volumeType) return null;

  const diskSize = numberOrNull(properties.disk_size);
  if (diskSize === null) return null;

  return {
    volumeType,
    volumeTypeKey: volumeType.toLowerCase(),
    diskSize
  };
}

function aggregateEvsVolumeTypeBreakdown(nativeResourceResponses) {
  const volumesByType = new Map();

  for (const response of nativeResourceResponses) {
    const resources = listFromResponse(response, ["resources", "resource_list", "native_resources"]);

    for (const resource of resources) {
      const parsed = parseEvsVolume(resource);
      if (!parsed) continue;

      const existing = volumesByType.get(parsed.volumeTypeKey);
      if (existing) {
        existing.count += 1;
        existing.totalGb += parsed.diskSize;
      } else {
        volumesByType.set(parsed.volumeTypeKey, {
          volumeType: parsed.volumeType,
          totalGb: parsed.diskSize,
          count: 1
        });
      }
    }
  }

  return [...volumesByType.values()].sort((a, b) => a.volumeType.localeCompare(b.volumeType));
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
    const total = firstDefined(value.total, value.total_value, value.totalValue);

    if (currentServiceId && resource && used !== undefined && used !== null && used !== "") {
      const item = {
        serviceId: currentServiceId,
        resource,
        used: numberOrNull(used)
      };
      const normalizedTotal = resourceTotal(total);

      if (normalizedTotal !== undefined) {
        item.total = normalizedTotal;
      }

      resources.push(item);
    }

    for (const child of Object.values(value)) {
      walk(child, currentServiceId);
    }
  }

  walk(resourceUsage);
  return resources;
}

function normalizedKey(value) {
  return String(value || "").trim().toLowerCase();
}

function resourceUsed(resources, serviceId, resourceName) {
  const expectedServiceId = normalizedKey(serviceId);
  const expectedResourceName = normalizedKey(resourceName);
  const match = resources.find(
    (resource) =>
      normalizedKey(resource.serviceId) === expectedServiceId &&
      normalizedKey(resource.resource) === expectedResourceName
  );

  return numberOrNull(match?.used) || 0;
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
  if (!regionId || !regionName) return null;

  return {
    regionId: String(regionId),
    regionName: String(regionName)
  };
}

function mapTenantUsageHistoryItem({ vdc, resourceUsage, syncedAt }) {
  const resources = flattenResourceUsage(resourceUsage);
  const extra = parseExtra(vdc.extra);

  return {
    vdcId: String(vdc.id),
    domainId: vdc.domain_id ?? null,
    tenantName: String(vdc.name || vdc.id),
    managerEmail: extra.email ?? null,
    ecsInstances: resourceUsed(resources, "ecs", "instances"),
    ecsCores: resourceUsed(resources, "ecs", "cores"),
    ecsRamGb: resourceUsed(resources, "ecs", "ram"),
    rdsInstances: resourceUsed(resources, "rds", "instance"),
    cceClusters: resourceUsed(resources, "cce", "hybrid.resource.type.cce.cluster"),
    evsGb: resourceUsed(resources, "evs", "gigabytes"),
    obsGb: resourceUsed(resources, "obsv3", "capacity"),
    sfsGb: resourceUsed(resources, "sfs", "gigabytes"),
    publicIps: resourceUsed(resources, "vpc", "publicIp"),
    wafInstances: resourceUsed(resources, "waf", "waf.instance"),
    syncedAt
  };
}

function mapTenantForCrm(tenant) {
  const rawPayload = parseJsonObject(tenant.raw_payload);
  return {
    vdcId: tenant.vdc_id,
    domainId: tenant.domain_id,
    name: tenant.name,
    level: tenant.level,
    upperVdcId: tenant.upper_vdc_id,
    enabled: tenant.enabled,
    managerName: tenant.manager_name,
    managerPhone: tenant.manager_phone,
    managerEmail: tenant.manager_email,
    ...(rawPayload.regionId ? { regionId: rawPayload.regionId } : {}),
    ...(rawPayload.regionName ? { regionName: rawPayload.regionName } : {}),
    ecsUsed: numberOrNull(tenant.ecs_used),
    evsUsed: numberOrNull(tenant.evs_used),
    projectCount: tenant.project_count,
    resources: flattenResourceUsage(tenant.resource_usage),
    ecsFlavors: tenant.ecs_flavor_breakdown || [],
    evsVolumeTypes: tenant.evs_volume_type_breakdown || []
  };
}

async function loadSyncedTenantsForCrm() {
  return prisma.$queryRaw`
    SELECT
      vdc_id, domain_id, name, level, upper_vdc_id, enabled,
      manager_name, manager_phone, manager_email,
      ecs_used, evs_used, project_count, raw_payload, resource_usage, ecs_flavor_breakdown, evs_volume_type_breakdown
    FROM manageone_tenants
    ORDER BY name ASC
  `;
}

async function fetchTenantRegion(vdc, session) {
  const url = `${vdcEndpointBaseUrl()}/v3.0/vdcs/${encodeURIComponent(vdc.id)}`;
  const { response, text } = await fetchTextWithTimeout(url, {
    method: "GET",
    headers: {
      Accept: "application/json, text/plain, */*",
      "X-Auth-Token": session.token
    },
    redirect: "manual"
  });

  if (!response.ok) {
    throw new HttpStatusError(response.status, `HTTP ${response.status}${text ? ` ${text}` : ""}`);
  }

  const region = extractTenantRegion(text ? JSON.parse(text) : {});
  if (!region) {
    throw new Error("No region found in VDC detail response");
  }

  return region;
}

async function fetchTenantResourceUsage(vdcId, session) {
  const baseUrl = stripTrailingSlash(process.env.MANAGEONE_BASE_URL || DEFAULT_MANAGEONE_BASE_URL);
  const url = `${baseUrl}/v3.0/capacity/${encodeURIComponent(vdcId)}/statics?inherit=true`;
  const { response, text } = await fetchTextWithTimeout(url, {
    method: "GET",
    headers: {
      Accept: "application/json, text/plain, */*",
      "X-Auth-Token": session.token
    },
    redirect: "manual"
  });

  if (!response.ok) {
    throw new HttpStatusError(response.status, `HTTP ${response.status}${text ? ` ${text}` : ""}`);
  }

  return text ? JSON.parse(text) : {};
}

async function retryRateLimited(label, callback) {
  for (let attempt = 0; attempt <= RESOURCE_USAGE_RATE_LIMIT_RETRIES; attempt += 1) {
    try {
      return await callback();
    } catch (error) {
      if (error?.status !== 429 || attempt === RESOURCE_USAGE_RATE_LIMIT_RETRIES) {
        throw error;
      }

      const nextAttempt = attempt + 2;
      console.warn(
        `[MANAGEONE SYNC] ${label} rate-limited; retrying attempt ${nextAttempt}/${RESOURCE_USAGE_RATE_LIMIT_RETRIES + 1} after ${RESOURCE_USAGE_RATE_LIMIT_RETRY_DELAY_MS}ms`
      );
      await delay(RESOURCE_USAGE_RATE_LIMIT_RETRY_DELAY_MS);
    }
  }

  return null;
}

async function fetchProjectPage(vdc, session, start, limit) {
  const baseUrl = stripTrailingSlash(process.env.MANAGEONE_BASE_URL || DEFAULT_MANAGEONE_BASE_URL);
  const url = `${baseUrl}/v3.1/vdcs/${encodeURIComponent(vdc.id)}/projects?start=${start}&limit=${limit}`;
  const { response, text } = await fetchTextWithTimeout(url, {
    method: "GET",
    headers: {
      Accept: "application/json, text/plain, */*",
      "X-Auth-Token": session.token
    },
    redirect: "manual"
  });

  if (!response.ok) {
    throw new HttpStatusError(response.status, `HTTP ${response.status}${text ? ` ${text}` : ""}`);
  }

  return text ? JSON.parse(text) : {};
}

async function listTenantProjects(vdc, session) {
  const limit = PROJECT_PAGE_LIMIT;
  let start = 0;
  let total = Infinity;
  const projects = [];
  let page = 0;

  while (start < total) {
    page += 1;
    if (page > PROJECT_MAX_PAGES) {
      throw new Error(`Project pagination exceeded ${PROJECT_MAX_PAGES} page(s) for ${vdc.name || vdc.id}`);
    }

    const body = await retryRateLimited(
      `resource-space lookup for ${vdc.name || vdc.id}`,
      () => fetchProjectPage(vdc, session, start, limit)
    );
    const pageProjects = listFromResponse(body, ["projects", "project_list"]);
    projects.push(...pageProjects);
    total = Number.isFinite(Number(body?.total)) ? Number(body.total) : projects.length;
    start += limit;

    if (start < total) {
      await delay(RESOURCE_USAGE_REQUEST_DELAY_MS);
    }
  }

  return projects;
}

async function fetchNativeEcsResourcePage(vdc, projectId, session, start, limit) {
  const params = new URLSearchParams({
    service_id: "ecs",
    resource_type_name: "CLOUD_ECS_INSTANCE",
    project_id: projectId,
    start: String(start),
    limit: String(limit)
  });
  const url = `${resourceEndpointBaseUrl()}/v3.0/native/resources?${params}`;
  const { response, text } = await fetchTextWithTimeout(url, {
    method: "GET",
    headers: {
      Accept: "application/json, text/plain, */*",
      "X-Auth-Token": session.token
    },
    redirect: "manual"
  });

  if (!response.ok) {
    throw new HttpStatusError(response.status, `HTTP ${response.status}${text ? ` ${text}` : ""}`);
  }

  return text ? JSON.parse(text) : {};
}

async function fetchProjectNativeEcsResources(vdc, projectId, session) {
  const limit = NATIVE_RESOURCE_PAGE_LIMIT;
  let start = 0;
  const responses = [];
  let page = 0;
  let hasNextPage = true;

  while (hasNextPage) {
    page += 1;
    if (page > NATIVE_RESOURCE_MAX_PAGES) {
      throw new Error(
        `Native ECS resource pagination exceeded ${NATIVE_RESOURCE_MAX_PAGES} page(s) for ${vdc.name || vdc.id} project ${projectId}`
      );
    }

    const body = await retryRateLimited(
      `native ECS resource lookup for ${vdc.name || vdc.id} project ${projectId}`,
      () => fetchNativeEcsResourcePage(vdc, projectId, session, start, limit)
    );
    responses.push(body);
    const pageResources = listFromResponse(body, ["resources", "resource_list", "native_resources"]);
    const reportedTotal = responseTotal(body);
    hasNextPage = shouldFetchNextNativePage({
      reportedTotal,
      start,
      pageSize: limit,
      pageResourceCount: pageResources.length
    });
    start += limit;

    if (hasNextPage) {
      await delay(RESOURCE_USAGE_REQUEST_DELAY_MS);
    }
  }

  return responses;
}

async function fetchDomainNativeEcsResourcePage(vdc, session, start, limit) {
  const params = new URLSearchParams({
    service_id: "ecs",
    resource_type_name: "CLOUD_ECS_INSTANCE",
    domain_id: String(vdc.domain_id || ""),
    start: String(start),
    limit: String(limit)
  });
  const url = `${resourceEndpointBaseUrl()}/v3.0/native/resources?${params}`;
  const { response, text } = await fetchTextWithTimeout(url, {
    method: "GET",
    headers: {
      Accept: "application/json, text/plain, */*",
      "X-Auth-Token": session.token
    },
    redirect: "manual"
  });

  if (!response.ok) {
    throw new HttpStatusError(response.status, `HTTP ${response.status}${text ? ` ${text}` : ""}`);
  }

  return text ? JSON.parse(text) : {};
}

async function fetchDomainNativeEcsResources(vdc, session) {
  const limit = NATIVE_RESOURCE_PAGE_LIMIT;
  let start = 0;
  const responses = [];
  let page = 0;
  let hasNextPage = true;

  while (hasNextPage) {
    page += 1;
    if (page > NATIVE_RESOURCE_MAX_PAGES) {
      throw new Error(
        `Domain native ECS resource pagination exceeded ${NATIVE_RESOURCE_MAX_PAGES} page(s) for ${vdc.name || vdc.id}`
      );
    }

    const body = await retryRateLimited(
      `domain native ECS resource lookup for ${vdc.name || vdc.id}`,
      () => fetchDomainNativeEcsResourcePage(vdc, session, start, limit)
    );
    responses.push(body);
    const pageResources = listFromResponse(body, ["resources", "resource_list", "native_resources"]);
    const reportedTotal = responseTotal(body);
    hasNextPage = shouldFetchNextNativePage({
      reportedTotal,
      start,
      pageSize: limit,
      pageResourceCount: pageResources.length
    });
    start += limit;

    if (hasNextPage) {
      await delay(RESOURCE_USAGE_REQUEST_DELAY_MS);
    }
  }

  return responses;
}

async function fetchNativeEvsResourcePage(vdc, projectId, session, start, limit) {
  const params = new URLSearchParams({
    service_id: "evs",
    resource_type_name: "CLOUD_EVS_INSTANCE",
    project_id: projectId,
    start: String(start),
    limit: String(limit)
  });
  const url = `${resourceEndpointBaseUrl()}/v3.0/native/resources?${params}`;
  const { response, text } = await fetchTextWithTimeout(url, {
    method: "GET",
    headers: {
      Accept: "application/json, text/plain, */*",
      "X-Auth-Token": session.token
    },
    redirect: "manual"
  });

  if (!response.ok) {
    throw new HttpStatusError(response.status, `HTTP ${response.status}${text ? ` ${text}` : ""}`);
  }

  return text ? JSON.parse(text) : {};
}

async function fetchProjectNativeEvsResources(vdc, projectId, session) {
  const limit = NATIVE_RESOURCE_PAGE_LIMIT;
  let start = 0;
  const responses = [];
  let page = 0;
  let hasNextPage = true;

  while (hasNextPage) {
    page += 1;
    if (page > NATIVE_RESOURCE_MAX_PAGES) {
      throw new Error(
        `Native EVS resource pagination exceeded ${NATIVE_RESOURCE_MAX_PAGES} page(s) for ${vdc.name || vdc.id} project ${projectId}`
      );
    }

    const body = await retryRateLimited(
      `native EVS resource lookup for ${vdc.name || vdc.id} project ${projectId}`,
      () => fetchNativeEvsResourcePage(vdc, projectId, session, start, limit)
    );
    responses.push(body);
    const pageResources = listFromResponse(body, ["resources", "resource_list", "native_resources"]);
    const reportedTotal = responseTotal(body);
    hasNextPage = shouldFetchNextNativePage({
      reportedTotal,
      start,
      pageSize: limit,
      pageResourceCount: pageResources.length
    });
    start += limit;

    if (hasNextPage) {
      await delay(RESOURCE_USAGE_REQUEST_DELAY_MS);
    }
  }

  return responses;
}

async function fetchDomainNativeEvsResourcePage(vdc, session, start, limit) {
  const params = new URLSearchParams({
    service_id: "evs",
    resource_type_name: "CLOUD_EVS_INSTANCE",
    domain_id: String(vdc.domain_id || ""),
    start: String(start),
    limit: String(limit)
  });
  const url = `${resourceEndpointBaseUrl()}/v3.0/native/resources?${params}`;
  const { response, text } = await fetchTextWithTimeout(url, {
    method: "GET",
    headers: {
      Accept: "application/json, text/plain, */*",
      "X-Auth-Token": session.token
    },
    redirect: "manual"
  });

  if (!response.ok) {
    throw new HttpStatusError(response.status, `HTTP ${response.status}${text ? ` ${text}` : ""}`);
  }

  return text ? JSON.parse(text) : {};
}

async function fetchDomainNativeEvsResources(vdc, session) {
  const limit = NATIVE_RESOURCE_PAGE_LIMIT;
  let start = 0;
  const responses = [];
  let page = 0;
  let hasNextPage = true;

  while (hasNextPage) {
    page += 1;
    if (page > NATIVE_RESOURCE_MAX_PAGES) {
      throw new Error(
        `Domain native EVS resource pagination exceeded ${NATIVE_RESOURCE_MAX_PAGES} page(s) for ${vdc.name || vdc.id}`
      );
    }

    const body = await retryRateLimited(
      `domain native EVS resource lookup for ${vdc.name || vdc.id}`,
      () => fetchDomainNativeEvsResourcePage(vdc, session, start, limit)
    );
    responses.push(body);
    const pageResources = listFromResponse(body, ["resources", "resource_list", "native_resources"]);
    const reportedTotal = responseTotal(body);
    hasNextPage = shouldFetchNextNativePage({
      reportedTotal,
      start,
      pageSize: limit,
      pageResourceCount: pageResources.length
    });
    start += limit;

    if (hasNextPage) {
      await delay(RESOURCE_USAGE_REQUEST_DELAY_MS);
    }
  }

  return responses;
}

async function fetchTenantEcsFlavorBreakdown(vdc, session, resourceUsage) {
  if (!shouldFetchEcsFlavorBreakdown(vdc, resourceUsage)) {
    return [];
  }

  if (USE_DOMAIN_NATIVE_BREAKDOWN && vdc.domain_id) {
    console.log(`[MANAGEONE SYNC] ECS flavor lookup for ${vdc.name || vdc.id}: domain-scoped native resources`);
    const domainResponses = await fetchDomainNativeEcsResources(vdc, session);
    const breakdown = aggregateEcsFlavorBreakdown(domainResponses);
    console.log(
      `[MANAGEONE SYNC] ECS flavor breakdown for ${vdc.name || vdc.id}: ${breakdown.length} flavor(s), ${countNativeRecords(domainResponses)} domain record(s)`
    );
    return breakdown;
  }

  const projects = await listTenantProjects(vdc, session);
  const nativeResourceResponses = [];
  console.log(`[MANAGEONE SYNC] ECS flavor lookup for ${vdc.name || vdc.id}: ${projects.length} project(s)`);

  for (const project of projects) {
    const projectId = project.id || project.project_id;
    if (!projectId) continue;

    await delay(RESOURCE_USAGE_REQUEST_DELAY_MS);
    nativeResourceResponses.push(...(await fetchProjectNativeEcsResources(vdc, String(projectId), session)));
  }

  const breakdown = aggregateEcsFlavorBreakdown(nativeResourceResponses);
  console.log(
    `[MANAGEONE SYNC] ECS flavor breakdown for ${vdc.name || vdc.id}: ${breakdown.length} flavor(s), ${countNativeRecords(nativeResourceResponses)} project record(s)`
  );
  return breakdown;
}

async function fetchTenantEvsVolumeTypeBreakdown(vdc, session, resourceUsage) {
  if (!shouldFetchEvsVolumeTypeBreakdown(vdc, resourceUsage)) {
    return [];
  }

  if (USE_DOMAIN_NATIVE_BREAKDOWN && vdc.domain_id) {
    console.log(`[MANAGEONE SYNC] EVS volume-type lookup for ${vdc.name || vdc.id}: domain-scoped native resources`);
    const domainResponses = await fetchDomainNativeEvsResources(vdc, session);
    const breakdown = aggregateEvsVolumeTypeBreakdown(domainResponses);
    console.log(
      `[MANAGEONE SYNC] EVS volume-type breakdown for ${vdc.name || vdc.id}: ${breakdown.length} type(s), ${countNativeRecords(domainResponses)} domain record(s)`
    );
    return breakdown;
  }

  const projects = await listTenantProjects(vdc, session);
  const nativeResourceResponses = [];
  console.log(`[MANAGEONE SYNC] EVS volume-type lookup for ${vdc.name || vdc.id}: ${projects.length} project(s)`);

  for (const project of projects) {
    const projectId = project.id || project.project_id;
    if (!projectId) continue;

    await delay(RESOURCE_USAGE_REQUEST_DELAY_MS);
    nativeResourceResponses.push(...(await fetchProjectNativeEvsResources(vdc, String(projectId), session)));
  }

  const breakdown = aggregateEvsVolumeTypeBreakdown(nativeResourceResponses);
  console.log(
    `[MANAGEONE SYNC] EVS volume-type breakdown for ${vdc.name || vdc.id}: ${breakdown.length} type(s), ${countNativeRecords(nativeResourceResponses)} project record(s)`
  );
  return breakdown;
}

async function fetchTenantResourceUsageWithRetry(vdc, session) {
  return retryRateLimited(`resource usage for ${vdc.name || vdc.id}`, () => fetchTenantResourceUsage(vdc.id, session));
}

async function pushTenantsToCrm() {
  const syncUrl = process.env.CRM_SYNC_URL;
  const syncSecret = process.env.CRM_SYNC_SECRET;

  if (!syncUrl || !syncSecret) {
    console.warn("[MANAGEONE SYNC] CRM push skipped: CRM_SYNC_URL or CRM_SYNC_SECRET is not configured");
    return;
  }

  const tenants = await loadSyncedTenantsForCrm();
  const payload = tenants.map(mapTenantForCrm);
  const response = await fetch(syncUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Sync-Secret": syncSecret
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`CRM sync failed: HTTP ${response.status}${body ? ` ${body}` : ""}`);
  }

  console.log(`[MANAGEONE SYNC] CRM push success: ${payload.length} tenant(s) sent`);
}

async function pushTenantUsageHistoryToCrm(payload) {
  const syncSecret = process.env.TENANT_HISTORY_SYNC_SECRET;

  if (!syncSecret) {
    console.warn("[MANAGEONE SYNC] tenant usage history push skipped: TENANT_HISTORY_SYNC_SECRET is not configured");
    return;
  }

  if (payload.length === 0) {
    console.warn("[MANAGEONE SYNC] tenant usage history push skipped: no usage payloads collected");
    return;
  }

  const response = await fetch(TENANT_USAGE_SYNC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Sync-Secret": syncSecret
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`tenant usage history sync failed: HTTP ${response.status}${body ? ` ${body}` : ""}`);
  }

  console.log(`[MANAGEONE SYNC] tenant usage history push success: ${payload.length} tenant(s) sent`);
}

async function syncManageOneTenants() {
  const [run] = await prisma.$queryRaw`
    INSERT INTO manageone_sync_runs (started_at, status)
    VALUES (now(), 'running')
    RETURNING id
  `;
  const runId = run.id;

  try {
    const vdcs = await listAllVdcs({ upper_vdc_id: "0", used: "true" });
    const session = await authenticate();
    const tenantUsageHistoryPayload = [];
    const syncedAt = Date.now();

    for (let index = 0; index < vdcs.length; index += 1) {
      const vdc = vdcs[index];
      console.log(`[MANAGEONE SYNC] syncing tenant ${index + 1}/${vdcs.length}: ${vdc.name || vdc.id}`);
      const extra = parseExtra(vdc.extra);
      let resourceUsagePayload = null;
      let resourceUsage = null;
      let ecsFlavorBreakdownPayload = null;
      let evsVolumeTypeBreakdownPayload = null;

      try {
        const region = await fetchTenantRegion(vdc, session);
        vdc.regionId = region.regionId;
        vdc.regionName = region.regionName;
        console.log(`[MANAGEONE SYNC] tenant region for ${vdc.name || vdc.id}: ${region.regionName}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error || "Unknown error");
        console.warn(`[MANAGEONE SYNC] tenant region skipped for ${vdc.name || vdc.id}: ${message}`);
      }

      const rawPayload = JSON.stringify(vdc);

      try {
        if (index > 0) {
          await delay(RESOURCE_USAGE_REQUEST_DELAY_MS);
        }

        resourceUsage = await fetchTenantResourceUsageWithRetry(vdc, session);
        resourceUsagePayload = JSON.stringify(resourceUsage);
        tenantUsageHistoryPayload.push(mapTenantUsageHistoryItem({ vdc, resourceUsage, syncedAt }));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error || "Unknown error");
        console.error(`[MANAGEONE SYNC] resource usage skipped for ${vdc.name || vdc.id}: ${message}`);
      }

      try {
        ecsFlavorBreakdownPayload = JSON.stringify(await fetchTenantEcsFlavorBreakdown(vdc, session, resourceUsage));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error || "Unknown error");
        console.error(`[MANAGEONE SYNC] ECS flavor breakdown skipped for ${vdc.name || vdc.id}: ${message}`);
      }

      try {
        evsVolumeTypeBreakdownPayload = JSON.stringify(await fetchTenantEvsVolumeTypeBreakdown(vdc, session, resourceUsage));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error || "Unknown error");
        console.error(`[MANAGEONE SYNC] EVS volume-type breakdown skipped for ${vdc.name || vdc.id}: ${message}`);
      }

      await prisma.$executeRaw`
        INSERT INTO manageone_tenants
          (vdc_id, domain_id, name, level, upper_vdc_id, enabled,
           manager_name, manager_phone, manager_email,
           ecs_used, evs_used, project_count, create_user_name,
           manageone_create_at, last_synced_at, raw_payload, resource_usage,
           ecs_flavor_breakdown, evs_volume_type_breakdown)
        VALUES
          (${String(vdc.id)}, ${vdc.domain_id ?? null}, ${String(vdc.name || vdc.id)},
           ${integerOrNull(vdc.level)}, ${vdc.upper_vdc_id ?? null}, ${booleanOrNull(vdc.enabled)},
           ${extra.manager ?? null}, ${extra.phone ?? null}, ${extra.email ?? null},
           ${numberOrNull(vdc.ecs_used)}, ${numberOrNull(vdc.evs_used)}, ${integerOrNull(vdc.project_count)},
           ${vdc.create_user_name ?? null}, ${dateFromMilliseconds(vdc.create_at)}, now(),
           CAST(${rawPayload} AS jsonb), CAST(${resourceUsagePayload} AS jsonb),
           CAST(${ecsFlavorBreakdownPayload} AS jsonb), CAST(${evsVolumeTypeBreakdownPayload} AS jsonb))
        ON CONFLICT (vdc_id) DO UPDATE SET
          domain_id = EXCLUDED.domain_id,
          name = EXCLUDED.name,
          level = EXCLUDED.level,
          upper_vdc_id = EXCLUDED.upper_vdc_id,
          enabled = EXCLUDED.enabled,
          manager_name = EXCLUDED.manager_name,
          manager_phone = EXCLUDED.manager_phone,
          manager_email = EXCLUDED.manager_email,
          ecs_used = EXCLUDED.ecs_used,
          evs_used = EXCLUDED.evs_used,
          project_count = EXCLUDED.project_count,
          create_user_name = EXCLUDED.create_user_name,
          manageone_create_at = EXCLUDED.manageone_create_at,
          last_synced_at = now(),
          raw_payload = EXCLUDED.raw_payload,
          resource_usage = COALESCE(EXCLUDED.resource_usage, manageone_tenants.resource_usage),
          ecs_flavor_breakdown = COALESCE(EXCLUDED.ecs_flavor_breakdown, manageone_tenants.ecs_flavor_breakdown),
          evs_volume_type_breakdown = COALESCE(EXCLUDED.evs_volume_type_breakdown, manageone_tenants.evs_volume_type_breakdown)
      `;
    }

    try {
      await pushTenantsToCrm();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error || "Unknown error");
      console.error("[MANAGEONE SYNC] CRM push failed:", message);
    }

    try {
      await pushTenantUsageHistoryToCrm(tenantUsageHistoryPayload);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error || "Unknown error");
      console.error("[MANAGEONE SYNC] tenant usage history push failed:", message);
    }

    await prisma.$executeRaw`
      UPDATE manageone_sync_runs
      SET finished_at = now(), status = 'success', tenants_synced = ${vdcs.length}
      WHERE id = ${runId}
    `;
    console.log(`[MANAGEONE SYNC] success: ${vdcs.length} tenants synced`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || "Unknown error");
    await prisma.$executeRaw`
      UPDATE manageone_sync_runs
      SET finished_at = now(), status = 'failed', error_message = ${message}
      WHERE id = ${runId}
    `;
    console.error("[MANAGEONE SYNC] failed:", message);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

syncManageOneTenants();
