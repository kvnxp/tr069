import { Router, Request, Response } from 'express';
import { authenticateUser, redirectIfAuthenticated } from '../../auth/session';

const router = Router();

// Login form handler
router.post('/login', redirectIfAuthenticated, (req: Request, res: Response) => {
  const { username, password } = req.body;
  
  if (authenticateUser(username, password)) {
    req.session.cms = {
      isAuthenticated: true,
      username,
      loginTime: new Date().toISOString()
    };
    
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        return res.redirect('/cms/login?error=1');
      }
      res.redirect('/cms/dashboard');
    });
  } else {
    res.redirect('/cms/login?error=1');
  }
});

// Logout
router.get('/logout', (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Session destroy error:', err);
    }
    res.redirect('/cms/login');
  });
});

export default router;