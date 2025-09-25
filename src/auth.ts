import crypto from 'crypto';

// Debug logging function
export const debug = process.env.DEBUG_MODE === 'true' ? console.log : () => {};

// HTTP Digest Authentication helper
export function createDigestAuth(username: string, password: string, method: string, uri: string, realm: string, nonce: string, qop?: string): string {
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