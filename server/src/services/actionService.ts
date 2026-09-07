import { db } from '../db/database.js';
import { broadcast } from '../sockets/socketServer.js';
import { detectAnomalies, revertResolution } from './anomalyService.js';

export interface ActionLogInput {
  actionType: string;
  description: string;
  entityType: string;
  entityId: string;
  performedBy: string;
  stateBefore?: any;
  stateAfter?: any;
}

export interface ActionRecord {
  id: string;
  action_type: string;
  description: string;
  entity_type: string;
  entity_id: string;
  performed_by: string;
  performed_at: string;
  reverted_at: string | null;
  reverted_by: string | null;
  state_before: string | null;
  state_after: string | null;
}

export function logAction(input: ActionLogInput): string {
  const id = 'act-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
  const stateBeforeStr = input.stateBefore !== undefined ? JSON.stringify(input.stateBefore) : null;
  const stateAfterStr = input.stateAfter !== undefined ? JSON.stringify(input.stateAfter) : null;

  db.prepare(`
    INSERT INTO action_history (
      id, action_type, description, entity_type, entity_id, performed_by, state_before, state_after
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    input.actionType,
    input.description,
    input.entityType,
    input.entityId,
    input.performedBy,
    stateBeforeStr,
    stateAfterStr
  );

  const actionRecord = {
    id,
    actionType: input.actionType,
    description: input.description,
    entityType: input.entityType,
    entityId: input.entityId,
    performedBy: input.performedBy,
    performedAt: new Date().toISOString(),
    revertedAt: null,
    revertedBy: null
  };

  broadcast('ACTION_LOGGED', actionRecord);

  return id;
}

export function getRecentActions(limit = 100): ActionRecord[] {
  const rows = db.prepare(`
    SELECT * FROM action_history
    ORDER BY performed_at DESC
    LIMIT ?
  `).all(limit) as ActionRecord[];

  return rows;
}

export function revertAction(actionId: string, revertedBy: string) {
  const action = db.prepare('SELECT * FROM action_history WHERE id = ?').get(actionId) as ActionRecord | undefined;
  if (!action) {
    throw new Error('רשומת פעולה לא נמצאה');
  }

  if (action.reverted_at) {
    throw new Error('פעולה זו כבר בוטלה בעבר');
  }

  const user = revertedBy || 'משתמש מערכת';
  const stateBefore = action.state_before ? JSON.parse(action.state_before) : null;

  switch (action.action_type) {
    case 'scan_created': {
      // Revert scan: delete observation from sweep_observations
      const obs = db.prepare('SELECT * FROM sweep_observations WHERE id = ?').get(action.entity_id) as any;
      if (obs) {
        db.prepare('DELETE FROM sweep_observations WHERE id = ?').run(action.entity_id);
      }
      const anomalies = detectAnomalies();
      broadcast('ANOMALIES_UPDATED', anomalies);
      broadcast('SCANS_UPDATED', { deletedObservationId: action.entity_id, serialNumber: obs?.serial_number });
      break;
    }

    case 'scan_deleted': {
      // Revert scan deletion: re-insert observation
      if (!stateBefore) {
        throw new Error('לא נמצא מידע קודם לשחזור הסריקה');
      }
      db.prepare(`
        INSERT OR REPLACE INTO sweep_observations (
          id, sweep_id, room_id, masha, serial_number, scanned_by, sticker_owner_text, product_name_detected, scanned_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        stateBefore.id,
        stateBefore.sweep_id || null,
        stateBefore.room_id,
        stateBefore.masha,
        stateBefore.serial_number || null,
        stateBefore.scanned_by,
        stateBefore.sticker_owner_text || null,
        stateBefore.product_name_detected || null,
        stateBefore.scanned_at || new Date().toISOString()
      );
      const anomalies = detectAnomalies();
      broadcast('ANOMALIES_UPDATED', anomalies);
      broadcast('SCANS_UPDATED', { restoredObservationId: stateBefore.id, serialNumber: stateBefore.serial_number });
      break;
    }

    case 'transfer_approved':
    case 'internal_move_confirmed': {
      // Revert anomaly resolution using existing logic
      revertResolution(action.entity_id, user);
      break;
    }

    case 'room_created': {
      // Delete the created room
      db.prepare('DELETE FROM rooms WHERE id = ?').run(action.entity_id);
      const anomalies = detectAnomalies();
      broadcast('ANOMALIES_UPDATED', anomalies);
      broadcast('ROOMS_UPDATED', { roomId: action.entity_id, action: 'deleted' });
      break;
    }

    case 'room_updated': {
      // Restore previous room attributes
      if (!stateBefore) throw new Error('לא נמצא מידע קודם לשחזור החדר');
      db.prepare(`
        UPDATE rooms
        SET name = ?, code = ?, holder_id = ?
        WHERE id = ?
      `).run(stateBefore.name, stateBefore.code, stateBefore.holder_id, action.entity_id);
      broadcast('ROOMS_UPDATED', { roomId: action.entity_id, action: 'updated' });
      break;
    }

    case 'room_deleted': {
      // Restore deleted room
      if (!stateBefore) throw new Error('לא נמצא מידע קודם לשחזור החדר');
      db.prepare(`
        INSERT OR REPLACE INTO rooms (id, name, code, holder_id, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(stateBefore.id, stateBefore.name, stateBefore.code, stateBefore.holder_id, stateBefore.created_at || new Date().toISOString());
      broadcast('ROOMS_UPDATED', { roomId: stateBefore.id, action: 'created' });
      break;
    }

    case 'holder_created': {
      // Delete created holder
      db.prepare('DELETE FROM inventory_holders WHERE id = ?').run(action.entity_id);
      broadcast('HOLDERS_UPDATED', { id: action.entity_id, action: 'deleted' });
      break;
    }

    case 'holder_updated': {
      // Restore previous holder attributes
      if (!stateBefore) throw new Error('לא נמצא מידע קודם לשחזור בעל המצאי');
      db.prepare(`
        UPDATE inventory_holders
        SET name = ?, personal_number = ?, phone = ?
        WHERE id = ?
      `).run(stateBefore.name, stateBefore.personal_number || null, stateBefore.phone || null, action.entity_id);
      broadcast('HOLDERS_UPDATED', { id: action.entity_id, action: 'updated' });
      break;
    }

    case 'holder_deleted': {
      // Restore deleted holder
      if (!stateBefore) throw new Error('לא נמצא מידע קודם לשחזור בעל המצאי');
      db.prepare(`
        INSERT OR REPLACE INTO inventory_holders (id, name, personal_number, phone, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(stateBefore.id, stateBefore.name, stateBefore.personal_number || null, stateBefore.phone || null, stateBefore.created_at || new Date().toISOString());
      broadcast('HOLDERS_UPDATED', { id: stateBefore.id, action: 'created' });
      break;
    }

    case 'masha_updated': {
      // Restore previous Masha attributes
      if (!stateBefore) throw new Error('לא נמצא מידע קודם לשחזור המסח"א');
      db.prepare(`
        UPDATE masha_registry
        SET category = ?, description = ?, updated_at = CURRENT_TIMESTAMP
        WHERE masha = ?
      `).run(stateBefore.category, stateBefore.description, action.entity_id);

      db.prepare(`
        UPDATE official_inventory
        SET description = ?, category = ?
        WHERE masha = ?
      `).run(stateBefore.description, stateBefore.category, action.entity_id);

      broadcast('MASHA_UPDATED', { masha: action.entity_id, category: stateBefore.category, description: stateBefore.description });
      break;
    }

    default:
      throw new Error(`סוג פעולה לא מוכר לביטול: ${action.action_type}`);
  }

  // Mark action as reverted in action_history
  db.prepare(`
    UPDATE action_history
    SET reverted_at = CURRENT_TIMESTAMP, reverted_by = ?
    WHERE id = ?
  `).run(user, actionId);

  broadcast('ACTION_REVERTED', {
    actionId,
    actionType: action.action_type,
    entityType: action.entity_type,
    entityId: action.entity_id,
    revertedBy: user,
    revertedAt: new Date().toISOString()
  });

  return {
    success: true,
    message: 'הפעולה בוטלה בהצלחה',
    actionId,
    actionType: action.action_type
  };
}
