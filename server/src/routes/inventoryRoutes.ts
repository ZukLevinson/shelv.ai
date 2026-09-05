import { Router } from 'express';
import { db } from '../db/database.js';

export const inventoryRouter = Router();

inventoryRouter.get('/rooms', (req, res) => {
  const rooms = db.prepare(`
    SELECT r.*, h.name as holder_name, h.email as holder_email,
           (SELECT COUNT(*) FROM official_inventory i WHERE i.room_id = r.id) as total_items,
           (SELECT COUNT(DISTINCT o.serial_number) FROM sweep_observations o WHERE o.room_id = r.id) as swept_items
    FROM rooms r
    JOIN inventory_holders h ON r.holder_id = h.id
    ORDER BY r.name ASC
  `).all();
  res.json(rooms);
});

inventoryRouter.get('/holders', (req, res) => {
  const holders = db.prepare(`
    SELECT h.*, 
           (SELECT json_group_array(json_object('id', r.id, 'name', r.name, 'code', r.code))
            FROM rooms r WHERE r.holder_id = h.id) as rooms_json
    FROM inventory_holders h
    ORDER BY h.name ASC
  `).all();

  const formatted = holders.map((h: any) => ({
    ...h,
    rooms: JSON.parse(h.rooms_json || '[]')
  }));
  res.json(formatted);
});

inventoryRouter.get('/items', (req, res) => {
  const { search, roomId, holderId, category } = req.query;

  let query = `
    SELECT i.*, r.name as room_name, r.code as room_code, h.name as holder_name
    FROM official_inventory i
    JOIN rooms r ON i.room_id = r.id
    JOIN inventory_holders h ON i.holder_id = h.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (search) {
    query += ` AND (i.serial_number LIKE ? OR i.masha LIKE ? OR i.description LIKE ?)`;
    const searchPattern = `%${search}%`;
    params.push(searchPattern, searchPattern, searchPattern);
  }
  if (roomId) {
    query += ` AND i.room_id = ?`;
    params.push(roomId);
  }
  if (holderId) {
    query += ` AND i.holder_id = ?`;
    params.push(holderId);
  }
  if (category) {
    query += ` AND i.category = ?`;
    params.push(category);
  }

  query += ` ORDER BY i.created_at DESC`;

  const items = db.prepare(query).all(...params);
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
      JOIN rooms r ON i.room_id = r.id
      JOIN inventory_holders h ON i.holder_id = h.id
      WHERE i.serial_number = ? COLLATE NOCASE
    `).get(String(sn).trim().toUpperCase());
  }

  if (!item && masha) {
    item = db.prepare(`
      SELECT i.*, r.name as room_name, h.name as holder_name
      FROM official_inventory i
      JOIN rooms r ON i.room_id = r.id
      JOIN inventory_holders h ON i.holder_id = h.id
      WHERE i.masha = ?
      LIMIT 1
    `).get(String(masha).trim());
  }

  res.json({ found: !!item, item });
});