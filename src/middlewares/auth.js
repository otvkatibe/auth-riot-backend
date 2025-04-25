import jwt from 'jsonwebtoken';
import User from '../models/User.js';

// Configuração do Token (deve ser igual ao do controller)
const tokenConfig = {
  access: {
    secret: process.env.JWT_SECRET
  }
};

// Middleware de Autenticação
export const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Token de acesso não fornecido',
      code: 'MISSING_TOKEN'
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, tokenConfig.access.secret);
    req.user = await User.findById(decoded.userId).select('-password -refreshToken');
    
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Usuário não encontrado',
        code: 'USER_NOT_FOUND'
      });
    }

    next();
  } catch (error) {
    console.error('Erro na autenticação:', error);

    let errorMessage = 'Token inválido';
    let errorCode = 'INVALID_TOKEN';

    if (error.name === 'TokenExpiredError') {
      errorMessage = 'Token expirado';
      errorCode = 'TOKEN_EXPIRED';
    }

    res.status(401).json({
      success: false,
      error: errorMessage,
      code: errorCode
    });
  }
};

// Middleware de Autorização (RBAC)
export const authorize = (roles = []) => {
  return (req, res, next) => {
    if (roles.length && !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Acesso não autorizado',
        code: 'FORBIDDEN',
        requiredRole: roles
      });
    }
    next();
  };
};