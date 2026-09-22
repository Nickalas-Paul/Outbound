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
              <p style="margin:0;font-size:12px;color:#71717a;line-height:1.5;">Outbound — Travel Intelligence &amp; Concierge</p>
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
  const subject = 'Verify your email to get your trip plan — Outbound';

  const html = layout({
    title: subject,
    preheader: 'Confirm your email so we can prepare your trip plan.',
    bodyHtml: `
      <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;line-height:1.3;">Hi ${escapeHtml(name)},</h1>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:#3f3f46;">
        Thanks for submitting your trip request. Please verify your email so we can prepare your personalized plan.
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
    'Thanks for submitting your trip request. Please verify your email so we can prepare your personalized plan.',
    '',
    `Verify your email: ${url}`,
    '',
    'This link expires in 24 hours.',
    '',
    'Outbound — Travel Intelligence & Concierge',
  ].join('\n');

  return { subject, html, text };
}

/** Draft itinerary delivery — sent after successful composition. */
export function itineraryDraftEmail(params: {
  name: string;
  tripSummary: string;
  itineraryUrl: string;
}): EmailContent {
  const name = params.name.trim() || 'there';
  const subject = 'Your draft itinerary is ready for review — Outbound';
  const html = layout({
    title: subject,
    preheader: 'Your personalized trip plan is ready to review.',
    bodyHtml: `
      <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;">Hi ${escapeHtml(name)},</h1>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.55;">
        Your draft itinerary is ready. Take a look and let us know if you'd like any changes.
      </p>
      <p style="margin:0 0 16px;font-size:14px;color:#52525b;white-space:pre-wrap;">${escapeHtml(params.tripSummary)}</p>
      <p style="margin:0 0 24px;text-align:center;">
        <a href="${escapeHtml(params.itineraryUrl)}" style="display:inline-block;background:#18181b;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 22px;border-radius:8px;">
          Download itinerary PDF
        </a>
      </p>
      <p style="margin:0;font-size:13px;line-height:1.5;color:#71717a;">
        Or open this link: <a href="${escapeHtml(params.itineraryUrl)}" style="color:#3b82f6;word-break:break-all;">${escapeHtml(params.itineraryUrl)}</a>
      </p>
    `,
  });
  const text = [
    `Hi ${name},`,
    '',
    'Your draft itinerary is ready. Take a look and let us know if you\'d like any changes.',
    '',
    params.tripSummary,
    '',
    `Download PDF: ${params.itineraryUrl}`,
    '',
    'Outbound — Travel Intelligence & Concierge',
  ].join('\n');
  return { subject, html, text };
}

/** Placeholder — 48h follow-up if no draft response. */
export function confirmationReminderEmail(params: {
  name: string;
  tripSummary: string;
}): EmailContent {
  const name = params.name.trim() || 'there';
  const subject = 'Reminder: your draft itinerary is waiting — Outbound';
  const html = layout({
    title: subject,
    bodyHtml: `
      <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;">Hi ${escapeHtml(name)},</h1>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.55;">Just a reminder that your draft itinerary is waiting for your review.</p>
      <p style="margin:0;font-size:14px;color:#52525b;">${escapeHtml(params.tripSummary)}</p>
    `,
  });
  const text = [
    `Hi ${name},`,
    '',
    'Just a reminder that your draft itinerary is waiting for your review.',
    params.tripSummary,
    '',
    'Outbound — Travel Intelligence & Concierge',
  ].join('\n');
  return { subject, html, text };
}

/** Placeholder — per-segment booking confirmation. */
export function bookingConfirmationEmail(params: {
  name: string;
  segmentDetails: string;
}): EmailContent {
  const name = params.name.trim() || 'there';
  const subject = 'Booking confirmed — Outbound';
  const html = layout({
    title: subject,
    bodyHtml: `
      <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;">Hi ${escapeHtml(name)},</h1>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.55;">A booking segment has been confirmed.</p>
      <p style="margin:0;font-size:14px;color:#52525b;white-space:pre-wrap;">${escapeHtml(params.segmentDetails)}</p>
    `,
  });
  const text = [
    `Hi ${name},`,
    '',
    'A booking segment has been confirmed.',
    params.segmentDetails,
    '',
    'Outbound — Travel Intelligence & Concierge',
  ].join('\n');
  return { subject, html, text };
}

/** Placeholder — pre-departure briefing. */
export function preTripEmail(params: {
  name: string;
  tripSummary: string;
  signalAlerts: string;
}): EmailContent {
  const name = params.name.trim() || 'there';
  const subject = 'Your pre-trip briefing — Outbound';
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
    'Outbound — Travel Intelligence & Concierge',
  ].join('\n');
  return { subject, html, text };
}

/** Placeholder — post-trip feedback request. */
export function postTripEmail(params: {
  name: string;
  destination: string;
}): EmailContent {
  const name = params.name.trim() || 'there';
  const subject = 'How was your trip? — Outbound';
  const html = layout({
    title: subject,
    bodyHtml: `
      <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;">Hi ${escapeHtml(name)},</h1>
      <p style="margin:0;font-size:15px;line-height:1.55;">
        We hope you enjoyed ${escapeHtml(params.destination)}. We'd love to hear how it went.
      </p>
    `,
  });
  const text = [
    `Hi ${name},`,
    '',
    `We hope you enjoyed ${params.destination}. We'd love to hear how it went.`,
    '',
    'Outbound — Travel Intelligence & Concierge',
  ].join('\n');
  return { subject, html, text };
}
