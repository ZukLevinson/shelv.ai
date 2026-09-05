import { Router } from 'express';
import { recordObservation, startSweepSession, completeSweepSession } from '../services/sweepService.js';
import { db } from '../db/database.js';

export const sweepRouter = Router();

sweepRouter.post('/scan', (req, res) => {
  const { sweepId, roomId, serialNumber, masha, scannedBy, stickerOwnerText, productNameDetected } = req.body;

  if (!roomId || !serialNumber || !scannedBy) {
    return res.status(400).json({ error: 'roomId, serialNumber, and scannedBy are required' });
  }

  try {
    const result = recordObservation({
      sweepId,
      roomId,
      serialNumber,
      masha,
      scannedBy,
      stickerOwnerText,
      productNameDetected
    });
    res.json(result);
  } catch (error: any) {
    console.error('[Sweep API] Error recording scan:', error);
    res.status(500).json({ error: error.message || 'Failed to record scan' });
  }
});

sweepRouter.post('/sessions/start', (req, res) => {
  const { roomId, sweptBy } = req.body;
  if (!roomId || !sweptBy) {
    return res.status(400).json({ error: 'roomId and sweptBy are required' });
  }

  const session = startSweepSession(roomId, sweptBy);
  res.json(session);
});

sweepRouter.post('/sessions/:id/complete', (req, res) => {
  const { id } = req.params;
  const result = completeSweepSession(id);
  res.json(result);
});

sweepRouter.get('/sessions', (req, res) => {
  const sessions = db.prepare(`
    SELECT s.*, r.name as room_name, r.code as room_code,
           (SELECT COUNT(*) FROM sweep_observations o WHERE o.sweep_id = s.id) as observation_count
    FROM sweep_sessions s
    JOIN rooms r ON s.room_id = r.id
    ORDER BY s.started_at DESC
    LIMIT 20
  `).all();
  res.json(sessions);
});