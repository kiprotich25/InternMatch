import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { AuthedRequest, requireAuth } from '../middleware/auth';
import User from '../models/User';
import Internship from '../models/Internship';
import {
  generateApplicationEmail,
  generateCvImprovements,
  generateInterviewQuestions,
  generateNetworkingSuggestions,
  generateSkillGaps,
  reviewInterviewAnswer,
} from '../services/aiService';

const router = Router();

router.post(
  '/cv-improvements',
  requireAuth,
  [body('internshipId').notEmpty(), body('resumeText').optional().isString()],
  async (req: AuthedRequest, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const user = await User.findById(req.userId);
    const internship = await Internship.findById(req.body.internshipId);
    if (!user || !internship) {
      return res.status(404).json({ message: 'User or internship not found' });
    }

    try {
      const text = await generateCvImprovements(user, internship, req.body.resumeText);
      return res.json({ text });
    } catch (e) {
      // In production you'd log this error
      return res.status(500).json({ message: 'Failed to generate CV improvements' });
    }
  },
);

router.post(
  '/application-email',
  requireAuth,
  [body('internshipId').notEmpty()],
  async (req: AuthedRequest, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const user = await User.findById(req.userId);
    const internship = await Internship.findById(req.body.internshipId);
    if (!user || !internship) {
      return res.status(404).json({ message: 'User or internship not found' });
    }

    try {
      const text = await generateApplicationEmail(user, internship);
      return res.json({ text });
    } catch {
      return res.status(500).json({ message: 'Failed to generate email' });
    }
  },
);

router.post(
  '/interview-questions',
  requireAuth,
  [body('internshipId').notEmpty(), body('count').optional().isInt({ min: 3, max: 15 })],
  async (req: AuthedRequest, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const internship = await Internship.findById(req.body.internshipId);
    if (!internship) {
      return res.status(404).json({ message: 'Internship not found' });
    }

    try {
      const text = await generateInterviewQuestions(internship, req.body.count || 8);
      return res.json({ text });
    } catch {
      return res.status(500).json({ message: 'Failed to generate questions' });
    }
  },
);

router.post(
  '/interview-review',
  requireAuth,
  [body('internshipId').notEmpty(), body('question').notEmpty(), body('answer').notEmpty()],
  async (req: AuthedRequest, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const internship = await Internship.findById(req.body.internshipId);
    if (!internship) {
      return res.status(404).json({ message: 'Internship not found' });
    }
    try {
      const text = await reviewInterviewAnswer(req.body.question, req.body.answer, internship);
      return res.json({ text });
    } catch {
      return res.status(500).json({ message: 'Failed to review answer' });
    }
  },
);

router.post(
  '/networking',
  requireAuth,
  [body('internshipId').notEmpty()],
  async (req: AuthedRequest, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const user = await User.findById(req.userId);
    const internship = await Internship.findById(req.body.internshipId);
    if (!user || !internship) {
      return res.status(404).json({ message: 'User or internship not found' });
    }
    try {
      const text = await generateNetworkingSuggestions(user, internship);
      return res.json({ text });
    } catch {
      return res.status(500).json({ message: 'Failed to generate networking suggestions' });
    }
  },
);

// GET /api/ai/skill-gaps — AI-powered skill gap analysis based on user's course + real internship data
router.get('/skill-gaps', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Aggregate the most frequently requested skills across all internships
    const pipeline = [
      { $unwind: '$skillsRequired' },
      { $group: { _id: '$skillsRequired', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 60 },
    ] as any[];

    const skillAgg = await Internship.aggregate(pipeline);
    const allTopSkills: string[] = skillAgg.map((s: any) => s._id).filter(Boolean);

    // If no internships in db yet, use career-field specific well-known skills
    const inDemandSkills =
      allTopSkills.length > 0
        ? allTopSkills
        : inferSkillsFromCourse(user.course || 'Technology');

    const gaps = await generateSkillGaps(
      user.course || 'Technology',
      user.skills || [],
      inDemandSkills,
    );

    return res.json({ course: user.course, gaps });
  } catch (e) {
    const msg = (e as Error)?.message ?? 'Unknown error';
    return res.status(500).json({ message: `Failed to generate skill gaps: ${msg}` });
  }
});

/** Fallback skill lists when DB has no internships yet */
function inferSkillsFromCourse(course: string): string[] {
  const c = course.toLowerCase();
  if (c.includes('computer') || c.includes('software') || c.includes('it') || c.includes('information')) {
    return ['Python', 'JavaScript', 'React', 'Node.js', 'SQL', 'Docker', 'Git', 'TypeScript', 'REST APIs', 'AWS', 'Linux', 'Machine Learning'];
  }
  if (c.includes('data') || c.includes('analytics') || c.includes('statistics')) {
    return ['Python', 'R', 'SQL', 'Pandas', 'Tableau', 'Power BI', 'Machine Learning', 'TensorFlow', 'Spark', 'Excel', 'Statistics', 'Jupyter'];
  }
  if (c.includes('design') || c.includes('ux') || c.includes('ui') || c.includes('art')) {
    return ['Figma', 'Adobe XD', 'User Research', 'Prototyping', 'Accessibility', 'HTML', 'CSS', 'Illustration', 'Typography', 'Usability Testing'];
  }
  if (c.includes('business') || c.includes('commerce') || c.includes('management') || c.includes('finance')) {
    return ['Excel', 'Power BI', 'SQL', 'Python', 'Financial Modelling', 'Project Management', 'Tableau', 'Business Analysis', 'Presentation Skills'];
  }
  if (c.includes('electric') || c.includes('engineer') || c.includes('mechanical')) {
    return ['MATLAB', 'AutoCAD', 'Python', 'C++', 'Circuit Design', 'Embedded Systems', 'CAD', 'IoT', 'PLC Programming'];
  }
  // Generic STEM fallback
  return ['Python', 'SQL', 'Excel', 'Git', 'Communication', 'Data Analysis', 'Project Management', 'Problem Solving'];
}

export default router;

