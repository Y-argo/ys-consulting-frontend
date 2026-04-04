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
  structured?: { summary: string; cards: { current: string[]; risk: string[]; plan: string[] }; analysis: { type: string; urgency: string; importance: string; mode: string }; actions: string[]; value_message: string; };
}

const C = {
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
  const [leftOpen, setLeftOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeConfig|null>(null);
  const [editingId, setEditingId] = useState<string|null>(null);
  const [scoreDelta, setScoreDelta] = useState<number|null>(null);
  const [editVal, setEditVal] = useState("");
  const [attachment, setAttachment] = useState<AttachmentResult|null>(null);
  const [attachLoading, setAttachLoading] = useState(false);
  const [feedbackToast, setFeedbackToast] = useState<string>("");
  const [loadingStep, setLoadingStep] = useState(0);
  const [showInputExample, setShowInputExample] = useState(false);
  const [chatExamples, setChatExamples] = useState<string[]>([]);
  const [purposeModesData, setPurposeModesData] = useState<{id:string;label:string}[]>([]);
  const [currentCsv, setCurrentCsv] = useState<string>("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLeftOpen(window.innerWidth >= 768);
    const user = getStoredUser();
    if (!user) { router.push("/"); return; }
    setUid(user.uid);
    listSessions().then(s => {
      if (s.length > 0) {
        setSessions(s);
        fetchHistory(s[0].chat_id);
      } else {
        newSession().then(id => {
          setSessions([{chat_id:id, title:"新しいチャット"}]);
          setChatId(id);
        });
      }
    });
    getMyFeatures().then(f => {
      const hasUltra = !!f.ascend_ultra;
      const hasApex = !!f.ascend_apex;
      setUltraEnabled(hasUltra);
      setApexEnabled(hasApex);
      const savedTier = localStorage.getItem("ascend_ai_tier_default");
      if (savedTier === "ultra" && hasUltra) setAiTier("ultra");
      else if (savedTier === "apex" && hasApex) setAiTier("apex");
      else setAiTier("core");
    });
    getUserStats().then(setStats);
    getHeaderConfig().then(setHeaderCfg);
    getFcReport().then(setFcData);
    getTheme().then(t => {
      setTheme(t);
      if (!t) return;
      // favicon
      if (t.favicon_url) {
        let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
        if (!link) { link = document.createElement("link"); link.rel = "icon"; document.head.appendChild(link); }
        link.href = t.favicon_url;
      }
    });
    getChatExamples().then(setChatExamples);
    getPurposeModes().then(setPurposeModesData);

    // セッションタイムアウト監視
    let _timeoutMin = 60;
    fetch("/api/user/session_timeout", {headers:{"Authorization":`Bearer ${localStorage.getItem("ascend_token")||""}`}})
      .then(r=>r.json()).then(d=>{ _timeoutMin = d.session_timeout_minutes||60; }).catch(()=>{});
    const _lastAct = {ts: Date.now()};
    const _updateAct = () => { _lastAct.ts = Date.now(); };
    window.addEventListener("mousemove", _updateAct);
    window.addEventListener("keydown", _updateAct);
    window.addEventListener("click", _updateAct);
    const _timer = setInterval(() => {
      if (Date.now() - _lastAct.ts > _timeoutMin * 60 * 1000) {
        logout();
        router.push("/");
      }
    }, 30000);
    return () => {
      clearInterval(_timer);
      window.removeEventListener("mousemove", _updateAct);
      window.removeEventListener("keydown", _updateAct);
      window.removeEventListener("click", _updateAct);
    };
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({behavior:"smooth"}); }, [messages]);

  async function fetchSessions() {
    const s = await listSessions();
    setSessions(s.length > 0 ? s : [{chat_id:"main", title:"メインチャット"}]);
  }
  async function fetchHistory(cid: string) {
    const h = await loadHistory(cid);
    setMessages(h.map((m,i)=>({...m, id:`hist_${i}_${Date.now()}`, suggestions: m.cases||[], structured: m.structured||undefined})));
    setChatId(cid);
  }

  const purposeModes = purposeModesData.length > 0
    ? purposeModesData.map(m=>({id:m.id, desc:m.label}))
    : [{id:"AUTO",desc:"AUTO（自動判別）"},{id:"NUMERIC",desc:"NUMERIC（数字/指標）"},{id:"GROWTH",desc:"GROWTH（成長/訓練）"},{id:"CONTROL",desc:"CONTROL（支配/構造図）"},{id:"STRATEGY",desc:"STRATEGY（戦略立案）"},{id:"ANALYSIS",desc:"ANALYSIS（分析/解析）"},{id:"PLANNING",desc:"PLANNING（計画/ロードマップ）"},{id:"RISK",desc:"RISK（リスク評価）"},{id:"CREATIVE",desc:"CREATIVE（創造/アイデア）"},{id:"SUMMARY",desc:"SUMMARY（要約/整理）"},{id:"NEGOTIATION",desc:"NEGOTIATION（交渉/説得）"},{id:"COACHING",desc:"COACHING（コーチング）"},{id:"DIAGNOSIS",desc:"DIAGNOSIS（診断/課題発見）"},{id:"FORECAST",desc:"FORECAST（予測/シナリオ）"},{id:"LEGAL",desc:"LEGAL（法務/規約）"},{id:"FINANCE",desc:"FINANCE（財務/投資）"},{id:"MARKETING",desc:"MARKETING（マーケ/集客）"},{id:"HR",desc:"HR（人材/組織）"},{id:"OPS",desc:"OPS（業務改善/効率化）"},{id:"TECH",desc:"TECH（技術/エンジニア）"}];

  const inputExamples = chatExamples;

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
    setLoadingStep(0);
    const _stepTimer = setInterval(()=>setLoadingStep(s=>Math.min(s+1,5)),1200);
    try {
      const sendText = text;
      const _isImgAttach = !!attachment && /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(attachment.filename||"");
      const _isFileReq2 = !!attachment && !_isImgAttach;
      const _isImageReq2 = _isImgAttach || (/画像|イメージ|イラスト|ロゴ|アイコン|バナー|生成して|描いて|作って/i.test(sendText) && !/解析|分析|読んで/.test(sendText));
      const _isInvestReq2 = /投資|銘柄|株|相場|シグナル|GOAL_BOTTOM|WATCH|底打ち|反発|買い|売り/i.test(sendText);
      let res;
      if (_isFileReq2 && attachment) {
        const { sendFileMessage } = await import("@/lib/api");
        res = await sendFileMessage(sendText, chatId, aiTier, attachment.extracted_text||"", attachment.filename||"");
      } else if (_isImageReq2) {
        // 画像添付の場合はb64を抽出して送信
        let _imgB64: string|undefined = undefined;
        let _imgMime: string|undefined = undefined;
        if (_isImgAttach && attachment?.extracted_text?.startsWith("__IMAGE_B64__:")) {
          const _parts = attachment.extracted_text.split(":");
          _imgMime = _parts[1];
          _imgB64 = _parts.slice(2).join(":");
        }
        const { sendImageMessage } = await import("@/lib/api");
        res = await sendImageMessage(sendText, chatId, aiTier, _imgB64, _imgMime);
      } else if (_isInvestReq2) {
        const { sendInvestMessage } = await import("@/lib/api");
        res = await sendInvestMessage(sendText, chatId, aiTier);
      } else {
        res = await sendMessage(sendText, chatId, aiTier, purposeMode);
      }
      const cases = res.cases||[];
      const images = res.images||[];
      setMessages(p=>[...p, {id:`a_${Date.now()}`, role:"assistant", content:res.reply, feedback:null, suggestions:cases, images, structured:res.structured||undefined}]);
      getUserStats().then(s=>{ setStats(s); if(s?.level_last_delta && s.level_last_delta!==0){ setScoreDelta(s.level_last_delta); setTimeout(()=>setScoreDelta(null),2500); } });
      getFcReport().then(setFcData);
    } catch(err:unknown) {
      const msg = err instanceof Error ? err.message : "エラー";
      setMessages(p=>[...p, {id:`e_${Date.now()}`, role:"assistant", content:"⚠️ "+msg}]);
    } finally { clearInterval(_stepTimer); setLoading(false); }
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
    const sliced = messages.slice(0, idx);
    setMessages(sliced);
    setEditingId(null);
    const val = editVal;
    setEditVal("");
    await new Promise(r => setTimeout(r, 50));
    const text = val.trim();
    if (!text || loading) return;
    setInput("");
    const userMsg: MsgExt = {
      id:`u_${Date.now()}`, role:"user",
      content: text,
    };
    setMessages(p=>[...p, userMsg]);
    setLoading(true);
    setLoadingStep(0);
    const _stepTimer = setInterval(()=>setLoadingStep(s=>Math.min(s+1,5)),1200);
    try {
      const _isImageReq2 = /画像|イメージ|イラスト|ロゴ|アイコン|バナー|生成して|描いて|作って/i.test(text) && !/解析|分析|読んで/.test(text);
      const _isInvestReq2 = /投資|銘柄|株|相場|シグナル|GOAL_BOTTOM|WATCH|底打ち|反発|買い|売り/i.test(text);
      let res;
      if (_isImageReq2) {
        const { sendImageMessage } = await import("@/lib/api");
        res = await sendImageMessage(text, chatId, aiTier);
      } else if (_isInvestReq2) {
        const { sendInvestMessage } = await import("@/lib/api");
        res = await sendInvestMessage(text, chatId, aiTier);
      } else {
        res = await sendMessage(text, chatId, aiTier, purposeMode);
      }
      clearInterval(_stepTimer);
      const cases = res.cases||[];
      const images = res.images||[];
      setMessages(p=>[...p, {id:`a_${Date.now()}`, role:"assistant", content:res.reply, feedback:null, suggestions:cases, images, structured:res.structured||undefined}]);
      getUserStats().then(s=>{ setStats(s); if(s?.level_last_delta && s.level_last_delta!==0){ setScoreDelta(s.level_last_delta); setTimeout(()=>setScoreDelta(null),2500); } });
      getFcReport().then(setFcData);
    } catch(err:unknown) {
      clearInterval(_stepTimer);
      const msg = err instanceof Error ? err.message : "エラー";
      setMessages(p=>[...p, {id:`e_${Date.now()}`, role:"assistant", content:"⚠️ "+msg}]);
    } finally { setLoading(false); }
  }

  async function handleFeedback(msgId: string, label: "good"|"bad", msgContent: string) {
    setMessages(p=>p.map(m=>m.id===msgId?{...m, feedback:label}:m));
    setFeedbackToast(label==="good" ? "👍 役立ったとして記録しました" : "💡 改善余地ありとして記録しました");
    setTimeout(()=>setFeedbackToast(""), 2500);
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
    const cid = await newSession();
    setSessions(s => [...s, {chat_id: cid, title: "新しいチャット"}]);
    setMessages([]);
    setChatId(cid);
    await new Promise(r => setTimeout(r, 800));
    await fetchSessions();
  }
  async function handleDelete() {
    if (!confirm("このチャットを削除しますか？")) return;
    const deletedId = chatId;
    setMessages([]);
    await deleteSession(deletedId);
    await new Promise(r => setTimeout(r, 800));
    const s = await listSessions();
    const next = s.filter(x => x.chat_id !== deletedId);
    if (next.length > 0) {
      setSessions(next);
      setChatId(next[0].chat_id);
      const h = await loadHistory(next[0].chat_id);
      setMessages(h.map((m,i)=>({...m, id:`hist_${i}_${Date.now()}`, suggestions: m.cases||[], structured: m.structured||undefined})));
    } else {
      const newId = await newSession();
      setSessions([{chat_id:newId, title:"新しいチャット"}]);
      setChatId(newId);
      setMessages([]);
    }
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
      <nav style={{background:C.nav, borderBottom:`1px solid ${C.border}`, backdropFilter:"blur(12px)", boxShadow:C.shadow}} className="flex-shrink-0 z-10">
        {/* 1行目: ASCEND（左）サブタイトル（中央）☰（右） */}
        <div className="flex items-center px-4 py-2 gap-2">
          <div className="flex items-center gap-2 flex-shrink-0">
            {theme?.logo_url ? (
              <img src={theme.logo_url} style={{height:`${theme.logo_size||32}px`,maxWidth:"120px",objectFit:"contain"}} alt="logo"/>
            ) : (
              <div style={{background:`linear-gradient(135deg,${theme?.color_primary||C.primary},${C.primary2})`,boxShadow:C.shadowPrimary}} className="w-7 h-7 rounded-lg flex items-center justify-center">
                <span className="text-white font-black text-xs">A</span>
              </div>
            )}
            <span className="font-black text-sm tracking-widest" style={{color:theme?.color_text_main||C.textMain}}>ASCEND</span>
          </div>
          <div className="flex-1 text-center">
            {headerCfg.subtitle && <span style={{color:C.primary,fontSize:"11px",fontWeight:600}}>{headerCfg.subtitle}</span>}
          </div>
          <button onClick={()=>setLeftOpen(!leftOpen)}
            style={{background:C.primary,color:"white",borderRadius:"10px",padding:"5px 12px",fontSize:"16px",border:"none",cursor:"pointer",flexShrink:0}}>☰</button>
        </div>
        {/* 2行目: AIエンジン + ユーザー 右寄せ */}
        <div className="flex items-center gap-2 px-4 pb-2 justify-end">
          <div style={{background:"rgba(79,70,229,0.08)",border:`1px solid ${C.borderPrimary}`,borderRadius:"10px"}} className="px-2 py-1 flex items-center gap-1">
            <span className="text-xs" style={{color:C.primary}}>⚡</span>
            <select value={aiTier} onChange={e=>setAiTier(e.target.value)} style={{background:"transparent",color:C.primary}} className="text-xs focus:outline-none cursor-pointer">
              <option value="core" style={{background:"#fff",color:"#111"}}>Core（標準）</option>
              {ultraEnabled && <option value="ultra" style={{background:"#fff",color:"#111"}}>Ultra（高精度）</option>}
              {apexEnabled  && <option value="apex"  style={{background:"#fff",color:"#111"}}>Apex（最上位）</option>}
            </select>
          </div>
          <button onClick={()=>router.push("/mypage")} style={{background:`linear-gradient(135deg,rgba(79,70,229,0.1),rgba(124,58,237,0.1))`,border:`1px solid ${C.borderPrimary}`,borderRadius:"10px",color:C.primary,display:"flex",alignItems:"center",gap:"4px",padding:"4px 8px 4px 4px"}} className="transition-all hover:opacity-80">
            <div style={{width:"20px",height:"20px",borderRadius:"50%",background:`linear-gradient(135deg,${C.primary},${C.primary2})`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              <span className="text-white font-black text-xs">{uid.charAt(0).toUpperCase()}</span>
            </div>
            <span className="font-bold text-xs">{uid}</span>
          </button>
        </div>
      </nav>

      <div className="flex flex-1 overflow-hidden">

        {/* LEFT SIDEBAR */}
        {leftOpen && (
          <aside style={{background:C.sidebar, borderRight:`1px solid ${C.border}`, width:"220px", overflowY:"auto", scrollbarWidth:"none"}} className="flex-shrink-0 flex flex-col [&::-webkit-scrollbar]:hidden">
            <div className="p-3 space-y-2" style={{minHeight:"min-content"}}>
              {/* サイドバータイトル */}
              <div className="flex items-center gap-2 pt-1 pb-2 px-1">
                <span style={{color:C.primary,fontWeight:900,fontSize:"13px",letterSpacing:"0.01em"}}>Ys Consulting Office</span>
              </div>
              {/* ランクスコア プレミアム */}
              {stats && (() => {
                const rankColors: Record<string,{bg:string,border:string,text:string,badge:string}> = {
                  default:{bg:"linear-gradient(135deg,#f8f9fc,#f1f2f6)",border:"rgba(0,0,0,0.1)",text:"#374151",badge:"linear-gradient(135deg,#6b7280,#9ca3af)"},
                };
                const rc = rankColors[stats.rank_name] || rankColors.default;
                const rankOrder = stats.rank_cfg ? [stats.rank_cfg.rank_1_name,stats.rank_cfg.rank_2_name,stats.rank_cfg.rank_3_name,stats.rank_cfg.rank_4_name] : [];
                const rankGradients = [
                  "linear-gradient(135deg,#9ca3af,#6b7280)",
                  "linear-gradient(135deg,#3b82f6,#2563eb)",
                  "linear-gradient(135deg,#f59e0b,#d97706)",
                  "linear-gradient(135deg,#8b5cf6,#6d28d9)",
                ];
                const curIdx = rankOrder.indexOf(stats.rank_name);
                const badgeGrad = rankGradients[curIdx] || rankGradients[0];
                const maxScore = [80,200,450,9999][Math.min(curIdx+1,3)];
                const minScore = [0,80,200,450][Math.max(curIdx,0)];
                const pct = Math.min(((stats.level_score-minScore)/Math.max(maxScore-minScore,1))*100,100);
                return (
                  <div style={{background:"linear-gradient(135deg,#fff,#f8f4ff)",border:`1px solid rgba(79,70,229,0.2)`,borderRadius:"14px",boxShadow:"0 2px 12px rgba(79,70,229,0.08)",overflow:"hidden"}} className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <div className="text-xs font-bold" style={{color:"#6b7280",letterSpacing:"0.08em"}}>RANK STATUS</div>
                        <div className="font-black text-base mt-0.5" style={{background:badgeGrad,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>{stats.rank_name}</div>
                      </div>
                      <div style={{background:badgeGrad,borderRadius:"10px",padding:"4px 10px",boxShadow:"0 2px 8px rgba(79,70,229,0.2)"}}>
                        <span className="text-white font-black text-sm">{stats.level_score.toLocaleString()}</span>
                        <span className="text-white text-xs ml-0.5 opacity-80">pt</span>
                        {scoreDelta!==null && <span style={{background:"rgba(255,255,255,0.25)",borderRadius:"6px",padding:"1px 5px",fontSize:"10px",fontWeight:900,marginLeft:"4px",animation:"fadeIn 0.3s"}}>{scoreDelta>0?"+":""}{scoreDelta}</span>}
                      </div>
                    </div>
                    {/* ランク進捗バー */}
                    <div style={{background:"rgba(0,0,0,0.06)",borderRadius:"99px",height:"4px",margin:"6px 0"}}>
                      <div style={{width:`${pct}%`,background:badgeGrad,borderRadius:"99px",height:"4px",transition:"width 0.6s ease"}}/>
                    </div>
                    <div className="text-xs" style={{color:"#9ca3af"}}>Next: {stats.next_pt}</div>
                    {/* ランク段階表示 */}
                    {rankOrder.length>0 && (
                      <div className="flex gap-1 mt-2">
                        {rankOrder.map((r,i)=>(
                          <div key={r} style={{flex:1,padding:"3px 0",textAlign:"center",background:r===stats.rank_name?rankGradients[i]:"rgba(0,0,0,0.04)",borderRadius:"6px",transition:"all 0.2s"}}>
                            <span style={{fontSize:"9px",fontWeight:r===stats.rank_name?"800":"500",color:r===stats.rank_name?"#fff":"#9ca3af"}}>{r}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
              <button onClick={handleNewSession} style={{background:`linear-gradient(135deg,${C.primary},${C.primary2})`, boxShadow:C.shadowPrimary}} className="w-full text-xs font-bold text-white rounded-xl py-2.5 hover:opacity-90 transition-all">
                ＋ 新しいチャット
              </button>
            </div>

            <div className="px-2 pb-2 space-y-0.5">
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
            {dm && (() => {
              const rank = String(dm.diagnosis_rank||"C");
              const rankGrad = rank==="S"?"linear-gradient(135deg,#f59e0b,#ef4444)":rank.startsWith("A")?"linear-gradient(135deg,#6366f1,#8b5cf6)":rank.startsWith("B")?"linear-gradient(135deg,#3b82f6,#06b6d4)":"linear-gradient(135deg,#6b7280,#9ca3af)";
              const dims = [
                {key:"Q",label:String(dm.label_q||"Q 意思決定精度"),val:Number(dm.decision_quality_score||0)},
                {key:"R",label:String(dm.label_r||"R リスク耐性"),val:Number(dm.risk_tolerance||0)},
                {key:"S",label:String(dm.label_s||"S 構造理解"),val:Number(dm.structural_intelligence||0)},
                {key:"V",label:String(dm.label_v||"V 判断速度"),val:Number(dm.decision_velocity||0)},
                {key:"P",label:String(dm.label_p||"P 予測精度"),val:Number(dm.prediction_accuracy||0)},
                {key:"E",label:String(dm.label_e||"E 実行一貫性"),val:Number(dm.execution_consistency||0)},
              ];
              const barColor = (v:number) => v>=80?"#6366f1":v>=65?"#3b82f6":v>=50?"#f59e0b":"#9ca3af";
              return (
                <div className="px-2 pb-2">
                  <div style={{background:"linear-gradient(135deg,#0f0c29,#302b63,#24243e)",borderRadius:"14px",boxShadow:"0 4px 20px rgba(99,102,241,0.25)",overflow:"hidden"}} className="p-3">
                    {/* ヘッダー */}
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <div style={{color:"rgba(255,255,255,0.5)",fontSize:"9px",letterSpacing:"0.15em",fontWeight:700}}>DIMENSION MATRIX</div>
                        <div style={{color:"rgba(255,255,255,0.9)",fontSize:"11px",fontWeight:800,marginTop:"1px"}}>意思決定精度診断</div>
                      </div>
                      <div style={{background:rankGrad,borderRadius:"10px",padding:"4px 10px",boxShadow:"0 0 12px rgba(99,102,241,0.4)"}}>
                        <span style={{color:"white",fontWeight:900,fontSize:"14px"}}>{rank}</span>
                      </div>
                    </div>
                    {/* 6指標 */}
                    <div className="space-y-2 mb-3">
                      {dims.map(d=>(
                        <div key={d.key}>
                          <div className="flex justify-between items-center mb-0.5">
                            <span style={{color:"rgba(255,255,255,0.6)",fontSize:"10px",fontWeight:600}}>{d.key}</span>
                            <span style={{color:"white",fontSize:"10px",fontWeight:700}}>{d.val.toFixed(0)}</span>
                          </div>
                          <div style={{background:"rgba(255,255,255,0.1)",borderRadius:"99px",height:"3px"}}>
                            <div style={{width:`${Math.min(d.val,100)}%`,background:barColor(d.val),borderRadius:"99px",height:"3px",transition:"width 0.6s ease",boxShadow:`0 0 6px ${barColor(d.val)}`}}/>
                          </div>
                        </div>
                      ))}
                    </div>
                    {/* TOTAL */}
                    <div style={{borderTop:"1px solid rgba(255,255,255,0.1)",paddingTop:"8px"}} className="flex justify-between items-center">
                      <span style={{color:"rgba(255,255,255,0.5)",fontSize:"10px",fontWeight:600}}>TOTAL SCORE</span>
                      <span style={{background:"linear-gradient(90deg,#f59e0b,#ef4444)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text",fontWeight:900,fontSize:"16px"}}>{Number(dm.diagnosis_total_score||0).toFixed(1)}</span>
                    </div>
                    <button onClick={()=>router.push("/mypage?tab=metrics")} style={{marginTop:"8px",width:"100%",background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:"8px",color:"rgba(255,255,255,0.8)",fontSize:"10px",fontWeight:600,padding:"5px 0",cursor:"pointer"}} className="hover:bg-white/15 transition-all">
                      📊 詳細を見る →
                    </button>
                  </div>
                </div>
              );
            })()}

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
          <div style={{background:C.card, borderBottom:`1px solid ${C.border}`}} className="flex items-center gap-1.5 px-4 py-2 overflow-x-auto flex-shrink-0">
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
          {/* フィードバックトースト */}
          {feedbackToast && (
            <div style={{position:"fixed",bottom:"80px",left:"50%",transform:"translateX(-50%)",background:"rgba(30,30,40,0.92)",color:"white",borderRadius:"12px",padding:"10px 24px",fontSize:"13px",fontWeight:600,zIndex:9999,boxShadow:"0 4px 20px rgba(0,0,0,0.3)",whiteSpace:"nowrap"}}>
              {feedbackToast}
            </div>
          )}
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
                  <p className="text-xl font-black mb-1" style={{color:C.textMain}}>{headerCfg.title||"Ys Consulting Office"}</p>
                  <p className="text-xs mt-1" style={{color:C.textMuted}}>何でも相談してください</p>
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
                                {/\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(m.attachment.filename||"") && m.attachment.extracted_text?.startsWith("__IMAGE_B64__:") && (()=>{
                                  const _p = m.attachment.extracted_text.split(":");
                                  const _mime = _p[1]||"image/jpeg";
                                  const _b64 = _p.slice(2).join(":");
                                  return <img src={`data:${_mime};base64,${_b64}`} alt={m.attachment.filename} className="mt-2 max-w-full rounded-lg" style={{maxHeight:"200px",objectFit:"contain"}} onError={e=>{(e.target as HTMLImageElement).style.display="none"}}/>;
                                })()}
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
                        {(()=>{
                          // JSON構造カード描画（consultResult系）
                          try {
                            const _s = (m.content||"").trim();
                            if (_s.startsWith("{") || _s.startsWith("```json")) {
                              const _clean = _s.replace(/^```json\s*/,"").replace(/\s*```$/,"").trim();
                              const _j = JSON.parse(_clean);
                              // structure診断
                              if (_j.summary && _j.structure_layers) return (
                                <div className="space-y-2">
                                  <div style={{background:"rgba(79,70,229,0.06)",border:`1px solid ${C.borderPrimary}`,borderRadius:"12px",padding:"10px 14px"}}>
                                    <p className="text-xs font-bold mb-1" style={{color:C.primary}}>📊 総合評価</p>
                                    <p className="text-sm" style={{color:C.textMain}}>{_j.summary}</p>
                                  </div>
                                  {(_j.structure_layers||[]).map((l:Record<string,unknown>,i:number)=>(
                                    <div key={i} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:"10px",padding:"8px 12px",display:"flex",gap:"10px",alignItems:"flex-start"}}>
                                      <span style={{background:`linear-gradient(135deg,${C.primary},${C.primary2})`,color:"white",borderRadius:"6px",padding:"2px 8px",fontSize:"10px",fontWeight:700,flexShrink:0}}>{String(l.layer||"")}</span>
                                      <div><p className="text-xs" style={{color:C.textMain}}>{String(l.content||"")}</p></div>
                                    </div>
                                  ))}
                                  {_j.key_bottleneck && <div style={{background:"rgba(239,68,68,0.06)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:"10px",padding:"8px 12px"}}><p className="text-xs font-bold" style={{color:"#dc2626"}}>🎯 主要ボトルネック: {String(_j.key_bottleneck)}</p></div>}
                                  {(_j.next_actions||[]).length>0 && <div style={{background:"rgba(16,185,129,0.06)",border:"1px solid rgba(16,185,129,0.2)",borderRadius:"10px",padding:"8px 12px"}}><p className="text-xs font-bold mb-1" style={{color:"#059669"}}>✅ 推奨アクション</p>{(_j.next_actions||[]).map((a:string,i:number)=><p key={i} className="text-xs" style={{color:C.textMain}}>• {a}</p>)}</div>}
                                </div>
                              );
                              // issue診断
                              if (_j.hypotheses && _j.root_cause) return (
                                <div className="space-y-2">
                                  {(_j.hypotheses||[]).map((h:Record<string,unknown>,i:number)=>(
                                    <div key={i} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:"10px",padding:"10px 14px"}}>
                                      <div className="flex gap-2 items-center mb-1">
                                        <span style={{background:h.priority==="high"?"rgba(239,68,68,0.1)":h.priority==="mid"?"rgba(245,158,11,0.1)":"rgba(16,185,129,0.1)",color:h.priority==="high"?"#dc2626":h.priority==="mid"?"#d97706":"#059669",borderRadius:"6px",padding:"1px 8px",fontSize:"10px",fontWeight:700}}>{String(h.priority||"").toUpperCase()}</span>
                                        <p className="text-xs font-bold" style={{color:C.textMain}}>{String(h.hypothesis||"")}</p>
                                      </div>
                                      <p className="text-xs" style={{color:C.textSub}}>根拠: {String(h.evidence||"")}</p>
                                    </div>
                                  ))}
                                  <div style={{background:"rgba(79,70,229,0.06)",border:`1px solid ${C.borderPrimary}`,borderRadius:"10px",padding:"8px 12px"}}><p className="text-xs font-bold" style={{color:C.primary}}>🔍 根本原因: {String(_j.root_cause)}</p></div>
                                </div>
                              );
                              // execution計画
                              if (_j.phases && _j.critical_path) return (
                                <div className="space-y-2">
                                  {(_j.phases||[]).map((p:Record<string,unknown>,i:number)=>(
                                    <div key={i} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:"10px",padding:"10px 14px"}}>
                                      <div className="flex gap-2 items-center mb-1">
                                        <span style={{background:`linear-gradient(135deg,${C.primary},${C.primary2})`,color:"white",borderRadius:"6px",padding:"2px 8px",fontSize:"10px",fontWeight:700}}>{String(p.phase||"")}</span>
                                        <span className="text-xs" style={{color:C.textMuted}}>{String(p.duration||"")}</span>
                                      </div>
                                      {(p.actions as string[]||[]).map((a:string,j:number)=><p key={j} className="text-xs" style={{color:C.textMain}}>• {a}</p>)}
                                      {p.kpi ? <p className="text-xs mt-1" style={{color:C.primary}}>KPI: {String(p.kpi)}</p> : null}
                                    </div>
                                  ))}
                                </div>
                              );
                            }
                          } catch {}
                          // 構造化カードUI
                          if (m.structured) {
                            const _s = m.structured as {summary:string;cards:{current:string[];risk:string[];plan:string[]};analysis:{type:string;urgency:string;importance:string;mode:string};actions:string[];value_message:string};
                            const _modeColor: Record<string,string> = {NUMERIC:"#059669",STRATEGY:"#6366f1",CONTROL:"#0891b2",RISK:"#dc2626",MARKETING:"#db2777",GROWTH:"#d97706",DIAGNOSIS:"#7c3aed",PLANNING:"#0891b2",FORECAST:"#475569",FINANCE:"#059669",HR:"#d97706",CREATIVE:"#db2777",NEGOTIATION:"#dc2626",AUTO:"#6366f1"};
                            const _mc = _modeColor[(_s.analysis?.mode||"").toUpperCase()]||"#6366f1";
                            return (
                              <div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
                                {/* 結論バー */}
                                <div style={{background:"linear-gradient(135deg,#0f0c29,#1e1b4b)",borderRadius:"10px",padding:"12px 16px",borderLeft:"3px solid #6366f1"}}>
                                  <p style={{color:"rgba(255,255,255,0.35)",fontSize:"9px",fontWeight:700,letterSpacing:"0.15em",marginBottom:"5px"}}>CONCLUSION</p>
                                  <p style={{color:"white",fontSize:"13px",fontWeight:700,lineHeight:1.6}}>{_s.summary}</p>
                                </div>
                                {/* 3分割カード */}
                                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"6px"}}>
                                  {([["現状整理","#0891b2",_s.cards?.current],["問題・リスク","#dc2626",_s.cards?.risk],["推奨方針","#059669",_s.cards?.plan]] as [string,string,string[]][]).map(([title,color,items])=>(
                                    <div key={title} style={{background:`${color}08`,border:`1px solid ${color}22`,borderRadius:"10px",padding:"10px 11px"}}>
                                      <p style={{color,fontSize:"10px",fontWeight:800,marginBottom:"6px",letterSpacing:"0.04em"}}>{title}</p>
                                      {(items||[]).map((item,i)=>(
                                        <div key={i} style={{display:"flex",gap:"4px",marginBottom:"4px",alignItems:"flex-start"}}>
                                          <span style={{color,fontSize:"9px",marginTop:"3px",flexShrink:0}}>▸</span>
                                          <p style={{color:C.textSub,fontSize:"11px",lineHeight:1.5}}>{item}</p>
                                        </div>
                                      ))}
                                    </div>
                                  ))}
                                </div>
                                {/* AI解析ボックス */}
                                <div style={{background:"linear-gradient(135deg,rgba(79,70,229,0.05),rgba(124,58,237,0.03))",border:"1px solid rgba(79,70,229,0.12)",borderRadius:"10px",padding:"10px 14px"}}>
                                  <p style={{color:C.primary,fontSize:"9px",fontWeight:800,letterSpacing:"0.15em",marginBottom:"7px"}}>AI ANALYSIS</p>
                                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"5px"}}>
                                    {([["論点タイプ",_s.analysis?.type||"—"],["緊急度",_s.analysis?.urgency||"—"],["重要度",_s.analysis?.importance||"—"],["推奨モード",_s.analysis?.mode||purposeMode]] as [string,string][]).map(([k,v])=>(
                                      <div key={k} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:"rgba(255,255,255,0.65)",borderRadius:"7px",padding:"5px 9px"}}>
                                        <span style={{color:C.textMuted,fontSize:"10px"}}>{k}</span>
                                        <span style={{color:k==="推奨モード"?_mc:C.primary,fontSize:"11px",fontWeight:700}}>{v}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                                {/* 次アクション */}
                                {(_s.actions||[]).length>0 && (
                                  <div>
                                    <p style={{color:C.textMuted,fontSize:"9px",fontWeight:700,letterSpacing:"0.12em",marginBottom:"5px"}}>NEXT ACTION</p>
                                    <div style={{display:"flex",flexWrap:"wrap" as const,gap:"5px"}}>
                                      {(_s.actions||[]).map((a:string,i:number)=>(
                                        <button key={i} onClick={()=>setInput(a)}
                                          style={{background:`linear-gradient(135deg,${C.primary},${C.primary2})`,borderRadius:"99px",padding:"5px 13px",border:"none",cursor:"pointer",boxShadow:C.shadowPrimary,color:"white",fontSize:"11px",fontWeight:600}}>
                                          {a}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {/* 診断ページ連携 */}
                                <div style={{borderTop:`1px solid ${C.border}`,paddingTop:"8px"}}>
                                  <p style={{color:C.textMuted,fontSize:"9px",fontWeight:700,letterSpacing:"0.12em",marginBottom:"5px"}}>🔬 診断ページで深掘り</p>
                                  <div style={{display:"flex",flexWrap:"wrap" as const,gap:"4px"}}>
                                    {([["🏗️","構造診断","structure","事業・組織の構造を解剖しボトルネックを特定"],["🎯","課題仮説","issue","状況から課題仮説を優先度付きで生成"],["⚖️","比較分析","comparison","複数案を多軸で客観比較し推奨案を提示"],["⚡","矛盾検知","contradiction","戦略・方針間の矛盾と整合性を検証"],["📋","実行計画","execution","フェーズ別・期限付きアクションプランを生成"]] as [string,string,string,string][]).map(([icon,label,tab,desc])=>(
                                      <button key={tab} onClick={()=>{
                                        const _input = encodeURIComponent([_s.summary,"\n\n【現状】\n"+(_s.cards?.current||[]).join("\n"),"\n\n【問題・リスク】\n"+(_s.cards?.risk||[]).join("\n"),"\n\n【推奨方針】\n"+(_s.cards?.plan||[]).join("\n")].join(""));
                                        window.location.href="/diagnosis?tab="+tab+"&input="+_input;
                                      }}
                                        title={desc}
                                        style={{background:"rgba(79,70,229,0.1)",border:"1px solid rgba(79,70,229,0.25)",borderRadius:"8px",padding:"4px 10px",color:"#6366f1",fontSize:"10px",fontWeight:600,cursor:"pointer",whiteSpace:"nowrap" as const,display:"flex",flexDirection:"column" as const,alignItems:"flex-start" as const,gap:"1px"}}>
                                        <span>{icon} {label}</span>
                                        <span style={{color:"rgba(99,102,241,0.6)",fontSize:"9px",fontWeight:400}}>{desc}</span>
                                      </button>
                                    ))}
                                  </div>
                                </div>

                                {/* 価値訴求 */}
                                {_s.value_message && (
                                  <div style={{borderTop:`1px solid ${C.border}`,paddingTop:"7px"}}>
                                    <p style={{color:C.textMuted,fontSize:"10px",fontStyle:"italic",textAlign:"center" as const}}>{_s.value_message}</p>
                                  </div>
                                )}
                              </div>
                            );
                          }
                          // 構造化カードUI
                          if (m.structured) {
                            const _s = m.structured as {summary:string;cards:{current:string[];risk:string[];plan:string[]};analysis:{type:string;urgency:string;importance:string;mode:string};actions:string[];value_message:string};
                            const _modeColor: Record<string,string> = {NUMERIC:"#059669",STRATEGY:"#6366f1",CONTROL:"#0891b2",RISK:"#dc2626",MARKETING:"#db2777",GROWTH:"#d97706",DIAGNOSIS:"#7c3aed",PLANNING:"#0891b2",FORECAST:"#475569",FINANCE:"#059669",HR:"#d97706",CREATIVE:"#db2777",NEGOTIATION:"#dc2626",AUTO:"#6366f1"};
                            const _mc = _modeColor[(_s.analysis?.mode||"").toUpperCase()]||"#6366f1";
                            return (
                              <div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
                                <div style={{background:"linear-gradient(135deg,#0f0c29,#1e1b4b)",borderRadius:"10px",padding:"12px 16px",borderLeft:"3px solid #6366f1"}}>
                                  <p style={{color:"rgba(255,255,255,0.35)",fontSize:"9px",fontWeight:700,letterSpacing:"0.15em",marginBottom:"5px"}}>CONCLUSION</p>
                                  <p style={{color:"white",fontSize:"13px",fontWeight:700,lineHeight:1.6}}>{_s.summary}</p>
                                </div>
                                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"6px"}}>
                                  {([["現状整理","#0891b2",_s.cards?.current],["問題・リスク","#dc2626",_s.cards?.risk],["推奨方針","#059669",_s.cards?.plan]] as [string,string,string[]][]).map(([title,color,items])=>(
                                    <div key={title} style={{background:`${color}08`,border:`1px solid ${color}22`,borderRadius:"10px",padding:"10px 11px"}}>
                                      <p style={{color,fontSize:"10px",fontWeight:800,marginBottom:"6px",letterSpacing:"0.04em"}}>{title}</p>
                                      {(items||[]).map((item,i)=>(
                                        <div key={i} style={{display:"flex",gap:"4px",marginBottom:"4px",alignItems:"flex-start"}}>
                                          <span style={{color,fontSize:"9px",marginTop:"3px",flexShrink:0}}>▸</span>
                                          <p style={{color:C.textSub,fontSize:"11px",lineHeight:1.5}}>{item}</p>
                                        </div>
                                      ))}
                                    </div>
                                  ))}
                                </div>
                                <div style={{background:"linear-gradient(135deg,rgba(79,70,229,0.05),rgba(124,58,237,0.03))",border:"1px solid rgba(79,70,229,0.12)",borderRadius:"10px",padding:"10px 14px"}}>
                                  <p style={{color:C.primary,fontSize:"9px",fontWeight:800,letterSpacing:"0.15em",marginBottom:"7px"}}>AI ANALYSIS</p>
                                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"5px"}}>
                                    {([["論点タイプ",_s.analysis?.type||"—"],["緊急度",_s.analysis?.urgency||"—"],["重要度",_s.analysis?.importance||"—"],["推奨モード",_s.analysis?.mode||purposeMode]] as [string,string][]).map(([k,v])=>(
                                      <div key={k} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:"rgba(255,255,255,0.65)",borderRadius:"7px",padding:"5px 9px"}}>
                                        <span style={{color:C.textMuted,fontSize:"10px"}}>{k}</span>
                                        <span style={{color:k==="推奨モード"?_mc:C.primary,fontSize:"11px",fontWeight:700}}>{v}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                                {(_s.actions||[]).length>0 && (
                                  <div>
                                    <p style={{color:C.textMuted,fontSize:"9px",fontWeight:700,letterSpacing:"0.12em",marginBottom:"5px"}}>NEXT ACTION</p>
                                    <div style={{display:"flex",flexWrap:"wrap" as const,gap:"5px"}}>
                                      {(_s.actions||[]).map((a:string,i:number)=>(
                                        <button key={i} onClick={()=>setInput(a)}
                                          style={{background:`linear-gradient(135deg,${C.primary},${C.primary2})`,borderRadius:"99px",padding:"5px 13px",border:"none",cursor:"pointer",boxShadow:C.shadowPrimary,color:"white",fontSize:"11px",fontWeight:600}}>
                                          {a}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {_s.value_message && (
                                  <div style={{borderTop:`1px solid ${C.border}`,paddingTop:"7px"}}>
                                    <p style={{color:C.textMuted,fontSize:"10px",fontStyle:"italic",textAlign:"center" as const}}>{_s.value_message}</p>
                                  </div>
                                )}
                              </div>
                            );
                          }
                          // フォールバック: 通常Markdown
                          return (
                            <div className="prose prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-gray-200 [&_td]:px-2 [&_td]:py-1.5 [&_td]:text-xs [&_th]:border [&_th]:border-gray-200 [&_th]:px-2 [&_th]:py-1.5 [&_th]:bg-indigo-50 [&_th]:text-xs [&_code]:bg-indigo-50 [&_code]:px-1 [&_code]:rounded [&_code]:text-xs" style={{color:C.textMain}}>
                              <ReactMarkdown>{m.content}</ReactMarkdown>
                            </div>
                          );
                        })()}
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
                <div style={{background:C.card, border:`1px solid ${C.border}`, borderRadius:"4px 18px 18px 18px", boxShadow:C.shadow}} className="px-5 py-3.5">
                  {(()=>{
                    const _lastUser = [...messages].reverse().find(m=>m.role==="user");
                    const _txt = (_lastUser?.content||"").toLowerCase();
                    const _hasFile = !!_lastUser?.attachment||["pdf","excel","csv","スプレッドシート","ファイル","xlsx"].some(w=>_txt.includes(w));
                    const _hasImgGen = ["イラスト","ロゴ","バナー","アイコン","illustration","生成して","描いて","作って"].some(w=>_txt.includes(w)) && !["解析","分析","読んで"].some(w=>_txt.includes(w));
                    const _hasImgAnalyze = !!_lastUser?.images?.length;
                    const _steps = _hasFile
                      ? ["ファイルを受信中...","内容を解析中...","構造を把握中...","インサイトを生成中...","回答を構築中...","最終調整中..."]
                      : _hasImgAnalyze
                      ? ["画像を受信中...","画像を解析中...","内容を把握中...","インサイトを抽出中...","回答を構築中...","最終調整中..."]
                      : _hasImgGen
                      ? ["リクエストを解析中...","プロンプトを設計中...","画像を生成中...","品質を検証中...","出力を最適化中...","仕上げ中..."]
                      : ["入力を解析中...","意図を特定中...","ナレッジを検索中...","回答を構築中...","構造を解析中...","回答を整形中..."];
                    const _label = _steps[Math.min(loadingStep,_steps.length-1)];
                    return (
                      <div className="flex items-center gap-2.5">
                        <div style={{display:"flex",gap:"3px",alignItems:"center"}}>
                          {[0,1,2].map(i=>(
                            <div key={i} style={{width:"5px",height:"5px",borderRadius:"99px",background:C.primary,opacity:(loadingStep+i)%3===0?1:0.25,transition:"opacity 0.4s ease"}}/>
                          ))}
                        </div>
                        <span className="text-xs font-semibold" style={{color:C.primary}}>{_label}</span>
                      </div>
                    );
                  })()}
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

          {/* 推奨モード表示 */}
          {(()=>{
            const _ALL_MODES: {id:string;label:string;keywords:string[];color:string}[] = [
              {id:"NUMERIC",   label:"NUMERIC",   color:"#059669", keywords:["売上","収益","利益","コスト","KPI","数値","指標","ROI","単価","客数","率","％","%","万円","億","数字","計算","集計","平均","合計","目標値","実績"]},
              {id:"STRATEGY",  label:"STRATEGY",  color:"#6366f1", keywords:["戦略","競合","差別化","ポジション","市場","参入","撤退","M&A","シェア","優位","方向性","方針","どう戦う","勝ち方","強み","弱み","機会","脅威","ブルーオーシャン"]},
              {id:"CONTROL",   label:"CONTROL",   color:"#0891b2", keywords:["組織","チーム","権限","管理","属人","マネジメント","構造","フロー","体制","部下","仕組み","ルール","制度","標準化","プロセス","役割","分担","指示","命令","統制"]},
              {id:"GROWTH",    label:"GROWTH",    color:"#d97706", keywords:["成長","スキル","習慣","訓練","改善","学習","育成","キャリア","目標設定","自己","メンタル","モチベ","継続","伸ばす","強化","向上","レベルアップ","鍛える","できるようになる"]},
              {id:"ANALYSIS",  label:"ANALYSIS",  color:"#7c3aed", keywords:["分析","解析","原因","要因","データ","トレンド","比較","評価","調査"]},
              {id:"PLANNING",  label:"PLANNING",  color:"#0891b2", keywords:["計画","ロードマップ","スケジュール","フェーズ","工程","マイルストーン","期限","手順","段取り","ステップ","いつまでに","何から","順番","優先順位","タスク","todo","やること"]},
              {id:"RISK",      label:"RISK",      color:"#dc2626", keywords:["リスク","危機","不安","失敗","損失","撤退","最悪","備え","保険","ヘッジ","怖い","心配","危ない","トラブル","問題","クレーム","炎上","倒産","赤字","訴訟","法的","ペナルティ"]},
              {id:"MARKETING", label:"MARKETING", color:"#db2777", keywords:["集客","マーケ","SNS","広告","ブランド","認知","リピート","新規","LP","CV","宣材","写真","予約","ネット予約","Instagram","集める","来店","来客","反応","フォロー","投稿","バズ","バナー","撮影","構図","ポーズ","プロフィール","見た目","印象","写り","映え","集患","口コミ","評判","レビュー"]},
              {id:"DIAGNOSIS", label:"DIAGNOSIS", color:"#7c3aed", keywords:["診断","課題","問題","ボトルネック","なぜ","原因","根本","改善点","うまくいかない","停滞","低下","落ちた","減った","悪化","把握","特定","解明","分からない"]},
              {id:"FORECAST",  label:"FORECAST",  color:"#475569", keywords:["予測","シナリオ","将来","見通し","予想","見込み","展望","今後","これから","先読み","トレンド","変化","未来","長期","中期","短期","どうなる"]},
              {id:"FINANCE",   label:"FINANCE",   color:"#059669", keywords:["財務","資金","融資","投資","キャッシュ","借入","資本","株","決算","BS","PL","銀行","借金","返済","利息","節税","税金","経費","補助金","助成金","資金繰り"]},
              {id:"HR",        label:"HR",        color:"#d97706", keywords:["採用","人材","評価","離職","組織設計","給与","人事","研修","面接","求人","スタッフ","従業員","社員","パート","アルバイト","チームビルド","文化","エンゲージメント","定着","退職"]},
              {id:"NEGOTIATION",label:"NEGOTIATION",color:"#dc2626",keywords:["交渉","説得","条件","合意","契約","価格交渉","提案","折衝","値引き","値上げ","断り方","断る","お願い","依頼","相手","どう伝える","伝え方","コミュニケーション"]},
              {id:"CREATIVE",  label:"CREATIVE",  color:"#db2777", keywords:["アイデア","企画","発想","コンセプト","デザイン","新しい","ユニーク","差別化","面白い","斬新","クリエイティブ","ネーミング","キャッチコピー","コンテンツ","企画書"]},
              {id:"SUMMARY",   label:"SUMMARY",   color:"#475569", keywords:["要約","まとめ","整理","簡潔","ポイント","サマリー"]},
              {id:"LEGAL",     label:"LEGAL",     color:"#374151", keywords:["法務","規約","契約","法律","コンプライアンス","規制","許認可","利用規約"]},
              {id:"COACHING",  label:"COACHING",  color:"#0891b2", keywords:["コーチング","自己","内省","気づき","変革","マインド","思考パターン"]},
              {id:"OPS",       label:"OPS",       color:"#0f766e", keywords:["業務","オペレーション","効率","工数","標準化","自動化","改善","無駄","ボトルネック","フロー整理","作業","手作業","システム化","デジタル化","DX","省力化","時短","生産性"]},
              {id:"TECH",      label:"TECH",      color:"#1d4ed8", keywords:["技術","エンジニア","システム","アーキテクチャ","実装","API","DB","インフラ","開発","コード","プログラム","ソフトウェア","ハードウェア","クラウド","サーバー","セキュリティ","バグ","エラー"]},
            ];
            if (input.trim().length < 8) return null;
            const _txt = input.toLowerCase();
            const _matched = _ALL_MODES.filter(m => m.keywords.some(k => _txt.includes(k))).slice(0, 4);
            if (_matched.length === 0) return null;
            const _top = _matched[0];
            const _subs = _matched.slice(1);
            return (
              <div style={{borderTop:`1px solid ${C.border}`,background:C.card,padding:"7px 16px 5px"}} className="flex-shrink-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span style={{color:C.textMuted,fontSize:"9px",fontWeight:700,letterSpacing:"0.12em",flexShrink:0}}>推奨モード</span>
                  {/* 最推奨 */}
                  {(()=>{
                    const m = _top;
                    const _enabledIds = purposeModesData.length > 0 ? purposeModesData.map(p=>p.id.toUpperCase()) : null;
                    const _unlocked = !_enabledIds || _enabledIds.includes(m.id.toUpperCase());
                    const _active = purposeMode===m.id;
                    return (
                      <div style={{position:"relative" as const}} className="group">
                        <button onClick={()=>{ if(_unlocked) setPurposeMode(m.id); }}
                          style={{
                            background: _active ? m.color : _unlocked ? m.color : "rgba(0,0,0,0.04)",
                            border: `1px solid ${_unlocked ? m.color : "rgba(0,0,0,0.1)"}`,
                            borderRadius:"99px", padding:"4px 12px",
                            cursor: _unlocked ? "pointer" : "not-allowed",
                            color: _unlocked ? "white" : "#9ca3af",
                            fontSize:"11px", fontWeight:800, transition:"all 0.15s",
                            boxShadow: _unlocked ? `0 2px 10px ${m.color}66` : "none",
                            opacity: _unlocked ? 1 : 0.6,
                            display:"flex", alignItems:"center", gap:"4px",
                          }}>
                          <span style={{fontSize:"9px",opacity:0.8}}>★</span>
                          {m.label}{_active ? " ✓" : ""}{!_unlocked ? " 🔒" : ""}
                        </button>
                        {!_unlocked && (
                          <div style={{position:"absolute" as const,bottom:"calc(100% + 6px)",left:"50%",transform:"translateX(-50%)",background:"#1f2937",color:"white",fontSize:"9px",fontWeight:600,padding:"4px 8px",borderRadius:"6px",whiteSpace:"nowrap" as const,pointerEvents:"none" as const,opacity:0,transition:"opacity 0.15s",zIndex:50}} className="group-hover:opacity-100">
                            管理者からの権限付与が必要です
                          </div>
                        )}
                      </div>
                    );
                  })()}
                  {/* サブ候補 */}
                  {_subs.length > 0 && <span style={{color:C.textMuted,fontSize:"9px",margin:"0 2px"}}>／</span>}
                  {_subs.map(m=>{
                    const _enabledIds = purposeModesData.length > 0 ? purposeModesData.map(p=>p.id.toUpperCase()) : null;
                    const _unlocked = !_enabledIds || _enabledIds.includes(m.id.toUpperCase());
                    const _active = purposeMode===m.id;
                    return (
                      <div key={m.id} style={{position:"relative" as const}} className="group">
                        <button onClick={()=>{ if(_unlocked) setPurposeMode(m.id); }}
                          style={{
                            background: _active ? m.color : _unlocked ? `${m.color}10` : "rgba(0,0,0,0.03)",
                            border: `1px solid ${_active ? m.color : _unlocked ? `${m.color}35` : "rgba(0,0,0,0.08)"}`,
                            borderRadius:"99px", padding:"3px 9px",
                            cursor: _unlocked ? "pointer" : "not-allowed",
                            color: _active ? "white" : _unlocked ? m.color : "#9ca3af",
                            fontSize:"9px", fontWeight:600, transition:"all 0.15s",
                            opacity: _unlocked ? 0.85 : 0.5,
                          }}>
                          {m.label}{_active ? " ✓" : ""}{!_unlocked ? " 🔒" : ""}
                        </button>
                        {!_unlocked && (
                          <div style={{position:"absolute" as const,bottom:"calc(100% + 6px)",left:"50%",transform:"translateX(-50%)",background:"#1f2937",color:"white",fontSize:"9px",fontWeight:600,padding:"4px 8px",borderRadius:"6px",whiteSpace:"nowrap" as const,pointerEvents:"none" as const,opacity:0,transition:"opacity 0.15s",zIndex:50}} className="group-hover:opacity-100">
                            管理者からの権限付与が必要です
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
          {/* 入力エリア */}
          <div style={{background:C.card, borderTop:`1px solid ${C.border}`, backdropFilter:"blur(12px)"}} className="px-4 py-3 flex-shrink-0">
            <form onSubmit={handleSend} className="flex gap-2 items-end">
              <input ref={fileRef} type="file" onChange={handleFileChange} className="hidden" accept=".txt,.md,.csv,.pdf,.xlsx,.xls,.json,.py,.js,.ts,.png,.jpg,.jpeg,.webp"/>
              <div style={{background:"rgba(0,0,0,0.02)",border:`1px solid ${C.border}`,borderRadius:"16px",display:"flex",alignItems:"flex-end",gap:"4px",padding:"6px 8px 6px 8px"}} className="flex-1 focus-within:border-indigo-400 transition-all">
                <button type="button" onClick={()=>fileRef.current?.click()} disabled={attachLoading}
                  style={{background:"transparent",border:"none",borderRadius:"8px",color:C.textMuted,padding:"6px",flexShrink:0,fontSize:"16px",lineHeight:1,cursor:"pointer"}}
                  className="hover:text-indigo-500 transition-all disabled:opacity-50">
                  {attachLoading ? "⏳" : "🗂️"}
                </button>
                <button type="button" onClick={()=>setShowInputExample(!showInputExample)}
                  style={{background:"transparent",border:"none",borderRadius:"8px",color:C.textMuted,padding:"6px",flexShrink:0,fontSize:"16px",lineHeight:1,cursor:"pointer"}}
                  className="hover:text-yellow-500 transition-all">💡</button>
                <textarea value={input} onChange={e=>setInput(e.target.value)}
                  onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();handleSend(e as unknown as React.FormEvent);}}}
                  disabled={loading} placeholder="コンサルタントに相談... (Shift+Enterで改行)"
                  rows={1} style={{background:"transparent",resize:"none",minHeight:"36px",maxHeight:"160px",color:C.textMain,flex:1}}
                  className="text-sm px-2 py-1.5 focus:outline-none placeholder-gray-400 disabled:opacity-50 leading-relaxed"
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
