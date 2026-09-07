import { Router } from 'express';
import { detectAnomalies, approveTransfer, confirmInternalMove, revertResolution } from '../services/anomalyService.js';
import { broadcast } from '../sockets/socketServer.js';
import { db } from '../db/database.js';
import { optionalToken, AuthenticatedRequest } from '../auth/authMiddleware.js';
import { logAction } from '../services/actionService.js';

export const anomalyRouter = Router();

anomalyRouter.get('/', (req, res) => {
  try {
    const holderId = req.query.holderId ? String(req.query.holderId).trim() : undefined;
    const report = detectAnomalies(holderId);
    res.json(report);
  } catch (error: any) {
    console.error('[Anomaly API] Error generating report:', error);
    res.status(500).json({ error: error.message || 'Failed to detect anomalies' });
  }
});

anomalyRouter.post('/approve-transfer', optionalToken, (req: AuthenticatedRequest, res) => {
  const { serialNumber, targetRoomId, targetHolderId, resolvedBy } = req.body;
  const user = resolvedBy || req.user?.name || 'משתמש מערכת';

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

    const actionId = logAction({
      actionType: 'transfer_approved',
      description: `אישור העברת פריט ${serialNumber} לחדר`,
      entityType: 'resolution',
      entityId: result.resolutionId,
      performedBy: user,
      stateAfter: { serialNumber, targetRoomId: resolvedRoomId, resolutionId: result.resolutionId }
    });

    res.json({ ...result, actionId });
  } catch (error: any) {
    console.error('[Anomaly API] Error approving transfer:', error);
    res.status(500).json({ error: error.message || 'Failed to approve transfer' });
  }
});

anomalyRouter.post('/confirm-move', optionalToken, async (req: AuthenticatedRequest, res) => {
  const { serialNumber, targetRoomId, resolvedBy } = req.body;
  const user = resolvedBy || req.user?.name || 'משתמש מערכת';
  if (!serialNumber || !targetRoomId) {
    return res.status(400).json({ error: 'serialNumber and targetRoomId are required' });
  }

  try {
    const result = confirmInternalMove(serialNumber, targetRoomId, user);
    const updatedReport = detectAnomalies();
    broadcast('ANOMALIES_UPDATED', updatedReport);
    broadcast('MOVE_CONFIRMED', { serialNumber, targetRoomId, resolvedBy: user });

    const actionId = logAction({
      actionType: 'internal_move_confirmed',
      description: `אישור הזזה פנימית לפריט ${serialNumber}`,
      entityType: 'resolution',
      entityId: result.resolutionId,
      performedBy: user,
      stateAfter: { serialNumber, targetRoomId, resolutionId: result.resolutionId }
    });

    res.json({ ...result, actionId });
  } catch (error: any) {
    console.error('[Anomaly API] Error confirming move:', error);
    res.status(500).json({ error: error.message || 'Failed to confirm move' });
  }
});

anomalyRouter.post('/revert-resolution', optionalToken, (req: AuthenticatedRequest, res) => {
  const { resolutionId, revertedBy } = req.body;
  if (!resolutionId) {
    return res.status(400).json({ error: 'resolutionId is required' });
  }

  try {
    const user = revertedBy || req.user?.name || 'משתמש מערכת';
    const result = revertResolution(resolutionId, user);
    const updatedReport = detectAnomalies();
    broadcast('ANOMALIES_UPDATED', updatedReport);
    broadcast('RESOLUTION_REVERTED', { resolutionId, serialNumber: result.serialNumber, revertedBy: user });
    res.json(result);
  } catch (error: any) {
    console.error('[Anomaly API] Error reverting resolution:', error);
    res.status(500).json({ error: error.message || 'Failed to revert resolution' });
  }
});

// GET /api/anomalies/alerts - Retrieve audit history of sent email alerts
anomalyRouter.get('/alerts', (req, res) => {
  try {
    const { limit = '50', offset = '0' } = req.query;
    import('../services/emailAlertService.js').then(({ getEmailAlertHistory }) => {
      const history = getEmailAlertHistory(Number(limit), Number(offset));
      res.json(history);
    }).catch(err => {
      res.status(500).json({ error: err.message || 'Failed to fetch email alert history' });
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch email alerts' });
  }
});

// POST /api/anomalies/send-alerts - On-demand trigger to alert relevant logged-in holders for all current exceptions
anomalyRouter.post('/send-alerts', optionalToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { alertAllPendingAnomalies } = await import('../services/emailAlertService.js');
    const summary = await alertAllPendingAnomalies();
    res.json({
      success: true,
      message: `סריקת התראות הושלמה: ${summary.sentCount + summary.simulatedCount} נשלחו, ${summary.skippedNotLoggedInCount} דולגו (טרם התחברו), ${summary.throttledCount} נמנעו מכפילות`,
      summary,
    });
  } catch (error: any) {
    console.error('[Anomaly API] Error dispatching alerts:', error);
    res.status(500).json({ error: error.message || 'Failed to dispatch email alerts' });
  }
});