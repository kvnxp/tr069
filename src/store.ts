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

export function setDeviceParams(serial: string, params: Record<string, any>) {
  const devices = loadDevices();
  const existing = devices[serial] || { serialNumber: serial };
  existing.params = params;
  existing.lastInform = new Date().toISOString();
  devices[serial] = existing;
  saveDevices(devices);
}

export function listDeviceParams(serial: string) {
  const d = getDevice(serial);
  if (!d || !d.params) return {};
  return d.params;
}
