import { Request, Response } from 'express';
import { getDevice, listDeviceParams, loadDevices } from '../store';

export const getDevices = (req: Request, res: Response) => {
  const devs = Object.keys(loadDevices()).map(k => ({ serial: k }));
  res.json(devs);
};

export const getDeviceBySerial = (req: Request, res: Response) => {
  const d = getDevice(req.params.serial);
  if (!d) return res.status(404).send('not found');
  res.json(d);
};

export const getDeviceParams = (req: Request, res: Response) => {
  const serial = req.params.serial;
  const offset = parseInt((req.query.offset as string) || '0');
  const limit = Math.min(1000, parseInt((req.query.limit as string) || '200'));
  const params = listDeviceParams(serial) || {};
  const keys = Object.keys(params).sort();
  const page = keys.slice(offset, offset + limit).map(k => ({ name: k, value: params[k] }));
  res.json({ total: keys.length, offset, limit: page.length, params: page });
};