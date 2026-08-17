import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { authenticate, listAllVdcs } from "../manageone.js";

const prisma = new PrismaClient();
const DEFAULT_MANAGEONE_BASE_URL = "https://10.20.24.9:26335/rest/vdc";
const TENANT_USAGE_SYNC_URL = "https://crm-api.102-203-134-106.sslip.io/tenant-usage/sync";
const DAILY_USAGE_CAPTURE_URL =
  process.env.DAILY_USAGE_CAPTURE_URL || TENANT_USAGE_SYNC_URL.replace("/tenant-usage/sync", "/daily-usage/capture");
const RESOURCE_USAGE_REQUEST_DELAY_MS = 2000;
const RESOURCE_USAGE_RATE_LIMIT_RETRIES = 2;
const RESOURCE_USAGE_RATE_LIMIT_RETRY_DELAY_MS = 5000;
const MANAGEONE_READ_TIMEOUT_MS = 30000;
const PROJECT_PAGE_LIMIT = 100;
const PROJECT_MAX_PAGES = 20;
const QUOTA_MAX_STARTS = Number(process.env.MANAGEONE_SYNC_QUOTA_MAX_STARTS || 30);
const CRM_SYNC_BATCH_SIZE = Math.max(1, Number.parseInt(process.env.CRM_SYNC_BATCH_SIZE || "10", 10) || 10);
const NATIVE_RESOURCE_PAGE_LIMIT = 1000;
const NATIVE_RESOURCE_MAX_PAGES = 20;
const DEFAULT_CAPACITY_BASE_URL = "https://10.20.24.9:26335";
const OBS_CAPACITY_REGIONS = [
  {
    regionId: "3A462C0E713B3BF389CC4359D2618F9D",
    regionCode: "htgcloud-region-02",
    regionName: "Mogadishu-region-hq3"
  },
  {
    regionId: "3A03042C29813F5DBA6DBDC2E95CB101",
    regionCode: "hoa-mogadishu-2",
    regionName: "Hoa-Mogadishu-2"
  }
];
const USE_DOMAIN_NATIVE_BREAKDOWN = process.env.MANAGEONE_SYNC_DOMAIN_NATIVE_BREAKDOWN !== "false";
const DEFAULT_VPC_CONSOLE_BASE_URL = "https://service-hq3.htgclouds.com/vpc/rest/v2";
const SYNC_TENANT_FILTER = String(process.env.MANAGEONE_SYNC_TENANT_FILTER || "")
  .trim()
  .toLowerCase();
const SYNC_NAT_GATEWAYS = process.env.MANAGEONE_SYNC_NAT_GATEWAYS === "true";
const SYNC_NAT_GATEWAY_TENANT_FILTER = String(process.env.MANAGEONE_SYNC_NAT_GATEWAY_TENANT_FILTER || "")
  .trim()
  .toLowerCase();

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

function chunkArray(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
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

function vpcConsoleBaseUrl() {
  return stripTrailingSlash(process.env.MANAGEONE_VPC_CONSOLE_BASE_URL || DEFAULT_VPC_CONSOLE_BASE_URL);
}

function capacityBaseUrl() {
  return stripTrailingSlash(process.env.MANAGEONE_CAPACITY_BASE_URL || DEFAULT_CAPACITY_BASE_URL);
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

function parseJsonResponse(text, label) {
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`${label} returned invalid JSON: ${String(text || "").slice(0, 300)}`);
  }
}

function normalizeObsIdentity(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function obsTenantRows(body) {
  if (Array.isArray(body?.tenant)) return body.tenant;
  if (Array.isArray(body?.obs?.tenant)) return body.obs.tenant;
  if (Array.isArray(body?.OBSCapacity?.tenant)) return body.OBSCapacity.tenant;
  if (Array.isArray(body?.data?.tenant)) return body.data.tenant;
  if (Array.isArray(body?.data?.obs?.tenant)) return body.data.obs.tenant;
  if (Array.isArray(body?.data?.OBSCapacity?.tenant)) return body.data.OBSCapacity.tenant;
  if (Array.isArray(body?.tenants)) return body.tenants;
  if (Array.isArray(body?.data?.tenants)) return body.data.tenants;
  if (Array.isArray(body?.rows)) return body.rows;
  if (Array.isArray(body?.data?.rows)) return body.data.rows;
  if (Array.isArray(body?.items)) return body.items;
  if (Array.isArray(body?.data?.items)) return body.data.items;
  return [];
}

function obsTenantRowMatches(row, tenant) {
  const tenantKeys = [
    tenant?.name,
    tenant?.id,
    tenant?.domain_id,
    tenant?.domainId,
    tenant?.vdcId,
    tenant?.tenantName
  ].map(normalizeObsIdentity);
  const rowKeys = [
    row?.tenantName,
    row?.tenant_name,
    row?.name,
    row?.tenantId,
    row?.tenant_id,
    row?.vdcId,
    row?.vdc_id,
    row?.domainId,
    row?.domain_id
  ].map(normalizeObsIdentity);
  return rowKeys.some((rowKey) => rowKey && tenantKeys.includes(rowKey));
}

function obsStorageClass(row) {
  const value = firstDefined(
    row?.storageClass,
    row?.storage_class,
    row?.bucketStorageClass,
    row?.bucket_storage_class,
    row?.storageClassName,
    row?.dataStorageClass,
    row?.type
  );
  return value ? String(value) : "Standard";
}

function obsBucketUsedMb(row) {
  const value = firstDefined(row?.bucketUsed, row?.bucket_used, row?.usedMb, row?.used_mb, row?.used, row?.usage);
  const numericValue = numberOrNull(value);
  if (numericValue !== null) return numericValue;

  const match = String(value || "")
    .trim()
    .match(/^(-?\d+(?:\.\d+)?)\s*([a-z]+)?$/i);
  if (!match) return null;

  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) return null;

  const unit = String(match[2] || "MB").toLowerCase();
  if (unit === "gb" || unit === "gib") return amount * 1024;
  if (unit === "kb" || unit === "kib") return amount / 1024;
  if (unit === "b" || unit === "byte" || unit === "bytes") return amount / (1024 * 1024);
  return amount;
}

function obsBucketUsedGb(row) {
  const usedMb = obsBucketUsedMb(row);
  if (usedMb === null || usedMb <= 0) return 0;
  return Math.round((usedMb / 1024) * 1000) / 1000;
}

function obsCapacityRowSample(row) {
  return {
    tenantName: firstDefined(row?.tenantName, row?.tenant_name, row?.name) ?? null,
    tenantId: firstDefined(row?.tenantId, row?.tenant_id) ?? null,
    vdcId: firstDefined(row?.vdcId, row?.vdc_id) ?? null,
    domainId: firstDefined(row?.domainId, row?.domain_id) ?? null,
    bucketName: firstDefined(row?.bucketName, row?.bucket_name, row?.name) ?? null,
    bucketUsed: firstDefined(row?.bucketUsed, row?.bucket_used, row?.usedMb, row?.used_mb, row?.used, row?.usage) ?? null
  };
}

function obsGbFromBreakdown(obsBuckets) {
  if (!Array.isArray(obsBuckets) || obsBuckets.length === 0) return null;
  return obsBuckets.reduce((total, bucket) => total + (numberOrNull(bucket?.totalGb) || 0), 0);
}

async function fetchObsCapacity(region, session) {
  const url = `${capacityBaseUrl()}/rest/capacity/v1/capbase/regions/${encodeURIComponent(
    region.regionId
  )}/resource-types/obs/current-capacities`;

  const { response, text } = await fetchTextWithTimeout(url, {
    method: "GET",
    headers: {
      Accept: "application/json, text/plain, */*",
      "Content-Type": "application/json",
      "X-Auth-Token": session.token
    },
    redirect: "manual"
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}${text ? ` ${text.slice(0, 500)}` : ""}`);
  }

  return obsTenantRows(parseJsonResponse(text, `OBS capacity for ${region.regionName}`));
}

async function fetchObsBucketBreakdownByTenant(session, vdcs) {
  const bucketsByVdcId = new Map();

  for (const region of OBS_CAPACITY_REGIONS) {
    try {
      const rows = await fetchObsCapacity(region, session);
      console.log(`[MANAGEONE SYNC] OBS3 capacity probe for ${region.regionName}: ${rows.length} tenant bucket row(s)`);

      let regionMatchCount = 0;
      for (const vdc of vdcs) {
        const matches = rows.filter((row) => obsTenantRowMatches(row, vdc));
        if (matches.length === 0) continue;

        regionMatchCount += matches.length;
        const existing = bucketsByVdcId.get(String(vdc.id)) || [];
        for (const row of matches) {
          const totalGb = obsBucketUsedGb(row);
          if (totalGb <= 0) continue;

          existing.push({
            bucketName: String(firstDefined(row?.bucketName, row?.bucket_name, row?.name, "OBS bucket")),
            totalGb,
            usedMb: obsBucketUsedMb(row) ?? undefined,
            storageClass: obsStorageClass(row),
            catalogItemName: "Fusion bucket",
            regionId: region.regionCode,
            regionName: region.regionName
          });
        }
        if (existing.length > 0) {
          bucketsByVdcId.set(String(vdc.id), existing);
        }
      }
      if (rows.length > 0 && regionMatchCount === 0) {
        console.warn(
          `[MANAGEONE SYNC] OBS3 capacity rows for ${region.regionName} did not match selected tenants; sample ${JSON.stringify(
            rows.slice(0, 3).map(obsCapacityRowSample)
          )}`
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error || "Unknown error");
      console.warn(`[MANAGEONE SYNC] OBS3 capacity probe skipped for ${region.regionName}: ${message}`);
    }
  }

  return bucketsByVdcId;
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

function isSystemVdc(vdc) {
  const name = String(vdc?.name || "").trim().toLowerCase();
  return (
    name.endsWith("_system_vdc") ||
    name.includes("system_vdc") ||
    name.startsWith("workspace_") ||
    name.startsWith("advanceservice_") ||
    name.startsWith("cfw_") ||
    name.startsWith("cfwforhcs_")
  );
}

function tenantMatchesFilter(vdc, filter) {
  if (!filter) return true;
  if (filter === "__all__") return true;

  const haystack = `${vdc?.name || ""} ${vdc?.id || ""} ${vdc?.domain_id || ""}`.toLowerCase();
  return filter
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .some((filterItem) => haystack.includes(filterItem));
}

function filterSyncTenants(vdcs) {
  if (!SYNC_TENANT_FILTER) return vdcs;
  return vdcs.filter((vdc) => tenantMatchesFilter(vdc, SYNC_TENANT_FILTER));
}

function shouldUseDomainNativeBreakdown(vdc) {
  return USE_DOMAIN_NATIVE_BREAKDOWN && Boolean(vdc?.domain_id) && !isSystemVdc(vdc);
}

function resourceUsageIndicatesEcs(resourceUsage) {
  return flattenResourceUsage(resourceUsage).some((resource) => {
    const serviceId = String(resource.serviceId || "").toLowerCase();
    const resourceName = String(resource.resource || "").toLowerCase();
    return serviceId.includes("ecs") && resourceName.includes("instance") && Number(resource.used) > 0;
  });
}

function ecsUsedFromResourceUsage(resourceUsage) {
  return resourceUsed(flattenResourceUsage(resourceUsage), "ecs", "instances");
}

function bmsUsedFromResources(resources) {
  return resourceUsed(resources, "bms", "instances");
}

function wafBasicUsedFromResources(resources) {
  return resourceUsed(resources, "waf", "waf.instance.100");
}

function wafEnterpriseUsedFromResources(resources) {
  return resourceUsed(resources, "waf", "waf.instance.500");
}

function resourceUsageIndicatesEvs(resourceUsage) {
  return flattenResourceUsage(resourceUsage).some((resource) => {
    const serviceId = String(resource.serviceId || "").toLowerCase();
    const resourceName = String(resource.resource || "").toLowerCase();
    return serviceId.includes("evs") && /(volume|gigabyte)/i.test(resourceName) && Number(resource.used) > 0;
  });
}

function resourceUsageIndicatesEipBandwidth(resourceUsage) {
  return flattenResourceUsage(resourceUsage).some((resource) => {
    const serviceId = String(resource.serviceId || "").toLowerCase();
    const resourceName = String(resource.resource || "").toLowerCase();
    return serviceId.includes("vpc") && resourceName.includes("bandwidth") && Number(resource.used) > 0;
  });
}

function resourceUsageIndicatesVpn(resourceUsage) {
  return flattenResourceUsage(resourceUsage).some((resource) => {
    const serviceId = String(resource.serviceId || "").toLowerCase();
    const resourceName = String(resource.resource || "").toLowerCase();
    return serviceId.includes("vpc") && resourceName.includes("vpn") && Number(resource.used) > 0;
  });
}

function shouldFetchNatGatewayBreakdown(vdc) {
  if (!SYNC_NAT_GATEWAYS) return false;
  if (!SYNC_NAT_GATEWAY_TENANT_FILTER) return false;
  return tenantMatchesFilter(vdc, SYNC_NAT_GATEWAY_TENANT_FILTER);
}

function shouldFetchEcsFlavorBreakdown(vdc, resourceUsage) {
  const ecsUsed = numberOrNull(vdc.ecs_used);
  return (ecsUsed !== null && ecsUsed > 0) || resourceUsageIndicatesEcs(resourceUsage);
}

function shouldFetchEvsVolumeTypeBreakdown(vdc, resourceUsage) {
  const evsUsed = numberOrNull(vdc.evs_used);
  return (evsUsed !== null && evsUsed > 0) || resourceUsageIndicatesEvs(resourceUsage);
}

function shouldFetchEipBandwidthBreakdown(resourceUsage) {
  return resourceUsageIndicatesEipBandwidth(resourceUsage);
}

function shouldFetchVpnGatewayBreakdown(resourceUsage) {
  return resourceUsageIndicatesVpn(resourceUsage);
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

function nativeResourceIdentity(resource) {
  return firstDefined(
    resource?.id,
    resource?.resource_id,
    resource?.resourceId,
    resource?.native_resource_id,
    resource?.nativeResourceId,
    resource?.uuid,
    resource?.properties?.id,
    resource?.properties?.resource_id,
    resource?.properties?.resourceId
  );
}

function aggregateEcsFlavorBreakdown(nativeResourceResponses) {
  const flavorsByName = new Map();
  const seenResources = new Set();

  for (const response of nativeResourceResponses) {
    const resources = listFromResponse(response, ["resources", "resource_list", "native_resources"]);

    for (const resource of resources) {
      const identity = nativeResourceIdentity(resource);
      if (identity) {
        const key = String(identity);
        if (seenResources.has(key)) continue;
        seenResources.add(key);
      }

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

function mergeEcsFlavorBreakdowns(items) {
  const flavorsByKey = new Map();

  for (const item of items) {
    const key = [item.flavorName, item.regionId || "", item.regionName || ""].join("|");
    const existing = flavorsByKey.get(key);
    if (existing) {
      existing.count += numberOrNull(item.count) || 0;
    } else {
      flavorsByKey.set(key, { ...item });
    }
  }

  return [...flavorsByKey.values()].sort((a, b) => {
    const regionCompare = String(a.regionName || "").localeCompare(String(b.regionName || ""));
    return regionCompare || String(a.flavorName || "").localeCompare(String(b.flavorName || ""));
  });
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

function mergeEvsVolumeTypeBreakdowns(items) {
  const volumesByKey = new Map();

  for (const item of items) {
    const key = [item.volumeTypeKey || String(item.volumeType || "").toLowerCase(), item.regionId || "", item.regionName || ""].join("|");
    const existing = volumesByKey.get(key);
    if (existing) {
      existing.count += numberOrNull(item.count) || 0;
      existing.totalGb += numberOrNull(item.totalGb) || 0;
    } else {
      volumesByKey.set(key, { ...item });
    }
  }

  return [...volumesByKey.values()].sort((a, b) => {
    const regionCompare = String(a.regionName || "").localeCompare(String(b.regionName || ""));
    return regionCompare || String(a.volumeType || "").localeCompare(String(b.volumeType || ""));
  });
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

function aggregateEipBandwidthBreakdown(nativeResourceResponses) {
  const tiersByName = new Map();

  for (const response of nativeResourceResponses) {
    const resources = listFromResponse(response, ["resources", "resource_list", "native_resources"]);

    for (const resource of resources) {
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
  }

  return [...tiersByName.values()].sort((a, b) => a.tierName.localeCompare(b.tierName));
}

function recordMatchesResourceTypeName(record, resourceTypeName) {
  const actualTypeName = firstDefined(
    record?.resource_type_name,
    record?.resourceTypeName,
    record?.cloud_resource_type,
    record?.className
  );
  return String(actualTypeName || "").toLowerCase() === String(resourceTypeName || "").toLowerCase();
}

function uniqueResourceKey(record) {
  return (
    firstDefined(
      record?.id,
      record?.resource_id,
      record?.resourceId,
      record?.nativeId,
      record?.resId,
      record?.native_resource_id,
      record?.name,
      record?.resource_name,
      record?.resourceName
    ) ?? null
  );
}

function aggregateVpnGatewayBreakdown(resourceIndexResponses) {
  const gatewaysByKey = new Map();

  for (const response of resourceIndexResponses) {
    const resources = listFromResponse(response, ["resources", "resource_list", "native_resources"]);

    for (const resource of resources) {
      if (!recordMatchesResourceTypeName(resource, "CLOUD_VPN_SERVICE")) continue;

      const key = uniqueResourceKey(resource);
      if (!key) continue;

      gatewaysByKey.set(String(key), {
        id: String(key),
        name: String(firstDefined(resource?.name, resource?.resource_name, resource?.resourceName, key)),
        resourceTypeName: "CLOUD_VPN_SERVICE"
      });
    }
  }

  return {
    count: gatewaysByKey.size,
    resourceTypeName: "CLOUD_VPN_SERVICE",
    items: [...gatewaysByKey.values()].sort((a, b) => a.name.localeCompare(b.name))
  };
}

function aggregateCloudBastionHostBreakdown(resourceIndexResponses) {
  const hostsByKey = new Map();

  for (const response of resourceIndexResponses) {
    const resources = listFromResponse(response, ["resources", "resource_list", "native_resources"]);

    for (const resource of resources) {
      if (
        !recordMatchesResourceTypeName(resource, "CLOUD_CBH") &&
        !recordMatchesResourceTypeName(resource, "CLOUD_CBH_INSTANCE")
      ) {
        continue;
      }

      const key = uniqueResourceKey(resource);
      if (!key) continue;

      hostsByKey.set(String(key), {
        id: String(key),
        name: String(firstDefined(resource?.name, resource?.resource_name, resource?.resourceName, key)),
        resourceTypeName: String(
          firstDefined(resource?.resource_type_name, resource?.resourceTypeName, resource?.cloud_resource_type, "CLOUD_CBH")
        )
      });
    }
  }

  return {
    count: hostsByKey.size,
    resourceTypeName: "CLOUD_CBH",
    items: [...hostsByKey.values()].sort((a, b) => a.name.localeCompare(b.name))
  };
}

const NAT_SPEC_CATALOG = {
  "1": "Small (150 Mbps)",
  "2": "Medium (600 Mbps)",
  "3": "Large (1.5 Gbps)",
  "4": "Extra-large (4 Gbps+)"
};
const NAT_RESOURCE_TYPE_NAME = "CLOUD_NAT_INSTANCE";
const NAT_DEFAULT_SPEC = "1";

function optionalVpcPortalHeaders(context = {}) {
  const headers = {};
  const cookie = String(process.env.MANAGEONE_VPC_COOKIE || "").trim();
  const agencyId = String(process.env.MANAGEONE_VPC_AGENCY_ID || "").trim();
  const region = String(firstDefined(context.regionHeader, process.env.MANAGEONE_VPC_REGION) || "").trim();
  const projectName = String(firstDefined(context.projectNameHeader, process.env.MANAGEONE_VPC_PROJECT_NAME) || "").trim();
  const language = String(process.env.MANAGEONE_VPC_X_LANGUAGE || "en-us").trim();
  const targetServices = String(process.env.MANAGEONE_VPC_X_TARGET_SERVICES || "").trim();

  if (cookie) headers.Cookie = cookie;
  if (agencyId) headers.Agencyid = agencyId;
  if (region) headers.Region = region;
  if (projectName) headers.Projectname = projectName;
  if (language) headers["X-Language"] = language;
  if (targetServices) headers["X-Target-Services"] = targetServices;
  headers["X-Requested-With"] = "XMLHttpRequest";

  return headers;
}

async function readVpcPortalJson(label, url, context = {}) {
  const portalHeaders = optionalVpcPortalHeaders(context);
  if (!portalHeaders.Cookie) {
    throw new Error("MANAGEONE_VPC_COOKIE is required for NAT gateway sync");
  }

  const { response, text } = await fetchTextWithTimeout(url, {
    method: "GET",
    headers: {
      Accept: "application/json, text/plain, */*",
      ...portalHeaders
    },
    redirect: "manual"
  });

  if (!response.ok) {
    throw new HttpStatusError(response.status, `${label}: HTTP ${response.status}${text ? ` ${text}` : ""}`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (text && !contentType.toLowerCase().includes("json")) {
    throw new Error(`${label}: expected JSON but got ${contentType || "unknown content-type"}`);
  }

  return text ? JSON.parse(text) : {};
}

async function fetchVpcNatGateways(projectId, context = {}) {
  const params = new URLSearchParams({
    sort_key: "created_at",
    sort_dir: "desc",
    enterprise_project_id: "all_granted_eps"
  });
  const url = `${vpcConsoleBaseUrl()}/${encodeURIComponent(projectId)}/nat_gateways?${params}`;
  const body = await readVpcPortalJson(`VPC NAT gateway list for project ${projectId}`, url, context);
  return listFromResponse(body, ["nat_gateways", "natGateways", "gateways"]);
}

function summarizeNatGateway(gateway, project = {}) {
  const spec = gateway?.spec === undefined || gateway?.spec === null ? NAT_DEFAULT_SPEC : String(gateway.spec);
  const catalogName = NAT_SPEC_CATALOG[spec] || null;

  return {
    id: String(firstDefined(gateway?.id, gateway?.name, `${project.projectId}:${spec || "unknown"}`)),
    name: String(firstDefined(gateway?.name, gateway?.resource_name, gateway?.id, "NAT Gateway")),
    resourceTypeName: String(firstDefined(gateway?.resource_type_name, NAT_RESOURCE_TYPE_NAME)),
    spec,
    catalogItemName: catalogName,
    status: firstDefined(gateway?.status, gateway?.resource_status) ? String(firstDefined(gateway?.status, gateway?.resource_status)) : null,
    projectId: firstDefined(project.projectId, gateway?.project_id),
    resourceSpaceName: firstDefined(project.resourceSpaceName, gateway?.project_name, gateway?.project_display_name),
    ...(firstDefined(project.regionId, gateway?.region_id) ? { regionId: firstDefined(project.regionId, gateway?.region_id) } : {}),
    ...(firstDefined(project.regionName, gateway?.region_name) ? { regionName: firstDefined(project.regionName, gateway?.region_name) } : {})
  };
}

function aggregateNatGatewayBreakdown(items) {
  const itemsByKey = new Map();

  for (const item of items) {
    if (!item.catalogItemName) continue;
    if (String(item.status || "").toLowerCase() === "deleted") continue;
    itemsByKey.set(item.id, item);
  }

  return {
    count: itemsByKey.size,
    resourceTypeName: NAT_RESOURCE_TYPE_NAME,
    items: [...itemsByKey.values()].sort((a, b) => a.name.localeCompare(b.name))
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

function projectRegionFields(project) {
  const region = extractProjectRegions(project)[0];
  return {
    ...(region?.regionId ? { regionId: region.regionId } : {}),
    ...(region?.regionName ? { regionName: region.regionName } : {})
  };
}

function projectId(project) {
  const value = firstDefined(project?.id, project?.project_id, project?.projectId);
  return value ? String(value) : null;
}

function quotaUnitId(project) {
  const value = firstDefined(
    project?.quota_unit_id,
    project?.quotaUnitId,
    project?.quota_unit?.id,
    project?.quotaUnit?.id,
    project?.enterprise_project_id,
    project?.enterpriseProjectId
  );
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

function vpcPortalProjectHeaderName(project) {
  return String(
    firstDefined(
      project?.iam_project_name,
      project?.iamProjectName,
      project?.project_name,
      project?.projectName,
      project?.name,
      project?.resource_space_name,
      project?.resourceSpaceName,
      project?.display_name,
      project?.displayName,
      project?.id,
      "unknown"
    )
  );
}

function projectRegionKey(project) {
  const fields = projectRegionFields(project);
  return `${fields.regionId || ""}|${fields.regionName || ""}`;
}

function hasMixedProjectRegions(projects) {
  const regionKeys = new Set(projects.map(projectRegionKey).filter((key) => key !== "|"));
  return regionKeys.size > 1;
}

function mapTenantUsageHistoryItem({ vdc, resourceUsage, obsBuckets, syncedAt }) {
  const resources = flattenResourceUsage(resourceUsage);
  const extra = parseExtra(vdc.extra);
  const obsGb = obsGbFromBreakdown(obsBuckets);

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
    obsGb: obsGb ?? resourceUsed(resources, "obsv3", "capacity"),
    sfsGb: resourceUsed(resources, "sfs", "gigabytes"),
    publicIps: resourceUsed(resources, "vpc", "publicIp"),
    bmsInstances: bmsUsedFromResources(resources),
    wafInstances: resourceUsed(resources, "waf", "waf.instance"),
    wafBasicInstances: wafBasicUsedFromResources(resources),
    wafEnterpriseInstances: wafEnterpriseUsedFromResources(resources),
    syncedAt
  };
}

function ecsUsedFromBreakdown(ecsFlavors) {
  if (!Array.isArray(ecsFlavors) || ecsFlavors.length === 0) return null;

  return ecsFlavors.reduce((total, flavor) => total + (numberOrNull(flavor?.count) || 0), 0);
}

function evsUsedFromBreakdown(evsVolumeTypes) {
  if (!Array.isArray(evsVolumeTypes) || evsVolumeTypes.length === 0) return null;

  return evsVolumeTypes.reduce((total, volumeType) => total + (numberOrNull(volumeType?.totalGb) || 0), 0);
}

function evsDiskManagedFeeFromBreakdown(evsVolumeTypes) {
  if (!Array.isArray(evsVolumeTypes) || evsVolumeTypes.length === 0) {
    return { count: 0, resourceTypeName: "CLOUD_EVS_INSTANCE" };
  }

  const feesByRegion = new Map();
  for (const volumeType of evsVolumeTypes) {
    const count = numberOrNull(volumeType?.count) || 0;
    if (count <= 0) continue;

    const regionId = volumeType?.regionId || null;
    const regionName = volumeType?.regionName || null;
    const key = `${regionId || ""}|${regionName || ""}`;
    const existing = feesByRegion.get(key);
    if (existing) {
      existing.count += count;
    } else {
      feesByRegion.set(key, {
        count,
        resourceTypeName: "CLOUD_EVS_INSTANCE",
        ...(regionId ? { regionId } : {}),
        ...(regionName ? { regionName } : {})
      });
    }
  }

  if (feesByRegion.size > 1) {
    return {
      count: [...feesByRegion.values()].reduce((total, item) => total + item.count, 0),
      resourceTypeName: "CLOUD_EVS_INSTANCE",
      items: [...feesByRegion.values()].sort((a, b) =>
        String(a.regionName || "").localeCompare(String(b.regionName || ""))
      )
    };
  }

  const [singleRegionFee] = feesByRegion.values();
  if (singleRegionFee) return singleRegionFee;

  return {
    count: evsVolumeTypes.reduce((total, volumeType) => total + (numberOrNull(volumeType?.count) || 0), 0),
    resourceTypeName: "CLOUD_EVS_INSTANCE"
  };
}

function mapTenantForCrm(tenant) {
  const rawPayload = parseJsonObject(tenant.raw_payload);
  const ecsFlavors = tenant.ecs_flavor_breakdown || [];
  const evsVolumeTypes = tenant.evs_volume_type_breakdown || [];
  const evsDiskManagedFees = tenant.evs_disk_managed_fee_breakdown || evsDiskManagedFeeFromBreakdown(evsVolumeTypes);
  const obsBuckets = tenant.obs_bucket_breakdown || [];
  const eipBandwidths = tenant.eip_bandwidth_breakdown || [];
  const vpnGateways = tenant.vpn_gateway_breakdown || null;
  const cloudBastionHosts = tenant.cloud_bastion_host_breakdown || null;
  const natGateways = tenant.nat_gateway_breakdown || null;
  const quotas = tenant.quota_breakdown || [];
  const derivedEcsUsed = ecsUsedFromBreakdown(ecsFlavors);
  const derivedEvsUsed = evsUsedFromBreakdown(evsVolumeTypes);

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
    ecsUsed: derivedEcsUsed ?? numberOrNull(tenant.ecs_used),
    evsUsed: derivedEvsUsed ?? numberOrNull(tenant.evs_used),
    projectCount: tenant.project_count,
    resources: flattenResourceUsage(tenant.resource_usage),
    ecsFlavors,
    evsVolumeTypes,
    evsDiskManagedFees,
    obsBuckets,
    eipBandwidths,
    quotas,
    ...(vpnGateways ? { vpnGateways } : {}),
    ...(cloudBastionHosts ? { cloudBastionHosts } : {}),
    ...(natGateways ? { natGateways } : {})
  };
}

async function loadSyncedTenantsForCrm(vdcIds = null) {
  const tenants = await prisma.$queryRaw`
    SELECT
      vdc_id, domain_id, name, level, upper_vdc_id, enabled,
      manager_name, manager_phone, manager_email,
      ecs_used, evs_used, project_count, raw_payload, resource_usage, ecs_flavor_breakdown, evs_volume_type_breakdown,
      evs_disk_managed_fee_breakdown, obs_bucket_breakdown, eip_bandwidth_breakdown, vpn_gateway_breakdown, cloud_bastion_host_breakdown,
      nat_gateway_breakdown, quota_breakdown
    FROM manageone_tenants
    ORDER BY name ASC
  `;

  if (!Array.isArray(vdcIds) || vdcIds.length === 0) {
    return tenants;
  }

  const allowedVdcIds = new Set(vdcIds.map((id) => String(id)));
  return tenants.filter((tenant) => allowedVdcIds.has(String(tenant.vdc_id)));
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

async function fetchProjectDetails(project, session) {
  const id = projectId(project);
  if (!id) {
    return project;
  }

  const url = `${vdcEndpointBaseUrl()}/v3.1/projects/${encodeURIComponent(id)}`;
  const body = await retryRateLimited(`project details for ${id}`, async () => {
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
  });

  return body?.project || body;
}

function quotaServiceKey(service) {
  return String(service?.service_id || service?.serviceId || service?.id || "");
}

function mergeQuotaServices(existingServices, nextServices) {
  const servicesById = new Map();

  for (const service of [...existingServices, ...nextServices]) {
    const key = quotaServiceKey(service);
    if (!key) continue;

    const current = servicesById.get(key);
    if (!current) {
      servicesById.set(key, { ...service });
      continue;
    }

    const currentQuotas = listFromResponse(current, ["quotas"]);
    const nextQuotas = listFromResponse(service, ["quotas"]);
    const quotasByKey = new Map(currentQuotas.map((quota) => [JSON.stringify(quota), quota]));
    for (const quota of nextQuotas) {
      quotasByKey.set(JSON.stringify(quota), quota);
    }
    current.quotas = [...quotasByKey.values()];
  }

  return [...servicesById.values()];
}

async function fetchQuotaUnitServices(quotaUnitIdValue, session) {
  const baseUrl = `${vdcEndpointBaseUrl()}/v3.2/enterprise-projects/${encodeURIComponent(quotaUnitIdValue)}/quotas`;
  let services = [];
  let total = null;
  let previousUniqueCount = 0;
  let noGrowthCount = 0;

  for (let start = 0; start < QUOTA_MAX_STARTS; start += 1) {
    const url = `${baseUrl}?start=${start}`;
    const body = await retryRateLimited(`quota page start=${start} for ${quotaUnitIdValue}`, async () => {
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
    });
    const pageServices = listFromResponse(body, ["services"]);
    total = Number.isFinite(Number(body?.total)) ? Number(body.total) : total;
    services = mergeQuotaServices(services, pageServices);

    if (services.length >= Number(total || 0)) break;
    if (services.length === previousUniqueCount) {
      noGrowthCount += 1;
    } else {
      noGrowthCount = 0;
    }
    previousUniqueCount = services.length;
    if (noGrowthCount >= 3) break;
    await delay(RESOURCE_USAGE_REQUEST_DELAY_MS);
  }

  return services;
}

function normalizeQuotaRows(services, project, quotaUnitIdValue) {
  const allowedServices = new Set(["ecs", "evs"]);
  const rows = [];

  for (const service of services) {
    const serviceId = quotaServiceKey(service).toLowerCase();
    if (!allowedServices.has(serviceId)) continue;

    for (const quota of listFromResponse(service, ["quotas"])) {
      const limit = numberOrNull(firstDefined(quota.quota_limit, quota.local_limit, quota.limit));
      const used = numberOrNull(firstDefined(quota.quota_used, quota.local_used, quota.used));
      const row = {
        projectId: projectId(project),
        projectName: projectName(project),
        quotaUnitId: quotaUnitIdValue,
        serviceId,
        serviceName: parseLocalizedName(service.service_name) || serviceId.toUpperCase(),
        regionId: quota.region_id ? String(quota.region_id) : null,
        regionName: parseLocalizedName(firstDefined(quota.region_name, quota.regionName)),
        cloudInfraId: quota.cloud_infra_id ? String(quota.cloud_infra_id) : null,
        azId: quota.az_id ? String(quota.az_id) : null,
        parentId: quota.parent_id ? String(quota.parent_id) : null,
        resourceId: quota.resource_id ? String(quota.resource_id) : null,
        resourceName: parseLocalizedName(firstDefined(quota.resource_name, quota.resourceName)),
        unit: parseLocalizedName(quota.unit),
        limit: limit ?? -1,
        used: used ?? 0
      };
      row.remaining = row.limit === -1 ? -1 : row.limit - row.used;
      rows.push(row);
    }
  }

  return rows;
}

async function fetchTenantQuotaBreakdown(vdc, session) {
  const projects = await listTenantProjects(vdc, session);
  const servicesByQuotaUnitId = new Map();
  const rows = [];

  console.log(`[MANAGEONE SYNC] quota lookup for ${vdc.name || vdc.id}: ${projects.length} project(s)`);

  for (const project of projects) {
    await delay(RESOURCE_USAGE_REQUEST_DELAY_MS);
    const detailedProject = await fetchProjectDetails(project, session);
    const quotaId = quotaUnitId(detailedProject);
    if (!quotaId) continue;

    if (!servicesByQuotaUnitId.has(quotaId)) {
      await delay(RESOURCE_USAGE_REQUEST_DELAY_MS);
      servicesByQuotaUnitId.set(quotaId, await fetchQuotaUnitServices(quotaId, session));
    }

    rows.push(...normalizeQuotaRows(servicesByQuotaUnitId.get(quotaId), detailedProject, quotaId));
  }

  console.log(
    `[MANAGEONE SYNC] quota breakdown for ${vdc.name || vdc.id}: ${rows.length} ECS/EVS quota row(s), ${servicesByQuotaUnitId.size} quota unit(s)`
  );
  return rows;
}

const ECS_FLAVOR_NATIVE_RESOURCE_PROBES = [
  {
    serviceId: "ecs",
    resourceTypeName: "CLOUD_ECS_INSTANCE",
    label: "ECS instance",
    required: true
  },
  {
    serviceId: "cce",
    resourceTypeName: "CLOUD_CCE_NODE",
    label: "CCE node",
    required: false
  },
  {
    serviceId: "cce",
    resourceTypeName: "CLOUD_NODE",
    label: "CCE cloud node",
    required: false
  }
];

async function fetchNativeEcsResourcePage(vdc, projectId, session, start, limit, probe = ECS_FLAVOR_NATIVE_RESOURCE_PROBES[0]) {
  const params = new URLSearchParams({
    service_id: probe.serviceId,
    resource_type_name: probe.resourceTypeName,
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

async function fetchProjectNativeEcsResources(vdc, projectId, session, probe = ECS_FLAVOR_NATIVE_RESOURCE_PROBES[0]) {
  const limit = NATIVE_RESOURCE_PAGE_LIMIT;
  let start = 0;
  const responses = [];
  let page = 0;
  let hasNextPage = true;

  while (hasNextPage) {
    page += 1;
    if (page > NATIVE_RESOURCE_MAX_PAGES) {
      throw new Error(
        `Native ${probe.label} resource pagination exceeded ${NATIVE_RESOURCE_MAX_PAGES} page(s) for ${vdc.name || vdc.id} project ${projectId}`
      );
    }

    const body = await retryRateLimited(
      `native ${probe.label} resource lookup for ${vdc.name || vdc.id} project ${projectId}`,
      () => fetchNativeEcsResourcePage(vdc, projectId, session, start, limit, probe)
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

async function fetchProjectNativeFlavorResources(vdc, projectId, session) {
  const responses = [];

  for (const probe of ECS_FLAVOR_NATIVE_RESOURCE_PROBES) {
    try {
      responses.push(...(await fetchProjectNativeEcsResources(vdc, projectId, session, probe)));
    } catch (error) {
      if (probe.required) throw error;
      const message = error instanceof Error ? error.message : String(error || "Unknown error");
      console.warn(
        `[MANAGEONE SYNC] optional ${probe.label} flavor lookup skipped for ${vdc.name || vdc.id} project ${projectId}: ${message}`
      );
    }
  }

  return responses;
}

async function fetchDomainNativeEcsResourcePage(vdc, session, start, limit, probe = ECS_FLAVOR_NATIVE_RESOURCE_PROBES[0]) {
  const params = new URLSearchParams({
    service_id: probe.serviceId,
    resource_type_name: probe.resourceTypeName,
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

async function fetchDomainNativeEcsResources(vdc, session, probe = ECS_FLAVOR_NATIVE_RESOURCE_PROBES[0]) {
  const limit = NATIVE_RESOURCE_PAGE_LIMIT;
  let start = 0;
  const responses = [];
  let page = 0;
  let hasNextPage = true;

  while (hasNextPage) {
    page += 1;
    if (page > NATIVE_RESOURCE_MAX_PAGES) {
      throw new Error(
        `Domain native ${probe.label} resource pagination exceeded ${NATIVE_RESOURCE_MAX_PAGES} page(s) for ${vdc.name || vdc.id}`
      );
    }

    const body = await retryRateLimited(
      `domain native ${probe.label} resource lookup for ${vdc.name || vdc.id}`,
      () => fetchDomainNativeEcsResourcePage(vdc, session, start, limit, probe)
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

async function fetchDomainNativeFlavorResources(vdc, session) {
  const responses = [];

  for (const probe of ECS_FLAVOR_NATIVE_RESOURCE_PROBES) {
    try {
      responses.push(...(await fetchDomainNativeEcsResources(vdc, session, probe)));
    } catch (error) {
      if (probe.required) throw error;
      const message = error instanceof Error ? error.message : String(error || "Unknown error");
      console.warn(
        `[MANAGEONE SYNC] optional domain ${probe.label} flavor lookup skipped for ${vdc.name || vdc.id}: ${message}`
      );
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

async function fetchNativeBandwidthResourcePage(vdc, projectId, session, start, limit) {
  const params = new URLSearchParams({
    service_id: "vpc",
    resource_type_name: "CLOUD_BANDWIDTHS",
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

async function fetchProjectNativeBandwidthResources(vdc, projectId, session) {
  const limit = NATIVE_RESOURCE_PAGE_LIMIT;
  let start = 0;
  const responses = [];
  let page = 0;
  let hasNextPage = true;

  while (hasNextPage) {
    page += 1;
    if (page > NATIVE_RESOURCE_MAX_PAGES) {
      throw new Error(
        `Native bandwidth resource pagination exceeded ${NATIVE_RESOURCE_MAX_PAGES} page(s) for ${vdc.name || vdc.id} project ${projectId}`
      );
    }

    const body = await retryRateLimited(
      `native bandwidth resource lookup for ${vdc.name || vdc.id} project ${projectId}`,
      () => fetchNativeBandwidthResourcePage(vdc, projectId, session, start, limit)
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

async function fetchDomainNativeBandwidthResourcePage(vdc, session, start, limit) {
  const params = new URLSearchParams({
    service_id: "vpc",
    resource_type_name: "CLOUD_BANDWIDTHS",
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

async function fetchDomainNativeBandwidthResources(vdc, session) {
  const limit = NATIVE_RESOURCE_PAGE_LIMIT;
  let start = 0;
  const responses = [];
  let page = 0;
  let hasNextPage = true;

  while (hasNextPage) {
    page += 1;
    if (page > NATIVE_RESOURCE_MAX_PAGES) {
      throw new Error(
        `Domain native bandwidth resource pagination exceeded ${NATIVE_RESOURCE_MAX_PAGES} page(s) for ${vdc.name || vdc.id}`
      );
    }

    const body = await retryRateLimited(
      `domain native bandwidth resource lookup for ${vdc.name || vdc.id}`,
      () => fetchDomainNativeBandwidthResourcePage(vdc, session, start, limit)
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

async function fetchResourceIndexPage(vdc, scope, query, session, start, limit) {
  const params = new URLSearchParams({
    start: String(start),
    limit: String(limit),
    extendParam: JSON.stringify({
      ...query,
      ...scope.extendParam
    })
  });
  const url = `${resourceEndpointBaseUrl()}/v3.0/resources?${params}`;
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

async function fetchResourceIndexResources(vdc, scope, query, session) {
  const limit = Math.min(NATIVE_RESOURCE_PAGE_LIMIT, 100);
  let start = 0;
  const responses = [];
  let page = 0;
  let hasNextPage = true;

  while (hasNextPage) {
    page += 1;
    if (page > NATIVE_RESOURCE_MAX_PAGES) {
      throw new Error(
        `Resource index pagination exceeded ${NATIVE_RESOURCE_MAX_PAGES} page(s) for ${vdc.name || vdc.id} scope ${scope.key}`
      );
    }

    const body = await retryRateLimited(
      `resource index lookup for ${vdc.name || vdc.id} scope ${scope.key}`,
      () => fetchResourceIndexPage(vdc, scope, query, session, start, limit)
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

async function fetchTenantVpnGatewayBreakdown(vdc, session, resourceUsage) {
  if (!vdc?.domain_id || !shouldFetchVpnGatewayBreakdown(resourceUsage)) {
    return { count: 0, resourceTypeName: "CLOUD_VPN_SERVICE", items: [] };
  }

  const resourceIndexResponses = [];
  console.log(`[MANAGEONE SYNC] VPN Gateway lookup for ${vdc.name || vdc.id}: resource index CLOUD_VPN_SERVICE`);

  for (const scope of resourceIndexScopes(vdc)) {
    await delay(RESOURCE_USAGE_REQUEST_DELAY_MS);
    resourceIndexResponses.push(
      ...(await fetchResourceIndexResources(
        vdc,
        scope,
        { resource_type_name: "CLOUD_VPN_SERVICE" },
        session
      ))
    );
  }

  const breakdown = aggregateVpnGatewayBreakdown(resourceIndexResponses);
  console.log(
    `[MANAGEONE SYNC] VPN Gateway breakdown for ${vdc.name || vdc.id}: ${breakdown.count} unique gateway(s), ${countNativeRecords(resourceIndexResponses)} resource index record(s)`
  );
  return breakdown;
}

async function fetchTenantCloudBastionHostBreakdown(vdc, session) {
  if (!vdc?.domain_id) {
    return { count: 0, resourceTypeName: "CLOUD_CBH", items: [] };
  }

  const resourceIndexResponses = [];
  console.log(`[MANAGEONE SYNC] Cloud Bastion Host lookup for ${vdc.name || vdc.id}: resource index CLOUD_CBH`);

  for (const scope of resourceIndexScopes(vdc)) {
    await delay(RESOURCE_USAGE_REQUEST_DELAY_MS);
    resourceIndexResponses.push(
      ...(await fetchResourceIndexResources(
        vdc,
        scope,
        { resource_type_name: "CLOUD_CBH" },
        session
      ))
    );
  }

  const breakdown = aggregateCloudBastionHostBreakdown(resourceIndexResponses);
  console.log(
    `[MANAGEONE SYNC] Cloud Bastion Host breakdown for ${vdc.name || vdc.id}: ${breakdown.count} unique host(s), ${countNativeRecords(resourceIndexResponses)} resource index record(s)`
  );
  return breakdown;
}

async function fetchTenantNatGatewayBreakdown(vdc, session) {
  if (!shouldFetchNatGatewayBreakdown(vdc)) {
    if (SYNC_NAT_GATEWAYS && !SYNC_NAT_GATEWAY_TENANT_FILTER) {
      console.warn(
        "[MANAGEONE SYNC] NAT Gateway sync skipped: MANAGEONE_SYNC_NAT_GATEWAY_TENANT_FILTER is required for safe rollout"
      );
    }
    return { count: 0, resourceTypeName: NAT_RESOURCE_TYPE_NAME, items: [] };
  }

  const resourceIndexResponses = [];
  console.log(`[MANAGEONE SYNC] NAT Gateway lookup for ${vdc.name || vdc.id}: resource index ${NAT_RESOURCE_TYPE_NAME}`);

  for (const scope of resourceIndexScopes(vdc)) {
    await delay(RESOURCE_USAGE_REQUEST_DELAY_MS);
    try {
      resourceIndexResponses.push(
        ...(await fetchResourceIndexResources(
          vdc,
          scope,
          { resource_type_name: NAT_RESOURCE_TYPE_NAME },
          session
        ))
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error || "Unknown error");
      console.error(
        `[MANAGEONE SYNC] NAT Gateway scope skipped for ${vdc.name || vdc.id} / ${scope.key}: ${message}`
      );
    }
  }

  const items = resourceIndexResponses
    .flatMap((body) => listFromResponse(body, ["resources", "resource_list", "native_resources"]))
    .map((gateway) => summarizeNatGateway(gateway));
  const breakdown = aggregateNatGatewayBreakdown(items);
  console.log(
    `[MANAGEONE SYNC] NAT Gateway breakdown for ${vdc.name || vdc.id}: ${breakdown.count} gateway(s), ${countNativeRecords(resourceIndexResponses)} resource index record(s)`
  );
  return breakdown;
}

async function fetchTenantEcsFlavorBreakdown(vdc, session, resourceUsage) {
  if (!shouldFetchEcsFlavorBreakdown(vdc, resourceUsage)) {
    return [];
  }

  const projects = await listTenantProjects(vdc, session);
  const useProjectRegions = hasMixedProjectRegions(projects);
  const usageEcsUsed = ecsUsedFromResourceUsage(resourceUsage);

  if (shouldUseDomainNativeBreakdown(vdc)) {
    if (!useProjectRegions) {
      console.log(`[MANAGEONE SYNC] ECS flavor lookup for ${vdc.name || vdc.id}: domain-scoped native resources`);
      const domainResponses = await fetchDomainNativeFlavorResources(vdc, session);
      const breakdown = aggregateEcsFlavorBreakdown(domainResponses);
      console.log(
        `[MANAGEONE SYNC] ECS flavor breakdown for ${vdc.name || vdc.id}: ${breakdown.length} flavor(s), ${countNativeRecords(domainResponses)} domain record(s)`
      );
      return breakdown;
    }

    console.log(
      `[MANAGEONE SYNC] ECS flavor lookup for ${vdc.name || vdc.id}: project-scoped native resources with resource-space regions`
    );
  }

  if (USE_DOMAIN_NATIVE_BREAKDOWN && isSystemVdc(vdc)) {
    console.log(
      `[MANAGEONE SYNC] ECS flavor lookup for ${vdc.name || vdc.id}: system VDC guard active; using project-scoped resources`
    );
  }

  const nativeResourceResponses = [];
  const regionAwareBreakdown = [];
  console.log(`[MANAGEONE SYNC] ECS flavor lookup for ${vdc.name || vdc.id}: ${projects.length} project(s)`);

  for (const project of projects) {
    const projectId = project.id || project.project_id;
    if (!projectId) continue;

    await delay(RESOURCE_USAGE_REQUEST_DELAY_MS);
    const projectResponses = await fetchProjectNativeFlavorResources(vdc, String(projectId), session);
    nativeResourceResponses.push(...projectResponses);
    regionAwareBreakdown.push(
      ...aggregateEcsFlavorBreakdown(projectResponses).map((item) => ({
        ...item,
        ...projectRegionFields(project)
      }))
    );
  }

  let breakdown = useProjectRegions ? mergeEcsFlavorBreakdowns(regionAwareBreakdown) : aggregateEcsFlavorBreakdown(nativeResourceResponses);
  let selectedRecordCount = countNativeRecords(nativeResourceResponses);
  let selectedScope = "project";
  const projectFlavorCount = ecsUsedFromBreakdown(breakdown) || 0;

  if (shouldUseDomainNativeBreakdown(vdc) && useProjectRegions && usageEcsUsed > projectFlavorCount) {
    console.log(
      `[MANAGEONE SYNC] ECS flavor lookup for ${vdc.name || vdc.id}: project-scoped records ${projectFlavorCount} below usage ${usageEcsUsed}; checking domain-scoped fallback`
    );
    const domainResponses = await fetchDomainNativeFlavorResources(vdc, session);
    const domainBreakdown = aggregateEcsFlavorBreakdown(domainResponses);
    const domainFlavorCount = ecsUsedFromBreakdown(domainBreakdown) || 0;
    console.log(
      `[MANAGEONE SYNC] ECS flavor domain fallback for ${vdc.name || vdc.id}: ${domainBreakdown.length} flavor(s), ${countNativeRecords(domainResponses)} domain record(s), ${domainFlavorCount} billable ECS row(s)`
    );

    if (domainFlavorCount > projectFlavorCount) {
      console.log(
        `[MANAGEONE SYNC] ECS flavor lookup for ${vdc.name || vdc.id}: using domain-scoped fallback because it has fuller ECS coverage`
      );
      breakdown = domainBreakdown;
      selectedRecordCount = countNativeRecords(domainResponses);
      selectedScope = "domain fallback";
    }
  }

  console.log(
    `[MANAGEONE SYNC] ECS flavor breakdown for ${vdc.name || vdc.id}: ${breakdown.length} flavor(s), ${selectedRecordCount} ${selectedScope} record(s)`
  );
  return breakdown;
}

async function fetchTenantEvsVolumeTypeBreakdown(vdc, session, resourceUsage) {
  if (!shouldFetchEvsVolumeTypeBreakdown(vdc, resourceUsage)) {
    return [];
  }

  const projects = await listTenantProjects(vdc, session);
  const useProjectRegions = hasMixedProjectRegions(projects);

  if (shouldUseDomainNativeBreakdown(vdc)) {
    if (!useProjectRegions) {
      console.log(`[MANAGEONE SYNC] EVS volume-type lookup for ${vdc.name || vdc.id}: domain-scoped native resources`);
      const domainResponses = await fetchDomainNativeEvsResources(vdc, session);
      const breakdown = aggregateEvsVolumeTypeBreakdown(domainResponses);
      console.log(
        `[MANAGEONE SYNC] EVS volume-type breakdown for ${vdc.name || vdc.id}: ${breakdown.length} type(s), ${countNativeRecords(domainResponses)} domain record(s)`
      );
      return breakdown;
    }

    console.log(
      `[MANAGEONE SYNC] EVS volume-type lookup for ${vdc.name || vdc.id}: project-scoped native resources with resource-space regions`
    );
  }

  if (USE_DOMAIN_NATIVE_BREAKDOWN && isSystemVdc(vdc)) {
    console.log(
      `[MANAGEONE SYNC] EVS volume-type lookup for ${vdc.name || vdc.id}: system VDC guard active; using project-scoped resources`
    );
  }

  const nativeResourceResponses = [];
  const regionAwareBreakdown = [];
  console.log(`[MANAGEONE SYNC] EVS volume-type lookup for ${vdc.name || vdc.id}: ${projects.length} project(s)`);

  for (const project of projects) {
    const projectId = project.id || project.project_id;
    if (!projectId) continue;

    await delay(RESOURCE_USAGE_REQUEST_DELAY_MS);
    const projectResponses = await fetchProjectNativeEvsResources(vdc, String(projectId), session);
    nativeResourceResponses.push(...projectResponses);
    regionAwareBreakdown.push(
      ...aggregateEvsVolumeTypeBreakdown(projectResponses).map((item) => ({
        ...item,
        ...projectRegionFields(project)
      }))
    );
  }

  const breakdown = useProjectRegions
    ? mergeEvsVolumeTypeBreakdowns(regionAwareBreakdown)
    : aggregateEvsVolumeTypeBreakdown(nativeResourceResponses);
  console.log(
    `[MANAGEONE SYNC] EVS volume-type breakdown for ${vdc.name || vdc.id}: ${breakdown.length} type(s), ${countNativeRecords(nativeResourceResponses)} project record(s)`
  );
  return breakdown;
}

async function fetchTenantEipBandwidthBreakdown(vdc, session, resourceUsage) {
  if (!shouldFetchEipBandwidthBreakdown(resourceUsage)) {
    return [];
  }

  if (shouldUseDomainNativeBreakdown(vdc)) {
    console.log(`[MANAGEONE SYNC] EIP bandwidth lookup for ${vdc.name || vdc.id}: domain-scoped native resources`);
    const domainResponses = await fetchDomainNativeBandwidthResources(vdc, session);
    const breakdown = aggregateEipBandwidthBreakdown(domainResponses);
    console.log(
      `[MANAGEONE SYNC] EIP bandwidth breakdown for ${vdc.name || vdc.id}: ${breakdown.length} tier(s), ${countNativeRecords(domainResponses)} domain record(s)`
    );
    return breakdown;
  }

  if (USE_DOMAIN_NATIVE_BREAKDOWN && isSystemVdc(vdc)) {
    console.log(
      `[MANAGEONE SYNC] EIP bandwidth lookup for ${vdc.name || vdc.id}: system VDC guard active; using project-scoped resources`
    );
  }

  const projects = await listTenantProjects(vdc, session);
  const nativeResourceResponses = [];
  console.log(`[MANAGEONE SYNC] EIP bandwidth lookup for ${vdc.name || vdc.id}: ${projects.length} project(s)`);

  for (const project of projects) {
    const projectId = project.id || project.project_id;
    if (!projectId) continue;

    await delay(RESOURCE_USAGE_REQUEST_DELAY_MS);
    nativeResourceResponses.push(...(await fetchProjectNativeBandwidthResources(vdc, String(projectId), session)));
  }

  const breakdown = aggregateEipBandwidthBreakdown(nativeResourceResponses);
  console.log(
    `[MANAGEONE SYNC] EIP bandwidth breakdown for ${vdc.name || vdc.id}: ${breakdown.length} tier(s), ${countNativeRecords(nativeResourceResponses)} project record(s)`
  );
  return breakdown;
}

async function fetchTenantResourceUsageWithRetry(vdc, session) {
  return retryRateLimited(`resource usage for ${vdc.name || vdc.id}`, () => fetchTenantResourceUsage(vdc.id, session));
}

async function pushTenantsToCrm(vdcIds = null) {
  const syncUrl = process.env.CRM_SYNC_URL;
  const syncSecret = process.env.CRM_SYNC_SECRET;

  if (!syncUrl || !syncSecret) {
    console.warn("[MANAGEONE SYNC] CRM push skipped: CRM_SYNC_URL or CRM_SYNC_SECRET is not configured");
    return;
  }

  if (Array.isArray(vdcIds) && vdcIds.length === 0) {
    console.warn("[MANAGEONE SYNC] CRM push skipped: no synced tenants matched the active filter");
    return;
  }

  const tenants = await loadSyncedTenantsForCrm(vdcIds);
  const payload = tenants.map(mapTenantForCrm);
  const batches = chunkArray(payload, CRM_SYNC_BATCH_SIZE);

  if (payload.length === 0) {
    console.warn("[MANAGEONE SYNC] CRM push skipped: no tenant payload rows loaded");
    return;
  }

  console.log(
    `[MANAGEONE SYNC] CRM push batching ${payload.length} tenant(s) into ${batches.length} batch(es) of up to ${CRM_SYNC_BATCH_SIZE}`
  );

  for (const [index, batch] of batches.entries()) {
    const batchNumber = index + 1;
    console.log(`[MANAGEONE SYNC] CRM push batch ${batchNumber}/${batches.length}: ${batch.length} tenant(s)`);

    const response = await fetch(syncUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Sync-Secret": syncSecret
      },
      body: JSON.stringify(batch)
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(
        `CRM sync batch ${batchNumber}/${batches.length} failed: HTTP ${response.status}${body ? ` ${body}` : ""}`
      );
    }
  }

  console.log(`[MANAGEONE SYNC] CRM push success: ${payload.length} tenant(s) sent in ${batches.length} batch(es)`);
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

async function triggerDailyUsageCaptureInCrm(tenantVdcIds, capturedAt) {
  const syncSecret = process.env.TENANT_HISTORY_SYNC_SECRET;

  if (!syncSecret) {
    console.warn("[MANAGEONE SYNC] daily usage capture skipped: TENANT_HISTORY_SYNC_SECRET is not configured");
    return;
  }

  if (!Array.isArray(tenantVdcIds) || tenantVdcIds.length === 0) {
    console.warn("[MANAGEONE SYNC] daily usage capture skipped: no synced tenants matched the active filter");
    return;
  }

  const response = await fetch(DAILY_USAGE_CAPTURE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Sync-Secret": syncSecret
    },
    body: JSON.stringify({
      capturedAt,
      tenantVdcIds
    })
  });

  const body = await response.text().catch(() => "");
  if (!response.ok) {
    throw new Error(`daily usage capture failed: HTTP ${response.status}${body ? ` ${body}` : ""}`);
  }

  console.log(`[MANAGEONE SYNC] daily usage capture success: ${body || "ok"}`);
}

async function syncManageOneTenants() {
  const [run] = await prisma.$queryRaw`
    INSERT INTO manageone_sync_runs (started_at, status)
    VALUES (now(), 'running')
    RETURNING id
  `;
  const runId = run.id;

  try {
    const allVdcs = await listAllVdcs({ upper_vdc_id: "0", used: "true" });
    const vdcs = filterSyncTenants(allVdcs);
    const session = await authenticate();
    const obsBucketBreakdownByVdcId = await fetchObsBucketBreakdownByTenant(session, vdcs);
    const tenantUsageHistoryPayload = [];
    const syncedTenantVdcIds = [];
    const syncedAt = Date.now();

    if (SYNC_TENANT_FILTER) {
      console.log(
        `[MANAGEONE SYNC] tenant filter active: ${SYNC_TENANT_FILTER}; selected ${vdcs.length}/${allVdcs.length} tenant(s)`
      );
    }

    for (let index = 0; index < vdcs.length; index += 1) {
      const vdc = vdcs[index];
      console.log(`[MANAGEONE SYNC] syncing tenant ${index + 1}/${vdcs.length}: ${vdc.name || vdc.id}`);
      const extra = parseExtra(vdc.extra);
      let resourceUsagePayload = null;
      let resourceUsage = null;
      let ecsFlavorBreakdownPayload = null;
      let evsVolumeTypeBreakdownPayload = null;
      let evsDiskManagedFeeBreakdownPayload = null;
      let obsBucketBreakdownPayload = null;
      let eipBandwidthBreakdownPayload = null;
      let vpnGatewayBreakdownPayload = null;
      let cloudBastionHostBreakdownPayload = null;
      let natGatewayBreakdownPayload = null;
      let quotaBreakdownPayload = null;

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
      const obsBucketBreakdown = obsBucketBreakdownByVdcId.get(String(vdc.id)) || [];
      if (obsBucketBreakdown.length > 0) {
        const totalGb = obsGbFromBreakdown(obsBucketBreakdown) || 0;
        obsBucketBreakdownPayload = JSON.stringify(obsBucketBreakdown);
        console.log(
          `[MANAGEONE SYNC] OBS3 bucket breakdown for ${vdc.name || vdc.id}: ${obsBucketBreakdown.length} bucket(s), ${totalGb.toFixed(2)} GB`
        );
      }

      try {
        if (index > 0) {
          await delay(RESOURCE_USAGE_REQUEST_DELAY_MS);
        }

        resourceUsage = await fetchTenantResourceUsageWithRetry(vdc, session);
        resourceUsagePayload = JSON.stringify(resourceUsage);
        tenantUsageHistoryPayload.push(mapTenantUsageHistoryItem({ vdc, resourceUsage, obsBuckets: obsBucketBreakdown, syncedAt }));
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
        const evsVolumeTypeBreakdown = await fetchTenantEvsVolumeTypeBreakdown(vdc, session, resourceUsage);
        evsVolumeTypeBreakdownPayload = JSON.stringify(evsVolumeTypeBreakdown);
        evsDiskManagedFeeBreakdownPayload = JSON.stringify(evsDiskManagedFeeFromBreakdown(evsVolumeTypeBreakdown));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error || "Unknown error");
        console.error(`[MANAGEONE SYNC] EVS volume-type breakdown skipped for ${vdc.name || vdc.id}: ${message}`);
      }

      try {
        eipBandwidthBreakdownPayload = JSON.stringify(await fetchTenantEipBandwidthBreakdown(vdc, session, resourceUsage));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error || "Unknown error");
        console.error(`[MANAGEONE SYNC] EIP bandwidth breakdown skipped for ${vdc.name || vdc.id}: ${message}`);
      }

      try {
        vpnGatewayBreakdownPayload = JSON.stringify(await fetchTenantVpnGatewayBreakdown(vdc, session, resourceUsage));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error || "Unknown error");
        console.error(`[MANAGEONE SYNC] VPN Gateway breakdown skipped for ${vdc.name || vdc.id}: ${message}`);
      }

      try {
        cloudBastionHostBreakdownPayload = JSON.stringify(await fetchTenantCloudBastionHostBreakdown(vdc, session));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error || "Unknown error");
        console.error(`[MANAGEONE SYNC] Cloud Bastion Host breakdown skipped for ${vdc.name || vdc.id}: ${message}`);
      }

      try {
        const natGatewayBreakdown = await fetchTenantNatGatewayBreakdown(vdc, session);
        natGatewayBreakdownPayload = natGatewayBreakdown.count > 0 ? JSON.stringify(natGatewayBreakdown) : null;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error || "Unknown error");
        console.error(`[MANAGEONE SYNC] NAT Gateway breakdown skipped for ${vdc.name || vdc.id}: ${message}`);
      }

      try {
        quotaBreakdownPayload = JSON.stringify(await fetchTenantQuotaBreakdown(vdc, session));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error || "Unknown error");
        console.error(`[MANAGEONE SYNC] quota breakdown skipped for ${vdc.name || vdc.id}: ${message}`);
      }

      await prisma.$executeRaw`
        INSERT INTO manageone_tenants
          (vdc_id, domain_id, name, level, upper_vdc_id, enabled,
           manager_name, manager_phone, manager_email,
           ecs_used, evs_used, project_count, create_user_name,
           manageone_create_at, last_synced_at, raw_payload, resource_usage,
           ecs_flavor_breakdown, evs_volume_type_breakdown, evs_disk_managed_fee_breakdown,
           obs_bucket_breakdown, eip_bandwidth_breakdown, vpn_gateway_breakdown, cloud_bastion_host_breakdown, nat_gateway_breakdown,
           quota_breakdown)
        VALUES
          (${String(vdc.id)}, ${vdc.domain_id ?? null}, ${String(vdc.name || vdc.id)},
           ${integerOrNull(vdc.level)}, ${vdc.upper_vdc_id ?? null}, ${booleanOrNull(vdc.enabled)},
           ${extra.manager ?? null}, ${extra.phone ?? null}, ${extra.email ?? null},
           ${numberOrNull(vdc.ecs_used)}, ${numberOrNull(vdc.evs_used)}, ${integerOrNull(vdc.project_count)},
           ${vdc.create_user_name ?? null}, ${dateFromMilliseconds(vdc.create_at)}, now(),
           CAST(${rawPayload} AS jsonb), CAST(${resourceUsagePayload} AS jsonb),
           CAST(${ecsFlavorBreakdownPayload} AS jsonb), CAST(${evsVolumeTypeBreakdownPayload} AS jsonb),
           CAST(${evsDiskManagedFeeBreakdownPayload} AS jsonb), CAST(${obsBucketBreakdownPayload} AS jsonb),
           CAST(${eipBandwidthBreakdownPayload} AS jsonb),
           CAST(${vpnGatewayBreakdownPayload} AS jsonb), CAST(${cloudBastionHostBreakdownPayload} AS jsonb),
           CAST(${natGatewayBreakdownPayload} AS jsonb), CAST(${quotaBreakdownPayload} AS jsonb))
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
          evs_volume_type_breakdown = COALESCE(EXCLUDED.evs_volume_type_breakdown, manageone_tenants.evs_volume_type_breakdown),
          evs_disk_managed_fee_breakdown = COALESCE(EXCLUDED.evs_disk_managed_fee_breakdown, manageone_tenants.evs_disk_managed_fee_breakdown),
          obs_bucket_breakdown = COALESCE(EXCLUDED.obs_bucket_breakdown, manageone_tenants.obs_bucket_breakdown),
          eip_bandwidth_breakdown = COALESCE(EXCLUDED.eip_bandwidth_breakdown, manageone_tenants.eip_bandwidth_breakdown),
          vpn_gateway_breakdown = COALESCE(EXCLUDED.vpn_gateway_breakdown, manageone_tenants.vpn_gateway_breakdown),
          cloud_bastion_host_breakdown = COALESCE(EXCLUDED.cloud_bastion_host_breakdown, manageone_tenants.cloud_bastion_host_breakdown),
          nat_gateway_breakdown = COALESCE(EXCLUDED.nat_gateway_breakdown, manageone_tenants.nat_gateway_breakdown),
          quota_breakdown = COALESCE(EXCLUDED.quota_breakdown, manageone_tenants.quota_breakdown)
      `;

      syncedTenantVdcIds.push(String(vdc.id));
    }

    try {
      await pushTenantsToCrm(SYNC_TENANT_FILTER ? syncedTenantVdcIds : null);
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

    try {
      await triggerDailyUsageCaptureInCrm(syncedTenantVdcIds, syncedAt);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error || "Unknown error");
      console.error("[MANAGEONE SYNC] daily usage capture failed:", message);
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
