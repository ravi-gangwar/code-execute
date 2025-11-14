import express from "express";
import bodyParser from "body-parser";
import { handleRun } from "./routes/run.js";

export function createApp() {
  const app = express();
  app.use(bodyParser.json({ limit: "1mb" }));
  
  app.post("/run", handleRun);
  app.get("/health", (_req, res) => res.json({ status: "ok", pid: process.pid }));
  
  return app;
}

