import {Router, Request, Response} from 'express';
import pool from '../db';
import {requireAuth} from '../middleware/auth';
import {validate} from '../middleware/validate';
import {updateProfileSchema} from '../schemas/profile.schema';

const router = Router();

// all route in theis file require auth
router.use(requireAuth);

// get /api/profile
// returns the profile row for the logged in user
// also joins the users table to include email
router.get('/', async (req: Request, res: Response): Promise<void> => {
    try {
        const result = await pool.query(
            `SELECT
            p.id,
            p.user_id,
            p.display_name,
            p.dietary_style,
            p.allergies,
            p.skill_level,
            p.preferred_cuisines,
            p.monthly_goals,
            p.calorie_goal,
            p.protein_goal,
            p.onboarding_completed,
            p.created_at,
            p.updated_at,
            u.email
            FROM user_profiles p
            JOIN users u ON u.id = p.user_id
            WHERE p.user_id = $1`,
            [req.userId]
        );
        if (result.rows.length === 0) {
            res.status(404).json({message: 'Profile not found.'});
            return;
        }
        res.json({profile: result.rows[0]});
    } catch(error) {
        console.error('GET /api/profile error:', error);
        res.status(500).json({message: 'Failed to fetch profile.'});
    }
});
// PATH
router.patch('/', validate(updateProfileSchema), async (req: Request, res: Response):
Promise<void> => {
    const ALLOWED_FIELDS = [
        'display_name',
        'dietary_style',
        'allergies',
        'skill_level',
        'preferred_cuisines',
        'monthly_goals',
        'calorie_goal',
        'protein_goal',
        'onboarding_completed',
    ] as const;

    const updates: string[] = [];
    const values: unknown[] = [];

    ALLOWED_FIELDS.forEach((field) => {
        if (req.body[field] !== undefined) {
            updates.push(`${field} = $${values.length + 1}`);
            values.push(req.body[field]);
        }
    });
    if (updates.length == 0) {
        res.status(400).json({message: 'No valid fields to update.'});
        return;
    }
    values.push(req.userId);
    const whereIndex = values.length;

    try {
        const result = await pool.query(
            `UPDATE user_profiles
            SET ${updates.join(', ')}
            WHERE user_id = $${whereIndex}
            RETURNING *`,
          values
        );
        if (result.rows.length === 0) {
            res.status(404).json({message: 'Profile not found.'});
            return;
        }
        res.json({profile: result.rows[0]});
    } catch(error) {
        console.error('PATH /api/profile error:', error);
        res.status(500).json({message: 'Failed to update profile.'});
    }
});
export default router;