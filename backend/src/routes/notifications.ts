import { Router } from 'express';
import { AuthedRequest, requireAuth } from '../middleware/auth';
import User from '../models/User';
import Internship from '../models/Internship';
import { scoreMatch } from '../services/aiService';

const router = Router();

router.get('/prioritized', requireAuth, async (req: AuthedRequest, res) => {
  const user = await User.findById(req.userId);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  const internships = await Internship.find({
    postedAt: { $gte: new Date(Date.now() - 1000 * 60 * 60 * 24 * 14) }, // last 14 days
  }).limit(50);

  const scored = await Promise.all(
    internships.map(async (intern) => {
      try {
        const score = await scoreMatch(user, intern);
        // simple priority: score + recency factor
        const ageDays = (Date.now() - intern.postedAt.getTime()) / (1000 * 60 * 60 * 24);
        const recencyBoost = Math.max(0, 10 - ageDays); // up to +10
        const priority = score + recencyBoost;
        return { internship: intern, score, priority };
      } catch {
        return { internship: intern, score: 0, priority: 0 };
      }
    }),
  );

  scored.sort((a, b) => b.priority - a.priority);

  return res.json(
    scored.map((s) => ({
      internship: s.internship,
      score: s.score,
      priority: s.priority,
    })),
  );
});

export default router;

