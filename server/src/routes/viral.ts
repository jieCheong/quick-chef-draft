// This file returns this week's active viral recipes
// this route is public, no requireAuth middleware
// I control the content by inserting rows into viral_recipes table in Neon
// Set active=true for recipes I want shown this week.

import { Router, Request, Response } from "express";
import pool from '../db';
const router = Router();

router.get('/', async (_req: Request, res: Response): Promise<void> => {
    try {
        const result = await pool.query(
            `SELECT
                id, title, description, image_url,
                ingredients, instructions, nutrition,
                tags, week_start, week_end, created_at
                FROM viral_recipes
                WHERE active = true
                ORDER BY created_at DESC
                LIMIT 10`
        );
        res.json(result.rows);
    } catch (error) {
        console.error('GET /api/viral-recipes error:', error);
        res.status(500).json({message: 'Failed to fetch viral recipes.'});
    }
});
export default router;