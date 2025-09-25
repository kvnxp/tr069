import session from 'express-session';
import { Request, Response, NextFunction } from 'express';

export interface CmsSession {
  isAuthenticated: boolean;
  username?: string;
  loginTime?: string;
}

declare module 'express-session' {
  interface SessionData {
    cms: CmsSession;
  }
}

// Session configuration
export const sessionConfig = session({
  secret: process.env.CMS_SESSION_SECRET || 'tr069-cms-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true if using HTTPS
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  },
  name: 'tr069.cms.sid'
});

// Default CMS credentials (change these in production)
const CMS_USERS = {
  admin: 'admin123',
  tr069: 'cwmp2024'
};

export function authenticateUser(username: string, password: string): boolean {
  return CMS_USERS[username as keyof typeof CMS_USERS] === password;
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.cms?.isAuthenticated) {
    if (req.path.startsWith('/cms/api/')) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    return res.redirect('/cms/login');
  }
  next();
}

export function redirectIfAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (req.session.cms?.isAuthenticated) {
    return res.redirect('/cms/dashboard');
  }
  next();
}