// server/src/routes/generateImage.ts
//
// POST /api/generate-image — generates a single AI image for one recipe
// instruction step. Mirrors the reserve-before-call / release-on-failure
// usage pattern from generate.ts (same file, same reasoning: a DALL-E
// call costs real money per request, so the daily cap must be enforced
// atomically, before the OpenAI call, not after).

import { Router, Request, Response } from 'express';
import pool from '../db';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { generateImageSchema, GenerateImageInput } from '../schemas/generateImage.schema';
import { generateFoodImage } from '../lib/generateFoodImage';
import { isRetryableOpenAIError } from '../lib/retryWithBackoff';

const router = Router();
router.use(requireAuth);

type Reservation = { reserved: true; used: number; max: number } | { reserved: false };

// Same atomic upsert-with-guard pattern as reserveGenerationSlot in
// generate.ts, targeting the separate images_used/max_images counters so
// step-image generation has its own daily budget independent of the
// recipe-text daily limit.
async function reserveImageSlot(userId: string): Promise<Reservation> {
  const today = new Date().toISOString().split('T')[0];
  const result = await pool.query(
    `INSERT INTO usage_daily (user_id, date, images_used, max_images)
     VALUES ($1, $2, 1, 20)
     ON CONFLICT (user_id, date)
     DO UPDATE SET images_used = usage_daily.images_used + 1, updated_at = NOW()
     WHERE usage_daily.images_used < usage_daily.max_images
     RETURNING images_used, max_images`,
    [userId, today]
  );
  if (result.rows.length === 0) return { reserved: false };
  const { images_used, max_images } = result.rows[0];
  return { reserved: true, used: images_used, max: max_images };
}

async function currentImageUsage(userId: string): Promise<{ used: number; max: number }> {
  const today = new Date().toISOString().split('T')[0];
  const result = await pool.query(
    `SELECT images_used, max_images FROM usage_daily WHERE user_id = $1 AND date = $2`,
    [userId, today]
  );
  if (result.rows.length === 0) return { used: 0, max: 20 };
  const { images_used, max_images } = result.rows[0];
  return { used: images_used, max: max_images };
}

async function releaseImageSlot(userId: string): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  await pool.query(
    `UPDATE usage_daily
     SET images_used = GREATEST(images_used - 1, 0), updated_at = NOW()
     WHERE user_id = $1 AND date = $2`,
    [userId, today]
  );
}

function buildImagePrompt({ recipeTitle, stepInstruction }: GenerateImageInput): string {
  return `A professional food photography shot illustrating one cooking step from the recipe "${recipeTitle}". The step: "${stepInstruction}". Bright natural lighting, overhead or close-up angle as appropriate, appetizing and realistic, no text or watermarks in the image.`;
}

// ─── POST /api/generate-image ──────────────────────────────────────────────
router.post('/', validate(generateImageSchema), async (req: Request, res: Response): Promise<void> => {
  const input = req.body as GenerateImageInput;

  let reservation: Reservation;
  try {
    reservation = await reserveImageSlot(req.userId);
  } catch (error) {
    req.log.error({ err: error }, 'Image usage limit check failed');
    res.status(500).json({ message: 'Failed to check usage limit.' });
    return;
  }

  if (!reservation.reserved) {
    const usage = await currentImageUsage(req.userId).catch(() => ({ used: 20, max: 20 }));
    req.log.warn({ used: usage.used, max: usage.max }, 'Daily image generation limit reached');
    res.status(429).json({
      message: `Daily limit reached. You've generated ${usage.used}/${usage.max} step images today. Resets at midnight.`,
      used: usage.used,
      max: usage.max,
    });
    return;
  }

  try {
    const prompt = buildImagePrompt(input);
    const imageUrl = await generateFoodImage(prompt);

    req.log.info({ stepNumber: input.stepNumber }, 'Step image generation succeeded');

    res.json({
      image_url: imageUrl,
      usage: { used: reservation.used, max: reservation.max, remaining: reservation.max - reservation.used },
    });
  } catch (error) {
    await releaseImageSlot(req.userId).catch((releaseError) => {
      req.log.error({ err: releaseError }, 'Failed to release image usage slot after generation failure');
    });

    req.log.error(
      { err: error, retryable: isRetryableOpenAIError(error) },
      'OpenAI step image generation failed'
    );
    const message = error instanceof Error ? error.message : 'Failed to generate image.';
    res.status(500).json({ message });
  }
});

export default router;
