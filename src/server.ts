import express, { Request, Response } from 'express';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import { debug } from './auth';
import { sessionConfig } from './auth/session';

// Replaced corrupted file with a clean implementation.
export const app = express();

// Middleware setup
app.use(cookieParser());
app.use(sessionConfig);

// Parse form data for CMS login
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Parse SOAP/XML for TR-069 protocol
app.use(bodyParser.text({ type: ['text/*', 'application/soap+xml', 'application/xml'] }));

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

export const startServer = (port: number = 7547, host: string = '0.0.0.0') => {
  app.listen(port, host, () => console.log(`TR-069 server listening on ${host}:${port}`));
};