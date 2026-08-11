import "dotenv/config";
import { authenticate, listAllVdcs } from "../manageone.js";

const DEFAULT_MANAGEONE_BASE_URL = "https://10.20.24.9:26335/rest/vdc";
const REQUEST_TIMEOUT_MS = Number(process.env.MANAGEONE_TIMEOUT_MS || 30000);
const REQUEST_DELAY_MS = Number(process.env.MANAGEONE_QUOTA_DIAGNOSTIC_DELAY_MS || 300);
const PROJECT_PAGE_LIMIT = Number(process.env.MANAGEONE_QUOTA_DIAGNOSTIC_PROJECT_PAGE_LIMIT || 100);
const PROJECT_MAX_PAGES = Number(process.env.MANAGEONE_QUOTA_DIAGNOSTIC_PROJECT_MAX_PAGES || 20);
const TENANT_FILTER = String(process.env.MANAGEONE_QUOTA_DIAGNOSTIC_TENANT_FILTER || "")
  .trim()
  .toLowerCase();
const PROJECT_FILTER = String(process.env.MANAGEONE_QUOTA_DIAGNOSTIC_PROJECT_FILTER || "")
  .trim()
  .toLowerCase();
const MAX_TENANTS = Number(process.env.MANAGEONE_QUOTA_DIAGNOSTIC_MAX_TENANTS || 3);
const QUOTA_SERVICES = new Set(["ecs", "evs"]);

function stripTrailingSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

function vdcEndpointBaseUrl() {
  return stripTrailingSlash(process.env.MANAGEONE_BASE_URL || DEFAULT_MANAGEONE_BASE_URL);
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
  return Number.isFinite(total) ? total : fallbackTotal ?? null;
}

function shouldFetchNextPage({ reportedTotal, start, pageSize, pageResourceCount }) {
  if (reportedTotal === null || reportedTotal === undefined) {
    return pageResourceCount >= pageSize;
  }
  return start + pageSize < reportedTotal;
}

async function readManageOneJson(label, url, session) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json, text/plain, */*",
        "X-Auth-Token": session.token
      },
      redirect: "manual",
      signal: controller.signal
    });
    const text = await response.text();
    const body = text ? JSON.parse(text) : {};

    if (!response.ok) {
      throw new Error(`${label} failed: HTTP ${response.status} ${text.slice(0, 500)}`);
    }

    return body;
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`${label} timed out after ${REQUEST_TIMEOUT_MS}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
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
    const hasNextPage = shouldFetchNextPage({
      reportedTotal: total,
      start,
      pageSize: PROJECT_PAGE_LIMIT,
      pageResourceCount: pageProjects.length
    });
    start += PROJECT_PAGE_LIMIT;

    if (!hasNextPage) break;
    await delay(REQUEST_DELAY_MS);
  }

  return projects;
}

function projectId(project) {
  return firstDefined(project?.id, project?.project_id, project?.projectId);
}

function quotaUnitId(project) {
  return firstDefined(
    project?.quota_unit_id,
    project?.quotaUnitId,
    project?.quota_unit?.id,
    project?.quotaUnit?.id,
    project?.enterprise_project_id,
    project?.enterpriseProjectId
  );
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

async function fetchProjectDetails(project, session) {
  const id = projectId(project);
  if (!id) {
    return { project, failures: ["Project has no id"] };
  }

  const url = `${vdcEndpointBaseUrl()}/v3.1/projects/${encodeURIComponent(id)}`;
  try {
    const body = await readManageOneJson(`project details for ${id}`, url, session);
    return {
      project: body?.project || body,
      failures: []
    };
  } catch (error) {
    return {
      project,
      failures: [error instanceof Error ? error.message : String(error || "Unknown project detail error")]
    };
  }
}

function quotaServicesFromProjectDetails(project) {
  const regions = Array.isArray(project?.regions) ? project.regions : [];
  const services = [];

  for (const region of regions) {
    const cloudInfras = Array.isArray(region?.cloud_infras) ? region.cloud_infras : [];
    for (const cloudInfra of cloudInfras) {
      const quotas = Array.isArray(cloudInfra?.quotas) ? cloudInfra.quotas : [];
      for (const quota of quotas) {
        const serviceId = String(quota?.service_id || "");
        if (!QUOTA_SERVICES.has(serviceId.toLowerCase())) continue;

        services.push({
          service_id: serviceId,
          service_name: quota.service_name,
          quotas: listFromResponse(quota, ["resources"]).map((resource) => ({
            region_id: region.region_id,
            region_name: region.name || region.region_name,
            cloud_infra_id: cloudInfra.cloud_infra_id,
            cloud_infra_name: cloudInfra.name || cloudInfra.cloud_infra_name,
            az_id: resource.az_id,
            parent_id: resource.parent_id,
            resource_id: resource.resource,
            resource_name: resource.resource_name,
            unit: resource.unit,
            quota_limit: resource.local_limit,
            quota_used: resource.local_used
          }))
        });
      }
    }
  }

  return services;
}

async function fetchQuotaUnitQuotas(project, session) {
  const id = quotaUnitId(project);
  if (!id) {
    return { services: [], failures: ["Project has no quota_unit_id"] };
  }

  const baseUrl = `${vdcEndpointBaseUrl()}/v3.2/enterprise-projects/${encodeURIComponent(id)}/quotas`;
  const candidateUrls = [baseUrl, `${baseUrl}?start=0`, `${baseUrl}?start=1`];
  const failures = [];

  for (const url of candidateUrls) {
    try {
      const body = await readManageOneJson(`quotas for project ${id}`, url, session);
      return {
        services: listFromResponse(body, ["services"]),
        failures: []
      };
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error || "Unknown quota error"));
    }
  }

  return {
    services: [],
    failures
  };
}

async function fetchProjectQuotas(project, session) {
  const detailResult = await fetchProjectDetails(project, session);
  const detailedProject = detailResult.project;
  const nestedServices = quotaServicesFromProjectDetails(detailedProject);
  if (nestedServices.length > 0) {
    return {
      quotaUnitId: quotaUnitId(detailedProject),
      source: "project_details",
      services: nestedServices,
      failures: detailResult.failures
    };
  }

  const quotaUnitResult = await fetchQuotaUnitQuotas(detailedProject, session);
  return {
    quotaUnitId: quotaUnitId(detailedProject),
    source: "quota_unit",
    services: quotaUnitResult.services,
    failures: [...detailResult.failures, ...quotaUnitResult.failures]
  };
}

function normalizeQuotaServices(services) {
  return services
    .filter((service) => QUOTA_SERVICES.has(String(service?.service_id || "").toLowerCase()))
    .map((service) => ({
      serviceId: String(service.service_id || ""),
      serviceName: service.service_name,
      quotas: listFromResponse(service, ["quotas"]).map((quota) => ({
        regionId: quota.region_id,
        regionName: quota.region_name,
        cloudInfraId: quota.cloud_infra_id,
        azId: quota.az_id,
        parentId: quota.parent_id,
        resourceId: quota.resource_id,
        resourceName: quota.resource_name,
        unit: quota.unit,
        limit: quota.quota_limit,
        used: quota.quota_used,
        remaining:
          Number(quota.quota_limit) === -1
            ? -1
            : Number(quota.quota_limit ?? 0) - Number(quota.quota_used ?? 0)
      }))
    }));
}

function filterTenants(vdcs) {
  const filtered = TENANT_FILTER
    ? vdcs.filter((vdc) => String(vdc.name || "").toLowerCase().includes(TENANT_FILTER))
    : vdcs;

  return filtered.slice(0, Math.max(1, MAX_TENANTS));
}

function filterProjects(projects) {
  if (!PROJECT_FILTER) return projects;
  return projects.filter((project) => projectName(project).toLowerCase().includes(PROJECT_FILTER));
}

async function main() {
  const session = await authenticate();
  const vdcs = filterTenants(await listAllVdcs({ upper_vdc_id: "0", used: "true" }));

  const report = {
    generatedAt: new Date().toISOString(),
    tenantFilter: TENANT_FILTER || null,
    projectFilter: PROJECT_FILTER || null,
    tenants: []
  };

  for (const vdc of vdcs) {
    console.log(`[MANAGEONE QUOTA] probing tenant: ${vdc.name || vdc.id}`);
    const projects = filterProjects(await listTenantProjects(vdc, session));
    const tenantReport = {
      tenant: {
        vdcId: vdc.id,
        domainId: vdc.domain_id,
        name: vdc.name,
        projectCount: projects.length
      },
      projects: []
    };

    for (const project of projects) {
      const quotas = await fetchProjectQuotas(project, session);
      tenantReport.projects.push({
        id: projectId(project),
        name: projectName(project),
        quotaUnitId: quotas.quotaUnitId,
        quotaSource: quotas.source,
        quotaServices: normalizeQuotaServices(quotas.services),
        failures: quotas.failures
      });
      await delay(REQUEST_DELAY_MS);
    }

    report.tenants.push(tenantReport);
  }

  console.log("================ TENANT QUOTA REPORT ================");
  console.log(JSON.stringify(report, null, 2));
  console.log("================ END TENANT QUOTA REPORT ================");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
