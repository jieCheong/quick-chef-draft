import {Router, Request, Response} from 'express';
import pool from '../db';
import { requireAuth} from '../middleware/auth';
import { validate } from '../middleware/validate';
import { idParamSchema } from '../schemas/recipes.schema';

const router = Router();
router.use(requireAuth);

// get
router.get('/', async(req: Request, res: Response): Promise<void> => {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : null;
    try {
        const query = limit
            ? `SELECT * FROM saved_recipes WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`
            : `SELECT * FROM saved_recipes WHERE user_id = $1 ORDER BY created_at DESC`;
            const params = limit ? [req.userId, limit] : [req.userId];
            const result = await pool.query(query, params);  
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

// patch
// Called from Saved.tsx when a step image is generated for an
// already-saved recipe, so the image persists instead of being
// regenerated (and re-billed) every time the recipe is viewed.
router.patch('/:id', validate(idParamSchema, 'params'), async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { instructions } = req.body;

    if (!instructions) {
        res.status(400).json({ message: 'Instructions are required.' });
        return;
    }

    try {
        const result = await pool.query(
            `UPDATE saved_recipes
             SET instructions = $1, updated_at = NOW()
             WHERE id = $2 AND user_id = $3
             RETURNING *`,
            [JSON.stringify(instructions), id, req.userId]
        );
        if (result.rows.length === 0) {
            res.status(404).json({ message: 'Recipe not found.' });
            return;
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error('PATCH /api/recipes/:id error:', error);
        res.status(500).json({ message: 'Failed to update recipe.' });
    }
});

// delete
router.delete('/:id', validate(idParamSchema, 'params'), async (req: Request, res: Response): Promise<void> => {
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
