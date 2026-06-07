import {Router, Request, Response} from 'express';
import pool from '../db';
import { requireAuth} from '../middleware/auth';

const router = Router();
router.use(requireAuth);

// get
router.get('/', async(req: Request, res: Response): Promise<void> => {
    try {
        const result = await pool.query(
            `SELECT
                id, user_id, title, description, image_url,
                cooking_time_minutes, difficulty, servings,
                cuisines, goal_alignment, is_quick_meal,
                ingredients, instructions, nutrition,
                created_at, updated_at
            FROM saved_recipes
            WHERE user_id = $1
            ORDER BY created_at DESC`,
            [req.userId]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('GET /api/recipes error:', error);
        res.status(500).json({message: 'Failed to fetch saved recipes.'});
    }
});

// post
// called from Cook.tsx when the user taps "saved recipe"
// the full recipe object from the AI response is sent in req.body
router.post('/', async (req: Request, res: Response): Promise<void> => {
    const {
        title,
        description,
        image_url,
        cooking_time_minutes,
        difficulty,
        servings,
        cuisines,
        goal_alignment,
        is_quick_meal,
        ingredients,
        instructions,
        nutrition
    } = req.body;

    if (!title || !ingredients || !instructions) {
        res.status(400).json({message: 'Title, ingredients, and instructions are required.'});
        return;
    }
    try {
        const result = await pool.query(
            `INSERT INTO saved_recipes (
            user_id, title, description, image_url,
            cooking_time_minutes, difficulty, servings,
            cuisines, goal_alignment, is_quick_meal,
            ingredients, instructions, nutrition
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *`,
        [
            req.userId,
            title,
            description || null,
            image_url || null,
            cooking_time_minutes || null,
            difficulty || null,
            servings || null,
            cuisines || [],
            goal_alignment || [],
            is_quick_meal || false,
            JSON.stringify(ingredients),
            JSON.stringify(instructions),
            nutrition ? JSON.stringify(nutrition) : null,
        ]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('POST /api/recipes error:', error);
        res.status(500).json({message: 'Failed to save recipe.'});
    }
});

// delete
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
    const {id} = req.params;

    try {
        const result = await pool.query(
            `DELETE FROM saved_recipes
            WHERE id = $1 AND user_id = $2
            RETURNING id`,
        [id, req.userId]
        );
        if (result.rows.length === 0) {
           res.status(404).json({message: 'Recipe not found.'});
           return;
        }
        res.status(204).send();
    } catch (error) {
        console.error('DELETE /api/recipes/:id error:', error);
        res.status(500).json({message: 'Failed to delete recipe.'});
    }
});

export default router;
