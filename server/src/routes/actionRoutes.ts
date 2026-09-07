import { Router } from 'express';
import { getRecentActions, revertAction } from '../services/actionService.js';

export const actionRouter = Router();

// GET /api/actions/recent - Fetch recent reversible actions
actionRouter.get('/recent', (req, res) => {
  const limit = req.query.limit ? Number(req.query.limit) : 50;
  try {
    const actions = getRecentActions(limit);
    res.json(actions);
  } catch (error: any) {
    console.error('[Action API] Error fetching recent actions:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch actions' });
  }
});

// POST /api/actions/:id/revert - Revert an action
actionRouter.post('/:id/revert', (req, res) => {
  const { id } = req.params;
  const { revertedBy } = req.body || {};

  try {
    const result = revertAction(id, revertedBy);
    res.json(result);
  } catch (error: any) {
    console.error('[Action API] Error reverting action:', error);
    res.status(400).json({ error: error.message || 'Failed to revert action' });
  }
});
