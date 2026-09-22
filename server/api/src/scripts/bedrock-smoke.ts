/**
 * Smoke test: Bedrock Haiku classify via ConverseCommand.
 * Run from server/api: npx ts-node --transpile-only src/scripts/bedrock-smoke.ts
 */

import '../config/env';
import {
  classifyWithHaiku,
  HAIKU_MODEL_ID,
  isBedrockConfigured,
  LLM_UNAVAILABLE_PREFIX,
  parseModelJson,
} from '../services/llm/bedrock';

async function main(): Promise<void> {
  console.log('Bedrock configured:', isBedrockConfigured());
  console.log('Haiku model:', HAIKU_MODEL_ID);

  const result = await classifyWithHaiku(
    'You classify short customer messages. Reply with a single lowercase label only: question or complaint.',
    "Classify this email as question or complaint: 'What time does the hotel check-in open?'"
  );

  console.log('Raw response:', result);
  if (result.startsWith(LLM_UNAVAILABLE_PREFIX)) {
    console.error('SMOKE_FAIL: LLM unavailable');
    process.exit(1);
  }

  // Sanitizer unit check
  const sample = parseModelJson<{ ok: boolean }>(
    'Sure!\n```json\n{"ok":true}\n```\nThanks'
  );
  console.log('parseModelJson sample:', sample);

  console.log('SMOKE_OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
