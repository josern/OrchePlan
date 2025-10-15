import { Router, Application, Request, Response } from 'express';
import { IndexController } from '../controllers/index';

const router = Router();
const indexController = new IndexController({
    getAllItems: async () => []
} as any);

export default function setRoutes(app: Application) {
        app.use('/', router);
        router.get('/', (req: Request, res: Response) => res.json({ ok: true }));
        // Add more routes as needed
}