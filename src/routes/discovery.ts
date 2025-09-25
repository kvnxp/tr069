import { Request, Response } from 'express';
import http from 'http';
import https from 'https';
import { getDevice, setDeviceParams } from '../store';
import { buildMethodRequest, parseSoap } from '../soap';
import { debug, createDigestAuth } from '../auth';

export const pullParams = async (req: Request, res: Response) => {
  const serial = (req.query.serial as string) || '000000';
  const connOverride = (req.query.connUrl as string) || undefined;
  const device = getDevice(serial);
  if (!device) return res.status(404).json({ error: 'Device not found', serial });

  const connUrl = connOverride || ((device.params && (device.params['Device.ManagementServer.ConnectionRequestURL']?.value || device.params['InternetGatewayDevice.ManagementServer.ConnectionRequestURL']?.value)) || undefined);
  if (!connUrl) return res.status(400).json({ error: 'No ConnectionRequestURL available for device', serial });

  // Get credentials from device data first, fallback to query params, then defaults
  const username = (device as any).username || (req.query.username as string) || 'admin';
  const password = (device as any).password || (req.query.password as string) || 'admin';

  debug(`Attempting parameter pull for device ${serial}`);
  debug(`Using ConnectionRequestURL: ${connUrl}`);
  debug(`Using credentials: ${username}:${'*'.repeat(password.length)}`);

  try {
    debug(`Attempting to pull parameters from device ${serial} using URL: ${connUrl}`);
    debug(`Using credentials: ${username}:${password}`);

    const postSoap = (urlStr: string, envelope: string, username: string = 'admin', password: string = 'admin'): Promise<any> => {
      return new Promise((resolve, reject) => {
        try {
          debug(`Making SOAP request to: ${urlStr}`);
          const url = new URL(urlStr);
          const lib = url.protocol === 'https:' ? https : http;

          // First attempt without auth to get the challenge
          const opts: any = { method: 'POST', headers: { 'Content-Type': 'text/xml', 'Content-Length': Buffer.byteLength(envelope, 'utf8') } };
          const r = lib.request(url, opts, (resp) => {
            debug(`Response received with status: ${resp.statusCode}`);

            if (resp.statusCode === 401) {
              // Handle Digest Authentication
              const wwwAuth = resp.headers['www-authenticate'];
              if (wwwAuth && wwwAuth.includes('Digest')) {
                debug(`Device requires authentication: ${wwwAuth}`);

                // Parse the WWW-Authenticate header
                const realm = wwwAuth.match(/realm="([^"]+)"/)?.[1] || '';
                const nonce = wwwAuth.match(/nonce="([^"]+)"/)?.[1] || '';
                const qop = wwwAuth.match(/qop="?([^",\s]+)"?/)?.[1];

                debug(`Parsed auth: realm="${realm}", nonce="${nonce}", qop="${qop}"`);

                // Create digest auth header
                const authHeader = createDigestAuth(username, password, 'POST', url.pathname, realm, nonce, qop);
                debug(`Using auth header: ${authHeader}`);

                // Retry with authentication
                const authOpts = {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'text/xml',
                    'Content-Length': Buffer.byteLength(envelope, 'utf8'),
                    'Authorization': authHeader
                  }
                };

                const r2 = lib.request(url, authOpts, (resp2) => {
                  debug(`Authenticated response status: ${resp2.statusCode}`);
                  let chunks: Buffer[] = [];
                  resp2.on('data', c => chunks.push(Buffer.from(c)));
                  resp2.on('end', async () => {
                    const body = Buffer.concat(chunks).toString();
                    debug(`Response body length: ${body.length} chars`);
                    if (resp2.statusCode === 200) {
                      try {
                        const parsedResp = await parseSoap(body);
                        resolve(parsedResp);
                      } catch (e) {
                        console.error('SOAP parse error:', e);
                        reject(e);
                      }
                    } else if (resp2.statusCode === 401) {
                      console.error(`Invalid credentials for device. Status: ${resp2.statusCode}`);
                      reject(new Error(`INVALID_CREDENTIALS`));
                    } else if (resp2.statusCode === 403) {
                      console.error(`Access forbidden for device. Status: ${resp2.statusCode}`);
                      reject(new Error(`ACCESS_FORBIDDEN`));
                    } else {
                      console.error(`Auth failed with status ${resp2.statusCode}: ${body}`);
                      reject(new Error(`AUTH_FAILED_${resp2.statusCode}`));
                    }
                  });
                });
                r2.on('error', (e) => {
                  console.error(`Auth request error:`, e.message);
                  reject(e);
                });
                r2.end(envelope);
              } else {
                reject(new Error('Unknown authentication method required'));
              }
            } else {
              // No auth needed or different response
              let chunks: Buffer[] = [];
              resp.on('data', c => chunks.push(Buffer.from(c)));
              resp.on('end', async () => {
                const body = Buffer.concat(chunks).toString();
                debug(`Response body length: ${body.length} chars`);

                if (resp.statusCode === 503) {
                  console.error(`Device unavailable (503 Service Unavailable). Device may be busy or not ready.`);
                  reject(new Error(`DEVICE_UNAVAILABLE`));
                } else if (resp.statusCode === 404) {
                  console.error(`Connection Request URL not found (404). URL may be incorrect.`);
                  reject(new Error(`CONNECTION_URL_NOT_FOUND`));
                } else if (resp.statusCode === 200) {
                  try {
                    const parsedResp = await parseSoap(body);
                    resolve(parsedResp);
                  } catch (e) {
                    console.error('SOAP parse error:', e);
                    reject(e);
                  }
                } else {
                  console.error(`Unexpected response status: ${resp.statusCode}`);
                  reject(new Error(`UNEXPECTED_STATUS_${resp.statusCode}`));
                }
              });
            }
          });
          r.on('error', (e) => {
            console.error(`Connection error to ${urlStr}:`, e.message);
            reject(e);
          });
          r.end(envelope);
        } catch (e) {
          console.error('Request setup error:', e);
          reject(e);
        }
      });
    };

    // Recursively discover all parameter names
    async function discoverParams(path: string): Promise<string[]> {
      const getNamesXml = `<cwmp:GetParameterNames xmlns:cwmp=\"urn:dslforum-org:cwmp-1-0\"><ParameterPath>${path}</ParameterPath><NextLevel>true</NextLevel></cwmp:GetParameterNames>`;
      const envelopeNames = buildMethodRequest(getNamesXml);
      const respNames = await postSoap(connUrl, envelopeNames, username, password);
      const env = respNames?.['soap-env:Envelope'] || respNames?.Envelope || respNames?.['soap:Envelope'];
      const bodyResp = env && (env['soap-env:Body'] || env.Body || env['soap:Body']);
      const namesResp = bodyResp && (bodyResp['cwmp:GetParameterNamesResponse'] || bodyResp.GetParameterNamesResponse);
      const paramList = namesResp && (namesResp.ParameterList || namesResp.ParameterList);
      let result: string[] = [];
      if (paramList) {
        const items = paramList.ParameterInfoStruct || paramList.Parameter || [];
        const arr = Array.isArray(items) ? items : [items];
        for (const it of arr) {
          const nm = it.Name || it.name;
          const nextLevel = it.NextLevel || it.nextLevel;
          if (nm) {
            if (nextLevel === 'true' || nextLevel === true) {
              // Branch: recurse
              const children = await discoverParams(nm);
              result = result.concat(children);
            } else {
              // Leaf: add to result
              result.push(nm);
            }
          }
        }
      }
      return result;
    }

    // Start from root
    const allParams = await discoverParams('');
    debug(`Discovered ${allParams.length} leaf parameters for device ${serial}`);
    if (allParams.length) {
      let namesXml = `<cwmp:GetParameterValues xmlns:cwmp=\"urn:dslforum-org:cwmp-1-0\">`;
      namesXml += `<ParameterNames soap-enc:arrayType=\"xsd:string[${allParams.length}]\">`;
      for (const n of allParams) namesXml += `<string>${n}</string>`;
      namesXml += `</ParameterNames></cwmp:GetParameterValues>`;
      const envelopeValues = buildMethodRequest(namesXml);
      const respValues = await postSoap(connUrl, envelopeValues, username, password);
      const env2 = respValues?.['soap-env:Envelope'] || respValues?.Envelope || respValues?.['soap:Envelope'];
      const body2 = env2 && (env2['soap-env:Body'] || env2.Body || env2['soap:Body']);
      const valsResp = body2 && (body2['cwmp:GetParameterValuesResponse'] || body2.GetParameterValuesResponse);
      const pList = valsResp && valsResp.ParameterList;
      const paramValues: Record<string, any> = {};
      if (pList) {
        const items2 = pList.ParameterValueStruct || pList.Parameter || [];
        const arr2 = Array.isArray(items2) ? items2 : [items2];
        for (const it of arr2) {
          const nm = it.Name || it.name;
          let valNode = it.Value || it.value;
          let v = null;
          if (valNode) v = typeof valNode === 'string' ? valNode : valNode._ || valNode.text || valNode['#text'];
          if (nm) paramValues[nm] = { value: v };
        }
        setDeviceParams(serial, paramValues);
        debug(`Persisted ${Object.keys(paramValues).length} parameter values for device ${serial}`);
      }
      return res.json({ ok: true, pulled: true });
    }
    return res.json({ ok: true, pulled: false, message: 'No parameters discovered' });
  } catch (err) {
    console.error('pull-params failed', err);
    const errorMessage = (err as Error).message;

    // Handle specific authentication and connection errors
    if (errorMessage === 'INVALID_CREDENTIALS') {
      return res.status(401).json({
        error: 'Invalid credentials',
        message: `Authentication failed for device ${serial}. Please verify the username and password in the device configuration.`,
        serial,
        suggestion: 'Update device credentials in database or provide correct username/password as query parameters'
      });
    } else if (errorMessage === 'ACCESS_FORBIDDEN') {
      return res.status(403).json({
        error: 'Access forbidden',
        message: `Device ${serial} denied access with current credentials.`,
        serial
      });
    } else if (errorMessage === 'DEVICE_UNAVAILABLE') {
      return res.status(503).json({
        error: 'Device unavailable',
        message: `Device ${serial} is not responding (503 Service Unavailable). The device may be busy or not ready for CWMP requests.`,
        serial,
        suggestion: 'Try again later or check device status'
      });
    } else if (errorMessage === 'CONNECTION_URL_NOT_FOUND') {
      return res.status(404).json({
        error: 'Connection URL not found',
        message: `The ConnectionRequestURL for device ${serial} is not accessible (404 Not Found).`,
        serial,
        suggestion: 'Verify the ConnectionRequestURL is correct'
      });
    } else if (errorMessage.includes('ECONNREFUSED')) {
      return res.status(503).json({
        error: 'Connection refused',
        message: `Cannot connect to device ${serial}. Connection refused.`,
        serial,
        suggestion: 'Check if device is online and accessible at the ConnectionRequestURL'
      });
    } else {
      return res.status(500).json({
        error: 'Pull failed',
        message: `Failed to pull parameters from device ${serial}: ${errorMessage}`,
        serial
      });
    }
  }
};

export const fullDiscovery = async (req: Request, res: Response) => {
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

  debug(`Starting FULL parameter discovery for device ${serial}`);
  debug(`This will recursively discover ALL available parameters...`);

  try {
    const postSoap = (urlStr: string, envelope: string, user: string = username, pass: string = password): Promise<any> => {
      return new Promise((resolve, reject) => {
        try {
          debug(`Making SOAP request to: ${urlStr}`);
          const url = new URL(urlStr);
          const lib = url.protocol === 'https:' ? https : http;

          // First attempt without auth to get the challenge
          const opts: any = { method: 'POST', headers: { 'Content-Type': 'text/xml', 'Content-Length': Buffer.byteLength(envelope, 'utf8') } };
          const r = lib.request(url, opts, (resp) => {

            if (resp.statusCode === 401) {
              // Handle Digest Authentication
              const wwwAuth = resp.headers['www-authenticate'];
              if (wwwAuth && wwwAuth.includes('Digest')) {
                debug(`Device requires authentication, using credentials...`);

                // Parse the WWW-Authenticate header
                const realm = wwwAuth.match(/realm="([^"]+)"/)?.[1] || '';
                const nonce = wwwAuth.match(/nonce="([^"]+)"/)?.[1] || '';
                const qop = wwwAuth.match(/qop="?([^",\s]+)"?/)?.[1];

                // Create digest auth header
                const authHeader = createDigestAuth(user, pass, 'POST', url.pathname, realm, nonce, qop);

                // Retry with authentication
                const authOpts = {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'text/xml',
                    'Content-Length': Buffer.byteLength(envelope, 'utf8'),
                    'Authorization': authHeader
                  }
                };

                const r2 = lib.request(url, authOpts, (resp2) => {
                  let chunks: Buffer[] = [];
                  resp2.on('data', c => chunks.push(Buffer.from(c)));
                  resp2.on('end', async () => {
                    const body = Buffer.concat(chunks).toString();
                    if (resp2.statusCode === 200) {
                      try {
                        const parsedResp = await parseSoap(body);
                        resolve(parsedResp);
                      } catch (e) {
                        console.error('SOAP parse error:', e);
                        reject(e);
                      }
                    } else if (resp2.statusCode === 503) {
                      reject(new Error('DEVICE_BUSY'));
                    } else {
                      console.error(`Auth failed with status ${resp2.statusCode}`);
                      reject(new Error(`AUTH_FAILED_${resp2.statusCode}`));
                    }
                  });
                });
                r2.on('error', reject);
                r2.end(envelope);
              } else {
                reject(new Error('Unknown authentication method required'));
              }
            } else if (resp.statusCode === 503) {
              reject(new Error('DEVICE_BUSY'));
            } else {
              // No auth needed or success
              let chunks: Buffer[] = [];
              resp.on('data', c => chunks.push(Buffer.from(c)));
              resp.on('end', async () => {
                const body = Buffer.concat(chunks).toString();
                if (resp.statusCode === 200) {
                  try {
                    const parsedResp = await parseSoap(body);
                    resolve(parsedResp);
                  } catch (e) {
                    reject(e);
                  }
                } else {
                  reject(new Error(`HTTP_${resp.statusCode}`));
                }
              });
            }
          });
          r.on('error', reject);
          r.end(envelope);
        } catch (e) {
          reject(e);
        }
      });
    };

    // Recursive parameter discovery
    async function discoverAllParams(path: string = '', depth: number = 0): Promise<string[]> {
      if (depth > 10) { // Prevent infinite recursion
        console.warn(`Max depth reached for path: ${path}`);
        return [];
      }

      debug(`${'  '.repeat(depth)}Discovering: ${path || 'root'}`);

      const getNamesXml = `<cwmp:GetParameterNames xmlns:cwmp="urn:dslforum-org:cwmp-1-0">
        <ParameterPath>${path}</ParameterPath>
        <NextLevel>true</NextLevel>
      </cwmp:GetParameterNames>`;

      const envelopeNames = buildMethodRequest(getNamesXml);
      const respNames = await postSoap(connUrl, envelopeNames, username, password);

      const env = respNames?.['soap-env:Envelope'] || respNames?.Envelope || respNames?.['soap:Envelope'];
      const bodyResp = env && (env['soap-env:Body'] || env.Body || env['soap:Body']);
      const namesResp = bodyResp && (bodyResp['cwmp:GetParameterNamesResponse'] || bodyResp.GetParameterNamesResponse);
      const paramList = namesResp && (namesResp.ParameterList || namesResp.ParameterList);

      let leafParams: string[] = [];

      if (paramList) {
        const items = paramList.ParameterInfoStruct || paramList.Parameter || [];
        const arr = Array.isArray(items) ? items : [items];

        for (const item of arr) {
          const paramName = item.Name || item.name;
          const writable = item.Writable || item.writable;

          if (paramName) {
            if (writable === 'false' || writable === false) {
              // This is a leaf parameter (readable)
              leafParams.push(paramName);
              debug(`${'  '.repeat(depth + 1)}✓ ${paramName}`);
            } else {
              // This might be a branch, recurse into it
              try {
                const childParams = await discoverAllParams(paramName, depth + 1);
                leafParams = leafParams.concat(childParams);
              } catch (e) {
                console.warn(`${'  '.repeat(depth + 1)}⚠ Failed to recurse into ${paramName}: ${e.message}`);
                // If recursion fails, treat it as a leaf
                leafParams.push(paramName);
              }
            }
          }
        }
      }

      return leafParams;
    }

    debug('=== Starting recursive parameter discovery ===');
    const allParams = await discoverAllParams();
    debug(`=== Discovered ${allParams.length} total parameters ===`);

    if (allParams.length > 0) {
      debug('Getting parameter values...');

      // Get values in batches to avoid overwhelming the device
      const batchSize = 50; // Reasonable batch size for TR-069
      const allValues: Record<string, any> = {};

      for (let i = 0; i < allParams.length; i += batchSize) {
        const batch = allParams.slice(i, i + batchSize);
        debug(`Getting values for batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(allParams.length/batchSize)} (${batch.length} params)`);

        try {
          let getValuesXml = `<cwmp:GetParameterValues xmlns:cwmp="urn:dslforum-org:cwmp-1-0">`;
          getValuesXml += `<ParameterNames soap-enc:arrayType="xsd:string[${batch.length}]">`;
          for (const paramName of batch) {
            getValuesXml += `<string>${paramName}</string>`;
          }
          getValuesXml += `</ParameterNames></cwmp:GetParameterValues>`;

          const envelopeValues = buildMethodRequest(getValuesXml);
          const respValues = await postSoap(connUrl, envelopeValues, username, password);

          const env2 = respValues?.['soap-env:Envelope'] || respValues?.Envelope || respValues?.['soap:Envelope'];
          const body2 = env2 && (env2['soap-env:Body'] || env2.Body || env2['soap:Body']);
          const valsResp = body2 && (body2['cwmp:GetParameterValuesResponse'] || body2.GetParameterValuesResponse);
          const pList = valsResp && valsResp.ParameterList;

          if (pList) {
            const items = pList.ParameterValueStruct || pList.Parameter || [];
            const arr = Array.isArray(items) ? items : [items];

            for (const item of arr) {
              const name = item.Name || item.name;
              let valueNode = item.Value || item.value;
              let value = null;
              if (valueNode) {
                value = typeof valueNode === 'string' ? valueNode : valueNode._ || valueNode.text || valueNode['#text'];
              }
              if (name) {
                allValues[name] = { value };
              }
            }
          }
        } catch (e) {
          console.warn(`Failed to get values for batch ${Math.floor(i/batchSize) + 1}: ${e.message}`);
        }
      }

      // Save all discovered parameters
      setDeviceParams(serial, allValues);
      debug(`✅ DISCOVERY COMPLETE! Saved ${Object.keys(allValues).length} parameters for device ${serial}`);

      res.json({
        success: true,
        message: `Full discovery completed for device ${serial}`,
        discovered: Object.keys(allValues).length,
        parameters: Object.keys(allValues).length > 100 ?
          `Too many to display (${Object.keys(allValues).length} total)` :
          Object.keys(allValues)
      });
    } else {
      res.json({
        success: false,
        message: `No parameters discovered for device ${serial}`,
        suggestion: 'Device may be busy or not responding to CWMP requests'
      });
    }

  } catch (err) {
    console.error('Full discovery failed:', err);
    const errorMessage = (err as Error).message;

    if (errorMessage === 'DEVICE_BUSY') {
      res.status(503).json({
        error: 'Device busy',
        message: `Device ${serial} is currently busy and cannot process CWMP requests.`,
        suggestion: 'Try again in 30-60 seconds'
      });
    } else {
      res.status(500).json({
        error: 'Discovery failed',
        message: `Full discovery failed for device ${serial}: ${errorMessage}`,
        serial
      });
    }
  }
};

export const scheduleDiscovery = async (req: Request, res: Response) => {
  const serial = (req.query.serial as string) || '';
  if (!serial) return res.status(400).json({ error: 'Serial number required' });

  const device = getDevice(serial);
  if (!device) return res.status(404).json({ error: 'Device not found', serial });

  // Initialize global pending discovery tracker
  if (!(global as any).pendingDiscovery) (global as any).pendingDiscovery = {};
  (global as any).pendingDiscovery[serial] = true;

  debug(`📋 Scheduled full parameter discovery for device ${serial} on next connection`);

  res.json({
    success: true,
    message: `Full parameter discovery scheduled for device ${serial}`,
    instruction: 'Discovery will automatically execute when the device next connects to the ACS (sends Inform)',
    suggestion: 'You can trigger an immediate connection using the /connection-request endpoint, or wait for the device to connect naturally'
  });
};

export const getPendingDiscovery = (req: Request, res: Response) => {
  const pending = (global as any).pendingDiscovery || {};
  const devices = Object.keys(pending).filter(serial => pending[serial]);

  res.json({
    pendingCount: devices.length,
    pendingDevices: devices,
    message: devices.length > 0 ?
      `${devices.length} device(s) have pending full parameter discovery` :
      'No pending discoveries scheduled'
  });
};