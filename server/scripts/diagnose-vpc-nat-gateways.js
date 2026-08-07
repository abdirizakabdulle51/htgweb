import "dotenv/config";
import { authenticate, listAllVdcs } from "../manageone.js";

const DEFAULT_MANAGEONE_BASE_URL = "https://10.20.24.9:26335/rest/vdc";
const DEFAULT_VPC_CONSOLE_BASE_URL = "https://service-hq3.htgclouds.com/vpc/rest/v2";
const REQUEST_TIMEOUT_MS = Number(process.env.MANAGEONE_TIMEOUT_MS || 30000);
const REQUEST_DELAY_MS = Number(process.env.MANAGEONE_DIAGNOSTIC_DELAY_MS || 500);
const PROJECT_PAGE_LIMIT = Number(process.env.MANAGEONE_DIAGNOSTIC_PROJECT_PAGE_LIMIT || 100);
const PROJECT_MAX_PAGES = Number(process.env.MANAGEONE_DIAGNOSTIC_PROJECT_MAX_PAGES || 20);
const TENANT_FILTER = String(process.env.MANAGEONE_DIAGNOSTIC_TENANT_FILTER || "").trim().toLowerCase();
const MAX_TENANTS = Number(process.env.MANAGEONE_DIAGNOSTIC_MAX_TENANTS || 0);
const MAX_SAMPLE_GATEWAYS = Number(process.env.MANAGEONE_DIAGNOSTIC_NAT_SAMPLE_LIMIT || 20);

const NAT_SPEC_CATALOG = {
  "1": "Small (150 Mbps)",
  "2": "Medium (600 Mbps)",
  "3": "Large (1.5 Gbps)",
  "4": "Extra-large (4 Gbps+)"
};

class HttpStatusError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "HttpStatusError";
    this.status = status;
  }
}

function stripTrailingSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

function vdcEndpointBaseUrl() {
  return stripTrailingSlash(process.env.MANAGEONE_BASE_URL || DEFAULT_MANAGEONE_BASE_URL);
}

function vpcConsoleBaseUrl() {
  return stripTrailingSlash(process.env.MANAGEONE_VPC_CONSOLE_BASE_URL || DEFAULT_VPC_CONSOLE_BASE_URL);
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "");
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

function listFromResponse(body, keys) {
  if (Array.isArray(body)) return body;

  for (const key of keys) {
    const value = body?.[key] || body?.data?.[key];
    if (Array.isArray(value)) return value;
  }

  return [];
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
      throw new Error(`Request timed out after ${REQUEST_TIMEOUT_MS}ms: ${url}`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function readJson(label, url, session) {
  const { response, text } = await fetchTextWithTimeout(url, {
    method: "GET",
    headers: {
      Accept: "application/json, text/plain, */*",
      "X-Auth-Token": session.token
    },
    redirect: "manual"
  });

  if (!response.ok) {
    throw new HttpStatusError(response.status, `${label}: HTTP ${response.status}${text ? ` ${text}` : ""}`);
  }

  return text ? JSON.parse(text) : {};
}

async function fetchProjectPage(vdc, session, start, limit) {
  const url = `${vdcEndpointBaseUrl()}/v3.1/vdcs/${encodeURIComponent(vdc.id)}/projects?start=${start}&limit=${limit}`;
  return readJson(`project/resource-space list for ${vdc.name || vdc.id}`, url, session);
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
      "unknown"
    )
  );
}

function extractProjectRegions(project) {
  const regions = Array.isArray(project?.regions) ? project.regions : [];

  return regions
    .map((region) => ({
      regionId: firstDefined(region.region_id, region.regionId, region.id),
      regionName: parseLocalizedName(firstDefined(region.region_name, region.regionName, region.name))
    }))
    .filter((region) => region.regionId || region.regionName)
    .map((region) => ({
      regionId: region.regionId ? String(region.regionId) : null,
      regionName: region.regionName ? String(region.regionName) : null
    }));
}

function primaryProjectRegion(project) {
  const regions = extractProjectRegions(project);
  return regions[0] || { regionId: null, regionName: null };
}

async function fetchNatGateways(projectIdValue, session) {
  const params = new URLSearchParams({
    sort_key: "created_at",
    sort_dir: "desc",
    enterprise_project_id: "all_granted_eps"
  });
  const url = `${vpcConsoleBaseUrl()}/${encodeURIComponent(projectIdValue)}/nat_gateways?${params}`;
  const body = await readJson(`VPC NAT gateway list for project ${projectIdValue}`, url, session);
  return {
    url,
    natGateways: listFromResponse(body, ["nat_gateways", "natGateways", "gateways"])
  };
}

function summarizeNatGateway(gateway) {
  const spec = gateway?.spec === undefined || gateway?.spec === null ? null : String(gateway.spec);
  const catalogName = spec ? NAT_SPEC_CATALOG[spec] || null : null;

  return {
    id: gateway?.id ? String(gateway.id) : null,
    name: gateway?.name ? String(gateway.name) : null,
    status: gateway?.status ? String(gateway.status) : null,
    spec,
    catalogItemName: catalogName,
    crmServiceCategory: catalogName ? "NAT" : null,
    crmItemName: catalogName,
    tenantId: gateway?.tenant_id ? String(gateway.tenant_id) : null,
    enterpriseProjectId:
      gateway?.enterprise_project_id === undefined || gateway?.enterprise_project_id === null
        ? null
        : String(gateway.enterprise_project_id),
    routerId: gateway?.router_id ? String(gateway.router_id) : null,
    internalNetworkId: gateway?.internal_network_id ? String(gateway.internal_network_id) : null,
    createdAt: gateway?.created_at ? String(gateway.created_at) : null,
    raw: {
      id: gateway?.id ?? null,
      name: gateway?.name ?? null,
      spec: gateway?.spec ?? null,
      status: gateway?.status ?? null
    }
  };
}

function filterTenants(vdcs) {
  const filtered = TENANT_FILTER
    ? vdcs.filter((vdc) =>
        `${vdc.name || ""} ${vdc.id || ""} ${vdc.domain_id || ""}`.toLowerCase().includes(TENANT_FILTER)
      )
    : vdcs;

  return MAX_TENANTS > 0 ? filtered.slice(0, MAX_TENANTS) : filtered;
}

async function inspectTenant(vdc, session) {
  console.log(`[VPC NAT DIAGNOSTIC] diagnosing ${vdc.name || vdc.id}`);

  await delay(REQUEST_DELAY_MS);
  const rawProjects = await listTenantProjects(vdc, session);
  const projects = [];

  for (const rawProject of rawProjects) {
    const id = projectId(rawProject);
    const region = primaryProjectRegion(rawProject);
    const row = {
      projectId: id,
      resourceSpaceName: projectName(rawProject),
      regionId: region.regionId,
      regionName: region.regionName,
      natGatewayCount: 0,
      natGateways: []
    };

    if (!id) {
      projects.push({ ...row, error: "Project/resource-space has no project id" });
      continue;
    }

    try {
      await delay(REQUEST_DELAY_MS);
      const result = await fetchNatGateways(id, session);
      const gateways = result.natGateways.map(summarizeNatGateway);
      projects.push({
        ...row,
        requestUrl: result.url,
        natGatewayCount: gateways.length,
        natGateways: gateways.slice(0, MAX_SAMPLE_GATEWAYS),
        omittedNatGatewaySamples: Math.max(0, gateways.length - MAX_SAMPLE_GATEWAYS)
      });
    } catch (error) {
      projects.push({
        ...row,
        error: error instanceof Error ? error.message : String(error || "Unknown error")
      });
    }
  }

  const natGateways = projects.flatMap((project) => project.natGateways || []);
  const bySpec = new Map();
  for (const gateway of natGateways) {
    const key = gateway.spec || "unknown";
    const existing = bySpec.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      bySpec.set(key, {
        spec: gateway.spec,
        catalogItemName: gateway.catalogItemName,
        count: 1
      });
    }
  }

  return {
    tenant: {
      vdcId: String(vdc.id),
      domainId: vdc.domain_id ?? null,
      name: String(vdc.name || vdc.id)
    },
    projectCount: projects.length,
    natGatewayCount: natGateways.length,
    natGatewaysBySpec: [...bySpec.values()].sort((a, b) => String(a.spec || "").localeCompare(String(b.spec || ""))),
    projects
  };
}

async function main() {
  console.log("[VPC NAT DIAGNOSTIC] read-only diagnostic started");
  console.log("[VPC NAT DIAGNOSTIC] no DB writes, no CRM push, no API response changes, no sync job changes");

  const session = await authenticate();
  const vdcs = filterTenants(await listAllVdcs({ upper_vdc_id: "0", used: "true" }));
  const results = [];

  console.log(`[VPC NAT DIAGNOSTIC] tenants selected: ${vdcs.length}`);

  for (const vdc of vdcs) {
    try {
      results.push(await inspectTenant(vdc, session));
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

  const report = {
    generatedAt: new Date().toISOString(),
    mode: "read-only",
    tenantFilter: TENANT_FILTER || null,
    tenantCount: results.length,
    tenantsWithNatGatewayCount: results.filter((row) => Number(row.natGatewayCount || 0) > 0).length,
    natGatewayCount: results.reduce((total, row) => total + Number(row.natGatewayCount || 0), 0),
    specCatalogMap: NAT_SPEC_CATALOG,
    tenants: results
  };

  console.log("================ VPC NAT GATEWAY DIAGNOSTIC ================");
  console.log(JSON.stringify(report, null, 2));
  console.log("================ END VPC NAT GATEWAY DIAGNOSTIC ================");
}

main().catch((error) => {
  console.error("[VPC NAT DIAGNOSTIC] failed", error);
  process.exitCode = 1;
});
