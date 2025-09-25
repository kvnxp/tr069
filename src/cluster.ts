import cluster, { Worker } from "node:cluster";
import { cpus } from "node:os";

let respawnTimestamp = 0;
let crashes: number[] = [];

function fork(): Worker {
  const w = cluster.fork();
  w.on("error", (err: NodeJS.ErrnoException) => {
    // Avoid exception when attempting to kill the process just as it's exiting
    if (err.code !== "EPIPE") throw err;
    setTimeout(() => {
      if (!w.isDead()) throw err;
    }, 50);
  });
  return w;
}

function restartWorker(worker: Worker, code: number | null, signal: string | null): void {
  const msg = {
    message: "Worker died",
    pid: worker.process?.pid,
    exitCode: code,
    signal: signal,
    timestamp: new Date().toISOString(),
  };

  console.error("🔥 Worker crashed:", msg);

  const now = Date.now();
  crashes.push(now);

  let min1 = 0,
    min2 = 0,
    min3 = 0;

  crashes = crashes.filter((n) => {
    if (n > now - 60000) ++min1;
    else if (n > now - 120000) ++min2;
    else if (n > now - 180000) ++min3;
    else return false;
    return true;
  });

  // Too many crashes in short time - exit
  if (min1 > 5 && min2 > 5 && min3 > 5) {
    process.exitCode = 1;
    cluster.removeListener("exit", restartWorker);
    for (const pid in cluster.workers) {
      cluster.workers[pid]?.kill();
    }

    console.error("💀 Too many crashes, exiting master process");
    return;
  }

  // Respawn with delay to prevent rapid cycling
  respawnTimestamp = Math.max(now, respawnTimestamp + 2000);
  if (respawnTimestamp === now) {
    console.log("🔄 Immediately respawning worker");
    fork();
    return;
  }

  setTimeout(() => {
    if (process.exitCode) return;
    console.log("🔄 Respawning worker after delay");
    fork();
  }, respawnTimestamp - now);
}

export function start(
  workerCount: number,
  servicePort: number,
  serviceAddress: string,
): void {
  console.log(`🚀 Starting TR-069 cluster with ${workerCount} workers`);

  cluster.on("listening", (worker, address) => {
    if (
      (address.addressType === 4 || address.addressType === 6) &&
      address.address === serviceAddress &&
      address.port === servicePort
    ) {
      console.log(`👷 Worker ${worker.process?.pid} listening on ${address.address}:${address.port}`);
    }
  });

  cluster.on("exit", restartWorker);

  if (!workerCount) workerCount = Math.max(2, cpus().length);

  console.log(`💻 Detected ${cpus().length} CPU cores, using ${workerCount} workers`);
  
  for (let i = 0; i < workerCount; ++i) {
    fork();
  }
}

export function stop(): void {
  console.log("🛑 Stopping all workers");
  cluster.removeListener("exit", restartWorker);
  for (const pid in cluster.workers) {
    cluster.workers[pid]?.kill();
  }
}

export const worker = cluster.worker;