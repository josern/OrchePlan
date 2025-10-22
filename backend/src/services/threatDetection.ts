import { Request } from 'express';
import { createComponentLogger } from '../utils/logger';
import prisma from './sqlClient';

const logger = createComponentLogger('ThreatDetection');

interface ThreatEvent {
  type: 'suspicious_login' | 'brute_force' | 'anomalous_behavior' | 'privilege_escalation' | 'data_exfiltration' | 'injection_attempt';
  severity: 'low' | 'medium' | 'high' | 'critical';
  ip: string;
  userAgent?: string;
  userId?: string;
  email?: string;
  details: Record<string, any>;
  timestamp: Date;
}

interface UserBehaviorPattern {
  userId: string;
  averageRequestsPerHour: number;
  commonIPs: string[];
  commonUserAgents: string[];
  usualLoginTimes: number[]; // Hours of day (0-23)
  usualEndpoints: string[];
  lastAnalyzed: Date;
}

class ThreatDetectionService {
  private suspiciousIPs = new Set<string>();
  private blockedIPs = new Set<string>();
  private userBehaviorCache = new Map<string, UserBehaviorPattern>();
  private requestCounts = new Map<string, { count: number; window: Date }>();

  // Known malicious patterns - more specific to avoid false positives
  private sqlInjectionPatterns = [
    /('.*?(union|select|insert|delete|drop|create|alter|exec|execute).*?')/i,
    /(;.*?(drop|delete|truncate|alter).*?(table|database))/i,
    /(\bunion\s+select)/i,
    /('.*?;.*?--)/i,
    /(\bor\s+1\s*=\s*1)/i,
    /(\band\s+1\s*=\s*1)/i
  ];

  private xssPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<iframe|<object|<embed|<link/gi
  ];

  private pathTraversalPatterns = [
    /\.\.\//g,
    /\.\.\\/g,
    /%2e%2e%2f/gi,
    /%2e%2e%5c/gi
  ];

  /**
   * Analyze incoming request for threats
   */
  async analyzeRequest(req: Request, userId?: string): Promise<ThreatEvent[]> {
    const threats: ThreatEvent[] = [];
    const ip = this.getClientIP(req);
    const userAgent = req.get('User-Agent') || '';
    
    // Skip analysis for blocked IPs (they shouldn't reach here anyway)
    if (this.blockedIPs.has(ip)) {
      return threats;
    }

    // 1. Check for injection attempts
    const injectionThreats = this.detectInjectionAttempts(req, ip, userAgent);
    threats.push(...injectionThreats);

    // 2. Check for brute force attacks
    const bruteForceThreats = this.detectBruteForce(ip, req.path, userAgent);
    threats.push(...bruteForceThreats);

    // 3. Check for anomalous behavior (if user is authenticated)
    if (userId) {
      const behaviorThreats = await this.detectAnomalousBehavior(userId, ip, userAgent, req);
      threats.push(...behaviorThreats);
    }

    // 4. Check for suspicious login patterns
    if (req.path.includes('/auth/')) {
      const loginThreats = this.detectSuspiciousLogin(ip, userAgent, req.body);
      threats.push(...loginThreats);
    }

    // Log and handle threats
    for (const threat of threats) {
      await this.handleThreat(threat);
    }

    return threats;
  }

  /**
   * Detect SQL injection, XSS, and path traversal attempts
   */
  private detectInjectionAttempts(req: Request, ip: string, userAgent: string): ThreatEvent[] {
    const threats: ThreatEvent[] = [];
    const inputSources = [
      JSON.stringify(req.body || {}),
      JSON.stringify(req.query || {}),
      req.path,
      userAgent
    ];

    const allInput = inputSources.join(' ');

    // SQL Injection Detection
    for (const pattern of this.sqlInjectionPatterns) {
      if (pattern.test(allInput)) {
        threats.push({
          type: 'injection_attempt',
          severity: 'high',
          ip,
          userAgent,
          details: {
            injectionType: 'sql',
            pattern: pattern.source,
            input: allInput.substring(0, 500), // Truncate for logging
            path: req.path,
            method: req.method
          },
          timestamp: new Date()
        });
        break; // One SQL injection detection per request is enough
      }
    }

    // XSS Detection
    for (const pattern of this.xssPatterns) {
      if (pattern.test(allInput)) {
        threats.push({
          type: 'injection_attempt',
          severity: 'high',
          ip,
          userAgent,
          details: {
            injectionType: 'xss',
            pattern: pattern.source,
            input: allInput.substring(0, 500),
            path: req.path,
            method: req.method
          },
          timestamp: new Date()
        });
        break;
      }
    }

    // Path Traversal Detection
    for (const pattern of this.pathTraversalPatterns) {
      if (pattern.test(allInput)) {
        threats.push({
          type: 'injection_attempt',
          severity: 'medium',
          ip,
          userAgent,
          details: {
            injectionType: 'path_traversal',
            pattern: pattern.source,
            input: allInput.substring(0, 500),
            path: req.path,
            method: req.method
          },
          timestamp: new Date()
        });
        break;
      }
    }

    return threats;
  }

  /**
   * Detect brute force attacks
   */
  private detectBruteForce(ip: string, path: string, userAgent: string): ThreatEvent[] {
    const threats: ThreatEvent[] = [];
    const now = new Date();
    const key = `${ip}:${path}`;
    
    // Get or initialize request count for this IP+path combination
    let requestData = this.requestCounts.get(key);
    if (!requestData || now.getTime() - requestData.window.getTime() > 15 * 60 * 1000) {
      // Reset window every 15 minutes
      requestData = { count: 0, window: now };
    }
    
    requestData.count++;
    this.requestCounts.set(key, requestData);

    // Thresholds for different endpoints - relaxed for development
    const thresholds = {
      '/auth/': 50, // Auth endpoints
      '/admin/': 100, // Admin endpoints
      default: 200    // General endpoints
    };

    let threshold = thresholds.default;
    for (const [pathPrefix, limit] of Object.entries(thresholds)) {
      if (path.startsWith(pathPrefix)) {
        threshold = limit;
        break;
      }
    }

    if (requestData.count > threshold) {
      threats.push({
        type: 'brute_force',
        severity: requestData.count > threshold * 2 ? 'critical' : 'high',
        ip,
        userAgent,
        details: {
          requestCount: requestData.count,
          threshold,
          path,
          windowStart: requestData.window.toISOString()
        },
        timestamp: now
      });

      // Mark IP as suspicious
      this.suspiciousIPs.add(ip);
    }

    return threats;
  }

  /**
   * Detect anomalous user behavior
   */
  private async detectAnomalousBehavior(userId: string, ip: string, userAgent: string, req: Request): Promise<ThreatEvent[]> {
    const threats: ThreatEvent[] = [];
    
    try {
      // Get or build user behavior pattern
      let pattern = this.userBehaviorCache.get(userId);
      if (!pattern || Date.now() - pattern.lastAnalyzed.getTime() > 24 * 60 * 60 * 1000) {
        pattern = await this.buildUserBehaviorPattern(userId);
        this.userBehaviorCache.set(userId, pattern);
      }

      const currentHour = new Date().getHours();

      // Check for unusual IP
      if (pattern.commonIPs.length > 0 && !pattern.commonIPs.includes(ip)) {
        threats.push({
          type: 'anomalous_behavior',
          severity: 'medium',
          ip,
          userAgent,
          userId,
          details: {
            anomalyType: 'unusual_ip',
            userCommonIPs: pattern.commonIPs,
            currentIP: ip
          },
          timestamp: new Date()
        });
      }

      // Check for unusual login time
      if (pattern.usualLoginTimes.length > 0) {
        const isUsualTime = pattern.usualLoginTimes.some(hour => 
          Math.abs(hour - currentHour) <= 2 // Within 2 hours of usual time
        );
        
        if (!isUsualTime) {
          threats.push({
            type: 'anomalous_behavior',
            severity: 'low',
            ip,
            userAgent,
            userId,
            details: {
              anomalyType: 'unusual_time',
              usualHours: pattern.usualLoginTimes,
              currentHour
            },
            timestamp: new Date()
          });
        }
      }

      // Check for unusual user agent
      if (pattern.commonUserAgents.length > 0 && !pattern.commonUserAgents.includes(userAgent)) {
        threats.push({
          type: 'anomalous_behavior',
          severity: 'low',
          ip,
          userAgent,
          userId,
          details: {
            anomalyType: 'unusual_user_agent',
            userCommonAgents: pattern.commonUserAgents,
            currentAgent: userAgent
          },
          timestamp: new Date()
        });
      }

      // Check for privilege escalation attempts
      if (req.path.startsWith('/admin/') && req.method !== 'GET') {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { role: true, email: true }
        });

        if (user && user.role !== 'admin' && user.role !== 'superuser') {
          threats.push({
            type: 'privilege_escalation',
            severity: 'critical',
            ip,
            userAgent,
            userId,
            email: user.email,
            details: {
              userRole: user.role,
              attemptedPath: req.path,
              method: req.method
            },
            timestamp: new Date()
          });
        }
      }

    } catch (error) {
      logger.error('Error in anomalous behavior detection', { userId, error });
    }

    return threats;
  }

  /**
   * Detect suspicious login patterns
   */
  private detectSuspiciousLogin(ip: string, userAgent: string, body: any): ThreatEvent[] {
    const threats: ThreatEvent[] = [];

    if (body && body.email) {
      // Check for credential stuffing (multiple emails from same IP)
      const emailKey = `emails:${ip}`;
      let emailSet = this.requestCounts.get(emailKey);
      if (!emailSet) {
        emailSet = { count: 0, window: new Date() };
      }

      // Reset window every hour
      if (Date.now() - emailSet.window.getTime() > 60 * 60 * 1000) {
        emailSet = { count: 0, window: new Date() };
      }

      emailSet.count++;
      this.requestCounts.set(emailKey, emailSet);

      if (emailSet.count > 20) { // More than 20 different emails from same IP
        threats.push({
          type: 'suspicious_login',
          severity: 'high',
          ip,
          userAgent,
          details: {
            suspicionType: 'credential_stuffing',
            emailAttempts: emailSet.count,
            currentEmail: body.email
          },
          timestamp: new Date()
        });
      }

      // Check for admin account targeting
      if (body.email.includes('admin') || body.email.includes('root') || body.email.includes('superuser')) {
        threats.push({
          type: 'suspicious_login',
          severity: 'medium',
          ip,
          userAgent,
          details: {
            suspicionType: 'admin_targeting',
            targetEmail: body.email
          },
          timestamp: new Date()
        });
      }
    }

    return threats;
  }

  /**
   * Handle detected threat
   */
  private async handleThreat(threat: ThreatEvent): Promise<void> {
    // Log the threat
    logger.warn('Threat detected', {
      component: 'threat_detection',
      ...threat
    });

    // Take action based on severity
    switch (threat.severity) {
      case 'critical':
        // Block IP immediately
        this.blockedIPs.add(threat.ip);
        // Could also trigger real-time alerts here
        break;
      
      case 'high':
        // Add to suspicious list, block after multiple high threats
        this.suspiciousIPs.add(threat.ip);
        if (this.getIPThreatCount(threat.ip) >= 3) {
          this.blockedIPs.add(threat.ip);
        }
        break;
      
      case 'medium':
      case 'low':
        // Monitor and log
        this.suspiciousIPs.add(threat.ip);
        break;
    }

    // Store threat in database for analysis
    try {
      await this.storeThreatEvent(threat);
    } catch (error) {
      logger.error('Failed to store threat event', { threat, error });
    }
  }

  /**
   * Get client IP address
   */
  private getClientIP(req: Request): string {
    return req.ip || 
           req.socket.remoteAddress || 
           (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || 
           'unknown';
  }

  /**
   * Build user behavior pattern from historical data
   */
  private async buildUserBehaviorPattern(userId: string): Promise<UserBehaviorPattern> {
    // This would typically query your logs or analytics database
    // For now, return a basic pattern
    return {
      userId,
      averageRequestsPerHour: 10,
      commonIPs: [],
      commonUserAgents: [],
      usualLoginTimes: [],
      usualEndpoints: [],
      lastAnalyzed: new Date()
    };
  }

  /**
   * Get threat count for IP
   */
  private getIPThreatCount(ip: string): number {
    // Count threats for this IP in the last hour
    // This is a simplified implementation
    return Array.from(this.requestCounts.keys())
      .filter(key => key.startsWith(ip))
      .length;
  }

  /**
   * Store threat event in database
   */
  private async storeThreatEvent(threat: ThreatEvent): Promise<void> {
    // Store in your preferred format - could be a dedicated threats table
    // For now, just ensure it's logged properly
    logger.warn('Storing threat event', {
      component: 'threat_storage',
      threat: {
        type: threat.type,
        severity: threat.severity,
        ip: threat.ip,
        userId: threat.userId,
        timestamp: threat.timestamp.toISOString()
      }
    });
  }

  /**
   * Check if IP is blocked
   */
  isBlocked(ip: string): boolean {
    return this.blockedIPs.has(ip);
  }

  /**
   * Check if IP is suspicious
   */
  isSuspicious(ip: string): boolean {
    return this.suspiciousIPs.has(ip);
  }

  /**
   * Get threat statistics
   */
  async getThreatStats(): Promise<any> {
    return {
      blockedIPs: this.blockedIPs.size,
      suspiciousIPs: this.suspiciousIPs.size,
      activeMonitoring: this.requestCounts.size,
      lastUpdate: new Date().toISOString()
    };
  }

  /**
   * Unblock IP (for admin use)
   */
  unblockIP(ip: string): void {
    this.blockedIPs.delete(ip);
    this.suspiciousIPs.delete(ip);
    logger.info('IP unblocked by admin', { ip, component: 'threat_detection' });
  }

  /**
   * Clear all blocked IPs and reset threat detection
   */
  clearAllBlocks(): void {
    const blockedCount = this.blockedIPs.size;
    const suspiciousCount = this.suspiciousIPs.size;
    
    this.blockedIPs.clear();
    this.suspiciousIPs.clear();
    this.requestCounts.clear();
    
    logger.info('All IP blocks cleared by admin', { 
      previouslyBlocked: blockedCount,
      previouslySuspicious: suspiciousCount,
      component: 'threat_detection' 
    });
  }

  /**
   * Get list of blocked IPs
   */
  getBlockedIPs(): string[] {
    return Array.from(this.blockedIPs);
  }

  /**
   * Get list of suspicious IPs
   */
  getSuspiciousIPs(): string[] {
    return Array.from(this.suspiciousIPs);
  }

  /**
   * Clear old data periodically
   */
  cleanup(): void {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;

    // Clear old request counts
    for (const [key, data] of this.requestCounts.entries()) {
      if (now - data.window.getTime() > oneHour) {
        this.requestCounts.delete(key);
      }
    }

    // Clear old behavior patterns
    for (const [userId, pattern] of this.userBehaviorCache.entries()) {
      if (now - pattern.lastAnalyzed.getTime() > 24 * 60 * 60 * 1000) {
        this.userBehaviorCache.delete(userId);
      }
    }
  }
}

export const threatDetectionService = new ThreatDetectionService();

// Cleanup old data every hour
setInterval(() => {
  threatDetectionService.cleanup();
}, 60 * 60 * 1000);

export default ThreatDetectionService;