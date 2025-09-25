#!/usr/bin/env bun
import * as cluster from "./cluster";
import { cpus } from "node:os";

// Configuration - can be moved to environment variables later
const WORKER_COUNT = parseInt(process.env.TR069_WORKER_PROCESSES || "0") || Math.max(2, cpus().length);
const SERVICE_PORT = parseInt(process.env.TR069_PORT || "7547");
const SERVICE_ADDRESS = process.env.TR069_INTERFACE || "::";

function exitWorkerGracefully(): void {
  console.log("🔄 Worker shutting down gracefully");
  setTimeout(() => {
    console.log("⚡ Force exit worker");
    process.exit(1);
  }, 5000).unref();
  
  // Simple shutdown - no need to import server
  console.log("✅ Worker shut down cleanly");
  process.exit(0);
}

if (!cluster.worker) {
  // MASTER PROCESS
  console.log(`🎯 TR-069 Master Process Starting`);
  console.log(`📊 PID: ${process.pid}`);
  console.log(`🔧 Workers: ${WORKER_COUNT}`);
  console.log(`🌐 Address: ${SERVICE_ADDRESS}:${SERVICE_PORT}`);
  
  // Start cluster
  cluster.start(WORKER_COUNT, SERVICE_PORT, SERVICE_ADDRESS);

  // Graceful shutdown handlers
  process.on("SIGINT", () => {
    console.log("🛑 Received SIGINT, shutting down cluster");
    cluster.stop();
    setTimeout(() => process.exit(0), 1000);
  });

  process.on("SIGTERM", () => {
    console.log("🛑 Received SIGTERM, shutting down cluster");
    cluster.stop();
    setTimeout(() => process.exit(0), 1000);
  });

} else {
  // WORKER PROCESS
  console.log(`👷 Worker ${process.pid} starting`);
  
  // Start the server directly
  require("./index");

  // Worker shutdown handlers
  process.on("SIGINT", exitWorkerGracefully);
  process.on("SIGTERM", exitWorkerGracefully);
  
  process.on("uncaughtException", (err) => {
    if ((err as NodeJS.ErrnoException).code === "ERR_IPC_DISCONNECTED") {
      console.log("🔌 Worker disconnected from master");
      return;
    }
    console.error("💥 Uncaught exception in worker:", err);
    exitWorkerGracefully();
  });
}