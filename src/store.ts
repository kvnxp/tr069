import fs from 'fs';
import path from 'path';

const DATA_DIR = path.resolve(__dirname, '..', 'data');
const DEVICES_FILE = path.join(DATA_DIR, 'devices.json');
const LOCK_FILE = path.join(DATA_DIR, 'devices.lock');

// Simple file locking mechanism for multi-process safety
let lockPromise: Promise<void> | null = null;

export type Device = {
  serialNumber: string;
  manufacturer?: string;
  oui?: string;
  productClass?: string;
  params?: Record<string, any>;
  lastInform?: string; // ISO timestamp
  username?: string; // CWMP connection credentials
  password?: string; // CWMP connection credentials
  discover?: string; // Legacy field for backward compatibility (e.g., "completed")
  discoveryStatus?: {
    isCompleted: boolean;
    lastDiscovery?: string; // ISO timestamp of last completed discovery
    parameterCount?: number; // Number of parameters discovered
    isManual?: boolean; // Whether last discovery was manually triggered
  };
};

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DEVICES_FILE)) fs.writeFileSync(DEVICES_FILE, JSON.stringify({}), 'utf8');
}

// Acquire file lock for safe concurrent access
async function acquireLock(): Promise<() => void> {
  const maxWait = 5000; // 5 seconds max wait
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWait) {
    try {
      // Try to create lock file exclusively
      const fd = fs.openSync(LOCK_FILE, 'wx');
      fs.writeSync(fd, process.pid.toString());
      fs.closeSync(fd);
      
      // Return unlock function
      return () => {
        try {
          fs.unlinkSync(LOCK_FILE);
        } catch (e) {
          // Lock file already removed
        }
      };
    } catch (e) {
      // Lock exists, wait a bit
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }
  
  throw new Error('Could not acquire file lock within timeout');
}

// Thread-safe operation wrapper
async function withLock<T>(operation: () => T): Promise<T> {
  // Serialize lock operations
  if (lockPromise) {
    await lockPromise;
  }
  
  const unlock = await acquireLock();
  try {
    const result = operation();
    lockPromise = Promise.resolve();
    return result;
  } finally {
    unlock();
    lockPromise = null;
  }
}

export function loadDevices(): Record<string, Device> {
  ensureDataDir();
  try {
    const raw = fs.readFileSync(DEVICES_FILE, 'utf8');
    return JSON.parse(raw || '{}');
  } catch (err) {
    console.error('Failed to read devices.json', err);
    return {};
  }
}

export function saveDevices(devices: Record<string, Device>) {
  ensureDataDir();
  fs.writeFileSync(DEVICES_FILE, JSON.stringify(devices, null, 2), 'utf8');
}

export function upsertDevice(device: Device) {
  const devices = loadDevices();
  devices[device.serialNumber] = { ...(devices[device.serialNumber] || {}), ...device };
  saveDevices(devices);
}

// Thread-safe versions for multi-worker usage
export async function upsertDeviceSafe(device: Device): Promise<void> {
  return withLock(() => {
    const devices = loadDevices();
    devices[device.serialNumber] = { ...(devices[device.serialNumber] || {}), ...device };
    saveDevices(devices);
  });
}

export async function setDeviceParamsSafe(serial: string, params: Record<string, any>): Promise<void> {
  return withLock(() => {
    const devices = loadDevices();
    if (devices[serial]) {
      devices[serial].params = { ...devices[serial].params, ...params };
      saveDevices(devices);
    }
  });
}

export function getDevice(serial: string): Device | undefined {
  const devices = loadDevices();
  return devices[serial];
}

export function setDeviceParams(serial: string, params: Record<string, any>, isManual: boolean = false) {
  const devices = loadDevices();
  const existing = devices[serial] || { serialNumber: serial };
  existing.params = params;
  existing.lastInform = new Date().toISOString();
  
  // Update discovery status when parameters are set
  existing.discoveryStatus = {
    isCompleted: true,
    lastDiscovery: new Date().toISOString(),
    parameterCount: Object.keys(params).length,
    isManual: isManual
  };
  
  devices[serial] = existing;
  saveDevices(devices);
}

export function listDeviceParams(serial: string) {
  const d = getDevice(serial);
  if (!d || !d.params) return {};
  return d.params;
}

export function isDeviceDiscovered(serial: string): boolean {
  const device = getDevice(serial);
  if (!device) return false;
  
  // Check for legacy 'discover' field first (backward compatibility)
  if ((device as any).discover === 'completed') {
    // Legacy devices with discover="completed" should not auto-discover again
    return true;
  }
  
  // Check new discoveryStatus structure
  if (!device.discoveryStatus) return false;
  
  // Consider discovered if:
  // 1. Discovery is marked as completed
  // 2. Has significant number of parameters (>= 50)
  // 3. Discovery was done recently (within last 7 days) or is manual
  const status = device.discoveryStatus;
  const hasEnoughParams = (status.parameterCount || 0) >= 50;
  
  if (!status.isCompleted || !hasEnoughParams) return false;
  
  // If manual discovery, always consider as discovered until manually triggered again
  if (status.isManual) return true;
  
  // For automatic discovery, check if it's recent (within 7 days)
  if (status.lastDiscovery) {
    const lastDiscovery = new Date(status.lastDiscovery);
    const daysSinceDiscovery = (Date.now() - lastDiscovery.getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceDiscovery <= 7;
  }
  
  return false;
}

export function markDiscoveryAsManual(serial: string) {
  const devices = loadDevices();
  const existing = devices[serial];
  if (existing && existing.discoveryStatus) {
    existing.discoveryStatus.isManual = true;
    devices[serial] = existing;
    saveDevices(devices);
  }
}
