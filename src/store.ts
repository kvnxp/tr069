import fs from 'fs';
import path from 'path';

const DATA_DIR = path.resolve(__dirname, '..', 'data');
const DEVICES_FILE = path.join(DATA_DIR, 'devices.json');

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
