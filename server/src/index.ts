import dotenv from 'dotenv';
dotenv.config();

import './db'; // runs the connection test on import, same as before
import { buildApp } from './app';

const app = buildApp();
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`🚀 QuickChef server running on http://localhost:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/health`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
});