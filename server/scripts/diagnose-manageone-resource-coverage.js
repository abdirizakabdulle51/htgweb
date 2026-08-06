import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { authenticate, listAllVdcs } from "../manageone.js";

const DEFAULT_MANAGEONE_BASE_URL = "https://10.20.24.9:26335/rest/vdc";
const REQUEST_TIMEOUT_MS = Number(process.env.MANAGEONE_TIMEOUT_MS || 30000);
const REQUEST_DELAY_MS = Number(process.env.MANAGEONE_DIAGNOSTIC_DELAY_MS || 500);
const PROJECT_PAGE_LIMIT = Number(process.env.MANAGEONE_DIAGNOSTIC_PROJECT_PAGE_LIMIT || 100);
const PROJECT_MAX_PAGES = Number(process.env.MANAGEONE_DIAGNOSTIC_PROJECT_MAX_PAGES || 20);
const NATIVE_RESOURCE_PAGE_LIMIT = Number(process.env.MANAGEONE_DIAGNOSTIC_NATIVE_PAGE_LIMIT || 500);
const NATIVE_RESOURCE_MAX_PAGES = Number(process.env.MANAGEONE_DIAGNOSTIC_NATIVE_MAX_PAGES || 10);
const TENANT_FILTER = String(process.env.MANAGEONE_DIAGNOSTIC_TENANT_FILTER || "").trim().toLowerCase();
const MAX_TENANTS = Number(process.env.MANAGEONE_DIAGNOSTIC_MAX_TENANTS || 0);
const ENABLE_PROTOTYPE_COLLECTORS = process.env.MANAGEONE_DIAGNOSTIC_PROTOTYPE_COLLECTORS === "true";

const BILLING_COVERAGE_WATCHLIST = [
  { serviceId: "cce", label: "CCE cluster counter", resourceNames: ["hybrid.resource.type.cce.cluster"] },
  { serviceId: "obsv3", label: "OBS/Object Storage capacity", resourceNames: ["capacity"] },
  { serviceId: "sfs", label: "SFS capacity", resourceNames: ["gigabytes"] },
  { serviceId: "vpc", label: "public IP counter", resourceNames: ["publicIp"] },
  { serviceId: "ecs", label: "ECS instances", resourceNames: ["instances"] },
  { serviceId: "evs", label: "EVS gigabytes", resourceNames: ["gigabytes"] }
];

const NATIVE_RESOURCE_PROBES = [
  { key: "ecsInstances", serviceId: "ecs", resourceTypeName: "CLOUD_ECS_INSTANCE" },
  { key: "evsVolumes", serviceId: "evs", resourceTypeName: "CLOUD_EVS_INSTANCE" },
  { key: "cceClusters", serviceId: "cce", resourceTypeName: "CLOUD_CCE_CLUSTER" },
  { key: "cceNodes", serviceId: "cce", resourceTypeName: "CLOUD_CCE_NODE" },
  { key: "obsBuckets", serviceId: "obsv3", resourceTypeName: "CLOUD_OBS_BUCKET" },
  { key: "vpcVpnGateways", serviceId: "vpc", resourceTypeName: "CLOUD_VPN_GATEWAY" },
  { key: "vpcEips", serviceId: "vpc", resourceTypeName: "CLOUD_EIP" },
  { key: "elbLoadBalancers", serviceId: "elb", resourceTypeName: "CLOUD_ELB_LOADBALANCER" },
  { key: "bastionHosts", serviceId: "cbh", resourceTypeName: "CLOUD_CBH_INSTANCE" }
];

const DOMAIN_NATIVE_RESOURCE_PROBES = [
  { key: "domainCloudVm", serviceId: "ecs", resourceTypeName: "CLOUD_VM" },
  { key: "domainEcsInstances", serviceId: "ecs", resourceTypeName: "CLOUD_ECS_INSTANCE" },
  { key: "domainCloudVolumes", serviceId: "evs", resourceTypeName: "CLOUD_VOLUME" },
  { key: "domainEvsInstances", serviceId: "evs", resourceTypeName: "CLOUD_EVS_INSTANCE" },
  { key: "domainFloatingIps", serviceId: "vpc", resourceTypeName: "CLOUD_FLOATING_IPS" },
  { key: "domainElb", serviceId: "elb", resourceTypeName: "CLOUD_ELB" },
  { key: "domainBandwidths", serviceId: "vpc", resourceTypeName: "CLOUD_BANDWIDTHS" },
  { key: "domainObs", serviceId: "obsv3", resourceTypeName: "CLOUD_OBS" },
  { key: "domainCceNodes", serviceId: "cce", resourceTypeName: "CLOUD_NODE" },
  { key: "domainCbh", serviceId: "cbh", resourceTypeName: "CLOUD_CBH" }
];

const TENANT_RESOURCE_CLASS_PROBES = [
  { key: "tenantCloudVm", className: "CLOUD_VM" },
  { key: "tenantCloudVolume", className: "CLOUD_VOLUME" },
  { key: "tenantFloatingIps", className: "CLOUD_FLOATING_IPS" },
  { key: "tenantElb", className: "CLOUD_ELB" },
  { key: "tenantBandwidths", className: "CLOUD_BANDWIDTHS" },
  { key: "tenantObs", className: "CLOUD_OBS" },
  { key: "tenantNode", className: "CLOUD_NODE" },
  { key: "tenantCbh", className: "CLOUD_CBH" },
  { key: "tenantSfsShare", className: "CLOUD_SFS_SHARE" }
];

const prisma = new PrismaClient();

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

function resourceTotal(value) {
  if (value === undefined || value === null || value === "") return undefined;
  const total = numberOrNull(value);
  return total === null || total === -1 ? undefined : total;
}

function normalizedKey(value) {
  return String(value || "").trim().toLowerCase();
}

function listFromResponse(body, keys) {
  if (Array.isArray(body)) return body;

  for (const key of keys) {
    const value = body?.[key] || body?.data?.[key];
    if (Array.isArray(value)) return value;
  }

  return [];
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
        serviceId: String(currentServiceId),
        resource: String(resource),
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

function countByService(resources) {
  const byService = new Map();

  for (const resource of resources) {
    const key = normalizedKey(resource.serviceId) || "unknown";
    const current = byService.get(key) || { serviceId: key, entries: 0, usedTotal: 0, resources: [] };
    current.entries += 1;
    current.usedTotal += Number.isFinite(resource.used) ? resource.used : 0;
    current.resources.push({
      resource: resource.resource,
      used: resource.used,
      ...(resource.total !== undefined ? { total: resource.total } : {})
    });
    byService.set(key, current);
  }

  return [...byService.values()].sort((a, b) => a.serviceId.localeCompare(b.serviceId));
}

function currentCrmPayloadShape({ vdc, resourceUsage, ecsFlavors, evsVolumeTypes }) {
  const resources = flattenResourceUsage(resourceUsage);
  return {
    vdcId: String(vdc.id),
    domainId: vdc.domain_id ?? null,
    name: String(vdc.name || vdc.id),
    ecsUsed: numberOrNull(vdc.ecs_used),
    evsUsed: numberOrNull(vdc.evs_used),
    projectCount: Number.parseInt(vdc.project_count, 10) || null,
    resources,
    ecsFlavors,
    evsVolumeTypes,
    tenantUsageHistoryFields: {
      ecsInstances: resourceUsed(resources, "ecs", "instances"),
      ecsCores: resourceUsed(resources, "ecs", "cores"),
      ecsRamGb: resourceUsed(resources, "ecs", "ram"),
      rdsInstances: resourceUsed(resources, "rds", "instance"),
      cceClusters: resourceUsed(resources, "cce", "hybrid.resource.type.cce.cluster"),
      evsGb: resourceUsed(resources, "evs", "gigabytes"),
      obsGb: resourceUsed(resources, "obsv3", "capacity"),
      sfsGb: resourceUsed(resources, "sfs", "gigabytes"),
      publicIps: resourceUsed(resources, "vpc", "publicIp"),
      wafInstances: resourceUsed(resources, "waf", "waf.instance")
    }
  };
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

function parseJson(text, label) {
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`${label} returned invalid JSON`);
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

  return parseJson(text, label);
}

async function fetchTenantResourceUsage(vdc, session) {
  const url = `${vdcEndpointBaseUrl()}/v3.0/capacity/${encodeURIComponent(vdc.id)}/statics?inherit=true`;
  return readManageOneJson(`resource usage for ${vdc.name || vdc.id}`, url, session);
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

async function fetchNativeResourcePage({ projectId, probe, session, start, limit }) {
  const params = new URLSearchParams({
    service_id: probe.serviceId,
    resource_type_name: probe.resourceTypeName,
    project_id: projectId,
    start: String(start),
    limit: String(limit)
  });
  const url = `${resourceEndpointBaseUrl()}/v3.0/native/resources?${params}`;
  return readManageOneJson(`${probe.key} native resources`, url, session);
}

async function fetchProjectNativeResources(projectId, probe, session) {
  const responses = [];
  let start = 0;
  let total = Infinity;
  let page = 0;

  while (start < total) {
    page += 1;
    if (page > NATIVE_RESOURCE_MAX_PAGES) {
      throw new Error(`${probe.key} pagination exceeded ${NATIVE_RESOURCE_MAX_PAGES} page(s) for project ${projectId}`);
    }

    const body = await fetchNativeResourcePage({
      projectId,
      probe,
      session,
      start,
      limit: NATIVE_RESOURCE_PAGE_LIMIT
    });
    responses.push(body);
    const pageResources = listFromResponse(body, ["resources", "resource_list", "native_resources"]);
    total = Number.isFinite(Number(body?.total)) ? Number(body.total) : start + pageResources.length;
    start += NATIVE_RESOURCE_PAGE_LIMIT;

    if (start < total) {
      await delay(REQUEST_DELAY_MS);
    }
  }

  return responses;
}

async function fetchDomainNativeResourcePage({ vdc, probe, session, start, limit }) {
  const params = new URLSearchParams({
    service_id: probe.serviceId,
    resource_type_name: probe.resourceTypeName,
    domain_id: String(vdc.domain_id || ""),
    vdc_id: String(vdc.id || ""),
    qFlag: "1",
    start: String(start),
    limit: String(limit)
  });
  const url = `${resourceEndpointBaseUrl()}/v3.0/native/resources?${params}`;
  return readManageOneJson(`${probe.key} domain native resources`, url, session);
}

async function fetchDomainNativeResources(vdc, probe, session) {
  const responses = [];
  let start = 0;
  let total = Infinity;
  let page = 0;

  while (start < total) {
    page += 1;
    if (page > NATIVE_RESOURCE_MAX_PAGES) {
      throw new Error(`${probe.key} domain pagination exceeded ${NATIVE_RESOURCE_MAX_PAGES} page(s) for ${vdc.name || vdc.id}`);
    }

    const body = await fetchDomainNativeResourcePage({
      vdc,
      probe,
      session,
      start,
      limit: NATIVE_RESOURCE_PAGE_LIMIT
    });
    responses.push(body);
    const pageResources = listFromResponse(body, ["resources", "resource_list", "native_resources"]);
    total = Number.isFinite(Number(body?.total)) ? Number(body.total) : start + pageResources.length;
    start += NATIVE_RESOURCE_PAGE_LIMIT;

    if (start < total) {
      await delay(REQUEST_DELAY_MS);
    }
  }

  return responses;
}

async function fetchTenantResourceClassPage({ vdc, probe, session, start, limit }) {
  const params = new URLSearchParams({
    start: String(start),
    limit: String(limit),
    domain_id: String(vdc.domain_id || ""),
    vdc_id: String(vdc.id || ""),
    tenant_id: String(vdc.id || "")
  });
  const url = `${manageOneRootUrl()}/rest/tenant-resource/v1/tenant/resources/${encodeURIComponent(probe.className)}?${params}`;
  return readManageOneJson(`${probe.key} tenant resource class`, url, session);
}

async function fetchTenantResourceClass(vdc, probe, session) {
  const responses = [];
  let start = 0;
  let total = Infinity;
  let page = 0;

  while (start < total) {
    page += 1;
    if (page > NATIVE_RESOURCE_MAX_PAGES) {
      throw new Error(`${probe.key} tenant-resource pagination exceeded ${NATIVE_RESOURCE_MAX_PAGES} page(s) for ${vdc.name || vdc.id}`);
    }

    const body = await fetchTenantResourceClassPage({
      vdc,
      probe,
      session,
      start,
      limit: NATIVE_RESOURCE_PAGE_LIMIT
    });
    responses.push(body);
    const pageResources = listFromResponse(body, ["objList", "resources", "resource_list", "instances"]);
    total = Number.isFinite(Number(body?.totalNum ?? body?.total))
      ? Number(body.totalNum ?? body.total)
      : start + pageResources.length;
    start += NATIVE_RESOURCE_PAGE_LIMIT;

    if (start < total) {
      await delay(REQUEST_DELAY_MS);
    }
  }

  return responses;
}

async function probeNativeResources(projects, session) {
  const probeResults = {};
  const responsesByProbe = new Map();

  for (const probe of NATIVE_RESOURCE_PROBES) {
    const responses = [];
    const failures = [];

    for (const project of projects) {
      const projectId = project.id || project.project_id || project.projectId;
      if (!projectId) continue;

      try {
        await delay(REQUEST_DELAY_MS);
        responses.push(...(await fetchProjectNativeResources(String(projectId), probe, session)));
      } catch (error) {
        failures.push({
          projectId: String(projectId),
          message: error instanceof Error ? error.message : String(error || "Unknown error")
        });
      }
    }

    const records = responses.flatMap((response) =>
      listFromResponse(response, ["resources", "resource_list", "native_resources"])
    );
    responsesByProbe.set(probe.key, responses);
    probeResults[probe.key] = {
      serviceId: probe.serviceId,
      resourceTypeName: probe.resourceTypeName,
      recordCount: records.length,
      sampleNames: records
        .slice(0, 5)
        .map((record) => record?.name || record?.resource_name || record?.resourceName || record?.id || record?.nativeId)
        .filter(Boolean),
      failures
    };
  }

  return { probeResults, responsesByProbe };
}

function summarizeRecords(responses, keys) {
  const records = responses.flatMap((response) => listFromResponse(response, keys));
  return {
    recordCount: records.length,
    sampleNames: records
      .slice(0, 8)
      .map((record) => record?.resource_name || record?.name || record?.deviceName || record?.id || record?.resId || record?.nativeId)
      .filter(Boolean),
    sampleResourceTypes: [
      ...new Set(
        records
          .slice(0, 20)
          .map((record) => record?.resource_type_name || record?.resourceTypeName || record?.cloud_resource_type || record?.className)
          .filter(Boolean)
      )
    ],
    sampleServices: [
      ...new Set(
        records
          .slice(0, 20)
          .map((record) => record?.service_id || record?.serviceId || record?.service_name || record?.serviceName)
          .filter(Boolean)
      )
    ]
  };
}

async function probePrototypeCollectors(vdc, session) {
  if (!ENABLE_PROTOTYPE_COLLECTORS) {
    return {
      enabled: false,
      note: "Set MANAGEONE_DIAGNOSTIC_PROTOTYPE_COLLECTORS=true to run extra read-only collector probes."
    };
  }

  const domainNative = {};
  const tenantResource = {};

  for (const probe of DOMAIN_NATIVE_RESOURCE_PROBES) {
    try {
      await delay(REQUEST_DELAY_MS);
      const responses = await fetchDomainNativeResources(vdc, probe, session);
      domainNative[probe.key] = {
        serviceId: probe.serviceId,
        resourceTypeName: probe.resourceTypeName,
        ...summarizeRecords(responses, ["resources", "resource_list", "native_resources"])
      };
    } catch (error) {
      domainNative[probe.key] = {
        serviceId: probe.serviceId,
        resourceTypeName: probe.resourceTypeName,
        error: error instanceof Error ? error.message : String(error || "Unknown error")
      };
    }
  }

  for (const probe of TENANT_RESOURCE_CLASS_PROBES) {
    try {
      await delay(REQUEST_DELAY_MS);
      const responses = await fetchTenantResourceClass(vdc, probe, session);
      tenantResource[probe.key] = {
        className: probe.className,
        ...summarizeRecords(responses, ["objList", "resources", "resource_list", "instances"])
      };
    } catch (error) {
      tenantResource[probe.key] = {
        className: probe.className,
        error: error instanceof Error ? error.message : String(error || "Unknown error")
      };
    }
  }

  return {
    enabled: true,
    domainNative,
    tenantResource
  };
}

function watchedCoverage(resources) {
  return BILLING_COVERAGE_WATCHLIST.map((watch) => ({
    label: watch.label,
    serviceId: watch.serviceId,
    used: watch.resourceNames.reduce((total, resourceName) => total + resourceUsed(resources, watch.serviceId, resourceName), 0)
  }));
}

function likelyBillingGaps({ crmPayload, nativeProbeResults }) {
  const gaps = [];
  const fields = crmPayload.tenantUsageHistoryFields;

  if (fields.cceClusters > 0 && nativeProbeResults.cceNodes?.recordCount === 0) {
    gaps.push("CCE is only represented as a cluster counter; no CCE SKU/node breakdown is currently exposed.");
  }
  if ((fields.obsGb || 0) > 0 && nativeProbeResults.obsBuckets?.recordCount === 0) {
    gaps.push("Object storage appears in raw capacity, but no native OBS/SATA billable rows are exposed.");
  }
  if (nativeProbeResults.vpcVpnGateways?.recordCount > 0) {
    gaps.push("VPN Gateway native resources exist, but current CRM tenant payload only exposes generic resources/public IP counters.");
  }
  if (nativeProbeResults.bastionHosts?.recordCount > 0) {
    gaps.push("Cloud Bastion Host native resources exist, but current CRM tenant payload has no bastion billing field.");
  }
  if (nativeProbeResults.evsVolumes?.recordCount > 0 && crmPayload.evsVolumeTypes.length === 0) {
    gaps.push("EVS native volumes exist, but current EVS volume-type breakdown is empty.");
  }

  return gaps;
}

async function loadSyncedTenantRow(vdcId) {
  try {
    const rows = await prisma.$queryRaw`
      SELECT vdc_id, name, resource_usage, ecs_flavor_breakdown, evs_volume_type_breakdown, last_synced_at
      FROM manageone_tenants
      WHERE vdc_id = ${String(vdcId)}
      LIMIT 1
    `;
    return rows[0] || null;
  } catch (error) {
    return {
      diagnosticReadError: error instanceof Error ? error.message : String(error || "Unknown error")
    };
  }
}

function filterTenants(vdcs) {
  const filtered = TENANT_FILTER
    ? vdcs.filter((vdc) =>
        `${vdc.name || ""} ${vdc.id || ""} ${vdc.domain_id || ""}`.toLowerCase().includes(TENANT_FILTER)
      )
    : vdcs;

  return MAX_TENANTS > 0 ? filtered.slice(0, MAX_TENANTS) : filtered;
}

async function diagnoseTenant(vdc, session) {
  const tenantName = String(vdc.name || vdc.id);
  console.log(`[RESOURCE COVERAGE] diagnosing ${tenantName}`);

  const resourceUsage = await fetchTenantResourceUsage(vdc, session);
  const resources = flattenResourceUsage(resourceUsage);
  const projects = await listTenantProjects(vdc, session);
  const { probeResults, responsesByProbe } = await probeNativeResources(projects, session);
  const ecsFlavors = aggregateEcsFlavorBreakdown(responsesByProbe.get("ecsInstances") || []);
  const evsVolumeTypes = aggregateEvsVolumeTypeBreakdown(responsesByProbe.get("evsVolumes") || []);
  const crmPayload = currentCrmPayloadShape({ vdc, resourceUsage, ecsFlavors, evsVolumeTypes });
  const prototypeCollectorResults = await probePrototypeCollectors(vdc, session);
  const syncedTenantRow = await loadSyncedTenantRow(vdc.id);

  return {
    tenant: {
      vdcId: String(vdc.id),
      domainId: vdc.domain_id ?? null,
      name: tenantName
    },
    rawManageOne: {
      projectCount: projects.length,
      resourceUsageServices: countByService(resources),
      watchedCoverage: watchedCoverage(resources),
      nativeResourceProbes: probeResults
    },
    htgwebCurrentCrmPayload: {
      resourceEntryCount: crmPayload.resources.length,
      resourceServices: countByService(crmPayload.resources),
      ecsFlavors,
      evsVolumeTypes,
      tenantUsageHistoryFields: crmPayload.tenantUsageHistoryFields
    },
    localSyncedSnapshot: syncedTenantRow
      ? {
          name: syncedTenantRow.name,
          lastSyncedAt: syncedTenantRow.last_synced_at,
          resourceEntryCount: Array.isArray(flattenResourceUsage(syncedTenantRow.resource_usage))
            ? flattenResourceUsage(syncedTenantRow.resource_usage).length
            : 0,
          ecsFlavorCount: Array.isArray(syncedTenantRow.ecs_flavor_breakdown)
            ? syncedTenantRow.ecs_flavor_breakdown.length
            : 0,
          evsVolumeTypeCount: Array.isArray(syncedTenantRow.evs_volume_type_breakdown)
            ? syncedTenantRow.evs_volume_type_breakdown.length
            : 0,
          ...(syncedTenantRow.diagnosticReadError ? { diagnosticReadError: syncedTenantRow.diagnosticReadError } : {})
        }
      : null,
    prototypeCollectors: prototypeCollectorResults,
    likelyBillingGaps: likelyBillingGaps({ crmPayload, nativeProbeResults: probeResults })
  };
}

async function main() {
  console.log("[RESOURCE COVERAGE] read-only diagnostic started");
  console.log("[RESOURCE COVERAGE] no DB writes, no CRM push, no API response changes");

  const session = await authenticate();
  const vdcs = filterTenants(await listAllVdcs({ upper_vdc_id: "0", used: "true" }));
  const results = [];

  console.log(`[RESOURCE COVERAGE] tenants selected: ${vdcs.length}`);

  for (const vdc of vdcs) {
    try {
      results.push(await diagnoseTenant(vdc, session));
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

  console.log("\n================ RESOURCE COVERAGE REPORT ================");
  console.log(JSON.stringify({ generatedAt: new Date().toISOString(), tenants: results }, null, 2));
  console.log("================ END RESOURCE COVERAGE REPORT ================");
}

main()
  .catch((error) => {
    console.error(
      `[RESOURCE COVERAGE] failed: ${error instanceof Error ? error.stack || error.message : String(error || "Unknown error")}`
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
