import express from 'express';
import {
  register,
  login,
  refreshToken,
  logout
} from '../controllers/auth.js';
import { authenticate } from '../middlewares/auth.js';

const router = express.Router();

// Rotas Públicas
router.post('/register', register);
router.post('/login', login);
router.post('/refresh-token', refreshToken);

// Rotas Protegidas
router.post('/logout', authenticate, logout);

export default router;