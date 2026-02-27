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

export default router;

