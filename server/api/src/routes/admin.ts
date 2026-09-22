/**
 * Admin utility routes (auth required; full admin roles in Step 8).
 *
 * POST /api/admin/follow-ups/run
 */

import { Router, Request, Response } from 'express';

import { requireAuth } from '../middleware/auth';
import { runFollowUpSequences } from '../services/correspondence/followups';
import { apiError } from '../utils/response';

const router = Router();

router.post(
  '/follow-ups/run',
  requireAuth,
  async (_req: Request, res: Response) => {
    try {
      const report = await runFollowUpSequences();
      res.status(200).json({
        success: true,
        report,
        totals: {
          postDraft48h: report.postDraft48h.length,
          preTrip14d: report.preTrip14d.length,
          preTrip2d: report.preTrip2d.length,
          postTrip7d: report.postTrip7d.length,
        },
      });
    } catch (err) {
      console.error('[admin] follow-ups run failed:', err);
      res.status(500).json(apiError('Failed to run follow-up sequences'));
    }
  }
);

export default router;
