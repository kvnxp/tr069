import { Request, Response } from 'express';
import { sessionManager } from '../../session-manager';

// Get all active sessions
export const getActiveSessions = (req: Request, res: Response) => {
  try {
    const sessions = sessionManager.getActiveSessions();
    res.json({
      success: true,
      sessions: sessions,
      count: sessions.length,
      timestamp: new Date().toISOString(),
      worker: process.pid
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      worker: process.pid
    });
  }
};

// Get session statistics
export const getSessionStats = (req: Request, res: Response) => {
  try {
    const stats = sessionManager.getStats();
    res.json({
      success: true,
      stats: stats,
      timestamp: new Date().toISOString(),
      worker: process.pid
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      worker: process.pid
    });
  }
};

// Get specific session
export const getSession = (req: Request, res: Response) => {
  try {
    const { serial } = req.params;
    const session = sessionManager.getSession(serial);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        error: `No active session found for device ${serial}`,
        worker: process.pid
      });
    }
    
    res.json({
      success: true,
      session: session,
      timestamp: new Date().toISOString(),
      worker: process.pid
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      worker: process.pid
    });
  }
};