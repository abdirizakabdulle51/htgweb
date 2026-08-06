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

async function fetchNativeResourcePage({ vdc, projectId, serviceId, resourceTypeName, session, start, limit }) {
  const params = new URLSearchParams({
    service_id: serviceId,
    resource_type_name: resourceTypeName,
    project_id: projectId,
    start: String(start),
    limit: String(limit)
  });
  const url = `${resourceEndpointBaseUrl()}/v3.0/native/resources?${params}`;
  return readManageOneJson(
    `${serviceId}/${resourceTypeName} native resources for ${vdc.name || vdc.id} project ${projectId}`,
    url,
    session
  );
}

async function fetchProjectNativeResources({ vdc, projectId, serviceId, resourceTypeName, session }) {
  const responses = [];
  let start = 0;
  let page = 0;
  let hasNextPage = true;

  while (hasNextPage) {
    page += 1;
    if (page > NATIVE_RESOURCE_MAX_PAGES) {
      throw new Error(
        `${serviceId}/${resourceTypeName} pagination exceeded ${NATIVE_RESOURCE_MAX_PAGES} page(s) for ${vdc.name || vdc.id} project ${projectId}`
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
    const reportedTotal = responseTotal(body);
    hasNextPage = shouldFetchNextNativePage({
      reportedTotal,
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

function bandwidthTierName(sizeMbps) {
  if (sizeMbps >= 1 && sizeMbps <= 5) return "1 - 5 Mbps";
  if (sizeMbps >= 6 && sizeMbps <= 50) return "6 - 50 Mbps";
  if (sizeMbps >= 51 && sizeMbps <= 200) return "51 - 200 Mbps";
  return null;
}

function parseBandwidthSize(record) {
  const properties = record?.properties || {};
  return numberOrNull(
    firstDefined(
      properties.bandwidth_size,
      properties.bandwidthSize,
      properties.bandwidth,
      properties.size,
      record?.bandwidth_size,
      record?.bandwidthSize,
      record?.bandwidth,
      record?.size
    )
  );
}

function aggregateEipBandwidthBreakdown(records) {
  const tiersByName = new Map();

  for (const resource of records) {
    const sizeMbps = parseBandwidthSize(resource);
    if (sizeMbps === null || sizeMbps <= 0) continue;

    const tierName = bandwidthTierName(sizeMbps);
    if (!tierName) continue;

    const existing = tiersByName.get(tierName);
    if (existing) {
      existing.count += 1;
      existing.totalMbps += sizeMbps;
    } else {
      tiersByName.set(tierName, {
        tierName,
        count: 1,
        totalMbps: sizeMbps
      });
    }
  }

  return [...tiersByName.values()].sort((a, b) => a.tierName.localeCompare(b.tierName));
}

function addLine(lines, base) {
  if (!base.quantity || base.quantity <= 0) return;
  lines.push(base);
}

function linesForProject(project, region, ecsFlavors, evsVolumeTypes, eipBandwidths) {
  const lines = [];

  for (const item of ecsFlavors) {
    addLine(lines, {
      serviceCategory: String(item.flavorName).toLowerCase().startsWith("s2.") ? "ECS-CCE" : "ECS",
      catalogItemName: item.flavorName,
      quantity: item.count,
      source: "project-native-ecs",
      ...region
    });
  }

  if (evsVolumeTypes.length > 0) {
    addLine(lines, {
      serviceCategory: "EVS",
      catalogItemName: "EVS - Disk Managed Fee",
      quantity: evsVolumeTypes.reduce((total, item) => total + item.count, 0),
      source: "project-native-evs-record-count",
      ...region
    });
  }

  for (const item of evsVolumeTypes) {
    addLine(lines, {
      serviceCategory: "EVS",
      catalogItemName:
        item.volumeType.toLowerCase() === "sata" ? "SATA (Object / Cold Storage)" : "SSD (Block Storage / NVMe)",
      quantity: item.totalGb,
      source: "project-native-evs-gb",
      volumeType: item.volumeType,
      diskCount: item.count,
      ...region
    });
  }

  for (const item of eipBandwidths) {
    addLine(lines, {
      serviceCategory: "EIP",
      catalogItemName: `EIP Bandwidth - ${item.tierName}`,
      quantity: item.count,
      totalMbps: item.totalMbps,
      source: "project-native-bandwidth",
      ...region
    });
  }

  return lines.map((line) => ({
    ...line,
    resourceSpaceName: project.resourceSpaceName,
    projectId: project.projectId
  }));
}

function regionFromProject(project) {
  const region = project.regions[0] || {};
  return {
    regionId: region.regionId ?? null,
    regionName: region.regionName ?? null
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
  console.log(`[RESOURCE SPACE PAYLOAD PREVIEW] diagnosing ${vdc.name || vdc.id}`);

  await delay(REQUEST_DELAY_MS);
  const rawProjects = await listTenantProjects(vdc, session);
  const projects = [];
  const crmPreviewLineItems = [];

  for (const rawProject of rawProjects) {
    const id = projectId(rawProject);
    if (!id) continue;

    const project = {
      projectId: id,
      resourceSpaceName: projectName(rawProject),
      regions: extractProjectRegions(rawProject)
    };
    const region = regionFromProject(project);

    await delay(REQUEST_DELAY_MS);
    const ecsRecords = recordsFromResponses(
      await fetchProjectNativeResources({
        vdc,
        projectId: id,
        serviceId: "ecs",
        resourceTypeName: "CLOUD_ECS_INSTANCE",
        session
      })
    );

    await delay(REQUEST_DELAY_MS);
    const evsRecords = recordsFromResponses(
      await fetchProjectNativeResources({
        vdc,
        projectId: id,
        serviceId: "evs",
        resourceTypeName: "CLOUD_EVS_INSTANCE",
        session
      })
    );

    await delay(REQUEST_DELAY_MS);
    const bandwidthRecords = recordsFromResponses(
      await fetchProjectNativeResources({
        vdc,
        projectId: id,
        serviceId: "vpc",
        resourceTypeName: "CLOUD_BANDWIDTHS",
        session
      })
    );

    const ecsFlavors = aggregateEcsFlavorBreakdown(ecsRecords);
    const evsVolumeTypes = aggregateEvsVolumeTypeBreakdown(evsRecords);
    const eipBandwidths = aggregateEipBandwidthBreakdown(bandwidthRecords);
    const lineItems = linesForProject(project, region, ecsFlavors, evsVolumeTypes, eipBandwidths);

    projects.push({
      ...project,
      region,
      recordCounts: {
        ecs: ecsRecords.length,
        evs: evsRecords.length,
        eipBandwidth: bandwidthRecords.length
      },
      ecsFlavors,
      evsVolumeTypes,
      evsDiskManagedFeeCount: evsRecords.length,
      eipBandwidths,
      previewLineCount: lineItems.length
    });
    crmPreviewLineItems.push(...lineItems);
  }

  const regionCount = new Set(crmPreviewLineItems.map((line) => `${line.regionId || ""}|${line.regionName || ""}`)).size;

  return {
    tenant: {
      vdcId: String(vdc.id),
      domainId: vdc.domain_id ?? null,
      name: String(vdc.name || vdc.id)
    },
    projectCount: projects.length,
    previewLineCount: crmPreviewLineItems.length,
    previewRegionCount: regionCount,
    hasMixedPreviewRegions: regionCount > 1,
    projects,
    crmPreviewLineItems
  };
}

function buildMixedRegionSummary(results) {
  return results
    .filter((row) => row.hasMixedPreviewRegions)
    .map((row) => ({
      tenantName: row.tenant?.name,
      vdcId: row.tenant?.vdcId,
      previewRegionCount: row.previewRegionCount,
      previewLineCount: row.previewLineCount,
      regions: [...new Set(row.crmPreviewLineItems.map((line) => line.regionName || "UNKNOWN"))],
      resourceSpaces: row.projects.map((project) => ({
        name: project.resourceSpaceName,
        projectId: project.projectId,
        regionName: project.region.regionName,
        previewLineCount: project.previewLineCount,
        recordCounts: project.recordCounts
      }))
    }));
}

async function main() {
  console.log("[RESOURCE SPACE PAYLOAD PREVIEW] read-only preview started");
  console.log("[RESOURCE SPACE PAYLOAD PREVIEW] no DB writes, no CRM push, no sync job changes");
  console.log("[RESOURCE SPACE PAYLOAD PREVIEW] covers project-scoped ECS, EVS, EVS disk fee, and EIP bandwidth only");

  const session = await authenticate();
  const vdcs = filterTenants(await listAllVdcs({ upper_vdc_id: "0", used: "true" }));
  const results = [];

  console.log(`[RESOURCE SPACE PAYLOAD PREVIEW] tenants selected: ${vdcs.length}`);

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
  console.log(`[RESOURCE SPACE PAYLOAD PREVIEW] mixed-preview-region tenant(s): ${mixedRegionTenants.length}`);

  console.log("\n================ RESOURCE SPACE CRM PAYLOAD PREVIEW ================");
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
  console.log("================ END RESOURCE SPACE CRM PAYLOAD PREVIEW ================");
}

main().catch((error) => {
  console.error("[RESOURCE SPACE PAYLOAD PREVIEW] failed:", error);
  process.exitCode = 1;
});
