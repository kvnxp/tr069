import { Request, Response } from 'express';
import http from 'http';
import https from 'https';
import { getDevice } from '../store';
import { debug, createDigestAuth } from '../auth';

export const connectionRequest = async (req: Request, res: Response) => {
  const serial = (req.query.serial as string) || '';
  if (!serial) return res.status(400).json({ error: 'Serial number required' });

  const device = getDevice(serial);
  if (!device) return res.status(404).json({ error: 'Device not found', serial });

  const connUrl = device.params && (
    device.params['Device.ManagementServer.ConnectionRequestURL']?.value ||
    device.params['InternetGatewayDevice.ManagementServer.ConnectionRequestURL']?.value
  );
  if (!connUrl) return res.status(400).json({ error: 'No ConnectionRequestURL available', serial });

  const username = (device as any).username || 'admin';
  const password = (device as any).password || 'admin';

  try {
    debug(`Sending Connection Request to device ${serial} at ${connUrl}`);

    const url = new URL(connUrl);
    const lib = url.protocol === 'https:' ? https : http;

    // First request to get auth challenge
    const initialOpts = {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml',
        'Content-Length': '0'
      }
    };

    const result = await new Promise<{status: number, body: string}>((resolve, reject) => {
      const req = lib.request(url, initialOpts, (resp) => {
        if (resp.statusCode === 401 && resp.headers['www-authenticate']) {
          // Parse auth challenge and retry with credentials
          const wwwAuth = resp.headers['www-authenticate'];
          const realm = wwwAuth.match(/realm="([^"]+)"/)?.[1] || 'HuaweiHomeGateway';
          const nonce = wwwAuth.match(/nonce="([^"]+)"/)?.[1] || '';
          const qop = wwwAuth.match(/qop="?([^",\s]+)"?/)?.[1];

          debug(`Got auth challenge: realm="${realm}", nonce="${nonce}"`);

          const authHeader = createDigestAuth(username, password, 'POST', url.pathname, realm, nonce, qop);
          const authOpts = {
            method: 'POST',
            headers: {
              'Content-Type': 'text/xml',
              'Content-Length': '0',
              'Authorization': authHeader
            }
          };

          const req2 = lib.request(url, authOpts, (resp2) => {
            let chunks: Buffer[] = [];
            resp2.on('data', c => chunks.push(Buffer.from(c)));
            resp2.on('end', () => {
              const body = Buffer.concat(chunks).toString();
              resolve({ status: resp2.statusCode || 0, body });
            });
          });
          req2.on('error', reject);
          req2.setTimeout(10000, () => {
            req2.destroy();
            reject(new Error('Timeout'));
          });
          req2.end();
        } else {
          let chunks: Buffer[] = [];
          resp.on('data', c => chunks.push(Buffer.from(c)));
          resp.on('end', () => {
            const body = Buffer.concat(chunks).toString();
            resolve({ status: resp.statusCode || 0, body });
          });
        }
      });
      req.on('error', reject);
      req.setTimeout(10000, () => {
        req.destroy();
        reject(new Error('Timeout'));
      });
      req.end();
    });

    debug(`Connection Request response: ${result.status}`);

    if (result.status === 200) {
      res.json({
        success: true,
        message: `Connection Request sent successfully to device ${serial}`,
        status: result.status,
        suggestion: 'Device should connect to ACS soon. Try pull-params in a few seconds.'
      });
    } else if (result.status === 503) {
      res.json({
        success: false,
        message: `Device ${serial} is busy (503). Connection Request acknowledged but device cannot connect right now.`,
        status: result.status,
        suggestion: 'Device is busy. Try again in 30-60 seconds.'
      });
    } else {
      res.status(result.status).json({
        success: false,
        message: `Connection Request failed with status ${result.status}`,
        status: result.status
      });
    }
  } catch (err) {
    console.error('Connection Request failed:', err);
    res.status(500).json({
      error: 'Connection Request failed',
      message: (err as Error).message,
      serial
    });
  }
};