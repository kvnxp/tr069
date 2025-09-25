import { Request, Response } from 'express';
import http from 'http';
import https from 'https';
import { getDevice } from '../store';
import { buildMethodRequest } from '../soap';
import { debug } from '../auth';

const pendingQueue: Array<{ serial: string; methodXml: string }> = [];

export const queueMethod = (req: Request, res: Response) => {
  const serial = (req.query.serial as string) || '000000';
  const methodXml = req.body as string;
  if (!methodXml) return res.status(400).send('method XML required in body');
  const device = getDevice(serial);
  let connUrl: string | undefined;
  if (device) {
    connUrl = device['Device.ManagementServer.ConnectionRequestURL'] || device['InternetGatewayDevice.ManagementServer.ConnectionRequestURL'] || device.params?.['Device.ManagementServer.ConnectionRequestURL'] || device.params?.['InternetGatewayDevice.ManagementServer.ConnectionRequestURL'];
  }

  if (connUrl && typeof connUrl === 'string') {
    const envelope = buildMethodRequest(methodXml);
    try {
      const url = new URL(connUrl);
      const opts: any = { method: 'POST', headers: { 'Content-Type': 'text/xml', 'Content-Length': Buffer.byteLength(envelope, 'utf8') } };
      const lib = url.protocol === 'https:' ? https : http;
      const req2 = lib.request(url, opts, (resp) => { resp.on('data', () => {}); resp.on('end', () => {}); });
      req2.on('error', (e: any) => { console.warn('queue-method: failed to send to device', e.message || e); pendingQueue.push({ serial, methodXml }); });
      req2.end(envelope);
      return res.json({ ok: true, sent: true });
    } catch (err) {
      console.warn('queue-method: invalid ConnectionRequestURL', connUrl, err);
      pendingQueue.push({ serial, methodXml });
      return res.json({ ok: true, queued: pendingQueue.length });
    }
  }

  pendingQueue.push({ serial, methodXml });
  res.json({ ok: true, queued: pendingQueue.length });
};