# Generating Supabase Keys for Self-Hosting

When self-hosting Mike with Docker, you need to generate several secrets. Run these commands once and paste the output into your `.env` file.

## Required secrets

```bash
# Postgres password
openssl rand -hex 32

# JWT secret (must be at least 32 chars)
openssl rand -base64 32

# Realtime encryption key
openssl rand -hex 16

# Phoenix secret key base (for Realtime)
openssl rand -base64 64

# Download signing secret
openssl rand -hex 32

# User API keys encryption secret
openssl rand -hex 32
```

## Supabase JWT keys (ANON_KEY and SERVICE_ROLE_KEY)

These are JWTs signed with your `JWT_SECRET`. Use this Node.js snippet:

```js
// generate-supabase-keys.mjs
// Run with: node generate-supabase-keys.mjs <your-jwt-secret>

import { createHmac } from "crypto";

const secret = process.argv[2];
if (!secret) { console.error("Usage: node generate-supabase-keys.mjs <jwt-secret>"); process.exit(1); }

function b64url(obj) {
  return Buffer.from(JSON.stringify(obj)).toString("base64url");
}
function sign(header, payload, secret) {
  const msg = `${b64url(header)}.${b64url(payload)}`;
  const sig = createHmac("sha256", secret).update(msg).digest("base64url");
  return `${msg}.${sig}`;
}

const header = { alg: "HS256", typ: "JWT" };
const now = Math.floor(Date.now() / 1000);

const anon = sign(header, { role: "anon", iss: "supabase", iat: now, exp: now + 10 * 365 * 24 * 3600 }, secret);
const service = sign(header, { role: "service_role", iss: "supabase", iat: now, exp: now + 10 * 365 * 24 * 3600 }, secret);

console.log("ANON_KEY=" + anon);
console.log("SERVICE_ROLE_KEY=" + service);
```

```bash
node generate-supabase-keys.mjs "your-jwt-secret-here"
```

## Quick all-in-one

```bash
JWT_SECRET=$(openssl rand -base64 32)
echo "JWT_SECRET=$JWT_SECRET"
echo "POSTGRES_PASSWORD=$(openssl rand -hex 32)"
echo "REALTIME_ENC_KEY=$(openssl rand -hex 16)"
echo "SECRET_KEY_BASE=$(openssl rand -base64 64)"
echo "DOWNLOAD_SIGNING_SECRET=$(openssl rand -hex 32)"
echo "USER_API_KEYS_ENCRYPTION_SECRET=$(openssl rand -hex 32)"
node generate-supabase-keys.mjs "$JWT_SECRET"
```
