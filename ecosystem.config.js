export default {
  apps: [
    {
      name: "manageone-tenant-sync",
      script: "server/jobs/sync-manageone-tenants.js",
      cron_restart: "0 3 * * *",
      autorestart: false,
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};
