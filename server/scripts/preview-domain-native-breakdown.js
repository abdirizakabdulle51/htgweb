import "dotenv/config";
import { authenticate, listAllVdcs } from "../manageone.js";

const DEFAULT_MANAGEONE_BASE_URL = "https://10.20.24.9:26335/rest/vdc";
const REQUEST_TIMEOUT_MS = Number(process.env.MANAGEONE_TIMEOUT_MS || 30000);
const REQUEST_DELAY_MS = Number(process.env.MANAGEONE_DIAGNOSTIC_DELAY_MS || 500);
const PROJECT_PAGE_LIMIT = Number(process.env.MANAGEONE_DIAGNOSTIC_PROJECT_PAGE_LIMIT || 100);
const PROJECT_MAX_PAGES = Number(process.env.MANAGEONE_DIAGNOSTIC_PROJECT_MAX_PAGES || 20);
const NATIVE_RESOURCE_PAGE_LIMIT = Number(process.env.MANAGEONE_DIAGNOSTIC_NATIVE_PAGE_LIMIT || 1000);
const NATIVE_RESOURCE_MAX_PAGES = Number(process.env.MANAGEONE_DIAGNOSTIC_NATIVE_MAX_PAGES || 20);
const TENANT_FILTER = String(process.env.MANAGEONE_DIAGNOSTIC_TENANT_FILTER || "").trim().toLowerCase();
const MAX_TENANTS = Number(process.env.MANAGEONE_DIAGNOSTIC_MAX_TENANTS || 0);
const NAT_RESOURCE_PROBES = [
  { key: "cloudNatGateway", serviceId: "vpc", resourceTypeName: "CLOUD_NAT_GATEWAY" },
  { key: "cloudNat", serviceId: "vpc", resourceTypeName: "CLOUD_NAT" },
  { key: "natGatewayDisplay", serviceId: "vpc", resourceTypeName: "NAT Gateway" }
];
const NAT_METERING_RESOURCE_TYPES = [
  { key: "natGatewayCode", resourceType: "hws.resource.type.natgateway" },
  { key: "natGatewaySnakeCode", resourceType: "hws.resource.type.nat_gateway" },
  { key: "natCode", resourceType: "hws.resource.type.nat" }
];
const NAT_RESOURCE_INDEX_PROBES = [
  { key: "indexNatGatewayDisplay", query: { resource_type_name: "NAT Gateway" } },
  { key: "indexNatGatewayCode", query: { resource_type_code: "hws.resource.type.natgateway" } },
  { key: "indexCloudNatGateway", query: { resource_type_name: "CLOUD_NAT_GATEWAY" } },
  { key: "indexCloudNat", query: { resource_type_name: "CLOUD_NAT" } }
];
const EIP_RESOURCE_PROBES = [
  { key: "cloudFloatingIps", serviceId: "vpc", resourceTypeName: "CLOUD_FLOATING_IPS" },
  { key: "cloudEip", serviceId: "vpc", resourceTypeName: "CLOUD_EIP" },
  { key: "cloudPublicIp", serviceId: "vpc", resourceTypeName: "CLOUD_PUBLIC_IP" },
  { key: "cloudPublicIps", serviceId: "vpc", resourceTypeName: "CLOUD_PUBLICIPS" }
];

function stripTrailingSlash(value) {
  return String(value || "").replace(/\/+$/, "");
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

function meteringEndpointBaseUrl() {
  return `${manageOneRootUrl()}/rest/metering`;
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "");
}

function numberOrNull(value) {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function listFromResponse(body, keys) {
  if (Array.isArray(body)) return body;

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

async function fetchTextWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    const text = await response.text();
    return { response, text };
  } finally {
    clearTimeout(timeout);
  }
}

async function readManageOneJson(label, url, session) {
  const { response, text } = await fetchTextWithTimeout(url, {
    method: "GET",
    headers: {
      Accept: "application/json, text/plain, */*",
      "X-Auth-Token": session.token
    },
    redirect: "manual"
  });

  if (!response.ok) {
    throw new Error(`${label} failed: HTTP ${response.status}${text ? ` ${text.slice(0, 500)}` : ""}`);
  }

  return text ? JSON.parse(text) : {};
}

async function postManageOneJson(label, url, body, session) {
  const { response, text } = await fetchTextWithTimeout(url, {
    method: "POST",
    headers: {
      Accept: "application/json, text/plain, */*",
      "Content-Type": "application/json",
      "X-Auth-Token": session.token
    },
    body: JSON.stringify(body),
    redirect: "manual"
  });

  if (!response.ok) {
    throw new Error(`${label} failed: HTTP ${response.status}${text ? ` ${text.slice(0, 500)}` : ""}`);
  }

  return text ? JSON.parse(text) : {};
}

function makeExtendParam(value) {
  return JSON.stringify(value);
}

async function fetchTenantResourceUsage(vdc, session) {
  const url = `${vdcEndpointBaseUrl()}/v3.0/capacity/${encodeURIComponent(vdc.id)}/statics?inherit=true`;
  return readManageOneJson(`resource usage for ${vdc.name || vdc.id}`, url, session);
}

async function fetchTenantRegion(vdc, session) {
  const url = `${vdcEndpointBaseUrl()}/v3.0/vdcs/${encodeURIComponent(vdc.id)}`;
  const detail = await readManageOneJson(`tenant region for ${vdc.name || vdc.id}`, url, session);
  const region = extractTenantRegion(detail);
  if (!region) {
    throw new Error("No region found in VDC detail response");
  }

  return region;
}

async function fetchProjectPage(vdc, session, start, limit) {
  const url = `${vdcEndpointBaseUrl()}/v3.1/vdcs/${encodeURIComponent(vdc.id)}/projects?start=${start}&limit=${limit}`;
  return readManageOneJson(`project list for ${vdc.name || vdc.id}`, url, session);
}

async function listTenantProjects(vdc, session) {
  const projects = [];
  let start = 0;
  let total = Infinity;
  let page = 0;

  while (start < total) {
    page += 1;
    if (page > PROJECT_MAX_PAGES) {
      throw new Error(`Project pagination exceeded ${PROJECT_MAX_PAGES} page(s) for ${vdc.name || vdc.id}`);
    }

    const body = await fetchProjectPage(vdc, session, start, PROJECT_PAGE_LIMIT);
    const pageProjects = listFromResponse(body, ["projects", "project_list"]);
    projects.push(...pageProjects);
    total = Number.isFinite(Number(body?.total)) ? Number(body.total) : projects.length;
    start += PROJECT_PAGE_LIMIT;

    if (start < total) {
      await delay(REQUEST_DELAY_MS);
    }
  }

  return projects;
}

async function fetchNativeResourcePage({ vdc, projectId, serviceId, resourceTypeName, session, start, limit }) {
  const params = new URLSearchParams({
    service_id: serviceId,
    resource_type_name: resourceTypeName,
    start: String(start),
    limit: String(limit)
  });

  if (projectId) {
    params.set("project_id", projectId);
  } else {
    params.set("domain_id", String(vdc.domain_id || ""));
  }

  const label = `${projectId ? "project" : "domain"} ${serviceId} native resources for ${vdc.name || vdc.id}`;
  const url = `${resourceEndpointBaseUrl()}/v3.0/native/resources?${params}`;
  return readManageOneJson(label, url, session);
}

async function fetchNativeResources({ vdc, projectId, serviceId, resourceTypeName, session }) {
  const responses = [];
  let start = 0;
  let page = 0;
  let hasNextPage = true;

  while (hasNextPage) {
    page += 1;
    if (page > NATIVE_RESOURCE_MAX_PAGES) {
      throw new Error(
        `${projectId ? "Project" : "Domain"} ${serviceId} pagination exceeded ${NATIVE_RESOURCE_MAX_PAGES} page(s) for ${vdc.name || vdc.id}`
      );
    }

    const body = await fetchNativeResourcePage({
      vdc,
      projectId,
      serviceId,
      resourceTypeName,
      session,
      start,
      limit: NATIVE_RESOURCE_PAGE_LIMIT
    });
    responses.push(body);

    const pageResources = listFromResponse(body, ["resources", "resource_list", "native_resources"]);
    hasNextPage = shouldFetchNextNativePage({
      reportedTotal: responseTotal(body),
      start,
      pageSize: NATIVE_RESOURCE_PAGE_LIMIT,
      pageResourceCount: pageResources.length
    });
    start += NATIVE_RESOURCE_PAGE_LIMIT;

    if (hasNextPage) {
      await delay(REQUEST_DELAY_MS);
    }
  }

  return responses;
}

function recordsFromResponses(responses) {
  return responses.flatMap((response) => listFromResponse(response, ["resources", "resource_list", "native_resources"]));
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

function aggregateEcsFlavorBreakdown(records) {
  const flavorsByName = new Map();

  for (const resource of records) {
    const parsed = parseEcsFlavor(resource?.properties?.flavor);
    if (!parsed) continue;

    const existing = flavorsByName.get(parsed.flavorName);
    if (existing) {
      existing.count += 1;
    } else {
      flavorsByName.set(parsed.flavorName, { ...parsed, count: 1 });
    }
  }

  return [...flavorsByName.values()].sort((a, b) => a.flavorName.localeCompare(b.flavorName));
}

function parseEvsVolume(volume) {
  const properties = volume?.properties || {};
  const volumeType = typeof properties.volume_type === "string" ? properties.volume_type.trim() : "";
  const diskSize = numberOrNull(properties.disk_size);
  if (!volumeType || diskSize === null) return null;

  return {
    volumeType,
    volumeTypeKey: volumeType.toLowerCase(),
    diskSize
  };
}

function aggregateEvsVolumeTypeBreakdown(records) {
  const volumesByType = new Map();

  for (const resource of records) {
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

  return [...volumesByType.values()].sort((a, b) => a.volumeType.localeCompare(b.volumeType));
}

function summarizeNatRecords(records) {
  return {
    recordCount: records.length,
    samples: records.slice(0, 5).map((record) => ({
      id: firstDefined(record?.id, record?.resource_id, record?.nativeId, record?.resId) ?? null,
      name: firstDefined(record?.name, record?.resource_name, record?.resourceName, record?.deviceName) ?? null,
      resourceTypeName:
        firstDefined(record?.resource_type_name, record?.resourceTypeName, record?.cloud_resource_type, record?.className) ?? null,
      properties: record?.properties ?? null
    }))
  };
}

function summarizeResourceRecords(records) {
  return {
    recordCount: records.length,
    samples: records.slice(0, 5).map((record) => ({
      id: firstDefined(record?.id, record?.resource_id, record?.nativeId, record?.resId) ?? null,
      name: firstDefined(record?.name, record?.resource_name, record?.resourceName, record?.deviceName) ?? null,
      resourceType:
        firstDefined(record?.resource_type, record?.resource_type_code, record?.resourceType, record?.resourceTypeCode) ?? null,
      resourceTypeName:
        firstDefined(record?.resource_type_name, record?.resourceTypeName, record?.cloud_resource_type, record?.className) ?? null,
      regionId: firstDefined(record?.region_id, record?.regionId, record?.region_code) ?? null,
      vdcId: firstDefined(record?.vdc_id, record?.vdcId) ?? null,
      domainId: firstDefined(record?.domain_id, record?.domainId) ?? null,
      properties: record?.properties ?? null
    }))
  };
}

function collectBandwidthFields(value, path = "", results = []) {
  if (!value || typeof value !== "object") return results;

  if (Array.isArray(value)) {
    value.slice(0, 5).forEach((item, index) => collectBandwidthFields(item, `${path}[${index}]`, results));
    return results;
  }

  for (const [key, child] of Object.entries(value)) {
    const nextPath = path ? `${path}.${key}` : key;
    if (/bandwidth|qos|rate|limit|speed|mbps|mbit/i.test(key)) {
      results.push({ path: nextPath, value: child });
    }
    if (child && typeof child === "object" && results.length < 30) {
      collectBandwidthFields(child, nextPath, results);
    }
  }

  return results.slice(0, 30);
}

function summarizeEipRecords(records) {
  return {
    recordCount: records.length,
    samples: records.slice(0, 5).map((record) => ({
      id: firstDefined(record?.id, record?.resource_id, record?.nativeId, record?.resId) ?? null,
      name: firstDefined(record?.name, record?.resource_name, record?.resourceName, record?.deviceName) ?? null,
      resourceTypeName:
        firstDefined(record?.resource_type_name, record?.resourceTypeName, record?.cloud_resource_type, record?.className) ?? null,
      ipAddress:
        firstDefined(record?.floatingIpAddress, record?.floating_ip_address, record?.publicIpAddress, record?.ip_address) ?? null,
      bandwidthFields: collectBandwidthFields(record),
      properties: record?.properties ?? null
    }))
  };
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
        used: numberOrNull(used)
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
  const expectedServiceId = String(serviceId).toLowerCase();
  const expectedResourceName = String(resourceName).toLowerCase();
  const match = resources.find(
    (resource) =>
      String(resource.serviceId || "").toLowerCase() === expectedServiceId &&
      String(resource.resource || "").toLowerCase() === expectedResourceName
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

function resourceRowsForService(resources, serviceId) {
  const expectedServiceId = String(serviceId).toLowerCase();
  return resources
    .filter((resource) => String(resource.serviceId || "").toLowerCase() === expectedServiceId)
    .map((resource) => ({
      serviceId: resource.serviceId,
      resource: resource.resource,
      used: resource.used
    }));
}

function filterTenants(vdcs) {
  const filtered = TENANT_FILTER
    ? vdcs.filter((vdc) =>
        `${vdc.name || ""} ${vdc.id || ""} ${vdc.domain_id || ""}`.toLowerCase().includes(TENANT_FILTER)
      )
    : vdcs;

  return MAX_TENANTS > 0 ? filtered.slice(0, MAX_TENANTS) : filtered;
}

async function fetchProjectScopedRecords(vdc, projects, session, serviceId, resourceTypeName) {
  const responses = [];

  for (const project of projects) {
    const projectId = firstDefined(project.id, project.project_id, project.projectId);
    if (!projectId) continue;

    await delay(REQUEST_DELAY_MS);
    responses.push(
      ...(await fetchNativeResources({
        vdc,
        projectId: String(projectId),
        serviceId,
        resourceTypeName,
        session
      }))
    );
  }

  return recordsFromResponses(responses);
}

async function fetchNatProbeRecords(vdc, projects, session, probe) {
  const projectScopedRecords = await fetchProjectScopedRecords(vdc, projects, session, probe.serviceId, probe.resourceTypeName);
  const domainScopedRecords = recordsFromResponses(
    await fetchNativeResources({
      vdc,
      serviceId: probe.serviceId,
      resourceTypeName: probe.resourceTypeName,
      session
    })
  );

  return {
    serviceId: probe.serviceId,
    resourceTypeName: probe.resourceTypeName,
    projectScoped: summarizeNatRecords(projectScopedRecords),
    domainScoped: summarizeNatRecords(domainScopedRecords)
  };
}

async function fetchNatProbeBreakdown(vdc, projects, session) {
  const results = {};

  for (const probe of NAT_RESOURCE_PROBES) {
    try {
      await delay(REQUEST_DELAY_MS);
      results[probe.key] = await fetchNatProbeRecords(vdc, projects, session, probe);
    } catch (error) {
      results[probe.key] = {
        serviceId: probe.serviceId,
        resourceTypeName: probe.resourceTypeName,
        error: error instanceof Error ? error.message : String(error || "Unknown error")
      };
    }
  }

  return results;
}

function resourceIndexScopes(vdc) {
  return [
    {
      key: "domainId",
      extendParam: { domain_id: String(vdc.domain_id || "") }
    },
    {
      key: "vdcId",
      extendParam: { vdc_id: String(vdc.id || "") }
    },
    {
      key: "domainAndVdc",
      extendParam: {
        domain_id: String(vdc.domain_id || ""),
        vdc_id: String(vdc.id || "")
      }
    }
  ];
}

async function fetchResourceIndexSample(vdc, probe, scope, session) {
  const params = new URLSearchParams({
    start: "0",
    limit: String(Math.min(NATIVE_RESOURCE_PAGE_LIMIT, 100)),
    extendParam: makeExtendParam({
      ...probe.query,
      ...scope.extendParam
    })
  });
  const url = `${resourceEndpointBaseUrl()}/v3.0/resources?${params}`;
  return readManageOneJson(`${probe.key} resource index ${scope.key}`, url, session);
}

async function fetchNatResourceIndexBreakdown(vdc, session) {
  const results = {};

  for (const probe of NAT_RESOURCE_INDEX_PROBES) {
    results[probe.key] = {
      query: probe.query,
      scopedSamples: {}
    };

    for (const scope of resourceIndexScopes(vdc)) {
      try {
        await delay(REQUEST_DELAY_MS);
        const body = await fetchResourceIndexSample(vdc, probe, scope, session);
        results[probe.key].scopedSamples[scope.key] = summarizeResourceRecords(
          listFromResponse(body, ["resources", "resource_list", "native_resources"])
        );
      } catch (error) {
        results[probe.key].scopedSamples[scope.key] = {
          error: error instanceof Error ? error.message : String(error || "Unknown error")
        };
      }
    }
  }

  return results;
}

async function fetchMeteringResources(vdc, probe, session) {
  if (!vdc.regionId) {
    throw new Error("No regionId available for metering resource lookup");
  }

  const body = await postManageOneJson(
    `${probe.key} metering resources`,
    `${meteringEndpointBaseUrl()}/v3.0/metering-unit/resources`,
    {
      resource_type: probe.resourceType,
      region_code: String(vdc.regionId),
      vdc_id: String(vdc.id || ""),
      domain_id: String(vdc.domain_id || ""),
      start: 0,
      limit: Math.min(NATIVE_RESOURCE_PAGE_LIMIT, 100)
    },
    session
  );
  return listFromResponse(body, ["resources", "resource_list"]);
}

async function fetchNatMeteringBreakdown(vdc, session) {
  const results = {};

  for (const probe of NAT_METERING_RESOURCE_TYPES) {
    try {
      await delay(REQUEST_DELAY_MS);
      const records = await fetchMeteringResources(vdc, probe, session);
      results[probe.key] = {
        resourceType: probe.resourceType,
        ...summarizeResourceRecords(records)
      };
    } catch (error) {
      results[probe.key] = {
        resourceType: probe.resourceType,
        error: error instanceof Error ? error.message : String(error || "Unknown error")
      };
    }
  }

  return results;
}

async function fetchMeteringResourceTypes(vdc, session) {
  try {
    if (!vdc.regionId) {
      throw new Error("No regionId available for metering resource-type lookup");
    }

    const params = new URLSearchParams({
      region_id: String(vdc.regionId),
      start: "0",
      limit: "100"
    });
    const body = await readManageOneJson(
      `metering resource types for ${vdc.name || vdc.id}`,
      `${meteringEndpointBaseUrl()}/v3.0/resource-types?${params}`,
      session
    );
    const records = listFromResponse(body, ["resource_types", "resourceTypes"]);
    return {
      recordCount: records.length,
      natMatches: records
        .filter((record) => /nat/i.test(`${record?.resource_type_code || ""} ${record?.resource_type_name || ""}`))
        .slice(0, 20)
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error || "Unknown error")
    };
  }
}

async function fetchEipProbeRecords(vdc, projects, session, probe) {
  const projectScopedRecords = await fetchProjectScopedRecords(vdc, projects, session, probe.serviceId, probe.resourceTypeName);
  const domainScopedRecords = recordsFromResponses(
    await fetchNativeResources({
      vdc,
      serviceId: probe.serviceId,
      resourceTypeName: probe.resourceTypeName,
      session
    })
  );

  return {
    serviceId: probe.serviceId,
    resourceTypeName: probe.resourceTypeName,
    projectScoped: summarizeEipRecords(projectScopedRecords),
    domainScoped: summarizeEipRecords(domainScopedRecords)
  };
}

async function fetchEipProbeBreakdown(vdc, projects, session) {
  const results = {};

  for (const probe of EIP_RESOURCE_PROBES) {
    try {
      await delay(REQUEST_DELAY_MS);
      results[probe.key] = await fetchEipProbeRecords(vdc, projects, session, probe);
    } catch (error) {
      results[probe.key] = {
        serviceId: probe.serviceId,
        resourceTypeName: probe.resourceTypeName,
        error: error instanceof Error ? error.message : String(error || "Unknown error")
      };
    }
  }

  return results;
}

async function compareTenant(vdc, session) {
  console.log(`[DOMAIN BREAKDOWN PREVIEW] comparing ${vdc.name || vdc.id}`);

  let tenantRegion = null;
  try {
    await delay(REQUEST_DELAY_MS);
    tenantRegion = await fetchTenantRegion(vdc, session);
    vdc.regionId = tenantRegion.regionId;
    vdc.regionName = tenantRegion.regionName;
  } catch (error) {
    tenantRegion = {
      error: error instanceof Error ? error.message : String(error || "Unknown error")
    };
  }

  const resourceUsage = await fetchTenantResourceUsage(vdc, session);
  const usageRows = flattenResourceUsage(resourceUsage);
  const projects = await listTenantProjects(vdc, session);

  const projectEcsRecords = await fetchProjectScopedRecords(vdc, projects, session, "ecs", "CLOUD_ECS_INSTANCE");
  const domainEcsRecords = recordsFromResponses(
    await fetchNativeResources({
      vdc,
      serviceId: "ecs",
      resourceTypeName: "CLOUD_ECS_INSTANCE",
      session
    })
  );

  const projectEvsRecords = await fetchProjectScopedRecords(vdc, projects, session, "evs", "CLOUD_EVS_INSTANCE");
  const domainEvsRecords = recordsFromResponses(
    await fetchNativeResources({
      vdc,
      serviceId: "evs",
      resourceTypeName: "CLOUD_EVS_INSTANCE",
      session
    })
  );
  const natProbes = await fetchNatProbeBreakdown(vdc, projects, session);
  const natResourceIndexProbes = await fetchNatResourceIndexBreakdown(vdc, session);
  const natMeteringProbes = await fetchNatMeteringBreakdown(vdc, session);
  const meteringResourceTypes = await fetchMeteringResourceTypes(vdc, session);
  const eipProbes = await fetchEipProbeBreakdown(vdc, projects, session);

  return {
    tenant: {
      vdcId: String(vdc.id),
      domainId: vdc.domain_id ?? null,
      name: String(vdc.name || vdc.id),
      regionId: tenantRegion?.regionId ?? null,
      regionName: tenantRegion?.regionName ?? null,
      ...(tenantRegion?.error ? { regionError: tenantRegion.error } : {})
    },
    rawCounters: {
      ecsInstances: resourceUsed(usageRows, "ecs", "instances"),
      evsGb: resourceUsed(usageRows, "evs", "gigabytes"),
      cceClusters: resourceUsed(usageRows, "cce", "hybrid.resource.type.cce.cluster"),
      publicIps: resourceUsed(usageRows, "vpc", "publicIp"),
      bandwidthSize: resourceUsed(usageRows, "vpc", "bandwidth_size"),
      natGateways:
        resourceUsed(usageRows, "vpc", "nat_gateway") +
        resourceUsed(usageRows, "vpc", "natgateway") +
        resourceUsed(usageRows, "vpc", "nat")
    },
    rawVpcUsageRows: resourceRowsForService(usageRows, "vpc"),
    projects: projects.length,
    currentProjectScoped: {
      ecsRecordCount: projectEcsRecords.length,
      ecsFlavors: aggregateEcsFlavorBreakdown(projectEcsRecords),
      evsRecordCount: projectEvsRecords.length,
      evsVolumeTypes: aggregateEvsVolumeTypeBreakdown(projectEvsRecords)
    },
    proposedDomainScoped: {
      ecsRecordCount: domainEcsRecords.length,
      ecsFlavors: aggregateEcsFlavorBreakdown(domainEcsRecords),
      evsRecordCount: domainEvsRecords.length,
      evsVolumeTypes: aggregateEvsVolumeTypeBreakdown(domainEvsRecords)
    },
    natProbes,
    natResourceIndexProbes,
    natMeteringProbes,
    meteringResourceTypes,
    eipProbes
  };
}

function sumNatNativeRecords(result) {
  return Object.values(result?.natProbes || {}).reduce(
    (total, probe) =>
      total + (numberOrNull(probe?.projectScoped?.recordCount) || 0) + (numberOrNull(probe?.domainScoped?.recordCount) || 0),
    0
  );
}

function sumNatMeteringRecords(result) {
  return Object.values(result?.natMeteringProbes || {}).reduce(
    (total, probe) => total + (numberOrNull(probe?.recordCount) || 0),
    0
  );
}

function buildNatSummary(results) {
  const tenantSummaries = results.map((result) => {
    const rawNatGateways = numberOrNull(result?.rawCounters?.natGateways) || 0;
    const nativeNatRecords = sumNatNativeRecords(result);
    const meteringNatRecords = sumNatMeteringRecords(result);
    const natResourceTypeMatches = Array.isArray(result?.meteringResourceTypes?.natMatches)
      ? result.meteringResourceTypes.natMatches.length
      : 0;
    const hasNatEvidence = rawNatGateways > 0 || nativeNatRecords > 0 || meteringNatRecords > 0 || natResourceTypeMatches > 0;

    return {
      tenant: result?.tenant?.name ?? "unknown",
      regionId: result?.tenant?.regionId ?? null,
      regionName: result?.tenant?.regionName ?? null,
      rawNatGateways,
      nativeNatRecords,
      meteringNatRecords,
      natResourceTypeMatches,
      hasNatEvidence
    };
  });

  return {
    tenantCount: tenantSummaries.length,
    tenantsWithNatEvidence: tenantSummaries.filter((tenant) => tenant.hasNatEvidence),
    tenantsWithoutNatEvidence: tenantSummaries.filter((tenant) => !tenant.hasNatEvidence).length,
    tenants: tenantSummaries
  };
}

async function main() {
  console.log("[DOMAIN BREAKDOWN PREVIEW] read-only preview started");
  console.log("[DOMAIN BREAKDOWN PREVIEW] no DB writes, no CRM push, no sync job changes");

  const session = await authenticate();
  const vdcs = filterTenants(await listAllVdcs({ upper_vdc_id: "0", used: "true" }));
  const results = [];

  console.log(`[DOMAIN BREAKDOWN PREVIEW] tenants selected: ${vdcs.length}`);

  for (const vdc of vdcs) {
    try {
      results.push(await compareTenant(vdc, session));
    } catch (error) {
      results.push({
        tenant: {
          vdcId: String(vdc.id),
          domainId: vdc.domain_id ?? null,
          name: String(vdc.name || vdc.id)
        },
        error: error instanceof Error ? error.message : String(error || "Unknown error")
      });
    }
  }

  console.log("\n================ DOMAIN BREAKDOWN PREVIEW ================");
  console.log(JSON.stringify({ generatedAt: new Date().toISOString(), natSummary: buildNatSummary(results), tenants: results }, null, 2));
  console.log("================ END DOMAIN BREAKDOWN PREVIEW ================");
}

main().catch((error) => {
  console.error(
    `[DOMAIN BREAKDOWN PREVIEW] failed: ${error instanceof Error ? error.stack || error.message : String(error || "Unknown error")}`
  );
  process.exitCode = 1;
});
