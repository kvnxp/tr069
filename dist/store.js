"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadDevices = loadDevices;
exports.saveDevices = saveDevices;
exports.upsertDevice = upsertDevice;
exports.getDevice = getDevice;
exports.setDeviceParams = setDeviceParams;
exports.listDeviceParams = listDeviceParams;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const DATA_DIR = path_1.default.resolve(__dirname, '..', 'data');
const DEVICES_FILE = path_1.default.join(DATA_DIR, 'devices.json');
function ensureDataDir() {
    if (!fs_1.default.existsSync(DATA_DIR))
        fs_1.default.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs_1.default.existsSync(DEVICES_FILE))
        fs_1.default.writeFileSync(DEVICES_FILE, JSON.stringify({}), 'utf8');
}
function loadDevices() {
    ensureDataDir();
    try {
        const raw = fs_1.default.readFileSync(DEVICES_FILE, 'utf8');
        return JSON.parse(raw || '{}');
    }
    catch (err) {
        console.error('Failed to read devices.json', err);
        return {};
    }
}
function saveDevices(devices) {
    ensureDataDir();
    fs_1.default.writeFileSync(DEVICES_FILE, JSON.stringify(devices, null, 2), 'utf8');
}
function upsertDevice(device) {
    const devices = loadDevices();
    devices[device.serialNumber] = { ...(devices[device.serialNumber] || {}), ...device };
    saveDevices(devices);
}
function getDevice(serial) {
    const devices = loadDevices();
    return devices[serial];
}
function setDeviceParams(serial, params) {
    const devices = loadDevices();
    const existing = devices[serial] || { serialNumber: serial };
    existing.params = params;
    existing.lastInform = new Date().toISOString();
    devices[serial] = existing;
    saveDevices(devices);
}
function listDeviceParams(serial) {
    const d = getDevice(serial);
    if (!d || !d.params)
        return {};
    return d.params;
}
