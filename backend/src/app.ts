import express from 'express';
import cors from 'cors';
import { json } from 'body-parser';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import setRoutes from './routes/index';
import authRoutes from './routes/auth';
import projectsRoutes from './routes/projects';
import tasksRoutes from './routes/tasks';
import usersRoutes from './routes/users';
import { sanitizeInput } from './middleware/validation';

dotenv.config();

const app = express();

// Rate limiting (more lenient for testing)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.NODE_ENV === 'test' ? 100 : 5, // More lenient for testing
    message: 'Too many authentication attempts, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});

// Middleware
app.use(json({ limit: '10mb' }));
app.use(cookieParser());

// Simple CORS for testing
app.use(cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
}));

// Apply rate limiting only in non-test environments
if (process.env.NODE_ENV !== 'test') {
    app.use('/auth', authLimiter);
}

// Global input sanitization
app.use(sanitizeInput);

// Mount routes
app.use('/auth', authRoutes);
app.use('/projects', projectsRoutes);
app.use('/tasks', tasksRoutes);
app.use('/users', usersRoutes);
setRoutes(app);

export default app;