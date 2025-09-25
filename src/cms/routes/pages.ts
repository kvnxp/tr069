import { Router, Request, Response } from 'express';
import { requireAuth, redirectIfAuthenticated } from '../../auth/session';
import { createLoginPage } from '../html/login';
import { createDashboardPage } from '../html/dashboard';
import { createWiFiConfigPage } from '../html/wifi-config';

const router = Router();

// Login routes
router.get('/login', redirectIfAuthenticated, (req: Request, res: Response) => {
  const errorMessage = req.query.error ? 'Credenciales inválidas' : undefined;
  res.send(createLoginPage(errorMessage));
});

// Dashboard route  
router.get('/dashboard', requireAuth, (req: Request, res: Response) => {
  const username = req.session.cms?.username || 'Usuario';
  res.send(createDashboardPage(username));
});

// WiFi Config route
router.get('/wifi/:serial', requireAuth, (req: Request, res: Response) => {
  const serial = req.params.serial;
  res.send(createWiFiConfigPage(serial));
});

// Default redirect - check authentication first
router.get('/', (req: Request, res: Response) => {
  if (req.session.cms?.isAuthenticated) {
    res.redirect('/cms/dashboard');
  } else {
    res.redirect('/cms/login');
  }
});

export default router;