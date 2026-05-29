# Mike — Setup Guide

Three ways to run Mike. Pick one.

---

## Option A — Local development

Standard Node.js dev setup. Fastest iteration cycle.

**Prerequisites:** Node.js 20+, npm, [Supabase CLI](https://supabase.com/docs/guides/cli)

```bash
# 1. Clone and install
git clone https://github.com/willchen96/mike.git
cd mike
npm install --prefix backend
npm install --prefix frontend

# 2. Start local Supabase (runs Postgres + Auth in Docker)
supabase start
# → prints URL, anon key, and service role key — copy them below

# 3. Apply the schema to the local database
psql "postgresql://postgres:postgres@localhost:54322/postgres" \
  -f backend/schema.sql

# 4. Configure backend
cp backend/.env.example backend/.env
# Edit backend/.env:
#   PORT=3001
#   SUPABASE_URL=http://localhost:54321
#   SUPABASE_SECRET_KEY=<service role key from supabase start>
#   DOWNLOAD_SIGNING_SECRET=$(openssl rand -hex 32)
#   USER_API_KEYS_ENCRYPTION_SECRET=$(openssl rand -hex 32)
#   CONCENTRATE_API_KEY=<your key>   # or any provider key below

# 5. Configure frontend
cp frontend/.env.local.example frontend/.env.local  # if it exists, else:
cat > frontend/.env.local << 'EOF'
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=<anon key from supabase start>
NEXT_PUBLIC_API_BASE_URL=/api/backend
SUPABASE_SECRET_KEY=<service role key from supabase start>
EOF

# 6. Run
npm run dev --prefix backend   # http://localhost:3001
npm run dev --prefix frontend  # http://localhost:3000
```

Open **http://localhost:3000**, sign up, and start chatting.

---

## Option B — Docker Compose (self-hosted / production)

One command brings up frontend + backend. Requires an external Supabase instance
(cloud or `supabase start` on the host).

**Prerequisites:** Docker, Docker Compose v2

```bash
# 1. Clone
git clone https://github.com/willchen96/mike.git
cd mike

# 2. Create env file
cp .env.example .env
# Edit .env — see "Environment variables" section below

# 3. Apply the database schema (once, on first run)
#    If using supabase start on this machine:
psql "postgresql://postgres:postgres@localhost:54322/postgres" \
  -f backend/schema.sql
#    If using Supabase Cloud: paste schema.sql into the SQL editor

# 4. Start
docker compose up -d

# 5. Check it
docker compose ps
docker compose logs frontend --tail=20
```

Open **http://localhost:3000** (or the port you mapped).

### With Ollama (local LLM)

Requires an NVIDIA GPU and [nvidia-container-toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html).

```bash
# Set in .env:
OLLAMA_BASE_URL=http://ollama:11434/v1/responses
OLLAMA_MODEL=qwen3:30b-a3b   # or any model Ollama supports

docker compose --profile ollama up -d

# Models are pulled automatically on first start by the ollama-init service.
# To pull additional models:
docker compose exec ollama ollama pull llama3.2
```

---

## Option C — Cloudflare tunnel (expose local to internet)

Run Option A or B locally, then expose port 3000 through a Cloudflare tunnel.
Only port 3000 needs to be public — the backend (3001) and Supabase (54321) stay
internal because the frontend proxies all requests server-side.

```bash
# Install cloudflared, then:
cloudflared tunnel --url http://localhost:3000
# → gives you a public URL like https://xxxx.trycloudflare.com
```

For a persistent tunnel (named, with your own domain):
1. Create a tunnel in the [Cloudflare Zero Trust dashboard](https://one.dash.cloudflare.com/)
2. Point it at `http://localhost:3000`
3. No other changes needed — the frontend handles all proxying

---

## Database

### Schema

`backend/schema.sql` is the complete schema for a fresh database. Run it once:

```bash
# Local Supabase
psql "postgresql://postgres:postgres@localhost:54322/postgres" -f backend/schema.sql

# Supabase Cloud — paste into SQL Editor, or use the CLI:
supabase db push --db-url "postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres"
```

### Migrations

`backend/supabase/migrations/` contains incremental migrations for existing databases.
**Do not run `schema.sql` on an existing database** — it will conflict with live data.
Apply migrations in filename order instead:

```bash
for f in backend/supabase/migrations/*.sql; do
  echo "Applying $f..."
  psql "postgresql://postgres:postgres@localhost:54322/postgres" -f "$f"
done
```

Or with the Supabase CLI (local):
```bash
supabase db reset   # WARNING: drops all data, re-runs everything from scratch
```

### Docker container migrations

The compose file does **not** auto-apply migrations on startup. Run them manually
after the first `docker compose up`:

```bash
# From the host, targeting local supabase start:
for f in backend/supabase/migrations/*.sql; do
  psql "postgresql://postgres:postgres@localhost:54322/postgres" -f "$f"
done

# Or if you have psql access to Supabase Cloud:
for f in backend/supabase/migrations/*.sql; do
  psql "postgresql://<user>:<pass>@db.<ref>.supabase.co:5432/postgres" -f "$f"
done
```

---

## File storage

Mike stores uploaded documents in one of two places depending on your config:

### Local disk (default — no config required)

When R2 env vars are not set, files are written to `backend/local-storage/` on
the backend container's filesystem (or the backend process's working directory
in local dev).

**⚠ Local disk is ephemeral in Docker.** Files written inside the container are
lost when the container is removed. Mount a volume to persist them:

```yaml
# In compose.yml, add to the backend service:
volumes:
  - ./data/local-storage:/app/local-storage
```

Or set `LOCAL_STORAGE_DIR` to a path inside a named volume. Local disk is fine
for development and single-server deployments where you don't mind the data
living on that machine.

### Cloudflare R2 (recommended for production)

Set four env vars and Mike automatically switches to R2:

```bash
R2_ENDPOINT_URL=https://<account-id>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=<token access key id>
R2_SECRET_ACCESS_KEY=<token secret access key>
R2_BUCKET_NAME=mike   # or whatever you named your bucket
```

Files are stored as `documents/<user-id>/<doc-id>/source.<ext>`. R2 is S3-compatible
so any S3-compatible store (MinIO, Tigris, Backblaze B2) works with the same vars.

**Signed URL downloads** only work with R2/S3 — the local disk fallback returns
`null` for signed URLs and falls back to streaming the file through the backend.

---

## Environment variables

### `backend/.env`

| Variable | Required | Description |
|---|---|---|
| `PORT` | no | Backend port (default `3001`) |
| `FRONTEND_URL` | yes | Public URL of the frontend (for CORS) |
| `SUPABASE_URL` | yes | Supabase project URL |
| `SUPABASE_SECRET_KEY` | yes | Supabase service role key |
| `DOWNLOAD_SIGNING_SECRET` | yes | Random 32-byte hex — signs download URLs |
| `USER_API_KEYS_ENCRYPTION_SECRET` | yes | Random 32-byte hex — encrypts stored API keys |
| `CONCENTRATE_API_KEY` | — | Concentrate AI key (universal model router) |
| `CONCENTRATE_RESPONSES_URL` | no | Override Concentrate endpoint |
| `ANTHROPIC_API_KEY` | — | Direct Anthropic key |
| `OPENAI_API_KEY` | — | Direct OpenAI key |
| `GEMINI_API_KEY` | — | Direct Google key |
| `OLLAMA_BASE_URL` | no | Ollama `/v1/responses` endpoint |
| `VLLM_BASE_URL` | no | vLLM `/v1/responses` endpoint |
| `VLLM_API_KEY` | no | vLLM bearer key |
| `GENERIC_BASE_URL` | no | Any OpenAI-Responses-compatible endpoint |
| `GENERIC_API_KEY` | no | Key for generic endpoint |
| `R2_ENDPOINT_URL` | no | R2/S3 endpoint — omit to use local disk |
| `R2_ACCESS_KEY_ID` | no | R2 access key |
| `R2_SECRET_ACCESS_KEY` | no | R2 secret key |
| `R2_BUCKET_NAME` | no | Bucket name (default `mike`) |
| `LOCAL_STORAGE_DIR` | no | Override local disk path (default `./local-storage`) |
| `RESEND_API_KEY` | no | Resend key for transactional email |

At least one AI provider key is required. `CONCENTRATE_API_KEY` is the simplest
option — it routes to any supported model without per-provider keys.

### `frontend/.env.local`

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` | yes | Supabase anon/publishable key |
| `NEXT_PUBLIC_API_BASE_URL` | yes | `/api/backend` (relative, works everywhere) |
| `SUPABASE_SECRET_KEY` | yes | Supabase service role key (server-side proxy) |
| `BACKEND_INTERNAL_URL` | no | Where Next.js proxies backend calls (default `http://localhost:3001`) |
| `SUPABASE_INTERNAL_URL` | no | Where Next.js proxies Supabase calls (default `http://localhost:54321`) |

### Generating secrets

```bash
openssl rand -hex 32   # for DOWNLOAD_SIGNING_SECRET and USER_API_KEYS_ENCRYPTION_SECRET
```

---

## AI provider keys

You need at least one. Options:

| Provider | Env var | Notes |
|---|---|---|
| **Concentrate AI** | `CONCENTRATE_API_KEY` | Routes to every model (Claude, GPT, Gemini, Grok, DeepSeek…) via one key. Get a key at [concentrate.ai](https://concentrate.ai). |
| Anthropic | `ANTHROPIC_API_KEY` | Claude models only |
| OpenAI | `OPENAI_API_KEY` | GPT models only |
| Google | `GEMINI_API_KEY` | Gemini models only |
| Ollama | `OLLAMA_BASE_URL` | Self-hosted open-source models |
| vLLM | `VLLM_BASE_URL` + `VLLM_API_KEY` | Self-hosted, any model |

Provider keys can also be added per-user in **Settings → Providers**.
A key in `backend/.env` applies to all users; a key added in Settings applies only
to that user and takes precedence over the instance key.
