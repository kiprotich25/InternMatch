import { Router } from 'express';
import { AuthedRequest, requireAuth } from '../middleware/auth';
import User from '../models/User';
import Internship from '../models/Internship';

const router = Router();

router.get('/', requireAuth, async (req: AuthedRequest, res) => {
  const user = await User.findById(req.userId);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  const totalApplications = user.applicationHistory.length;
  const byStatus = user.applicationHistory.reduce<Record<string, number>>((acc, app) => {
    acc[app.status] = (acc[app.status] || 0) + 1;
    return acc;
  }, {});

  const skills = user.skills;
  const allRequiredSkillsAgg = await Internship.aggregate([
    { $unwind: '$skillsRequired' },
    { $group: { _id: '$skillsRequired', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 20 },
  ]);

  const skillGaps = allRequiredSkillsAgg
    .filter((s) => !skills.includes(s._id))
    .map((s) => ({ skill: s._id as string, demand: s.count as number }));

  return res.json({
    applications: {
      total: totalApplications,
      byStatus,
    },
    skills: {
      current: skills,
      gaps: skillGaps,
    },
  });
});

export default router;

