import { Router, Request, Response } from 'express';
import { requireAuth } from '../../auth/session';
import { getActiveSessions, getSessionStats, getSession } from './sessions';

const router = Router();

// API endpoint for devices
router.get('/devices', requireAuth, async (req: Request, res: Response) => {
  try {
    // Get the list of device serial numbers
    const response = await fetch(`http://localhost:${process.env.PORT || 7547}/devices`);
    const deviceList = await response.json();
    
    // Fetch full device data for each device
    const devicePromises = deviceList.map(async (device: any) => {
      try {
        const deviceResponse = await fetch(`http://localhost:${process.env.PORT || 7547}/device/${device.serial}`);
        return await deviceResponse.json();
      } catch (error) {
        console.error(`Error fetching device ${device.serial}:`, error);
        // Return minimal device info if individual device fetch fails
        return { serialNumber: device.serial };
      }
    });
    
    const devices = await Promise.all(devicePromises);
    res.json(devices);
  } catch (error) {
    console.error('Error fetching devices:', error);
    res.status(500).json({ error: 'Failed to fetch devices' });
  }
});

// API endpoint for device parameters
router.get('/device/:serial/params', requireAuth, async (req: Request, res: Response) => {
  try {
    const response = await fetch(`http://localhost:${process.env.PORT || 7547}/device/${req.params.serial}/params`);
    const params = await response.json();
    res.json(params);
  } catch (error) {
    console.error('Error fetching device params:', error);
    res.status(500).json({ error: 'Failed to fetch device parameters' });
  }
});

// API endpoint to set device parameters
router.post('/device/:serial/params', requireAuth, async (req: Request, res: Response) => {
  try {
    const { parameters } = req.body;
    
    if (!parameters || typeof parameters !== 'object') {
      return res.status(400).json({ error: 'Invalid parameters format' });
    }
    
    const response = await fetch(`http://localhost:${process.env.PORT || 7547}/queue-method`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serial: req.params.serial,
        method: 'SetParameterValues',
        parameters
      })
    });
    
    const result = await response.json();
    res.json(result);
  } catch (error) {
    console.error('Error setting device params:', error);
    res.status(500).json({ error: 'Failed to set device parameters' });
  }
});

// API endpoint for device actions
router.post('/device/:serial/action', requireAuth, async (req: Request, res: Response) => {
  try {
    const { action } = req.body;
    const serial = req.params.serial;
    
    let method;
    let parameters = {};
    
    switch (action) {
      case 'reboot':
        method = 'Reboot';
        break;
      case 'factory_reset':
        method = 'FactoryReset';
        break;
      case 'download':
        method = 'Download';
        parameters = req.body.parameters || {};
        break;
      case 'wifi_restart':
        method = 'SetParameterValues';
        parameters = {
          'InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.Enable': 'false'
        };
        // Note: In a real implementation, you'd also set it back to true after a delay
        break;
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
    
    const response = await fetch(`http://localhost:${process.env.PORT || 7547}/queue-method`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serial, method, parameters })
    });
    
    const result = await response.json();
    res.json(result);
  } catch (error) {
    console.error('Error executing device action:', error);
    res.status(500).json({ error: 'Failed to execute device action' });
  }
});

// Session management endpoints
router.get('/sessions', requireAuth, getActiveSessions);
router.get('/sessions/stats', requireAuth, getSessionStats);
router.get('/sessions/:serial', requireAuth, getSession);

export default router;