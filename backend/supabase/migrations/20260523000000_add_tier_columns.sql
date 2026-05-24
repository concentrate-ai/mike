-- Add per-tier model preferences and catalog state to user_profiles.
-- high_model / medium_model / low_model: nullable provider-qualified slugs.
-- Null means "use the server-side fallback constant for this tier."
-- enabled_models / favorite_models: arrays of provider-qualified ids like
-- "anthropic:claude-opus-4-7". enabled_models replaces the old global MODELS
-- hardcoded list; favorite_models already existed as bare slugs but is
-- re-defined here to be consistent with qualified ids going forward.
-- custom_models: user-entered slugs not fetched from any provider API.

alter table public.user_profiles
  add column if not exists high_model   text,
  add column if not exists medium_model text,
  add column if not exists low_model    text,
  add column if not exists enabled_models  jsonb not null default '[]'::jsonb,
  add column if not exists custom_models   jsonb not null default '[]'::jsonb;
