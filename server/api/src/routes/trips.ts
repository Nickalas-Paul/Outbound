/**
 * Trip-facing routes (itinerary PDF retrieval).
 *
 * GET /api/trips/:tripId/itinerary/pdf
 */

import fs from 'fs/promises';
import path from 'path';

import { Router, Request, Response } from 'express';

import { pool } from '../config/database';
import { renderItineraryPdf } from '../services/itinerary-pdf';
import {
  isItineraryContent,
  type ItineraryContent,
} from '../services/itinerary-types';
import { apiError } from '../utils/response';

const router = Router();

router.get(
  '/:tripId/itinerary/pdf',
  async (req: Request, res: Response) => {
    try {
      const tripId = String(req.params.tripId ?? '').trim();
      if (!/^[0-9a-f-]{36}$/i.test(tripId)) {
        res.status(400).json(apiError('Invalid trip id'));
        return;
      }

      const result = await pool.query<{
        id: string;
        version_number: number;
        content: ItineraryContent;
        pdf_path: string | null;
        status: string;
      }>(
        `
        SELECT id, version_number, content, pdf_path, status
        FROM itinerary_versions
        WHERE trip_id = $1
          AND status IN ('composed', 'sent', 'confirmed')
        ORDER BY version_number DESC
        LIMIT 1
        `,
        [tripId]
      );

      if (result.rows.length === 0) {
        res.status(404).json(apiError('No itinerary available for this trip'));
        return;
      }

      const row = result.rows[0];
      if (!isItineraryContent(row.content)) {
        res.status(500).json(apiError('Itinerary content is invalid'));
        return;
      }

      let buffer: Buffer | null = null;
      if (row.pdf_path) {
        try {
          buffer = await fs.readFile(row.pdf_path);
        } catch {
          buffer = null;
        }
      }
      if (!buffer) {
        buffer = await renderItineraryPdf(row.content);
        // Best-effort cache to disk
        try {
          const dir = path.resolve(__dirname, '../../data/itineraries');
          await fs.mkdir(dir, { recursive: true });
          const absolute = path.join(
            dir,
            `${tripId}-v${row.version_number}.pdf`
          );
          await fs.writeFile(absolute, buffer);
          await pool.query(
            `UPDATE itinerary_versions SET pdf_path = $1, updated_at = NOW() WHERE id = $2`,
            [absolute, row.id]
          );
        } catch (err) {
          console.warn('[trips] could not cache PDF:', err);
        }
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `inline; filename="outbound-itinerary-v${row.version_number}.pdf"`
      );
      res.send(buffer);
    } catch (err) {
      console.error('[trips] itinerary pdf error:', err);
      res.status(500).json(apiError('Failed to generate itinerary PDF'));
    }
  }
);

export default router;
