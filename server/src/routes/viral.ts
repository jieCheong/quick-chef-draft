// This file returns this week's active viral recipes
// this route is public, no requireAuth middleware
// Content is fully automated: rotateViralRecipesIfStale() (see
// lib/rotateViralRecipes.ts) generates 3 new AI recipes and flips
// active=true on them whenever the current batch turns 7+ days old.

import { Router, Request, Response } from "express";
import pool from '../db';
const router = Router();

router.get('/', async (req: Request, res: Response): Promise<void> => {
    try {
        const result = await pool.query(
            `SELECT
                id, title, description, image_url,
                cooking_time_minutes, difficulty,
                ingredients, instructions, nutrition,
                tags, week_start, week_end, created_at
                FROM viral_recipes
                WHERE active = true
                ORDER BY created_at DESC
                LIMIT 3`
        );
        res.json(result.rows);
    } catch (error) {
        req.log.error({ err: error }, 'GET /api/viral-recipes error');
        res.status(500).json({message: 'Failed to fetch viral recipes.'});
    }
});
export default router;