import dotenv from 'dotenv';
dotenv.config();

import cron from 'node-cron';
import './db'; // runs the connection test on import, same as before
import { buildApp } from './app';
import { rotateViralRecipesIfStale } from './lib/rotateViralRecipes';

const app = buildApp();
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`🚀 QuickChef server running on http://localhost:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/health`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);

  // Check once on startup (in case the 7-day threshold passed while the
  // server was down — a redeploy shouldn't delay a rotation) and again
  // daily via cron. rotateViralRecipesIfStale() only actually regenerates
  // when the active batch is 7+ days old, so these are just polls for
  // that threshold, not literal weekly/daily rotations.
  rotateViralRecipesIfStale().catch((err) =>
    console.error('[viral-rotation] Startup check failed:', err)
  );
  cron.schedule('0 3 * * *', () => {
    rotateViralRecipesIfStale().catch((err) =>
      console.error('[viral-rotation] Scheduled check failed:', err)
    );
  });
});