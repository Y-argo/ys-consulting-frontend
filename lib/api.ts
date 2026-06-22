// lib/api.ts
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || "https://ys-consulting-api-665881683479.asia-northeast1.run.app";

function getToken(): string {
  if (typeof window === "undefined") return "";
  // localStorage を優先（互換性のため）、なければ undefined を返す
  // Cookieは自動的に fetch に含まれる（credentials: 'include' で）
  const token = localStorage.getItem("ascend_token");
  if (token) return token;
  // Cookieからの取得は fetch 時に自動で行われるため、ここでは空文字列を返す
  return "";
}

function authHeaders(): HeadersInit {
  const token = getToken();
  return token
    ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
    : { "Content-Type": "application/json" };
}

function fetchOptions(method: string = "GET", body?: string): RequestInit {
  const headers = authHeaders();
  const init: RequestInit = {
    method,
    headers,
    credentials: "include", // Cookie を自動送信・受信
  };
  if (body) init.body = body;
  return init;
}

export interface LoginResult {
  token: string;
  uid: string;
  role: string;
  tenant_id: string;
}

export async function loginUser(uid: string, password: string): Promise<LoginResult> {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uid, password, role: "user" }),
    credentials: "include", // Cookie 自動送信・受信
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const detail = err.detail || "ログインに失敗しました";
    if (detail === "EXPIRED") throw new Error("EXPIRED");
    throw new Error(detail);
  }
  const data: LoginResult = await res.json();
  // localStorage にも保存（互換性のため）
  localStorage.setItem("ascend_token", data.token);
  localStorage.setItem("ascend_uid", data.uid);
  localStorage.setItem("ascend_role", data.role);
  localStorage.setItem("ascend_tenant", data.tenant_id);
  // Cookieは自動的に set_cookie で保存される
  return data;
}

export async function logout(): Promise<void> {
  try {
    // APIのlogoutエンドポイントを呼び出し、Cookieを削除
    await fetch(`${API_BASE}/api/auth/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });
  } catch {
    // エラーでも続行
  }
  // localStorage からも削除
  localStorage.removeItem("ascend_token");
  localStorage.removeItem("ascend_uid");
  localStorage.removeItem("ascend_role");
  localStorage.removeItem("ascend_tenant");
}

export async function recordAdClick(adId: string, tenantId: string): Promise<void> {
  try {
    await fetch(`${API_BASE}/api/ads/click`, {
      method: "POST",
      headers: authHeaders() as Record<string, string>,
      body: JSON.stringify({ ad_id: adId, tenant_id: tenantId }),
      credentials: "include",
    });
  } catch {
    // クリック記録失敗は無視
  }
}

export async function fetchAd(position: "sidebar" | "mypage"): Promise<{
  ad: {
    id: string;
    image_url: string;
    link_url: string;
    alt_text: string;
    position: string;
    tenant_id: string;
  } | null;
}> {
  const res = await fetch(`${API_BASE}/api/ads?position=${position}`, {
    headers: authHeaders() as Record<string, string>,
    credentials: "include",
  });
  if (!res.ok) return { ad: null };
  return res.json();
}

export function getStoredUser() {
  if (typeof window === "undefined") return null;
  const token = localStorage.getItem("ascend_token");
  if (!token) return null;
  return {
    token,
    uid:       localStorage.getItem("ascend_uid")    || "",
    role:      localStorage.getItem("ascend_role")   || "",
    tenant_id: localStorage.getItem("ascend_tenant") || "default",
  };
}

export interface Message {
  role: "user" | "assistant";
  content: string;
  cases?: string[];
  confirmation_choices?: string[];
  structured?: {
    summary: string;
    cards: { current: string[]; risk: string[]; plan: string[] };
    analysis: { type: string; urgency: string; importance: string; mode: string };
    actions: string[];
    value_message: string;
  };
  sources?: Array<{text:string; score:number; source_id:string; is_retrieved:boolean}>;
}

export interface SendResult {
  reply: string;
  chat_id: string;
  msg_id: string;
  cases?: string[];
  confirmation_choices?: string[];
  images?: {mime_type:string; data:string}[];
  structured?: {
    summary: string;
    cards: { current: string[]; risk: string[]; plan: string[] };
    analysis: { type: string; urgency: string; importance: string; mode: string };
    actions: string[];
    value_message: string;
  };
  sources?: Array<{text:string; score:number; source_id:string; is_retrieved:boolean}>;
}

export async function sendMessage(
  message: string,
  chat_id: string = "main",
  ai_tier: string = "core",
  purpose_mode: string = "auto",
  chat_mode: string = "consult"
): Promise<SendResult> {
  const res = await fetch(`${API_BASE}/api/chat/send`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ message, chat_id, ai_tier, purpose_mode, chat_mode }),
    credentials: "include",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "送信に失敗しました");
  }
  return res.json();
}

export async function loadHistory(chat_id: string = "main"): Promise<Message[]> {
  const res = await fetch(`${API_BASE}/api/chat/history/${chat_id}`, {
    headers: authHeaders(),
    credentials: "include",
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.messages || [];
}

export interface SessionInfo {
  chat_id: string;
  title: string;
  updated_at?: string;
}

export async function listSessions(): Promise<SessionInfo[]> {
  const res = await fetch(`${API_BASE}/api/chat/sessions`, {
    headers: authHeaders(),
  });
  if (!res.ok) return [];
  return res.json();
}

export async function newSession(): Promise<string> {
  const res = await fetch(`${API_BASE}/api/chat/session/new`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("セッション作成失敗");
  const data = await res.json();
  return data.chat_id;
}

export interface FeatureFlags {
  image_generation: boolean;
  personal_consulting: boolean;
  current_issue_diagnosis: boolean;
  decision_metrics: boolean;
  fixed_concept_report: boolean;
  ascend_ultra: boolean;
  ascend_apex: boolean;
  [key: string]: boolean;
}

export async function getMyFeatures(): Promise<FeatureFlags> {
  const res = await fetch(`${API_BASE}/api/auth/me/features`, {
    headers: authHeaders(),
  });
  if (!res.ok) {
    // 失敗時はデフォルト（core のみ許可）を返す
    return {
      image_generation: false,
      personal_consulting: false,
      current_issue_diagnosis: false,
      decision_metrics: false,
      fixed_concept_report: false,
      ascend_ultra: false,
      ascend_apex: false,
      diag_structure: false,
      diag_issue: false,
      diag_comparison: false,
      diag_contradiction: false,
      diag_execution: false,
      diag_investment: false,
      diag_graph: false,
      diag_file: false,
      diag_presentation: false,
      diag_future: false,
    };
  }
  const data = await res.json();
  return data.features as FeatureFlags;
}

export interface UserStats {
  uid: string;
  level_score: number;
  rank_name: string;
  next_pt: string;
  rank_cfg: { rank_1_name: string; rank_2_name: string; rank_3_name: string; rank_4_name: string };
  decision_metrics: Record<string, number | string> | null;
  use_count_since_report: number;
  fc_report_unlocked: boolean;
  fc_report_threshold: number;
  diagnosis_count: number;
  total_chat_count: number;
  diag_available: boolean;
  diag_next_unlock: number;
  diag_checkpoint: number;
  fixed_concept_score: number | null;
  is_unlimited?: boolean;
  expires_at?: string;
  level_last_delta?: number;
  tenant_id?: string;
  notification_settings?: Record<string, boolean | string>;
}

export async function getUserStats(): Promise<UserStats | null> {
  const res = await fetch(`${API_BASE}/api/user/stats`, { headers: authHeaders() });
  if (!res.ok) return null;
  return res.json();
}

export async function getUsageLogs(): Promise<{prompt: string; timestamp: string; purpose_mode?: string; diagnosis_type?: string}[]> {
  const res = await fetch(`${API_BASE}/api/user/usage_logs`, { headers: authHeaders() });
  if (!res.ok) return [];
  const data = await res.json();
  return data.logs || [];
}

export async function deleteSession(chat_id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/user/session/${chat_id}`, { method: "DELETE", headers: authHeaders() });
  if (!res.ok) throw new Error(`削除失敗: ${res.status}`);
}

export async function renameSession(chat_id: string, title: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/user/session/${chat_id}/rename`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ title }),
  });
  if (!res.ok) throw new Error(`リネーム失敗: ${res.status}`);
}

export async function getHeaderConfig(): Promise<Record<string, string>> {
  const res = await fetch(`${API_BASE}/api/user/header_config`, { headers: authHeaders() });
  if (!res.ok) return {};
  return res.json();
}

export async function getUserGuide(): Promise<string> {
  const res = await fetch(`${API_BASE}/api/user/user_guide`, { headers: authHeaders() });
  if (!res.ok) return "";
  const data = await res.json();
  return data.guide || "";
}

export async function getFcReport(): Promise<{report: Record<string,unknown>|null; use_count_since_report: number}> {
  const res = await fetch(`${API_BASE}/api/user/fc_report`, { headers: authHeaders() });
  if (!res.ok) return { report: null, use_count_since_report: 0 };
  return res.json();
}

export async function getRankupTips(): Promise<string> {
  const res = await fetch(`${API_BASE}/api/user/rankup_tips`, { headers: authHeaders() });
  if (!res.ok) return "";
  const d = await res.json(); return d.content || "";
}

export async function getManual(): Promise<string> {
  const res = await fetch(`${API_BASE}/api/user/manual`, { headers: authHeaders() });
  if (!res.ok) return "";
  const d = await res.json(); return d.content || "";
}

export async function registerUser(uid: string, password: string, display_name: string): Promise<LoginResult> {
  const res = await fetch(`${API_BASE}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uid, password, display_name }),
    credentials: "include",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "登録に失敗しました");
  }
  const data: LoginResult = await res.json();
  localStorage.setItem("ascend_token", data.token);
  localStorage.setItem("ascend_uid", data.uid);
  localStorage.setItem("ascend_role", data.role);
  localStorage.setItem("ascend_tenant", data.tenant_id);
  return data;
}

export interface AttachmentResult {
  filename: string;
  ext: string;
  size: number;
  extracted_text: string;
  preview: string;
}

export async function uploadAttachment(file: File, chat_id: string): Promise<AttachmentResult> {
  const form = new FormData();
  form.append("file", file);
  form.append("chat_id", chat_id);
  const token = typeof window !== "undefined" ? localStorage.getItem("ascend_token") || "" : "";
  const res = await fetch(`${API_BASE}/api/chat/upload_attachment`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (!res.ok) throw new Error("添付ファイルの処理に失敗しました");
  return res.json();
}

export async function getSuggestedQuestions(last_message: string, last_reply: string): Promise<string[]> {
  const res = await fetch(`${API_BASE}/api/chat/suggest`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ last_message, last_reply }),
  });
  if (!res.ok) return [];
  const d = await res.json();
  return d.questions || [];
}

export async function saveFeedback(chat_id: string, message: string, reply: string, label: string): Promise<void> {
  await fetch(`${API_BASE}/api/chat/feedback`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ chat_id, message, reply, label }),
  });
}

export interface Inquiry {
  inquiry_id: string;
  title: string;
  category: string;
  status: string;
  status_label: string;
  created_at: string;
  updated_at: string;
  unread_for_user: boolean;
}

export interface InquiryMessage {
  message_id: string;
  sender_type: "user"|"admin";
  body: string;
  created_at: string;
}

export async function listInquiries(): Promise<Inquiry[]> {
  const res = await fetch(`${API_BASE}/api/inquiry/list`, { headers: authHeaders() });
  if (!res.ok) return [];
  const d = await res.json();
  return d.inquiries || [];
}

export async function getInquiryMessages(inquiry_id: string): Promise<InquiryMessage[]> {
  const res = await fetch(`${API_BASE}/api/inquiry/messages/${inquiry_id}`, { headers: authHeaders() });
  if (!res.ok) return [];
  const d = await res.json();
  return d.messages || [];
}

export async function createInquiry(title: string, body: string, category: string, supplement: string): Promise<string> {
  const res = await fetch(`${API_BASE}/api/inquiry/create`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ title, body, category, supplement }),
  });
  if (!res.ok) throw new Error("相談の作成に失敗しました");
  const d = await res.json();
  return d.inquiry_id;
}

export async function addInquiryMessage(inquiry_id: string, body: string): Promise<void> {
  await fetch(`${API_BASE}/api/inquiry/message`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ inquiry_id, body }),
  });
}

export interface ThemeConfig {
  logo_url: string;
  logo_size: number;
  favicon_url: string;
  color_primary: string;
  color_secondary: string;
  color_bg: string;
  color_nav_bg: string;
  color_sidebar_bg: string;
  color_card_bg: string;
  color_text_main: string;
  color_text_sub: string;
  color_border: string;
  color_user_bubble: string;
  color_ai_bubble: string;
}

export async function getTheme(): Promise<ThemeConfig | null> {
  const res = await fetch(`${API_BASE}/api/user/theme`, { headers: authHeaders() });
  if (!res.ok) return null;
  return res.json();
}

export async function getChatExamples(): Promise<string[]> {
  const res = await fetch(`${API_BASE}/api/user/chat_examples`, { headers: authHeaders() });
  if (!res.ok) return [];
  const d = await res.json();
  return d.examples || [];
}

export async function getPurposeModes(): Promise<{id:string;label:string}[]> {
  const res = await fetch(`${API_BASE}/api/user/purpose_modes`, { headers: authHeaders() });
  if (!res.ok) return [];
  const d = await res.json();
  return d.modes || [];
}

export interface TableResult {
  message: string;
  csv?: string;
  columns?: string[];
  rows?: unknown[][];
  has_chart?: boolean;
  numeric_cols?: string[];
}

export async function tableCommand(command: string, csv_data?: string): Promise<TableResult> {
  const res = await fetch(`${API_BASE}/api/chat/table_command`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ command, csv_data: csv_data || "" }),
  });
  if (!res.ok) return { message: "テーブル操作エラー" };
  return res.json();
}

export async function lgbmPredict(prompt: string): Promise<string> {
  const res = await fetch(`${API_BASE}/api/user/lgbm/predict?prompt=${encodeURIComponent(prompt)}`, {
    headers: authHeaders(),
  });
  if (!res.ok) return "auto";
  const d = await res.json();
  return d.mode || "auto";
}

export async function getCustomPrompt(): Promise<{custom_sys_prompt:string;custom_prompt_mode:string;has_custom:boolean}> {
  const res = await fetch(`${API_BASE}/api/user/custom_prompt`, { headers: authHeaders() });
  if (!res.ok) return {custom_sys_prompt:"",custom_prompt_mode:"append",has_custom:false};
  return res.json();
}

export async function saveCustomPrompt(custom_sys_prompt: string, custom_prompt_mode: string): Promise<void> {
  await fetch(`${API_BASE}/api/user/custom_prompt`, {
    method: "POST", headers: authHeaders(),
    body: JSON.stringify({ custom_sys_prompt, custom_prompt_mode }),
  });
}

export async function sendImageMessage(
  message: string,
  chat_id: string = "main",
  ai_tier: string = "core",
  image_b64?: string,
  image_mime?: string
): Promise<SendResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 180000);
  try {
    const res = await fetch(`${API_BASE}/api/chat/send_image`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ message, chat_id, ai_tier, image_b64, image_mime }),
      signal: controller.signal,
    });
    const text = await res.text();
    let data: any = {};
    try { data = text ? JSON.parse(text) : {}; } catch {
      throw new Error("画像送信失敗: JSON解析失敗 url=" + `${API_BASE}/api/chat/send_image` + " status=" + res.status + " body=" + text.slice(0,300));
    }
    if (!res.ok) {
      throw new Error(data.detail || ("画像送信失敗: status=" + res.status + " body=" + text.slice(0,300)));
    }
    return data;
  } catch(e: unknown) {
    if (e instanceof Error && e.name==="AbortError") throw new Error("応答に時間がかかっています。");
    throw e;
  } finally { clearTimeout(timer); }
}

export async function sendFileMessage(
  message: string,
  chat_id: string = "main",
  ai_tier: string = "core",
  file_text: string = "",
  filename: string = ""
): Promise<SendResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 180000);
  try {
    const res = await fetch(`${API_BASE}/api/chat/send_file`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ message, chat_id, ai_tier, file_text, filename }),
      signal: controller.signal,
    });
    if (!res.ok) { const err = await res.json().catch(()=>({})); throw new Error(err.detail||"ファイル送信失敗"); }
    return res.json();
  } catch(e: unknown) {
    if (e instanceof Error && e.name==="AbortError") throw new Error("応答に時間がかかっています。");
    throw e;
  } finally { clearTimeout(timer); }
}

export async function sendInvestMessage(
  message: string,
  chat_id: string = "main",
  ai_tier: string = "core"
): Promise<SendResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 180000);
  try {
    const res = await fetch(`${API_BASE}/api/chat/send_invest`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ message, chat_id, ai_tier }),
      signal: controller.signal,
    });
    if (!res.ok) { const err = await res.json().catch(()=>({})); throw new Error(err.detail||"投資送信失敗"); }
    return res.json();
  } catch(e: unknown) {
    if (e instanceof Error && e.name==="AbortError") throw new Error("応答に時間がかかっています。");
    throw e;
  } finally { clearTimeout(timer); }
}

export async function getUserPlan(): Promise<string> {
  try {
    const res = await fetch(`${API_BASE}/api/user/plan`, { headers: authHeaders() });
    const d = await res.json();
    return d.plan || "";
  } catch { return ""; }
}

export async function getAdminAiSettings(): Promise<{ai_description:string;conversation_starters:string[]}> {
  try {
    const res = await fetch(`${API_BASE}/api/user/admin_ai_settings`, { headers: authHeaders() });
    return await res.json();
  } catch { return {ai_description:"", conversation_starters:[]}; }
}

export async function getUserAiSettings(): Promise<{ai_description:string;conversation_starters:string[];use_admin_settings:boolean;member_extra_prompt:string}> {
  try {
    const res = await fetch(`${API_BASE}/api/user/user_ai_settings`, { headers: authHeaders() });
    return await res.json();
  } catch { return {ai_description:"", conversation_starters:[], use_admin_settings:false, member_extra_prompt:""}; }
}

export async function saveUserAiSettings(ai_description: string, conversation_starters: string[], use_admin_settings: boolean = false, member_extra_prompt: string = ""): Promise<void> {
  await fetch(`${API_BASE}/api/user/user_ai_settings`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ ai_description, conversation_starters, use_admin_settings, member_extra_prompt }),
  });
}

export async function getUserKnowledgeList(): Promise<{source_id:string;title:string;link_id:string;chunks:number;summaries:number}[]> {
  try {
    const res = await fetch(`${API_BASE}/api/user/user_knowledge_list`, { headers: authHeaders() });
    const d = await res.json();
    return d.files || [];
  } catch { return []; }
}

export async function uploadUserKnowledge(file: File): Promise<{ok:boolean;chunks:number;summaries:number}> {
  const fd = new FormData();
  fd.append("file", file);
  const token = typeof window !== "undefined" ? localStorage.getItem("ascend_token") || "" : "";
  const res = await fetch(`${API_BASE}/api/user/user_knowledge_upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });
  return res.json();
}

export async function deleteUserKnowledge(source_id: string): Promise<void> {
  const token = typeof window !== "undefined" ? localStorage.getItem("ascend_token") || "" : "";
  await fetch(`${API_BASE}/api/user/user_knowledge/${encodeURIComponent(source_id)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ============================================================
// SSE Streaming Clients
// ============================================================
type SSECallback = (step: string) => void;
type SSEResult = { reply: string; chat_id: string; msg_id: string; cases: string[]; images: { mime_type: string; data: string; gcs_url?: string }[]; structured: { summary: string; cards: { current: string[]; risk: string[]; plan: string[] }; analysis: { type: string; urgency: string; importance: string; mode: string }; actions: string[]; value_message: string } | undefined; sources?: Array<{text:string; score:number; source_id:string; is_retrieved:boolean}>; confirmation_choices?: string[]; intent_label?: string };

async function _ssePost(url: string, body: object, onStep: SSECallback): Promise<SSEResult> {
  const token = localStorage.getItem("ascend_token") || "";
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) throw new Error(`SSE接続失敗: ${res.status}`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  // 行バッファ: チャンク境界をまたぐ不完全行を保持
  let lineBuf = "";
  // データバッファ: 複数行にまたがるSSEイベントのdata行を結合
  let dataBuf = "";
  let result: SSEResult | null = null;
  let _sseErr: string | null = null;
  let _rawSseText = "";
  while (true) {
    const { done, value } = await reader.read();
    // done=trueでもvalueにデータが含まれる場合があるため必ずデコード
    const chunk = value ? decoder.decode(value, { stream: !done }) : "";
    _rawSseText += chunk;
    lineBuf += chunk;
    // 行単位に分割して処理
    const rawLines = lineBuf.split("\n");
    // 最後の要素は不完全行としてlineBufに残す（done時は""）
    lineBuf = done ? "" : (rawLines.pop() || "");
    for (const raw of rawLines) {
      const line = raw.trimEnd();
      if (line === "") {
        // 空行 = SSEイベントの区切り → dataBufをパース
        if (dataBuf) {
          try {
            const evt = JSON.parse(dataBuf);
            if (evt.type === "step") onStep(evt.label);
            else if (evt.type === "done") result = evt as SSEResult;
            else if (evt.type === "error") _sseErr = evt.message || "エラー";
          } catch {}
          dataBuf = "";
        }
      } else if (line.startsWith("data:")) {
        // data行: "data: xxx" / "data:xxx" の両方に対応
        const payload = line.slice(5).trimStart();
        dataBuf = dataBuf ? dataBuf + payload : payload;
      }
      // コメント行（:）やその他フィールドは無視
    }
    if (done) break;
  }

  if (dataBuf) {
    try {
      const evt = JSON.parse(dataBuf);
      if (evt.type === "step") onStep(evt.label);
      else if (evt.type === "done") result = evt as SSEResult;
      else if (evt.type === "error") _sseErr = evt.message || "エラー";
    } catch {}
    dataBuf = "";
  }

  if (!result && !_sseErr && _rawSseText) {
    try {
      const dataLines = _rawSseText
        .split(/\r?\n/)
        .map(l => l.trimEnd())
        .filter(l => l.startsWith("data:"))
        .map(l => l.slice(5).trimStart());

      for (const payload of dataLines) {
        if (!payload) continue;
        const evt = JSON.parse(payload);
        if (evt.type === "done") result = evt as SSEResult;
        else if (evt.type === "error") _sseErr = evt.message || "エラー";
      }
    } catch {}
  }

  if (_sseErr) throw new Error("⚠️ " + _sseErr);
  if (!result) throw new Error("SSE応答なし raw=" + _rawSseText.slice(-300));
  return result;
}

export async function sendMessageStream(message: string, chatId: string, aiTier: string, purposeMode: string, chatMode: string, onStep: SSECallback): Promise<SSEResult> {
  return _ssePost(`${API_BASE}/api/chat/send_stream`, { message, chat_id: chatId, ai_tier: aiTier, purpose_mode: purposeMode, chat_mode: chatMode }, onStep);
}

export async function sendImageMessageStream(message: string, chatId: string, aiTier: string, imageb64?: string, imageMime?: string, onStep: SSECallback = ()=>{}): Promise<SSEResult> {
  return _ssePost(`${API_BASE}/api/chat/send_image_stream`, { message, chat_id: chatId, ai_tier: aiTier, image_b64: imageb64, image_mime: imageMime }, onStep);
}

export async function sendFileMessageStream(message: string, chatId: string, aiTier: string, fileText: string, filename: string, onStep: SSECallback = ()=>{}): Promise<SSEResult> {
  return _ssePost(`${API_BASE}/api/chat/send_file_stream`, { message, chat_id: chatId, ai_tier: aiTier, file_text: fileText, filename }, onStep);
}

export async function getRagSettings(): Promise<{threshold:number;top_k:number}> {
  const res = await fetch(`${API_BASE}/api/user/rag_settings`, { headers: authHeaders() });
  if (!res.ok) return { threshold: 0.42, top_k: 5 };
  return res.json();
}

export async function saveRagSettings(threshold: number, top_k: number): Promise<void> {
  await fetch(`${API_BASE}/api/user/rag_settings`, {
    method: "POST", headers: authHeaders() as Record<string, string>,
    body: JSON.stringify({ threshold, top_k }),
  });
}

export async function getRecentSourceHistory(): Promise<Array<{is_retrieved:boolean; score:number; text:string; source_id:string}>> {
  try {
    const res = await fetch(`${API_BASE}/api/chat/sources_log`, { headers: authHeaders() });
    if (!res.ok) return [];
    const data = await res.json();
    return data.sources || [];
  } catch { return []; }
}
export async function generateSlides(theme: string, purpose: string, audience: string, slideCount: number): Promise<{ok:boolean;data:any}> {
  try {
    const res = await fetch(`${API_BASE}/api/user/generate_slides`, {
      method: "POST", headers: authHeaders() as Record<string, string>,
      body: JSON.stringify({ theme, purpose, audience, slide_count: slideCount }),
    });
    if (!res.ok) return { ok: false, data: null };
    return res.json();
  } catch { return { ok: false, data: null }; }
}
export async function generateEventPlan(fields: Record<string,string>): Promise<{ok:boolean;data:any}> {
  try {
    const res = await fetch(`${API_BASE}/api/user/generate_event_plan`, {
      method: "POST", headers: authHeaders() as Record<string, string>,
      body: JSON.stringify(fields),
    });
    if (!res.ok) return { ok: false, data: null };
    return res.json();
  } catch { return { ok: false, data: null }; }
}

export async function getNotifications(): Promise<Array<{notif_id:string;type:string;title:string;body:string;link_tab:string;read:boolean;created_at:string}>> {
  try {
    const res = await fetch(`${API_BASE}/api/user/notifications`, { headers: authHeaders() });
    if (!res.ok) return [];
    const data = await res.json();
    return data.notifications || [];
  } catch { return []; }
}

export async function markNotificationRead(notif_id: string): Promise<void> {
  try {
    await fetch(`${API_BASE}/api/user/notifications/${notif_id}/read`, {
      method: "PATCH", headers: authHeaders() as Record<string, string>,
    });
  } catch {}
}

export async function markAllNotificationsRead(): Promise<void> {
  try {
    await fetch(`${API_BASE}/api/user/notifications/read_all`, {
      method: "PATCH", headers: authHeaders() as Record<string, string>,
    });
  } catch {}
}

export async function saveNotificationSettings(settings: Record<string,boolean|string>): Promise<void> {
  const res = await fetch(`${API_BASE}/api/user/notification_settings_save`, {
    method: "POST",
    headers: authHeaders() as Record<string, string>,
    body: JSON.stringify(settings),
  });
  const data = await res.json().catch(()=>({}));
  if (!res.ok || data.ok === false) {
    throw new Error(data.error || data.detail || "通知設定の保存に失敗しました");
  }
}

export async function deleteIssueHistory(doc_id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/diagnosis/issue_history/${doc_id}`, {
    method: "DELETE",
    headers: authHeaders() as Record<string, string>,
  });
  if (!res.ok) throw new Error("削除に失敗しました");
}

// ── Agent Mode ──────────────────────────────────────────────────────
export interface AgentTask {
  task_id: string;
  tenant_id: string;
  user_uid: string;
  agent_type: string;
  operation_type: string;
  industry: string;
  status: "PENDING" | "APPROVED" | "RUNNING" | "DONE" | "REJECTED" | "FAILED" | "WAITING_MAPPING" | "WAITING_EXECUTOR" | "BLOCKED";
  payload: Record<string, unknown>;
  preview: {
    agent_type: string;
    operation_type: string;
    industry: string;
    entity_label: string;
    summary: string;
    payload_preview: Record<string, unknown>;
  };
  op_id?: string;
  entity_type?: string;
  op_snapshot?: {
    op_id: string;
    display_name: string;
    category: string;
    operation_type: string;
    entity_type: string;
    industry: string;
    payload_schema_version: string;
  };
  approved_by: string | null;
  approved_at: string | null;
  scheduled_at: string | null;
  result: Record<string, unknown> | null;
  created_at: string;
  media_mapping_id?: string;
  menu_item_target_url?: string;
  menu_item_title?: string;
  menu_item_category?: string;
  source?: string;
  schedule_id?: string;
  // P14
  operation_steps?: {
    step_id: string;
    step_type: string;
    order: number;
    required?: boolean;
    selector_key?: string;
    payload_key?: string;
    url_key?: string;
    submit_selector_key?: string;
    timeout?: number;
    duration?: number;
  }[];
}

export interface AgentLog {
  log_id: string;
  task_id: string;
  tenant_id: string;
  operator_uid: string;
  agent_type: string;
  operation_type: string;
  before_state: Record<string, unknown>;
  after_state: Record<string, unknown>;
  success: boolean;
  error_message: string;
  executed_at: string;
  self_heal_attempted?: boolean;
  self_heal_success?: boolean;
  self_heal_retry_succeeded?: boolean;
}

export async function createAgentTask(params: {
  agent_type: string;
  operation_type: string;
  industry?: string;
  entity_type?: string;
  op_id?: string;
  payload: Record<string, unknown>;
  operation_mapping_override?: Record<string, unknown>;
  scheduled_at?: string;
  media_mapping_id?: string;
}): Promise<{ task_id: string; status: string; preview: AgentTask["preview"] }> {
  const res = await fetch(`${API_BASE}/api/agent/task/create`, {
    method: "POST",
    headers: authHeaders() as Record<string, string>,
    body: JSON.stringify(params),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || "タスク作成に失敗しました");
  return data;
}

// 求人対応（項目7）: 専用ナレッジ＋市場調査でAI文面を生成（送信はしない）
export async function recruitGenerate(params: {
  target_mapping_id?: string;
  recruit_mode: "offer" | "reply" | "text";
  applicant_context?: string;
  conditions?: string;
  instruction?: string;
  industry?: string;
}): Promise<{
  recruit_mode: string;
  doc_label: string;
  title: string;
  body: string;
  knowledge_used: boolean;
  market_used: boolean;
  note: string;
}> {
  const res = await fetch(`${API_BASE}/api/agent/cross_media/recruit/generate`, {
    method: "POST",
    headers: authHeaders() as Record<string, string>,
    body: JSON.stringify(params),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || "求人文面の生成に失敗しました");
  return data;
}

export interface AgentTaskBatch {
  batch_id: string;
  tenant_id?: string;
  user_uid?: string;
  agent_type: string;
  operation_type: string;
  industry?: string;
  payload?: Record<string, unknown>;
  workflow_id?: string;
  status: string;
  task_ids: string[];
  created_tasks?: { task_id: string; mapping_id: string; media_name: string; status: string; step_count?: number }[];
  skipped_targets?: { mapping_id: string; media_name?: string; reason: string; operation_status?: string; missing?: string[] }[];
  counts?: Record<string, number>;
  execution_results?: { task_id: string; status: string; skipped?: boolean; reason?: string; error?: string; result?: Record<string, unknown> }[];
  created_at?: string;
  approved_at?: string;
  executed_at?: string;
  updated_at?: string;
}

export interface CrossMediaTask {
  cross_task_id: string;
  tenant_id?: string;
  user_uid?: string;
  workflow_id?: string;
  instruction?: string;
  industry?: string;
  source_mode: "manual_payload" | "public_url" | "source_mapping";
  source_url?: string;
  source_mapping_id?: string;
  source_status?: string;
  source_snapshot?: Record<string, unknown>;
  target_operation_type: string;
  target_mapping_ids?: string[];
  payload?: Record<string, unknown>;
  query?: string;
  max_items?: number;
  status: string;
  task_ids: string[];
  created_tasks?: { task_id: string; mapping_id: string; media_name: string; status: string; step_count?: number }[];
  skipped_targets?: { mapping_id: string; media_name?: string; reason: string; operation_status?: string; missing?: string[] }[];
  counts?: Record<string, number>;
  created_at?: string;
  updated_at?: string;
}

export async function fetchCrossMediaSourceEntities(params: {
  source_mapping_id: string;
  target_operation_type?: string;
  list_url?: string;
}): Promise<{
  ok: boolean;
  status: string;
  message?: string;
  entity_label: string;
  list_url: string;
  entities: { name: string; url: string }[];
  count: number;
}> {
  const res = await fetch(`${API_BASE}/api/agent/cross_media/source_entities`, {
    method: "POST",
    headers: authHeaders() as Record<string, string>,
    body: JSON.stringify(params),
  });
  const data = await res.json().catch(() => ({ ok: false, entities: [] }));
  if (!res.ok) throw new Error(data.detail || "対象一覧の取得に失敗しました");
  return data;
}

export async function fetchCrossMediaSnapshot(params: {
  source_mapping_id: string;
  dest_mapping_id: string;
  entity_url: string;
}): Promise<{
  ok: boolean;
  message?: string;
  snapshot: {
    synced_at: string | null;
    source_data: Record<string, string>;
    mapped_fields: Record<string, string>;
    entity_label: string;
    industry: string;
  } | null;
}> {
  const q = new URLSearchParams(params).toString();
  const res = await fetch(`${API_BASE}/api/agent/cross_media/snapshot?${q}`, {
    headers: authHeaders() as Record<string, string>,
  });
  const data = await res.json().catch(() => ({ ok: false, snapshot: null }));
  if (!res.ok) throw new Error(data.detail || "スナップショット取得に失敗しました");
  return data;
}

export async function createCrossMediaTask(params: {
  instruction?: string;
  industry?: string;
  source_mode: "manual_payload" | "public_url" | "source_mapping";
  source_url?: string;
  source_mapping_id?: string;
  target_mapping_ids?: string[];
  target_operation_type: string;
  source_payload?: Record<string, unknown>;
  query?: string;
  max_items?: number;
  source_access_confirmed?: boolean;
  scheduled_at?: string;
  source_entity_url?: string;
  source_entity_label?: string;
  selected_field_keys?: string[];
}): Promise<CrossMediaTask> {
  const res = await fetch(`${API_BASE}/api/agent/cross_media/task/create`, {
    method: "POST",
    headers: authHeaders() as Record<string, string>,
    body: JSON.stringify(params),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || "媒体クロスメディア作成に失敗しました");
  return data;
}

export async function previewCrossMedia(params: {
  source_mapping_id?: string;
  source_url?: string;
  source_payload?: Record<string, unknown>;
  target_mapping_ids: string[];
  target_operation_type: string;
  instruction?: string;
  source_entity_url?: string;
}): Promise<{
  results: {
    mapping_id: string;
    media_name: string;
    screenshot_b64?: string;
    current_url?: string;
    resolved_url?: string;
    url_source?: string;
    url_verified?: boolean;
    mapping_detail: { index: number; label: string; name: string; value: string }[];
    field_count: number;
    mapped_field_count?: number;
    known_mapped_fields?: Array<{selector?: string; label?: string; name?: string; id?: string; type?: string; required?: boolean; canonical?: string; source?: string}>;
    mapped_count: number;
    source_data_keys: string[];
    error?: string;
  }[];
  source_data: Record<string, string>;
}> {
  const res = await fetch(`${API_BASE}/api/agent/cross_media/preview`, {
    method: "POST",
    headers: authHeaders() as Record<string, string>,
    body: JSON.stringify(params),
  });
  const data = await res.json().catch(() => ({ results: [], source_data: {} }));
  if (!res.ok) throw new Error(data.detail || "プレビュー取得に失敗しました");
  return data;
}

export async function deleteCrossMediaTask(crossTaskId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/agent/cross_media/task/${encodeURIComponent(crossTaskId)}`, {
    method: "DELETE",
    headers: authHeaders() as Record<string, string>,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || "削除に失敗しました");
}

export async function listCrossMediaTasks(): Promise<{ tasks: CrossMediaTask[]; count: number }> {
  const res = await fetch(`${API_BASE}/api/agent/cross_media/task/list`, {
    headers: authHeaders() as Record<string, string>,
  });
  const data = await res.json().catch(() => ({ tasks: [], count: 0 }));
  return data;
}

export async function createAgentTaskBatch(params: {
  agent_type?: string;
  operation_type: string;
  industry?: string;
  entity_type?: string;
  media_mapping_ids?: string[];
  payload: Record<string, unknown>;
  scheduled_at?: string;
  include_needs_review?: boolean;
}): Promise<AgentTaskBatch> {
  const res = await fetch(`${API_BASE}/api/agent/task/batch/create`, {
    method: "POST",
    headers: authHeaders() as Record<string, string>,
    body: JSON.stringify(params),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || "一括タスク作成に失敗しました");
  return data;
}

export async function approveAgentTaskBatch(batch_id: string): Promise<{ batch_id: string; status: string; approved_task_ids: string[]; skipped: unknown[]; counts: Record<string, number> }> {
  const res = await fetch(`${API_BASE}/api/agent/task/batch/approve`, {
    method: "POST",
    headers: authHeaders() as Record<string, string>,
    body: JSON.stringify({ batch_id }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || "一括承認に失敗しました");
  return data;
}

export async function executeAgentTaskBatch(batch_id: string): Promise<{ batch_id: string; status: string; results: unknown[]; counts: Record<string, number> }> {
  const res = await fetch(`${API_BASE}/api/agent/task/batch/execute`, {
    method: "POST",
    headers: authHeaders() as Record<string, string>,
    body: JSON.stringify({ batch_id }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || "一括実行に失敗しました");
  return data;
}

export async function listAgentTaskBatches(): Promise<{ batches: AgentTaskBatch[]; count: number }> {
  const res = await fetch(`${API_BASE}/api/agent/task/batch/list`, {
    headers: authHeaders() as Record<string, string>,
  });
  const data = await res.json().catch(() => ({ batches: [], count: 0 }));
  return data;
}

export async function planAgentTask(params: {
  instruction: string;
  mapping_id?: string;
}): Promise<{
  ok: boolean;
  ready: boolean;
  media_name?: string;
  op_id?: string;
  operation_type?: string;
  payload?: Record<string, unknown>;
  preview?: string;
  question?: string;
}> {
  const res = await fetch(`${API_BASE}/api/agent/plan`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error((await res.json()).detail || "plan failed");
  return res.json();
}

export type AgentGoalPlan = {
  ok: boolean;
  goal: string;
  mode: string;
  route_tab: string;
  confidence: number;
  summary: string;
  autonomy_level?: string;
  can_create_task: boolean;
  operation_plan?: {
    ready?: boolean;
    operation_type?: string;
    payload?: Record<string, unknown>;
    preview?: string;
    question?: string | null;
  };
  extracted?: Record<string, unknown>;
  prefill?: {
    monitoring?: Record<string, unknown>;
    cross_media?: Record<string, unknown>;
    interview?: Record<string, unknown>;
    task?: Record<string, unknown>;
    schedule?: Record<string, unknown>;
  };
  missing_capabilities?: string[];
  tool_selection?: Array<{ tool: string; tab: string; score: number; reason: string }>;
  readiness: Record<string, number>;
  media: Array<Record<string, unknown>>;
  workstream: Array<{ phase: string; title: string; tab: string; status: string }>;
  next_actions: Array<{ label: string; tab: string; status: string; reason: string }>;
};

export async function planAgentGoal(params: {
  goal: string;
  mapping_id?: string;
}): Promise<AgentGoalPlan> {
  const res = await fetch(`${API_BASE}/api/agent/goal/plan`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || "ゴール解析に失敗しました");
  return data;
}

export async function createAgentTaskFromInstruction(params: {
  instruction: string;
  mapping_id?: string;
  payload?: Record<string, unknown>;
  scheduled_at?: string;
}): Promise<{
  ok: boolean;
  created: boolean;
  status?: string;
  source?: "menu_item" | "media_mapping";
  task_id?: string;
  preview?: AgentTask["preview"];
  operation_type?: string;
  media_name?: string;
  mapping_id?: string;
  target_url?: string;
  question?: string;
  candidates?: Array<Record<string, unknown>>;
  plan?: Record<string, unknown>;
}> {
  const res = await fetch(`${API_BASE}/api/agent/task/from_instruction`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = typeof data.detail === "string" ? data.detail : data.detail?.message;
    throw new Error(detail || "自然文タスク作成に失敗しました");
  }
  return data;
}

export async function approveAgentTask(task_id: string): Promise<{ task_id: string; status: string }> {
  const res = await fetch(`${API_BASE}/api/agent/task/approve`, {
    method: "POST",
    headers: authHeaders() as Record<string, string>,
    body: JSON.stringify({ task_id }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || "承認に失敗しました");
  return data;
}

export async function rejectAgentTask(task_id: string, reason?: string): Promise<{ task_id: string; status: string }> {
  const res = await fetch(`${API_BASE}/api/agent/task/reject`, {
    method: "POST",
    headers: authHeaders() as Record<string, string>,
    body: JSON.stringify({ task_id, reason }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || "却下に失敗しました");
  return data;
}

export async function deleteAgentTask(task_id: string): Promise<{ task_id: string; status: string }> {
  const res = await fetch(`${API_BASE}/api/agent/task/${encodeURIComponent(task_id)}`, {
    method: "DELETE",
    headers: authHeaders() as Record<string, string>,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || "削除に失敗しました");
  return data;
}

export async function executeAgentTask(task_id: string): Promise<{ task_id: string; status: string; result: Record<string, unknown> }> {
  const res = await fetch(`${API_BASE}/api/agent/task/execute/${task_id}`, {
    method: "POST",
    headers: authHeaders() as Record<string, string>,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || "実行に失敗しました");
  return data;
}

export async function listAgentTasks(params?: { status?: string; agent_type?: string }): Promise<{ tasks: AgentTask[]; count: number }> {
  const q = new URLSearchParams();
  if (params?.status) q.set("status", params.status);
  if (params?.agent_type) q.set("agent_type", params.agent_type);
  const res = await fetch(`${API_BASE}/api/agent/task/list?${q.toString()}`, {
    headers: authHeaders() as Record<string, string>,
  });
  const data = await res.json().catch(() => ({ tasks: [], count: 0 }));
  return data;
}

export async function getAgentTask(task_id: string): Promise<AgentTask> {
  const res = await fetch(`${API_BASE}/api/agent/task/${task_id}`, {
    headers: authHeaders() as Record<string, string>,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || "タスク取得に失敗しました");
  return data;
}

export async function listAgentLogs(params?: { agent_type?: string }): Promise<{ logs: AgentLog[]; count: number }> {
  const q = new URLSearchParams();
  if (params?.agent_type) q.set("agent_type", params.agent_type);
  const res = await fetch(`${API_BASE}/api/agent/log/list?${q.toString()}`, {
    headers: authHeaders() as Record<string, string>,
  });
  const data = await res.json().catch(() => ({ logs: [], count: 0 }));
  return data;
}

export async function getAgentIndustryTemplates(): Promise<{
  templates: Record<string, Record<string, string>>;
  agent_types: string[];
  operation_types: string[];
}> {
  const res = await fetch(`${API_BASE}/api/agent/industry_templates`, {
    headers: authHeaders() as Record<string, string>,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || "テンプレート取得に失敗しました");
  return data;
}

export async function getAgentPermissions(tenantId: string): Promise<{
  tenant_id?: string;
  admin_granted?: boolean;
  allowed_agents?: string[];
  allowed_operations?: string[];
  max_tasks_per_day?: number;
  operations?: Record<string, { approval_count?: number; auto_enabled?: boolean; last_approved_at?: string }>;
}> {
  const res = await fetch(`${API_BASE}/api/agent/permissions/${encodeURIComponent(tenantId)}`, {
    headers: authHeaders() as Record<string, string>,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || "エージェント権限取得に失敗しました");
  return data;
}

export async function updateAgentPermissions(
  tenantId: string,
  patch: {
    admin_granted?: boolean;
    allowed_agents?: string[];
    allowed_operations?: string[];
    max_tasks_per_day?: number;
  }
): Promise<{
  tenant_id?: string;
  admin_granted?: boolean;
  allowed_agents?: string[];
  allowed_operations?: string[];
  max_tasks_per_day?: number;
  operations?: Record<string, { approval_count?: number; auto_enabled?: boolean; last_approved_at?: string }>;
}> {
  const res = await fetch(`${API_BASE}/api/agent/permissions/${encodeURIComponent(tenantId)}`, {
    method: "PATCH",
    headers: { ...(authHeaders() as Record<string, string>), "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || "エージェント権限更新に失敗しました");
  return data;
}


// ── Agent Mode 追加関数 ──────────────────────────────────────────────────────

export interface AgentOp {
  op_id: string;
  display_name: string;
  description?: string;
  category: string;
  industry?: string;
  entity_type?: string;
  operation_type?: string;
  allowed_plans: string[];
  requires_approval?: boolean;
  active?: boolean;
  invalid_reason?: string;
  payload_schema?: {
    fields: Array<{
      key: string;
      label: string;
      type: "text" | "textarea" | "select" | "file" | "datetime" | "number" | "boolean";
      required: boolean;
      options?: string[];
    }>;
  };
  created_at?: string;
}

export interface MediaMapping {
  mapping_id: string;
  tenant_id: string;
  media_name: string;
  media_url: string;
  login_url?: string | null;
  auth_type?: string | null;
  operation_type?: string | null;
  credential_secret_name?: string | null;
  verify_selector?: string | null;
  dom_selectors: Record<string, string>;
  form_structure: Record<string, unknown>;
  last_verified_at: string | null;
  manual_menu_scan_results?: {
    items?: unknown[];
    summary?: Record<string, unknown>;
    started_at?: string;
    updated_at?: string;
    finished_at?: string;
  } | null;
  scan_progress?: Record<string, unknown> | null;
  schema_first?: Record<string, unknown> | null;
  media_schema?: Record<string, unknown> | null;
  entity_schema?: Record<string, unknown> | null;
  login_health?: string | null;
  created_at: string;
  capabilities?: { can_login?: boolean; can_upload_image?: boolean; can_post_news?: boolean; can_update_text?: boolean; can_verify?: boolean; } | null;
  industry?: string | null;
  selector_repair_suggestions?: {
    created_at?: string;
    operation_type?: string;
    failed_selectors?: string[];
    suggested_selectors?: { suggested_selector: string; tag?: string; name?: string; id?: string }[];
    cleared_at?: string;
    applied?: boolean;
  } | null;
  previous_selectors?: Record<string, string> | null;
  last_selector_repair_applied_at?: string | null;
  capabilities_candidate?: {
    created_at?: string;
    capabilities?: Record<string, boolean>;
    reason?: Record<string, string>;
    cleared_at?: string;
    applied?: boolean;
  } | null;
  previous_capabilities?: Record<string, boolean> | null;
  semantic_selector_candidates?: {
    created_at?: string;
    labels?: Record<string, string>;
    confidence?: Record<string, string>;
    cleared_at?: string;
    applied?: boolean;
    applied_keys?: string[];
  } | null;
  last_semantic_selector_applied_at?: string | null;
  last_capabilities_applied_at?: string | null;
  selector_rankings?: {
    computed_at?: string | { _seconds: number };
    operation_type?: string;
    ranked_selectors?: {
      selector: string;
      score: number;
      reasons: string[];
      source: string;
      label?: string;
    }[];
  } | null;
  agent_learning_health?: {
    computed_at?: string;
    execution_count?: number;
    success_count?: number;
    failed_count?: number;
    success_rate?: number;
    avg_execution_time_ms?: number;
    selector_success_rate_avg?: number | null;
    most_common_failure?: string;
    last_failure_at?: string | null;
    last_success_at?: string | null;
    recommendations?: string[];
  } | null;
  business_conditions?: {
    site_purpose?: string;
    screening?: {
      height_min?: number;
      height_max?: number;
      weight_max?: number;
      cup_min?: string;
      tattoo_ok?: boolean;
      age_min?: number;
      age_max?: number;
      custom_conditions?: string;
      image_check?: boolean;
    };
    reply_policy?: {
      tone?: string;
      interview_info?: string;
      shop_conditions?: string;
    };
    offer_template?: string;
  } | null;
  manual_form_pages?: Array<{
    page_id?: string;
    title?: string;
    url?: string;
    op_type?: string;
    page_type?: string;
    fields?: Array<{
      selector?: string;
      label?: string;
      name?: string;
      id?: string;
      type?: string;
      required?: boolean;
      canonical?: string;
      options?: string[];
      placeholder?: string;
      value?: string;
    }>;
    fields_count?: number;
    form_action?: string;
    save_selector?: string;
    source?: string;
    saved_at?: string;
    op_type_user_specified?: boolean;
  }> | null;
  operation_mappings?: Record<string, {
    status?: string;
    executable?: boolean;
    confirmed?: boolean;
    user_confirmed?: boolean;
    production_ready?: boolean;
    candidate_only?: boolean;
    confirmation_status?: string;
    execution_block_reason?: string;
    target_url?: string;
    source?: string;
    fields?: Array<{selector?: string; label?: string; name?: string; id?: string; type?: string; required?: boolean; canonical?: string; options?: string[]; placeholder?: string; value?: string}>;
    selectors?: Record<string, {selector: string; label?: string; type?: string; source?: string; confidence?: string}>;
    form_schema?: {fields?: Array<{selector?: string; label?: string; name?: string; id?: string; canonical?: string; type?: string; required?: boolean; options?: string[]; placeholder?: string; value?: string}>};
    form_action?: string;
    save_selector?: string;
    manual_title?: string;
    missing?: string[];
    validation_score?: number;
    updated_at?: string;
  }> | null;
}

export interface MediaSchemaResponse {
  mapping_id: string;
  media_name: string;
  schema_first: Record<string, unknown>;
  media_schema: Record<string, unknown>;
  entity_schema: Record<string, unknown>;
  schema_generation?: string;
  forms: Array<Record<string, unknown>>;
  fields: Array<Record<string, unknown>>;
  counts: Record<string, number>;
}

export interface MediaMenuItemsResponse {
  mapping_id: string;
  media_name: string;
  items: Array<Record<string, unknown>>;
  count: number;
  summary: Record<string, unknown>;
  storage_mode?: string;
  items_subcollection?: string;
}

export interface AgentSchedule {
  schedule_id: string;
  tenant_id: string;
  op_id: string;
  operation_type?: string;
  media_mapping_id?: string;
  media_name?: string;
  menu_item_target_url?: string;
  menu_item_title?: string;
  menu_item_category?: string;
  cron_expr: string;
  payload_template: Record<string, unknown>;
  enabled: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
  created_at: string;
}

export async function listAgentOps(): Promise<{ ops: AgentOp[]; count: number }> {
  const res = await fetch(`${API_BASE}/api/agent/ops`, {
    headers: authHeaders() as Record<string, string>,
  });
  if (!res.ok) throw new Error((await res.json()).detail || "ops取得失敗");
  return res.json();
}

export async function createMediaMapping(params: {
  media_name: string;
  media_url: string;
  login_url?: string;
  industry?: string;
  dom_selectors?: Record<string, string>;
  form_structure?: Record<string, unknown>;
  capabilities?: { can_login?: boolean; can_upload_image?: boolean; can_post_news?: boolean; can_update_text?: boolean; can_verify?: boolean; };
}): Promise<{ mapping_id: string; status: string }> {
  const res = await fetch(`${API_BASE}/api/agent/media/map`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error((await res.json()).detail || "媒体マッピング作成失敗");
  return res.json();
}

export async function listMediaMappings(): Promise<{ mappings: MediaMapping[]; count: number }> {
  const res = await fetch(`${API_BASE}/api/agent/media/map`, {
    headers: authHeaders() as Record<string, string>,
  });
  if (!res.ok) throw new Error((await res.json()).detail || "媒体マッピング取得失敗");
  return res.json();
}

export async function deleteMediaMapping(mapping_id: string): Promise<{ mapping_id: string; status: string }> {
  const res = await fetch(`${API_BASE}/api/agent/media/map/${mapping_id}`, {
    method: "DELETE",
    headers: authHeaders() as Record<string, string>,
  });
  if (!res.ok) throw new Error((await res.json()).detail || "媒体マッピング削除失敗");
  return res.json();
}

export async function createAgentSchedule(params: {
  op_id?: string;
  operation_type?: string;
  media_mapping_id?: string;
  menu_item_target_url?: string;
  cron_expr: string;
  payload_template?: Record<string, unknown>;
  enabled?: boolean;
}): Promise<{ schedule_id: string; status: string }> {
  const res = await fetch(`${API_BASE}/api/agent/schedule/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error((await res.json()).detail || "スケジュール作成失敗");
  return res.json();
}

export async function listAgentSchedules(): Promise<{ schedules: AgentSchedule[]; count: number }> {
  const res = await fetch(`${API_BASE}/api/agent/schedule/list`, {
    headers: authHeaders() as Record<string, string>,
  });
  if (!res.ok) throw new Error((await res.json()).detail || "スケジュール取得失敗");
  return res.json();
}

export async function updateAgentSchedule(
  schedule_id: string,
  enabled: boolean
): Promise<{ schedule_id: string; enabled: boolean }> {
  const res = await fetch(`${API_BASE}/api/agent/schedule/${schedule_id}?enabled=${enabled}`, {
    method: "PATCH",
    headers: authHeaders() as Record<string, string>,
  });
  if (!res.ok) throw new Error((await res.json()).detail || "スケジュール更新失敗");
  return res.json();
}


export async function saveMediaCredential(mapping_id: string, login_id: string, password: string): Promise<{ status: string; mapping_id: string; credential_registered: boolean }> {
  const res = await fetch(`${API_BASE}/api/agent/media/map/${mapping_id}/credential`, {
    method: "PATCH",
    headers: { ...(authHeaders() as Record<string, string>), "Content-Type": "application/json" },
    body: JSON.stringify({ login_id, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || "ログイン情報の保存に失敗しました");
  return data;
}

export async function updateMediaSelectors(
  mapping_id: string,
  dom_selectors: { username: string; password: string; login_submit: string; [key: string]: string },
  verify_selector?: string
): Promise<{ mapping_id: string; status: string }> {
  const res = await fetch(`${API_BASE}/api/agent/media/map/${mapping_id}/selectors`, {
    method: "PATCH",
    headers: { ...(authHeaders() as Record<string, string>), "Content-Type": "application/json" },
    body: JSON.stringify({ dom_selectors, form_structure: {}, verify_selector: verify_selector || null }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || "セレクター設定の保存に失敗しました");
  return data;
}

export async function loginCheckMediaMapping(mapping_id: string): Promise<{
  mapping_id: string;
  status: string;
  login_checked: boolean;
  login_success: boolean;
  message: string;
}> {
  const res = await fetch(`${API_BASE}/api/agent/media/map/${mapping_id}/login_check`, {
    method: "POST",
    headers: authHeaders() as Record<string, string>,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || data.message || data.error || "ログイン確認失敗");
  return data;
}

export interface SitePreviewFieldBox {
  key: string;
  selector: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SitePreviewResult {
  mapping_id?: string;
  screenshot_b64: string;
  page_html: string;
  current_url: string;
  title: string;
  field_boxes: SitePreviewFieldBox[];
  form_elements?: FormElement[];
  login_used: boolean;
  viewport: { width: number; height: number };
}

export interface FormElement {
  idx: number;
  tag: string;
  type: string;
  label: string;
  name: string;
  selector: string | null;
  current_value: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface FormFillResult {
  mapping_id: string;
  submit_clicked: boolean;
  screenshot_b64: string;
  current_url: string;
  field_errors: string[];
  viewport: { width: number; height: number };
  message: string;
}

export async function formFill(
  mapping_id: string,
  target_url: string,
  field_values: Record<string, string>
): Promise<FormFillResult> {
  const res = await fetch(`${API_BASE}/api/agent/media/map/${mapping_id}/form_fill`, {
    method: "POST",
    headers: { ...(authHeaders() as Record<string, string>), "Content-Type": "application/json" },
    body: JSON.stringify({ target_url, field_values }),
    credentials: "include",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || data.message || "フォーム送信に失敗しました");
  return data;
}

export async function getSitePreview(mapping_id: string, target_url?: string): Promise<SitePreviewResult> {
  const res = await fetch(`${API_BASE}/api/agent/media/map/${mapping_id}/site_preview`, {
    method: "POST",
    headers: { ...(authHeaders() as Record<string, string>), "Content-Type": "application/json" },
    body: JSON.stringify({ target_url: target_url || "" }),
    credentials: "include",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || data.message || "サイトプレビューの取得に失敗しました");
  return data;
}

export async function previewPublicUrl(url: string): Promise<SitePreviewResult> {
  const res = await fetch(`${API_BASE}/api/agent/media/preview_url`, {
    method: "POST",
    headers: { ...(authHeaders() as Record<string, string>), "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
    credentials: "include",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || data.message || "URLプレビューの取得に失敗しました");
  return data;
}

export async function getFormSnapshot(mapping_id: string, target_url?: string): Promise<SitePreviewResult> {
  const res = await fetch(`${API_BASE}/api/agent/media/map/${mapping_id}/form_snapshot`, {
    method: "POST",
    headers: { ...(authHeaders() as Record<string, string>), "Content-Type": "application/json" },
    body: JSON.stringify({ target_url: target_url || "" }),
    credentials: "include",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || data.message || "フォームスナップショットの取得に失敗しました");
  return data;
}

export async function applySelectorRepair(
  mapping_id: string,
  approved_selectors: Record<string, string>
): Promise<{
  mapping_id: string;
  applied_keys: string[];
  previous_selectors: Record<string, string>;
  status: string;
}> {
  const res = await fetch(`${API_BASE}/api/agent/media/map/${mapping_id}/selector_repair/apply`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" } as Record<string, string>,
    body: JSON.stringify({ approved_selectors }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || "selector修復候補の適用に失敗しました");
  return data;
}

export async function applyCapabilities(
  mapping_id: string,
  approved_capabilities: Record<string, boolean>
): Promise<{
  mapping_id: string;
  applied_keys: string[];
  previous_capabilities: Record<string, boolean>;
  status: string;
}> {
  const res = await fetch(`${API_BASE}/api/agent/media/map/${mapping_id}/capabilities/apply`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" } as Record<string, string>,
    body: JSON.stringify({ approved_capabilities }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || "capability候補の適用に失敗しました");
  return data;
}

export async function applySemanticSelector(
  mapping_id: string,
  approved_labels: Record<string, boolean>
): Promise<{
  mapping_id: string;
  applied_keys: string[];
  previous_selectors: Record<string, string>;
  status: string;
}> {
  const res = await fetch(`${API_BASE}/api/agent/media/map/${mapping_id}/semantic_selector/apply`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" } as Record<string, string>,
    body: JSON.stringify({ approved_labels }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || "意味推定selectorの適用に失敗しました");
  return data;
}
export async function recomputeLearningHealth(mapping_id: string): Promise<{
  mapping_id: string;
  status: string;
  health: {
    computed_at: string;
    execution_count: number;
    success_count: number;
    failed_count: number;
    success_rate: number;
    avg_execution_time_ms: number;
    selector_success_rate_avg: number | null;
    most_common_failure: string;
    last_failure_at: string | null;
    last_success_at: string | null;
    recommendations: string[];
  };
}> {
  const res = await fetch(`${API_BASE}/api/agent/media/map/${mapping_id}/learning/recompute`, {
    method: "POST",
    headers: authHeaders() as Record<string, string>,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || "健康度の再計算に失敗しました");
  return data;
}
export async function recomputeSelectorRanking(mapping_id: string): Promise<{
  mapping_id: string;
  status: string;
  ranked_count: number;
  selector_rankings: {
    computed_at: string;
    operation_type: string;
    ranked_selectors: {
      selector: string;
      score: number;
      reasons: string[];
      source: string;
      label?: string;
    }[];
  };
}> {
  const res = await fetch(`${API_BASE}/api/agent/media/map/${mapping_id}/selector_rank/recompute`, {
    method: "POST",
    headers: authHeaders() as Record<string, string>,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || "selectorランキングの再計算に失敗しました");
  return data;
}

// ── P20 Workflow Session Control ──────────────────────────────────────────────

export interface WorkflowSession {
  session_id: string;
  workflow_id: string;
  goal: string;
  approval_state: string;
  status: string;
  risk_level: string;
  current_phase: string;
  current_step: string;
  paused: boolean;
  cancelled: boolean;
  interruptible: boolean;
  execution_policy: Record<string, unknown>;
  adaptive_branch_history: Array<Record<string, unknown>>;
}

export async function approveWorkflowSession(session_id: string): Promise<{ session_id: string; status: string }> {
  const res = await fetch(`${API_BASE}/api/agent/workflow/approve`, {
    method: "POST",
    headers: authHeaders() as Record<string, string>,
    body: JSON.stringify({ session_id }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || "承認に失敗しました");
  return data;
}

export async function rejectWorkflowSession(session_id: string): Promise<{ session_id: string; status: string }> {
  const res = await fetch(`${API_BASE}/api/agent/workflow/reject`, {
    method: "POST",
    headers: authHeaders() as Record<string, string>,
    body: JSON.stringify({ session_id }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || "却下に失敗しました");
  return data;
}

export async function pauseWorkflowSession(session_id: string): Promise<{ session_id: string; status: string }> {
  const res = await fetch(`${API_BASE}/api/agent/workflow/pause`, {
    method: "POST",
    headers: authHeaders() as Record<string, string>,
    body: JSON.stringify({ session_id }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || "一時停止に失敗しました");
  return data;
}

export async function resumeWorkflowSession(session_id: string): Promise<{ session_id: string; status: string }> {
  const res = await fetch(`${API_BASE}/api/agent/workflow/resume`, {
    method: "POST",
    headers: authHeaders() as Record<string, string>,
    body: JSON.stringify({ session_id }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || "再開に失敗しました");
  return data;
}

export async function cancelWorkflowSession(session_id: string): Promise<{ session_id: string; status: string }> {
  const res = await fetch(`${API_BASE}/api/agent/workflow/cancel`, {
    method: "POST",
    headers: authHeaders() as Record<string, string>,
    body: JSON.stringify({ session_id }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || "キャンセルに失敗しました");
  return data;
}

export async function getWorkflowSession(session_id: string): Promise<WorkflowSession> {
  const res = await fetch(`${API_BASE}/api/agent/workflow/session/${encodeURIComponent(session_id)}`, {
    headers: authHeaders() as Record<string, string>,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || "セッション取得に失敗しました");
  return data;
}

export async function createWorkflowSession(params: {
  workflow_id?: string;
  goal: string;
  instruction?: string;
  mapping_id?: string;
  execution_policy?: Record<string, unknown>;
}): Promise<WorkflowSession> {
  const res = await fetch(`${API_BASE}/api/agent/workflow/session/create`, {
    method: "POST",
    headers: authHeaders() as Record<string, string>,
    body: JSON.stringify(params),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || "ワークフロー作成に失敗しました");
  return data;
}

export async function listWorkflowSessions(): Promise<{ sessions: WorkflowSession[]; count: number }> {
  const res = await fetch(`${API_BASE}/api/agent/workflow/session/list`, {
    headers: authHeaders() as Record<string, string>,
  });
  const data = await res.json().catch(() => ({ sessions: [], count: 0 }));
  return data;
}

export async function scanMediaDom(
  mapping_id: string,
  max_pages?: number,
  options?: {
    start_url?: string;
    include_patterns?: string[];
    exclude_patterns?: string[];
    reset_resume?: boolean;
  }
): Promise<Record<string, unknown>> {
  const res = await fetch(`${API_BASE}/api/agent/media/map/${encodeURIComponent(mapping_id)}/dom_scan`, {
    method: "POST",
    headers: { ...(authHeaders() as Record<string, string>), "Content-Type": "application/json" },
    body: JSON.stringify({
      max_pages: max_pages ?? 200,
      start_url: options?.start_url ?? "",
      include_patterns: options?.include_patterns ?? [],
      exclude_patterns: options?.exclude_patterns ?? [],
      reset_resume: options?.reset_resume ?? false,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || data.message || "DOMスキャンに失敗しました");
  return data;
}

export async function getMediaMappingSchema(
  mapping_id: string,
  options?: { include_forms?: boolean; include_fields?: boolean; forms_limit?: number; fields_limit?: number }
): Promise<MediaSchemaResponse> {
  const params = new URLSearchParams();
  if (options?.include_forms !== undefined) params.set("include_forms", String(options.include_forms));
  if (options?.include_fields !== undefined) params.set("include_fields", String(options.include_fields));
  if (options?.forms_limit !== undefined) params.set("forms_limit", String(options.forms_limit));
  if (options?.fields_limit !== undefined) params.set("fields_limit", String(options.fields_limit));
  const qs = params.toString();
  const res = await fetch(`${API_BASE}/api/agent/media/map/${encodeURIComponent(mapping_id)}/schema${qs ? `?${qs}` : ""}`, {
    headers: authHeaders() as Record<string, string>,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || "媒体schema取得に失敗しました");
  return data as MediaSchemaResponse;
}

export async function getMediaMenuScanItems(mapping_id: string, limit = 300): Promise<MediaMenuItemsResponse> {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  const res = await fetch(`${API_BASE}/api/agent/media/map/${encodeURIComponent(mapping_id)}/menu_items?${params.toString()}`, {
    headers: authHeaders() as Record<string, string>,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || "HTMLメニュー詳細の取得に失敗しました");
  return data as MediaMenuItemsResponse;
}

export type ProfileDisplayField = { selector: string; label: string; value: string; type: string };
export type ProfileMappingResult = {
  mapping_id: string;
  media_name?: string;
  target_url?: string;
  fill_fields?: Record<string, string>;   // CSSセレクタ→値（execute直通）
  display_fields?: ProfileDisplayField[]; // UI表示用
  error?: string;
};

export async function generateProfilePreview(params: {
  cast_name: string;
  age?: string;
  height?: string;
  bust?: string;
  cup?: string;
  waist?: string;
  hip?: string;
  type_hint?: string;
  custom_instructions?: string;
  industry?: string;
  target_mapping_ids: string[];
  source_html?: string;
  source_html_mapping_id?: string;
  source_html_target_url?: string;
}): Promise<{ ok: boolean; cast_name: string; generated_fields: Record<string, string>; mapping_results: ProfileMappingResult[] }> {
  const res = await fetch(`${API_BASE}/api/agent/cross_media/generate_profile_preview`, {
    method: "POST",
    headers: { ...(authHeaders() as Record<string, string>), "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || data.message || "プロフィール生成に失敗しました");
  return data;
}

export async function generateProfileExecute(params: {
  cast_name: string;
  fill_fields: Record<string, string>;   // CSSセレクタ→値
  target_mapping_id: string;
  target_url?: string;
}): Promise<{ ok: boolean; cast_name: string; message: string; filled_count?: number }> {
  const res = await fetch(`${API_BASE}/api/agent/cross_media/generate_profile_execute`, {
    method: "POST",
    headers: { ...(authHeaders() as Record<string, string>), "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || data.message || "プロフィール登録に失敗しました");
  return data;
}

export type MonitoringResult = {
  id: string;
  tenant_id: string;
  mapping_id: string;
  task_id?: string;
  executed_at?: string;
  monitoring_target?: string;
  industry?: string;
  trending_phrases: string[];
  popular_types: string[];
  avoid_phrases: string[];
  ai_summary: string;
  recommendations: string[];
  keyword_hits?: Record<string, number>;
  active_casts?: { cast_name: string; count: number }[];
  silent_casts?: string[];
  total_posts?: number;
  competitors?: { url: string; ok: boolean; title?: string; total_posts?: number }[];
};

export async function getMonitoringResults(params: {
  mapping_id?: string;
  limit?: number;
}): Promise<{ results: MonitoringResult[] }> {
  const qs = new URLSearchParams();
  if (params.mapping_id) qs.set("mapping_id", params.mapping_id);
  if (params.limit) qs.set("limit", String(params.limit));
  const res = await fetch(`${API_BASE}/api/agent/monitoring/results?${qs}`, {
    headers: authHeaders() as Record<string, string>,
  });
  const data = await res.json().catch(() => ({ results: [] }));
  return data;
}

export async function deepScanOperation(
  mapping_id: string,
  operation_type: string,
  hint_url: string = ""
): Promise<{
  mapping_id: string;
  operation_type: string;
  result: {
    status: string;
    target_url?: string;
    selectors?: Record<string, string>;
    missing?: string[];
    confidence?: string;
    last_scanned_at?: string;
    error?: string;
  };
}> {
  const res = await fetch(`${API_BASE}/api/agent/media/map/${mapping_id}/operation/${operation_type}/deep_scan`, {
    method: "POST",
    headers: { ...(authHeaders() as Record<string, string>), "Content-Type": "application/json" },
    body: JSON.stringify({ hint_url }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) throw new Error("ASCENDに再ログインしてください");
    throw new Error(data.detail || data.message || data.error || "deep_scan失敗");
  }
  return data;
}


export interface DialogCandidate {
  value?: string;       // URL type
  selector?: string;    // selector type
  description: string;
  confidence: "high" | "medium" | "low";
  tag?: string;         // selector type: HTML タグ名
  text?: string;        // selector type: 表示テキスト
  placeholder?: string; // selector type: placeholder 属性
}
export interface DialogStep {
  role: string;
  question: string;
  type: "url" | "selector";
  optional: boolean;
  candidates: DialogCandidate[];
}

export async function scanOperationDialog(
  mapping_id: string,
  page_url: string,
  page_name: string,
  intent?: string
): Promise<{ ok: boolean; page_name: string; page_url: string; steps: DialogStep[]; discovered_tabs?: {href: string; absolute_url: string; text: string}[]; error?: string }> {
  const res = await fetch(`${API_BASE}/api/agent/media/map/${mapping_id}/dialog/scan`, {
    method: "POST",
    headers: { ...(authHeaders() as Record<string, string>), "Content-Type": "application/json" },
    body: JSON.stringify({ page_url, page_name, ...(intent ? { intent } : {}) }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) throw new Error("ASCENDに再ログインしてください");
    throw new Error(data.detail || data.message || data.error || "スキャン失敗");
  }
  return data;
}

export async function autoDiscoverMenu(mappingId: string, startUrl?: string): Promise<{ ok: boolean; items_count: number; source_url: string }> {
  const res = await fetch(`${API_BASE}/api/agent/media/map/${mappingId}/menu/auto_discover`, {
    method: "POST",
    headers: { ...(authHeaders() as Record<string, string>), "Content-Type": "application/json" },
    body: JSON.stringify({ start_url: startUrl || "" }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) throw new Error("ASCENDに再ログインしてください");
    throw new Error(data.detail || data.message || data.error || "自動取得失敗");
  }
  return data;
}

export async function addMenuItem(mappingId: string, item: { absolute_url: string; title: string; category?: string }): Promise<{ ok: boolean; added: boolean }> {
  const res = await fetch(`${API_BASE}/api/agent/media/map/${mappingId}/menu_items/add`, {
    method: "POST",
    headers: { ...(authHeaders() as Record<string, string>), "Content-Type": "application/json" },
    body: JSON.stringify(item),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) throw new Error("ASCENDに再ログインしてください");
    throw new Error(data.detail || data.message || data.error || "追加失敗");
  }
  return data;
}

export async function confirmDialogStep(
  mapping_id: string,
  body: { page_name: string; role: string; value: string; type: string }
): Promise<{ ok: boolean; role: string; saved: string }> {
  const res = await fetch(`${API_BASE}/api/agent/media/map/${mapping_id}/dialog/confirm`, {
    method: "POST",
    headers: { ...(authHeaders() as Record<string, string>), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) throw new Error("ASCENDに再ログインしてください");
    throw new Error(data.detail || data.message || data.error || "保存失敗");
  }
  return data;
}

export async function previewDialogElement(
  mapping_id: string,
  body: { selector: string; navigate_url: string; operation_type: string }
): Promise<{ ok: boolean; screenshot_b64: string; element_found: boolean; element_tag: string; element_text: string }> {
  const res = await fetch(`${API_BASE}/api/agent/media/map/${mapping_id}/dialog/element_preview`, {
    method: "POST",
    headers: { ...(authHeaders() as Record<string, string>), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) throw new Error("ASCENDに再ログインしてください");
    throw new Error(data.detail || data.message || data.error || "プレビュー失敗");
  }
  return data;
}

export async function multiDeepScan(
  mapping_id: string
): Promise<{
  ok: boolean;
  operations_count: number;
  ready: string[];
  partial: string[];
  needs_mapping: string[];
  waiting: string[];
  failed: string[];
  results: {
    operation_type: string;
    status: string;
    missing: string[];
    target_url?: string;
    error_reason?: string;
  }[];
}> {
  const res = await fetch(`${API_BASE}/api/agent/media/map/${mapping_id}/multi_deep_scan`, {
    method: "POST",
    headers: authHeaders() as Record<string, string>,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) throw new Error("ASCENDに再ログインしてください");
    throw new Error(data.detail || data.message || data.error || "multi_deep_scan失敗");
  }
  return { ok: true, ...data };
}

export async function updateCapabilities(
  mapping_id: string,
  capabilities: Record<string, boolean>
): Promise<{ mapping_id: string; capabilities: Record<string, boolean>; status: string }> {
  const res = await fetch(`${API_BASE}/api/agent/media/map/${mapping_id}/capabilities`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
    body: JSON.stringify({ capabilities }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function htmlMenuImport(mappingId: string, sourceUrl: string, rawHtml: string) {
  const u = getStoredUser();
  const res = await fetch(`${API_BASE}/api/agent/media/map/${mappingId}/html_menu/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(u?.token ? { Authorization: `Bearer ${u.token}` } : {}) },
    body: JSON.stringify({ source_url: sourceUrl, raw_html: rawHtml }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
export async function getVerificationReviews(mappingId: string) {
  const u = getStoredUser();
  const res = await fetch(`${API_BASE}/api/agent/media/map/${mappingId}/verification_reviews`, {
    headers: { ...(u?.token ? { Authorization: `Bearer ${u.token}` } : {}) },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function updateBusinessConditions(
  mappingId: string,
  conditions: {
    site_purpose?: string;
    screening?: {
      height_min?: number | null;
      height_max?: number | null;
      weight_max?: number | null;
      cup_min?: string;
      tattoo_ok?: boolean;
      age_min?: number | null;
      age_max?: number | null;
      custom_conditions?: string;
      image_check?: boolean;
    };
    reply_policy?: {
      tone?: string;
      interview_info?: string;
      shop_conditions?: string;
    };
    offer_template?: string;
  }
): Promise<{ ok: boolean; mapping_id: string; business_conditions: Record<string, unknown> }> {
  const res = await fetch(`${API_BASE}/api/agent/media/map/${mappingId}/business_conditions`, {
    method: "PATCH",
    headers: { ...(authHeaders() as Record<string, string>), "Content-Type": "application/json" },
    body: JSON.stringify(conditions),
  });
  if (!res.ok) throw new Error((await res.json()).detail || "業務条件の保存に失敗しました");
  return res.json();
}

// ─── Step 3: recruit_conversations ───────────────────────────────────────

export interface RecruitConversation {
  conversation_id: string;
  mapping_id: string;
  tenant_id?: string;
  candidate_url: string;
  reply_url?: string;       // オファー送信後の会話スレッドURL（返信送信・受信監視に使用）
  candidate_name: string;
  phase: "offer_sent" | "waiting_reply" | "replied" | "interview_info_sent" | "scheduled" | "declined";
  messages: Array<{ role: "shop" | "candidate"; content: string; sent_at?: string }>;
  profile_data?: Record<string, unknown>;
  screening_pass?: boolean;
  screening_reason?: string;
  offer_sent_at?: string;
  created_at?: string;
  updated_at?: string;
  last_candidate_message?: string;
}

export async function listRecruitConversations(mappingId?: string): Promise<{
  conversations: RecruitConversation[];
  count: number;
}> {
  const params = mappingId ? `?mapping_id=${encodeURIComponent(mappingId)}` : "";
  const res = await fetch(`${API_BASE}/api/agent/recruit/conversations${params}`, {
    headers: authHeaders() as Record<string, string>,
  });
  if (!res.ok) throw new Error((await res.json()).detail || "会話一覧の取得に失敗しました");
  return res.json();
}

export async function generateRecruitReply(params: {
  conversation_id: string;
  new_message: string;
  instruction?: string;
  mapping_id?: string;
}): Promise<{
  generated_reply: string;
  current_phase: string;
  suggested_next_phase: string;
  conversation_id: string;
  candidate_name: string;
  note: string;
}> {
  const res = await fetch(
    `${API_BASE}/api/agent/recruit/conversations/${encodeURIComponent(params.conversation_id)}/reply/generate`,
    {
      method: "POST",
      headers: { ...(authHeaders() as Record<string, string>), "Content-Type": "application/json" },
      body: JSON.stringify({
        conversation_id: params.conversation_id,
        new_message: params.new_message,
        instruction: params.instruction || "",
        mapping_id: params.mapping_id || "",
      }),
    }
  );
  if (!res.ok) throw new Error((await res.json()).detail || "返信生成に失敗しました");
  return res.json();
}

export async function updateRecruitConversationPhase(
  conversationId: string,
  phase: string
): Promise<{ ok: boolean; conversation_id: string; phase: string }> {
  const res = await fetch(
    `${API_BASE}/api/agent/recruit/conversations/${encodeURIComponent(conversationId)}/phase?phase=${encodeURIComponent(phase)}`,
    {
      method: "PATCH",
      headers: authHeaders() as Record<string, string>,
    }
  );
  if (!res.ok) throw new Error((await res.json()).detail || "フェーズ更新に失敗しました");
  return res.json();
}

export async function patchOperationUrl(mappingId: string, operationType: string, targetUrl: string) {
  const u = getStoredUser();
  const res = await fetch(`${API_BASE}/api/agent/media/map/${mappingId}/operation_url`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...(u?.token ? { Authorization: `Bearer ${u.token}` } : {}) },
    body: JSON.stringify({ operation_type: operationType, target_url: targetUrl }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function manualPagesPreview(mappingId: string, pages: { title: string; url: string; html: string }[]) {
  const u = getStoredUser();
  const res = await fetch(`${API_BASE}/api/agent/media/map/${mappingId}/manual_pages/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(u?.token ? { Authorization: `Bearer ${u.token}` } : {}) },
    body: JSON.stringify({ pages }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function manualPagesImport(mappingId: string, pages: { title: string; url: string; html: string; op_type_override?: string }[]) {
  const u = getStoredUser();
  const res = await fetch(`${API_BASE}/api/agent/media/map/${mappingId}/manual_pages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(u?.token ? { Authorization: `Bearer ${u.token}` } : {}) },
    body: JSON.stringify({ pages }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function manualPageFetchAndPreview(mappingId: string, url: string, title: string, opTypeOverride?: string) {
  const u = getStoredUser();
  const res = await fetch(`${API_BASE}/api/agent/media/map/${mappingId}/manual_pages/fetch_and_preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(u?.token ? { Authorization: `Bearer ${u.token}` } : {}) },
    body: JSON.stringify({ url, title, op_type_override: opTypeOverride || "" }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function manualPageDelete(mappingId: string, pageId: string) {
  const u = getStoredUser();
  const res = await fetch(`${API_BASE}/api/agent/media/map/${mappingId}/manual_pages/${pageId}`, {
    method: "DELETE",
    headers: { ...(u?.token ? { Authorization: `Bearer ${u.token}` } : {}) },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function manualPageUpdateOpType(mappingId: string, pageId: string, opType: string) {
  const u = getStoredUser();
  const res = await fetch(`${API_BASE}/api/agent/media/map/${mappingId}/manual_pages/${pageId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...(u?.token ? { Authorization: `Bearer ${u.token}` } : {}) },
    body: JSON.stringify({ op_type: opType }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function menuItemDeepScan(mappingId: string, targetUrl: string, params?: { max_follow_per_url?: number }) {
  const u = getStoredUser();
  const res = await fetch(`${API_BASE}/api/agent/media/map/${mappingId}/menu_item/deep_scan`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(u?.token ? { Authorization: `Bearer ${u.token}` } : {}) },
    body: JSON.stringify({ target_url: targetUrl, max_follow_per_url: params?.max_follow_per_url ?? 50 }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function menuItemsDeepScan(mappingId: string, params?: { max_urls?: number; max_follow_per_url?: number; force_rescan?: boolean; offset?: number; chunk_size?: number }) {
  const u = getStoredUser();
  const res = await fetch(`${API_BASE}/api/agent/media/map/${mappingId}/menu_items/deep_scan`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(u?.token ? { Authorization: `Bearer ${u.token}` } : {}) },
    body: JSON.stringify({
      max_urls: params?.max_urls ?? 200,
      max_follow_per_url: params?.max_follow_per_url ?? 50,
      force_rescan: params?.force_rescan ?? true,
      offset: params?.offset ?? 0,
      chunk_size: params?.chunk_size ?? 2,
    }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function createMenuItemTask(
  mappingId: string,
  targetUrl: string,
  operationType: string,
  payload: Record<string, unknown> = {},
  scheduledAt?: string
): Promise<{ task_id: string; status: string; preview: AgentTask["preview"]; target_url: string; operation_type: string; step_count?: number }> {
  const u = getStoredUser();
  const res = await fetch(`${API_BASE}/api/agent/media/map/${mappingId}/menu_item/task/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(u?.token ? { Authorization: `Bearer ${u.token}` } : {}) },
    body: JSON.stringify({
      target_url: targetUrl,
      operation_type: operationType,
      payload,
      scheduled_at: scheduledAt,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = typeof data.detail === "string" ? data.detail : data.detail?.message;
    throw new Error(detail || "HTMLメニューURLのタスク作成に失敗しました");
  }
  return data;
}

// ── 外部LLM HTML解析 新設計 ────────────────────────────────────────────

export interface AiAnalysisResult {
  ok: boolean;
  from_cache: boolean;
  url_hash: string;
  page_type: string;
  confidence: number;
  site_purpose: string;
  login_selectors: Record<string, string>;
  operation_selectors: Record<string, string>;
  operation_steps: Array<{ step_id: string; step_type: string; selector_key: string; value: string | null; terminal: boolean }>;
  capabilities: Record<string, boolean>;
  analysis_notes: string;
  apply_result?: { ok: boolean; updated_fields: string[]; error?: string };
  error?: string;
}

/** HTMLを解析（mapping_idを指定すると即適用） */
export async function aiAnalyzeHtml(params: {
  rawHtml: string;
  pageUrl?: string;
  pageTypeHint?: string;
  mappingId?: string;
  forceReanalyze?: boolean;
}): Promise<AiAnalysisResult> {
  const res = await fetch(`${API_BASE}/api/agent/media/ai_analyze_html`, {
    ...fetchOptions("POST", JSON.stringify({
      raw_html:        params.rawHtml,
      page_url:        params.pageUrl || "",
      page_type_hint:  params.pageTypeHint || "auto",
      mapping_id:      params.mappingId || null,
      force_reanalyze: params.forceReanalyze ?? false,
    })),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || data.error || "HTML解析に失敗しました");
  return data;
}

/** mapping_id に対してHTMLを解析・適用 */
export async function aiSetupMapping(
  mappingId: string,
  params: { rawHtml: string; pageUrl?: string; pageTypeHint?: string; forceReanalyze?: boolean }
): Promise<AiAnalysisResult & { mapping_id: string; updated_fields: string[] }> {
  const res = await fetch(`${API_BASE}/api/agent/media/map/${mappingId}/ai_setup`, {
    ...fetchOptions("POST", JSON.stringify({
      raw_html:        params.rawHtml,
      page_url:        params.pageUrl || "",
      page_type_hint:  params.pageTypeHint || "auto",
      force_reanalyze: params.forceReanalyze ?? false,
    })),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || data.error || "AI解析適用に失敗しました");
  return data;
}

/** 複数ページを一括解析・適用 */
export async function aiSetupBatch(
  mappingId: string,
  pages: Array<{ rawHtml: string; pageUrl?: string; pageTypeHint?: string }>
): Promise<{ ok: boolean; mapping_id: string; results: Array<{ page_url: string; page_type: string; confidence: number; ok: boolean; updated_fields: string[]; from_cache: boolean; error?: string }>; ready_ops: string[]; summary: { total: number; success: number; cached: number } }> {
  const res = await fetch(`${API_BASE}/api/agent/media/map/${mappingId}/ai_setup_batch`, {
    ...fetchOptions("POST", JSON.stringify({
      pages: pages.map(p => ({
        raw_html:       p.rawHtml,
        page_url:       p.pageUrl || "",
        page_type_hint: p.pageTypeHint || "auto",
      })),
    })),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || data.error || "一括解析に失敗しました");
  return data;
}

/** URLのキャッシュ解析が存在するか確認 */
export async function checkHtmlCache(url: string): Promise<{
  exists: boolean; url_hash: string; url: string;
  page_type?: string; confidence?: number; site_purpose?: string;
  capabilities?: Record<string, boolean>; ready_ops?: string[];
}> {
  const res = await fetch(
    `${API_BASE}/api/agent/media/html_cache/check?url=${encodeURIComponent(url)}`,
    fetchOptions("GET")
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || "キャッシュ確認に失敗しました");
  return data;
}

/** 共有キャッシュをmappingに即適用（他テナントが解析済みの場合） */
export async function aiCloneFromCache(mappingId: string): Promise<{
  ok: boolean; mapping_id?: string; ready_ops?: string[]; message?: string; reason?: string;
}> {
  const res = await fetch(`${API_BASE}/api/agent/media/map/${mappingId}/ai_clone_from_cache`, {
    ...fetchOptions("POST", "{}"),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || "キャッシュ適用に失敗しました");
  return data;
}

/**
 * 新設計: Playwright クロール → Gemini 解析 → AI_CONFIRMED で保存
 * runInBg=true (デフォルト): バックグラウンド実行（即レスポンス）
 * runInBg=false: 同期実行（完了まで待つ。デバッグ・強制再解析用）
 */
export async function autoSetupMapping(
  mappingId: string,
  options: { runInBg?: boolean } = {}
): Promise<{
  ok: boolean;
  status: string;
  message?: string;
  ready_ops?: string[];
  failed_ops?: string[];
  cache_saved?: boolean;
  pages_scanned?: number;
  mapping_id: string;
}> {
  const res = await fetch(`${API_BASE}/api/agent/media/map/${mappingId}/auto_setup`, {
    ...fetchOptions("POST", JSON.stringify({ run_in_bg: options.runInBg ?? true })),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || data.error || "自動セットアップに失敗しました");
  return data;
}
