import { json, preflight } from "../_shared/http.ts";
import { adminClient, sha256Hex } from "../_shared/supabase.ts";

const MAX_PROFILE_BYTES = 262144;
const MAX_AVATAR_BYTES = 204800;
const MAX_BODY_BYTES = 300000;

type Session = {
  id: string;
  account_id: string;
  expires_at: string;
  revoked_at: string | null;
};

Deno.serve(async (req) => {
  const early = preflight(req);
  if (early) return early;

  try {
    const supabase = adminClient();
    const session = await readSession(req, supabase);
    if (!session) return json(req, { error: "unauthorized" }, 401);

    if (req.method === "GET") {
      await touchSession(supabase, session.id);
      return json(req, await readProfile(supabase, session.account_id));
    }
    if (req.method !== "POST") return json(req, { error: "method_not_allowed" }, 405);

    const bodyText = await req.text();
    if (new TextEncoder().encode(bodyText).byteLength > MAX_BODY_BYTES) {
      return json(req, { error: "payload_too_large" }, 413);
    }
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(bodyText) as Record<string, unknown>;
    } catch {
      return json(req, { error: "invalid_json" }, 400);
    }
    const action = typeof body.action === "string" ? body.action : "save";

    if (action === "logout") {
      const { error } = await supabase
        .from("wechat_sessions")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", session.id);
      if (error) throw error;
      return json(req, { ok: true });
    }
    if (action !== "save") return json(req, { error: "unknown_action" }, 400);

    const baseVersion = body.baseVersion;
    if (!Number.isInteger(baseVersion) || (baseVersion as number) < 0) {
      return json(req, { error: "invalid_base_version" }, 400);
    }
    const profile = body.profile;
    if (!profile || typeof profile !== "object" || Array.isArray(profile)) {
      return json(req, { error: "invalid_profile" }, 400);
    }
    const profileBytes = new TextEncoder().encode(JSON.stringify(profile)).byteLength;
    if (profileBytes > MAX_PROFILE_BYTES) return json(req, { error: "profile_too_large" }, 413);
    const avatar = (profile as Record<string, unknown>).avatar;
    if (avatar && typeof avatar === "object") {
      const customData = (avatar as Record<string, unknown>).customData;
      if (typeof customData === "string" && new TextEncoder().encode(customData).byteLength > MAX_AVATAR_BYTES) {
        return json(req, { error: "avatar_too_large" }, 413);
      }
    }

    const { data: current, error: currentError } = await supabase
      .from("player_profiles")
      .select("version, profile, updated_at")
      .eq("account_id", session.account_id)
      .maybeSingle();
    if (currentError) throw currentError;

    if (!current) {
      if (baseVersion !== 0) {
        return json(req, { error: "version_conflict", version: 0, profile: null }, 409);
      }
      const { data: inserted, error: insertError } = await supabase
        .from("player_profiles")
        .insert({
          account_id: session.account_id,
          version: 1,
          profile,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select("version, profile, updated_at")
        .single();
      if (insertError) {
        if (insertError.code === "23505") {
          return json(req, await conflictPayload(supabase, session.account_id), 409);
        }
        throw insertError;
      }
      await touchSession(supabase, session.id);
      return json(req, { ok: true, version: inserted.version, updatedAt: inserted.updated_at });
    }

    if (current.version !== baseVersion) {
      return json(req, {
        error: "version_conflict",
        version: current.version,
        profile: current.profile,
        updatedAt: current.updated_at,
      }, 409);
    }

    const nextVersion = (current.version as number) + 1;
    const { data: updated, error: updateError } = await supabase
      .from("player_profiles")
      .update({ profile, version: nextVersion, updated_at: new Date().toISOString() })
      .eq("account_id", session.account_id)
      .eq("version", current.version)
      .select("version, updated_at")
      .maybeSingle();
    if (updateError) throw updateError;
    if (!updated) return json(req, await conflictPayload(supabase, session.account_id), 409);

    await touchSession(supabase, session.id);
    return json(req, { ok: true, version: updated.version, updatedAt: updated.updated_at });
  } catch (error) {
    console.error("wechat-profile failed", error);
    return json(req, { error: "profile_service_unavailable" }, 500);
  }
});

async function readSession(req: Request, supabase: ReturnType<typeof adminClient>): Promise<Session | null> {
  const header = req.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const tokenHash = await sha256Hex(match[1].trim());
  const { data, error } = await supabase
    .from("wechat_sessions")
    .select("id, account_id, expires_at, revoked_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (error) throw error;
  if (!data || data.revoked_at) return null;
  if (!Number.isFinite(Date.parse(data.expires_at)) || Date.parse(data.expires_at) < Date.now()) return null;
  return data as Session;
}

async function readProfile(supabase: ReturnType<typeof adminClient>, accountId: string) {
  const [{ data: account, error: accountError }, { data: row, error: profileError }] = await Promise.all([
    supabase.from("wechat_accounts").select("wechat_nickname, wechat_avatar").eq("id", accountId).maybeSingle(),
    supabase.from("player_profiles").select("version, profile, updated_at").eq("account_id", accountId).maybeSingle(),
  ]);
  if (accountError) throw accountError;
  if (profileError) throw profileError;
  return {
    account: {
      id: accountId,
      wechatNickname: account?.wechat_nickname ?? "",
      wechatAvatar: account?.wechat_avatar ?? "",
    },
    version: row?.version ?? 0,
    profile: row?.profile ?? null,
    updatedAt: row?.updated_at ?? null,
  };
}

async function conflictPayload(supabase: ReturnType<typeof adminClient>, accountId: string) {
  const { data, error } = await supabase
    .from("player_profiles")
    .select("version, profile, updated_at")
    .eq("account_id", accountId)
    .maybeSingle();
  if (error) throw error;
  return {
    error: "version_conflict",
    version: data?.version ?? 0,
    profile: data?.profile ?? null,
    updatedAt: data?.updated_at ?? null,
  };
}

async function touchSession(supabase: ReturnType<typeof adminClient>, sessionId: string): Promise<void> {
  await supabase
    .from("wechat_sessions")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", sessionId);
}
