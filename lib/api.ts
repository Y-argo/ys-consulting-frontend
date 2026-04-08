// lib/api.ts
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || "";

function getToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("ascend_token") || "";
}

function authHeaders(): HeadersInit {
  const token = getToken();
  return token
    ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
    : { "Content-Type": "application/json" };
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
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const detail = err.detail || "ログインに失敗しました";
    if (detail === "EXPIRED") throw new Error("EXPIRED");
    throw new Error(detail);
  }
  const data: LoginResult = await res.json();
  localStorage.setItem("ascend_token", data.token);
  localStorage.setItem("ascend_uid", data.uid);
  localStorage.setItem("ascend_role", data.role);
  localStorage.setItem("ascend_tenant", data.tenant_id);
  return data;
}

export function logout(): void {
  localStorage.removeItem("ascend_token");
  localStorage.removeItem("ascend_uid");
  localStorage.removeItem("ascend_role");
  localStorage.removeItem("ascend_tenant");
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
  structured?: {
    summary: string;
    cards: { current: string[]; risk: string[]; plan: string[] };
    analysis: { type: string; urgency: string; importance: string; mode: string };
    actions: string[];
    value_message: string;
  };
}

export interface SendResult {
  reply: string;
  chat_id: string;
  msg_id: string;
  cases?: string[];
  images?: {mime_type:string; data:string}[];
  structured?: {
    summary: string;
    cards: { current: string[]; risk: string[]; plan: string[] };
    analysis: { type: string; urgency: string; importance: string; mode: string };
    actions: string[];
    value_message: string;
  };
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
      image_generation: true,
      personal_consulting: true,
      current_issue_diagnosis: true,
      decision_metrics: true,
      fixed_concept_report: true,
      ascend_ultra: false,
      ascend_apex: false,
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
}

export async function getUserStats(): Promise<UserStats | null> {
  const res = await fetch(`${API_BASE}/api/user/stats`, { headers: authHeaders() });
  if (!res.ok) return null;
  return res.json();
}

export async function getUsageLogs(): Promise<{prompt: string; timestamp: string}[]> {
  const res = await fetch(`${API_BASE}/api/user/usage_logs`, { headers: authHeaders() });
  if (!res.ok) return [];
  const data = await res.json();
  return data.logs || [];
}

export async function deleteSession(chat_id: string): Promise<void> {
  await fetch(`${API_BASE}/api/user/session/${chat_id}`, { method: "DELETE", headers: authHeaders() });
}

export async function renameSession(chat_id: string, title: string): Promise<void> {
  await fetch(`${API_BASE}/api/user/session/${chat_id}/rename`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ title }),
  });
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
    if (!res.ok) { const err = await res.json().catch(()=>({})); throw new Error(err.detail||"画像送信失敗"); }
    return res.json();
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
