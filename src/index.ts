import express, { Request, Response } from 'express';
import bodyParser from 'body-parser';
import { parseSoap, buildInformResponse, buildMethodRequest } from './soap';
import { upsertDevice, listDeviceParams, getDevice, setDeviceParams, loadDevices } from './store';
import http from 'http';
import https from 'https';
import crypto from 'crypto';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Debug logging function
export const debug = process.env.DEBUG_MODE === 'true' ? console.log : () => {};

// Replaced corrupted file with a clean implementation.
const app = express();
app.use(bodyParser.text({ type: ['text/*', 'application/soap+xml', 'application/xml'] }));

// HTTP Digest Authentication helper
function createDigestAuth(username: string, password: string, method: string, uri: string, realm: string, nonce: string, qop?: string): string {
  const ha1 = crypto.createHash('md5').update(`${username}:${realm}:${password}`).digest('hex');
  const ha2 = crypto.createHash('md5').update(`${method}:${uri}`).digest('hex');
  
  let response: string;
  if (qop && qop === 'auth') {
    const nc = '00000001';
    const cnonce = crypto.randomBytes(8).toString('hex');
    response = crypto.createHash('md5').update(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`).digest('hex');
    return `Digest username="${username}", realm="${realm}", nonce="${nonce}", uri="${uri}", qop=${qop}, nc=${nc}, cnonce="${cnonce}", response="${response}"`;
  } else {
    response = crypto.createHash('md5').update(`${ha1}:${nonce}:${ha2}`).digest('hex');
    return `Digest username="${username}", realm="${realm}", nonce="${nonce}", uri="${uri}", response="${response}"`;
  }
}

// Basic request logger for debugging incoming Inform/soap requests
app.use((req: Request, res: Response, next) => {
  if (req.method === 'POST') {
    try {
      debug('Incoming HTTP', req.method, req.path, 'from', req.ip || req.connection.remoteAddress);
      debug('Headers:', JSON.stringify(req.headers));
      if (req.body) {
        const snippet = (typeof req.body === 'string') ? req.body.substring(0, 2000) : JSON.stringify(req.body).substring(0, 2000);
        debug('Body (truncated 2000):', snippet);
      }
    } catch (e) {
      console.warn('Failed to log request', e);
    }
  }
  next();
});

const pendingQueue: Array<{ serial: string; methodXml: string }> = [];

app.post('/queue-method', (req: Request, res: Response) => {
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
});

app.post('/', async (req: Request, res: Response) => {
  const rawBody = req.body;
  const xmlRaw = typeof rawBody === 'string' ? rawBody : '';
  debug('Incoming HTTP POST / from', req.ip);

  // Guard: empty or non-string bodies
  if (!xmlRaw || xmlRaw.trim().length === 0) {
    debug('Empty body received on / — responding 204 No Content');
    res.status(204).send();
    return;
  }

  // Conservative sanitizer: remove backslashes that appear immediately before angle brackets or slashes
  let xml = xmlRaw;
  try {
    const sanitized = xml.replace(/\\+(?=[<>\\/])/g, '');
    if (sanitized !== xml) xml = sanitized;
  } catch (e) { /* ignore */ }

  // Attempt parse, with a single aggressive fallback that strips all backslashes if initial parse fails
  let parsed: any;
  try { parsed = await parseSoap(xml); } catch (initialErr) {
    try {
      const fallback = xml.replace(/\\+/g, '');
      parsed = await parseSoap(fallback);
      xml = fallback;
    } catch (fallbackErr) {
      console.error('XML parse failed (both attempts)');
      return res.status(400).send('Invalid XML');
    }
  }

  const findKey = (obj: any, predicate: (k: string) => boolean) => {
    if (!obj || typeof obj !== 'object') return undefined;
    for (const k of Object.keys(obj)) if (predicate(k)) return obj[k];
    return undefined;
  };

  const envelope = findKey(parsed, k => k.toLowerCase().endsWith('envelope')) || findKey(parsed, k => k.toLowerCase() === 'envelope');
  const body = envelope && (findKey(envelope, k => k.toLowerCase().endsWith('body')) || findKey(envelope, k => k.toLowerCase() === 'body'));
  const inform = body && (findKey(body, k => k.toLowerCase().endsWith('inform')) || findKey(body, k => k.toLowerCase() === 'inform'));

  let requestId: string | undefined;
  if (envelope) {
    const header = findKey(envelope, k => k.toLowerCase().endsWith('header')) || findKey(envelope, k => k.toLowerCase() === 'header');
    if (header) {
      const idNode = findKey(header, k => k.toLowerCase().endsWith('id'));
      if (idNode) requestId = (typeof idNode === 'string') ? idNode : idNode._ || idNode['#text'] || (idNode && idNode[0]);
    }
  }

  if (inform) {
    const deviceId = findKey(inform, k => k.toLowerCase().endsWith('deviceid')) || findKey(inform, k => k.toLowerCase() === 'deviceid');
    const getChild = (obj: any, name: string) => obj && findKey(obj, k => k.toLowerCase().endsWith(name.toLowerCase()));
    const serialNumber = getChild(deviceId, 'serialnumber') || getChild(deviceId, 'serial');

    let paramsMap: Record<string, any> = {};
    const parameterList = inform.ParameterList || inform['ParameterList'] || inform.parameterList || inform.parameterlist || null;
    if (parameterList) {
      const pvs = parameterList.ParameterValueStruct || parameterList.Parameter || parameterList.ParameterValue || null;
      const items = Array.isArray(pvs) ? pvs : (pvs ? [pvs] : []);
      for (const it of items) {
        const name = it.Name || it.name || it['cwmp:Name'] || it['Name'];
        const valueNode = it.Value || it.value || it['cwmp:Value'] || it['Value'];
        let val = null;
        if (valueNode) val = (typeof valueNode === 'string') ? valueNode : valueNode._ || valueNode['#text'] || valueNode;
        if (name) paramsMap[String(name)] = { value: val };
      }
    }

    if (serialNumber) {
      const serial = String(serialNumber);
      const existing = getDevice(serial);
      debug(`🔗 Device ${serial} connected (Inform received)`);
      upsertDevice({ serialNumber: serial, params: paramsMap, lastInform: new Date().toISOString() });
      
      // Check if we should do a full parameter discovery
      // Auto-discover if device is new OR has very few parameters (< 20 means incomplete discovery)
      const paramCount = existing ? Object.keys(existing.params || {}).length : 0;
      const shouldDoFullDiscovery = !existing || (req.query.discover === 'true') || paramCount < 20;

      if (!existing) {
        const connUrl = (paramsMap['Device.ManagementServer.ConnectionRequestURL'] && paramsMap['Device.ManagementServer.ConnectionRequestURL'].value) || (paramsMap['InternetGatewayDevice.ManagementServer.ConnectionRequestURL'] && paramsMap['InternetGatewayDevice.ManagementServer.ConnectionRequestURL'].value) || undefined;
        if (connUrl) {
          debug(`🔍 Starting automatic discovery for new device ${serial}`);
          
          const postSoap = (urlStr: string, envelope: string): Promise<any> => new Promise((resolve, reject) => {
            try {
              const url = new URL(urlStr);
              const lib = url.protocol === 'https:' ? https : http;
              const opts: any = { method: 'POST', headers: { 'Content-Type': 'text/xml', 'Content-Length': Buffer.byteLength(envelope, 'utf8') } };
              const r = lib.request(url, opts, (resp) => {
                const chunks: Buffer[] = [] as any;
                resp.on('data', c => chunks.push(Buffer.from(c)));
                resp.on('end', async () => {
                  const body = Buffer.concat(chunks).toString();
                  try { const parsedResp = await parseSoap(body); resolve(parsedResp); } catch (e) { reject(e); }
                });
              });
              r.on('error', (e) => reject(e));
              r.end(envelope);
            } catch (e) { reject(e); }
          });

          // Recursively discover all parameter names
          async function discoverParams(path: string): Promise<string[]> {
            const getNamesXml = `<cwmp:GetParameterNames xmlns:cwmp=\"urn:dslforum-org:cwmp-1-0\"><ParameterPath>${path}</ParameterPath><NextLevel>true</NextLevel></cwmp:GetParameterNames>`;
            const envelopeNames = buildMethodRequest(getNamesXml);
            const respNames = await postSoap(connUrl, envelopeNames);
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
                const writable = it.Writable || it.writable;
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

          (async () => {
            try {
              // Start from root
              const allParams = await discoverParams('');
              debug(`Discovered ${allParams.length} leaf parameters for device ${serial}`);
              if (allParams.length) {
                let namesXml = `<cwmp:GetParameterValues xmlns:cwmp=\"urn:dslforum-org:cwmp-1-0\">`;
                namesXml += `<ParameterNames soap-enc:arrayType=\"xsd:string[${allParams.length}]\">`;
                for (const n of allParams) namesXml += `<string>${n}</string>`;
                namesXml += `</ParameterNames></cwmp:GetParameterValues>`;
                const envelopeValues = buildMethodRequest(namesXml);
                const respValues = await postSoap(connUrl, envelopeValues);
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
              }
            } catch (e) {
              console.warn('Failed to recursively pull parameters from device', e && e.message ? e.message : e);
            }
          })();
        }
      }
      
      // Check if we should do discovery - either pending request OR auto-discovery for incomplete devices
      const pendingDiscovery = (global as any).pendingDiscovery || {};
      if (pendingDiscovery[serial] || shouldDoFullDiscovery) {
        debug(`✨ Starting full parameter discovery for device ${serial} during Inform session`);
        
        // Initialize discovery queue for this session
        if (!(global as any).discoveryQueue) (global as any).discoveryQueue = {};
        (global as any).discoveryQueue[serial] = {
          paths: [''], // Start with root
          allParams: new Set(),
          currentPath: 0
        };
        
        delete pendingDiscovery[serial]; // Remove pending flag
        
        // Start with root discovery
        const getParamNamesXml = `<cwmp:GetParameterNames xmlns:cwmp="urn:dslforum-org:cwmp-1-0">
          <ParameterPath></ParameterPath>
          <NextLevel>true</NextLevel>
        </cwmp:GetParameterNames>`;
        const respXml = buildMethodRequest(getParamNamesXml, requestId);
        res.type('application/xml').send(respXml);
        return;
      }
    }

    // Send regular Inform response if no discovery needed
    const respXml = buildInformResponse(requestId);
    res.type('application/xml').send(respXml);
    return;
  }

  // Handle GetParameterNamesResponse (part of ongoing discovery)
  const getParamNamesResponse = body && (findKey(body, k => k.toLowerCase().includes('getparameternamesresponse')));
  if (getParamNamesResponse) {
    debug('📝 Processing GetParameterNamesResponse for ongoing discovery');
    
    const discoveryQueue = (global as any).discoveryQueue || {};
    let deviceSerial = null;
    
    // Find which device this response belongs to (in real implementation you'd track this better)
    for (const serial of Object.keys(discoveryQueue)) {
      if (discoveryQueue[serial]) {
        deviceSerial = serial;
        break;
      }
    }
    
    if (deviceSerial && discoveryQueue[deviceSerial]) {
      const queue = discoveryQueue[deviceSerial];
      const parameterList = getParamNamesResponse.ParameterList || getParamNamesResponse.parameterList || {};
      const items = parameterList.ParameterInfoStruct || parameterList.Parameter || [];
      const paramArray = Array.isArray(items) ? items : (items ? [items] : []);
      
      debug(`📋 Got ${paramArray.length} parameters in response for path: ${queue.paths[queue.currentPath] || 'root'}`);
      
      const newPaths = [];
      const leafParams = [];
      
      for (const item of paramArray) {
        const name = item.Name || item.name;
        const writable = item.Writable || item.writable;
        
        if (name) {
          debug(`  📄 ${name} (writable: ${writable})`);
          
          // In TR-069: Objects end with '.' and should be explored further
          // Leaf parameters don't end with '.' regardless of Writable value
          if (name.endsWith('.')) {
            // This is definitely a branch/object - add to paths for further discovery
            newPaths.push(name);
          } else {
            // This is a leaf parameter (ends without '.')
            leafParams.push(name);
            queue.allParams.add(name);
          }
        }
      }
      
      // Add new paths to discovery queue
      queue.paths.push(...newPaths);
      queue.currentPath++;
      
      debug(`📊 Discovery progress: ${queue.allParams.size} leaf parameters found, ${queue.paths.length - queue.currentPath} paths remaining`);
      
      // Continue with next path or finish discovery
      if (queue.currentPath < queue.paths.length) {
        const nextPath = queue.paths[queue.currentPath];
        debug(`🔍 Discovering next path: ${nextPath}`);
        
        const getParamNamesXml = `<cwmp:GetParameterNames xmlns:cwmp="urn:dslforum-org:cwmp-1-0">
          <ParameterPath>${nextPath}</ParameterPath>
          <NextLevel>true</NextLevel>
        </cwmp:GetParameterNames>`;
        const respXml = buildMethodRequest(getParamNamesXml, requestId);
        res.type('application/xml').send(respXml);
        return;
      } else {
        // Discovery complete! Get all parameter values
        debug(`🎉 Parameter discovery complete! Found ${queue.allParams.size} parameters. Getting values...`);
        
        const allParamsList = Array.from(queue.allParams);
        const batchSize = 50; // Reasonable batch size
        
        if (allParamsList.length > 0) {
          const batch = allParamsList.slice(0, batchSize);
          
          // Store remaining parameters for next batches
          queue.valueBatches = [];
          for (let i = 0; i < allParamsList.length; i += batchSize) {
            queue.valueBatches.push(allParamsList.slice(i, i + batchSize));
          }
          queue.currentBatch = 0;
          
          let getValuesXml = `<cwmp:GetParameterValues xmlns:cwmp="urn:dslforum-org:cwmp-1-0">`;
          getValuesXml += `<ParameterNames soap-enc:arrayType="xsd:string[${batch.length}]">`;
          for (const paramName of batch) {
            getValuesXml += `<string>${paramName}</string>`;
          }
          getValuesXml += `</ParameterNames></cwmp:GetParameterValues>`;
          
          const respXml = buildMethodRequest(getValuesXml, requestId);
          res.type('application/xml').send(respXml);
          return;
        }
      }
    }
    
    // Default response if no active discovery
    const respXml = buildInformResponse(requestId);
    res.type('application/xml').send(respXml);
    return;
  }

  // Handle GetParameterValuesResponse (getting actual parameter values)
  const getParamValuesResponse = body && (findKey(body, k => k.toLowerCase().includes('getparametervaluesresponse')));
  if (getParamValuesResponse) {
    debug('📊 Processing GetParameterValuesResponse');
    
    const discoveryQueue = (global as any).discoveryQueue || {};
    let deviceSerial = null;
    
    // Find which device this response belongs to
    for (const serial of Object.keys(discoveryQueue)) {
      if (discoveryQueue[serial] && discoveryQueue[serial].valueBatches) {
        deviceSerial = serial;
        break;
      }
    }
    
    if (deviceSerial && discoveryQueue[deviceSerial]) {
      const queue = discoveryQueue[deviceSerial];
      const parameterList = getParamValuesResponse.ParameterList || getParamValuesResponse.parameterList || {};
      const items = parameterList.ParameterValueStruct || parameterList.Parameter || [];
      const paramArray = Array.isArray(items) ? items : (items ? [items] : []);
      
      // Collect parameter values
      if (!queue.allValues) queue.allValues = {};
      
      for (const item of paramArray) {
        const name = item.Name || item.name;
        let valueNode = item.Value || item.value;
        let value = null;
        
        if (valueNode) {
          value = typeof valueNode === 'string' ? valueNode : 
                  valueNode._ || valueNode.text || valueNode['#text'];
        }
        
        if (name) {
          queue.allValues[name] = { value };
        }
      }
      
      queue.currentBatch++;
      debug(`📦 Processed batch ${queue.currentBatch}/${queue.valueBatches.length} (${paramArray.length} parameters)`);
      
      // Continue with next batch or finish
      if (queue.currentBatch < queue.valueBatches.length) {
        const nextBatch = queue.valueBatches[queue.currentBatch];
        
        let getValuesXml = `<cwmp:GetParameterValues xmlns:cwmp="urn:dslforum-org:cwmp-1-0">`;
        getValuesXml += `<ParameterNames soap-enc:arrayType="xsd:string[${nextBatch.length}]">`;
        for (const paramName of nextBatch) {
          getValuesXml += `<string>${paramName}</string>`;
        }
        getValuesXml += `</ParameterNames></cwmp:GetParameterValues>`;
        
        const respXml = buildMethodRequest(getValuesXml, requestId);
        res.type('application/xml').send(respXml);
        return;
      } else {
        // All done! Save parameters to device
        debug(`✅ FULL DISCOVERY COMPLETE! Saving ${Object.keys(queue.allValues).length} parameters for device ${deviceSerial}`);
        setDeviceParams(deviceSerial, queue.allValues);
        
        // Clean up discovery queue
        delete discoveryQueue[deviceSerial];
        
        // Send final response
        const respXml = buildInformResponse(requestId);
        res.type('application/xml').send(respXml);
        return;
      }
    }
  }

  // Default response for other SOAP messages
  const respXml = buildInformResponse(requestId);
  res.type('application/xml').send(respXml);
});

app.post('/pull-params', async (req: Request, res: Response) => {
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
});

app.get('/devices', (req: Request, res: Response) => {
  const devs = Object.keys(loadDevices()).map(k => ({ serial: k }));
  res.json(devs);
});

app.get('/device/:serial', (req: Request, res: Response) => {
  const d = getDevice(req.params.serial);
  if (!d) return res.status(404).send('not found');
  res.json(d);
});

app.get('/device/:serial/params', (req: Request, res: Response) => {
  const serial = req.params.serial;
  const offset = parseInt((req.query.offset as string) || '0');
  const limit = Math.min(1000, parseInt((req.query.limit as string) || '200'));
  const params = listDeviceParams(serial) || {};
  const keys = Object.keys(params).sort();
  const page = keys.slice(offset, offset + limit).map(k => ({ name: k, value: params[k] }));
  res.json({ total: keys.length, offset, limit: page.length, params: page });
});

// Full parameter discovery endpoint - does complete recursive parameter pull
app.post('/full-discovery', async (req: Request, res: Response) => {
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
});

// Schedule full discovery for next device connection
app.post('/schedule-discovery', async (req: Request, res: Response) => {
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
});

// Check pending discovery status
app.get('/pending-discovery', (req: Request, res: Response) => {
  const pending = (global as any).pendingDiscovery || {};
  const devices = Object.keys(pending).filter(serial => pending[serial]);
  
  res.json({
    pendingCount: devices.length,
    pendingDevices: devices,
    message: devices.length > 0 ? 
      `${devices.length} device(s) have pending full parameter discovery` :
      'No pending discoveries scheduled'
  });
});

// TR-069 Connection Request endpoint
app.post('/connection-request', async (req: Request, res: Response) => {
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
});

const port = process.env.PORT ? Number(process.env.PORT) : 7547;
const host = process.env.HOST || '0.0.0.0'; // Listen on all interfaces
loadDevices();
app.listen(port, host, () => console.log(`TR-069 server listening on ${host}:${port}`));
