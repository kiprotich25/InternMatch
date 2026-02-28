import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import Internship from '../models/Internship';
import { requireAuth } from '../middleware/auth';
import { syncExternalInternships, seedFallbackIfEmpty } from '../services/internshipSources';

const router = Router();

// List internships with basic filters
router.get('/', requireAuth, async (req, res) => {
  const { q, location, remote } = req.query;
  const filter: Record<string, unknown> = {};

  if (location) {
    filter.location = { $regex: String(location), $options: 'i' };
  }
  if (remote === 'true') {
    filter.isRemote = true;
  }

  let query = Internship.find(filter).sort({ postedAt: -1 }).limit(100);
  if (q) {
    query = query.find({ $text: { $search: String(q) } });
  }

  const items = await query.exec();
  return res.json(items);
});

// Manual add (for admin / seeding via API)
router.post(
  '/',
  requireAuth,
  [
    body('title').notEmpty(),
    body('company').notEmpty(),
    body('location').notEmpty(),
    body('description').notEmpty(),
    body('applyUrl').isURL(),
  ],
  async (req: import('express').Request, res: import('express').Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const internship = await Internship.create({
      title: req.body.title,
      company: req.body.company,
      location: req.body.location,
      description: req.body.description,
      applyUrl: req.body.applyUrl,
      skillsRequired: req.body.skillsRequired || [],
      source: req.body.source || 'manual',
      seniority: req.body.seniority || 'intern',
      isRemote: req.body.isRemote ?? false,
      postedAt: req.body.postedAt || new Date(),
    });

    return res.status(201).json(internship);
  },
);

// Fetch and upsert internships from external APIs (e.g. Remotive)
router.post('/sync', requireAuth, async (req, res) => {
  try {
    const result = await syncExternalInternships();
    const allFailed = result.errors.length > 0 && result.inserted === 0 && result.updated === 0;

    if (allFailed) {
      // Fall back to sample internships so the UI is never empty
      const { seeded } = await seedFallbackIfEmpty();
      return res.status(200).json({
        message: seeded > 0
          ? `External APIs unavailable — loaded ${seeded} sample internships instead`
          : 'External APIs unavailable; sample internships already loaded',
        inserted: seeded,
        updated: 0,
        errors: result.errors,
      });
    }

    return res.status(200).json({
      message: 'Synced internships from external sources',
      ...result,
    });
  } catch (e) {
    const msg = (e as Error)?.message ?? 'Unknown error';
    return res.status(500).json({ message: `Failed to sync internships: ${msg}` });
  }
});

export default router;

