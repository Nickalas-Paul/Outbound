/**
 * Pure PDF renderer for composed itineraries (JSON in → Buffer out).
 */

import PDFDocument from 'pdfkit';

import type { ItineraryContent } from './itinerary-types';

function money(n: number | undefined, currency = 'USD'): string {
  if (n == null || Number.isNaN(n)) return '—';
  return `${currency} ${Math.round(n).toLocaleString('en-US')}`;
}

/**
 * Render a multi-page travel itinerary PDF from structured content only.
 */
export function renderItineraryPdf(content: ItineraryContent): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'LETTER',
      margins: { top: 54, bottom: 64, left: 54, right: 54 },
      bufferPages: true,
      info: {
        Title: content.title,
        Author: 'Outbound',
        Subject: 'Travel itinerary draft',
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const currency = content.estimatedBudgetPerPerson?.currency || 'USD';
    const pageWidth =
      doc.page.width - doc.page.margins.left - doc.page.margins.right;

    // —— Title page ——
    doc.fontSize(22).font('Helvetica-Bold').text(content.title, { align: 'left' });
    doc.moveDown(0.6);
    doc
      .fontSize(11)
      .font('Helvetica')
      .fillColor('#333333')
      .text(content.summary || '', { width: pageWidth, align: 'left' });
    doc.moveDown(1);
    doc.fillColor('#000000').fontSize(10);
    doc.text(`Destinations: ${(content.destinations || []).join(', ') || '—'}`);
    doc.text(`Total days: ${content.totalDays ?? content.days?.length ?? '—'}`);
    if (content.estimatedBudgetPerPerson) {
      doc.text(
        `Estimated budget / person: ${money(content.estimatedBudgetPerPerson.low, currency)} – ${money(content.estimatedBudgetPerPerson.high, currency)}`
      );
    }

    // —— Day pages ——
    for (const day of content.days || []) {
      doc.addPage();
      doc
        .fontSize(16)
        .font('Helvetica-Bold')
        .text(`Day ${day.dayNumber}${day.date ? ` — ${day.date}` : ''}`);
      doc.moveDown(0.3);
      doc.fontSize(12).font('Helvetica-Bold').text(day.theme || 'Day plan');
      doc
        .fontSize(10)
        .font('Helvetica')
        .fillColor('#444444')
        .text(`${day.location || ''}`);
      doc.fillColor('#000000');
      doc.moveDown(0.6);

      if (day.accommodation) {
        doc.font('Helvetica-Bold').text('Accommodation');
        doc.font('Helvetica').text(
          `${day.accommodation.name} (${day.accommodation.type}) — ${money(day.accommodation.estimatedCostPerNight, currency)}/night`
        );
        if (day.accommodation.bookingNotes) {
          doc.fillColor('#444444').text(String(day.accommodation.bookingNotes));
          doc.fillColor('#000000');
        }
        doc.moveDown(0.5);
      }

      if (day.activities?.length) {
        doc.font('Helvetica-Bold').text('Activities');
        for (const a of day.activities) {
          doc
            .font('Helvetica-Bold')
            .fontSize(10)
            .text(`${a.time || ''} — ${a.name}`);
          doc
            .font('Helvetica')
            .fillColor('#333333')
            .text(String(a.description || ''));
          doc
            .fillColor('#555555')
            .text(
              `${a.duration || ''} · ${money(a.estimatedCost, currency)}${a.bookingRequired ? ' · booking required' : ''}`
            );
          doc.fillColor('#000000');
          doc.moveDown(0.35);
        }
      }

      if (day.meals?.length) {
        doc.font('Helvetica-Bold').text('Meals');
        for (const m of day.meals) {
          doc
            .font('Helvetica')
            .text(
              `${m.type}: ${m.suggestion} (${money(m.estimatedCost, currency)})`
            );
        }
        doc.moveDown(0.4);
      }

      if (day.logistics) {
        doc.font('Helvetica-Bold').text('Logistics');
        doc.font('Helvetica').text(String(day.logistics));
        doc.moveDown(0.3);
      }
      if (day.tips) {
        doc.font('Helvetica-Bold').text('Tip');
        doc.font('Helvetica').fillColor('#333333').text(String(day.tips));
        doc.fillColor('#000000');
      }
    }

    // —— Closing page ——
    doc.addPage();
    doc.fontSize(14).font('Helvetica-Bold').text('General tips');
    doc.moveDown(0.4);
    doc.fontSize(10).font('Helvetica');
    for (const tip of content.generalTips || []) {
      doc.text(`• ${String(tip)}`);
    }
    doc.moveDown(0.8);
    doc.fontSize(14).font('Helvetica-Bold').text('Packing notes');
    doc.moveDown(0.4);
    doc.fontSize(10).font('Helvetica');
    for (const note of content.packingNotes || []) {
      doc.text(`• ${String(note)}`);
    }
    doc.moveDown(0.8);
    doc.fontSize(14).font('Helvetica-Bold').text('Important notices');
    doc.moveDown(0.4);
    doc.fontSize(10).font('Helvetica');
    for (const note of content.importantNotes || []) {
      doc.text(`• ${String(note)}`);
    }

    // Stamp footers after layout (avoids pageAdded recursion)
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      const y = doc.page.height - 40;
      doc
        .fontSize(8)
        .fillColor('#666666')
        .text('Prepared by Outbound — outboundtravel.com', 54, y, {
          width: pageWidth,
          align: 'center',
          lineBreak: false,
        });
    }

    doc.end();
  });
}
