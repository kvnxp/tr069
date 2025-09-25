import { Request, Response } from 'express';
import { upsertDevice, listDeviceParams, getDevice, setDeviceParams, isDeviceDiscovered, upsertDeviceSafe, setDeviceParamsSafe } from '../store';
import { parseSoap, buildInformResponse, buildMethodRequest } from '../soap';
import { debug } from '../auth';
import { sessionManager } from '../session-manager';

export const handleSoapRequest = async (req: Request, res: Response) => {
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
      debug(`🔗 Device ${serial} connected (Inform received) [Worker ${process.pid}]`);
      
      // Create or update session
      const manufacturer = deviceId?.Manufacturer || deviceId?.manufacturer || 'Unknown';
      const sessionDeviceId = `${manufacturer}-${serial}`;
      sessionManager.createOrUpdateSession(serial, sessionDeviceId, 'active');
      
      // Use thread-safe upsert for multi-worker safety
      await upsertDeviceSafe({ serialNumber: serial, params: paramsMap, lastInform: new Date().toISOString() });

      // Check if we should do a full parameter discovery
      // Auto-discover only if:
      // 1. Device is completely new (never seen before)
      // 2. Explicit manual discovery requested (?discover=true)
      // 3. Device is not marked as already discovered (using smart discovery status)
      const isAlreadyDiscovered = isDeviceDiscovered(serial);
      const isManualDiscovery = req.query.discover === 'true';
      const isNewDevice = !existing;
      
      const shouldDoFullDiscovery = isNewDevice || isManualDiscovery || !isAlreadyDiscovered;

      if (!existing) {
        const connUrl = (paramsMap['Device.ManagementServer.ConnectionRequestURL'] && paramsMap['Device.ManagementServer.ConnectionRequestURL'].value) || (paramsMap['InternetGatewayDevice.ManagementServer.ConnectionRequestURL'] && paramsMap['InternetGatewayDevice.ManagementServer.ConnectionRequestURL'].value) || undefined;
        if (connUrl) {
          debug(`🔍 Starting automatic discovery for new device ${serial}`);

          // This would be complex to extract, so for now we'll skip the automatic discovery logic
          // and just handle the basic inform response
        }
      }

      // Check if we should do discovery - either pending request OR auto-discovery for new/incomplete devices
      const pendingDiscovery = (global as any).pendingDiscovery || {};
      const isCurrentlyDiscovering = sessionManager.isDiscovering(serial);
      
      if ((pendingDiscovery[serial] || shouldDoFullDiscovery) && !isCurrentlyDiscovering) {
        const discoveryReason = isManualDiscovery ? 'manual request' :
                              isNewDevice ? 'new device' :
                              !isAlreadyDiscovered ? 'incomplete discovery' :
                              'pending discovery';
        debug(`✨ Starting full parameter discovery for device ${serial} during Inform session (reason: ${discoveryReason}) [Worker ${process.pid}]`);

        // Initialize session discovery state
        sessionManager.setDiscoveryState(serial, {
          pathQueue: [''], // Start with root
          currentBatch: 0,
          totalBatches: 1,
          parametersFound: 0
        });

        // Initialize discovery queue for this session (backward compatibility)
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
        // Mark discovery as completed with the appropriate manual flag
        const wasManualDiscovery = (req.query.discover === 'true');
        setDeviceParams(deviceSerial, queue.allValues, wasManualDiscovery);

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
};