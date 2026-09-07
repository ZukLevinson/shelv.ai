import { Router } from 'express';
import { db } from '../db/database.js';
import { authenticateToken, requireRole, AuthenticatedRequest } from '../auth/authMiddleware.js';

export const userRouter = Router();

// GET /api/users - List all users with coupled holder details (Manager only)
userRouter.get('/', authenticateToken, requireRole(['manager']), (_req, res) => {
  try {
    const users = db.prepare(`
      SELECT u.id, u.email, u.name, u.role, u.holder_id, u.created_at, u.updated_at,
             h.name as holder_name, h.personal_number as holder_personal_number, h.email as holder_email, h.phone as holder_phone
      FROM users u
      LEFT JOIN inventory_holders h ON u.holder_id = h.id
      ORDER BY u.role DESC, u.created_at DESC
    `).all();

    res.json(users);
  } catch (err: any) {
    console.error('[User API] Error fetching users:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch users' });
  }
});

// PUT /api/users/:id/role - Update user role (Manager only)
userRouter.put('/:id/role', authenticateToken, requireRole(['manager']), (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const { role } = req.body;

  if (!['manager', 'inventory_owner'].includes(role)) {
    return res.status(400).json({ error: 'הרשאה לא חוקית. מותר רק manager או inventory_owner' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any;
  if (!user) {
    return res.status(404).json({ error: 'המשתמש לא נמצא' });
  }

  // Prevent demoting the last remaining manager
  if (user.role === 'manager' && role !== 'manager') {
    const managerCount = (db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'manager'").get() as any).count;
    if (managerCount <= 1) {
      return res.status(400).json({ error: 'לא ניתן להסיר הרשאת עריכה מהמשתמש האחרון במערכת' });
    }
  }

  db.prepare('UPDATE users SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(role, id);

  const updated = db.prepare(`
    SELECT u.id, u.email, u.name, u.role, u.holder_id, u.created_at, u.updated_at,
           h.name as holder_name
    FROM users u
    LEFT JOIN inventory_holders h ON u.holder_id = h.id
    WHERE u.id = ?
  `).get(id);

  res.json({ success: true, user: updated });
});

// PUT /api/users/:id/holder - Couple or uncouple user with an inventory holder
// Managers can couple any user; users can couple themselves if uncoupled
userRouter.put('/:id/holder', authenticateToken, (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const { holder_id } = req.body;

  // Authorization check: either Manager, or user coupling themselves
  const isManager = req.user?.role === 'manager';
  const isSelf = req.user?.userId === id;

  if (!isManager && !isSelf) {
    return res.status(403).json({ error: 'אין הרשאה לעדכן שיוך של משתמש אחר' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any;
  if (!user) {
    return res.status(404).json({ error: 'המשתמש לא נמצא' });
  }

  const targetHolderId = (holder_id || '').trim() || null;

  if (targetHolderId) {
    const holder = db.prepare('SELECT id, name FROM inventory_holders WHERE id = ?').get(targetHolderId) as any;
    if (!holder) {
      return res.status(400).json({ error: 'בעל המצאי שנבחר אינו קיים במערכת' });
    }
  }

  db.prepare('UPDATE users SET holder_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(targetHolderId, id);

  const updated = db.prepare(`
    SELECT u.id, u.email, u.name, u.role, u.holder_id, u.created_at, u.updated_at,
           h.name as holder_name
    FROM users u
    LEFT JOIN inventory_holders h ON u.holder_id = h.id
    WHERE u.id = ?
  `).get(id);

  res.json({ success: true, user: updated });
});

// DELETE /api/users/:id - Delete a user (Manager only)
userRouter.delete('/:id', authenticateToken, requireRole(['manager']), (req: AuthenticatedRequest, res) => {
  const { id } = req.params;

  if (req.user?.userId === id) {
    return res.status(400).json({ error: 'לא ניתן למחוק את החשבון של עצמך' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any;
  if (!user) {
    return res.status(404).json({ error: 'המשתמש לא נמצא' });
  }

  db.prepare('DELETE FROM users WHERE id = ?').run(id);

  res.json({ success: true, message: 'המשתמש הוסר בהצלחה' });
});
