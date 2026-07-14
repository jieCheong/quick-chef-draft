// server/src/lib/generateFoodImage.ts
//
// Shared OpenAI Images API call, used both for user-triggered step images
// (routes/generateImage.ts) and for trending-recipe hero images
// (lib/rotateViralRecipes.ts). Pulled out once a second caller needed the
// exact same "call gpt-image-1, turn the base64 response into a data URI"
// logic, rather than duplicating it a third time.

import OpenAI from 'openai';
import { retryWithBackoff, isRetryableOpenAIError } from './retryWithBackoff';

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

export async function generateFoodImage(prompt: string): Promise<string> {
  const result = await retryWithBackoff(
    () =>
      getOpenAI().images.generate({
        model: 'gpt-image-1',
        prompt,
        size: '1024x1024',
        quality: 'medium',
        n: 1,
      }),
    {
      maxRetries: 2,
      baseDelayMs: 500,
      shouldRetry: isRetryableOpenAIError,
    }
  );

  // gpt-image-1 only returns base64-encoded image data (no hosted url option
  // like dall-e-3 had) — turned into a data URI here since this app has no
  // object storage to upload the bytes to.
  const b64 = result.data?.[0]?.b64_json;
  if (!b64) throw new Error('OpenAI returned no image data');
  return `data:image/png;base64,${b64}`;
}
