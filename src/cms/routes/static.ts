import { Router, Request, Response } from 'express';
import path from 'path';

const router = Router();

// Serve JavaScript files
router.get('/dashboard-core.js', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../scripts/dashboard-core.js'));
});

router.get('/device-management.js', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../scripts/device-management.js'));
});

router.get('/device-actions.js', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../scripts/device-actions.js'));
});

router.get('/wifi-config.js', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../scripts/wifi-config.js'));
});

// Combined dashboard script
router.get('/dashboard.js', (req: Request, res: Response) => {
  const fs = require('fs');
  
  try {
    const coreScript = fs.readFileSync(path.join(__dirname, '../scripts/dashboard-core.js'), 'utf8');
    const managementScript = fs.readFileSync(path.join(__dirname, '../scripts/device-management.js'), 'utf8');
    const actionsScript = fs.readFileSync(path.join(__dirname, '../scripts/device-actions.js'), 'utf8');
    
    const combinedScript = `
// Dashboard Core Functions
${coreScript}

// Device Management Functions  
${managementScript}

// Device Actions Functions
${actionsScript}
    `;
    
    res.setHeader('Content-Type', 'application/javascript');
    res.send(combinedScript);
  } catch (error) {
    console.error('Error serving combined script:', error);
    res.status(500).send('// Error loading scripts');
  }
});

export default router;