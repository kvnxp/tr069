import dotenv from 'dotenv';
import { app, startServer } from './server';
import { loadDevices } from './store';

// TR-069 Routes
import { getDevices, getDeviceBySerial, getDeviceParams } from './routes/devices';
import { pullParams, fullDiscovery, scheduleDiscovery, getPendingDiscovery } from './routes/discovery';
import { connectionRequest } from './routes/connection';
import { queueMethod } from './routes/queue';
import { handleSoapRequest } from './routes/soap';

// CMS Routes
import cmsRouter from './cms';

// Load environment variables from .env file
dotenv.config();

// CMS Routes (must come before TR-069 routes to avoid conflicts)
app.use('/cms', cmsRouter);

// TR-069 API Routes  
app.get('/devices', getDevices);
app.get('/device/:serial', getDeviceBySerial);
app.get('/device/:serial/params', getDeviceParams);

app.post('/pull-params', pullParams);
app.post('/full-discovery', fullDiscovery);
app.post('/schedule-discovery', scheduleDiscovery);
app.get('/pending-discovery', getPendingDiscovery);

app.post('/connection-request', connectionRequest);

app.post('/queue-method', queueMethod);

// TR-069 SOAP endpoint (catch-all for device connections)
app.post('/', handleSoapRequest);

const port = process.env.PORT ? Number(process.env.PORT) : 7547;
const host = process.env.HOST || '0.0.0.0'; // Listen on all interfaces
loadDevices();
startServer(port, host);
