import "dotenv/config";
import { authenticate, listAllVdcs } from "../manageone.js";

const DEFAULT_MANAGEONE_BASE_URL = "https://10.20.24.9:26335/rest/vdc";
const REQUEST_TIMEOUT_MS = Number(process.env.MANAGEONE_TIMEOUT_MS || 30000);
const REQUEST_DELAY_MS = Number(process.env.MANAGEONE_DIAGNOSTIC_DELAY_MS || 500);
const PROJECT_PAGE_LIMIT = Number(process.env.MANAGEONE_DIAGNOSTIC_PROJECT_PAGE_LIMIT || 100);
const PROJECT_MAX_PAGES = Number(process.env.MANAGEONE_DIAGNOSTIC_PROJECT_MAX_PAGES || 20);
const TENANT_FILTER = String(process.env.MANAGEONE_DIAGNOSTIC_TENANT_FILTER || "").trim().toLowerCase();
const MAX_TENANTS = Number(process.env.MANAGEONE_DIAGNOSTIC_MAX_TENANTS || 0);

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

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
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
    throw new HttpStatusError(response.status, `${label}: HTTP ${response.status}${text ? ` ${text}` : ""}`);
  }

  return text ? JSON.parse(text) : {};
}

async function fetchTenantDetail(vdc, session) {
  const url = `${vdcEndpointBaseUrl()}/v3.0/vdcs/${encodeURIComponent(vdc.id)}`;
  return readManageOneJson(`tenant detail for ${vdc.name || vdc.id}`, url, session);
}

function extractTenantRegions(detail) {
  const body = detail?.vdc || detail?.VDC || detail;
  const regions = Array.isArray(body?.regions) ? body.regions : [];

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

async function fetchProjectPage(vdc, session, start, limit) {
  const url = `${vdcEndpointBaseUrl()}/v3.1/vdcs/${encodeURIComponent(vdc.id)}/projects?start=${start}&limit=${limit}`;
  return readManageOneJson(`project/resource-space list for ${vdc.name || vdc.id}`, url, session);
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

function uniqueRegions(projects, tenantRegions) {
  const byKey = new Map();

  for (const region of tenantRegions) {
    const key = `${region.regionId || ""}|${region.regionName || ""}`;
    byKey.set(key, { ...region, source: "tenant" });
  }

  for (const project of projects) {
    for (const region of project.regions) {
      const key = `${region.regionId || ""}|${region.regionName || ""}`;
      byKey.set(key, { ...region, source: byKey.has(key) ? byKey.get(key).source : "resource-space" });
    }
  }

  return [...byKey.values()];
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
  console.log(`[RESOURCE SPACE REGIONS] diagnosing ${vdc.name || vdc.id}`);

  let tenantRegions = [];
  let tenantRegionError = null;
  try {
    await delay(REQUEST_DELAY_MS);
    tenantRegions = extractTenantRegions(await fetchTenantDetail(vdc, session));
  } catch (error) {
    tenantRegionError = error instanceof Error ? error.message : String(error || "Unknown error");
  }

  await delay(REQUEST_DELAY_MS);
  const rawProjects = await listTenantProjects(vdc, session);
  const projects = rawProjects.map((project) => ({
    projectId: String(firstDefined(project?.id, project?.project_id, "")),
    resourceSpaceName: projectName(project),
    tenantName: firstDefined(project?.tenant_name, project?.tenantName) ?? null,
    domainId: firstDefined(project?.domain_id, project?.domainId, vdc.domain_id) ?? null,
    tenantId: firstDefined(project?.tenant_id, project?.tenantId) ?? null,
    regions: extractProjectRegions(project)
  }));
  const regions = uniqueRegions(projects, tenantRegions);
  const resourceSpaceRegionCount = new Set(
    projects.flatMap((project) => project.regions.map((region) => `${region.regionId || ""}|${region.regionName || ""}`))
  ).size;

  return {
    tenant: {
      vdcId: String(vdc.id),
      domainId: vdc.domain_id ?? null,
      name: String(vdc.name || vdc.id),
      tenantRegions,
      ...(tenantRegionError ? { tenantRegionError } : {})
    },
    projectCount: projects.length,
    resourceSpaceRegionCount,
    hasMixedResourceSpaceRegions: resourceSpaceRegionCount > 1,
    regions,
    projects
  };
}

function buildMixedRegionSummary(results) {
  return results
    .filter((row) => row.hasMixedResourceSpaceRegions)
    .map((row) => ({
      tenantName: row.tenant?.name,
      vdcId: row.tenant?.vdcId,
      resourceSpaceRegionCount: row.resourceSpaceRegionCount,
      regions: row.regions,
      resourceSpaces: row.projects.map((project) => ({
        name: project.resourceSpaceName,
        projectId: project.projectId,
        regions: project.regions
      }))
    }));
}

async function main() {
  console.log("[RESOURCE SPACE REGIONS] read-only diagnostic started");
  console.log("[RESOURCE SPACE REGIONS] no DB writes, no CRM push, no sync job changes");

  const session = await authenticate();
  const vdcs = filterTenants(await listAllVdcs({ upper_vdc_id: "0", used: "true" }));
  const results = [];

  console.log(`[RESOURCE SPACE REGIONS] tenants selected: ${vdcs.length}`);

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

  const mixedRegionTenants = buildMixedRegionSummary(results);
  console.log(`[RESOURCE SPACE REGIONS] mixed-region tenant(s): ${mixedRegionTenants.length}`);

  console.log("\n================ RESOURCE SPACE REGION REPORT ================");
  console.log(
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        tenantCount: results.length,
        mixedRegionTenantCount: mixedRegionTenants.length,
        mixedRegionTenants,
        tenants: results
      },
      null,
      2
    )
  );
  console.log("================ END RESOURCE SPACE REGION REPORT ================");
}

main().catch((error) => {
  console.error("[RESOURCE SPACE REGIONS] failed:", error);
  process.exitCode = 1;
});
