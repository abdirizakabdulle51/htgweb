import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { listAllVdcs } from "../manageone.js";

const prisma = new PrismaClient();

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

async function syncManageOneTenants() {
  const [run] = await prisma.$queryRaw`
    INSERT INTO manageone_sync_runs (started_at, status)
    VALUES (now(), 'running')
    RETURNING id
  `;
  const runId = run.id;

  try {
    const vdcs = await listAllVdcs({ upper_vdc_id: "0" });

    for (const vdc of vdcs) {
      const extra = parseExtra(vdc.extra);
      const rawPayload = JSON.stringify(vdc);

      await prisma.$executeRaw`
        INSERT INTO manageone_tenants
          (vdc_id, domain_id, name, level, upper_vdc_id, enabled,
           manager_name, manager_phone, manager_email,
           ecs_used, evs_used, project_count, create_user_name,
           manageone_create_at, last_synced_at, raw_payload)
        VALUES
          (${String(vdc.id)}, ${vdc.domain_id ?? null}, ${String(vdc.name || vdc.id)},
           ${integerOrNull(vdc.level)}, ${vdc.upper_vdc_id ?? null}, ${booleanOrNull(vdc.enabled)},
           ${extra.manager ?? null}, ${extra.phone ?? null}, ${extra.email ?? null},
           ${numberOrNull(vdc.ecs_used)}, ${numberOrNull(vdc.evs_used)}, ${integerOrNull(vdc.project_count)},
           ${vdc.create_user_name ?? null}, ${dateFromMilliseconds(vdc.create_at)}, now(),
           CAST(${rawPayload} AS jsonb))
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
          raw_payload = EXCLUDED.raw_payload
      `;
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
