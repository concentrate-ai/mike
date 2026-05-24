import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { createServerSupabase } from "../lib/supabase";
import { DEFAULT_TABULAR_MODEL, resolveModel } from "../lib/llm";
import { inferTier } from "../lib/llm/routing";
import {
  type ApiKeyStatus,
  getUserApiKeyStatus,
  getUserApiKeys,
  hasEnvApiKey,
  normalizeApiKeyProvider,
  saveUserApiKey,
} from "../lib/userApiKeys";
import { verifyApiKey } from "../lib/verifyApiKey";

export const userRouter = Router();

const MONTHLY_CREDIT_LIMIT = 999999;

type UserProfileRow = {
  display_name: string | null;
  organisation: string | null;
  message_credits_used: number;
  credits_reset_date: string;
  tier: string;
  tabular_model: string;
  high_model: string | null;
  medium_model: string | null;
  low_model: string | null;
  enabled_models: string[];
  favorite_models: string[];
  custom_models: unknown[];
};

function serializeProfile(
  row: UserProfileRow,
  apiKeyStatus?: ApiKeyStatus,
) {
  const creditsUsed = row.message_credits_used ?? 0;
  return {
    displayName: row.display_name,
    organisation: row.organisation,
    messageCreditsUsed: creditsUsed,
    creditsResetDate: row.credits_reset_date,
    creditsRemaining: Math.max(MONTHLY_CREDIT_LIMIT - creditsUsed, 0),
    tier: row.tier || "Free",
    tabularModel: resolveModel(row.tabular_model, DEFAULT_TABULAR_MODEL),
    highModel: row.high_model ?? null,
    mediumModel: row.medium_model ?? null,
    lowModel: row.low_model ?? null,
    enabledModels: Array.isArray(row.enabled_models) ? row.enabled_models : [],
    favoriteModels: Array.isArray(row.favorite_models) ? row.favorite_models : [],
    customModels: Array.isArray(row.custom_models) ? row.custom_models : [],
    ...(apiKeyStatus ? { apiKeyStatus } : {}),
  };
}

const PROFILE_SELECT =
  "display_name, organisation, message_credits_used, credits_reset_date, tier, tabular_model, high_model, medium_model, low_model, enabled_models, favorite_models, custom_models";

function validateProfilePayload(body: unknown):
  | {
      ok: true;
      update: {
        display_name?: string | null;
        organisation?: string | null;
        tabular_model?: string;
        updated_at: string;
      };
    }
  | { ok: false; detail: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, detail: "Expected a JSON object" };
  }

  const raw = body as Record<string, unknown>;
  const allowedFields = new Set([
    "displayName",
    "organisation",
    "tabularModel",
  ]);
  const invalidField = Object.keys(raw).find((key) => !allowedFields.has(key));
  if (invalidField) {
    return { ok: false, detail: `Unsupported profile field: ${invalidField}` };
  }

  const update: {
    display_name?: string | null;
    organisation?: string | null;
    tabular_model?: string;
    updated_at: string;
  } = { updated_at: new Date().toISOString() };

  if ("displayName" in raw) {
    if (raw.displayName !== null && typeof raw.displayName !== "string") {
      return { ok: false, detail: "displayName must be a string or null" };
    }
    update.display_name = raw.displayName?.trim() || null;
  }

  if ("organisation" in raw) {
    if (raw.organisation !== null && typeof raw.organisation !== "string") {
      return { ok: false, detail: "organisation must be a string or null" };
    }
    update.organisation = raw.organisation?.trim() || null;
  }

  if ("tabularModel" in raw) {
    if (typeof raw.tabularModel !== "string") {
      return { ok: false, detail: "tabularModel must be a string" };
    }
    const resolved = resolveModel(raw.tabularModel, "");
    if (!resolved) {
      return { ok: false, detail: "Unsupported tabularModel" };
    }
    update.tabular_model = resolved;
  }

  return { ok: true, update };
}

async function ensureProfileRow(
  db: ReturnType<typeof createServerSupabase>,
  userId: string,
) {
  const { error } = await db
    .from("user_profiles")
    .upsert(
      { user_id: userId },
      { onConflict: "user_id", ignoreDuplicates: true },
    );
  return error;
}

async function loadProfile(
  db: ReturnType<typeof createServerSupabase>,
  userId: string,
  options: { repairMissing?: boolean } = {},
) {
  let { data, error } = await db
    .from("user_profiles")
    .select(PROFILE_SELECT)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) return { data: null, error };
  if (!data) {
    if (!options.repairMissing) {
      return { data: null, error: new Error("Profile not found") };
    }

    const ensureError = await ensureProfileRow(db, userId);
    if (ensureError) return { data: null, error: ensureError };

    const created = await db
      .from("user_profiles")
      .select(PROFILE_SELECT)
      .eq("user_id", userId)
      .single();
    if (created.error) return { data: null, error: created.error };
    data = created.data;
  }

  let row = data as UserProfileRow;
  if (row.credits_reset_date && new Date() > new Date(row.credits_reset_date)) {
    const creditsResetDate = new Date();
    creditsResetDate.setDate(creditsResetDate.getDate() + 30);
    const { data: resetData, error: resetError } = await db
      .from("user_profiles")
      .update({
        message_credits_used: 0,
        credits_reset_date: creditsResetDate.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .select(PROFILE_SELECT)
      .single();

    if (resetError) return { data: null, error: resetError };
    row = resetData as UserProfileRow;
  }

  return { data: serializeProfile(row), error: null };
}

// POST /user/profile
userRouter.post("/profile", requireAuth, async (_req, res) => {
  const userId = res.locals.userId as string;
  const db = createServerSupabase();
  const error = await ensureProfileRow(db, userId);
  if (error) return void res.status(500).json({ detail: error.message });
  res.json({ ok: true });
});

// GET /user/profile
userRouter.get("/profile", requireAuth, async (_req, res) => {
  const userId = res.locals.userId as string;
  const db = createServerSupabase();
  const { data, error } = await loadProfile(db, userId, {
    repairMissing: true,
  });
  if (error) return void res.status(500).json({ detail: error.message });
  const apiKeyStatus = await getUserApiKeyStatus(userId, db);
  res.json({ ...data, apiKeyStatus });
});

// PATCH /user/profile
userRouter.patch("/profile", requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;
  const parsed = validateProfilePayload(req.body);
  if (!parsed.ok) return void res.status(400).json({ detail: parsed.detail });

  const db = createServerSupabase();
  const ensureError = await ensureProfileRow(db, userId);
  if (ensureError)
    return void res.status(500).json({ detail: ensureError.message });

  const { error: updateError } = await db
    .from("user_profiles")
    .update(parsed.update)
    .eq("user_id", userId);
  if (updateError)
    return void res.status(500).json({ detail: updateError.message });

  const { data, error } = await loadProfile(db, userId);
  if (error) return void res.status(500).json({ detail: error.message });
  const apiKeyStatus = await getUserApiKeyStatus(userId, db);
  res.json({ ...data, apiKeyStatus });
});

// PUT /user/tier-models — update high/medium/low model preferences
userRouter.put("/tier-models", requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;
  const body = req.body;
  if (!body || typeof body !== "object") {
    return void res.status(400).json({ detail: "Expected a JSON object" });
  }

  const raw = body as Record<string, unknown>;
  const update: {
    high_model?: string | null;
    medium_model?: string | null;
    low_model?: string | null;
    updated_at: string;
  } = { updated_at: new Date().toISOString() };

  for (const tier of ["high", "medium", "low"] as const) {
    const field = `${tier}Model` as "highModel" | "mediumModel" | "lowModel";
    if (field in raw) {
      const val = raw[field];
      if (val !== null && typeof val !== "string") {
        return void res.status(400).json({ detail: `${field} must be a string or null` });
      }
      const col = `${tier}_model` as "high_model" | "medium_model" | "low_model";
      update[col] = typeof val === "string" ? val.trim() || null : null;
    }
  }

  const db = createServerSupabase();
  const ensureError = await ensureProfileRow(db, userId);
  if (ensureError) return void res.status(500).json({ detail: ensureError.message });

  const { error } = await db
    .from("user_profiles")
    .update(update)
    .eq("user_id", userId);
  if (error) return void res.status(500).json({ detail: error.message });

  const { data, profileError } = await (async () => {
    const r = await loadProfile(db, userId);
    return { data: r.data, profileError: r.error };
  })();
  if (profileError) return void res.status(500).json({ detail: profileError.message });
  const apiKeyStatus = await getUserApiKeyStatus(userId, db);
  res.json({ ...data, apiKeyStatus });
});

// PUT /user/enabled-models — replace the full enabled_models array
userRouter.put("/enabled-models", requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;
  const models = req.body?.models;
  if (!Array.isArray(models) || models.some((m: unknown) => typeof m !== "string")) {
    return void res.status(400).json({ detail: "models must be an array of strings" });
  }
  const db = createServerSupabase();
  const ensureError = await ensureProfileRow(db, userId);
  if (ensureError) return void res.status(500).json({ detail: ensureError.message });

  // Auto-tier: when a model is newly enabled, fill any null tier column.
  const { data: existing } = await db
    .from("user_profiles")
    .select("high_model, medium_model, low_model, enabled_models")
    .eq("user_id", userId)
    .single();
  const prev: string[] = Array.isArray(existing?.enabled_models) ? existing.enabled_models : [];
  const newIds = models.filter((m: string) => !prev.includes(m));

  const tierUpdate: { high_model?: string; medium_model?: string; low_model?: string } = {};
  for (const id of newIds) {
    const tier = inferTier(id);
    if (!tier) continue;
    const col = `${tier}_model` as "high_model" | "medium_model" | "low_model";
    if (!existing?.[col] && !tierUpdate[col]) {
      tierUpdate[col] = id;
    }
  }

  const { error } = await db
    .from("user_profiles")
    .update({
      enabled_models: models,
      ...tierUpdate,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
  if (error) return void res.status(500).json({ detail: error.message });

  const { data } = await loadProfile(db, userId);
  const apiKeyStatus = await getUserApiKeyStatus(userId, db);
  res.json({ ...data, apiKeyStatus });
});

// PUT /user/custom-models — replace the full custom_models array
userRouter.put("/custom-models", requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;
  const models = req.body?.models;
  if (!Array.isArray(models)) {
    return void res.status(400).json({ detail: "models must be an array" });
  }
  const db = createServerSupabase();
  const ensureError = await ensureProfileRow(db, userId);
  if (ensureError) return void res.status(500).json({ detail: ensureError.message });
  const { error } = await db
    .from("user_profiles")
    .update({ custom_models: models, updated_at: new Date().toISOString() })
    .eq("user_id", userId);
  if (error) return void res.status(500).json({ detail: error.message });
  res.json({ customModels: models });
});

// GET /user/api-keys
userRouter.get("/api-keys", requireAuth, async (_req, res) => {
  const userId = res.locals.userId as string;
  const db = createServerSupabase();
  const status = await getUserApiKeyStatus(userId, db);
  res.json(status);
});

// PUT /user/api-keys/:provider
userRouter.put("/api-keys/:provider", requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;
  const provider = normalizeApiKeyProvider(req.params.provider);
  if (!provider)
    return void res.status(400).json({ detail: "Unsupported provider" });

  const apiKey =
    typeof req.body?.api_key === "string" ? req.body.api_key : null;
  const db = createServerSupabase();
  try {
    if (hasEnvApiKey(provider)) {
      return void res.status(409).json({
        detail:
          "This provider is configured by the server environment and cannot be changed from the browser.",
      });
    }
    await saveUserApiKey(userId, provider, apiKey, db);
    const status = await getUserApiKeyStatus(userId, db);
    res.json(status);
  } catch (err) {
    console.error("[user/api-keys] save failed", {
      provider,
      error: err instanceof Error ? err.message : String(err),
    });
    res.status(500).json({ detail: "Failed to save API key" });
  }
});

// POST /user/api-keys/:provider/verify
userRouter.post("/api-keys/:provider/verify", requireAuth, async (_req, res) => {
  const userId = res.locals.userId as string;
  const provider = normalizeApiKeyProvider(_req.params.provider);
  if (!provider)
    return void res.status(400).json({ detail: "Unsupported provider" });

  const db = createServerSupabase();
  try {
    const keys = await getUserApiKeys(userId, db);
    const key = keys[provider]?.trim() ?? "";
    const verified = await verifyApiKey(provider, key);
    res.json({ verified });
  } catch (err) {
    console.error("[user/api-keys/verify]", err);
    res.json({ verified: false });
  }
});

// PUT /user/favorite-models
userRouter.put("/favorite-models", requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;
  const models = req.body?.models;
  if (!Array.isArray(models) || models.some((m: unknown) => typeof m !== "string")) {
    return void res.status(400).json({ detail: "models must be an array of strings" });
  }
  const db = createServerSupabase();
  const ensureError = await ensureProfileRow(db, userId);
  if (ensureError) return void res.status(500).json({ detail: ensureError.message });
  const { error } = await db
    .from("user_profiles")
    .update({ favorite_models: models, updated_at: new Date().toISOString() })
    .eq("user_id", userId);
  if (error) return void res.status(500).json({ detail: error.message });
  res.json({ favoriteModels: models });
});

// DELETE /user/account
userRouter.delete("/account", requireAuth, async (_req, res) => {
  const userId = res.locals.userId as string;
  const db = createServerSupabase();
  const { error } = await db.auth.admin.deleteUser(userId);
  if (error) return void res.status(500).json({ detail: error.message });
  res.status(204).send();
});
