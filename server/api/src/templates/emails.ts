export type EmailContent = {
  subject: string;
  html: string;
  text: string;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const EM = '\u2014';
const FOOTER = `Outbound ${EM} Personal travel concierge`;

function layout(opts: {
  title: string;
  bodyHtml: string;
  preheader?: string;
}): string {
  const preheader = opts.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(opts.preheader)}</div>`
    : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(opts.title)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#18181b;">
  ${preheader}
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:12px;padding:32px 28px;border:1px solid #e4e4e7;">
          <tr>
            <td>
              <p style="margin:0 0 24px;font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#52525b;">Outbound</p>
              ${opts.bodyHtml}
              <hr style="border:none;border-top:1px solid #e4e4e7;margin:28px 0;" />
              <p style="margin:0;font-size:12px;color:#71717a;line-height:1.5;">${escapeHtml(FOOTER)}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function verificationEmail(params: {
  name: string;
  verificationUrl: string;
}): EmailContent {
  const name = params.name.trim() || 'there';
  const url = params.verificationUrl;
  const subject = `Verify your email to get your trip plan ${EM} Outbound`;

  const html = layout({
    title: subject,
    preheader: 'Confirm your email so I can start crafting your trip plan.',
    bodyHtml: `
      <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;line-height:1.3;">Hi ${escapeHtml(name)},</h1>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:#3f3f46;">
        Thanks for submitting your trip request. Please verify your email so I can start crafting your personalized plan.
      </p>
      <p style="margin:0 0 24px;text-align:center;">
        <a href="${escapeHtml(url)}" style="display:inline-block;background:#18181b;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 22px;border-radius:8px;">
          Verify email
        </a>
      </p>
      <p style="margin:0 0 12px;font-size:13px;line-height:1.5;color:#71717a;">
        Or copy this link into your browser:<br />
        <a href="${escapeHtml(url)}" style="color:#3b82f6;word-break:break-all;">${escapeHtml(url)}</a>
      </p>
      <p style="margin:0;font-size:13px;line-height:1.5;color:#71717a;">
        This link expires in 24 hours.
      </p>
    `,
  });

  const text = [
    `Hi ${name},`,
    '',
    'Thanks for submitting your trip request. Please verify your email so I can start crafting your personalized plan.',
    '',
    `Verify your email: ${url}`,
    '',
    'This link expires in 24 hours.',
    '',
    FOOTER,
  ].join('\n');

  return { subject, html, text };
}

/** Draft itinerary delivery ? includes PDF, confirm, and revise links. */
export function itineraryDraftEmail(params: {
  name: string;
  tripTitle: string;
  tripSummary: string;
  itineraryUrl: string;
  confirmUrl: string;
  reviseUrl: string;
}): EmailContent {
  const name = params.name.trim() || 'there';
  const subject = `Your draft itinerary is ready for review ${EM} Outbound`;
  const html = layout({
    title: subject,
    preheader: 'Your personalized trip plan is ready to review.',
    bodyHtml: `
      <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;">Hi ${escapeHtml(name)},</h1>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.55;">
        I've put together a draft itinerary for your trip. Take a look and let me know what you think.
      </p>
      <p style="margin:0 0 4px;font-size:16px;font-weight:700;color:#18181b;">${escapeHtml(params.tripTitle)}</p>
      <p style="margin:0 0 16px;font-size:14px;color:#52525b;white-space:pre-wrap;">${escapeHtml(params.tripSummary)}</p>
      <p style="margin:0 0 16px;text-align:center;">
        <a href="${escapeHtml(params.itineraryUrl)}" style="display:inline-block;background:#ffffff;color:#18181b;text-decoration:none;font-size:14px;font-weight:600;padding:10px 18px;border-radius:8px;border:1px solid #d4d4d8;">
          View / download PDF
        </a>
      </p>
      <p style="margin:0 0 24px;text-align:center;">
        <a href="${escapeHtml(params.confirmUrl)}" style="display:inline-block;background:#18181b;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 22px;border-radius:8px;">
          Confirm This Itinerary
        </a>
      </p>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.55;color:#3f3f46;text-align:center;">
        Want changes?
        <a href="${escapeHtml(params.reviseUrl)}" style="color:#3b82f6;">Request Changes</a>
      </p>
      <p style="margin:0;font-size:13px;line-height:1.5;color:#71717a;">
        Take your time reviewing ${EM} this link is valid for 7 days. If you'd like to discuss anything, reply to this email.
      </p>
    `,
  });
  const text = [
    `Hi ${name},`,
    '',
    "I've put together a draft itinerary for your trip. Take a look and let me know what you think.",
    '',
    params.tripTitle,
    params.tripSummary,
    '',
    `View / download PDF: ${params.itineraryUrl}`,
    '',
    `Confirm this itinerary: ${params.confirmUrl}`,
    '',
    `Request changes: ${params.reviseUrl}`,
    '',
    `Take your time reviewing ${EM} this link is valid for 7 days. If you'd like to discuss anything, reply to this email.`,
    '',
    FOOTER,
  ].join('\n');
  return { subject, html, text };
}

/** Sent after the client confirms a draft itinerary. */
export function itineraryConfirmedEmail(params: {
  name: string;
  destinationLabel: string;
  serviceTier: 'full_service' | 'itinerary_only' | string;
}): EmailContent {
  const name = params.name.trim() || 'there';
  const subject = `Your itinerary is confirmed ${EM} Outbound`;
  const tierLine =
    params.serviceTier === 'full_service'
      ? "I'll begin coordinating your bookings now."
      : "You're all set \u2014 enjoy planning with your finalized itinerary.";

  const html = layout({
    title: subject,
    preheader: 'Your itinerary is locked in.',
    bodyHtml: `
      <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;">Hi ${escapeHtml(name)},</h1>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.55;">
        Thanks for confirming! Your itinerary for ${escapeHtml(params.destinationLabel)} is locked in.
      </p>
      <p style="margin:0;font-size:15px;line-height:1.55;color:#3f3f46;">
        ${escapeHtml(tierLine)}
      </p>
    `,
  });
  const text = [
    `Hi ${name},`,
    '',
    `Thanks for confirming! Your itinerary for ${params.destinationLabel} is locked in.`,
    '',
    tierLine,
    '',
    FOOTER,
  ].join('\n');
  return { subject, html, text };
}

/** Placeholder ? 48h follow-up if no draft response. */
export function confirmationReminderEmail(params: {
  name: string;
  tripSummary: string;
}): EmailContent {
  const name = params.name.trim() || 'there';
  const subject = `Reminder: your draft itinerary is waiting ${EM} Outbound`;
  const html = layout({
    title: subject,
    bodyHtml: `
      <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;">Hi ${escapeHtml(name)},</h1>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.55;">Just a gentle reminder ${EM} your draft itinerary is ready whenever you are.</p>
      <p style="margin:0;font-size:14px;color:#52525b;">${escapeHtml(params.tripSummary)}</p>
    `,
  });
  const text = [
    `Hi ${name},`,
    '',
    `Just a gentle reminder ${EM} your draft itinerary is ready whenever you are.`,
    params.tripSummary,
    '',
    FOOTER,
  ].join('\n');
  return { subject, html, text };
}

/** Per-segment booking confirmation. */
export function bookingConfirmationEmail(params: {
  name: string;
  segmentType: 'flight' | 'hotel' | string;
  segmentLabel: string;
  dates: string;
  confirmationNumber: string;
  cancellationSummary: string;
  providerName: string;
}): EmailContent {
  const name = params.name.trim() || 'there';
  const kind = params.segmentType === 'hotel' ? 'hotel' : 'flight';
  const subject = `Your ${kind} is confirmed ${EM} Outbound`;
  const personal =
    kind === 'hotel'
      ? `I've secured your ${params.segmentLabel} for ${params.dates}.`
      : `I've secured your flight (${params.segmentLabel}) for ${params.dates}.`;

  const html = layout({
    title: subject,
    preheader: `Great news ${EM} your ${kind} is confirmed.`,
    bodyHtml: `
      <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;">Hi ${escapeHtml(name)},</h1>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.55;">
        Great news ${EM} your ${escapeHtml(kind)} is confirmed!
      </p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.55;color:#3f3f46;">
        ${escapeHtml(personal)}
      </p>
      <p style="margin:0 0 8px;font-size:14px;color:#52525b;line-height:1.55;">
        <strong>Confirmation:</strong> ${escapeHtml(params.confirmationNumber)}<br />
        <strong>Provider:</strong> ${escapeHtml(params.providerName)}<br />
        <strong>Dates:</strong> ${escapeHtml(params.dates)}
      </p>
      <p style="margin:0;font-size:13px;line-height:1.5;color:#71717a;">
        Cancellation: ${escapeHtml(params.cancellationSummary)}
      </p>
    `,
  });
  const text = [
    `Hi ${name},`,
    '',
    `Great news ${EM} your ${kind} is confirmed!`,
    personal,
    '',
    `Confirmation: ${params.confirmationNumber}`,
    `Provider: ${params.providerName}`,
    `Dates: ${params.dates}`,
    `Cancellation: ${params.cancellationSummary}`,
    '',
    FOOTER,
  ].join('\n');
  return { subject, html, text };
}

/** Sent when booking run completes (all or partial). */
export function bookingSummaryEmail(params: {
  name: string;
  destinationLabel: string;
  segments: Array<{
    type: string;
    label: string;
    confirmationNumber: string;
    amountNote?: string;
  }>;
  itineraryUrl: string;
  notes?: string;
}): EmailContent {
  const name = params.name.trim() || 'there';
  const subject = `All bookings for your ${params.destinationLabel} trip ${EM} Outbound`;
  const listHtml = params.segments
    .map(
      (s) =>
        `<li style="margin:0 0 8px;">
          <strong>${escapeHtml(s.type)}</strong> ${EM} ${escapeHtml(s.label)}
          <br /><span style="color:#52525b;">Conf: ${escapeHtml(s.confirmationNumber)}${
            s.amountNote ? ` · ${escapeHtml(s.amountNote)}` : ''
          }</span>
        </li>`
    )
    .join('');
  const listText = params.segments
    .map(
      (s) =>
        `- ${s.type}: ${s.label} (conf ${s.confirmationNumber}${
          s.amountNote ? `, ${s.amountNote}` : ''
        })`
    )
    .join('\n');

  const html = layout({
    title: subject,
    preheader: 'Your bookings are coming together.',
    bodyHtml: `
      <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;">Hi ${escapeHtml(name)},</h1>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.55;">
        All bookings for your ${escapeHtml(params.destinationLabel)} trip are confirmed!
      </p>
      <ul style="margin:0 0 16px;padding-left:18px;font-size:14px;line-height:1.5;color:#3f3f46;">
        ${listHtml || '<li>See your segment confirmation emails for details.</li>'}
      </ul>
      ${
        params.notes
          ? `<p style="margin:0 0 16px;font-size:14px;color:#52525b;">${escapeHtml(params.notes)}</p>`
          : ''
      }
      <p style="margin:0 0 12px;font-size:14px;line-height:1.55;color:#3f3f46;">
        Pre-trip checklist: passport validity, visas if needed, travel insurance, and local payment cards.
      </p>
      <p style="margin:0;font-size:14px;">
        <a href="${escapeHtml(params.itineraryUrl)}" style="color:#3b82f6;">View your itinerary PDF</a>
      </p>
    `,
  });
  const text = [
    `Hi ${name},`,
    '',
    `All bookings for your ${params.destinationLabel} trip are confirmed!`,
    '',
    listText || 'See your segment confirmation emails for details.',
    '',
    params.notes ?? '',
    '',
    'Pre-trip checklist: passport validity, visas if needed, travel insurance, and local payment cards.',
    '',
    `Itinerary PDF: ${params.itineraryUrl}`,
    '',
    FOOTER,
  ]
    .filter((line, i, arr) => !(line === '' && arr[i - 1] === ''))
    .join('\n');
  return { subject, html, text };
}

/** Sent when a segment fails or exceeds price tolerance. */
export function bookingFailureEmail(params: {
  name: string;
  destinationLabel: string;
  reason: string;
  optionsNote: string;
}): EmailContent {
  const name = params.name.trim() || 'there';
  const subject = `I need your input on your ${params.destinationLabel} booking ${EM} Outbound`;
  const html = layout({
    title: subject,
    preheader: 'A booking segment needs your attention.',
    bodyHtml: `
      <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;">Hi ${escapeHtml(name)},</h1>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.55;">
        I need your input on part of your ${escapeHtml(params.destinationLabel)} booking.
      </p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.55;color:#3f3f46;">
        ${escapeHtml(params.reason)}
      </p>
      <p style="margin:0;font-size:15px;line-height:1.55;color:#3f3f46;">
        ${escapeHtml(params.optionsNote)}
      </p>
    `,
  });
  const text = [
    `Hi ${name},`,
    '',
    `I need your input on part of your ${params.destinationLabel} booking.`,
    '',
    params.reason,
    '',
    params.optionsNote,
    '',
    FOOTER,
  ].join('\n');
  return { subject, html, text };
}

/** Placeholder ? pre-departure briefing. */
export function preTripEmail(params: {
  name: string;
  tripSummary: string;
  signalAlerts: string;
}): EmailContent {
  const name = params.name.trim() || 'there';
  const subject = `Your pre-trip briefing ${EM} Outbound`;
  const html = layout({
    title: subject,
    bodyHtml: `
      <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;">Hi ${escapeHtml(name)},</h1>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.55;">Here's your pre-departure briefing.</p>
      <p style="margin:0 0 12px;font-size:14px;color:#52525b;">${escapeHtml(params.tripSummary)}</p>
      <p style="margin:0;font-size:14px;color:#52525b;white-space:pre-wrap;">${escapeHtml(params.signalAlerts)}</p>
    `,
  });
  const text = [
    `Hi ${name},`,
    '',
    "Here's your pre-departure briefing.",
    params.tripSummary,
    '',
    params.signalAlerts,
    '',
    FOOTER,
  ].join('\n');
  return { subject, html, text };
}

/** Placeholder ? post-trip feedback request. */
export function postTripEmail(params: {
  name: string;
  destination: string;
}): EmailContent {
  const name = params.name.trim() || 'there';
  const subject = `How was your trip? ${EM} Outbound`;
  const html = layout({
    title: subject,
    bodyHtml: `
      <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;">Hi ${escapeHtml(name)},</h1>
      <p style="margin:0;font-size:15px;line-height:1.55;">
        I hope you enjoyed ${escapeHtml(params.destination)}. I'd love to hear how it went.
      </p>
    `,
  });
  const text = [
    `Hi ${name},`,
    '',
    `I hope you enjoyed ${params.destination}. I'd love to hear how it went.`,
    '',
    FOOTER,
  ].join('\n');
  return { subject, html, text };
}
