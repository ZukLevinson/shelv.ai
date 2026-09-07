import { Router } from 'express';
import { db } from '../db/database.js';
import { verifyGoogleIdToken, signSessionToken } from '../auth/authUtils.js';
import { authenticateToken, AuthenticatedRequest } from '../auth/authMiddleware.js';

export const authRouter = Router();

// Helper to get Google Client ID from process.env or system_settings
export function getStoredGoogleClientId(): string {
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_ID.trim()) {
    return process.env.GOOGLE_CLIENT_ID.trim();
  }
  try {
    const row = db.prepare("SELECT value FROM system_settings WHERE key = 'google_client_id'").get() as any;
    if (row && row.value) {
      process.env.GOOGLE_CLIENT_ID = row.value.trim();
      return row.value.trim();
    }
  } catch (err) {}
  return '';
}

// GET /api/auth/config - Provide public Google Client ID for GIS button
authRouter.get('/config', (_req, res) => {
  res.json({
    googleClientId: getStoredGoogleClientId(),
  });
});

// POST /api/auth/config - Save or update Google Client ID directly from app
authRouter.post('/config', (req, res) => {
  const { googleClientId } = req.body;
  const cleanId = (googleClientId || '').trim();

  if (!cleanId) {
    return res.status(400).json({ error: 'Google Client ID is required' });
  }

  try {
    db.prepare(`
      INSERT INTO system_settings (key, value, updated_at)
      VALUES ('google_client_id', ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
    `).run(cleanId);

    process.env.GOOGLE_CLIENT_ID = cleanId;

    res.json({ success: true, googleClientId: cleanId });
  } catch (err: any) {
    console.error('[Auth API] Error saving google client id:', err);
    res.status(500).json({ error: err.message || 'Failed to save Google Client ID' });
  }
});

// POST /api/auth/google - Sign in / Register with Google ID token
authRouter.post('/google', async (req, res) => {
  const token = req.body.credential || req.body.idToken;
  if (!token) {
    return res.status(400).json({ error: 'Google credential token is required' });
  }

  try {
    const profile = await verifyGoogleIdToken(token);
    const email = profile.email.toLowerCase().trim();
    const name = profile.name.trim();

    let user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;

    if (!user) {
      // If no users exist yet or email is in INITIAL_MANAGER_EMAILS, assign 'manager'
      const totalUsers = (db.prepare('SELECT COUNT(*) as count FROM users').get() as any).count;
      const initialAdmins = (process.env.INITIAL_MANAGER_EMAILS || '')
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);

      const isManager = totalUsers === 0 || initialAdmins.includes(email);
      const role = isManager ? 'manager' : 'inventory_owner';

      // Auto-couple if an existing inventory holder has the same email
      let autoHolderId: string | null = null;
      const matchingHolder = db.prepare('SELECT id FROM inventory_holders WHERE email = ? COLLATE NOCASE').get(email) as any;
      if (matchingHolder) {
        autoHolderId = matchingHolder.id;
      }

      const id = profile.sub || 'user-' + Date.now();
      db.prepare(`
        INSERT INTO users (id, email, name, role, holder_id)
        VALUES (?, ?, ?, ?, ?)
      `).run(id, email, name, role, autoHolderId);

      user = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any;
    } else {
      // Update name if changed
      db.prepare(`
        UPDATE users 
        SET name = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(name, user.id);
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id) as any;
    }

    // Fetch holder name if coupled
    let holderName: string | null = null;
    if (user.holder_id) {
      const holder = db.prepare('SELECT name FROM inventory_holders WHERE id = ?').get(user.holder_id) as any;
      holderName = holder ? holder.name : null;
    }

    const sessionToken = signSessionToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      holderId: user.holder_id,
    });

    res.json({
      token: sessionToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        holder_id: user.holder_id,
        holder_name: holderName,
      },
    });
  } catch (err: any) {
    console.error('[Auth API] Google sign-in failed:', err);
    res.status(401).json({ error: err.message || 'Google sign-in validation failed' });
  }
});

// POST /api/auth/quick-login (and /dev-login for backwards compatibility)
authRouter.post(['/quick-login', '/dev-login'], (req, res) => {
  const { role, email, name, holder_id } = req.body;
  const cleanRole = role === 'manager' ? 'manager' : 'inventory_owner';
  const cleanEmail = (email || (cleanRole === 'manager' ? 'admin@shelv.ai' : 'owner@shelv.ai')).toLowerCase().trim();
  const cleanName = (name || (cleanRole === 'manager' ? 'הרשאת עריכה' : 'בעל מצאי')).trim();

  let user = db.prepare('SELECT * FROM users WHERE email = ?').get(cleanEmail) as any;

  if (!user) {
    const id = 'user-' + Math.random().toString(36).substring(2, 9);
    db.prepare(`
      INSERT INTO users (id, email, name, role, holder_id)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, cleanEmail, cleanName, cleanRole, holder_id || null);
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any;
  } else {
    db.prepare(`
      UPDATE users 
      SET role = ?, name = ?, holder_id = COALESCE(?, holder_id), updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(cleanRole, cleanName, holder_id || null, user.id);
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id) as any;
  }

  let holderName: string | null = null;
  if (user.holder_id) {
    const holder = db.prepare('SELECT name FROM inventory_holders WHERE id = ?').get(user.holder_id) as any;
    holderName = holder ? holder.name : null;
  }

  const sessionToken = signSessionToken({
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    holderId: user.holder_id,
  });

  res.json({
    token: sessionToken,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      holder_id: user.holder_id,
      holder_name: holderName,
    },
  });
});

// GET /api/auth/me - Retrieve current authenticated session info
authRouter.get('/me', authenticateToken, (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const user = db.prepare(`
    SELECT u.*, h.name as holder_name, h.personal_number as holder_personal_number
    FROM users u
    LEFT JOIN inventory_holders h ON u.holder_id = h.id
    WHERE u.id = ?
  `).get(req.user.userId) as any;

  if (!user) {
    return res.status(404).json({ error: 'User not found in system' });
  }

  res.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      holder_id: user.holder_id,
      holder_name: user.holder_name,
      created_at: user.created_at,
    },
  });
});
