import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { authenticate, listAllVdcs } from "../manageone.js";

const prisma = new PrismaClient();
const DEFAULT_MANAGEONE_BASE_URL = "https://10.20.24.9:26335/rest/vdc";
const RESOURCE_USAGE_REQUEST_DELAY_MS = 500;

function parseExtra(value) {
  if (!value) return {};
  if (typeof value === "object") return value;

  try {
    return JSON.parse(value);
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

function mapTenantForCrm(tenant) {
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
    ecsUsed: numberOrNull(tenant.ecs_used),
    evsUsed: numberOrNull(tenant.evs_used),
    projectCount: tenant.project_count,
    resources: flattenResourceUsage(tenant.resource_usage)
  };
}

async function loadSyncedTenantsForCrm() {
  return prisma.$queryRaw`
    SELECT
      vdc_id, domain_id, name, level, upper_vdc_id, enabled,
      manager_name, manager_phone, manager_email,
      ecs_used, evs_used, project_count, resource_usage
    FROM manageone_tenants
    ORDER BY name ASC
  `;
}

async function fetchTenantResourceUsage(vdcId, session) {
  const baseUrl = stripTrailingSlash(process.env.MANAGEONE_BASE_URL || DEFAULT_MANAGEONE_BASE_URL);
  const url = `${baseUrl}/v3.0/capacity/${encodeURIComponent(vdcId)}/statics?inherit=true`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json, text/plain, */*",
      "X-Auth-Token": session.token
    },
    redirect: "manual"
  });
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}${text ? ` ${text}` : ""}`);
  }

  return text ? JSON.parse(text) : {};
}

async function pushTenantsToCrm() {
  const syncUrl = process.env.CRM_SYNC_URL;
  const syncSecret = process.env.CRM_SYNC_SECRET;

  if (!syncUrl || !syncSecret) {
    console.warn("[MANAGEONE SYNC] CRM push skipped: CRM_SYNC_URL or CRM_SYNC_SECRET is not configured");
    return;
  }

  const tenants = await loadSyncedTenantsForCrm();
  const payload = tenants.map(mapTenantForCrm);
  const response = await fetch(syncUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Sync-Secret": syncSecret
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`CRM sync failed: HTTP ${response.status}${body ? ` ${body}` : ""}`);
  }

  console.log(`[MANAGEONE SYNC] CRM push success: ${payload.length} tenant(s) sent`);
}

async function syncManageOneTenants() {
  const [run] = await prisma.$queryRaw`
    INSERT INTO manageone_sync_runs (started_at, status)
    VALUES (now(), 'running')
    RETURNING id
  `;
  const runId = run.id;

  try {
    const vdcs = await listAllVdcs({ upper_vdc_id: "0", used: "true" });
    const session = await authenticate();

    for (let index = 0; index < vdcs.length; index += 1) {
      const vdc = vdcs[index];
      const extra = parseExtra(vdc.extra);
      const rawPayload = JSON.stringify(vdc);
      let resourceUsagePayload = null;

      try {
        if (index > 0) {
          await delay(RESOURCE_USAGE_REQUEST_DELAY_MS);
        }

        resourceUsagePayload = JSON.stringify(await fetchTenantResourceUsage(vdc.id, session));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error || "Unknown error");
        console.error(`[MANAGEONE SYNC] resource usage skipped for ${vdc.name || vdc.id}: ${message}`);
      }

      await prisma.$executeRaw`
        INSERT INTO manageone_tenants
          (vdc_id, domain_id, name, level, upper_vdc_id, enabled,
           manager_name, manager_phone, manager_email,
           ecs_used, evs_used, project_count, create_user_name,
           manageone_create_at, last_synced_at, raw_payload, resource_usage)
        VALUES
          (${String(vdc.id)}, ${vdc.domain_id ?? null}, ${String(vdc.name || vdc.id)},
           ${integerOrNull(vdc.level)}, ${vdc.upper_vdc_id ?? null}, ${booleanOrNull(vdc.enabled)},
           ${extra.manager ?? null}, ${extra.phone ?? null}, ${extra.email ?? null},
           ${numberOrNull(vdc.ecs_used)}, ${numberOrNull(vdc.evs_used)}, ${integerOrNull(vdc.project_count)},
           ${vdc.create_user_name ?? null}, ${dateFromMilliseconds(vdc.create_at)}, now(),
           CAST(${rawPayload} AS jsonb), CAST(${resourceUsagePayload} AS jsonb))
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
          resource_usage = COALESCE(EXCLUDED.resource_usage, manageone_tenants.resource_usage)
      `;
    }

    try {
      await pushTenantsToCrm();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error || "Unknown error");
      console.error("[MANAGEONE SYNC] CRM push failed:", message);
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
