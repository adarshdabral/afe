// PM2 processes for running BOTH apps on one EC2 box (the self-hosted
// alternative to Vercel + Render — see DEPLOY_AWS.md).
//
//   cd <repo root> && pm2 start backend/deploy/ecosystem.config.cjs && pm2 save
//
// Run pm2 from the REPO ROOT — `cwd` below is resolved relative to that.
// Secrets: backend/.env. Frontend config: frontend/.env.local (NEXT_PUBLIC_BACKEND_URL,
// read at build time). Uploaded lesson files: backend/uploads (UPLOAD_DIR) — back it up.

module.exports = {
  apps: [
    {
      name: "ai-spark-api",
      cwd: "./backend",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 4000",
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      max_memory_restart: "600M",
      env: { NODE_ENV: "production", PORT: "4000" },
    },
    {
      name: "ai-spark-web",
      cwd: "./frontend",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      max_memory_restart: "600M",
      env: { NODE_ENV: "production", PORT: "3000" },
    },
  ],
};
