# Mike — Dev Reference

## Default ports
| Service | Default port | Start command |
|---|---|---|
| Backend | 3001 | `npm run dev --prefix backend` |
| Frontend | 3000 | `npm run dev --prefix frontend` |
| Supabase (local) | 54321 (API) / 54322 (Postgres) | `supabase start` |
| Ollama | 11434 | `ollama serve` |

Override with `PORT=XXXX` env var for backend or frontend.

## Kill & restart backend

```bash
pkill -f "tsx.*src/index.ts" 2>/dev/null || true
cd backend && npm run dev
```

## Check what's on a port

```bash
ss -tlnp | grep 3001
```

## Apply DB migrations manually

```bash
PGPASSWORD=postgres psql -h localhost -p 54322 -U postgres -d postgres \
  -f backend/supabase/migrations/<filename>.sql```

Check table schema:
```bash
PGPASSWORD=postgres psql -h localhost -p 54322 -U postgres -d postgres \
  -c "\d public.user_profiles"
```

## Key env files

- `backend/.env` — PORT, SUPABASE_URL, encryption secrets, provider API keys
- `frontend/.env.local` — NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY, NEXT_PUBLIC_API_BASE_URL

## Cloudflare tunnel / self-hosting

The frontend proxies both the backend API and Supabase through Next.js, so
**only the frontend port needs to be exposed to the internet**.

How it works:
- `NEXT_PUBLIC_API_BASE_URL=/api/backend` — browser calls `/api/backend/...`
  on the same origin; a Next.js API route forwards server-to-server to
  `BACKEND_INTERNAL_URL` (default `http://localhost:3001`)
- Supabase auth calls proxy through `/api/supabase/...` to `SUPABASE_INTERNAL_URL`
  (default `http://localhost:54321`)
- `supabase.ts` derives the Supabase URL from `window.location.origin` at
  runtime so it works with any public hostname without changing `.env.local`

To expose behind a Cloudflare tunnel: point the tunnel at the frontend port only.

## Docker Compose

```bash
# Copy and fill in env
cp .env.example .env

# Start app (requires external Supabase — cloud or `supabase start`)
docker compose up -d

# With Ollama (GPU recommended)
docker compose --profile ollama up -d
```

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
3. Add `lib/llm/<provider>.ts` adapter (copy `ollama.ts` as template)
4. Wire into `streamChatWithTools` / `completeText` in `lib/llm/index.ts`
5. Add normalizer in `routes/providerModels/<name>.ts`
6. Wire it in `routes/providerModels/index.ts`
7. Add to `CATALOG_PROVIDERS` in `frontend/src/app/lib/providerModels.ts`

## DB migration checklist

When adding columns to `user_profiles` or `tabular_reviews`:
1. Write migration in `backend/supabase/migrations/YYYYMMDDHHMMSS_<name>.sql`
2. Update `backend/schema.sql` (for fresh installs)
3. Apply to local DB (see Apply DB migrations above)
## Common gotchas

- **Backend running old code**: process is `tsx watch src/index.ts` — kill + restart picks up changes immediately
- **Enabled/tier columns missing**: run the `20260523000000_add_tier_columns.sql` migration
- **Port conflicts**: check `ss -tlnp | grep <port>` and kill the occupying process
