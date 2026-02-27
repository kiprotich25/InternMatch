import { Router } from 'express';
import { AuthedRequest, requireAuth } from '../middleware/auth';
import User from '../models/User';
import Internship from '../models/Internship';
import { scoreMatch } from '../services/aiService';

const router = Router();

router.get('/recommendations', requireAuth, async (req: AuthedRequest, res) => {
  const user = await User.findById(req.userId);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  const internships = await Internship.find().sort({ postedAt: -1 }).limit(50);

  const scored = await Promise.all(
    internships.map(async (intern) => {
      try {
        const score = await scoreMatch(user, intern);
        return { internship: intern, score };
      } catch {
        return { internship: intern, score: 0 };
      }
    }),
  );

  scored.sort((a, b) => b.score - a.score);

  return res.json(
    scored.map((s) => ({
      score: s.score,
      internship: s.internship,
    })),
  );
});

export default router;

