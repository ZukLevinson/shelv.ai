import { Router } from 'express';
import { db } from '../db/database.js';
import { verifyGoogleIdToken, signSessionToken } from '../auth/authUtils.js';
import { authenticateToken, AuthenticatedRequest } from '../auth/authMiddleware.js';

export const authRouter = Router();

// Helper to get Google Client ID strictly from environment variables
export function getStoredGoogleClientId(): string {
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_ID.trim()) {
    return process.env.GOOGLE_CLIENT_ID.trim();
  }
  return '';
}

// GET /api/auth/config - Provide Google Client ID from server environment variable to client
authRouter.get('/config', (_req, res) => {
  res.json({
    googleClientId: getStoredGoogleClientId(),
  });
});

// Helper to format user response
function formatUserResponse(user: any) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    is_manager: Boolean(user.is_manager),
    personal_number: user.personal_number || null,
    holder_id: user.holder_id || null,
    holder_name: user.holder_name || null,
    onboarding_completed: Boolean(user.onboarding_completed),
    created_at: user.created_at,
  };
}

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

    const isZuk = email === 'zuklevinson@gmail.com';

    let user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;

    if (!user) {
      // zuklevinson@gmail.com is granted management permission by default
      const isManager = isZuk ? 1 : 0;
      const role = 'inventory_owner';

      // Auto-couple if an existing inventory holder has the same email
      let autoHolderId: string | null = null;
      const matchingHolder = db.prepare('SELECT id FROM inventory_holders WHERE email = ? COLLATE NOCASE').get(email) as any;
      if (matchingHolder) {
        autoHolderId = matchingHolder.id;
      }

      const id = profile.sub || 'user-' + Date.now();
      db.prepare(`
        INSERT INTO users (id, email, name, role, is_manager, holder_id, onboarding_completed, last_login_at)
        VALUES (?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
      `).run(id, email, name, role, isManager, autoHolderId);

      user = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any;
    } else {
      // If user is zuklevinson@gmail.com, ensure is_manager is 1
      const isManager = isZuk ? 1 : user.is_manager;

      // Auto-couple if user is currently uncoupled:
      // 1. By personal_number if set
      // 2. By email
      let currentHolderId = user.holder_id;
      if (!currentHolderId && user.personal_number) {
        const matchingHolderByPN = db.prepare(`
          SELECT id FROM inventory_holders 
          WHERE TRIM(personal_number) = TRIM(?) COLLATE NOCASE 
          LIMIT 1
        `).get(user.personal_number) as any;
        if (matchingHolderByPN) {
          currentHolderId = matchingHolderByPN.id;
        }
      }
      if (!currentHolderId) {
        const matchingHolderByEmail = db.prepare('SELECT id FROM inventory_holders WHERE email = ? COLLATE NOCASE').get(email) as any;
        if (matchingHolderByEmail) {
          currentHolderId = matchingHolderByEmail.id;
        }
      }

      // Update name, is_manager, holder_id, and last_login_at
      db.prepare(`
        UPDATE users 
        SET name = ?, is_manager = ?, holder_id = COALESCE(?, holder_id), last_login_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(name, isManager, currentHolderId || null, user.id);
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id) as any;
    }

    // Fetch holder details if coupled
    let holderName: string | null = null;
    if (user.holder_id) {
      const holder = db.prepare('SELECT name FROM inventory_holders WHERE id = ?').get(user.holder_id) as any;
      holderName = holder ? holder.name : null;
    }
    user.holder_name = holderName;

    const sessionToken = signSessionToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      is_manager: Boolean(user.is_manager),
      holderId: user.holder_id,
      personal_number: user.personal_number,
    });

    res.json({
      token: sessionToken,
      user: formatUserResponse(user),
    });
  } catch (err: any) {
    console.error('[Auth API] Google sign-in failed:', err);
    res.status(401).json({ error: err.message || 'Google sign-in validation failed' });
  }
});

// POST /api/auth/onboarding - Complete onboarding step after login (choose role and couple by מ"א)
authRouter.post('/onboarding', authenticateToken, (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { role, personal_number } = req.body;

  if (!['inventory_owner', 'scanner'].includes(role)) {
    return res.status(400).json({ error: 'תפקיד לא חוקי. מותר רק בעל מצאי (inventory_owner) או סורק (scanner)' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.userId) as any;
  if (!user) {
    return res.status(404).json({ error: 'User not found in system' });
  }

  let coupled = false;
  let holderId: string | null = null;
  let holderName: string | null = null;
  let cleanPN: string | null = null;

  if (role === 'inventory_owner') {
    if (user.id === 'scanner-guest' || user.email === 'scanner@shelv.ai') {
      return res.status(403).json({ error: 'הרשאת בעל מצאי מחייבת התחברות באמצעות חשבון Google בלבד' });
    }
    cleanPN = (personal_number !== undefined ? String(personal_number).trim() : (user.personal_number || '')).trim();
    if (!cleanPN) {
      return res.status(400).json({ error: 'חובה להזין מספר אישי (מ"א) עבור בעל מצאי' });
    }

    // Attempt to couple with existing inventory holder by personal_number
    const matchingHolder = db.prepare(`
      SELECT id, name FROM inventory_holders 
      WHERE TRIM(personal_number) = TRIM(?) COLLATE NOCASE 
      LIMIT 1
    `).get(cleanPN) as any;

    if (matchingHolder) {
      holderId = matchingHolder.id;
      holderName = matchingHolder.name;
      coupled = true;
    } else {
      // User entered מ"א but holder entity is not in system yet
      holderId = null;
      coupled = false;
    }

    db.prepare(`
      UPDATE users 
      SET role = 'inventory_owner', 
          personal_number = ?, 
          holder_id = ?, 
          onboarding_completed = 1, 
          updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(cleanPN, holderId, user.id);
  } else {
    // Role: scanner
    // Only zuklevinson@gmail.com can retain is_manager if ever assigned
    const keepManager = user.email.toLowerCase() === 'zuklevinson@gmail.com' ? user.is_manager : 0;

    db.prepare(`
      UPDATE users 
      SET role = 'scanner', 
          personal_number = NULL, 
          holder_id = NULL, 
          is_manager = ?,
          onboarding_completed = 1, 
          updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(keepManager, user.id);
  }

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
    token: sessionToken,
    user: formatUserResponse(updatedUser),
    coupled,
    holder_name: holderName,
    message: coupled
      ? `שויכת בהצלחה לבעל המצאי: ${holderName}`
      : role === 'inventory_owner'
        ? 'המספר האישי נשמר בהצלחה. פרטי בעל המצאי טרם הוזנו למערכת, החשבון יסונכרן אוטומטית בעת טעינת המצאי.'
        : 'הוגדרת כסורק בהצלחה.',
  });
});

// POST /api/auth/scanner-login - Log in as a scanner without Google
authRouter.post('/scanner-login', (req, res) => {
  const customName = req.body.name ? String(req.body.name).trim() : 'סורק מצאי';
  const scannerId = 'scanner-guest';
  const email = 'scanner@shelv.ai';

  let user = db.prepare('SELECT * FROM users WHERE id = ?').get(scannerId) as any;
  if (!user) {
    db.prepare(`
      INSERT INTO users (id, email, name, role, is_manager, holder_id, personal_number, onboarding_completed, last_login_at)
      VALUES (?, ?, ?, 'scanner', 0, NULL, NULL, 1, CURRENT_TIMESTAMP)
    `).run(scannerId, email, customName);
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(scannerId) as any;
  } else {
    // Ensure role is scanner, is_manager is 0, and uncoupled
    db.prepare(`
      UPDATE users 
      SET name = ?, role = 'scanner', is_manager = 0, holder_id = NULL, personal_number = NULL, onboarding_completed = 1, last_login_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(customName, scannerId);
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(scannerId) as any;
  }

  const sessionToken = signSessionToken({
    userId: user.id,
    email: user.email,
    name: user.name,
    role: 'scanner',
    is_manager: false,
    holderId: null,
    personal_number: null,
  });

  res.json({
    token: sessionToken,
    user: formatUserResponse(user),
  });
});

// Legacy quick login endpoints - only allowed for scanner, all other roles require Google
authRouter.all(['/quick-login', '/dev-login'], (req, res) => {
  if (req.method === 'POST' && req.body?.role === 'scanner') {
    const customName = req.body.name ? String(req.body.name).trim() : 'סורק מצאי';
    const scannerId = 'scanner-guest';
    const email = 'scanner@shelv.ai';

    let user = db.prepare('SELECT * FROM users WHERE id = ?').get(scannerId) as any;
    if (!user) {
      db.prepare(`
        INSERT INTO users (id, email, name, role, is_manager, holder_id, personal_number, onboarding_completed, last_login_at)
        VALUES (?, ?, ?, 'scanner', 0, NULL, NULL, 1, CURRENT_TIMESTAMP)
      `).run(scannerId, email, customName);
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(scannerId) as any;
    } else {
      db.prepare(`
        UPDATE users 
        SET name = ?, role = 'scanner', is_manager = 0, holder_id = NULL, personal_number = NULL, onboarding_completed = 1, last_login_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(customName, scannerId);
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(scannerId) as any;
    }

    const sessionToken = signSessionToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: 'scanner',
      is_manager: false,
      holderId: null,
      personal_number: null,
    });

    return res.json({
      token: sessionToken,
      user: formatUserResponse(user),
    });
  }

  res.status(403).json({
    error: 'התחברות ללא Google מותרת אך ורק לתפקיד סורק. עבור הרשאות בעל מצאי או ניהול, חובה להתחבר באמצעות חשבון Google בלבד.',
  });
});

// GET /api/auth/me - Retrieve current authenticated session info
authRouter.get('/me', authenticateToken, (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  let user = db.prepare(`
    SELECT u.*, h.name as holder_name, h.personal_number as holder_personal_number
    FROM users u
    LEFT JOIN inventory_holders h ON u.holder_id = h.id
    WHERE u.id = ?
  `).get(req.user.userId) as any;

  if (!user) {
    return res.status(404).json({ error: 'User not found in system' });
  }

  // If user is uncoupled inventory owner with personal_number, check if a matching holder was added
  if (user.role === 'inventory_owner' && !user.holder_id && user.personal_number) {
    const matchingHolder = db.prepare(`
      SELECT id, name FROM inventory_holders 
      WHERE TRIM(personal_number) = TRIM(?) COLLATE NOCASE 
      LIMIT 1
    `).get(user.personal_number) as any;

    if (matchingHolder) {
      db.prepare('UPDATE users SET holder_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(matchingHolder.id, user.id);
      user = db.prepare(`
        SELECT u.*, h.name as holder_name, h.personal_number as holder_personal_number
        FROM users u
        LEFT JOIN inventory_holders h ON u.holder_id = h.id
        WHERE u.id = ?
      `).get(user.id) as any;
    }
  }

  res.json({
    user: formatUserResponse(user),
  });
});
