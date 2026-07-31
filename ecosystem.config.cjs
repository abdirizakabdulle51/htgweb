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
    },
    {
      name: "cloud-capacity-sync",
      script: "server/jobs/sync-cloud-capacity.js",
      cron_restart: "*/15 * * * *",
      autorestart: false,
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production"
      }
    },
    {
      name: "ping-monitor",
      script: "server/jobs/ping-monitor.js",
      cron_restart: "*/2 * * * *",
      autorestart: false,
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production"
      }
    },
    {
      name: "service-health-monitor",
      script: "server/jobs/service-health-monitor.js",
      cron_restart: "*/2 * * * *",
      autorestart: false,
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production"
      }
    },
    {
      name: "manageone-alarm-sync",
      script: "server/jobs/sync-manageone-alarms.js",
      cron_restart: "*/2 * * * *",
      autorestart: false,
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};
