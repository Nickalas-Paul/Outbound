/**
 * Unit checks for parseModelJson (no network).
 */
import assert from 'assert';
import { parseModelJson } from '../services/llm/bedrock';

function run(): void {
  assert.deepStrictEqual(
    parseModelJson<{ a: number }>('```json\n{"a":1}\n```'),
    { a: 1 }
  );
  assert.deepStrictEqual(
    parseModelJson<{ ok: boolean }>('Here you go:\n{"ok":true}\nThanks!'),
    { ok: true }
  );
  assert.deepStrictEqual(parseModelJson<number[]>('[1,2,3]'), [1, 2, 3]);
  let threw = false;
  try {
    parseModelJson('no json here');
  } catch {
    threw = true;
  }
  assert.ok(threw, 'expected throw on non-json');
  console.log('parseModelJson unit checks OK');
}

run();
