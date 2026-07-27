CREATE TABLE "manageone_tenants" (
  "vdc_id" TEXT PRIMARY KEY,
  "domain_id" TEXT,
  "name" TEXT NOT NULL,
  "level" INTEGER,
  "upper_vdc_id" TEXT,
  "enabled" BOOLEAN,
  "manager_name" TEXT,
  "manager_phone" TEXT,
  "manager_email" TEXT,
  "ecs_used" NUMERIC,
  "evs_used" NUMERIC,
  "project_count" INTEGER,
  "create_user_name" TEXT,
  "manageone_create_at" TIMESTAMPTZ,
  "last_synced_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "raw_payload" JSONB
);

CREATE TABLE "manageone_sync_runs" (
  "id" SERIAL PRIMARY KEY,
  "started_at" TIMESTAMPTZ NOT NULL,
  "finished_at" TIMESTAMPTZ,
  "status" TEXT,
  "tenants_synced" INTEGER,
  "error_message" TEXT
);
