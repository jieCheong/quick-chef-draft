/*
This file sets up the connection to the PostgreSQL database using the `pg` library. It exports a `Pool` instance that can be used throughout the application to execute queries against the database. The connection configuration is read from environment variables, allowing for flexibility in different environments (development, testing, production).
Pool instead of a single connection because it opening a database
connection takes ~50ms of network handshake. If every single
request opened its own connection, my server would be 50ms slower 
on every request, and under load It'd hit PostgreSQL's
connection limit (~100) almost instantly.

Pool re-opens N connections and resues them:
1. Request 1 arrives -> pool gives it connection A
2. Request 2 arrives -> pool gives it connection B
3. Request 1 finishes -> pool takes back connection A
4. Request 3 arrives -> pool gives it connection A again

Never open or close connections manually, just call pool.query()
*/
import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

// create the pool. reads DATABASE_URL from process.env.
//
// ssl is derived from DATABASE_URL itself rather than hardcoded or keyed
// off NODE_ENV: Neon's connection string always carries ?sslmode=require
// (it rejects plain connections), but the local docker-compose Postgres
// (postgresql://postgres:postgres@db:5432/quickchef) has no SSL support
// at all — requesting SSL against it fails with "The server does not
// support SSL connections". Reading the flag off the URL means the same
// code works against both without needing an extra env var to keep in sync.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('sslmode=require')
    ? { rejectUnauthorized: false }
    : false,
});

// test the connection when module loads
pool.connect((err, client, release) => {
    if (err) {
        console.error('Error connecting to the database:', err.message);
        console.error('Check DATABASE_URL in server/.env');
    } else {
        console.log('Successfully connected to the database');
        release();
    }
});

export default pool;