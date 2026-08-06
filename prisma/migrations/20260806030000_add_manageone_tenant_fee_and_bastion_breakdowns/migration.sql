ALTER TABLE "manageone_tenants"
  ADD COLUMN "evs_disk_managed_fee_breakdown" JSONB,
  ADD COLUMN "cloud_bastion_host_breakdown" JSONB;
