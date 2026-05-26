"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  getStoredUser, listAgentTasks, approveAgentTask, rejectAgentTask,
  executeAgentTask, createAgentTask, listAgentLogs,
  getAgentIndustryTemplates,
  AgentTask, AgentLog,
} from "@/lib/api";

const STATUS_LABEL: Record<string, string> = {
  PENDING: "承認待ち", APPROVED: "承認済み", RUNNING: "実行中",
  DONE: "完了", REJECTED: "却下", FAILED: "失敗",
};
const STATUS_COLOR: Record<string, string> = {
  PENDING: "#b87d00", APPROVED: "#1a6fa8", RUNNING: "#7c3aed",
  DONE: "#15803d", REJECTED: "#6b7280", FAILED: "#b91c1c",
};
const AGENT_LABEL: Record<string, string> = {
  hp_update: "HP/媒体更新", audit: "投稿/更新監査", interview: "面接/ヒアリング補佐",
};
const OP_LABEL: Record<string, string> = {
  entity_register: "Entity登録", entity_update: "Entity更新", media_replace: "Media差し替え",
  text_update: "テキスト更新", schedule_update: "スケジュール更新", price_update: "料金更新",
  news_post: "ニュース投稿", status_update: "ステータス更新",
};

type Tab = "tasks" | "create" | "logs";

export default function AgentPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("tasks");
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [selectedTask, setSelectedTask] = useState<AgentTask | null>(null);

  // 作成フォーム
  const [agentType, setAgentType] = useState("hp_update");
  const [opType, setOpType] = useState("entity_update");
  const [industry, setIndustry] = useState("other");
  const [payloadText, setPayloadText] = useState("{}");
  const [templates, setTemplates] = useState<Record<string, Record<string, string>>>({});
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const u = getStoredUser();
    if (!u) { router.push("/"); return; }
    fetchTasks();
    getAgentIndustryTemplates().then(d => setTemplates(d.templates)).catch(() => {});
  }, []);

  async function fetchTasks() {
    setLoading(true);
    try {
      const d = await listAgentTasks(filterStatus ? { status: filterStatus } : undefined);
      setTasks(d.tasks);
    } catch (e: unknown) {
      const err = e as Error;
      if (err.message && err.message.includes("権限")) {
        setMsg("エージェントモードの利用権限がありません（APEX/ULTRAプラン、またはadmin許可が必要です）");
      } else {
        setMsg("タスク取得に失敗しました");
      }
    } finally { setLoading(false); }
  }

  async function fetchLogs() {
    setLoading(true);
    try {
      const d = await listAgentLogs();
      setLogs(d.logs);
    } catch { setMsg("ログ取得に失敗しました"); }
    finally { setLoading(false); }
  }

  async function handleApprove(task_id: string) {
    try {
      await approveAgentTask(task_id);
      setMsg("承認しました");
      setSelectedTask(null);
      fetchTasks();
    } catch (e: unknown) { setMsg((e as Error).message); }
  }

  async function handleReject(task_id: string) {
    const reason = window.prompt("却下理由を入力してください（任意）");
    if (reason === null) return;
    try {
      await rejectAgentTask(task_id, reason);
      setMsg("却下しました");
      setSelectedTask(null);
      fetchTasks();
    } catch (e: unknown) { setMsg((e as Error).message); }
  }

  async function handleExecute(task_id: string) {
    try {
      const r = await executeAgentTask(task_id);
      setMsg("実行完了: " + (r.result as Record<string,string>)?.message || "");
      setSelectedTask(null);
      fetchTasks();
    } catch (e: unknown) { setMsg((e as Error).message); }
  }

  async function handleCreate() {
    let payload: Record<string, unknown> = {};
    try { payload = JSON.parse(payloadText); } catch { setMsg("payloadのJSON形式が正しくありません"); return; }
    setCreating(true);
    try {
      const r = await createAgentTask({ agent_type: agentType, operation_type: opType, industry, payload });
      setMsg("タスクを作成しました: " + r.task_id);
      setTab("tasks");
      fetchTasks();
    } catch (e: unknown) { setMsg((e as Error).message); }
    finally { setCreating(false); }
  }

  const tmpl = templates[industry] || {};

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-background-tertiary)", padding: "24px 16px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>

        {/* ヘッダー */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <button onClick={() => router.back()} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "var(--color-text-secondary)" }}>←</button>
          <h1 style={{ fontSize: 22, fontWeight: 500, margin: 0, color: "var(--color-text-primary)" }}>エージェントモード</h1>
          <span style={{ fontSize: 12, background: "#7c3aed22", color: "#7c3aed", borderRadius: 6, padding: "2px 10px", fontWeight: 500 }}>BETA</span>
        </div>

        {/* メッセージ */}
        {msg && (
          <div style={{ background: "var(--color-background-secondary)", border: "1px solid var(--color-border-primary)", borderRadius: 8, padding: "10px 16px", marginBottom: 16, fontSize: 14, color: "var(--color-text-primary)" }}>
            {msg}
            <button onClick={() => setMsg("")} style={{ float: "right", background: "none", border: "none", cursor: "pointer", color: "var(--color-text-secondary)" }}>×</button>
          </div>
        )}

        {/* タブ */}
        <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: "1px solid var(--color-border-tertiary)" }}>
          {(["tasks", "create", "logs"] as Tab[]).map(t => (
            <button key={t} onClick={() => { setTab(t); if (t === "logs") fetchLogs(); else if (t === "tasks") fetchTasks(); }}
              style={{ padding: "8px 20px", background: "none", border: "none", borderBottom: tab === t ? "2px solid #7c3aed" : "2px solid transparent", cursor: "pointer", fontWeight: tab === t ? 500 : 400, color: tab === t ? "#7c3aed" : "var(--color-text-secondary)", fontSize: 14, transition: "all 0.15s" }}>
              {t === "tasks" ? "タスク一覧" : t === "create" ? "タスク作成" : "実行ログ"}
            </button>
          ))}
        </div>

        {/* タスク一覧 */}
        {tab === "tasks" && (
          <div>
            <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
              {["", "PENDING", "APPROVED", "RUNNING", "DONE", "REJECTED", "FAILED"].map(s => (
                <button key={s} onClick={() => { setFilterStatus(s); setTimeout(fetchTasks, 0); }}
                  style={{ padding: "4px 12px", borderRadius: 6, border: "1px solid var(--color-border-secondary)", background: filterStatus === s ? "#7c3aed" : "var(--color-background-secondary)", color: filterStatus === s ? "#fff" : "var(--color-text-secondary)", cursor: "pointer", fontSize: 13 }}>
                  {s || "すべて"}
                </button>
              ))}
              <button onClick={fetchTasks} style={{ marginLeft: "auto", padding: "4px 12px", borderRadius: 6, border: "1px solid var(--color-border-secondary)", background: "var(--color-background-secondary)", color: "var(--color-text-secondary)", cursor: "pointer", fontSize: 13 }}>更新</button>
            </div>

            {loading ? (
              <div style={{ textAlign: "center", padding: 40, color: "var(--color-text-secondary)" }}>読み込み中...</div>
            ) : tasks.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: "var(--color-text-secondary)", fontSize: 14 }}>タスクがありません</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {tasks.map(t => (
                  <div key={t.task_id} onClick={() => setSelectedTask(t)}
                    style={{ background: "var(--color-background-secondary)", border: "1px solid var(--color-border-tertiary)", borderRadius: 10, padding: "14px 18px", cursor: "pointer", transition: "border-color 0.15s" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 500, background: STATUS_COLOR[t.status] + "22", color: STATUS_COLOR[t.status], borderRadius: 5, padding: "2px 8px" }}>{STATUS_LABEL[t.status] || t.status}</span>
                      <span style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)" }}>{AGENT_LABEL[t.agent_type] || t.agent_type}</span>
                      <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>/ {OP_LABEL[t.operation_type] || t.operation_type}</span>
                      <span style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginLeft: "auto" }}>{t.created_at ? new Date(t.created_at).toLocaleString("ja-JP") : ""}</span>
                    </div>
                    <div style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>{t.preview?.summary || ""}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* タスク作成 */}
        {tab === "create" && (
          <div style={{ background: "var(--color-background-secondary)", border: "1px solid var(--color-border-tertiary)", borderRadius: 12, padding: 24 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-secondary)", display: "block", marginBottom: 6 }}>エージェント種別</label>
                <select value={agentType} onChange={e => setAgentType(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--color-border-secondary)", background: "var(--color-background-primary)", color: "var(--color-text-primary)", fontSize: 14 }}>
                  <option value="hp_update">HP/媒体更新</option>
                  <option value="audit">投稿/更新監査</option>
                  <option value="interview">面接/ヒアリング補佐</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-secondary)", display: "block", marginBottom: 6 }}>操作種別</label>
                <select value={opType} onChange={e => setOpType(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--color-border-secondary)", background: "var(--color-background-primary)", color: "var(--color-text-primary)", fontSize: 14 }}>
                  {Object.entries(OP_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-secondary)", display: "block", marginBottom: 6 }}>業種</label>
                <select value={industry} onChange={e => setIndustry(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--color-border-secondary)", background: "var(--color-background-primary)", color: "var(--color-text-primary)", fontSize: 14 }}>
                  <option value="nightlife">夜職</option>
                  <option value="beauty">美容/サロン</option>
                  <option value="retail">小売/飲食</option>
                  <option value="realestate">不動産</option>
                  <option value="btob">法人営業/BtoB</option>
                  <option value="fitness">フィットネス/スクール</option>
                  <option value="other">その他</option>
                </select>
                {tmpl.entity_name && (
                  <div style={{ marginTop: 6, fontSize: 12, color: "var(--color-text-tertiary)" }}>
                    対象: {tmpl.entity_name} / スケジュール: {tmpl.schedule} / 投稿: {tmpl.news}
                  </div>
                )}
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-secondary)", display: "block", marginBottom: 6 }}>payload (JSON)</label>
                <textarea value={payloadText} onChange={e => setPayloadText(e.target.value)} rows={5}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--color-border-secondary)", background: "var(--color-background-primary)", color: "var(--color-text-primary)", fontSize: 13, fontFamily: "monospace", resize: "vertical", boxSizing: "border-box" }} />
              </div>
              <button onClick={handleCreate} disabled={creating}
                style={{ padding: "10px 24px", borderRadius: 8, border: "none", background: creating ? "#9ca3af" : "#7c3aed", color: "#fff", fontWeight: 500, fontSize: 15, cursor: creating ? "not-allowed" : "pointer" }}>
                {creating ? "作成中..." : "タスクを作成"}
              </button>
            </div>
          </div>
        )}

        {/* 実行ログ */}
        {tab === "logs" && (
          <div>
            {loading ? (
              <div style={{ textAlign: "center", padding: 40, color: "var(--color-text-secondary)" }}>読み込み中...</div>
            ) : logs.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: "var(--color-text-secondary)", fontSize: 14 }}>ログがありません</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {logs.map(l => (
                  <div key={l.log_id} style={{ background: "var(--color-background-secondary)", border: "1px solid var(--color-border-tertiary)", borderRadius: 10, padding: "12px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 500, background: l.success ? "#15803d22" : "#b91c1c22", color: l.success ? "#15803d" : "#b91c1c", borderRadius: 5, padding: "2px 8px" }}>{l.success ? "成功" : "失敗"}</span>
                      <span style={{ fontSize: 13, color: "var(--color-text-primary)" }}>{AGENT_LABEL[l.agent_type] || l.agent_type}</span>
                      <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>/ {OP_LABEL[l.operation_type] || l.operation_type}</span>
                      <span style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginLeft: "auto" }}>{l.executed_at ? new Date(l.executed_at).toLocaleString("ja-JP") : ""}</span>
                    </div>
                    {l.error_message && <div style={{ fontSize: 12, color: "#b91c1c" }}>{l.error_message}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* タスク詳細モーダル */}
        {selectedTask && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
            <div style={{ background: "var(--color-background-primary)", borderRadius: 14, padding: 28, maxWidth: 560, width: "100%", maxHeight: "80vh", overflowY: "auto" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 500 }}>タスク詳細</h2>
                <button onClick={() => setSelectedTask(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "var(--color-text-secondary)" }}>×</button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 14 }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ background: STATUS_COLOR[selectedTask.status] + "22", color: STATUS_COLOR[selectedTask.status], borderRadius: 5, padding: "2px 10px", fontWeight: 500 }}>{STATUS_LABEL[selectedTask.status]}</span>
                  <span style={{ color: "var(--color-text-secondary)" }}>{AGENT_LABEL[selectedTask.agent_type]}</span>
                  <span style={{ color: "var(--color-text-tertiary)" }}>/ {OP_LABEL[selectedTask.operation_type]}</span>
                </div>
                <div style={{ background: "var(--color-background-tertiary)", borderRadius: 8, padding: "10px 14px" }}>
                  <div style={{ fontWeight: 500, marginBottom: 4 }}>実行内容</div>
                  <div style={{ color: "var(--color-text-secondary)" }}>{selectedTask.preview?.summary}</div>
                </div>
                <div style={{ background: "var(--color-background-tertiary)", borderRadius: 8, padding: "10px 14px" }}>
                  <div style={{ fontWeight: 500, marginBottom: 4 }}>payload</div>
                  <pre style={{ margin: 0, fontSize: 12, color: "var(--color-text-secondary)", overflowX: "auto" }}>{JSON.stringify(selectedTask.payload, null, 2)}</pre>
                </div>
                {selectedTask.result && (
                  <div style={{ background: "var(--color-background-tertiary)", borderRadius: 8, padding: "10px 14px" }}>
                    <div style={{ fontWeight: 500, marginBottom: 4 }}>実行結果</div>
                    <pre style={{ margin: 0, fontSize: 12, color: "var(--color-text-secondary)", overflowX: "auto" }}>{JSON.stringify(selectedTask.result, null, 2)}</pre>
                  </div>
                )}
                <div style={{ display: "flex", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
                  {selectedTask.status === "PENDING" && (<>
                    <button onClick={() => handleApprove(selectedTask.task_id)}
                      style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", background: "#1a6fa8", color: "#fff", fontWeight: 500, cursor: "pointer", fontSize: 14 }}>承認して実行待ちへ</button>
                    <button onClick={() => handleReject(selectedTask.task_id)}
                      style={{ flex: 1, padding: "10px", borderRadius: 8, border: "1px solid var(--color-border-secondary)", background: "none", color: "var(--color-text-secondary)", fontWeight: 500, cursor: "pointer", fontSize: 14 }}>却下</button>
                  </>)}
                  {selectedTask.status === "APPROVED" && (
                    <button onClick={() => handleExecute(selectedTask.task_id)}
                      style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", background: "#15803d", color: "#fff", fontWeight: 500, cursor: "pointer", fontSize: 14 }}>実行する</button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
