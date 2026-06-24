import { z } from 'zod';
 
// .email() validates format. .toLowerCase() normalizes before it ever
// reaches the database — this means "Test@Gmail.com" and "test@gmail.com"
// are guaranteed identical by the time route logic runs, not just by
// convention in route code (which is easy to forget in a new route).
const emailField = z
  .string()
  .min(1, 'Email is required.')
  .email('Please enter a valid email address.')
  .toLowerCase()
  .trim();
 
const passwordField = z
  .string()
  .min(6, 'Password must be at least 6 characters.')
  .max(72, 'Password is too long.'); // bcrypt silently truncates beyond 72 bytes — cap it explicitly
 
export const registerSchema = z.object({
  email: emailField,
  password: passwordField,
  // .optional() means the field can be omitted entirely.
  // If present, it must be a string between 1-100 chars.
  display_name: z.string().trim().min(1).max(100).optional(),
});
 
export const loginSchema = z.object({
  email: emailField,
  // Login doesn't need the same strength rules as registration —
  // we're checking an EXISTING password, not creating a new one.
  // Just require it's present.
  password: z.string().min(1, 'Password is required.'),
});
 
// Infer TypeScript types directly from the schemas.
// This means the type and the validator can never drift out of sync —
// if you add a field to the schema, the type updates automatically.
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
 