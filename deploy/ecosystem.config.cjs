// PM2 process definitions for the ai-spark stack.
//
//   cd <repo root> && pm2 start deploy/ecosystem.config.cjs && pm2 save
//
// Run pm2 from the REPO ROOT — `cwd` below is resolved relative to that.
// Secrets live in backend/.env and frontend/.env (git-ignored). The backend has
// no dotenv, so we load its .env via Node's native --env-file (needs Node >= 20.6).
// Next.js loads frontend/.env itself at start, so the web app needs no node_args.
//
// The backend is ESM ("type":"module") compiled with moduleResolution "bundler",
// so tsc emits EXTENSIONLESS imports that Node's native ESM loader rejects
// (ERR_MODULE_NOT_FOUND on `node dist/index.js`). We therefore run the TS source
// directly via tsx (`node --import tsx`), which resolves those imports. Fork mode
// is used so the --import loader hook applies cleanly to the single instance.
// (Hardening later: bundle the backend with esbuild to drop the tsx runtime dep.)

module.exports = {
  apps: [
    {
      name: "ai-spark-api",
      cwd: "./backend",
      script: "src/index.ts",
      interpreter: "node", // pm2 maps .ts -> bun by default; force node + tsx loader
      node_args: "--env-file=.env --import tsx",
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      max_memory_restart: "400M",
      env: { NODE_ENV: "production" },
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
