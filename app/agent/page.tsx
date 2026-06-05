"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  getStoredUser, listAgentTasks, approveAgentTask, executeAgentTask, createAgentTask, planAgentTask, listAgentLogs,
  listMediaMappings, createMediaMapping, deleteMediaMapping, loginCheckMediaMapping, saveMediaCredential, updateMediaSelectors, applySelectorRepair, applyCapabilities, updateCapabilities, recomputeLearningHealth, applySemanticSelector, recomputeSelectorRanking, deepScanOperation, multiDeepScan,
  listAgentSchedules, createAgentSchedule, updateAgentSchedule,
  listAgentOps,
  AgentTask, AgentLog, MediaMapping, AgentSchedule, AgentOp,
  WorkflowSession, approveWorkflowSession, rejectWorkflowSession, pauseWorkflowSession, resumeWorkflowSession, cancelWorkflowSession, getWorkflowSession, listWorkflowSessions, createWorkflowSession, scanMediaDom,
} from "@/lib/api";

type PayloadField = {
  key: string;
  label: string;
  type: "text" | "textarea" | "select" | "file" | "datetime" | "number" | "boolean";
  required: boolean;
  options?: string[];
};
type OpWithSchema = AgentOp;

const INDUSTRY_TEMPLATES_UI: Record<string, {label: string; entity: string; schedule: string; news: string; media: string}> = {
  nightlife:  { label: "夜職・風俗",                  entity: "キャスト",     schedule: "出勤",         news: "ニュース",     media: "写真" },
  beauty:     { label: "美容・エステ",                 entity: "スタッフ",     schedule: "予約枠",       news: "キャンペーン", media: "スタッフ写真" },
  retail:     { label: "小売・EC",                     entity: "商品",         schedule: "営業時間",     news: "お知らせ",     media: "商品写真" },
  realestate: { label: "不動産",                       entity: "物件",         schedule: "空室状況",     news: "新着物件",     media: "物件写真" },
  btob:       { label: "BtoB・士業",                   entity: "サービス",     schedule: "セミナー",     news: "ニュース",     media: "資料" },
  other:      { label: "その他",                       entity: "エンティティ", schedule: "スケジュール", news: "お知らせ",     media: "メディア" },
};


const ABSTRACT_TASK_OPTIONS = [
  "Entity登録", "情報更新", "画像・資料差し替え", "スケジュール更新",
  "料金更新", "ニュース投稿", "ステータス更新", "更新監査", "差分検知",
];
const INDUSTRY_TASK_OPTIONS: Record<string, string[]> = {
  nightlife:  ABSTRACT_TASK_OPTIONS,
  beauty:     ABSTRACT_TASK_OPTIONS,
  realestate: ABSTRACT_TASK_OPTIONS,
  retail:     ABSTRACT_TASK_OPTIONS,
  btob:       ABSTRACT_TASK_OPTIONS,
  other:      ABSTRACT_TASK_OPTIONS,
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: "承認待ち", APPROVED: "実行待ち", RUNNING: "実行中",
  DONE: "完了", REJECTED: "却下", FAILED: "失敗",
  WAITING_MAPPING: "サイト接続が必要", WAITING_EXECUTOR: "この操作はまだ自動実行に未対応です", BLOCKED: "情報不足",
};
const STATUS_COLOR: Record<string, string> = {
  PENDING: "#b87d00", APPROVED: "#1a6fa8", RUNNING: "#7c3aed",
  DONE: "#15803d", REJECTED: "#6b7280", FAILED: "#b91c1c",
  WAITING_MAPPING: "#c2410c", WAITING_EXECUTOR: "#7c3aed", BLOCKED: "#b91c1c",
};
const OP_LABEL: Record<string, string> = {
  entity_register: "情報登録", entity_update: "情報更新", media_replace: "画像・資料差し替え",
  text_update: "テキスト更新", schedule_update: "予定更新", price_update: "料金更新",
  news_post: "ニュース投稿", status_update: "ステータス更新",
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
  if (msg.includes("mapping")) return "サイト接続設定が見つかりません";
  return msg;
}

type ErrorDetail = { error_type: string; message: string; action: string };

function parseErrorDetail(msg: string): ErrorDetail {
  if (!msg) return { error_type: "UNKNOWN", message: "不明なエラーが発生しました", action: "管理者にお問い合わせください" };
  if (msg.includes("credential_secret_name") || msg.includes("credential未設定"))
    return { error_type: "CREDENTIAL_MISSING", message: "credential_secret_nameが未設定です", action: "① 媒体マッピング → ログイン情報登録で設定してください" };
  if (msg.includes("PLAYWRIGHT_ENABLED") || msg.includes("playwright"))
    return { error_type: "PLAYWRIGHT_DISABLED", message: "PLAYWRIGHT_ENABLEDがfalseです", action: "管理者にブラウザ実行の有効化を依頼してください" };
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
    return { error_type: "MAPPING_NOT_FOUND", message: "サイト接続設定が見つかりません", action: "① 媒体マッピングでサイトを再登録してください" };
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


type Tab = "sites" | "create" | "tasks" | "schedule" | "logs" | "health";

export default function AgentPage() {
  const router = useRouter();
  const WAITING_EXECUTOR_OPS = ["interview_support", "update_audit", "post_monitoring"];
  const SUPPORTED_OPS = ["text_update", "news_post", "status_update", "media_replace", "schedule_update", "price_update", "entity_register", "entity_update"];
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

  const fetchWfSessions = async () => {
    setWfLoading(true);
    try {
      const r = await listWorkflowSessions();
      setWfSessions(r.sessions || []);
    } catch { setWfSessions([]); } finally { setWfLoading(false); }
  };
  const [mounted, setMounted] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>("sites");
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [mappings, setMappings] = useState<MediaMapping[]>([]);
  const [schedules, setSchedules] = useState<AgentSchedule[]>([]);
  const [ops, setOps] = useState<OpWithSchema[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [selectedTask, setSelectedTask] = useState<AgentTask | null>(null);
  const [loginCheckResults, setLoginCheckResults] = useState<Record<string, {login_success: boolean; message: string}>>({});
  const [domScanResults, setDomScanResults] = useState<Record<string, Record<string, unknown>>>({});
  const [domScanLoading, setDomScanLoading] = useState<Record<string, boolean>>({});
  const [repairSelections, setRepairSelections] = useState<Record<string, Record<string, string | undefined>>>({});
  const [domScanMaxPages, setDomScanMaxPages] = useState<Record<string, number>>({});
  const [domScanStartUrl, setDomScanStartUrl] = useState<Record<string,string>>({});
  const [domScanInclude, setDomScanInclude] = useState<Record<string,string>>({});
  const [domScanExclude, setDomScanExclude] = useState<Record<string,string>>({});
  const [capabilitySelections, setCapabilitySelections] = useState<Record<string, Record<string, boolean>>>({});
  const [semanticSelectorSelections, setSemanticSelectorSelections] = useState<Record<string, Record<string, boolean>>>({});
  const [deepScanLoading, setDeepScanLoading] = useState<Record<string, boolean>>({});
  const [deepScanResults, setDeepScanResults] = useState<Record<string, Record<string, unknown>>>({});
  const [hintUrls, setHintUrls] = useState<Record<string, string>>({});

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
  const [creating, setCreating] = useState(false);

  // 自然言語プラン
  const [planInput, setPlanInput] = useState("");
  const [planResult, setPlanResult] = useState<null | {ready: boolean; media_name?: string; op_id?: string; operation_type?: string; payload?: Record<string,unknown>; preview?: string; question?: string}>(null);
  const [planLoading, setPlanLoading] = useState(false);

  // スケジュール
  const [scheduleOpId, setScheduleOpId] = useState("");
  const [scheduleHour, setScheduleHour] = useState("9");
  const [scheduleMin, setScheduleMin] = useState("0");
  const [scheduleDow, setScheduleDow] = useState("*");

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
      const [td, ld, md, sd, od] = await Promise.allSettled([
        listAgentTasks(), listAgentLogs(), listMediaMappings(),
        listAgentSchedules(), listAgentOps(),
      ]);
      if (td.status === "fulfilled") setTasks(td.value.tasks);
      if (ld.status === "fulfilled") setLogs(ld.value.logs);
      if (md.status === "fulfilled") setMappings(md.value.mappings);
      if (sd.status === "fulfilled") setSchedules(sd.value.schedules);
      // 失敗項目をmsgに表示
      const failedNames: string[] = [];
      if (td.status === "rejected") failedNames.push("タスク");
      if (ld.status === "rejected") failedNames.push("履歴");
      if (md.status === "rejected") failedNames.push("媒体設定");
      if (sd.status === "rejected") failedNames.push("スケジュール");
      if (od.status === "rejected") failedNames.push("自動化一覧");
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

  async function handleExecute(task_id: string) {
    try {
      await executeAgentTask(task_id);
      setMsg("実行しました");
      const d = await listAgentTasks();
      setTasks(d.tasks);
    } catch (e: unknown) { setMsg((e as Error).message); }
  }

  async function handleApprove(task_id: string) {
    try {
      await approveAgentTask(task_id);
      setMsg("承認しました");
      const d = await listAgentTasks();
      setTasks(d.tasks);
    } catch (e: unknown) { setMsg((e as Error).message); }
  }

  function fallbackParse(input: string): { ready: boolean; operation_type: string; preview: string; question?: string } {
    const t = input.toLowerCase();
    if (/投稿数|投稿頻度|写メ日記|日記|未投稿|監視|sns/.test(t))
      return { ready: false, operation_type: "post_monitoring", preview: "", question: "投稿数監視（post_monitoring）は実行層が未対応です。タスク構造・承認・ログ確認は可能ですが、実媒体操作は現在未対応です。" };
    if (/写真|画像|差し替え|media/.test(t))
      return { ready: true, operation_type: "media_replace", preview: "Media差し替えタスクを作成します（推定）。" };
    if (/出勤|予定|スケジュール|schedule/.test(t))
      return { ready: true, operation_type: "schedule_update", preview: "スケジュール更新タスクを作成します（推定）。" };
    if (/ニュース|お知らせ|投稿|news/.test(t))
      return { ready: true, operation_type: "news_post", preview: "ニュース投稿タスクを作成します（推定）。" };
    if (/面接|応募|ヒアリング|interview/.test(t))
      return { ready: false, operation_type: "interview_support", preview: "", question: "面接ヒアリング補佐（interview_support）は実行層が未対応です。タスク構造・承認・ログ確認は可能ですが、実媒体操作は現在未対応です。" };
    if (/テキスト|文章|説明|更新|text/.test(t))
      return { ready: true, operation_type: "text_update", preview: "テキスト更新タスクを作成します（推定）。" };
    if (/料金|価格|price/.test(t))
      return { ready: true, operation_type: "price_update", preview: "料金更新タスクを作成します（推定）。" };
    if (/ステータス|status|状態/.test(t))
      return { ready: true, operation_type: "status_update", preview: "ステータス更新タスクを作成します（推定）。" };
    if (/登録|追加|entity/.test(t))
      return { ready: true, operation_type: "entity_register", preview: "Entity登録タスクを作成します（推定）。" };
    if (/更新|変更|修正/.test(t))
      return { ready: true, operation_type: "entity_update", preview: "Entity更新タスクを作成します（推定）。" };
    if (/監査|チェック|差分|未更新/.test(t))
      return { ready: false, operation_type: "update_audit", preview: "", question: "更新監査（update_audit）は実行層が未対応です。タスク構造・承認・ログ確認は可能ですが、実媒体操作は現在未対応です。" };
    return { ready: false, operation_type: "BLOCKED", preview: "", question: "指示内容を特定できませんでした。操作の種類（例：投稿監視・画像差し替え・スケジュール更新）を含めて再入力してください。" };
  }

  async function handlePlan() {
    if (!planInput.trim()) { setMsg("指示を入力してください"); return; }
    setPlanLoading(true);
    setPlanResult(null);
    try {
      const r = await planAgentTask({ instruction: planInput });
      setPlanResult(r);
    } catch {
      const fb = fallbackParse(planInput);
      setPlanResult({ ...fb, ok: true } as typeof planResult extends null ? never : NonNullable<typeof planResult>);
      if (!fb.ready) setMsg("AI解析失敗。入力内容から推定できませんでした。操作の種類を含めて再入力してください。");
    } finally { setPlanLoading(false); }
  }

  async function handlePlanCreate() {
    if (!planResult || !planResult.ready) return;
    if (!selectedMedia) { setMsg("先に操作対象の媒体を選択してください。"); return; }
    if (!selectedMedia.credential_secret_name) { setMsg("ログイン情報未登録です。① 媒体マッピングでID/PASSを登録してください。"); return; }
    if (!selectedMedia.last_verified_at) { setMsg("接続確認未完了です。① 媒体マッピングで接続確認を完了してください。"); return; }
    try {
      await createAgentTask({
        agent_type: "hp_update",
        operation_type: planResult.operation_type || "",
        industry: selectedMedia.industry || "generic",
        op_id: planResult.op_id || "",
        media_mapping_id: selectedMedia.mapping_id,
        payload: {
          ...(planResult.payload || {}),
          media_mapping_id: selectedMedia.mapping_id,
          media_name: selectedMedia.media_name,
        },
      });
      setMsg("自動化を追加しました");
      setPlanInput("");
      setPlanResult(null);
      const d = await listAgentTasks();
      setTasks(d.tasks);
      setTab("tasks");
    } catch (e: unknown) { setMsg((e as Error).message); }
  }

  async function handleCreate() {
    if (!selectedMedia) { setMsg("先に操作対象の媒体を選択してください。"); return; }
    if (!selectedMedia.credential_secret_name) { setMsg("ログイン情報未登録です。① 媒体マッピングでID/PASSを登録してください。"); return; }
    if (!selectedMedia.last_verified_at) { setMsg("接続確認未完了です。① 媒体マッピングで接続確認を完了してください。"); return; }
    const selectedOp = ops.find(o => o.op_id === selectedOpId);
    if (!selectedOp) { setMsg("自動化内容を選択してください"); return; }
    if (selectedOp.active === false) { setMsg("このOperationは現在利用できません"); return; }
    const fields = selectedOp.payload_schema?.fields || [];
    for (const f of fields) {
      if (f.required && !formValues[f.key]) {
        setMsg(`「${f.label}」を入力してください`);
        return;
      }
    }
    setCreating(true);
    try {
      await createAgentTask({
        agent_type: selectedOp.category || "hp_update",
        operation_type: selectedOp.operation_type || "",
        industry: selectedMedia.industry || "generic",
        entity_type: selectedOp.entity_type || "",
        op_id: selectedOp.op_id || "",
        media_mapping_id: selectedMedia.mapping_id,
        payload: {
          ...formValues,
          media_mapping_id: selectedMedia.mapping_id,
          media_name: selectedMedia.media_name,
        },
      });
      setMsg("自動化を追加しました");
      setFormValues({});
      setSelectedOpId("");
      const d = await listAgentTasks();
      setTasks(d.tasks);
      setTab("tasks");
    } catch (e: unknown) { setMsg((e as Error).message); }
    finally { setCreating(false); }
  }

  // ウィザードSTEP3: 接続テスト
  async function handleWizardTest() {
    if (!createdMappingId) return;
    // selector未設定チェック
    if (!selectorUsername || !selectorPassword || !selectorSubmit) {
      setWizardTestResult({ ok: false, msg: "ログインフォーム設定が未登録です。下のフォームを入力してください" });
      return;
    }
    setWizardConnecting(true);
    setWizardTestResult(null);
    try {
      // selector保存
      await updateMediaSelectors(
        createdMappingId,
        { username: selectorUsername, password: selectorPassword, login_submit: selectorSubmit },
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
      const newId = (r as Record<string,string>).mapping_id || "";
      if (!newId) { setMsg("サイト接続の作成に失敗しました。もう一度お試しください"); return; }
      // listMediaMappings で存在確認
      const latest = await listMediaMappings();
      const exists = latest.mappings.some(m => m.mapping_id === newId);
      if (!exists) {
        setMsg("サイト接続の作成確認に失敗しました。もう一度お試しください");
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
    setSiteLoginId(""); setSiteLoginPass(""); setWizardTestResult(null); setCreatedMappingId("");
    setSelectorUsername(""); setSelectorPassword(""); setSelectorSubmit(""); setSelectorVerify("");
  }

  // 長期未実行チェック（7日以上実行なし）
  const longInactiveSites = mappings.filter(m => {
    if (!m.last_verified_at) return true;
    const diff = Date.now() - new Date(m.last_verified_at).getTime();
    return diff > 7 * 24 * 60 * 60 * 1000;
  });

  const totalSites = mappings.length;
  const activeSites = mappings.filter(m => m.last_verified_at).length;
  const errorSites = mappings.filter(m => !m.credential_secret_name).length + logs.filter(l => !l.success).length;
  const todayLogs = logs.filter(l => {
    if (!l.executed_at) return false;
    return new Date(l.executed_at).toDateString() === new Date().toDateString();
  }).length;

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
    <div style={{ minHeight: "100vh", background: "#f8f7ff", fontFamily: "system-ui, sans-serif" }}>

      {/* ── トップバー ── */}
      <div style={{ background: "linear-gradient(135deg,#7c3aed,#4f46e5)", padding: "0 24px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 2px 12px rgba(124,58,237,0.3)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => router.back()} style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 6, cursor: "pointer", color: "#fff", padding: "4px 10px", fontSize: 13 }}>←</button>
          <span style={{ fontWeight: 800, fontSize: 16, color: "#fff", letterSpacing: -0.3 }}>ASCEND Agent OS</span><button onClick={() => setSidebarOpen(o => !o)} style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 6, cursor: "pointer", color: "#fff", padding: "4px 10px", fontSize: 13 }}>{sidebarOpen ? "◀" : "▶"}</button>
          <span style={{ fontSize: 10, background: "rgba(255,255,255,0.2)", color: "#fff", borderRadius: 4, padding: "2px 7px", fontWeight: 700 }}>BETA</span>
        </div>
        <button onClick={() => { const ready = mappings.some(m => m.credential_secret_name && m.last_verified_at); if (!ready) { setMsg("まずサイト接続を完了してください"); setTab("sites"); return; } setTab("create"); }}
          style={{ background: "#fff", border: "none", borderRadius: 8, cursor: "pointer", color: "#7c3aed", fontWeight: 700, fontSize: 13, padding: "7px 16px" }}>
          ＋ 新しい自動化
        </button>
      </div>

      <div style={{ display: "flex", minHeight: "calc(100vh - 56px)" }}>

        {/* ── サイドナビ ── */}
        <div style={{ width: sidebarOpen ? 200 : 0, background: "#fff", borderRight: sidebarOpen ? "1px solid #e9d5ff" : "none", padding: sidebarOpen ? "20px 0" : 0, flexShrink: 0, display: "flex", flexDirection: "column", gap: 2, overflow: "hidden", transition: "width 0.2s" }}>
          {([
            { key: "sites",    icon: "🌐", label: "媒体マッピング",  sub: `${mappings.length}件` },
            { key: "create",   icon: "➕", label: "タスク作成",      sub: "" },
            { key: "tasks",    icon: "📋", label: "タスク一覧",      sub: `${tasks.length}件` },
            { key: "schedule", icon: "📅", label: "スケジュール",    sub: `${schedules.length}件` },
            { key: "logs",     icon: "📜", label: "実行ログ",        sub: `${logs.length}件` },
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

          {/* 統計 */}
          <div style={{ margin: "20px 12px 0", padding: "14px", background: "#f5f3ff", borderRadius: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#7c3aed", marginBottom: 10, letterSpacing: 0.5 }}>STATUS</div>
            {[
              { label: "接続済み", value: activeSites, color: "#15803d" },
              { label: "要確認",   value: errorSites,  color: errorSites > 0 ? "#dc2626" : "#9ca3af" },
              { label: "本日実行", value: todayLogs,   color: "#1a6fa8" },
            ].map(s => (
              <div key={s.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: "#6b7280" }}>{s.label}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: s.color }}>{s.value}</span>
              </div>
            ))}
          </div>
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
              {{ sites: "🌐 媒体マッピング", create: "➕ タスク作成", tasks: "📋 タスク一覧", schedule: "📅 スケジュール", logs: "📜 実行ログ", health: "⚠️ 異常確認" }[tab]}
            </h2>
            <p style={{ fontSize: 12, color: "#6b7280", margin: "4px 0 0" }}>
              {{ sites: "自動化するサイトの接続・解析・操作候補を管理します", create: "登録済み媒体を選択してタスクを作成します", tasks: "承認待ち・実行待ちのタスクを管理します", schedule: "定期実行するタスクを予約します", logs: "実行履歴と結果を確認します", health: "エラー・未設定・異常を確認します" }[tab]}
            </p>
          </div>

          {/* ─────────── SECTION: 媒体マッピング ─────────── */}
          {tab === "sites" && (
            <div>
              {/* 新規登録ボタン */}
              <div style={{ marginBottom: 16 }}>
                <button onClick={() => setShowWizard(prev => !prev)}
                  style={{ padding: "9px 20px", borderRadius: 8, border: "1px solid #7c3aed", background: showWizard ? "#ede9fe" : "#fff", color: "#7c3aed", cursor: "pointer", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                  {showWizard ? "▲ 閉じる" : "＋ 新規サイトを登録"}
                </button>
              </div>

              {/* ウィザード */}
              {showWizard && (
                <div style={{ background: "#fff", border: "2px solid #7c3aed", borderRadius: 12, padding: 24, marginBottom: 24 }}>
                  {/* ステップインジケーター */}
                  <div style={{ display: "flex", alignItems: "center", marginBottom: 24 }}>
                    {[1,2,3,4].map((s, i) => (
                      <div key={s} style={{ display: "flex", alignItems: "center", flex: i < 3 ? 1 : "none" }}>
                        <div style={{ width: 32, height: 32, borderRadius: "50%", background: wizardStep >= s ? "#7c3aed" : "#f3f4f6", color: wizardStep >= s ? "#fff" : "#9ca3af", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                          {wizardStep > s ? "✓" : s}
                        </div>
                        <div style={{ fontSize: 11, color: wizardStep >= s ? "#7c3aed" : "#9ca3af", marginLeft: 6, whiteSpace: "nowrap", fontWeight: wizardStep === s ? 700 : 400 }}>
                          {["サイト登録","認証登録","ログイン設定","完了"][s-1]}
                        </div>
                        {i < 3 && <div style={{ flex: 1, height: 2, background: wizardStep > s ? "#7c3aed" : "#e5e7eb", margin: "0 10px" }} />}
                      </div>
                    ))}
                  </div>

                  {wizardStep === 1 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#1e1b4b", marginBottom: 4 }}>自動化するサイトの情報を入力してください</div>
                      <select value={siteIndustry} onChange={e => setSiteIndustry(e.target.value)}
                        style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14, color: "#111827" }}>
                        {Object.entries(INDUSTRY_TEMPLATES_UI).map(([key, val]) => <option key={key} value={key}>{val.label}</option>)}
                      </select>
                      {siteIndustry !== "other" && (
                        <div style={{ fontSize: 12, color: "#6b7280", background: "#f9fafb", borderRadius: 6, padding: "8px 12px" }}>
                          {`${INDUSTRY_TEMPLATES_UI[siteIndustry]?.entity}・${INDUSTRY_TEMPLATES_UI[siteIndustry]?.schedule}・${INDUSTRY_TEMPLATES_UI[siteIndustry]?.news}・${INDUSTRY_TEMPLATES_UI[siteIndustry]?.media} などを自動化できます`}
                        </div>
                      )}
                      <input value={siteName} onChange={e => setSiteName(e.target.value)} placeholder="サイト名（例：体入ドラフト）"
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
                            if (!exists) { setMsg("サイト接続情報が見つかりません。STEP1からやり直してください"); setCreatedMappingId(""); setWizardStep(1); return; }
                            await saveMediaCredential(createdMappingId, siteLoginId, siteLoginPass);
                            setSiteLoginId(""); setSiteLoginPass("");
                            await fetchAll();
                            setWizardStep(3); setMsg("");
                          } catch (e: unknown) {
                            const err = e as Error;
                            if (err.message?.includes("404")) { setMsg("サイト接続情報が見つかりません。STEP1からやり直してください"); setCreatedMappingId(""); setWizardStep(1); }
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
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#1e1b4b" }}>接続テストを実行してください</div>
                      {!mappings.find(m => m.mapping_id === createdMappingId)?.credential_secret_name && (
                        <div style={{ fontSize: 12, padding: "8px 12px", borderRadius: 8, background: "#fef2f2", border: "1px solid #fca5a5", color: "#b91c1c" }}>⚠️ ログイン情報が未登録です。STEP2に戻ってください。</div>
                      )}
                      <div style={{ background: "#f9fafb", borderRadius: 8, padding: "14px" }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#1e1b4b", marginBottom: 10 }}>ログイン設定状況</div>
                        {[
                          { label: "ID入力欄", val: selectorUsername },
                          { label: "パスワード欄", val: selectorPassword },
                          { label: "ログインボタン", val: selectorSubmit },
                          { label: "ログイン後の目印（任意）", val: selectorVerify, optional: true },
                        ].map(f => (
                          <div key={f.label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, marginBottom: 6 }}>
                            <span style={{ color: f.val ? "#15803d" : (f as {optional?:boolean}).optional ? "#9ca3af" : "#b91c1c", fontWeight: 700 }}>{f.val ? "✅" : (f as {optional?:boolean}).optional ? "－" : "❌"}</span>
                            <span style={{ color: "#374151", minWidth: 140 }}>{f.label}</span>
                            <span style={{ color: f.val ? "#15803d" : "#9ca3af", fontSize: 11 }}>{f.val ? "検出済み" : (f as {optional?:boolean}).optional ? "任意" : "未検出"}</span>
                          </div>
                        ))}
                      </div>
                      <details style={{ background: "#f9fafb", borderRadius: 8, padding: "10px 14px" }}>
                        <summary style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", cursor: "pointer" }}>🔧 手動修正（上級者向け）</summary>
                        <div style={{ marginTop: 10 }}>
                          {[
                            { label: "ID入力欄", val: selectorUsername, set: setSelectorUsername },
                            { label: "パスワード欄", val: selectorPassword, set: setSelectorPassword },
                            { label: "ログインボタン", val: selectorSubmit, set: setSelectorSubmit },
                            { label: "ログイン後の目印（任意）", val: selectorVerify, set: setSelectorVerify },
                          ].map(f => (
                            <div key={f.label} style={{ marginBottom: 8 }}>
                              <label style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 2 }}>{f.label}</label>
                              <input value={f.val} onChange={e => { const v = e.target.value; if (v.includes('name=""')) return; f.set(v); }}
                                style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 12, fontFamily: "monospace", boxSizing: "border-box" }} />
                            </div>
                          ))}
                        </div>
                      </details>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => setWizardStep(2)} style={{ padding: "10px 18px", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", color: "#6b7280", cursor: "pointer", fontSize: 14 }}>← 戻る</button>
                        <button onClick={handleWizardTest} disabled={wizardConnecting}
                          style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: wizardConnecting ? "#9ca3af" : "#1a6fa8", color: "#fff", fontWeight: 700, cursor: wizardConnecting ? "not-allowed" : "pointer", fontSize: 14 }}>
                          {wizardConnecting ? "確認中..." : "🔍 接続テスト"}
                        </button>
                        <button onClick={() => { setWizardStep(4); fetchAll(); }}
                          style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: "#15803d", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
                          {wizardTestResult?.ok ? "接続して自動化開始 →" : "スキップして保存"}
                        </button>
                      </div>
                    </div>
                  )}

                  {wizardStep === 4 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "center", padding: "20px 0" }}>
                      <div style={{ fontSize: 48 }}>🎉</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: "#1e1b4b" }}>「{siteName}」の接続が完了しました</div>
                      <div style={{ fontSize: 13, color: "#6b7280" }}>次は「タスク作成」から自動化内容を設定してください。</div>
                      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                        <button onClick={resetWizard} style={{ padding: "9px 18px", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", color: "#6b7280", cursor: "pointer", fontSize: 13 }}>別のサイトを追加</button>
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
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#374151", marginBottom: 6 }}>まだサイト接続がありません</div>
                  <div style={{ fontSize: 12 }}>上のボタンから最初のサイトを登録してください</div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {mappings.map(m => {
                    const hasCredential = !!m.credential_secret_name;
                    const isVerified = !!m.last_verified_at;
                    const checkResult = loginCheckResults[m.mapping_id];
                    const connStatus = (m.login_health === "HEALTHY") ? "ok" : checkResult ? (checkResult.login_success ? "ok" : "error") : (isVerified ? "ok" : hasCredential ? "warn" : "error");
                    const isConfigError = checkResult && !checkResult.login_success && (checkResult.message.includes("セレクター") || checkResult.message.includes("不足") || checkResult.message.includes("ログインフォーム設定"));
                    const statusInfo = {
                      ok:    { label: "🟢 正常",         color: "#15803d", bg: "#f0fdf4", border: "#bbf7d0" },
                      warn:  { label: "🟡 要確認",       color: "#b87d00", bg: "#fffbeb", border: "#fde68a" },
                      error: { label: isConfigError ? "🔴 設定未完了" : "🔴 ログイン失敗", color: "#b91c1c", bg: "#fef2f2", border: "#fca5a5" },
                    }[connStatus];
                    return (
                      <div key={m.mapping_id} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "18px 20px", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
                        {/* サイトヘッダー */}
                        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12, gap: 12 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: 15, color: "#1e1b4b" }}>{m.media_name}</div>
                            <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2, wordBreak: "break-all" }}>{m.media_url}</div>
                            {m.industry && m.industry !== "other" && <span style={{ display: "inline-block", marginTop: 4, fontSize: 11, color: "#7c3aed", background: "#f5f3ff", borderRadius: 4, padding: "1px 7px" }}>{INDUSTRY_TEMPLATES_UI[m.industry]?.label}</span>}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: statusInfo.color, background: statusInfo.bg, border: `1px solid ${statusInfo.border}`, borderRadius: 6, padding: "3px 10px" }}>{statusInfo.label}</span>
                            <button onClick={async () => { if (!confirm(`「${m.media_name}」を削除しますか？`)) return; try { await deleteMediaMapping(m.mapping_id); fetchAll(); } catch(e: unknown){ setMsg((e as Error).message); }}}
                              style={{ padding: "3px 10px", borderRadius: 6, border: "1px solid #fca5a5", background: "#fff", color: "#b91c1c", cursor: "pointer", fontSize: 11 }}>削除</button>
                          </div>
                        </div>

                        {m.last_verified_at && <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 10 }}>最終確認: {new Date(m.last_verified_at).toLocaleString("ja-JP")}</div>}

                        {/* ログイン情報未設定 */}
                        {!hasCredential && (
                          <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: "12px 16px", marginBottom: 12 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: "#b91c1c", marginBottom: 8 }}>⚠️ ログイン情報が未設定です</div>
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

                        {checkResult && (
                          checkResult.login_success
                            ? <div style={{ fontSize: 12, padding: "6px 12px", borderRadius: 6, marginBottom: 10, background: "#f0fdf4", color: "#15803d", border: "1px solid #bbf7d0" }}>✅ 接続確認に成功しました</div>
                            : m.login_health === "HEALTHY" ? null : <ErrorCard msg={checkResult.message} />
                        )}

                        {/* アクションボタン */}
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                          <button onClick={async () => {
                            try { setMsg("接続確認中..."); const r = await loginCheckMediaMapping(m.mapping_id); setLoginCheckResults(prev => ({ ...prev, [m.mapping_id]: { login_success: r.login_success, message: r.message } })); setMsg(""); }
                            catch (e: unknown) { const raw = (e as Error).message || "接続確認に失敗しました"; setLoginCheckResults(prev => ({ ...prev, [m.mapping_id]: { login_success: false, message: raw } })); setMsg(translateError(raw)); }
                          }} style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid #7c3aed", background: "#fff", color: "#7c3aed", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                            🔍 接続確認
                          </button>
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
                          {/* crawl_state表示（修正11） */}
                          {(() => { const cs = ((m as unknown) as Record<string,unknown>).crawl_state as Record<string,unknown> | undefined; if (!cs) return null; return (
                            <div style={{ padding: "8px 12px", borderRadius: 8, background: cs.status === "PAUSED_TIMEOUT" ? "#fef3c7" : cs.status === "DONE" ? "#f0fdf4" : "#f9fafb", border: `1px solid ${cs.status === "PAUSED_TIMEOUT" ? "#f59e0b" : cs.status === "DONE" ? "#86efac" : "#e5e7eb"}`, fontSize: 12, marginBottom: 4 }}>
                              <div style={{ fontWeight: 600, marginBottom: 2 }}>{cs.status === "PAUSED_TIMEOUT" ? "🟡 巡回が途中で停止中" : cs.status === "DONE" ? "✅ 巡回完了" : cs.status === "RUNNING" ? "🔵 巡回中" : `巡回状態: ${cs.status}`}</div>
                              <div>巡回済み: {String(cs.pages_crawled ?? 0)} ページ　残り: {String(cs.resume_queue_count ?? cs.remaining_count ?? 0)} URL</div>
                              {cs.last_url ? <div style={{ color: "#6b7280", wordBreak: "break-all" }}>停止位置: {String(cs.last_url)}</div> : null}
                              {cs.start_url ? <div style={{ color: "#6b7280" }}>開始URL: {String(cs.start_url)}</div> : null}
                              {(cs.include_patterns as string[] | undefined)?.length ? <div style={{ color: "#6b7280" }}>含む: {(cs.include_patterns as string[]).join(", ")}</div> : null}
                              {(cs.exclude_patterns as string[] | undefined)?.length ? <div style={{ color: "#6b7280" }}>除く: {(cs.exclude_patterns as string[]).join(", ")}</div> : null}
                            </div>
                          ); })()}
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
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
                          <button onClick={async () => {
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
                          </button>
                          </div>
                        </div>

                        {domScanLoading[m.mapping_id] && (
                          <div style={{ padding: "10px 14px", borderRadius: 8, background: "#eff6ff", border: "1px solid #bfdbfe", fontSize: 12, color: "#1d4ed8", marginBottom: 10 }}>
                            ⏳ 解析中です。ログインフォーム・入力欄・ボタンを確認しています。
                          </div>
                        )}

                        {/* 解析状況 */}
                        {(() => {
                          const mx = m as unknown as Record<string, unknown>;
                          const stats = mx.analysis_stats as Record<string, unknown> | undefined;
                          const navGraph   = mx.navigation_graph as Record<string, unknown> | undefined;
                          const _opCandRaw2 = mx.operation_candidates as string[] | undefined;
                          const _opMapsRaw2 = (mx.operation_mappings as Record<string, {status?: string}> | undefined) || {};
                          const _opMapKeys2 = Object.keys(_opMapsRaw2).filter(op => ["READY","PARTIAL"].includes(_opMapsRaw2[op]?.status || ""));
                          const _opStepsRaw2 = (mx.operation_steps_by_type as Record<string, unknown[]> | undefined) || {};
                          const _opStepKeys2 = Object.keys(_opStepsRaw2).filter(op => Array.isArray(_opStepsRaw2[op]) && (_opStepsRaw2[op] as unknown[]).length > 0);
                          const opCands2 = Array.from(new Set([...(_opCandRaw2 || []), ..._opMapKeys2, ..._opStepKeys2])).filter(op => op !== "admin_crawl");
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
                          const partialMappedCount = opCands2 ? opCands2.filter(op => opMaps?.[op]?.status === "PARTIAL" && hasSteps(op)).length : 0;
                          const needsCount = opCands2 ? opCands2.filter(op => !_isExecReady(op) && !(opMaps?.[op]?.status === "PARTIAL" && hasSteps(op))).length : Math.max(0, opCount - readyCount);
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
                                    <div style={{ fontSize: 11, fontWeight: 700, color: "#0f766e", marginBottom: 4 }}>Operation entrypoints</div>
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
                          if (mx.crawl_status !== "PARTIAL") return null;
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
                          const _opMapKeys3 = Object.keys(opMaps2 || {}).filter(op => ["READY","PARTIAL"].includes((opMaps2 || {})[op]?.status || ""));
                          const _opStepKeys3 = Object.keys(opStepsDef2 || {}).filter(op => Array.isArray((opStepsDef2 || {})[op]) && ((opStepsDef2 || {})[op] as unknown[]).length > 0);
                          const opCands3 = Array.from(new Set([...(_opCandRaw3 || []), ..._opMapKeys3, ..._opStepKeys3])).filter(op => op !== "admin_crawl");
                          const execReady2 = opCands3 ? opCands3.filter(op => { if (opMaps2?.[op]?.status !== "READY") return false; if (!opStepsDef2?.[op] || (opStepsDef2[op] as unknown[]).length === 0) return false; if (!opMaps2?.[op]?.executable) return false; return true; }).length : 0;
                          if (!hasCrawled) return null;
                          const partialMappedCount2 = opCands3 ? opCands3.filter(op => opMaps2?.[op]?.status === "PARTIAL" && opStepsDef2?.[op] && (opStepsDef2[op] as unknown[]).length > 0).length : 0;
                          if (execReady2 === 0 && partialMappedCount2 > 0) return <div style={{ padding: "8px 14px", borderRadius: 8, background: "#fffbeb", border: "1px solid #fde68a", fontSize: 12, color: "#92400e", marginBottom: 10 }}>⚠️ 実行可能な操作はまだありませんが、確認が必要な操作候補が {partialMappedCount2}件あります。deep scan または不足selector確認を行ってください。</div>;
                          if (execReady2 === 0) return <div style={{ padding: "8px 14px", borderRadius: 8, background: "#fffbeb", border: "1px solid #fde68a", fontSize: 12, color: "#92400e", marginBottom: 10 }}>⚠️ ログインと巡回は成功しています。実更新に必要な項目（steps/validation/verify）が未完成のため、まだ実行できません。</div>;
                          return <div style={{ padding: "8px 14px", borderRadius: 8, background: "#f0fdf4", border: "1px solid #bbf7d0", fontSize: 12, color: "#14532d", marginBottom: 10 }}>✅ 実行可能な操作が {execReady2}件あります。{partialMappedCount2 > 0 ? ` 確認が必要な操作候補が ${partialMappedCount2}件あります。` : ""}</div>;
                        })()}

                        {/* ログイン前設定 */}
                        {(domScanResults[m.mapping_id] || (m as unknown as Record<string, unknown>).detected_summary) && (() => {
                          const ds = (domScanResults[m.mapping_id] || (m as unknown as Record<string, unknown>).detected_summary) as Record<string, unknown>;
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
                          if (!caps && !opCands) return null;
                          const CAP_LABEL: Record<string, string> = { can_login: "ログイン可能", can_verify: "ログイン後確認", can_update_text: "文章更新", can_post_news: "ニュース投稿", can_upload_image: "画像アップロード", can_update_schedule: "出勤・予定更新", can_update_price: "料金更新", can_register_entity: "新規登録", can_update_entity: "編集・更新", can_navigate_admin: "管理画面巡回" };
                          const _getOpStatus = (op: string): {icon: string; label: string; note: string} => {
                            const mapStatus = opMaps?.[op]?.status;
                            if (mapStatus === "READY") { const _mx3 = m as unknown as Record<string, unknown>; const _steps3 = (_mx3.operation_steps_by_type as Record<string, unknown[]> | undefined)?.[op]; const _execOk = opMaps?.[op]?.executable === true && _steps3 && _steps3.length > 0; if (_execOk) return { icon: "✅", label: "実行可能", note: "" }; return { icon: "🟠", label: "解析済", note: "対象画面を選択して再解析できます。" }; }
                            if (mapStatus === "PARTIAL") { const _hasSteps = Array.isArray((m as unknown as Record<string, unknown>).operation_steps_by_type && ((m as unknown as Record<string, unknown>).operation_steps_by_type as Record<string, unknown[]>)?.[op]) && (((m as unknown as Record<string, unknown>).operation_steps_by_type as Record<string, unknown[]>)?.[op] as unknown[]).length > 0; if (_hasSteps) return { icon: "🟡", label: "一部未確定（steps生成済み）", note: "不足selectorを確認してください。" }; return { icon: "🟡", label: "一部未確定", note: "deep scanで不足項目を確認してください。" }; }
                            if (mapStatus === "NEEDS_MAPPING")      return { icon: "🟡", label: "対象画面未確定",   note: "deep scanを実行してください。" };
                            if (mapStatus === "NEEDS_LOGIN_VERIFY") return { icon: "🔴", label: "ログイン後未到達", note: "ログイン確認を先に実行してください。" };
                            if (mapStatus === "WAITING_EXECUTOR")   return { icon: "🟣", label: "実行器未対応",     note: "この操作はまだ自動実行に対応していません。" };
                            if (mapStatus === "FAILED")             return { icon: "🔴", label: "解析失敗",         note: "再試行してください。" };
                            if (mapStatus === "ERROR")              return { icon: "🔴", label: "解析エラー",       note: "再試行してください。" };
                            if (mapStatus === "SCANNING")           return { icon: "⏳", label: "解析中",           note: "しばらくお待ちください。" };
                            if (mapStatus !== undefined && mapStatus !== null) return { icon: "🔍", label: mapStatus, note: "" };
                            return { icon: "🔍", label: "未解析", note: "「全操作を詳しく解析」を実行してください。" };
                          };
                          return (
                            <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "14px 16px" }}>
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                                <div style={{ fontSize: 13, fontWeight: 700, color: "#14532d" }}>🤖 検出した操作候補</div>
                                <button disabled={Object.values(deepScanLoading).some(v => v)}
                                  onClick={async () => {
                                    const mid = String(mx.mapping_id);
                                    setDeepScanLoading(prev => ({ ...prev, [mid + "_multi"]: true }));
                                    setMsg("🔍 全操作を解析中...");
                                    try { const res = await multiDeepScan(mid); setMsg(`✅ 全操作解析完了 READY:${res.ready?.length||0} PARTIAL:${res.partial?.length||0} NEEDS_MAPPING:${res.needs_mapping?.length||0}`); const updated = await listMediaMappings(); setMappings(updated.mappings || []); }
                                    catch(e: unknown) { setMsg("❌ " + (e instanceof Error ? e.message : "通信エラー")); }
                                    finally { setDeepScanLoading(prev => ({ ...prev, [mid + "_multi"]: false })); }
                                  }}
                                  style={{ fontSize: 12, padding: "5px 12px", borderRadius: 6, border: "1px solid #15803d", background: "#dcfce7", color: "#15803d", cursor: Object.values(deepScanLoading).some(v => v) ? "not-allowed" : "pointer", fontWeight: 600 }}>
                                  {deepScanLoading[String(mx.mapping_id) + "_multi"] ? "解析中..." : "🔍 全操作を詳しく解析"}
                                </button>
                              </div>

                              {opCands && opCands.length > 0 ? (
                                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                  {opCands.map(op => {
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
                                              const CAP_MAP: Record<string,string> = { entity_register: "can_register_entity", entity_update: "can_update_entity", text_update: "can_update_text", schedule_update: "can_update_schedule", price_update: "can_update_price", news_post: "can_post_news", media_replace: "can_upload_image", status_update: "can_verify" };
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
                                        {(() => {
                                          const opMap = opMaps?.[op] as Record<string, unknown> | undefined;
                                          const mapStatus = opMap?.status as string | undefined;
                                          const missing = opMap?.missing as string[] | undefined;
                                          if (!opMap || mapStatus === "READY" || mapStatus === undefined) return null;
                                          return (
                                            <div style={{ marginTop: 6, marginLeft: 22, padding: "6px 10px", borderRadius: 6, background: "#fef9c3", border: "1px solid #fde68a", fontSize: 11 }}>
                                              {missing && missing.length > 0 && <div style={{ color: "#b45309", marginBottom: 2 }}>未検出: {missing.join(", ")}</div>}
                                            </div>
                                          );
                                        })()}
                                        {true && (
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
                                <div style={{ fontSize: 12, color: "#6b7280", padding: "8px 0" }}>接続確認を実行すると操作候補が検出されます。</div>
                              )}

                              {/* 手動追加 */}
                              {(() => {
                                const ALL_OPS = ["entity_register","entity_update","text_update","schedule_update","price_update","news_post","media_replace","status_update"];
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
                                        const CAP_MAP2: Record<string,string> = { entity_register: "can_register_entity", entity_update: "can_update_entity", text_update: "can_update_text", schedule_update: "can_update_schedule", price_update: "can_update_price", news_post: "can_post_news", media_replace: "can_upload_image", status_update: "can_verify" };
                                        if (CAP_MAP2[sel]) {
                                          try { await updateCapabilities(String(mx.mapping_id), { [CAP_MAP2[sel]]: true }); const updated = await listMediaMappings(); setMappings(updated.mappings || []); setMsg("✅ 操作候補を追加しました"); }
                                          catch(e: unknown) { setMsg("❌ " + (e instanceof Error ? e.message : "追加失敗")); }
                                        }
                                      }}>追加</button>
                                  </div>
                                );
                              })()}

                              {/* Capability表示 */}
                              {caps && Object.keys(caps).length > 0 && (
                                <details style={{ marginTop: 12 }}>
                                  <summary style={{ fontSize: 12, color: "#6b7280", cursor: "pointer" }}>詳細: Capability一覧</summary>
                                  <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
                                    {Object.entries(caps).map(([k, v]) => (
                                      <span key={k} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: v ? "#dcfce7" : "#f3f4f6", color: v ? "#15803d" : "#9ca3af", border: `1px solid ${v ? "#bbf7d0" : "#e5e7eb"}` }}>
                                        {CAP_LABEL[k] || k}: {v ? "ON" : "OFF"}
                                      </span>
                                    ))}
                                  </div>
                                </details>
                              )}

                              {caps?.can_navigate_admin && (
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
                </div>
              )}
            </div>
          )}

          {/* ─────────── SECTION: タスク作成 ─────────── */}
          {tab === "create" && (
            <div>
              {/* 媒体選択 */}
              <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "16px 20px", marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#1e1b4b", marginBottom: 8 }}>① 操作対象の媒体を選択</div>
                {mappings.length === 0 ? (
                  <div style={{ fontSize: 13, color: "#b91c1c", padding: "10px 14px", borderRadius: 8, background: "#fef2f2", border: "1px solid #fca5a5" }}>⚠️ 媒体が未登録です。先に「媒体マッピング」タブでサイトを登録してください。</div>
                ) : (
                  <select value={selectedMedia?.mapping_id || ""} onChange={e => { const m2 = mappings.find(x => x.mapping_id === e.target.value) || null; setSelectedMedia(m2); setSelectedOpId(""); setFormValues({}); }}
                    style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }}>
                    <option value="">媒体を選択してください</option>
                    {mappings.map(m3 => <option key={m3.mapping_id} value={m3.mapping_id}>{m3.media_name}{m3.industry && m3.industry !== "other" ? `（${INDUSTRY_TEMPLATES_UI[m3.industry]?.label}）` : ""}</option>)}
                  </select>
                )}
                {selectedMedia && !selectedMedia.credential_secret_name && <div style={{ marginTop: 8, fontSize: 12, padding: "8px 12px", borderRadius: 6, background: "#fef2f2", border: "1px solid #fca5a5", color: "#b91c1c" }}>🔑 ログイン情報未登録です。媒体マッピングでID/PASSを登録してください。</div>}
                {selectedMedia && selectedMedia.credential_secret_name && !selectedMedia.last_verified_at && <div style={{ marginTop: 8, fontSize: 12, padding: "8px 12px", borderRadius: 6, background: "#fffbeb", border: "1px solid #fde68a", color: "#b45309" }}>🔍 接続確認が未実施です。媒体マッピングで接続確認を行ってください。</div>}
              </div>

              {selectedMedia && (() => {
                const industry = selectedMedia.industry || "other";
                const OPERATION_CAPABILITY_MAP: Record<string, string> = { news_post: "can_post_news", media_replace: "can_upload_image", text_update: "can_update_text", entity_register: "can_register_entity", entity_update: "can_update_entity", schedule_update: "can_update_schedule", price_update: "can_update_price", status_update: "can_verify" };
                const WAITING_EXECUTOR_OPS = ["interview_support","update_audit","post_monitoring"];
                const noCapabilities = !selectedMedia.capabilities || Object.values(selectedMedia.capabilities).every(v => !v);
                const availableOps = ops.filter(op => {
                  if (WAITING_EXECUTOR_OPS.includes(op.operation_type || "")) return true;
                  if (noCapabilities) return false;
                  const requiredCap = OPERATION_CAPABILITY_MAP[op.operation_type || ""];
                  if (!requiredCap) return true;
                  return !!(selectedMedia.capabilities as Record<string,boolean>)?.[requiredCap];
                });
                const taskNames = (INDUSTRY_TASK_OPTIONS[industry] || ABSTRACT_TASK_OPTIONS);
                const industryTemplate = INDUSTRY_TEMPLATES_UI[industry] || INDUSTRY_TEMPLATES_UI.other;
                return (
                  <div>
                    {/* Operation選択 */}
                    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "16px 20px", marginBottom: 16 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#1e1b4b", marginBottom: 8 }}>② 操作の種類を選択</div>
                      {availableOps.length === 0 ? (
                        <div style={{ fontSize: 12, color: "#b45309", padding: "10px 14px", borderRadius: 6, background: "#fffbeb", border: "1px solid #fde68a" }}>この媒体には実行可能な操作がまだ設定されていません。媒体マッピングで解析を実行してください。</div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          <div>
                            <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>タスクの種類（{industryTemplate.label}）</label>
                            <select value={selectedOpId} onChange={e => { setSelectedOpId(e.target.value); setFormValues({}); }}
                              style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }}>
                              <option value="">タスクを選択してください</option>
                              {taskNames.map(name => {
                                const matchedOp = availableOps.find(op => { const label = OP_LABEL[op.operation_type || ""] || op.display_name || ""; return name.includes(label) || label.includes(name) || op.display_name === name; });
                                return <option key={name} value={matchedOp?.op_id || ""} disabled={!matchedOp}>{name}{!matchedOp ? "（未対応）" : WAITING_EXECUTOR_OPS.includes(matchedOp.operation_type || "") ? "（未対応）" : ""}</option>;
                              })}
                            </select>
                          </div>
                          <div>
                            <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>Operation（詳細）</label>
                            <select value={selectedOpId} onChange={e => { setSelectedOpId(e.target.value); setFormValues({}); }}
                              style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }}>
                              <option value="">自動化の種類を選択してください</option>
                              {availableOps.map(op => <option key={op.op_id} value={op.op_id || ""}>{op.display_name || op.op_id}{WAITING_EXECUTOR_OPS.includes(op.operation_type || "") ? "（実行層未対応）" : ""}</option>)}
                            </select>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* フォーム */}
                    {selectedOpId && (() => {
                      const selOp = ops.find(o => o.op_id === selectedOpId) as OpWithSchema | undefined;
                      if (!selOp) return null;
                      const fields: PayloadField[] = selOp.payload_schema?.fields || [];
                      const canCreate = selectedMedia?.credential_secret_name;
                      return (
                        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "16px 20px", marginBottom: 16 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "#1e1b4b", marginBottom: 12 }}>③ 内容を入力してタスクを作成</div>
                          {fields.length > 0 && (
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
                      {planResult && (
                        <div style={{ padding: "12px 16px", borderRadius: 8, background: planResult.ready ? "#f0fdf4" : "#fffbeb", border: `1px solid ${planResult.ready ? "#bbf7d0" : "#fde68a"}`, fontSize: 13 }}>
                          {planResult.preview && <div style={{ color: "#1e1b4b", marginBottom: 8 }}>{planResult.preview}</div>}
                          {planResult.question && <div style={{ color: "#b45309" }}>❓ {planResult.question}</div>}
                          {planResult.ready && (
                            <button onClick={handlePlanCreate} disabled={creating}
                              style={{ marginTop: 8, padding: "8px 18px", borderRadius: 8, border: "none", background: creating ? "#9ca3af" : "#15803d", color: "#fff", fontWeight: 700, cursor: creating ? "not-allowed" : "pointer", fontSize: 13 }}>
                              {creating ? "作成中..." : "このタスクを作成する"}
                            </button>
                          )}
                        </div>
                      )}
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
                      {t.preview?.summary && <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 10 }}>{t.preview.summary}</div>}
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {t.status === "PENDING" && <button onClick={() => handleApprove(t.task_id)} style={{ padding: "7px 18px", borderRadius: 8, border: "none", background: "#1a6fa8", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>承認する</button>}
                        {t.status === "APPROVED" && <button onClick={() => handleExecute(t.task_id)} style={{ padding: "7px 18px", borderRadius: 8, border: "none", background: "#15803d", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>実行する</button>}
                      </div>
                      {t.status === "WAITING_MAPPING" && <div style={{ marginTop: 8, padding: "8px 12px", borderRadius: 6, background: "#fff7ed", border: "1px solid #fed7aa", fontSize: 12, color: "#c2410c" }}>⚠️ 「媒体マッピング」タブでサイトを設定してください</div>}
                      {t.status === "BLOCKED" && <div style={{ marginTop: 8, padding: "8px 12px", borderRadius: 6, background: "#fef2f2", border: "1px solid #fca5a5", fontSize: 12, color: "#b91c1c" }}>🚫 必要情報が不足しています</div>}
                      {t.status === "WAITING_EXECUTOR" && <div style={{ marginTop: 8, padding: "8px 12px", borderRadius: 6, background: "#faf5ff", border: "1px solid #e9d5ff", fontSize: 12, color: "#7c3aed" }}>🔧 実行層未対応：タスク構造・承認・ログ確認までが現在の対応範囲です。</div>}
                      {t.result && (() => {
                        const res = t.result as Record<string, unknown>;
                        const isSuccess = res.success === true;
                        const msg2 = res.message as string || res.error as string || "";
                        const verif = res.verification as Record<string, unknown> | undefined;
                        return (
                          <div style={{ marginTop: 8, padding: "8px 12px", borderRadius: 6, background: isSuccess ? "#f0fdf4" : "#fef2f2", border: `1px solid ${isSuccess ? "#bbf7d0" : "#fca5a5"}`, fontSize: 12 }}>
                            <span style={{ color: isSuccess ? "#15803d" : "#b91c1c", fontWeight: 700 }}>{isSuccess ? "✅ 実行完了" : "❌ 実行失敗"}</span>
                            {msg2 && <div style={{ color: "#374151", marginTop: 4 }}>{translateError(msg2)}</div>}
                            {verif && <div style={{ color: "#6b7280", marginTop: 4 }}>検証: {JSON.stringify(verif)}</div>}
                          </div>
                        );
                      })()}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ─────────── SECTION: スケジュール ─────────── */}
          {tab === "schedule" && (
            <div>
              <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "16px 20px", marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#1e1b4b", marginBottom: 12 }}>＋ 定期実行を予約</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <select value={scheduleOpId} onChange={e => setScheduleOpId(e.target.value)}
                    style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }}>
                    {ops.map(op => <option key={op.op_id} value={op.op_id}>{op.display_name || op.op_id}</option>)}
                  </select>
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
                    if (!scheduleOpId) { setMsg("自動化内容を選択してください"); return; }
                    const cron = `${scheduleMin} ${scheduleHour} * * ${scheduleDow}`;
                    try { await createAgentSchedule({ op_id: scheduleOpId, cron_expr: cron }); setMsg("実行予約を登録しました"); const d = await listAgentSchedules(); setSchedules(d.schedules); }
                    catch (e: unknown) { setMsg((e as Error).message); }
                  }} style={{ padding: "10px 24px", borderRadius: 8, border: "none", background: "#7c3aed", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 14, alignSelf: "flex-start" }}>予約する</button>
                </div>
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
                        <div style={{ fontWeight: 600, fontSize: 14, color: "#1e1b4b" }}>{ops.find(o => o.op_id === s.op_id)?.display_name || s.op_id}</div>
                        <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>{cronToJa(s.cron_expr)}</div>
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
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {mappings.filter(m => !m.credential_secret_name).map(m => (
                <div key={m.mapping_id} style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 10, padding: "14px 18px", display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 22 }}>🔴</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "#b91c1c" }}>{m.media_name}</div>
                    <div style={{ fontSize: 12, color: "#b91c1c", marginTop: 2 }}>ログイン情報が未登録です</div>
                  </div>
                  <button onClick={() => setTab("sites")} style={{ padding: "6px 14px", borderRadius: 6, border: "none", background: "#b91c1c", color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: 12 }}>設定する</button>
                </div>
              ))}
              {longInactiveSites.filter(m => !!m.credential_secret_name).map(m => (
                <div key={"inactive-" + m.mapping_id} style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "14px 18px", display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 22 }}>🟡</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "#b87d00" }}>{m.media_name}</div>
                    <div style={{ fontSize: 12, color: "#b87d00", marginTop: 2 }}>7日以上接続確認が行われていません</div>
                  </div>
                  <button onClick={async () => { try { setMsg("接続確認中..."); const r = await loginCheckMediaMapping(m.mapping_id); setLoginCheckResults(prev => ({ ...prev, [m.mapping_id]: { login_success: r.login_success, message: r.message } })); setMsg(r.login_success ? "接続を確認しました" : "接続確認に失敗しました"); fetchAll(); } catch (e: unknown) { setMsg((e as Error).message); } }}
                    style={{ padding: "6px 14px", borderRadius: 6, border: "none", background: "#b87d00", color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: 12 }}>再確認</button>
                </div>
              ))}
              {logs.filter(l => !l.success).slice(0, 5).map(l => (
                <div key={l.log_id} style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "14px 18px", display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 22 }}>⚠️</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "#b87d00" }}>{OP_LABEL[l.operation_type] || l.operation_type}</div>
                    <div style={{ fontSize: 12, color: "#b87d00", marginTop: 2 }}>{translateError(l.error_message || "実行に失敗しました")}</div>
                    <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{l.executed_at ? new Date(l.executed_at).toLocaleString("ja-JP") : ""}</div>
                  </div>
                </div>
              ))}
              {mappings.filter(m => !m.credential_secret_name).length === 0 && longInactiveSites.filter(m => !!m.credential_secret_name).length === 0 && logs.filter(l => !l.success).length === 0 && (
                <div style={{ textAlign: "center", padding: "60px 0", color: "#9ca3af" }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>🟢</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "#374151" }}>異常は検出されていません</div>
                  <div style={{ fontSize: 12, marginTop: 6 }}>すべての接続が正常に稼働しています</div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* P20 Workflow Control Panel */}
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

    </div>
  );
}
