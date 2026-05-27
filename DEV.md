# Mike — Dev Rosetta Stone

## Where things run (local machine)

| Service | Port | Start command | Log |
|---|---|---|---|
| Backend (tsx watch) | 4001 | `cd backend && npm run dev > /tmp/mike-backend.log 2>&1 &` | `tail -f /tmp/mike-backend.log` |
| Frontend (Next.js) | 4000 | `cd frontend && npm run dev` | terminal |
| Supabase (local) | 54321 (API) / 54322 (Postgres) | managed externally | — |

## Kill & restart backend

```bash
pkill -f "tsx.*src/index.ts" 2>/dev/null || true
cd /home/admin/kickoff/3rd-party/mike/backend
npm run dev > /tmp/mike-backend.log 2>&1 &
echo "Backend PID: $!"
tail -f /tmp/mike-backend.log
```

## Check what's on a port

```bash
ss -tlnp | grep 4001
cat /proc/$(ss -tlnp | grep 4001 | grep -oP 'pid=\K\d+')/cmdline | tr '\0' ' '
```

## Apply DB migrations manually

```bash
PGPASSWORD=postgres psql -h localhost -p 54322 -U postgres -d postgres \
  -f /home/admin/kickoff/3rd-party/mike/backend/supabase/migrations/<filename>.sql
```

Check what columns exist:
```bash
PGPASSWORD=postgres psql -h localhost -p 54322 -U postgres -d postgres \
  -c "\d public.user_profiles"
```

## Key env files

- `backend/.env` — PORT, SUPABASE_URL, encryption secret, provider API keys
- `frontend/.env.local` — SUPABASE_SECRET_KEY, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY, NEXT_PUBLIC_API_BASE_URL

## Cloudflare tunnel / self-hosting

The frontend proxies both the backend API and Supabase through Next.js, so
**only port 4000 needs to be exposed to the internet** — no separate tunnels for
4001 (backend) or 54321 (Supabase).

How it works:
- `NEXT_PUBLIC_API_BASE_URL=/api/backend` — the browser calls `/api/backend/...`
  on the same origin; `next.config.ts` rewrites this to `http://localhost:4001`
  server-side (configurable via `BACKEND_INTERNAL_URL` in `.env.local`)
- Supabase auth calls are proxied through `/api/supabase/...` via a Next.js
  API route (`src/app/api/supabase/[...path]/route.ts`) which forwards to
  `http://localhost:54321` (configurable via `SUPABASE_INTERNAL_URL` in `.env.local`)
- `supabase.ts` derives the Supabase URL from `window.location.origin` at
  runtime so it works with any public hostname without changing `.env.local`

To add behind a Cloudflare tunnel: point the tunnel at port 4000 only.

## Backend source layout

```
backend/src/
  index.ts                    — Express app, rate limiters, route mounts
  lib/llm/
    types.ts                  — Provider union, UserApiKeys, StreamChatParams
    providers.ts              — Provider registry (source of truth for all providers)
    models.ts                 — Tier constants, resolveModel, providerForModel
    routing.ts                — parseQualifiedId, resolveTier, resolveReviewModel
    index.ts                  — streamChatWithTools, completeText (with Concentrate fallback)
  lib/userSettings.ts         — getUserModelSettings (reads tier columns + tabular_model)
  lib/userApiKeys.ts          — encrypt/decrypt, getUserApiKeys, getUserApiKeyStatus
  routes/
    user.ts                   — profile CRUD, tier-models, enabled-models, api-keys
    tabular.ts                — tabular review CRUD + generate/chat
    providerModels/           — GET /providers/:id/models (one normalizer per provider)
      concentrate.ts, anthropic.ts, gemini.ts, openai.ts, generic.ts
```

## Adding a new provider

1. Add to `Provider` union in `lib/llm/types.ts`
2. Add entry to `PROVIDERS` array in `lib/llm/providers.ts`
3. Add normalizer in `routes/providerModels/<name>.ts`
4. Wire it in `routes/providerModels/index.ts`
5. Add to `CATALOG_PROVIDERS` in `frontend/src/app/lib/providerModels.ts`
6. DB migration to add provider to `user_api_keys` CHECK constraint (if key is DB-stored)

## DB migration checklist

When adding columns to `user_profiles` or `tabular_reviews`:
1. Write migration in `backend/supabase/migrations/YYYYMMDDHHMMSS_<name>.sql`
2. Update `backend/schema.sql` (for fresh installs)
3. Apply to local DB: `PGPASSWORD=postgres psql -h localhost -p 54322 -U postgres -d postgres -f <file>`

## Common gotchas

- **Backend running old code**: process is `tsx watch src/index.ts` — kill + restart picks up changes immediately, no build needed
- **Enabled/tier columns missing**: run the `20260523000000_add_tier_columns.sql` migration
- **Price off by 1M**: Concentrate returns price already per-million tokens — don't multiply
- **`generic` provider**: env-only (GENERIC_BASE_URL + GENERIC_API_KEY), no DB row, not in catalog tabs unless configured
