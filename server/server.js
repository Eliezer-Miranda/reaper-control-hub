// Local Express proxy for the REAPER Web Interface.
// Run from the project root with:  npm run server
//
// The frontend (when proxyMode = "local") sends:
//   GET /proxy?path=/_/TRANSPORT
//   headers: x-reaper-host, x-reaper-port, x-reaper-password (optional)
// Headers fall back to .env values if not provided.

import express from "express";
import cors from "cors";
import "dotenv/config";

const app = express();
app.use(cors());

const ENV_HOST = process.env.REAPER_HOST || "127.0.0.1";
const ENV_PORT = process.env.REAPER_PORT || "8080";
const ENV_PASS = process.env.REAPER_PASSWORD || "";
const PORT = parseInt(process.env.PROXY_PORT || "3001", 10);

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "reaper-proxy", port: PORT });
});

app.get("/proxy", async (req, res) => {
  const host = String(req.header("x-reaper-host") || ENV_HOST);
  const port = String(req.header("x-reaper-port") || ENV_PORT);
  const password = String(req.header("x-reaper-password") || ENV_PASS);
  const path = String(req.query.path || "");

  if (!path) {
    return res.status(400).json({ error: "Missing 'path' query param" });
  }
  if (!/^[a-zA-Z0-9.\-_]+$/.test(host)) {
    return res.status(400).json({ error: "Invalid host" });
  }
  const safePath = path.startsWith("/") ? path : `/${path}`;
  const url = `http://${host}:${port}${safePath}`;

  const headers = {};
  if (password) {
    headers["Authorization"] = "Basic " + Buffer.from(`:${password}`).toString("base64");
  }

  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 3000);

  try {
    const r = await fetch(url, { method: "GET", headers, signal: ctrl.signal });
    const body = await r.text();
    clearTimeout(timeout);
    res.json({ status: r.status, ok: r.ok, body });
  } catch (err) {
    clearTimeout(timeout);
    res.status(504).json({
      status: 0,
      ok: false,
      body: "",
      error: "REAPER unreachable",
      detail: err && err.message ? err.message : String(err),
    });
  }
});

app.listen(PORT, () => {
  console.log(`▶ REAPER proxy escutando em http://localhost:${PORT}`);
  console.log(`  Default REAPER target: http://${ENV_HOST}:${ENV_PORT}`);
});
