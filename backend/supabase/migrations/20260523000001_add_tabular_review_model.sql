-- Add per-review model selection to tabular_reviews.
-- Nullable. When null the backend defaults to the user's medium tier at
-- run time. Can hold either a tier name ("high" / "medium" / "low") or a
-- provider-qualified slug ("anthropic:claude-sonnet-4-6").
-- Backfill: existing reviews inherit the creating user's tabular_model
-- setting where the join is available.

alter table public.tabular_reviews
  add column if not exists model text;

-- Best-effort backfill — only touches rows where the user still has a
-- profile row with a non-default tabular_model value.
update public.tabular_reviews tr
set    model = up.tabular_model
from   public.user_profiles up
where  tr.user_id = up.user_id::text
  and  up.tabular_model is not null
  and  up.tabular_model <> 'gemini-3-flash-preview'
  and  tr.model is null;
