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
const NAT_RESOURCE_TYPE_NAME = "CLOUD_NAT_INSTANCE";
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

function resourceUsedByPattern(resources, serviceIdPattern, resourcePattern) {
  const match = resources.find(
    (resource) =>
      serviceIdPattern.test(normalizedKey(resource.serviceId)) &&
      resourcePattern.test(normalizedKey(resource.resource)),
  );

  return numberOrNull(match?.used) || 0;
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

function mapMonitoringRow({ vdc, region, resourceUsage, natGateways, capturedAt }) {
  const resources = flattenResourceUsage(resourceUsage);
  return {
    vdcId: String(vdc.id),
    ...(vdc.domain_id ? { domainId: String(vdc.domain_id) } : {}),
    tenantName: String(vdc.name || vdc.id),
    ...(region.regionId ? { regionId: region.regionId } : {}),
    ...(region.regionName ? { regionName: region.regionName } : {}),
    capturedAt,
    ecsInstances: resourceUsed(resources, "ecs", "instances"),
    ecsCores: resourceUsed(resources, "ecs", "cores"),
    ecsRamGb: resourceUsed(resources, "ecs", "ram"),
    evsGb: resourceUsed(resources, "evs", "gigabytes"),
    obsGb: resourceUsed(resources, "obsv3", "capacity"),
    publicIps: resourceUsed(resources, "vpc", "publicIp"),
    loadBalancers: resourceUsedByPattern(resources, /elb|vpc/, /load.?balancer|elb/),
    vpnGateways: resourceUsedByPattern(resources, /vpc/, /vpn/),
    natGateways,
    wafInstances: resourceUsed(resources, "waf", "waf.instance"),
    rawMetrics: {
      resourceUsage,
    },
  };
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

      if (!regionMatchesFilter(region, REGION_FILTER)) {
        console.log(
          `[MANAGEONE HOURLY] tenant skipped by region filter: ${vdc.name || vdc.id} ` +
            `(${region.regionName || region.regionId || "unknown region"})`,
        );
        continue;
      }

      const [resourceUsage, natGateways] = await Promise.all([
        fetchTenantResourceUsage(vdc.id, session),
        fetchTenantNatGatewayCount(vdc, session),
      ]);

      rows.push(
        mapMonitoringRow({
          vdc,
          region,
          resourceUsage,
          natGateways,
          capturedAt: startedAt,
        }),
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
