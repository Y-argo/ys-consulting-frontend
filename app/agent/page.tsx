"use client";
import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  getStoredUser, listAgentTasks, approveAgentTask, rejectAgentTask, deleteAgentTask, executeAgentTask, createAgentTask, planAgentTask, createAgentTaskFromInstruction, listAgentLogs,
  listAgentTaskBatches, createAgentTaskBatch, approveAgentTaskBatch, executeAgentTaskBatch,
  listCrossMediaTasks, createCrossMediaTask, previewCrossMedia, deleteCrossMediaTask, fetchCrossMediaSourceEntities, fetchCrossMediaSnapshot,
  listMediaMappings, createMediaMapping, deleteMediaMapping, loginCheckMediaMapping, saveMediaCredential, updateMediaSelectors, applySelectorRepair, applyCapabilities, updateCapabilities, recomputeLearningHealth, applySemanticSelector, recomputeSelectorRanking, deepScanOperation, multiDeepScan, getMediaMenuScanItems,
  menuItemsDeepScan, createMenuItemTask, getMediaMappingSchema,
  listAgentSchedules, createAgentSchedule, updateAgentSchedule,
  listAgentOps, planAgentGoal,
  AgentTask, AgentLog, AgentTaskBatch, CrossMediaTask, MediaMapping, AgentSchedule, AgentOp,
  AgentGoalPlan,
  WorkflowSession, approveWorkflowSession, rejectWorkflowSession, pauseWorkflowSession, resumeWorkflowSession, cancelWorkflowSession, getWorkflowSession, listWorkflowSessions, createWorkflowSession, scanMediaDom,
  getSitePreview, previewPublicUrl, SitePreviewResult, getFormSnapshot, FormElement, formFill, FormFillResult,
  generateProfilePreview, getMonitoringResults,
  recruitGenerate,
  type MonitoringResult,
} from "@/lib/api";
import { htmlMenuImport, getVerificationReviews, patchOperationUrl, manualPagesImport, manualPagesPreview, manualPageDelete, manualPageFetchAndPreview, updateBusinessConditions, listRecruitConversations, generateRecruitReply, updateRecruitConversationPhase, scanOperationDialog, confirmDialogStep, previewDialogElement, autoDiscoverMenu, addMenuItem, autoSetupMapping } from "@/lib/api";
import type { MediaSchemaResponse, MediaMenuItemsResponse, RecruitConversation, DialogStep, DialogCandidate } from "@/lib/api";

type PayloadField = {
  key: string;
  label: string;
  type: "text" | "textarea" | "select" | "file" | "datetime" | "number" | "boolean";
  required: boolean;
  options?: string[];
};
type MappingPayloadField = {
  selector?: string;
  label?: string;
  name?: string;
  id?: string;
  key?: string;
  type?: string;
  required?: boolean;
  canonical?: string;
  options?: string[];
  placeholder?: string;
  value?: string;
  source?: string;
};
type CrossPreviewResult = {
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
  known_mapped_fields?: MappingPayloadField[];
  mapped_count: number;
  source_data_keys: string[];
  error?: string;
};
type OpWithSchema = AgentOp;
type MenuItemOperationResult = {
  op?: string;
  status?: string;
  target_url?: string;
  missing?: string[];
  steps?: number;
  step_count?: number;
};
type MenuScanSummary = {
  total?: number;
  ready?: number;
  needs_review?: number;
  no_editable_dom?: number;
  no_operation?: number;
  failed?: number;
  scanned?: number;
  unknown?: number;
  unscanned?: number;
  ready_or_review?: number;
  action_required?: number;
  non_actionable?: number;
  completed?: boolean;
  health_status?: string;
  top_stop_stages?: Array<{ stage?: string; count?: number }>;
  top_stop_reasons?: Array<{ reason?: string; count?: number }>;
};
type MenuItemScanResult = {
  url: string;
  canonical_url?: string;
  title?: string;
  category?: string;
  status?: string;
  message?: string;
  updated_ops?: MenuItemOperationResult[];
  operations?: Record<string, MenuItemOperationResult>;
  diagnostics?: {
    stop_stage?: string;
    stop_reason?: string;
    followed_count?: number;
    followed_urls?: string[];
    inspected_urls?: string[];
    page_evidence?: Array<Record<string, unknown>>;
    operation_results?: Array<Record<string, unknown>>;
  };
};
type MenuDisplayItem = {
  label: string;
  url: string;
  category: string;
  status?: string;
  message?: string;
  productionReady?: boolean;
  confirmed?: boolean;
  candidateOnly?: boolean;
  source: "deep_scan" | "manual";
};
type HealthFinding = {
  id: string;
  severity: "critical" | "warning" | "pending" | "info";
  source: "mapping" | "deep_scan" | "log";
  title: string;
  detail: string;
  action: string;
  tab: Tab;
};

const INDUSTRY_TEMPLATES_UI: Record<string, {label: string; entity: string; schedule: string; news: string; media: string}> = {
  nightlife:  { label: "夜職・風俗",                  entity: "キャスト",     schedule: "出勤",         news: "ニュース",     media: "写真" },
  beauty:     { label: "美容・エステ",                 entity: "スタッフ",     schedule: "予約枠",       news: "キャンペーン", media: "スタッフ写真" },
  retail:     { label: "小売・EC",                     entity: "商品",         schedule: "営業時間",     news: "お知らせ",     media: "商品写真" },
  realestate: { label: "不動産",                       entity: "物件",         schedule: "空室状況",     news: "新着物件",     media: "物件写真" },
  btob:       { label: "BtoB・士業",                   entity: "サービス",     schedule: "セミナー",     news: "ニュース",     media: "資料" },
  fitness:    { label: "フィットネス・スポーツ",       entity: "講師",         schedule: "レッスン",     news: "キャンペーン", media: "講師写真" },
  other:      { label: "その他",                       entity: "エンティティ", schedule: "スケジュール", news: "お知らせ",     media: "メディア" },
};

const normalizeIndustryKey = (industry?: string): string => {
  if (industry === "real_estate") return "realestate";
  if (industry === "b2b") return "btob";
  return industry || "other";
};

const normalizePayloadFieldType = (type?: string): PayloadField["type"] => {
  const t = (type || "").toLowerCase();
  if (t === "textarea") return "textarea";
  if (t === "select") return "select";
  if (t === "number" || t === "range") return "number";
  if (t === "checkbox" || t === "radio" || t === "boolean") return "boolean";
  if (t === "datetime" || t === "datetime-local" || t === "date" || t === "time") return "datetime";
  if (t === "file") return "file";
  return "text";
};

const CONTROL_FIELD_TYPES = new Set(["hidden", "password", "submit", "button", "reset", "image"]);
const CONTROL_FIELD_KEYWORDS = [
  "login", "signin", "sign_in", "ログイン", "管理者id", "管理者", "admin",
  "password", "passwd", "pass", "パスワード",
  "hidden", "(hidden)", "csrf", "_token", "token", "nonce",
  "submit", "send", "送信", "保存する", "ログインid/パスワードを保存する",
  "remember", "button", "open_field", "select_girl_review",
  "sort", "ソート", "削除", "delete", "戻る", "back", "確認",
];

const fieldTextBlob = (field: Partial<MappingPayloadField>): string => [
  field.label, field.name, field.id, field.key, field.canonical, field.selector, field.placeholder,
].map(v => String(v || "")).join(" ").trim().toLowerCase();

const isActionableMappingField = (field: Partial<MappingPayloadField>): boolean => {
  const type = String(field.type || "text").toLowerCase();
  if (CONTROL_FIELD_TYPES.has(type)) return false;
  const blob = fieldTextBlob(field);
  if (!blob) return false;
  if (blob.includes("input[type=password]") || blob.includes("type='password'") || blob.includes("type=\"password\"")) return false;
  return !CONTROL_FIELD_KEYWORDS.some(keyword => blob.includes(keyword));
};

const CONFIRMED_OPERATION_SOURCES = new Set(["AI_CONFIRMED", "TASK_OVERRIDE"]);

const isConfirmedOperationMapping = (opMap?: {
  status?: string;
  executable?: boolean;
  source?: string;
  confirmed?: boolean;
  user_confirmed?: boolean;
  production_ready?: boolean;
  confirmation_status?: string;
} | null): boolean => {
  if (!opMap) return false;
  if (opMap.production_ready === true) return true;
  const status = String(opMap.confirmation_status || "");
  if (status === "AI_CONFIRMED") return true;
  return CONFIRMED_OPERATION_SOURCES.has(String(opMap.source || ""));
};

const isProductionReadyOperationMapping = (opMap?: {
  status?: string;
  executable?: boolean;
  source?: string;
  confirmed?: boolean;
  user_confirmed?: boolean;
  production_ready?: boolean;
  confirmation_status?: string;
} | null): boolean => {
  return !!opMap && opMap.status === "READY" && opMap.executable === true && isConfirmedOperationMapping(opMap);
};

const mappedFieldsForOperation = (m: MediaMapping | null | undefined, op: string): MappingPayloadField[] => {
  if (!m || !op) return [];
  const out: MappingPayloadField[] = [];
  const seen = new Set<string>();
  const add = (fields: MappingPayloadField[] | undefined, source: string) => {
    (fields || []).forEach((field, index) => {
      if (!isActionableMappingField(field)) return;
      const key = [field.selector, field.canonical, field.name, field.id, field.label].map(v => String(v || "").trim()).join("|");
      if (!key.trim() || seen.has(key)) return;
      seen.add(key);
      out.push({ ...field, source: field.source || source });
    });
  };
  const opMap = m.operation_mappings?.[op];
  if (isConfirmedOperationMapping(opMap)) {
    add(opMap?.fields as MappingPayloadField[] | undefined, "operation_mappings");
    add(opMap?.form_schema?.fields as MappingPayloadField[] | undefined, "operation_mappings");
  }
  return out;
};

const labelForMappingField = (field: MappingPayloadField): string => {
  return (field.label || field.name || field.canonical || field.id || field.selector || "").trim();
};

const sanitizePayloadKey = (raw: string, fallback: string, used: Set<string>): string => {
  let key = (raw || fallback || "field").replace(/[^0-9A-Za-z_-]+/g, "_").replace(/^_+|_+$/g, "");
  if (!key) key = fallback || "field";
  let uniq = key.slice(0, 80);
  let n = 2;
  while (used.has(uniq)) {
    uniq = `${key.slice(0, 70)}_${n}`;
    n += 1;
  }
  used.add(uniq);
  return uniq;
};

const payloadFieldsForOperation = (m: MediaMapping | null | undefined, op: string, opDef?: OpWithSchema): PayloadField[] => {
  const used = new Set<string>();
  const fields: PayloadField[] = [];
  (opDef?.payload_schema?.fields || []).forEach(field => {
    if (!field?.key || used.has(field.key)) return;
    used.add(field.key);
    fields.push(field);
  });
  mappedFieldsForOperation(m, op).forEach((field, index) => {
    const tail = (field.canonical || "").split(".").pop() || "";
    const rawKey = field.key || tail || field.name || field.id || `field_${index}`;
    const key = sanitizePayloadKey(String(rawKey), `field_${index}`, used);
    fields.push({
      key,
      label: field.label || field.name || field.canonical || field.id || key,
      type: normalizePayloadFieldType(field.type),
      required: !!field.required,
      options: field.options,
    });
  });
  return fields;
};

const serializePayloadValueForInput = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  if (Array.isArray(value)) return value.map(v => String(v ?? "")).filter(Boolean).join("\n");
  return String(value);
};

const seedValuesForPayloadFields = (fields: PayloadField[], payload?: Record<string, unknown>): Record<string, string> => {
  const next: Record<string, string> = {};
  fields.forEach(field => {
    if (!payload || !(field.key in payload)) return;
    next[field.key] = serializePayloadValueForInput(payload[field.key]);
  });
  return next;
};

const hasMappedOperationUrl = (m: MediaMapping | null | undefined, op: string): boolean => {
  if (!m || !op) return false;
  const opMap = m.operation_mappings?.[op];
  const opUrl = isConfirmedOperationMapping(opMap) ? (opMap?.target_url || "").trim() : "";
  return !!opUrl;
};

const isRecruitMapping = (m: MediaMapping | null | undefined): boolean => {
  if (!m) return false;
  const purpose = m.business_conditions?.site_purpose || "";
  if (purpose === "scout" || purpose === "reply") return true;
  const blob = `${m.media_name || ""} ${m.media_url || ""} ${m.login_url || ""}`.toLowerCase();
  return /求人|応募|スカウト|候補者|面接|recruit|scout|candidate|applicant/.test(blob);
};

const mappedFieldLabelsForOperation = (maps: MediaMapping[], op: string): string[] => {
  const labels = new Set<string>();
  maps.forEach(m => {
    mappedFieldsForOperation(m, op).forEach(field => {
      const label = labelForMappingField(field);
      if (label) labels.add(label);
    });
  });
  return Array.from(labels).slice(0, 200);
};

const parseUrlList = (raw: string): string[] => {
  const seen = new Set<string>();
  return String(raw || "")
    .replace(/,/g, "\n")
    .split(/\n+/)
    .map(x => x.trim())
    .filter(x => x.startsWith("http://") || x.startsWith("https://"))
    .filter(x => {
      if (seen.has(x)) return false;
      seen.add(x);
      return true;
    });
};

const monitorTargetsForMapping = (m: MediaMapping | null | undefined): Array<{label: string; url: string; source: string}> => {
  if (!m) return [];
  const rows: Array<{label: string; url: string; source: string}> = [];
  const add = (label: string, url?: string | null, source = "") => {
    const u = String(url || "").trim();
    if (!u || rows.some(row => row.url === u)) return;
    rows.push({ label: label || u, url: u, source });
  };
  if (isProductionReadyOperationMapping(m.operation_mappings?.page_monitor)) {
    add(m.operation_mappings?.page_monitor?.manual_title || "AI整備済み監視ページ", m.operation_mappings?.page_monitor?.target_url, "AI整備済み");
  }
  add("媒体URL", m.media_url, "media_url");
  return rows;
};

const selectableLabelsForCrossPreview = (res: CrossPreviewResult): string[] => {
  const labels = new Set<string>();
  (res.mapping_detail || []).forEach(d => {
    const key = (d.label || d.name || "").trim();
    if (key && isActionableMappingField({ label: key, name: d.name })) labels.add(key);
  });
  (res.known_mapped_fields || []).forEach(f => {
    if (!isActionableMappingField(f)) return;
    const key = labelForMappingField(f);
    if (key) labels.add(key);
  });
  return Array.from(labels);
};

// site_purpose ごとの推奨 operation_type（完全連動用）
const SITE_PURPOSE_OPS: Record<string, string[]> = {
  scout:   ["offer_send", "recruit_inbox_scan", "recruit_reply"],
  reply:   ["recruit_inbox_scan", "recruit_reply", "page_monitor"],
  post:    ["blog_post", "news_post", "text_update", "entity_register", "entity_update"],
  monitor: ["page_monitor", "recruit_inbox_scan", "post_monitoring"],
  other:   ["news_post", "blog_post", "text_update", "entity_register", "entity_update", "page_monitor"],
};

const SITE_PURPOSE_QUICK: Record<string, Array<{op: string; label: string; note: string}>> = {
  scout: [
    {op: "offer_send",         label: "🎯 スカウト精査＋オファー",   note: "候補者をAI精査してオファー一括送信"},
    {op: "recruit_inbox_scan", label: "📬 受信ボックスをスキャン",    note: "候補者の返信を確認して会話スレッド更新"},
    {op: "recruit_reply",      label: "💬 返信を送信",               note: "会話スレッドに返信"},
  ],
  reply: [
    {op: "recruit_inbox_scan", label: "📬 応募受信を確認",   note: "応募者からの新着メッセージを受信ボックスで確認"},
    {op: "recruit_reply",      label: "💬 応募者に返信",     note: "応募者の会話スレッドに返信を送信"},
    {op: "page_monitor",       label: "👁 受信状況を確認",   note: "受信ページの状況を確認"},
  ],
  post: [
    {op: "blog_post",       label: "📝 ブログを投稿",   note: "スタッフブログ・日記を投稿"},
    {op: "news_post",       label: "📰 ニュースを投稿", note: "お知らせを投稿"},
    {op: "text_update",     label: "✏️ 情報を更新",     note: "テキスト・プロフィールを更新"},
  ],
  monitor: [
    {op: "page_monitor",       label: "👁 ページを監視",       note: "投稿状況・更新頻度を確認"},
    {op: "recruit_inbox_scan", label: "📬 求人受信を確認",     note: "求人受信ボックスをスキャン"},
  ],
};

const SITE_PURPOSE_LABEL: Record<string, string> = {
  scout: "🎯 スカウト型", reply: "💬 返信型", post: "📝 投稿型", monitor: "👁 監視型", other: "その他",
};

const SITE_PURPOSE_COLOR: Record<string, {bg: string; border: string; text: string}> = {
  scout:   {bg: "#fef3c7", border: "#fde68a", text: "#92400e"},
  reply:   {bg: "#eff6ff", border: "#bfdbfe", text: "#1d4ed8"},
  post:    {bg: "#f0fdf4", border: "#bbf7d0", text: "#15803d"},
  monitor: {bg: "#f5f3ff", border: "#ddd6fe", text: "#4c1d95"},
};

const ABSTRACT_TASK_OPTIONS = [
  "情報登録", "情報更新", "画像・資料差し替え", "スケジュール更新",
  "料金更新", "ニュース投稿", "ステータス更新", "更新監査", "差分検知",
];
const INDUSTRY_TASK_OPTIONS: Record<string, string[]> = {
  nightlife:  ABSTRACT_TASK_OPTIONS,
  beauty:     ABSTRACT_TASK_OPTIONS,
  realestate: ABSTRACT_TASK_OPTIONS,
  retail:     ABSTRACT_TASK_OPTIONS,
  btob:       ABSTRACT_TASK_OPTIONS,
  fitness:    ABSTRACT_TASK_OPTIONS,
  other:      ABSTRACT_TASK_OPTIONS,
};

const STATUS_LABEL: Record<string, string> = {
  PENDING:         "承認待ち",
  APPROVED:        "実行待ち",
  RUNNING:         "実行中",
  DONE:            "完了",
  REJECTED:        "却下",
  FAILED:          "失敗",
  CREATED:         "作成済み",
  PARTIAL:         "一部完了",
  SKIPPED:         "スキップ",
  NEEDS_REVIEW:    "要確認",
  UNDISCOVERED:    "未解析",
  WAITING_MAPPING: "AI解析中（初回）",
  WAITING_EXECUTOR:"自動実行未対応",
  BLOCKED:         "情報不足",
  CANCELLED:       "キャンセル",
  TIMEOUT:         "タイムアウト",
};
const STATUS_COLOR: Record<string, string> = {
  PENDING:         "#b87d00",
  APPROVED:        "#1a6fa8",
  RUNNING:         "#7c3aed",
  DONE:            "#15803d",
  REJECTED:        "#6b7280",
  FAILED:          "#b91c1c",
  CREATED:         "#374151",
  PARTIAL:         "#0369a1",
  SKIPPED:         "#6b7280",
  NEEDS_REVIEW:    "#b45309",
  UNDISCOVERED:    "#9ca3af",
  WAITING_MAPPING: "#0369a1",
  WAITING_EXECUTOR:"#7c3aed",
  BLOCKED:         "#b91c1c",
  CANCELLED:       "#6b7280",
  TIMEOUT:         "#b91c1c",
};
const STATUS_BG: Record<string, string> = {
  PENDING:         "#fef9c3",
  APPROVED:        "#dbeafe",
  RUNNING:         "#f5f3ff",
  DONE:            "#dcfce7",
  REJECTED:        "#f3f4f6",
  FAILED:          "#fee2e2",
  CREATED:         "#f9fafb",
  PARTIAL:         "#e0f2fe",
  SKIPPED:         "#f3f4f6",
  NEEDS_REVIEW:    "#fffbeb",
  UNDISCOVERED:    "#f9fafb",
  WAITING_MAPPING: "#e0f2fe",
  WAITING_EXECUTOR:"#f5f3ff",
  BLOCKED:         "#fee2e2",
  CANCELLED:       "#f3f4f6",
  TIMEOUT:         "#fee2e2",
};
const OP_LABEL: Record<string, string> = {
  entity_register:    "情報登録",
  entity_update:      "情報更新",
  profile_update:     "プロフィール詳細更新",
  media_replace:      "メイン画像差替",
  gallery_add:        "ギャラリー追加",
  text_update:        "テキスト更新",
  blog_post:          "店長ブログ",
  schedule_update:    "スケジュール更新",
  price_update:       "料金更新",
  news_post:          "ニュース投稿",
  status_update:      "ステータス更新",
  post_monitoring:    "投稿数監視",
  interview_assist:   "面接メモ作成",
  page_monitor:       "ページ監視",
  offer_send:         "スカウト精査＋オファー送信",
  recruit_inbox_scan: "受信ボックス監視",
  recruit_reply:      "候補者へ返信",
};

const OP_HELP: Record<string, string> = {
  entity_register: "新しい情報を登録します。",
  entity_update: "既存情報を更新します。",
  media_replace: "画像や資料を差し替えます。",
  text_update: "説明文や本文を更新します。",
  schedule_update: "予定やシフトなどの表示を更新します。",
  price_update: "料金表示を更新します。",
  news_post: "お知らせやニュース本文を投稿します。",
  blog_post: "求人サイトの店長ブログを投稿します（写メ日記はキャスト専用のため対象外）。",
  post_monitoring: "投稿数、未投稿、競合・市場の動きを確認します。",
  interview_assist: "面接を自動化する機能ではありません。質問案、評価軸、判断メモを作成します。",
};

const MENU_ITEM_PAYLOAD_TEMPLATE: Record<string, Record<string, string>> = {
  news_post: { title: "", body: "" },
  blog_post: { title: "", body: "" },
  text_update: { text: "" },
  status_update: { body: "" },
  media_replace: { file_path: "" },
  schedule_update: { schedule_value: "" },
  price_update: { price_value: "" },
  entity_register: { name: "" },
  entity_update: { value: "" },
};

function cronToJa(cron: string): string {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return cron;
  const [min, hour, , , dow] = parts;
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  if (dow === "*") return `毎日 ${hour.padStart(2,"0")}:${min.padStart(2,"0")}`;
  const d = parseInt(dow);
  if (!isNaN(d) && d >= 0 && d <= 6) return `毎週 ${days[d]}曜 ${hour.padStart(2,"0")}:${min.padStart(2,"0")}`;
  return cron;
}

function timestampMs(value?: string | null): number {
  if (!value) return 0;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function sortTasksNewest(items: AgentTask[] = []): AgentTask[] {
  return [...items].sort((a, b) => timestampMs(b.created_at) - timestampMs(a.created_at));
}

function sortLogsNewest(items: AgentLog[] = []): AgentLog[] {
  return [...items].sort((a, b) => timestampMs(b.executed_at) - timestampMs(a.executed_at));
}

function sortCreatedNewest<T extends { created_at?: string }>(items: T[] = []): T[] {
  return [...items].sort((a, b) => timestampMs(b.created_at) - timestampMs(a.created_at));
}

function taskSummary(t: AgentTask): string {
  const op = t.operation_type || "";
  if (op === "interview_assist") {
    const role = typeof t.payload?.role_name === "string" && t.payload.role_name ? `（${t.payload.role_name}）` : "";
    return `面接で使う質問案・評価軸・判断メモを作成します${role}。面接そのものを自動実施するものではありません。`;
  }
  if (op === "post_monitoring") {
    const target = typeof t.payload?.monitoring_target === "string" && t.payload.monitoring_target ? ` 対象: ${t.payload.monitoring_target}` : "";
    return `投稿数、未投稿、競合・市場キーワードを確認します。${target}`;
  }
  const raw = t.preview?.summary || "";
  if (raw && !raw.includes("_") && !raw.includes("エンティティの")) return raw;
  return `${OP_LABEL[op] || "選択した操作"}の内容を確認し、承認後に実行します。`;
}

function translateError(msg: string): string {
  if (!msg) return "";
  if (msg.includes("credential_secret_name") || msg.includes("credential未設定")) return "ログイン情報が未登録です";
  if (msg.includes("PLAYWRIGHT_ENABLED") || msg.includes("playwright")) return "PLAYWRIGHT_ENABLEDがfalseです。ブラウザ実行が無効になっています";
  if (msg.includes("Secret Manager") || msg.includes("secret")) return "Secret Manager取得に失敗しました。credential_secret_nameを確認してください";
  if (msg.includes("ログイン用セレクターが不足") || msg.includes("selector not found") || msg.includes("ログインフォーム設定") || msg.includes("セレクター") || msg.includes("不足しています")) return "ログインフォーム設定が未登録または不正です（ID/PASSの問題ではありません）";
  if (msg.includes("verify_selector")) return "ログイン情報の送信は完了しましたが、ログイン後の目印が見つかりませんでした。『ログイン後だけ表示される目印』を空欄にして再確認するか、ログイン後だけ表示されるメニューを指定してください。";
  if (msg.includes("selector")) return "サイト構造が変更された可能性があります。自動解析を再実行してください";
  if (msg.includes("login") || msg.includes("ログイン失敗")) return "ログインに失敗しました。ID・パスワードを確認してください";
  if (msg.includes("timeout")) return "接続タイムアウトが発生しました。login_urlを確認してください";
  if (msg.includes("mapping")) return "媒体基盤設定が見つかりません";
  return msg;
}

type ErrorDetail = { error_type: string; message: string; action: string };

function parseErrorDetail(msg: string): ErrorDetail {
  if (!msg) return { error_type: "UNKNOWN", message: "不明なエラーが発生しました", action: "管理者にお問い合わせください" };
  if (msg.includes("credential_secret_name") || msg.includes("credential未設定"))
    return { error_type: "CREDENTIAL_MISSING", message: "credential_secret_nameが未設定です", action: "① 媒体基盤 → ログイン情報登録で設定してください" };
  if (msg.includes("PLAYWRIGHT_ENABLED") || msg.includes("playwright"))
    return { error_type: "PLAYWRIGHT_DISABLED", message: "PLAYWRIGHT_ENABLEDがfalseです", action: "管理者にブラウザ実行の有効化を依頼してください" };
  if (msg.includes("再登録が必要") || msg.includes("下のフォームからID") || msg.includes("Secret Managerに見つかりません") || msg.includes("再度ID/パスワードを入力してください"))
    return { error_type: "CREDENTIAL_REREGISTER", message: "ログイン情報の再登録が必要です", action: "↓ 下の入力欄から ID・パスワードを入力してください" };
  if (msg.includes("Secret Manager") || msg.includes("secret"))
    return { error_type: "SECRET_FETCH_FAILED", message: "Secret Manager取得に失敗しました", action: "credential_secret_nameが正しいか確認してください" };
  if (msg.includes("verify_selector"))
    return { error_type: "VERIFY_SELECTOR_MISMATCH", message: "ログイン後の確認位置が一致しません", action: "ログイン後だけ表示される目印を空欄にして再確認してください" };
  if (msg.includes("selector not found") || msg.includes("ログイン用セレクターが不足") || msg.includes("セレクター") || msg.includes("不足しています"))
    return { error_type: "SELECTOR_MISSING", message: "ログインID入力欄が見つかりません", action: "サイト構造を自動解析して入力欄を検出してください" };
  if (msg.includes("selector"))
    return { error_type: "SELECTOR_BROKEN", message: "入力欄が見つかりません（サイト構造変更の可能性）", action: "サイト構造を自動解析して修復候補を確認してください" };
  if (msg.includes("login") || msg.includes("ログイン失敗"))
    return { error_type: "LOGIN_FAILED", message: "ログインに失敗しました", action: "ID・パスワードが正しいか確認してください" };
  if (msg.includes("timeout"))
    return { error_type: "TIMEOUT", message: "接続タイムアウトが発生しました", action: "login_urlが正しいか確認してください" };
  if (msg.includes("mapping"))
    return { error_type: "MAPPING_NOT_FOUND", message: "媒体基盤設定が見つかりません", action: "① 媒体基盤で媒体を再登録してください" };
  return { error_type: "UNKNOWN", message: msg, action: "内容を確認して再試行してください" };
}

function ErrorCard({ msg }: { msg: string }) {
  const d = parseErrorDetail(msg);
  return (
    <div style={{ padding: "10px 14px", borderRadius: 8, background: "#b91c1c11", border: "1px solid #b91c1c44", fontSize: 12 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
        <span style={{ fontWeight: 700, color: "#b91c1c", fontFamily: "monospace", fontSize: 11 }}>[{d.error_type}]</span>
      </div>
      <div style={{ color: "#b91c1c", fontWeight: 600, marginBottom: 4 }}>&#x274C; {d.message}</div>
      <div style={{ color: "#7c3aed", fontSize: 11 }}>&#x1F449; {d.action}</div>
    </div>
  );
}


type Tab = "command" | "sites" | "cross" | "monitoring" | "interview" | "create" | "tasks" | "batch" | "schedule" | "logs" | "health";
const AGENT_TABS: Tab[] = ["command", "sites", "cross", "monitoring", "interview", "create", "tasks", "batch", "schedule", "logs", "health"];

function menuLabelFromUrl(raw: string): string {
  try {
    const url = new URL(raw);
    const pathPart = url.pathname.split("/").filter(Boolean).pop() || "";
    const cleaned = decodeURIComponent(pathPart.replace(/\.[^./?]+$/, "").replace(/[-_]+/g, " ")).trim();
    if (cleaned) return cleaned;
  } catch {
    // noop
  }
  return raw.length > 40 ? `...${raw.slice(-40)}` : raw;
}

function bestMenuLabel(rawLabel: string, rawUrl: string): string {
  const label = (rawLabel || "").trim();
  if (!label) return menuLabelFromUrl(rawUrl);
  if (label === rawUrl || label.startsWith("http")) return menuLabelFromUrl(rawUrl);
  if ((label.includes("?") && label.includes("=")) || /[A-Za-z0-9_-]{25,}/.test(label)) return menuLabelFromUrl(rawUrl);
  return label;
}

function normalizeMenuUrl(raw: string): string {
  try {
    const url = new URL(raw);
    url.searchParams.delete("entry_sid");
    url.searchParams.delete("entry_time");
    url.hash = "";
    return url.toString();
  } catch {
    return raw;
  }
}

function menuScopeRoot(pathname: string): string {
  const clean = pathname || "/";
  const parts = clean.split("/").filter(Boolean);
  if (parts.length === 0) return "/";
  const first = parts[0];
  if (first.includes(".")) return "/";
  return `/${first}/`;
}

function isMenuUrlInMappingScope(m: MediaMapping, rawUrl: string): boolean {
  try {
    const target = new URL(rawUrl);
    const bases = [m.media_url, m.login_url].filter(Boolean) as string[];
    if (bases.length === 0) return true;
    return bases.some(baseRaw => {
      try {
        const base = new URL(baseRaw);
        const targetHost = target.hostname.toLowerCase();
        const baseHost = base.hostname.toLowerCase();
        if (!(targetHost === baseHost || targetHost.endsWith(`.${baseHost}`))) return false;
        const root = menuScopeRoot(base.pathname);
        if (root === "/") return true;
        return target.pathname === root.slice(0, -1) || target.pathname.startsWith(root);
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

function adjustedMenuStatus(item: Record<string, unknown>): string {
  const status = String(item.status || "");
  const diag = item.diagnostics as { editable_pages_count?: number; page_evidence?: Array<Record<string, unknown>> } | undefined;
  const editable = Number(diag?.editable_pages_count || 0) > 0 || (diag?.page_evidence || []).some(p =>
    Number(p.forms || 0) > 0 || Number(p.inputs || 0) > 0 || Number(p.buttons || 0) > 0 || Number(p.selects || 0) > 0
  );
  if (status === "NO_OPERATION" && editable) return "NEEDS_REVIEW";
  return status;
}

function menuStatusLabel(status?: string): { label: string; color: string; bg: string; border: string } | null {
  const s = String(status || "").toUpperCase();
  if (s === "READY") return { label: "✅ AI整備済み", color: "#15803d", bg: "#f0fdf4", border: "#bbf7d0" };
  if (s === "NEEDS_REVIEW") return { label: "AI整備待ち", color: "#b45309", bg: "#fffbeb", border: "#fde68a" };
  if (s === "NO_EDITABLE_DOM") return { label: "フォームなし", color: "#64748b", bg: "#f8fafc", border: "#cbd5e1" };
  if (s === "NO_OPERATION") return { label: "未検出", color: "#64748b", bg: "#f8fafc", border: "#cbd5e1" };
  if (s === "FAILED") return { label: "失敗", color: "#b91c1c", bg: "#fef2f2", border: "#fca5a5" };
  return null;
}

function menuDisplayStatusLabel(item: MenuDisplayItem): { label: string; color: string; bg: string; border: string } | null {
  const s = String(item.status || "").toUpperCase();
  if (item.productionReady || item.confirmed) return menuStatusLabel(s);
  if (s === "READY") return { label: "AI整備待ち", color: "#7c2d12", bg: "#fff7ed", border: "#fed7aa" };
  if (s === "NEEDS_REVIEW") return { label: "AI整備待ち", color: "#b45309", bg: "#fffbeb", border: "#fde68a" };
  return menuStatusLabel(s);
}

function summarizeMenuDisplayItems(items: MenuDisplayItem[]): MenuScanSummary {
  const summary: MenuScanSummary = {
    total: items.length,
    scanned: items.filter(i => !!i.status).length,
    ready: 0,
    needs_review: 0,
    no_editable_dom: 0,
    no_operation: 0,
    failed: 0,
    unknown: 0,
  };
  items.forEach(item => {
    const s = String(item.status || "").toUpperCase();
    if (s === "READY" && (item.productionReady || item.confirmed)) summary.ready = Number(summary.ready || 0) + 1;
    else if (s === "READY" || s === "NEEDS_REVIEW") summary.needs_review = Number(summary.needs_review || 0) + 1;
    else if (s === "NO_EDITABLE_DOM") summary.no_editable_dom = Number(summary.no_editable_dom || 0) + 1;
    else if (s === "NO_OPERATION") summary.no_operation = Number(summary.no_operation || 0) + 1;
    else if (s === "FAILED") summary.failed = Number(summary.failed || 0) + 1;
    else summary.unknown = Number(summary.unknown || 0) + 1;
  });
  summary.unscanned = Math.max(Number(summary.total || 0) - Number(summary.scanned || 0), 0);
  summary.ready_or_review = Number(summary.ready || 0) + Number(summary.needs_review || 0);
  summary.action_required = Number(summary.needs_review || 0) + Number(summary.no_editable_dom || 0) + Number(summary.no_operation || 0) + Number(summary.failed || 0);
  summary.non_actionable = Number(summary.no_editable_dom || 0) + Number(summary.no_operation || 0);
  summary.completed = Number(summary.total || 0) > 0 && Number(summary.scanned || 0) >= Number(summary.total || 0);
  return summary;
}

function coerceMenuScanSummary(raw?: Record<string, unknown> | MenuScanSummary | null): MenuScanSummary | undefined {
  if (!raw) return undefined;
  return raw as MenuScanSummary;
}

function effectiveMenuItemsForDisplay(m: MediaMapping, loaded?: MediaMenuItemsResponse): { items: MenuDisplayItem[]; source: "deep_scan" | "manual"; summary?: MenuScanSummary } {
  const mx = m as unknown as Record<string, unknown>;
  const scan = mx.manual_menu_scan_results as { items?: MenuItemScanResult[]; summary?: MenuScanSummary } | undefined;
  const scanItems = (loaded?.items?.length ? loaded.items : scan?.items || []) as Array<Record<string, unknown>>;
  const summary = coerceMenuScanSummary((loaded?.summary as Record<string, unknown> | undefined) || scan?.summary);
  const source: "deep_scan" | "manual" = scanItems.length > 0 ? "deep_scan" : "manual";
  const rawItems = source === "deep_scan"
    ? scanItems
    : (((mx.manual_menu_items as Array<Record<string, unknown>> | undefined) || []) as Array<Record<string, unknown>>);
  const seen = new Set<string>();
  const items: MenuDisplayItem[] = [];

  rawItems.forEach(item => {
    const url = String(
      item.url || item.canonical_url || item.absolute_url || item.href || ""
    );
    if (!url || !url.startsWith("http")) return;
    if (!isMenuUrlInMappingScope(m, url)) return;
    const key = normalizeMenuUrl(url);
    if (seen.has(key)) return;
    seen.add(key);
    const rawLabel = String(item.title || item.text || item.label || "");
    const operations = item.operations as Record<string, Record<string, unknown>> | undefined;
    const operationRows = Object.values(operations || {});
    const operationProductionReady = operationRows.some(rec =>
      rec.production_ready === true || rec.confirmation_status === "AI_CONFIRMED" || CONFIRMED_OPERATION_SOURCES.has(String(rec.source || ""))
    );
    const operationConfirmed = operationRows.some(rec =>
      rec.production_ready === true || rec.confirmation_status === "AI_CONFIRMED" || CONFIRMED_OPERATION_SOURCES.has(String(rec.source || ""))
    );
    items.push({
      label: bestMenuLabel(rawLabel, url),
      url,
      category: String(item.category || "その他"),
      status: adjustedMenuStatus(item),
      message: String(item.message || ""),
      productionReady: Boolean(item.production_ready || item.production_eligible || item.confirmation_status === "AI_CONFIRMED" || operationProductionReady),
      confirmed: Boolean(item.production_ready || item.confirmation_status === "AI_CONFIRMED" || operationConfirmed),
      candidateOnly: item.candidate_only !== false,
      source,
    });
  });

  return { items, source, summary: source === "deep_scan" ? summarizeMenuDisplayItems(items) : summary };
}

function menuScanSeverity(summary?: MenuScanSummary): "critical" | "warning" | "pending" | "info" {
  if (!summary || Number(summary.total || 0) <= 0) return "info";
  const total = Number(summary.total || 0);
  const scanned = Number(summary.scanned ?? 0);
  const unscanned = Number(summary.unscanned ?? Math.max(total - scanned, 0));
  const ready = Number(summary.ready || 0);
  const review = Number(summary.needs_review || 0);
  const noDom = Number(summary.no_editable_dom || 0);
  const failed = Number(summary.failed || 0);
  const noOp = Number(summary.no_operation || 0);
  const health = String(summary.health_status || "");
  if (health === "FAILED_MANY" || health === "NO_READY") return "critical";
  if (health === "UNSCANNED" || (scanned <= 0 && total > 0)) return "pending";
  if (health === "INCOMPLETE" || unscanned > 0) return "pending";
  if (failed >= Math.max(3, Math.ceil(total * 0.25))) return "critical";
  if (ready + review === 0 && failed > 0 && total > 0) return "critical";
  if (failed > 0 || review > 0 || noOp > 0 || noDom > 0) return "warning";
  return "info";
}

function menuScanTitle(summary?: MenuScanSummary, running = false, failedState = false): string {
  if (failedState) return "❌ AI整備停止";
  if (running) return "🔵 AI整備中";
  const severity = menuScanSeverity(summary);
  if (severity === "critical") return "❌ AI整備 要復旧";
  if (severity === "warning") return "⚠️ AI整備待ちあり";
  if (severity === "pending") {
    const total = Number(summary?.total || 0);
    const scanned = Number(summary?.scanned || 0);
    return scanned <= 0 && total > 0 ? "⚪ AI未整備" : "🟡 AI整備 未完了";
  }
  return "✅ AI整備済み";
}

function menuScanTone(summary?: MenuScanSummary, running = false, failedState = false) {
  const severity = failedState ? "critical" : running ? "info" : menuScanSeverity(summary);
  if (severity === "critical") return { bg: "#fef2f2", border: "#fca5a5", main: "#b91c1c" };
  if (severity === "warning") return { bg: "#fffbeb", border: "#fde68a", main: "#b87d00" };
  if (severity === "pending") return { bg: "#f8fafc", border: "#cbd5e1", main: "#475569" };
  if (running) return { bg: "#eff6ff", border: "#bfdbfe", main: "#1d4ed8" };
  return { bg: "#f0fdf4", border: "#86efac", main: "#15803d" };
}

function menuScanSummaryLine(summary?: MenuScanSummary): string {
  if (!summary) return "";
  const total = Number(summary.total ?? 0);
  const scanned = Number(summary.scanned ?? 0);
  const unscanned = Number(summary.unscanned ?? Math.max(total - scanned, 0));
  return `${scanned}/${total}URL / 未処理 ${unscanned} / 実行可 ${Number(summary.ready ?? 0)} / AI整備待ち ${Number(summary.needs_review ?? 0)} / フォームなし ${Number(summary.no_editable_dom ?? 0)} / 未検出 ${Number(summary.no_operation ?? 0)} / 失敗 ${Number(summary.failed ?? 0)}`;
}

function firstStopReason(summary?: MenuScanSummary): string {
  const top = summary?.top_stop_reasons?.[0];
  if (!top?.reason) return "";
  return `${top.reason}${top.count ? ` (${top.count}件)` : ""}`;
}

function SitePreviewPanel({
  preview,
  label,
  labelColor = "#1d4ed8",
  onClose,
}: {
  preview: SitePreviewResult;
  label: string;
  labelColor?: string;
  onClose?: () => void;
}) {
  const DISPLAY_W = 480;
  const VW = preview.viewport.width;
  const VH = preview.viewport.height;
  const scale = DISPLAY_W / VW;
  const displayH = Math.round(VH * scale);
  const useIframe = !!preview.page_html;
  return (
    <div style={{ borderRadius: 8, overflow: "hidden", border: `2px solid ${labelColor}33`, boxShadow: "0 2px 12px rgba(0,0,0,0.10)" }}>
      {/* ブラウザ風ヘッダー */}
      <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 8px", background: "#1e293b" }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444", display: "inline-block", flexShrink: 0 }} />
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#f59e0b", display: "inline-block", flexShrink: 0 }} />
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981", display: "inline-block", flexShrink: 0 }} />
        <span style={{ fontSize: 9, fontWeight: 700, color: labelColor, background: labelColor + "22", padding: "1px 6px", borderRadius: 3, flexShrink: 0 }}>{label}</span>
        <div style={{ flex: 1, background: "#334155", borderRadius: 3, padding: "2px 8px", fontSize: 9, color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
          {preview.current_url}
        </div>
        {onClose && (
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 12, padding: "0 2px", flexShrink: 0 }}>✕</button>
        )}
      </div>
      {/* サイト本体（iframe模倣） */}
      <div style={{ position: "relative", width: DISPLAY_W, height: displayH, overflow: "hidden", background: "#fff" }}>
        {useIframe ? (
          <iframe
            srcDoc={preview.page_html}
            sandbox="allow-same-origin"
            style={{ width: VW, height: VH, border: "none", transform: `scale(${scale})`, transformOrigin: "top left", pointerEvents: "none", display: "block" }}
            title={preview.title || label}
          />
        ) : (
          <img src={`data:image/png;base64,${preview.screenshot_b64}`} alt={label} style={{ width: DISPLAY_W, height: "auto", display: "block" }} />
        )}
        {preview.field_boxes.map((box, idx) => (
          <div key={idx} style={{
            position: "absolute",
            left: Math.round(box.x * scale), top: Math.round(box.y * scale),
            width: Math.max(Math.round(box.w * scale), 4), height: Math.max(Math.round(box.h * scale), 4),
            border: "2px solid #f59e0b", background: "rgba(245,158,11,0.18)",
            borderRadius: 3, pointerEvents: "none", boxSizing: "border-box", zIndex: 10,
          }}>
            <span style={{ position: "absolute", top: -16, left: 0, background: "#f59e0b", color: "#fff", fontSize: 8, padding: "1px 4px", borderRadius: "3px 3px 3px 0", whiteSpace: "nowrap", fontWeight: 700 }}>
              {box.key}
            </span>
          </div>
        ))}
      </div>
      {/* フッター */}
      <div style={{ padding: "4px 8px", background: "#f8fafc", borderTop: "1px solid #e2e8f0", fontSize: 9, color: "#64748b", display: "flex", gap: 8 }}>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{preview.title}</span>
        {preview.field_boxes.length > 0 && <span style={{ color: "#f59e0b", fontWeight: 700, flexShrink: 0 }}>フィールド {preview.field_boxes.length}件</span>}
      </div>
    </div>
  );
}

// スクリーンショット上にフォームフィールドを重ねてASCENDから直接編集・保存できるパネル
function InteractiveSitePanel({
  preview,
  label,
  labelColor = "#7c3aed",
  mappingId,
  onClose,
  onSaved,
}: {
  preview: SitePreviewResult;
  label: string;
  labelColor?: string;
  mappingId?: string;
  onClose?: () => void;
  onSaved?: (result: FormFillResult) => void;
}) {
  const vw = preview.viewport?.width || 1280;
  const vh = preview.viewport?.height || 800;
  const DISPLAY_W = 640;
  const scale = DISPLAY_W / vw;
  const displayH = Math.round(vh * scale);
  const [editValues, setEditValues] = React.useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    (preview.form_elements || []).forEach(el => {
      if (el.selector && el.current_value !== undefined) {
        init[el.selector] = el.current_value;
      }
    });
    return init;
  });
  const [saving, setSaving] = React.useState(false);
  const [saveResult, setSaveResult] = React.useState<string | null>(null);

  const handleSave = async () => {
    if (!mappingId) return;
    setSaving(true);
    setSaveResult(null);
    try {
      const result = await formFill(mappingId, preview.current_url || "", editValues);
      setSaveResult(result.submit_clicked ? `✅ ${result.message}` : `⚠️ ${result.message}`);
      if (onSaved) onSaved(result);
    } catch (e: unknown) {
      setSaveResult("❌ " + (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const fields = (preview.form_elements || []).filter(el => el.selector && el.tag !== "button" && el.type !== "submit");
  const hasEditable = fields.length > 0 && !!mappingId;

  return (
    <div style={{ borderRadius: 10, overflow: "hidden", border: `2px solid ${labelColor}44`, boxShadow: "0 2px 16px rgba(0,0,0,0.12)" }}>
      {/* ブラウザ風ヘッダー */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", background: "#1e293b" }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444", display: "inline-block" }} />
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#f59e0b", display: "inline-block" }} />
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981", display: "inline-block" }} />
        <span style={{ fontSize: 9, fontWeight: 800, color: labelColor, background: labelColor + "33", padding: "1px 6px", borderRadius: 3 }}>{label}</span>
        <div style={{ flex: 1, background: "#334155", borderRadius: 3, padding: "2px 8px", fontSize: 9, color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {preview.current_url}
        </div>
        {hasEditable && (
          <span style={{ fontSize: 9, color: "#86efac", fontWeight: 700 }}>編集可 {fields.length}フィールド</span>
        )}
        {onClose && (
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 13 }}>✕</button>
        )}
      </div>

      {/* スクリーンショット + フィールドオーバーレイ */}
      <div style={{ position: "relative", width: DISPLAY_W, height: displayH, overflow: "hidden", background: "#fff" }}>
        <img
          src={`data:image/png;base64,${preview.screenshot_b64}`}
          alt={label}
          style={{ width: DISPLAY_W, height: "auto", display: "block", pointerEvents: "none" }}
        />
        {fields.map(el => (
          el.type === "textarea" || el.tag === "textarea" ? (
            <textarea
              key={el.selector}
              value={editValues[el.selector!] ?? el.current_value ?? ""}
              onChange={e => setEditValues(prev => ({ ...prev, [el.selector!]: e.target.value }))}
              style={{
                position: "absolute",
                left: Math.round(el.x * scale),
                top: Math.round(el.y * scale),
                width: Math.round(el.w * scale),
                height: Math.round(el.h * scale),
                opacity: 0.92,
                background: "#fffef0",
                border: "1.5px solid " + labelColor,
                fontSize: Math.max(9, Math.round(12 * scale)),
                padding: "1px 3px",
                boxSizing: "border-box",
                resize: "none",
                zIndex: 5,
                fontFamily: "inherit",
              }}
            />
          ) : (
            <input
              key={el.selector}
              value={editValues[el.selector!] ?? el.current_value ?? ""}
              onChange={e => setEditValues(prev => ({ ...prev, [el.selector!]: e.target.value }))}
              title={el.label}
              style={{
                position: "absolute",
                left: Math.round(el.x * scale),
                top: Math.round(el.y * scale),
                width: Math.round(el.w * scale),
                height: Math.round(el.h * scale),
                opacity: 0.92,
                background: "#fffef0",
                border: "1.5px solid " + labelColor,
                fontSize: Math.max(9, Math.round(12 * scale)),
                padding: "1px 3px",
                boxSizing: "border-box",
                zIndex: 5,
              }}
            />
          )
        ))}
      </div>

      {/* 保存フッター */}
      {hasEditable && (
        <div style={{ padding: "8px 12px", background: "#f8fafc", borderTop: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={handleSave} disabled={saving}
            style={{ padding: "6px 20px", borderRadius: 6, border: "none", background: saving ? "#9ca3af" : labelColor, color: "#fff", fontWeight: 800, fontSize: 12, cursor: saving ? "wait" : "pointer" }}>
            {saving ? "保存中..." : "ASCENDから保存する"}
          </button>
          {saveResult && <span style={{ fontSize: 11, color: saveResult.startsWith("✅") ? "#15803d" : "#b91c1c", fontWeight: 700 }}>{saveResult}</span>}
          <span style={{ fontSize: 10, color: "#9ca3af", marginLeft: "auto" }}>{preview.title}</span>
        </div>
      )}
    </div>
  );
}

export default function AgentPage() {
  const router = useRouter();
  const WAITING_EXECUTOR_OPS = ["interview", "audit"];
  const isWaitingExecutorOp = (op: AgentOp) =>
    WAITING_EXECUTOR_OPS.includes(op.category || "") ||
    WAITING_EXECUTOR_OPS.includes(op.operation_type || "");
  const SUPPORTED_OPS = ["text_update", "news_post", "blog_post", "media_replace", "schedule_update", "price_update", "entity_register", "entity_update", "page_monitor", "offer_send", "recruit_inbox_scan", "recruit_reply"];
  const [wfSessions, setWfSessions] = useState<WorkflowSession[]>([]);
  const [wfLoading, setWfLoading] = useState(false);
  const [wfSessionInput, setWfSessionInput] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [wfMsg, setWfMsg] = useState("");
  const [manualOpen, setManualOpen] = useState(false);
  const [wfExpanded, setWfExpanded] = useState<Record<string, boolean>>({});
  const [wfPolicyExpanded, setWfPolicyExpanded] = useState<Record<string, boolean>>({});
  const [wfGoal, setWfGoal] = useState("");
  const [wfWorkflowId, setWfWorkflowId] = useState("");
  const [wfInstruction, setWfInstruction] = useState("");
  const [wfMappingId, setWfMappingId] = useState("");
  const [wfCreating, setWfCreating] = useState(false);
  const [wfCreateOpen, setWfCreateOpen] = useState(false);
  const [debugMode, setDebugMode] = useState(false);

  const fetchWfSessions = async () => {
    setWfLoading(true);
    try {
      const r = await listWorkflowSessions();
      setWfSessions(r.sessions || []);
    } catch { setWfSessions([]); } finally { setWfLoading(false); }
  };
  const [mounted, setMounted] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>("command");
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [batches, setBatches] = useState<AgentTaskBatch[]>([]);
  const [crossTasks, setCrossTasks] = useState<CrossMediaTask[]>([]);
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [mappings, setMappings] = useState<MediaMapping[]>([]);
  const [sitesCollapsed, setSitesCollapsed] = useState(false);
  const [schedules, setSchedules] = useState<AgentSchedule[]>([]);
  const [ops, setOps] = useState<OpWithSchema[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [selectedTask, setSelectedTask] = useState<AgentTask | null>(null);
  const [loginCheckResults, setLoginCheckResults] = useState<Record<string, {login_success: boolean; message: string}>>({});
  const [domScanResults, setDomScanResults] = useState<Record<string, Record<string, unknown>>>({});
  const [domScanLoading, setDomScanLoading] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (typeof window === "undefined") return;
    const requestedTab = new URLSearchParams(window.location.search).get("tab") as Tab | null;
    if (requestedTab && AGENT_TABS.includes(requestedTab)) setTab(requestedTab);
  }, []);
  // Keep ?tab= in the URL in sync with the active tab so a refresh stays on the
  // current section instead of resetting to the Agent司令塔. The read above
  // restores it on load; this writes it on every tab change (skipping mount).
  const tabFirstRun = useRef(true);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (tabFirstRun.current) { tabFirstRun.current = false; return; }
    const url = new URL(window.location.href);
    if (url.searchParams.get("tab") !== tab) {
      url.searchParams.set("tab", tab);
      window.history.replaceState(null, "", url.toString());
    }
  }, [tab]);
  const [repairSelections, setRepairSelections] = useState<Record<string, Record<string, string | undefined>>>({});
  const [domScanMaxPages, setDomScanMaxPages] = useState<Record<string, number>>({});
  const [domScanStartUrl, setDomScanStartUrl] = useState<Record<string,string>>({});
  const [domScanInclude, setDomScanInclude] = useState<Record<string,string>>({});
  const [domScanExclude, setDomScanExclude] = useState<Record<string,string>>({});
  const [capabilitySelections, setCapabilitySelections] = useState<Record<string, Record<string, boolean>>>({});
  const [semanticSelectorSelections, setSemanticSelectorSelections] = useState<Record<string, Record<string, boolean>>>({});
  const [deepScanLoading, setDeepScanLoading] = useState<Record<string, boolean>>({});

  // 対話型マッピング
  const [dialogMappingId, setDialogMappingId]     = useState<string | null>(null);
  const [dialogOpType, setDialogOpType]           = useState<string>("");   // = page_name
  const [dialogPageUrl, setDialogPageUrl]         = useState<string>("");
  const [dialogSteps, setDialogSteps]             = useState<DialogStep[]>([]);
  const [dialogStepIdx, setDialogStepIdx]         = useState<number>(0);
  const [dialogCustomVal, setDialogCustomVal]     = useState<string>("");
  const [dialogLoading, setDialogLoading]         = useState<boolean>(false);
  const [dialogDone, setDialogDone]               = useState<boolean>(false);
  const [dialogError, setDialogError]             = useState<string>("");
  const [dialogConfirmed, setDialogConfirmed]     = useState<Record<string, string>>({});
  const [dialogSaving, setDialogSaving]           = useState<boolean>(false);
  const [dialogPreviewImg, setDialogPreviewImg]     = useState<string | null>(null);
  const [dialogPreviewIdx, setDialogPreviewIdx]     = useState<number | null>(null);
  const [dialogPreviewError, setDialogPreviewError] = useState<string>("");
  const [dialogDiscoveredTabs, setDialogDiscoveredTabs] = useState<{href: string; absolute_url: string; text: string}[]>([]);
  const [dialogDiscoveredMappingId, setDialogDiscoveredMappingId] = useState<string>("");
  const [menuItemScreenshot, setMenuItemScreenshot] = useState<{mappingId: string; url: string; label: string; img: string | null; loading: boolean; error: string} | null>(null);
  const [deepScanResults, setDeepScanResults] = useState<Record<string, Record<string, unknown>>>({});
  const [hintUrls, setHintUrls] = useState<Record<string, string>>({});
  const [batchOp, setBatchOp] = useState("news_post");
  const [batchPayloadText, setBatchPayloadText] = useState("{\n  \"body\": \"\"\n}");
  const [batchSelectedMappingIds, setBatchSelectedMappingIds] = useState<Record<string, boolean>>({});
  const [batchLoading, setBatchLoading] = useState(false);
  const [crossInstruction, setCrossInstruction] = useState("");
  const [crossSourceMode, setCrossSourceMode] = useState<"manual_payload" | "public_url" | "source_mapping">("manual_payload");
  const [crossSourceUrl, setCrossSourceUrl] = useState("");
  const [crossSourceMappingId, setCrossSourceMappingId] = useState("");
  const [crossTargetOp, setCrossTargetOp] = useState("entity_update");
  const [crossPayloadText, setCrossPayloadText] = useState("{\n  \"title\": \"\",\n  \"body\": \"\"\n}");
  const [crossQuery, setCrossQuery] = useState("");
  const [crossMaxItems, setCrossMaxItems] = useState(1);
  const [crossAccessConfirmed, setCrossAccessConfirmed] = useState(false);
  const [crossSelectedTargets, setCrossSelectedTargets] = useState<Record<string, boolean>>({});
  const [crossLoading, setCrossLoading] = useState(false);
  const [crossDestCheckLoading, setCrossDestCheckLoading] = useState<Record<string, boolean>>({});
  const [crossPreviewLoading, setCrossPreviewLoading] = useState(false);
  const [crossPreviewData, setCrossPreviewData] = useState<{ results: CrossPreviewResult[]; source_data: Record<string, string> } | null>(null);
  // クロスメディアモード: "copy"=既存コピー / "generate"=AI新規生成 / "recruit"=求人対応
  const [crossMode, setCrossMode] = useState<"copy" | "generate" | "recruit">("copy");
  // 求人対応モード用（項目7）
  const [recruitMode, setRecruitMode] = useState<"offer" | "reply" | "text">("reply");
  const [recruitMappingId, setRecruitMappingId] = useState("");
  const [recruitApplicant, setRecruitApplicant] = useState("");
  const [recruitConditions, setRecruitConditions] = useState("");
  const [recruitInstruction, setRecruitInstruction] = useState("");
  const [recruitLoading, setRecruitLoading] = useState(false);
  const [recruitResult, setRecruitResult] = useState<{ doc_label: string; title: string; body: string; knowledge_used: boolean; market_used: boolean; note: string } | null>(null);
  const [recruitEditTitle, setRecruitEditTitle] = useState("");
  const [recruitEditBody, setRecruitEditBody] = useState("");
  const [recruitSending, setRecruitSending] = useState(false);
  // offer_send フィルター
  const [offerFilterScoutOnly, setOfferFilterScoutOnly] = useState(true);
  const [offerFilterUnsentOnly, setOfferFilterUnsentOnly] = useState(true);
  const [offerFreeText, setOfferFreeText] = useState("");
  const [offerMaxSend, setOfferMaxSend] = useState(5);
  // 新規生成モード用
  const [genCastName, setGenCastName] = useState("");
  const [genAge, setGenAge] = useState("");
  const [genHeight, setGenHeight] = useState("");
  const [genBust, setGenBust] = useState("");
  const [genCup, setGenCup] = useState("");
  const [genWaist, setGenWaist] = useState("");
  const [genHip, setGenHip] = useState("");
  const [genTypeHint, setGenTypeHint] = useState("");
  const [genInstructions, setGenInstructions] = useState("");
  const [genPreviewLoading, setGenPreviewLoading] = useState(false);
  const [genNoMonitoringWarning, setGenNoMonitoringWarning] = useState(false);
  const [genRegisterUrlError, setGenRegisterUrlError] = useState(false);
  // display_fields: {label, selector, value, type}[] per mapping_id
  const [genDisplayFields, setGenDisplayFields] = useState<Record<string, import("@/lib/api").ProfileDisplayField[]>>({});
  // fill_fields: {mapping_id: {selector: value}} - execute直通用
  const [genFillFields, setGenFillFields] = useState<Record<string, Record<string, string>>>({});
  const [genExecuting, setGenExecuting] = useState(false);
  const [genResult, setGenResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // 対象指定（誰を）: 取得元エンティティ一覧と選択
  const [crossEntityLoading, setCrossEntityLoading] = useState(false);
  const [crossEntities, setCrossEntities] = useState<{ name: string; url: string; hidden?: boolean }[]>([]);
  const [crossEntityLabel, setCrossEntityLabel] = useState("対象");
  const [crossSelectedEntity, setCrossSelectedEntity] = useState<{ name: string; url: string; hidden?: boolean } | null>(null);
  const [showHiddenEntities, setShowHiddenEntities] = useState(false);
  // 更新スコープ（全体/差分/個別）
  const [crossUpdateScope, setCrossUpdateScope] = useState<"all" | "diff" | "individual">("individual")
  // 差分モード用スナップショット（dest_mapping_id → {synced_at, mapped_fields}）
  const [crossSnapshots, setCrossSnapshots] = useState<Record<string, { synced_at: string | null; mapped_fields: Record<string, string> }>>({});
  // 更新範囲（何を）: プレビュー項目のうち反映するフィールド（mapping_id -> label -> bool）
  const [crossFieldSel, setCrossFieldSel] = useState<Record<string, Record<string, boolean>>>({});
  const [monitorMediaId, setMonitorMediaId] = useState("");
  const [monitorTargetUrl, setMonitorTargetUrl] = useState("");
  const [monitorCastNames, setMonitorCastNames] = useState("");
  const [monitorDate, setMonitorDate] = useState("");
  const [monitorMarketKeywords, setMonitorMarketKeywords] = useState("新人,イベント,割引,キャンペーン,予約,本指名,SNS");
  const [monitorCompetitorUrls, setMonitorCompetitorUrls] = useState("");
  const [monitorLoading, setMonitorLoading] = useState(false);
  const [monitoringResults, setMonitoringResults] = useState<MonitoringResult[]>([]);
  const [monitoringResultsLoading, setMonitoringResultsLoading] = useState(false);
  const [interviewRole, setInterviewRole] = useState("応募者");
  const [interviewGoal, setInterviewGoal] = useState("応募者の適性、継続性、条件一致を判断したい");
  const [interviewCandidateMemo, setInterviewCandidateMemo] = useState("");
  const [interviewRequirements, setInterviewRequirements] = useState("継続性,希望条件,接客適性,ルール理解,リスク確認");
  const [interviewLoading, setInterviewLoading] = useState(false);
  const [goalInput, setGoalInput] = useState("");
  const [goalPlan, setGoalPlan] = useState<AgentGoalPlan | null>(null);
  const [goalLoading, setGoalLoading] = useState(false);
  const [goalCreating, setGoalCreating] = useState(false);

  // サイト接続ウィザード
  const [wizardStep, setWizardStep] = useState(1);
  const [showWizard, setShowWizard] = useState(false);
  const [collapsedMappings, setCollapsedMappings] = useState<Record<string, boolean>>({});
  const [siteIndustry, setSiteIndustry] = useState("other");
  const [siteName, setSiteName] = useState("");
  const [siteUrl, setSiteUrl] = useState("");
  const [siteLoginId, setSiteLoginId] = useState("");
  const [siteLoginPass, setSiteLoginPass] = useState("");
  const [wizardConnecting, setWizardConnecting] = useState(false);
  const [wizardTestResult, setWizardTestResult] = useState<{ok: boolean; msg: string} | null>(null);
  const [createdMappingId, setCreatedMappingId] = useState<string>("");
  const [templateDetected, setTemplateDetected] = useState<string | null>(null);
  const [selectorUsername, setSelectorUsername] = useState("");
  const [selectorPassword, setSelectorPassword] = useState("");
  const [selectorSubmit, setSelectorSubmit] = useState("");
  const [selectorVerify, setSelectorVerify] = useState("");
  const [selectorSaving, setSelectorSaving] = useState(false);

  // ログイン情報登録モーダル
  const [loginRegModal, setLoginRegModal] = useState<MediaMapping | null>(null);
  const [loginRegId, setLoginRegId] = useState("");
  const [loginRegPass, setLoginRegPass] = useState("");
  const [loginRegLoading, setLoginRegLoading] = useState(false);

  // 自動化作成（動的フォーム）
  const [selectedOpId, setSelectedOpId] = useState("");
  const [selectedMedia, setSelectedMedia] = useState<MediaMapping | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [selectedMenuItemUrl, setSelectedMenuItemUrl] = useState("");
  const [creating, setCreating] = useState(false);

  // 自然言語プラン
  const [planInput, setPlanInput] = useState("");
  const [planResult, setPlanResult] = useState<null | {ready: boolean; media_name?: string; op_id?: string; operation_type?: string; payload?: Record<string,unknown>; preview?: string; question?: string}>(null);
  const [planFormValues, setPlanFormValues] = useState<Record<string, string>>({});
  const [planLoading, setPlanLoading] = useState(false);

  // スケジュール
  const [scheduleOpId, setScheduleOpId] = useState("");
  const [scheduleMediaId, setScheduleMediaId] = useState("");
  const [scheduleMenuItemUrl, setScheduleMenuItemUrl] = useState("");
  const [schedulePayloadText, setSchedulePayloadText] = useState("{\n  \"body\": \"\"\n}");
  const [scheduleHour, setScheduleHour] = useState("9");
  const [scheduleMin, setScheduleMin] = useState("0");
  const [scheduleDow, setScheduleDow] = useState("*");

  // ページリスト開閉

  // HTML貼り付け解析
  const [htmlMenuTarget, setHtmlMenuTarget] = useState<string>("");
  const [htmlMenuInput, setHtmlMenuInput] = useState<Record<string,string>>({});
  const [htmlMenuSourceUrl, setHtmlMenuSourceUrl] = useState<Record<string,string>>({});
  const [htmlMenuLoading, setHtmlMenuLoading] = useState<Record<string,boolean>>({});
  const [htmlMenuResult, setHtmlMenuResult] = useState<Record<string,Record<string,unknown>>>({});
  // 業務条件パネル
  const [bizCondOpen, setBizCondOpen] = useState<Record<string,boolean>>({});
  const [bizCondEdit, setBizCondEdit] = useState<Record<string, {
    site_purpose: string;
    height_min: string; height_max: string; weight_max: string;
    cup_min: string; tattoo_ok: boolean; age_min: string; age_max: string;
    custom_conditions: string; image_check: boolean;
    tone: string; interview_info: string; shop_conditions: string;
    offer_template: string;
  }>>({});
  const [bizCondSaving, setBizCondSaving] = useState<Record<string,boolean>>({});
  // Step 3: 会話スレッド管理
  const [recruitConversations, setRecruitConversations] = useState<RecruitConversation[]>([]);
  const [convLoading, setConvLoading] = useState(false);
  const [convError, setConvError] = useState("");
  const [openConvId, setOpenConvId] = useState<string | null>(null);
  const [convNewMsg, setConvNewMsg] = useState<Record<string, string>>({});
  const [convReplyDraft, setConvReplyDraft] = useState<Record<string, string>>({});
  const [convReplyLoading, setConvReplyLoading] = useState<Record<string, boolean>>({});
  const [convReplyInstruction, setConvReplyInstruction] = useState<Record<string, string>>({});
  // 手動ページ登録
  const [manualPagesOpen, setManualPagesOpen] = useState<Record<string,boolean>>({});
  const [manualPageEntries, setManualPageEntries] = useState<Record<string, {title:string;url:string;html:string}[]>>({});
  const [manualPagesLoading, setManualPagesLoading] = useState<Record<string,boolean>>({});
  const [manualPagesResult, setManualPagesResult] = useState<Record<string,unknown>>({});
  const [manualPagesPreviewData, setManualPagesPreviewData] = useState<Record<string,unknown>>({});
  const [manualPagesPreviewLoading, setManualPagesPreviewLoading] = useState<Record<string,boolean>>({});
  type FetchResult = {ok:boolean;status?:string;page_type?:string;op_type?:string;op_type_override?:string;fields?:{label?:string;name?:string;type?:string}[];form_action?:string;screenshot?:string;error?:string;html_length?:number;current_url?:string};
  const [manualPageFetchResults, setManualPageFetchResults] = useState<Record<string, Record<number, FetchResult>>>({});
  const [manualPageFetchLoading, setManualPageFetchLoading] = useState<Record<string, Record<number, boolean>>>({});
  const [savedPageExpanded, setSavedPageExpanded] = useState<Record<string, boolean>>({});
  const [savedPageReanalyzing, setSavedPageReanalyzing] = useState<Record<string, boolean>>({});
  const [savedPagePendingOp, setSavedPagePendingOp] = useState<Record<string, string>>({});
  // 検証レビュー
  const [verifyReviewOpen, setVerifyReviewOpen] = useState<Record<string,boolean>>({});
  const [verifyReviewData, setVerifyReviewData] = useState<Record<string,unknown>>({});
  const [verifyReviewLoading, setVerifyReviewLoading] = useState<Record<string,boolean>>({});
  const [patchUrlTarget, setPatchUrlTarget] = useState<Record<string,string>>({});
  const [patchUrlLoading, setPatchUrlLoading] = useState<Record<string,boolean>>({});
  const [menuItemScanResults, setMenuItemScanResults] = useState<Record<string, unknown>>({});
  const [menuScanDetails, setMenuScanDetails] = useState<Record<string, MediaMenuItemsResponse>>({});
  const [schemaPreview, setSchemaPreview] = useState<Record<string, MediaSchemaResponse | null>>({});
  const [schemaPreviewLoading, setSchemaPreviewLoading] = useState<Record<string, boolean>>({});
  const [sitePreviewData, setSitePreviewData] = useState<Record<string, SitePreviewResult | null>>({});
  const [sitePreviewLoading, setSitePreviewLoading] = useState<Record<string, boolean>>({});
  const [sitePreviewUrl, setSitePreviewUrl] = useState<Record<string, string>>({});
  const [crossSrcPreview, setCrossSrcPreview] = useState<SitePreviewResult | null>(null);
  const [crossSrcPreviewLoading, setCrossSrcPreviewLoading] = useState(false);
  const [crossDstPreview, setCrossDstPreview] = useState<Record<string, SitePreviewResult | null>>({});
  const [crossDstPreviewLoading, setCrossDstPreviewLoading] = useState<Record<string, boolean>>({});
  // ビジュアルPINクリック紐付けUI用 state
  type CrossPin = { x: number; y: number };
  const [crossSrcPins, setCrossSrcPins] = useState<CrossPin[]>([]);
  const [crossDstPins, setCrossDstPins] = useState<Record<string, (CrossPin | null)[]>>({});
  const [crossPinPending, setCrossPinPending] = useState<number | null>(null);
  const [crossDstSnapshotLoading, setCrossDstSnapshotLoading] = useState<Record<string, boolean>>({});
  // New field-mapping states
  const [crossSrcFields, setCrossSrcFields] = useState<FormElement[]>([]);
  const [crossSrcFieldsLoading, setCrossSrcFieldsLoading] = useState(false);
  const [crossDstDisplayId, setCrossDstDisplayId] = useState("");
  const [crossDstFieldsMap, setCrossDstFieldsMap] = useState<Record<string, FormElement[]>>({});
  const [crossDstFieldsLoadingMap, setCrossDstFieldsLoadingMap] = useState<Record<string, boolean>>({});
  const [crossFieldLinks, setCrossFieldLinks] = useState<Array<{srcLabel: string; dstLabel: string}>>([]);
  const [crossDstUrl, setCrossDstUrl] = useState("");
  const [crossSrcExtractFields, setCrossSrcExtractFields] = useState<string[]>([]);
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    const u = getStoredUser();
    if (!u || !u.token) { router.replace("/"); return; }
    (async () => {
      try {
        await listAgentTasks();
        setHasPermission(true);
        fetchAll();
      } catch (e: unknown) {
        const err = e as Error;
        if (err.message && (err.message.includes("権限") || err.message.includes("403"))) {
          setHasPermission(false);
        } else {
          setHasPermission(true);
          fetchAll();
        }
      }
    })();
  }, [mounted]);

  async function fetchAll() {
    setLoading(true);
    try {
      const [td, ld, md, sd, od, bd, cd, mrd] = await Promise.allSettled([
        listAgentTasks(), listAgentLogs(), listMediaMappings(),
        listAgentSchedules(), listAgentOps(), listAgentTaskBatches(), listCrossMediaTasks(),
        getMonitoringResults({ limit: 10 }),
      ]);
      if (td.status === "fulfilled") setTasks(sortTasksNewest(td.value.tasks || []));
      if (ld.status === "fulfilled") setLogs(sortLogsNewest(ld.value.logs || []));
      if (md.status === "fulfilled") {
        const mediaMappings = md.value.mappings || [];
        setMappings(mediaMappings);
        const scanResults = await Promise.allSettled(
          mediaMappings.map(m => getMediaMenuScanItems(m.mapping_id, 500))
        );
        const nextDetails: Record<string, MediaMenuItemsResponse> = {};
        scanResults.forEach((r, idx) => {
          if (r.status === "fulfilled" && r.value) nextDetails[mediaMappings[idx].mapping_id] = r.value;
        });
        setMenuScanDetails(nextDetails);
      }
      if (sd.status === "fulfilled") setSchedules(sd.value.schedules);
      if (bd.status === "fulfilled") setBatches(sortCreatedNewest(bd.value.batches || []));
      if (cd.status === "fulfilled") setCrossTasks(sortCreatedNewest(cd.value.tasks || []));
      if (mrd.status === "fulfilled") setMonitoringResults(mrd.value.results || []);
      // 失敗項目をmsgに表示
      const failedNames: string[] = [];
      if (td.status === "rejected") failedNames.push("タスク");
      if (ld.status === "rejected") failedNames.push("履歴");
      if (md.status === "rejected") failedNames.push("媒体設定");
      if (sd.status === "rejected") failedNames.push("スケジュール");
      if (od.status === "rejected") failedNames.push("自動化一覧");
      if (bd.status === "rejected") failedNames.push("一括実行");
      if (cd.status === "rejected") failedNames.push("別媒体へ展開");
      if (failedNames.length > 0) setMsg(`一部データを取得できませんでした：${failedNames.join("、")}`);
      if (od.status === "fulfilled") {
        const validOps = (od.value.ops || []).filter((o: OpWithSchema) => o.active !== false);
        setOps(validOps);
        if (validOps.length > 0) {
          setScheduleOpId(validOps[0].op_id || "");
          setSelectedOpId(validOps[0].op_id || "");
        }
      }
    } finally { setLoading(false); }
  }

  async function runAiMappingSetup(mappingId: string) {
    const loadingKey = `${mappingId}_ai_mapping_setup`;
    setDeepScanLoading(prev => ({ ...prev, [loadingKey]: true }));
    setMsg("AI自動整備を開始しました。Playwrightでログイン・解析中...");
    try {
      // 新設計: Playwright クロール → Gemini 解析 → AI_CONFIRMED で保存
      const result = await autoSetupMapping(mappingId, { runInBg: false });
      await fetchAll();
      if (result.ok) {
        const ready = (result.ready_ops || []).join(", ") || "なし";
        setMsg(`✅ AI整備完了。READY操作: ${ready}`);
      } else {
        setMsg(`⚠️ AI整備: ${result.status || "不明"} — 認証情報を確認してください`);
      }
    } catch (e: unknown) {
      setMsg("AI整備失敗: " + ((e as Error).message || "不明なエラー"));
    } finally {
      setDeepScanLoading(prev => ({ ...prev, [loadingKey]: false }));
    }
  }

  async function handleExecute(task_id: string) {
    try {
      await executeAgentTask(task_id);
      setMsg("実行しました");
      const d = await listAgentTasks();
      setTasks(sortTasksNewest(d.tasks || []));
    } catch (e: unknown) { setMsg((e as Error).message); }
  }

  async function handleApprove(task_id: string) {
    try {
      await approveAgentTask(task_id);
      setMsg("承認しました");
      const d = await listAgentTasks();
      setTasks(sortTasksNewest(d.tasks || []));
    } catch (e: unknown) { setMsg((e as Error).message); }
  }

  async function handleReject(task_id: string) {
    try {
      await rejectAgentTask(task_id, "ユーザーが承認・実行画面から却下");
      setMsg("却下しました");
      const d = await listAgentTasks();
      setTasks(sortTasksNewest(d.tasks || []));
    } catch (e: unknown) { setMsg((e as Error).message); }
  }

  async function handleDelete(task_id: string) {
    if (typeof window !== "undefined" && !window.confirm("このタスクを一覧から削除します。実行ログは残ります。よろしいですか？")) return;
    try {
      await deleteAgentTask(task_id);
      setMsg("タスクを削除しました");
      const d = await listAgentTasks();
      setTasks(sortTasksNewest(d.tasks || []));
    } catch (e: unknown) { setMsg((e as Error).message); }
  }

  function operationState(m: MediaMapping, op: string): { status?: string; missing?: string[]; confidence?: number; page_url?: string; target_url?: string; steps?: number; production_ready?: boolean; confirmed?: boolean; source?: string } | null {
    const mx = m as unknown as {
      operation_mappings?: Record<string, { status?: string; missing?: string[]; confidence?: number; page_url?: string; target_url?: string; executable?: boolean; selectors?: Record<string, unknown>; source?: string; confirmed?: boolean; user_confirmed?: boolean; production_ready?: boolean; confirmation_status?: string }>;
      operation_steps_by_type?: Record<string, unknown[]>;
      capability_view?: { operations?: Record<string, { status?: string; missing?: string[]; target_url?: string; taskable?: boolean; step_count?: number }> };
    };
    const capOps = mx.capability_view?.operations;
    const byOp = mx.operation_mappings || {};
    const st = byOp[op] || null;
    const confirmed = isConfirmedOperationMapping(st);
    const productionReady = isProductionReadyOperationMapping(st);
    if (capOps && Object.keys(capOps).length > 0) {
      const cap = capOps[op] || null;
      return cap ? { ...cap, confirmed, production_ready: productionReady, source: st?.source, steps: productionReady ? Number(cap.step_count || (cap.taskable ? 1 : 0)) : 0 } : null;
    }
    if (!st) return null;
    const stepCount = (mx.operation_steps_by_type?.[op] || []).length;
    const isManualReady = st.status === "READY" && confirmed && (st.executable === true || Object.keys(st.selectors || {}).length > 0);
    const effectiveSteps = stepCount > 0 ? stepCount : (isManualReady ? 1 : 0);
    return { ...st, confirmed, production_ready: isProductionReadyOperationMapping(st), steps: effectiveSteps };
  }

  function isMediaOperationTaskable(m: MediaMapping | null | undefined, op: string): boolean {
    if (!m || !op) return false;
    const st = operationState(m, op);
    return st?.status === "READY" && st.production_ready === true && Number(st.steps || 0) > 0;
  }

  function readyMenuItemsForOp(m: MediaMapping, op: string): MenuItemScanResult[] {
    const scan = (m as unknown as { manual_menu_scan_results?: { items?: MenuItemScanResult[] } }).manual_menu_scan_results;
    return (scan?.items || []).filter(item => {
      const direct = item.operations?.[op];
      const legacy = item.updated_ops?.find(r => r.op === op);
      const status = direct?.status || legacy?.status;
      const steps = Number(direct?.step_count ?? direct?.steps ?? legacy?.step_count ?? legacy?.steps ?? 0);
      const rec = direct || legacy;
      const confirmed = Boolean(
        (item as unknown as Record<string, unknown>).production_ready === true
        || (item as unknown as Record<string, unknown>).confirmation_status === "AI_CONFIRMED"
        || (rec as unknown as Record<string, unknown> | undefined)?.production_ready === true
        || (rec as unknown as Record<string, unknown> | undefined)?.confirmation_status === "AI_CONFIRMED"
      );
      return !!item.url && status === "READY" && steps > 0 && confirmed;
    });
  }

  function isOperationReadyForMedia(m: MediaMapping, op: string): boolean {
    if (op === "post_monitoring") return !!m.media_url || !!m.login_url;
    if (op === "page_monitor") {
      return isProductionReadyOperationMapping(m.operation_mappings?.page_monitor);
    }
    // スカウト系: site_purpose + 認証情報 + 対象URLのマッピングが揃って初めて実行可
    if (op === "offer_send") {
      return m.business_conditions?.site_purpose === "scout" && !!m.credential_secret_name && hasMappedOperationUrl(m, "offer_send");
    }
    if (op === "recruit_inbox_scan") {
      const _sp = m.business_conditions?.site_purpose || "";
      return ["scout", "reply", "monitor"].includes(_sp) && !!m.credential_secret_name && hasMappedOperationUrl(m, "recruit_inbox_scan");
    }
    if (op === "recruit_reply") {
      const _sp = m.business_conditions?.site_purpose || "";
      return ["scout", "reply"].includes(_sp) && !!m.credential_secret_name;
    }
    if (isMediaOperationTaskable(m, op)) return true;
    if (readyMenuItemsForOp(m, op).length > 0) return true;
    const _opMaps = (m as unknown as Record<string,unknown>).operation_mappings as Record<string, {status?: string; executable?: boolean; source?: string; confirmed?: boolean; production_ready?: boolean; confirmation_status?: string}> | undefined;
    return isProductionReadyOperationMapping(_opMaps?.[op]);
  }

  const _SCOUT_BATCH_OPS = ["offer_send", "recruit_inbox_scan", "recruit_reply"];
  const _SCOUT_BATCH_ALLOWED: Record<string, string[]> = {
    offer_send:         ["scout"],
    recruit_inbox_scan: ["scout", "reply", "monitor"],
    recruit_reply:      ["scout", "reply"],
  };
  const batchPayloadForReady = (() => {
    try { return JSON.parse(batchPayloadText || "{}") as Record<string, unknown>; }
    catch { return {}; }
  })();
  const batchReadyMappings = mappings.filter(m => {
    if (_SCOUT_BATCH_OPS.includes(batchOp)) {
      const _sp = m.business_conditions?.site_purpose || "";
      const _allowed = _SCOUT_BATCH_ALLOWED[batchOp] || [];
      if (!_allowed.includes(_sp) || !m.credential_secret_name) return false;
      if (batchOp === "offer_send" || batchOp === "recruit_inbox_scan") return hasMappedOperationUrl(m, batchOp);
      if (batchOp === "recruit_reply") return !!String(batchPayloadForReady.reply_url || "").trim();
      return true;
    }
    const st = operationState(m, batchOp);
    if (st?.status === "READY" && st.production_ready === true && Number(st.steps || 0) > 0) return true;
    const _bOpMaps = (m as unknown as Record<string,unknown>).operation_mappings as Record<string, {status?: string; executable?: boolean; source?: string; confirmed?: boolean; production_ready?: boolean; confirmation_status?: string}> | undefined;
    return isProductionReadyOperationMapping(_bOpMaps?.[batchOp]);
  });
  const selectedBatchIds = Object.entries(batchSelectedMappingIds)
    .filter(([id, selected]) => selected && batchReadyMappings.some(m => m.mapping_id === id))
    .map(([id]) => id);
  const crossReadyTargets = mappings.filter(m => {
    const st = operationState(m, crossTargetOp);
    if (st?.status === "READY" && st.production_ready === true && Number(st.steps || 0) > 0) return true;
    return isProductionReadyOperationMapping(m.operation_mappings?.[crossTargetOp]);
  });
  const selectedCrossTargetIds = Object.entries(crossSelectedTargets)
    .filter(([id, selected]) => selected && crossReadyTargets.some(m => m.mapping_id === id))
    .map(([id]) => id);
  const monitoringTasks = tasks.filter(t => t.agent_type === "post_monitoring" || t.operation_type === "post_monitoring");
  const latestMonitoring = monitoringTasks.find(t => t.result && (t.result as Record<string, unknown>).monitoring_result) || null;
  const interviewFocus = interviewRequirements.split(/[,\n、]/).map(x => x.trim()).filter(Boolean);
  const interviewQuestions = [
    `${interviewRole || "応募者"}として働く目的と、今回もっとも重視している条件を教えてください。`,
    "これまで続けられた仕事や活動では、何が継続の支えになっていましたか。",
    "苦手な接客や不安になりやすい場面がある場合、どのように対処してきましたか。",
    "希望シフト、通勤、生活リズムの中で無理が出そうな条件はありますか。",
    "店舗ルール、掲載可否、連絡頻度、遅刻欠勤時の連絡について確認したい点はありますか。",
    "入店後に早期離脱しないために、事前に店側へ共有しておきたい事情はありますか。",
    ...(interviewRequirements.includes("身バレ") || interviewRequirements.includes("掲載") || interviewRequirements.includes("写真")
      ? ["写真掲載、顔出し範囲、SNS露出について許容できる範囲とNG条件を確認してください。"] : []),
    ...(interviewRequirements.includes("売上") || interviewRequirements.includes("指名") || interviewRequirements.includes("接客")
      ? ["指名やリピートにつながる接客で、自分が大切にしたい姿勢を具体例で確認してください。"] : []),
  ];
  const interviewAxes = [
    ["目的の明確さ", "応募理由と希望条件が現実的に説明できているか"],
    ["継続性", "勤務条件・生活リズム・連絡習慣に無理がないか"],
    ["接客適性", "苦手場面を自覚し、対処の言語化ができるか"],
    ["ルール理解", "掲載、遅刻欠勤、連絡、禁止事項を確認できているか"],
    ["リスク予兆", "早期離脱、トラブル、期待値ズレにつながる未確認点がないか"],
  ];

  async function refreshBatchesAndTasks() {
    const [bd, td] = await Promise.allSettled([listAgentTaskBatches(), listAgentTasks()]);
    if (bd.status === "fulfilled") setBatches(sortCreatedNewest(bd.value.batches || []));
    if (td.status === "fulfilled") setTasks(sortTasksNewest(td.value.tasks || []));
  }

  async function handleBatchCreate() {
    if (selectedBatchIds.length === 0) {
      setMsg("一括で作成するサイトを選択してください");
      return;
    }
    let payload: Record<string, unknown> = {};
    try {
      payload = batchPayloadText.trim() ? JSON.parse(batchPayloadText) : {};
    } catch {
      setMsg("入力データのJSON形式を確認してください");
      return;
    }
    setBatchLoading(true);
    try {
      const r = await createAgentTaskBatch({
        agent_type: "hp_update",
        operation_type: batchOp,
        industry: "generic",
        media_mapping_ids: selectedBatchIds,
        payload,
      });
      await refreshBatchesAndTasks();
      setMsg(`一括タスクを作成しました：作成 ${r.counts?.created ?? 0}件 / スキップ ${r.counts?.skipped ?? 0}件`);
    } catch (e: unknown) {
      setMsg((e as Error).message);
    } finally {
      setBatchLoading(false);
    }
  }

  async function handleCrossCreate() {
    if (selectedCrossTargetIds.length === 0) {
      setMsg("出力先サイトを選択してください");
      return;
    }
    if (crossSourceMode === "public_url" && !crossSourceUrl.trim()) {
      setMsg("取得元URLを入力してください");
      return;
    }
    if (crossSourceMode === "source_mapping" && !crossSourceMappingId) {
      setMsg("取得元媒体を選択してください");
      return;
    }
    if ((crossSourceMode === "public_url" || crossSourceMode === "source_mapping") && !crossAccessConfirmed) {
      setMsg("取得元の利用権限・契約・規約確認にチェックしてください");
      return;
    }
    let payload: Record<string, unknown> = {};
    try {
      payload = crossPayloadText.trim() ? JSON.parse(crossPayloadText) : {};
    } catch {
      setMsg("中間データJSONの形式を確認してください");
      return;
    }
    setCrossLoading(true);
    try {
      const r = await createCrossMediaTask({
        instruction: crossInstruction,
        industry: "generic",
        source_mode: crossSourceMode,
        source_url: crossSourceUrl,
        source_mapping_id: crossSourceMappingId,
        target_mapping_ids: selectedCrossTargetIds,
        target_operation_type: crossTargetOp,
        source_payload: { ...payload, field_links: crossFieldLinks.length > 0 ? crossFieldLinks : undefined },
        query: crossQuery,
        max_items: crossMaxItems,
        source_access_confirmed: crossAccessConfirmed || crossSourceMode === "manual_payload",
      });
      const [ct, td] = await Promise.allSettled([listCrossMediaTasks(), listAgentTasks()]);
      if (ct.status === "fulfilled") setCrossTasks(sortCreatedNewest(ct.value.tasks || []));
      if (td.status === "fulfilled") setTasks(sortTasksNewest(td.value.tasks || []));
      setMsg(`別媒体へ展開するタスクを作成しました：作成 ${r.counts?.created ?? 0}件 / スキップ ${r.counts?.skipped ?? 0}件`);
      if ((r.counts?.created ?? 0) > 0) setTab("tasks");
    } catch (e: unknown) {
      setMsg("❌ " + (e instanceof Error ? e.message : "別媒体への展開タスク作成に失敗しました"));
    } finally {
      setCrossLoading(false);
    }
  }

  async function handleMonitoringCreate() {
    const selectedMedia = mappings.find(m => m.mapping_id === monitorMediaId) || null;
    const resolvedMonitorTarget = monitorTargetUrl.trim() || monitorTargetsForMapping(selectedMedia)[0]?.url || "";
    const competitorUrls = parseUrlList(monitorCompetitorUrls);
    if (!selectedMedia && !resolvedMonitorTarget) {
      setMsg("監視URL、または媒体を選択してください");
      return;
    }
    if (competitorUrls.length > 5) {
      setMsg(`競合URLは最大5件までです。現在 ${competitorUrls.length} 件あります。優先する5件に絞ってください。`);
      return;
    }
    // site_purpose 連動: スカウト/返信型は recruit_inbox_scan へ自動切替
    const _monPurpose = selectedMedia?.business_conditions?.site_purpose || "";
    const _isRecruitMonitor = ["scout", "reply"].includes(_monPurpose);
    if (_isRecruitMonitor && !selectedMedia?.credential_secret_name) {
      setMsg("受信ボックス監視にはログイン情報が必要です。媒体基盤でID/PASSを登録してください。");
      return;
    }
    setMonitorLoading(true);
    try {
      if (_isRecruitMonitor) {
        await createAgentTask({
          agent_type: "hp_update",
          operation_type: "recruit_inbox_scan",
          industry: normalizeIndustryKey(selectedMedia?.industry ?? undefined) || "generic",
          entity_type: "inbox",
          media_mapping_id: selectedMedia?.mapping_id || undefined,
          payload: {
            media_mapping_id: selectedMedia?.mapping_id || "",
            media_name: selectedMedia?.media_name || "",
          },
        });
        setMsg(`${SITE_PURPOSE_LABEL[_monPurpose]}サイトのため受信ボックス監視タスクを作成しました。`);
      } else {
        await createAgentTask({
          agent_type: "post_monitoring",
          operation_type: "post_monitoring",
          industry: normalizeIndustryKey(selectedMedia?.industry ?? undefined) || "generic",
          entity_type: "monitoring",
          payload: {
            monitoring_target: resolvedMonitorTarget,
            cast_names: monitorCastNames,
            monitoring_date: monitorDate,
            market_keywords: monitorMarketKeywords,
            competitor_urls: competitorUrls.join("\n"),
            media_mapping_id: selectedMedia?.mapping_id || "",
            media_name: selectedMedia?.media_name || "",
          },
          media_mapping_id: selectedMedia?.mapping_id || undefined,
        });
        setMsg("AI監視・市場調査タスクを作成しました。承認・実行画面で確認して実行してください。");
      }
      const d = await listAgentTasks();
      setTasks(sortTasksNewest(d.tasks || []));
      setTab("tasks");
    } catch(e: unknown) {
      setMsg("❌ " + (e instanceof Error ? e.message : "監視タスク作成失敗"));
    } finally {
      setMonitorLoading(false);
    }
  }

  async function handleInterviewCreate() {
    if (!interviewGoal.trim()) {
      setMsg("面接目的を入力してください");
      return;
    }
    setInterviewLoading(true);
    try {
      await createAgentTask({
        agent_type: "interview",
        operation_type: "interview_assist",
        industry: "generic",
        entity_type: "candidate",
        payload: {
          use_case: interviewGoal,
          role_name: interviewRole,
          candidate_memo: interviewCandidateMemo,
          requirements: interviewRequirements,
          generated_questions: interviewQuestions,
          evaluation_axes: interviewAxes.map(([axis, check]) => ({ axis, check })),
        },
      });
      const d = await listAgentTasks();
      setTasks(sortTasksNewest(d.tasks || []));
      setMsg("面接メモ作成タスクを追加しました。承認・実行画面で確認してからメモを生成できます。");
      setTab("tasks");
    } catch (e: unknown) {
      setMsg("❌ " + (e instanceof Error ? e.message : "面接メモ作成タスクの追加に失敗しました"));
    } finally {
      setInterviewLoading(false);
    }
  }

  async function handleBatchApprove(batch_id: string) {
    setBatchLoading(true);
    try {
      const r = await approveAgentTaskBatch(batch_id);
      await refreshBatchesAndTasks();
      setMsg(`一括承認しました：${r.approved_task_ids.length}件`);
    } catch (e: unknown) {
      setMsg((e as Error).message);
    } finally {
      setBatchLoading(false);
    }
  }

  async function handleBatchExecute(batch_id: string) {
    setBatchLoading(true);
    try {
      const r = await executeAgentTaskBatch(batch_id);
      await refreshBatchesAndTasks();
      setMsg(`一括実行しました：${r.status}`);
    } catch (e: unknown) {
      setMsg((e as Error).message);
    } finally {
      setBatchLoading(false);
    }
  }

  function applyGoalPrefill(tabName: string) {
    const prefill = goalPlan?.prefill || {};
    if (tabName === "monitoring") {
      const mon = prefill.monitoring || {};
      if (mon.monitoring_target) setMonitorTargetUrl(String(mon.monitoring_target));
      if (mon.monitoring_date) setMonitorDate(String(mon.monitoring_date));
      if (mon.market_keywords) setMonitorMarketKeywords(String(mon.market_keywords));
    }
    if (tabName === "cross") {
      const cross = prefill.cross_media || {};
      if (cross.instruction) setCrossInstruction(String(cross.instruction));
      if (cross.source_mode === "public_url" || cross.source_mode === "manual_payload" || cross.source_mode === "source_mapping") {
        setCrossSourceMode(cross.source_mode);
      }
      if (cross.source_url) setCrossSourceUrl(String(cross.source_url));
      if (cross.query) setCrossQuery(String(cross.query));
      if (cross.max_items) setCrossMaxItems(Math.max(1, Math.min(50, Number(cross.max_items) || 1)));
      if (cross.target_operation_type) setCrossTargetOp(String(cross.target_operation_type));
    }
    if (tabName === "interview") {
      const interview = prefill.interview || {};
      setInterviewGoal(String(interview.use_case || goalInput || "応募者の適性、継続性、条件一致を判断したい"));
      if (interview.requirements) setInterviewRequirements(String(interview.requirements));
    }
    if (tabName === "create") {
      const task = prefill.task || {};
      setPlanInput(String(task.instruction || goalInput));
    }
    if (tabName === "schedule") {
      const schedule = prefill.schedule || {};
      const payload = schedule.payload && typeof schedule.payload === "object" ? schedule.payload : { body: goalInput };
      setSchedulePayloadText(JSON.stringify(payload, null, 2));
    }
  }

  function openGoalTab(tabName: string) {
    applyGoalPrefill(tabName);
    if (AGENT_TABS.includes(tabName as Tab)) setTab(tabName as Tab);
  }

  function plannedFieldsForResult(plan: typeof planResult): PayloadField[] {
    if (!plan?.operation_type) return [];
    const matchedOp = ops.find(o =>
      (!!plan.op_id && o.op_id === plan.op_id) ||
      o.operation_type === plan.operation_type
    );
    return payloadFieldsForOperation(selectedMedia, plan.operation_type, matchedOp);
  }

  async function handleGoalAnalyze() {
    if (!goalInput.trim()) { setMsg("目的またはゴールを入力してください"); return; }
    setGoalLoading(true);
    setGoalPlan(null);
    try {
      const r = await planAgentGoal({ goal: goalInput });
      setGoalPlan(r);
      if (r.route_tab && AGENT_TABS.includes(r.route_tab as Tab)) {
        setMsg(`Agent判断: ${r.summary}`);
      }
    } catch (e: unknown) {
      setMsg("❌ " + (e instanceof Error ? e.message : "ゴール解析に失敗しました"));
    } finally {
      setGoalLoading(false);
    }
  }

  async function handleGoalCreateTask() {
    if (!goalInput.trim()) { setMsg("目的またはゴールを入力してください"); return; }
    setGoalCreating(true);
    try {
      let plan = goalPlan;
      if (!plan) {
        plan = await planAgentGoal({ goal: goalInput });
        setGoalPlan(plan);
      }
      if (!plan.can_create_task) {
        setMsg(`${plan.summary || "この入力だけでは実行タスクにできませんでした"} 必要な情報を入力できる画面へ移動します。`);
        if (plan.route_tab && AGENT_TABS.includes(plan.route_tab as Tab)) setTab(plan.route_tab as Tab);
        return;
      }
      // site_purpose 連動: スカウト系ゴールは scout mapping を自動補完 + offer_template を注入
      const _goalOp = plan.operation_plan?.operation_type || "";
      const _goalIsScout = plan.mode === "scout_recruit" ||
        ["offer_send", "recruit_inbox_scan", "recruit_reply"].includes(_goalOp);
      const _goalMapping = _goalIsScout
        ? (mappings.find(m => m.business_conditions?.site_purpose === "scout" && !!m.credential_secret_name)
           || mappings.find(m => ["scout", "reply"].includes(m.business_conditions?.site_purpose || "")))
        : null;
      const _goalBc = _goalMapping?.business_conditions || {};
      const _goalPayloadExtra: Record<string, unknown> = {};
      if (_goalOp === "offer_send" && !plan.operation_plan?.payload?.body && _goalBc.offer_template) {
        _goalPayloadExtra.body = _goalBc.offer_template;
      }
      const r = await createAgentTaskFromInstruction({
        instruction: goalInput,
        mapping_id: _goalMapping?.mapping_id || undefined,
        payload: { ..._goalPayloadExtra, ...(plan.operation_plan?.payload || {}) },
      });
      if (!r.created) {
        const candidateText = (r.candidates || []).slice(0, 5).map(c => String(c.title || c.media_name || c.url || "")).filter(Boolean).join("、");
        setMsg((r.question || "ゴールからタスクを作成できませんでした") + (candidateText ? ` 候補: ${candidateText}` : ""));
        if (r.status === "NEEDS_MEDIA") setTab("sites");
        return;
      }
      const d = await listAgentTasks();
      setTasks(sortTasksNewest(d.tasks || []));
      setMsg("入力内容から承認待ちタスクを作成しました。内容を確認して承認すると実行できます。");
      setTab("tasks");
    } catch (e: unknown) {
      setMsg("❌ " + (e instanceof Error ? e.message : "ゴールタスク作成失敗"));
    } finally {
      setGoalCreating(false);
    }
  }

  function fallbackParse(input: string): { ready: boolean; operation_type: string; preview: string; question?: string } {
    const t = input.toLowerCase();
    if (/スカウト|オファー送信|候補者.*精査|精査.*候補者|求人サイト.*候補|offer.?send/.test(t))
      return { ready: true, operation_type: "offer_send", preview: "スカウト精査＋オファー送信タスクを作成します。候補者をAIで絞り込んでオファーを送信します。" };
    if (/受信ボックス|受信.*スキャン|inbox.*スキャン|メッセージ確認|recruit.?inbox|応募.*確認|応募者.*連絡|新着.*確認|着信.*確認|受信.*確認|応募チェック/.test(t))
      return { ready: true, operation_type: "recruit_inbox_scan", preview: "受信ボックス監視タスクを作成します。応募者・候補者からのメッセージを確認して会話スレッドを更新します。" };
    if (/候補者.*返信|スカウト.*返信|recruit.?reply|求人.*返信|応募者.*返信|応募.*返信|連絡.*返信|問い合わせ.*返信/.test(t))
      return { ready: true, operation_type: "recruit_reply", preview: "返信送信タスクを作成します。応募者・候補者の会話スレッドに返信を送信します。" };
    if (/投稿数|投稿頻度|写メ日記|日記|未投稿|監視|sns/.test(t))
      return { ready: true, operation_type: "post_monitoring", preview: "投稿数監視タスクを作成します。監視URLがあればそのURL、なければ選択媒体のURLを読みます。" };
    if (/写真|画像|差し替え|media/.test(t))
      return { ready: true, operation_type: "media_replace", preview: "画像・資料差し替えタスクを作成します（推定）。" };
    if (/出勤|予定|スケジュール|schedule/.test(t))
      return { ready: true, operation_type: "schedule_update", preview: "予定更新タスクを作成します（推定）。" };
    if (/ニュース|お知らせ|投稿|news/.test(t))
      return { ready: true, operation_type: "news_post", preview: "ニュース投稿タスクを作成します（推定）。" };
    if (/面接|ヒアリング|面談|interview/.test(t))
      return { ready: true, operation_type: "interview_assist", preview: "面接メモ作成タスクを作成します。質問案・評価軸・判断メモを整理します。" };
    if (/テキスト|文章|説明|更新|text/.test(t))
      return { ready: true, operation_type: "text_update", preview: "テキスト更新タスクを作成します（推定）。" };
    if (/料金|価格|price/.test(t))
      return { ready: true, operation_type: "price_update", preview: "料金更新タスクを作成します（推定）。" };
    if (/ステータス|status|状態|公開|非公開|在籍/.test(t))
      return { ready: true, operation_type: "entity_update", preview: "情報更新タスクを作成します（公開状態・在籍などは情報更新に統合されました）。" };
    if (/登録|追加|entity/.test(t))
      return { ready: true, operation_type: "entity_register", preview: "情報登録タスクを作成します（推定）。" };
    if (/更新|変更|修正/.test(t))
      return { ready: true, operation_type: "entity_update", preview: "情報更新タスクを作成します（推定）。" };
    if (/監査|チェック|差分|未更新/.test(t))
      return { ready: false, operation_type: "audit", preview: "", question: "更新監査（audit）は実行層が未対応です。タスク構造・承認・ログ確認は可能ですが、実媒体操作は現在未対応です。" };
    return { ready: false, operation_type: "BLOCKED", preview: "", question: "指示内容を特定できませんでした。操作の種類（例：投稿監視・画像差し替え・スケジュール更新）を含めて再入力してください。" };
  }

  async function handlePlan() {
    if (!planInput.trim()) { setMsg("指示を入力してください"); return; }
    setPlanLoading(true);
    setPlanResult(null);
    setPlanFormValues({});
    try {
      const r = await planAgentTask({ instruction: planInput, mapping_id: selectedMedia?.mapping_id });
      setPlanResult(r);
      setPlanFormValues(seedValuesForPayloadFields(plannedFieldsForResult(r), r.payload));
    } catch {
      const fb = fallbackParse(planInput);
      setPlanResult({ ...fb, ok: true } as typeof planResult extends null ? never : NonNullable<typeof planResult>);
      setPlanFormValues({});
      if (!fb.ready) setMsg("AI解析失敗。入力内容から推定できませんでした。操作の種類を含めて再入力してください。");
    } finally { setPlanLoading(false); }
  }

  async function handlePlanCreate() {
    if (!planResult || !planResult.ready) return;
    const isInterviewPlan = planResult.operation_type === "interview_assist";
    if (isInterviewPlan) {
      setCreating(true);
      try {
        await createAgentTask({
          agent_type: "interview",
          operation_type: "interview_assist",
          industry: "generic",
          entity_type: "candidate",
          payload: {
            use_case: planInput,
            role_name: "応募者",
            candidate_memo: "",
            requirements: "継続性,接客適性,ルール理解,条件一致",
          },
        });
        const d = await listAgentTasks();
        setTasks(sortTasksNewest(d.tasks || []));
        setMsg("面接メモ作成タスクを追加しました。承認後に質問案・評価軸を生成できます。");
        setTab("tasks");
      } catch (e: unknown) {
        setMsg("❌ " + (e instanceof Error ? e.message : "面接メモ作成タスクの追加に失敗しました"));
      } finally {
        setCreating(false);
      }
      return;
    }
    if (!selectedMedia) { setMsg("先に操作対象の媒体を選択してください。"); return; }
    const _planOpType = planResult.operation_type || "";
    const _planNoCredNeeded =
      _planOpType === "post_monitoring" ||
      _planOpType === "page_monitor";
    if (!_planNoCredNeeded && !selectedMedia.credential_secret_name) { setMsg("ログイン情報未登録です。① 媒体基盤でID/PASSを登録してください。"); return; }
    const _planFields = plannedFieldsForResult(planResult);
    for (const f of _planFields) {
      const currentValue = planFormValues[f.key] ?? serializePayloadValueForInput(planResult.payload?.[f.key]);
      if (f.required && !String(currentValue || "").trim()) {
        setMsg(`AIタスク用の「${f.label}」を入力してください`);
        return;
      }
    }
    setCreating(true);
    try {
      // スカウト系: business_conditions から payload を補完
      const _planBc = selectedMedia.business_conditions || {};
      const _planPayloadExtra: Record<string, unknown> = {};
      if (_planOpType === "offer_send" && !planResult.payload?.body && _planBc.offer_template) {
        _planPayloadExtra.body = _planBc.offer_template;
      }
      const _planPayloadFields = Object.fromEntries(
        Object.entries(planFormValues).filter(([, value]) => value !== "")
      );
      const r = await createAgentTaskFromInstruction({
        instruction: planInput,
        mapping_id: selectedMedia.mapping_id,
        payload: { ..._planPayloadExtra, ...(planResult.payload || {}), ..._planPayloadFields },
      });
      if (!r.created) {
        const candidateText = (r.candidates || []).slice(0, 5).map(c => c.title || c.media_name || c.url).filter(Boolean).join("、");
        setMsg((r.question || "タスクを作成できませんでした") + (candidateText ? ` 候補: ${candidateText}` : ""));
        return;
      }
      setMsg(`自動化を追加しました${r.source === "menu_item" ? "（HTMLメニューURL）" : ""}`);
      setPlanInput("");
      setPlanResult(null);
      setPlanFormValues({});
      const d = await listAgentTasks();
      setTasks(sortTasksNewest(d.tasks || []));
      setTab("tasks");
    } catch (e: unknown) { setMsg((e as Error).message); }
    finally { setCreating(false); }
  }

  async function handleCreate() {
    if (!selectedMedia) { setMsg("先に操作対象の媒体を選択してください。"); return; }
    const selectedOp = ops.find(o => o.op_id === selectedOpId);
    if (!selectedOp) { setMsg("自動化内容を選択してください"); return; }
    if (selectedOp.active === false) { setMsg("この操作は現在利用できません"); return; }
    const selectedOperationType = selectedOp.operation_type || "";
    // credential不要op: post_monitoring / page_monitor のみ（recruit系は必ずログイン必要）
    const _noCredNeeded =
      selectedOperationType === "post_monitoring" ||
      selectedOperationType === "page_monitor";
    if (!_noCredNeeded && !selectedMedia.credential_secret_name) { setMsg("ログイン情報未登録です。① 媒体基盤でID/PASSを登録してください。"); return; }
    const menuItemsForOp = readyMenuItemsForOp(selectedMedia, selectedOperationType);
    const mediaLevelReady = isMediaOperationTaskable(selectedMedia, selectedOperationType);
    if (!mediaLevelReady && menuItemsForOp.length > 0 && !selectedMenuItemUrl) {
      setMsg("対象HTMLメニューURLを選択してください");
      return;
    }
    const fields = payloadFieldsForOperation(selectedMedia, selectedOperationType, selectedOp);
    for (const f of fields) {
      if (f.required && !formValues[f.key]) {
        setMsg(`「${f.label}」を入力してください`);
        return;
      }
    }
    if (selectedOperationType === "recruit_reply" && !formValues.reply_url) {
      setMsg("返信先URL(reply_url)を入力してください");
      return;
    }
    setCreating(true);
    try {
      if (selectedMenuItemUrl) {
        await createMenuItemTask(selectedMedia.mapping_id, selectedMenuItemUrl, selectedOperationType, {
          ...formValues,
          media_mapping_id: selectedMedia.mapping_id,
          media_name: selectedMedia.media_name,
        });
      } else {
        // スカウト系: business_conditions からデフォルト値を補完
        const _bcExtra: Record<string, string> = {};
        const _bc = selectedMedia.business_conditions || {};
        if (selectedOperationType === "offer_send" && !formValues.body && _bc.offer_template) {
          _bcExtra.body = _bc.offer_template;
        }
        // offer_send: _ff_* キーを filter_fields dict に変換
        const _extraPayload: Record<string, unknown> = {};
        if (selectedOperationType === "offer_send") {
          const _offerFields = mappedFieldsForOperation(selectedMedia, "offer_send");
          const _ff: Record<string, string> = {};
          _offerFields.forEach((f, fi) => {
            const _sel = f.selector || "";
            const _fKey = `_ff_${f.name || f.id || fi}`;
            const _val = (formValues[_fKey] || "").trim();
            if (_sel && _val) _ff[_sel] = _val;
          });
          if (Object.keys(_ff).length > 0) _extraPayload.filter_fields = _ff;
        }
        // _ff_* キーは clean_payload に含めない
        const _cleanFormValues = Object.fromEntries(
          Object.entries(formValues).filter(([k]) => !k.startsWith("_ff_"))
        );
        await createAgentTask({
          agent_type: selectedOp.category || "hp_update",
          operation_type: selectedOperationType,
          industry: normalizeIndustryKey(selectedMedia.industry ?? undefined) || "generic",
          entity_type: selectedOp.entity_type || "",
          op_id: selectedOp.op_id?.startsWith("default_") ? "" : (selectedOp.op_id || ""),
          media_mapping_id: selectedMedia.mapping_id,
          payload: {
            ..._bcExtra,
            ..._cleanFormValues,
            ..._extraPayload,
            media_mapping_id: selectedMedia.mapping_id,
            media_name: selectedMedia.media_name,
          },
        });
      }
      setMsg("自動化を追加しました");
      setFormValues({});
      setSelectedOpId("");
      setSelectedMenuItemUrl("");
      const d = await listAgentTasks();
      setTasks(sortTasksNewest(d.tasks || []));
      setTab("tasks");
    } catch (e: unknown) { setMsg((e as Error).message); }
    finally { setCreating(false); }
  }

  // ウィザードSTEP3: 接続テスト
  async function handleWizardTest() {
    if (!createdMappingId) return;
    setWizardConnecting(true);
    setWizardTestResult(null);
    try {
      let finalUsername = selectorUsername;
      let finalPassword = selectorPassword;
      let finalSubmit   = selectorSubmit;

      // selectors未設定 → dom_scanでログインフォームを自動検出
      if (!finalUsername || !finalPassword || !finalSubmit) {
        try {
          const scanResult = await scanMediaDom(createdMappingId, 1, { reset_resume: false });
          if (scanResult.executed || scanResult.auto_applied) {
            const latest = await listMediaMappings();
            const mm = latest.mappings.find(m => m.mapping_id === createdMappingId);
            const ds = (mm?.dom_selectors as Record<string, string>) || {};
            if (ds.username)     { finalUsername = ds.username;     setSelectorUsername(ds.username); }
            if (ds.password)     { finalPassword = ds.password;     setSelectorPassword(ds.password); }
            if (ds.login_submit) { finalSubmit   = ds.login_submit; setSelectorSubmit(ds.login_submit); }
          }
        } catch (_scanErr) {
          // scan失敗は無視して続行
        }
      }

      if (!finalUsername || !finalPassword || !finalSubmit) {
        setWizardTestResult({ ok: false, msg: "ログインフォームを自動検出できませんでした。媒体基盤のAI整備を実行してください。" });
        return;
      }

      // selector保存
      await updateMediaSelectors(
        createdMappingId,
        { username: finalUsername, password: finalPassword, login_submit: finalSubmit },
        selectorVerify || undefined
      );
      const r = await loginCheckMediaMapping(createdMappingId);
      setWizardTestResult({ ok: r.login_success, msg: r.login_success ? "接続に成功しました" : translateError(r.message) });
    } catch (e: unknown) {
      setWizardTestResult({ ok: false, msg: translateError((e as Error).message) });
    } finally { setWizardConnecting(false); }
  }

  // ウィザードSTEP1→2: サイト情報登録
  async function handleWizardStep1() {
    if (!siteName || !siteUrl) { setMsg("サイト名とURLを入力してください"); return; }
    setWizardConnecting(true);
    try {
      const r = await createMediaMapping({ media_name: siteName, media_url: siteUrl, login_url: siteUrl, industry: siteIndustry, capabilities: {} });
      const rr = r as Record<string, string | null>;
      const newId = rr.mapping_id || "";
      if (!newId) { setMsg("媒体基盤の作成に失敗しました。もう一度お試しください"); return; }
      const clonedFrom = rr.cloned_from_template || null;
      setTemplateDetected(clonedFrom);
      // listMediaMappings で存在確認
      const latest = await listMediaMappings();
      const exists = latest.mappings.some(m => m.mapping_id === newId);
      if (!exists) {
        setMsg("媒体基盤の作成確認に失敗しました。もう一度お試しください");
        setCreatedMappingId("");
        return;
      }
      setMappings(latest.mappings);
      setCreatedMappingId(newId);
      setWizardStep(2);
      setMsg("");
    } catch (e: unknown) { setMsg((e as Error).message); }
    finally { setWizardConnecting(false); }
  }

  function resetWizard() {
    setWizardStep(1); setSiteName(""); setSiteUrl("");
    setSiteLoginId(""); setSiteLoginPass(""); setWizardTestResult(null); setCreatedMappingId(""); setTemplateDetected(null);
    setSelectorUsername(""); setSelectorPassword(""); setSelectorSubmit(""); setSelectorVerify("");
  }

  // 長期未実行チェック（7日以上実行なし）
  const longInactiveSites = mappings.filter(m => {
    if (!m.last_verified_at) return true;
    const diff = Date.now() - new Date(m.last_verified_at).getTime();
    return diff > 7 * 24 * 60 * 60 * 1000;
  });

  const todayLogs = logs.filter(l => {
    if (!l.executed_at) return false;
    return new Date(l.executed_at).toDateString() === new Date().toDateString();
  }).length;
  const failedLogs = logs.filter(l => !l.success);
  const healthFindings: HealthFinding[] = [
    ...mappings.filter(m => !m.credential_secret_name).map(m => ({
      id: `credential-${m.mapping_id}`,
      severity: "critical" as const,
      source: "mapping" as const,
      title: `${m.media_name}: ログイン情報が未登録`,
      detail: "タスク実行・深掘り解析でログインが必要な媒体です。",
      action: "媒体基盤でログイン情報を登録してください。",
      tab: "sites" as const,
    })),
    ...longInactiveSites.filter(m => !!m.credential_secret_name).map(m => ({
      id: `inactive-${m.mapping_id}`,
      severity: "warning" as const,
      source: "mapping" as const,
      title: `${m.media_name}: 任意の接続確認が古い`,
      detail: "AI整備済みの操作だけ実行できます。未整備の場合は媒体基盤のAI整備で土台を保存してください。",
      action: "必要な場合だけ接続確認を実行してください。",
      tab: "sites" as const,
    })),
    ...mappings.flatMap(m => {
      const summary = (m as unknown as { manual_menu_scan_results?: { summary?: MenuScanSummary } }).manual_menu_scan_results?.summary;
      const severity = menuScanSeverity(summary);
      if (!summary || severity === "info") return [];
      const reason = firstStopReason(summary);
      return [{
        id: `menu-scan-${m.mapping_id}`,
        severity,
        source: "deep_scan" as const,
        title: `${m.media_name}: ${menuScanTitle(summary).replace(/^[^\s]+ /, "")}`,
        detail: menuScanSummaryLine(summary),
        action: reason || "URL別の停止ログを確認し、必要なURLだけ再深掘りしてください。",
        tab: "sites" as const,
      }];
    }),
    ...failedLogs.slice(0, 20).map(l => ({
      id: `log-${l.log_id}`,
      severity: "warning" as const,
      source: "log" as const,
      title: `${OP_LABEL[l.operation_type] || l.operation_type}: 実行失敗`,
      detail: translateError(l.error_message || "実行に失敗しました"),
      action: l.executed_at ? new Date(l.executed_at).toLocaleString("ja-JP") : "実行ログを確認してください。",
      tab: "logs" as const,
    })),
  ];
  const criticalFindings = healthFindings.filter(f => f.severity === "critical").length;
  const warningFindings = healthFindings.filter(f => f.severity === "warning").length;
  const errorSites = criticalFindings + warningFindings;

  if (!mounted) return null;

  if (hasPermission === false) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--color-background-tertiary)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ background: "var(--color-background-secondary)", border: "1px solid var(--color-border-tertiary)", borderRadius: 16, padding: 40, maxWidth: 400, width: "100%", textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 8 }}>ご利用いただけません</h2>
          <p style={{ fontSize: 14, color: "var(--color-text-secondary)", lineHeight: 1.7, marginBottom: 24 }}>
            AI自動運営アシスタントはAPEX・ULTRA、または管理者許可済みのPRO・STANDARD+プランでご利用いただける機能です。
          </p>
          <button onClick={() => router.push("/plan")}
            style={{ padding: "10px 24px", borderRadius: 8, border: "none", background: "#7c3aed", color: "#fff", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>
            プランを確認する
          </button>
          <button onClick={() => router.back()}
            style={{ display: "block", margin: "12px auto 0", padding: "8px 24px", borderRadius: 8, border: "1px solid var(--color-border-secondary)", background: "none", color: "var(--color-text-secondary)", fontSize: 14, cursor: "pointer" }}>
            戻る
          </button>
        </div>
      </div>
    );
  }

  if (hasPermission === null) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--color-background-tertiary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "var(--color-text-secondary)", fontSize: 14 }}>確認中...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#fff", fontFamily: "system-ui, sans-serif" }}>

      {/* ── トップバー ── */}
      <div style={{ background: "linear-gradient(135deg,#7c3aed,#4f46e5)", padding: "0 24px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 2px 12px rgba(124,58,237,0.3)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => router.back()} style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 6, cursor: "pointer", color: "#fff", padding: "4px 10px", fontSize: 13 }}>←</button>
          <span style={{ fontWeight: 800, fontSize: 16, color: "#fff", letterSpacing: -0.3 }}>ASCEND Agent OS</span><button onClick={() => setSidebarOpen(o => !o)} style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 6, cursor: "pointer", color: "#fff", padding: "4px 10px", fontSize: 13 }}>{sidebarOpen ? "◀" : "▶"}</button>
          <span style={{ fontSize: 10, background: "rgba(255,255,255,0.2)", color: "#fff", borderRadius: 4, padding: "2px 7px", fontWeight: 700 }}>BETA</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => router.push("/mypage?tab=agent")}
            style={{ background: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.28)", borderRadius: 8, cursor: "pointer", color: "#fff", fontWeight: 800, fontSize: 13, padding: "7px 14px" }}>
            🤖 AI運用管理
          </button>
          <button onClick={() => setTab("command")}
            style={{ background: "#fff", border: "none", borderRadius: 8, cursor: "pointer", color: "#7c3aed", fontWeight: 700, fontSize: 13, padding: "7px 16px" }}>
            目的から開始
          </button>
        </div>
      </div>

      <div style={{ display: "flex", minHeight: "calc(100vh - 56px)" }}>

        {/* ── サイドナビ ── */}
        <div style={{ width: sidebarOpen ? 200 : 0, background: "#fff", borderRight: sidebarOpen ? "1px solid #e9d5ff" : "none", padding: sidebarOpen ? "20px 0" : 0, flexShrink: 0, display: "flex", flexDirection: "column", gap: 2, overflow: "hidden", transition: "width 0.2s" }}>
          {([
            { key: "command",  icon: "🧭", label: "目的から作成",      sub: "" },
            { key: "sites",    icon: "🌐", label: "媒体基盤",  sub: `${mappings.length}件` },
            { key: "cross",    icon: "🤖", label: "AIクロスメディア", sub: `${crossTasks.length}件` },
            { key: "monitoring", icon: "📈", label: "AI監視・市場調査", sub: `${monitoringTasks.length}件` },
            { key: "interview", icon: "🤝", label: "面接メモ", sub: "" },
            { key: "create",   icon: "➕", label: "詳細作成",      sub: "補助" },
            { key: "tasks",    icon: "📋", label: "承認・実行",      sub: `${tasks.length}件` },
            { key: "batch",    icon: "⏩", label: "複数へ一括",        sub: `${batches.length}件` },
            { key: "schedule", icon: "📅", label: "予約実行",    sub: `${schedules.length}件` },
            { key: "logs",     icon: "📜", label: "実行履歴",        sub: `${logs.length}件` },
            { key: "health",   icon: "⚠️", label: "異常確認",        sub: errorSites > 0 ? `${errorSites}件` : "" },
          ] as {key: Tab; icon: string; label: string; sub: string}[]).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 20px", background: tab === t.key ? "#f5f3ff" : "none", border: "none", borderLeft: tab === t.key ? "3px solid #7c3aed" : "3px solid transparent", cursor: "pointer", textAlign: "left", width: "100%" }}>
              <span style={{ fontSize: 16 }}>{t.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: tab === t.key ? 700 : 500, color: tab === t.key ? "#7c3aed" : "#374151" }}>{t.label}</div>
                {t.sub && <div style={{ fontSize: 10, color: t.key === "health" && errorSites > 0 ? "#dc2626" : "#9ca3af", marginTop: 1 }}>{t.sub}</div>}
              </div>
            </button>
          ))}

          <button onClick={() => setDebugMode(d => !d)}
            style={{ display: "none", margin: "12px 12px 0", padding: "6px 10px", borderRadius: 8, border: "1px solid #e9d5ff", background: debugMode ? "#f5f3ff" : "#fff", color: debugMode ? "#7c3aed" : "#9ca3af", fontSize: 10, fontWeight: 700, cursor: "pointer", width: "calc(100% - 24px)" }}>
            {debugMode ? "🔧 開発者モード ON" : "🔧 開発者モード"}
          </button>
        </div>

        {/* ── メインコンテンツ ── */}
        <div style={{ flex: 1, padding: "24px 28px", overflowY: "auto", minWidth: 0 }}>

          {/* メッセージ */}
          {msg && (
            <div style={{ background: "#f5f3ff", border: "1px solid #c4b5fd", borderRadius: 8, padding: "10px 16px", marginBottom: 16, fontSize: 13, color: "#7c3aed", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span>{msg}</span>
              <button onClick={() => setMsg("")} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: 18 }}>×</button>
            </div>
          )}

          {/* ページタイトル */}
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: "#1e1b4b", margin: 0 }}>
              {{ command: "🧭 目的から作成", sites: "🌐 媒体基盤", cross: "🤖 AIクロスメディア", monitoring: "📈 AI監視・市場調査", interview: "🤝 面接メモ", create: "➕ 詳細作成", tasks: "📋 承認・実行", batch: "⏩ 複数へ一括", schedule: "📅 予約実行", logs: "📜 実行履歴", health: "⚠️ 異常確認" }[tab]}
            </h2>
            <p style={{ fontSize: 12, color: "#6b7280", margin: "4px 0 0" }}>
              {{ command: "AIが目的を整理し、次に進む画面または承認待ちタスクへつなぎます。チャット画面からの自然文入力にも対応しています", sites: "ログイン情報・媒体構造・任意補助解析を管理します。AI本実行の土台です", cross: "AI生成・求人対応・同一/別媒体展開を承認待ちタスクへつなぎます", monitoring: "AIで投稿量・未投稿・競合・市場信号を調査し、クロスメディアへ引き継ぎます", interview: "面接を自動化せず、質問案・評価軸・判断メモを作成します", create: "通常は目的から作成/AIクロスメディアを使います。ここは操作種別やpayloadを直接指定する補助画面です", tasks: "作成済みタスクを承認・却下・実行・削除します", batch: "複数サイトへ同じ操作の承認待ちタスクをまとめて作ります", schedule: "決まった日時に承認制タスクを作る予約を設定します", logs: "実行結果を新しい順に確認します", health: "エラー・未設定・異常を確認します" }[tab]}
            </p>
          </div>

          {/* ─────────── SECTION: Agent司令塔 ─────────── */}
          {tab === "command" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "18px 20px" }}>
                <div style={{ fontSize: 13, fontWeight: 900, color: "#1e1b4b", marginBottom: 8 }}>AI委託: 目的・ゴールから開始</div>
                <div style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.6, marginBottom: 8 }}>
                  ここに自然文で書くと、AIが目的を整理して推奨画面または承認待ちタスクへつなぎます。チャット画面のAgent入力からも同じタスク作成に対応しています。
                </div>
                <textarea value={goalInput} onChange={e => setGoalInput(e.target.value)}
                  placeholder="例：投稿が止まっている対象を見つけたい / サイトAの情報をサイトBへ反映したい / 予約につながる運用を整理したい"
                  style={{ width: "100%", minHeight: 96, padding: "12px 14px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, resize: "vertical", boxSizing: "border-box", lineHeight: 1.6 }} />
                <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                  <button onClick={handleGoalAnalyze} disabled={goalLoading}
                    style={{ padding: "9px 22px", borderRadius: 8, border: "none", background: goalLoading ? "#9ca3af" : "#7c3aed", color: "#fff", fontWeight: 800, cursor: goalLoading ? "not-allowed" : "pointer", fontSize: 13 }}>
                    {goalLoading ? "整理中..." : "入力内容を整理"}
                  </button>
                  {goalPlan?.route_tab && (
                    <button onClick={() => openGoalTab(goalPlan.route_tab)}
                      style={{ padding: "9px 18px", borderRadius: 8, border: "1px solid #c4b5fd", background: "#fff", color: "#7c3aed", fontWeight: 800, cursor: "pointer", fontSize: 13 }}>
                      推奨画面へ進む
                    </button>
                  )}
                  <button onClick={handleGoalCreateTask} disabled={goalCreating || !goalInput.trim()}
                    style={{ padding: "9px 18px", borderRadius: 8, border: "none", background: (goalCreating || !goalInput.trim()) ? "#9ca3af" : "#15803d", color: "#fff", fontWeight: 800, cursor: (goalCreating || !goalInput.trim()) ? "not-allowed" : "pointer", fontSize: 13 }}>
                    {goalCreating ? "作成中..." : "入力からタスク作成"}
                  </button>
                  <button onClick={() => router.push("/chat")}
                    style={{ padding: "9px 18px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff", color: "#334155", fontWeight: 800, cursor: "pointer", fontSize: 13 }}>
                    チャット入力へ
                  </button>
                </div>
              </div>

              <div style={{ background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: 10, padding: "14px 18px" }}>
                <div style={{ fontSize: 13, fontWeight: 900, color: "#0f172a", marginBottom: 10 }}>すぐ使う</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
                  {[
                    ["媒体基盤", "sites", "ログイン・構造・補助解析"],
                    ["AIクロスメディア", "cross", "生成・求人・媒体展開"],
                    ["1件だけ作る", "create", "サイトを選んで作成"],
                    ["投稿を監視", "monitoring", "未投稿・競合確認"],
                    ["面接メモ", "interview", "質問案と評価軸"],
                    ["予約する", "schedule", "定期実行の予約"],
                    ["承認・実行", "tasks", "作成済みを処理"],
                    ["履歴を見る", "logs", "新しい順の結果"],
                  ].map(([label, nextTab, body]) => (
                    <button key={label} onClick={() => setTab(nextTab as Tab)}
                      style={{ textAlign: "left", border: "1px solid #e2e8f0", background: "#fff", borderRadius: 8, padding: "10px 12px", cursor: "pointer" }}>
                      <div style={{ fontSize: 12, fontWeight: 900, color: "#1e1b4b" }}>{label}</div>
                      <div style={{ fontSize: 11, color: "#64748b", marginTop: 3 }}>{body}</div>
                    </button>
                  ))}
                </div>
              </div>

              {goalPlan ? (
                <>
                  <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "16px 20px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                      <span style={{ fontSize: 12, fontWeight: 900, color: "#1e1b4b" }}>Agent判断</span>
                      <span style={{ fontSize: 11, fontWeight: 800, color: "#7c3aed", background: "#f5f3ff", border: "1px solid #ddd6fe", borderRadius: 999, padding: "3px 9px" }}>{goalPlan.mode}</span>
                      <span style={{ fontSize: 11, fontWeight: 800, color: "#0f766e", background: "#ecfdf5", border: "1px solid #bbf7d0", borderRadius: 999, padding: "3px 9px" }}>{goalPlan.autonomy_level || "READY_TO_GUIDE"}</span>
                      <span style={{ fontSize: 11, color: "#6b7280" }}>信頼度 {Math.round((goalPlan.confidence || 0) * 100)}%</span>
                    </div>
                    <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.7, marginBottom: 12 }}>{goalPlan.summary}</div>
                    {!!goalPlan.missing_capabilities?.length && (
                      <div style={{ marginBottom: 12, padding: "9px 11px", borderRadius: 8, border: "1px solid #fde68a", background: "#fffbeb" }}>
                        <div style={{ fontSize: 11, color: "#92400e", fontWeight: 900, marginBottom: 4 }}>任せる前に足りないもの</div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {goalPlan.missing_capabilities.map(m => <span key={m} style={{ fontSize: 11, color: "#92400e", background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 999, padding: "3px 8px", fontWeight: 800 }}>{m}</span>)}
                        </div>
                      </div>
                    )}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8 }}>
                      {[
                        ["媒体", goalPlan.readiness.mappings],
                        ["READY", goalPlan.readiness.ready_operations],
                        ["監視", goalPlan.readiness.monitoring_tasks],
                        ["クロスメディア", goalPlan.readiness.cross_tasks],
                        ["承認待ち", goalPlan.readiness.pending_tasks],
                        ["要確認", goalPlan.readiness.blocked_tasks],
                      ].map(([label, value]) => (
                        <div key={String(label)} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "9px 10px", background: "#f8fafc" }}>
                          <div style={{ fontSize: 10, color: "#64748b", fontWeight: 800 }}>{String(label)}</div>
                          <div style={{ fontSize: 20, color: "#1e1b4b", fontWeight: 900 }}>{String(value ?? 0)}</div>
                        </div>
                      ))}
                    </div>
                    {!!goalPlan.tool_selection?.length && (
                      <div style={{ marginTop: 12 }}>
                        <div style={{ fontSize: 12, fontWeight: 900, color: "#1e1b4b", marginBottom: 8 }}>Agent Tool Stack</div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
                          {goalPlan.tool_selection.slice(0, 6).map(tool => (
                            <button key={tool.tool} onClick={() => openGoalTab(tool.tab)}
                              style={{ textAlign: "left", border: "1px solid #e5e7eb", borderRadius: 8, background: "#fff", padding: "9px 10px", cursor: "pointer" }}>
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                                <span style={{ fontSize: 12, fontWeight: 900, color: "#1e1b4b" }}>{tool.tool}</span>
                                <span style={{ fontSize: 11, fontWeight: 900, color: tool.score >= 80 ? "#15803d" : tool.score >= 50 ? "#92400e" : "#64748b" }}>{tool.score}</span>
                              </div>
                              <div style={{ height: 5, background: "#f1f5f9", borderRadius: 999, margin: "7px 0", overflow: "hidden" }}>
                                <div style={{ width: `${tool.score}%`, height: "100%", background: tool.score >= 80 ? "#22c55e" : tool.score >= 50 ? "#f59e0b" : "#94a3b8" }} />
                              </div>
                              <div style={{ fontSize: 10, color: "#64748b", lineHeight: 1.45 }}>{tool.reason}</div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
                    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "14px 16px" }}>
                      <div style={{ fontSize: 12, fontWeight: 900, color: "#1e1b4b", marginBottom: 8 }}>実行レイヤー</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                        {goalPlan.workstream.map(row => {
                          const ok = row.status === "OK" || row.status === "READY";
                          return (
                            <button key={row.phase} onClick={() => openGoalTab(row.tab)}
                              style={{ width: "100%", textAlign: "left", border: `1px solid ${ok ? "#bbf7d0" : "#fde68a"}`, background: ok ? "#f0fdf4" : "#fffbeb", borderRadius: 8, padding: "8px 10px", cursor: "pointer" }}>
                              <div style={{ fontSize: 12, color: "#111827", fontWeight: 800 }}>{row.title}</div>
                              <div style={{ fontSize: 10, color: ok ? "#15803d" : "#92400e", fontWeight: 800, marginTop: 2 }}>{row.status}</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "14px 16px" }}>
                      <div style={{ fontSize: 12, fontWeight: 900, color: "#1e1b4b", marginBottom: 8 }}>次アクション</div>
                      {goalPlan.next_actions.length === 0 ? (
                        <div style={{ fontSize: 12, color: "#64748b" }}>いま追加で必要な作業はありません。</div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                          {goalPlan.next_actions.map((a, idx) => (
                            <button key={`${a.label}-${idx}`} onClick={() => openGoalTab(a.tab)}
                              style={{ width: "100%", textAlign: "left", border: "1px solid #ddd6fe", background: "#f5f3ff", borderRadius: 8, padding: "8px 10px", cursor: "pointer" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ fontSize: 11, color: "#7c3aed", fontWeight: 900 }}>{a.status}</span>
                                <span style={{ fontSize: 12, color: "#1e1b4b", fontWeight: 900 }}>{a.label}</span>
                              </div>
                              <div style={{ fontSize: 11, color: "#475569", marginTop: 3, lineHeight: 1.5 }}>{a.reason}</div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: 10, padding: "14px 18px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 10 }}>
                  {[
                    ["媒体基盤", "登録、ログイン、補助解析、READY化までを土台として扱います。"],
                    ["AIクロスメディア", "生成、求人対応、同一/別媒体展開を承認待ちタスクへ流します。"],
                    ["AI監視・市場調査", "投稿量、未投稿、競合、市場訴求を見ます。"],
                    ["承認・運用管理", "承認待ち、停止理由、スケジュールを追います。"],
                  ].map(([title, body]) => (
                    <div key={title} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "10px 12px" }}>
                      <div style={{ fontSize: 12, fontWeight: 900, color: "#1e1b4b", marginBottom: 4 }}>{title}</div>
                      <div style={{ fontSize: 11, color: "#475569", lineHeight: 1.5 }}>{body}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ─────────── SECTION: 媒体マッピング ─────────── */}
          {tab === "sites" && (
            <div>
              {/* 新規登録ボタン */}
              <div style={{ marginBottom: 16 }}>
                <button onClick={() => setShowWizard(prev => !prev)}
                  style={{ padding: "9px 20px", borderRadius: 8, border: "1px solid #7c3aed", background: showWizard ? "#ede9fe" : "#fff", color: "#7c3aed", cursor: "pointer", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                  {showWizard ? "▲ 閉じる" : "＋ 新規媒体を登録"}
                </button>
              </div>

              {/* ウィザード */}
              {showWizard && (
                <div style={{ background: "#fff", border: "2px solid #7c3aed", borderRadius: 12, padding: 24, marginBottom: 24 }}>
                  {/* ステップインジケーター */}
                  <div style={{ display: "flex", alignItems: "center", marginBottom: 24 }}>
                    {[1,2,3].map((s, i) => (
                      <div key={s} style={{ display: "flex", alignItems: "center", flex: i < 2 ? 1 : "none" }}>
                        <div style={{ width: 32, height: 32, borderRadius: "50%", background: wizardStep >= s ? "#7c3aed" : "#f3f4f6", color: wizardStep >= s ? "#fff" : "#9ca3af", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                          {wizardStep > s ? "✓" : s}
                        </div>
                        <div style={{ fontSize: 11, color: wizardStep >= s ? "#7c3aed" : "#9ca3af", marginLeft: 6, whiteSpace: "nowrap", fontWeight: wizardStep === s ? 700 : 400 }}>
                          {["媒体登録","認証登録","完了"][s-1]}
                        </div>
                        {i < 2 && <div style={{ flex: 1, height: 2, background: wizardStep > s ? "#7c3aed" : "#e5e7eb", margin: "0 10px" }} />}
                      </div>
                    ))}
                  </div>

                  {wizardStep === 1 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#1e1b4b", marginBottom: 4 }}>AIが扱う媒体基盤の情報を入力してください</div>
                      <select value={siteIndustry} onChange={e => setSiteIndustry(e.target.value)}
                        style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14, color: "#111827" }}>
                        {Object.entries(INDUSTRY_TEMPLATES_UI).map(([key, val]) => <option key={key} value={key}>{val.label}</option>)}
                      </select>
                      {siteIndustry !== "other" && (
                        <div style={{ fontSize: 12, color: "#6b7280", background: "#f9fafb", borderRadius: 6, padding: "8px 12px" }}>
                          {`${INDUSTRY_TEMPLATES_UI[siteIndustry]?.entity}・${INDUSTRY_TEMPLATES_UI[siteIndustry]?.schedule}・${INDUSTRY_TEMPLATES_UI[siteIndustry]?.news}・${INDUSTRY_TEMPLATES_UI[siteIndustry]?.media} などを自動化できます`}
                        </div>
                      )}
                      <input value={siteName} onChange={e => setSiteName(e.target.value)} placeholder="媒体名（例：体入ドラフト）"
                        style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }} />
                      <input value={siteUrl} onChange={e => setSiteUrl(e.target.value)} placeholder="ログインページのURL（例：https://...）"
                        style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }} />
                      <button onClick={handleWizardStep1}
                        style={{ padding: "10px 24px", borderRadius: 8, border: "none", background: "#7c3aed", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 14, alignSelf: "flex-start" }}>
                        次へ →
                      </button>
                    </div>
                  )}

                  {wizardStep === 2 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#1e1b4b" }}>ログインID・パスワードを登録してください</div>
                      {templateDetected && (
                        <div style={{ fontSize: 12, color: "#065f46", background: "#ecfdf5", borderRadius: 8, padding: "10px 14px", border: "1px solid #6ee7b7" }}>
                          ✅ この媒体の設定テンプレートを検出しました。URL構造・メニュー設定を自動コピー済みです。ログイン情報を入力するだけですぐに使えます。
                        </div>
                      )}
                      <div style={{ fontSize: 12, color: "#6b7280", background: "#f0fdf4", borderRadius: 8, padding: "10px 14px", border: "1px solid #bbf7d0" }}>
                        🔒 入力情報は暗号化して安全に保存されます。外部送信はありません。
                      </div>
                      <input value={siteLoginId} onChange={e => setSiteLoginId(e.target.value)} placeholder="ログインID（メールアドレス等）"
                        style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }} />
                      <input type="password" value={siteLoginPass} onChange={e => setSiteLoginPass(e.target.value)} placeholder="パスワード"
                        style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }} />
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => setWizardStep(1)} style={{ padding: "10px 18px", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", color: "#6b7280", cursor: "pointer", fontSize: 14 }}>← 戻る</button>
                        <button onClick={async () => {
                          if (!siteLoginId || !siteLoginPass) { setMsg("IDとパスワードを入力してください"); return; }
                          if (!createdMappingId) { setMsg("サイト情報が未登録です。STEP1からやり直してください"); return; }
                          setWizardConnecting(true);
                          try {
                            let exists = mappings.some(m => m.mapping_id === createdMappingId);
                            if (!exists) { const latest = await listMediaMappings(); setMappings(latest.mappings); exists = latest.mappings.some(m => m.mapping_id === createdMappingId); }
                            if (!exists) { setMsg("媒体基盤情報が見つかりません。STEP1からやり直してください"); setCreatedMappingId(""); setWizardStep(1); return; }
                            await saveMediaCredential(createdMappingId, siteLoginId, siteLoginPass);
                            setSiteLoginId(""); setSiteLoginPass("");
                            try { const lc = await loginCheckMediaMapping(createdMappingId); setLoginCheckResults(prev => ({ ...prev, [createdMappingId]: { login_success: lc.login_success, message: lc.message } })); } catch { /* ログインチェック失敗はSTEP3で表示 */ }
                            await fetchAll();
                            setWizardStep(3); setMsg(""); // step3=完了
                          } catch (e: unknown) {
                            const err = e as Error;
                            if (err.message?.includes("404")) { setMsg("媒体基盤情報が見つかりません。STEP1からやり直してください"); setCreatedMappingId(""); setWizardStep(1); }
                            else { setMsg(err.message); }
                          } finally { setWizardConnecting(false); }
                        }} disabled={wizardConnecting}
                          style={{ padding: "10px 24px", borderRadius: 8, border: "none", background: wizardConnecting ? "#9ca3af" : "#7c3aed", color: "#fff", fontWeight: 700, cursor: wizardConnecting ? "not-allowed" : "pointer", fontSize: 14 }}>
                          {wizardConnecting ? "保存中..." : "次へ →"}
                        </button>
                      </div>
                    </div>
                  )}

                  {wizardStep === 3 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "center", padding: "20px 0" }}>
                      <div style={{ fontSize: 48 }}>🎉</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: "#1e1b4b" }}>「{siteName}」の媒体基盤を登録しました</div>
                      <div style={{ fontSize: 13, color: "#6b7280", textAlign: "center", maxWidth: 340, lineHeight: 1.6 }}>AI整備済みの媒体はそのまま使えます。未整備の媒体はAI整備でログインフォームと入力フィールドを保存します。</div>
                      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                        <button onClick={resetWizard} style={{ padding: "9px 18px", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", color: "#6b7280", cursor: "pointer", fontSize: 13 }}>別の媒体を追加</button>
                        <button onClick={() => { setTab("create"); resetWizard(); }} style={{ padding: "9px 18px", borderRadius: 8, border: "none", background: "#7c3aed", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>タスクを作成する →</button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 登録済みサイト一覧 */}
              {mappings.length === 0 ? (
                <div style={{ textAlign: "center", padding: "60px 0", color: "#9ca3af" }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>🌐</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#374151", marginBottom: 6 }}>まだ媒体基盤がありません</div>
                  <div style={{ fontSize: 12 }}>上のボタンから最初の媒体を登録してください</div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {/* 媒体構成マップ（常に表示） */}
                  {mappings.length >= 2 && (() => {
                    const _isHome = (url: string, name: string) => /club-hana\.com|クラブ華|club.?hana/i.test(url + " " + name);
                    const _isRecruit = (url: string) => /qzin\.jp|q-pri\.com/i.test(url);
                    const _isAd = (url: string) => /cityheaven\.net|fuzoku\.jp/i.test(url);
                    const homeMedia = mappings.filter(m => _isHome(m.media_url, m.media_name));
                    const recruitMedia = mappings.filter(m => !_isHome(m.media_url, m.media_name) && _isRecruit(m.media_url));
                    const adMedia = mappings.filter(m => !_isHome(m.media_url, m.media_name) && _isAd(m.media_url));
                    const _getCount = (m: MediaMapping) => {
                      const effective = effectiveMenuItemsForDisplay(m, menuScanDetails[m.mapping_id]);
                      return Number(effective.summary?.total ?? effective.items.length ?? 0);
                    };
                    const branches: { label: string; icon: string; lineColor: string; neonColor: string; glowBg: string; border: string; items: typeof mappings }[] = [];
                    if (adMedia.length > 0) branches.push({ label: "広告", icon: "📢", lineColor: "#3b82f6", neonColor: "#60a5fa", glowBg: "rgba(59,130,246,0.12)", border: "rgba(96,165,250,0.35)", items: adMedia });
                    if (recruitMedia.length > 0) branches.push({ label: "求人", icon: "📋", lineColor: "#8b5cf6", neonColor: "#a78bfa", glowBg: "rgba(139,92,246,0.12)", border: "rgba(167,139,250,0.35)", items: recruitMedia });
                    const totalCount = mappings.reduce((sum, m) => sum + _getCount(m), 0);
                    const LC = "#8b5cf6";
                    return (
                      <div style={{ padding: "18px 20px 22px", background: "linear-gradient(rgba(139,92,246,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,0.07) 1px, transparent 1px), linear-gradient(135deg, #0d0b1e 0%, #130f2e 50%, #0a0818 100%)", backgroundSize: "28px 28px, 28px 28px, 100% 100%", border: "1px solid rgba(139,92,246,0.45)", borderRadius: 16, boxShadow: "0 0 0 1px rgba(139,92,246,0.10), 0 12px 48px rgba(88,28,220,0.35)", width: "100%", boxSizing: "border-box" as const }}>
                        {/* ヘッダー */}
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
                              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#8b5cf6", boxShadow: "0 0 7px #8b5cf6" }} />
                              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#3b82f6", boxShadow: "0 0 7px #3b82f6" }} />
                            </div>
                            <span style={{ fontSize: 10, color: "#c4b5fd", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase" as const }}>媒体連携マップ</span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span style={{ fontSize: 10, color: "#6d28d9", fontWeight: 600, letterSpacing: "0.08em", fontFamily: "monospace" }}>NODES: {mappings.length}</span>
                            {totalCount > 0 && <span style={{ fontSize: 12, color: "#e9d5ff", fontWeight: 800, background: "linear-gradient(135deg, rgba(139,92,246,0.35), rgba(109,40,217,0.20))", border: "1px solid rgba(167,139,250,0.45)", borderRadius: 20, padding: "4px 14px", boxShadow: "0 0 12px rgba(139,92,246,0.25)" }}>合計 {totalCount}機能</span>}
                          </div>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
                          {/* 自社HP ルートノード */}
                          {homeMedia.length > 0 ? homeMedia.map(hm => {
                            const hmCount = _getCount(hm);
                            return (
                              <div key={hm.mapping_id} style={{ background: "linear-gradient(135deg, #ffffff 0%, #f5f3ff 100%)", border: "2px solid #7c3aed", borderRadius: 14, padding: "12px 32px", boxShadow: "0 0 0 4px rgba(124,58,237,0.18), 0 0 28px rgba(124,58,237,0.50), 0 8px 24px rgba(0,0,0,0.50)" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                  <span style={{ fontSize: 22 }}>🏠</span>
                                  <div>
                                    <div style={{ fontSize: 15, fontWeight: 900, color: "#1e1b4b", letterSpacing: "-0.02em" }}>{hm.media_name}</div>
                                    <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 1, fontFamily: "monospace" }}>{(hm.media_url || "").replace(/^https?:\/\//, "").split("/")[0]}</div>
                                  </div>
                                  <div style={{ marginLeft: 8, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                                    <span style={{ fontSize: 9, fontWeight: 700, color: "#7c3aed", background: "#f5f3ff", border: "1px solid #ddd6fe", borderRadius: 4, padding: "2px 8px", letterSpacing: "0.06em" }}>自社HP</span>
                                    {hmCount > 0 && <span style={{ fontSize: 15, fontWeight: 900, color: "#7c3aed", fontFamily: "monospace", lineHeight: 1 }}>{hmCount}<span style={{ fontSize: 10, fontWeight: 600, marginLeft: 2 }}>機能</span></span>}
                                  </div>
                                </div>
                              </div>
                            );
                          }) : (
                            <div style={{ background: "linear-gradient(135deg, #ffffff 0%, #f5f3ff 100%)", border: "2px solid #7c3aed", borderRadius: 14, padding: "12px 32px", boxShadow: "0 0 0 4px rgba(124,58,237,0.18), 0 0 28px rgba(124,58,237,0.50)", display: "flex", alignItems: "center", gap: 12 }}>
                              <span style={{ fontSize: 22 }}>🏠</span>
                              <div style={{ fontSize: 15, fontWeight: 900, color: "#1e1b4b" }}>自社サイト</div>
                              <span style={{ fontSize: 9, fontWeight: 700, color: "#7c3aed", background: "#f5f3ff", border: "1px solid #ddd6fe", borderRadius: 4, padding: "2px 8px" }}>自社HP</span>
                            </div>
                          )}
                          {branches.length > 0 && (
                            <>
                              {/* 縦幹（グリッド中央に正確に接続） */}
                              <div style={{ display: "flex", justifyContent: "center", width: "100%" }}>
                                <div style={{ width: 2, height: 28, background: `linear-gradient(to bottom, #7c3aed, ${LC})`, boxShadow: `0 0 8px ${LC}` }} />
                              </div>
                              {/* ブランチグリッド：1fr×N で列幅均等 → センター位置が一致 */}
                              <div style={{ display: "grid", gridTemplateColumns: `repeat(${branches.length}, 1fr)`, gap: 0, width: "100%" }}>
                                {branches.map((branch, idx) => (
                                  <div key={branch.label} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                                    {/* T字アーム：左右 flex:1 の borderTop で幹中央と必ず交差 */}
                                    <div style={{ display: "flex", width: "100%", height: 28 }}>
                                      <div style={{ flex: 1, borderTop: idx > 0 ? `2px solid ${LC}` : "none" }} />
                                      <div style={{ width: 2, background: LC, boxShadow: `0 0 6px ${LC}` }} />
                                      <div style={{ flex: 1, borderTop: idx < branches.length - 1 ? `2px solid ${LC}` : "none" }} />
                                    </div>
                                    {/* ブランチカード */}
                                    <div style={{ width: "100%", padding: "0 10px", boxSizing: "border-box" as const }}>
                                      <div style={{ background: "rgba(10,6,24,0.75)", border: `1px solid ${branch.border}`, borderTop: `3px solid ${branch.lineColor}`, borderRadius: 12, padding: "14px 14px 16px", boxShadow: `0 0 20px ${branch.glowBg}, inset 0 1px 0 rgba(255,255,255,0.05)` }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14 }}>
                                          <span style={{ fontSize: 13 }}>{branch.icon}</span>
                                          <span style={{ fontSize: 12, fontWeight: 800, color: branch.neonColor, letterSpacing: "0.12em", textTransform: "uppercase" as const }}>{branch.label}</span>
                                          <div style={{ flex: 1, height: 1, background: `linear-gradient(to right, ${branch.border}, transparent)` }} />
                                        </div>
                                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" as const, justifyContent: "center" }}>
                                          {branch.items.map(mi => {
                                            const cnt = _getCount(mi);
                                            return (
                                              <div key={mi.mapping_id} style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${branch.border}`, borderRadius: 10, padding: "10px 14px", textAlign: "center", boxShadow: `0 0 12px ${branch.glowBg}`, minWidth: 80, flex: 1 }}>
                                                <div style={{ fontWeight: 800, color: "#f1f5f9", fontSize: 13 }}>{mi.media_name}</div>
                                                <div style={{ fontSize: 9, color: "#475569", marginTop: 3, fontFamily: "monospace" }}>{mi.media_url.replace(/^https?:\/\//, "").split("/")[0]}</div>
                                                {cnt > 0 && <div style={{ fontSize: 15, color: branch.neonColor, marginTop: 7, fontWeight: 900, fontFamily: "monospace", textShadow: `0 0 8px ${branch.neonColor}` }}>{cnt}<span style={{ fontSize: 9, fontWeight: 600, marginLeft: 2 }}>機能</span></div>}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                  {/* 折りたたみトグル */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600 }}>登録媒体 {mappings.length}件</span>
                    <button onClick={() => setSitesCollapsed(v => !v)}
                      style={{ padding: "2px 10px", borderRadius: 6, border: "1px solid #e5e7eb", background: "#fff", color: "#6b7280", cursor: "pointer", fontSize: 11 }}>
                      {sitesCollapsed ? "▼ 表示" : "▲ 折りたたむ"}
                    </button>
                  </div>
                  {!sitesCollapsed && <><div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {mappings.map(m => {
                    const hasCredential = !!m.credential_secret_name && (m as unknown as Record<string, unknown>).credential_registered !== false;
                    const checkResult = loginCheckResults[m.mapping_id];
                    const connStatus = (m.login_health === "HEALTHY") ? "ok" : checkResult ? (checkResult.login_success ? "ok" : "error") : (hasCredential ? "ok" : "error");
                    const statusInfo = {
                      ok:    { label: "🟢 正常",       color: "#15803d", bg: "#f0fdf4", border: "#bbf7d0" },
                      error: { label: "🔴 要設定",     color: "#b91c1c", bg: "#fef2f2", border: "#fca5a5" },
                    }[connStatus];
                    const schemaFirst = ((m.schema_first || {}) as Record<string, unknown>);
                    const schemaData = schemaPreview[m.mapping_id] || null;
                    const schemaLoading = !!schemaPreviewLoading[m.mapping_id];
                    const schemaDataFirst = (schemaData?.schema_first || {}) as Record<string, unknown>;
                    const schemaDataMedia = (schemaData?.media_schema || {}) as Record<string, unknown>;
                    const schemaStatus = String(schemaDataFirst.status || schemaFirst.status || "");
                    const schemaForms = Number(schemaDataFirst.forms_count || schemaFirst.forms_count || schemaDataMedia.forms_count || schemaData?.counts?.forms_total || 0);
                    const schemaFields = Number(schemaDataFirst.canonical_fields_count || schemaFirst.canonical_fields_count || schemaDataMedia.canonical_fields_count || schemaData?.counts?.fields_total || 0);
                    const schemaEntities = Number(schemaDataFirst.entities_count || schemaFirst.entities_count || schemaDataMedia.entities_count || 0);
                    const schemaStorage = String(schemaDataFirst.storage_mode || schemaFirst.storage_mode || schemaDataMedia.storage_mode || "");
                    const schemaReady = (schemaStatus === "READY" || schemaForms > 0) && schemaForms > 0;
                    return (
                      <div key={m.mapping_id} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "18px 20px", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
                        {/* サイトヘッダー */}
                        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12, gap: 12 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: 15, color: "#1e1b4b" }}>{m.media_name}</div>
                            <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2, wordBreak: "break-all" }}>{m.media_url}</div>
                            {m.industry && m.industry !== "other" && <span style={{ display: "inline-block", marginTop: 4, fontSize: 11, color: "#7c3aed", background: "#f5f3ff", borderRadius: 4, padding: "1px 7px" }}>{INDUSTRY_TEMPLATES_UI[normalizeIndustryKey(m.industry)]?.label}</span>}
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <span style={{ fontSize: 11, fontWeight: 700, color: statusInfo.color, background: statusInfo.bg, border: `1px solid ${statusInfo.border}`, borderRadius: 6, padding: "3px 10px" }}>{statusInfo.label}</span>
                              <button
                                title="この媒体を削除"
                                onClick={async () => {
                                  if (!window.confirm(`「${m.media_name || m.media_url}」を削除しますか？\nこの操作は取り消せません。`)) return;
                                  try {
                                    await deleteMediaMapping(m.mapping_id);
                                    setMsg("✅ 媒体を削除しました");
                                    fetchAll();
                                  } catch (e: unknown) { setMsg("❌ " + (e instanceof Error ? e.message : "削除失敗")); }
                                }}
                                style={{ fontSize: 11, padding: "3px 8px", borderRadius: 5, border: "1px solid #fca5a5", background: "#fff", color: "#dc2626", cursor: "pointer", lineHeight: 1 }}>
                                🗑
                              </button>
                            </div>
                            {/* スキャン状態インジケーター */}
                            {(() => {
                              const mx = (m as unknown) as Record<string, unknown>;
                              const sp = mx.scan_progress as Record<string, unknown> | undefined;
                              const spStatus = String(sp?.status || "");
                              const isRunning = spStatus === "RUNNING";
                              const effective = effectiveMenuItemsForDisplay(m, menuScanDetails[m.mapping_id]);
                              const ms = effective.summary;
                              const total = Number(ms?.total ?? effective.items.length ?? 0);
                              const scanned = Number(ms?.scanned ?? 0);
                              const failed = Number(ms?.failed ?? 0);
                              if (isRunning) return <span style={{ fontSize: 10, color: "#1d4ed8", fontWeight: 600, padding: "2px 8px", background: "#eff6ff", borderRadius: 4, border: "1px solid #bfdbfe" }}>🔵 解析中...</span>;
                              if (failed > 0) return <span style={{ fontSize: 10, color: "#dc2626", padding: "2px 8px", background: "#fef2f2", borderRadius: 4, border: "1px solid #fca5a5" }}>⚠ {failed}件失敗</span>;
                              if (total > 0 && scanned >= total) return <span style={{ fontSize: 10, color: "#15803d", padding: "2px 8px", background: "#f0fdf4", borderRadius: 4, border: "1px solid #bbf7d0" }}>✅ {total}件完了</span>;
                              if (total > 0) return <span style={{ fontSize: 10, color: "#b45309", padding: "2px 8px", background: "#fefce8", borderRadius: 4, border: "1px solid #fde68a" }}>🟡 {total}件登録済</span>;
                              return null;
                            })()}
                          </div>
                        </div>

                        {m.last_verified_at && <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 10 }}>最終確認: {new Date(m.last_verified_at).toLocaleString("ja-JP")}</div>}

                        {/* ──── 🗺️ ページを選んで設定する（統合セクション） ──── */}
                        {m.credential_secret_name && m.login_url && (() => {
                          const effective = effectiveMenuItemsForDisplay(m, menuScanDetails[m.mapping_id]);
                          const _menuItems = effective.items;
                          const _summary = effective.summary;
                          const _tone = menuScanTone(_summary);

                          const _grouped: Record<string, MenuDisplayItem[]> = {};
                          _menuItems.forEach(item => {
                            const cat = item.category || "その他";
                            if (!_grouped[cat]) _grouped[cat] = [];
                            _grouped[cat].push(item);
                          });

                          const _inferIntent = (label: string): string => {
                            const l = label;
                            if (/新規|登録|追加|作成|create|add|new|register/i.test(l)) return "新規登録ページ";
                            if (/編集|更新|修正|edit|update|modify/i.test(l)) return "編集ページ";
                            if (/一覧|リスト|検索|list|search|index/i.test(l)) return "一覧ページ";
                            if (/削除|delete|remove/i.test(l)) return "削除ページ";
                            if (/出勤|スケジュール|schedule|shift/i.test(l)) return "スケジュールページ";
                            if (/写メ|写真|photo|image|gallery|upload/i.test(l)) return "メディアアップロードページ";
                            if (/プロフィール|情報|profile|info/i.test(l)) return "情報編集ページ";
                            return "";
                          };

                          const openDialog = async (pageUrl: string, pageName: string) => {
                            setDialogMappingId(m.mapping_id);
                            setDialogOpType(pageName);
                            setDialogPageUrl(pageUrl);
                            setDialogSteps([]);
                            setDialogStepIdx(0);
                            setDialogCustomVal("");
                            setDialogDone(false);
                            setDialogError("");
                            setDialogConfirmed({});
                            setDialogSaving(false);
                            setDialogPreviewImg(null);
                            setDialogPreviewIdx(null);
                            setDialogPreviewError("");
                            setDialogDiscoveredTabs([]);
                            setDialogDiscoveredMappingId(m.mapping_id);
                            setDialogLoading(true);
                            try {
                              const intent = _inferIntent(pageName);
                              const r = await scanOperationDialog(m.mapping_id, pageUrl, pageName, intent);
                              setDialogSteps(r.steps);
                              if (r.discovered_tabs && r.discovered_tabs.length > 0) {
                                setDialogDiscoveredTabs(r.discovered_tabs);
                              }
                            } catch (e: unknown) {
                              setDialogError((e as Error).message || "スキャン失敗");
                            } finally { setDialogLoading(false); }
                          };

                          return (
                            <div style={{ marginBottom: 14 }}>
                              {_summary && (
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "8px 10px", borderRadius: 8, background: _tone.bg, border: `1px solid ${_tone.border}`, marginBottom: 8, flexWrap: "wrap" as const }}>
                                  <div style={{ fontSize: 11, color: _tone.main, fontWeight: 800 }}>
                                    {menuScanTitle(_summary)} <span style={{ fontWeight: 600 }}>{menuScanSummaryLine(_summary)}</span>
                                  </div>
                                  <div style={{ fontSize: 10, color: "#64748b", fontWeight: 700 }}>
                                    表示元: {effective.source === "deep_scan" ? "AI整備結果" : "HTML/URL候補"}
                                  </div>
                                </div>
                              )}
                              {!_summary && _menuItems.length > 0 && (
                                <div style={{ padding: "8px 10px", borderRadius: 8, background: "#f8fafc", border: "1px solid #cbd5e1", marginBottom: 8 }}>
                                  <div style={{ fontSize: 11, color: "#475569", fontWeight: 800 }}>AI未整備 <span style={{ fontWeight: 600 }}>{_menuItems.length}URL候補</span></div>
                                </div>
                              )}
                              {_menuItems.length === 0 ? (
                                <div style={{ padding: "16px", background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0", marginBottom: 12, textAlign: "center" as const, fontSize: 12, color: "#64748b" }}>
                                  AI整備に使えるURL候補がまだありません。HTML貼り付けやURL登録は任意補助として追加できます。
                                </div>
                              ) : (
                                <div>
                                  {Object.entries(_grouped).map(([cat, items]) => (
                                    <div key={cat} style={{ marginBottom: 10 }}>
                                      <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700, marginBottom: 4 }}>{cat}</div>
                                      <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 6 }}>
                                        {items.map((item) => {
                                          const {label, url, message} = item;
                                          const st = menuDisplayStatusLabel(item);
                                          return (
                                          <button key={url} onClick={() => openDialog(url, label)}
                                            title={message || item.status || label}
                                            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 8, border: `1px solid ${st?.border || "#7c3aed"}`, background: st?.bg || "#fff", color: st?.color || "#7c3aed", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                                            {label}
                                            {st && <span style={{ fontSize: 9, fontWeight: 800, color: st.color }}>{st.label}</span>}
                                          </button>
                                        );})}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {/* ログイン情報未設定 or 再登録が必要 */}
                        {((m as unknown as Record<string, unknown>).credential_registered !== true || m.login_health === "BLOCKED" || (checkResult && !checkResult.login_success)) && (
                          <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: "12px 16px", marginBottom: 12 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: "#b91c1c", marginBottom: 8 }}>{hasCredential ? "🔑 ログイン情報を更新" : "⚠️ ログイン情報が未設定です"}</div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                              <input value={loginRegId} onChange={e => setLoginRegId(e.target.value)} placeholder="ログインID"
                                style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13 }} />
                              <input type="password" value={loginRegPass} onChange={e => setLoginRegPass(e.target.value)} placeholder="パスワード"
                                style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13 }} />
                              <button onClick={async () => {
                                if (!loginRegId || !loginRegPass) { setMsg("IDとパスワードを入力してください"); return; }
                                setLoginRegLoading(true);
                                try {
                                  await saveMediaCredential(m.mapping_id, loginRegId, loginRegPass);
                                  setLoginRegId(""); setLoginRegPass("");
                                  try { const r = await loginCheckMediaMapping(m.mapping_id); setLoginCheckResults(prev => ({ ...prev, [m.mapping_id]: { login_success: r.login_success, message: r.message } })); setMsg(r.login_success ? "ログイン情報を登録し、接続確認に成功しました" : "ログイン情報を保存しましたが、接続確認に失敗しました"); } catch { setMsg("ログイン情報を保存しましたが、接続確認に失敗しました"); }
                                  fetchAll();
                                } catch (e: unknown) { setMsg((e as Error).message); }
                                finally { setLoginRegLoading(false); }
                              }} disabled={loginRegLoading} style={{ padding: "8px 16px", borderRadius: 6, border: "none", background: loginRegLoading ? "#9ca3af" : "#b91c1c", color: "#fff", fontWeight: 600, cursor: loginRegLoading ? "not-allowed" : "pointer", fontSize: 13, alignSelf: "flex-start" }}>
                                {loginRegLoading ? "登録中..." : "登録する"}
                              </button>
                            </div>
                          </div>
                        )}

                        {checkResult && !checkResult.login_success && m.login_health !== "HEALTHY" && (
                          <ErrorCard msg={checkResult.message} />
                        )}

{/* 巡回指定UI非表示 */}
{false && <>
                          {/* 巡回指定UI */}
                          <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: "8px 10px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#f9fafb", marginBottom: 4 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <input type="number" min={10} max={1000} value={domScanMaxPages[m.mapping_id] ?? 200} onChange={e => setDomScanMaxPages(prev => ({ ...prev, [m.mapping_id]: Number(e.target.value) }))}
                                style={{ width: 64, padding: "5px 8px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 12 }} />
                              <span style={{ fontSize: 11, color: "#9ca3af" }}>ページ上限</span>
                            </div>
                            <input type="text" placeholder="巡回開始URL（任意）" value={domScanStartUrl[m.mapping_id] ?? ""} onChange={e => setDomScanStartUrl(prev => ({ ...prev, [m.mapping_id]: e.target.value }))}
                              style={{ padding: "5px 8px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 12, width: "100%" }} />
                            <input type="text" placeholder="含むURL（カンマ区切り、任意）" value={domScanInclude[m.mapping_id] ?? ""} onChange={e => setDomScanInclude(prev => ({ ...prev, [m.mapping_id]: e.target.value }))}
                              style={{ padding: "5px 8px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 12, width: "100%" }} />
                            <input type="text" placeholder="除くURL（カンマ区切り、任意）" value={domScanExclude[m.mapping_id] ?? ""} onChange={e => setDomScanExclude(prev => ({ ...prev, [m.mapping_id]: e.target.value }))}
                              style={{ padding: "5px 8px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 12, width: "100%" }} />
                          </div>
</> }
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
{/* DOM巡回ボタン非表示 */}
{false && <>
                          <button onClick={async () => {
                            setDomScanLoading(prev => ({ ...prev, [m.mapping_id]: true }));
                            setMsg("サイト構造を自動解析中...");
                            try {
                              const r = await scanMediaDom(m.mapping_id, domScanMaxPages[m.mapping_id] ?? 200, {
                                start_url: domScanStartUrl[m.mapping_id] || "",
                                include_patterns: (domScanInclude[m.mapping_id] || "").split(",").map(s=>s.trim()).filter(Boolean),
                                exclude_patterns: (domScanExclude[m.mapping_id] || "").split(",").map(s=>s.trim()).filter(Boolean),
                                reset_resume: false,
                              });
                              const d = await listMediaMappings(); setMappings(d.mappings);
                              if (r.detected_summary) setDomScanResults(prev => ({ ...prev, [m.mapping_id]: r.detected_summary as Record<string, unknown> }));
                              if (r.auto_applied && r.auto_apply_message) { setMsg("✅ " + String(r.auto_apply_message)); }
                              else { const hasSelector = r.selector_candidates || r.semantic_selector_candidates || r.capability_candidates || r.detected_summary; setMsg(hasSelector ? "✅ 自動解析完了。検出結果を確認してください。" : "✅ 自動解析完了。新たな候補は検出されませんでした。"); }
                            } catch (e: unknown) {
                              const raw = (e as Error).message || "自動解析に失敗しました";
                              setMsg(raw.includes("WAITING_EXECUTOR") ? "❌ 自動解析失敗：実行層未対応" : raw.includes("BLOCKED") ? "❌ 自動解析失敗：必要情報不足" : raw.includes("Playwright") || raw.includes("playwright") ? "❌ 自動解析失敗：ブラウザエンジン無効" : raw.includes("timeout") ? "❌ 自動解析失敗：接続タイムアウト" : raw.includes("login") ? "❌ 自動解析失敗：ログイン失敗" : "❌ 自動解析失敗：" + raw);
                            } finally { setDomScanLoading(prev => ({ ...prev, [m.mapping_id]: false })); }
                          }} disabled={domScanLoading[m.mapping_id] === true}
                            style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid #1a6fa8", background: domScanLoading[m.mapping_id] ? "#9ca3af" : "#fff", color: domScanLoading[m.mapping_id] ? "#fff" : "#1a6fa8", cursor: domScanLoading[m.mapping_id] ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 600 }}>
                            {domScanLoading[m.mapping_id] ? "解析中..." : "🔍 続きを解析"}
                          </button>
{false && <>                          <button onClick={async () => {
                            setDomScanLoading(prev => ({ ...prev, [m.mapping_id]: true }));
                            setMsg("最初からサイト構造を再解析中...");
                            try {
                              const r = await scanMediaDom(m.mapping_id, domScanMaxPages[m.mapping_id] ?? 200, {
                                start_url: domScanStartUrl[m.mapping_id] || "",
                                include_patterns: (domScanInclude[m.mapping_id] || "").split(",").map(s=>s.trim()).filter(Boolean),
                                exclude_patterns: (domScanExclude[m.mapping_id] || "").split(",").map(s=>s.trim()).filter(Boolean),
                                reset_resume: true,
                              });
                              const d = await listMediaMappings(); setMappings(d.mappings);
                              if (r.detected_summary) setDomScanResults(prev => ({ ...prev, [m.mapping_id]: r.detected_summary as Record<string, unknown> }));
                              setMsg("✅ 再解析完了");
                            } catch (e: unknown) {
                              setMsg("❌ 再解析失敗：" + ((e as Error).message || "不明なエラー"));
                            } finally { setDomScanLoading(prev => ({ ...prev, [m.mapping_id]: false })); }
                          }} disabled={domScanLoading[m.mapping_id] === true}
                            style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid #dc2626", background: "#fff", color: "#dc2626", cursor: domScanLoading[m.mapping_id] ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 600 }}>
                            🔄 最初から再解析
                          </button></> }
</> }
                        </div>

                        {domScanLoading[m.mapping_id] && (
                          <div style={{ padding: "10px 14px", borderRadius: 8, background: "#eff6ff", border: "1px solid #bfdbfe", fontSize: 12, color: "#1d4ed8", marginBottom: 10 }}>
                            ⏳ 解析中です。ログインフォーム・入力欄・ボタンを確認しています。
                          </div>
                        )}

                        {/* 解析状況 */}
                        {(() => {
                          if (!debugMode) return null;
                          const mx = m as unknown as Record<string, unknown>;
                          const stats = mx.analysis_stats as Record<string, unknown> | undefined;
                          const navGraph   = mx.navigation_graph as Record<string, unknown> | undefined;
                          const _opCandRaw2 = mx.operation_candidates as string[] | undefined;
                          const _opMapsRaw2 = (mx.operation_mappings as Record<string, {status?: string}> | undefined) || {};
                          const _opMapKeys2 = Object.keys(_opMapsRaw2).filter(op => ["READY","NEEDS_REVIEW"].includes(_opMapsRaw2[op]?.status || ""));
                          const _opStepsRaw2 = (mx.operation_steps_by_type as Record<string, unknown[]> | undefined) || {};
                          const _opStepKeys2 = Object.keys(_opStepsRaw2).filter(op => Array.isArray(_opStepsRaw2[op]) && (_opStepsRaw2[op] as unknown[]).length > 0);
                          const opCands2 = Array.from(new Set([...(_opCandRaw2 || []), ..._opMapKeys2, ..._opStepKeys2]));
                          const opMaps     = mx.operation_mappings as Record<string, {status?: string; executable?: boolean}> | undefined;
                          const crawlRuns  = stats?.crawl_runs as number || 0;
                          const _cs = mx.crawl_state as Record<string,unknown> | undefined;
                          const _ngPages = Array.isArray((navGraph as Record<string,unknown> | undefined)?.pages) ? ((navGraph as Record<string,unknown>).pages as unknown[]).length : (navGraph ? Object.keys(navGraph).filter(k => k !== 'pages' && k !== 'updated_at').length : 0);
                          const lastPages = Number(_cs?.pages_crawled || 0) || _ngPages || Number((mx.pages_crawled as number) || 0) || Number(((mx.detected_summary as Record<string,unknown>|undefined)?.pages_crawled as number) || 0) || 0;
                          const remainingUrls = Number(_cs?.resume_queue_count || 0) || Number(_cs?.remaining_count || 0) || (Array.isArray(mx.crawl_resume_queue) ? (mx.crawl_resume_queue as unknown[]).length : 0);
                          const opCount    = stats?.operation_candidates_count as number || (opCands2 ? opCands2.length : 0);
                          const opStepsDef = mx.operation_steps_by_type as Record<string, unknown[]> | undefined;
                          const _isExecReady = (op: string): boolean => { if (opMaps?.[op]?.status !== "READY") return false; if (!opStepsDef?.[op] || (opStepsDef[op] as unknown[]).length === 0) return false; if (!opMaps?.[op]?.executable) return false; return true; };
                          const execReadyCount = opCands2 ? opCands2.filter(op => _isExecReady(op)).length : 0;
                          const readyCount = opCands2 ? opCands2.filter(op => opMaps?.[op]?.status === "READY").length : 0;
                          const hasSteps = (op: string) => Array.isArray(opStepsDef?.[op]) && (opStepsDef[op] as unknown[]).length > 0;
                          const partialMappedCount = opCands2 ? opCands2.filter(op => opMaps?.[op]?.status === "NEEDS_REVIEW" && hasSteps(op)).length : 0;
                          const needsCount = opCands2 ? opCands2.filter(op => !_isExecReady(op) && !(opMaps?.[op]?.status === "NEEDS_REVIEW" && hasSteps(op))).length : Math.max(0, opCount - readyCount);
                          if (!crawlRuns && !opCount) return null;
                          return (
                            <div style={{ background: "#eef2ff", borderRadius: 8, padding: "10px 14px", marginBottom: 10 }}>
                              <div style={{ fontSize: 11, fontWeight: 700, color: "#4338ca", marginBottom: 6 }}>🔍 解析状況</div>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 16, fontSize: 12, color: "#3730a3" }}>
                                <span>解析回数 <strong>{crawlRuns}</strong></span>
                                <span>巡回ページ <strong>{lastPages}</strong></span>
                                {remainingUrls > 0 && <span style={{ color: "#b45309" }}>残りURL <strong>{remainingUrls}</strong></span>}
                                <span>操作候補 <strong>{opCount}</strong></span>
                                <span style={{ color: "#15803d" }}>実行可能 <strong>{execReadyCount}</strong></span>
                                <span style={{ color: "#b45309" }}>確認必要 <strong>{partialMappedCount}</strong></span>
                                {needsCount > 0 && <span style={{ color: "#6b7280" }}>未解析 <strong>{needsCount}</strong></span>}
                              </div>
                            </div>
                          );
                        })()}

                        {/* 媒体構造理解 P21.5 */}
                        {(() => {
                          if (!debugMode) return null;
                          const mx2 = m as unknown as Record<string, unknown>;
                          const sm = mx2.media_structure_map as Record<string,unknown> | undefined;
                          if (!sm) return null;
                          const summary = sm.summary as Record<string,unknown> | undefined;
                          const areas = sm.areas as Record<string,{pages:string[];operations:string[];ignored_reason?:string}> | undefined;
                          const eps = sm.operation_entrypoints as Record<string,{url:string;confidence:number;evidence:string[]}> | undefined;
                          const areaLabels: Record<string,string> = {content:"コンテンツ",entity:"エンティティ",media:"メディア",schedule:"スケジュール",price:"料金",reservation:"予約",customer:"顧客",analytics:"分析",system:"システム",help:"ヘルプ",unknown:"不明"};
                          const activeAreas = (summary?.areas_detected as string[] | undefined) || [];
                          return (
                            <details style={{ marginBottom: 8 }}>
                              <summary style={{ fontSize: 12, fontWeight: 700, color: "#0f766e", cursor: "pointer", padding: "6px 10px", background: "#f0fdfa", borderRadius: 6, border: "1px solid #99f6e4" }}>🗺️ 媒体構造理解 — 検出エリア {activeAreas.length} / 総ページ {String(summary?.total_pages ?? 0)} / 候補ページ {String(summary?.operation_candidate_pages ?? 0)} / 除外 {String(summary?.ignored_pages ?? 0)}</summary>
                              <div style={{ padding: "8px 10px", background: "#f0fdfa", borderRadius: "0 0 6px 6px", border: "1px solid #99f6e4", borderTop: "none" }}>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                                  {activeAreas.map(a => (
                                    <span key={a} style={{ padding: "2px 8px", borderRadius: 12, background: ["content","entity","media","schedule","price"].includes(a) ? "#ccfbf1" : "#f1f5f9", border: "1px solid #99f6e4", fontSize: 11, color: ["content","entity","media","schedule","price"].includes(a) ? "#0f766e" : "#64748b" }}>
                                      {areaLabels[a] || a} {areas?.[a]?.operations?.length ? `(${areas[a].operations.join("/")})` : areas?.[a]?.ignored_reason ? "⛔" : ""}
                                    </span>
                                  ))}
                                </div>
                                {eps && Object.keys(eps).length > 0 && (
                                  <div>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: "#0f766e", marginBottom: 4 }}>操作候補の入口</div>
                                    {Object.entries(eps).map(([op, ep]) => (
                                      <div key={op} style={{ fontSize: 11, color: "#0f766e", marginBottom: 2 }}>
                                        <strong>{op}</strong>: <span style={{ color: "#64748b", wordBreak: "break-all" }}>{ep.url}</span> (信頼度:{ep.confidence}) [{ep.evidence?.join(",")}]
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </details>
                          );
                        })()}
                        {/* PARTIAL バナー */}
                        {(() => {
                          const mx = m as unknown as Record<string, unknown>;
                          if (mx.crawl_status !== "PAUSED_TIMEOUT" && mx.crawl_status !== "PAUSED_REMAINING") return null;
                          return (
                            <div style={{ padding: "10px 14px", borderRadius: 8, background: "#fffbeb", border: "1px solid #fde68a", fontSize: 12, color: "#b45309", display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                              <span>🟡 サイト巡回が途中で止まっています。続きを解析できます。</span>
                              <button disabled={domScanLoading[m.mapping_id] === true}
                                onClick={async () => {
                                  const mid = m.mapping_id;
                                  setDomScanLoading(prev => ({ ...prev, [mid]: true }));
                                  setMsg("🔍 続きからサイト構造を解析中...");
                                  try { const r = await scanMediaDom(mid, domScanMaxPages[mid] ?? 200, { start_url: domScanStartUrl[mid] || "", include_patterns: (domScanInclude[mid] || "").split(",").map(s=>s.trim()).filter(Boolean), exclude_patterns: (domScanExclude[mid] || "").split(",").map(s=>s.trim()).filter(Boolean), reset_resume: false }); const d = await listMediaMappings(); setMappings(d.mappings); setMsg("✅ 解析完了"); if (r.detected_summary) setDomScanResults(prev => ({ ...prev, [mid]: r.detected_summary as Record<string, unknown> })); }
                                  catch(e: unknown) { setMsg("❌ " + (e instanceof Error ? e.message : "解析失敗")); }
                                  finally { setDomScanLoading(prev => ({ ...prev, [mid]: false })); }
                                }}
                                style={{ padding: "4px 12px", borderRadius: 6, border: "1px solid #b45309", background: "#fef3c7", color: "#b45309", cursor: "pointer", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>
                                {domScanLoading[m.mapping_id] ? "解析中..." : "🔍 続きを解析"}
                              </button>
                            </div>
                          );
                        })()}

                        {/* 実行安全系警告 */}
                        {(() => {
                          const mx2 = m as unknown as Record<string, unknown>;
                          const opMaps2  = mx2.operation_mappings as Record<string, {status?: string; executable?: boolean}> | undefined;
                          const navGraph2 = mx2.navigation_graph as Record<string, unknown> | undefined;
                          const hasCrawled = navGraph2 && Object.keys(navGraph2).length > 0;
                          const opStepsDef2 = mx2.operation_steps_by_type as Record<string, unknown[]> | undefined;
                          const _opCandRaw3 = mx2.operation_candidates as string[] | undefined;
                          const _opMapKeys3 = Object.keys(opMaps2 || {}).filter(op => ["READY","NEEDS_REVIEW"].includes((opMaps2 || {})[op]?.status || ""));
                          const _opStepKeys3 = Object.keys(opStepsDef2 || {}).filter(op => Array.isArray((opStepsDef2 || {})[op]) && ((opStepsDef2 || {})[op] as unknown[]).length > 0);
                          const opCands3 = Array.from(new Set([...(_opCandRaw3 || []), ..._opMapKeys3, ..._opStepKeys3]));
                          const execReady2 = opCands3 ? opCands3.filter(op => { if (opMaps2?.[op]?.status !== "READY") return false; if (!opStepsDef2?.[op] || (opStepsDef2[op] as unknown[]).length === 0) return false; if (!opMaps2?.[op]?.executable) return false; return true; }).length : 0;
                          if (!hasCrawled) return null;
                          const partialMappedCount2 = opCands3 ? opCands3.filter(op => opMaps2?.[op]?.status === "NEEDS_REVIEW" && opStepsDef2?.[op] && (opStepsDef2[op] as unknown[]).length > 0).length : 0;
                          if (execReady2 === 0 && partialMappedCount2 > 0) return null;
                          if (execReady2 === 0) return null;
                          return null;
                        })()}

                        {/* ログイン前設定 */}
                        {(domScanResults[m.mapping_id] || (m as unknown as Record<string, unknown>).detected_summary || Object.keys((m as unknown as Record<string, unknown>).dom_selectors as Record<string, unknown> || {}).length > 0) && (() => {
                          const ds = (domScanResults[m.mapping_id] || (m as unknown as Record<string, unknown>).detected_summary || {}) as Record<string, unknown>;
                          const domSel = (m as unknown as Record<string, unknown>).dom_selectors as Record<string, unknown> || {};
                          const rows: {label: string; value: unknown; icon: string}[] = [
                            { label: "ログインID欄",         icon: "👤", value: domSel.username || ds.login_id },
                            { label: "パスワード欄",         icon: "🔑", value: domSel.password || ds.password },
                            { label: "ログインボタン",       icon: "🔘", value: domSel.login_submit || ds.login_button },
                            { label: "ログイン後の目印候補", icon: "✅", value: (ds.verify_candidates as string[])?.join(", ") || null },
                            { label: "画像アップロード欄",   icon: "🖼️", value: (ds.file_inputs as string[])?.join(", ") || null },
                            { label: "投稿本文欄",           icon: "📝", value: (ds.textareas as string[])?.join(", ") || null },
                          ];
                          return (
                            <details style={{ background: "#eff6ff", borderRadius: 8, padding: "10px 14px", marginBottom: 10 }}>
                              <summary style={{ fontSize: 12, fontWeight: 700, color: "#1d4ed8", cursor: "pointer" }}>🔍 ログイン前設定を確認</summary>
                              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 4 }}>
                                {rows.map(row => (
                                  <div key={row.label} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 11 }}>
                                    <span style={{ minWidth: 16 }}>{row.icon}</span>
                                    <span style={{ color: "#1e40af", fontWeight: 600, minWidth: 140 }}>{row.label}</span>
                                    <span style={{ color: row.value ? "#1e3a5f" : "#9ca3af", fontFamily: "monospace", fontSize: 10 }}>{row.value ? String(row.value) : "未検出"}</span>
                                  </div>
                                ))}
                              </div>
                            </details>
                          );
                        })()}

                        {/* 操作候補 */}
                        {(() => {
                          const mx = m as unknown as Record<string, unknown>;
                          const caps = mx.capabilities as Record<string, boolean> | undefined;
                          const opCands = mx.operation_candidates as string[] | undefined;
                          const opSteps = mx.operation_steps_by_type as Record<string, {step_type: string}[]> | undefined;
                          const opMaps = mx.operation_mappings as Record<string, {status?: string; executable?: boolean}> | undefined;
                          const navGraph = mx.navigation_graph as Record<string, unknown> | undefined;
                          return null;
                          const CAP_LABEL: Record<string, string> = { can_login: "ログイン可能", can_verify: "ログイン後確認", can_update_text: "文章更新", can_post_news: "ニュース投稿", can_upload_image: "画像アップロード", can_update_schedule: "出勤・予定更新", can_update_price: "料金更新", can_register_entity: "新規登録", can_update_entity: "編集・更新", can_navigate_admin: "管理画面巡回" };
                          const _getOpStatus = (op: string): {icon: string; label: string; note: string} => {
                            const mapStatus = opMaps?.[op]?.status;
                            if (mapStatus === "READY") { const _mx3 = m as unknown as Record<string, unknown>; const _steps3 = (_mx3.operation_steps_by_type as Record<string, unknown[]> | undefined)?.[op]; const _execOk = opMaps?.[op]?.executable === true && _steps3 && _steps3.length > 0; if (_execOk) return { icon: "✅", label: "実行可能", note: "" }; return { icon: "🟠", label: "解析済", note: "対象画面を選択して再解析できます。" }; }
                            if (mapStatus === "NEEDS_REVIEW") { const _hasSteps = Array.isArray((m as unknown as Record<string, unknown>).operation_steps_by_type && ((m as unknown as Record<string, unknown>).operation_steps_by_type as Record<string, unknown[]>)?.[op]) && (((m as unknown as Record<string, unknown>).operation_steps_by_type as Record<string, unknown[]>)?.[op] as unknown[]).length > 0; if (_hasSteps) return { icon: "🟠", label: "要確認（steps生成済み）", note: "対象画面・入力欄・保存ボタンの確認が必要です。" }; return { icon: "🟠", label: "要確認", note: "候補は検出済みです。対象画面・入力欄・保存ボタンの確認が必要です。" }; }
                            const _resolvedStatus = mapStatus === "NEEDS_MAPPING" ? "UNDISCOVERED" : mapStatus === "PARTIAL" ? "NEEDS_REVIEW" : mapStatus;
                            if (_resolvedStatus === "UNDISCOVERED") return { icon: "⏳", label: "未発見", note: "巡回範囲内に該当操作が見つかりません。" };
                            if (mapStatus === "NEEDS_LOGIN_VERIFY") return { icon: "🔴", label: "ログイン後未到達", note: "ログイン確認を先に実行してください。" };
                            if (mapStatus === "WAITING_EXECUTOR")   return { icon: "🟣", label: "実行器未対応",     note: "この操作はまだ自動実行に対応していません。" };
                            if (mapStatus === "FAILED")             return { icon: "🔴", label: "解析失敗",         note: "再試行してください。" };
                            if (mapStatus === "ERROR")              return { icon: "🔴", label: "解析エラー",       note: "再試行してください。" };
                            if (mapStatus === "SCANNING")           return { icon: "⏳", label: "解析中",           note: "しばらくお待ちください。" };
                            if (mapStatus !== undefined && mapStatus !== null) return { icon: "🔍", label: mapStatus, note: "" };
                            return { icon: "⏳", label: "未解析", note: "操作解析がまだ実行されていません。" };
                          };
                          return (
                            <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "14px 16px" }}>
                              {opCands && (opCands as string[]).length > 0 ? (
                                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                  {(opCands as string[]).filter(op => op === "admin_crawl").map(op => (
                                    <div key={op} style={{ background: "#f0f9ff", borderRadius: 8, padding: "10px 14px", border: "1px solid #bae6fd" }}>
                                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                        <span style={{ fontSize: 14 }}>🔍</span>
                                        <span style={{ fontSize: 13, fontWeight: 700, color: "#0369a1", flex: 1 }}>admin_crawl</span>
                                        <span style={{ fontSize: 11, color: "#0369a1", fontWeight: 600, background: "#e0f2fe", borderRadius: 4, padding: "1px 6px" }}>解析専用</span>
                                      </div>
                                      <div style={{ fontSize: 11, color: "#0369a1", marginTop: 4, marginLeft: 22 }}>管理画面解析専用の操作です。タスク作成はできません。</div>
{/* 媒体マッピングで自動解析枠非表示 */}
                                    </div>
                                  ))}
                                  {false && (opCands || []).filter(op => op !== "admin_crawl").map(op => {
                                    const st = _getOpStatus(op);
                                    return (
                                      <div key={op} style={{ background: "#fff", borderRadius: 8, padding: "10px 14px", border: "1px solid #d1fae5" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                          <span style={{ fontSize: 14 }}>{st.icon}</span>
                                          <span style={{ fontSize: 13, fontWeight: 700, color: "#14532d", flex: 1 }}>{OP_LABEL[op] || op}</span>
                                          <span style={{ fontSize: 11, color: st.icon === "✅" ? "#15803d" : "#b45309", fontWeight: 600, background: st.icon === "✅" ? "#dcfce7" : "#fef3c7", borderRadius: 4, padding: "1px 6px" }}>{st.label}</span>
                                          <button style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, border: "1px solid #fca5a5", background: "#fff", color: "#b91c1c", cursor: "pointer" }}
                                            onClick={async () => {
                                              if (!window.confirm(`「${OP_LABEL[op] || op}」を候補から削除しますか？`)) return;
                                              const CAP_MAP: Record<string,string> = { entity_register: "can_register_entity", entity_update: "can_update_entity", text_update: "can_update_text", schedule_update: "can_update_schedule", price_update: "can_update_price", news_post: "can_post_news", media_replace: "can_upload_image", status_update: "can_update_text" };
                                              const capKey = CAP_MAP[op];
                                              if (capKey) { try { await updateCapabilities(String(mx.mapping_id), { [capKey]: false }); const updated = await listMediaMappings(); setMappings(updated.mappings || []); setMsg("✅ 操作候補を削除しました"); } catch(e: unknown) { setMsg("❌ " + (e instanceof Error ? e.message : "削除失敗")); } }
                                            }}>削除</button>
                                        </div>
                                        {st.note && <div style={{ fontSize: 11, color: "#92400e", marginTop: 4, marginLeft: 22 }}>{st.note}</div>}
                                        {(() => {
                                          const _opMapT = opMaps?.[op] as Record<string, unknown> | undefined;
                                          const _targetUrl = _opMapT?.target_url as string | undefined;
                                          const _navEntry = _targetUrl && navGraph ? navGraph[_targetUrl] as Record<string, unknown> | undefined : undefined;
                                          const _pageTitle = _navEntry?.title as string | undefined;
                                          if (!_pageTitle || !_targetUrl) return null;
                                          const _dispTitle = _pageTitle.replace(/^[^—\-－クラブ華]*[—\-－]\s*/, '');
                                          return <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4, marginLeft: 22 }}>対象画面: {_dispTitle}</div>;
                                        })()}
                                        {false && (() => {
                                          const opMap = opMaps?.[op] as Record<string, unknown> | undefined;
                                          const mapStatus = opMap?.status as string | undefined;
                                          const missing = opMap?.missing as string[] | undefined;
                                          if (!opMap || mapStatus === "READY" || mapStatus === undefined) return null;
                                          return (
                                            <div style={{ marginTop: 6, marginLeft: 22, padding: "6px 10px", borderRadius: 6, background: "#fef9c3", border: "1px solid #fde68a", fontSize: 11 }}>
                                              {(missing ?? []).length > 0 && <div style={{ color: "#b45309", marginBottom: 2 }}>未検出: {(missing ?? []).join(", ")}</div>}
                                            </div>
                                          );
                                        })()}
                                        {false && (
                                          <div style={{ marginTop: 8, marginLeft: 0 }}>
                                            {(() => {
                                              const _hintKey = String(mx.mapping_id) + '_' + op;
                                              const _showHint = hintUrls[_hintKey] !== undefined;
                                              const opMap2 = opMaps?.[op] as Record<string, unknown> | undefined;
                                              const mapStatus2 = opMap2?.status as string | undefined;
                                              if (mapStatus2 === "READY" && opMaps?.[op]?.executable) return null;
                                              return (
                                                <div>
                                                  {!_showHint ? (
                                                    <button onClick={() => setHintUrls(prev => ({ ...prev, [_hintKey]: "" }))}
                                                      style={{ fontSize: 11, padding: "3px 10px", borderRadius: 5, border: "1px solid #6366f1", background: "#eef2ff", color: "#4f46e5", cursor: "pointer", fontWeight: 600 }}>
                                                      ＋ URLを追加して解析
                                                    </button>
                                                  ) : (
                                                    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                                                      <input value={hintUrls[_hintKey] || ""} onChange={e => setHintUrls(prev => ({ ...prev, [_hintKey]: e.target.value }))} placeholder="対象ページのURLを入力"
                                                        style={{ flex: 1, minWidth: 180, padding: "5px 10px", borderRadius: 6, border: "1px solid #a5b4fc", fontSize: 12 }} />
                                                      <button onClick={async () => {
                                                        const hurl = hintUrls[_hintKey];
                                                        if (!hurl) return;
                                                        const mid2 = String(mx.mapping_id);
                                                        setDeepScanLoading(prev => ({ ...prev, [mid2 + "_" + op]: true }));
                                                        try {
                                                          await deepScanOperation(mid2, op, hurl);
                                                          const updated = await listMediaMappings(); setMappings(updated.mappings || []);
                                                          setHintUrls(prev => ({ ...prev, [_hintKey]: undefined as unknown as string }));
                                                          setMsg("✅ 解析完了");
                                                        } catch(e: unknown) { setMsg("❌ " + (e instanceof Error ? e.message : "解析失敗")); }
                                                        finally { setDeepScanLoading(prev => ({ ...prev, [mid2 + "_" + op]: false })); }
                                                      }} disabled={deepScanLoading[String(mx.mapping_id) + "_" + op]}
                                                        style={{ padding: "5px 12px", borderRadius: 6, border: "none", background: deepScanLoading[String(mx.mapping_id) + "_" + op] ? "#9ca3af" : "#4f46e5", color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: 11 }}>
                                                        {deepScanLoading[String(mx.mapping_id) + "_" + op] ? "解析中..." : "解析する"}
                                                      </button>
                                                      <button onClick={() => setHintUrls(prev => { const n = {...prev}; delete n[_hintKey]; return n; })}
                                                        style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid #d1d5db", background: "#fff", color: "#9ca3af", cursor: "pointer", fontSize: 11 }}>✕</button>
                                                    </div>
                                                  )}
                                                </div>
                                              );
                                            })()}
                                          </div>
                                        )}
                                        {/* Deep scan detail */}
                                        {(() => {
                                          const opMap3 = opMaps?.[op] as Record<string, unknown> | undefined;
                                          const mapStatus3 = opMap3?.status as string | undefined;
                                          const sels3 = opMap3?.selectors as Record<string, unknown> | undefined;
                                          const targetUrl3 = opMap3?.target_url as string | undefined;
                                          const sourceUrl3 = sels3 ? Object.values(sels3).map(v => v && typeof v === "object" ? (v as Record<string,string>).source_url : null).find(Boolean) as string | undefined : undefined;
                                          const urlMismatch3 = targetUrl3 && sourceUrl3 && targetUrl3 !== sourceUrl3;
                                          if (!opMap3 || mapStatus3 === "READY" || mapStatus3 === undefined) return null;
                                          if (!sels3 && !urlMismatch3) return null;
                                          return (
                                            <div style={{ marginTop: 6, marginLeft: 22, padding: "6px 10px", borderRadius: 6, background: "#fef9c3", border: "1px solid #fde68a", fontSize: 11 }}>
                                              {sels3 && Object.keys(sels3).length > 0 && (
                                                <div style={{ color: "#374151" }}>
                                                  {Object.entries(sels3).map(([k, v]) => { const dispV = v && typeof v === "object" ? ((v as Record<string,string>).selector || JSON.stringify(v)) : String(v); return <div key={k}><span style={{ color: "#6b7280" }}>{k}:</span> {dispV}</div>; })}
                                                </div>
                                              )}
                                              {urlMismatch3 && <div style={{ color: "#92400e", marginTop: 4 }}>⚠ 入力欄は別ページで検出されています<br/>target: {targetUrl3}<br/>source: {sourceUrl3}</div>}
                                            </div>
                                          );
                                        })()}
                                        {/* Page selection */}
                                        {(() => {
                                        
                                          if (!debugMode) return null;
                                          const opMap4 = opMaps?.[op] as Record<string, unknown> | undefined;
                                          const mapStatus4 = opMap4?.status as string | undefined;
                                          if (mapStatus4 === "READY" && opMaps?.[op]?.executable) return null;
                                          const navPages = navGraph ? Object.entries(navGraph).filter(([url, pg]) => { const p = pg as Record<string,unknown>; const title = p.title as string || ""; const status = p.status_code as number || 200; const stripped = title.replace(/^.*?[—\-－]\s*/, "").trim(); const isBad = status === 404 || stripped === "" || stripped === "クラブ華" || title.includes("404") || title.includes("Not Found") || title.includes("Index of /") || title.includes("META テキスト") || title.includes("ACMAILER") || title.includes("シティヘブン") || title.includes("CMS") || ["ホーム","トップ","Home","TOP"].includes(title); return !isBad && !url.endsWith("#") && title !== ""; }).slice(0, 30) : [];
                                          if (navPages.length === 0) return null;
                                          return (
                                            <div style={{ marginTop: 6, marginLeft: 0 }}>
                                              <div style={{ fontSize: 11, color: "#4f46e5", fontWeight: 600, marginBottom: 4 }}>対象画面を選択して解析:</div>
                                              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, maxHeight: 220, overflowY: "auto" }}>
                                                {navPages.map(([url, pg]) => {
                                                  const p = pg as Record<string,unknown>;
                                                  const title = p.title as string || url;
                                                  const dispTitle = title.replace(/^.*?[—\-－]\s*/, '').trim() || title;
                                                  return (
                                                    <button key={url} onClick={async () => {
                                                      const mid3 = String(mx.mapping_id);
                                                      setDeepScanLoading(prev => ({ ...prev, [mid3 + "_" + op]: true }));
                                                      try { await deepScanOperation(mid3, op, url); const updated = await listMediaMappings(); setMappings(updated.mappings || []); setMsg("✅ 解析完了"); }
                                                      catch(e: unknown) { setMsg("❌ " + (e instanceof Error ? e.message : "解析失敗")); }
                                                      finally { setDeepScanLoading(prev => ({ ...prev, [mid3 + "_" + op]: false })); }
                                                    }} disabled={deepScanLoading[String(mx.mapping_id) + "_" + op]}
                                                      style={{ padding: "5px 10px", borderRadius: 5, border: "1px solid #e0e7ff", background: "#f5f3ff", color: "#3730a3", cursor: "pointer", fontSize: 11, whiteSpace: "nowrap" }}>
                                                      {dispTitle || url}
                                                    </button>
                                                  );
                                                })}
                                              </div>
                                            </div>
                                          );
                                        })()}
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div style={{ fontSize: 12, color: "#6b7280", padding: "8px 0" }}>AI整備済みのフォームだけ実行対象です。候補不足の媒体は媒体基盤のAI整備で更新します。</div>
                              )}

                              {/* 手動追加 */}
                              {false && (() => {
                                const ALL_OPS = ["entity_register","entity_update","text_update","schedule_update","price_update","news_post","media_replace","blog_post","page_monitor"];
                                const existing = (opCands || []);
                                const addable = ALL_OPS.filter(op => !existing.includes(op));
                                if (addable.length === 0) return null;
                                return (
                                  <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
                                    <select id={"add_op_" + String(mx.mapping_id)} style={{ fontSize: 12, padding: "5px 8px", borderRadius: 6, border: "1px solid #d1d5db" }}>
                                      <option value="">＋ 操作候補を手動追加</option>
                                      {addable.map(op => <option key={op} value={op}>{OP_LABEL[op] || op}</option>)}
                                    </select>
                                    <button style={{ fontSize: 12, padding: "5px 12px", borderRadius: 6, border: "1px solid #7c3aed", background: "#f5f3ff", color: "#7c3aed", cursor: "pointer", fontWeight: 600 }}
                                      onClick={async () => {
                                        const sel = (document.getElementById("add_op_" + String(mx.mapping_id)) as HTMLSelectElement)?.value;
                                        if (!sel) return;
                                        const CAP_MAP2: Record<string,string> = { entity_register: "can_register_entity", entity_update: "can_update_entity", text_update: "can_update_text", schedule_update: "can_update_schedule", price_update: "can_update_price", news_post: "can_post_news", media_replace: "can_upload_image", status_update: "can_update_text" };
                                        if (CAP_MAP2[sel]) {
                                          try { await updateCapabilities(String(mx.mapping_id), { [CAP_MAP2[sel]]: true }); const updated = await listMediaMappings(); setMappings(updated.mappings || []); setMsg("✅ 操作候補を追加しました"); }
                                          catch(e: unknown) { setMsg("❌ " + (e instanceof Error ? e.message : "追加失敗")); }
                                        }
                                      }}>追加</button>
                                  </div>
                                );
                              })()}

                              {/* Capability表示 */}
                              {debugMode && caps && Object.keys(caps as Record<string,boolean>).length > 0 && (
                                <details style={{ marginTop: 12 }}>
                                  <summary style={{ fontSize: 12, color: "#6b7280", cursor: "pointer" }}>詳細: Capability一覧</summary>
                                  <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
                                    {Object.entries(caps as Record<string,boolean>).map(([k, v]) => (
                                      <span key={k} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: v ? "#dcfce7" : "#f3f4f6", color: v ? "#15803d" : "#9ca3af", border: `1px solid ${v ? "#bbf7d0" : "#e5e7eb"}` }}>
                                        {CAP_LABEL[k] || k}: {v ? "ON" : "OFF"}
                                      </span>
                                    ))}
                                  </div>
                                </details>
                              )}

                              {false && (
                                <div style={{ marginTop: 10, padding: "6px 12px", borderRadius: 6, background: "#f0fdf4", border: "1px solid #bbf7d0", fontSize: 12, color: "#15803d" }}>✅ 管理画面の自動巡回が可能です</div>
                              )}
                            </div>
                          );
                        })()}

                        {/* セレクター修復候補 */}
                        {m.selector_repair_suggestions && !m.selector_repair_suggestions.cleared_at && (
                          <div style={{ marginTop: 10, padding: "12px 16px", borderRadius: 8, background: "#fffbeb", border: "1px solid #fde68a" }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: "#b87d00", marginBottom: 8 }}>🔧 修復候補あり</div>
                            <div style={{ fontSize: 12, color: "#78350f", marginBottom: 8 }}>以下の入力欄候補が検出されました。適用するものにチェックを入れてください。</div>
                            {(m.selector_repair_suggestions.suggested_selectors || []).filter((s: {suggested_selector?: string}) => s.suggested_selector).map((s: {suggested_selector: string; tag?: string; name?: string; id?: string}, idx: number) => (
                              <label key={idx} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, marginBottom: 6, cursor: "pointer" }}>
                                <input type="checkbox" onChange={e => { setRepairSelections(prev => ({ ...prev, [m.mapping_id]: { ...(prev[m.mapping_id] || {}), [s.name || s.id || String(idx)]: e.target.checked ? s.suggested_selector : undefined } })); }} />
                                <span style={{ fontFamily: "monospace", background: "#fef3c7", padding: "1px 6px", borderRadius: 4 }}>{s.suggested_selector}</span>
                                <span style={{ color: "#92400e" }}>{s.tag}{s.name ? ` name="${s.name}"` : ""}{s.id ? ` id="${s.id}"` : ""}</span>
                              </label>
                            ))}
                            <button onClick={async () => {
                              const sel2 = repairSelections[m.mapping_id] || {};
                              const approved2: Record<string, string> = {};
                              Object.entries(sel2).forEach(([k, v]) => { if (v) approved2[k] = v as string; });
                              if (Object.keys(approved2).length === 0) { setMsg("適用する入力欄候補を選択してください"); return; }
                              if (!window.confirm(`選択した${Object.keys(approved2).length}件の入力欄候補をログイン設定へ反映しますか？`)) return;
                              try { await applySelectorRepair(m.mapping_id, approved2); const d = await listMediaMappings(); setMappings(d.mappings); setMsg("✅ 修復候補を適用しました"); }
                              catch(e: unknown) { setMsg("❌ " + (e instanceof Error ? e.message : "適用失敗")); }
                            }} style={{ padding: "7px 16px", borderRadius: 6, border: "none", background: "#b87d00", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>適用する</button>
                          </div>
                        )}

                        {/* AI推定セレクター候補 */}
                        {m.semantic_selector_candidates && !m.semantic_selector_candidates.cleared_at && (() => {
                          const cands = m.semantic_selector_candidates as {cleared_at?: string; candidates?: Record<string, {label_map?: Record<string, string>; confirmed?: boolean}>};
                          if (!cands.candidates) return null;
                          const unconfirmed = Object.entries(cands.candidates).filter(([, v]) => !v.confirmed);
                          if (unconfirmed.length === 0) return null;
                          return (
                            <div style={{ marginTop: 10, padding: "12px 16px", borderRadius: 8, background: "#faf5ff", border: "1px solid #e9d5ff" }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: "#7c3aed", marginBottom: 8 }}>🤖 AI推定セレクター候補</div>
                              <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>AIが推定した入力欄候補です。ログイン設定へ反映するか確認してください。</div>
                              {unconfirmed.map(([op5, v5]) => {
                                const lm = v5.label_map || {};
                                return (
                                  <div key={op5} style={{ marginBottom: 8, padding: "8px 12px", background: "#fff", borderRadius: 6, border: "1px solid #e9d5ff" }}>
                                    <div style={{ fontSize: 12, fontWeight: 700, color: "#7c3aed", marginBottom: 4 }}>{op5}</div>
                                    {Object.entries(lm).map(([label, sel5]) => <div key={label} style={{ fontSize: 11, color: "#374151", fontFamily: "monospace" }}>{label}: {sel5}</div>)}
                                  </div>
                                );
                              })}
                              <button onClick={async () => {
                                const toApply: Record<string, Record<string, string>> = {};
                                unconfirmed.forEach(([op6, v6]) => { toApply[op6] = v6.label_map || {}; });
                                const flat: Record<string, boolean> = {};
                                Object.values(toApply).forEach(lm2 => Object.entries(lm2).forEach(([k, v]) => { flat[k] = true; }));
                                if (!window.confirm("AI推定セレクター候補をログイン設定へ反映しますか？")) return;
                                try { await applySemanticSelector(m.mapping_id, flat); const d = await listMediaMappings(); setMappings(d.mappings); setMsg("✅ AI推定候補を反映しました"); }
                                catch(e: unknown) { setMsg("❌ " + (e instanceof Error ? e.message : "反映失敗")); }
                              }} style={{ padding: "7px 16px", borderRadius: 6, border: "none", background: "#7c3aed", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>反映する</button>
                            </div>
                          );
                        })()}

                        {/* Capability候補 */}
                        {m.capabilities_candidate && !m.capabilities_candidate.cleared_at && (() => {
                          const cand = m.capabilities_candidate as {cleared_at?: string; capabilities?: Record<string, boolean>; applied?: boolean};
                          if (!cand.capabilities || Object.keys(cand.capabilities).length === 0) return null;
                          return (
                            <div style={{ marginTop: 10, padding: "12px 16px", borderRadius: 8, background: "#ecfdf5", border: "1px solid #a7f3d0" }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: "#065f46", marginBottom: 8 }}>✅ Capability候補が検出されました</div>
                              <div style={{ fontSize: 12, color: "#047857", marginBottom: 8 }}>以下のCapabilityを有効にしますか？</div>
                              {Object.entries(cand.capabilities).map(([k, v]) => (
                                <div key={k} style={{ fontSize: 12, color: "#065f46", marginBottom: 2 }}>
                                  <input type="checkbox" defaultChecked={v} id={"cap_cand_" + m.mapping_id + "_" + k} style={{ marginRight: 6 }} />
                                  <label htmlFor={"cap_cand_" + m.mapping_id + "_" + k}>{({"can_login":"ログイン可能","can_verify":"ログイン後確認","can_update_text":"文章更新","can_post_news":"ニュース投稿","can_upload_image":"画像アップロード","can_update_schedule":"出勤・予定更新","can_update_price":"料金更新","can_register_entity":"新規登録","can_update_entity":"編集・更新","can_navigate_admin":"管理画面巡回"} as Record<string,string>)[k] || k}</label>
                                </div>
                              ))}
                              <button onClick={async () => {
                                const approved3: Record<string, boolean> = {};
                                Object.keys(cand.capabilities || {}).forEach(k => { const el = document.getElementById("cap_cand_" + m.mapping_id + "_" + k) as HTMLInputElement; if (el) approved3[k] = el.checked; });
                                if (!window.confirm("選択したCapabilityを反映しますか？")) return;
                                try { await applyCapabilities(m.mapping_id, approved3); const d = await listMediaMappings(); setMappings(d.mappings); setMsg("✅ Capabilityを反映しました"); }
                                catch(e: unknown) { setMsg("❌ " + (e instanceof Error ? e.message : "反映失敗")); }
                              }} style={{ marginTop: 8, padding: "7px 16px", borderRadius: 6, border: "none", background: "#065f46", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>反映する</button>
                            </div>
                          );
                        })()}

                      </div>
                    );
                  })}
                </div></>}
                </div>
              )}
            </div>
          )}

          {/* ─────────── SECTION: 媒体クロスメディア ─────────── */}
          {tab === "cross" && (() => {
            const CROSS_INDUSTRY_TERMS: Record<string, { entity: string; schedule: string; news: string; media: string; blog: string; icon: string; determiner: string }> = {
              nightlife:  { entity: "キャスト",   schedule: "出勤",       news: "ニュース",     media: "写真",       blog: "店長ブログ（求人サイト）",     icon: "👤", determiner: "誰" },
              beauty:     { entity: "スタッフ",   schedule: "予約枠",     news: "キャンペーン", media: "スタッフ写真", blog: "スタッフブログ",       icon: "👤", determiner: "誰" },
              retail:     { entity: "商品",       schedule: "営業時間",   news: "お知らせ",     media: "商品写真",   blog: "商品レビュー・ブログ", icon: "🛍️", determiner: "どの" },
              realestate: { entity: "物件",       schedule: "空室状況",   news: "新着物件",     media: "物件写真",   blog: "物件レポート・ブログ", icon: "🏠", determiner: "どの" },
              btob:       { entity: "サービス",   schedule: "セミナー",   news: "ニュース",     media: "資料",       blog: "コラム・実績レポート", icon: "📋", determiner: "どの" },
              fitness:    { entity: "講師",       schedule: "レッスン",   news: "キャンペーン", media: "講師写真",   blog: "レッスンレポート・ブログ", icon: "🏃", determiner: "どの" },
            };
            const CROSS_INDUSTRY_ALIAS: Record<string, string> = { real_estate: "realestate", b2b: "btob" };
            const _srcIndustryRaw = (mappings.find(m => m.mapping_id === crossSourceMappingId) as { industry?: string } | undefined)?.industry ?? "";
            const _srcIndustryKey = CROSS_INDUSTRY_ALIAS[_srcIndustryRaw] ?? _srcIndustryRaw;
            const cIT = CROSS_INDUSTRY_TERMS[_srcIndustryKey] ?? { entity: "情報", schedule: "スケジュール", news: "お知らせ", media: "メディア", blog: "ブログ・日記", icon: "🎯", determiner: "どの" };
            return (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              {/* モード切替 */}
              <div style={{ display: "flex", gap: 8 }}>
                {(["copy", "generate", "recruit"] as const).map(m => (
                  <button key={m} onClick={() => setCrossMode(m)}
                    style={{ padding: "8px 18px", borderRadius: 20, border: crossMode === m ? "2px solid #7c3aed" : "1px solid #d1d5db", background: crossMode === m ? "#ede9fe" : "#fff", color: crossMode === m ? "#4c1d95" : "#6b7280", fontWeight: crossMode === m ? 700 : 400, fontSize: 13, cursor: "pointer" }}>
                    {m === "copy" ? "🔁 既存コピー" : m === "generate" ? "✨ AI新規生成" : "🧲 求人対応"}
                  </button>
                ))}
              </div>


              {/* ── 求人対応モード（項目7） ── */}
              {crossMode === "recruit" && (() => {
                const recruitMapping = mappings.find(m => m.mapping_id === recruitMappingId);
                const recruitIndustry = (recruitMapping as { industry?: string } | undefined)?.industry || "nightlife";
                const needsApplicant = recruitMode !== "text";
                const isOfferMode = recruitMode === "offer";
                const canGenerate = !isOfferMode && !!recruitConditions.trim() && (!needsApplicant || !!recruitApplicant.trim()) && !recruitLoading;
                return (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={{ border: "1px solid #fed7aa", borderRadius: 14, padding: "16px 20px", background: "#fff7ed" }}>
                    <div style={{ fontSize: 13, fontWeight: 900, color: "#9a3412", marginBottom: 6 }}>🧲 求人対応</div>
                    <div style={{ fontSize: 11, color: "#9a3412", lineHeight: 1.6 }}>
                      {isOfferMode
                        ? <>📤 <b>オファー送信文</b>は求人媒体に設定済みの定型文を使用します（AI生成なし）。<br/>定型文を貼り付けまたは入力 → <b>承認して送信タスクを作成</b>（実際の送信は承認後）。</>
                        : <>✨AI新規生成と同じ<b>専用ナレッジ＋市場調査</b>に基づいて文面を生成します（AIに丸投げしません）。<br/>生成 → 内容を確認・修正 → <b>承認して送信タスクを作成</b>（実際の送信は承認後）。</>
                      }
                    </div>
                  </div>

                  {/* 求人サイト選択 */}
                  <div style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: "16px 20px", background: "#fff" }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#1e1b4b", marginBottom: 8 }}>① 求人サイト（送信先）を選択</div>
                    <select value={recruitMappingId} onChange={e => setRecruitMappingId(e.target.value)}
                      style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13 }}>
                      <option value="">求人サイトの媒体を選択...</option>
                      {mappings.map(m => (
                        <option key={m.mapping_id} value={m.mapping_id}>{m.media_name}</option>
                      ))}
                    </select>
                    <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 6 }}>
                      未登録の場合は「媒体基盤」で求人サイトを登録してください。返信・オファーなどURL特定が必要な操作は、媒体基盤のAI整備で使える状態にします。URL登録は任意補助です。
                    </div>
                  </div>

                  {/* 対応タイプ */}
                  <div style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: "16px 20px", background: "#fff" }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#1e1b4b", marginBottom: 10 }}>② 対応タイプ</div>
                    <div style={{ display: "flex", gap: 8 }}>
                      {([
                        ["reply", "📨 申込・問合せ返信", "応募者からの連絡に返信"],
                        ["offer", "📤 オファー送信文", "条件に合う候補者へ送る"],
                        ["text",  "📝 求人掲載文言",   "募集文・キャッチ・条件文"],
                      ] as [typeof recruitMode, string, string][]).map(([mode, label, desc]) => (
                        <button key={mode} onClick={() => { setRecruitMode(mode); setRecruitResult(null); }}
                          style={{ flex: 1, padding: "10px 12px", borderRadius: 10, textAlign: "left", border: recruitMode === mode ? "2px solid #ea580c" : "1px solid #fed7aa", background: recruitMode === mode ? "#ffedd5" : "#fff", cursor: "pointer" }}>
                          <div style={{ fontSize: 12, fontWeight: 800, color: recruitMode === mode ? "#9a3412" : "#374151" }}>{label}</div>
                          <div style={{ fontSize: 10, color: "#6b7280", marginTop: 2 }}>{desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* ③ 入力（オファー以外：AI生成 / オファー：定型文＋絞り込みで一括送信） */}
                  {isOfferMode ? (
                    <>
                    {/* ③-A 絞り込み条件 */}
                    <div style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: "16px 20px", background: "#fff", display: "flex", flexDirection: "column", gap: 10 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: "#1e1b4b" }}>③ 絞り込み条件</div>
                      <div style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.5 }}>
                        候補者検索ページ（手動登録済み）でフィルターを適用し、該当者全員に定型文を送信します。
                      </div>
                      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
                        <input type="checkbox" checked={offerFilterScoutOnly} onChange={e => setOfferFilterScoutOnly(e.target.checked)} />
                        求職中のみ対象
                      </label>
                      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
                        <input type="checkbox" checked={offerFilterUnsentOnly} onChange={e => setOfferFilterUnsentOnly(e.target.checked)} />
                        オファー未送信のみ対象
                      </label>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", display: "block", marginBottom: 4 }}>フリーワード（任意）</label>
                        <input value={offerFreeText} onChange={e => setOfferFreeText(e.target.value)}
                          placeholder="例: 東京 / 未経験可"
                          style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13 }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", display: "block", marginBottom: 4 }}>最大送信件数</label>
                        <input type="number" min={1} max={50} value={offerMaxSend} onChange={e => setOfferMaxSend(Number(e.target.value))}
                          style={{ width: 100, padding: "9px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13 }} />
                      </div>
                    </div>
                    {/* ③-B ひな形文 */}
                    <div style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: "16px 20px", background: "#fff", display: "flex", flexDirection: "column", gap: 12 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: "#1e1b4b" }}>④ ひな形文（定型文）</div>
                      <div style={{ fontSize: 11, color: "#78350f", background: "#fef9c3", border: "1px solid #fde68a", borderRadius: 8, padding: "8px 12px", lineHeight: 1.6 }}>
                        求人媒体に設定済みの定型文を貼り付けてください。絞り込み結果の全候補者に同文を送信します。
                      </div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", display: "block", marginBottom: 4 }}>本文 *</label>
                        <textarea value={recruitEditBody} onChange={e => setRecruitEditBody(e.target.value)}
                          placeholder="求人媒体の定型文をここに貼り付けてください..."
                          style={{ width: "100%", minHeight: 160, padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, lineHeight: 1.6, resize: "vertical" }} />
                      </div>
                      <button disabled={!recruitMappingId || !recruitEditBody.trim() || recruitSending} onClick={async () => {
                        if (!recruitMappingId) { setMsg("送信先の求人サイトを選択してください"); return; }
                        setRecruitSending(true);
                        try {
                          const r = await createAgentTask({
                            agent_type: "hp_update",
                            operation_type: "offer_send",
                            entity_type: "recruitment",
                            media_mapping_id: recruitMappingId,
                            payload: {
                              body: recruitEditBody,
                              max_send: offerMaxSend,
                              filter_intent: {
                                scout_only: offerFilterScoutOnly,
                                offer_unset_only: offerFilterUnsentOnly,
                                free_text: offerFreeText,
                              },
                            },
                          });
                          setMsg(`✅ オファー一括送信タスクを作成しました（承認待ち）。タスク一覧で承認すると実行されます。 [${r.status}]`);
                          setRecruitEditBody("");
                        } catch (e: unknown) {
                          setMsg("❌ タスク作成失敗: " + (e instanceof Error ? e.message : "不明なエラー"));
                        } finally { setRecruitSending(false); }
                      }}
                        style={{ padding: "11px 16px", borderRadius: 10, border: "none", background: (!recruitMappingId || !recruitEditBody.trim()) ? "#fdba74" : "#16a34a", color: "#fff", fontWeight: 800, fontSize: 13, cursor: (!recruitMappingId || !recruitEditBody.trim()) ? "default" : "pointer" }}>
                        {recruitSending ? "⏳ 作成中..." : `✅ 承認してオファー一括送信タスクを作成（最大${offerMaxSend}件）`}
                      </button>
                    </div>
                    </>
                  ) : (
                  <>
                  <div style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: "16px 20px", background: "#fff", display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#1e1b4b" }}>③ 内容を入力</div>
                    {needsApplicant && (
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", display: "block", marginBottom: 4 }}>
                          {recruitMode === "reply" ? "相手のメッセージ・状況 *" : "候補者の情報・狙い *"}
                        </label>
                        <textarea value={recruitApplicant} onChange={e => setRecruitApplicant(e.target.value)}
                          placeholder={recruitMode === "reply" ? "例: 「未経験ですが大丈夫ですか？週2から働けますか？」" : "例: 20代前半・経験浅め・短時間希望の層へ"}
                          style={{ width: "100%", minHeight: 70, padding: "9px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, resize: "vertical" }} />
                      </div>
                    )}
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", display: "block", marginBottom: 4 }}>条件・対応方針 *</label>
                      <textarea value={recruitConditions} onChange={e => setRecruitConditions(e.target.value)}
                        placeholder="例: 日給保証2万・体験入店OK・送り迎えあり・ノルマなし・未経験歓迎"
                        style={{ width: "100%", minHeight: 60, padding: "9px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, resize: "vertical" }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", display: "block", marginBottom: 4 }}>追加指示（任意）</label>
                      <input value={recruitInstruction} onChange={e => setRecruitInstruction(e.target.value)}
                        placeholder="例: 砕けすぎず丁寧に / 絵文字は控えめに"
                        style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13 }} />
                    </div>
                    <button disabled={!canGenerate} onClick={async () => {
                      setRecruitLoading(true);
                      setRecruitResult(null);
                      try {
                        const r = await recruitGenerate({
                          target_mapping_id: recruitMappingId,
                          recruit_mode: recruitMode,
                          applicant_context: recruitApplicant,
                          conditions: recruitConditions,
                          instruction: recruitInstruction,
                          industry: recruitIndustry,
                        });
                        setRecruitResult(r);
                        setRecruitEditTitle(r.title || "");
                        setRecruitEditBody(r.body || "");
                      } catch (e: unknown) {
                        setMsg("❌ 生成失敗: " + (e instanceof Error ? e.message : "不明なエラー"));
                      } finally { setRecruitLoading(false); }
                    }}
                      style={{ padding: "11px 16px", borderRadius: 10, border: "none", background: canGenerate ? "#ea580c" : "#fdba74", color: "#fff", fontWeight: 800, fontSize: 13, cursor: canGenerate ? "pointer" : "default" }}>
                      {recruitLoading ? "⏳ 専用ナレッジ＋市場調査で生成中..." : "🧠 AIで文面を生成（送信しない）"}
                    </button>
                  </div>

                  {/* 生成結果 */}
                  {recruitResult && (
                    <div style={{ border: "1px solid #fed7aa", borderRadius: 14, padding: "16px 20px", background: "#fff", display: "flex", flexDirection: "column", gap: 10 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: "#9a3412" }}>④ 生成結果を確認・修正 — {recruitResult.doc_label}</div>
                      <div style={{ fontSize: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ padding: "2px 8px", borderRadius: 999, background: recruitResult.knowledge_used ? "#dcfce7" : "#f3f4f6", color: recruitResult.knowledge_used ? "#15803d" : "#9ca3af" }}>専用ナレッジ {recruitResult.knowledge_used ? "✓使用" : "未登録"}</span>
                        <span style={{ padding: "2px 8px", borderRadius: 999, background: recruitResult.market_used ? "#dcfce7" : "#f3f4f6", color: recruitResult.market_used ? "#15803d" : "#9ca3af" }}>市場調査 {recruitResult.market_used ? "✓使用" : "未登録"}</span>
                      </div>
                      <div style={{ fontSize: 10, color: "#9a3412" }}>{recruitResult.note}</div>
                      {recruitMode !== "reply" && (
                        <div>
                          <label style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", display: "block", marginBottom: 4 }}>件名・見出し</label>
                          <input value={recruitEditTitle} onChange={e => setRecruitEditTitle(e.target.value)}
                            style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13 }} />
                        </div>
                      )}
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", display: "block", marginBottom: 4 }}>本文（修正可）</label>
                        <textarea value={recruitEditBody} onChange={e => setRecruitEditBody(e.target.value)}
                          style={{ width: "100%", minHeight: 160, padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, lineHeight: 1.6, resize: "vertical" }} />
                      </div>
                      <button disabled={!recruitMappingId || !recruitEditBody.trim() || recruitSending} onClick={async () => {
                        if (!recruitMappingId) { setMsg("送信先の求人サイトを選択してください"); return; }
                        setRecruitSending(true);
                        try {
                          const r = await createAgentTask({
                            agent_type: "hp_update",
                            operation_type: recruitMode === "reply" ? "recruit_reply" : "blog_post",
                            entity_type: "recruitment",
                            media_mapping_id: recruitMappingId,
                            payload: recruitMode === "reply"
                              ? { body: recruitEditBody }
                              : { title: recruitEditTitle, body: recruitEditBody },
                          });
                          setMsg(`✅ ${recruitMode === "reply" ? "返信" : "送信"}タスクを作成しました（承認待ち）。タスク一覧で承認すると実行されます。 [${r.status}]`);
                          setRecruitResult(null);
                          setRecruitApplicant(""); setRecruitInstruction("");
                        } catch (e: unknown) {
                          setMsg("❌ タスク作成失敗: " + (e instanceof Error ? e.message : "不明なエラー"));
                        } finally { setRecruitSending(false); }
                      }}
                        style={{ padding: "11px 16px", borderRadius: 10, border: "none", background: (!recruitMappingId || !recruitEditBody.trim()) ? "#fdba74" : "#16a34a", color: "#fff", fontWeight: 800, fontSize: 13, cursor: (!recruitMappingId || !recruitEditBody.trim()) ? "default" : "pointer" }}>
                        {recruitSending ? "⏳ 作成中..." : "✅ 承認して送信タスクを作成（送信は承認後）"}
                      </button>
                    </div>
                  )}
                  </>
                  )}

                  {/* ─── Step 3: 📨 会話スレッド ────────────────────────────────── */}
                  <div style={{ marginTop: 8, borderTop: "1px solid #374151", paddingTop: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 800, fontSize: 13, color: "#e5e7eb" }}>📨 会話スレッド</span>
                      <button onClick={async () => {
                        setConvLoading(true); setConvError("");
                        try {
                          const r = await listRecruitConversations(recruitMappingId || undefined);
                          setRecruitConversations(r.conversations);
                        } catch (e: unknown) {
                          setConvError(e instanceof Error ? e.message : "取得失敗");
                        } finally { setConvLoading(false); }
                      }} style={{ fontSize: 11, color: "#9ca3af", background: "transparent", border: "1px solid #374151", borderRadius: 6, padding: "2px 8px", cursor: "pointer" }}>
                        {convLoading ? "⏳" : "🔄 最新取得"}
                      </button>
                      {/* 受信ボックスをスキャン → recruit_inbox_scan タスク作成 */}
                      <button onClick={async () => {
                        if (!recruitMappingId) { setMsg("受信ボックス監視には送信先の求人サイトを選択してください"); return; }
                        try {
                          await createAgentTask({
                            agent_type: "hp_update",
                            operation_type: "recruit_inbox_scan",
                            media_mapping_id: recruitMappingId,
                            payload: {},
                          });
                          setMsg("✅ 受信ボックススキャンタスクを作成しました（承認後に実行・会話スレッドが自動更新されます）");
                        } catch (e: unknown) { setMsg("❌ タスク作成失敗: " + (e instanceof Error ? e.message : "")); }
                      }} style={{ fontSize: 11, color: "#60a5fa", background: "transparent", border: "1px solid #1d4ed8", borderRadius: 6, padding: "2px 8px", cursor: "pointer" }}>
                        📬 受信ボックスをスキャン
                      </button>
                    </div>
                    {convError && <div style={{ color: "#ef4444", fontSize: 11, marginBottom: 8 }}>❌ {convError}</div>}
                    {recruitConversations.length === 0 && !convLoading && (
                      <div style={{ color: "#6b7280", fontSize: 12 }}>スレッドなし（オファー送信後に自動作成されます）</div>
                    )}
                    {recruitConversations.map(conv => {
                      const cid = conv.conversation_id;
                      const isOpen = openConvId === cid;
                      const phaseLabel: Record<string, string> = {
                        offer_sent: "📤 オファー送信済",
                        waiting_reply: "⏳ 返信待ち",
                        replied: "💬 返信あり",
                        interview_info_sent: "📋 面接案内済",
                        scheduled: "✅ 面接確定",
                        declined: "❌ 辞退",
                      };
                      const phaseColor: Record<string, string> = {
                        offer_sent: "#fbbf24", waiting_reply: "#60a5fa", replied: "#34d399",
                        interview_info_sent: "#a78bfa", scheduled: "#86efac", declined: "#f87171",
                      };
                      return (
                        <div key={cid} style={{ border: `1px solid ${phaseColor[conv.phase] || "#374151"}`, borderRadius: 10, marginBottom: 8, background: "#1f2937", overflow: "hidden" }}>
                          <div onClick={() => setOpenConvId(isOpen ? null : cid)}
                            style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", cursor: "pointer" }}>
                            <span style={{ padding: "2px 8px", borderRadius: 999, background: phaseColor[conv.phase] || "#374151", color: "#111", fontSize: 10, fontWeight: 700, whiteSpace: "nowrap" }}>
                              {phaseLabel[conv.phase] || conv.phase}
                            </span>
                            <span style={{ fontWeight: 700, fontSize: 13, color: "#e5e7eb", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{conv.candidate_name}</span>
                            {/* reply_urlがあれば返信可能アイコン表示 */}
                            {conv.reply_url
                              ? <span title={`返信URL: ${conv.reply_url}`} style={{ fontSize: 10, color: "#34d399", whiteSpace: "nowrap" }}>💬返信可</span>
                              : <span title="受信ボックススキャン後に返信URLが取得されます" style={{ fontSize: 10, color: "#6b7280", whiteSpace: "nowrap" }}>💬要スキャン</span>
                            }
                            {conv.last_candidate_message && (
                              <span style={{ fontSize: 11, color: "#9ca3af", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 120 }}>{conv.last_candidate_message}</span>
                            )}
                            <span style={{ fontSize: 11, color: "#6b7280" }}>{isOpen ? "▲" : "▼"}</span>
                          </div>
                          {isOpen && (
                            <div style={{ borderTop: "1px solid #374151", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
                              {/* メッセージ履歴 */}
                              <div style={{ maxHeight: 200, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
                                {(conv.messages || []).map((msg, mi) => (
                                  <div key={mi} style={{ display: "flex", flexDirection: msg.role === "shop" ? "row-reverse" : "row", gap: 6 }}>
                                    <div style={{ maxWidth: "80%", padding: "7px 11px", borderRadius: 10, background: msg.role === "shop" ? "#1d4ed8" : "#374151", fontSize: 12, color: "#e5e7eb", lineHeight: 1.5 }}>
                                      <div style={{ fontSize: 10, fontWeight: 700, color: msg.role === "shop" ? "#93c5fd" : "#9ca3af", marginBottom: 3 }}>{msg.role === "shop" ? "店舗" : conv.candidate_name}</div>
                                      {msg.content}
                                    </div>
                                  </div>
                                ))}
                              </div>
                              {/* フェーズ変更 */}
                              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                {["waiting_reply", "replied", "interview_info_sent", "scheduled", "declined"].map(ph => (
                                  <button key={ph} onClick={async () => {
                                    try {
                                      await updateRecruitConversationPhase(cid, ph);
                                      setRecruitConversations(prev => prev.map(c => c.conversation_id === cid ? {...c, phase: ph as RecruitConversation["phase"]} : c));
                                    } catch (e: unknown) { setMsg("❌ フェーズ更新失敗: " + (e instanceof Error ? e.message : "")); }
                                  }} style={{ fontSize: 10, padding: "3px 8px", borderRadius: 6, border: "1px solid #374151", background: conv.phase === ph ? "#374151" : "transparent", color: conv.phase === ph ? "#e5e7eb" : "#9ca3af", cursor: "pointer" }}>
                                    {phaseLabel[ph] || ph}
                                  </button>
                                ))}
                              </div>
                              {/* 返信生成 */}
                              <div style={{ borderTop: "1px solid #374151", paddingTop: 10 }}>
                                <label style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", display: "block", marginBottom: 4 }}>候補者からの新着メッセージ</label>
                                <textarea value={convNewMsg[cid] || ""} onChange={e => setConvNewMsg(p => ({...p, [cid]: e.target.value}))}
                                  placeholder="例: 「体験入店ってどんな感じですか？」"
                                  style={{ width: "100%", minHeight: 60, padding: "8px 10px", borderRadius: 8, border: "1px solid #374151", fontSize: 12, background: "#111827", color: "#e5e7eb", resize: "vertical" }} />
                                <input value={convReplyInstruction[cid] || ""} onChange={e => setConvReplyInstruction(p => ({...p, [cid]: e.target.value}))}
                                  placeholder="追加指示（任意）: 例「面接に誘うタイミング」"
                                  style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: "1px solid #374151", fontSize: 11, background: "#111827", color: "#e5e7eb", marginTop: 6 }} />
                                <button disabled={!convNewMsg[cid]?.trim() || !!convReplyLoading[cid]} onClick={async () => {
                                  setConvReplyLoading(p => ({...p, [cid]: true}));
                                  try {
                                    const r = await generateRecruitReply({
                                      conversation_id: cid,
                                      new_message: convNewMsg[cid] || "",
                                      instruction: convReplyInstruction[cid] || "",
                                      mapping_id: recruitMappingId || conv.mapping_id,
                                    });
                                    setConvReplyDraft(p => ({...p, [cid]: r.generated_reply}));
                                    setRecruitConversations(prev => prev.map(c => c.conversation_id === cid ? {
                                      ...c,
                                      messages: [...(c.messages||[]), {role: "candidate" as const, content: convNewMsg[cid]||""}],
                                      last_candidate_message: convNewMsg[cid] || "",
                                    } : c));
                                    setConvNewMsg(p => ({...p, [cid]: ""}));
                                  } catch (e: unknown) { setMsg("❌ 返信生成失敗: " + (e instanceof Error ? e.message : "")); }
                                  finally { setConvReplyLoading(p => ({...p, [cid]: false})); }
                                }} style={{ marginTop: 8, padding: "9px 14px", borderRadius: 8, border: "none", background: !convNewMsg[cid]?.trim() ? "#374151" : "#ea580c", color: "#fff", fontWeight: 700, fontSize: 12, cursor: !convNewMsg[cid]?.trim() ? "default" : "pointer" }}>
                                  {convReplyLoading[cid] ? "⏳ 生成中..." : "🤖 AI返信を生成"}
                                </button>
                                {convReplyDraft[cid] && (
                                  <div style={{ marginTop: 10 }}>
                                    <label style={{ fontSize: 11, fontWeight: 700, color: "#34d399", display: "block", marginBottom: 4 }}>✨ AI生成返信（修正して使用）</label>
                                    <textarea value={convReplyDraft[cid]} onChange={e => setConvReplyDraft(p => ({...p, [cid]: e.target.value}))}
                                      style={{ width: "100%", minHeight: 100, padding: "9px 10px", borderRadius: 8, border: "1px solid #34d399", fontSize: 12, background: "#111827", color: "#e5e7eb", resize: "vertical", lineHeight: 1.6 }} />
                                    <button onClick={async () => {
                                      if (!recruitMappingId) { setMsg("送信先の求人サイトを選択してください"); return; }
                                      setRecruitSending(true);
                                      try {
                                        // recruit_reply: reply_url（会話スレッドURL）を使用。未設定時はcandidate_urlを参照
                                        const _replyTarget = conv.reply_url || conv.candidate_url;
                                        if (!_replyTarget) { setMsg("❌ 返信先URLが不明です（会話スレッドURLが未取得）"); setRecruitSending(false); return; }
                                        await createAgentTask({
                                          agent_type: "hp_update",
                                          operation_type: "recruit_reply",
                                          entity_type: "recruitment",
                                          media_mapping_id: recruitMappingId || conv.mapping_id,
                                          payload: { body: convReplyDraft[cid], reply_url: _replyTarget },
                                        });
                                        setMsg("✅ 返信タスクを作成しました（承認待ち）");
                                        setConvReplyDraft(p => {const n={...p}; delete n[cid]; return n;});
                                        setRecruitConversations(prev => prev.map(c => c.conversation_id === cid ? {
                                          ...c,
                                          messages: [...(c.messages||[]), {role: "shop" as const, content: convReplyDraft[cid]||""}],
                                        } : c));
                                      } catch (e: unknown) { setMsg("❌ タスク作成失敗: " + (e instanceof Error ? e.message : "")); }
                                      finally { setRecruitSending(false); }
                                    }} style={{ marginTop: 6, padding: "9px 14px", borderRadius: 8, border: "none", background: "#16a34a", color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                                      ✅ 承認して返信タスクを作成
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                );
              })()}

              {/* ── 新規生成モード ── */}
              {crossMode === "generate" && (() => {
                const genTargetIds = Object.entries(crossSelectedTargets).filter(([,v]) => v).map(([k]) => k);
                // 先頭選択済みマッピングのdisplay_fields（フォーム構造から動的生成）
                const firstMid = genTargetIds[0] || "";
                const displayFields = genDisplayFields[firstMid] || [];
                const hasPreview = displayFields.length > 0;
                const inputStyle = { width: "100%", padding: "9px 10px", borderRadius: 8, border: "1px solid #c4b5fd", fontSize: 13, boxSizing: "border-box" as const };
                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {/* ① 基本情報入力 */}
                    <div style={{ border: "2px solid #7c3aed", borderRadius: 14, padding: "18px 20px", background: "#faf5ff" }}>
                      <div style={{ fontSize: 13, fontWeight: 900, color: "#4c1d95", marginBottom: 14 }}>✨ 新規{cIT.entity}プロフィール生成</div>
                      <div style={{ fontSize: 11, color: "#6d28d9", lineHeight: 1.6, marginBottom: 12 }}>
                        AIはここでプロフィール文面とフォーム項目対応を作ります。実媒体への登録はここでは行わず、確認後に承認待ちタスクとして作成します。
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                        <div style={{ gridColumn: "1 / -1" }}>
                          <label style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", display: "block", marginBottom: 4 }}>{cIT.entity}名 *</label>
                          <input value={genCastName} onChange={e => setGenCastName(e.target.value)} placeholder="例: さくら" style={inputStyle} />
                        </div>
                        <div>
                          <label style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", display: "block", marginBottom: 4 }}>年齢</label>
                          <input value={genAge} onChange={e => setGenAge(e.target.value)} placeholder="22" style={inputStyle} />
                        </div>
                        <div>
                          <label style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", display: "block", marginBottom: 4 }}>身長 (cm)</label>
                          <input value={genHeight} onChange={e => setGenHeight(e.target.value)} placeholder="160" style={inputStyle} />
                        </div>
                        {/* スリーサイズ */}
                        <div>
                          <label style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", display: "block", marginBottom: 4 }}>バスト / カップ</label>
                          <div style={{ display: "flex", gap: 6 }}>
                            <input value={genBust} onChange={e => setGenBust(e.target.value)} placeholder="84" style={{ ...inputStyle, flex: 1 }} />
                            <input value={genCup} onChange={e => setGenCup(e.target.value)} placeholder="E" style={{ ...inputStyle, width: 56, flex: "none" }} />
                          </div>
                        </div>
                        <div>
                          <label style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", display: "block", marginBottom: 4 }}>ウエスト / ヒップ</label>
                          <div style={{ display: "flex", gap: 6 }}>
                            <input value={genWaist} onChange={e => setGenWaist(e.target.value)} placeholder="58" style={{ ...inputStyle, flex: 1 }} />
                            <input value={genHip} onChange={e => setGenHip(e.target.value)} placeholder="85" style={{ ...inputStyle, flex: 1 }} />
                          </div>
                        </div>
                        <div>
                          <label style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", display: "block", marginBottom: 4 }}>タイプ・雰囲気（任意）</label>
                          <input value={genTypeHint} onChange={e => setGenTypeHint(e.target.value)} placeholder="例: 天然系、元気系" style={inputStyle} />
                        </div>
                      </div>
                      <div style={{ marginBottom: 10 }}>
                        <label style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", display: "block", marginBottom: 4 }}>AIへの追加指示（任意）</label>
                        <textarea value={genInstructions} onChange={e => setGenInstructions(e.target.value)}
                          placeholder="例: 新人らしく初々しい文体で。趣味は読書と映画鑑賞を入れて。前職はOL。"
                          rows={2} style={{ width: "100%", padding: "9px 10px", borderRadius: 8, border: "1px solid #c4b5fd", fontSize: 13, resize: "vertical", boxSizing: "border-box" }} />
                      </div>
                      <div style={{ marginBottom: 10 }}>
                        <button type="button" onClick={() => setTab("sites")}
                          style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "9px 16px", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 12, border: genRegisterUrlError ? "2px solid #dc2626" : "1.5px solid #a78bfa", background: genRegisterUrlError ? "#fef2f2" : "#f5f3ff", color: genRegisterUrlError ? "#dc2626" : "#7c3aed" }}>
                          🔍 {genRegisterUrlError ? "登録フォームの自動検出に失敗しました — 媒体基盤タブで深掘りを再実行してください" : "媒体基盤タブで深掘りを実行してから生成してください"}
                        </button>
                      </div>
                      {/* 登録先選択 */}
                      <div style={{ marginBottom: 10 }}>
                        <label style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", display: "block", marginBottom: 6 }}>登録先サイト（承認待ちタスク作成先）</label>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {mappings.map(m => (
                            <label key={m.mapping_id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 20, border: crossSelectedTargets[m.mapping_id] ? "2px solid #7c3aed" : "1px solid #ddd6fe", background: crossSelectedTargets[m.mapping_id] ? "#ede9fe" : "#fff", cursor: "pointer", fontSize: 12, fontWeight: 700, color: crossSelectedTargets[m.mapping_id] ? "#4c1d95" : "#374151", userSelect: "none" }}>
                              <input type="checkbox" checked={!!crossSelectedTargets[m.mapping_id]}
                                onChange={e => setCrossSelectedTargets(prev => ({ ...prev, [m.mapping_id]: e.target.checked }))}
                                style={{ width: 13, height: 13 }} />
                              {m.media_name}
                            </label>
                          ))}
                        </div>
                        {genTargetIds.length === 0 && <div style={{ fontSize: 11, color: "#d97706", marginTop: 4 }}>※登録先を選択してから生成してください</div>}
                      </div>
                      <button onClick={async () => {
                        if (!genCastName) { setMsg(`${cIT.entity}名を入力してください`); return; }
                        if (genTargetIds.length === 0) { setMsg("登録先サイトを選択してください"); return; }
                        if (monitoringResults.length === 0) { setGenNoMonitoringWarning(true); return; }
                        setGenNoMonitoringWarning(false);
                        setGenPreviewLoading(true); setGenDisplayFields({}); setGenFillFields({}); setGenResult(null);
                        try {
                          const industry = (mappings.find(m => genTargetIds.includes(m.mapping_id)) as { industry?: string } | undefined)?.industry || "nightlife";
                          const r = await generateProfilePreview({
                            cast_name: genCastName, age: genAge, height: genHeight, bust: genBust, cup: genCup,
                            waist: genWaist, hip: genHip, type_hint: genTypeHint, custom_instructions: genInstructions,
                            industry, target_mapping_ids: genTargetIds,
                          });
                          const newDisplay: Record<string, import("@/lib/api").ProfileDisplayField[]> = {};
                          const newFill: Record<string, Record<string, string>> = {};
                          const errors: string[] = [];
                          for (const mr of r.mapping_results) {
                            if (mr.error) {
                              const mName = mr.media_name || mr.mapping_id;
                              errors.push(`【${mName}】${mr.error}${mr.target_url ? `（URL: ${mr.target_url}）` : ""}`);
                              continue;
                            }
                            if (mr.display_fields && mr.display_fields.length > 0) newDisplay[mr.mapping_id] = mr.display_fields;
                            if (mr.fill_fields && Object.keys(mr.fill_fields).length > 0) newFill[mr.mapping_id] = { ...mr.fill_fields };
                          }
                          setGenDisplayFields(newDisplay);
                          setGenFillFields(newFill);
                          const urlNotFound = errors.some(e => e.includes("新規登録フォームのURL"));
                          if (urlNotFound) {
                            setGenRegisterUrlError(true);
                            setMsg("⚠️ " + errors.join("\n"));
                          } else if (errors.length > 0) {
                            setMsg("⚠️ 以下のサイトでエラーが発生しました:\n" + errors.join("\n"));
                          } else if (Object.keys(newDisplay).length === 0) {
                            setMsg("⚠️ フォーム要素を取得できませんでした。深堀が完了しているか確認してください。");
                          }
                        } catch(e: unknown) { setMsg("生成失敗: " + (e instanceof Error ? e.message : "不明")); }
                        finally { setGenPreviewLoading(false); }
                      }} disabled={genPreviewLoading || !genCastName || genTargetIds.length === 0}
                        style={{ marginTop: 4, padding: "10px 24px", borderRadius: 8, border: "none", background: genPreviewLoading || !genCastName || genTargetIds.length === 0 ? "#9ca3af" : "#7c3aed", color: "#fff", fontWeight: 700, fontSize: 14, cursor: genPreviewLoading || !genCastName || genTargetIds.length === 0 ? "not-allowed" : "pointer" }}>
                        {genPreviewLoading ? "⏳ フォーム解析・AI生成中..." : "✨ プロフィールを生成"}
                      </button>

                      {/* 市場監視データなし警告 */}
                      {genNoMonitoringWarning && (
                        <div style={{ marginTop: 14, padding: "16px 18px", borderRadius: 10, background: "linear-gradient(135deg, #fffbeb, #fef3c7)", border: "1.5px solid #f59e0b" }}>
                          <div style={{ fontSize: 13, fontWeight: 800, color: "#92400e", marginBottom: 8 }}>⚠️ 市場監視データがありません</div>
                          <div style={{ fontSize: 12, color: "#78350f", marginBottom: 14, lineHeight: 1.7 }}>
                            📈 市場監視を先に実行すると、トレンドフレーズ・人気タイプ・競合分析を踏まえた<br/>
                            高精度なプロフィール生成が可能になります。<br/>
                            <span style={{ fontWeight: 700 }}>このまま生成すると、AIの汎用知識のみで出力されます。</span>
                          </div>
                          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                            <button onClick={() => { setTab("monitoring"); setGenNoMonitoringWarning(false); }}
                              style={{ padding: "9px 20px", borderRadius: 7, border: "none", background: "#7c3aed", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                              📈 市場監視を実行する
                            </button>
                            <button onClick={async () => {
                              setGenNoMonitoringWarning(false);
                              setGenPreviewLoading(true); setGenDisplayFields({}); setGenFillFields({}); setGenResult(null);
                              try {
                                const industry = (mappings.find(m => genTargetIds.includes(m.mapping_id)) as { industry?: string } | undefined)?.industry || "nightlife";
                                const r = await generateProfilePreview({
                                  cast_name: genCastName, age: genAge, height: genHeight, bust: genBust, cup: genCup,
                                  waist: genWaist, hip: genHip, type_hint: genTypeHint, custom_instructions: genInstructions,
                                  industry, target_mapping_ids: genTargetIds,
                                });
                                const newDisplay: Record<string, import("@/lib/api").ProfileDisplayField[]> = {};
                                const newFill: Record<string, Record<string, string>> = {};
                                const errors: string[] = [];
                                for (const mr of r.mapping_results) {
                                  if (mr.error) {
                                    const mName = mr.media_name || mr.mapping_id;
                                    errors.push(`【${mName}】${mr.error}${mr.target_url ? `（URL: ${mr.target_url}）` : ""}`);
                                    continue;
                                  }
                                  if (mr.display_fields && mr.display_fields.length > 0) newDisplay[mr.mapping_id] = mr.display_fields;
                                  if (mr.fill_fields && Object.keys(mr.fill_fields).length > 0) newFill[mr.mapping_id] = { ...mr.fill_fields };
                                }
                                setGenDisplayFields(newDisplay);
                                setGenFillFields(newFill);
                                const urlNotFound2 = errors.some(e => e.includes("新規登録フォームのURL"));
                                if (urlNotFound2) {
                                  setGenRegisterUrlError(true);
                                  setMsg("⚠️ " + errors.join("\n"));
                                } else if (errors.length > 0) {
                                  setMsg("⚠️ 以下のサイトでエラーが発生しました:\n" + errors.join("\n"));
                                } else if (Object.keys(newDisplay).length === 0) {
                                  setMsg("⚠️ フォーム要素を取得できませんでした。深堀が完了しているか確認してください。");
                                }
                              } catch(e: unknown) { setMsg("生成失敗: " + (e instanceof Error ? e.message : "不明")); }
                              finally { setGenPreviewLoading(false); }
                            }}
                              style={{ padding: "9px 20px", borderRadius: 7, border: "1.5px solid #d97706", background: "#fff7ed", color: "#92400e", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                              このまま生成する
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* ② 生成結果プレビュー（フォームフィールドに合わせた動的表示） */}
                    {hasPreview && genTargetIds.map(mid => {
                      const df = genDisplayFields[mid] || [];
                      const mName = mappings.find(m => m.mapping_id === mid)?.media_name || mid;
                      if (df.length === 0) return null;
                      return (
                        <div key={mid} style={{ border: "2px solid #059669", borderRadius: 14, padding: "18px 20px", background: "#f0fdf4" }}>
                          <div style={{ fontSize: 13, fontWeight: 900, color: "#065f46", marginBottom: 14 }}>📝 {mName} — 生成結果（{df.length}フィールド・編集可）</div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {df.map((field, i) => {
                              const currentVal = genFillFields[mid]?.[field.selector] ?? field.value;
                              const isLong = field.type === "textarea" || currentVal.length > 60;
                              return (
                                <div key={i} style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 8, alignItems: "flex-start" }}>
                                  <div style={{ fontSize: 11, fontWeight: 700, color: "#065f46", paddingTop: 8, wordBreak: "break-all" }}>{field.label}</div>
                                  {isLong ? (
                                    <textarea value={currentVal}
                                      onChange={e => setGenFillFields(ff => ({ ...ff, [mid]: { ...(ff[mid] || {}), [field.selector]: e.target.value } }))}
                                      rows={3} style={{ padding: "7px 9px", borderRadius: 6, border: "1px solid #6ee7b7", fontSize: 12, resize: "vertical", boxSizing: "border-box" }} />
                                  ) : (
                                    <input value={currentVal}
                                      onChange={e => setGenFillFields(ff => ({ ...ff, [mid]: { ...(ff[mid] || {}), [field.selector]: e.target.value } }))}
                                      style={{ padding: "7px 9px", borderRadius: 6, border: "1px solid #6ee7b7", fontSize: 12, boxSizing: "border-box" }} />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}

                    {/* ③ 承認待ちタスク作成 */}
                    {genResult && (
                      <div style={{ padding: "10px 14px", borderRadius: 8, background: genResult.ok ? "#f0fdf4" : "#fef2f2", border: `1px solid ${genResult.ok ? "#86efac" : "#fca5a5"}`, color: genResult.ok ? "#15803d" : "#b91c1c", fontSize: 13, fontWeight: 600 }}>
                        {genResult.ok ? "✅ " : "❌ "}{genResult.msg}
                      </div>
                    )}
                    <button onClick={async () => {
                      if (!genCastName) { setMsg(`${cIT.entity}名が未入力です`); return; }
                      if (genTargetIds.length === 0) { setMsg("登録先サイトを選択してください"); return; }
                      if (!hasPreview) { setMsg("先にプロフィールを生成してください"); return; }
                      setGenExecuting(true); setGenResult(null);
                      let ok = 0; let fail = 0;
                      const failures: string[] = [];
                      for (const mid of genTargetIds) {
                        const fillData = genFillFields[mid];
                        if (!fillData || Object.keys(fillData).length === 0) { fail++; continue; }
                        const targetMapping = mappings.find(m => m.mapping_id === mid);
                        const opMap = targetMapping?.operation_mappings?.entity_register;
                        const saveSelector = opMap?.save_selector || opMap?.selectors?.save?.selector || "";
                        if (!targetMapping || !isProductionReadyOperationMapping(opMap) || !saveSelector) {
                          fail++;
                          failures.push(`${targetMapping?.media_name || mid}: AI整備済みの登録フォーム/保存ボタンが未検出`);
                          continue;
                        }
                        const selectors: Record<string, { selector: string; label?: string; type?: string; source?: string; confidence?: string }> = {};
                        const fields: Array<{ selector: string; label: string; type: string; value: string }> = [];
                        const payload: Record<string, unknown> = {
                          media_mapping_id: mid,
                          media_name: targetMapping.media_name,
                          name: genCastName,
                          generated_by: "ai_profile_preview",
                        };
                        (genDisplayFields[mid] || []).forEach((field, index) => {
                          const value = genFillFields[mid]?.[field.selector] ?? field.value ?? "";
                          if (!field.selector || value === "") return;
                          const key = `generated_field_${index + 1}`;
                          selectors[key] = {
                            selector: field.selector,
                            label: field.label || key,
                            type: field.type || "text",
                            source: "ai_profile_preview",
                            confidence: "high",
                          };
                          fields.push({
                            selector: field.selector,
                            label: field.label || key,
                            type: field.type || "text",
                            value,
                          });
                          payload[key] = value;
                        });
                        selectors.save = { selector: saveSelector, label: "保存", type: "button", source: "ai_profile_preview", confidence: "high" };
                        if (fields.length === 0) {
                          fail++;
                          failures.push(`${targetMapping.media_name}: 入力フィールドなし`);
                          continue;
                        }
                        try {
                          await createAgentTask({
                            agent_type: "hp_update",
                            operation_type: "entity_register",
                            industry: targetMapping.industry || "nightlife",
                            entity_type: "entity",
                            media_mapping_id: mid,
                            payload,
                            operation_mapping_override: {
                              status: "READY",
                              executable: true,
                              target_url: opMap?.target_url || "",
                              source: "TASK_OVERRIDE",
                              confirmed: true,
                              production_ready: true,
                              candidate_only: false,
                              confirmation_status: "AI_CONFIRMED",
                              fields,
                              selectors,
                              form_schema: { fields },
                              save_selector: saveSelector,
                              manual_title: "AI新規生成プレビュー",
                            },
                          });
                          ok++;
                        } catch(e: unknown) {
                          fail++;
                          failures.push(`${targetMapping.media_name}: ${e instanceof Error ? e.message : "タスク作成失敗"}`);
                          console.error(e);
                        }
                      }
                      try {
                        const d = await listAgentTasks();
                        setTasks(sortTasksNewest(d.tasks || []));
                      } catch { /* タスクは作成済みなので画面遷移は続行 */ }
                      if (ok > 0) setTab("tasks");
                      setGenResult({ ok: fail === 0, msg: `${ok}件の承認待ち登録タスクを作成${fail > 0 ? `（${fail}件失敗: ${failures.join(" / ")}）` : ""}` });
                      setGenExecuting(false);
                    }} disabled={genExecuting || !hasPreview || genTargetIds.length === 0}
                      style={{ padding: "12px 28px", borderRadius: 10, border: "none", background: genExecuting || !hasPreview || genTargetIds.length === 0 ? "#9ca3af" : "#059669", color: "#fff", fontWeight: 800, fontSize: 15, cursor: genExecuting || !hasPreview || genTargetIds.length === 0 ? "not-allowed" : "pointer" }}>
                      {genExecuting ? "⏳ タスク作成中..." : `✅ ${genTargetIds.length}サイトの承認待ち登録タスクを作成`}
                    </button>
                  </div>
                );
              })()}

              {crossMode === "copy" && <>
              {/* 説明 */}
              <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "12px 16px", fontSize: 12, color: "#475569", lineHeight: 1.7 }}>
                取得元の{cIT.entity}情報を、登録済みの複数媒体へ一括展開します。媒体ごとのフォーム構造は解析済みのためAIが自動マッピングします。
              </div>

              {/* ── 1: 取得元 ── */}
              <div style={{ border: "2px solid #f59e0b", borderRadius: 14, padding: "18px 20px", background: "#fffbeb" }}>
                <div style={{ fontSize: 13, fontWeight: 900, color: "#78350f", marginBottom: 14 }}>📤 取得元</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#92400e", marginBottom: 5 }}>媒体</div>
                    <select value={crossSourceMappingId} onChange={e => {
                      const _nv = e.target.value;
                      setCrossSourceMappingId(_nv); setCrossSrcPreview(null); setCrossSelectedEntity(null); setCrossEntities([]); setCrossPreviewData(null);
                      if (_nv) {
                        const _sm = mappings.find(m => m.mapping_id === _nv);
                        const _sp = _sm?.business_conditions?.site_purpose || "";
                        if (_sp === "scout" || _sp === "reply") setCrossMode("recruit");
                        else if (_sp === "post" || _sp === "monitor") setCrossMode("copy");
                      }
                    }}
                      style={{ width: "100%", padding: "9px 10px", borderRadius: 8, border: "1px solid #fbbf24", fontSize: 12, background: "#fff" }}>
                      <option value="">選択してください</option>
                      {mappings.map(m => {
                        const _p = m.business_conditions?.site_purpose || "";
                        const _badge = _p && _p !== "other" ? ` [${SITE_PURPOSE_LABEL[_p] || _p}]` : "";
                        return <option key={m.mapping_id} value={m.mapping_id}>{m.media_name}{_badge}</option>;
                      })}
                    </select>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#92400e", marginBottom: 5 }}>対象ページURL <span style={{ fontWeight: 400, color: "#a16207" }}>（任意）</span></div>
                    <input value={crossSourceUrl} onChange={e => setCrossSourceUrl(e.target.value)}
                      placeholder="例: /cast/profile.php?id=12"
                      style={{ width: "100%", padding: "9px 10px", borderRadius: 8, border: "1px solid #fbbf24", fontSize: 12, boxSizing: "border-box" }} />
                  </div>
                </div>
                <button onClick={async () => {
                  if (!crossSourceMappingId) { setMsg("取得元媒体を選択してください"); return; }
                  setCrossSrcPreviewLoading(true);
                  try {
                    const p = await getFormSnapshot(crossSourceMappingId, crossSourceUrl || undefined);
                    setCrossSrcPreview(p);
                  } catch(e: unknown) { setMsg("プレビュー失敗: " + (e as Error).message); }
                  finally { setCrossSrcPreviewLoading(false); }
                }} disabled={crossSrcPreviewLoading || !crossSourceMappingId}
                  style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #f59e0b", background: "#fff", color: "#92400e", fontWeight: 700, fontSize: 12, cursor: crossSourceMappingId ? "pointer" : "default", marginBottom: crossSrcPreview ? 10 : 0 }}>
                  {crossSrcPreviewLoading ? "取得中..." : "🔍 ページを確認する"}
                </button>
                {crossSrcPreview?.screenshot_b64 && (
                  <div>
                    <div style={{ fontSize: 11, color: "#a16207", marginBottom: 4, marginTop: 8 }}>現在ページ: {crossSrcPreview.current_url || crossSrcPreview.title}</div>
                    <img src={`data:image/png;base64,${crossSrcPreview.screenshot_b64}`}
                      style={{ width: "100%", borderRadius: 8, border: "1px solid #fde68a", display: "block" }} alt="取得元" />
                  </div>
                )}
              </div>

              {/* ── 2: 操作タイプ ── */}
              <div style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: "18px 20px", background: "#fff" }}>
                <div style={{ fontSize: 13, fontWeight: 900, color: "#1e1b4b", marginBottom: 14 }}>⚡ 何をする？</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 8 }}>
                  {([
                    ["entity_update",    "✏️", "情報更新",           `既存${cIT.entity}情報を最新に更新`],
                    ["profile_update",   "👤", "プロフィール詳細",   `${cIT.entity}の詳細項目・自己紹介を更新`],
                    ["news_post",        "📰", "ニュース投稿",       `${cIT.news}・イベントを投稿`],
                    ["blog_post",        "✍️", "店長ブログ",         `${cIT.blog}を投稿`],
                    ["text_update",      "📝", "テキスト更新",       `指定${cIT.entity}のコメント・PR文を更新`],
                    ["media_replace",    "📸", "メイン画像差替",     `トップ・メインの${cIT.media}を差替`],
                    ["schedule_update",  "📅", `${cIT.schedule}更新`, `指定${cIT.entity}の${cIT.schedule}日・シフトを反映`],
                    ["price_update",     "💰", "料金更新",           "料金表示を更新"],
                  ] as [string, string, string, string][]).map(([op, icon, label, desc]) => (
                    <button key={op} onClick={() => { setCrossTargetOp(op); setCrossSelectedEntity(null); setCrossEntities([]); setCrossPreviewData(null); setCrossUpdateScope("individual"); setCrossSrcExtractFields([]); }}
                      style={{ padding: "10px 12px", borderRadius: 10, border: crossTargetOp === op ? "2px solid #7c3aed" : "1px solid #e5e7eb", background: crossTargetOp === op ? "#f5f3ff" : "#fafafa", cursor: "pointer", textAlign: "left" }}>
                      <div style={{ fontSize: 18, marginBottom: 4 }}>{icon}</div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: crossTargetOp === op ? "#4c1d95" : "#1e1b4b", marginBottom: 2 }}>{label}</div>
                      <div style={{ fontSize: 10, color: "#6b7280", lineHeight: 1.4 }}>{desc}</div>
                    </button>
                  ))}
                </div>
                {(() => {
                  const hasSelectedTargets = Object.values(crossSelectedTargets).some(Boolean);
                  const candidateMaps = mappings.filter(m => {
                    if (hasSelectedTargets) return !!crossSelectedTargets[m.mapping_id] || m.mapping_id === crossSourceMappingId;
                    if (crossSourceMappingId) return m.mapping_id === crossSourceMappingId;
                    return true;
                  });
                  let fieldLabels = mappedFieldLabelsForOperation(candidateMaps, crossTargetOp);
                  let isFallback = false;
                  if (fieldLabels.length === 0 && crossSourceMappingId) {
                    const srcMap = mappings.find(m => m.mapping_id === crossSourceMappingId);
                    if (srcMap) {
                      const fallbackSet = new Set<string>();
                      const allOpKeys = Array.from(new Set([
                        "entity_update","profile_update","news_post","blog_post","text_update","media_replace","schedule_update","price_update",
                        ...Object.keys(srcMap.operation_mappings || {}),
                      ]));
                      allOpKeys.forEach(opKey => {
                        mappedFieldsForOperation(srcMap, opKey).forEach(f => { const l = labelForMappingField(f); if (l) fallbackSet.add(l); });
                      });
                      fieldLabels = Array.from(fallbackSet).slice(0, 200);
                      if (fieldLabels.length > 0) isFallback = true;
                    }
                  }
                  const selectedSet = new Set(crossSrcExtractFields);
                  return (
                    <div style={{ marginTop: 14, padding: "10px 12px", borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 900, color: "#334155" }}>取得フィールドを絞る（任意）</div>
                          <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>
                            {isFallback
                              ? "この操作のAI整備済みフィールドがないため、同一媒体のAI整備済み項目を参考表示しています。"
                              : "AI整備済みフォームからログイン/送信/hidden以外の項目を選べます。未選択でもAIが自動で判断します。"}
                          </div>
                        </div>
                        {fieldLabels.length > 0 && (
                          <div style={{ fontSize: 10, color: "#64748b", fontWeight: 700 }}>
                            {fieldLabels.length}候補 / 選択 {crossSrcExtractFields.length}
                          </div>
                        )}
                      </div>
                      {fieldLabels.length > 0 ? (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, maxHeight: 130, overflowY: "auto", padding: 2 }}>
                          {fieldLabels.map(label => {
                            const selected = selectedSet.has(label);
                            return (
                              <button key={label} onClick={() => setCrossSrcExtractFields(prev => prev.includes(label) ? prev.filter(x => x !== label) : [...prev, label])}
                                style={{ fontSize: 10, padding: "4px 9px", borderRadius: 999, border: selected ? "1px solid #7c3aed" : "1px solid #cbd5e1", background: selected ? "#ede9fe" : "#fff", color: selected ? "#4c1d95" : "#475569", cursor: "pointer", fontWeight: selected ? 800 : 600 }}>
                                {selected ? "✓ " : ""}{label}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div style={{ fontSize: 11, color: "#475569", background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 6, padding: "7px 9px" }}>
                          AI整備済みフィールドがありません。媒体基盤のAI整備で対象フォームを保存してください。
                        </div>
                      )}
                      {crossSrcExtractFields.length > 0 && (
                        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                          <button onClick={() => setCrossSrcExtractFields([])}
                            style={{ padding: "7px 12px", borderRadius: 7, border: "1px solid #e5e7eb", background: "#fff", color: "#64748b", fontWeight: 700, fontSize: 11, cursor: "pointer" }}>
                            選択解除
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* ── 2.5: 更新スコープ＆対象指定 ── エンティティ系操作のみ表示 */}
              {(() => {
                const ENTITY_OPS = new Set(["entity_update", "profile_update", "media_replace", "text_update", "schedule_update"]);
                if (!ENTITY_OPS.has(crossTargetOp)) return null;
                const scopeBtnStyle = (active: boolean) => ({
                  flex: 1, padding: "10px 12px", borderRadius: 10, textAlign: "left" as const,
                  border: active ? "2px solid #ec4899" : "1px solid #fbcfe8",
                  background: active ? "#fce7f3" : "#fff", cursor: "pointer",
                });
                return (
                  <div style={{ border: "1px solid #fbcfe8", borderRadius: 14, padding: "18px 20px", background: "#fdf2f8", display: "flex", flexDirection: "column", gap: 14 }}>
                    {/* スコープ選択 */}
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 900, color: "#9d174d", marginBottom: 10 }}>📊 更新範囲を選ぶ</div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => { setCrossUpdateScope("all"); setCrossSelectedEntity(null); setCrossPreviewData(null); }} style={scopeBtnStyle(crossUpdateScope === "all")}>
                          <div style={{ fontSize: 16, marginBottom: 2 }}>🔄</div>
                          <div style={{ fontSize: 12, fontWeight: 800, color: crossUpdateScope === "all" ? "#9d174d" : "#374151" }}>全体を更新</div>
                          <div style={{ fontSize: 10, color: "#6b7280" }}>全{cIT.entity}を一括展開</div>
                        </button>
                        <button onClick={() => { setCrossUpdateScope("diff"); setCrossPreviewData(null); }} style={scopeBtnStyle(crossUpdateScope === "diff")}>
                          <div style={{ fontSize: 16, marginBottom: 2 }}>↕️</div>
                          <div style={{ fontSize: 12, fontWeight: 800, color: crossUpdateScope === "diff" ? "#9d174d" : "#374151" }}>差分を更新</div>
                          <div style={{ fontSize: 10, color: "#6b7280" }}>{cIT.entity}を選んで変更分のみ</div>
                        </button>
                        <button onClick={() => { setCrossUpdateScope("individual"); setCrossPreviewData(null); }} style={scopeBtnStyle(crossUpdateScope === "individual")}>
                          <div style={{ fontSize: 16, marginBottom: 2 }}>{cIT.icon}</div>
                          <div style={{ fontSize: 12, fontWeight: 800, color: crossUpdateScope === "individual" ? "#9d174d" : "#374151" }}>1件を指定</div>
                          <div style={{ fontSize: 10, color: "#6b7280" }}>{cIT.entity}を選んで更新</div>
                        </button>
                      </div>
                    </div>

                    {/* 全体を更新: 説明のみ */}
                    {crossUpdateScope === "all" && (
                      <div style={{ fontSize: 12, color: "#be185d", background: "#fff", borderRadius: 8, padding: "10px 14px", border: "1px solid #fbcfe8" }}>
                        取得元の全{cIT.entity}を自動取得し、展開先へ一括反映します。<br/>
                        <span style={{ color: "#9ca3af" }}>プレビューをスキップして直接展開できます。{cIT.entity}数が多い場合は複数タスクが作成されます。</span>
                      </div>
                    )}

                    {/* 1件を指定 / 差分を更新: エンティティ選択 */}
                    {(crossUpdateScope === "individual" || crossUpdateScope === "diff") && (
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#9d174d", marginBottom: 10 }}>
                          {cIT.icon} どの{cIT.entity}を更新しますか？
                        </div>
                        {!crossSourceMappingId ? (
                          <div style={{ fontSize: 12, color: "#9ca3af" }}>先に取得元媒体を選択してください</div>
                        ) : (
                          <>
                            <button onClick={async () => {
                              setCrossEntityLoading(true);
                              setCrossEntities([]);
                              setCrossSelectedEntity(null);
                              try {
                                const r = await fetchCrossMediaSourceEntities({
                                  source_mapping_id: crossSourceMappingId,
                                  target_operation_type: crossTargetOp,
                                });
                                setCrossEntities(r.entities || []);
                                setCrossEntityLabel(r.entity_label || cIT.entity);
                                if ((r.entities || []).length === 0) {
                                  setMsg(r.message || `${cIT.entity}が見つかりませんでした`);
                                }
                              } catch(e: unknown) {
                                setMsg("❌ 対象一覧の取得失敗: " + (e instanceof Error ? e.message : "不明なエラー"));
                              } finally { setCrossEntityLoading(false); }
                            }} disabled={crossEntityLoading}
                              style={{ padding: "9px 16px", borderRadius: 8, border: "1px solid #ec4899", background: "#fff", color: "#9d174d", fontWeight: 800, fontSize: 12, cursor: crossEntityLoading ? "default" : "pointer", marginBottom: crossEntities.length > 0 ? 12 : 0 }}>
                              {crossEntityLoading ? "⏳ 読み込み中（Playwright + AI）..." : `📋 取得元から${cIT.entity}一覧を読み込む`}
                            </button>
                            {crossEntities.length > 0 && (() => {
                              const visibleEnts = crossEntities.filter(e => !e.hidden);
                              const hiddenEnts  = crossEntities.filter(e => e.hidden);
                              const autoShowHidden = visibleEnts.length === 0 && hiddenEnts.length > 0;
                              const hiddenUncertain = autoShowHidden;
                              const displayEnts = (showHiddenEntities || autoShowHidden) ? crossEntities : visibleEnts;
                              return (
                                <div>
                                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
                                    <span style={{ fontSize: 11, color: "#be185d", fontWeight: 700 }}>
                                      {autoShowHidden
                                        ? <>{crossEntities.length}件の{crossEntityLabel}<span style={{ color: "#b45309", fontWeight: 400 }}>（非表示判定が全件に出たため要点検扱い）</span></>
                                        : <>{visibleEnts.length}件の{crossEntityLabel}{hiddenEnts.length > 0 && <span style={{ color: "#9ca3af", fontWeight: 400 }}>（非表示 {hiddenEnts.length}件含む）</span>}</>
                                      }
                                      {crossSelectedEntity ? ` — 選択中: ${crossSelectedEntity.name}` : "（1件選択）"}
                                    </span>
                                    {hiddenEnts.length > 0 && !autoShowHidden && (
                                      <button onClick={() => setShowHiddenEntities(v => !v)}
                                        style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, border: "1px solid #d1d5db", background: showHiddenEntities ? "#f3f4f6" : "#fff", color: "#6b7280", cursor: "pointer" }}>
                                        {showHiddenEntities ? "非表示を隠す" : "非表示も表示"}
                                      </button>
                                    )}
                                  </div>
                                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, maxHeight: 220, overflowY: "auto", padding: 4 }}>
                                    {displayEnts.map((ent, i) => {
                                      const sel = crossSelectedEntity?.url === ent.url;
                                      const isHidden = hiddenUncertain ? false : !!ent.hidden;
                                      return (
                                        <button key={i} onClick={() => setCrossSelectedEntity(sel ? null : ent)}
                                          style={{ padding: "6px 12px", borderRadius: 16, border: sel ? "2px solid #ec4899" : isHidden ? "1px dashed #d1d5db" : "1px solid #fbcfe8", background: sel ? "#fce7f3" : isHidden ? "#f9fafb" : "#fff", color: sel ? "#9d174d" : isHidden ? "#9ca3af" : "#6b7280", fontSize: 12, fontWeight: sel ? 700 : 400, cursor: "pointer", opacity: isHidden ? 0.6 : 1 }}>
                                          {sel ? "✓ " : ""}{ent.name}{hiddenUncertain ? " ?" : isHidden ? " 🚫" : ""}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })()}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* ── 3: 出力先 & 実行 ── */}
              <div style={{ border: "2px solid #7c3aed", borderRadius: 14, padding: "18px 20px", background: "#faf5ff" }}>
                <div style={{ fontSize: 13, fontWeight: 900, color: "#4c1d95", marginBottom: 14 }}>📥 どこへ展開する？</div>
                {crossSourceMappingId && (
                  <div style={{ fontSize: 11, color: "#4c1d95", background: "#f5f3ff", border: "1px solid #ddd6fe", borderRadius: 6, padding: "7px 9px", marginBottom: 10 }}>
                    取得元の媒体も更新先に選べます。同じ媒体内でAI生成・差分反映する場合は、取得元にもチェックを入れてください。
                  </div>
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                  {mappings.map(m => {
                    const chkRes = loginCheckResults[m.mapping_id];
                    const chkLoading = crossDestCheckLoading[m.mapping_id];
                    const isSourceTarget = !!crossSourceMappingId && m.mapping_id === crossSourceMappingId;
                    return (
                      <div key={m.mapping_id} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 24, border: crossSelectedTargets[m.mapping_id] ? "2px solid #7c3aed" : "1px solid #ddd6fe", background: crossSelectedTargets[m.mapping_id] ? "#ede9fe" : "#fff", cursor: "pointer", fontSize: 13, fontWeight: 700, color: crossSelectedTargets[m.mapping_id] ? "#4c1d95" : "#374151", userSelect: "none" }}>
                          <input type="checkbox" checked={!!crossSelectedTargets[m.mapping_id]}
                            onChange={e => setCrossSelectedTargets(prev => ({ ...prev, [m.mapping_id]: e.target.checked }))}
                            style={{ width: 15, height: 15 }} />
                          {m.media_name}
                          {isSourceTarget && <span style={{ fontSize: 9, fontWeight: 900, padding: "1px 6px", borderRadius: 999, background: "#dbeafe", color: "#1d4ed8", border: "1px solid #bfdbfe" }}>取得元</span>}
                          {(() => {
                            const _tp = m.business_conditions?.site_purpose || "";
                            if (!_tp || _tp === "other") return null;
                            const _tc = SITE_PURPOSE_COLOR[_tp];
                            if (!_tc) return null;
                            return <span style={{ fontSize: 9, fontWeight: 800, padding: "1px 5px", borderRadius: 4, background: _tc.bg, color: _tc.text, border: `1px solid ${_tc.border}`, marginLeft: 2 }}>{SITE_PURPOSE_LABEL[_tp]}</span>;
                          })()}
                        </label>
                        {crossSelectedTargets[m.mapping_id] && (() => {
                          const _tp = m.business_conditions?.site_purpose || "";
                          if (_tp !== "scout" && _tp !== "reply") return null;
                          return (
                            <div style={{ fontSize: 10, color: "#b91c1c", padding: "3px 10px", borderRadius: 5, background: "#fef2f2", border: "1px solid #fca5a5", flexBasis: "100%", marginTop: 2 }}>
                              ⚠️ {SITE_PURPOSE_LABEL[_tp]}サイトはコピー展開非対応。「🧲 求人対応」モードを使ってください
                            </div>
                          );
                        })()}
                        <button onClick={async (e) => {
                          e.preventDefault();
                          setCrossDestCheckLoading(prev => ({ ...prev, [m.mapping_id]: true }));
                          try {
                            const r = await loginCheckMediaMapping(m.mapping_id);
                            setLoginCheckResults(prev => ({ ...prev, [m.mapping_id]: { login_success: r.login_success, message: r.message } }));
                          } catch(err: unknown) {
                            setLoginCheckResults(prev => ({ ...prev, [m.mapping_id]: { login_success: false, message: (err as Error).message || "接続確認に失敗しました" } }));
                          } finally {
                            setCrossDestCheckLoading(prev => ({ ...prev, [m.mapping_id]: false }));
                          }
                        }} disabled={chkLoading}
                          style={{ padding: "5px 12px", borderRadius: 16, border: "1px solid #c4b5fd", background: "#fff", color: "#4c1d95", fontSize: 11, fontWeight: 700, cursor: chkLoading ? "default" : "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
                          {chkLoading ? "確認中..." : "🔍 接続確認"}
                        </button>
                        {chkRes && (
                          <span style={{ fontSize: 11, color: chkRes.login_success ? "#15803d" : "#b91c1c", fontWeight: 700 }}>
                            {chkRes.login_success ? "✅ OK" : "❌ NG"}
                          </span>
                        )}
                      </div>
                    );
                  })}
                  {mappings.length === 0 && (
                    <div style={{ fontSize: 12, color: "#9ca3af" }}>媒体が登録されていません</div>
                  )}
                  {mappings.length > 0 && !crossSourceMappingId && (
                    <div style={{ fontSize: 11, color: "#6b7280" }}>先に取得元媒体を選択してください</div>
                  )}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, marginBottom: 12, alignItems: "end" }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#4c1d95", marginBottom: 5 }}>AIへの追加指示 <span style={{ fontWeight: 400, color: "#7c3aed" }}>（任意）</span></div>
                    <input value={crossInstruction} onChange={e => setCrossInstruction(e.target.value)}
                      placeholder="例: 名前は「様」なしで / バストのみ / 最新写真3枚"
                      style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #c4b5fd", fontSize: 12, boxSizing: "border-box", background: "#fff" }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#4c1d95", marginBottom: 5 }}>件数上限</div>
                    <input type="number" min={1} max={50} value={crossMaxItems}
                      onChange={e => setCrossMaxItems(Math.max(1, Math.min(50, Number(e.target.value || 1))))}
                      style={{ width: 70, padding: "9px 10px", borderRadius: 8, border: "1px solid #c4b5fd", fontSize: 12, background: "#fff" }} />
                  </div>
                </div>

                <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 11, color: "#92400e", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "10px 12px", marginBottom: 14, cursor: "pointer" }}>
                  <input type="checkbox" checked={crossAccessConfirmed} onChange={e => setCrossAccessConfirmed(e.target.checked)} style={{ marginTop: 1, flexShrink: 0 }} />
                  <span>取得元の利用権限・契約・規約・転載権限を確認済みです</span>
                </label>

                {(() => {
                  const ENTITY_OPS = new Set(["entity_update", "profile_update", "media_replace", "text_update", "schedule_update"]);
                  const needsEntity = ENTITY_OPS.has(crossTargetOp);
                  // 全体スコープのみ個別選択不要。差分・個別は選択必須
                  const entityOk = !needsEntity || crossUpdateScope === "all" || !!crossSelectedEntity;
                  const allSelected = Object.entries(crossSelectedTargets).filter(([,v]) => v).map(([k]) => k);
                  const baseOk = allSelected.length > 0 && !!crossSourceMappingId && crossAccessConfirmed && !crossLoading;
                  // 全体スコープはプレビュー不要、直接作成。差分・個別はプレビュー必要
                  const canPreview = crossUpdateScope !== "all" && baseOk && entityOk && !crossPreviewLoading;
                  const canCreate = baseOk && entityOk && (crossUpdateScope === "all" || crossPreviewData !== null);
                  return (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {/* プレビューボタン */}
                      <button onClick={async () => {
                        if (!canPreview) {
                          setMsg(allSelected.length === 0 ? "展開先を選択してください" : !crossSourceMappingId ? "取得元媒体を選択してください" : !entityOk ? `更新する${cIT.entity}を選択してください` : "利用権限の確認チェックを入れてください");
                          return;
                        }
                        setCrossPreviewLoading(true);
                        setCrossPreviewData(null);
                        setCrossFieldSel({});
                        try {
                          const p = await previewCrossMedia({
                            source_mapping_id: crossSourceMappingId,
                            source_url: crossSourceUrl || undefined,
                            target_mapping_ids: allSelected,
                            target_operation_type: crossTargetOp,
                            instruction: crossInstruction,
                            source_entity_url: crossSelectedEntity?.url || undefined,
                          });
                          setCrossPreviewData(p);
                          if (crossUpdateScope === "diff" && crossSelectedEntity) {
                            // 差分モード: スナップショットを取得して変更フィールドのみ自動ON
                            const snapMap: Record<string, { synced_at: string | null; mapped_fields: Record<string, string> }> = {};
                            await Promise.all(allSelected.map(async destId => {
                              try {
                                const s = await fetchCrossMediaSnapshot({
                                  source_mapping_id: crossSourceMappingId,
                                  dest_mapping_id: destId,
                                  entity_url: crossSelectedEntity.url,
                                });
                                if (s.ok && s.snapshot) snapMap[destId] = { synced_at: s.snapshot.synced_at, mapped_fields: s.snapshot.mapped_fields };
                              } catch { /* 初回同期 = スナップショットなし */ }
                            }));
                            setCrossSnapshots(snapMap);
                            const initSel: Record<string, Record<string, boolean>> = {};
                            p.results.forEach(res => {
                              const snap = snapMap[res.mapping_id];
                              initSel[res.mapping_id] = {};
                              const valueByLabel = new Map((res.mapping_detail || []).map(d => [d.label || d.name, d.value]));
                              Array.from(new Set([...selectableLabelsForCrossPreview(res), ...crossSrcExtractFields])).forEach(key => {
                                if (!snap) {
                                  initSel[res.mapping_id][key] = true; // 初回 = 全ON
                                } else {
                                  const prev = snap.mapped_fields[key];
                                  // 新規フィールド or 値が変わった場合のみON
                                  const nextValue = valueByLabel.get(key);
                                  initSel[res.mapping_id][key] = prev === undefined || (nextValue !== undefined && prev !== nextValue);
                                }
                              });
                            });
                            setCrossFieldSel(initSel);
                          } else {
                            // 個別モード: 全項目ON
                            const initSel: Record<string, Record<string, boolean>> = {};
                            p.results.forEach(res => {
                              initSel[res.mapping_id] = {};
                              Array.from(new Set([...selectableLabelsForCrossPreview(res), ...crossSrcExtractFields])).forEach(label => { initSel[res.mapping_id][label] = true; });
                            });
                            setCrossFieldSel(initSel);
                          }
                        } catch(e: unknown) {
                          setMsg("❌ プレビュー失敗: " + (e instanceof Error ? e.message : "不明なエラー"));
                        } finally { setCrossPreviewLoading(false); }
                      }} disabled={!canPreview}
                        style={{ width: "100%", padding: "14px 20px", borderRadius: 12, border: "2px solid #7c3aed", background: canPreview ? "#fff" : "#f5f3ff", color: canPreview ? "#4c1d95" : "#a78bfa", fontWeight: 900, fontSize: 14, cursor: canPreview ? "pointer" : "default" }}>
                        {crossPreviewLoading ? "⏳ プレビュー取得中（Playwright + AI）..." : `🔍 ${allSelected.length}媒体のフォームをプレビュー確認`}
                      </button>

                      {/* プレビュー結果 */}
                      {crossPreviewData && (
                        <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
                          <div style={{ background: "#f0fdf4", padding: "10px 14px", fontSize: 12, fontWeight: 700, color: "#15803d", borderBottom: "1px solid #bbf7d0" }}>
                            ✅ プレビュー完了 — 取得元データキー: {crossPreviewData.source_data ? Object.keys(crossPreviewData.source_data).join(", ") || "なし" : "なし"}
                          </div>
                          {crossPreviewData.results.map(res => (
                            <div key={res.mapping_id} style={{ borderBottom: "1px solid #f0f0f0", padding: 14 }}>
                              <div style={{ fontSize: 13, fontWeight: 800, color: "#1e1b4b", marginBottom: 4 }}>
                                📥 {res.media_name}
                                {res.error ? <span style={{ color: "#b91c1c", fontWeight: 400, fontSize: 11, marginLeft: 8 }}>❌ {res.error}</span>
                                  : <span style={{ color: "#6b7280", fontWeight: 400, fontSize: 11, marginLeft: 8 }}>フォーム{res.field_count}項目 / 保存済み{res.mapped_field_count || 0}項目 / AI提案{res.mapped_count}項目</span>}
                                {crossUpdateScope === "diff" && crossSnapshots[res.mapping_id]?.synced_at && (
                                  <span style={{ marginLeft: 8, fontSize: 10, color: "#7c3aed", background: "#f5f3ff", borderRadius: 4, padding: "1px 6px" }}>
                                    前回同期: {new Date(crossSnapshots[res.mapping_id].synced_at!).toLocaleDateString("ja-JP")}
                                  </span>
                                )}
                                {crossUpdateScope === "diff" && !crossSnapshots[res.mapping_id] && (
                                  <span style={{ marginLeft: 8, fontSize: 10, color: "#15803d", background: "#dcfce7", borderRadius: 4, padding: "1px 6px" }}>初回同期</span>
                                )}
                              </div>
                              {!res.error && res.url_source === "AI_CONFIRMED" && (
                                <div style={{ fontSize: 11, color: "#15803d", marginBottom: 8, padding: "6px 10px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 6 }}>
                                  ✅ AI整備済みのURLを使用します。
                                </div>
                              )}
                              {!res.error && res.url_source && res.url_source !== "AI_CONFIRMED" && (
                                <div style={{ fontSize: 11, color: "#92400e", marginBottom: 8, padding: "8px 10px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 6, lineHeight: 1.5 }}>
                                  ⚠️ このURLはAI整備済みではありません（{res.url_source === "RELATED" ? "近い操作から流用" : res.url_source === "FALLBACK" ? "管理画面トップ" : "旧解析/推定"}）。媒体基盤のAI整備で対象URLを保存してください。
                                </div>
                              )}
                              {res.current_url && (
                                <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 8, padding: "2px 6px", background: "#f9fafb", borderRadius: 4, wordBreak: "break-all" }}>
                                  🔗 {res.current_url}
                                </div>
                              )}
                              {res.screenshot_b64 && (
                                <img src={`data:image/png;base64,${res.screenshot_b64}`}
                                  style={{ width: "100%", borderRadius: 6, border: "1px solid #e5e7eb", marginBottom: 8 }} alt={res.media_name} />
                              )}
                              {Array.from(new Set([...selectableLabelsForCrossPreview(res), ...crossSrcExtractFields])).length > 0 && (() => {
                                const selectableLabels = Array.from(new Set([...selectableLabelsForCrossPreview(res), ...crossSrcExtractFields]));
                                const detailKeys = new Set((res.mapping_detail || []).map(d => d.label || d.name).filter(Boolean));
                                const knownOnlyLabels = selectableLabels.filter(label => !detailKeys.has(label));
                                const selMap = crossFieldSel[res.mapping_id] || {};
                                const selCount = selectableLabels.filter(label => selMap[label] !== false).length;
                                const allOn = selectableLabels.length > 0 && selCount === selectableLabels.length;
                                return (
                                <div>
                                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                                    <span style={{ fontSize: 10, color: "#6b7280" }}>反映する項目を選択（{selCount}/{selectableLabels.length}）</span>
                                    <button onClick={() => setCrossFieldSel(prev => {
                                      const next = { ...(prev[res.mapping_id] || {}) };
                                      selectableLabels.forEach(label => { next[label] = !allOn; });
                                      return { ...prev, [res.mapping_id]: next };
                                    })} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, border: "1px solid #ddd6fe", background: "#fff", color: "#7c3aed", cursor: "pointer", fontWeight: 700 }}>
                                      {allOn ? "全解除" : "全選択"}
                                    </button>
                                  </div>
                                  {(res.mapping_detail || []).length > 0 && <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
                                    <thead><tr>
                                      <th style={{ width: 28, padding: "4px 4px", background: "#f5f3ff" }}></th>
                                      <th style={{ textAlign: "left", padding: "4px 8px", background: "#f5f3ff", color: "#4c1d95", fontWeight: 700 }}>フィールド</th>
                                      <th style={{ textAlign: "left", padding: "4px 8px", background: "#f5f3ff", color: "#4c1d95", fontWeight: 700 }}>入力予定値</th>
                                      {crossUpdateScope === "diff" && crossSnapshots[res.mapping_id] && (
                                        <th style={{ textAlign: "left", padding: "4px 8px", background: "#f5f3ff", color: "#6b7280", fontWeight: 700 }}>前回値</th>
                                      )}
                                    </tr></thead>
                                    <tbody>{res.mapping_detail.map((d, i) => {
                                      const key = d.label || d.name;
                                      const on = selMap[key] !== false;
                                      const snap = crossUpdateScope === "diff" ? crossSnapshots[res.mapping_id] : null;
                                      const prevVal = snap?.mapped_fields[key];
                                      const isNew = snap && prevVal === undefined;
                                      const isChanged = snap && prevVal !== undefined && prevVal !== d.value;
                                      const isSame = snap && prevVal !== undefined && prevVal === d.value;
                                      return (
                                      <tr key={i} style={{ borderBottom: "1px solid #f3f4f6", opacity: on ? 1 : 0.4 }}>
                                        <td style={{ padding: "4px 4px", textAlign: "center" }}>
                                          <input type="checkbox" checked={on}
                                            onChange={e => setCrossFieldSel(prev => ({ ...prev, [res.mapping_id]: { ...(prev[res.mapping_id] || {}), [key]: e.target.checked } }))}
                                            style={{ width: 14, height: 14 }} />
                                        </td>
                                        <td style={{ padding: "4px 8px", color: "#374151", fontWeight: 600 }}>
                                          {key}
                                          {isNew && <span style={{ marginLeft: 4, fontSize: 9, background: "#dcfce7", color: "#15803d", borderRadius: 4, padding: "1px 4px", fontWeight: 700 }}>🆕 新規</span>}
                                          {isChanged && <span style={{ marginLeft: 4, fontSize: 9, background: "#fef3c7", color: "#92400e", borderRadius: 4, padding: "1px 4px", fontWeight: 700 }}>✏️ 変更</span>}
                                          {isSame && <span style={{ marginLeft: 4, fontSize: 9, background: "#f3f4f6", color: "#9ca3af", borderRadius: 4, padding: "1px 4px" }}>✓ 同じ</span>}
                                        </td>
                                        <td style={{ padding: "4px 8px", color: "#7c3aed", fontWeight: 500 }}>{d.value}</td>
                                        {snap && (
                                          <td style={{ padding: "4px 8px", color: "#9ca3af", fontSize: 10 }}>{prevVal ?? "—"}</td>
                                        )}
                                      </tr>
                                      );
                                    })}</tbody>
                                  </table>}
                                  {knownOnlyLabels.length > 0 && (
                                    <div style={{ marginTop: 8, padding: "8px 10px", borderRadius: 6, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                                      <div style={{ fontSize: 10, color: "#475569", fontWeight: 700, marginBottom: 6 }}>保存済みマッピング候補（AI値未提案）</div>
                                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                        {knownOnlyLabels.map(label => {
                                          const on = selMap[label] !== false;
                                          return (
                                            <label key={label} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, color: "#374151", border: "1px solid #cbd5e1", borderRadius: 999, padding: "3px 8px", background: on ? "#fff" : "#f1f5f9" }}>
                                              <input type="checkbox" checked={on}
                                                onChange={e => setCrossFieldSel(prev => ({ ...prev, [res.mapping_id]: { ...(prev[res.mapping_id] || {}), [label]: e.target.checked } }))}
                                                style={{ width: 12, height: 12 }} />
                                              {label}
                                            </label>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}
                                </div>
                                );
                              })()}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* タスク作成ボタン */}
                      <button onClick={async () => {
                        if (!canCreate) return;
                        setCrossLoading(true);
                        try {
                          const baseParams = {
                            instruction: crossInstruction,
                            industry: "generic",
                            source_mode: "source_mapping" as const,
                            source_url: crossSourceUrl,
                            source_mapping_id: crossSourceMappingId,
                            target_mapping_ids: allSelected,
                            target_operation_type: crossTargetOp,
                            source_payload: {},
                            query: crossQuery,
                            max_items: crossMaxItems,
                            source_access_confirmed: crossAccessConfirmed,
                            selected_field_keys: crossSrcExtractFields.length > 0 ? crossSrcExtractFields : undefined,
                          };

                          if (crossUpdateScope === "all" || crossUpdateScope === "diff") {
                            // 全体を更新: エンティティ一覧を取得して1件ずつタスク作成
                            let entities = crossEntities;
                            if (entities.length === 0) {
                              const listRes = await fetchCrossMediaSourceEntities({
                                source_mapping_id: crossSourceMappingId,
                                target_operation_type: crossTargetOp,
                              });
                              entities = listRes.entities || [];
                              setCrossEntities(entities);
                              setCrossEntityLabel(listRes.entity_label || cIT.entity);
                            }
                            if (entities.length === 0) {
                              setMsg(`${cIT.entity}が見つかりませんでした。一覧取得を先にお試しください。`);
                              return;
                            }
                            // 差分スコープの場合は選択済みエンティティのみ（1件）
                            const targets = crossUpdateScope === "diff" && crossSelectedEntity
                              ? [crossSelectedEntity]
                              : entities;
                            let created = 0;
                            for (const ent of targets) {
                              try {
                                await createCrossMediaTask({ ...baseParams, source_entity_url: ent.url, source_entity_label: ent.name });
                                created++;
                              } catch { /* skip failed */ }
                            }
                            const [ct, td] = await Promise.allSettled([listCrossMediaTasks(), listAgentTasks()]);
                            if (ct.status === "fulfilled") setCrossTasks(sortCreatedNewest(ct.value.tasks || []));
                            if (td.status === "fulfilled") setTasks(sortTasksNewest(td.value.tasks || []));
                            const scopeLabel = crossUpdateScope === "diff" ? "差分展開" : "全体展開";
                            setMsg(`✅ ${scopeLabel}: ${created}件のタスクを作成しました`);
                            if (created > 0) setTab("tasks");
                          } else {
                            // 1件指定: プレビューで選択したフィールドで作成
                            const selectedLabels = Array.from(new Set(
                              [...crossSrcExtractFields, ...Object.values(crossFieldSel).flatMap(m => Object.entries(m).filter(([,v]) => v).map(([k]) => k))]
                            ));
                            const allLabels = Array.from(new Set(
                              [...crossSrcExtractFields, ...(crossPreviewData?.results || []).flatMap(res => selectableLabelsForCrossPreview(res))]
                            ));
                            const fieldFilter = selectedLabels.length > 0 && selectedLabels.length < allLabels.length ? selectedLabels : [];
                            const r = await createCrossMediaTask({
                              ...baseParams,
                              source_entity_url: crossSelectedEntity?.url || undefined,
                              source_entity_label: crossSelectedEntity?.name || undefined,
                              selected_field_keys: fieldFilter,
                            });
                            const [ct, td] = await Promise.allSettled([listCrossMediaTasks(), listAgentTasks()]);
                            if (ct.status === "fulfilled") setCrossTasks(sortCreatedNewest(ct.value.tasks || []));
                            if (td.status === "fulfilled") setTasks(sortTasksNewest(td.value.tasks || []));
                            setMsg(`展開タスク作成: ${r.counts?.created ?? 0}件 / スキップ ${r.counts?.skipped ?? 0}件`);
                            setCrossPreviewData(null);
                            if ((r.counts?.created ?? 0) > 0) setTab("tasks");
                          }
                        } catch(e: unknown) {
                          setMsg("❌ " + (e instanceof Error ? e.message : "タスク作成に失敗しました"));
                        } finally { setCrossLoading(false); }
                      }} disabled={!canCreate}
                        style={{ width: "100%", padding: "16px 20px", borderRadius: 12, border: "none", background: canCreate ? "#7c3aed" : "#c4b5fd", color: "#fff", fontWeight: 900, fontSize: 15, cursor: canCreate ? "pointer" : "default" }}>
                        {crossLoading ? "タスク作成中..." : canCreate
                          ? crossUpdateScope === "all"
                            ? `✅ 確認済み → 🚀 全${cIT.entity}を${allSelected.length}媒体へ一括展開`
                            : `✅ 確認済み → 🚀 ${allSelected.length}媒体へ一括展開`
                          : crossUpdateScope === "individual" && !crossPreviewData
                            ? `🔍 先にプレビューを確認してください`
                            : `展開先・取得元を選択してください`
                        }
                      </button>
                    </div>
                  );
                })()}
              </div>

              {/* タスク履歴 */}
              {crossTasks.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#374151" }}>展開タスク履歴（{crossTasks.length}件）</div>
                    <button onClick={async () => {
                      if (!confirm(`履歴を全件（${crossTasks.length}件）削除しますか？`)) return;
                      try {
                        await Promise.all(crossTasks.map(t => deleteCrossMediaTask(t.cross_task_id)));
                        const r = await listCrossMediaTasks();
                        setCrossTasks(sortCreatedNewest(r.tasks || []));
                      } catch(e: unknown) { setMsg("❌ 削除失敗: " + (e instanceof Error ? e.message : String(e))); }
                    }} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 6, border: "1px solid #fca5a5", background: "#fff", color: "#b91c1c", cursor: "pointer", fontWeight: 700 }}>
                      全削除
                    </button>
                  </div>
                  {crossTasks.map(t => (
                    <div key={t.cross_task_id} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "12px 16px" }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <span style={{ fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 6, background: STATUS_BG[t.status] || "#f3f4f6", color: STATUS_COLOR[t.status] || "#374151" }}>{STATUS_LABEL[t.status] || t.status}</span>
                        <span style={{ fontSize: 12, fontWeight: 800, color: "#1e1b4b" }}>{OP_LABEL[t.target_operation_type] || t.target_operation_type}</span>
                        <span style={{ fontSize: 11, color: "#6b7280" }}>作成 {t.counts?.created ?? 0} / スキップ {t.counts?.skipped ?? 0}</span>
                        <span style={{ fontSize: 10, color: "#9ca3af" }}>{t.created_at ? new Date(t.created_at).toLocaleString("ja-JP") : ""}</span>
                        <button onClick={async () => {
                          try {
                            await deleteCrossMediaTask(t.cross_task_id);
                            setCrossTasks(prev => prev.filter(x => x.cross_task_id !== t.cross_task_id));
                          } catch(e: unknown) { setMsg("❌ 削除失敗: " + (e instanceof Error ? e.message : String(e))); }
                        }} style={{ marginLeft: "auto", fontSize: 11, padding: "2px 8px", borderRadius: 6, border: "1px solid #fca5a5", background: "#fff", color: "#b91c1c", cursor: "pointer" }}>
                          削除
                        </button>
                      </div>
                      {t.instruction && <div style={{ fontSize: 11, color: "#374151", marginTop: 4 }}>{t.instruction}</div>}
                      <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>{t.source_url || t.source_mode}</div>
                    </div>
                  ))}
                </div>
              )}

              </>}

            </div>
            );
          })()}

                                        {/* ─────────── SECTION: 投稿・市場監視 ─────────── */}
          {tab === "monitoring" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ border: "1px solid #c7d2fe", borderRadius: 10, background: "#eef2ff", padding: "12px 14px" }}>
                <div style={{ fontSize: 12, fontWeight: 900, color: "#312e81", marginBottom: 8 }}>AI監視・市場調査の流れ</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
                  {[
                    ["1", "監視対象URL・競合URLを指定"],
                    ["2", "監視タスクを作成"],
                    ["3", "承認・実行でAI監視"],
                    ["4", "結果をAIクロスメディアへ引き継ぐ"],
                  ].map(([num, text]) => (
                    <div key={num} style={{ display: "flex", gap: 8, alignItems: "center", border: "1px solid #ddd6fe", borderRadius: 8, background: "#fff", padding: "8px 10px" }}>
                      <span style={{ width: 22, height: 22, borderRadius: 999, background: "#4f46e5", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 900 }}>{num}</span>
                      <span style={{ fontSize: 11, color: "#3730a3", fontWeight: 800, lineHeight: 1.45 }}>{text}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: 10, padding: "14px 18px" }}>
                <div style={{ fontSize: 13, fontWeight: 900, color: "#0f172a", marginBottom: 8 }}>監視で見るもの</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 10 }}>
                  {[
                    ["投稿量", "対象日の写メ日記・ブログ・投稿らしき件数を集計します。"],
                    ["対象者別", "指定した名前ごとに投稿あり/未投稿を切り分けます。"],
                    ["市場信号", "新人、イベント、割引、予約、本指名、SNSなどの訴求語を検出します。"],
                    ["競合比較", "競合URLを入れると同日投稿量を比較し、投稿負けを検出します。"],
                    ["クロスメディア反映", "分析結果はプロフィール生成・別媒体展開の指示へ引き継げます。"],
                  ].map(([title, body]) => (
                    <div key={title} style={{ border: "1px solid #e2e8f0", background: "#fff", borderRadius: 8, padding: "10px 12px" }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: "#1e1b4b", marginBottom: 4 }}>{title}</div>
                      <div style={{ fontSize: 11, color: "#475569", lineHeight: 1.5 }}>{body}</div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button onClick={() => { setTab("cross"); setCrossMode("copy"); }}
                    style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid #7c3aed", background: "#fff", color: "#4c1d95", fontWeight: 800, fontSize: 12, cursor: "pointer" }}>
                    AIクロスメディア更新へ
                  </button>
                  <button onClick={() => { setTab("cross"); setCrossMode("generate"); }}
                    style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid #059669", background: "#fff", color: "#047857", fontWeight: 800, fontSize: 12, cursor: "pointer" }}>
                    監視結果を使ってAI生成へ
                  </button>
                </div>
              </div>

              <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "16px 20px" }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#1e1b4b", marginBottom: 12 }}>監視タスクを作成</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 6 }}>対象媒体基盤</label>
                    <select value={monitorMediaId} onChange={e => {
                      const nextId = e.target.value;
                      setMonitorMediaId(nextId);
                      const nextMedia = mappings.find(m => m.mapping_id === nextId) || null;
                      const nextTarget = monitorTargetsForMapping(nextMedia)[0]?.url || "";
                      if (!monitorTargetUrl.trim()) setMonitorTargetUrl(nextTarget);
                    }}
                      style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13 }}>
                      <option value="">公開URLだけで監視</option>
                      {mappings.map(m => <option key={m.mapping_id} value={m.mapping_id}>{m.media_name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 6 }}>対象日</label>
                    <input value={monitorDate} onChange={e => setMonitorDate(e.target.value)} placeholder="空欄なら今日 / 例 2026-06-14"
                      style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, boxSizing: "border-box" }} />
                  </div>
                </div>
                <div style={{ marginTop: 12 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 6 }}>監視URL</label>
                  <input value={monitorTargetUrl} onChange={e => setMonitorTargetUrl(e.target.value)} placeholder="写メ日記一覧、ブログ一覧、店舗ページなど。空欄なら選択媒体のURLを使用"
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, boxSizing: "border-box" }} />
                  {(() => {
                    const selectedMonitorMedia = mappings.find(m => m.mapping_id === monitorMediaId) || null;
                    const targets = monitorTargetsForMapping(selectedMonitorMedia);
                    if (!targets.length) return null;
                    return (
                      <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {targets.map(t => (
                          <button key={`${t.source}:${t.url}`} onClick={() => setMonitorTargetUrl(t.url)}
                            style={{ fontSize: 10, padding: "4px 9px", borderRadius: 999, border: monitorTargetUrl === t.url ? "1px solid #7c3aed" : "1px solid #cbd5e1", background: monitorTargetUrl === t.url ? "#ede9fe" : "#fff", color: monitorTargetUrl === t.url ? "#4c1d95" : "#475569", fontWeight: 700, cursor: "pointer" }}>
                            {t.label}
                          </button>
                        ))}
                      </div>
                    );
                  })()}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12, marginTop: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 6 }}>対象者名（任意）</label>
                    <textarea value={monitorCastNames} onChange={e => setMonitorCastNames(e.target.value)} placeholder="名前A, 名前B, 名前C"
                      style={{ width: "100%", minHeight: 86, padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 12, resize: "vertical", boxSizing: "border-box" }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 6 }}>市場・マーケ監視キーワード</label>
                    <textarea value={monitorMarketKeywords} onChange={e => setMonitorMarketKeywords(e.target.value)}
                      style={{ width: "100%", minHeight: 86, padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 12, resize: "vertical", boxSizing: "border-box" }} />
                  </div>
                </div>
                <div style={{ marginTop: 12 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 6 }}>競合URL</label>
                  <textarea value={monitorCompetitorUrls} onChange={e => setMonitorCompetitorUrls(e.target.value)} placeholder="https://competitor.example/diary&#10;https://competitor.example/blog"
                    style={{ width: "100%", minHeight: 76, padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 12, resize: "vertical", boxSizing: "border-box" }} />
                  {(() => {
                    const urls = parseUrlList(monitorCompetitorUrls);
                    const over = urls.length > 5;
                    return (
                      <div style={{ marginTop: 6, fontSize: 11, color: over ? "#b91c1c" : "#64748b", fontWeight: over ? 800 : 600 }}>
                        競合URL: {urls.length}/5件対応（改行またはカンマ区切り）
                        {over && " — 5件以下に絞ってください"}
                      </div>
                    );
                  })()}
                </div>
                <button onClick={handleMonitoringCreate} disabled={monitorLoading}
                  style={{ marginTop: 14, padding: "9px 22px", borderRadius: 8, border: "none", background: monitorLoading ? "#9ca3af" : "#7c3aed", color: "#fff", fontWeight: 800, cursor: monitorLoading ? "not-allowed" : "pointer", fontSize: 13 }}>
                  {monitorLoading ? "作成中..." : "監視タスクを作成"}
                </button>
              </div>

              {/* ── 業種連動: scout/reply/monitor マッピング選択時の専用監査セクション ── */}
              {(() => {
                const _mMedia = monitorMediaId ? mappings.find(m => m.mapping_id === monitorMediaId) : null;
                const _mPurpose = (_mMedia?.business_conditions?.site_purpose || "") as string;
                if (!["scout", "reply", "monitor"].includes(_mPurpose)) {
                  // site_purpose未設定のマッピングでも、求人系マッピング（scout/reply/monitor）が1件でもあれば案内を表示
                  const _scoutMaps = mappings.filter(m => ["scout", "reply", "monitor"].includes(m.business_conditions?.site_purpose || ""));
                  if (_scoutMaps.length === 0 || monitorMediaId) return null;
                  return (
                    <div style={{ background: "#fef3c7", border: "1px solid #fde68a", borderRadius: 10, padding: "14px 18px" }}>
                      <div style={{ fontSize: 12, fontWeight: 900, color: "#92400e", marginBottom: 6 }}>🧲 求人対応マッピングが {_scoutMaps.length} 件あります</div>
                      <div style={{ fontSize: 11, color: "#92400e", marginBottom: 10 }}>スカウト型・返信型サイトは投稿監視ではなく受信ボックス監視（recruit_inbox_scan）が適しています。媒体を選択してから「📬 応募受信を確認」を使ってください。</div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {_scoutMaps.slice(0, 3).map(sm => (
                          <button key={sm.mapping_id} onClick={() => setMonitorMediaId(sm.mapping_id)}
                            style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid #fde68a", background: "#fff", color: "#92400e", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                            {sm.media_name}を選択
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                }
                const _colors = SITE_PURPOSE_COLOR[_mPurpose] || {bg: "#fef3c7", border: "#fde68a", text: "#92400e"};
                return (
                  <div style={{ background: _colors.bg, border: `1px solid ${_colors.border}`, borderRadius: 10, padding: "16px 20px" }}>
                    <div style={{ fontSize: 13, fontWeight: 900, color: _colors.text, marginBottom: 6 }}>
                      {SITE_PURPOSE_LABEL[_mPurpose]}サイト — 業種連動 監査タスク
                    </div>
                    <div style={{ fontSize: 11, color: _colors.text, marginBottom: 12 }}>
                      {_mPurpose === "scout" && "スカウト型サイトの監査は「受信ボックス監視」が中心です。候補者からの返信を定期スキャンして会話スレッドを更新します。"}
                      {_mPurpose === "reply" && "返信型サイトの監査は受信状況の確認です。新着メッセージを確認してください。"}
                      {_mPurpose === "monitor" && "監視型サイトの定期監視です。ページの更新・投稿状況を確認します。"}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                      {(SITE_PURPOSE_QUICK[_mPurpose] || []).filter(qa => qa.op === "recruit_inbox_scan" || qa.op === "page_monitor").map(qa => (
                        <button key={qa.op} onClick={async () => {
                          if (!monitorMediaId) return;
                          setMonitorLoading(true);
                          try {
                            await createAgentTask({
                              agent_type: qa.op === "recruit_inbox_scan" ? "hp_update" : qa.op === "page_monitor" ? "page_monitor" : "post_monitoring",
                              operation_type: qa.op,
                              industry: normalizeIndustryKey(_mMedia?.industry ?? undefined) || "generic",
                              entity_type: qa.op === "recruit_inbox_scan" ? "inbox" : "monitoring",
                              media_mapping_id: monitorMediaId,
                              payload: { media_mapping_id: monitorMediaId, media_name: _mMedia?.media_name || "" },
                            });
                            setMsg(`${qa.label}タスクを作成しました。承認後に実行されます。`);
                            setTab("tasks");
                          } catch(e: unknown) {
                            setMsg("❌ " + (e instanceof Error ? e.message : "タスク作成失敗"));
                          } finally { setMonitorLoading(false); }
                        }} disabled={monitorLoading}
                          style={{ padding: "9px 18px", borderRadius: 8, border: "none", background: _colors.text, color: "#fff", fontWeight: 800, fontSize: 12, cursor: monitorLoading ? "default" : "pointer", opacity: monitorLoading ? 0.6 : 1 }}>
                          {monitorLoading ? "作成中..." : qa.label}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {latestMonitoring && (() => {
                const res = latestMonitoring.result as Record<string, unknown>;
                const mr = (res.monitoring_result || {}) as Record<string, unknown>;
                const marketing = (mr.marketing || {}) as Record<string, unknown>;
                const byCast = (mr.by_cast || {}) as Record<string, number>;
                const recs = (marketing.recommendations || []) as string[];
                const competitors = (mr.competitors || []) as Array<Record<string, unknown>>;
                return (
                  <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "16px 20px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
                      <div style={{ fontSize: 13, fontWeight: 900, color: "#1e1b4b" }}>最新監視結果</div>
                      <span style={{ fontSize: 11, color: "#6b7280" }}>対象日 {String(mr.target_date || "-")}</span>
                      <span style={{ fontSize: 11, color: "#6b7280" }}>信頼度 {String(mr.confidence || "-")}</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8, marginBottom: 12 }}>
                      <div style={{ borderRadius: 8, background: "#f0fdf4", border: "1px solid #bbf7d0", padding: "10px 12px" }}>
                        <div style={{ fontSize: 10, color: "#15803d", fontWeight: 800 }}>総投稿数</div>
                        <div style={{ fontSize: 24, color: "#15803d", fontWeight: 900 }}>{String(mr.total_posts ?? 0)}</div>
                      </div>
                      <div style={{ borderRadius: 8, background: "#fffbeb", border: "1px solid #fde68a", padding: "10px 12px" }}>
                        <div style={{ fontSize: 10, color: "#92400e", fontWeight: 800 }}>未投稿対象</div>
                        <div style={{ fontSize: 24, color: "#92400e", fontWeight: 900 }}>{((marketing.silent_casts || []) as unknown[]).length}</div>
                      </div>
                      <div style={{ borderRadius: 8, background: "#eff6ff", border: "1px solid #bfdbfe", padding: "10px 12px" }}>
                        <div style={{ fontSize: 10, color: "#1d4ed8", fontWeight: 800 }}>競合比較</div>
                        <div style={{ fontSize: 24, color: "#1d4ed8", fontWeight: 900 }}>{competitors.length}</div>
                      </div>
                    </div>
                    {Object.keys(byCast).length > 0 && (
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 12, fontWeight: 800, color: "#374151", marginBottom: 6 }}>対象者別件数</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {Object.entries(byCast).slice(0, 16).map(([name, count]) => (
                            <span key={name} style={{ fontSize: 11, color: "#1e1b4b", background: "#f5f3ff", border: "1px solid #ddd6fe", borderRadius: 999, padding: "4px 9px", fontWeight: 700 }}>{name}: {count}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {recs.length > 0 && (
                      <div style={{ marginBottom: 10, padding: "9px 12px", borderRadius: 8, background: "#fef2f2", border: "1px solid #fecaca" }}>
                        <div style={{ fontSize: 12, fontWeight: 800, color: "#b91c1c", marginBottom: 4 }}>推奨アクション</div>
                        {recs.slice(0, 5).map((r, idx) => <div key={idx} style={{ fontSize: 12, color: "#7f1d1d", marginTop: 2 }}>{r}</div>)}
                      </div>
                    )}
                    {competitors.length > 0 && (
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 800, color: "#374151", marginBottom: 6 }}>競合URL比較</div>
                        {competitors.slice(0, 5).map((c, idx) => (
                          <div key={idx} style={{ fontSize: 11, color: c.ok ? "#374151" : "#b91c1c", padding: "4px 0", borderTop: idx === 0 ? "none" : "1px solid #f3f4f6" }}>
                            {String(c.title || c.url)} / 投稿 {String(c.total_posts ?? "-")}件 {c.ok ? "" : `/ ${String(c.message || "")}`}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* ── 📊 AI市場分析レポート（monitoring_resultsコレクションから） ── */}
              {monitoringResults.length > 0 && (() => {
                const latest = monitoringResults[0];
                const hasData = (latest.trending_phrases?.length ?? 0) > 0 || (latest.popular_types?.length ?? 0) > 0;
                return (
                  <div style={{ background: "linear-gradient(135deg, #1e1b4b 0%, #3b0764 100%)", borderRadius: 12, padding: "18px 20px", color: "#fff" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 900 }}>📊 AI市場分析レポート</div>
                        <div style={{ fontSize: 11, color: "#a5b4fc", marginTop: 2 }}>{latest.executed_at ? new Date(latest.executed_at).toLocaleString("ja-JP") : ""}分析</div>
                      </div>
                      <button onClick={() => {
                        setTab("cross");
                        setCrossMode("generate");
                        if (latest.popular_types?.length) setGenTypeHint(latest.popular_types.slice(0, 2).join("・"));
                        if (latest.recommendations?.length) setGenInstructions(
                          "【市場分析より】" + latest.recommendations.slice(0, 2).join("。") +
                          (latest.avoid_phrases?.length ? "。避けるべき表現: " + latest.avoid_phrases.slice(0, 2).join("、") : "")
                        );
                      }} style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "#7c3aed", color: "#fff", fontWeight: 800, fontSize: 12, cursor: "pointer" }}>
                        ✨ この分析でプロフィール生成
                      </button>
                    </div>
                    {latest.ai_summary && (
                      <div style={{ fontSize: 12, color: "#c4b5fd", marginBottom: 12, lineHeight: 1.6, background: "rgba(255,255,255,0.08)", borderRadius: 8, padding: "8px 12px" }}>
                        {latest.ai_summary}
                      </div>
                    )}
                    {hasData && (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
                        {(latest.trending_phrases?.length ?? 0) > 0 && (
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 800, color: "#a5b4fc", marginBottom: 6 }}>🔥 トレンドフレーズ</div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                              {latest.trending_phrases.slice(0, 8).map((p, i) => (
                                <span key={i} style={{ fontSize: 11, background: "rgba(255,255,255,0.15)", borderRadius: 999, padding: "3px 9px", color: "#fff" }}>{p}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        {(latest.popular_types?.length ?? 0) > 0 && (
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 800, color: "#a5b4fc", marginBottom: 6 }}>💫 人気タイプ</div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                              {latest.popular_types.slice(0, 6).map((t, i) => (
                                <span key={i} style={{ fontSize: 11, background: "rgba(124,58,237,0.4)", borderRadius: 999, padding: "3px 9px", color: "#e9d5ff" }}>{t}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        {(latest.avoid_phrases?.length ?? 0) > 0 && (
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 800, color: "#fca5a5", marginBottom: 6 }}>⚠️ 陳腐な表現（避ける）</div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                              {latest.avoid_phrases.slice(0, 5).map((p, i) => (
                                <span key={i} style={{ fontSize: 11, background: "rgba(239,68,68,0.2)", borderRadius: 999, padding: "3px 9px", color: "#fca5a5", textDecoration: "line-through" }}>{p}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        {(latest.recommendations?.length ?? 0) > 0 && (
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 800, color: "#6ee7b7", marginBottom: 6 }}>✅ 推奨アクション</div>
                            {latest.recommendations.slice(0, 3).map((r, i) => (
                              <div key={i} style={{ fontSize: 11, color: "#d1fae5", marginTop: 3, lineHeight: 1.5 }}>・{r}</div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    {!hasData && (
                      <div style={{ fontSize: 12, color: "#a5b4fc", textAlign: "center", padding: "8px 0" }}>
                        監視タスクを実行するとAI分析結果がここに表示されます
                      </div>
                    )}
                  </div>
                );
              })()}

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {monitoringTasks.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "42px 0", color: "#9ca3af" }}>
                    <div style={{ fontSize: 40, marginBottom: 10 }}>📈</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#374151" }}>監視タスクはまだありません</div>
                  </div>
                ) : monitoringTasks.slice(0, 20).map(t => (
                  <div key={t.task_id} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "12px 16px" }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <span style={{ fontSize: 12, fontWeight: 800, padding: "3px 9px", borderRadius: 6, background: (STATUS_COLOR[t.status] || "#6b7280") + "22", color: STATUS_COLOR[t.status] || "#6b7280" }}>{STATUS_LABEL[t.status] || t.status}</span>
                      <span style={{ fontSize: 13, fontWeight: 800, color: "#1e1b4b" }}>{t.payload?.media_name as string || "公開URL監視"}</span>
                      <span style={{ fontSize: 11, color: "#6b7280", marginLeft: "auto" }}>{t.created_at ? new Date(t.created_at).toLocaleString("ja-JP") : ""}</span>
                    </div>
                    <div style={{ fontSize: 11, color: "#6b7280", marginTop: 5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{String(t.payload?.monitoring_target || "")}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ─────────── SECTION: 面接補助 ─────────── */}
          {tab === "interview" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "16px 20px" }}>
                <div style={{ fontSize: 13, fontWeight: 900, color: "#1e1b4b", marginBottom: 12 }}>面接条件を整理</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 6 }}>対象職種</label>
                    <input value={interviewRole} onChange={e => setInterviewRole(e.target.value)}
                      style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, boxSizing: "border-box" }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 6 }}>面接目的</label>
                    <input value={interviewGoal} onChange={e => setInterviewGoal(e.target.value)}
                      style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, boxSizing: "border-box" }} />
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12, marginTop: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 6 }}>候補者メモ</label>
                    <textarea value={interviewCandidateMemo} onChange={e => setInterviewCandidateMemo(e.target.value)} placeholder="応募経路、希望条件、不安点、確認済み事項など"
                      style={{ width: "100%", minHeight: 96, padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 12, resize: "vertical", boxSizing: "border-box", lineHeight: 1.6 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 6 }}>確認したい観点</label>
                    <textarea value={interviewRequirements} onChange={e => setInterviewRequirements(e.target.value)}
                      style={{ width: "100%", minHeight: 96, padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 12, resize: "vertical", boxSizing: "border-box", lineHeight: 1.6 }} />
                  </div>
                </div>
                <button onClick={handleInterviewCreate} disabled={interviewLoading}
                  style={{ marginTop: 14, padding: "9px 22px", borderRadius: 8, border: "none", background: interviewLoading ? "#9ca3af" : "#7c3aed", color: "#fff", fontWeight: 800, cursor: interviewLoading ? "not-allowed" : "pointer", fontSize: 13 }}>
                  {interviewLoading ? "作成中..." : "面接メモ作成タスクを追加"}
                </button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
                <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "16px 20px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: 900, color: "#1e1b4b" }}>面接質問</div>
                    <span style={{ fontSize: 11, color: "#6b7280" }}>{interviewQuestions.length}問</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {interviewQuestions.map((q, idx) => (
                      <div key={q} style={{ display: "grid", gridTemplateColumns: "28px 1fr", gap: 10, border: "1px solid #e5e7eb", borderRadius: 8, padding: "10px 12px", background: "#fafafa" }}>
                        <span style={{ width: 28, height: 28, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 999, background: "#f5f3ff", color: "#7c3aed", fontSize: 12, fontWeight: 900 }}>{idx + 1}</span>
                        <span style={{ fontSize: 12, color: "#374151", lineHeight: 1.6 }}>{q}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "16px 20px" }}>
                    <div style={{ fontSize: 13, fontWeight: 900, color: "#1e1b4b", marginBottom: 10 }}>評価軸</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {interviewAxes.map(([axis, check]) => (
                        <div key={axis} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "9px 11px", background: "#fff" }}>
                          <div style={{ fontSize: 12, fontWeight: 800, color: "#1e1b4b" }}>{axis}</div>
                          <div style={{ fontSize: 11, color: "#6b7280", marginTop: 3, lineHeight: 1.5 }}>{check}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "16px 20px" }}>
                    <div style={{ fontSize: 13, fontWeight: 900, color: "#1e1b4b", marginBottom: 10 }}>判断メモ</div>
                    {[
                      ["採用", "不安点が説明済みで、勤務条件とルール理解が一致している。", "#15803d"],
                      ["保留", "条件・掲載範囲・連絡習慣のどれかが未確認。", "#b87d00"],
                      ["見送り", "重要条件の不一致、継続性の説明不足、重大な期待値ズレがある。", "#b91c1c"],
                    ].map(([label, body, color]) => (
                      <div key={label} style={{ display: "grid", gridTemplateColumns: "54px 1fr", gap: 8, padding: "7px 0", borderTop: label === "採用" ? "none" : "1px solid #f3f4f6" }}>
                        <span style={{ color, fontSize: 12, fontWeight: 900 }}>{label}</span>
                        <span style={{ color: "#4b5563", fontSize: 11, lineHeight: 1.5 }}>{body}</span>
                      </div>
                    ))}
                    {interviewFocus.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                        {interviewFocus.slice(0, 10).map(f => (
                          <span key={f} style={{ fontSize: 11, color: "#7c3aed", background: "#f5f3ff", border: "1px solid #ddd6fe", borderRadius: 999, padding: "4px 8px", fontWeight: 700 }}>{f}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ─────────── SECTION: タスク作成 ─────────── */}
          {tab === "create" && (
            <div>
              <div style={{ background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: 10, padding: "12px 16px", marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 900, color: "#0f172a", marginBottom: 4 }}>詳細作成は補助画面です</div>
                <div style={{ fontSize: 11, color: "#475569", lineHeight: 1.6 }}>
                  通常は「目的から作成」または「AIクロスメディア」を使ってください。ここは操作種別、対象URL、payloadを手で指定したい時だけ使う詳細ルートです。
                </div>
              </div>
              {/* 媒体選択 */}
              <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "16px 20px", marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#1e1b4b", marginBottom: 8 }}>① 操作対象の媒体を選択</div>
                {mappings.length === 0 ? (
                  <div style={{ fontSize: 13, color: "#b91c1c", padding: "10px 14px", borderRadius: 8, background: "#fef2f2", border: "1px solid #fca5a5" }}>⚠️ 媒体が未登録です。先に「媒体基盤」タブで媒体を登録してください。</div>
                ) : (
                  <select value={selectedMedia?.mapping_id || ""} onChange={e => { const m2 = mappings.find(x => x.mapping_id === e.target.value) || null; setSelectedMedia(m2); setSelectedOpId(""); setSelectedMenuItemUrl(""); setFormValues({}); setPlanResult(null); setPlanFormValues({}); }}
                    style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }}>
                    <option value="">媒体を選択してください</option>
                    {mappings.map(m3 => <option key={m3.mapping_id} value={m3.mapping_id}>{m3.media_name}{m3.industry && m3.industry !== "other" ? `（${INDUSTRY_TEMPLATES_UI[normalizeIndustryKey(m3.industry)]?.label}）` : ""}</option>)}
                  </select>
                )}
                {selectedMedia && !selectedMedia.credential_secret_name && <div style={{ marginTop: 8, fontSize: 12, padding: "8px 12px", borderRadius: 6, background: "#fef2f2", border: "1px solid #fca5a5", color: "#b91c1c" }}>🔑 ログイン情報未登録です。媒体基盤でID/PASSを登録してください。</div>}
                {selectedMedia && selectedMedia.credential_secret_name && !selectedMedia.last_verified_at && <div style={{ marginTop: 8, fontSize: 12, padding: "8px 12px", borderRadius: 6, background: "#eef2ff", border: "1px solid #c7d2fe", color: "#3730a3" }}>AI整備済みの操作だけ実行できます。未整備の候補は媒体基盤のAI整備で対象ページ・入力項目・保存操作を保存します。</div>}
              </div>

              {/* ── 目的別 推奨タスク（業種×site_purpose 連動）── */}
              {selectedMedia && (() => {
                const _bc = selectedMedia.business_conditions || {};
                const _purpose = (_bc.site_purpose || "") as string;
                const _quickActions = SITE_PURPOSE_QUICK[_purpose] || [];
                if (!_purpose || _purpose === "other" || _quickActions.length === 0) return null;
                const _colors = SITE_PURPOSE_COLOR[_purpose] || {bg: "#f9fafb", border: "#e5e7eb", text: "#374151"};
                return (
                  <div style={{ background: _colors.bg, border: `1px solid ${_colors.border}`, borderRadius: 10, padding: "14px 18px", marginBottom: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 900, color: _colors.text, marginBottom: 10 }}>
                      {SITE_PURPOSE_LABEL[_purpose]}サイト — 業種連動 推奨タスク
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {_quickActions.map(qa => {
                        const _matchOp = ops.find(o => o.operation_type === qa.op && o.active !== false);
                        return (
                          <button key={qa.op}
                            onClick={() => { if (_matchOp) { setSelectedOpId(_matchOp.op_id || ""); setFormValues({}); setSelectedMenuItemUrl(""); } }}
                            title={qa.note}
                            style={{ padding: "9px 14px", borderRadius: 8, border: `1px solid ${_colors.border}`, background: "#fff", color: "#1e1b4b", fontWeight: 700, fontSize: 12, cursor: _matchOp ? "pointer" : "default", opacity: _matchOp ? 1 : 0.45, display: "flex", flexDirection: "column", gap: 2, alignItems: "flex-start" }}>
                            <span>{qa.label}</span>
                            <span style={{ fontSize: 10, color: "#6b7280", fontWeight: 400 }}>{qa.note}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {selectedMedia && (() => {
                const _mediaPurpose = selectedMedia.business_conditions?.site_purpose || "";
                const _purposeOps = SITE_PURPOSE_OPS[_mediaPurpose] || [];
                // purpose-aware sort: 業種に合うopsを先頭に
                const _sortByPurpose = (a: OpWithSchema, b: OpWithSchema) => {
                  const aMatch = _purposeOps.includes(a.operation_type || "");
                  const bMatch = _purposeOps.includes(b.operation_type || "");
                  if (aMatch && !bMatch) return -1;
                  if (!aMatch && bMatch) return 1;
                  return 0;
                };
                const availableOps = ops
                  .filter(op => op.active !== false && !isWaitingExecutorOp(op) && isOperationReadyForMedia(selectedMedia, op.operation_type || ""))
                  .sort(_sortByPurpose);
                const allRunnableOps = ops
                  .filter(op => op.active !== false && !isWaitingExecutorOp(op) && (SUPPORTED_OPS.includes(op.operation_type || "") || op.operation_type === "post_monitoring"))
                  .sort(_sortByPurpose);
                const selectedOp = ops.find(o => o.op_id === selectedOpId);
                const selectedOpType = selectedOp?.operation_type || "";
                const selectedMenuItems = selectedOpType ? readyMenuItemsForOp(selectedMedia, selectedOpType) : [];
                const selectedMediaLevelReady = selectedOpType ? isMediaOperationTaskable(selectedMedia, selectedOpType) : false;
                return (
                  <div>
                    {/* Operation選択 */}
                    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "16px 20px", marginBottom: 16 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#1e1b4b", marginBottom: 8 }}>② 操作の種類を選択</div>
                      {availableOps.length === 0 ? (
                        <div style={{ fontSize: 12, color: "#0369a1", padding: "10px 14px", borderRadius: 6, background: "#e0f2fe", border: "1px solid #7dd3fc" }}>この媒体にはAI整備済みの実行操作がありません。媒体基盤のAI整備で使える/使えない状態を保存してください。</div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          <div>
                            <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>タスクの種類</label>
                            <select value={selectedOpId} onChange={e => { setSelectedOpId(e.target.value); setFormValues({}); }}
                              style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }}>
                              <option value="">タスクを選択してください</option>
                              {availableOps.map(op => {
                                const itemCount = readyMenuItemsForOp(selectedMedia, op.operation_type || "").length;
                                const mediaReady = isMediaOperationTaskable(selectedMedia, op.operation_type || "");
                                const isPurposeMatch = _purposeOps.includes(op.operation_type || "");
                                const purposeMark = _mediaPurpose && isPurposeMatch ? "★ " : "";
                                return <option key={op.op_id} value={op.op_id || ""}>{purposeMark}{OP_LABEL[op.operation_type || ""] || op.display_name || op.op_id}{itemCount ? `（リンク別で実行可 ${itemCount}件）` : mediaReady ? "（媒体全体で実行可）" : ""}</option>;
                              })}
                            </select>
                          </div>
                          <div>
                            <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>実行できる操作（確認用）</label>
                            <select value={selectedOpId} onChange={e => { setSelectedOpId(e.target.value); setSelectedMenuItemUrl(""); setFormValues({}); }}
                              style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }}>
                              <option value="">自動化の種類を選択してください</option>
                              {allRunnableOps.map(op => {
                                const ready = isOperationReadyForMedia(selectedMedia, op.operation_type || "");
                                const itemCount = readyMenuItemsForOp(selectedMedia, op.operation_type || "").length;
                                const isPMatch = _purposeOps.includes(op.operation_type || "");
                                const pMark = _mediaPurpose && isPMatch ? "★ " : "";
                                return <option key={op.op_id} value={op.op_id || ""} disabled={!ready}>{pMark}{op.display_name || OP_LABEL[op.operation_type || ""] || op.op_id}{ready ? (itemCount ? ` / AI整備済みリンク ${itemCount}件` : " / AI整備済み") : " / AI整備待ち"}</option>;
                              })}
                            </select>
                          </div>
                          {selectedOpType && selectedMenuItems.length > 0 && (
                            <div>
                              <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>対象HTMLメニューURL</label>
                              <select value={selectedMenuItemUrl} onChange={e => setSelectedMenuItemUrl(e.target.value)}
                                style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }}>
                                <option value="">{selectedMediaLevelReady ? "媒体全体の操作で作成（URL指定なし）" : "リンクを選択してください"}</option>
                                {selectedMenuItems.map(item => <option key={item.url} value={item.url}>{item.category ? `${item.category} / ` : ""}{item.title || item.url}</option>)}
                              </select>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* フォーム */}
                    {selectedOpId && (() => {
                      const selOp = ops.find(o => o.op_id === selectedOpId) as OpWithSchema | undefined;
                      if (!selOp) return null;
                      const opType = selOp.operation_type || "";
                      const _isOfferSend = opType === "offer_send";
                      const _mappedFields = mappedFieldsForOperation(selectedMedia, opType);
                      const fields: PayloadField[] = payloadFieldsForOperation(selectedMedia, opType, selOp);
                      // offer_send: mappingから絞り込み条件フィールドを取得（selector→表示ラベル）
                      const _offerMappedFilterFields = _isOfferSend
                        ? mappedFieldsForOperation(selectedMedia, "offer_send").filter(f => !!f.selector && !!f.label)
                        : [];
                      const isMonitoringOp = opType === "post_monitoring";
                      const isPageMonitorOp = opType === "page_monitor";
                      const monitorOpMap = isPageMonitorOp ? selectedMedia?.operation_mappings?.page_monitor : null;
                      const monitorOpMapRecord = monitorOpMap as unknown as { title?: string; page_title?: string; target_url?: string } | null;
                      const _monitorPages = isPageMonitorOp && isProductionReadyOperationMapping(monitorOpMap) && monitorOpMapRecord?.target_url
                        ? [{ page_id: "ai_confirmed_page_monitor", title: monitorOpMapRecord.title || monitorOpMapRecord.page_title || "AI整備済み監視ページ", url: monitorOpMapRecord.target_url, op_type: "page_monitor" }]
                        : [];
                      const needsMenuTarget = !isMonitoringOp && !isPageMonitorOp && !isMediaOperationTaskable(selectedMedia, opType) && readyMenuItemsForOp(selectedMedia, opType).length > 0;
                      const canCreate = isPageMonitorOp
                        ? !!selectedMedia?.mapping_id && _monitorPages.length > 0 && !!formValues["monitor_url"]
                        : isMonitoringOp ? !!selectedMedia?.mapping_id
                        : !!selectedMedia?.credential_secret_name && (!needsMenuTarget || !!selectedMenuItemUrl);
                      return (
                        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "16px 20px", marginBottom: 16 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "#1e1b4b", marginBottom: 12 }}>③ 内容を入力してタスクを作成</div>
                          {/* page_monitor: 登録済み監視ページ選択 */}
                          {isPageMonitorOp && (
                            <div style={{ marginBottom: 14 }}>
                              {_monitorPages.length > 1 ? (
                                <div>
                                  <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 4 }}>監視対象ページを選択 <span style={{ color: "#b91c1c" }}>*</span></label>
                                  <select
                                    value={formValues["monitor_url"] || ""}
                                    onChange={e => setFormValues(prev => ({ ...prev, monitor_url: e.target.value }))}
                                    style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13 }}>
                                    <option value="">選択してください</option>
                                    {_monitorPages.map((p, pi) => (
                                      <option key={pi} value={p.url || ""}>{p.title || p.url}</option>
                                    ))}
                                  </select>
                                </div>
                              ) : _monitorPages.length === 1 ? (
                                <div style={{ padding: "8px 12px", borderRadius: 6, background: "#f0f9ff", border: "1px solid #bae6fd", fontSize: 12 }}>
                                  <span style={{ fontWeight: 700, color: "#0369a1" }}>監視対象: </span>
                                  <span style={{ color: "#374151" }}>{_monitorPages[0].title || _monitorPages[0].url}</span>
                                  {/* 自動でURLをセット */}
                                  {!formValues["monitor_url"] && (() => { setTimeout(() => setFormValues(prev => ({ ...prev, monitor_url: _monitorPages[0].url || "" })), 0); return null; })()}
                                </div>
                              ) : (
                                <div style={{ padding: "8px 12px", borderRadius: 6, background: "#fffbeb", border: "1px solid #fde68a", fontSize: 12, color: "#b45309" }}>
                                  ⚠️ 監視ページURLが未登録です。監視URLを直接入力するか、媒体基盤のAI整備で「👁 監視・一覧確認」を使える状態にしてください。
                                </div>
                              )}
                              <div style={{ marginTop: 8 }}>
                                <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>確認ポイント（任意）</label>
                                <input type="text" value={formValues["check_points"] || ""} onChange={e => setFormValues(prev => ({ ...prev, check_points: e.target.value }))}
                                  placeholder="例: キャラとの一致・投稿頻度・未投稿者"
                                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, boxSizing: "border-box" }} />
                              </div>
                            </div>
                          )}
                          {/* マッピング取得フィールド数バナー */}
                          {_mappedFields.length > 0 && (
                            <div style={{ padding: "8px 12px", borderRadius: 6, background: "#f0fdf4", border: "1px solid #bbf7d0", fontSize: 11, color: "#15803d", marginBottom: 10 }}>
                              ✅ マッピングから {_mappedFields.length} フィールドを検出しました。この操作の入力候補として連動します。
                            </div>
                          )}
                          {/* offer_send: mapping取得した候補者検索フィルタフィールド */}
                          {_isOfferSend && _offerMappedFilterFields.length > 0 && (
                            <div style={{ marginBottom: 14 }}>
                              <div style={{ padding: "8px 12px", borderRadius: 6, background: "#fdf4ff", border: "1px solid #e9d5ff", fontSize: 11, color: "#7c3aed", marginBottom: 10 }}>
                                🔍 マッピングから {_offerMappedFilterFields.length} 件の候補者検索フィルタを検出。値を入力すると絞り込み条件として適用されます（空欄はデフォルト）。
                              </div>
                              <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 6 }}>候補者絞り込み条件（マッピングから）</div>
                              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                {_offerMappedFilterFields.map((f, fi) => {
                                  const _ffKey = `_ff_${f.name || f.id || fi}`;
                                  return (
                                    <div key={_ffKey}>
                                      <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 3 }}>{f.label || f.name || f.canonical}</label>
                                      {f.type === "select" ? (
                                        <select value={formValues[_ffKey] || ""} onChange={e => setFormValues(prev => ({ ...prev, [_ffKey]: e.target.value }))}
                                          style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13 }}>
                                          <option value="">（指定なし）</option>
                                          {f.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                        </select>
                                      ) : (
                                        <input type={f.type === "number" ? "number" : "text"} value={formValues[_ffKey] || ""}
                                          onChange={e => setFormValues(prev => ({ ...prev, [_ffKey]: e.target.value }))}
                                          placeholder={`${f.label || f.name || ""}（省略可）`}
                                          style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13, boxSizing: "border-box" }} />
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                          {!isPageMonitorOp && fields.length > 0 && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
                              {fields.map(f => (
                                <div key={f.key}>
                                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>{f.label}{f.required && <span style={{ color: "#b91c1c", marginLeft: 4 }}>*</span>}</label>
                                  {f.type === "textarea" ? (
                                    <textarea value={formValues[f.key] || ""} onChange={e => setFormValues(prev => ({ ...prev, [f.key]: e.target.value }))} rows={4}
                                      style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14, boxSizing: "border-box", resize: "vertical" }} />
                                  ) : f.type === "select" ? (
                                    <select value={formValues[f.key] || ""} onChange={e => setFormValues(prev => ({ ...prev, [f.key]: e.target.value }))}
                                      style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }}>
                                      <option value="">選択してください</option>
                                      {f.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                    </select>
                                  ) : f.type === "boolean" ? (
                                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
                                      <input type="checkbox" checked={formValues[f.key] === "true"} onChange={e => setFormValues(prev => ({ ...prev, [f.key]: e.target.checked ? "true" : "false" }))} />
                                      {f.label}
                                    </label>
                                  ) : (
                                    <input type={f.type === "number" ? "number" : f.type === "datetime" ? "datetime-local" : "text"} value={formValues[f.key] || ""} onChange={e => setFormValues(prev => ({ ...prev, [f.key]: e.target.value }))}
                                      style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14, boxSizing: "border-box" }} />
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                          <button onClick={handleCreate} disabled={creating || !selectedOpId || !canCreate}
                            style={{ padding: "10px 24px", borderRadius: 8, border: "none", background: (creating || !selectedOpId || !canCreate) ? "#9ca3af" : "#7c3aed", color: "#fff", fontWeight: 700, cursor: (creating || !selectedOpId || !canCreate) ? "not-allowed" : "pointer", fontSize: 14 }}>
                            {creating ? "作成中..." : "タスクを作成する"}
                          </button>
                        </div>
                      );
                    })()}

                    {/* AIプランナー */}
                    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "16px 20px" }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#1e1b4b", marginBottom: 8 }}>🤖 AIに指示してタスクを作成（自然文入力）</div>
                      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                        <input value={planInput} onChange={e => setPlanInput(e.target.value)} placeholder="例：今週の新着情報を投稿して"
                          style={{ flex: 1, padding: "10px 14px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }} />
                        <button onClick={handlePlan} disabled={false}
                          style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: "#7c3aed", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
                          {"解析"}
                        </button>
                      </div>
                      {planResult && (() => {
                        const plannedFields = plannedFieldsForResult(planResult);
                        const mappedCount = selectedMedia && planResult.operation_type
                          ? mappedFieldsForOperation(selectedMedia, planResult.operation_type).length
                          : 0;
                        return (
                          <div style={{ padding: "12px 16px", borderRadius: 8, background: planResult.ready ? "#f0fdf4" : "#fffbeb", border: `1px solid ${planResult.ready ? "#bbf7d0" : "#fde68a"}`, fontSize: 13 }}>
                            {planResult.preview && <div style={{ color: "#1e1b4b", marginBottom: 8 }}>{planResult.preview}</div>}
                            {planResult.question && <div style={{ color: "#b45309" }}>❓ {planResult.question}</div>}
                            {planResult.ready && plannedFields.length > 0 && (
                              <div style={{ marginTop: 10 }}>
                                <div style={{ padding: "8px 12px", borderRadius: 6, background: "#eef2ff", border: "1px solid #c7d2fe", fontSize: 11, color: "#3730a3", marginBottom: 10 }}>
                                  {mappedCount > 0
                                    ? `保存済みマッピングから ${mappedCount} 項目、基本項目を含めて合計 ${plannedFields.length} 項目をこの会話ルートでも入力できます。`
                                    : `この操作で扱える ${plannedFields.length} 項目を会話ルートでもそのまま入力できます。`}
                                </div>
                                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 12 }}>
                                  {plannedFields.map(f => (
                                    <div key={f.key}>
                                      <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>
                                        {f.label}{f.required && <span style={{ color: "#b91c1c", marginLeft: 4 }}>*</span>}
                                      </label>
                                      {f.type === "textarea" ? (
                                        <textarea
                                          value={planFormValues[f.key] || ""}
                                          onChange={e => setPlanFormValues(prev => ({ ...prev, [f.key]: e.target.value }))}
                                          rows={4}
                                          style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14, boxSizing: "border-box", resize: "vertical", background: "#fff" }}
                                        />
                                      ) : f.type === "select" ? (
                                        <select
                                          value={planFormValues[f.key] || ""}
                                          onChange={e => setPlanFormValues(prev => ({ ...prev, [f.key]: e.target.value }))}
                                          style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14, background: "#fff" }}>
                                          <option value="">選択してください</option>
                                          {f.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                        </select>
                                      ) : f.type === "boolean" ? (
                                        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "#374151" }}>
                                          <input
                                            type="checkbox"
                                            checked={planFormValues[f.key] === "true"}
                                            onChange={e => setPlanFormValues(prev => ({ ...prev, [f.key]: e.target.checked ? "true" : "false" }))}
                                          />
                                          {f.label}
                                        </label>
                                      ) : (
                                        <input
                                          type={f.type === "number" ? "number" : f.type === "datetime" ? "datetime-local" : "text"}
                                          value={planFormValues[f.key] || ""}
                                          onChange={e => setPlanFormValues(prev => ({ ...prev, [f.key]: e.target.value }))}
                                          style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14, boxSizing: "border-box", background: "#fff" }}
                                        />
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            {planResult.ready && (
                              <button onClick={handlePlanCreate} disabled={creating}
                                style={{ marginTop: 8, padding: "8px 18px", borderRadius: 8, border: "none", background: creating ? "#9ca3af" : "#15803d", color: "#fff", fontWeight: 700, cursor: creating ? "not-allowed" : "pointer", fontSize: 13 }}>
                                {creating ? "作成中..." : "このタスクを作成する"}
                              </button>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* ─────────── SECTION: タスク一覧 ─────────── */}
          {tab === "tasks" && (
            <div>
              {loading ? (
                <div style={{ textAlign: "center", padding: 40, color: "#9ca3af", fontSize: 14 }}>読み込み中...</div>
              ) : tasks.length === 0 ? (
                <div style={{ textAlign: "center", padding: "60px 0", color: "#9ca3af" }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>🤖</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#374151", marginBottom: 6 }}>まだタスクがありません</div>
                  <div style={{ fontSize: 12 }}>「タスク作成」から最初のタスクを作成してください</div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {tasks.map(t => (
                    <div key={t.task_id} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "16px 20px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 6, background: STATUS_COLOR[t.status] + "22", color: STATUS_COLOR[t.status] }}>{STATUS_LABEL[t.status] || t.status}</span>
                        <span style={{ fontSize: 14, fontWeight: 600, color: "#1e1b4b" }}>{t.op_snapshot?.display_name || OP_LABEL[t.operation_type] || t.operation_type}</span>
                        <span style={{ fontSize: 11, color: "#9ca3af", marginLeft: "auto" }}>{t.created_at ? new Date(t.created_at).toLocaleString("ja-JP") : ""}</span>
                      </div>
                      <div style={{ fontSize: 13, color: "#475569", marginBottom: 8, lineHeight: 1.6 }}>{taskSummary(t)}</div>
                      {OP_HELP[t.operation_type] && <div style={{ fontSize: 11, color: "#64748b", marginBottom: 10 }}>{OP_HELP[t.operation_type]}</div>}
                      {(t.payload?.media_name || t.menu_item_title || t.menu_item_target_url || t.schedule_id) && (
                        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {t.payload?.media_name && <span>媒体: {String(t.payload.media_name)}</span>}
                          {t.menu_item_title && <span>リンク: {t.menu_item_title}</span>}
                          {t.menu_item_category && <span>カテゴリ: {t.menu_item_category}</span>}
                          {t.menu_item_target_url && <span style={{ maxWidth: 360, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>URL: {t.menu_item_target_url}</span>}
                          {t.schedule_id && <span>予約生成</span>}
                        </div>
                      )}
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {t.status === "PENDING" && <button onClick={() => handleApprove(t.task_id)} style={{ padding: "7px 18px", borderRadius: 8, border: "none", background: "#1a6fa8", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>承認する</button>}
                        {t.status === "PENDING" && <button onClick={() => handleReject(t.task_id)} style={{ padding: "7px 18px", borderRadius: 8, border: "1px solid #fca5a5", background: "#fff", color: "#b91c1c", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>却下する</button>}
                        {t.status === "APPROVED" && <button onClick={() => handleExecute(t.task_id)} style={{ padding: "7px 18px", borderRadius: 8, border: "none", background: "#15803d", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>実行する</button>}
                        {t.status !== "RUNNING" && <button onClick={() => handleDelete(t.task_id)} style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", color: "#6b7280", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>削除</button>}
                      </div>
                      {t.status === "WAITING_MAPPING" && <div style={{ marginTop: 8, padding: "8px 12px", borderRadius: 6, background: "#e0f2fe", border: "1px solid #7dd3fc", fontSize: 12, color: "#0369a1" }}>AI整備が必要です。媒体基盤で対象ページ・入力項目・保存操作を保存してから実行します。</div>}
                      {t.status === "BLOCKED" && <div style={{ marginTop: 8, padding: "8px 12px", borderRadius: 6, background: "#fef2f2", border: "1px solid #fca5a5", fontSize: 12, color: "#b91c1c" }}>🚫 必要情報が不足しています</div>}
                      {t.status === "WAITING_EXECUTOR" && <div style={{ marginTop: 8, padding: "8px 12px", borderRadius: 6, background: "#faf5ff", border: "1px solid #e9d5ff", fontSize: 12, color: "#7c3aed" }}>🔧 実行層未対応：タスク構造・承認・ログ確認までが現在の対応範囲です。</div>}
                      {t.status === "REJECTED" && <div style={{ marginTop: 8, padding: "8px 12px", borderRadius: 6, background: "#f9fafb", border: "1px solid #e5e7eb", fontSize: 12, color: "#6b7280" }}>このタスクは却下済みです。不要なら削除できます。</div>}
                      {t.result && t.status !== "REJECTED" && (() => {
                        const res = t.result as Record<string, unknown>;
                        const isSuccess = res.success === true || res.status === "DONE";
                        const msg2 = res.message as string || res.error as string || "";
                        const verif = res.verification as Record<string, unknown> | undefined;
                        const diff = res.diff as Record<string, {before: unknown, after: unknown, changed: boolean}> | undefined;
                        const isValidationFailed = msg2.includes("[P29_VALIDATION_FAILED]");
                        const approvalCount = (t as unknown as Record<string, unknown>).approval_count as number | undefined;
                        const autoEnabled = (t as unknown as Record<string, unknown>).auto_enabled as boolean | undefined;
                        const monitorData = res.monitor_data as {headers?: string[]; items?: Record<string,string>[]; total_count?: number; summary?: string; page_title?: string; error?: string; analysis?: {cast_summary?: {名前?:string;投稿数?:number;最終投稿?:string;評価?:string;コメント?:string}[]; alert_casts?: string[]; top_poster?: string; overall_comment?: string}} | undefined;
                        const monitorScreenshot = res.screenshot_b64 as string | undefined;
                        return (
                          <div style={{ marginTop: 8, padding: "8px 12px", borderRadius: 6, background: isSuccess ? "#f0fdf4" : "#fef2f2", border: `1px solid ${isSuccess ? "#bbf7d0" : "#fca5a5"}`, fontSize: 12 }}>
                            <span style={{ color: isSuccess ? "#15803d" : "#b91c1c", fontWeight: 700 }}>{isSuccess ? (t.operation_type === "page_monitor" ? "👁 監視完了" : "✅ 実行完了") : "❌ 実行失敗"}</span>
                            {isValidationFailed && (
                              <div style={{ marginTop: 4, padding: "4px 8px", borderRadius: 4, background: "#fef2f2", border: "1px solid #fca5a5", color: "#b91c1c", fontWeight: 600 }}>
                                ⛔ バリデーションエラー: {msg2.replace("[P29_VALIDATION_FAILED]", "").trim()}
                              </div>
                            )}
                            {!isValidationFailed && msg2 && <div style={{ color: "#374151", marginTop: 4 }}>{translateError(msg2)}</div>}
                            {verif && t.operation_type !== "page_monitor" && <div style={{ color: "#6b7280", marginTop: 4 }}>検証: {verif.method as string} {verif.verified ? "✅" : "❌"}</div>}
                            {/* ── page_monitor 専用結果表示 ── */}
                            {t.operation_type === "page_monitor" && monitorData && (
                              <div style={{ marginTop: 8, borderTop: "1px solid #bbf7d0", paddingTop: 8 }}>
                                {monitorScreenshot && (
                                  <img src={`data:image/jpeg;base64,${monitorScreenshot}`} alt="監視スクリーンショット"
                                    style={{ width: "100%", maxHeight: 180, objectFit: "cover", objectPosition: "top", borderRadius: 6, marginBottom: 8, border: "1px solid #e5e7eb" }} />
                                )}
                                {/* 全体サマリー */}
                                {monitorData.analysis?.overall_comment && (
                                  <div style={{ fontSize: 12, color: "#0369a1", fontWeight: 700, marginBottom: 8, padding: "6px 10px", background: "#e0f2fe", borderRadius: 6 }}>
                                    📊 {monitorData.analysis.overall_comment}
                                  </div>
                                )}
                                {/* アラートキャスト */}
                                {(monitorData.analysis?.alert_casts || []).length > 0 && (
                                  <div style={{ marginBottom: 8, padding: "5px 10px", borderRadius: 6, background: "#fef2f2", border: "1px solid #fca5a5", fontSize: 11 }}>
                                    <span style={{ fontWeight: 700, color: "#b91c1c" }}>⚠️ 要確認（7日以上未投稿）: </span>
                                    <span style={{ color: "#b91c1c" }}>{(monitorData.analysis?.alert_casts || []).join("、")}</span>
                                  </div>
                                )}
                                {/* キャスト別集計 */}
                                {(monitorData.analysis?.cast_summary || []).length > 0 && (
                                  <div style={{ marginBottom: 10 }}>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: "#374151", marginBottom: 4 }}>キャスト別投稿状況</div>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                      {(monitorData.analysis?.cast_summary || []).map((c, ci) => (
                                        <div key={ci} style={{ padding: "5px 8px", borderRadius: 5, background: c.評価 === "未投稿" ? "#fef2f2" : c.評価 === "少ない" ? "#fffbeb" : "#f0fdf4", border: `1px solid ${c.評価 === "未投稿" ? "#fca5a5" : c.評価 === "少ない" ? "#fde68a" : "#bbf7d0"}`, fontSize: 11 }}>
                                          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                                            <span style={{ fontWeight: 800, color: "#1e1b4b", minWidth: 60 }}>{c.名前}</span>
                                            <span style={{ background: "#dbeafe", color: "#1d4ed8", borderRadius: 3, padding: "1px 6px", fontWeight: 700 }}>{c.投稿数}件</span>
                                            <span style={{ color: "#6b7280", fontSize: 10 }}>最終: {c.最終投稿 || "不明"}</span>
                                            <span style={{ color: c.評価 === "未投稿" ? "#b91c1c" : c.評価 === "少ない" ? "#b45309" : "#15803d", fontWeight: 600 }}>{c.評価}</span>
                                          </div>
                                          {c.コメント && <div style={{ color: "#475569", fontSize: 10, marginTop: 3 }}>{c.コメント}</div>}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {/* 投稿一覧テーブル */}
                                {monitorData.error ? (
                                  <div style={{ color: "#b91c1c", fontSize: 11 }}>解析エラー: {monitorData.error}</div>
                                ) : (monitorData.items && monitorData.items.length > 0) ? (
                                  <div>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: "#374151", marginBottom: 4 }}>投稿一覧（直近{monitorData.items.length}件）</div>
                                    <div style={{ overflowX: "auto" }}>
                                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
                                        <thead>
                                          <tr style={{ background: "#1e1b4b" }}>
                                            {Object.keys(monitorData.items[0] || {}).map((h, hi) => (
                                              <th key={hi} style={{ padding: "4px 6px", color: "#fff", fontWeight: 700, textAlign: "left", whiteSpace: "nowrap", borderRight: "1px solid #3730a3" }}>{h}</th>
                                            ))}
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {monitorData.items.map((row, ri) => (
                                            <tr key={ri} style={{ background: ri % 2 === 0 ? "#f5f3ff" : "#fff", borderBottom: "1px solid #ede9fe" }}>
                                              {Object.keys(row).map((h, ci) => (
                                                <td key={ci} style={{ padding: "3px 6px", color: "#374151", verticalAlign: "top", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row[h] ?? ""}</td>
                                              ))}
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                    <div style={{ fontSize: 10, color: "#6b7280", marginTop: 4 }}>
                                      {monitorData.items.length}件表示 / 合計 {monitorData.total_count ?? monitorData.items.length}件
                                    </div>
                                  </div>
                                ) : (
                                  <div style={{ fontSize: 11, color: "#6b7280" }}>データなし（ページをご確認ください）</div>
                                )}
                              </div>
                            )}
                            {diff && Object.values(diff).some(d => d.changed) && (
                              <div style={{ marginTop: 6, borderTop: "1px solid #e5e7eb", paddingTop: 6 }}>
                                <div style={{ fontWeight: 600, color: "#374151", marginBottom: 4 }}>📝 変更差分</div>
                                {Object.entries(diff).filter(([, d]) => d.changed).map(([key, d]) => (
                                  <div key={key} style={{ marginBottom: 2, color: "#374151" }}>
                                    <span style={{ fontWeight: 600 }}>{key}:</span>
                                    <span style={{ color: "#b91c1c", marginLeft: 4 }}>{String(d.before ?? "（空）")}</span>
                                    <span style={{ color: "#6b7280", margin: "0 4px" }}>→</span>
                                    <span style={{ color: "#15803d" }}>{String(d.after ?? "（空）")}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            {autoEnabled && (
                              <div style={{ marginTop: 6, padding: "3px 8px", borderRadius: 4, background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1d4ed8", fontSize: 11 }}>
                                🤖 自動実行昇格済み（承認{approvalCount}回達成）
                              </div>
                            )}
                          </div>
                        );
                      })()}
                  </div>
                    ))}
                </div>
              )}
            </div>
          )}

          {/* ─────────── SECTION: 一括実行 ─────────── */}
          {tab === "batch" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "16px 20px" }}>
                <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap", marginBottom: 14 }}>
                  <div style={{ minWidth: 220 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 6 }}>操作タイプ</div>
                    <select value={batchOp} onChange={e => { setBatchOp(e.target.value); setBatchSelectedMappingIds({}); }}
                      style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13 }}>
                      {SUPPORTED_OPS.map(op => <option key={op} value={op}>{OP_LABEL[op] || op}</option>)}
                    </select>
                  </div>
                  <div style={{ flex: 1, minWidth: 260 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 6 }}>投稿内容・入力データ（JSON）</div>
                    <div style={{ fontSize: 11, color: "#64748b", marginBottom: 6 }}>例：本文だけなら {"{\"body\":\"投稿本文\"}"} の形で入力します。</div>
                    <textarea value={batchPayloadText} onChange={e => setBatchPayloadText(e.target.value)}
                      style={{ width: "100%", minHeight: 92, padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 12, fontFamily: "monospace", resize: "vertical" }} />
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#1e1b4b" }}>実行できるサイト {batchReadyMappings.length}件</span>
                  <button onClick={() => {
                    const next: Record<string, boolean> = {};
                    batchReadyMappings.forEach(m => { next[m.mapping_id] = true; });
                    setBatchSelectedMappingIds(next);
                  }} disabled={batchReadyMappings.length === 0}
                    style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid #c4b5fd", background: "#fff", color: "#7c3aed", fontSize: 12, fontWeight: 700, cursor: batchReadyMappings.length ? "pointer" : "not-allowed" }}>
                    全選択
                  </button>
                  <button onClick={() => setBatchSelectedMappingIds({})}
                    style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid #e5e7eb", background: "#fff", color: "#6b7280", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                    解除
                  </button>
                  <span style={{ fontSize: 12, color: "#6b7280" }}>選択中 {selectedBatchIds.length}件</span>
                </div>

                {batchReadyMappings.length === 0 ? (
                  <div style={{ padding: "18px 14px", borderRadius: 8, background: "#f9fafb", border: "1px solid #e5e7eb", fontSize: 12, color: "#6b7280" }}>
                    この操作を媒体全体で実行できるサイトがありません。媒体基盤のAI整備で候補を実行可/不可に分類してください。リンク別にAI整備済みの操作は「詳細作成」から対象リンクを選べます。
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 8 }}>
                    {batchReadyMappings.map(m => {
                      const st = operationState(m, batchOp);
                      return (
                        <label key={m.mapping_id} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 12px", borderRadius: 8, border: batchSelectedMappingIds[m.mapping_id] ? "1px solid #7c3aed" : "1px solid #e5e7eb", background: batchSelectedMappingIds[m.mapping_id] ? "#f5f3ff" : "#fff", cursor: "pointer" }}>
                          <input type="checkbox" checked={!!batchSelectedMappingIds[m.mapping_id]} onChange={e => setBatchSelectedMappingIds(prev => ({ ...prev, [m.mapping_id]: e.target.checked }))} style={{ marginTop: 3 }} />
                          <span style={{ minWidth: 0 }}>
                            <span style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#1e1b4b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.media_name}</span>
                            <span style={{ display: "block", fontSize: 11, color: "#15803d", fontWeight: 700, marginTop: 2 }}>
                              {_SCOUT_BATCH_OPS.includes(batchOp) ? `🔑 ${SITE_PURPOSE_LABEL[m.business_conditions?.site_purpose || ""] || "認証済"}` : (st?.status || "STEPS_READY")}
                            </span>
                            {(st?.target_url || st?.page_url || m.media_url) && <span style={{ display: "block", fontSize: 10, color: "#9ca3af", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{st?.target_url || st?.page_url || m.media_url}</span>}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}

                <button onClick={handleBatchCreate} disabled={batchLoading || selectedBatchIds.length === 0}
                  style={{ marginTop: 14, padding: "9px 22px", borderRadius: 8, border: "none", background: batchLoading || selectedBatchIds.length === 0 ? "#9ca3af" : "#7c3aed", color: "#fff", fontWeight: 700, cursor: batchLoading || selectedBatchIds.length === 0 ? "not-allowed" : "pointer", fontSize: 13 }}>
                  一括タスクを作成
                </button>
              </div>

              {batches.length === 0 ? (
                <div style={{ textAlign: "center", padding: "42px 0", color: "#9ca3af" }}>
                  <div style={{ fontSize: 40, marginBottom: 10 }}>⏩</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#374151", marginBottom: 6 }}>まだ一括タスクがありません</div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {batches.map(b => {
                    const color = STATUS_COLOR[b.status] || (b.status.includes("PARTIAL") ? "#b87d00" : "#6b7280");
                    const canApprove = b.status === "PENDING" || b.status === "PARTIAL_APPROVED";
                    const canExecute = ["APPROVED", "PARTIAL_FAILED", "PARTIAL_DONE", "FAILED", "NEEDS_REVIEW"].includes(b.status);
                    return (
                      <div key={b.batch_id} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "16px 20px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 6, background: color + "22", color }}>{b.status}</span>
                          <span style={{ fontSize: 14, fontWeight: 700, color: "#1e1b4b" }}>{OP_LABEL[b.operation_type] || b.operation_type}</span>
                          <span style={{ fontSize: 12, color: "#6b7280" }}>作成 {b.counts?.created ?? b.task_ids?.length ?? 0} / スキップ {b.counts?.skipped ?? 0} / 完了 {b.counts?.done ?? 0} / 失敗 {b.counts?.failed ?? 0}</span>
                          <span style={{ fontSize: 11, color: "#9ca3af", marginLeft: "auto" }}>{b.created_at ? new Date(b.created_at).toLocaleString("ja-JP") : ""}</span>
                        </div>
                        {b.skipped_targets && b.skipped_targets.length > 0 && (
                          <div style={{ marginBottom: 8, padding: "8px 10px", borderRadius: 6, background: "#fffbeb", border: "1px solid #fde68a", fontSize: 11, color: "#92400e" }}>
                            スキップ: {b.skipped_targets.slice(0, 3).map(s => `${s.media_name || s.mapping_id}(${s.reason})`).join("、")}{b.skipped_targets.length > 3 ? ` ほか${b.skipped_targets.length - 3}件` : ""}
                          </div>
                        )}
                        {b.execution_results && b.execution_results.length > 0 && (
                          <div style={{ marginBottom: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                            {b.execution_results.slice(0, 4).map((r, idx) => (
                              <div key={`${b.batch_id}-result-${idx}`} style={{ fontSize: 11, color: r.status === "DONE" ? "#15803d" : r.skipped ? "#6b7280" : "#b91c1c" }}>
                                {r.task_id}: {r.status}{r.reason ? ` / ${r.reason}` : ""}{r.error ? ` / ${String(r.error)}` : ""}
                              </div>
                            ))}
                          </div>
                        )}
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {canApprove && <button onClick={() => handleBatchApprove(b.batch_id)} disabled={batchLoading}
                            style={{ padding: "7px 16px", borderRadius: 8, border: "none", background: batchLoading ? "#9ca3af" : "#1a6fa8", color: "#fff", fontWeight: 700, cursor: batchLoading ? "not-allowed" : "pointer", fontSize: 13 }}>一括承認</button>}
                          {canExecute && <button onClick={() => handleBatchExecute(b.batch_id)} disabled={batchLoading}
                            style={{ padding: "7px 16px", borderRadius: 8, border: "none", background: batchLoading ? "#9ca3af" : "#15803d", color: "#fff", fontWeight: 700, cursor: batchLoading ? "not-allowed" : "pointer", fontSize: 13 }}>順次実行</button>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ─────────── SECTION: スケジュール ─────────── */}
          {tab === "schedule" && (
            <div>
              <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "16px 20px", marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#1e1b4b", marginBottom: 12 }}>＋ 定期実行を予約</div>
                {(() => {
                  const scheduleMedia = mappings.find(m => m.mapping_id === scheduleMediaId) || null;
                  const scheduleOp = ops.find(op => op.op_id === scheduleOpId) || null;
                  const scheduleOpType = scheduleOp?.operation_type || "";
                  const _schPurpose = scheduleMedia?.business_conditions?.site_purpose || "";
                  const _schPurposeOps = SITE_PURPOSE_OPS[_schPurpose] || [];
                  const _schSortByPurpose = (a: OpWithSchema, b: OpWithSchema) => {
                    const aM = _schPurposeOps.includes(a.operation_type || "");
                    const bM = _schPurposeOps.includes(b.operation_type || "");
                    return aM && !bM ? -1 : !aM && bM ? 1 : 0;
                  };
                  const readyScheduleOps = scheduleMedia
                    ? ops.filter(op => op.active !== false && !isWaitingExecutorOp(op) && isOperationReadyForMedia(scheduleMedia, op.operation_type || "")).sort(_schSortByPurpose)
                    : [];
                  const scheduleMenuItems = scheduleMedia && scheduleOpType ? readyMenuItemsForOp(scheduleMedia, scheduleOpType) : [];
                  const scheduleMediaReady = !!(scheduleMedia && scheduleOpType && isMediaOperationTaskable(scheduleMedia, scheduleOpType));
                  return (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <select value={scheduleMediaId} onChange={e => { setScheduleMediaId(e.target.value); setScheduleOpId(""); setScheduleMenuItemUrl(""); }}
                    style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }}>
                    <option value="">媒体を選択してください</option>
                    {mappings.map(m => <option key={m.mapping_id} value={m.mapping_id}>{m.media_name}</option>)}
                  </select>
                  <select value={scheduleOpId} onChange={e => { setScheduleOpId(e.target.value); setScheduleMenuItemUrl(""); }}
                    disabled={!scheduleMedia}
                    style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }}>
                    <option value="">予約する操作を選択してください</option>
                    {readyScheduleOps.map(op => {
                      const itemCount = scheduleMedia ? readyMenuItemsForOp(scheduleMedia, op.operation_type || "").length : 0;
                      const mediaReady = scheduleMedia ? isMediaOperationTaskable(scheduleMedia, op.operation_type || "") : false;
                      const _sMark = _schPurpose && _schPurposeOps.includes(op.operation_type || "") ? "★ " : "";
                      return <option key={op.op_id} value={op.op_id}>{_sMark}{op.display_name || OP_LABEL[op.operation_type || ""] || op.op_id}{itemCount ? ` / リンク別で実行可 ${itemCount}件` : mediaReady ? " / 媒体全体で実行可" : ""}</option>;
                    })}
                  </select>
                  {scheduleOpType && scheduleMenuItems.length > 0 && (
                    <select value={scheduleMenuItemUrl} onChange={e => setScheduleMenuItemUrl(e.target.value)}
                      style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }}>
                      <option value="">{scheduleMediaReady ? "媒体全体の操作で予約（URL指定なし）" : "対象HTMLメニューURLを選択してください"}</option>
                      {scheduleMenuItems.map(item => <option key={item.url} value={item.url}>{item.category ? `${item.category} / ` : ""}{item.title || item.url}</option>)}
                    </select>
                  )}
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginTop: 4 }}>予約時に使う入力データ（JSON）</div>
                  <textarea value={schedulePayloadText} onChange={e => setSchedulePayloadText(e.target.value)}
                    style={{ minHeight: 92, padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 12, fontFamily: "monospace", resize: "vertical" }} />
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <select value={scheduleDow} onChange={e => setScheduleDow(e.target.value)} style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }}>
                      <option value="*">毎日</option>
                      {["月","火","水","木","金","土","日"].map((d, i) => <option key={i+1} value={String(i+1 === 7 ? 0 : i+1)}>毎週 {d}曜</option>)}
                    </select>
                    <select value={scheduleHour} onChange={e => setScheduleHour(e.target.value)} style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }}>
                      {Array.from({length: 24}, (_, i) => <option key={i} value={String(i)}>{String(i).padStart(2,"0")}時</option>)}
                    </select>
                    <select value={scheduleMin} onChange={e => setScheduleMin(e.target.value)} style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }}>
                      {["0","15","30","45"].map(mn => <option key={mn} value={mn}>{mn.padStart(2,"0")}分</option>)}
                    </select>
                  </div>
                  <div style={{ fontSize: 12, color: "#6b7280", background: "#f9fafb", borderRadius: 6, padding: "8px 12px" }}>
                    予約内容: {scheduleDow === "*" ? "毎日" : `毎週${["日","月","火","水","木","金","土"][parseInt(scheduleDow)]}曜`} {scheduleHour.padStart(2,"0")}:{scheduleMin.padStart(2,"0")} に自動実行
                  </div>
                  <button onClick={async () => {
                    if (!scheduleMedia) { setMsg("予約対象の媒体を選択してください"); return; }
                    if (!scheduleOp) { setMsg("自動化内容を選択してください"); return; }
                    if (!scheduleMediaReady && scheduleMenuItems.length > 0 && !scheduleMenuItemUrl) { setMsg("対象HTMLメニューURLを選択してください"); return; }
                    let payload: Record<string, unknown> = {};
                    try { payload = schedulePayloadText.trim() ? JSON.parse(schedulePayloadText) : {}; }
                    catch { setMsg("入力データのJSON形式を確認してください"); return; }
                    const cron = `${scheduleMin} ${scheduleHour} * * ${scheduleDow}`;
                    try {
                      await createAgentSchedule({
                        op_id: scheduleOp.op_id?.startsWith("default_") ? undefined : scheduleOp.op_id,
                        operation_type: scheduleOpType,
                        media_mapping_id: scheduleMedia.mapping_id,
                        menu_item_target_url: scheduleMenuItemUrl || undefined,
                        cron_expr: cron,
                        payload_template: payload,
                      });
                      setMsg("実行予約を登録しました");
                      const d = await listAgentSchedules();
                      setSchedules(d.schedules);
                    }
                    catch (e: unknown) { setMsg((e as Error).message); }
                  }} style={{ padding: "10px 24px", borderRadius: 8, border: "none", background: "#7c3aed", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 14, alignSelf: "flex-start" }}>予約する</button>
                </div>
                  );
                })()}
              </div>
              {schedules.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 0", color: "#9ca3af" }}>
                  <div style={{ fontSize: 40, marginBottom: 10 }}>📅</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#374151", marginBottom: 6 }}>まだ予約がありません</div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {schedules.map(s => (
                    <div key={s.schedule_id} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "14px 18px", display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 14, color: "#1e1b4b" }}>{ops.find(o => o.op_id === s.op_id || o.operation_type === s.operation_type)?.display_name || OP_LABEL[s.operation_type || ""] || s.op_id}</div>
                        <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{s.media_name || s.media_mapping_id || "媒体未指定"}{s.menu_item_title ? ` / ${s.menu_item_title}` : ""}</div>
                        <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>{cronToJa(s.cron_expr)}{s.menu_item_target_url ? ` / リンク別で実行` : ""}</div>
                      </div>
                      <button onClick={async () => { try { await updateAgentSchedule(s.schedule_id, !s.enabled); const d = await listAgentSchedules(); setSchedules(d.schedules); } catch (e: unknown) { setMsg((e as Error).message); } }}
                        style={{ padding: "5px 14px", borderRadius: 6, border: `1px solid ${s.enabled ? "#bbf7d0" : "#e5e7eb"}`, background: s.enabled ? "#f0fdf4" : "#f9fafb", color: s.enabled ? "#15803d" : "#9ca3af", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                        {s.enabled ? "稼働中" : "停止中"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ─────────── SECTION: 実行ログ ─────────── */}
          {tab === "logs" && (
            <div>
              <div style={{ background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 10, padding: "12px 16px", marginBottom: 12, fontSize: 12, color: "#475569", display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <span>実行ログは時系列の履歴です。異常確認はこのログと媒体診断を集約した復旧リストです。</span>
                <span style={{ fontWeight: 800, color: failedLogs.length ? "#b91c1c" : "#15803d" }}>本日実行 {todayLogs}件 / 失敗 {failedLogs.length}件</span>
              </div>
              {loading ? (
                <div style={{ textAlign: "center", padding: 40, color: "#9ca3af" }}>読み込み中...</div>
              ) : logs.length === 0 ? (
                <div style={{ textAlign: "center", padding: "60px 0", color: "#9ca3af" }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#374151", marginBottom: 6 }}>まだ実行履歴がありません</div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {logs.map(l => (
                    <div key={l.log_id} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "14px 18px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 12, fontWeight: 700, padding: "2px 8px", borderRadius: 5, background: l.success ? "#dcfce7" : "#fee2e2", color: l.success ? "#15803d" : "#b91c1c" }}>{l.success ? "✅ 成功" : "❌ 失敗"}</span>
                        <span style={{ fontSize: 13, color: "#1e1b4b" }}>{OP_LABEL[l.operation_type] || l.operation_type}</span>
                        <span style={{ fontSize: 11, color: "#9ca3af", marginLeft: "auto" }}>{l.executed_at ? new Date(l.executed_at).toLocaleString("ja-JP") : ""}</span>
                      </div>
                      {l.error_message && <div style={{ fontSize: 12, color: "#b91c1c", marginTop: 4 }}>{translateError(l.error_message)}</div>}
                      {l.self_heal_retry_succeeded && <div style={{ fontSize: 12, color: "#1d4ed8", marginTop: 4, fontWeight: 600 }}>🔧 自動修復で成功（再実行）</div>}
                      {l.self_heal_attempted && !l.self_heal_retry_succeeded && <div style={{ fontSize: 12, color: "#b87d00", marginTop: 4 }}>🔧 自動修復を試みましたが失敗しました</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ─────────── SECTION: 異常確認 ─────────── */}
          {tab === "health" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
                {[
                  { label: "重大", value: criticalFindings, color: "#b91c1c", bg: "#fef2f2" },
                  { label: "要確認", value: warningFindings, color: "#b87d00", bg: "#fffbeb" },
                  { label: "失敗ログ", value: failedLogs.length, color: failedLogs.length ? "#b91c1c" : "#15803d", bg: "#f8fafc" },
                  { label: "本日実行", value: todayLogs, color: "#1d4ed8", bg: "#eff6ff" },
                ].map(x => (
                  <div key={x.label} style={{ background: x.bg, border: `1px solid ${x.color}22`, borderRadius: 10, padding: "12px 14px" }}>
                    <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>{x.label}</div>
                    <div style={{ fontSize: 22, color: x.color, fontWeight: 900, lineHeight: 1.2 }}>{x.value}</div>
                  </div>
                ))}
              </div>

              <div style={{ background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 10, padding: "12px 16px", fontSize: 12, color: "#475569" }}>
                異常確認は、実行ログだけでなく媒体基盤の接続状態とHTML深掘り診断をまとめた復旧リストです。
              </div>

              {healthFindings.length === 0 ? (
                <div style={{ textAlign: "center", padding: "60px 0", color: "#9ca3af" }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>🟢</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "#374151" }}>異常は検出されていません</div>
                  <div style={{ fontSize: 12, marginTop: 6 }}>接続・深掘り診断・実行ログに復旧対象はありません</div>
                </div>
              ) : (
                healthFindings.map(f => {
                  const tone = f.severity === "critical"
                    ? { bg: "#fef2f2", border: "#fca5a5", color: "#b91c1c", icon: "🔴" }
                    : { bg: "#fffbeb", border: "#fde68a", color: "#b87d00", icon: "🟡" };
                  const sourceLabel = f.source === "deep_scan" ? "深掘り診断" : f.source === "log" ? "実行ログ" : "媒体設定";
                  return (
                    <div key={f.id} style={{ background: tone.bg, border: `1px solid ${tone.border}`, borderRadius: 10, padding: "14px 18px", display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ fontSize: 20 }}>{tone.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 3 }}>
                          <span style={{ fontWeight: 800, fontSize: 14, color: tone.color }}>{f.title}</span>
                          <span style={{ fontSize: 10, fontWeight: 800, color: tone.color, background: "#fff", border: `1px solid ${tone.border}`, borderRadius: 5, padding: "2px 6px" }}>{sourceLabel}</span>
                        </div>
                        <div style={{ fontSize: 12, color: tone.color, marginTop: 2 }}>{f.detail}</div>
                        <div style={{ fontSize: 11, color: "#64748b", marginTop: 3 }}>{f.action}</div>
                      </div>
                      <button onClick={() => setTab(f.tab)}
                        style={{ padding: "6px 14px", borderRadius: 6, border: "none", background: tone.color, color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 12, whiteSpace: "nowrap" }}>
                        確認する
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          )}

        </div>
      </div>

      {debugMode && (<>
      <div style={{ padding: "0 24px 24px" }}>
        <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, padding: "18px 22px" }}>
          <div style={{ fontWeight: 800, fontSize: 14, color: "#1e1b4b", marginBottom: 12 }}>📋 ASCEND Agent OS 実装状況</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 8, fontSize: 12 }}>
            {([
              { phase: "P20", label: "Workflow Orchestration",   status: "定義済/保存済/一部接続済", note: "失敗時replan接続あり。完全自律実行ではない", color: "#b87d00", bg: "#fffbeb" },
              { phase: "P21", label: "Post-Login Crawler",       status: "接続済",                  note: "login_check成功後crawl接続済",             color: "#15803d", bg: "#f0fdf4" },
              { phase: "P22", label: "DOM Evidence Mapping",     status: "接続済",                  note: "operation_mappings保存/selector merge済",  color: "#15803d", bg: "#f0fdf4" },
              { phase: "P23", label: "Operation Deep Scan",      status: "接続済",                  note: "deep_scan実行済",                          color: "#15803d", bg: "#f0fdf4" },
              { phase: "P24", label: "LLM Classification",       status: "接続済",                  note: "deep_scan/rebuild_operation_steps済",      color: "#15803d", bg: "#f0fdf4" },
              { phase: "P25", label: "Session Management",       status: "接続済(部分)",            note: "通常実行経路のみ。login_checkは別経路。known issues有り", color: "#b87d00", bg: "#fffbeb" },
              { phase: "P26", label: "Auto Retry",               status: "定義済",                  note: "step retry(browser_executor)+task retry(agent.py)1回。設計図P26未完", color: "#6b7280", bg: "#f9fafb" },
              { phase: "P27", label: "Anomaly Detection",        status: "定義済",                  note: "mapping_id欠落対策のみ。N日間未投稿検知・連続失敗検知未実装", color: "#6b7280", bg: "#f9fafb" },
              { phase: "P28", label: "Diff Preview",             status: "接続済(部分)",            note: "before/after取得・diff生成済。UI表示未接続", color: "#b87d00", bg: "#fffbeb" },
              { phase: "P29", label: "Pre-Execution Validation", status: "接続済",                  note: "validation_rules実行前チェック済",         color: "#15803d", bg: "#f0fdf4" },
              { phase: "P30", label: "Verify + Rollback",        status: "接続済(修正済)",          note: "verified=True時のみDONE。self_heal+verified必須化修正済", color: "#b87d00", bg: "#fffbeb" },
              { phase: "P31", label: "Permission Learning",      status: "接続済(修正済)",          note: "FORBIDDEN_OPS禁止・LOW_RISK限定昇格修正済", color: "#b87d00", bg: "#fffbeb" },
              { phase: "P32", label: "Scheduler",                status: "接続済(task生成まで)",    note: "task生成まで接続済。自動execute未接続。承認制維持", color: "#6b7280", bg: "#f9fafb" },
              { phase: "P33", label: "Templates",                status: "定義済",                  note: "テンプレート保存のみ。自動適用禁止",       color: "#6b7280", bg: "#f9fafb" },
              { phase: "P34", label: "Chat→Task Flow",           status: "接続済",                  note: "チャットAgentモード→plan→READY媒体選定→task生成まで接続", color: "#15803d", bg: "#f0fdf4" },
              { phase: "P35", label: "Multi-Media Execution",    status: "接続済",                  note: "一括task作成/承認/逐次実行/失敗隔離APIと専用UIを追加", color: "#15803d", bg: "#f0fdf4" },
            ] as {phase:string;label:string;status:string;note:string;color:string;bg:string}[]).map(p => (
              <div key={p.phase} style={{ background: p.bg, border: `1px solid ${p.color}33`, borderRadius: 8, padding: "8px 12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                  <span style={{ fontWeight: 700, color: p.color, fontSize: 12 }}>{p.phase}</span>
                  <span style={{ fontSize: 11, color: "#374151" }}>{p.label}</span>
                </div>
                <div style={{ fontSize: 11, fontWeight: 600, color: p.color }}>{p.status}</div>
                <div style={{ fontSize: 10, color: "#6b7280", marginTop: 2 }}>{p.note}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{ padding: "0 24px 48px" }}>
        <div style={{ background: "linear-gradient(135deg,rgba(124,58,237,0.1),rgba(79,70,229,0.06))", borderRadius: 16, padding: "24px 28px", border: "1px solid rgba(124,58,237,0.2)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ fontWeight: 800, fontSize: 16, color: "#1e1b4b" }}>🤖 P20 Workflow Control Panel</div>
            <button onClick={fetchWfSessions} style={{ padding: "6px 16px", borderRadius: 8, border: "none", background: "#7c3aed", color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>更新</button>
          </div>
          {wfMsg && <div style={{ fontSize: 13, color: "#7c3aed", marginBottom: 12, padding: "8px 12px", borderRadius: 6, background: "#f5f3ff", border: "1px solid #c4b5fd" }}>{wfMsg}</div>}
          <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
            <input value={wfSessionInput} onChange={e => setWfSessionInput(e.target.value)} placeholder="セッションIDを入力"
              style={{ flex: 1, minWidth: 200, padding: "9px 14px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }} />
            <button onClick={async () => { if (!wfSessionInput.trim()) return; try { const s = await getWorkflowSession(wfSessionInput.trim()); setWfSessions([s]); setWfMsg(""); } catch(e: unknown) { setWfMsg((e as Error).message); } }}
              style={{ padding: "9px 18px", borderRadius: 8, border: "none", background: "#4f46e5", color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>取得</button>
            <button onClick={async () => { try { const r = await createWorkflowSession({ goal: wfSessionInput.trim() || "agent_task" }); setWfSessions(prev => [r, ...prev]); setWfMsg("セッション作成: " + r.session_id); } catch(e: unknown) { setWfMsg((e as Error).message); } }}
              style={{ padding: "9px 18px", borderRadius: 8, border: "none", background: "#15803d", color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>新規作成</button>
          </div>
          {wfSessions.length === 0 ? (
            <div style={{ textAlign: "center", padding: "24px 0", color: "#9ca3af", fontSize: 13 }}>セッションがありません</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {wfSessions.map(s => {
                const ap = s.approval_state || "";
                const st = s.status || "";
                const statusMap: Record<string, {label: string; color: string; bg: string}> = {
                  WAITING_APPROVAL: { label: "🟡 承認待ち", color: "#b87d00", bg: "#fffbeb" },
                  APPROVED:         { label: "🟢 実行可能", color: "#15803d", bg: "#f0fdf4" },
                  RUNNING:          { label: "🔵 実行中",   color: "#1d4ed8", bg: "#eff6ff" },
                  PAUSED:           { label: "⏸ 一時停止", color: "#6b7280", bg: "#f9fafb" },
                  COMPLETED:        { label: "✅ 完了",     color: "#15803d", bg: "#f0fdf4" },
                  FAILED:           { label: "🔴 失敗",     color: "#b91c1c", bg: "#fef2f2" },
                  REJECTED:         { label: "🚫 却下",     color: "#b91c1c", bg: "#fef2f2" },
                  CANCELLED:        { label: "⛔ キャンセル", color: "#6b7280", bg: "#f9fafb" },
                };
                const statusInfo = statusMap[ap] || statusMap[st] || { label: ap || st || "不明", color: "#6b7280", bg: "#f9fafb" };
                const isWaitingApproval = ap === "WAITING_APPROVAL";
                const isRunnable = ["APPROVED","RUNNING"].includes(ap) || ["APPROVED","RUNNING"].includes(st);
                const isPaused = ap === "PAUSED" || st === "PAUSED";
                const isFinished = ["REJECTED","CANCELLED","COMPLETED","FAILED"].includes(ap) || ["REJECTED","CANCELLED","COMPLETED","FAILED"].includes(st);
                const isCancelled = ["CANCELLED","REJECTED"].includes(ap) || ["CANCELLED","REJECTED"].includes(st);
                return (
                  <div key={s.session_id} style={{ background: statusInfo.bg, border: `1px solid ${statusInfo.color}33`, borderRadius: 10, padding: "14px 18px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: statusInfo.color }}>{statusInfo.label}</span>
                      <span style={{ fontSize: 12, color: "#6b7280", fontFamily: "monospace" }}>{s.session_id.slice(0, 12)}...</span>
                      <span style={{ fontSize: 11, color: "#9ca3af", marginLeft: "auto" }}>{s.session_id.slice(0,8)}</span>
                    </div>
                    
                    {s.risk_level && <div style={{ fontSize: 12, color: "#b87d00", marginBottom: 6 }}>リスク: {s.risk_level}</div>}
                    {!isFinished && (
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {isWaitingApproval && (
                          <>
                            <button onClick={async () => { try { await approveWorkflowSession(s.session_id); setWfMsg("承認しました"); fetchWfSessions(); } catch(e: unknown) { setWfMsg((e as Error).message); } }}
                              style={{ padding: "6px 16px", borderRadius: 8, border: "none", background: "#15803d", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>承認</button>
                            <button onClick={async () => { if (!confirm("却下しますか？")) return; try { await rejectWorkflowSession(s.session_id); setWfMsg("却下しました"); fetchWfSessions(); } catch(e: unknown) { setWfMsg((e as Error).message); } }}
                              style={{ padding: "6px 16px", borderRadius: 8, border: "none", background: "#b91c1c", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>却下</button>
                          </>
                        )}
                        {isRunnable && !isPaused && (
                          <button onClick={async () => { try { await pauseWorkflowSession(s.session_id); setWfMsg("一時停止しました"); fetchWfSessions(); } catch(e: unknown) { setWfMsg((e as Error).message); } }}
                            style={{ padding: "6px 16px", borderRadius: 8, border: "none", background: "#6b7280", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>一時停止</button>
                        )}
                        {isPaused && (
                          <button onClick={async () => { try { await resumeWorkflowSession(s.session_id); setWfMsg("再開しました"); fetchWfSessions(); } catch(e: unknown) { setWfMsg((e as Error).message); } }}
                            style={{ padding: "6px 16px", borderRadius: 8, border: "none", background: "#1a6fa8", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>再開</button>
                        )}
                        {!isCancelled && (
                          <button onClick={async () => { if (!confirm("キャンセルしますか？")) return; try { await cancelWorkflowSession(s.session_id); setWfMsg("キャンセルしました"); fetchWfSessions(); } catch(e: unknown) { setWfMsg((e as Error).message); } }}
                            style={{ padding: "6px 16px", borderRadius: 8, border: "none", background: "#b91c1c", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>キャンセル</button>
                        )}
                      </div>
                    )}
                    {isFinished && <div style={{ fontSize: 12, color: "#9ca3af", paddingTop: 4 }}>このセッションは終了済みのため操作できません</div>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      </>)}

      {/* ──── ページプレビュー 固定オーバーレイ ──── */}
      {menuItemScreenshot && (
        <div style={{ position: "fixed", bottom: 20, right: 20, zIndex: 8500, background: "#fff", borderRadius: 12, boxShadow: "0 4px 24px rgba(0,0,0,0.22)", width: 340, maxHeight: "70vh", overflowY: "auto", padding: 14, border: "1px solid #bae6fd" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#0c4a6e", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 260 }} title={menuItemScreenshot.url}>📸 {menuItemScreenshot.label}</span>
            <button onClick={() => setMenuItemScreenshot(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#94a3b8", lineHeight: 1, flexShrink: 0 }}>×</button>
          </div>
          {menuItemScreenshot.loading && (
            <div style={{ textAlign: "center", padding: "24px 0", fontSize: 12, color: "#9ca3af" }}>
              🤖 AIがページを取得中...<br/><span style={{ fontSize: 11 }}>ログインセッションを維持してアクセスします</span>
            </div>
          )}
          {!menuItemScreenshot.loading && menuItemScreenshot.img && (
            <img src={`data:image/png;base64,${menuItemScreenshot.img}`} alt="page preview" style={{ width: "100%", borderRadius: 6, border: "1px solid #e2e8f0" }} />
          )}
          {!menuItemScreenshot.loading && !menuItemScreenshot.img && !menuItemScreenshot.error && (
            <div style={{ fontSize: 11, color: "#9ca3af", textAlign: "center", padding: "16px 0" }}>画像を取得できませんでした</div>
          )}
          {menuItemScreenshot.error && (
            <div style={{ fontSize: 11, color: "#b91c1c", background: "#fef2f2", borderRadius: 6, padding: "8px 10px" }}>{menuItemScreenshot.error}</div>
          )}
        </div>
      )}

      {/* ──── 対話型マッピング モーダル ──── */}
      {dialogMappingId !== null && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.55)" }}
          onClick={(e) => { if (e.target === e.currentTarget) { setDialogMappingId(null); } }}>
          <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 8px 40px rgba(0,0,0,0.22)", width: "min(580px, 96vw)", maxHeight: "88vh", overflowY: "auto", padding: "28px 28px 24px" }}>

            {/* ヘッダー */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#1e293b" }}>⚙️ 操作マッピング設定</div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 3 }}>{dialogOpType} — {dialogDone ? "設定完了" : dialogLoading ? "AI解析中..." : `ステップ ${dialogStepIdx + 1} / ${dialogSteps.length}`}</div>
              </div>
              <button onClick={() => setDialogMappingId(null)}
                style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#94a3b8", lineHeight: 1 }}>×</button>
            </div>

            {/* ローディング */}
            {dialogLoading && (
              <div style={{ textAlign: "center", padding: "32px 0", color: "#64748b", fontSize: 14 }}>
                <div style={{ fontSize: 28, marginBottom: 10 }}>🤖</div>
                AIがページを解析中です。<br/>
                <span style={{ fontSize: 12, color: "#9ca3af" }}>（2回目以降はセッションキャッシュを使用します）</span>
              </div>
            )}

            {/* エラー */}
            {!dialogLoading && dialogError && (
              <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 10, padding: 16, color: "#b91c1c", fontSize: 13 }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>❌ エラーが発生しました</div>
                {dialogError}
                <div style={{ marginTop: 12 }}>
                  <button onClick={() => setDialogMappingId(null)}
                    style={{ padding: "6px 16px", borderRadius: 8, border: "none", background: "#e2e8f0", color: "#475569", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>閉じる</button>
                </div>
              </div>
            )}

            {/* 完了サマリー */}
            {!dialogLoading && !dialogError && dialogDone && (
              <div>
                <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: 16, marginBottom: 16 }}>
                  <div style={{ fontWeight: 700, color: "#15803d", marginBottom: 10, fontSize: 14 }}>✅ 設定が完了しました</div>
                  {Object.entries(dialogConfirmed).map(([role, val]) => (
                    <div key={role} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 6, fontSize: 12 }}>
                      <span style={{ color: "#64748b", minWidth: 120 }}>{role}</span>
                      <span style={{ fontFamily: "monospace", color: "#1e293b", wordBreak: "break-all", background: "#e0f2fe", borderRadius: 4, padding: "1px 6px" }}>{val}</span>
                    </div>
                  ))}
                </div>
                {/* 発見されたタブメニュー */}
                {dialogDiscoveredTabs.length > 0 && (
                  <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: 14, marginBottom: 14 }}>
                    <div style={{ fontWeight: 700, color: "#92400e", marginBottom: 8, fontSize: 13 }}>🔎 このページで発見されたタブ ({dialogDiscoveredTabs.length}件)</div>
                    <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>ページリストに追加すると個別に設定できます</div>
                    {dialogDiscoveredTabs.map((tab, ti) => (
                      <div key={ti} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 0", borderTop: ti > 0 ? "1px solid #fde68a" : "none" }}>
                        <span style={{ flex: 1, fontSize: 11, color: "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={tab.absolute_url}>{tab.text || tab.href}</span>
                        <button onClick={async () => {
                          try {
                            await addMenuItem(dialogDiscoveredMappingId, { absolute_url: tab.absolute_url, title: tab.text || tab.href });
                            const d = await listMediaMappings(); setMappings(d.mappings || []);
                            setDialogDiscoveredTabs(prev => prev.filter((_, i) => i !== ti));
                          } catch(e: unknown) { alert((e as Error).message || "追加失敗"); }
                        }} style={{ padding: "2px 10px", borderRadius: 5, border: "1px solid #fbbf24", background: "#fff", color: "#92400e", fontSize: 10, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
                          📥 追加
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ fontSize: 12, color: "#64748b", marginBottom: 16 }}>次回以降はキャッシュを使用するため、LLM解析なしで高速実行されます。</div>
                <button onClick={() => setDialogMappingId(null)}
                  style={{ width: "100%", padding: "10px 0", borderRadius: 10, border: "none", background: "#1a6fa8", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>閉じる</button>
              </div>
            )}

            {/* 質問ステップ */}
            {!dialogLoading && !dialogError && !dialogDone && dialogSteps.length > 0 && (() => {
              const step = dialogSteps[dialogStepIdx];
              const isLast = dialogStepIdx >= dialogSteps.length - 1;
              const doConfirm = async (value: string) => {
                if (!value.trim() || dialogSaving) return;
                setDialogSaving(true);
                try {
                  await confirmDialogStep(dialogMappingId!, {
                    page_name: dialogOpType,
                    role: step.role,
                    value: value.trim(),
                    type: step.type,
                  });
                  setDialogConfirmed(prev => ({ ...prev, [step.role]: value.trim() }));
                  setDialogCustomVal("");
                  setDialogPreviewImg(null);
                  setDialogPreviewIdx(null);
                  setDialogPreviewError("");
                  if (isLast) {
                    setDialogDone(true);
                    try { const d = await listMediaMappings(); setMappings(d.mappings || []); } catch {}
                  } else {
                    setDialogStepIdx(i => i + 1);
                  }
                } catch (e: unknown) {
                  setDialogError((e as Error).message || "保存失敗");
                } finally { setDialogSaving(false); }
              };

              const doSkip = () => {
                setDialogCustomVal("");
                setDialogPreviewImg(null);
                setDialogPreviewIdx(null);
                setDialogPreviewError("");
                if (isLast) {
                  setDialogDone(true);
                } else {
                  setDialogStepIdx(i => i + 1);
                }
              };

              const doPreview = async (candidateIdx: number, selector: string) => {
                if (dialogPreviewIdx === candidateIdx) {
                  setDialogPreviewImg(null); setDialogPreviewIdx(null); setDialogPreviewError(""); return;
                }
                setDialogPreviewIdx(candidateIdx);
                setDialogPreviewImg(null);
                setDialogPreviewError("");
                const navigateUrl = dialogConfirmed["target_url"] || "";
                try {
                  const r = await previewDialogElement(dialogMappingId!, {
                    selector,
                    navigate_url: navigateUrl,
                    operation_type: dialogOpType,
                  });
                  setDialogPreviewImg(r.screenshot_b64 || null);
                  if (!r.element_found) setDialogPreviewError("⚠️ 要素が見つかりませんでした（セレクターが一致しない可能性があります）");
                } catch (e: unknown) {
                  setDialogPreviewImg(null);
                  setDialogPreviewIdx(null);
                  setDialogPreviewError(`プレビュー取得失敗: ${(e as Error).message || "不明なエラー"}`);
                }
              };

              const doUrlPreview = async (candidateIdx: number, candidateUrl: string) => {
                if (dialogPreviewIdx === candidateIdx) {
                  setDialogPreviewImg(null); setDialogPreviewIdx(null); setDialogPreviewError(""); return;
                }
                setDialogPreviewIdx(candidateIdx);
                setDialogPreviewImg(null);
                setDialogPreviewError("");
                try {
                  const r = await previewDialogElement(dialogMappingId!, {
                    selector: "body",
                    navigate_url: candidateUrl,
                    operation_type: dialogOpType,
                  });
                  setDialogPreviewImg(r.screenshot_b64 || null);
                  if (!r.element_found) setDialogPreviewError("⚠️ ページが開けませんでした");
                } catch (e: unknown) {
                  setDialogPreviewImg(null);
                  setDialogPreviewIdx(null);
                  setDialogPreviewError(`スクリーンショット失敗: ${(e as Error).message || "不明"}`);
                }
              };

              const confidenceColor = (c: string) =>
                c === "high" ? "#15803d" : c === "medium" ? "#b87d00" : "#6b7280";
              const confidenceBg = (c: string) =>
                c === "high" ? "#dcfce7" : c === "medium" ? "#fef9c3" : "#f1f5f9";
              const confidenceLabel = (c: string) =>
                c === "high" ? "高" : c === "medium" ? "中" : "低";

              return (
                <div>
                  {/* プログレスバー */}
                  <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
                    {dialogSteps.map((_, i) => (
                      <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i < dialogStepIdx ? "#1a6fa8" : i === dialogStepIdx ? "#93c5fd" : "#e2e8f0" }} />
                    ))}
                  </div>

                  {/* 質問 */}
                  <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "14px 16px", marginBottom: 16 }}>
                    <div style={{ fontSize: 13, color: "#64748b", marginBottom: 4 }}>
                      {step.type === "url" ? "🔗 URLを選択" : "🎯 セレクターを選択"}
                      {step.optional && <span style={{ marginLeft: 6, fontSize: 11, color: "#94a3b8", background: "#f1f5f9", borderRadius: 4, padding: "1px 6px" }}>任意</span>}
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#1e293b" }}>{step.question}</div>
                  </div>

                  {/* AIが提案する候補 */}
                  {step.candidates && step.candidates.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600, marginBottom: 8 }}>💡 AI整備待ち候補</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {step.candidates.map((c, i) => {
                          const val = step.type === "url" ? (c.value || "") : (c.selector || "");
                          const isPreviewing = dialogPreviewIdx === i;
                          if (step.type === "url") {
                            const isUrlPreviewing = dialogPreviewIdx === i;
                            return (
                              <div key={i} style={{ borderRadius: 8, border: `1px solid ${isUrlPreviewing ? "#1a6fa8" : "#e2e8f0"}`, background: "#fff", overflow: "hidden" }}>
                                <div style={{ padding: "10px 14px" }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                                    <span style={{ fontSize: 11, fontWeight: 700, color: confidenceColor(c.confidence), background: confidenceBg(c.confidence), borderRadius: 4, padding: "1px 6px" }}>
                                      確度: {confidenceLabel(c.confidence)}
                                    </span>
                                    <button onClick={() => doUrlPreview(i, val)} disabled={dialogSaving}
                                      style={{ fontSize: 11, color: "#1a6fa8", background: isUrlPreviewing ? "#eff6ff" : "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 4, padding: "2px 8px", cursor: dialogSaving ? "default" : "pointer", fontWeight: 600 }}>
                                      {isUrlPreviewing && !dialogPreviewImg ? "取得中..." : isUrlPreviewing ? "▲ 閉じる" : "📸 ページを確認"}
                                    </button>
                                    <button onClick={() => navigator.clipboard.writeText(val).catch(()=>{})}
                                      style={{ fontSize: 10, color: "#94a3b8", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 4, padding: "2px 6px", cursor: "pointer" }}
                                      title={val}>📋</button>
                                  </div>
                                  <div style={{ fontFamily: "monospace", fontSize: 12, color: "#1e293b", wordBreak: "break-all", marginBottom: 4 }}>{val}</div>
                                  {c.description && <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>{c.description}</div>}
                                  {isUrlPreviewing && dialogPreviewImg && (
                                    <div style={{ marginBottom: 8 }}>
                                      <img src={`data:image/png;base64,${dialogPreviewImg}`} alt="page preview" style={{ width: "100%", borderRadius: 6, border: "1px solid #e2e8f0" }} />
                                    </div>
                                  )}
                                  {isUrlPreviewing && dialogPreviewError && (
                                    <div style={{ fontSize: 11, color: "#b45309", background: "#fffbeb", borderRadius: 4, padding: "4px 8px", marginBottom: 8 }}>{dialogPreviewError}</div>
                                  )}
                                  <button onClick={() => doConfirm(val)} disabled={dialogSaving}
                                    style={{ padding: "5px 14px", borderRadius: 6, border: "none", background: dialogSaving ? "#e2e8f0" : "#1a6fa8", color: dialogSaving ? "#94a3b8" : "#fff", fontWeight: 700, cursor: dialogSaving ? "default" : "pointer", fontSize: 12 }}>
                                    これで正しい ✅
                                  </button>
                                </div>
                              </div>
                            );
                          } else {
                            // セレクター ステップ: メタデータ表示 + スクリーンショット確認
                            return (
                              <div key={i} style={{ borderRadius: 8, border: `1px solid ${isPreviewing ? "#1a6fa8" : "#e2e8f0"}`, background: "#fff", overflow: "hidden", transition: "border-color 0.15s" }}>
                                <div style={{ padding: "10px 14px" }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                                    <span style={{ fontSize: 11, fontWeight: 700, color: confidenceColor(c.confidence), background: confidenceBg(c.confidence), borderRadius: 4, padding: "1px 6px" }}>
                                      確度: {confidenceLabel(c.confidence)}
                                    </span>
                                    {c.tag && <span style={{ fontSize: 11, color: "#6b7280", background: "#f1f5f9", borderRadius: 4, padding: "1px 6px" }}>{`<${c.tag}>`}</span>}
                                    {c.text && <span style={{ fontSize: 11, color: "#374151" }}>「{c.text}」</span>}
                                    {c.placeholder && <span style={{ fontSize: 11, color: "#9ca3af" }}>placeholder: {c.placeholder}</span>}
                                  </div>
                                  <div style={{ fontFamily: "monospace", fontSize: 12, color: "#1e293b", wordBreak: "break-all", marginBottom: 4 }}>{val}</div>
                                  {c.description && <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>{c.description}</div>}
                                  <div style={{ display: "flex", gap: 6 }}>
                                    <button onClick={() => doConfirm(val)} disabled={dialogSaving}
                                      style={{ padding: "5px 14px", borderRadius: 6, border: "none", background: dialogSaving ? "#e2e8f0" : "#1a6fa8", color: dialogSaving ? "#94a3b8" : "#fff", fontWeight: 700, cursor: dialogSaving ? "default" : "pointer", fontSize: 12 }}>
                                      これで正しい ✅
                                    </button>
                                    <button onClick={() => doPreview(i, val)} disabled={dialogSaving}
                                      style={{ padding: "5px 12px", borderRadius: 6, border: `1px solid ${isPreviewing ? "#1a6fa8" : "#e2e8f0"}`, background: isPreviewing ? "#eff6ff" : "#fff", color: "#374151", cursor: dialogSaving ? "default" : "pointer", fontSize: 12 }}>
                                      {isPreviewing && dialogPreviewImg === null ? "読込中..." : isPreviewing ? "▲ 閉じる" : "🔍 確認"}
                                    </button>
                                  </div>
                                </div>
                                {isPreviewing && dialogPreviewImg && (
                                  <div style={{ borderTop: "1px solid #e2e8f0", padding: 8, background: "#f8fafc" }}>
                                    <img src={`data:image/jpeg;base64,${dialogPreviewImg}`}
                                      alt="element preview"
                                      style={{ width: "100%", borderRadius: 6, display: "block" }} />
                                  </div>
                                )}
                              </div>
                            );
                          }
                        })}
                      </div>
                    </div>
                  )}

                  {/* プレビューエラー */}
                  {dialogPreviewError && (
                    <div style={{ fontSize: 12, color: "#b45309", background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 8, padding: "8px 12px", marginBottom: 12 }}>
                      {dialogPreviewError}
                    </div>
                  )}

                  {/* 手入力フィールド */}
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600, marginBottom: 6 }}>✏️ 手動入力 {step.candidates?.length ? "（候補にない場合）" : ""}</div>
                    <input
                      type="text"
                      value={dialogCustomVal}
                      onChange={e => setDialogCustomVal(e.target.value)}
                      placeholder={step.type === "url" ? "https://..." : "CSS セレクター"}
                      onKeyDown={e => { if (e.key === "Enter" && dialogCustomVal.trim()) doConfirm(dialogCustomVal); }}
                      style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, fontFamily: step.type === "selector" ? "monospace" : "inherit", outline: "none" }}
                    />
                  </div>

                  {/* アクションボタン */}
                  <div style={{ display: "flex", gap: 10 }}>
                    <button
                      onClick={() => { if (dialogCustomVal.trim() && !dialogSaving) doConfirm(dialogCustomVal); }}
                      disabled={!dialogCustomVal.trim() || dialogSaving}
                      style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "none", background: (dialogCustomVal.trim() && !dialogSaving) ? "#1a6fa8" : "#e2e8f0", color: (dialogCustomVal.trim() && !dialogSaving) ? "#fff" : "#94a3b8", fontWeight: 700, cursor: (dialogCustomVal.trim() && !dialogSaving) ? "pointer" : "default", fontSize: 13 }}>
                      {dialogSaving ? "保存中..." : "これで正しい ✅"}
                    </button>
                    {step.optional && (
                      <button onClick={doSkip} disabled={dialogSaving}
                        style={{ padding: "10px 18px", borderRadius: 10, border: "1px solid #e2e8f0", background: "#fff", color: "#64748b", fontWeight: 600, cursor: dialogSaving ? "default" : "pointer", opacity: dialogSaving ? 0.5 : 1, fontSize: 13 }}>
                        スキップ
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}

          </div>
        </div>
      )}

    </div>
  );
}
