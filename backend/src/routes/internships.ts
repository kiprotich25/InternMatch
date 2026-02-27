import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import Internship from '../models/Internship';
import { requireAuth } from '../middleware/auth';

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
  async (req, res) => {
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

export default router;

