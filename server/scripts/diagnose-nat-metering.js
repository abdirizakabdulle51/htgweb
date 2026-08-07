import "dotenv/config";
import { authenticate, listAllVdcs } from "../manageone.js";

const DEFAULT_MANAGEONE_BASE_URL = "https://10.20.24.9:26335/rest/vdc";
const REQUEST_TIMEOUT_MS = Number(process.env.MANAGEONE_TIMEOUT_MS || 30000);
const REQUEST_DELAY_MS = Number(process.env.MANAGEONE_DIAGNOSTIC_DELAY_MS || 500);
const PROJECT_PAGE_LIMIT = Number(process.env.MANAGEONE_DIAGNOSTIC_PROJECT_PAGE_LIMIT || 100);
const PROJECT_MAX_PAGES = Number(process.env.MANAGEONE_DIAGNOSTIC_PROJECT_MAX_PAGES || 20);
const TENANT_FILTER = String(process.env.MANAGEONE_DIAGNOSTIC_TENANT_FILTER || "").trim().toLowerCase();
const MAX_TENANTS = Number(process.env.MANAGEONE_DIAGNOSTIC_MAX_TENANTS || 0);
const NAT_RESOURCE_TYPE = "hws.resource.type.natgateway";
const DEFAULT_TIME_ZONE = process.env.MANAGEONE_METERING_TIME_ZONE || "Asia/Shanghai";
const DEFAULT_LOCALE = process.env.MANAGEONE_METERING_LOCALE || "en_US";
const DEFAULT_PERIOD = process.env.MANAGEONE_METERING_PERIOD || "hourly";
const SAMPLE_LIMIT = Number(process.env.MANAGEONE_DIAGNOSTIC_NAT_SAMPLE_LIMIT || 20);

const NAT_SPEC_CATALOG = {
  "1": "Small (150 Mbps)",
  "2": "Medium (600 Mbps)",
  "3": "Large (1.5 Gbps)",
  "4": "Extra-large (4 Gbps+)"
};

function stripTrailingSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

function manageOneRootUrl() {
  return stripTrailingSlash(process.env.MANAGEONE_BASE_URL || DEFAULT_MANAGEONE_BASE_URL).replace(/\/rest\/vdc$/, "");
}

function vdcEndpointBaseUrl() {
  return stripTrailingSlash(process.env.MANAGEONE_BASE_URL || DEFAULT_MANAGEONE_BASE_URL);
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

function localizedString(value) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object") {
        return localizedString(parsed);
      }
    } catch {
      return value;
    }

    return value;
  }
  if (typeof value === "object") {
    return (
      value.en_us ||
      value.en_US ||
      value["en-us"] ||
      value.zh_cn ||
      value.zh_CN ||
      value.name ||
      value.id ||
      null
    );
  }

  return String(value);
}

function addCandidate(candidates, value, source) {
  const candidate = localizedString(value);
  if (!candidate) return;
  if (candidates.some((item) => item.value === candidate)) return;
  candidates.push({ value: candidate, source });
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

function safeSnippet(value, limit = 320) {
  const compact = String(value || "")
    .replace(/\s+/g, " ")
    .trim();
  return compact ? `${compact.slice(0, limit)}${compact.length > limit ? "..." : ""}` : "";
}

function defaultMeteringWindow() {
  const end = new Date();
  const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
  return {
    startTime: process.env.MANAGEONE_METERING_START_TIME || formatDateTime(start),
    endTime: process.env.MANAGEONE_METERING_END_TIME || formatDateTime(end)
  };
}

function formatDateTime(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return [
    date.getUTCFullYear(),
    "-",
    pad(date.getUTCMonth() + 1),
    "-",
    pad(date.getUTCDate()),
    " ",
    pad(date.getUTCHours()),
    ":",
    pad(date.getUTCMinutes()),
    ":",
    pad(date.getUTCSeconds())
  ].join("");
}

function summarizeNatRecord(record) {
  const resourceTypeCode = firstDefined(
    record?.resource_type_code,
    record?.resource_type,
    record?.resourceTypeCode,
    record?.resourceType
  );
  const resourceSpecCode = String(
    firstDefined(record?.resource_spec_code, record?.resource_spec, record?.spec, record?.resourceSpecCode) || ""
  );

  return {
    id: firstDefined(record?.resource_id, record?.id, record?.nativeId, record?.resId) ?? null,
    name:
      firstDefined(
        record?.resource_display_name,
        record?.resource_name,
        record?.name,
        record?.resourceName,
        record?.deviceName
      ) ?? null,
    resourceTypeCode: resourceTypeCode ?? null,
    resourceSpecCode: resourceSpecCode || null,
    catalogItemName: NAT_SPEC_CATALOG[resourceSpecCode] || null,
    status: firstDefined(record?.status, record?.resource_status, record?.state) ?? null,
    regionId: firstDefined(record?.region_id, record?.region_code, record?.regionId, record?.regionCode) ?? null,
    regionName: firstDefined(record?.region_name, record?.regionName) ?? null,
    vdcId: firstDefined(record?.vdc_id, record?.vdcId) ?? null,
    domainId: firstDefined(record?.domain_id, record?.domainId) ?? null,
    enterpriseProjectId: firstDefined(record?.enterprise_project_id, record?.enterpriseProjectId) ?? null,
    usageValue: firstDefined(record?.usage_value, record?.usageValue) ?? null,
    usageDuration: firstDefined(record?.usage_duration, record?.usageDuration) ?? null,
    price: firstDefined(record?.price, record?.fee, record?.amount) ?? null,
    priceUnit: firstDefined(record?.price_unit, record?.priceUnit, record?.unit) ?? null
  };
}

function summarizeNatRecords(records) {
  const natRecords = records.filter((record) => {
    const haystack = [
      record?.resource_type_code,
      record?.resource_type,
      record?.resourceTypeCode,
      record?.resourceType,
      record?.resource_type_name,
      record?.resourceTypeName,
      record?.resource_display_name,
      record?.resource_name,
      record?.name
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes("natgateway") || haystack.includes("nat gateway") || haystack.includes("nat_");
  });

  return {
    recordCount: records.length,
    natRecordCount: natRecords.length,
    samples: natRecords.slice(0, SAMPLE_LIMIT).map(summarizeNatRecord)
  };
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
    throw new Error(`${label}: HTTP ${response.status}${text ? ` ${safeSnippet(text)}` : ""}`);
  }

  return parseJsonResponse(label, response, text);
}

async function postJson(label, url, body, session) {
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
    throw new Error(`${label}: HTTP ${response.status}${text ? ` ${safeSnippet(text)}` : ""}`);
  }

  return parseJsonResponse(label, response, text);
}

function parseJsonResponse(label, response, text) {
  const contentType = response.headers.get("content-type") || "";
  if (text && !contentType.toLowerCase().includes("json")) {
    throw new Error(`${label}: expected JSON but got ${contentType || "unknown content-type"} ${safeSnippet(text)}`);
  }

  try {
    return text ? JSON.parse(text) : {};
  } catch (error) {
    throw new Error(
      `${label}: invalid JSON response (${error instanceof Error ? error.message : String(error)}) ${safeSnippet(text)}`
    );
  }
}

async function fetchTenantRegion(vdc, session) {
  const url = `${vdcEndpointBaseUrl()}/v3.0/vdcs/${encodeURIComponent(vdc.id)}`;
  const detail = await readJson(`tenant region for ${vdc.name || vdc.id}`, url, session);
  return extractTenantRegion(detail);
}

function extractTenantRegion(detail) {
  const region = firstDefined(
    detail?.region,
    detail?.regions?.[0],
    detail?.vdc?.region,
    detail?.vdc?.regions?.[0],
    detail?.data?.region,
    detail?.data?.regions?.[0]
  );
  if (!region) return null;

  return {
    regionId: localizedString(firstDefined(region?.id, region?.region_id, region?.regionId, region?.code)),
    regionName: localizedString(firstDefined(region?.name, region?.region_name, region?.regionName, region?.displayName))
  };
}

async function fetchProjectPage(vdc, session, start, limit) {
  const url = `${vdcEndpointBaseUrl()}/v3.1/vdcs/${encodeURIComponent(vdc.id)}/projects?start=${start}&limit=${limit}`;
  return readJson(`project list for ${vdc.name || vdc.id}`, url, session);
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

async function fetchResourceTypes(regionId, session) {
  const params = new URLSearchParams({
    region_id: String(regionId),
    start: "0",
    limit: "1000"
  });
  const body = await readJson(
    `metering resource types for ${regionId}`,
    `${meteringEndpointBaseUrl()}/v3.0/resource-types?${params}`,
    session
  );
  const records = listFromResponse(body, ["resource_types", "resourceTypes"]);
  return {
    total: responseTotal(body),
    ...summarizeNatRecords(records)
  };
}

async function fetchBillingItems(regionId, session, includeIsActive = true) {
  const params = new URLSearchParams({
    region_id: String(regionId),
    resource_type_code: NAT_RESOURCE_TYPE,
    time_zone: DEFAULT_TIME_ZONE,
    start: "0",
    limit: "1000"
  });
  if (includeIsActive) {
    params.set("is_active", "true");
  }
  const body = await readJson(
    `NAT billing items${includeIsActive ? "" : " without is_active"} for ${regionId}`,
    `${meteringEndpointBaseUrl()}/v3.0/billing-items?${params}`,
    session
  );
  const records = listFromResponse(body, ["billing_items", "billingItems"]);
  return {
    total: responseTotal(body),
    recordCount: records.length,
    samples: records.slice(0, SAMPLE_LIMIT).map((record) => ({
      id: record?.id ?? null,
      name: firstDefined(record?.name, record?.display_name, record?.displayName) ?? null,
      resourceTypeCode: record?.resource_type_code ?? null,
      monthlyPrice: firstDefined(record?.cur_rate_value_month, record?.rate_value_month, record?.plan_rate_value_month) ?? null,
      hourlyPrice: firstDefined(record?.cur_rate_value_hour, record?.rate_value_hour, record?.plan_rate_value_hour) ?? null,
      unitId: firstDefined(record?.cur_unit_id, record?.unit_id, record?.plan_unit_id) ?? null,
      unitOptions: Array.isArray(record?.unit_options) ? record.unit_options.slice(0, 5) : []
    }))
  };
}

async function fetchMeteringUnitResources(vdc, regionId, session) {
  const body = await postJson(
    `NAT metering-unit resources for ${vdc.name || vdc.id}`,
    `${meteringEndpointBaseUrl()}/v3.0/metering-unit/resources`,
    {
      resource_type: NAT_RESOURCE_TYPE,
      region_code: String(regionId),
      vdc_id: String(vdc.id || ""),
      domain_id: String(vdc.domain_id || ""),
      start: 0,
      limit: 1000
    },
    session
  );
  return summarizeNatRecords(listFromResponse(body, ["resources", "resource_list"]));
}

async function fetchResourceInstances(vdc, regionId, session, scope = {}) {
  const { startTime, endTime } = defaultMeteringWindow();
  const requestBody = {
    region_code: String(regionId),
    start_time: startTime,
    end_time: endTime,
    time_zone: DEFAULT_TIME_ZONE,
    domain_id: String(vdc.domain_id || ""),
    vdc_id: String(vdc.id || ""),
    resource_type_code: [NAT_RESOURCE_TYPE],
    limit: 1000
  };
  if (scope.projectId) {
    requestBody.project_id = [String(scope.projectId)];
  }

  const body = await postJson(
    `NAT resource instances for ${vdc.name || vdc.id}${scope.label ? ` ${scope.label}` : ""}`,
    `${meteringEndpointBaseUrl()}/v3.0/list-resource-instances`,
    requestBody,
    session
  );
  return {
    window: { startTime, endTime, timeZone: DEFAULT_TIME_ZONE },
    request: {
      regionCode: regionId,
      vdcId: requestBody.vdc_id,
      projectIds: requestBody.project_id || null,
      resourceTypeCode: requestBody.resource_type_code
    },
    ...summarizeNatRecords(listFromResponse(body, ["resources", "resource_instances", "resourceInstances"]))
  };
}

async function fetchMetricsData(vdc, regionId, session, scope = {}) {
  const { startTime, endTime } = defaultMeteringWindow();
  const requestBody = {
    region_code: String(regionId),
    start_time: startTime,
    end_time: endTime,
    time_zone: DEFAULT_TIME_ZONE,
    period: DEFAULT_PERIOD,
    locale: DEFAULT_LOCALE,
    domain_id: String(vdc.domain_id || ""),
    vdc_id: String(vdc.id || ""),
    cloud_service_type_code: "vpc",
    resource_type_code: NAT_RESOURCE_TYPE,
    limit: 1000
  };
  if (Array.isArray(scope.resourceIds) && scope.resourceIds.length > 0) {
    requestBody.resource_id = scope.resourceIds.map(String);
  }

  const body = await postJson(
    `NAT metrics data for ${vdc.name || vdc.id}${scope.label ? ` ${scope.label}` : ""}`,
    `${meteringEndpointBaseUrl()}/v3.0/query-metrics-data`,
    requestBody,
    session
  );
  return {
    window: { startTime, endTime, timeZone: DEFAULT_TIME_ZONE, period: DEFAULT_PERIOD },
    request: {
      regionCode: regionId,
      vdcId: requestBody.vdc_id,
      cloudServiceTypeCode: requestBody.cloud_service_type_code,
      resourceTypeCode: requestBody.resource_type_code,
      resourceIds: requestBody.resource_id || null
    },
    ...summarizeNatRecords(listFromResponse(body, ["metrics", "metrics_data", "metric_data", "resources", "datas"]))
  };
}

async function safeProbe(fn) {
  try {
    return await fn();
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error || "Unknown error")
    };
  }
}

function projectSummary(project) {
  return {
    id: firstDefined(project?.id, project?.project_id, project?.projectId) ?? null,
    name: firstDefined(project?.name, project?.project_name, project?.projectName) ?? null,
    regionId: localizedString(firstDefined(project?.region_id, project?.regionId)) ?? null,
    regionName: localizedString(firstDefined(project?.region_name, project?.regionName)) ?? null
  };
}

function buildRegionCandidates(vdc, region, projects) {
  const candidates = [];
  const envCandidates = String(process.env.MANAGEONE_DIAGNOSTIC_REGION_CODES || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  for (const envCandidate of envCandidates) {
    addCandidate(candidates, envCandidate, "MANAGEONE_DIAGNOSTIC_REGION_CODES");
  }

  addCandidate(candidates, region?.regionId, "tenant.regionId");
  addCandidate(candidates, region?.regionName, "tenant.regionName");
  addCandidate(candidates, vdc.regionId, "vdc.regionId");
  addCandidate(candidates, vdc.regionName, "vdc.regionName");

  if (Array.isArray(projects)) {
    for (const project of projects) {
      const name = localizedString(firstDefined(project?.name, project?.project_name, project?.projectName));
      addCandidate(candidates, firstDefined(project?.region_id, project?.regionId), `project.regionId:${name || "unknown"}`);
      addCandidate(candidates, firstDefined(project?.region_name, project?.regionName), `project.regionName:${name || "unknown"}`);
      addCandidate(candidates, name, `project.name:${name || "unknown"}`);
    }
  }

  return candidates;
}

async function probeRegion(vdc, regionCandidate, session) {
  const regionCode = regionCandidate.value;
  const probes = {
    source: regionCandidate.source,
    resourceTypes: await safeProbe(() => fetchResourceTypes(regionCode, session))
  };

  await delay(REQUEST_DELAY_MS);
  probes.billingItems = await safeProbe(() => fetchBillingItems(regionCode, session, true));
  await delay(REQUEST_DELAY_MS);
  probes.billingItemsWithoutIsActive = await safeProbe(() => fetchBillingItems(regionCode, session, false));
  await delay(REQUEST_DELAY_MS);
  probes.meteringUnitResources = await safeProbe(() => fetchMeteringUnitResources(vdc, regionCode, session));
  await delay(REQUEST_DELAY_MS);
  probes.listResourceInstances = await safeProbe(() => fetchResourceInstances(vdc, regionCode, session, { label: "vdc-scope" }));
  await delay(REQUEST_DELAY_MS);
  probes.queryMetricsData = await safeProbe(() => fetchMetricsData(vdc, regionCode, session, { label: "vdc-scope" }));

  return probes;
}

async function probeProjectRegion(vdc, project, session) {
  const projectId = firstDefined(project?.id, project?.project_id, project?.projectId);
  const projectName = localizedString(firstDefined(project?.name, project?.project_name, project?.projectName));
  const projectRegionCandidates = [];
  addCandidate(projectRegionCandidates, project?.region_id ?? project?.regionId, `project.regionId:${projectName || projectId}`);
  addCandidate(projectRegionCandidates, project?.region_name ?? project?.regionName, `project.regionName:${projectName || projectId}`);
  addCandidate(projectRegionCandidates, projectName, `project.name:${projectName || projectId}`);

  const probesByRegion = {};
  for (const candidate of projectRegionCandidates) {
    console.log(
      `[NAT METERING] trying project candidate for ${vdc.name || vdc.id}: ${projectName || projectId} / ${
        candidate.value
      } (${candidate.source})`
    );
    probesByRegion[candidate.value] = {
      source: candidate.source,
      listResourceInstances: await safeProbe(() =>
        fetchResourceInstances(vdc, candidate.value, session, {
          label: `project-scope ${projectName || projectId}`,
          projectId
        })
      )
    };
    await delay(REQUEST_DELAY_MS);
    probesByRegion[candidate.value].queryMetricsData = await safeProbe(() =>
      fetchMetricsData(vdc, candidate.value, session, {
        label: `project-scope ${projectName || projectId}`
      })
    );
    await delay(REQUEST_DELAY_MS);
  }

  return {
    project: projectSummary(project),
    probesByRegion
  };
}

async function diagnoseTenant(vdc, session) {
  console.log(`[NAT METERING] diagnosing ${vdc.name || vdc.id}`);

  const region = await safeProbe(() => fetchTenantRegion(vdc, session));
  const projects = await safeProbe(() => listTenantProjects(vdc, session));
  const regionCandidates = buildRegionCandidates(vdc, region, projects);

  const probesByRegion = {};
  for (const candidate of regionCandidates) {
    console.log(`[NAT METERING] trying region candidate for ${vdc.name || vdc.id}: ${candidate.value} (${candidate.source})`);
    probesByRegion[candidate.value] = await probeRegion(vdc, candidate, session);
    await delay(REQUEST_DELAY_MS);
  }

  const projectProbes = [];
  if (Array.isArray(projects)) {
    for (const project of projects) {
      projectProbes.push(await probeProjectRegion(vdc, project, session));
      await delay(REQUEST_DELAY_MS);
    }
  }

  return {
    tenant: {
      vdcId: String(vdc.id),
      domainId: vdc.domain_id ?? null,
      name: String(vdc.name || vdc.id),
      regionId: region?.regionId ?? vdc.regionId ?? null,
      regionName: region?.regionName ?? null
    },
    projects: Array.isArray(projects) ? projects.map(projectSummary) : projects,
    regionCandidates,
    probesByRegion,
    projectProbes
  };
}

async function main() {
  console.log("[NAT METERING] read-only diagnostic started");
  console.log("[NAT METERING] no DB writes, no CRM push, no sync changes");
  console.log(`[NAT METERING] resource type: ${NAT_RESOURCE_TYPE}`);

  const session = await authenticate();
  let vdcs = await listAllVdcs();

  if (TENANT_FILTER) {
    vdcs = vdcs.filter((vdc) => String(vdc.name || "").toLowerCase().includes(TENANT_FILTER));
  }
  if (MAX_TENANTS > 0) {
    vdcs = vdcs.slice(0, MAX_TENANTS);
  }

  console.log(`[NAT METERING] tenants selected: ${vdcs.length}`);

  const tenants = [];
  for (const vdc of vdcs) {
    tenants.push(await diagnoseTenant(vdc, session));
    await delay(REQUEST_DELAY_MS);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    manageOneRootUrl: manageOneRootUrl(),
    meteringBaseUrl: meteringEndpointBaseUrl(),
    tenantFilter: TENANT_FILTER || null,
    tenantCount: tenants.length,
    natResourceType: NAT_RESOURCE_TYPE,
    tenants
  };

  console.log("================ NAT METERING DIAGNOSTIC ================");
  console.log(JSON.stringify(report, null, 2));
  console.log("================ END NAT METERING DIAGNOSTIC ================");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error || "Unknown error");
  console.error(`[NAT METERING] failed: ${message}`);
  process.exitCode = 1;
});
