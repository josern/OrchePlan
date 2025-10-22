import { Router, Application, Request, Response } from 'express';
import { IndexController } from '../controllers/index';
import adminRoutes from './admin';
import authRoutes from './auth';
import projectRoutes from './projects';
import taskRoutes from './tasks';
import userRoutes from './users';
import realtimeRoutes from './realtime';

const router = Router();
const indexController = new IndexController({
    getAllItems: async () => []
} as { getAllItems: () => Promise<unknown[]> });

export default function setRoutes(app: Application) {
        app.use('/', router);
        app.use('/auth', authRoutes);
        app.use('/admin', adminRoutes);
        app.use('/projects', projectRoutes);
        app.use('/tasks', taskRoutes);
        app.use('/users', userRoutes);
        app.use('/realtime', realtimeRoutes);
        router.get('/', (req: Request, res: Response) => res.json({ ok: true }));
        // Add more routes as needed
}