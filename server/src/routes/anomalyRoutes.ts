import { Router } from 'express';
import { detectAnomalies, approveTransfer, confirmInternalMove } from '../services/anomalyService.js';
import { broadcast } from '../sockets/socketServer.js';
import { db } from '../db/database.js';

export const anomalyRouter = Router();

anomalyRouter.get('/', (req, res) => {
  try {
    const report = detectAnomalies();
    res.json(report);
  } catch (error: any) {
    console.error('[Anomaly API] Error generating report:', error);
    res.status(500).json({ error: error.message || 'Failed to detect anomalies' });
  }
});

anomalyRouter.post('/approve-transfer', (req, res) => {
  const { serialNumber, targetRoomId, targetHolderId, resolvedBy } = req.body;
  const user = resolvedBy || 'מנהל מערכת';

  if (!serialNumber || (!targetRoomId && !targetHolderId)) {
    return res.status(400).json({ error: 'serialNumber and targetRoomId (or targetHolderId) are required' });
  }

  try {
    let resolvedRoomId = targetRoomId;
    if (!resolvedRoomId && targetHolderId) {
      const room = db.prepare('SELECT id FROM rooms WHERE holder_id = ? LIMIT 1').get(targetHolderId) as any;
      if (room) {
        resolvedRoomId = room.id;
      } else {
        const latestObservation = db.prepare(`
          SELECT room_id FROM sweep_observations WHERE serial_number = ? ORDER BY scanned_at DESC LIMIT 1
        `).get(serialNumber) as any;
        resolvedRoomId = latestObservation ? latestObservation.room_id : null;
      }
    }

    if (!resolvedRoomId) {
      return res.status(400).json({ error: 'Could not resolve target room for transfer' });
    }

    const result = approveTransfer(serialNumber, resolvedRoomId, user);
    const updatedReport = detectAnomalies();
    broadcast('ANOMALIES_UPDATED', updatedReport);
    broadcast('TRANSFER_APPROVED', { serialNumber, targetRoomId: resolvedRoomId, resolvedBy: user });
    res.json(result);
  } catch (error: any) {
    console.error('[Anomaly API] Error approving transfer:', error);
    res.status(500).json({ error: error.message || 'Failed to approve transfer' });
  }
});

anomalyRouter.post('/confirm-move', (req, res) => {
  const { serialNumber, targetRoomId, resolvedBy } = req.body;
  if (!serialNumber || !targetRoomId || !resolvedBy) {
    return res.status(400).json({ error: 'serialNumber, targetRoomId, and resolvedBy are required' });
  }

  try {
    const result = confirmInternalMove(serialNumber, targetRoomId, resolvedBy);
    const updatedReport = detectAnomalies();
    broadcast('ANOMALIES_UPDATED', updatedReport);
    broadcast('MOVE_CONFIRMED', { serialNumber, targetRoomId, resolvedBy });
    res.json(result);
  } catch (error: any) {
    console.error('[Anomaly API] Error confirming move:', error);
    res.status(500).json({ error: error.message || 'Failed to confirm move' });
  }
});