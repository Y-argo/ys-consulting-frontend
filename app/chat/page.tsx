"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
const ReactMarkdown = dynamic(() => import("react-markdown"), { ssr: false, loading: () => null });
import {
  getStoredUser, logout, sendMessage, loadHistory, listSessions, newSession,
  getMyFeatures, getUserStats, getUsageLogs, deleteSession, renameSession,
  getHeaderConfig, getFcReport, getRankupTips, getManual, getUserGuide,
  getSuggestedQuestions, saveFeedback, uploadAttachment,
  getChatExamples, getPurposeModes, getTheme,
  tableCommand, lgbmPredict, TableResult,
  Message, SessionInfo, UserStats, AttachmentResult, ThemeConfig,
} from "@/lib/api";

type Modal = "none"|"rankup"|"manual"|"guide"|"about"|"fc"|"logs"|"mypage"|"rename"|"cookie";

interface MsgExt extends Message {
  id: string;
  suggestions?: string[];
  feedback?: "good"|"bad"|null;
  attachment?: AttachmentResult;
  images?: {mime_type:string; data:string}[];
  tableResult?: TableResult;
}

const BASE_C = {
  bg: "#f8f9fc",
  card: "#ffffff",
  nav: "rgba(255,255,255,0.95)",
  sidebar: "#f3f4f8",
  primary: "#4f46e5",
  primary2: "#7c3aed",
  textMain: "#111827",
  textSub: "#6b7280",
  textMuted: "#9ca3af",
  border: "rgba(0,0,0,0.08)",
  borderPrimary: "rgba(79,70,229,0.2)",
  shadow: "0 1px 3px rgba(0,0,0,0.08)",
  shadowMd: "0 4px 16px rgba(0,0,0,0.08)",
  shadowPrimary: "0 4px 16px rgba(79,70,229,0.2)",
};

export default function ChatPage() {
  const router = useRouter();
  const [uid, setUid] = useState("");
  const [messages, setMessages] = useState<MsgExt[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [chatId, setChatId] = useState("main");
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [aiTier, setAiTier] = useState("core");
  const [ultraEnabled, setUltraEnabled] = useState(false);
  const [apexEnabled, setApexEnabled] = useState(false);
  const [stats, setStats] = useState<UserStats|null>(null);
  const [usageLogs, setUsageLogs] = useState<{prompt:string;timestamp:string}[]>([]);
  const [purposeMode, setPurposeMode] = useState("AUTO");
  const [modal, setModal] = useState<Modal>("none");
  const [modalContent, setModalContent] = useState("");
  const [renameVal, setRenameVal] = useState("");
  const [fcData, setFcData] = useState<{report:Record<string,unknown>|null;use_count_since_report:number}>({report:null,use_count_since_report:0});
  const [headerCfg, setHeaderCfg] = useState<Record<string,string>>({});
  const [leftOpen, setLeftOpen] = useState(true);
  const [theme, setTheme] = useState<ThemeConfig|null>(null);
  const [editingId, setEditingId] = useState<string|null>(null);
  const [editVal, setEditVal] = useState("");
  const [attachment, setAttachment] = useState<AttachmentResult|null>(null);
  const [attachLoading, setAttachLoading] = useState(false);
  const [showInputExample, setShowInputExample] = useState(false);
  const [chatExamples, setChatExamples] = useState<string[]>([]);
  const [purposeModesData, setPurposeModesData] = useState<{id:string;label:string}[]>([]);
  const [currentCsv, setCurrentCsv] = useState<string>("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const C = {
    ...BASE_C,
    primary: theme?.color_primary || BASE_C.primary,
    primary2: theme?.color_secondary || BASE_C.primary2,
  };

  useEffect(() => {
    const user = getStoredUser();
    if (!user) { router.push("/"); return; }
    setUid(user.uid);
    fetchSessions();
    fetchHistory("main");
    getMyFeatures().then(f => { setUltraEnabled(!!f.ascend_ultra); setApexEnabled(!!f.ascend_apex); });
    getUserStats().then(setStats);
    getHeaderConfig().then(setHeaderCfg);
    getFcReport().then(setFcData);
    getTheme().then(setTheme);
    getChatExamples().then(setChatExamples);
    getPurposeModes().then(setPurposeModesData);
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({behavior:"smooth"}); }, [messages]);

  async function fetchSessions() {
    const s = await listSessions();
    setSessions(s.length > 0 ? s : [{chat_id:"main",title:"メインチャット"}]);
  }
  async function fetchHistory(cid: string) {
    const h = await loadHistory(cid);
    setMessages(h.map((m,i)=>({...m, id:`hist_${i}_${Date.now()}`, suggestions: m.cases||[]})));
    setChatId(cid);
  }

  const purposeModes = purposeModesData.length > 0
    ? purposeModesData.map(m=>({id:m.id, desc:m.label}))
    : [{id:"AUTO",desc:"自動"},{id:"NUMERIC",desc:"数字"},{id:"GROWTH",desc:"成長"},{id:"CONTROL",desc:"構造"},{id:"CREATIVE",desc:"創造"},{id:"MARKETING",desc:"集客"}];

  const inputExamples = chatExamples.length > 0 ? chatExamples : [
    "【目的】新規指名を月10件増やす\n【現状】月100本・新規10前後\n【制約】1日3時間・SNS運用中\n【出力】戦略と優先アクション3件",
    "【目的】リピート率を80%以上にする\n【現状】現在60%・接客60分\n【制約】価格変更不可\n【出力】具体的施策と計測指標",
    "【目的】競合との差別化を明確化\n【現状】同エリアに5店舗競合\n【制約】宣材写真3枚のみ\n【出力】差別化軸と訴求文案",
  ];

  function renderAssistantImages(images?: {mime_type:string; data:string}[]) {
    if (!images || images.length === 0) return null;
    return (
      <div className="mt-3 space-y-2">
        {images.map((img, ii) => (
          <div key={ii}>
            <img src={`data:${img.mime_type};base64,${img.data}`} alt={`generated_${ii+1}`} className="max-w-full rounded-xl" style={{maxHeight:"400px",objectFit:"contain",border:`1px solid ${C.border}`}}/>
            <a href={`data:${img.mime_type};base64,${img.data}`} download={`image_${ii+1}.png`}
              style={{background:"rgba(79,70,229,0.08)",border:`1px solid ${C.borderPrimary}`,borderRadius:"8px",color:C.primary}}
              className="inline-block mt-1 text-xs px-3 py-1 hover:text-indigo-700">📥 画像を保存</a>
          </div>
        ))}
      </div>
    );
  }

  function renderAssistantTable(tableResult?: TableResult) {
    if (!tableResult || !tableResult.columns || tableResult.columns.length === 0) return null;
    return (
      <div className="mt-3">
        <div style={{overflowX:"auto"}}>
          <table style={{borderCollapse:"collapse",width:"100%",fontSize:"11px"}}>
            <thead>
              <tr>{tableResult.columns.map((c,ci)=>(
                <th key={ci} style={{border:`1px solid ${C.border}`,padding:"4px 8px",background:"rgba(79,70,229,0.06)",color:C.primary,whiteSpace:"nowrap"}}>{c}</th>
              ))}</tr>
            </thead>
            <tbody>
              {(tableResult.rows||[]).slice(0,50).map((row,ri)=>(
                <tr key={ri}>{(row as unknown[]).map((cell,ci)=>(
                  <td key={ci} style={{border:`1px solid ${C.border}`,padding:"3px 8px",color:C.textMain}}>{String(cell??'')}</td>
                ))}</tr>
              ))}
            </tbody>
          </table>
        </div>
        {tableResult.csv && (
          <div className="flex gap-2 mt-2 flex-wrap">
            <a href={`data:text/csv;charset=utf-8,${encodeURIComponent(tableResult.csv)}`} download="table.csv"
              style={{background:"rgba(16,185,129,0.08)",border:"1px solid rgba(16,185,129,0.3)",borderRadius:"8px",color:"#059669"}}
              className="text-xs px-3 py-1 hover:text-green-700">📥 CSV保存</a>
            {["/rank","/filter","/derive","/top","/consult"].map(cmd=>(
              <button key={cmd} onClick={()=>setInput(cmd+" ")}
                style={{background:"rgba(79,70,229,0.06)",border:`1px solid ${C.borderPrimary}`,borderRadius:"8px",color:C.primary}}
                className="text-xs px-2 py-1 hover:text-indigo-700">{cmd}</button>
            ))}
          </div>
        )}
      </div>
    );
  }

  function renderAssistantSuggestions(suggestions?: string[]) {
    if (!suggestions || suggestions.length === 0) return null;
    return (
      <div className="ml-11 mt-2 space-y-1.5">
        <p className="text-xs mb-1.5" style={{color:C.primary}}>💡 次に想定される事案</p>
        {suggestions.map((q,qi)=>(
          <button key={qi} onClick={()=>setInput(q)}
            style={{background:C.card, border:`1px solid ${C.borderPrimary}`, borderRadius:"12px", boxShadow:C.shadow, color:C.textSub}}
            className="w-full text-left text-xs px-4 py-2.5 transition-all hover:border-indigo-400 hover:text-indigo-600 block">
            {q}
          </button>
        ))}
      </div>
    );
  }

  async function handleSend(e: React.FormEvent, overrideText?: string) {
    e.preventDefault();
    const text = (overrideText ?? input).trim();
    if (!text || loading) return;
    setInput("");
    setShowInputExample(false);
    if (text.startsWith("/") && ["/rank","/filter","/derive","/top","/consult","/sort","/reset"].some(c=>text.startsWith(c))) {
      await handleTableCommand(text); return;
    }
    const userMsg: MsgExt = {
      id:`u_${Date.now()}`, role:"user",
      content: attachment ? `${text}\n\n[添付: ${attachment.filename}]\n${attachment.extracted_text.slice(0,1000)}` : text,
      attachment: attachment||undefined,
    };
    setAttachment(null);
    setMessages(p=>[...p, userMsg]);
    setLoading(true);
    try {
      const sendText = attachment
        ? `${text}\n\n【添付ファイル: ${attachment.filename}】\n${attachment.extracted_text.slice(0,2000)}`
        : text;
      const res = await sendMessage(sendText, chatId, aiTier);
      const cases = res.cases||[];
      const images = res.images||[];
      setMessages(p=>[...p, {id:`a_${Date.now()}`, role:"assistant", content:res.reply, feedback:null, suggestions:cases, images}]);
      getUserStats().then(setStats);
      getFcReport().then(setFcData);
    } catch(err:unknown) {
      const msg = err instanceof Error ? err.message : "エラー";
      setMessages(p=>[...p, {id:`e_${Date.now()}`, role:"assistant", content:"⚠️ "+msg}]);
    } finally { setLoading(false); }
  }

  async function handleTableCommand(cmd: string) {
    if (!cmd.trim()) return;
    setLoading(true);
    try {
      const result = await tableCommand(cmd, currentCsv);
      if (result.csv) setCurrentCsv(result.csv);
      setMessages(p=>[...p, {id:`t_${Date.now()}`, role:"assistant", content:result.message, feedback:null, tableResult:result}]);
    } catch { setMessages(p=>[...p, {id:`e_${Date.now()}`, role:"assistant", content:"テーブル操作エラー"}]);
    } finally { setLoading(false); }
  }

  async function handleEditSend(msgId: string) {
    if (!editVal.trim()) return;
    const idx = messages.findIndex(m=>m.id===msgId);
    if (idx===-1) return;
    setMessages(messages.slice(0,idx));
    setEditingId(null);
    const fakeEv = {preventDefault:()=>{}} as React.FormEvent;
    setTimeout(()=>handleSend(fakeEv, editVal), 0);
    setEditVal("");
  }

  async function handleFeedback(msgId: string, label: "good"|"bad", msgContent: string) {
    setMessages(p=>p.map(m=>m.id===msgId?{...m, feedback:label}:m));
    const userMsg = messages.slice(0, messages.findIndex(m=>m.id===msgId)).reverse().find(m=>m.role==="user");
    await saveFeedback(chatId, userMsg?.content||"", msgContent, label);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAttachLoading(true);
    try { const r = await uploadAttachment(file, chatId); setAttachment(r); }
    catch { alert("ファイルの読み込みに失敗しました"); }
    finally { setAttachLoading(false); e.target.value=""; }
  }

  async function handleNewSession() {
    const cid = await newSession(); await fetchSessions(); await fetchHistory(cid);
  }
  async function handleDelete() {
    if (!confirm("このチャットを削除しますか？")) return;
    await deleteSession(chatId); await fetchSessions(); await fetchHistory("main");
  }
  async function handleRename() {
    if (!renameVal.trim()) return;
    await renameSession(chatId, renameVal.trim()); setModal("none"); setRenameVal(""); await fetchSessions();
  }
  async function openModal(m: Modal) {
    setModal(m);
    if (m==="rankup") { const c = await getRankupTips(); setModalContent(c); }
    if (m==="manual") { const c = await getManual(); setModalContent(c); }
    if (m==="guide")  { const c = await getUserGuide(); setModalContent(c); }
    if (m==="logs")   { const l = await getUsageLogs(); setUsageLogs(l); }
  }

  const dm = stats?.decision_metrics;
  const fcThreshold = stats?.fc_report_threshold||12;
  const fcCount = fcData.use_count_since_report;
  const fcUnlocked = fcCount>=fcThreshold;
  const fcPct = Math.min((fcCount/fcThreshold)*100,100);
  const modalTitles: Record<Modal,string> = {
    none:"",rankup:"🏆 ランクアップのコツ",manual:"📖 データ戦略完全マニュアル",
    guide:"📝 使い方ガイド",about:"ℹ️ ASCENDとは",fc:"🧠 固定概念レポート",
    logs:"📋 利用履歴",mypage:"👤 マイページ",rename:"✏️ チャット名変更",cookie:"🍪 Cookie設定",
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{background:C.bg, fontFamily:"'Inter','Noto Sans JP',sans-serif", color:C.textMain}}>
      {/* NAV */}
      <nav style={{background:C.nav, borderBottom:`1px solid ${C.border}`, backdropFilter:"blur(12px)", boxShadow:C.shadow}} className="flex items-center justify-between px-5 py-2.5 flex-shrink-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={()=>setLeftOpen(!leftOpen)} style={{color:C.textMuted}} className="hover:text-gray-600 transition-colors text-lg">☰</button>
          <div className="flex items-center gap-2.5">
            {theme?.logo_url ? (
              <img src={theme.logo_url} style={{height:`${theme.logo_size||32}px`,maxWidth:"120px",objectFit:"contain"}} alt="logo"/>
            ) : (
              <div style={{background:`linear-gradient(135deg,${C.primary},${C.primary2})`, boxShadow:C.shadowPrimary}} className="w-7 h-7 rounded-lg flex items-center justify-center">
                <span className="text-white font-black text-xs">A</span>
              </div>
            )}
            <span className="font-black text-sm tracking-widest" style={{color:C.textMain}}>ASCEND</span>
            <span style={{color:C.textMuted}} className="text-xs hidden sm:inline">｜{headerCfg.subtitle||"Ys Consulting Office"}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div style={{background:"rgba(79,70,229,0.08)",border:`1px solid ${C.borderPrimary}`,borderRadius:"12px"}} className="px-2 py-1 flex items-center gap-1" title="AIエンジン選択: Core=標準 / Ultra=高精度 / Apex=最上位">
            <span className="text-xs" style={{color:C.primary}}>⚡</span>
            <select value={aiTier} onChange={e=>setAiTier(e.target.value)} style={{background:"transparent",color:C.primary}} className="text-xs focus:outline-none cursor-pointer">
              <option value="core" style={{background:"#fff",color:"#111"}}>Core（標準）</option>
              {ultraEnabled && <option value="ultra" style={{background:"#fff",color:"#111"}}>Ultra（高精度）</option>}
              {apexEnabled  && <option value="apex"  style={{background:"#fff",color:"#111"}}>Apex（最上位）</option>}
            </select>
          </div>
          <button onClick={()=>openModal("mypage")} style={{background:"rgba(0,0,0,0.04)",border:`1px solid ${C.border}`,borderRadius:"12px"}} className="text-xs px-3 py-1.5 transition-all hover:bg-black/8">
            👤 {uid}
          </button>
          <button onClick={()=>router.push("/mypage")} style={{background:`rgba(79,70,229,0.08)`,border:`1px solid ${C.borderPrimary}`,borderRadius:"12px",color:C.primary}} className="text-xs px-3 py-1.5 transition-all hover:bg-indigo-50">マイページ</button>
        </div>
      </nav>

      <div className="flex flex-1 overflow-hidden">
        {/* LEFT SIDEBAR */}
        {leftOpen && (
          <aside style={{background:C.sidebar, borderRight:`1px solid ${C.border}`, width:"220px"}} className="flex-shrink-0 flex flex-col overflow-y-auto">
            <div className="p-3 space-y-2">
              {/* ロゴ */}
              {theme?.logo_url && (
                <div className="flex justify-center pt-1 pb-2">
                  <img src={theme.logo_url} style={{height:`${theme.logo_size||36}px`,maxWidth:"140px",objectFit:"contain"}} alt="logo"/>
                </div>
              )}
              {/* ランクスコア */}
              {stats && (
                <div style={{background:C.card, border:`1px solid ${C.borderPrimary}`, borderRadius:"12px", boxShadow:C.shadow}} className="p-3">
                  <div className="flex justify-between items-center">
                    <span style={{color:C.primary}} className="text-xs font-bold">{stats.rank_name}</span>
                    <span style={{background:`linear-gradient(135deg,${C.primary},${C.primary2})`, borderRadius:"8px", padding:"2px 8px"}} className="text-xs font-black text-white">{stats.level_score} pt</span>
                  </div>
                  <p className="text-xs mt-0.5" style={{color:C.textMuted}}>Next: {stats.next_pt}</p>
                </div>
              )}
              <button onClick={handleNewSession} style={{background:`linear-gradient(135deg,${C.primary},${C.primary2})`, boxShadow:C.shadowPrimary}} className="w-full text-xs font-bold text-white rounded-xl py-2.5 hover:opacity-90 transition-all">
                ＋ 新しいチャット
              </button>
            </div>

            <div className="flex-1 px-2 pb-2 space-y-0.5 overflow-y-auto">
              {sessions.map(s=>(
                <button key={s.chat_id} onClick={()=>fetchHistory(s.chat_id)}
                  style={chatId===s.chat_id
                    ?{background:"rgba(79,70,229,0.1)",border:`1px solid ${C.borderPrimary}`,color:C.primary,borderRadius:"10px"}
                    :{border:"1px solid transparent",color:C.textSub,borderRadius:"10px"}
                  }
                  className="w-full text-left text-xs px-3 py-2 truncate transition-all hover:bg-black/4 hover:text-gray-700">
                  💬 {s.title||s.chat_id}
                </button>
              ))}
            </div>

            {/* Decision Metrics */}
            {dm && (
              <div className="px-2 pb-2">
                <div style={{background:C.card, border:`1px solid ${C.borderPrimary}`, borderRadius:"12px", boxShadow:C.shadow}} className="p-3">
                  <div className="flex justify-between items-center mb-2">
                    <span style={{color:C.primary}} className="text-xs font-bold">DECISION METRICS</span>
                    <span style={{background:`linear-gradient(135deg,${C.primary},${C.primary2})`, padding:"1px 7px", borderRadius:"20px"}} className="text-xs font-black text-white">{String(dm.diagnosis_rank||"C")}</span>
                  </div>
                  <div className="space-y-1.5 mb-2">
                    {([["Q",dm.decision_quality_score],["R",dm.risk_tolerance],["S",dm.structural_intelligence],["V",dm.decision_velocity],["P",dm.prediction_accuracy],["E",dm.execution_consistency]] as [string,unknown][]).map(([l,v])=>(
                      <div key={String(l)}>
                        <div className="flex justify-between text-xs mb-0.5">
                          <span style={{color:C.textSub}}>{String(l)}</span>
                          <span style={{color:C.textMain}} className="font-bold">{Number(v||0).toFixed(0)}</span>
                        </div>
                        <div style={{background:"rgba(0,0,0,0.07)",borderRadius:"99px",height:"3px"}}>
                          <div style={{width:`${Math.min(Number(v||0),100)}%`,background:`linear-gradient(90deg,${C.primary},${C.primary2})`,borderRadius:"99px",height:"3px"}}/>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{borderTop:`1px solid ${C.border}`}} className="flex justify-between pt-1.5">
                    <span className="text-xs" style={{color:C.textMuted}}>TOTAL</span>
                    <span style={{color:"#d97706"}} className="font-black text-xs">{Number(dm.diagnosis_total_score||0).toFixed(1)}</span>
                  </div>
                  <button onClick={()=>router.push("/diagnosis")} style={{border:`1px solid ${C.borderPrimary}`,color:C.primary,borderRadius:"8px"}} className="w-full mt-2 text-xs hover:text-indigo-700 py-1 transition-all">
                    📊 診断 →
                  </button>
                </div>
              </div>
            )}

            <div className="p-2 space-y-0.5" style={{borderTop:`1px solid ${C.border}`}}>
              {[
                {icon:"✏️",label:"チャット名変更",fn:()=>openModal("rename")},
                {icon:"🗑️",label:"このチャット削除",fn:handleDelete},
                {icon:"🔬",label:"現状課題診断",fn:()=>router.push("/diagnosis")},
                {icon:"📩",label:"個人相談",fn:()=>router.push("/inquiry")},
              ].map(item=>(
                <button key={item.label} onClick={item.fn} style={{color:C.textSub,borderRadius:"10px"}} className="w-full text-left text-xs hover:text-gray-700 hover:bg-black/4 px-3 py-1.5 transition-all">
                  {item.icon} {item.label}
                </button>
              ))}
              <button onClick={()=>{logout();router.push("/");}} className="w-full text-left text-xs px-3 py-1.5 transition-all hover:text-red-500" style={{color:C.textMuted,borderRadius:"10px"}}>
                ← ログアウト
              </button>
            </div>
          </aside>
        )}

        {/* MAIN */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* モードバー */}
          <div style={{background:C.card, borderBottom:`1px solid ${C.border}`, scrollbarWidth:"none", msOverflowStyle:"none"} as React.CSSProperties} className="flex items-center gap-1.5 px-4 py-2 overflow-x-auto flex-shrink-0 [&::-webkit-scrollbar]:hidden">
            <span style={{fontSize:"10px",fontWeight:700,color:C.textMuted,letterSpacing:"0.12em",whiteSpace:"nowrap",flexShrink:0,paddingRight:"4px"}}>モード選択</span>
            {purposeModes.map(m=>(
              <button key={m.id} onClick={()=>setPurposeMode(m.id)}
                style={purposeMode===m.id
                  ?{background:`linear-gradient(135deg,${C.primary},${C.primary2})`, boxShadow:C.shadowPrimary, color:"white", borderRadius:"10px"}
                  :{background:"transparent", border:`1px solid ${C.border}`, color:C.textSub, borderRadius:"10px"}
                }
                className="flex-shrink-0 text-xs px-3 py-1.5 transition-all font-medium">
                {m.id} <span className="opacity-60">{m.desc}</span>
              </button>
            ))}
          </div>

          {/* アナウンス */}
          {headerCfg.announcement && (
            <div style={{background:"rgba(79,70,229,0.06)", borderBottom:`1px solid ${C.borderPrimary}`}} className="px-4 py-2 flex-shrink-0">
              <p className="text-xs font-bold" style={{color:C.primary}}>📢 {headerCfg.announcement}</p>
            </div>
          )}

          {/* メッセージ */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {messages.length===0 && (
              <div className="flex flex-col items-center justify-end h-full text-center space-y-6 pb-8">
                <div style={{background:`linear-gradient(135deg,${C.primary},${C.primary2})`, boxShadow:C.shadowPrimary}} className="w-16 h-16 rounded-2xl flex items-center justify-center">
                  <span className="text-white font-black text-2xl">A</span>
                </div>
                <div>
                  <p className="text-xl font-black mb-1" style={{color:C.textMain}}>{headerCfg.title||"ASCEND"}</p>
                  {headerCfg.subtitle && <p className="text-sm mt-1" style={{color:C.textSub}}>{headerCfg.subtitle}</p>}
                </div>
                <div className="grid grid-cols-2 gap-2 max-w-lg w-full">
                  {["売上を上げる戦略を教えて","リスクを最小化する方法は？","競合分析をしてほしい","意思決定の優先順位を整理したい"].map(q=>(
                    <button key={q} onClick={()=>setInput(q)}
                      style={{background:C.card, border:`1px solid ${C.border}`, boxShadow:C.shadow, borderRadius:"12px"}}
                      className="text-xs text-left p-3 hover:border-indigo-300 hover:shadow-md transition-all">
                      {q} →
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m,i)=>(
              <div key={m.id}>
                {m.role==="user" && (
                  <div className="flex justify-end gap-2 group">
                    <div className="max-w-[70%]">
                      {editingId===m.id ? (
                        <div style={{background:C.card, border:`1px solid ${C.borderPrimary}`, borderRadius:"18px 18px 4px 18px", boxShadow:C.shadowMd}} className="p-3">
                          <textarea value={editVal} onChange={e=>setEditVal(e.target.value)}
                            style={{background:"transparent",resize:"none",width:"100%",color:C.textMain}}
                            className="text-sm focus:outline-none min-h-[60px]"
                          />
                          <div className="flex gap-2 mt-2">
                            <button onClick={()=>handleEditSend(m.id)} style={{background:`linear-gradient(135deg,${C.primary},${C.primary2})`}} className="text-xs text-white px-3 py-1 rounded-lg">送信</button>
                            <button onClick={()=>setEditingId(null)} className="text-xs px-3 py-1 rounded-lg" style={{color:C.textSub}}>キャンセル</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div style={{background:`linear-gradient(135deg,${C.primary},${C.primary2})`, borderRadius:"18px 18px 4px 18px", boxShadow:C.shadowPrimary}} className="px-4 py-3 text-sm text-white leading-relaxed">
                            {m.attachment && (
                              <div style={{background:"rgba(255,255,255,0.15)",borderRadius:"8px"}} className="mb-2 px-2 py-1 text-xs text-indigo-100">
                                📎 {m.attachment.filename} ({(m.attachment.size/1024).toFixed(1)}KB)
                              </div>
                            )}
                            {m.content.replace(/\n\n\[添付:[\s\S]*$/,"").replace(/\n\n【添付ファイル:[\s\S]*$/,"")}
                          </div>
                          <div className="flex justify-end mt-1 gap-1 opacity-100 transition-opacity">
                            <button onClick={()=>{setEditingId(m.id);setEditVal(m.content.replace(/\n\n\[添付:[\s\S]*$/,"").replace(/\n\n【添付ファイル:[\s\S]*$/,""));}}
                              className="text-xs px-2 py-0.5 rounded transition-colors" style={{color:C.textMuted}}>✏️ 編集</button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {m.role==="assistant" && (
                  <div className="flex gap-3">
                    <div style={{background:`linear-gradient(135deg,${C.primary},${C.primary2})`, flexShrink:0, boxShadow:C.shadowPrimary}} className="w-8 h-8 rounded-xl flex items-center justify-center mt-0.5">
                      <span className="text-white font-black text-xs">A</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div style={{background:C.card, border:`1px solid ${C.border}`, borderRadius:"4px 18px 18px 18px", boxShadow:C.shadow}} className="px-5 py-4 text-sm leading-relaxed">
                        <div className="prose prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-gray-200 [&_td]:px-2 [&_td]:py-1.5 [&_td]:text-xs [&_th]:border [&_th]:border-gray-200 [&_th]:px-2 [&_th]:py-1.5 [&_th]:bg-indigo-50 [&_th]:text-xs [&_code]:bg-indigo-50 [&_code]:px-1 [&_code]:rounded [&_code]:text-xs" style={{color:C.textMain}}>
                          <ReactMarkdown>{m.content}</ReactMarkdown>
                        </div>
                        {m.images && m.images.length>0 && (
                          <div className="mt-3 space-y-2">
                            {m.images.map((img,ii)=>(
                              <div key={ii}>
                                <img src={`data:${img.mime_type};base64,${img.data}`} alt={`generated_${ii+1}`} className="max-w-full rounded-xl" style={{maxHeight:"400px",objectFit:"contain",border:`1px solid ${C.border}`}}/>
                                <a href={`data:${img.mime_type};base64,${img.data}`} download={`image_${ii+1}.png`}
                                  style={{background:"rgba(79,70,229,0.08)",border:`1px solid ${C.borderPrimary}`,borderRadius:"8px",color:C.primary}}
                                  className="inline-block mt-1 text-xs px-3 py-1 hover:text-indigo-700">📥 画像を保存</a>
                              </div>
                            ))}
                          </div>
                        )}
                        {m.tableResult && m.tableResult.columns && m.tableResult.columns.length>0 && (
                          <div className="mt-3">
                            <div style={{overflowX:"auto"}}>
                              <table style={{borderCollapse:"collapse",width:"100%",fontSize:"11px"}}>
                                <thead>
                                  <tr>{m.tableResult.columns.map((c,ci)=>(
                                    <th key={ci} style={{border:`1px solid ${C.border}`,padding:"4px 8px",background:"rgba(79,70,229,0.06)",color:C.primary,whiteSpace:"nowrap"}}>{c}</th>
                                  ))}</tr>
                                </thead>
                                <tbody>
                                  {(m.tableResult.rows||[]).slice(0,50).map((row,ri)=>(
                                    <tr key={ri}>{(row as unknown[]).map((cell,ci)=>(
                                      <td key={ci} style={{border:`1px solid ${C.border}`,padding:"3px 8px",color:C.textMain}}>{String(cell??'')}</td>
                                    ))}</tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                            {m.tableResult.csv && (
                              <div className="flex gap-2 mt-2 flex-wrap">
                                <a href={`data:text/csv;charset=utf-8,${encodeURIComponent(m.tableResult.csv)}`} download="table.csv"
                                  style={{background:"rgba(16,185,129,0.08)",border:"1px solid rgba(16,185,129,0.3)",borderRadius:"8px",color:"#059669"}}
                                  className="text-xs px-3 py-1 hover:text-green-700">📥 CSV保存</a>
                                {["/rank","/filter","/derive","/top","/consult"].map(cmd=>(
                                  <button key={cmd} onClick={()=>setInput(cmd+" ")}
                                    style={{background:"rgba(79,70,229,0.06)",border:`1px solid ${C.borderPrimary}`,borderRadius:"8px",color:C.primary}}
                                    className="text-xs px-2 py-1 hover:text-indigo-700">{cmd}</button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {i>0 && (
                        <div className="flex items-center gap-2 mt-2">
                          <button onClick={()=>handleFeedback(m.id,"good",m.content)}
                            style={m.feedback==="good"
                              ?{background:"rgba(16,185,129,0.1)",border:"1px solid rgba(16,185,129,0.4)",color:"#059669"}
                              :{background:C.card,border:`1px solid ${C.border}`,color:C.textMuted}
                            }
                            className="text-xs px-3 py-1 rounded-xl transition-all">👍 役立った</button>
                          <button onClick={()=>handleFeedback(m.id,"bad",m.content)}
                            style={m.feedback==="bad"
                              ?{background:"rgba(245,158,11,0.1)",border:"1px solid rgba(245,158,11,0.4)",color:"#d97706"}
                              :{background:C.card,border:`1px solid ${C.border}`,color:C.textMuted}
                            }
                            className="text-xs px-3 py-1 rounded-xl transition-all">💡 改善余地あり</button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {m.role==="assistant" && m.suggestions && m.suggestions.length>0 && (
                  <div className="ml-11 mt-2 space-y-1.5">
                    <p className="text-xs mb-1.5" style={{color:C.primary}}>💡 次に想定される事案</p>
                    {m.suggestions.map((q,qi)=>(
                      <button key={qi} onClick={()=>setInput(q)}
                        style={{background:C.card, border:`1px solid ${C.borderPrimary}`, borderRadius:"12px", boxShadow:C.shadow, color:C.textSub}}
                        className="w-full text-left text-xs px-4 py-2.5 transition-all hover:border-indigo-400 hover:text-indigo-600 block">
                        {q}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex gap-3">
                <div style={{background:`linear-gradient(135deg,${C.primary},${C.primary2})`}} className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-black text-xs">A</span>
                </div>
                <div style={{background:C.card, border:`1px solid ${C.border}`, borderRadius:"4px 18px 18px 18px", boxShadow:C.shadow}} className="px-5 py-3.5 flex items-center gap-1.5">
                  {[0,1,2].map(i=><div key={i} className="w-1.5 h-1.5 rounded-full animate-bounce" style={{background:C.primary,animationDelay:`${i*0.15}s`}}/>)}
                </div>
              </div>
            )}
            <div ref={bottomRef}/>
          </div>

          {/* 入力例 */}
          {showInputExample && (
            <div style={{background:C.card, borderTop:`1px solid ${C.border}`}} className="px-4 py-3 flex-shrink-0">
              <div className="flex justify-between items-center mb-2">
                <p className="text-xs font-bold" style={{color:C.primary}}>💡 入力例（タップで挿入）</p>
                <button onClick={()=>setShowInputExample(false)} className="text-xs" style={{color:C.textMuted}}>✕</button>
              </div>
              <div className="space-y-2">
                {inputExamples.map((ex,i)=>(
                  <button key={i} onClick={()=>{setInput(ex);setShowInputExample(false);}}
                    style={{background:"rgba(79,70,229,0.04)",border:`1px solid ${C.borderPrimary}`,borderRadius:"12px",color:C.textSub}}
                    className="w-full text-left text-xs hover:text-indigo-600 px-3 py-2 transition-all whitespace-pre-wrap">
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 添付プレビュー */}
          {attachment && (
            <div style={{background:"rgba(79,70,229,0.04)",borderTop:`1px solid ${C.borderPrimary}`}} className="px-4 py-2 flex items-center gap-3 flex-shrink-0">
              <span className="text-xs" style={{color:C.primary}}>📎 {attachment.filename}</span>
              <span className="text-xs" style={{color:C.textMuted}}>({(attachment.size/1024).toFixed(1)}KB)</span>
              <span className="text-xs truncate flex-1" style={{color:C.textMuted}}>{attachment.preview}</span>
              <button onClick={()=>setAttachment(null)} className="text-xs transition-colors hover:text-red-500" style={{color:C.textMuted}}>✕</button>
            </div>
          )}

          {/* 入力エリア */}
          <div style={{background:C.card, borderTop:`1px solid ${C.border}`, backdropFilter:"blur(12px)"}} className="px-4 py-3 flex-shrink-0">
            <form onSubmit={handleSend} className="flex gap-2 items-end">
              <input ref={fileRef} type="file" onChange={handleFileChange} className="hidden" accept=".txt,.md,.csv,.pdf,.xlsx,.xls,.json,.py,.js,.ts,.png,.jpg,.jpeg,.webp"/>
              <button type="button" onClick={()=>fileRef.current?.click()} disabled={attachLoading}
                style={{background:"rgba(0,0,0,0.04)",border:`1px solid ${C.border}`,borderRadius:"12px",flexShrink:0,color:C.textSub}}
                className="hover:text-indigo-500 hover:border-indigo-300 p-3 transition-all disabled:opacity-50">
                {attachLoading ? "⏳" : "🗂️"}
              </button>
              <button type="button" onClick={()=>setShowInputExample(!showInputExample)}
                style={{background:"rgba(0,0,0,0.04)",border:`1px solid ${C.border}`,borderRadius:"12px",flexShrink:0,color:C.textSub}}
                className="hover:text-yellow-500 hover:border-yellow-300 p-3 transition-all text-sm">💡</button>
              <div style={{background:"rgba(0,0,0,0.02)",border:`1px solid ${C.border}`,borderRadius:"16px"}} className="flex-1 focus-within:border-indigo-400 transition-all">
                <textarea value={input} onChange={e=>setInput(e.target.value)}
                  onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();handleSend(e as unknown as React.FormEvent);}}}
                  disabled={loading} placeholder="コンサルタントに相談... (Shift+Enterで改行)"
                  rows={1} style={{background:"transparent",resize:"none",minHeight:"44px",maxHeight:"160px",color:C.textMain}}
                  className="w-full text-sm px-4 py-3 focus:outline-none placeholder-gray-400 disabled:opacity-50 leading-relaxed"
                />
              </div>
              <button type="submit" disabled={loading||(!input.trim()&&!attachment)}
                style={(!loading&&(input.trim()||attachment))
                  ?{background:`linear-gradient(135deg,${C.primary},${C.primary2})`,boxShadow:C.shadowPrimary,borderRadius:"12px"}
                  :{background:"rgba(0,0,0,0.06)",borderRadius:"12px"}
                }
                className="text-white font-bold p-3 transition-all disabled:text-gray-400 flex-shrink-0 active:scale-95">
                ▶
              </button>
            </form>
            <p className="text-center text-xs mt-2" style={{color:C.textMuted}}>本AIの出力は意思決定支援のための提案です。投資・法務・医療等の重要事項は専門家にご確認ください。</p>
          </div>
        </div>
      </div>

      {/* MODAL */}
      {modal!=="none" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{background:"rgba(0,0,0,0.4)",backdropFilter:"blur(8px)"}} onClick={()=>setModal("none")}>
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:"24px",maxWidth:"680px",width:"100%",maxHeight:"85vh",boxShadow:"0 25px 80px rgba(0,0,0,0.15)"}} className="flex flex-col overflow-hidden" onClick={e=>e.stopPropagation()}>
            <div style={{borderBottom:`1px solid ${C.border}`}} className="flex items-center justify-between px-6 py-4 flex-shrink-0">
              <h2 className="font-bold" style={{color:C.textMain}}>{modalTitles[modal]}</h2>
              <button onClick={()=>setModal("none")} style={{background:"rgba(0,0,0,0.05)",borderRadius:"10px",color:C.textSub}} className="hover:text-gray-700 w-8 h-8 flex items-center justify-center">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {(modal==="rankup"||modal==="manual"||modal==="guide") && (
                <div className="prose prose-sm max-w-none [&_table]:border-collapse [&_td]:border [&_td]:border-gray-200 [&_td]:px-3 [&_td]:py-2 [&_th]:border [&_th]:border-gray-200 [&_th]:px-3 [&_th]:py-2 [&_th]:bg-indigo-50" style={{color:C.textMain}}>
                  <ReactMarkdown>{modalContent}</ReactMarkdown>
                </div>
              )}
              {modal==="rename" && (
                <div className="space-y-4">
                  <p className="text-sm" style={{color:C.textSub}}>現在: <span style={{color:C.textMain}}>{chatId}</span></p>
                  <input value={renameVal} onChange={e=>setRenameVal(e.target.value)} placeholder="新しいチャット名"
                    style={{background:"rgba(0,0,0,0.03)",border:`1px solid ${C.border}`,borderRadius:"14px",color:C.textMain,width:"100%"}}
                    className="text-sm px-4 py-3 focus:outline-none focus:border-indigo-400 transition-colors placeholder-gray-400"
                  />
                  <button onClick={handleRename} style={{background:`linear-gradient(135deg,${C.primary},${C.primary2})`}} className="w-full text-white font-bold rounded-2xl py-3 text-sm hover:opacity-90">変更する</button>
                </div>
              )}
              {modal==="logs" && (
                <div className="space-y-2">
                  {usageLogs.length===0
                    ? <p className="text-sm text-center py-8" style={{color:C.textMuted}}>履歴がありません</p>
                    : usageLogs.map((l,i)=>(
                      <div key={i} style={{background:"rgba(0,0,0,0.02)",border:`1px solid ${C.border}`,borderRadius:"14px"}} className="px-4 py-3">
                        <p className="text-xs mb-1" style={{color:C.textMuted}}>{l.timestamp.slice(0,16)}</p>
                        <p className="text-sm truncate" style={{color:C.textSub}}>{l.prompt}</p>
                      </div>
                    ))
                  }
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
