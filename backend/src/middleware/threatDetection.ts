import { Request, Response, NextFunction } from 'express';
import { threatDetectionService } from '../services/threatDetection';
import { createComponentLogger } from '../utils/logger';
import { AuthedRequest } from './auth';

const logger = createComponentLogger('ThreatMiddleware');

/**
 * Middleware to analyze requests for potential threats
 */
export const threatDetectionMiddleware = async (
  req: AuthedRequest, 
  res: Response, 
  next: NextFunction
): Promise<Response | void> => {
  try {
    const startTime = Date.now();
    const ip = req.ip || req.socket.remoteAddress || 'unknown';

    // Skip threat detection in development mode
    if (process.env.NODE_ENV === 'development' || process.env.DISABLE_THREAT_DETECTION === 'true') {
      return next();
    }

    // Skip threat analysis for certain safe paths
    const safePaths = ['/health', '/favicon.ico', '/csrf-token'];
    if (safePaths.some(path => req.path.startsWith(path))) {
      return next();
    }

    // Check if IP is already blocked
    if (threatDetectionService.isBlocked(ip)) {
      logger.warn('Blocked IP attempted access', {
        ip,
        path: req.path,
        method: req.method,
        userAgent: req.get('User-Agent'),
        component: 'threat_blocking'
      });
      
      return res.status(403).json({
        error: 'Access denied',
        message: 'Your IP has been temporarily blocked due to suspicious activity'
      });
    }

    // Analyze request for threats
    const threats = await threatDetectionService.analyzeRequest(req, req.userId);

    // Add threat information to request for later use
    (req as any).threatInfo = {
      threats,
      isSuspicious: threatDetectionService.isSuspicious(ip),
      analysisTime: Date.now() - startTime
    };

    // If critical threats are detected, block immediately
    const criticalThreats = threats.filter(t => t.severity === 'critical');
    if (criticalThreats.length > 0) {
      logger.error('Critical threat detected - blocking request', {
        ip,
        threats: criticalThreats,
        path: req.path,
        method: req.method,
        component: 'threat_blocking'
      });

      return res.status(403).json({
        error: 'Request blocked',
        message: 'Potentially malicious activity detected'
      });
    }

    // For high-severity threats, add additional logging but allow request
    const highThreats = threats.filter(t => t.severity === 'high');
    if (highThreats.length > 0) {
      logger.warn('High-severity threat detected', {
        ip,
        threats: highThreats,
        path: req.path,
        method: req.method,
        userId: req.userId,
        component: 'threat_monitoring'
      });
    }

    next();
  } catch (error) {
    // Don't block requests if threat detection fails
    logger.error('Threat detection middleware error', {
      error: error instanceof Error ? error.message : String(error),
      path: req.path,
      method: req.method,
      component: 'threat_middleware'
    });
    
    next();
  }
};

/**
 * Enhanced rate limiting that considers threat level
 */
export const adaptiveRateLimit = (req: AuthedRequest, res: Response, next: NextFunction): void => {
  // Skip in development mode
  if (process.env.NODE_ENV === 'development' || process.env.DISABLE_THREAT_DETECTION === 'true') {
    return next();
  }

  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const threatInfo = (req as any).threatInfo;

  // If IP is suspicious, apply stricter rate limiting
  if (threatInfo?.isSuspicious) {
    // This would integrate with express-rate-limit
    // For now, just add headers to indicate monitoring
    res.setHeader('X-Threat-Level', 'suspicious');
    res.setHeader('X-Enhanced-Monitoring', 'active');
  }

  if (threatInfo?.threats?.length > 0) {
    res.setHeader('X-Threats-Detected', threatInfo.threats.length.toString());
  }

  next();
};

/**
 * Middleware to log successful operations for behavior analysis
 */
export const behaviorLoggingMiddleware = (
  req: AuthedRequest, 
  res: Response, 
  next: NextFunction
): void => {
  // Store original res.json to intercept responses
  const originalJson = res.json;

  res.json = function(body: any) {
    // Log successful operations for behavior pattern building
    if (res.statusCode < 400 && req.userId) {
      logger.info('User operation completed', {
        userId: req.userId,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString(),
        component: 'behavior_tracking'
      });
    }

    // Call original json method
    return originalJson.call(this, body);
  };

  next();
};

/**
 * Middleware specifically for authentication endpoints
 */
export const authThreatDetection = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<Response | void> => {
  try {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    
    // Enhanced monitoring for auth endpoints
    logger.info('Authentication attempt', {
      ip,
      path: req.path,
      method: req.method,
      userAgent: req.get('User-Agent'),
      email: req.body?.email ? req.body.email.substring(0, 20) + '***' : 'none',
      timestamp: new Date().toISOString(),
      component: 'auth_monitoring'
    });

    // Check for common attack patterns in auth
    const email = req.body?.email || '';
    const password = req.body?.password || '';

    // Detect potential credential stuffing
    if (email.length > 100 || password.length > 200) {
      logger.warn('Suspicious credential length detected', {
        ip,
        emailLength: email.length,
        passwordLength: password.length,
        component: 'auth_threat_detection'
      });
    }

    // Detect multiple rapid auth attempts (handled by rate limiter, but also log)
    const userAgent = req.get('User-Agent') || '';
    if (!userAgent || userAgent.length < 10) {
      logger.warn('Suspicious user agent in auth attempt', {
        ip,
        userAgent,
        component: 'auth_threat_detection'
      });
    }

    next();
  } catch (error) {
    logger.error('Auth threat detection error', { error, component: 'auth_threat_detection' });
    next();
  }
};

export default {
  threatDetectionMiddleware,
  adaptiveRateLimit,
  behaviorLoggingMiddleware,
  authThreatDetection
};