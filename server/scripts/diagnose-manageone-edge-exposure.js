import "dotenv/config";
import { authenticate, listAllVdcs } from "../manageone.js";

const DEFAULT_MANAGEONE_BASE_URL = "https://10.20.24.9:26335/rest/vdc";
const REQUEST_TIMEOUT_MS = Number(process.env.MANAGEONE_TIMEOUT_MS || 30000);
const REQUEST_DELAY_MS = Number(process.env.MANAGEONE_EDGE_DIAGNOSTIC_DELAY_MS || 500);
const PROJECT_PAGE_LIMIT = Number(process.env.MANAGEONE_EDGE_DIAGNOSTIC_PROJECT_PAGE_LIMIT || 100);
const PROJECT_MAX_PAGES = Number(process.env.MANAGEONE_EDGE_DIAGNOSTIC_PROJECT_MAX_PAGES || 20);
const RESOURCE_PAGE_LIMIT = Number(process.env.MANAGEONE_EDGE_DIAGNOSTIC_RESOURCE_PAGE_LIMIT || 300);
const RESOURCE_MAX_PAGES = Number(process.env.MANAGEONE_EDGE_DIAGNOSTIC_RESOURCE_MAX_PAGES || 10);
const TENANT_FILTER = String(process.env.MANAGEONE_EDGE_DIAGNOSTIC_TENANT_FILTER || "")
  .trim()
  .toLowerCase();
const MAX_TENANTS = Number(process.env.MANAGEONE_EDGE_DIAGNOSTIC_MAX_TENANTS || 2);

const EDGE_PROBES = [
  {
    key: "publicIps",
    label: "Public IPs",
    serviceId: "vpc",
    resourceTypeNames: ["CLOUD_FLOATING_IPS", "CLOUD_EIP"]
  },
  {
    key: "bandwidths",
    label: "Bandwidths",
    serviceId: "vpc",
    resourceTypeNames: ["CLOUD_BANDWIDTHS"]
  },
  {
    key: "loadBalancers",
    label: "Load Balancers",
    serviceId: "elb",
    resourceTypeNames: ["CLOUD_ELB", "CLOUD_ELB_LOADBALANCER"]
  },
  {
    key: "natGateways",
    label: "NAT Gateways",
    serviceId: "vpc",
    resourceTypeNames: ["CLOUD_NAT_GATEWAY", "CLOUD_NAT", "NAT Gateway"]
  },
  {
    key: "vpnGateways",
    label: "VPN Gateways",
    serviceId: "vpc",
    resourceTypeNames: ["CLOUD_VPN_GATEWAY", "CLOUD_VPN_SERVICE"]
  }
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

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "");
}

function listFromResponse(body, keys) {
  if (Array.isArray(body)) return body;

  for (const key of keys) {
    const value = body?.[key] || body?.data?.[key];
    if (Array.isArray(value)) return value;
  }

  return [];
}

function responseTotal(body, fallbackTotal) {
  const total = Number(body?.total ?? body?.totalNum);
  return Number.isFinite(total) ? total : fallbackTotal;
}

function makeExtendParam(value) {
  return JSON.stringify(value);
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
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`HTTP request timed out after ${REQUEST_TIMEOUT_MS}ms`);
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
    throw new Error(`${label} returned invalid JSON: ${String(text || "").slice(0, 300)}`);
  }
}

async function readManageOneJson(label, url, session) {
  const { response, text } = await fetchTextWithTimeout(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Auth-Token": session.token
    }
  });

  const body = parseJson(text, label);
  if (!response.ok) {
    throw new Error(`${label} failed: HTTP ${response.status}${text ? ` ${text.slice(0, 500)}` : ""}`);
  }

  return body;
}

async function fetchProjectPage(vdc, session, start, limit) {
  const url = `${vdcEndpointBaseUrl()}/v3.1/vdcs/${encodeURIComponent(vdc.id)}/projects?start=${start}&limit=${limit}`;
  return readManageOneJson(`projects for ${vdc.name || vdc.id}`, url, session);
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
    total = responseTotal(body, projects.length);
    start += PROJECT_PAGE_LIMIT;

    if (start < total) await delay(REQUEST_DELAY_MS);
  }

  return projects;
}

function projectId(project) {
  return firstDefined(project?.id, project?.project_id, project?.projectId);
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
      project?.id
    ) || ""
  );
}

function projectRegionFields(project) {
  const regions = Array.isArray(project?.regions) ? project.regions : [];
  const region = regions[0] || {};
  return {
    regionId: firstDefined(project?.region_id, project?.regionId, region?.id, region?.region_id, region?.regionId),
    regionName: firstDefined(project?.region_name, project?.regionName, region?.name, region?.region_name, region?.regionName)
  };
}

async function fetchNativeResourcePage({ projectId: id, probe, resourceTypeName, session, start, limit }) {
  const params = new URLSearchParams({
    service_id: probe.serviceId,
    resource_type_name: resourceTypeName,
    project_id: id,
    start: String(start),
    limit: String(limit)
  });
  const url = `${resourceEndpointBaseUrl()}/v3.0/native/resources?${params}`;
  return readManageOneJson(`${probe.key} native ${resourceTypeName}`, url, session);
}

async function fetchResourceIndexPage({ vdc, resourceTypeName, session, start, limit, scope }) {
  const params = new URLSearchParams({
    start: String(start),
    limit: String(limit),
    extendParam: makeExtendParam({
      resource_type_name: resourceTypeName,
      ...scope
    })
  });
  const url = `${resourceEndpointBaseUrl()}/v3.0/resources?${params}`;
  return readManageOneJson(`${resourceTypeName} resource index for ${vdc.name || vdc.id}`, url, session);
}

async function pagedNativeResources({ project, probe, resourceTypeName, session }) {
  const id = projectId(project);
  if (!id) return [];

  const responses = [];
  let start = 0;
  let total = Infinity;
  let page = 0;

  while (start < total) {
    page += 1;
    if (page > RESOURCE_MAX_PAGES) {
      throw new Error(`${probe.key} native pagination exceeded ${RESOURCE_MAX_PAGES} page(s) for project ${id}`);
    }

    const body = await fetchNativeResourcePage({
      projectId: String(id),
      probe,
      resourceTypeName,
      session,
      start,
      limit: RESOURCE_PAGE_LIMIT
    });
    responses.push(body);
    const records = listFromResponse(body, ["resources", "resource_list", "native_resources"]);
    total = responseTotal(body, start + records.length);
    start += RESOURCE_PAGE_LIMIT;

    if (start < total) await delay(REQUEST_DELAY_MS);
  }

  return responses.flatMap((response) => listFromResponse(response, ["resources", "resource_list", "native_resources"]));
}

async function resourceIndexSample({ vdc, resourceTypeName, session, scope }) {
  const body = await fetchResourceIndexPage({
    vdc,
    resourceTypeName,
    session,
    scope,
    start: 0,
    limit: Math.min(RESOURCE_PAGE_LIMIT, 100)
  });
  return listFromResponse(body, ["resources", "resource_list", "native_resources"]);
}

function uniqueResourceKey(record) {
  return String(
    firstDefined(
      record?.id,
      record?.resource_id,
      record?.resourceId,
      record?.nativeId,
      record?.native_id,
      record?.native_resource_id,
      record?.resource_name,
      record?.resourceName,
      record?.name
    ) || ""
  );
}

function pickResourceFields(record, context = {}) {
  return {
    id: uniqueResourceKey(record),
    name: firstDefined(record?.name, record?.resource_name, record?.resourceName, record?.deviceName),
    resourceTypeName: firstDefined(record?.resource_type_name, record?.resourceTypeName, record?.cloud_resource_type, context.resourceTypeName),
    serviceId: firstDefined(record?.service_id, record?.serviceId, record?.service_name, record?.serviceName, context.serviceId),
    status: firstDefined(record?.status, record?.state, record?.resource_status, record?.resourceStatus),
    ipAddress: firstDefined(
      record?.ip,
      record?.ipAddress,
      record?.ip_address,
      record?.public_ip,
      record?.publicIp,
      record?.floating_ip_address,
      record?.floatingIpAddress,
      record?.properties?.ip,
      record?.properties?.ipAddress,
      record?.properties?.public_ip,
      record?.properties?.publicIp,
      record?.properties?.floating_ip_address
    ),
    bandwidthName: firstDefined(record?.bandwidth_name, record?.bandwidthName, record?.properties?.bandwidth_name),
    bandwidthSize: firstDefined(record?.bandwidth_size, record?.bandwidthSize, record?.properties?.bandwidth_size),
    createdAt: firstDefined(record?.created_at, record?.createdAt, record?.create_time, record?.createTime),
    projectId: firstDefined(record?.project_id, record?.projectId, context.projectId),
    projectName: context.projectName,
    regionId: firstDefined(record?.region_id, record?.regionId, context.regionId),
    regionName: firstDefined(record?.region_name, record?.regionName, context.regionName)
  };
}

function compactResource(resource) {
  return Object.fromEntries(Object.entries(resource).filter(([, value]) => value !== undefined && value !== ""));
}

async function collectEdgeResources(vdc, projects, session) {
  const report = {};

  for (const probe of EDGE_PROBES) {
    const resourcesByKey = new Map();
    const failures = [];

    for (const resourceTypeName of probe.resourceTypeNames) {
      for (const project of projects) {
        const id = projectId(project);
        const regionFields = projectRegionFields(project);
        try {
          await delay(REQUEST_DELAY_MS);
          const records = await pagedNativeResources({
            project,
            probe,
            resourceTypeName,
            session
          });
          for (const record of records) {
            const resource = compactResource(
              pickResourceFields(record, {
                resourceTypeName,
                serviceId: probe.serviceId,
                projectId: id ? String(id) : undefined,
                projectName: projectName(project),
                ...regionFields
              })
            );
            if (resource.id) resourcesByKey.set(`${probe.key}:${resource.id}`, resource);
          }
        } catch (error) {
          failures.push({
            method: "native",
            resourceTypeName,
            projectId: id ? String(id) : undefined,
            message: error instanceof Error ? error.message : String(error || "Unknown error")
          });
        }
      }

      for (const scope of [
        { domain_id: String(vdc.domain_id || "") },
        { vdc_id: String(vdc.id || "") },
        { domain_id: String(vdc.domain_id || ""), vdc_id: String(vdc.id || "") }
      ]) {
        try {
          await delay(REQUEST_DELAY_MS);
          const records = await resourceIndexSample({
            vdc,
            resourceTypeName,
            session,
            scope
          });
          for (const record of records) {
            const resource = compactResource(
              pickResourceFields(record, {
                resourceTypeName,
                serviceId: probe.serviceId
              })
            );
            if (resource.id) resourcesByKey.set(`${probe.key}:${resource.id}`, resource);
          }
        } catch (error) {
          failures.push({
            method: "resourceIndex",
            resourceTypeName,
            scope,
            message: error instanceof Error ? error.message : String(error || "Unknown error")
          });
        }
      }
    }

    const resources = [...resourcesByKey.values()].sort((a, b) =>
      String(a.name || a.id).localeCompare(String(b.name || b.id))
    );
    report[probe.key] = {
      label: probe.label,
      count: resources.length,
      resources,
      failures
    };
  }

  return report;
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
  console.log(`[EDGE EXPOSURE] diagnosing ${tenantName}`);
  const projects = await listTenantProjects(vdc, session);
  const edgeResources = await collectEdgeResources(vdc, projects, session);

  return {
    tenant: {
      vdcId: String(vdc.id),
      domainId: vdc.domain_id ?? null,
      name: tenantName,
      projectCount: projects.length
    },
    edgeResources
  };
}

async function main() {
  console.log("[EDGE EXPOSURE] read-only diagnostic started");
  console.log("[EDGE EXPOSURE] no DB writes, no CRM push, no API response changes");

  const session = await authenticate();
  const tenants = filterTenants(await listAllVdcs({ upper_vdc_id: "0", used: "true" }));
  const results = [];

  console.log(`[EDGE EXPOSURE] tenants selected: ${tenants.length}`);

  for (const vdc of tenants) {
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

  console.log("\n================ EDGE EXPOSURE REPORT ================");
  console.log(JSON.stringify({ generatedAt: new Date().toISOString(), tenants: results }, null, 2));
  console.log("================ END EDGE EXPOSURE REPORT ================");
}

main().catch((error) => {
  console.error(`[EDGE EXPOSURE] failed: ${error instanceof Error ? error.stack || error.message : String(error || "Unknown error")}`);
  process.exitCode = 1;
});
