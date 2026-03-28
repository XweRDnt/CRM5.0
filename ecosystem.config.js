module.exports = {
  apps: [
    {
      name: "video-crm-mvp",
      script: "npm",
      args: "run start -- --hostname 127.0.0.1 --port 3000",
      cwd: "/var/www/video-crm-mvp",
      max_memory_restart: "512M",
      restart_delay: 3000,
    },
    {
      name: "video-crm-worker",
      script: "npx",
      args: "tsx lib/jobs/index.ts",
      cwd: "/var/www/video-crm-mvp",
      max_memory_restart: "256M",
      restart_delay: 5000,
    },
  ],
};
