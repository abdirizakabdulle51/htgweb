import "dotenv/config";
import { authenticate } from "../manageone.js";

const CRM_HOST_GROUPS_SYNC_URL =
  process.env.CRM_HOST_GROUPS_SYNC_URL || "https://crm-api.102-203-134-106.sslip.io/cloud-host-groups/sync";
const HOST_GROUP_REQUEST_TIMEOUT_MS = Number(process.env.MANAGEONE_TIMEOUT_MS || 30000);
const CMDB_PAGE_SIZE = Number(process.env.MANAGEONE_HOST_GROUP_CMDB_PAGE_SIZE || 200);
const PERF_HOST_CHUNK_SIZE = Number(process.env.MANAGEONE_HOST_GROUP_PERF_CHUNK_SIZE || 50);
const PHYSICAL_HOST_OBJ_TYPE_ID = 1407379178520576;
const CPU_USAGE_INDICATOR_ID = 1407379178586113;
const MEMORY_USAGE_INDICATOR_ID = 1407379178651656;
const RISK_WATCH_PERCENT = 70;
const RISK_CRITICAL_PERCENT = 85;

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function manageOneOrigin() {
  const base = process.env.MANAGEONE_AUTH_BASE_URL || process.env.MANAGEONE_BASE_URL || "https://10.20.24.9:26335";
  const url = new URL(base);
  return `${url.protocol}//${url.host}`;
}

async function fetchTextWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HOST_GROUP_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    const text = await response.text();
    return { response, text };
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`HTTP request timed out after ${HOST_GROUP_REQUEST_TIMEOUT_MS}ms`);
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
    throw new Error(`${label} returned invalid JSON`);
  }
}

function numberValue(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function stringValue(value) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function roundPercent(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

function cmdbItems(body) {
  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.objList)) return body.objList;
  if (Array.isArray(body?.instances)) return body.instances;
  if (Array.isArray(body?.data?.objList)) return body.data.objList;
  if (Array.isArray(body?.data?.instances)) return body.data.instances;
  if (Array.isArray(body?.data)) return body.data;
  return [];
}

function cmdbTotal(body, fallbackLength) {
  return (
    numberValue(body?.totalNum) ??
    numberValue(body?.total) ??
    numberValue(body?.data?.totalNum) ??
    numberValue(body?.data?.total) ??
    fallbackLength
  );
}

async function fetchCmdbInstances(session, className) {
  const origin = manageOneOrigin();
  const allItems = [];
  let pageNo = 1;
  let total = Infinity;

  while (allItems.length < total) {
    const url = `${origin}/rest/cmdb/v1/instances/${encodeURIComponent(className)}?pageSize=${CMDB_PAGE_SIZE}&pageNo=${pageNo}`;
    const { response, text } = await fetchTextWithTimeout(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Auth-Token": session.token
      }
    });

    if (!response.ok) {
      throw new Error(`ManageOne CMDB ${className} fetch failed: HTTP ${response.status}${text ? ` ${text}` : ""}`);
    }

    const body = parseJson(text, `ManageOne CMDB ${className} response`);
    const items = cmdbItems(body);
    total = cmdbTotal(body, allItems.length + items.length);
    allItems.push(...items);

    if (items.length === 0) break;
    pageNo += 1;
  }

  console.log(`[HOST GROUPS] fetched ${allItems.length} ${className} CMDB instance(s)`);
  return allItems;
}

async function fetchHostPerformance(session, hostIds) {
  const origin = manageOneOrigin();
  const performanceByHostId = new Map();

  for (let index = 0; index < hostIds.length; index += PERF_HOST_CHUNK_SIZE) {
    const chunk = hostIds.slice(index, index + PERF_HOST_CHUNK_SIZE);
    const { response, text } = await fetchTextWithTimeout(
      `${origin}/rest/performance/v1/data-svc/latest-data/action/query`,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-Auth-Token": session.token
        },
        body: JSON.stringify({
          obj_type_id: PHYSICAL_HOST_OBJ_TYPE_ID,
          indicator_ids: [CPU_USAGE_INDICATOR_ID, MEMORY_USAGE_INDICATOR_ID],
          obj_ids: chunk
        })
      }
    );

    if (!response.ok) {
      throw new Error(`ManageOne host performance fetch failed: HTTP ${response.status}${text ? ` ${text}` : ""}`);
    }

    const body = parseJson(text, "ManageOne host performance response");
    const data = body?.data && typeof body.data === "object" ? body.data : {};
    for (const [hostId, indicators] of Object.entries(data)) {
      performanceByHostId.set(hostId, {
        cpuPercent: numberValue(indicators?.[CPU_USAGE_INDICATOR_ID]?.last_collect_data),
        memoryPercent: numberValue(indicators?.[MEMORY_USAGE_INDICATOR_ID]?.last_collect_data)
      });
    }
  }

  console.log(`[HOST GROUPS] fetched latest CPU/memory metrics for ${performanceByHostId.size} host(s)`);
  return performanceByHostId;
}

function hostId(host) {
  return stringValue(host?.resId || host?.id || host?.nativeId);
}

function hostName(host) {
  return stringValue(host?.name || host?.deviceName || host?.nativeId || hostId(host));
}

function hostManageIp(host) {
  return stringValue(host?.ipAddress || host?.manageIp || host?.managementIp || host?.address);
}

function groupHostsByClusterName(hosts) {
  const grouped = new Map();
  for (const host of hosts) {
    const clusterName = stringValue(host?.clusterName || host?.cluster || host?.ownerName);
    if (!clusterName) continue;
    const current = grouped.get(clusterName) || [];
    current.push(host);
    grouped.set(clusterName, current);
  }
  return grouped;
}

function average(values) {
  const numeric = values.filter((value) => Number.isFinite(value));
  if (numeric.length === 0) return 0;
  return numeric.reduce((sum, value) => sum + value, 0) / numeric.length;
}

function maximum(values) {
  const numeric = values.filter((value) => Number.isFinite(value));
  return numeric.length > 0 ? Math.max(...numeric) : 0;
}

function worstHost(hosts, metricName) {
  let worst = null;
  for (const host of hosts) {
    const value = numberValue(host[metricName]);
    if (!Number.isFinite(value)) continue;
    if (!worst || value > worst.value) {
      worst = { host, value };
    }
  }

  if (!worst) return undefined;

  const payload = {
    hostId: worst.host.hostId,
    hostName: worst.host.hostName
  };
  if (metricName === "cpuPercent") payload.cpuPercent = roundPercent(worst.value);
  if (metricName === "memoryPercent") payload.memoryPercent = roundPercent(worst.value);
  return payload;
}

function riskForMetrics({ cpuAvgPercent, cpuMaxPercent, memoryAvgPercent, memoryMaxPercent }) {
  const checks = [
    ["CPU average", cpuAvgPercent],
    ["CPU max host", cpuMaxPercent],
    ["Memory average", memoryAvgPercent],
    ["Memory max host", memoryMaxPercent]
  ];
  const riskReasons = [];
  let riskLevel = "healthy";

  for (const [label, value] of checks) {
    if (value >= RISK_CRITICAL_PERCENT) {
      riskLevel = "critical";
      riskReasons.push(`${label} is above ${RISK_CRITICAL_PERCENT}%`);
    } else if (value >= RISK_WATCH_PERCENT) {
      if (riskLevel !== "critical") riskLevel = "watch";
      riskReasons.push(`${label} is above ${RISK_WATCH_PERCENT}%`);
    }
  }

  return {
    riskLevel,
    riskReasons
  };
}

function normalizeRegionName(cluster) {
  const value = cluster?.bizRegionName || cluster?.regionName || cluster?.logicalRegionName;
  if (typeof value === "string" && value.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(value);
      return stringValue(parsed.en_us || parsed.en_US || parsed.zh_cn || value);
    } catch {
      return value;
    }
  }
  return stringValue(value);
}

function normalizeHostGroup(cluster, hosts, performanceByHostId, syncedAt) {
  const enrichedHosts = hosts.map((host) => {
    const id = hostId(host);
    const metrics = performanceByHostId.get(id) || {};
    return {
      hostId: id,
      hostName: hostName(host),
      manageIp: hostManageIp(host),
      cpuPercent: roundPercent(numberValue(metrics.cpuPercent, 0)),
      memoryPercent: roundPercent(numberValue(metrics.memoryPercent, 0))
    };
  });

  const cpuValues = enrichedHosts.map((host) => numberValue(host.cpuPercent)).filter(Number.isFinite);
  const memoryValues = enrichedHosts.map((host) => numberValue(host.memoryPercent)).filter(Number.isFinite);
  const cpuAvgPercent = roundPercent(average(cpuValues));
  const cpuMaxPercent = roundPercent(maximum(cpuValues));
  const memoryAvgPercent = roundPercent(average(memoryValues));
  const memoryMaxPercent = roundPercent(maximum(memoryValues));
  const risk = riskForMetrics({ cpuAvgPercent, cpuMaxPercent, memoryAvgPercent, memoryMaxPercent });

  return {
    hostGroupId: stringValue(cluster?.resId || cluster?.id || cluster?.nativeId || cluster?.name),
    hostGroupName: stringValue(cluster?.name || cluster?.deviceName || cluster?.nativeId),
    regionId: stringValue(cluster?.bizRegionId || cluster?.regionId || cluster?.logicalRegionId),
    regionName: normalizeRegionName(cluster),
    azId: stringValue(cluster?.azoneId || cluster?.azId),
    azName: stringValue(cluster?.azoneName || cluster?.azName),
    resourcePoolId: stringValue(cluster?.resourcePoolId),
    resourcePoolName: stringValue(cluster?.resourcePoolName),
    hypervisorType: stringValue(cluster?.hypervisorType).toLowerCase(),
    hostCount: enrichedHosts.length,
    cpuAvgPercent,
    cpuMaxPercent,
    memoryAvgPercent,
    memoryMaxPercent,
    ...risk,
    worstCpuHost: worstHost(enrichedHosts, "cpuPercent"),
    worstMemoryHost: worstHost(enrichedHosts, "memoryPercent"),
    hosts: enrichedHosts,
    rawCluster: cluster || {},
    rawHostSample: hosts[0] || {},
    lastSyncedAt: syncedAt
  };
}

function isRelevantCluster(cluster, hosts) {
  if (hosts.length === 0) return false;
  const name = stringValue(cluster?.name || cluster?.deviceName).toLowerCase();
  if (!name) return false;
  if (name.includes("manage-aggr") || name.startsWith("_system_")) return false;
  return true;
}

async function pushHostGroupsToCrm(syncSecret, payload) {
  const { response, text } = await fetchTextWithTimeout(CRM_HOST_GROUPS_SYNC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-Sync-Secret": syncSecret
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`CRM host group sync failed: HTTP ${response.status}${text ? ` ${text}` : ""}`);
  }

  return parseJson(text, "CRM host group sync response");
}

async function main() {
  const syncSecret = requireEnv("HOST_GROUPS_SYNC_SECRET");
  const syncedAt = Date.now();
  const session = await authenticate();

  console.log("[HOST GROUPS] fetching ManageOne host group CMDB data");
  const [clusters, physicalHosts] = await Promise.all([
    fetchCmdbInstances(session, "SYS_Cluster"),
    fetchCmdbInstances(session, "SYS_PhysicalHost")
  ]);

  const hostsByClusterName = groupHostsByClusterName(physicalHosts);
  const hostIds = physicalHosts.map(hostId).filter(Boolean);
  const performanceByHostId = await fetchHostPerformance(session, hostIds);
  const hostGroups = [];

  for (const cluster of clusters) {
    const clusterName = stringValue(cluster?.name || cluster?.deviceName);
    const hosts = hostsByClusterName.get(clusterName) || [];
    if (!isRelevantCluster(cluster, hosts)) continue;
    hostGroups.push(normalizeHostGroup(cluster, hosts, performanceByHostId, syncedAt));
  }

  const result = await pushHostGroupsToCrm(syncSecret, {
    syncedAt,
    hostGroups
  });

  console.log(
    `[HOST GROUPS] completed: ${hostGroups.length} host group(s) pushed, CRM received ${
      result?.received ?? "unknown"
    }, upserted ${result?.upserted ?? "unknown"}, deactivated ${result?.deactivated ?? "unknown"}`
  );
}

main().catch((error) => {
  console.error(
    `[HOST GROUPS] failed: ${error instanceof Error ? error.stack || error.message : String(error || "Unknown error")}`
  );
  process.exitCode = 1;
});
