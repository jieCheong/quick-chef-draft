-- This file defines every table in the QuickChef db
-- To run: psql -U <username> -d <database_name> -f schema.sql
-- Important: The order of CREATE TABLE statements matters

-- Extensions
-- uuid-ossp gives uuid_generate_v4() to auto-generate unique IDs.
-- Use UUID instead of auto-increment integer bc:
-- 1. IDs are unguessable (security)
-- 2. They work across multiple db without ID collisions
-- 3. Industry standard for user-facing IDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
-- Stores login credentials and metadata for each user
-- Split users and profiles since Auth data is sensitive and accessed on every request
-- Profile data is larger and only needed sometimes
-- Splitting them keeps the user table fast and small
CREATE TABLE IF NOT EXISTS users (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email          VARCHAR(255) UNIQUE NOT NULL,
    password_hash  VARCHAR(255) NOT NULL,
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- User profiles table
-- One profile per user, stored personalization data for AI recipe generation
CREATE TABLE IF NOT EXISTS user_profiles (
    id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id              UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    display_name         VARCHAR(100),
    dietary_style        VARCHAR(50),
    allergies            TEXT[] DEFAULT '{}',
    skill_level          VARCHAR(20),
    preferred_cuisines   TEXT[] DEFAULT '{}',
    monthly_goals        TEXT[] DEFAULT '{}',
    calorie_goal         INT,
    protein_goal         INT,
    onboarding_completed BOOLEAN DEFAULT FALSE,
    created_at           TIMESTAMPTZ DEFAULT NOW(),
    updated_at           TIMESTAMPTZ DEFAULT NOW()
);

-- Pantry Items table
-- Each user can have multiple pantry items, stored as an array of JSON objects
CREATE TABLE IF NOT EXISTS pantry_items (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name       VARCHAR(100) NOT NULL,
    category   VARCHAR(50) DEFAULT 'other',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Saved Recipes table
-- Store ingredients, instructions, and nutrition as JSONB (JSON Binary)
-- It allows PostgreSQL to validate the JSON on insert, I can
-- query into the json, and faster reads than text.
-- JSONB is perfect for the flexible, nested data of recipes.
CREATE TABLE IF NOT EXISTS saved_recipes (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title          VARCHAR(255) NOT NULL,
    description    TEXT,
    image_url      TEXT,
    cooking_time_minutes INT,
    difficulty      VARCHAR(20),
    servings       INT,
    cuisines        TEXT[] DEFAULT '{}',
    goal_alignment   TEXT[] DEFAULT '{}',
    is_quick_meal     BOOLEAN DEFAULT FALSE,
    ingredients    JSONB NOT NULL,
    instructions   JSONB NOT NULL,
    nutrition      JSONB,
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Usage Daily
-- Tracks how many ai recipe generations each user had used per day
-- Free 2 for users
CREATE TABLE IF NOT EXISTS usage_daily (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date             DATE NOT NULL DEFAULT CURRENT_DATE,
    generations_used INT DEFAULT 0,
    max_generations  INT DEFAULT 2,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, date)
);

--Viral Recipes
-- These are not user generated, I add them manually in the Neon db
-- The week_start / week_end + active columns let me:
-- 1. Pre-load next week's recipes in advance
-- 2. Control which ones are currently visible from the db
-- 3. Update content wo redeploying the app
CREATE TABLE IF NOT EXISTS viral_recipes (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title          VARCHAR(255) NOT NULL,
    description    TEXT,
    image_url      TEXT,
    ingredients    JSONB NOT NULL,
    instructions   JSONB NOT NULL,
    nutrition      JSONB,
    tags           TEXT[] DEFAULT '{}',
    week_start     DATE NOT NULL,
    week_end       DATE NOT NULL,
    active         BOOLEAN DEFAULT FALSE,
    created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
-- It is a data struture that makes loopups fater
-- PostgreSQL jumps directly to matching rows
CREATE INDEX IF NOT EXISTS idx_pantry_items_user_id ON pantry_items(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_recipes_user_id ON saved_recipes(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_daily_user_id ON usage_daily(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_daily_date ON usage_daily(date);
CREATE INDEX IF NOT EXISTS idx_viral_recipes_active ON viral_recipes(active);

-- Auto update updated_at column on row update
-- PostgreSQL doesn't automatically update "updated_at" when row changes
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- Attatch the trigger to each table that has an updated_at column
CREATE OR REPLACE TRIGGER update_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON user_profiles
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_saved_recipes_updated_at
BEFORE UPDATE ON saved_recipes
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_usage_daily_updated_at
BEFORE UPDATE ON usage_daily
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();