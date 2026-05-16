-- Add favorite_models JSONB column to user_profiles.
-- Stores an array of model ID strings, e.g. ["claude-sonnet-4-6","deepseek-r1"].
-- Default empty array so the frontend can always iterate without null checks.
alter table public.user_profiles
  add column if not exists favorite_models jsonb not null default '[]'::jsonb;
