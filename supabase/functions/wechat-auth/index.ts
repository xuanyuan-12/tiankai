import { json, preflight, text } from "../_shared/http.ts";
import { adminClient, env, randomToken, sha256Hex } from "../_shared/supabase.ts";

const STATE_TTL_MS = 10 * 60 * 1000;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function wechatAuthorizeUrl(appId: string, callbackUrl: string, state: string): string {
  const query = new URLSearchParams({
    appid: appId,
    redirect_uri: callbackUrl,
    response_type: "code",
    scope: "snsapi_login",
    state,
  });
  return `https://open.weixin.qq.com/connect/qrconnect?${query.toString()}#wechat_redirect`;
}

Deno.serve(async (req) => {
  const early = preflight(req);
  if (early) return early;

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") ?? "start";
    if (action === "health") {
      return json(req, {
        configured: Boolean(
          Deno.env.get("WECHAT_APP_ID") &&
          Deno.env.get("WECHAT_APP_SECRET") &&
          Deno.env.get("WECHAT_CALLBACK_URL") &&
          Deno.env.get("ALLOWED_ORIGINS"),
        ),
      });
    }
    if (action === "start") return await start(req, url);
    if (action === "callback") return await callback(req, url);
    return text(req, "unknown action", 400);
  } catch (error) {
    console.error("wechat-auth failed", error);
    return text(req, "wechat_login_failed", 500);
  }
});

async function start(req: Request, url: URL): Promise<Response> {
  if (req.method !== "GET") return text(req, "method not allowed", 405);

  const appId = Deno.env.get("WECHAT_APP_ID");
  const callbackUrl = Deno.env.get("WECHAT_CALLBACK_URL");
  if (!appId || !callbackUrl) return text(req, "wechat_not_configured", 503);

  const redirectTo = url.searchParams.get("redirect");
  if (!redirectTo) return text(req, "missing redirect", 400);
  try {
    const parsed = new URL(redirectTo);
    const allowed = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    if (!allowed.includes(parsed.origin)) return text(req, "redirect origin not allowed", 400);
  } catch {
    return text(req, "invalid redirect", 400);
  }

  const state = randomToken(24);
  const stateHash = await sha256Hex(state);
  const supabase = adminClient();
  const now = new Date();
  const { error } = await supabase.from("wechat_oauth_states").insert({
    state_hash: stateHash,
    redirect_to: redirectTo,
    created_at: now.toISOString(),
    expires_at: new Date(now.getTime() + STATE_TTL_MS).toISOString(),
  });
  if (error) throw error;

  return new Response(null, {
    status: 302,
    headers: {
      Location: wechatAuthorizeUrl(appId, callbackUrl, state),
      "Cache-Control": "no-store",
    },
  });
}

async function callback(req: Request, url: URL): Promise<Response> {
  if (req.method !== "GET") return text(req, "method not allowed", 405);

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return text(req, "missing oauth code or state", 400);

  const appId = env("WECHAT_APP_ID");
  const appSecret = env("WECHAT_APP_SECRET");
  const supabase = adminClient();
  const stateHash = await sha256Hex(state);
  const now = Date.now();

  const { data: stateRow, error: stateError } = await supabase
    .from("wechat_oauth_states")
    .select("*")
    .eq("state_hash", stateHash)
    .is("used_at", null)
    .maybeSingle();
  if (stateError) throw stateError;
  if (!stateRow) return text(req, "invalid or expired login state", 400);
  const expiresAt = Date.parse(stateRow.expires_at);
  if (!Number.isFinite(expiresAt) || expiresAt < now) return text(req, "login state expired", 400);

  const { data: consumed, error: consumeError } = await supabase
    .from("wechat_oauth_states")
    .update({ used_at: new Date(now).toISOString() })
    .eq("id", stateRow.id)
    .is("used_at", null)
    .select("id")
    .maybeSingle();
  if (consumeError) throw consumeError;
  if (!consumed) return text(req, "login state already used", 400);

  const tokenResponse = await fetch(
    `https://api.weixin.qq.com/sns/oauth2/access_token?${new URLSearchParams({
      appid: appId,
      secret: appSecret,
      code,
      grant_type: "authorization_code",
    }).toString()}`,
  );
  const tokenPayload = await tokenResponse.json() as Record<string, unknown>;
  if (!tokenResponse.ok || tokenPayload.errcode) {
    console.error("wechat token exchange failed", tokenPayload);
    return text(req, "wechat token exchange failed", 502);
  }
  const accessToken = typeof tokenPayload.access_token === "string" ? tokenPayload.access_token : "";
  const openid = typeof tokenPayload.openid === "string" ? tokenPayload.openid : "";
  if (!accessToken || !openid) return text(req, "wechat token payload invalid", 502);

  let wechatNickname = "";
  let wechatAvatar = "";
  let unionid = typeof tokenPayload.unionid === "string" ? tokenPayload.unionid : null;
  try {
    const userResponse = await fetch(
      `https://api.weixin.qq.com/sns/userinfo?${new URLSearchParams({
        access_token: accessToken,
        openid,
        lang: "zh_CN",
      }).toString()}`,
    );
    const userPayload = await userResponse.json() as Record<string, unknown>;
    if (userResponse.ok && !userPayload.errcode) {
      wechatNickname = typeof userPayload.nickname === "string" ? userPayload.nickname.slice(0, 80) : "";
      wechatAvatar = typeof userPayload.headimgurl === "string" ? userPayload.headimgurl.slice(0, 1000) : "";
      if (!unionid && typeof userPayload.unionid === "string") unionid = userPayload.unionid;
    }
  } catch (error) {
    console.warn("wechat userinfo failed", error);
  }

  const timestamp = new Date().toISOString();
  const { data: account, error: accountError } = await supabase
    .from("wechat_accounts")
    .upsert({
      openid,
      unionid,
      wechat_nickname: wechatNickname,
      wechat_avatar: wechatAvatar,
      updated_at: timestamp,
      last_login_at: timestamp,
    }, { onConflict: "openid" })
    .select("id")
    .single();
  if (accountError) throw accountError;

  const sessionToken = randomToken(32);
  const { error: sessionError } = await supabase.from("wechat_sessions").insert({
    account_id: account.id,
    token_hash: await sha256Hex(sessionToken),
    created_at: timestamp,
    last_used_at: timestamp,
    expires_at: new Date(now + SESSION_TTL_MS).toISOString(),
  });
  if (sessionError) throw sessionError;

  const target = new URL(stateRow.redirect_to);
  target.hash = `wechat_login=${sessionToken}`;
  return new Response(null, {
    status: 302,
    headers: { Location: target.toString(), "Cache-Control": "no-store" },
  });
}
