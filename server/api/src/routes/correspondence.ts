/**
 * Correspondence webhook routes.
 *
 * POST /api/correspondence/inbound — Resend-format inbound webhook
 */

import { Router, Request, Response } from 'express';

import {
  scheduleProcessInbound,
  type InboundEmailPayload,
} from '../services/correspondence/processor';

const router = Router();

router.post('/inbound', async (req: Request, res: Response) => {
  try {
    const body = (req.body ?? {}) as InboundEmailPayload & {
      data?: InboundEmailPayload;
      type?: string;
    };

    // Support both flat payloads (tests) and Resend-wrapped { type, data }
    const payload: InboundEmailPayload =
      body.data && typeof body.data === 'object'
        ? {
            from: body.data.from ?? (body as { from?: string }).from,
            to: body.data.to ?? (body as { to?: string }).to,
            subject: body.data.subject,
            text: body.data.text,
            html: body.data.html,
            headers: body.data.headers,
            message_id: body.data.message_id,
            email_id: body.data.email_id,
          }
        : body;

    if (!payload.from && !payload.text && !payload.html) {
      res.status(400).json({ error: 'Invalid inbound payload' });
      return;
    }

    // Acknowledge immediately; classify + route asynchronously
    res.status(200).json({ received: true });
    scheduleProcessInbound(payload);
  } catch (err) {
    console.error('[correspondence] inbound webhook error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Inbound webhook failed' });
    }
  }
});

export default router;
