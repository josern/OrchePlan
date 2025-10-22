import { Router } from 'express';
import { signup, login, me, logout, changePassword } from '../controllers/auth';
import { authMiddleware } from '../middleware/auth';
import { sanitizeInput } from '../middleware/validation';
import { validateSignup, validateLogin, validateChangePassword } from '../middleware/validationSchemas';

const router = Router();

// Apply sanitization to all routes
router.use(sanitizeInput);

router.post('/signup', validateSignup, signup);
router.post('/login', validateLogin, login);
router.get('/me', authMiddleware, me);
router.post('/logout', logout);
router.post('/change-password', authMiddleware, validateChangePassword, changePassword);

export default router;
