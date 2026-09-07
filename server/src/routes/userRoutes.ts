import { Router } from 'express';
import { db } from '../db/database.js';
import { authenticateToken, requireRole, AuthenticatedRequest } from '../auth/authMiddleware.js';
import { signSessionToken } from '../auth/authUtils.js';

export const userRouter = Router();

// GET /api/users - List all users with coupled holder details (Manager only)
userRouter.get('/', authenticateToken, requireRole(['manager']), (_req, res) => {
  try {
    const users = db.prepare(`
      SELECT u.id, u.email, u.name, u.role, u.is_manager, u.personal_number, u.holder_id, u.onboarding_completed, u.created_at, u.updated_at,
             h.name as holder_name, h.personal_number as holder_personal_number, h.email as holder_email, h.phone as holder_phone
      FROM users u
      LEFT JOIN inventory_holders h ON u.holder_id = h.id
      ORDER BY u.is_manager DESC, u.role ASC, u.created_at DESC
    `).all().map((u: any) => ({
      ...u,
      is_manager: Boolean(u.is_manager),
      onboarding_completed: Boolean(u.onboarding_completed),
    }));

    res.json(users);
  } catch (err: any) {
    console.error('[User API] Error fetching users:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch users' });
  }
});

// PUT /api/users/me/personal-number - Logged-in user editing their own personal number (מ"א)
userRouter.put('/me/personal-number', authenticateToken, (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { personal_number } = req.body;
  const cleanPN = (personal_number !== undefined ? String(personal_number).trim() : '').trim();

  if (!cleanPN) {
    return res.status(400).json({ error: 'חובה להזין מספר אישי (מ"א) תקין' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.userId) as any;
  if (!user) {
    return res.status(404).json({ error: 'המשתמש לא נמצא' });
  }

  if (user.id === 'scanner-guest' || user.email === 'scanner@shelv.ai' || user.role === 'scanner') {
    return res.status(403).json({ error: 'הרשאת בעל מצאי מחייבת התחברות באמצעות חשבון Google בלבד' });
  }

  // Attempt to re-couple with inventory_holders using the new personal number
  let holderId: string | null = null;
  let holderName: string | null = null;
  let coupled = false;

  const matchingHolder = db.prepare(`
    SELECT id, name FROM inventory_holders 
    WHERE TRIM(personal_number) = TRIM(?) COLLATE NOCASE 
    LIMIT 1
  `).get(cleanPN) as any;

  if (matchingHolder) {
    holderId = matchingHolder.id;
    holderName = matchingHolder.name;
    coupled = true;
  }

  db.prepare(`
    UPDATE users 
    SET personal_number = ?, 
        holder_id = ?, 
        role = 'inventory_owner',
        onboarding_completed = 1,
        updated_at = CURRENT_TIMESTAMP 
    WHERE id = ?
  `).run(cleanPN, holderId, user.id);

  const updatedUser = db.prepare(`
    SELECT u.*, h.name as holder_name
    FROM users u
    LEFT JOIN inventory_holders h ON u.holder_id = h.id
    WHERE u.id = ?
  `).get(user.id) as any;

  const sessionToken = signSessionToken({
    userId: updatedUser.id,
    email: updatedUser.email,
    name: updatedUser.name,
    role: updatedUser.role,
    is_manager: Boolean(updatedUser.is_manager),
    holderId: updatedUser.holder_id,
    personal_number: updatedUser.personal_number,
  });

  res.json({
    success: true,
    token: sessionToken,
    user: {
      id: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      role: updatedUser.role,
      is_manager: Boolean(updatedUser.is_manager),
      personal_number: updatedUser.personal_number,
      holder_id: updatedUser.holder_id,
      holder_name: holderName,
      onboarding_completed: Boolean(updatedUser.onboarding_completed),
      created_at: updatedUser.created_at,
    },
    coupled,
    holder_name: holderName,
    message: coupled
      ? `המ"א עודכן בהצלחה ושויכת לבעל המצאי: ${holderName}`
      : 'המ"א עודכן בהצלחה. פרטי בעל המצאי טרם נקלטו במערכת, החשבון יסונכרן אוטומטית ברגע שהרשימה תיטען.',
  });
});

// PUT /api/users/:id/role - Update user role (Manager only)
// User can either be 'inventory_owner' or 'scanner'
userRouter.put('/:id/role', authenticateToken, requireRole(['manager']), (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const { role } = req.body;

  if (!['inventory_owner', 'scanner'].includes(role)) {
    return res.status(400).json({ error: 'תפקיד לא חוקי. מותר רק בעל מצאי (inventory_owner) או סורק (scanner)' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any;
  if (!user) {
    return res.status(404).json({ error: 'המשתמש לא נמצא' });
  }

  const isZuk = user.email.toLowerCase() === 'zuklevinson@gmail.com';

  if (role === 'scanner') {
    // Demoting to scanner removes management permission, unless it is zuklevinson@gmail.com
    if (isZuk) {
      return res.status(400).json({ error: 'לא ניתן לשנות את תפקידו של מנהל המערכת הראשי לסורק' });
    }

    db.prepare(`
      UPDATE users 
      SET role = 'scanner', 
          is_manager = 0, 
          holder_id = NULL, 
          personal_number = NULL, 
          updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(id);
  } else {
    // Changing to inventory_owner
    db.prepare(`
      UPDATE users 
      SET role = 'inventory_owner', 
          updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(id);
  }

  const updated = db.prepare(`
    SELECT u.id, u.email, u.name, u.role, u.is_manager, u.personal_number, u.holder_id, u.onboarding_completed, u.created_at, u.updated_at,
           h.name as holder_name
    FROM users u
    LEFT JOIN inventory_holders h ON u.holder_id = h.id
    WHERE u.id = ?
  `).get(id) as any;

  res.json({
    success: true,
    user: {
      ...updated,
      is_manager: Boolean(updated.is_manager),
      onboarding_completed: Boolean(updated.onboarding_completed),
    },
  });
});

// PUT /api/users/:id/management - Grant or revoke management permission (Manager only)
userRouter.put('/:id/management', authenticateToken, requireRole(['manager']), (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const { is_manager } = req.body;

  const targetManager = Boolean(is_manager);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any;
  if (!user) {
    return res.status(404).json({ error: 'המשתמש לא נמצא' });
  }

  const isZuk = user.email.toLowerCase() === 'zuklevinson@gmail.com';

  // zuklevinson@gmail.com cannot lose management permission
  if (isZuk && !targetManager) {
    return res.status(400).json({ error: 'לא ניתן לשלול הרשאת ניהול ממנהל המערכת הראשי (zuklevinson@gmail.com)' });
  }

  // Only inventory_owner can have management permission
  if (user.role === 'scanner' && targetManager) {
    return res.status(400).json({ error: 'רק בעל מצאי יכול לקבל הרשאת ניהול (סורק אינו יכול לשמש כמנהל)' });
  }

  // Prevent demoting the last remaining manager
  if (user.is_manager && !targetManager) {
    const managerCount = (db.prepare("SELECT COUNT(*) as count FROM users WHERE is_manager = 1").get() as any).count;
    if (managerCount <= 1) {
      return res.status(400).json({ error: 'לא ניתן להסיר הרשאת ניהול מהמנהל האחרון במערכת' });
    }
  }

  db.prepare('UPDATE users SET is_manager = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(targetManager ? 1 : 0, id);

  const updated = db.prepare(`
    SELECT u.id, u.email, u.name, u.role, u.is_manager, u.personal_number, u.holder_id, u.onboarding_completed, u.created_at, u.updated_at,
           h.name as holder_name
    FROM users u
    LEFT JOIN inventory_holders h ON u.holder_id = h.id
    WHERE u.id = ?
  `).get(id) as any;

  res.json({
    success: true,
    user: {
      ...updated,
      is_manager: Boolean(updated.is_manager),
      onboarding_completed: Boolean(updated.onboarding_completed),
    },
    message: targetManager ? 'הרשאת ניהול הוענקה בהצלחה' : 'הרשאת ניהול נשללה בהצלחה',
  });
});

// PUT /api/users/:id/holder - Couple or uncouple user with an inventory holder
// Managers can couple any user; users can couple themselves if uncoupled
userRouter.put('/:id/holder', authenticateToken, (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const { holder_id, personal_number } = req.body;

  // Authorization check: either Manager, or user coupling themselves
  const isManager = Boolean(req.user?.is_manager);
  const isSelf = req.user?.userId === id;

  if (!isManager && !isSelf) {
    return res.status(403).json({ error: 'אין הרשאה לעדכן שיוך של משתמש אחר' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any;
  if (!user) {
    return res.status(404).json({ error: 'המשתמש לא נמצא' });
  }

  const targetHolderId = (holder_id || '').trim() || null;
  let targetPersonalNumber = personal_number !== undefined ? (String(personal_number).trim() || null) : user.personal_number;

  if (targetHolderId) {
    const holder = db.prepare('SELECT id, name, personal_number FROM inventory_holders WHERE id = ?').get(targetHolderId) as any;
    if (!holder) {
      return res.status(400).json({ error: 'בעל המצאי שנבחר אינו קיים במערכת' });
    }
    if (!targetPersonalNumber && holder.personal_number) {
      targetPersonalNumber = holder.personal_number;
    }
  }

  db.prepare(`
    UPDATE users 
    SET holder_id = ?, 
        personal_number = ?, 
        updated_at = CURRENT_TIMESTAMP 
    WHERE id = ?
  `).run(targetHolderId, targetPersonalNumber, id);

  const updated = db.prepare(`
    SELECT u.id, u.email, u.name, u.role, u.is_manager, u.personal_number, u.holder_id, u.onboarding_completed, u.created_at, u.updated_at,
           h.name as holder_name
    FROM users u
    LEFT JOIN inventory_holders h ON u.holder_id = h.id
    WHERE u.id = ?
  `).get(id) as any;

  res.json({
    success: true,
    user: {
      ...updated,
      is_manager: Boolean(updated.is_manager),
      onboarding_completed: Boolean(updated.onboarding_completed),
    },
  });
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

  if (user.email.toLowerCase() === 'zuklevinson@gmail.com') {
    return res.status(400).json({ error: 'לא ניתן למחוק את חשבון מנהל המערכת הראשי (zuklevinson@gmail.com)' });
  }

  db.prepare('DELETE FROM users WHERE id = ?').run(id);

  res.json({ success: true, message: 'המשתמש הוסר בהצלחה' });
});
