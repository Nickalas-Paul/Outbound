/**
 * Minimal server-rendered HTML pages for public trip actions.
 */

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function htmlPage(opts: {
  title: string;
  bodyHtml: string;
  status?: number;
}): { status: number; html: string } {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(opts.title)}</title>
  <style>
    :root { color-scheme: light; }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #f4f4f5;
      color: #18181b;
      line-height: 1.5;
    }
    .wrap {
      max-width: 560px;
      margin: 48px auto;
      padding: 0 16px;
    }
    .card {
      background: #fff;
      border: 1px solid #e4e4e7;
      border-radius: 12px;
      padding: 28px 24px;
    }
    .brand {
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #52525b;
      margin: 0 0 20px;
    }
    h1 {
      font-size: 22px;
      margin: 0 0 12px;
      font-weight: 700;
    }
    p { margin: 0 0 12px; color: #3f3f46; font-size: 15px; }
    label {
      display: block;
      font-size: 13px;
      font-weight: 600;
      margin: 16px 0 6px;
      color: #27272a;
    }
    textarea {
      width: 100%;
      box-sizing: border-box;
      min-height: 140px;
      padding: 12px;
      border: 1px solid #d4d4d8;
      border-radius: 8px;
      font: inherit;
      resize: vertical;
    }
    button {
      margin-top: 16px;
      background: #18181b;
      color: #fff;
      border: 0;
      border-radius: 8px;
      padding: 12px 18px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
    }
    .muted { color: #71717a; font-size: 13px; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <p class="brand">Outbound</p>
      ${opts.bodyHtml}
    </div>
  </div>
</body>
</html>`;

  return { status: opts.status ?? 200, html };
}
