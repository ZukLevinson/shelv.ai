import { Request, Response, NextFunction } from 'express';
import { verifySessionToken, TokenPayload } from './authUtils.js';

export interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
}

export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ error: 'נדרשת התחברות למערכת (Authentication required)' });
  }

  const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : authHeader.trim();
  const payload = verifySessionToken(token);

  if (!payload) {
    return res.status(401).json({ error: 'פג תוקף החיבור או שהטוקן שגוי (Invalid or expired token)' });
  }

  req.user = payload;
  next();
}

export function optionalToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  if (authHeader) {
    const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : authHeader.trim();
    const payload = verifySessionToken(token);
    if (payload) {
      req.user = payload;
    }
  }
  next();
}

export function requireRole(allowedRoles: Array<'manager' | 'inventory_owner' | 'scanner'>) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'נדרשת התחברות למערכת' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: `אין לך הרשאה מתאימה לפעולה זו. נדרשת הרשאת: ${allowedRoles.join(' / ')}` 
      });
    }

    next();
  };
}
