// Session management for multi-device TR-069 discovery
// Keeps track of active device sessions to prevent interference

export interface DeviceSession {
  deviceId: string;
  serial: string;
  startTime: number;
  lastActivity: number;
  status: 'discovering' | 'idle' | 'active';
  discoveryState?: {
    pathQueue: string[];
    currentBatch: number;
    totalBatches: number;
    parametersFound: number;
  };
}

class SessionManager {
  private sessions: Map<string, DeviceSession> = new Map();
  private readonly SESSION_TIMEOUT = 300000; // 5 minutes

  // Create or update session for device
  createOrUpdateSession(serial: string, deviceId: string, status: DeviceSession['status'] = 'active'): DeviceSession {
    const now = Date.now();
    const existing = this.sessions.get(serial);
    
    if (existing) {
      existing.lastActivity = now;
      existing.status = status;
      return existing;
    }

    const session: DeviceSession = {
      deviceId,
      serial,
      startTime: now,
      lastActivity: now,
      status,
    };

    this.sessions.set(serial, session);
    console.log(`📱 Created session for device ${serial} (${deviceId})`);
    return session;
  }

  // Get active session for device
  getSession(serial: string): DeviceSession | undefined {
    const session = this.sessions.get(serial);
    if (!session) return undefined;
    
    // Check if session is expired
    if (Date.now() - session.lastActivity > this.SESSION_TIMEOUT) {
      console.log(`⏰ Session expired for device ${serial}`);
      this.sessions.delete(serial);
      return undefined;
    }
    
    return session;
  }

  // Update discovery state for a session
  setDiscoveryState(serial: string, state: DeviceSession['discoveryState']): void {
    const session = this.getSession(serial);
    if (session) {
      session.discoveryState = state;
      session.lastActivity = Date.now();
      session.status = 'discovering';
    }
  }

  // Complete discovery for a session
  completeDiscovery(serial: string): void {
    const session = this.getSession(serial);
    if (session) {
      session.status = 'idle';
      session.discoveryState = undefined;
      session.lastActivity = Date.now();
      console.log(`✅ Discovery completed for device ${serial}`);
    }
  }

  // Check if device is currently in discovery
  isDiscovering(serial: string): boolean {
    const session = this.getSession(serial);
    return session?.status === 'discovering' && !!session.discoveryState;
  }

  // Get all active sessions
  getActiveSessions(): DeviceSession[] {
    return Array.from(this.sessions.values()).filter(session => 
      Date.now() - session.lastActivity <= this.SESSION_TIMEOUT
    );
  }

  // Clean up expired sessions
  cleanup(): void {
    const now = Date.now();
    const expired: string[] = [];
    
    for (const [serial, session] of this.sessions) {
      if (now - session.lastActivity > this.SESSION_TIMEOUT) {
        expired.push(serial);
      }
    }
    
    for (const serial of expired) {
      console.log(`🗑️ Cleaning up expired session for ${serial}`);
      this.sessions.delete(serial);
    }
  }

  // Remove session
  removeSession(serial: string): void {
    if (this.sessions.delete(serial)) {
      console.log(`🚪 Removed session for device ${serial}`);
    }
  }

  // Get session stats
  getStats(): { total: number; discovering: number; idle: number; active: number } {
    const sessions = this.getActiveSessions();
    return {
      total: sessions.length,
      discovering: sessions.filter(s => s.status === 'discovering').length,
      idle: sessions.filter(s => s.status === 'idle').length,
      active: sessions.filter(s => s.status === 'active').length,
    };
  }
}

// Singleton instance
export const sessionManager = new SessionManager();

// Periodic cleanup
setInterval(() => {
  sessionManager.cleanup();
}, 60000); // Clean up every minute