import { parseStringPromise, Builder } from 'xml2js';

export async function parseSoap(xml: string) {
  const parsed = await parseStringPromise(xml, { explicitArray: false });
  return parsed;
}

// Build an InformResponse; if requestId is provided, include a Header with cwmp:ID
export function buildInformResponse(requestId?: string) {
  const builder = new Builder({ headless: true });
  const envelope: any = {
    'soap-env:Envelope': {
      $: {
        'xmlns:soap-env': 'http://schemas.xmlsoap.org/soap/envelope/',
        'xmlns:cwmp': 'urn:dslforum-org:cwmp-1-0'
      }
    }
  };

  // Always include a cwmp:ID in the header; generate one if not provided.
  const id = requestId || `resp-${Math.random().toString(36).slice(-8)}`;
  envelope['soap-env:Envelope']['soap-env:Header'] = {
    'cwmp:ID': {
      $: { 'soap-env:mustUnderstand': 1 },
      _: id
    }
  };

  envelope['soap-env:Envelope']['soap-env:Body'] = {
    'cwmp:InformResponse': {
      'MaxEnvelopes': 1
    }
  };

  return builder.buildObject(envelope);
}

// Build a SOAP envelope containing a CWMP method request (methodXml is the inner method element string)
export function buildMethodRequest(methodXml: string, requestId?: string) {
  const id = requestId || `req-${Math.random().toString(36).slice(-8)}`;
  // Minimal envelope with header and method in body. methodXml is assumed to be a raw XML string.
  const envelope = `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<soap-env:Envelope xmlns:soap-env="http://schemas.xmlsoap.org/soap/envelope/" xmlns:cwmp="urn:dslforum-org:cwmp-1-0">` +
    `<soap-env:Header><cwmp:ID soap-env:mustUnderstand="1">${id}</cwmp:ID></soap-env:Header>` +
    `<soap-env:Body>${methodXml}</soap-env:Body></soap-env:Envelope>`;

  return envelope;
}
