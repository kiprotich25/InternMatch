import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import User from '../models/User';
import { AuthedRequest, requireAuth } from '../middleware/auth';

const router = Router();

router.get('/', requireAuth, async (req: AuthedRequest, res) => {
  const user = await User.findById(req.userId);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  return res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    course: user.course,
    skills: user.skills,
    preferredLocations: user.preferredLocations,
    resumeUrl: user.resumeUrl,
  });
});

router.put(
  '/',
  requireAuth,
  [
    body('course').optional().isString(),
    body('skills').optional().isArray(),
    body('preferredLocations').optional().isArray(),
    body('resumeUrl').optional().isString(),
  ],
  async (req: AuthedRequest, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const user = await User.findByIdAndUpdate(
      req.userId,
      {
        $set: {
          course: req.body.course,
          skills: req.body.skills,
          preferredLocations: req.body.preferredLocations,
          resumeUrl: req.body.resumeUrl,
        },
      },
      { new: true },
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      course: user.course,
      skills: user.skills,
      preferredLocations: user.preferredLocations,
      resumeUrl: user.resumeUrl,
    });
  },
);

export default router;

