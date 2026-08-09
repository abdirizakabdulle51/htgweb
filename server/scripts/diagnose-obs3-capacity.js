import "dotenv/config";
import { authenticate, listAllVdcs } from "../manageone.js";

const CAPACITY_BASE_URL = (process.env.MANAGEONE_CAPACITY_BASE_URL || "https://10.20.24.9:26335").replace(
  /\/+$/,
  ""
);
const REQUEST_TIMEOUT_MS = Number(process.env.MANAGEONE_TIMEOUT_MS || 30000);
const TENANT_FILTER = String(process.env.MANAGEONE_DIAGNOSTIC_TENANT_FILTER || "").trim().toLowerCase();
const MAX_TENANTS = Number(process.env.MANAGEONE_DIAGNOSTIC_MAX_TENANTS || 0);

const REGIONS = [
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

function normalize(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function tenantMatchesFilter(vdc) {
  if (!TENANT_FILTER) return true;
  return [vdc?.name, vdc?.id, vdc?.domain_id].some((value) => String(value || "").toLowerCase().includes(TENANT_FILTER));
}

function selectTenants(vdcs) {
  const selected = vdcs.filter(tenantMatchesFilter);
  return MAX_TENANTS > 0 ? selected.slice(0, MAX_TENANTS) : selected;
}

async function fetchTextWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      redirect: "manual"
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
    throw new Error(`${label} returned invalid JSON: ${text.slice(0, 300)}`);
  }
}

async function fetchObsCapacity(region, session) {
  const url = `${CAPACITY_BASE_URL}/rest/capacity/v1/capbase/regions/${encodeURIComponent(
    region.regionId
  )}/resource-types/obs/current-capacities`;

  const { response, text } = await fetchTextWithTimeout(url, {
    method: "GET",
    headers: {
      Accept: "application/json, text/plain, */*",
      "Content-Type": "application/json",
      "X-Auth-Token": session.token
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}${text ? ` ${text.slice(0, 500)}` : ""}`);
  }

  return {
    url,
    body: parseJson(text, `OBS capacity for ${region.regionName}`)
  };
}

function obsTenantRows(body) {
  if (Array.isArray(body?.tenant)) return body.tenant;
  if (Array.isArray(body?.obs?.tenant)) return body.obs.tenant;
  if (Array.isArray(body?.OBSCapacity?.tenant)) return body.OBSCapacity.tenant;
  return [];
}

function tenantRowMatches(row, tenant) {
  const tenantKeys = [
    tenant?.name,
    tenant?.id,
    tenant?.domain_id,
    tenant?.domainId,
    tenant?.vdcId,
    tenant?.tenantName
  ].map(normalize);
  const rowKeys = [row?.tenantName, row?.tenantId, row?.vdcId, row?.domainId].map(normalize);
  return rowKeys.some((rowKey) => rowKey && tenantKeys.includes(rowKey));
}

function summarizeBucket(row) {
  return {
    tenantName: row?.tenantName ?? null,
    tenantId: row?.tenantId ?? null,
    regionName: row?.regionName ?? null,
    regionId: row?.regionId ?? null,
    bucketName: row?.bucketName ?? null,
    bucketUsed: row?.bucketUsed ?? null,
    bucketQuota: row?.bucketQuota ?? null,
    bucketUsage: row?.bucketUsage ?? null
  };
}

async function main() {
  console.log("[OBS3 CAPACITY] read-only diagnostic started");
  console.log("[OBS3 CAPACITY] no DB writes, no CRM push, no API response changes");

  const session = await authenticate();
  const vdcs = await listAllVdcs();
  const selectedTenants = selectTenants(vdcs);
  const report = {
    generatedAt: new Date().toISOString(),
    tenantFilter: TENANT_FILTER || null,
    tenantCount: selectedTenants.length,
    regions: [],
    tenants: selectedTenants.map((tenant) => ({
      id: tenant.id,
      name: tenant.name,
      domainId: tenant.domain_id ?? null,
      matches: []
    }))
  };

  for (const region of REGIONS) {
    console.log(`[OBS3 CAPACITY] probing ${region.regionName}`);
    const regionReport = {
      region,
      status: "unknown",
      requestUrl: null,
      tenantBucketRecordCount: 0,
      sampleBuckets: [],
      error: null
    };

    try {
      const { url, body } = await fetchObsCapacity(region, session);
      const rows = obsTenantRows(body).map(summarizeBucket);
      regionReport.status = "ok";
      regionReport.requestUrl = url;
      regionReport.tenantBucketRecordCount = rows.length;
      regionReport.sampleBuckets = rows.slice(0, 10);

      for (const tenantReport of report.tenants) {
        const tenant = selectedTenants.find((item) => String(item.id) === String(tenantReport.id));
        const matches = rows.filter((row) => tenantRowMatches(row, tenant));
        if (matches.length > 0) {
          tenantReport.matches.push({
            regionName: region.regionName,
            regionId: region.regionId,
            bucketCount: matches.length,
            buckets: matches
          });
        }
      }
    } catch (error) {
      regionReport.status = "error";
      regionReport.error = error instanceof Error ? error.message : String(error);
    }

    report.regions.push(regionReport);
  }

  report.tenantsWithObsBuckets = report.tenants.filter((tenant) => tenant.matches.length > 0).length;

  console.log("================ OBS3 CAPACITY DIAGNOSTIC ================");
  console.log(JSON.stringify(report, null, 2));
  console.log("================ END OBS3 CAPACITY DIAGNOSTIC ================");
}

main().catch((error) => {
  console.error("[OBS3 CAPACITY] failed:", error);
  process.exitCode = 1;
});
