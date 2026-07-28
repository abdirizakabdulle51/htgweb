module.exports = {
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
    },
    {
      name: "ai-recommendations-sync",
      script: "server/jobs/generate-ai-recommendations.js",
      cron_restart: "0 4 * * 0",
      autorestart: false,
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};
