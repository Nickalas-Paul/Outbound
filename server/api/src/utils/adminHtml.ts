/**
 * Shared HTML layout for admin dashboard pages.
 */

import { escapeHtml } from './htmlPage';

export function adminLayout(opts: {
  title: string;
  bodyHtml: string;
  active?: 'dashboard' | 'escalations' | 'health';
}): string {
  const nav = (href: string, label: string, key: string) => {
    const active = opts.active === key;
    return `<a href="${href}" style="margin-right:16px;${
      active ? 'font-weight:700;text-decoration:underline;' : ''
    }">${escapeHtml(label)}</a>`;
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(opts.title)} — Outbound Admin</title>
  <style>
    body { margin:0; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; background:#f4f4f5; color:#18181b; }
    header { background:#18181b; color:#fff; padding:12px 20px; }
    header a { color:#e4e4e7; text-decoration:none; font-size:14px; }
    header .brand { font-weight:700; letter-spacing:0.06em; text-transform:uppercase; margin-right:24px; color:#fff; }
    main { max-width:1100px; margin:24px auto; padding:0 16px 48px; }
    .cards { display:flex; flex-wrap:wrap; gap:12px; margin-bottom:24px; }
    .card { background:#fff; border:1px solid #e4e4e7; border-radius:8px; padding:14px 16px; min-width:140px; }
    .card .n { font-size:28px; font-weight:700; }
    .card .l { font-size:12px; color:#71717a; text-transform:uppercase; letter-spacing:0.04em; }
    .warn { background:#fef2f2; border-color:#fecaca; }
    table { width:100%; border-collapse:collapse; background:#fff; border:1px solid #e4e4e7; border-radius:8px; overflow:hidden; }
    th, td { text-align:left; padding:10px 12px; border-bottom:1px solid #f4f4f5; font-size:14px; vertical-align:top; }
    th { background:#fafafa; font-size:12px; text-transform:uppercase; letter-spacing:0.04em; color:#52525b; }
    tr:hover td { background:#fafafa; }
    a { color:#1d4ed8; }
    .pill { display:inline-block; padding:2px 8px; border-radius:999px; font-size:12px; background:#e4e4e7; }
    .pill.danger { background:#fecaca; color:#991b1b; }
    .pill.ok { background:#dcfce7; color:#166534; }
    .muted { color:#71717a; font-size:13px; }
    h1 { font-size:22px; margin:0 0 8px; }
    h2 { font-size:16px; margin:28px 0 10px; }
    textarea { width:100%; min-height:100px; box-sizing:border-box; padding:10px; border:1px solid #d4d4d8; border-radius:6px; font:inherit; }
    button, .btn { background:#18181b; color:#fff; border:0; border-radius:6px; padding:8px 14px; font-size:14px; cursor:pointer; text-decoration:none; display:inline-block; }
    .thread { background:#fff; border:1px solid #e4e4e7; border-radius:8px; padding:12px; }
    .msg { border-bottom:1px solid #f4f4f5; padding:10px 0; }
    .msg:last-child { border-bottom:0; }
    .msg.in { border-left:3px solid #3b82f6; padding-left:10px; }
    .msg.out { border-left:3px solid #a1a1aa; padding-left:10px; }
    .msg.esc { background:#fef2f2; }
    pre { white-space:pre-wrap; font-family:inherit; margin:6px 0 0; font-size:14px; }
  </style>
</head>
<body>
  <header>
    <span class="brand">Outbound Admin</span>
    ${nav('/api/admin/dashboard', 'Dashboard', 'dashboard')}
    ${nav('/api/admin/dashboard/escalations', 'Escalations', 'escalations')}
    <form method="POST" action="/api/admin/follow-ups/run" style="display:inline;margin-right:16px;">
      <button type="submit" style="background:#3f3f46;padding:4px 10px;font-size:13px;">Run Follow-ups</button>
    </form>
    ${nav('/api/admin/health', 'API Health', 'health')}
  </header>
  <main>
    ${opts.bodyHtml}
  </main>
  <script>
    // Attach Bearer token from localStorage for fetch-based actions if present
    window.__adminToken = localStorage.getItem('outbound_admin_token') || '';
  </script>
</body>
</html>`;
}

export { escapeHtml };
