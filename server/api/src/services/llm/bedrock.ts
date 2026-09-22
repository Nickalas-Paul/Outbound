/**
 * AWS Bedrock Converse adapter for Claude Haiku (classify) and Sonnet (compose).
 */

import {
  BedrockRuntimeClient,
  ConverseCommand,
  type ConverseCommandOutput,
} from '@aws-sdk/client-bedrock-runtime';

const REGION = process.env.AWS_REGION?.trim() || 'us-east-1';

/** Claude Haiku 4.5 inference profile (us-east-1). */
export const HAIKU_MODEL_ID =
  process.env.BEDROCK_HAIKU_MODEL_ID?.trim() ||
  'us.anthropic.claude-haiku-4-5-20251001-v1:0';

/** Claude Sonnet 4.5 inference profile (us-east-1). */
export const SONNET_MODEL_ID =
  process.env.BEDROCK_SONNET_MODEL_ID?.trim() ||
  'us.anthropic.claude-sonnet-4-5-20250929-v1:0';

export const LLM_UNAVAILABLE_PREFIX = '[LLM_UNAVAILABLE]';

let client: BedrockRuntimeClient | null | undefined;
let warnedMissing = false;

function getClient(): BedrockRuntimeClient | null {
  if (client !== undefined) return client;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();
  if (!accessKeyId || !secretAccessKey) {
    if (!warnedMissing) {
      console.warn(
        '[llm] AWS credentials not configured — Bedrock calls will return fallback'
      );
      warnedMissing = true;
    }
    client = null;
    return null;
  }
  client = new BedrockRuntimeClient({
    region: REGION,
    credentials: { accessKeyId, secretAccessKey },
  });
  return client;
}

export function isBedrockConfigured(): boolean {
  return Boolean(getClient());
}

function extractText(output: ConverseCommandOutput): string {
  const parts = output.output?.message?.content ?? [];
  const texts: string[] = [];
  for (const part of parts) {
    if ('text' in part && typeof part.text === 'string') {
      texts.push(part.text);
    }
  }
  return texts.join('\n').trim();
}

async function converse(opts: {
  modelId: string;
  systemPrompt: string;
  userMessage: string;
  maxTokens: number;
  temperature: number;
}): Promise<string> {
  const bedrock = getClient();
  if (!bedrock) {
    return `${LLM_UNAVAILABLE_PREFIX} Bedrock credentials not configured`;
  }

  try {
    const response = await bedrock.send(
      new ConverseCommand({
        modelId: opts.modelId,
        system: [{ text: opts.systemPrompt }],
        messages: [
          {
            role: 'user',
            content: [{ text: opts.userMessage }],
          },
        ],
        inferenceConfig: {
          maxTokens: opts.maxTokens,
          temperature: opts.temperature,
        },
      })
    );
    const text = extractText(response);
    if (!text) {
      return `${LLM_UNAVAILABLE_PREFIX} Empty Bedrock response`;
    }
    return text;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[llm] Bedrock Converse error:', message);
    return `${LLM_UNAVAILABLE_PREFIX} ${message}`;
  }
}

export async function classifyWithHaiku(
  systemPrompt: string,
  userMessage: string
): Promise<string> {
  return converse({
    modelId: HAIKU_MODEL_ID,
    systemPrompt,
    userMessage,
    maxTokens: 2048,
    temperature: 0.3,
  });
}

export async function composeWithSonnet(
  systemPrompt: string,
  userMessage: string
): Promise<string> {
  return converse({
    modelId: SONNET_MODEL_ID,
    systemPrompt,
    userMessage,
    maxTokens: 8192,
    temperature: 0.7,
  });
}

/**
 * Strip markdown fences / preamble and parse JSON.
 */
export function parseModelJson<T>(raw: string): T {
  if (raw == null || typeof raw !== 'string') {
    throw new Error('parseModelJson: expected a string');
  }
  if (raw.startsWith(LLM_UNAVAILABLE_PREFIX)) {
    throw new Error(`parseModelJson: LLM unavailable — ${raw}`);
  }

  let text = raw.trim();

  // Strip ```json ... ``` or ``` ... ```
  const fence = text.match(/^```(?:json)?\s*([\s\S]*?)```\s*$/i);
  if (fence) {
    text = fence[1].trim();
  } else if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  }

  const firstObj = text.indexOf('{');
  const firstArr = text.indexOf('[');
  let start = -1;
  if (firstObj === -1) start = firstArr;
  else if (firstArr === -1) start = firstObj;
  else start = Math.min(firstObj, firstArr);

  if (start === -1) {
    throw new Error('parseModelJson: no JSON object/array found in model output');
  }

  const lastObj = text.lastIndexOf('}');
  const lastArr = text.lastIndexOf(']');
  const end = Math.max(lastObj, lastArr);
  if (end < start) {
    throw new Error('parseModelJson: malformed JSON bounds in model output');
  }

  const slice = text.slice(start, end + 1);
  try {
    return JSON.parse(slice) as T;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`parseModelJson: JSON.parse failed — ${msg}`);
  }
}
