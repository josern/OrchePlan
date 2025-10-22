import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import util from 'util';
import { json } from 'body-parser';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import csrf from '@dr.pogodin/csurf';
import setRoutes from './routes/index';
import authRoutes from './routes/auth';
import projectsRoutes from './routes/projects';
import tasksRoutes from './routes/tasks';
import usersRoutes from './routes/users';
import realtimeRoutes from './routes/realtime';
import { logger, requestLoggingMiddleware } from './utils/logger';
import { sanitizeInput } from './middleware/validation';
import { 
  threatDetectionMiddleware, 
  adaptiveRateLimit, 
  behaviorLoggingMiddleware,
  authThreatDetection 
} from './middleware/threatDetection';

dotenv.config();

// Environment validation for production
if (process.env.NODE_ENV === 'production') {
    const requiredEnvVars = ['JWT_SECRET', 'DATABASE_URL'];
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
        logger.error('Missing required environment variables for production', {
            component: 'startup',
            missingVars
        });
        process.exit(1);
    }
    
    if (process.env.JWT_SECRET === 'dev-secret') {
        logger.error('JWT_SECRET must be changed from default value in production', {
            component: 'startup'
        });
        process.exit(1);
    }
}

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// Configure trust proxy for proper client IP detection
// This is essential for rate limiting to work correctly with reverse proxies
if (process.env.NODE_ENV === 'production') {
    // In production, trust first proxy (load balancer/reverse proxy)
    app.set('trust proxy', 1);
    logger.info('Trust proxy enabled for production environment', {
        component: 'proxy',
        trustProxy: 1
    });
} else {
    // In development, trust loopback and local addresses for testing
    app.set('trust proxy', 'loopback');
    logger.info('Trust proxy enabled for development environment', {
        component: 'proxy', 
        trustProxy: 'loopback'
    });
}

// Security headers with Helmet

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
        },
    },
    crossOriginEmbedderPolicy: false, // Allow cross-origin requests
    hsts: {
        maxAge: 31536000, // 1 year in seconds
        includeSubDomains: true, // Apply to all subdomains
        preload: true // Enable HSTS preloading
    }
}));

// Rate limiting
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.NODE_ENV === 'test' ? 100 : 5, // More lenient for testing
    message: 'Too many authentication attempts, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});

// Apply rate limiting (skip auth rate limiting in test environment)
app.use(generalLimiter);
if (process.env.NODE_ENV !== 'test') {
    app.use('/auth', authLimiter);
}
app.use('/auth', authThreatDetection);

// Middleware
app.use(json({ limit: '10mb' })); // Limit request size
// parse cookies
app.use(cookieParser());
// Enable CORS for the frontend app. Allow credentials (cookies) and configurable origins.
// Simplified CORS for debugging - be more permissive in development
app.use(cors({
    origin: (origin, callback) => {
        // allow requests with no origin (like curl or server-to-server)
        if (!origin) return callback(null, true);


        // In development, be very permissive
        if (process.env.NODE_ENV !== 'production') {
            logger.debug('CORS: Origin allowed (development mode)', { origin, component: 'cors' });
            return callback(null, true);
        }

        // For production, still check explicitly configured origins
        const FRONTEND_ORIGINS = (process.env.FRONTEND_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
        if (FRONTEND_ORIGINS.includes(origin)) {
            logger.debug('CORS: Origin allowed (configured)', { origin, component: 'cors' });
            return callback(null, true);
        }

        logger.warn('CORS: Blocked origin', { origin, component: 'cors' });
        return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With', 'X-CSRF-Token'],
    optionsSuccessStatus: 200,
}));

// Use the proper request logging middleware
app.use(requestLoggingMiddleware());

// Threat detection middleware (before other middlewares)
app.use(threatDetectionMiddleware);

// Adaptive rate limiting based on threat level
app.use(adaptiveRateLimit);

// Behavior logging for pattern analysis
app.use(behaviorLoggingMiddleware);

// Global input sanitization (applies to all routes)
app.use(sanitizeInput);

// CSRF Protection
const csrfProtection = csrf({
    cookie: {
        key: '_csrf',
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        maxAge: 3600000, // 1 hour
    },
    // More secure CSRF configuration - protect critical operations in all environments
    ignoreMethods: ['GET', 'HEAD', 'OPTIONS'], // Only ignore safe HTTP methods
});

// Create selective CSRF protection for critical operations
const criticalOperationCSRF = (req: Request, res: Response, next: NextFunction) => {
    // Critical operations that always need CSRF protection
    const criticalPaths = [
        '/auth/',               // Authentication operations
        '/admin/',              // Admin operations  
        '/users/',              // User management
        '/projects/',           // Project creation/deletion
        '/tasks/',              // Task creation/editing/deletion
        '/statuses/'            // Status management
    ];

    const isCriticalOperation = criticalPaths.some(path => req.url.startsWith(path));
    const isStateChanging = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method);

    if (isCriticalOperation && isStateChanging) {
        // Always apply CSRF protection to critical operations
        return csrfProtection(req, res, next);
    }

    // For non-critical operations in development, skip CSRF
    if (process.env.NODE_ENV !== 'production') {
        return next();
    }

    // In production, apply CSRF to all state-changing operations
    return csrfProtection(req, res, next);
};

// Apply selective CSRF protection
app.use(criticalOperationCSRF);

logger.info('CSRF protection configured', { 
    component: 'csrf',
    mode: process.env.NODE_ENV === 'production' ? 'full-protection' : 'critical-operations-only',
    protectedPaths: ['/api/auth/', '/api/admin/', '/api/users/', '/api/projects/', '/api/statuses/']
});

// CSRF token endpoint - frontend can call this to get a token
app.get('/csrf-token', (req, res) => {
    // Apply CSRF protection to the token endpoint itself
    csrfProtection(req, res, () => {
        res.json({ 
            csrfToken: req.csrfToken(),
            message: 'CSRF token generated successfully'
        });
    });
});

// Mount routes through the main router
setRoutes(app);

app.listen(PORT, '0.0.0.0', () => {
    logger.info('Server started successfully', {
        component: 'server',
        port: PORT,
        host: '0.0.0.0',
        environment: process.env.NODE_ENV || 'development'
    });
    
    logger.info('Server access URLs', {
        component: 'server',
        urls: [
            `http://0.0.0.0:${PORT}`,
            `http://localhost:${PORT}`,
            ...(process.env.NODE_ENV !== 'production' 
                ? [`https://3000--main--orcheplan--andreas.coder.josern.com`] 
                : [])
        ]
    });
});

// Global error handler: map errors with a `status` property to HTTP responses
app.use((err: any, req: any, res: any, next: any) => {
    const correlationId = req.correlationId;
    
    if (err && err.status) {
        logger.warn('HTTP error response', {
            component: 'error-handler',
            correlationId,
            status: err.status,
            message: err.message,
            method: req.method,
            url: req.url
        });
        return res.status(err.status).json({ error: err.message || 'Error' });
    }
    
    logger.error('Unhandled server error', {
        component: 'error-handler',
        correlationId,
        method: req.method,
        url: req.url,
        userAgent: req.get('User-Agent'),
        ip: req.ip
    }, err);
    
    res.status(500).json({ error: 'Internal server error' });
});