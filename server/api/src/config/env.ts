import path from 'path';
import dotenv from 'dotenv';

// Prefer repo-root .env whether cwd is server/api or monorepo root.
const candidates = [
  path.resolve(process.cwd(), '../../.env'),
  path.resolve(process.cwd(), '.env'),
  path.resolve(__dirname, '../../../../.env'),
];
for (const p of candidates) {
  const result = dotenv.config({ path: p });
  if (!result.error) break;
}
