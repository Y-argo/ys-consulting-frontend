"use client";
import React, { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
const ReactMarkdown = dynamic(() => import("react-markdown"), { ssr: false, loading: () => null });
const FileDiagnosis = dynamic(() => import("./FileDiagnosis"), { ssr: false, loading: () => null });
const PresentationTool = dynamic(() => import("../mypage/PresentationTool"), { ssr: false, loading: () => null });
const CustomerManagement = dynamic(() => import("./CustomerManagement"), { ssr: false, loading: () => null });
import { getStoredUser, getUserStats, UserStats, getMyFeatures } from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || "https://ys-consulting-api-665881683479.asia-northeast1.run.app";

function authHeaders(): HeadersInit {
  const token = typeof window !== "undefined" ? localStorage.getItem("ascend_token") || "" : "";
  return token ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` } : { "Content-Type": "application/json" };
}

type TabId = "diagnosis"|"structure"|"issue"|"comparison"|"contradiction"|"execution"|"investment"|"graph"|"file"|"presentation"|"future"|"profile"|"crm";

const C = {
  bg:"#f8f9fc", card:"#ffffff", primary:"#4f46e5", primary2:"#7c3aed",
  textMain:"#111827", textSub:"#6b7280", textMuted:"#9ca3af",
  border:"rgba(0,0,0,0.08)", borderPrimary:"rgba(79,70,229,0.2)",
  shadow:"0 1px 3px rgba(0,0,0,0.08)", shadowMd:"0 4px 16px rgba(0,0,0,0.08)",
  shadowPrimary:"0 4px 16px rgba(79,70,229,0.2)",
};

function DiagnosisPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<TabId>("diagnosis");
  const [tabMenuOpen, setTabMenuOpen] = useState(false);
  const graphRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState("");
  const [history, setHistory] = useState<{doc_id:string;report_md:string;created_at:string}[]>([]);
  const [error, setError] = useState("");
  // コンサルAI
  const [inputText, setInputText] = useState("");
  const [inputMap, setInputMap] = useState<Record<string,string>>({});
  const getInput = (t:string) => inputMap[t] ?? "";
  const setInput = (t:string, v:string) => setInputMap(m=>({...m,[t]:v}));
  const [supplement, setSupplement] = useState("");
  const [options, setOptions] = useState("");
  const [strategy, setStrategy] = useState("");
  const [policy, setPolicy] = useState("");
  const [consultResult, setConsultResult] = useState<Record<string,unknown>|null>(null);
  const [consultHistory, setConsultHistory] = useState<{analysis_type:string;input_text:string;result:Record<string,unknown>;created_at:string}[]>([]);
  const [frameworks, setFrameworks] = useState<{name:string;description:string;active:boolean}[]>([]);
  // 投資シグナル
  const [signals, setSignals] = useState<{goal_bottom:Record<string,unknown>[];watch_big_sell:Record<string,unknown>[];asof_date:string}|null>(null);
  const [analysisData, setAnalysisData] = useState<Record<string,any>|null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [stockSearch, setStockSearch] = useState("");
  const [stockSortKey, setStockSortKey] = useState("rank_score");
  const [showAllStocks, setShowAllStocks] = useState(false);
  const [stats, setStats] = useState<UserStats|null>(null);
  const [chatMessages, setChatMessages] = useState<{role:string;content:string}[]>([]);
  const [features, setFeatures] = useState<Record<string,boolean>>({});
  const [featuresLoaded, setFeaturesLoaded] = useState(false);
  const [profileInput, setProfileInput] = useState<Record<string,string>>({});
  const [profileResult, setProfileResult] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileHistory, setProfileHistory] = useState<{doc_id:string;target_name:string;created_at:string;summary:string;result?:any}[]>([]);
  const [issueHistory, setIssueHistory] = useState<any[]>([]);
  const [structureHistory, setStructureHistory] = useState<any[]>([]);
  const [profileError, setProfileError] = useState("");
  const [profileQuestions, setProfileQuestions] = useState<Record<string,string[]>|null>(null);
  const [profileQuestionsLoading, setProfileQuestionsLoading] = useState(false);
  const [profileAnswer, setProfileAnswer] = useState("");
  const [profileAnswerLoading, setProfileAnswerLoading] = useState(false);
  const [profileCustomQuestion, setProfileCustomQuestion] = useState("");
  const [profileAnsweredQuestion, setProfileAnsweredQuestion] = useState("");
  const [profileGuideOpen, setProfileGuideOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!getStoredUser()) { router.push("/"); return; }
    getMyFeatures().then(f=>{setFeatures(f as Record<string,boolean>);setFeaturesLoaded(true);}).catch(()=>{setFeatures({diag_structure:false,diag_issue:false,diag_comparison:false,diag_contradiction:false,diag_execution:false,diag_investment:false,diag_graph:false,diag_file:false,diag_presentation:false,diag_future:false,diag_profile:false});setFeaturesLoaded(true);});
    const urlTab = searchParams.get("tab") as TabId;
    const urlStock = searchParams.get("stock");
    if (urlStock) setStockSearch(decodeURIComponent(urlStock));
    if (urlTab) {
      setTab(urlTab);
      localStorage.setItem("diag_tab", urlTab);
      try {
        const _stored = sessionStorage.getItem("diag_input_"+urlTab);
        if (_stored) {
          sessionStorage.removeItem("diag_input_"+urlTab);
          if (urlTab === "comparison") {
            setOptions(_stored);
          } else if (urlTab === "contradiction") {
            setStrategy(_stored);
          } else {
            setInputMap(m => ({...m, [urlTab]: _stored}));
          }
        }
      } catch(_e) {}
      return;
    }
    const savedTab = localStorage.getItem("diag_tab") as TabId;
    if (savedTab) setTab(savedTab);
    fetchHistory();
    fetchFrameworks();
    fetchSignals();
    getUserStats().then(setStats);
    fetch(`${API_BASE}/api/chat/history/main`, { headers: authHeaders() })
      .then(r=>r.json()).then(d=>setChatMessages(d.messages||[])).catch(()=>{});
  }, []);


  async function fetchHistory() {
    try {
      const res = await fetch(`${API_BASE}/api/diagnosis/list`, { headers: authHeaders() });
      if (res.ok) { const d = await res.json(); setHistory(d.diagnoses||[]); if(d.diagnoses?.length>0) setReport(d.diagnoses[0].report_md); }
    } catch {}
  }
  async function fetchFrameworks() {
    try {
      const res = await fetch(`${API_BASE}/api/diagnosis/frameworks`, { headers: authHeaders() });
      if (res.ok) { const d = await res.json(); setFrameworks(d.frameworks||[]); }
    } catch {}
  }
  async function fetchSignals() {
    try {
      const res = await fetch(`${API_BASE}/api/investment/signals`, { headers: authHeaders() });
      if (res.ok) { const d = await res.json(); setSignals(d.signals); }
    } catch {}
  }
  const [stockResult, setStockResult] = useState<Record<string,any>|null>(null);
  const [stockLoading, setStockLoading] = useState(false);
  const [graphData, setGraphData] = useState<{nodes:{id:string;label:string}[];edges:{from:string;to:string}[]}|null>(null);
  const [graphLoading, setGraphLoading] = useState(false);
  async function fetchGraphData() {
    setGraphLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/diagnosis/thought_map`, { headers: authHeaders() });
      if (!res.ok) { setError("グラフ取得失敗"); setGraphLoading(false); return; }
      const d = await res.json();
      if (!d.nodes || d.nodes.length === 0) { setError("チャット履歴が見つかりません"); setGraphLoading(false); return; }
      setGraphData(d);
      const TOPIC_COLORS: Record<string,string> = {
        "戦略・競合":"#6366f1","集客・SNS":"#0891b2","売上・財務":"#059669",
        "組織・人材":"#d97706","投資・株":"#dc2626","診断・分析":"#8b5cf6",
        "指名・接客":"#db2777","その他":"#475569"
      };
      const _nodes = d.nodes.map((n: {id:string;label:string;group?:string;is_center?:boolean}) => {
        const _bg = TOPIC_COLORS[n.group||"その他"]||"#6366f1";
        return {
          id: n.id,
          label: (n.label||"").slice(0, n.is_center ? 18 : 12),
          title: n.label||"",
          color: {
            background: _bg,
            border: "rgba(255,255,255,0.25)",
            highlight: { background: _bg, border: "rgba(255,255,255,0.8)" },
            hover: { background: _bg, border: "rgba(255,255,255,0.6)" },
          },
          size: n.is_center ? 38 : 20,
          shape: n.is_center ? "ellipse" : "dot",
          font: { size: n.is_center ? 13 : 10, color: "#ffffff", bold: n.is_center, strokeWidth: 2, strokeColor: "rgba(0,0,0,0.6)" },
          shadow: { enabled: true, color: `${_bg}88`, x: 0, y: 0, size: n.is_center ? 16 : 8 },
          borderWidth: n.is_center ? 2 : 1,
        };
      });
      const _edges = d.edges.map((e: {from:string;to:string;topic?:string}) => ({
        from: e.from, to: e.to,
        color: { color: TOPIC_COLORS[e.topic||"その他"]||"rgba(99,102,241,0.5)", opacity: 0.55, highlight: "#ffffff" },
        width: 1.5, arrows: { to: { enabled: true, scaleFactor: 0.6 } },
        smooth: { type: "curvedCW", roundness: 0.15 },
        shadow: { enabled: true, color: "rgba(0,0,0,0.3)", x: 0, y: 2, size: 4 },
      }));
      const _draw = () => {
        if (!graphRef.current) return;
        graphRef.current.style.height = "480px";
        graphRef.current.style.background = "linear-gradient(135deg,#0f0c29,#1a1040,#0d0d1a)";
        graphRef.current.style.borderRadius = "0 0 16px 16px";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const _vis = (window as any).vis;
        if (!_vis) return;
        new _vis.Network(graphRef.current,
          { nodes: new _vis.DataSet(_nodes), edges: new _vis.DataSet(_edges) },
          {
            physics: { barnesHut: { gravitationalConstant: -4000, centralGravity: 0.4, springLength: 140, springConstant: 0.05, damping: 0.12 }, stabilization: { iterations: 400, fit: true }, minVelocity: 0.5 },
            layout: { improvedLayout: true },
            interaction: { hover: true, tooltipDelay: 80, navigationButtons: false, keyboard: false },
            nodes: { borderWidth: 1, borderWidthSelected: 2 },
            edges: { smooth: { type: "curvedCW", roundness: 0.2 } },
            background: { fill: "transparent" },
          }
        );
        setGraphLoading(false);
      };
      let _att = 0;
      const _poll = setInterval(() => {
        _att++;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((window as any).vis) { clearInterval(_poll); _draw(); }
        else if (_att > 30) { clearInterval(_poll); setError("描画失敗"); setGraphLoading(false); }
      }, 200);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (!(window as any).vis) {
        const _s = document.createElement("script");
        _s.src = "https://unpkg.com/vis-network@9.1.9/standalone/umd/vis-network.min.js";
        _s.onload = () => { clearInterval(_poll); _draw(); };
        _s.onerror = () => { clearInterval(_poll); setError("visライブラリロード失敗"); setGraphLoading(false); };
        document.head.appendChild(_s);
      }
    } catch(e:unknown) { setError(e instanceof Error ? e.message : "エラー"); setGraphLoading(false); }
  }
  async function fetchStockAnalysis() {
    if (!stockSearch.trim()) return;
    setStockLoading(true); setError("");  setStockResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/investment/stock_analysis`, {
        method:"POST", headers:authHeaders(),
        body:JSON.stringify({query: stockSearch.trim()})
      });
      if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.detail||"エラー"); }
      const d = await res.json();
      if (!d.ok) throw new Error(d.error||"エラー");
      let _r = d.result;
      if (typeof _r === "string") {
        const _c = _r.replace(/```json\s*/g,"").replace(/```/g,"").trim();
        try { _r = JSON.parse(_c); } catch(_e) { _r = {summary: _r}; }
      }
      if (_r && typeof _r === "object") {
        // summaryフィールドがJSON文字列全体の場合パースし直す
        if (typeof _r.summary === "string" && _r.summary.trim().startsWith("{")) {
          try {
            const _parsed = JSON.parse(_r.summary.replace(/```json\s*/g,"").replace(/```/g,"").trim());
            if (_parsed && typeof _parsed === "object" && _parsed.code) { _r = _parsed; }
          } catch(_e) {}
        }
        const _clean = (v: unknown) => typeof v === "string" ? v.replace(/```json\s*/g,"").replace(/```/g,"").trim() : v;
        Object.keys(_r).forEach(k => { _r[k] = _clean(_r[k]); });
        if (_r.signal_analysis && typeof _r.signal_analysis === "object") {
          Object.keys(_r.signal_analysis).forEach(k => { _r.signal_analysis[k] = _clean(_r.signal_analysis[k]); });
        }
        if (_r.strategy && typeof _r.strategy === "object") {
          Object.keys(_r.strategy).forEach(k => { _r.strategy[k] = _clean(_r.strategy[k]); });
        }
      }
      setStockResult(_r);
    } catch(e:unknown) { setError(e instanceof Error ? e.message : "エラー"); }
    finally { setStockLoading(false); }
  }

  async function fetchInvestmentAnalysis() {
    setAnalysisLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/investment/analysis`, { headers: authHeaders() });
      if (res.ok) { const d = await res.json(); if(d.ok) {
        if (typeof d.analysis === "string") {
          const _clean = d.analysis.replace(/^```json\s*/,"").replace(/\s*```$/,"").trim();
          try { d.analysis = JSON.parse(_clean); } catch(_e) { d.analysis = {market_summary: d.analysis}; }
        }
        setAnalysisData(d); setSignals(d.latest);
      } }
    } catch {} finally { setAnalysisLoading(false); }
  }

  async function handleGenerate() {
    setLoading(true); setError("");
    try {
      const res = await fetch(`${API_BASE}/api/diagnosis/generate`, { method:"POST", headers:authHeaders(), body:JSON.stringify({n_chats:30}) });
      if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.detail||"生成に失敗しました"); }
      const d = await res.json(); setReport(d.report_md); fetchHistory();
    } catch(e:unknown) { setError(e instanceof Error ? e.message : "エラー"); }
    finally { setLoading(false); }
  }

  async function handleConsult(analysisType: string) {
    setLoading(true); setError(""); setConsultResult(null); setActiveAnalysisType(analysisType);
    try {
      const body = { analysis_type:analysisType, input_text:getInput(analysisType), supplement, options, strategy, policy };
      const _ctrl = new AbortController();
      const _timer = setTimeout(()=>_ctrl.abort(), 180000);
      let res: Response;
      try { res = await fetch(`${API_BASE}/api/diagnosis/consult`, { method:"POST", headers:authHeaders(), body:JSON.stringify(body), signal:_ctrl.signal }); } finally { clearTimeout(_timer); }
      if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.detail||"エラー"); }
      const d = await res.json();
      if (!d.ok) throw new Error(d.error||"エラー");
      setConsultResult(d.result);
      if(analysisType==="issue"){ loadIssueHistory(); }
      // 履歴更新
      const h = await fetch(`${API_BASE}/api/diagnosis/consult/history?analysis_type=${analysisType}`, { headers:authHeaders() });
      if (h.ok) { const hd = await h.json(); setConsultHistory(hd.analyses||[]); }
    } catch(e:unknown) { setError(e instanceof Error ? e.message : "エラー"); }
    finally { setLoading(false); }
  }

  async function handleSignalFeedback(code: string, asof_date: string, signal_type: string, label: number) {
    try {
      await fetch(`${API_BASE}/api/investment/feedback`, { method:"POST", headers:authHeaders(), body:JSON.stringify({code,asof_date,signal_type,label}) });
    } catch {}
  }

  const [activeAnalysisType, setActiveAnalysisType] = useState<string>("");
  const [futureInput, setFutureInput] = useState("");
  const [futureResult, setFutureResult] = useState<any>(null);
  const [futureLoading, setFutureLoading] = useState(false);
  const [futureError, setFutureError] = useState("");
  const [futureHistory, setFutureHistory] = useState<any[]>([]);
  const [reviewTarget, setReviewTarget] = useState<any>(null);
  const [reviewInput, setReviewInput] = useState<any>({actual_outcome:"",actual_success_level:50,actual_risk:"中",actual_state:""});
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewResult, setReviewResult] = useState<any>(null);
  const loadProfileHistory = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/diagnosis/profile_list`, {headers:authHeaders()});
      const data = await res.json();
      if(data.profiles) setProfileHistory(data.profiles);
    } catch(e){}
  };
  const loadStructureHistory = async () => {
    try{
      const res = await fetch(`${API_BASE}/api/diagnosis/consult/history?analysis_type=structure`,{headers:authHeaders()});
      const data = await res.json();
      if(data.analyses){ setStructureHistory(data.analyses.slice(0,20)); }
    }catch(e){}
  };
  const deleteStructureAnalysis = async (doc_id:string) => {
    if(!confirm("この構造診断を削除しますか？")) return;
    try{
      await fetch(`${API_BASE}/api/diagnosis/consult/delete/${doc_id}`,{method:"DELETE",headers:authHeaders()});
      setStructureHistory(prev=>prev.filter(h=>h.doc_id!==doc_id));
    }catch(e){}
  };
  const loadIssueHistory = async () => {
    try{
      const res = await fetch(`${API_BASE}/api/diagnosis/issue_list`,{headers:authHeaders()});
      const data = await res.json();
      if(data.reports){ setIssueHistory(data.reports); }
    }catch(e){}
  };
  const loadFutureHistory = async () => {
    const token = localStorage.getItem("ascend_token") || "";
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";
    try {
      const r = await fetch(`${API_BASE}/api/diagnosis/future_simulation_list`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const d = await r.json();
      if (d.items) setFutureHistory(d.items);
    } catch(e) {}
  };
  const deleteFutureSimulation = async (docId: string) => {
    if (!confirm("このシミュレーション履歴を削除しますか？")) return;
    const token = localStorage.getItem("ascend_token") || "";
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";
    try {
      await fetch(`${API_BASE}/api/diagnosis/future_simulation_delete/${docId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      setFutureHistory(prev => prev.filter(h => h.doc_id !== docId));
    } catch(e) {}
  };
  const deleteProfile = async (doc_id:string) => {
    if(!confirm("このプロファイルを削除しますか？")) return;
    try {
      await fetch(`${API_BASE}/api/diagnosis/profile_delete/${doc_id}`,{method:"DELETE",headers:authHeaders()});
      loadProfileHistory();
    } catch(e){}
  };
  const handleProfileGenerate = async () => {
    setProfileError("");
    const _vals = [profileInput.frequent_words,profileInput.conversation_traits,profileInput.judgment_criteria,profileInput.stress_reaction,profileInput.behavioral_patterns,profileInput.interpersonal_needs,profileInput.disliked_types,profileInput.trust_conditions,profileInput.work_attitude,profileInput.preferred_environment,profileInput.breakdown_conditions,profileInput.core_values,profileInput.strong_reactions,profileInput.contradictions,profileInput.obsessions,profileInput.anger_points,profileInput.justification_patterns,profileInput.ignored_topics,profileInput.responsibility_shift];
    if(!_vals.some(v=>(v||"").trim())){setProfileError("少なくとも1項目入力してください。");return;}
    setProfileLoading(true);
    let existingDocIds=new Set<string>();
    try{
      const baseRes=await fetch(`${API_BASE}/api/diagnosis/profile_list`,{headers:authHeaders()});
      const baseData=await baseRes.json();
      existingDocIds=new Set((baseData.profiles||[]).map((p:any)=>String(p.doc_id)));
    }catch(e){}
    try {
      const res = await fetch(`${API_BASE}/api/diagnosis/profile_generate`, {
        method:"POST",headers:authHeaders(),
        body:JSON.stringify({
          target_name:profileInput.target_name||"",relationship:profileInput.relationship||"",
          frequent_words:profileInput.frequent_words||"",conversation_traits:profileInput.conversation_traits||"",
          judgment_criteria:profileInput.judgment_criteria||"",stress_reaction:profileInput.stress_reaction||"",
          behavioral_patterns:profileInput.behavioral_patterns||"",interpersonal_needs:profileInput.interpersonal_needs||"",
          disliked_types:profileInput.disliked_types||"",trust_conditions:profileInput.trust_conditions||"",
          work_attitude:profileInput.work_attitude||"",preferred_environment:profileInput.preferred_environment||"",
          breakdown_conditions:profileInput.breakdown_conditions||"",
          core_values:profileInput.core_values||"",
          strong_reactions:profileInput.strong_reactions||"",
          contradictions:profileInput.contradictions||"",
          obsessions:profileInput.obsessions||"",
          anger_points:profileInput.anger_points||"",
          justification_patterns:profileInput.justification_patterns||"",
          ignored_topics:profileInput.ignored_topics||"",
          responsibility_shift:profileInput.responsibility_shift||"",
          behavioral_traces:profileInput.behavioral_traces||"",
        }),
      });
      const data = await res.json();
      if(data.ok){setProfileResult(data.result);loadProfileHistory();}
      else setProfileError(data.detail||"エラーが発生しました");
    } catch(e:any){
      setProfileError("生成処理中...自動表示まで少々お待ちください。");
      let found=false;
      for(let i=0;i<24;i++){
        await new Promise(resolve=>setTimeout(resolve,5000));
        try{
          const r2=await fetch(`${API_BASE}/api/diagnosis/profile_list`,{headers:authHeaders()});
          const d2=await r2.json();
          const newProfile=d2.profiles?.find((p:any)=>!existingDocIds.has(p.doc_id));
          if(newProfile?.result){setProfileResult(newProfile.result);setProfileError("");loadProfileHistory();found=true;break;}
        }catch(e2){}
      }
      if(!found)setProfileError("生成完了。下の履歴の「更新」ボタンを押して確認してください。");
      loadProfileHistory();
    } finally{setProfileLoading(false);}
  };
  const handleProfilePrint = () => {
    if(!profileResult) return;
    const w = window.open("","_blank"); if(!w) return;
    const a=(profileResult.analysis||{}) as Record<string,string>;
    const la: Record<string,string> = {thinking_style:"思考傾向",behavioral_principle:"行動原理",emotional_trigger:"感情トリガー",interpersonal_risk:"対人リスク",strengths:"強み",weaknesses:"弱点",approach:"適した接し方",compatible_type:"相性良いタイプ",caution:"注意点",deep_desire:"深層欲求推定"};
    const pr=profileResult as any;
    let h="<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>プロファイルレポート</title>";
    h+="<style>body{font-family:sans-serif;max-width:800px;margin:30px auto;padding:20px;color:#111}h1{font-size:18px;font-weight:800;margin-bottom:4px}h2{font-size:12px;font-weight:700;color:#4f46e5;margin:16px 0 6px;border-bottom:1px solid #e5e7eb;padding-bottom:4px}.s{margin-bottom:8px;padding:10px;border:1px solid #e5e7eb;border-radius:6px}.l{font-size:9px;color:#6b7280;font-weight:700;margin-bottom:3px;text-transform:uppercase}.v{font-size:12px;line-height:1.5}.g{display:grid;grid-template-columns:1fr 1fr;gap:8px}.layer{padding:8px 10px;border-radius:6px;margin-bottom:6px;border-left:3px solid #4f46e5}.chain{padding:8px;background:#f8f8f8;border-radius:6px;margin-bottom:4px}@media print{button{display:none}}</style></head><body>";
    h+="<h1>🕵️ "+pr.target_name+"</h1><p style=\"color:#6b7280;font-size:11px\">"+( pr.generated_at||"")+" ■ 関係性: "+(pr.relationship||"")+"</p>";
    if(pr.unique_causal_chain)h+='<h2>■ 固有因果連鎖</h2><div class="s" style="background:#1a0533;border:1px solid #6d28d9"><div class="v" style="color:#e9d5ff;font-size:13px;line-height:1.8">'+pr.unique_causal_chain+'</div></div>';
    const existFields=[{l:"⚡ 存在接続",k:"existence_connection"},{l:"🌐 世界モデル",k:"learned_world_model"},{l:"🚫 諦め学習",k:"what_was_abandoned"},{l:"👁 無意識痕跡",k:"unconscious_signatures"}];
    const validExist=existFields.filter(({k})=>pr[k]);
    if(validExist.length){h+='<h2>■ 存在構造</h2><div class="g">';for(const{l,k} of validExist)h+='<div class="s"><div class="l">'+l+'</div><div class="v">'+pr[k]+'</div></div>';h+='</div>';}
    h+="<h2>■ 構造レイヤー</h2>";
    const layers=[{l:"主構造",k:"main_type",c:"#4f46e5"},{l:"副構造",k:"sub_type",c:"#7c3aed"},{l:"ストレス時移行",k:"stress_type",c:"#dc2626"},{l:"対人時変化",k:"interpersonal_type",c:"#059669"}];
    for(const{l,k,c} of layers){if(pr[k])h+='<div class="layer" style="border-color:'+c+'"><div class="l">'+l+'</div><div class="v">'+pr[k]+'</div></div>';}
    if(pr.core_motivation)h+="<h2>■ 中心核</h2><div class=\"s\"><div class=\"v\">"+pr.core_motivation+"</div></div>";
    const secs=[{l:"防衛機能",k:"defense_function"},{l:"現実処理傾向",k:"reality_processing"},{l:"責任接続性",k:"responsibility_connection"},{l:"自尊心維持",k:"self_esteem_maintenance"}];
    const validSecs=secs.filter(({k})=>pr[k]);
    if(validSecs.length){h+="<h2>■ 防衛構造</h2><div class=\"g\">";for(const{l,k} of validSecs)h+='<div class="s"><div class="l">'+l+'</div><div class="v">'+pr[k]+'</div></div>';h+="</div>";}
    const chains=[{l:"起点",k:"chain_trigger"},{l:"一次反応",k:"chain_primary"},{l:"防衛反応",k:"chain_defense"},{l:"結果",k:"chain_result"},{l:"長期化",k:"chain_chronic"}];
    const validChains=chains.filter(({k})=>pr[k]);
    if(validChains.length){h+="<h2>■ 行動連鎖</h2>";for(let i=0;i<validChains.length;i++){const{l,k}=validChains[i];h+='<div class="chain"><div class="l">'+l+'</div><div class="v">'+pr[k]+'</div></div>';if(i<validChains.length-1)h+='<div style="text-align:center;color:#6b7280">&darr;</div>';}
}
    if(pr.breakdown_prediction||pr.interpersonal_dynamics){h+="<h2>■ 崩壊予測・対人力学</h2><div class=\"g\">";if(pr.breakdown_prediction)h+='<div class="s"><div class="l">崩壊予測</div><div class="v">'+pr.breakdown_prediction+'</div></div>';if(pr.interpersonal_dynamics)h+='<div class="s"><div class="l">対人力学</div><div class="v">'+pr.interpersonal_dynamics+'</div></div>';h+="</div>";}
    if(Object.keys(a).length){h+="<h2>■ 分析結果</h2><div class=\"g\">";for(const[k,v] of Object.entries(a)){h+='<div class="s"><div class="l">'+(la[k]||k)+'</div><div class="v">'+v+'</div></div>';}h+="</div>";}
    if(pr.existence_os&&Object.keys(pr.existence_os).some((k:string)=>pr.existence_os[k])){const osL:Record<string,string>={world_os:"🌐 世界OS",self_os:"🪪 自己OS",other_os:"👤 他者OS",safety_os:"🔒 安全OS",attachment_os:"💞 愛着OS",value_os:"💎 価値OS",dominance_os:"👑 支配OS",collapse_os:"💥 崩壊OS",creation_os:"✨ 創造OS"};h+='<h2>■ 存在OSレポート</h2><div class="g">';for(const[k,v] of Object.entries(pr.existence_os as Record<string,string>)){if(v)h+='<div class="s" style="background:#0f172a;border-color:#334155"><div class="l" style="color:#94a3b8">'+(osL[k]||k)+'</div><div class="v" style="color:#e2e8f0">'+v+'</div></div>';}h+='</div>';}
    if(pr.structure_extraction&&Object.keys(pr.structure_extraction).some((k:string)=>pr.structure_extraction[k])){const seL:Record<string,string>={contradictions:"🔄 繰り返す矛盾",obsessions:"🎯 執着",anger_trigger:"⚡ 怒りポイント",justification:"🛡️ 正義化構造",silence_ignored:"🔇 沈黙・無視論点",responsibility_position:"⚖️ 責任転嫁位置",reality_interpretation:"🧬 現実解釈の構造"};h+='<h2>■ 構造抽出レポート</h2><div class="g">';for(const[k,v] of Object.entries(pr.structure_extraction as Record<string,string>)){if(v)h+='<div class="s"><div class="l" style="color:#7c3aed">'+(seL[k]||k)+'</div><div class="v">'+v+'</div></div>';}h+='</div>';}
    if(pr.summary)h+="<h2>■ 総合所見</h2><div class=\"s\"><div class=\"v\">"+pr.summary+"</div></div>";
    h+="<script>window.print();<\/script></body></html>";
    w.document.write(h); w.document.close();
  };
  const handleIssuePrint = () => {
    if(!consultResult || activeAnalysisType!=="issue") return;
    const r = consultResult as any;
    const w = window.open("","_blank");
    if(!w) return;
    let h='<!DOCTYPE html><html><head><meta charset="utf-8"><title>課題仮説レポート</title>';
    h+='<style>';
    h+='body{font-family:sans-serif;max-width:1100px;margin:30px auto;padding:24px;color:#111;background:#fff;}';
    h+='h1{font-size:30px;font-weight:900;margin-bottom:8px;color:#1e1b4b;}';
    h+='h2{font-size:22px;font-weight:800;color:#4c1d95;margin:28px 0 10px;border-bottom:2px solid #e5e7eb;padding-bottom:6px;}';
    h+='.card{border:1px solid #d1d5db;border-radius:12px;padding:18px;margin-bottom:14px;background:#fafafa;}';
    h+='.txt{font-size:18px;line-height:2.0;color:#111;}';
    h+='.mini{font-size:16px;color:#374151;font-weight:700;margin-bottom:4px;}';
    h+='.pill{display:inline-block;padding:4px 10px;border-radius:999px;font-size:15px;font-weight:700;margin-right:6px;margin-bottom:6px;background:#ede9fe;color:#4c1d95;border:1px solid #c4b5fd;}';
    h+='.chain{padding:14px;border-radius:12px;background:#f0f9ff;border:1px solid #bae6fd;margin-bottom:12px;}';
    h+='.chain .mini{color:#1e40af;}';
    h+='ul{padding-left:24px;}';
    h+='li{margin-bottom:10px;font-size:18px;line-height:1.9;color:#111;}';
    h+='@media print{button{display:none;}}';
    h+='</style></head><body>';
    h+='<h1>🎯 課題仮説レポート</h1>';
    if(r.issue_summary){
      h+='<div class="card"><div class="txt">'+String(r.issue_summary)+'</div></div>';
    }
    if(Array.isArray(r.main_issues)&&r.main_issues.length){
      h+='<h2>主要論点</h2><ul>';
      r.main_issues.forEach((x:string)=>{h+='<li>'+x+'</li>';});
      h+='</ul>';
    }
    if(Array.isArray(r.hypotheses)&&r.hypotheses.length){
      h+='<h2>課題仮説</h2>';
      r.hypotheses.forEach((hyp:any,i:number)=>{
        h+='<div class="card">';
        h+='<div style="font-size:24px;font-weight:900;margin-bottom:10px;color:#1e1b4b;">'+(i+1)+'. '+String(hyp.title||'仮説')+'</div>';
        if(hyp.priority){h+='<span class="pill">優先度: '+String(hyp.priority)+'</span>';}
        if(hyp.confidence){h+='<span class="pill">確度: '+String(hyp.confidence)+'</span>';}
        if(typeof hyp.verification_score==="number"){h+='<span class="pill">検証可能性: '+Math.round(Number(hyp.verification_score||0)*100)+'%</span>';}
        if(hyp.description){h+='<div class="txt" style="margin-top:14px;">'+String(hyp.description)+'</div>';}
        const fields=[
          ["根拠",hyp.evidence?.join(" / ")],
          ["影響",hyp.expected_impact],
          ["検証",hyp.verification_method],
          ["必要データ",hyp.required_data?.join(" / ")],
          ["反証条件",hyp.falsification_condition],
          ["初手",hyp.first_action],
          ["優先理由",hyp.priority_reason]
        ];
        fields.forEach(([label,val])=>{
          if(val){
            h+='<div style="margin-top:14px;">';
            h+='<div class="mini">'+label+'</div>';
            h+='<div class="txt">'+String(val)+'</div>';
            h+='</div>';
          }
        });
        h+='</div>';
      });
    }
    if(Array.isArray(r.root_issues)&&r.root_issues.length){
      h+='<h2>🔴 根本課題</h2><ul>';
      r.root_issues.forEach((x:string)=>h+='<li style="color:#991b1b;">'+x+'</li>');
      h+='</ul>';
    }
    if(Array.isArray(r.surface_issues)&&r.surface_issues.length){
      h+='<h2>🟡 表面的課題</h2><ul>';
      r.surface_issues.forEach((x:string)=>h+='<li style="color:#92400e;">'+x+'</li>');
      h+='</ul>';
    }
    if(Array.isArray(r.causal_chains)&&r.causal_chains.length){
      h+='<h2>🔗 因果連鎖</h2>';
      r.causal_chains.forEach((c:any)=>{
        h+='<div class="chain">';
        if(c.root){h+='<div class="mini">ROOT</div><div class="txt" style="color:#991b1b;">'+String(c.root)+'</div>';}
        if(c.mechanism){h+='<div class="mini" style="margin-top:10px;">MECHANISM</div><div class="txt" style="color:#1e40af;">'+String(c.mechanism)+'</div>';}
        if(c.symptom){h+='<div class="mini" style="margin-top:10px;">SYMPTOM</div><div class="txt" style="color:#92400e;">'+String(c.symptom)+'</div>';}
        if(c.business_impact){h+='<div class="mini" style="margin-top:10px;">IMPACT</div><div class="txt" style="color:#065f46;">'+String(c.business_impact)+'</div>';}
        h+='</div>';
      });
    }
    if(r.top_hypothesis||r.priority_reason){
      h+='<h2>⭐ 最重要仮説</h2>';
      h+='<div class="card">';
      if(r.top_hypothesis){h+='<div style="font-size:24px;font-weight:900;margin-bottom:12px;color:#1e1b4b;">'+String(r.top_hypothesis)+'</div>';}
      if(r.priority_reason){h+='<div class="txt">'+String(r.priority_reason)+'</div>';}
      h+='</div>';
    }
    const listSections=[
      ["❓ 不足情報",r.missing_information],
      ["✅ 次に確認すべき質問",r.questions_to_verify],
      ["🎯 意思決定ポイント",r.decision_points]
    ];
    listSections.forEach(([title,arr])=>{
      if(Array.isArray(arr)&&(arr as string[]).length){
        h+='<h2>'+title+'</h2><ul>';
        (arr as string[]).forEach((x:string)=>h+='<li>'+x+'</li>');
        h+='</ul>';
      }
    });
    h+='<script>window.print();<\/script></body></html>';
    w.document.write(h);
    w.document.close();
  };
  const loadProfileQuestions = async () => {
    if(!profileResult) return;
    setProfileQuestionsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/diagnosis/profile_questions`,{
        method:"POST",headers:authHeaders(),
        body:JSON.stringify({profile_result:profileResult}),
      });
      const data = await res.json();
      if(data.ok) setProfileQuestions(data.questions);
    } catch(e){} finally{setProfileQuestionsLoading(false);}
  };
  const askProfileQuestion = async (q:string) => {
    if(!q.trim()||!profileResult) return;
    setProfileAnswerLoading(true);
    setProfileAnsweredQuestion(q);
    setProfileAnswer("");
    try {
      const res = await fetch(`${API_BASE}/api/diagnosis/profile_followup`,{
        method:"POST",headers:authHeaders(),
        body:JSON.stringify({profile_result:profileResult,question:q}),
      });
      const data = await res.json();
      if(data.ok) setProfileAnswer(data.answer);
    } catch(e){} finally{setProfileAnswerLoading(false);setProfileCustomQuestion("");}
  };
    const allTabs: {id:TabId;label:string;flag?:string}[] = [
    ...(features?.current_issue_diagnosis!==false ? [{id:"diagnosis" as TabId,label:"🔬 現状課題診断"}] : []),
    {id:"structure",label:"🏗️ 構造診断",flag:"diag_structure"},
    {id:"issue",label:"🎯 課題仮説",flag:"diag_issue"},
    {id:"comparison",label:"⚖️ 比較分析",flag:"diag_comparison"},
    {id:"contradiction",label:"⚡ 矛盾検知",flag:"diag_contradiction"},
    {id:"execution",label:"📋 実行計画",flag:"diag_execution"},
    {id:"investment",label:"📈 投資シグナル",flag:"diag_investment"},
    {id:"graph",label:"📊 会話の可視化",flag:"diag_graph"},
    {id:"file",label:"🧾 ファイル診断",flag:"diag_file"},
    {id:"presentation",label:"📊 プレゼン資料",flag:"diag_presentation"},
    {id:"future",label:"🔮 未来分岐シミュレーター",flag:"diag_future"},
    {id:"profile",label:"🕵️ プロファイル生成",flag:"diag_profile"},
    {id:"crm",label:"👥 顧客AIマネジメント",flag:"diag_crm"},
  ];
  const TABS = allTabs.filter(t=>!t.flag || (featuresLoaded && features[t.flag] === true));
  useEffect(()=>{
    if(featuresLoaded && TABS.length>0 && !TABS.find(t=>t.id===tab)){
      setTab(TABS[0].id);
      if(typeof window!=="undefined") localStorage.setItem("diag_tab",TABS[0].id);
    }
  },[featuresLoaded]);
  useEffect(()=>{
    if(tab==="issue"){
      loadIssueHistory();
    }
    if(tab==="structure"){
      loadStructureHistory();
    }
  },[tab]);

  const renderConsultResult = () => {
    if (!consultResult) return null;
    const r = consultResult as Record<string, any>;
    const Section = ({title,color,children}:{title:string,color:string,children:React.ReactNode}) => (
      <div style={{background:`${color}08`,border:`1px solid ${color}30`,borderRadius:"14px",marginBottom:"12px"}} className="p-4">
        <p style={{color,fontWeight:700,fontSize:"13px",marginBottom:"8px"}}>{title}</p>
        {children}
      </div>
    );
    const Tag = ({label,color}:{label:string,color:string}) => (
      <span style={{background:`${color}15`,border:`1px solid ${color}40`,color,borderRadius:"99px",padding:"2px 10px",fontSize:"11px",fontWeight:600,marginRight:"6px",marginBottom:"4px",display:"inline-block"}}>{label}</span>
    );

    // structure
    if (activeAnalysisType==="structure") return (
      <div id="structure-report-print" style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:"16px",boxShadow:C.shadowMd}} className="p-5 mt-4">
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"16px"}}>
          <p style={{color:C.primary,fontWeight:900,fontSize:"15px"}}>🏗️ 構造診断レポート</p>
          <button onClick={()=>window.print()} style={{padding:"8px 16px",borderRadius:"10px",background:"#4f46e5",color:"white",fontWeight:700,fontSize:"12px",border:"none",cursor:"pointer"}}>🖨️ 印刷・保存</button>
        </div>

        {r.issue_summary && <Section title="問題サマリー" color={C.primary}><p style={{color:C.textSub,fontSize:"13px",lineHeight:"1.7"}}>{String(r.issue_summary)}</p></Section>}

        {Array.isArray(r.observations) && r.observations.length>0 && (
          <Section title="観測事実" color="#0891b2">
            {(r.observations as string[]).map((o,i)=>(
              <div key={i} className="flex items-start gap-2 mb-1">
                <span style={{color:"#0891b2",fontWeight:700,fontSize:"12px"}}>▸</span>
                <p style={{color:C.textSub,fontSize:"12px"}}>{o}</p>
              </div>
            ))}
          </Section>
        )}

        {r.structure_map && typeof r.structure_map==="object" && (
          <Section title="🧠 STRUCTURE MAP" color="#7c3aed"><div style={{breakInside:"avoid",pageBreakInside:"avoid"}}>
            {r.structure_map.core_system && (
              <div style={{marginBottom:"10px"}}>
                <p style={{color:"#a78bfa",fontSize:"11px",fontWeight:700,marginBottom:"4px"}}>CORE SYSTEM</p>
                <p style={{color:C.textSub,fontSize:"12px",lineHeight:"1.6"}}>{String(r.structure_map.core_system)}</p>
              </div>
            )}
            {(["actors","resources","constraints","feedback_loops","failure_points"] as const).map((key)=>{
              const labels: Record<string,string> = {actors:"ACTORS",resources:"RESOURCES",constraints:"CONSTRAINTS",feedback_loops:"FEEDBACK LOOPS",failure_points:"FAILURE POINTS"};
              const arr = r.structure_map[key];
              if (!Array.isArray(arr) || arr.length===0) return null;
              return (
                <div key={key} style={{marginBottom:"8px"}}>
                  <p style={{color:"#a78bfa",fontSize:"11px",fontWeight:700,marginBottom:"4px"}}>{labels[key]}</p>
                  <div style={{display:"flex",flexWrap:"wrap",gap:"4px"}}>
                    {(arr as string[]).map((v,i)=>(
                      <span key={i} style={{background:"rgba(124,58,237,0.12)",border:"1px solid rgba(124,58,237,0.3)",color:"#c4b5fd",borderRadius:"8px",padding:"2px 9px",fontSize:"11px"}}>{v}</span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div></Section>
        )}

        {Array.isArray(r.surface_causes) && r.surface_causes.length>0 && (
          <Section title="🔎 表層原因" color="#d97706">
            {(r.surface_causes as string[]).map((c,i)=>(
              <div key={i} className="flex items-start gap-2 mb-1">
                <span style={{color:"#d97706",fontWeight:700,fontSize:"12px"}}>{i+1}.</span>
                <p style={{color:C.textSub,fontSize:"12px"}}>{c}</p>
              </div>
            ))}
          </Section>
        )}

        {Array.isArray(r.root_causes) && r.root_causes.length>0 && (
          <Section title="🔍 根因" color="#dc2626">
            {(r.root_causes as string[]).map((c,i)=>(
              <div key={i} className="flex items-start gap-2 mb-1">
                <span style={{color:"#dc2626",fontWeight:700,fontSize:"12px"}}>{i+1}.</span>
                <p style={{color:C.textSub,fontSize:"12px"}}>{c}</p>
              </div>
            ))}
          </Section>
        )}

        {Array.isArray(r.causal_chains) && r.causal_chains.length>0 && (
          <Section title="🔗 CAUSAL CHAINS" color="#0891b2">
            <div style={{display:"flex",flexDirection:"column",gap:"10px",breakInside:"avoid",pageBreakInside:"avoid"}}>
              {(r.causal_chains as any[]).map((chain,i)=>{
                const conf = String(chain.confidence||"");
                const confColor = conf==="高"?"#ef4444":conf==="中"?"#f59e0b":"#6b7280";
                return (
                  <div key={i} className="avoid-break" style={{background:"rgba(8,145,178,0.07)",border:"1px solid rgba(8,145,178,0.2)",borderRadius:"12px",padding:"12px"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"8px"}}>
                      <span style={{color:"#0891b2",fontWeight:700,fontSize:"11px"}}>CHAIN {i+1}</span>
                      <span style={{background:`${confColor}20`,border:`1px solid ${confColor}50`,color:confColor,borderRadius:"99px",padding:"1px 8px",fontSize:"10px",fontWeight:700}}>confidence: {conf||"−"}</span>
                    </div>
                    <div style={{display:"flex",flexDirection:"column",gap:"4px"}}>
                      {([["ROOT",chain.root,"#ef4444"],["MECHANISM",chain.mechanism,"#f59e0b"],["SYMPTOM",chain.symptom,"#0891b2"],["BUSINESS IMPACT",chain.business_impact,"#dc2626"]] as [string,any,string][]).map(([label,val,color])=>(
                        val ? (
                          <div key={label} style={{display:"flex",alignItems:"flex-start",gap:"6px"}}>
                            <span style={{color:color,fontSize:"10px",fontWeight:700,minWidth:"110px",paddingTop:"1px"}}>{label}</span>
                            <p style={{color:C.textSub,fontSize:"12px",lineHeight:"1.6",flex:1}}>{String(val)}</p>
                          </div>
                        ) : null
                      ))}
                      {Array.isArray(chain.evidence) && chain.evidence.length>0 && (
                        <div style={{display:"flex",alignItems:"flex-start",gap:"6px",marginTop:"2px"}}>
                          <span style={{color:"#6b7280",fontSize:"10px",fontWeight:700,minWidth:"110px",paddingTop:"1px"}}>EVIDENCE</span>
                          <div style={{flex:1}}>
                            {(chain.evidence as string[]).map((ev,j)=>(
                              <p key={j} style={{color:"#9ca3af",fontSize:"11px"}}>・{ev}</p>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        {Array.isArray(r.bottlenecks) && r.bottlenecks.length>0 && (
          <Section title="🚧 BOTTLENECKS" color="#f59e0b">
            <div style={{display:"flex",flexDirection:"column",gap:"10px",breakInside:"avoid",pageBreakInside:"avoid"}}>
              {(r.bottlenecks as any[]).map((bn,i)=>{
                const prio = String(bn.priority||"");
                const prioColor = prio==="高"?"#ef4444":prio==="中"?"#f59e0b":"#6b7280";
                return (
                  <div key={i} className="avoid-break" style={{background:"rgba(245,158,11,0.07)",border:"1px solid rgba(245,158,11,0.2)",borderRadius:"12px",padding:"12px"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"8px"}}>
                      <p style={{color:"#f59e0b",fontWeight:700,fontSize:"12px"}}>{String(bn.point||"")}</p>
                      <span style={{background:`${prioColor}20`,border:`1px solid ${prioColor}50`,color:prioColor,borderRadius:"99px",padding:"1px 8px",fontSize:"10px",fontWeight:700}}>priority: {prio||"−"}</span>
                    </div>
                    {bn.why_bottleneck && <p style={{color:C.textSub,fontSize:"12px",marginBottom:"4px"}}>⚠ {String(bn.why_bottleneck)}</p>}
                    {bn.affected_area && <p style={{color:"#9ca3af",fontSize:"11px",marginBottom:"4px"}}>影響範囲: {String(bn.affected_area)}</p>}
                    {bn.first_fix && <p style={{color:"#34d399",fontSize:"12px",fontWeight:600}}>→ 初手: {String(bn.first_fix)}</p>}
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        {Array.isArray(r.priority_points) && r.priority_points.length>0 && (
          <Section title="🎯 優先論点" color="#7c3aed">
            {(r.priority_points as string[]).map((p,i)=>(
              <div key={i} className="flex items-start gap-2 mb-1">
                <span style={{color:"#7c3aed",fontWeight:700,fontSize:"12px"}}>{i+1}.</span>
                <p style={{color:C.textSub,fontSize:"12px"}}>{p}</p>
              </div>
            ))}
          </Section>
        )}

        {(r.current_structure||r.ideal_structure) && (
          <Section title="🌉 CURRENT → IDEAL STRUCTURE" color="#059669">
            {r.current_structure && (
              <div style={{background:"rgba(5,150,105,0.08)",border:"1px solid rgba(5,150,105,0.2)",borderRadius:"10px",padding:"10px 12px",marginBottom:"8px"}}>
                <p style={{color:"#6ee7b7",fontSize:"10px",fontWeight:700,marginBottom:"4px"}}>CURRENT</p>
                <p style={{color:C.textSub,fontSize:"12px",lineHeight:"1.6"}}>{String(r.current_structure)}</p>
              </div>
            )}
            {Array.isArray(r.transition_barriers) && r.transition_barriers.length>0 && (
              <div style={{padding:"6px 0 6px 12px",borderLeft:"2px solid rgba(5,150,105,0.3)",marginBottom:"8px"}}>
                <p style={{color:"#6b7280",fontSize:"10px",fontWeight:700,marginBottom:"4px"}}>TRANSITION BARRIERS</p>
                {(r.transition_barriers as string[]).map((b,i)=>(
                  <p key={i} style={{color:"#9ca3af",fontSize:"11px"}}>⛔ {b}</p>
                ))}
              </div>
            )}
            {r.ideal_structure && (
              <div style={{background:"rgba(5,150,105,0.12)",border:"1px solid rgba(5,150,105,0.3)",borderRadius:"10px",padding:"10px 12px"}}>
                <p style={{color:"#6ee7b7",fontSize:"10px",fontWeight:700,marginBottom:"4px"}}>IDEAL</p>
                <p style={{color:C.textSub,fontSize:"12px",lineHeight:"1.6"}}>{String(r.ideal_structure)}</p>
              </div>
            )}
          </Section>
        )}

        {Array.isArray(r.recommended_actions) && r.recommended_actions.length>0 && (
          <Section title="⚡ 推奨アクション（優先度順）" color="#059669">
            {(r.recommended_actions as string[]).map((a,i)=>(
              <div key={i} className="flex items-start gap-2 mb-2">
                <span style={{color:"#059669",fontWeight:700,fontSize:"12px",minWidth:"20px"}}>{i+1}.</span>
                <p style={{color:C.textSub,fontSize:"12px"}}>{a}</p>
              </div>
            ))}
          </Section>
        )}

        {Array.isArray(r.risks) && r.risks.length>0 && (
          <Section title="🚨 リスク" color="#dc2626">
            {(r.risks as string[]).map((rk,i)=>(
              <div key={i} className="flex items-start gap-2 mb-1">
                <span style={{color:"#dc2626",fontSize:"12px"}}>▸</span>
                <p style={{color:C.textSub,fontSize:"12px"}}>{rk}</p>
              </div>
            ))}
          </Section>
        )}

        {Array.isArray(r.verification_plan) && r.verification_plan.length>0 && (
          <Section title="🧪 VERIFICATION PLAN" color="#6366f1"><div style={{breakInside:"avoid",pageBreakInside:"avoid"}}>
            {(r.verification_plan as string[]).map((v,i)=>(
              <div key={i} className="avoid-break" style={{display:"flex",alignItems:"flex-start",gap:"8px",marginBottom:"6px"}}>
                <span style={{background:"rgba(99,102,241,0.2)",border:"1px solid rgba(99,102,241,0.4)",color:"#a5b4fc",borderRadius:"50%",width:"20px",height:"20px",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"10px",fontWeight:700,flexShrink:0,marginTop:"1px"}}>{i+1}</span>
                <p style={{color:C.textSub,fontSize:"12px",lineHeight:"1.6"}}>{v}</p>
              </div>
            ))}
          </div></Section>
        )}

        {Array.isArray(r.missing_information) && r.missing_information.length>0 && (
          <Section title="❓ 不足情報" color="#6b7280">
            {(r.missing_information as string[]).map((m,i)=>(
              <div key={i} className="flex items-start gap-2 mb-1">
                <span style={{color:"#6b7280",fontSize:"12px"}}>?</span>
                <p style={{color:C.textSub,fontSize:"12px"}}>{m}</p>
              </div>
            ))}
          </Section>
        )}
      </div>
    );
    // issue
    if (activeAnalysisType==="issue") return (
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:"16px",boxShadow:C.shadowMd}} className="p-5 mt-4">
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"16px"}}>
          <p style={{color:C.primary,fontWeight:900,fontSize:"17px"}}>
            🎯 課題仮説レポート
          </p>
          <button
            onClick={handleIssuePrint}
            style={{
              padding:"10px 18px",
              borderRadius:"12px",
              background:"#4f46e5",
              color:"white",
              fontWeight:800,
              fontSize:"12px",
              border:"none",
              cursor:"pointer"
            }}
          >
            🖨️ 印刷・保存
          </button>
        </div>
        {Array.isArray(r.main_issues) && r.main_issues.length>0 && (
          <Section title="主要論点" color={C.primary}>
            {(r.main_issues as string[]).map((issue,i)=>(
              <div key={i} className="flex items-start gap-2 mb-1">
                <span style={{color:C.primary,fontWeight:700,fontSize:"13px"}}>{i+1}.</span>
                <p style={{color:C.textSub,fontSize:"13px"}}>{issue}</p>
              </div>
            ))}
          </Section>
        )}
        {Array.isArray(r.hypotheses) && r.hypotheses.length>0 && (
          <Section title="課題仮説" color="#7c3aed">
            {(r.hypotheses as any[]).map((h,i)=>{
              const isObj = h && typeof h === "object";
              return (
                <div key={i} style={{border:`1px solid ${C.border}`,borderRadius:"12px",padding:"10px 12px",marginBottom:"10px",background:"rgba(124,58,237,0.04)"}}>
                  <div className="flex items-start gap-2 mb-2">
                    <span style={{color:"#7c3aed",fontWeight:900,fontSize:"13px",minWidth:"20px"}}>{i+1}.</span>
                    <div style={{flex:1}}>
                      <p style={{color:C.textMain,fontSize:"11px",fontWeight:800,marginBottom:"4px"}}>
                        {isObj ? (h.title || "仮説") : String(h)}
                      </p>
                      {isObj && h.description && (
                        <p style={{color:C.textSub,fontSize:"13px",lineHeight:"1.7",marginBottom:"8px"}}>{String(h.description)}</p>
                      )}
                      {isObj && (
                        <div style={{display:"flex",gap:"6px",flexWrap:"wrap",marginBottom:"8px"}}>
                          {h.priority && <span style={{border:"1px solid rgba(217,119,6,0.35)",borderRadius:"999px",padding:"2px 8px",fontSize:"12px",color:"#d97706"}}>優先度: {String(h.priority)}</span>}
                          {h.confidence && <span style={{border:"1px solid rgba(5,150,105,0.35)",borderRadius:"999px",padding:"2px 8px",fontSize:"12px",color:"#059669"}}>確度: {String(h.confidence)}</span>}
                        </div>
                      )}
                      {isObj && Array.isArray(h.evidence) && h.evidence.length>0 && (
                        <div style={{marginBottom:"6px"}}>
                          <p style={{color:C.textMain,fontSize:"12px",fontWeight:800,marginBottom:"2px"}}>根拠</p>
                          {h.evidence.map((e:any,j:number)=><p key={j} style={{color:C.textSub,fontSize:"12px",lineHeight:"1.6"}}>・{String(e)}</p>)}
                        </div>
                      )}
                      {isObj && h.expected_impact && (
                        <p style={{color:C.textSub,fontSize:"12px",lineHeight:"1.6"}}><b>影響:</b> {String(h.expected_impact)}</p>
                      )}
                      {isObj && h.verification_method && (
                        <p style={{color:C.textSub,fontSize:"12px",lineHeight:"1.6"}}><b>検証:</b> {String(h.verification_method)}</p>
                      )}
                      {isObj && Array.isArray(h.required_data) && h.required_data.length>0 && (
                        <p style={{color:C.textSub,fontSize:"12px",lineHeight:"1.6"}}><b>必要データ:</b> {h.required_data.map((x:any)=>String(x)).join(" / ")}</p>
                      )}
                      {isObj && h.falsification_condition && (
                        <p style={{color:C.textSub,fontSize:"12px",lineHeight:"1.6"}}><b>反証条件:</b> {String(h.falsification_condition)}</p>
                      )}
                      {isObj && h.first_action && (
                        <p style={{color:"#7c3aed",fontSize:"12px",lineHeight:"1.6",fontWeight:800,marginTop:"4px"}}>初手: {String(h.first_action)}</p>
                      )}
                      {isObj && h.priority_reason && (
                        <p style={{color:"#d97706",fontSize:"12px",lineHeight:"1.6",marginTop:"4px"}}>
                          <b>優先理由:</b> {String(h.priority_reason)}
                        </p>
                      )}

                      {isObj && typeof h.verification_score === "number" && (
                        <div style={{marginTop:"6px"}}>
                          <div style={{display:"flex",justifyContent:"space-between",marginBottom:"2px"}}>
                            <span style={{color:C.textSub,fontSize:"11px"}}>検証可能性</span>
                            <span style={{color:"#059669",fontSize:"11px",fontWeight:800}}>
                              {Math.round(Number(h.verification_score || 0)*100)}%
                            </span>
                          </div>
                          <div style={{background:"rgba(0,0,0,0.08)",borderRadius:"999px",height:"5px"}}>
                            <div
                              style={{
                                width:`${Math.round(Number(h.verification_score || 0)*100)}%`,
                                background:"linear-gradient(90deg,#059669,#10b981)",
                                borderRadius:"999px",
                                height:"5px"
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </Section>
        )}
        {Array.isArray(r.root_issues) && r.root_issues.length>0 && (
          <Section title="🔴 根本課題" color="#dc2626">
            {(r.root_issues as string[]).map((x,i)=>(
              <div key={i} className="flex items-start gap-2 mb-1">
                <span style={{color:"#dc2626",fontWeight:900,fontSize:"13px"}}>●</span>
                <p style={{color:C.textSub,fontSize:"13px",lineHeight:"1.7"}}>{x}</p>
              </div>
            ))}
          </Section>
        )}

        {Array.isArray(r.surface_issues) && r.surface_issues.length>0 && (
          <Section title="🟡 表面的課題" color="#d97706">
            {(r.surface_issues as string[]).map((x,i)=>(
              <div key={i} className="flex items-start gap-2 mb-1">
                <span style={{color:"#d97706",fontWeight:900,fontSize:"13px"}}>●</span>
                <p style={{color:C.textSub,fontSize:"13px",lineHeight:"1.7"}}>{x}</p>
              </div>
            ))}
          </Section>
        )}
        {Array.isArray(r.causal_chains) && r.causal_chains.length>0 && (
          <Section title="🔗 因果連鎖" color="#2563eb">
            {(r.causal_chains as any[]).map((c,i)=>(
              <div
                key={i}
                style={{
                  border:`1px solid ${C.border}`,
                  borderRadius:"12px",
                  padding:"10px 12px",
                  marginBottom:"10px",
                  background:"rgba(37,99,235,0.04)"
                }}
              >
                {c.root && (
                  <p style={{color:"#dc2626",fontSize:"12px",fontWeight:800,marginBottom:"4px"}}>
                    ROOT: {String(c.root)}
                  </p>
                )}
                {c.mechanism && (
                  <p style={{color:"#2563eb",fontSize:"12px",lineHeight:"1.6"}}>
                    MECHANISM: {String(c.mechanism)}
                  </p>
                )}
                {c.symptom && (
                  <p style={{color:"#d97706",fontSize:"12px",lineHeight:"1.6"}}>
                    SYMPTOM: {String(c.symptom)}
                  </p>
                )}
                {c.business_impact && (
                  <p style={{color:"#059669",fontSize:"12px",lineHeight:"1.6"}}>
                    IMPACT: {String(c.business_impact)}
                  </p>
                )}
              </div>
            ))}
          </Section>
        )}

        {(r.top_hypothesis || r.priority_reason) && (
          <Section title="⭐ 最重要仮説" color="#7c3aed">
            {r.top_hypothesis && (
              <p style={{color:C.textMain,fontSize:"11px",fontWeight:800,marginBottom:"6px"}}>
                {String(r.top_hypothesis)}
              </p>
            )}
            {r.priority_reason && (
              <p style={{color:C.textSub,fontSize:"13px",lineHeight:"1.7"}}>
                {String(r.priority_reason)}
              </p>
            )}
          </Section>
        )}
        {typeof r.verification_score === "number" && (
          <Section title="🧪 全体検証可能性" color="#059669">
            <div style={{background:"rgba(0,0,0,0.08)",borderRadius:"999px",height:"8px",marginBottom:"6px"}}>
              <div
                style={{
                  width:`${Math.round(Number(r.verification_score || 0)*100)}%`,
                  background:"linear-gradient(90deg,#059669,#10b981)",
                  borderRadius:"999px",
                  height:"8px"
                }}
              />
            </div>
            <p style={{color:C.textSub,fontSize:"13px"}}>
              仮説全体の検証可能性スコア:
              <span style={{color:"#059669",fontWeight:800}}>
                {" "}{Math.round(Number(r.verification_score || 0)*100)}%
              </span>
            </p>
          </Section>
        )}

        {Array.isArray(r.missing_information) && r.missing_information.length>0 && (
          <Section title="❓ 不足情報" color="#6b7280">
            {(r.missing_information as string[]).map((m,i)=>(
              <div key={i} className="flex items-start gap-2 mb-1">
                <span style={{color:"#6b7280",fontSize:"13px"}}>?</span>
                <p style={{color:C.textSub,fontSize:"13px",lineHeight:"1.7"}}>{m}</p>
              </div>
            ))}
          </Section>
        )}

        {Array.isArray(r.questions_to_verify) && r.questions_to_verify.length>0 && (
          <Section title="✅ 次に確認すべき質問" color="#059669">
            {(r.questions_to_verify as string[]).map((q,i)=>(
              <div key={i} className="flex items-start gap-2 mb-1">
                <span style={{color:"#059669",fontSize:"13px"}}>Q{i+1}.</span>
                <p style={{color:C.textSub,fontSize:"13px"}}>{q}</p>
              </div>
            ))}
          </Section>
        )}
        {Array.isArray(r.decision_points) && r.decision_points.length>0 && (
          <Section title="🎯 意思決定ポイント" color="#d97706">
            {(r.decision_points as string[]).map((d,i)=>(
              <div key={i} className="flex items-start gap-2 mb-1">
                <span style={{color:"#d97706",fontWeight:700,fontSize:"13px"}}>▸</span>
                <p style={{color:C.textSub,fontSize:"13px"}}>{d}</p>
              </div>
            ))}
          </Section>
        )}
      </div>
    );

    // comparison
    if (activeAnalysisType==="comparison") return (
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:"16px",boxShadow:C.shadowMd}} className="p-5 mt-4">
        <p style={{color:C.primary,fontWeight:900,fontSize:"15px",marginBottom:"16px"}}>⚖️ 比較分析レポート</p>
        {Array.isArray(r.options) && r.options.length>0 && (
          <div style={{marginBottom:"16px"}}>
            {(r.options as {name:string;scores:Record<string,number>;pros:string[];cons:string[];recommended_for:string[]}[]).map((opt,i)=>(
              <div key={i} style={{border:`1px solid ${C.border}`,borderRadius:"12px",marginBottom:"10px",overflow:"hidden"}}>
                <div style={{background:`linear-gradient(135deg,${C.primary}15,${C.primary2}08)`,padding:"10px 14px",borderBottom:`1px solid ${C.border}`}}>
                  <span style={{color:C.primary,fontWeight:700,fontSize:"13px"}}>{opt.name}</span>
                </div>
                <div style={{padding:"10px 14px"}}>
                  {Object.entries(opt.scores||{}).length>0 && (
                    <div style={{display:"flex",flexWrap:"wrap",gap:"6px",marginBottom:"8px"}}>
                      {Object.entries(opt.scores).map(([k,v])=>(
                        <span key={k} style={{background:`${C.primary}10`,border:`1px solid ${C.border}`,borderRadius:"8px",padding:"2px 8px",fontSize:"11px",color:C.textSub}}>{k}: <b style={{color:Number(v)>=4?"#059669":Number(v)>=3?"#d97706":"#dc2626"}}>{v}</b>/5</span>
                      ))}
                    </div>
                  )}
                  {Array.isArray(opt.pros) && opt.pros.length>0 && <p style={{color:"#059669",fontSize:"11px",marginBottom:"2px"}}>✓ {opt.pros.join("　")}</p>}
                  {Array.isArray(opt.cons) && opt.cons.length>0 && <p style={{color:"#dc2626",fontSize:"11px"}}>✗ {opt.cons.join("　")}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
        {r.final_recommendation && <Section title="✅ 最終推奨" color="#059669"><p style={{color:"#059669",fontWeight:700,fontSize:"13px"}}>{String(r.final_recommendation)}</p></Section>}
      </div>
    );

    // contradiction
    if (activeAnalysisType==="contradiction") return (
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:"16px",boxShadow:C.shadowMd}} className="p-5 mt-4">
        <p style={{color:C.primary,fontWeight:900,fontSize:"15px",marginBottom:"16px"}}>⚡ 矛盾検知レポート</p>
        {r.consistency_score !== undefined && (
          <Section title="整合性スコア" color={Number(r.consistency_score)>=70?"#059669":Number(r.consistency_score)>=50?"#d97706":"#dc2626"}>
            <div className="flex items-center gap-3">
              <div style={{background:"rgba(0,0,0,0.06)",borderRadius:"99px",height:"8px",flex:1}}>
                <div style={{width:`${Number(r.consistency_score)}%`,background:Number(r.consistency_score)>=70?"linear-gradient(90deg,#059669,#10b981)":Number(r.consistency_score)>=50?"linear-gradient(90deg,#d97706,#fbbf24)":"linear-gradient(90deg,#dc2626,#f87171)",borderRadius:"99px",height:"8px"}}/>
              </div>
              <span style={{fontWeight:900,fontSize:"18px",color:Number(r.consistency_score)>=70?"#059669":Number(r.consistency_score)>=50?"#d97706":"#dc2626"}}>{Number(r.consistency_score)}</span>
            </div>
          </Section>
        )}
        {r.overall_assessment && typeof r.overall_assessment === "object" && (r.overall_assessment as {top_contradiction?:string;priority_fix?:string;first_action?:string;summary?:string}).top_contradiction && (
          <Section title="🚨 最重要矛盾" color="#dc2626">
            <p style={{color:"#dc2626",fontWeight:700,fontSize:"13px",marginBottom:"6px"}}>{(r.overall_assessment as {top_contradiction:string}).top_contradiction}</p>
            {(r.overall_assessment as {priority_fix?:string}).priority_fix && <p style={{color:C.textSub,fontSize:"12px",marginBottom:"4px"}}>優先修正箇所: {(r.overall_assessment as {priority_fix:string}).priority_fix}</p>}
            {(r.overall_assessment as {first_action?:string}).first_action && <p style={{color:"#059669",fontWeight:600,fontSize:"12px"}}>▶ 最初の一手: {(r.overall_assessment as {first_action:string}).first_action}</p>}
          </Section>
        )}
        {Array.isArray(r.contradictions) && r.contradictions.length>0 && (
          <Section title={`真の矛盾 (${r.contradictions.length}件)`} color="#dc2626">
            {(r.contradictions as {type:string;description:string;strategy_quote?:string;policy_quote?:string;context_quote?:string;why_problematic:string;severity?:string;confidence?:string;fix_direction:string}[]).map((c,i)=>(
              <div key={i} style={{borderBottom:`1px solid rgba(0,0,0,0.06)`,paddingBottom:"12px",marginBottom:"12px"}}>
                <div className="flex items-center gap-2 mb-1" style={{flexWrap:"wrap"}}>
                  {c.type && <span style={{background:"#dc262615",border:"1px solid #dc262640",color:"#dc2626",borderRadius:"99px",padding:"2px 10px",fontSize:"11px",fontWeight:600}}>{c.type}</span>}
                  {c.severity && <span style={{background:c.severity==="重大"?"#dc262615":c.severity==="中"?"#d9780615":"#05966915",border:`1px solid ${c.severity==="重大"?"#dc262640":c.severity==="中"?"#d9780640":"#05966940"}`,color:c.severity==="重大"?"#dc2626":c.severity==="中"?"#d97706":"#059669",borderRadius:"99px",padding:"2px 8px",fontSize:"11px",fontWeight:600}}>{c.severity}</span>}
                  {c.confidence && <span style={{background:c.confidence==="高"?"#05966915":c.confidence==="中"?"#d9780615":"#64748b15",border:`1px solid ${c.confidence==="高"?"#05966940":c.confidence==="中"?"#d9780640":"#64748b40"}`,color:c.confidence==="高"?"#059669":c.confidence==="中"?"#d97706":"#64748b",borderRadius:"99px",padding:"2px 8px",fontSize:"11px",fontWeight:600}}>確度: {c.confidence}</span>}
                </div>
                <p style={{color:C.textMain,fontWeight:600,fontSize:"13px",marginBottom:"6px"}}>{c.description}</p>
                {(c.strategy_quote||c.policy_quote||c.context_quote) && (
                  <div style={{background:"rgba(0,0,0,0.03)",borderRadius:"8px",padding:"6px 10px",marginBottom:"6px",fontSize:"11px",color:C.textMuted}}>
                    {c.strategy_quote && <p style={{marginBottom:"2px"}}>📌 戦略: 「{c.strategy_quote}」</p>}
                    {c.policy_quote && <p style={{marginBottom:"2px"}}>📌 方針: 「{c.policy_quote}」</p>}
                    {c.context_quote && c.context_quote.trim() && <p>📌 背景: 「{c.context_quote}」</p>}
                  </div>
                )}
                {c.why_problematic && <p style={{color:C.textMuted,fontSize:"11px",marginBottom:"4px"}}>⚠ 問題点: {c.why_problematic}</p>}
                {c.fix_direction && <p style={{color:"#059669",fontSize:"12px",fontWeight:600}}>▶ 修正アクション: {c.fix_direction}</p>}
              </div>
            ))}
          </Section>
        )}
        {Array.isArray(r.tradeoffs) && r.tradeoffs.length>0 && (
          <Section title={`トレードオフ (${r.tradeoffs.length}件)`} color="#d97706">
            {(r.tradeoffs as {description:string;tension:string;recommended_priority:string}[]).map((t,i)=>(
              <div key={i} style={{borderBottom:`1px solid rgba(0,0,0,0.06)`,paddingBottom:"10px",marginBottom:"10px"}}>
                <p style={{color:C.textMain,fontWeight:600,fontSize:"13px",marginBottom:"4px"}}>{t.description}</p>
                {t.tension && <p style={{color:C.textMuted,fontSize:"11px",marginBottom:"2px"}}>⚖ 緊張関係: {t.tension}</p>}
                {t.recommended_priority && <p style={{color:"#d97706",fontSize:"11px",fontWeight:600}}>▶ 推奨優先: {t.recommended_priority}</p>}
              </div>
            ))}
          </Section>
        )}
        {Array.isArray(r.contradictions) && r.contradictions.length===0 && (
          <Section title="矛盾なし" color="#059669"><p style={{color:"#059669",fontSize:"13px"}}>✅ 入力内容に重大な矛盾は検出されませんでした。</p></Section>
        )}
        {r.overall_assessment && typeof r.overall_assessment === "object" && (r.overall_assessment as {summary?:string}).summary && (
          <Section title="総合評価" color={C.primary}><p style={{color:C.textSub,fontSize:"13px",lineHeight:"1.7"}}>{(r.overall_assessment as {summary:string}).summary}</p></Section>
        )}
        {r.overall_assessment && typeof r.overall_assessment === "string" && (
          <Section title="総合評価" color={C.primary}><p style={{color:C.textSub,fontSize:"13px",lineHeight:"1.7"}}>{String(r.overall_assessment)}</p></Section>
        )}
        {r.score_basis && (
          <Section title="スコア根拠" color="#7c3aed"><p style={{color:C.textSub,fontSize:"12px",lineHeight:"1.7"}}>{String(r.score_basis)}</p></Section>
        )}
        {Array.isArray(r.missing_information) && r.missing_information.length>0 && (
          <Section title="不足情報" color="#d97706">
            <ul style={{margin:0,paddingLeft:"18px"}}>
              {(r.missing_information as string[]).map((mi,i)=>(
                <li key={i} style={{color:C.textSub,fontSize:"12px",marginBottom:"4px"}}>{mi}</li>
              ))}
            </ul>
          </Section>
        )}
      </div>
    );

    // execution
    if (activeAnalysisType==="execution") return (
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:"16px",boxShadow:C.shadowMd}} className="p-5 mt-4">
        <p style={{color:C.primary,fontWeight:900,fontSize:"15px",marginBottom:"16px"}}>📋 実行計画レポート</p>
        {Array.isArray(r.action_plan) && r.action_plan.length>0 && (
          <div style={{marginBottom:"16px"}}>
            {(r.action_plan as {task:string;owner:string;deadline:string;kpi:string;priority:string}[]).map((p,i)=>(
              <div key={i} style={{border:`1px solid ${C.border}`,borderRadius:"12px",marginBottom:"10px",overflow:"hidden"}}>
                <div style={{background:`linear-gradient(135deg,${p.priority==="high"?"#dc262615":"#d9780615"},${C.primary}08)`,padding:"10px 14px",borderBottom:`1px solid ${C.border}`}}>
                  <div className="flex justify-between items-center">
                    <span style={{color:C.textMain,fontWeight:700,fontSize:"13px"}}>{i+1}. {p.task}</span>
                    <span style={{color:p.priority==="high"?"#dc2626":p.priority==="medium"?"#d97706":"#059669",fontSize:"11px",fontWeight:700}}>{p.priority==="high"?"🔴 高":p.priority==="medium"?"🟡 中":"🟢 低"}</span>
                  </div>
                </div>
                <div style={{padding:"10px 14px"}}>
                  {p.owner && <p style={{color:C.textSub,fontSize:"12px",marginBottom:"2px"}}>👤 担当: {p.owner}</p>}
                  {p.deadline && <p style={{color:C.textSub,fontSize:"12px",marginBottom:"2px"}}>📅 期限: {p.deadline}</p>}
                  {p.kpi && <p style={{color:"#059669",fontSize:"12px"}}>📊 KPI: {p.kpi}</p>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* phases */}
        {Array.isArray(r.phases) && r.phases.length>0 && (
          <div style={{marginBottom:"16px"}}>
            <p style={{color:C.textMain,fontWeight:800,fontSize:"13px",marginBottom:"8px"}}>📅 フェーズ</p>
            <div style={{border:`1px solid ${C.border}`,borderRadius:"12px",padding:"12px 14px"}}>
              <ul style={{margin:0,paddingLeft:"16px"}}>
                {(r.phases as string[]).map((ph,i)=>(
                  <li key={i} style={{color:C.textSub,fontSize:"12px",marginBottom:"4px"}}>{ph}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* critical_path */}
        {Array.isArray(r.critical_path) && r.critical_path.length>0 && (
          <div style={{marginBottom:"16px"}}>
            <p style={{color:C.textMain,fontWeight:800,fontSize:"13px",marginBottom:"8px"}}>🔗 クリティカルパス</p>
            <div style={{border:`1px solid ${C.border}`,borderRadius:"12px",padding:"12px 14px"}}>
              <div className="flex flex-wrap gap-2">
                {(r.critical_path as string[]).map((step,i)=>{
                  const _nodes = (r.graph && Array.isArray(r.graph.nodes)) ? r.graph.nodes as {task_id?:string;objective?:string}[] : [];
                  const _node = _nodes.find(n=>n.task_id===step);
                  const _label = _node ? (_node.objective||step).slice(0,20)+"…" : step;
                  return (
                    <span key={i} style={{display:"inline-flex",alignItems:"center",gap:"4px"}}>
                      <span style={{background:`linear-gradient(135deg,${C.primary},${C.primary2})`,color:"white",borderRadius:"8px",padding:"3px 10px",fontSize:"12px",fontWeight:600}}>{_label}</span>
                      {i<r.critical_path.length-1 && <span style={{color:C.textMuted,fontSize:"12px"}}>→</span>}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* graph */}
        {r.graph && (Array.isArray(r.graph.nodes) || Array.isArray(r.graph.edges)) && (
          <div style={{marginBottom:"16px"}}>
            <p style={{color:C.textMain,fontWeight:800,fontSize:"13px",marginBottom:"8px"}}>🕸 依存グラフ</p>
            <div style={{border:`1px solid ${C.border}`,borderRadius:"12px",padding:"12px 14px"}}>
              {Array.isArray(r.graph.nodes) && r.graph.nodes.length>0 && (
                <div style={{marginBottom:"8px"}}>
                  <p style={{color:C.textSub,fontSize:"11px",fontWeight:700,marginBottom:"4px"}}>ノード</p>
                  <div className="flex flex-wrap gap-2">
                    {(r.graph.nodes as {task_id?:string;objective?:string;id?:string;label?:string;type?:string}[]).map((n,i)=>(
                      <span key={i} style={{background:`${C.primary}15`,color:C.primary,borderRadius:"6px",padding:"2px 8px",fontSize:"11px",fontWeight:600}}>
                        {(n.task_id||n.id||"node")}：{(n.objective||n.label||"").slice(0,20)}…
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {Array.isArray(r.graph.edges) && r.graph.edges.length>0 && (
                <div>
                  <p style={{color:C.textSub,fontSize:"11px",fontWeight:700,marginBottom:"4px"}}>エッジ（依存関係）</p>
                  {(r.graph.edges as {from:string;to:string;label?:string}[]).map((e,i)=>(
                    <p key={i} style={{color:C.textSub,fontSize:"12px",marginBottom:"2px"}}>
                      <span style={{color:C.primary,fontWeight:600}}>{e.from}</span>
                      <span style={{margin:"0 4px"}}>→</span>
                      <span style={{color:C.primary,fontWeight:600}}>{e.to}</span>
                      {e.label && <span style={{color:C.textMuted,marginLeft:"6px",fontSize:"11px"}}>({e.label})</span>}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* risks */}
        {Array.isArray(r.risks) && r.risks.length>0 && (
          <div style={{marginBottom:"16px"}}>
            <p style={{color:C.textMain,fontWeight:800,fontSize:"13px",marginBottom:"8px"}}>⚠️ リスク</p>
            <ul style={{margin:0,paddingLeft:"16px"}}>
              {(r.risks as string[]).map((rk,i)=>(
                <li key={i} style={{color:"#dc2626",fontSize:"12px",marginBottom:"4px"}}>{rk}</li>
              ))}
            </ul>
          </div>
        )}

        {/* blockers */}
        {Array.isArray(r.blockers) && r.blockers.length>0 && (
          <div style={{marginBottom:"16px"}}>
            <p style={{color:C.textMain,fontWeight:800,fontSize:"13px",marginBottom:"8px"}}>🚧 ブロッカー</p>
            <div style={{border:`1px solid #d9780630`,borderRadius:"12px",padding:"12px 14px",background:"#d9780608"}}>
              <ul style={{margin:0,paddingLeft:"16px"}}>
                {(r.blockers as string[]).map((b,i)=>(
                  <li key={i} style={{color:C.textSub,fontSize:"12px",marginBottom:"4px"}}>{b}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* checkpoints */}
        {Array.isArray(r.checkpoints) && r.checkpoints.length>0 && (
          <div style={{marginBottom:"8px"}}>
            <p style={{color:C.textMain,fontWeight:800,fontSize:"13px",marginBottom:"8px"}}>✅ チェックポイント</p>
            <div style={{border:`1px solid ${C.border}`,borderRadius:"12px",padding:"12px 14px"}}>
              <ul style={{margin:0,paddingLeft:"16px"}}>
                {(r.checkpoints as string[]).map((cp,i)=>(
                  <li key={i} style={{color:C.textSub,fontSize:"12px",marginBottom:"4px"}}>{cp}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

      </div>
    );

    // fallback
    return (
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:"16px",boxShadow:C.shadow}} className="p-5 mt-4">
        <pre style={{color:C.textMain,fontSize:"12px",lineHeight:"1.7",whiteSpace:"pre-wrap",fontFamily:"inherit"}}>{JSON.stringify(consultResult,null,2)}</pre>
      </div>
    );
  };

  return (
    <div style={{background:C.bg, minHeight:"100vh", fontFamily:"'Inter','Noto Sans JP',sans-serif", color:C.textMain}}>
      <nav style={{background:"rgba(255,255,255,0.95)",borderBottom:`1px solid ${C.border}`,backdropFilter:"blur(12px)",boxShadow:C.shadow,position:"sticky",top:0,zIndex:50}} className="px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={()=>router.push("/chat")} style={{color:C.textMuted}} className="text-sm hover:text-gray-700 transition-colors flex-shrink-0">← チャット</button>
          <span style={{color:C.border}}>|</span>
          <button onClick={()=>router.push("/mypage")} style={{color:C.textMuted}} className="text-sm hover:text-gray-700 transition-colors flex-shrink-0">マイページ</button>
          <span style={{color:C.border}}>|</span>
          <span className="text-sm font-bold flex-1 truncate" style={{color:C.textMain}}>{TABS.find(t=>t.id===tab)?.label ?? "診断・分析"}</span>
          <div style={{position:"relative",flexShrink:0}}>
            <button onClick={()=>setTabMenuOpen(o=>!o)}
              style={{background:C.primary,color:"white",borderRadius:"10px",padding:"5px 12px",fontSize:"16px",border:"none",cursor:"pointer"}}>☰</button>
            {tabMenuOpen && (
              <div style={{position:"fixed",top:"56px",right:0,left:0,background:"white",border:`1px solid ${C.border}`,borderBottom:`2px solid ${C.border}`,boxShadow:"0 4px 16px rgba(0,0,0,0.10)",zIndex:49,padding:"8px 16px",display:"flex",flexWrap:"wrap" as const,gap:"4px"}} onClick={()=>setTabMenuOpen(false)}>
                {TABS.map(t=>(
                  <button key={t.id} onClick={()=>{setTab(t.id);setConsultResult(null);setActiveAnalysisType("");if(typeof window!=="undefined")localStorage.setItem("diag_tab",t.id);}}
                    style={tab===t.id
                      ?{background:`linear-gradient(135deg,${C.primary},${C.primary2})`,color:"white",borderRadius:"10px",width:"100%",textAlign:"left",padding:"8px 12px",border:"none",cursor:"pointer",marginBottom:"2px",display:"block"}
                      :{background:"transparent",color:C.textSub,borderRadius:"10px",width:"100%",textAlign:"left",padding:"8px 12px",border:"none",cursor:"pointer",marginBottom:"2px",display:"block"}
                    }
                    className="text-xs font-medium transition-all hover:bg-indigo-50">
                    {t.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-6">


        {error && <p className="text-red-500 text-xs bg-red-50 border border-red-200 rounded-xl px-4 py-2 mb-4">{error}</p>}

        {/* 現状課題診断 */}
        {tab==="diagnosis" && (
          <>
            {stats && (
              <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:"16px",boxShadow:C.shadow,marginBottom:"16px"}} className="p-4">
                <p className="text-xs font-bold mb-3" style={{color:C.textMuted}}>📋 チャット診断レポート（12回ごとに生成可能）</p>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs" style={{color:C.textMuted}}>チャット累計</p>
                    <p className="text-2xl font-black" style={{color:C.primary}}>{stats.total_chat_count}<span className="text-xs font-normal ml-1" style={{color:C.textMuted}}>回</span></p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs" style={{color:C.textMuted}}>次の診断まで</p>
                    <p className="text-lg font-black" style={{color:stats.diag_available?"#10b981":C.textSub}}>
                      {stats.diag_available ? "✅ 診断可能" : `あと ${stats.diag_next_unlock - stats.total_chat_count} 回`}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs" style={{color:C.textMuted}}>診断回数</p>
                    <p className="text-2xl font-black" style={{color:C.primary2}}>{stats.diagnosis_count}<span className="text-xs font-normal ml-1" style={{color:C.textMuted}}>回</span></p>
                  </div>
                </div>
              </div>
            )}
          <div className="space-y-4">
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:"16px",boxShadow:C.shadow}} className="p-5">
              <p className="text-sm text-gray-500 mb-4">直近のチャット履歴をAIが分析し、あなたの現状課題と意思決定パターンを診断します。</p>
              <div className="flex gap-3 items-center">
                <button onClick={handleGenerate} disabled={loading || (mounted && stats!==null && !stats?.diag_available)}
                  style={{background:(mounted && stats!==null && !stats?.diag_available)?"#374151":`linear-gradient(135deg,${C.primary},${C.primary2})`,boxShadow:(mounted && stats!==null && !stats?.diag_available)?"none":C.shadowPrimary,borderRadius:"12px"}}
                  className="text-white text-sm font-bold px-6 py-2.5 hover:opacity-90 disabled:opacity-50 transition-all">
                  {loading ? "生成中..." : (mounted && stats!==null && !stats?.diag_available) ? `🔒 あと${(stats?.diag_next_unlock??0)-(stats?.total_chat_count??0)}回` : "🔬 診断レポートを生成"}
                </button>
                {history.length>0 && (
                  <select onChange={e=>{const h=history.find(x=>x.doc_id===e.target.value);if(h)setReport(h.report_md);}}
                    style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:"10px",color:C.textSub,padding:"6px 10px",fontSize:"12px"}}>
                    {history.map((h,i)=><option key={h.doc_id} value={h.doc_id}>{i===0?"最新":`過去 ${i}`}</option>)}
                  </select>
                )}
              </div>
            </div>
            {report && (
              <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:"20px",boxShadow:C.shadowMd}} className="overflow-hidden">
                {/* レポートヘッダー */}
                <div style={{background:`linear-gradient(135deg,${C.primary},${C.primary2})`,padding:"20px 24px"}}>
                  <p style={{color:"rgba(255,255,255,0.7)",fontSize:"10px",letterSpacing:"0.12em",fontWeight:700}} className="mb-1">DIAGNOSIS REPORT</p>
                  <p style={{color:"white",fontWeight:900,fontSize:"16px"}}>🔬 現状課題診断レポート</p>
                </div>
                {/* セクション別表示 */}
                <div className="p-5 space-y-4">
                  {report.split(/\n(?=#{1,3}\s)/).map((section, i) => {
                    const lines = section.trim().split('\n');
                    const heading = lines[0].replace(/^#+\s*/, '').trim();
                    const body = lines.slice(1).join('\n').trim();
                    if (!heading) return null;
                    const colors = ["#4f46e5","#0891b2","#059669","#d97706","#dc2626","#7c3aed","#0891b2","#059669"];
                    const color = colors[i % colors.length];
                    return (
                      <div key={i} style={{background:`${color}06`,border:`1px solid ${color}20`,borderRadius:"14px",padding:"14px 16px"}}>
                        <p style={{color,fontWeight:800,fontSize:"13px",marginBottom:body?"10px":"0"}}>{heading}</p>
                        {body && (
                          <div style={{color:C.textSub,fontSize:"12px",lineHeight:"1.8"}}>
                            {body.split('\n').map((line, j) => {
                              const trimmed = line.trim();
                              if (!trimmed) return null;
                              const isBullet = trimmed.startsWith('-') || trimmed.startsWith('*') || trimmed.startsWith('・');
                              const text = isBullet ? trimmed.replace(/^[-*・]\s*/,'') : trimmed;
                              const isBold = /\*\*(.+?)\*\*/.test(text);
                              const cleanText = text.replace(/\*\*(.+?)\*\*/g,'$1');
                              return (
                                <div key={j} className={isBullet?"flex items-start gap-2 mb-1":"mb-1"}>
                                  {isBullet && <span style={{color,fontWeight:700,minWidth:"14px",fontSize:"11px"}}>▶</span>}
                                  <span style={{fontWeight:isBold?700:400,color:isBold?C.textMain:C.textSub}}>{cleanText}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {!report && !loading && (
              <p className="text-center text-sm py-16" style={{color:C.textMuted}}>「診断レポートを生成」を押すと直近チャット履歴を分析します</p>
            )}
          </div>
          </>
        )}

        {/* 構造診断 */}
        {tab==="structure" && (
          <div className="space-y-4">
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:"16px",boxShadow:C.shadow}} className="p-5">
              <p className="text-sm font-bold mb-3" style={{color:C.textMain}}>🏗️ 構造診断</p>
              <p className="text-xs mb-4" style={{color:C.textSub}}>事業・組織・戦略の構造を解剖し、ボトルネックを特定します</p>
              <textarea value={getInput("structure")} onChange={e=>setInput("structure",e.target.value)} placeholder="【現状・課題】を入力してください&#10;例：月商300万が1年間横ばい。新規は広告依存、リピートは口コミのみ。"
                style={{background:"rgba(0,0,0,0.02)",border:`1px solid ${C.border}`,borderRadius:"12px",color:C.textMain,width:"100%",resize:"vertical"}}
                className="text-sm px-4 py-3 focus:outline-none placeholder-gray-400" rows={5}/>
              <textarea value={supplement} onChange={e=>setSupplement(e.target.value)} placeholder="補足情報（任意）"
                style={{background:"rgba(0,0,0,0.02)",border:`1px solid ${C.border}`,borderRadius:"12px",color:C.textMain,width:"100%",resize:"none",marginTop:"8px"}}
                className="text-sm px-4 py-2 focus:outline-none placeholder-gray-400" rows={2}/>
              <button onClick={()=>handleConsult("structure")} disabled={loading||!getInput("structure").trim()}
                style={{background:`linear-gradient(135deg,${C.primary},${C.primary2})`,boxShadow:C.shadowPrimary,borderRadius:"12px",marginTop:"12px"}}
                className="text-white text-sm font-bold px-6 py-2.5 hover:opacity-90 disabled:opacity-50">
                {loading?"分析中...":"構造診断を実行"}
              </button>
            </div>
            {renderConsultResult()}
            {/* 保存済み構造診断 */}
            <div style={{marginTop:"24px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"12px"}}>
                <p style={{fontSize:"16px",fontWeight:800,color:C.textMain}}>🗂 保存済み構造診断</p>
                <button onClick={loadStructureHistory} style={{background:"none",border:"none",cursor:"pointer",color:C.textSub,fontSize:"14px"}}>更新</button>
              </div>
              {structureHistory.length===0?(
                <div style={{padding:"18px",fontSize:"15px",color:C.textSub}}>保存済みレポートはありません</div>
              ):(
                structureHistory.map((h:any,i:number)=>(
                  <div key={i} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:"12px",padding:"14px 16px",marginBottom:"8px"}}>
                    <p style={{fontSize:"11px",color:C.textSub,marginBottom:"4px"}}>{h.created_at ? new Date(h.created_at).toLocaleString("ja-JP") : ""}</p>
                    <p style={{fontSize:"13px",color:C.textMain,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",marginBottom:"8px"}}>{String(h.input_text||"").slice(0,60)}{String(h.input_text||"").length>60?"…":""}</p>
                    <div style={{display:"flex",gap:"6px"}}>
                      <button onClick={()=>{setConsultResult(h.result);setActiveAnalysisType("structure");}} style={{fontSize:"11px",color:"#4f46e5",background:"none",border:"1px solid #4f46e5",borderRadius:"6px",padding:"3px 10px",cursor:"pointer"}}>開く</button>
                      <button onClick={()=>deleteStructureAnalysis(h.doc_id)} style={{fontSize:"11px",color:"#ef4444",background:"none",border:"1px solid #ef4444",borderRadius:"6px",padding:"3px 10px",cursor:"pointer"}}>削除</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* 課題仮説 */}
        {tab==="issue" && (
          <div className="space-y-4">
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:"16px",boxShadow:C.shadow}} className="p-5">
              <p className="text-sm font-bold mb-3" style={{color:C.textMain}}>🎯 課題仮説生成</p>
              <p className="text-xs mb-4" style={{color:C.textSub}}>状況から複数の課題仮説を生成し、優先度と検証方法を提示します</p>
              <textarea value={getInput("issue")} onChange={e=>setInput("issue",e.target.value)} placeholder="状況・背景を入力してください"
                style={{background:"rgba(0,0,0,0.02)",border:`1px solid ${C.border}`,borderRadius:"12px",color:C.textMain,width:"100%",resize:"vertical"}}
                className="text-sm px-4 py-3 focus:outline-none placeholder-gray-400" rows={5}/>
              <button onClick={()=>handleConsult("issue")} disabled={loading||!getInput("issue").trim()}
                style={{background:`linear-gradient(135deg,${C.primary},${C.primary2})`,boxShadow:C.shadowPrimary,borderRadius:"12px",marginTop:"12px"}}
                className="text-white text-sm font-bold px-6 py-2.5 hover:opacity-90 disabled:opacity-50">
                {loading?"分析中...":"課題仮説を生成"}
              </button>
            </div>
            {renderConsultResult()}
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:"16px",marginTop:"16px",overflow:"hidden"}}>
              <div style={{padding:"14px 18px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <p style={{fontSize:"18px",fontWeight:800,color:C.textMain}}>📚 保存済み課題仮説</p>
                <button onClick={loadIssueHistory} style={{background:"none",border:"none",cursor:"pointer",color:C.textSub,fontSize:"14px"}}>更新</button>
              </div>
              {issueHistory.length===0?(
                <div style={{padding:"18px",fontSize:"15px",color:C.textSub}}>保存済みレポートはありません</div>
              ):(
                issueHistory.map((h:any)=>(
                  <div key={h.doc_id} style={{padding:"16px 18px",borderBottom:`1px solid ${C.border}`,cursor:"pointer"}} onClick={()=>{setConsultResult(h.result);setActiveAnalysisType("issue");}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:"6px"}}>
                      <p style={{fontSize:"16px",fontWeight:700,color:C.textMain}}>🎯 課題仮説</p>
                      <p style={{fontSize:"12px",color:C.textSub}}>{String(h.created_at||"")}</p>
                    </div>
                    <p style={{fontSize:"14px",color:C.textSub,lineHeight:"1.7"}}>{String(h.input_text||"")}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* 比較分析 */}
        {tab==="comparison" && (
          <div className="space-y-4">
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:"16px",boxShadow:C.shadow}} className="p-5">
              <p className="text-sm font-bold mb-3" style={{color:C.textMain}}>⚖️ 比較分析</p>
              <p className="text-xs mb-4" style={{color:C.textSub}}>複数の選択肢を多軸で比較し、最適解を提示します</p>
              <textarea value={options} onChange={e=>setOptions(e.target.value)} placeholder="比較する選択肢（改行区切り）&#10;例：A案: 広告強化&#10;B案: 紹介制度導入&#10;C案: 単価アップ"
                style={{background:"rgba(0,0,0,0.02)",border:`1px solid ${C.border}`,borderRadius:"12px",color:C.textMain,width:"100%",resize:"vertical"}}
                className="text-sm px-4 py-3 focus:outline-none placeholder-gray-400" rows={4}/>
              <textarea value={getInput("comparison")} onChange={e=>setInput("comparison",e.target.value)} placeholder="判断の背景・制約条件（任意）"
                style={{background:"rgba(0,0,0,0.02)",border:`1px solid ${C.border}`,borderRadius:"12px",color:C.textMain,width:"100%",resize:"none",marginTop:"8px"}}
                className="text-sm px-4 py-2 focus:outline-none placeholder-gray-400" rows={2}/>
              <button onClick={()=>handleConsult("comparison")} disabled={loading||!options.trim()}
                style={{background:`linear-gradient(135deg,${C.primary},${C.primary2})`,boxShadow:C.shadowPrimary,borderRadius:"12px",marginTop:"12px"}}
                className="text-white text-sm font-bold px-6 py-2.5 hover:opacity-90 disabled:opacity-50">
                {loading?"分析中...":"比較分析を実行"}
              </button>
            </div>
            {renderConsultResult()}
          </div>
        )}

        {/* 矛盾検知 */}
        {tab==="contradiction" && (
          <div className="space-y-4">
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:"16px",boxShadow:C.shadow}} className="p-5">
              <p className="text-sm font-bold mb-3" style={{color:C.textMain}}>⚡ 矛盾検知</p>
              <p className="text-xs mb-4" style={{color:C.textSub}}>背景・戦略・方針の3軸から矛盾・整合性を検証します</p>
              <textarea value={inputText} onChange={e=>setInputText(e.target.value)} placeholder="【背景・課題・状況】を入力&#10;例：既存顧客が離脱気味・新規が取れていない・スタッフ3名体制"
                style={{background:"rgba(0,0,0,0.02)",border:`1px solid ${C.border}`,borderRadius:"12px",color:C.textMain,width:"100%",resize:"none"}}
                className="text-sm px-4 py-3 focus:outline-none placeholder-gray-400" rows={3}/>
              <textarea value={strategy} onChange={e=>setStrategy(e.target.value)} placeholder="【目標・戦略】を入力&#10;例：2年で売上2倍・新規顧客比率50%以上"
                style={{background:"rgba(0,0,0,0.02)",border:`1px solid ${C.border}`,borderRadius:"12px",color:C.textMain,width:"100%",resize:"none",marginTop:"8px"}}
                className="text-sm px-4 py-3 focus:outline-none placeholder-gray-400" rows={3}/>
              <textarea value={policy} onChange={e=>setPolicy(e.target.value)} placeholder="【方針・制約・現在の施策】を入力&#10;例：値下げ禁止・紹介のみ集客・月広告費5万上限"
                style={{background:"rgba(0,0,0,0.02)",border:`1px solid ${C.border}`,borderRadius:"12px",color:C.textMain,width:"100%",resize:"none",marginTop:"8px"}}
                className="text-sm px-4 py-3 focus:outline-none placeholder-gray-400" rows={3}/>
              <button onClick={()=>handleConsult("contradiction")} disabled={loading||(!strategy.trim()&&!inputText.trim()&&!policy.trim())}
                style={{background:`linear-gradient(135deg,${C.primary},${C.primary2})`,boxShadow:C.shadowPrimary,borderRadius:"12px",marginTop:"12px"}}
                className="text-white text-sm font-bold px-6 py-2.5 hover:opacity-90 disabled:opacity-50">
                {loading?"分析中...":"矛盾検知を実行"}
              </button>
            </div>
            {renderConsultResult()}
          </div>
        )}

        {/* 実行計画 */}
        {tab==="execution" && (
          <div className="space-y-4">
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:"16px",boxShadow:C.shadow}} className="p-5">
              <p className="text-sm font-bold mb-3" style={{color:C.textMain}}>📋 実行計画生成</p>
              <p className="text-xs mb-4" style={{color:C.textSub}}>目標に対するフェーズ別実行計画・KPI・リスクを生成します</p>
              <textarea value={getInput("execution")} onChange={e=>setInput("execution",e.target.value)} placeholder="目標・背景を入力してください&#10;例：半年で月商500万達成。現状300万。スタッフ3名。"
                style={{background:"rgba(0,0,0,0.02)",border:`1px solid ${C.border}`,borderRadius:"12px",color:C.textMain,width:"100%",resize:"vertical"}}
                className="text-sm px-4 py-3 focus:outline-none placeholder-gray-400" rows={5}/>
              <button onClick={()=>handleConsult("execution")} disabled={loading||!getInput("execution").trim()}
                style={{background:`linear-gradient(135deg,${C.primary},${C.primary2})`,boxShadow:C.shadowPrimary,borderRadius:"12px",marginTop:"12px"}}
                className="text-white text-sm font-bold px-6 py-2.5 hover:opacity-90 disabled:opacity-50">
                {loading?"生成中...":"実行計画を生成"}
              </button>
            </div>
            {renderConsultResult()}
          </div>
        )}

        {/* 投資シグナル */}
        {tab==="investment" && (
          <div className="space-y-4">
            {/* ヘッダー */}
            <div style={{background:"linear-gradient(135deg,#0f172a,#1e293b,#0f2744)",borderRadius:"20px",boxShadow:"0 8px 32px rgba(0,0,0,0.4)",padding:"24px"}}>
              <p style={{color:"rgba(99,179,237,0.7)",fontSize:"10px",letterSpacing:"0.15em",fontWeight:700,marginBottom:"4px"}}>MARKET INTELLIGENCE SYSTEM</p>
              <h2 style={{color:"white",fontWeight:900,fontSize:"20px",marginBottom:"6px"}}>📈 投資シグナル分析</h2>
              <p style={{color:"rgba(255,255,255,0.5)",fontSize:"12px",marginBottom:"16px"}}>
                {signals ? `基準日: ${signals.asof_date}　|　反発候補: ${(signals.goal_bottom||[]).length}件　|　売り監視: ${(signals.watch_big_sell||[]).length}件` : "AIが市場データを分析してコンサルティングレポートを生成します"}
              </p>
              <div style={{display:"flex",gap:"8px",marginBottom:"12px",flexWrap:"wrap" as const}}>
                <input
                  type="text"
                  value={stockSearch}
                  onChange={e=>setStockSearch(e.target.value)}
                  placeholder="銘柄コードまたは社名を入力（例: 9984 ソフトバンク）"
                  style={{background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.2)",borderRadius:"10px",padding:"8px 14px",fontSize:"13px",color:"white",flex:1,minWidth:"200px"}}
                />
                <button
                  onClick={fetchStockAnalysis}
                  disabled={stockLoading||!stockSearch.trim()}
                  style={{background:"rgba(255,255,255,0.12)",border:"1px solid rgba(255,255,255,0.2)",borderRadius:"10px",padding:"8px 16px",color:"white",fontSize:"12px",fontWeight:600,cursor:"pointer",whiteSpace:"nowrap" as const}}
                  className="hover:bg-white/20 transition-all disabled:opacity-50">
                  {stockLoading ? "⏳ 分析中..." : "🔍 個別分析"}
                </button>
              </div>
              <button onClick={()=>{if(!analysisLoading)fetchInvestmentAnalysis();}} style={{background:"linear-gradient(135deg,#3b82f6,#6366f1)",borderRadius:"12px",padding:"10px 24px",border:"none",cursor:"pointer",boxShadow:"0 4px 16px rgba(59,130,246,0.4)",opacity:analysisLoading?0.7:1,pointerEvents:"auto" as const}}
                className="text-white font-bold text-sm hover:opacity-90 transition-all">
                {analysisLoading ? "⏳ AI分析中..." : "⚡ AIコンサル分析を実行"}
              </button>
            </div>

            {/* 個別銘柄分析レポート */}
            {stockResult && (
              <div style={{background:C.card,border:"1px solid rgba(79,70,229,0.25)",borderRadius:"20px",boxShadow:C.shadowMd,overflow:"hidden"}}>
                <div style={{background:`linear-gradient(135deg,${C.primary}12,${C.primary2}08)`,borderBottom:`1px solid ${C.borderPrimary}`,padding:"14px 20px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
                    <div style={{width:"4px",height:"20px",background:`linear-gradient(135deg,${C.primary},${C.primary2})`,borderRadius:"2px"}}/>
                    <div>
                      <p style={{color:C.primary,fontWeight:900,fontSize:"16px"}}>{stockResult.code} {stockResult.name}</p>
                      <p style={{color:C.textMuted,fontSize:"11px"}}>個別銘柄コンサル分析</p>
                    </div>
                  </div>
                  <div style={{background:stockResult.action==="買い検討"?"linear-gradient(135deg,#059669,#047857)":stockResult.action==="回避"?"linear-gradient(135deg,#dc2626,#b91c1c)":"linear-gradient(135deg,#d97706,#b45309)",borderRadius:"12px",padding:"8px 16px",textAlign:"center" as const}}>
                    <p style={{color:"white",fontWeight:900,fontSize:"14px"}}>{stockResult.action}</p>
                    <p style={{color:"rgba(255,255,255,0.8)",fontSize:"10px"}}>確信度 {stockResult.confidence}%</p>
                  </div>
                </div>
                <div style={{padding:"20px",display:"flex",flexDirection:"column",gap:"14px"}}>
                  {stockResult.summary && (
                    <div style={{background:`${C.primary}04`,border:`1px solid ${C.borderPrimary}`,borderRadius:"12px",padding:"14px"}}>
                      <p style={{color:C.textSub,fontSize:"13px",lineHeight:"1.8"}}>{stockResult.summary}</p>
                    </div>
                  )}
                  {stockResult.signal_analysis && (
                    <div>
                      <p style={{color:C.textMain,fontWeight:700,fontSize:"13px",marginBottom:"8px"}}>📊 シグナル分析</p>
                      <div className="grid grid-cols-1 gap-2">
                        {Object.entries(stockResult.signal_analysis as Record<string,string>).map(([k,v])=>(
                          <div key={k} style={{background:"rgba(0,0,0,0.02)",border:`1px solid ${C.border}`,borderRadius:"10px",padding:"10px 14px"}}>
                            <span style={{color:C.primary,fontWeight:600,fontSize:"11px"}}>{k==="rank_trend"?"ランクトレンド":k==="sell_pressure"?"売り圧力":"反発可能性"}</span>
                            <p style={{color:C.textSub,fontSize:"12px",marginTop:"3px"}}>{v}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    {stockResult.strengths && Array.isArray(stockResult.strengths) && (
                      <div style={{background:"rgba(5,150,105,0.04)",border:"1px solid rgba(5,150,105,0.15)",borderRadius:"12px",padding:"12px"}}>
                        <p style={{color:"#059669",fontWeight:700,fontSize:"12px",marginBottom:"8px"}}>✅ 強み</p>
                        {(stockResult.strengths as string[]).map((s:string,i:number)=>(
                          <div key={i} style={{display:"flex",gap:"6px",marginBottom:"4px"}}>
                            <span style={{color:"#059669",fontSize:"11px"}}>▶</span>
                            <p style={{color:C.textSub,fontSize:"12px"}}>{s}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    {stockResult.risks && Array.isArray(stockResult.risks) && (
                      <div style={{background:"rgba(239,68,68,0.04)",border:"1px solid rgba(239,68,68,0.15)",borderRadius:"12px",padding:"12px"}}>
                        <p style={{color:"#dc2626",fontWeight:700,fontSize:"12px",marginBottom:"8px"}}>⚠️ リスク</p>
                        {(stockResult.risks as string[]).map((r:string,i:number)=>(
                          <div key={i} style={{display:"flex",gap:"6px",marginBottom:"4px"}}>
                            <span style={{color:"#dc2626",fontSize:"11px"}}>▶</span>
                            <p style={{color:C.textSub,fontSize:"12px"}}>{r}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {stockResult.strategy && (
                    <div style={{background:"rgba(0,0,0,0.02)",border:`1px solid ${C.border}`,borderRadius:"12px",padding:"14px"}}>
                      <p style={{color:C.textMain,fontWeight:700,fontSize:"12px",marginBottom:"10px"}}>📋 投資戦略</p>
                      {Object.entries(stockResult.strategy as Record<string,string>).map(([k,v])=>(
                        <div key={k} style={{marginBottom:"8px"}}>
                          <span style={{color:C.primary,fontWeight:600,fontSize:"11px"}}>{k==="short_term"?"短期戦略":k==="mid_term"?"中期戦略":k==="entry_condition"?"エントリー条件":"エグジット条件"}: </span>
                          <span style={{color:C.textSub,fontSize:"12px"}}>{v}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {stockResult.next_actions && Array.isArray(stockResult.next_actions) && (
                    <div>
                      <p style={{color:C.textMain,fontWeight:700,fontSize:"12px",marginBottom:"8px"}}>⚡ 次のアクション</p>
                      {(stockResult.next_actions as string[]).map((a:string,i:number)=>(
                        <div key={i} style={{display:"flex",alignItems:"flex-start",gap:"10px",marginBottom:"6px"}}>
                          <div style={{background:`linear-gradient(135deg,${C.primary},${C.primary2})`,borderRadius:"50%",width:"20px",height:"20px",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                            <span style={{color:"white",fontWeight:900,fontSize:"10px"}}>{i+1}</span>
                          </div>
                          <p style={{color:C.textSub,fontSize:"12px",lineHeight:"1.7",paddingTop:"1px"}}>{a}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* AIコンサル分析レポート */}
            {analysisData && analysisData.analysis && (
              <div style={{background:C.card,border:"1px solid rgba(59,130,246,0.2)",borderRadius:"20px",boxShadow:C.shadowMd,overflow:"hidden"}}>
                <div style={{background:"linear-gradient(135deg,rgba(59,130,246,0.1),rgba(99,102,241,0.06))",borderBottom:"1px solid rgba(59,130,246,0.15)",padding:"14px 20px",display:"flex",alignItems:"center",gap:"10px"}}>
                  <div style={{width:"4px",height:"20px",background:"linear-gradient(135deg,#3b82f6,#6366f1)",borderRadius:"2px"}}/>
                  <p style={{color:"#3b82f6",fontWeight:800,fontSize:"14px"}}>⚡ AIコンサルタント分析レポート　{analysisData.asof_date}</p>
                </div>
                <div style={{padding:"20px"}}>
                  {/* 市場サマリー */}
                  {analysisData.analysis.market_summary && (
                    <div style={{background:"rgba(59,130,246,0.04)",border:"1px solid rgba(59,130,246,0.12)",borderRadius:"12px",padding:"14px",marginBottom:"16px"}}>
                      <p style={{color:"#3b82f6",fontWeight:700,fontSize:"12px",marginBottom:"6px"}}>📊 市場サマリー</p>
                      <p style={{color:C.textSub,fontSize:"13px",lineHeight:"1.8"}}>{String(analysisData.analysis.market_summary)}</p>
                    </div>
                  )}

                  {/* セクター分析 */}
                  {Array.isArray(analysisData.analysis.sector_analysis) && analysisData.analysis.sector_analysis.length>0 && (
                    <div style={{marginBottom:"16px"}}>
                      <p style={{color:C.textMain,fontWeight:700,fontSize:"13px",marginBottom:"10px"}}>🏭 セクター別シグナル</p>
                      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:"8px"}}>
                        {(analysisData.analysis.sector_analysis as any[]).map((s:any,i:number)=>(
                          <div key={i} style={{background:s.signal==="買い"?"rgba(5,150,105,0.06)":s.signal==="売り"?"rgba(239,68,68,0.06)":"rgba(0,0,0,0.03)",border:`1px solid ${s.signal==="買い"?"rgba(5,150,105,0.2)":s.signal==="売り"?"rgba(239,68,68,0.2)":"rgba(0,0,0,0.08)"}`,borderRadius:"10px",padding:"10px"}}>
                            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"4px"}}>
                              <span style={{color:C.textMain,fontWeight:600,fontSize:"12px"}}>{s.sector}</span>
                              <span style={{background:s.signal==="買い"?"rgba(5,150,105,0.15)":s.signal==="売り"?"rgba(239,68,68,0.15)":"rgba(0,0,0,0.06)",color:s.signal==="買い"?"#059669":s.signal==="売り"?"#dc2626":"#6b7280",borderRadius:"99px",padding:"2px 8px",fontSize:"11px",fontWeight:700}}>{s.signal}</span>
                            </div>
                            <p style={{color:C.textMuted,fontSize:"11px"}}>{s.reason}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 注目銘柄 */}
                  {Array.isArray(analysisData.analysis.top_picks) && analysisData.analysis.top_picks.length>0 && (
                    <div style={{marginBottom:"16px"}}>
                      <p style={{color:C.textMain,fontWeight:700,fontSize:"13px",marginBottom:"10px"}}>🎯 注目銘柄ピック</p>
                      {(analysisData.analysis.top_picks as any[]).map((p:any,i:number)=>(
                        <div key={i} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:"12px",padding:"12px",marginBottom:"8px",boxShadow:C.shadow}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"6px"}}>
                            <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                              <span style={{color:C.primary,fontWeight:900,fontSize:"14px"}}>{p.code}</span>
                              <span style={{color:C.textSub,fontSize:"12px"}}>{p.name}</span>
                            </div>
                            <span style={{background:p.action==="買い検討"?"rgba(5,150,105,0.12)":p.action==="回避"?"rgba(239,68,68,0.12)":"rgba(217,119,6,0.12)",color:p.action==="買い検討"?"#059669":p.action==="回避"?"#dc2626":"#d97706",borderRadius:"99px",padding:"3px 10px",fontSize:"11px",fontWeight:700}}>{p.action}</span>
                          </div>
                          <p style={{color:C.textSub,fontSize:"12px",marginBottom:"4px"}}>{p.reason}</p>
                          <p style={{color:"#dc2626",fontSize:"11px"}}>⚠️ {p.risk}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* リスクアラート */}
                  {Array.isArray(analysisData.analysis.risk_alerts) && analysisData.analysis.risk_alerts.length>0 && (
                    <div style={{marginBottom:"16px"}}>
                      <p style={{color:C.textMain,fontWeight:700,fontSize:"13px",marginBottom:"10px"}}>🚨 リスクアラート</p>
                      {(analysisData.analysis.risk_alerts as any[]).map((r:any,i:number)=>(
                        <div key={i} style={{background:r.severity==="high"?"rgba(239,68,68,0.06)":r.severity==="mid"?"rgba(217,119,6,0.06)":"rgba(0,0,0,0.03)",border:`1px solid ${r.severity==="high"?"rgba(239,68,68,0.2)":r.severity==="mid"?"rgba(217,119,6,0.2)":"rgba(0,0,0,0.08)"}`,borderRadius:"10px",padding:"10px",marginBottom:"6px"}}>
                          <div style={{display:"flex",alignItems:"center",gap:"6px",marginBottom:"4px"}}>
                            <span style={{color:r.severity==="high"?"#dc2626":r.severity==="mid"?"#d97706":"#6b7280",fontWeight:700,fontSize:"12px"}}>{r.severity==="high"?"🔴":r.severity==="mid"?"🟡":"🟢"} {r.title}</span>
                          </div>
                          <p style={{color:C.textMuted,fontSize:"11px"}}>{r.detail}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 戦略提言 */}
                  {analysisData.analysis.strategy && (
                    <div style={{background:"linear-gradient(135deg,rgba(79,70,229,0.06),rgba(124,58,237,0.04))",border:`1px solid ${C.borderPrimary}`,borderRadius:"12px",padding:"14px",marginBottom:"16px"}}>
                      <p style={{color:C.primary,fontWeight:700,fontSize:"12px",marginBottom:"6px"}}>💡 総合戦略提言</p>
                      <p style={{color:C.textSub,fontSize:"13px",lineHeight:"1.8"}}>{String(analysisData.analysis.strategy)}</p>
                    </div>
                  )}

                  {/* 次のアクション */}
                  {Array.isArray(analysisData.analysis.next_actions) && analysisData.analysis.next_actions.length>0 && (
                    <div>
                      <p style={{color:C.textMain,fontWeight:700,fontSize:"13px",marginBottom:"10px"}}>⚡ 次のアクション</p>
                      {(analysisData.analysis.next_actions as string[]).map((a:string,i:number)=>(
                        <div key={i} style={{display:"flex",alignItems:"flex-start",gap:"10px",marginBottom:"8px"}}>
                          <div style={{background:`linear-gradient(135deg,${C.primary},${C.primary2})`,borderRadius:"50%",width:"22px",height:"22px",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,boxShadow:C.shadowPrimary}}>
                            <span style={{color:"white",fontWeight:900,fontSize:"10px"}}>{i+1}</span>
                          </div>
                          <p style={{color:C.textSub,fontSize:"13px",lineHeight:"1.7",paddingTop:"1px"}}>{a}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 全銘柄検索・ランキング */}
            {signals && (
              <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:"16px",boxShadow:C.shadow,overflow:"hidden"}}>
                <div style={{background:`${C.primary}08`,borderBottom:`1px solid ${C.border}`,padding:"12px 16px",display:"flex",alignItems:"center",gap:"8px",flexWrap:"wrap" as const}}>
                  <div style={{width:"4px",height:"18px",background:C.primary,borderRadius:"2px"}}/>
                  <p style={{color:C.primary,fontWeight:800,fontSize:"13px",flex:1}}>🔍 全銘柄ランキング・検索</p>
                  <input
                    value={stockSearch} onChange={e=>setStockSearch(e.target.value)}
                    placeholder="銘柄コード・社名・セクターで検索"
                    style={{background:"rgba(0,0,0,0.04)",border:`1px solid ${C.border}`,borderRadius:"8px",padding:"6px 12px",fontSize:"12px",color:C.textMain,minWidth:"200px"}}
                  />
                  <select value={stockSortKey} onChange={e=>setStockSortKey(e.target.value)}
                    style={{background:"rgba(0,0,0,0.04)",border:`1px solid ${C.border}`,borderRadius:"8px",padding:"6px 10px",fontSize:"12px",color:C.textMain}}>
                    <option value="rank_score">ランクスコア順</option>
                    <option value="sell_score">売りスコア順</option>
                    <option value="bottom_score">底打ちスコア順</option>
                    <option value="rank_today">本日ランク順</option>
                    <option value="rank_prev">前日ランク順</option>
                    <option value="rank_diff">ランク変動順</option>
                    <option value="chg_pct">前日比%順</option>
                    <option value="chg">前日比順</option>
                    <option value="close">終値順</option>
                    <option value="sell_days">売り継続日数順</option>
                    <option value="rebound_1_2d">反発確率順</option>
                  </select>
                </div>
                {(() => {
                  const allStocks = (signals as any).all_stocks || [...(signals.goal_bottom||[]),...(signals.watch_big_sell||[])];
                  const filtered = allStocks.filter((r:any)=>{
                    if (!stockSearch.trim()) return true;
                    const q = stockSearch.toLowerCase();
                    return String(r.code||"").includes(q) || String(r.company_name||"").toLowerCase().includes(q) || String(r.sector||"").includes(q);
                  });
                  const sorted = [...filtered].sort((a:any,b:any)=>Number(b[stockSortKey]||0)-Number(a[stockSortKey]||0));
                  const display = showAllStocks ? sorted : sorted.slice(0,30);
                  return (
                    <div>
                      <div style={{padding:"8px 16px",background:"rgba(0,0,0,0.02)",borderBottom:`1px solid ${C.border}`}}>
                        <span style={{color:C.textMuted,fontSize:"11px"}}>{filtered.length}件中 {display.length}件表示</span>
                      </div>
                      <div style={{overflowX:"auto"}}>
                        <table style={{width:"100%",borderCollapse:"collapse",fontSize:"12px"}}>
                          <thead>
                            <tr>{["#","銘柄","社名","セクター","基準日","終値","前日比","前日比%","本日ランク","前日ランク","変動","売りスコア","底打ちスコア","ランクスコア","売継日","反発率","シグナル"].map(h=>(
                              <th key={h} style={{background:`${C.primary}08`,border:`1px solid ${C.border}`,padding:"7px 10px",color:C.primary,fontWeight:700,whiteSpace:"nowrap" as const,textAlign:"left" as const}}>{h}</th>
                            ))}</tr>
                          </thead>
                          <tbody>
                            {display.map((r:any,i:number)=>(
                              <tr key={i} style={{background:i%2===0?"transparent":"rgba(0,0,0,0.015)"}}>
                                <td style={{border:`1px solid ${C.border}`,padding:"6px 10px",color:C.textMuted,fontSize:"11px"}}>{i+1}</td>
                                <td style={{border:`1px solid ${C.border}`,padding:"6px 10px",color:C.primary,fontWeight:700}}>{String(r.code||"")}</td>
                                <td style={{border:`1px solid ${C.border}`,padding:"6px 10px",color:C.textMain,minWidth:"120px"}}>{String(r.company_name||"")}</td>
                                <td style={{border:`1px solid ${C.border}`,padding:"6px 10px",color:C.textMuted,fontSize:"11px"}}>{String(r.sector||"")}</td>
                                <td style={{border:`1px solid ${C.border}`,padding:"6px 10px",color:C.textMuted,fontSize:"11px"}}>{String(r.asof_date||"")}</td>
                                <td style={{border:`1px solid ${C.border}`,padding:"6px 10px",color:C.textMain,textAlign:"right" as const,fontWeight:600}}>{String(r.close||"")}</td>
                                <td style={{border:`1px solid ${C.border}`,padding:"6px 10px",textAlign:"right" as const,color:Number(r.chg||0)>=0?"#059669":"#dc2626"}}>{Number(r.chg||0)>=0?"+":""}{Number(r.chg||0)%1===0?String(Math.round(Number(r.chg||0))):Number(r.chg||0).toFixed(1)}</td>
                                <td style={{border:`1px solid ${C.border}`,padding:"6px 10px",textAlign:"right" as const,color:Number(r.chg_pct||0)>=0?"#059669":"#dc2626",fontWeight:600}}>{Number(r.chg_pct||0).toFixed(2)}%</td>
                                <td style={{border:`1px solid ${C.border}`,padding:"6px 10px",color:C.textMain,textAlign:"right" as const}}>{String(r.rank_today||"")}</td>
                                <td style={{border:`1px solid ${C.border}`,padding:"6px 10px",color:C.textMuted,textAlign:"right" as const}}>{String(r.rank_prev||"")}</td>
                                <td style={{border:`1px solid ${C.border}`,padding:"6px 10px",textAlign:"right" as const,color:Number(r.rank_diff||0)>0?"#059669":Number(r.rank_diff||0)<0?"#dc2626":C.textMuted,fontWeight:600}}>{Number(r.rank_diff||0)>0?"+":""}{String(r.rank_diff||"")}</td>
                                <td style={{border:`1px solid ${C.border}`,padding:"6px 10px",color:"#dc2626",textAlign:"right" as const}}>{Number(r.sell_score||0).toFixed(2)}</td>
                                <td style={{border:`1px solid ${C.border}`,padding:"6px 10px",color:"#059669",textAlign:"right" as const}}>{Number(r.bottom_score||0).toFixed(2)}</td>
                                <td style={{border:`1px solid ${C.border}`,padding:"6px 10px",color:C.primary,fontWeight:600,textAlign:"right" as const}}>{Number(r.rank_score||0).toFixed(2)}</td>
                                <td style={{border:`1px solid ${C.border}`,padding:"6px 10px",color:C.textMain,textAlign:"right" as const}}>{String(r.sell_days||"")}</td>
                                <td style={{border:`1px solid ${C.border}`,padding:"6px 10px",color:"#7c3aed",textAlign:"right" as const}}>{r.rebound_1_2d!==undefined?Number(r.rebound_1_2d||0).toFixed(2):"-"}</td>
                                <td style={{border:`1px solid ${C.border}`,padding:"6px 10px",textAlign:"center" as const}}>
                                  {r.goal_flag ? <span style={{background:"rgba(5,150,105,0.12)",color:"#059669",borderRadius:"6px",padding:"2px 8px",fontSize:"11px",fontWeight:700}}>反発</span>
                                  : r.big_sell_flag ? <span style={{background:"rgba(239,68,68,0.12)",color:"#dc2626",borderRadius:"6px",padding:"2px 8px",fontSize:"11px",fontWeight:700}}>売り</span>
                                  : <span style={{color:C.textMuted,fontSize:"11px"}}>-</span>}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {sorted.length > 30 && !showAllStocks && (
                        <div style={{padding:"12px",textAlign:"center" as const}}>
                          <button onClick={()=>setShowAllStocks(true)} style={{background:`${C.primary}10`,border:`1px solid ${C.borderPrimary}`,borderRadius:"10px",color:C.primary,padding:"8px 20px",fontSize:"12px",fontWeight:600,cursor:"pointer"}}>
                            さらに表示（残り{sorted.length-30}件）
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* GOAL_BOTTOM テーブル */}
            {signals && (signals.goal_bottom||[]).length > 0 && (
              <div style={{background:C.card,border:"1px solid rgba(5,150,105,0.2)",borderRadius:"16px",boxShadow:C.shadow,overflow:"hidden"}}>
                <div style={{background:"rgba(5,150,105,0.08)",borderBottom:"1px solid rgba(5,150,105,0.15)",padding:"12px 16px",display:"flex",alignItems:"center",gap:"8px"}}>
                  <div style={{width:"4px",height:"18px",background:"#059669",borderRadius:"2px"}}/>
                  <p style={{color:"#059669",fontWeight:800,fontSize:"13px"}}>🎯 反発底打ち候補（GOAL_BOTTOM）　{(signals.goal_bottom||[]).length}件</p>
                </div>
                <div style={{overflowX:"auto"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:"12px"}}>
                    <thead>
                      <tr>{["銘柄","社名","セクター","終値","前日比%","底打ちスコア","ランクスコア","評価"].map(h=>(
                        <th key={h} style={{background:"rgba(5,150,105,0.05)",border:`1px solid ${C.border}`,padding:"8px 10px",color:"#059669",fontWeight:700,whiteSpace:"nowrap" as const,textAlign:"left" as const}}>{h}</th>
                      ))}</tr>
                    </thead>
                    <tbody>
                      {[...(signals.goal_bottom||[])].sort((a:any,b:any)=>Number(b.rank_score||0)-Number(a.rank_score||0)).slice(0,30).map((r:Record<string,unknown>,i:number)=>(
                        <tr key={i} style={{background:i%2===0?"transparent":"rgba(0,0,0,0.01)"}}>
                          <td style={{border:`1px solid ${C.border}`,padding:"7px 10px",color:C.primary,fontWeight:700}}>{String(r.code||"")}</td>
                          <td style={{border:`1px solid ${C.border}`,padding:"7px 10px",color:C.textMain}}>{String(r.company_name||"")}</td>
                          <td style={{border:`1px solid ${C.border}`,padding:"7px 10px",color:C.textMuted,fontSize:"11px"}}>{String(r.sector||"")}</td>
                          <td style={{border:`1px solid ${C.border}`,padding:"7px 10px",color:C.textMain,textAlign:"right" as const,fontWeight:600}}>{String(r.close||"")}</td>
                          <td style={{border:`1px solid ${C.border}`,padding:"7px 10px",textAlign:"right" as const,color:Number(r.chg_pct||0)>=0?"#059669":"#dc2626",fontWeight:600}}>{Number(r.chg_pct||0).toFixed(2)}%</td>
                          <td style={{border:`1px solid ${C.border}`,padding:"7px 10px",color:C.textMain,textAlign:"right" as const}}>{Number(r.bottom_score||0).toFixed(2)}</td>
                          <td style={{border:`1px solid ${C.border}`,padding:"7px 10px",color:C.primary,fontWeight:600,textAlign:"right" as const}}>{Number(r.rank_score||0).toFixed(2)}</td>
                          <td style={{border:`1px solid ${C.border}`,padding:"7px 10px",textAlign:"center" as const}}>
                            <div style={{display:"flex",gap:"4px",justifyContent:"center"}}>
                              <button onClick={()=>handleSignalFeedback(String(r.code||""),signals.asof_date,"goal_bottom",1)} style={{background:"rgba(5,150,105,0.1)",border:"1px solid rgba(5,150,105,0.3)",borderRadius:"6px",color:"#059669",padding:"2px 8px",fontSize:"11px",cursor:"pointer"}}>👍</button>
                              <button onClick={()=>handleSignalFeedback(String(r.code||""),signals.asof_date,"goal_bottom",0)} style={{background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:"6px",color:"#dc2626",padding:"2px 8px",fontSize:"11px",cursor:"pointer"}}>👎</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* WATCH_BIG_SELL テーブル */}
            {signals && (signals.watch_big_sell||[]).length > 0 && (
              <div style={{background:C.card,border:"1px solid rgba(217,119,6,0.2)",borderRadius:"16px",boxShadow:C.shadow,overflow:"hidden"}}>
                <div style={{background:"rgba(217,119,6,0.08)",borderBottom:"1px solid rgba(217,119,6,0.15)",padding:"12px 16px",display:"flex",alignItems:"center",gap:"8px"}}>
                  <div style={{width:"4px",height:"18px",background:"#d97706",borderRadius:"2px"}}/>
                  <p style={{color:"#d97706",fontWeight:800,fontSize:"13px"}}>👁️ 大口売り込み監視（WATCH_BIG_SELL）　{(signals.watch_big_sell||[]).length}件</p>
                </div>
                <div style={{overflowX:"auto"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:"12px"}}>
                    <thead>
                      <tr>{["銘柄","社名","セクター","終値","売りスコア","売り継続日","評価"].map(h=>(
                        <th key={h} style={{background:"rgba(217,119,6,0.05)",border:`1px solid ${C.border}`,padding:"8px 10px",color:"#d97706",fontWeight:700,whiteSpace:"nowrap" as const,textAlign:"left" as const}}>{h}</th>
                      ))}</tr>
                    </thead>
                    <tbody>
                      {[...(signals.watch_big_sell||[])].sort((a:any,b:any)=>Number(b.sell_score||0)-Number(a.sell_score||0)).slice(0,30).map((r:Record<string,unknown>,i:number)=>(
                        <tr key={i} style={{background:i%2===0?"transparent":"rgba(0,0,0,0.01)"}}>
                          <td style={{border:`1px solid ${C.border}`,padding:"7px 10px",color:C.primary,fontWeight:700}}>{String(r.code||"")}</td>
                          <td style={{border:`1px solid ${C.border}`,padding:"7px 10px",color:C.textMain}}>{String(r.company_name||"")}</td>
                          <td style={{border:`1px solid ${C.border}`,padding:"7px 10px",color:C.textMuted,fontSize:"11px"}}>{String(r.sector||"")}</td>
                          <td style={{border:`1px solid ${C.border}`,padding:"7px 10px",color:C.textMain,fontWeight:600,textAlign:"right" as const}}>{String(r.close||"")}</td>
                          <td style={{border:`1px solid ${C.border}`,padding:"7px 10px",color:"#dc2626",fontWeight:600,textAlign:"right" as const}}>{Number(r.sell_score||0).toFixed(2)}</td>
                          <td style={{border:`1px solid ${C.border}`,padding:"7px 10px",color:C.textMain,textAlign:"right" as const}}>{String(r.sell_days||"")}</td>
                          <td style={{border:`1px solid ${C.border}`,padding:"7px 10px",textAlign:"center" as const}}>
                            <div style={{display:"flex",gap:"4px",justifyContent:"center"}}>
                              <button onClick={()=>handleSignalFeedback(String(r.code||""),signals.asof_date,"watch_big_sell",1)} style={{background:"rgba(5,150,105,0.1)",border:"1px solid rgba(5,150,105,0.3)",borderRadius:"6px",color:"#059669",padding:"2px 8px",fontSize:"11px",cursor:"pointer"}}>👍</button>
                              <button onClick={()=>handleSignalFeedback(String(r.code||""),signals.asof_date,"watch_big_sell",0)} style={{background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:"6px",color:"#dc2626",padding:"2px 8px",fontSize:"11px",cursor:"pointer"}}>👎</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {!signals && !analysisData && (
              <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:"16px",boxShadow:C.shadow,padding:"32px",textAlign:"center"}}>
                <p style={{fontSize:"32px",marginBottom:"12px"}}>📈</p>
                <p style={{color:C.textMain,fontWeight:700,fontSize:"14px",marginBottom:"8px"}}>「AIコンサル分析を実行」を押してください</p>
                <p style={{color:C.textMuted,fontSize:"12px"}}>FirebaseのLGBM学習済みシグナルデータを元にAIが市場分析レポートを生成します</p>
              </div>
            )}
          </div>
        )}
        {tab==="graph" && (
          <div className="space-y-4">
            {/* ヘッダーカード */}
            <div style={{background:"linear-gradient(135deg,#0f0c29,#302b63,#24243e)",borderRadius:"20px",boxShadow:"0 8px 32px rgba(99,102,241,0.25)",overflow:"hidden"}}>
              <div style={{padding:"20px 24px 16px"}}>
                <p style={{color:"rgba(255,255,255,0.35)",fontSize:"9px",letterSpacing:"0.2em",fontWeight:700,marginBottom:"6px"}}>CONVERSATION INTELLIGENCE</p>
                <div className="flex items-center justify-between">
                  <div>
                    <h2 style={{color:"white",fontWeight:900,fontSize:"17px",marginBottom:"3px"}}>会話構造マップ</h2>
                    <p style={{color:"rgba(255,255,255,0.38)",fontSize:"11px"}}>相談の思考連鎖とトピック分布を可視化します</p>
                  </div>
                  <button onClick={fetchGraphData} disabled={graphLoading}
                    style={{background:graphLoading?"rgba(255,255,255,0.1)":"linear-gradient(135deg,#6366f1,#8b5cf6)",borderRadius:"12px",padding:"9px 20px",border:"1px solid rgba(255,255,255,0.15)",cursor:graphLoading?"not-allowed":"pointer",boxShadow:graphLoading?"none":"0 4px 16px rgba(99,102,241,0.4)",flexShrink:0,color:"white",fontWeight:700,fontSize:"12px",transition:"all 0.2s"}}>
                    {graphLoading ? "解析中..." : "マップを生成"}
                  </button>
                </div>
              </div>
              {/* トピック凡例 */}
              {graphData && (
                <div style={{borderTop:"1px solid rgba(255,255,255,0.08)",padding:"10px 24px",display:"flex",flexWrap:"wrap" as const,gap:"8px"}}>
                  {[["戦略・競合","#6366f1"],["集客・SNS","#0891b2"],["売上・財務","#059669"],["組織・人材","#d97706"],["投資・株","#dc2626"],["診断・分析","#8b5cf6"],["指名・接客","#db2777"],["その他","#475569"]].map(([label,color])=>(
                    <div key={label} style={{display:"flex",alignItems:"center",gap:"5px"}}>
                      <div style={{width:"8px",height:"8px",borderRadius:"99px",background:color,boxShadow:`0 0 6px ${color}`}}/>
                      <span style={{color:"rgba(255,255,255,0.45)",fontSize:"9px",fontWeight:600}}>{label}</span>
                    </div>
                  ))}
                </div>
              )}
              {/* stats */}
              {graphData && (
                <div style={{borderTop:"1px solid rgba(255,255,255,0.06)",padding:"10px 24px",display:"flex",gap:"24px"}}>
                  {[
                    ["NODES", String(graphData.nodes.length)],
                    ["CONNECTIONS", String(graphData.edges.length)],
                    ["TOPICS", String(new Set(graphData.nodes.map((n:any)=>n.group||"その他")).size)],
                  ].map(([k,v])=>(
                    <div key={k}>
                      <p style={{color:"rgba(255,255,255,0.28)",fontSize:"8px",fontWeight:700,letterSpacing:"0.15em"}}>{k}</p>
                      <p style={{color:"white",fontWeight:900,fontSize:"16px"}}>{v}</p>
                    </div>
                  ))}
                </div>
              )}
              {/* グラフ本体 */}
              {graphLoading && (
                <div style={{padding:"48px 0",textAlign:"center" as const}}>
                  <div style={{display:"inline-block",width:"32px",height:"32px",border:"3px solid rgba(255,255,255,0.1)",borderTop:"3px solid #6366f1",borderRadius:"50%",animation:"spin 1s linear infinite"}}/>
                  <p style={{color:"rgba(255,255,255,0.35)",fontSize:"12px",marginTop:"12px"}}>チャット履歴を構造解析中...</p>
                  <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                </div>
              )}
              {!graphData && !graphLoading && (
                <div style={{padding:"40px 0",textAlign:"center" as const}}>
                  <p style={{color:"rgba(255,255,255,0.2)",fontSize:"12px"}}>「マップを生成」を押すと直近のチャット履歴を構造化します</p>
                </div>
              )}
              <div ref={graphRef} style={{width:"100%",minHeight: graphData ? "480px" : "0px",display: graphData ? "block" : "none"}}/>
            </div>
            {/* 操作ヒント */}
            {graphData && (
              <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:"14px",padding:"12px 16px",display:"flex",gap:"16px",flexWrap:"wrap" as const}}>
                {[["🖱️ ドラッグ","ノードを移動"],["🔍 スクロール","ズームイン/アウト"],["🎯 クリック","ノードを選択"],["◉ 大ノード","中心トピック"]].map(([icon,desc])=>(
                  <div key={desc} style={{display:"flex",alignItems:"center",gap:"6px"}}>
                    <span style={{fontSize:"11px"}}>{icon}</span>
                    <span style={{color:C.textMuted,fontSize:"10px"}}>{desc}</span>
                  </div>
                ))}
              </div>
            )}

            {/* 未解決アラート */}
            {graphData && (graphData as any).unresolved_alerts?.length > 0 && (
              <div style={{background:"rgba(254,226,226,0.9)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:"16px",padding:"16px 20px"}}>
                <p style={{color:"#dc2626",fontSize:"10px",fontWeight:800,letterSpacing:"0.15em",marginBottom:"10px"}}>⚠️ 未解決課題アラート</p>
                {((graphData as any).unresolved_alerts as {topic:string;count:number;message:string}[]).map((a,i)=>(
                  <div key={i} style={{display:"flex",alignItems:"flex-start",gap:"8px",marginBottom:"8px"}}>
                    <span style={{color:"#dc2626",fontWeight:900,fontSize:"13px",flexShrink:0}}>{a.count}回</span>
                    <p style={{color:"#7f1d1d",fontSize:"12px",lineHeight:1.6}}>{a.message}</p>
                  </div>
                ))}
              </div>
            )}

            {/* 課題構造ツリー */}
            {graphData && (graphData as any).issue_tree?.root_issues?.length > 0 && (
              <div style={{background:"rgba(238,242,255,0.95)",border:"1px solid rgba(99,102,241,0.25)",borderRadius:"16px",padding:"16px 20px"}}>
                <p style={{color:"#4338ca",fontSize:"10px",fontWeight:800,letterSpacing:"0.15em",marginBottom:"12px"}}>🧠 AIによる課題構造分析</p>
                {(graphData as any).issue_tree.priority_action && (
                  <div style={{background:"linear-gradient(135deg,#6366f1,#8b5cf6)",borderRadius:"10px",padding:"10px 14px",marginBottom:"12px"}}>
                    <p style={{color:"rgba(255,255,255,0.6)",fontSize:"9px",fontWeight:700,marginBottom:"3px"}}>最優先アクション</p>
                    <p style={{color:"white",fontSize:"13px",fontWeight:700}}>{(graphData as any).issue_tree.priority_action}</p>
                  </div>
                )}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px"}}>
                  {[
                    ["🔴 根本課題","root_issues","#dc2626"],
                    ["🟡 表面的課題","surface_issues","#d97706"],
                    ["🔁 繰り返しパターン","recurring_patterns","#8b5cf6"],
                    ["🌱 成長機会","growth_opportunities","#059669"],
                  ].map(([title,key,color])=>(
                    (graphData as any).issue_tree[key]?.length > 0 && (
                      <div key={key} style={{background:`${color}10`,border:`1px solid ${color}30`,borderRadius:"10px",padding:"10px 12px"}}>
                        <p style={{color:color as string,fontSize:"10px",fontWeight:700,marginBottom:"6px"}}>{title as string}</p>
                        {((graphData as any).issue_tree[key] as string[]).map((item:string,j:number)=>(
                          <div key={j} style={{display:"flex",gap:"4px",marginBottom:"3px"}}>
                            <span style={{color:color as string,fontSize:"9px",flexShrink:0}}>▸</span>
                            <p style={{color:C.textSub,fontSize:"11px",lineHeight:1.5}}>{item}</p>
                          </div>
                        ))}
                      </div>
                    )
                  ))}
                </div>
              </div>
            )}

            {/* 成長トレンド */}
            {graphData && (graphData as any).growth_trend?.length > 0 && (
              <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:"16px",padding:"16px 20px"}}>
                <p style={{color:C.textMain,fontSize:"10px",fontWeight:800,letterSpacing:"0.15em",marginBottom:"12px"}}>📈 相談テーマ・成長トレンド</p>
                <div className="space-y-2">
                  {((graphData as any).growth_trend as {topic:string;session_count:number;last_date:string}[]).slice(0,6).map((t,i)=>(
                    <div key={i} style={{display:"flex",alignItems:"center",gap:"10px"}}>
                      <span style={{color:C.textSub,fontSize:"11px",width:"100px",flexShrink:0}}>{t.topic}</span>
                      <div style={{flex:1,background:"rgba(0,0,0,0.06)",borderRadius:"99px",height:"6px"}}>
                        <div style={{width:`${Math.min(t.session_count*20,100)}%`,background:"linear-gradient(90deg,#6366f1,#8b5cf6)",borderRadius:"99px",height:"6px"}}/>
                      </div>
                      <span style={{color:C.textMuted,fontSize:"10px",width:"40px",textAlign:"right" as const}}>{t.session_count}日</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab==="presentation" && (
          <PresentationTool />
        )}

        {tab==="future" && (
          <div className="space-y-4">
            <div style={{background:"linear-gradient(135deg,#0f172a,#1e1b4b)",borderRadius:"20px",padding:"20px 24px",boxShadow:"0 8px 32px rgba(99,102,241,0.25)"}}>
              <p style={{color:"rgba(255,255,255,0.35)",fontSize:"9px",letterSpacing:"0.2em",fontWeight:700,marginBottom:"6px"}}>FUTURE SIMULATION</p>
              <h2 style={{color:"white",fontWeight:900,fontSize:"17px",marginBottom:"3px"}}>🔮 未来分岐シミュレーター</h2>
              <p style={{color:"rgba(255,255,255,0.38)",fontSize:"11px",marginBottom:"16px"}}>現状・目標・課題を入力してください。ASCENDが複数の未来分岐を生成し、最適ルートを提示します。</p>
              <textarea value={futureInput} onChange={e=>setFutureInput(e.target.value)}
                placeholder="例：売上が3ヶ月連続で下がっている&#10;例：副業を始めたい&#10;例：このまま現職を続けるべきか迷っている&#10;例：新規事業に投資するか放置するか判断したい"
                rows={4} style={{width:"100%",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:"12px",color:"white",padding:"12px",fontSize:"13px",resize:"vertical",boxSizing:"border-box"}}
                className="focus:outline-none placeholder-gray-500"/>
              <button onClick={async()=>{
                if(!futureInput.trim()){setFutureError("入力してください");return;}
                setFutureLoading(true);setFutureError("");setFutureResult(null);
                try{
                  const token=localStorage.getItem("ascend_token")||"";
                  const API_BASE=process.env.NEXT_PUBLIC_API_URL||"";
                  const r=await fetch(`${API_BASE}/api/diagnosis/future_simulation`,{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${token}`},body:JSON.stringify({message:futureInput.trim(),ai_tier:"core"})});
                  const d=await r.json();
                  if(!r.ok){setFutureError(d.detail||"エラーが発生しました");return;}
                  setFutureResult(d.result);
                    loadFutureHistory();
                }catch(e){setFutureError("通信エラーが発生しました");}
                finally{setFutureLoading(false);}
              }} disabled={futureLoading||!futureInput.trim()}
                style={{marginTop:"12px",background:"linear-gradient(135deg,#4f46e5,#7c3aed)",border:"none",borderRadius:"12px",color:"white",fontWeight:700,fontSize:"13px",padding:"10px 28px",cursor:"pointer",opacity:futureLoading||!futureInput.trim()?0.5:1}}>
                {futureLoading?"🔮 分析中...":"🔮 未来を分岐する"}
              </button>
              {futureError && <p style={{color:"#f87171",fontSize:"12px",marginTop:"8px"}}>{futureError}</p>}
            </div>
            {futureResult && (
              <div className="space-y-4">
                {/* 現状認識 */}
                <div style={{background:"rgba(79,70,229,0.08)",border:"1px solid rgba(79,70,229,0.2)",borderRadius:"16px",padding:"16px"}}>
                  <p style={{fontSize:"11px",fontWeight:700,color:"#4f46e5",marginBottom:"6px"}}>📍 現状認識</p>
                  <p style={{fontSize:"13px",color:"#111827",lineHeight:1.7}}>{futureResult.current_state}</p>
                </div>
                {/* 因果分析 */}
                {futureResult.causal_analysis && (
                  <div style={{background:"#fff7ed",border:"1px solid #fed7aa",borderRadius:"16px",padding:"20px"}}>
                    <p style={{fontSize:"11px",fontWeight:700,color:"#ea580c",marginBottom:"14px",letterSpacing:"0.1em"}}>🔍 因果分析 — なぜこの状況に至ったか</p>
                    {/* 根本原因 */}
                    <p style={{fontSize:"11px",fontWeight:700,color:"#9a3412",marginBottom:"8px"}}>根本原因</p>
                    <div className="space-y-2" style={{marginBottom:"16px"}}>
                      {futureResult.causal_analysis.root_causes?.map((c:string,i:number)=>(
                        <div key={i} style={{display:"flex",gap:"10px",alignItems:"flex-start"}}>
                          <span style={{background:"#ea580c",color:"white",borderRadius:"50%",width:"18px",height:"18px",fontSize:"10px",fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:"1px"}}>{i+1}</span>
                          <p style={{fontSize:"13px",color:"#431407",lineHeight:1.6,margin:0}}>{c}</p>
                        </div>
                      ))}
                    </div>
                    {/* 因果チェーン */}
                    <p style={{fontSize:"11px",fontWeight:700,color:"#9a3412",marginBottom:"8px"}}>因果連鎖</p>
                    <div style={{marginBottom:"16px",background:"rgba(234,88,12,0.04)",borderRadius:"10px",padding:"12px"}}>
                      {futureResult.causal_analysis.causal_chain?.map((ch:any,i:number)=>{
                        const isLast=i===futureResult.causal_analysis.causal_chain.length-1;
                        return(
                          <div key={i}>
                            <div style={{display:"flex",gap:"8px",alignItems:"flex-start"}}>
                              <span style={{fontSize:"10px",fontWeight:700,color:"#ea580c",flexShrink:0,marginTop:"2px"}}>原因</span>
                              <p style={{fontSize:"12px",color:"#431407",margin:0,lineHeight:1.6}}>{ch.cause}</p>
                            </div>
                            <div style={{paddingLeft:"8px",borderLeft:"2px solid #fed7aa",marginLeft:"16px",marginTop:"2px",marginBottom:"2px"}}>
                              <span style={{fontSize:"10px",color:"#ea580c"}}>↓</span>
                            </div>
                            <div style={{display:"flex",gap:"8px",alignItems:"flex-start",marginBottom:isLast?0:"12px"}}>
                              <span style={{fontSize:"10px",fontWeight:700,color:"#c2410c",flexShrink:0,marginTop:"2px"}}>結果</span>
                              <p style={{fontSize:"12px",color:"#431407",margin:0,lineHeight:1.6}}>{ch.effect}</p>
                            </div>
                            {!isLast && <div style={{paddingLeft:"8px",borderLeft:"2px solid #fed7aa",marginLeft:"16px",marginTop:"2px",marginBottom:"2px"}}><span style={{fontSize:"10px",color:"#ea580c"}}>↓</span></div>}
                          </div>
                        );
                      })}
                    </div>
                    {/* 繰り返しパターン */}
                    <p style={{fontSize:"11px",fontWeight:700,color:"#9a3412",marginBottom:"6px"}}>繰り返しパターン</p>
                    <p style={{fontSize:"13px",color:"#431407",lineHeight:1.7,marginBottom:"16px",background:"rgba(234,88,12,0.06)",borderRadius:"8px",padding:"10px"}}>{futureResult.causal_analysis.repeat_pattern}</p>
                    {/* 警戒ライン */}
                    <p style={{fontSize:"11px",fontWeight:700,color:"#9a3412",marginBottom:"8px"}}>⚠️ 同じ失敗を防ぐ警戒ライン</p>
                    <div className="space-y-2">
                      {futureResult.causal_analysis.warning_signs?.map((w:string,i:number)=>(
                        <div key={i} style={{display:"flex",gap:"8px",alignItems:"flex-start",background:"rgba(239,68,68,0.05)",border:"1px solid rgba(239,68,68,0.15)",borderRadius:"8px",padding:"8px 12px"}}>
                          <span style={{fontSize:"13px",flexShrink:0}}>🚨</span>
                          <p style={{fontSize:"12px",color:"#7f1d1d",margin:0,lineHeight:1.6}}>{w}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {/* 分岐カード */}
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:"12px"}}>
                  {futureResult.branches?.map((b:any)=>{
                    const isRec = b.id===futureResult.recommended;
                    const isAvoid = b.id===futureResult.avoid_branch;
                    const borderColor = isRec?"#4f46e5":isAvoid?"#ef4444":"rgba(0,0,0,0.08)";
                    const bgColor = isRec?"rgba(79,70,229,0.04)":isAvoid?"rgba(239,68,68,0.03)":"white";
                    const riskColor = b.risk==="高"?"#ef4444":b.risk==="中"?"#f59e0b":"#10b981";
                    return (
                      <div key={b.id} style={{background:bgColor,border:`2px solid ${borderColor}`,borderRadius:"16px",padding:"16px",position:"relative"}}>
                        {isRec && <span style={{position:"absolute",top:"10px",right:"10px",background:"#4f46e5",color:"white",fontSize:"9px",fontWeight:700,padding:"2px 8px",borderRadius:"20px"}}>推奨</span>}
                        {isAvoid && <span style={{position:"absolute",top:"10px",right:"10px",background:"#ef4444",color:"white",fontSize:"9px",fontWeight:700,padding:"2px 8px",borderRadius:"20px"}}>回避</span>}
                        <p style={{fontSize:"10px",fontWeight:700,color:"#6b7280",marginBottom:"4px"}}>ルート {b.id}</p>
                        <p style={{fontSize:"14px",fontWeight:900,color:"#111827",marginBottom:"10px"}}>{b.label}</p>
                        {/* state_transition タイムライン */}
                        {b.state_transition && (
                          <div style={{marginBottom:"12px",padding:"8px",background:"rgba(0,0,0,0.03)",borderRadius:"8px"}}>
                            <p style={{fontSize:"9px",fontWeight:700,color:"#9ca3af",marginBottom:"6px",letterSpacing:"0.05em"}}>因果連鎖</p>
                            {b.state_transition.map((s:string,i:number)=>(
                              <div key={i} style={{display:"flex",flexDirection:"column",alignItems:"flex-start"}}>
                                <span style={{fontSize:"11px",color:"#374151",lineHeight:1.5,fontWeight:i===0||i===b.state_transition.length-1?700:400}}>{s}</span>
                                {i<b.state_transition.length-1 && <span style={{fontSize:"10px",color:"#d1d5db",lineHeight:1}}>↓</span>}
                              </div>
                            ))}
                          </div>
                        )}
                        <div style={{display:"flex",gap:"8px",marginBottom:"6px",flexWrap:"wrap"}}>
                          <span style={{background:"rgba(0,0,0,0.04)",borderRadius:"8px",padding:"2px 8px",fontSize:"10px",fontWeight:700,color:"#374151"}}>成功率 {b.success_rate}%</span>
                          <span style={{background:`${riskColor}18`,borderRadius:"8px",padding:"2px 8px",fontSize:"10px",fontWeight:700,color:riskColor}}>リスク {b.risk}</span>
                        </div>
                        {/* score_basis */}
                        {b.score_basis && (
                          <p style={{fontSize:"10px",color:"#9ca3af",lineHeight:1.6,marginBottom:"10px",fontStyle:"italic"}}>{b.score_basis}</p>
                        )}
                        <ul style={{margin:0,padding:"0 0 0 14px",marginBottom:"10px"}}>
                          {b.points?.map((p:string,i:number)=>(
                            <li key={i} style={{fontSize:"12px",color:"#374151",lineHeight:1.7,marginBottom:"2px"}}>{p}</li>
                          ))}
                        </ul>
                        {/* 追加バッジ */}
                        <div style={{display:"flex",flexWrap:"wrap",gap:"6px",marginBottom:"10px"}}>
                          {b.short_term && <span style={{fontSize:"10px",background:"rgba(99,102,241,0.08)",color:"#4f46e5",borderRadius:"6px",padding:"2px 7px"}}>短期: {b.short_term}</span>}
                          {b.mid_term && <span style={{fontSize:"10px",background:"rgba(245,158,11,0.08)",color:"#d97706",borderRadius:"6px",padding:"2px 7px"}}>中期: {b.mid_term}</span>}
                          {b.long_term && <span style={{fontSize:"10px",background:"rgba(16,185,129,0.08)",color:"#059669",borderRadius:"6px",padding:"2px 7px"}}>長期: {b.long_term}</span>}
                          {b.execution_difficulty && <span style={{fontSize:"10px",background:"rgba(0,0,0,0.05)",color:"#374151",borderRadius:"6px",padding:"2px 7px"}}>実行難易度: {b.execution_difficulty}</span>}
                          {b.continuity_load && <span style={{fontSize:"10px",background:"rgba(0,0,0,0.05)",color:"#374151",borderRadius:"6px",padding:"2px 7px"}}>継続負荷: {b.continuity_load}</span>}
                          {b.market_fit && <span style={{fontSize:"10px",background:"rgba(0,0,0,0.05)",color:"#374151",borderRadius:"6px",padding:"2px 7px"}}>市場適合: {b.market_fit}</span>}
                          {b.current_fit && <span style={{fontSize:"10px",background:"rgba(0,0,0,0.05)",color:"#374151",borderRadius:"6px",padding:"2px 7px"}}>現状整合: {b.current_fit}</span>}
                        </div>
                        {b.required_resources && b.required_resources.length>0 && (
                          <div style={{marginBottom:"10px"}}>
                            <p style={{fontSize:"10px",color:"#6b7280",marginBottom:"3px"}}>必要資源</p>
                            <div style={{display:"flex",flexWrap:"wrap",gap:"4px"}}>
                              {b.required_resources.map((r:string,i:number)=>(
                                <span key={i} style={{fontSize:"10px",background:"rgba(0,0,0,0.04)",color:"#374151",borderRadius:"6px",padding:"2px 7px"}}>{r}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        {b.collapse_risk && (
                          <div style={{marginBottom:"10px",padding:"6px 8px",background:"rgba(239,68,68,0.05)",borderRadius:"6px",borderLeft:"3px solid #ef4444"}}>
                            <p style={{fontSize:"9px",fontWeight:700,color:"#ef4444",marginBottom:"2px"}}>崩壊リスク</p>
                            <p style={{fontSize:"11px",color:"#7f1d1d",lineHeight:1.5}}>{b.collapse_risk}</p>
                          </div>
                        )}
                        {b.expected_return && (
                          <div style={{marginBottom:"10px"}}>
                            <p style={{fontSize:"10px",color:"#6b7280",marginBottom:"2px"}}>期待リターン</p>
                            <p style={{fontSize:"11px",color:"#111827",lineHeight:1.5}}>{b.expected_return}</p>
                          </div>
                        )}
                        <div style={{borderTop:"1px solid rgba(0,0,0,0.06)",paddingTop:"8px",marginTop:"4px"}}>
                          <p style={{fontSize:"10px",color:"#6b7280",marginBottom:"2px"}}>必要行動</p>
                          <p style={{fontSize:"12px",fontWeight:700,color:"#111827"}}>{b.required_action}</p>
                          <p style={{fontSize:"10px",color:"#6b7280",marginTop:"4px",marginBottom:"2px"}}>到達する未来</p>
                          <p style={{fontSize:"12px",fontWeight:700,color:"#111827"}}>{b.future}</p>
                          {b.time_horizon && <p style={{fontSize:"10px",color:"#9ca3af",marginTop:"4px"}}>意思決定期限: {b.time_horizon}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* simulation_basis */}
                {futureResult.simulation_basis && (
                  <div style={{background:"rgba(99,102,241,0.04)",border:"1px solid rgba(99,102,241,0.15)",borderRadius:"12px",padding:"14px"}}>
                    <p style={{fontSize:"11px",fontWeight:700,color:"#4f46e5",marginBottom:"10px",letterSpacing:"0.05em"}}>🧮 ASCEND 前提条件・信頼度</p>
                    {futureResult.simulation_basis.confidence && (
                      <p style={{fontSize:"12px",color:"#374151",marginBottom:"8px"}}>分析信頼度: <strong>{futureResult.simulation_basis.confidence}</strong></p>
                    )}
                    {futureResult.simulation_basis.assumptions?.length>0 && (
                      <div style={{marginBottom:"8px"}}>
                        <p style={{fontSize:"10px",fontWeight:700,color:"#6b7280",marginBottom:"4px"}}>前提仮定</p>
                        {futureResult.simulation_basis.assumptions.map((a:string,i:number)=>(
                          <p key={i} style={{fontSize:"11px",color:"#374151",lineHeight:1.6,marginBottom:"2px"}}>• {a}</p>
                        ))}
                      </div>
                    )}
                    {futureResult.simulation_basis.missing_information?.length>0 && (
                      <div>
                        <p style={{fontSize:"10px",fontWeight:700,color:"#dc2626",marginBottom:"4px"}}>⚠️ 判断に必要だが不明な情報</p>
                        {futureResult.simulation_basis.missing_information.map((m:string,i:number)=>(
                          <p key={i} style={{fontSize:"11px",color:"#7f1d1d",lineHeight:1.6,marginBottom:"2px",background:"rgba(239,68,68,0.06)",borderRadius:"4px",padding:"2px 6px"}}>• {m}</p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {/* 未来マップ */}
                <div style={{background:"#0f172a",borderRadius:"16px",padding:"16px"}}>
                  <p style={{fontSize:"11px",fontWeight:700,color:"rgba(255,255,255,0.5)",marginBottom:"10px"}}>🗺️ 未来マップ</p>
                  <div style={{fontFamily:"monospace",fontSize:"12px",color:"rgba(255,255,255,0.85)",lineHeight:2}}>
                    <div>現在</div>
                    {futureResult.branches?.map((b:any,i:number)=>{
                      const isLast=i===futureResult.branches.length-1;
                      const isRec=b.id===futureResult.recommended;
                      const color=isRec?"#a5b4fc":"rgba(255,255,255,0.7)";
                      return <div key={b.id} style={{color}}>{isLast?" └─":" ├─"} {b.label} → {b.future}</div>;
                    })}
                  </div>
                </div>
                {/* 最終出力 */}
                <div style={{background:"linear-gradient(135deg,#1e1b4b,#0f172a)",borderRadius:"16px",padding:"20px"}}>
                  <p style={{fontSize:"11px",fontWeight:700,color:"rgba(255,255,255,0.4)",marginBottom:"12px",letterSpacing:"0.1em"}}>ASCEND FINAL OUTPUT</p>
                  <p style={{color:"rgba(255,255,255,0.5)",fontSize:"11px",marginBottom:"4px"}}>最も合理的な未来</p>
                  <p style={{color:"#a5b4fc",fontWeight:900,fontSize:"18px",marginBottom:"6px"}}>ルート {futureResult.recommended}</p>
                  {/* recommended_reason 強化表示 */}
                  {typeof futureResult.recommended_reason === "object" && futureResult.recommended_reason !== null ? (
                    <div style={{marginBottom:"16px"}}>
                      {futureResult.recommended_reason.current_alignment && (
                        <div style={{marginBottom:"6px"}}>
                          <p style={{fontSize:"9px",fontWeight:700,color:"rgba(255,255,255,0.4)",marginBottom:"2px"}}>現状整合性</p>
                          <p style={{color:"rgba(255,255,255,0.75)",fontSize:"12px",lineHeight:1.6}}>{futureResult.recommended_reason.current_alignment}</p>
                        </div>
                      )}
                      {futureResult.recommended_reason.sustainability && (
                        <div style={{marginBottom:"6px"}}>
                          <p style={{fontSize:"9px",fontWeight:700,color:"rgba(255,255,255,0.4)",marginBottom:"2px"}}>継続可能性</p>
                          <p style={{color:"rgba(255,255,255,0.75)",fontSize:"12px",lineHeight:1.6}}>{futureResult.recommended_reason.sustainability}</p>
                        </div>
                      )}
                      {futureResult.recommended_reason.low_collapse_reason && (
                        <div style={{marginBottom:"6px"}}>
                          <p style={{fontSize:"9px",fontWeight:700,color:"rgba(255,255,255,0.4)",marginBottom:"2px"}}>崩壊回避性</p>
                          <p style={{color:"rgba(255,255,255,0.75)",fontSize:"12px",lineHeight:1.6}}>{futureResult.recommended_reason.low_collapse_reason}</p>
                        </div>
                      )}
                      {futureResult.recommended_reason.summary && (
                        <p style={{color:"rgba(255,255,255,0.5)",fontSize:"11px",marginTop:"6px",fontStyle:"italic"}}>{futureResult.recommended_reason.summary}</p>
                      )}
                    </div>
                  ) : (
                    <p style={{color:"rgba(255,255,255,0.75)",fontSize:"12px",lineHeight:1.7,marginBottom:"16px"}}>{futureResult.recommended_reason}</p>
                  )}
                  <p style={{color:"rgba(255,255,255,0.5)",fontSize:"11px",marginBottom:"8px"}}>今すぐやるべきこと</p>
                  {futureResult.immediate_actions?.map((a:string,i:number)=>(
                    <div key={i} style={{display:"flex",gap:"10px",alignItems:"flex-start",marginBottom:"6px"}}>
                      <span style={{background:"#4f46e5",color:"white",borderRadius:"50%",width:"18px",height:"18px",fontSize:"10px",fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:"1px"}}>{i+1}</span>
                      <p style={{color:"white",fontSize:"13px",lineHeight:1.6,margin:0}}>{a}</p>
                    </div>
                  ))}
                  <div style={{marginTop:"16px",borderTop:"1px solid rgba(255,255,255,0.1)",paddingTop:"12px"}}>
                    <p style={{color:"rgba(255,255,255,0.5)",fontSize:"11px",marginBottom:"4px"}}>避けるべき未来</p>
                    <p style={{color:"#f87171",fontWeight:700,fontSize:"13px",marginBottom:"4px"}}>ルート {futureResult.avoid_branch}</p>
                    {/* avoid_reason 強化表示 */}
                    {typeof futureResult.avoid_reason === "object" && futureResult.avoid_reason !== null ? (
                      <div>
                        {futureResult.avoid_reason.collapse_trigger && (
                          <div style={{marginBottom:"6px"}}>
                            <p style={{fontSize:"9px",fontWeight:700,color:"rgba(255,255,255,0.4)",marginBottom:"2px"}}>崩壊トリガー</p>
                            <p style={{color:"rgba(255,255,255,0.6)",fontSize:"12px",lineHeight:1.6}}>{futureResult.avoid_reason.collapse_trigger}</p>
                          </div>
                        )}
                        {futureResult.avoid_reason.early_warning && (
                          <div style={{marginBottom:"6px"}}>
                            <p style={{fontSize:"9px",fontWeight:700,color:"rgba(255,255,255,0.4)",marginBottom:"2px"}}>初期警戒兆候</p>
                            <p style={{color:"rgba(255,255,255,0.6)",fontSize:"12px",lineHeight:1.6}}>{futureResult.avoid_reason.early_warning}</p>
                          </div>
                        )}
                        {futureResult.avoid_reason.point_of_no_return && (
                          <div style={{marginBottom:"6px"}}>
                            <p style={{fontSize:"9px",fontWeight:700,color:"rgba(255,255,255,0.4)",marginBottom:"2px"}}>回復困難地点</p>
                            <p style={{color:"rgba(255,255,255,0.6)",fontSize:"12px",lineHeight:1.6}}>{futureResult.avoid_reason.point_of_no_return}</p>
                          </div>
                        )}
                        {futureResult.avoid_reason.summary && (
                          <p style={{color:"rgba(255,255,255,0.4)",fontSize:"11px",marginTop:"4px",fontStyle:"italic"}}>{futureResult.avoid_reason.summary}</p>
                        )}
                      </div>
                    ) : (
                      <p style={{color:"rgba(255,255,255,0.6)",fontSize:"12px",lineHeight:1.7}}>{futureResult.avoid_reason}</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        {tab==="future" && (
        <div style={{background:"white",borderRadius:"16px",padding:"16px 20px",boxShadow:"0 2px 8px rgba(0,0,0,0.06)"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"12px"}}>
            <h4 style={{fontWeight:700,fontSize:"13px",color:"#111827"}}>🔮 過去のシミュレーション履歴</h4>
            <button onClick={loadFutureHistory} style={{fontSize:"11px",color:"#6b7280",background:"none",border:"none",cursor:"pointer"}}>更新</button>
          </div>
          {futureHistory.length===0?(
            <p style={{fontSize:"12px",color:"#9ca3af",textAlign:"center" as const,padding:"12px 0"}}>履歴なし（「更新」を押してください）</p>
          ):futureHistory.map(h=>(
            <div key={h.doc_id} style={{padding:"10px 12px",borderRadius:"10px",border:"1px solid rgba(0,0,0,0.07)",marginBottom:"8px",background:"#f8f9fc"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"4px"}}>
                <div style={{flex:1,minWidth:0,marginRight:"8px"}}>
                  <p style={{fontWeight:600,fontSize:"12px",color:"#111827",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" as const}}>{h.message||"（入力なし）"}</p>
                  <p style={{fontSize:"10px",color:"#9ca3af"}}>{(h.created_at||"").slice(0,16)}</p>
                </div>
                <div style={{display:"flex",gap:"4px",flexShrink:0}}>
                  <button onClick={()=>{if(h.result){setFutureResult(h.result);window.scrollTo({top:0,behavior:"smooth"});}}} style={{fontSize:"10px",color:"#4f46e5",background:"none",border:"1px solid #4f46e5",borderRadius:"6px",padding:"2px 7px",cursor:"pointer"}}>開く</button>
                  <button onClick={()=>deleteFutureSimulation(h.doc_id)} style={{fontSize:"10px",color:"#ef4444",background:"none",border:"1px solid #ef4444",borderRadius:"6px",padding:"2px 7px",cursor:"pointer"}}>削除</button>
                  {h.prediction_tracking?.status==="pending" ? (
                    <button onClick={()=>{setReviewTarget(h);setReviewResult(null);setReviewInput({actual_outcome:"",actual_success_level:50,actual_risk:"中",actual_state:""});}} style={{fontSize:"10px",color:"#f59e0b",background:"none",border:"1px solid #f59e0b",borderRadius:"6px",padding:"2px 7px",cursor:"pointer"}}>検証入力</button>
                  ) : h.prediction_tracking?.status==="validated" ? (
                    <span style={{fontSize:"10px",color:"#10b981",fontWeight:700}}>✓ 検証済 {h.prediction_tracking.accuracy_score}pt</span>
                  ) : null}
                </div>
              </div>
              {h.result?.recommended && (
                <p style={{fontSize:"11px",color:"#6b7280"}}>推奨: ルート {h.result.recommended}　{(()=>{const r=h.result?.recommended_reason;const s=typeof r==="object"&&r!==null?r.summary||"":String(r||"");return s.slice(0,40)+(s.length>40?"…":"");})()}</p>
              )}
            </div>
          ))}
        {/* 検証入力モーダル */}
        {reviewTarget && (
          <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px"}}>
            <div style={{background:"white",borderRadius:"16px",padding:"20px",width:"100%",maxWidth:"480px",maxHeight:"80vh",overflowY:"auto"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"16px"}}>
                <p style={{fontWeight:700,fontSize:"14px",color:"#111827"}}>🔍 予測検証 — 実際の結果を入力</p>
                <button onClick={()=>{setReviewTarget(null);setReviewResult(null);}} style={{background:"none",border:"none",fontSize:"18px",cursor:"pointer",color:"#6b7280"}}>✕</button>
              </div>
              <p style={{fontSize:"11px",color:"#6b7280",marginBottom:"12px"}}>推奨ルート: <strong>{reviewTarget.result?.recommended}</strong> / シミュレーション日: {(reviewTarget.created_at||"").slice(0,10)}</p>
              <div style={{marginBottom:"12px"}}>
                <p style={{fontSize:"11px",fontWeight:700,color:"#374151",marginBottom:"4px"}}>実際の結果（どうなったか）</p>
                <textarea value={reviewInput.actual_outcome} onChange={e=>setReviewInput((p:any)=>({...p,actual_outcome:e.target.value}))} rows={3} placeholder="例：売上が少し改善した、施策を実行したが効果なし、別の問題が発生した..." style={{width:"100%",border:"1px solid #e5e7eb",borderRadius:"8px",padding:"8px",fontSize:"12px",resize:"vertical",boxSizing:"border-box" as const}}/>
              </div>
              <div style={{marginBottom:"12px"}}>
                <p style={{fontSize:"11px",fontWeight:700,color:"#374151",marginBottom:"4px"}}>実際の成功度 (0〜100)</p>
                <input type="range" min={0} max={100} value={reviewInput.actual_success_level} onChange={e=>setReviewInput((p:any)=>({...p,actual_success_level:Number(e.target.value)}))} style={{width:"100%"}}/>
                <p style={{fontSize:"11px",color:"#6b7280",textAlign:"center" as const}}>{reviewInput.actual_success_level}点</p>
              </div>
              <div style={{marginBottom:"12px"}}>
                <p style={{fontSize:"11px",fontWeight:700,color:"#374151",marginBottom:"4px"}}>実際のリスク</p>
                <div style={{display:"flex",gap:"8px"}}>
                  {["低","中","高"].map(r=>(
                    <button key={r} onClick={()=>setReviewInput((p:any)=>({...p,actual_risk:r}))} style={{flex:1,padding:"6px",borderRadius:"8px",border:`2px solid ${reviewInput.actual_risk===r?"#4f46e5":"#e5e7eb"}`,background:reviewInput.actual_risk===r?"rgba(79,70,229,0.08)":"white",fontWeight:700,fontSize:"12px",cursor:"pointer",color:reviewInput.actual_risk===r?"#4f46e5":"#374151"}}>{r}</button>
                  ))}
                </div>
              </div>
              <div style={{marginBottom:"16px"}}>
                <p style={{fontSize:"11px",fontWeight:700,color:"#374151",marginBottom:"4px"}}>現在の状態</p>
                <textarea value={reviewInput.actual_state} onChange={e=>setReviewInput((p:any)=>({...p,actual_state:e.target.value}))} rows={2} placeholder="例：事業継続中、部分的に改善、撤退検討中..." style={{width:"100%",border:"1px solid #e5e7eb",borderRadius:"8px",padding:"8px",fontSize:"12px",resize:"vertical",boxSizing:"border-box" as const}}/>
              </div>
              {reviewResult && (
                <div style={{background:"rgba(79,70,229,0.06)",border:"1px solid rgba(79,70,229,0.2)",borderRadius:"10px",padding:"12px",marginBottom:"16px"}}>
                  <p style={{fontSize:"11px",fontWeight:700,color:"#4f46e5",marginBottom:"6px"}}>📊 予測精度スコア</p>
                  <p style={{fontSize:"24px",fontWeight:900,color:"#111827",marginBottom:"4px"}}>{reviewResult.accuracy_score}点</p>
                  {reviewResult.prediction_gap && (
                    <div style={{fontSize:"11px",color:"#6b7280",lineHeight:1.7}}>
                      <p>予測成功率: {reviewResult.prediction_gap.predicted_success_rate}% → 実際: {reviewResult.prediction_gap.actual_success_level}点（差: {reviewResult.prediction_gap.rate_gap}）</p>
                      <p>リスク予測: {reviewResult.prediction_gap.predicted_risk} → 実際: {reviewResult.prediction_gap.actual_risk} {reviewResult.prediction_gap.risk_matched?"✓ 一致":"✗ 不一致"}</p>
                    </div>
                  )}
                </div>
              )}
              <button onClick={async()=>{
                if(!reviewInput.actual_outcome.trim()){return;}
                setReviewLoading(true);
                try{
                  const token=localStorage.getItem("ascend_token")||"";
                  const API_BASE=process.env.NEXT_PUBLIC_API_URL||"";
                  const r=await fetch(`${API_BASE}/api/diagnosis/future_simulation_review/${reviewTarget.doc_id}`,{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${token}`},body:JSON.stringify(reviewInput)});
                  const d=await r.json();
                  if(r.ok){setReviewResult(d);loadFutureHistory();}
                }catch(e){}
                finally{setReviewLoading(false);}
              }} disabled={reviewLoading||!reviewInput.actual_outcome.trim()} style={{width:"100%",background:"linear-gradient(135deg,#4f46e5,#7c3aed)",border:"none",borderRadius:"10px",color:"white",fontWeight:700,fontSize:"13px",padding:"10px",cursor:"pointer",opacity:reviewLoading||!reviewInput.actual_outcome.trim()?0.5:1}}>
                {reviewLoading?"送信中...":"検証を送信する"}
              </button>
            </div>
          </div>
        )}
        </div>
      )}
      {tab==="file" && (
          <div className="space-y-4">
            <div style={{background:"linear-gradient(135deg,#0f172a,#1e293b)",borderRadius:"20px",padding:"20px 24px",boxShadow:"0 8px 32px rgba(99,102,241,0.2)"}}>
              <p style={{color:"rgba(255,255,255,0.35)",fontSize:"9px",letterSpacing:"0.2em",fontWeight:700,marginBottom:"6px"}}>FILE DIAGNOSIS</p>
              <h2 style={{color:"white",fontWeight:900,fontSize:"17px",marginBottom:"3px"}}>🧾 ファイル診断</h2>
              <p style={{color:"rgba(255,255,255,0.38)",fontSize:"11px",marginBottom:"16px"}}>ファイルをアップロードして全タブを横断解析し、構造診断・課題仮説・実行計画を一括生成します</p>
              <FileDiagnosis C={C} />
            </div>
          </div>
        )}
        {tab==="profile" && mounted && features?.diag_profile===true && (
          <div className="space-y-4">
            <div style={{background:"linear-gradient(135deg,#0f172a,#1e1b4b)",borderRadius:"20px",padding:"20px 24px",boxShadow:"0 8px 32px rgba(99,102,241,0.25)"}}>
              <p style={{color:"rgba(255,255,255,0.35)",fontSize:"9px",letterSpacing:"0.2em",fontWeight:700,marginBottom:"6px"}}>PROFILE ANALYSIS</p>
              <h2 style={{color:"white",fontWeight:900,fontSize:"17px",marginBottom:"3px"}}>🕵️ プロファイル生成</h2>
              <p style={{color:"rgba(255,255,255,0.38)",fontSize:"11px",marginBottom:"16px"}}>対象者の言動・反応・価値基準から行動原理・思考傾向・対人構造を分析します。</p>
              <p style={{color:"rgba(255,255,255,0.45)",fontSize:"10px",fontWeight:800,letterSpacing:"0.1em",marginBottom:"8px"}}>基本情報</p>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px",marginBottom:"4px"}}>
                {([{key:"target_name",label:"対象者名（任意）",ph:"例：田中さん"},{key:"relationship",label:"関係性",ph:"上司・恋人・部下・顧客"}] as {key:string;label:string;ph:string}[]).map(({key,label,ph})=>(
                  <div key={key}>
                    <p style={{color:"rgba(255,255,255,0.6)",fontSize:"11px",marginBottom:"3px"}}>{label}</p>
                    <input value={profileInput[key]||""} onChange={e=>setProfileInput(p=>({...p,[key]:e.target.value}))} placeholder={ph} style={{width:"100%",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:"8px",color:"white",padding:"8px 10px",fontSize:"12px",boxSizing:"border-box"}} className="focus:outline-none"/>
                  </div>
                ))}
              </div>
              <p style={{color:"rgba(255,255,255,0.45)",fontSize:"10px",fontWeight:800,letterSpacing:"0.1em",marginTop:"14px",marginBottom:"8px"}}>💬 会話傾向</p>
              {([{key:"frequent_words",label:"よく使う言葉・話題（複数入力可）",ph:"効率、不安、承認、お金、他人批判、理想論"},{key:"conversation_traits",label:"会話時の特徴",ph:"話を遮る、結論を急ぐ、感情で広がる、自分語りが多い、否定から入る"}] as {key:string;label:string;ph:string}[]).map(({key,label,ph})=>(
                <div key={key} style={{marginBottom:"8px"}}>
                  <p style={{color:"rgba(255,255,255,0.6)",fontSize:"11px",marginBottom:"3px"}}>{label}</p>
                  <textarea value={profileInput[key]||""} onChange={e=>setProfileInput(p=>({...p,[key]:e.target.value}))} rows={2} placeholder={ph} style={{width:"100%",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:"8px",color:"white",padding:"8px 10px",fontSize:"12px",resize:"vertical",boxSizing:"border-box"}} className="focus:outline-none placeholder-gray-600"/>
                </div>
              ))}
              <p style={{color:"rgba(255,255,255,0.45)",fontSize:"10px",fontWeight:800,letterSpacing:"0.1em",marginTop:"14px",marginBottom:"8px"}}>⚙️ 行動構造</p>
              {([{key:"judgment_criteria",label:"判断基準（何を優先して動くか）",ph:"損得、安心、承認、支配、愛情、正義、合理性"},{key:"stress_reaction",label:"ストレス時の反応（当てはまるものを入力）",ph:"他責、自責、無反応、逃避、過剰防衛"},{key:"behavioral_patterns",label:"繰り返す行動パターン",ph:"先延ばし、依存、過集中、被害者化"}] as {key:string;label:string;ph:string}[]).map(({key,label,ph})=>(
                <div key={key} style={{marginBottom:"8px"}}>
                  <p style={{color:"rgba(255,255,255,0.6)",fontSize:"11px",marginBottom:"3px"}}>{label}</p>
                  <textarea value={profileInput[key]||""} onChange={e=>setProfileInput(p=>({...p,[key]:e.target.value}))} rows={2} placeholder={ph} style={{width:"100%",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:"8px",color:"white",padding:"8px 10px",fontSize:"12px",resize:"vertical",boxSizing:"border-box"}} className="focus:outline-none placeholder-gray-600"/>
                </div>
              ))}
              <p style={{color:"rgba(255,255,255,0.45)",fontSize:"10px",fontWeight:800,letterSpacing:"0.1em",marginTop:"14px",marginBottom:"8px"}}>👥 対人構造</p>
              {([{key:"interpersonal_needs",label:"人間関係で求めるもの",ph:"安心感、優位性、承認、支配、共感、距離感"},{key:"disliked_types",label:"苦手な相手",ph:"圧が強い人、論理型、感情型、指示的な人"},{key:"trust_conditions",label:"信頼する条件",ph:"話を聴く、否定しない、有能さ、一貫性、秘密保持"}] as {key:string;label:string;ph:string}[]).map(({key,label,ph})=>(
                <div key={key} style={{marginBottom:"8px"}}>
                  <p style={{color:"rgba(255,255,255,0.6)",fontSize:"11px",marginBottom:"3px"}}>{label}</p>
                  <textarea value={profileInput[key]||""} onChange={e=>setProfileInput(p=>({...p,[key]:e.target.value}))} rows={2} placeholder={ph} style={{width:"100%",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:"8px",color:"white",padding:"8px 10px",fontSize:"12px",resize:"vertical",boxSizing:"border-box"}} className="focus:outline-none placeholder-gray-600"/>
                </div>
              ))}
              <p style={{color:"rgba(255,255,255,0.45)",fontSize:"10px",fontWeight:800,letterSpacing:"0.1em",marginTop:"14px",marginBottom:"8px"}}>💼 仕事・行動特性</p>
              {([{key:"work_attitude",label:"仕事への姿勢",ph:"完璧主義、責任感強い、受け身、独立型、評価依存"},{key:"preferred_environment",label:"得意な環境",ph:"裁量あり、明確指示、少人数、競争環境"},{key:"breakdown_conditions",label:"崩れる条件",ph:"管理過多、曖昧指示、否定、孤立、プレッシャー"}] as {key:string;label:string;ph:string}[]).map(({key,label,ph})=>(
                <div key={key} style={{marginBottom:"8px"}}>
                  <p style={{color:"rgba(255,255,255,0.6)",fontSize:"11px",marginBottom:"3px"}}>{label}</p>
                  <textarea value={profileInput[key]||""} onChange={e=>setProfileInput(p=>({...p,[key]:e.target.value}))} rows={2} placeholder={ph} style={{width:"100%",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:"8px",color:"white",padding:"8px 10px",fontSize:"12px",resize:"vertical",boxSizing:"border-box"}} className="focus:outline-none placeholder-gray-600"/>
                </div>
              ))}
              <p style={{color:"rgba(255,255,255,0.45)",fontSize:"10px",fontWeight:800,letterSpacing:"0.1em",marginTop:"14px",marginBottom:"8px"}}>🧭 価値観・信念</p>
              {([{key:"core_values",label:"大事にしているもの（複数入力可）",ph:"自由、成長、安定、愛情、支配、誠実、結果"},{key:"strong_reactions",label:"強く反応すること（当てはまるものを入力）",ph:"否定、無視、裏切り、失敗、軽視、不公平"}] as {key:string;label:string;ph:string}[]).map(({key,label,ph})=>(
                <div key={key} style={{marginBottom:"8px"}}>
                  <p style={{color:"rgba(255,255,255,0.6)",fontSize:"11px",marginBottom:"3px"}}>{label}</p>
                  <textarea value={profileInput[key]||""} onChange={e=>setProfileInput(p=>({...p,[key]:e.target.value}))} rows={2} placeholder={ph} style={{width:"100%",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:"8px",color:"white",padding:"8px 10px",fontSize:"12px",resize:"vertical",boxSizing:"border-box"}} className="focus:outline-none placeholder-gray-600"/>
                </div>
              ))}
              <p style={{color:"rgba(255,255,255,0.45)",fontSize:"10px",fontWeight:800,letterSpacing:"0.1em",marginTop:"14px",marginBottom:"8px"}}>🔍 構造的シグナル</p>
              {([{key:"contradictions",label:"繰り返す矛盾（何度も起きるパターン）",ph:"約束を守らない、話題をすり替える、認めない後に謝る"},{key:"obsessions",label:"執着していること",ph:"評価、地位、特定の人、お金、承認、正しさ"},{key:"anger_points",label:"強く反応・怒るポイント",ph:"コントロールを失う、否定される、無視される、責められる"}] as {key:string;label:string;ph:string}[]).map(({key,label,ph})=>(
                <div key={key} style={{marginBottom:"8px"}}>
                  <p style={{color:"rgba(255,255,255,0.6)",fontSize:"11px",marginBottom:"3px"}}>{label}</p>
                  <textarea value={profileInput[key]||""} onChange={e=>setProfileInput(p=>({...p,[key]:e.target.value}))} rows={2} placeholder={ph} style={{width:"100%",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:"8px",color:"white",padding:"8px 10px",fontSize:"12px",resize:"vertical",boxSizing:"border-box"}} className="focus:outline-none placeholder-gray-600"/>
                </div>
              ))}
              <p style={{color:"rgba(255,255,255,0.45)",fontSize:"10px",fontWeight:800,letterSpacing:"0.1em",marginTop:"14px",marginBottom:"8px"}}>⚖️ 正義化・責任構造</p>
              {([{key:"justification_patterns",label:"正義化・自己正当化パターン",ph:"自分は悪くない、環境が悪い、仕方なかった、お前のせい"},{key:"ignored_topics",label:"無視する論点・沈黙する箇所",ph:"責任の話になると黙る、数字を聞くと話題を変える"},{key:"responsibility_shift",label:"責任転嫁の方向",ph:"上司のせい、部下のせい、環境のせい、運のせい"}] as {key:string;label:string;ph:string}[]).map(({key,label,ph})=>(
                <div key={key} style={{marginBottom:"8px"}}>
                  <p style={{color:"rgba(255,255,255,0.6)",fontSize:"11px",marginBottom:"3px"}}>{label}</p>
                  <textarea value={profileInput[key]||""} onChange={e=>setProfileInput(p=>({...p,[key]:e.target.value}))} rows={2} placeholder={ph} style={{width:"100%",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:"8px",color:"white",padding:"8px 10px",fontSize:"12px",resize:"vertical",boxSizing:"border-box"}} className="focus:outline-none placeholder-gray-600"/>
                </div>
              ))}
              <p style={{color:"rgba(255,255,255,0.45)",fontSize:"10px",fontWeight:800,letterSpacing:"0.1em",marginTop:"14px",marginBottom:"8px"}}>🔍 行動痕跡（環境への無意識の刻印）</p>
              <div style={{marginBottom:"8px"}}>
                <p style={{color:"rgba(255,255,255,0.6)",fontSize:"11px",marginBottom:"3px"}}>観察された行動痕跡（複数記入・箇条書き推奨）</p>
                <textarea value={profileInput["behavioral_traces"]||""} onChange={e=>setProfileInput(p=>({...p,behavioral_traces:e.target.value}))} rows={4} placeholder={"会議で結論直前に別議題を出す / 報告メールが長いほど謝罪が増える / 完成直前でやり直しを要求する / 机が常に物で隠れている / 食事を必ず残す"} style={{width:"100%",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:"8px",color:"white",padding:"8px 10px",fontSize:"12px",resize:"vertical",boxSizing:"border-box"}} className="focus:outline-none placeholder-gray-600"/>
              </div>
              <button onClick={handleProfileGenerate} disabled={profileLoading} style={{width:"100%",padding:"12px",borderRadius:"12px",background:profileLoading?"rgba(255,255,255,0.1)":"linear-gradient(135deg,#6366f1,#8b5cf6)",color:"white",fontWeight:700,fontSize:"14px",border:"none",cursor:profileLoading?"not-allowed":"pointer",marginTop:"16px"}}>
                {profileLoading?"🔄 分析中...":"🕵️ プロファイルを生成する"}
              </button>
              {profileError && <p style={{color:"#f87171",fontSize:"12px",marginTop:"8px",padding:"8px 12px",background:"rgba(248,113,113,0.12)",borderRadius:"8px"}}>⚠️ {profileError}</p>}
            </div>
            {profileResult && (
              <div id="profile-result-output" style={{background:"white",borderRadius:"20px",padding:"20px 24px",boxShadow:"0 4px 16px rgba(0,0,0,0.08)"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"20px"}}>
                  <div>
                    <p style={{fontSize:"11px",color:"#6b7280",marginBottom:"2px"}}>{profileResult.generated_at} ■ {profileResult.relationship}</p>
                    <h3 style={{fontWeight:800,fontSize:"16px",color:"#111827"}}>{profileResult.target_name}</h3>
                  </div>
                  <button onClick={handleProfilePrint} style={{padding:"8px 16px",borderRadius:"10px",background:"#4f46e5",color:"white",fontWeight:700,fontSize:"13px",border:"none",cursor:"pointer"}}>🖨️ 印刷・保存</button>
                </div>
                {(profileResult as any).unique_causal_chain && (
                  <div style={{background:"linear-gradient(135deg,#1a0533,#2d1066)",borderRadius:"14px",padding:"16px 18px",marginBottom:"14px",border:"1px solid rgba(139,92,246,0.3)"}}>
                    <p style={{fontSize:"9px",color:"rgba(167,139,250,0.8)",fontWeight:700,letterSpacing:"0.15em",marginBottom:"10px"}}>🔗 固有因果連鎖 / UNIQUE CAUSAL CHAIN</p>
                    <p style={{fontSize:"13px",color:"rgba(255,255,255,0.95)",lineHeight:"1.8",fontWeight:500}}>{(profileResult as any).unique_causal_chain}</p>
                  </div>
                )}
                {((profileResult as any).existence_connection||(profileResult as any).learned_world_model||(profileResult as any).what_was_abandoned||(profileResult as any).unconscious_signatures) && (
                  <div style={{marginBottom:"14px"}}>
                    <p style={{fontSize:"10px",color:"#111827",fontWeight:700,letterSpacing:"0.1em",marginBottom:"8px"}}>🧬 存在構造レポート</p>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"6px"}}>
                      {([{k:"existence_connection",l:"⚡ 存在接続",c:"#dc2626",bg:"#fff1f2"},{k:"learned_world_model",l:"🌐 世界モデル",c:"#0284c7",bg:"#f0f9ff"},{k:"what_was_abandoned",l:"🚫 諦め学習",c:"#7c3aed",bg:"#faf5ff"},{k:"unconscious_signatures",l:"👁 無意識痕跡",c:"#059669",bg:"#f0fdf4"}] as {k:string;l:string;c:string;bg:string}[]).filter(({k})=>(profileResult as any)[k]).map(({k,l,c,bg})=>(
                        <div key={k} style={{background:bg,borderLeft:`3px solid ${c}`,padding:"10px 12px",borderRadius:"0 8px 8px 0"}}>
                          <p style={{fontSize:"9px",color:c,fontWeight:700,marginBottom:"4px"}}>{l}</p>
                          <p style={{fontSize:"11px",color:"#111827",lineHeight:"1.5"}}>{(profileResult as any)[k]}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {(profileResult.main_type||profileResult.sub_type) && (
                  <div style={{marginBottom:"14px"}}>
                    <p style={{fontSize:"10px",color:"#6b7280",fontWeight:700,letterSpacing:"0.1em",marginBottom:"8px"}}>■ 構造レイヤー</p>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"6px"}}>
                      {[{label:"主構造",val:profileResult.main_type,c:"#4f46e5",bg:"#eef2ff"},{label:"副構造",val:profileResult.sub_type,c:"#7c3aed",bg:"#faf5ff"},{label:"ストレス時移行",val:profileResult.stress_type,c:"#dc2626",bg:"#fef2f2"},{label:"対人時変化",val:profileResult.interpersonal_type,c:"#059669",bg:"#f0fdf4"}].filter(x=>x.val).map(({label,val,c,bg})=>(
                        <div key={label} style={{background:bg,borderLeft:`3px solid ${c}`,padding:"8px 10px",borderRadius:"0 8px 8px 0"}}>
                          <p style={{fontSize:"9px",color:c,fontWeight:700,marginBottom:"2px"}}>{label}</p>
                          <p style={{fontSize:"11px",color:"#111827",lineHeight:"1.4"}}>{val}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {profileResult.core_motivation && (
                  <div style={{background:"#fef2f2",borderLeft:"3px solid #ef4444",padding:"12px 14px",borderRadius:"0 10px 10px 0",marginBottom:"10px"}}>
                    <p style={{fontSize:"9px",color:"#ef4444",fontWeight:700,marginBottom:"4px"}}>🎯 中心核（何を恐れ、何を守ろうとしているか）</p>
                    <p style={{fontSize:"12px",color:"#111827",lineHeight:"1.6"}}>{profileResult.core_motivation}</p>
                  </div>
                )}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"6px",marginBottom:"10px"}}>
                  {([{k:"defense_function",l:"🛡️ 防衛機能",c:"#f59e0b",bg:"#fffbeb"},{k:"reality_processing",l:"🔄 現実処理傾向",c:"#6366f1",bg:"#eef2ff"},{k:"responsibility_connection",l:"⚖️ 責任接続性",c:"#8b5cf6",bg:"#faf5ff"},{k:"self_esteem_maintenance",l:"💠 自尊心維持",c:"#0891b2",bg:"#ecfeff"}] as {k:string;l:string;c:string;bg:string}[]).filter(({k})=>(profileResult as any)[k]).map(({k,l,c,bg})=>(
                    <div key={k} style={{background:bg,borderLeft:`3px solid ${c}`,padding:"8px 10px",borderRadius:"0 8px 8px 0"}}>
                      <p style={{fontSize:"9px",color:c,fontWeight:700,marginBottom:"3px"}}>{l}</p>
                      <p style={{fontSize:"11px",color:"#111827",lineHeight:"1.5"}}>{(profileResult as any)[k]}</p>
                    </div>
                  ))}
                </div>
                {profileResult.chain_trigger && (
                  <div style={{background:"linear-gradient(135deg,#0f172a,#1e1b4b)",borderRadius:"14px",padding:"14px 16px",marginBottom:"10px"}}>
                    <p style={{fontSize:"9px",color:"rgba(255,255,255,0.45)",fontWeight:700,letterSpacing:"0.1em",marginBottom:"10px"}}>⛓️ 行動連鎖</p>
                    {([{k:"chain_trigger",l:"起点"},{k:"chain_primary",l:"一次反応"},{k:"chain_defense",l:"防衛反応"},{k:"chain_result",l:"結果"},{k:"chain_chronic",l:"長期化"}] as {k:string;l:string}[]).filter(({k})=>(profileResult as any)[k]).map(({k,l},i,arr)=>(
                      <div key={k} style={{marginBottom:i<arr.length-1?"8px":"0"}}>
                        <div style={{display:"flex",alignItems:"flex-start",gap:"8px"}}>
                          <span style={{minWidth:"52px",background:"rgba(99,102,241,0.3)",borderRadius:"4px",padding:"2px 6px",fontSize:"9px",color:"rgba(255,255,255,0.7)",fontWeight:700,textAlign:"center",marginTop:"2px"}}>{l}</span>
                          <p style={{fontSize:"12px",color:"rgba(255,255,255,0.9)",lineHeight:"1.5"}}>{(profileResult as any)[k]}</p>
                        </div>
                        {i<arr.length-1 && <p style={{color:"rgba(99,102,241,0.5)",fontSize:"12px",marginLeft:"30px",marginTop:"2px"}}>↓</p>}
                      </div>
                    ))}
                  </div>
                )}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"6px",marginBottom:"14px"}}>
                  {([{k:"breakdown_prediction",l:"⚡ 崩壊予測",c:"#dc2626",bg:"#fff1f2"},{k:"interpersonal_dynamics",l:"👥 対人力学",c:"#0284c7",bg:"#f0f9ff"}] as {k:string;l:string;c:string;bg:string}[]).filter(({k})=>(profileResult as any)[k]).map(({k,l,c,bg})=>(
                    <div key={k} style={{background:bg,borderLeft:`3px solid ${c}`,padding:"10px 12px",borderRadius:"0 8px 8px 0"}}>
                      <p style={{fontSize:"9px",color:c,fontWeight:700,marginBottom:"3px"}}>{l}</p>
                      <p style={{fontSize:"11px",color:"#111827",lineHeight:"1.5"}}>{(profileResult as any)[k]}</p>
                    </div>
                  ))}
                </div>
                {profileResult.analysis && Object.keys(profileResult.analysis as Record<string,string>).length>0 && (
                  <div style={{marginBottom:"14px"}}>
                    <p style={{fontSize:"10px",color:"#4f46e5",fontWeight:700,letterSpacing:"0.1em",marginBottom:"8px"}}>🔬 分析結果</p>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"6px"}}>
                      {Object.entries(profileResult.analysis as Record<string,string>).map(([k,v])=>(
                        <div key={k} style={{background:"#f8f9fc",borderRadius:"8px",padding:"10px",border:"1px solid rgba(0,0,0,0.06)"}}>
                          <p style={{fontSize:"9px",color:"#6b7280",fontWeight:600,marginBottom:"3px"}}>{({"thinking_style":"思考傾向","behavioral_principle":"行動原理","emotional_trigger":"感情トリガー","interpersonal_risk":"対人リスク","strengths":"強み","weaknesses":"弱点","approach":"適した接し方","compatible_type":"相性良いタイプ","caution":"注意点","deep_desire":"深層欲求推定"} as Record<string,string>)[k]||k}</p>
                          <p style={{fontSize:"11px",color:"#111827",lineHeight:"1.5"}}>{v}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {(profileResult as any).existence_os && Object.keys((profileResult as any).existence_os).some((k:string)=>(profileResult as any).existence_os[k]) && (
                  <div style={{background:"linear-gradient(135deg,#0f172a,#1e1b4b)",borderRadius:"14px",padding:"14px 16px",marginBottom:"14px"}}>
                    <p style={{fontSize:"9px",color:"rgba(255,255,255,0.45)",fontWeight:700,letterSpacing:"0.1em",marginBottom:"10px"}}>🧬 存在OSレポート</p>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"6px"}}>
                      {([{k:"world_os",l:"🌐 世界OS"},{k:"self_os",l:"🪪 自己OS"},{k:"other_os",l:"👤 他者OS"},{k:"safety_os",l:"🔒 安全OS"},{k:"attachment_os",l:"💞 愛着OS"},{k:"value_os",l:"💎 価値OS"},{k:"dominance_os",l:"👑 支配OS"},{k:"collapse_os",l:"💥 崩壊OS"},{k:"creation_os",l:"✨ 創造OS"}] as {k:string;l:string}[]).filter(({k})=>(profileResult as any).existence_os?.[k]).map(({k,l})=>(
                        <div key={k} style={{background:"rgba(255,255,255,0.06)",borderRadius:"8px",padding:"8px 10px",border:"1px solid rgba(255,255,255,0.1)"}}>
                          <p style={{fontSize:"9px",color:"rgba(255,255,255,0.5)",fontWeight:700,marginBottom:"3px"}}>{l}</p>
                          <p style={{fontSize:"11px",color:"rgba(255,255,255,0.88)",lineHeight:"1.5"}}>{(profileResult as any).existence_os[k]}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {(profileResult as any).structure_extraction && Object.keys((profileResult as any).structure_extraction).some((k:string)=>(profileResult as any).structure_extraction[k]) && (
                  <div style={{background:"#fafafa",borderRadius:"14px",padding:"14px 16px",marginBottom:"14px",border:"1px solid rgba(0,0,0,0.07)"}}>
                    <p style={{fontSize:"9px",color:"#7c3aed",fontWeight:700,letterSpacing:"0.1em",marginBottom:"10px"}}>🔍 構造抽出レポート</p>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"6px"}}>
                      {([{k:"contradictions",l:"🔄 繰り返す矛盾"},{k:"obsessions",l:"🎯 執着"},{k:"anger_trigger",l:"⚡ 怒りポイント"},{k:"justification",l:"🛡️ 正義化構造"},{k:"silence_ignored",l:"🔇 沈黙・無視論点"},{k:"responsibility_position",l:"⚖️ 責任転嫁位置"},{k:"reality_interpretation",l:"🧬 現実解釈の構造"}] as {k:string;l:string}[]).filter(({k})=>(profileResult as any).structure_extraction?.[k]).map(({k,l})=>(
                        <div key={k} style={{background:"#f3f0ff",borderRadius:"8px",padding:"8px 10px",border:"1px solid rgba(124,58,237,0.12)"}}>
                          <p style={{fontSize:"9px",color:"#7c3aed",fontWeight:700,marginBottom:"3px"}}>{l}</p>
                          <p style={{fontSize:"11px",color:"#111827",lineHeight:"1.5"}}>{(profileResult as any).structure_extraction[k]}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div style={{background:"#f0fdf4",borderRadius:"12px",padding:"14px",border:"1px solid rgba(34,197,94,0.2)"}}>
                  <p style={{fontSize:"10px",color:"#16a34a",fontWeight:700,marginBottom:"6px"}}>📋 総合所見（安全確保アルゴリズムの構造）</p>
                  <p style={{fontSize:"12px",color:"#111827",lineHeight:"1.6"}}>{profileResult.summary}</p>
                </div>
              </div>
            )}
            {profileResult && (
            <div style={{background:"white",borderRadius:"16px",padding:"20px 24px",boxShadow:"0 4px 16px rgba(0,0,0,0.08)"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"14px"}}>
                <p style={{fontWeight:800,fontSize:"14px",color:"#111827"}}>🔍 深掘り質問</p>
                {!profileQuestions&&!profileQuestionsLoading&&(
                  <button onClick={loadProfileQuestions} style={{fontSize:"12px",color:"#4f46e5",background:"none",border:"1px solid #4f46e5",borderRadius:"8px",padding:"4px 12px",cursor:"pointer",fontWeight:700}}>AI質問を生成</button>
                )}
              </div>
              {profileQuestionsLoading&&<p style={{fontSize:"12px",color:"#6b7280",textAlign:"center",padding:"12px 0"}}>🔄 質問生成中...</p>}
              {profileQuestions&&(
                <div style={{marginBottom:"14px"}}>
                  {(["危険系","活用系","関係系","深層系"] as string[]).map(cat=>(
                    profileQuestions[cat]&&profileQuestions[cat].length>0&&(
                      <div key={cat} style={{marginBottom:"10px"}}>
                        <p style={{fontSize:"9px",fontWeight:700,color:"#6b7280",letterSpacing:"0.1em",marginBottom:"6px"}}>{{危険系:"⚡ 危険系",活用系:"✨ 活用系",関係系:"👥 関係系",深層系:"🧬 深層系"}[cat]}</p>
                        <div style={{display:"flex",flexWrap:"wrap",gap:"6px"}}>
                          {profileQuestions[cat].map((q:string,i:number)=>(
                            <button key={i} onClick={()=>askProfileQuestion(q)} style={{fontSize:"11px",color:"#4f46e5",background:"#eef2ff",border:"1px solid rgba(99,102,241,0.2)",borderRadius:"20px",padding:"5px 12px",cursor:"pointer",textAlign:"left",lineHeight:"1.4"}}>{q}</button>
                          ))}
                        </div>
                      </div>
                    )
                  ))}
                </div>
              )}
              <div style={{display:"flex",gap:"8px",marginBottom:"10px"}}>
                <input value={profileCustomQuestion} onChange={e=>setProfileCustomQuestion(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&profileCustomQuestion.trim())askProfileQuestion(profileCustomQuestion);}} placeholder="自由質問を入力..." style={{flex:1,background:"#f8f9fc",border:"1px solid rgba(0,0,0,0.1)",borderRadius:"10px",padding:"9px 12px",fontSize:"12px",color:"#111827"}} className="focus:outline-none"/>
                <button onClick={()=>askProfileQuestion(profileCustomQuestion)} disabled={profileAnswerLoading||!profileCustomQuestion.trim()} style={{padding:"9px 16px",borderRadius:"10px",background:profileAnswerLoading||!profileCustomQuestion.trim()?"#e5e7eb":"#4f46e5",color:"white",fontWeight:700,fontSize:"12px",border:"none",cursor:profileAnswerLoading||!profileCustomQuestion.trim()?"not-allowed":"pointer",whiteSpace:"nowrap"}}>{profileAnswerLoading?"🔄":"質問する"}</button>
              </div>
              {profileAnswer&&(
                <div style={{background:"#f0fdf4",borderRadius:"12px",padding:"14px 16px",border:"1px solid rgba(34,197,94,0.2)"}}>
                  <p style={{fontSize:"9px",color:"#16a34a",fontWeight:700,marginBottom:"6px"}}>💬 {profileAnsweredQuestion}</p>
                  <p style={{fontSize:"12px",color:"#111827",lineHeight:"1.7"}}>{profileAnswer}</p>
                </div>
              )}
            </div>
            )}
            <div style={{background:"white",borderRadius:"16px",padding:"16px 20px",boxShadow:"0 2px 8px rgba(0,0,0,0.06)"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"12px"}}>
                <h4 style={{fontWeight:700,fontSize:"13px",color:"#111827"}}>📋 過去のプロファイル</h4>
                <button onClick={loadProfileHistory} style={{fontSize:"11px",color:"#6b7280",background:"none",border:"none",cursor:"pointer"}}>更新</button>
              </div>
              {profileHistory.length===0?(
                <p style={{fontSize:"12px",color:"#9ca3af",textAlign:"center",padding:"12px 0"}}>履歴なし</p>
              ):profileHistory.map(h=>(
                <div key={h.doc_id} style={{padding:"10px 12px",borderRadius:"10px",border:"1px solid rgba(0,0,0,0.07)",marginBottom:"8px",background:"#f8f9fc"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"4px"}}>
                    <div>
                      <p style={{fontWeight:600,fontSize:"12px",color:"#111827"}}>{h.target_name}</p>
                      <p style={{fontSize:"10px",color:"#9ca3af"}}>{(h.created_at||"").slice(0,16)}</p>
                    </div>
                    <div style={{display:"flex",gap:"4px"}}>
                      <button onClick={()=>{if(h.result){setProfileResult(h.result);setProfileQuestions(null);setProfileAnswer("");setProfileAnsweredQuestion("");setProfileCustomQuestion("");setTimeout(()=>document.getElementById("profile-result-output")?.scrollIntoView({behavior:"smooth",block:"start"}),100);}}} style={{fontSize:"10px",color:"#4f46e5",background:"none",border:"1px solid #4f46e5",borderRadius:"6px",padding:"2px 7px",cursor:"pointer"}}>開く</button>
                      <button onClick={()=>deleteProfile(h.doc_id)} style={{fontSize:"10px",color:"#ef4444",background:"none",border:"1px solid #ef4444",borderRadius:"6px",padding:"2px 7px",cursor:"pointer"}}>削除</button>
                    </div>
                  </div>
                  <p style={{fontSize:"11px",color:"#6b7280",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{h.summary}</p>
                </div>
              ))}
            </div>

            {/* プロファイル生成ガイド */}
                <div style={{background:"white",border:"1px solid rgba(0,0,0,0.08)",borderRadius:"16px",boxShadow:"0 1px 3px rgba(0,0,0,0.08)"}}>
                  <button onClick={()=>setProfileGuideOpen(p=>!p)} style={{width:"100%",padding:"14px 20px",background:"none",border:"none",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                      <span style={{background:"rgba(99,102,241,0.1)",borderRadius:"50%",width:"22px",height:"22px",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"12px",fontWeight:700,color:"#6366f1"}}>?</span>
                      <span style={{fontWeight:700,fontSize:"13px",color:"#111827"}}>使い方ガイド</span>
                    </div>
                    <span style={{color:"#9ca3af",fontSize:"12px"}}>{profileGuideOpen?"▲ 閉じる":"▼ 開く"}</span>
                  </button>
                  {profileGuideOpen && (
                    <div style={{padding:"0 20px 20px",borderTop:"1px solid rgba(0,0,0,0.06)"}}>
                      {/* 価値訴求 */}
                      <div style={{background:"linear-gradient(135deg,#4f46e5,#7c3aed)",borderRadius:"12px",padding:"16px 18px",marginTop:"16px",marginBottom:"12px"}}>
                        <p style={{color:"rgba(255,255,255,0.5)",fontSize:"9px",fontWeight:700,letterSpacing:"0.2em",marginBottom:"8px"}}>ASCEND プロファイル生成</p>
                        <p style={{color:"white",fontWeight:900,fontSize:"14px",marginBottom:"4px"}}>人の行動原理・思考構造を解剖し、最適な関わり方を導出する</p>
                        <p style={{color:"rgba(255,255,255,0.55)",fontSize:"11px",marginBottom:"12px",lineHeight:1.6}}>観察情報を入力するだけで、AIが対象者の思考・行動・対人構造を多角的に分析。接し方・地雷・信頼構築の最短経路を特定します。</p>
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"6px"}}>
                          {([
                            ["🧠 思考構造の解明","判断基準・価値観・信念から行動原理を特定し、次の行動を予測"],
                            ["⚡ 地雷・崩れる条件","ストレス反応・怒りポイント・崩壊条件を把握して衝突を回避"],
                            ["👥 対人構造の把握","信頼条件・苦手タイプから関わり方と信頼構築の最短経路を導出"],
                            ["🔗 固有因果連鎖","繰り返すパターンの根本原因を特定し本質的な問題を把握"],
                            ["🔍 深掘り質問（生成後）","危険系・活用系・関係系・深層系の質問をAIが自動生成"],
                            ["💬 自由質問（生成後）","結果に対して任意で追加質問し、さらに深い分析が可能"],
                          ] as [string,string][]).map(([title,desc])=>(
                            <div key={title} style={{background:"rgba(255,255,255,0.08)",borderRadius:"8px",padding:"8px 10px"}}>
                              <p style={{color:"white",fontWeight:700,fontSize:"11px",marginBottom:"2px"}}>{title}</p>
                              <p style={{color:"rgba(255,255,255,0.55)",fontSize:"9px",lineHeight:1.5}}>{desc}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                      {/* 使い方の流れ */}
                      <div style={{background:"linear-gradient(135deg,#0f172a,#1e1b4b)",borderRadius:"12px",padding:"14px 16px",marginBottom:"14px"}}>
                        <p style={{color:"rgba(255,255,255,0.4)",fontSize:"9px",fontWeight:700,letterSpacing:"0.15em",marginBottom:"10px"}}>📋 使い方の流れ</p>
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px"}}>
                          {([
                            {step:"① 情報入力",color:"#6366f1",items:["対象者名・関係性を入力","会話傾向・行動構造・対人構造など観察した情報を入力","項目が多いほど分析精度が上がります（全項目入力不要）"]},
                            {step:"② プロファイル生成",color:"#059669",items:["「プロファイルを生成する」を押す","固有因果連鎖・存在構造・接客スタイル・地雷・信頼条件を生成","印刷・保存で手元に残せます"]},
                            {step:"③ 深掘り質問（任意）",color:"#d97706",items:["生成後に「AI質問を生成」を押す","危険系・活用系・関係系・深層系の質問が自動生成される","質問をタップするだけでAIが即回答","自由入力でオリジナル質問も可能"]},
                            {step:"④ 履歴管理",color:"#0891b2",items:["過去のプロファイルは画面下の履歴から再表示","「開く」で結果と深掘り質問を再利用","不要なものは削除可能"]},
                          ] as {step:string;color:string;items:string[]}[]).map(({step,color,items})=>(
                            <div key={step} style={{background:`${color}10`,borderRadius:"10px",padding:"10px 12px",border:`1px solid ${color}25`}}>
                              <p style={{color,fontWeight:700,fontSize:"11px",marginBottom:"6px"}}>{step}</p>
                              {items.map((item,i)=>(
                                <p key={i} style={{color:"rgba(255,255,255,0.7)",fontSize:"10px",lineHeight:1.6,marginBottom:"2px"}}>• {item}</p>
                              ))}
                            </div>
                          ))}
                        </div>
                      </div>
                      {/* 項目ガイド */}
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px"}}>
                        {([
                          {icon:"💬",title:"会話傾向",items:["よく使う言葉・話題：口癖・頻出テーマから価値観・優先事項を推定","会話時の特徴：話し方のクセ・パターンから思考構造を読む"]},
                          {icon:"⚙️",title:"行動構造",items:["判断基準：何を優先して動くかを把握することで行動予測が可能","ストレス反応：崩れるときのパターンを知ることで対処できる","繰り返す行動パターン：無意識の習慣から内面の課題を推論"]},
                          {icon:"👥",title:"対人構造",items:["人間関係で求めるもの：対人ニーズから最適な関わり方を設計","苦手な相手：地雷タイプを把握して不要な衝突を回避","信頼する条件：信頼構築の最短経路を特定して関係を加速"]},
                          {icon:"💼",title:"仕事・行動特性",items:["仕事への姿勢：得意な動き方と弱点を把握して活かし方を設計","崩れる条件：パフォーマンスが落ちる環境・状況を事前に把握"]},
                          {icon:"🔍",title:"構造的シグナル",items:["繰り返す矛盾：表面的な言動と内面のズレを検出","執着・怒りポイント：感情が動く無意識の優先事項を特定","正義化パターン：自己保護・責任回避の構造を解析"]},
                          {icon:"🕵️",title:"行動痕跡（重要）",items:["観察した行動をそのまま入力するだけでOK（解釈・分析不要）","無意識に環境へ残した行動サインから内面状態をAIが推論","「会議で結論直前に別議題を出す」など具体的な行動を記入"]},
                          {icon:"🔍",title:"深掘り質問（生成後）",items:["⚡ 危険系：地雷・崩壊条件・リスク行動を深掘り","✨ 活用系：強み・得意パターン・活かし方を深掘り","👥 関係系：対人ニーズ・信頼条件・相性を深掘り","🧬 深層系：無意識の動機・根本原因を深掘り","自由入力で任意の質問も可能"]},
                          {icon:"⚠️",title:"注意事項",items:["分析結果は傾向・確率の提示です。断定ではありません","最終判断は必ず人間が行ってください","個人情報は適切に管理してください"]},
                        ] as {icon:string;title:string;items:string[]}[]).map(({icon,title,items})=>(
                          <div key={title} style={{background:"#f8f9fc",borderRadius:"12px",padding:"12px 14px"}}>
                            <p style={{fontWeight:700,fontSize:"12px",color:"#111827",marginBottom:"8px"}}>{icon} {title}</p>
                            <ul style={{margin:0,padding:"0 0 0 14px"}}>
                              {items.map((item,i)=>(
                                <li key={i} style={{fontSize:"11px",color:"#6b7280",lineHeight:1.7,marginBottom:"2px"}}>{item}</li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
          </div>
        )}
        {tab==="crm" && mounted && features?.diag_crm===true && (
          <div className="space-y-4">
            <CustomerManagement />
          </div>
        )}
      </div>
    </div>
  );
}
import { Suspense } from "react";
export default function DiagnosisPageWrapper() {
  return (
    <Suspense fallback={null}>
      <DiagnosisPageInner />
    </Suspense>
  );
}
