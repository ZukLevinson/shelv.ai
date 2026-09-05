import { Router } from 'express';
import { detectAnomalies, approveTransfer, confirmInternalMove } from '../services/anomalyService.js';
import { broadcast } from '../sockets/socketServer.js';

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
  const { serialNumber, targetRoomId, resolvedBy } = req.body;
  if (!serialNumber || !targetRoomId || !resolvedBy) {
    return res.status(400).json({ error: 'serialNumber, targetRoomId, and resolvedBy are required' });
  }

  try {
    const result = approveTransfer(serialNumber, targetRoomId, resolvedBy);
    const updatedReport = detectAnomalies();
    broadcast('ANOMALIES_UPDATED', updatedReport);
    broadcast('TRANSFER_APPROVED', { serialNumber, targetRoomId, resolvedBy });
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