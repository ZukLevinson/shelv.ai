import { Router } from 'express';
import { db } from '../db/database.js';
import { broadcast } from '../sockets/socketServer.js';

export const inventoryRouter = Router();

inventoryRouter.get('/rooms', (req, res) => {
  const rooms = db.prepare(`
    SELECT r.*, h.name as holder_name, h.personal_number as holder_personal_number, h.phone as holder_phone,
           (SELECT COUNT(*) FROM official_inventory i WHERE i.room_id = r.id) as total_items,
           (SELECT COUNT(DISTINCT o.serial_number) FROM sweep_observations o WHERE o.room_id = r.id) as swept_items
    FROM rooms r
    JOIN inventory_holders h ON r.holder_id = h.id
    ORDER BY r.name ASC
  `).all();
  res.json(rooms);
});

inventoryRouter.post('/rooms', (req, res) => {
  const { name, code, holder_id, new_holder_name } = req.body;
  const cleanName = (name || '').trim();
  const cleanCode = (code || '').trim();

  if (!cleanName || !cleanCode) {
    return res.status(400).json({ error: 'שם וקוד חדר הם שדות חובה' });
  }

  const existing = db.prepare('SELECT id FROM rooms WHERE code = ? COLLATE NOCASE').get(cleanCode) as any;
  if (existing) {
    return res.status(400).json({ error: `קוד החדר "${cleanCode}" כבר קיים במערכת` });
  }

  let resolvedHolderId = (holder_id || '').trim();
  if (!resolvedHolderId && new_holder_name) {
    const cleanHolderName = new_holder_name.trim();
    if (cleanHolderName) {
      const existingHolder = db.prepare('SELECT id FROM inventory_holders WHERE name = ? COLLATE NOCASE').get(cleanHolderName) as any;
      if (existingHolder) {
        resolvedHolderId = existingHolder.id;
      } else {
        resolvedHolderId = 'holder-' + Date.now();
        db.prepare('INSERT INTO inventory_holders (id, name) VALUES (?, ?)').run(resolvedHolderId, cleanHolderName);
      }
    }
  }

  if (!resolvedHolderId) {
    return res.status(400).json({ error: 'יש לבחור או להזין בעל מצאי עבור החדר' });
  }

  const holder = db.prepare('SELECT id FROM inventory_holders WHERE id = ?').get(resolvedHolderId) as any;
  if (!holder) {
    return res.status(400).json({ error: 'בעל המצאי שנבחר אינו קיים' });
  }

  const roomId = 'room-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
  db.prepare(`
    INSERT INTO rooms (id, name, code, holder_id)
    VALUES (?, ?, ?, ?)
  `).run(roomId, cleanName, cleanCode, resolvedHolderId);

  broadcast('ROOMS_UPDATED', { roomId, action: 'created' });

  const createdRoom = db.prepare(`
    SELECT r.*, h.name as holder_name, h.email as holder_email,
           0 as total_items, 0 as swept_items
    FROM rooms r
    JOIN inventory_holders h ON r.holder_id = h.id
    WHERE r.id = ?
  `).get(roomId);

  res.status(201).json(createdRoom);
});

inventoryRouter.put('/rooms/:id', (req, res) => {
  const { id } = req.params;
  const { name, code, holder_id, new_holder_name } = req.body;

  const existingRoom = db.prepare('SELECT * FROM rooms WHERE id = ?').get(id) as any;
  if (!existingRoom) {
    return res.status(404).json({ error: 'החדר לא נמצא' });
  }

  const cleanName = (name !== undefined ? name : existingRoom.name).trim();
  const cleanCode = (code !== undefined ? code : existingRoom.code).trim();

  if (!cleanName || !cleanCode) {
    return res.status(400).json({ error: 'שם וקוד חדר אינם יכולים להיות ריקים' });
  }

  const duplicate = db.prepare('SELECT id FROM rooms WHERE code = ? COLLATE NOCASE AND id != ?').get(cleanCode, id) as any;
  if (duplicate) {
    return res.status(400).json({ error: `קוד החדר "${cleanCode}" כבר בשימוש בחדר אחר` });
  }

  let resolvedHolderId = (holder_id || existingRoom.holder_id).trim();
  if (new_holder_name && !holder_id) {
    const cleanHolderName = new_holder_name.trim();
    if (cleanHolderName) {
      const existingHolder = db.prepare('SELECT id FROM inventory_holders WHERE name = ? COLLATE NOCASE').get(cleanHolderName) as any;
      if (existingHolder) {
        resolvedHolderId = existingHolder.id;
      } else {
        resolvedHolderId = 'holder-' + Date.now();
        db.prepare('INSERT INTO inventory_holders (id, name) VALUES (?, ?)').run(resolvedHolderId, cleanHolderName);
      }
    }
  }

  const holder = db.prepare('SELECT id FROM inventory_holders WHERE id = ?').get(resolvedHolderId) as any;
  if (!holder) {
    return res.status(400).json({ error: 'בעל המצאי שנבחר אינו קיים' });
  }

  db.prepare(`
    UPDATE rooms
    SET name = ?, code = ?, holder_id = ?
    WHERE id = ?
  `).run(cleanName, cleanCode, resolvedHolderId, id);

  broadcast('ROOMS_UPDATED', { roomId: id, action: 'updated' });

  const updatedRoom = db.prepare(`
    SELECT r.*, h.name as holder_name, h.email as holder_email,
           (SELECT COUNT(*) FROM official_inventory i WHERE i.room_id = r.id) as total_items,
           (SELECT COUNT(DISTINCT o.serial_number) FROM sweep_observations o WHERE o.room_id = r.id) as swept_items
      FROM rooms r
      JOIN inventory_holders h ON r.holder_id = h.id
      WHERE r.id = ?
  `).get(id);

  res.json(updatedRoom);
});

inventoryRouter.delete('/rooms/:id', (req, res) => {
  const { id } = req.params;
  const existingRoom = db.prepare('SELECT * FROM rooms WHERE id = ?').get(id) as any;
  if (!existingRoom) {
    return res.status(404).json({ error: 'החדר לא נמצא' });
  }

  db.prepare('DELETE FROM rooms WHERE id = ?').run(id);

  broadcast('ROOMS_UPDATED', { roomId: id, action: 'deleted' });
  res.json({ success: true, message: 'החדר נמחק בהצלחה' });
});

inventoryRouter.get('/holders', (req, res) => {
  const holders = db.prepare(`
    SELECT h.*, 
           (SELECT COUNT(*) FROM official_inventory i WHERE i.holder_id = h.id) as total_signed_items,
           (SELECT COUNT(DISTINCT o.serial_number) 
            FROM sweep_observations o 
            JOIN rooms r ON o.room_id = r.id 
            WHERE r.holder_id = h.id) as swept_items_count,
           (SELECT json_group_array(json_object('id', r.id, 'name', r.name, 'code', r.code))
            FROM rooms r WHERE r.holder_id = h.id) as rooms_json
    FROM inventory_holders h
    ORDER BY h.name ASC
  `).all();

  const formatted = holders.map((h: any) => ({
    ...h,
    total_signed_items: Number(h.total_signed_items || 0),
    swept_items_count: Number(h.swept_items_count || 0),
    rooms: JSON.parse(h.rooms_json || '[]')
  }));
  res.json(formatted);
});

inventoryRouter.post('/holders', (req, res) => {
  const { name, personal_number, phone } = req.body;
  const cleanName = (name || '').trim();
  if (!cleanName) {
    return res.status(400).json({ error: 'שם בעל מצאי הוא שדה חובה' });
  }

  const existingHolder = db.prepare('SELECT id FROM inventory_holders WHERE name = ? COLLATE NOCASE').get(cleanName) as any;
  if (existingHolder) {
    return res.json({ success: true, id: existingHolder.id, name: cleanName, existing: true });
  }

  const cleanPersonalNumber = personal_number ? String(personal_number).trim() : null;
  const cleanPhone = phone ? String(phone).trim() : null;

  const id = 'holder-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
  db.prepare('INSERT INTO inventory_holders (id, name, personal_number, phone) VALUES (?, ?, ?, ?)').run(
    id, cleanName, cleanPersonalNumber, cleanPhone
  );

  broadcast('HOLDERS_UPDATED', { id, action: 'created', name: cleanName });

  res.status(201).json({ success: true, id, name: cleanName, personal_number: cleanPersonalNumber, phone: cleanPhone });
});

inventoryRouter.put('/holders/:id', (req, res) => {
  const { id } = req.params;
  const { name, personal_number, phone } = req.body;

  const existing = db.prepare('SELECT * FROM inventory_holders WHERE id = ?').get(id) as any;
  if (!existing) {
    return res.status(404).json({ error: 'בעל המצאי לא נמצא' });
  }

  const cleanName = (name !== undefined ? name : existing.name).trim();
  if (!cleanName) {
    return res.status(400).json({ error: 'שם בעל מצאי אינו יכול להיות ריק' });
  }

  const duplicate = db.prepare('SELECT id FROM inventory_holders WHERE name = ? COLLATE NOCASE AND id != ?').get(cleanName, id) as any;
  if (duplicate) {
    return res.status(400).json({ error: `שם בעל המצאי "${cleanName}" כבר קיים במערכת` });
  }

  const cleanPersonalNumber = personal_number !== undefined ? (personal_number ? String(personal_number).trim() : null) : existing.personal_number;
  const cleanPhone = phone !== undefined ? (phone ? String(phone).trim() : null) : existing.phone;

  db.prepare(`
    UPDATE inventory_holders
    SET name = ?, personal_number = ?, phone = ?
    WHERE id = ?
  `).run(cleanName, cleanPersonalNumber, cleanPhone, id);

  broadcast('HOLDERS_UPDATED', { id, action: 'updated', name: cleanName });

  const updatedHolder = db.prepare(`
    SELECT h.*, 
           (SELECT COUNT(*) FROM official_inventory i WHERE i.holder_id = h.id) as total_signed_items,
           (SELECT COUNT(DISTINCT o.serial_number) 
            FROM sweep_observations o 
            JOIN rooms r ON o.room_id = r.id 
            WHERE r.holder_id = h.id) as swept_items_count,
           (SELECT json_group_array(json_object('id', r.id, 'name', r.name, 'code', r.code))
            FROM rooms r WHERE r.holder_id = h.id) as rooms_json
    FROM inventory_holders h
    WHERE h.id = ?
  `).get(id) as any;

  res.json({
    ...updatedHolder,
    total_signed_items: Number(updatedHolder.total_signed_items || 0),
    swept_items_count: Number(updatedHolder.swept_items_count || 0),
    rooms: JSON.parse(updatedHolder.rooms_json || '[]')
  });
});

inventoryRouter.delete('/holders/:id', (req, res) => {
  const { id } = req.params;

  const existing = db.prepare('SELECT * FROM inventory_holders WHERE id = ?').get(id) as any;
  if (!existing) {
    return res.status(404).json({ error: 'בעל המצאי לא נמצא' });
  }

  // Check if holder has assigned rooms or inventory items
  const roomsCount = db.prepare('SELECT COUNT(*) as count FROM rooms WHERE holder_id = ?').get(id) as { count: number };
  const itemsCount = db.prepare('SELECT COUNT(*) as count FROM official_inventory WHERE holder_id = ?').get(id) as { count: number };

  if (roomsCount.count > 0 || itemsCount.count > 0) {
    return res.status(400).json({
      error: `לא ניתן למחוק את בעל המצאי "${existing.name}". משויכים אליו ${roomsCount.count} חדרים ו-${itemsCount.count} פריטי מצאי חתומים. יש להעביר או למחוק אותם תחילה.`
    });
  }

  db.prepare('DELETE FROM inventory_holders WHERE id = ?').run(id);

  broadcast('HOLDERS_UPDATED', { id, action: 'deleted' });

  res.json({ success: true, message: 'בעל המצאי נמחק בהצלחה' });
});

inventoryRouter.get('/items', (req, res) => {
  const { search, roomId, holderId, category } = req.query;

  let query = `
    SELECT 
      COALESCE(o.serial_number, i.serial_number) as serial_number,
      COALESCE(o.masha, i.masha) as masha,
      COALESCE(m.name, i.description, o.product_name_detected, 'פריט') as description,
      COALESCE(m.category, i.category, 'PC') as category,
      r.id as room_id,
      r.name as room_name,
      r.code as room_code,
      h.name as holder_name,
      COALESCE(o.scanned_at, i.created_at) as last_seen_at,
      COALESCE(o.scanned_by, 'מערכת') as last_scanned_by,
      o.sticker_owner_text
    FROM sweep_observations o
    JOIN rooms r ON o.room_id = r.id
    JOIN inventory_holders h ON r.holder_id = h.id
    LEFT JOIN official_inventory i ON o.serial_number = i.serial_number
    LEFT JOIN masha_registry m ON COALESCE(o.masha, i.masha) = m.masha
    WHERE o.id = (
      SELECT sub.id FROM sweep_observations sub
      WHERE sub.serial_number = o.serial_number
      ORDER BY sub.scanned_at DESC LIMIT 1
    )
  `;
  const params: any[] = [];

  if (search) {
    query += ` AND (o.serial_number LIKE ? OR o.masha LIKE ? OR m.name LIKE ? OR i.description LIKE ?)`;
    const searchPattern = `%${search}%`;
    params.push(searchPattern, searchPattern, searchPattern, searchPattern);
  }
  if (roomId) {
    query += ` AND r.id = ?`;
    params.push(roomId);
  }
  if (holderId) {
    query += ` AND h.id = ?`;
    params.push(holderId);
  }
  if (category) {
    query += ` AND COALESCE(m.category, i.category, 'PC') = ?`;
    params.push(category);
  }

  query += ` ORDER BY last_seen_at DESC`;

  let items = db.prepare(query).all(...params);

  // If no sweeps yet, fall back to official inventory baseline so catalog isn't blank
  if (items.length === 0) {
    let fallbackQuery = `
      SELECT i.serial_number, i.masha, 
             COALESCE(m.name, i.description) as description,
             COALESCE(m.category, i.category) as category,
             r.id as room_id, r.name as room_name, r.code as room_code, h.name as holder_name,
             i.created_at as last_seen_at, 'בסיס נתונים' as last_scanned_by, NULL as sticker_owner_text
      FROM official_inventory i
      LEFT JOIN rooms r ON i.room_id = r.id
      JOIN inventory_holders h ON i.holder_id = h.id
      LEFT JOIN masha_registry m ON i.masha = m.masha
      WHERE 1=1
    `;
    const fallbackParams: any[] = [];
    if (search) {
      fallbackQuery += ` AND (i.serial_number LIKE ? OR i.masha LIKE ? OR i.description LIKE ?)`;
      const searchPattern = `%${search}%`;
      fallbackParams.push(searchPattern, searchPattern, searchPattern);
    }
    if (roomId) {
      fallbackQuery += ` AND i.room_id = ?`;
      fallbackParams.push(roomId);
    }
    if (holderId) {
      fallbackQuery += ` AND i.holder_id = ?`;
      fallbackParams.push(holderId);
    }
    fallbackQuery += ` ORDER BY i.created_at DESC`;
    items = db.prepare(fallbackQuery).all(...fallbackParams);
  }

  res.json(items);
});

inventoryRouter.get('/lookup', (req, res) => {
  const { sn, masha } = req.query;
  if (!sn && !masha) {
    return res.status(400).json({ error: 'sn or masha query parameter required' });
  }

  let item = null;
  if (sn) {
    item = db.prepare(`
      SELECT i.*, r.name as room_name, h.name as holder_name
      FROM official_inventory i
      LEFT JOIN rooms r ON i.room_id = r.id
      JOIN inventory_holders h ON i.holder_id = h.id
      WHERE i.serial_number = ? COLLATE NOCASE
    `).get(String(sn).trim().toUpperCase());
  }

  if (!item && masha) {
    item = db.prepare(`
      SELECT i.*, r.name as room_name, h.name as holder_name
      FROM official_inventory i
      LEFT JOIN rooms r ON i.room_id = r.id
      JOIN inventory_holders h ON i.holder_id = h.id
      WHERE i.masha = ?
      LIMIT 1
    `).get(String(masha).trim());
  }

  res.json({ found: !!item, item });
});

// Masha Registry Endpoints
inventoryRouter.get('/masha-registry', (req, res) => {
  try {
    const list = db.prepare(`
      WITH all_mashas AS (
        SELECT masha FROM masha_registry
        UNION
        SELECT masha FROM official_inventory WHERE masha IS NOT NULL AND masha != ''
        UNION
        SELECT masha FROM sweep_observations WHERE masha IS NOT NULL AND masha != ''
      )
      SELECT a.masha, 
             COALESCE(m.name, '') as name,
             COALESCE(m.category, (SELECT o.category FROM official_inventory o WHERE o.masha = a.masha LIMIT 1), 'PC') as category,
             COALESCE(m.description, (SELECT o.description FROM official_inventory o WHERE o.masha = a.masha LIMIT 1), '') as description,
             (SELECT COUNT(*) FROM official_inventory o WHERE o.masha = a.masha) as total_signed,
             (SELECT COUNT(DISTINCT s.serial_number) FROM sweep_observations s WHERE s.masha = a.masha) as total_discovered
      FROM all_mashas a
      LEFT JOIN masha_registry m ON a.masha = m.masha
      ORDER BY a.masha ASC
    `).all();
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch masha registry' });
  }
});

inventoryRouter.post('/masha-registry/update', (req, res) => {
  const { masha, name, category, description } = req.body;
  if (!masha) {
    return res.status(400).json({ error: 'masha is required' });
  }

  const cleanMasha = String(masha).trim();
  const cleanName = (name || '').trim();
  const cleanCategory = (category || 'PC').trim();
  const cleanDesc = (description || '').trim();

  try {
    db.prepare(`
      INSERT INTO masha_registry (masha, name, category, description, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(masha) DO UPDATE SET
        name = excluded.name,
        category = excluded.category,
        description = excluded.description,
        updated_at = CURRENT_TIMESTAMP
    `).run(cleanMasha, cleanName, cleanCategory, cleanDesc);

    // Also update any official inventory items with this masha to keep name/description/category in sync
    if (cleanName || cleanDesc || cleanCategory) {
      db.prepare(`
        UPDATE official_inventory
        SET description = COALESCE(NULLIF(?, ''), description),
            category = COALESCE(NULLIF(?, ''), category)
        WHERE masha = ?
      `).run(cleanName || cleanDesc, cleanCategory, cleanMasha);
    }

    broadcast('MASHA_UPDATED', { masha: cleanMasha, name: cleanName, category: cleanCategory, description: cleanDesc });
    res.json({ success: true, masha: cleanMasha });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to update masha' });
  }
});