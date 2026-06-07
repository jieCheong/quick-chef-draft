// GET - fetch all pantry items for the logged-in user
// POST - add a new pantry item
// DELETE - remove a pantry item by id

import { Router, Request, Response } from 'express';
import pool from '../db';
import { requireAuth } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

// get
router.get('/', async(req: Request, res: Response): Promise<void> => {
    try {
        const result = await pool.query(
            `SELECT id, user_id, name, category, created_at
            FROM pantry_items
            WHERE user_id = $1
            ORDER BY category, name ASC`,
            [req.userId]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('GET /api/pantry error:', error);
        res.status(500).json({message: 'Failed to fetch pantry items.'});
    }
});

// post
router.post('/', async (req: Request, res: Response): Promise<void> => {
    const {name, category = 'other'} = req.body;

    if (!name || !name.trim()) {
        res.status(400).json({message: 'Item name is required.'});
        return;
    }
    try {
        // check for duplicates - no point adding "Chicken" twice
        // LOWER() makes the check case-insensitive
        const existing = await pool.query(
            `SELECT id FROM pantry_items
            WHERE user_id = $1 AND LOWER(name) = LOWER($2)`,
            [req.userId, name.trim()]
        );
        if (existing.rows.length > 0) {
            res.status(409).json({message: `"${name}" is already in your pantry.`});
            return;
        }
        const result = await pool.query(
            `INSERT INTO pantry_items (user_id, name, category)
            VALUES ($1, $2, $3)
            RETURNING id, user_id, name, category, created_at`,
            [req.userId, name.trim(), category]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('POST /api/pantry error:', error);
        res.status(500).json({message: 'Failed to add pantry item.'});
    }
});

// delete
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
    const {id} = req.params;

    try {
        const result = await pool.query(
            `DELETE FROM pantry_items
            WHERE id = $1 AND user_id = $2
            RETURNING id`,
            [id, req.userId]
        );
        if (result.rows.length === 0) {
            res.status(404).json({message: 'Item not found.'});
            return;
        }
        res.status(204).send();
    } catch (error) {
        console.error('DELETE /api/pantry/:id error:', error);
        res.status(500).json({message: 'Failed to remove pantry item.'});
    }
});
export default router;