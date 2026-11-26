import { Router } from 'express';
import { listDietaryRequirements } from '../queries/attendees.js';

const router = Router();

// GET /api/dietary-requirements -> [{ id, name }]   (small, rarely changes: safe to cache in the UI)
router.get('/dietary-requirements', async (req, res) => {
  res.json(await listDietaryRequirements());
});

export default router;
