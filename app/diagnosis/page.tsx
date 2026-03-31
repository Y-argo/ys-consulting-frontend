"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
const ReactMarkdown = dynamic(() => import("react-markdown"), { ssr: false, loading: () => null });
import { getStoredUser, getUserStats, UserStats, getMyFeatures } from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";
function authHeaders(): HeadersInit {
  const token = typeof window !== "undefined" ? localStorage.getItem("ascend_token") || "" : "";
  return token ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` } : { "Content-Type": "application/json" };
}

type TabId = "diagnosis"|"structure"|"issue"|"comparison"|"contradiction"|"execution"|"investment"|"graph";

const C = {
  bg:"#f8f9fc", card:"#ffffff", primary:"#4f46e5", primary2:"#7c3aed",
  textMain:"#111827", textSub:"#6b7280", textMuted:"#9ca3af",
  border:"rgba(0,0,0,0.08)", borderPrimary:"rgba(79,70,229,0.2)",
  shadow:"0 1px 3px rgba(0,0,0,0.08)", shadowMd:"0 4px 16px rgba(0,0,0,0.08)",
  shadowPrimary:"0 4px 16px rgba(79,70,229,0.2)",
};

export default function DiagnosisPage() {
  const router = useRouter();
  const [tab, setTab] = useState<TabId>(()=>(typeof window!=="undefined"?(localStorage.getItem("diag_tab") as TabId)||"diagnosis":"diagnosis"));
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

  useEffect(() => {
    if (!getStoredUser()) { router.push("/"); return; }
    fetchHistory();
    fetchFrameworks();
    fetchSignals();
    getUserStats().then(setStats);
    getMyFeatures().then(f=>setFeatures(f as Record<string,boolean>));
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
        "戦略・競合":"#4f46e5","集客・SNS":"#0891b2","売上・財務":"#059669",
        "組織・人材":"#d97706","投資・株":"#dc2626","診断・分析":"#7c3aed",
        "指名・接客":"#db2777","その他":"#6b7280"
      };
      const _nodes = d.nodes.map((n: {id:string;label:string;group?:string;is_center?:boolean}) => ({
        id: n.id,
        label: (n.label||"").slice(0,15),
        color: { background: TOPIC_COLORS[n.group||"その他"]||"#6366f1", border: "rgba(255,255,255,0.3)" },
        size: n.is_center ? 35 : 18,
        shape: n.is_center ? "ellipse" : "dot",
        font: { size: n.is_center ? 13 : 10, color: "#111827", bold: n.is_center },
        shadow: true,
      }));
      const _edges = d.edges.map((e: {from:string;to:string;topic?:string}) => ({
        from: e.from, to: e.to,
        color: { color: TOPIC_COLORS[e.topic||"その他"]||"rgba(99,102,241,0.4)", opacity: 0.6 },
        width: 1.5, arrows: "to",
      }));
      const _draw = () => {
        if (!graphRef.current) return;
        graphRef.current.style.height = "400px";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const _vis = (window as any).vis;
        if (!_vis) return;
        new _vis.Network(graphRef.current,
          { nodes: new _vis.DataSet(_nodes), edges: new _vis.DataSet(_edges) },
          { physics:{barnesHut:{gravitationalConstant:-3000,centralGravity:0.3,springLength:120},stabilization:{iterations:300},fit:true}, layout:{improvedLayout:true}, interaction:{hover:true,tooltipDelay:100}, nodes:{borderWidth:1,shadow:{enabled:true,color:"rgba(0,0,0,0.12)",x:2,y:2,size:6}}, edges:{smooth:{type:"curvedCW",roundness:0.2},shadow:true} }
        );
        setGraphLoading(false);
      };
      let _att = 0;
      const _poll = setInterval(() => {
        _att++;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    if (!getInput("investment").trim()) return;
    setStockLoading(true); setError("");  setStockResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/investment/stock_analysis`, {
        method:"POST", headers:authHeaders(),
        body:JSON.stringify({query: getInput("investment").trim()})
      });
      if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.detail||"エラー"); }
      const d = await res.json();
      if (!d.ok) throw new Error(d.error||"エラー");
      setStockResult(d.result);
    } catch(e:unknown) { setError(e instanceof Error ? e.message : "エラー"); }
    finally { setStockLoading(false); }
  }

  async function fetchInvestmentAnalysis() {
    setAnalysisLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/investment/analysis`, { headers: authHeaders() });
      if (res.ok) { const d = await res.json(); if(d.ok) { setAnalysisData(d); setSignals(d.latest); } }
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
      const res = await fetch(`${API_BASE}/api/diagnosis/consult`, { method:"POST", headers:authHeaders(), body:JSON.stringify(body) });
      if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.detail||"エラー"); }
      const d = await res.json();
      if (!d.ok) throw new Error(d.error||"エラー");
      setConsultResult(d.result);
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
  const allTabs: {id:TabId;label:string;flag?:string}[] = [
    {id:"diagnosis",label:"🔬 現状課題診断"},
    {id:"structure",label:"🏗️ 構造診断",flag:"diag_structure"},
    {id:"issue",label:"🎯 課題仮説",flag:"diag_issue"},
    {id:"comparison",label:"⚖️ 比較分析",flag:"diag_comparison"},
    {id:"contradiction",label:"⚡ 矛盾検知",flag:"diag_contradiction"},
    {id:"execution",label:"📋 実行計画",flag:"diag_execution"},
    {id:"investment",label:"📈 投資シグナル",flag:"diag_investment"},
    {id:"graph",label:"📊 会話の可視化",flag:"diag_graph"},
  ];
  const TABS = allTabs.filter(t=>!t.flag || features[t.flag] !== false);

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
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:"16px",boxShadow:C.shadowMd}} className="p-5 mt-4">
        <p style={{color:C.primary,fontWeight:900,fontSize:"15px",marginBottom:"16px"}}>🏗️ 構造診断レポート</p>
        {r.summary && <Section title="総合サマリー" color={C.primary}><p style={{color:C.textSub,fontSize:"13px",lineHeight:"1.7"}}>{String(r.summary)}</p></Section>}
        {Array.isArray(r.structure_layers) && r.structure_layers.length>0 && (
          <Section title="構造レイヤー分析" color="#0891b2">
            {(r.structure_layers as {layer:string;content:string;strength:number}[]).map((l,i)=>(
              <div key={i} style={{borderBottom:`1px solid rgba(0,0,0,0.06)`,paddingBottom:"8px",marginBottom:"8px"}}>
                <div className="flex justify-between items-center mb-1">
                  <span style={{color:"#0891b2",fontWeight:700,fontSize:"12px"}}>{l.layer}</span>
                  <span style={{color:C.textMuted,fontSize:"11px"}}>強度 {Math.round((l.strength||0)*100)}%</span>
                </div>
                <div style={{background:"rgba(0,0,0,0.04)",borderRadius:"99px",height:"4px",marginBottom:"6px"}}>
                  <div style={{width:`${Math.round((l.strength||0)*100)}%`,background:"linear-gradient(90deg,#0891b2,#06b6d4)",borderRadius:"99px",height:"4px"}}/>
                </div>
                <p style={{color:C.textSub,fontSize:"12px"}}>{l.content}</p>
              </div>
            ))}
          </Section>
        )}
        {r.key_bottleneck && <Section title="🚨 主要ボトルネック" color="#dc2626"><p style={{color:"#dc2626",fontSize:"13px",fontWeight:600}}>{String(r.key_bottleneck)}</p></Section>}
        {r.recommended_framework && <Section title="📐 推奨フレームワーク" color="#7c3aed"><p style={{color:C.textSub,fontSize:"13px"}}>{String(r.recommended_framework)}</p></Section>}
        {Array.isArray(r.next_actions) && r.next_actions.length>0 && (
          <Section title="⚡ 次のアクション" color="#059669">
            {(r.next_actions as string[]).map((a,i)=>(
              <div key={i} className="flex items-start gap-2 mb-2">
                <span style={{color:"#059669",fontWeight:700,fontSize:"12px",minWidth:"20px"}}>{i+1}.</span>
                <p style={{color:C.textSub,fontSize:"12px"}}>{a}</p>
              </div>
            ))}
          </Section>
        )}
      </div>
    );

    // issue
    if (activeAnalysisType==="issue") return (
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:"16px",boxShadow:C.shadowMd}} className="p-5 mt-4">
        <p style={{color:C.primary,fontWeight:900,fontSize:"15px",marginBottom:"16px"}}>🎯 課題仮説レポート</p>
        {r.root_cause && <Section title="根本原因" color="#dc2626"><p style={{color:"#dc2626",fontSize:"13px",fontWeight:600}}>{String(r.root_cause)}</p></Section>}
        {Array.isArray(r.hypotheses) && r.hypotheses.length>0 && (
          <Section title="課題仮説一覧" color={C.primary}>
            {(r.hypotheses as {hypothesis:string;priority:string;evidence:string;verification:string}[]).map((h,i)=>(
              <div key={i} style={{borderBottom:`1px solid rgba(0,0,0,0.06)`,paddingBottom:"10px",marginBottom:"10px"}}>
                <div className="flex items-center gap-2 mb-1">
                  <Tag label={h.priority==="high"?"🔴 高":h.priority==="mid"?"🟡 中":"🟢 低"} color={h.priority==="high"?"#dc2626":h.priority==="mid"?"#d97706":"#059669"}/>
                  <p style={{color:C.textMain,fontWeight:600,fontSize:"13px"}}>{h.hypothesis}</p>
                </div>
                <p style={{color:C.textMuted,fontSize:"11px"}}>根拠: {h.evidence}</p>
                <p style={{color:C.textMuted,fontSize:"11px"}}>検証: {h.verification}</p>
              </div>
            ))}
          </Section>
        )}
        {Array.isArray(r.quick_wins) && r.quick_wins.length>0 && (
          <Section title="⚡ 即効策" color="#059669">
            {(r.quick_wins as string[]).map((a,i)=>(
              <div key={i} className="flex items-start gap-2 mb-1">
                <span style={{color:"#059669",fontWeight:700,fontSize:"12px"}}>✓</span>
                <p style={{color:C.textSub,fontSize:"12px"}}>{a}</p>
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
          <div style={{overflowX:"auto",marginBottom:"16px"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:"12px"}}>
              <thead>
                <tr>
                  {["選択肢","コスト","リスク","効果","実現性","速度","総評"].map(h=>(
                    <th key={h} style={{background:`${C.primary}10`,border:`1px solid ${C.border}`,padding:"8px",color:C.primary,fontWeight:700,whiteSpace:"nowrap"}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(r.options as {name:string;scores:{cost:number;risk:number;effect:number;feasibility:number;speed:number};summary:string}[]).map((opt,i)=>(
                  <tr key={i} style={{background:i%2===0?"transparent":"rgba(0,0,0,0.02)"}}>
                    <td style={{border:`1px solid ${C.border}`,padding:"8px",fontWeight:600,color:C.textMain}}>{opt.name}</td>
                    {["cost","risk","effect","feasibility","speed"].map(k=>(
                      <td key={k} style={{border:`1px solid ${C.border}`,padding:"8px",textAlign:"center"}}>
                        <span style={{color:Number(opt.scores[k as keyof typeof opt.scores])>=75?"#059669":Number(opt.scores[k as keyof typeof opt.scores])>=50?"#d97706":"#dc2626",fontWeight:700}}>
                          {opt.scores[k as keyof typeof opt.scores]}
                        </span>
                      </td>
                    ))}
                    <td style={{border:`1px solid ${C.border}`,padding:"8px",color:C.textSub,fontSize:"11px"}}>{opt.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {r.recommendation && <Section title="✅ 推奨選択肢" color="#059669"><p style={{color:"#059669",fontWeight:700,fontSize:"14px"}}>{String(r.recommendation)}</p><p style={{color:C.textSub,fontSize:"12px",marginTop:"4px"}}>{String(r.rationale||"")}</p></Section>}
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
        {Array.isArray(r.contradictions) && r.contradictions.length>0 && (
          <Section title="検出された矛盾" color="#dc2626">
            {(r.contradictions as {point:string;severity:string;resolution:string}[]).map((c,i)=>(
              <div key={i} style={{borderBottom:`1px solid rgba(0,0,0,0.06)`,paddingBottom:"10px",marginBottom:"10px"}}>
                <div className="flex items-center gap-2 mb-1">
                  <Tag label={c.severity==="high"?"🔴 深刻":c.severity==="mid"?"🟡 中程度":"🟢 軽微"} color={c.severity==="high"?"#dc2626":c.severity==="mid"?"#d97706":"#059669"}/>
                </div>
                <p style={{color:C.textMain,fontWeight:600,fontSize:"13px",marginBottom:"4px"}}>{c.point}</p>
                <p style={{color:C.textMuted,fontSize:"11px"}}>解決策: {c.resolution}</p>
              </div>
            ))}
          </Section>
        )}
        {r.overall_assessment && <Section title="総合評価" color={C.primary}><p style={{color:C.textSub,fontSize:"13px",lineHeight:"1.7"}}>{String(r.overall_assessment)}</p></Section>}
      </div>
    );

    // execution
    if (activeAnalysisType==="execution") return (
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:"16px",boxShadow:C.shadowMd}} className="p-5 mt-4">
        <p style={{color:C.primary,fontWeight:900,fontSize:"15px",marginBottom:"16px"}}>📋 実行計画レポート</p>
        {Array.isArray(r.phases) && r.phases.length>0 && (
          <div style={{marginBottom:"16px"}}>
            {(r.phases as {phase:string;duration:string;actions:string[];kpi:string;risks:string[]}[]).map((p,i)=>(
              <div key={i} style={{border:`1px solid ${C.border}`,borderRadius:"12px",marginBottom:"10px",overflow:"hidden"}}>
                <div style={{background:`linear-gradient(135deg,${C.primary}15,${C.primary2}08)`,padding:"10px 14px",borderBottom:`1px solid ${C.border}`}}>
                  <div className="flex justify-between items-center">
                    <span style={{color:C.primary,fontWeight:700,fontSize:"13px"}}>Phase {i+1}: {p.phase}</span>
                    <span style={{color:C.textMuted,fontSize:"11px"}}>📅 {p.duration}</span>
                  </div>
                </div>
                <div style={{padding:"10px 14px"}}>
                  <p style={{color:C.textMuted,fontSize:"11px",fontWeight:600,marginBottom:"4px"}}>アクション</p>
                  {(p.actions||[]).map((a,j)=>(
                    <div key={j} className="flex items-start gap-2 mb-1">
                      <span style={{color:C.primary,fontSize:"11px",minWidth:"16px"}}>▶</span>
                      <p style={{color:C.textSub,fontSize:"12px"}}>{a}</p>
                    </div>
                  ))}
                  {p.kpi && <p style={{color:"#059669",fontSize:"12px",marginTop:"6px"}}>📊 KPI: {p.kpi}</p>}
                  {Array.isArray(p.risks) && p.risks.length>0 && <p style={{color:"#dc2626",fontSize:"12px",marginTop:"4px"}}>⚠️ リスク: {p.risks.join("、")}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
        {r.critical_path && <Section title="🎯 クリティカルパス" color="#d97706"><p style={{color:C.textSub,fontSize:"13px"}}>{String(r.critical_path)}</p></Section>}
        {Array.isArray(r.success_criteria) && r.success_criteria.length>0 && (
          <Section title="✅ 成功条件" color="#059669">
            {(r.success_criteria as string[]).map((s,i)=>(
              <div key={i} className="flex items-start gap-2 mb-1">
                <span style={{color:"#059669",fontWeight:700,fontSize:"12px"}}>✓</span>
                <p style={{color:C.textSub,fontSize:"12px"}}>{s}</p>
              </div>
            ))}
          </Section>
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
      <nav style={{background:"rgba(255,255,255,0.95)",borderBottom:`1px solid ${C.border}`,backdropFilter:"blur(12px)",boxShadow:C.shadow,position:"sticky",top:0,zIndex:50}} className="flex items-center gap-4 px-6 py-3">
        <button onClick={()=>router.push("/chat")} style={{color:C.textMuted}} className="text-sm hover:text-gray-700 transition-colors">← チャット</button>
        <span style={{color:C.border}}>|</span>
        <button onClick={()=>router.push("/mypage")} style={{color:C.textMuted}} className="text-sm hover:text-gray-700 transition-colors">マイページ</button>
        <span style={{color:C.border}}>|</span>
        <h1 className="text-base font-bold" style={{color:C.textMain}}>診断・分析</h1>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* タブ */}
        <div className="flex gap-1.5 flex-wrap mb-6">
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>{setTab(t.id);setConsultResult(null);setActiveAnalysisType("");if(typeof window!=="undefined")localStorage.setItem("diag_tab",t.id);}}
              style={tab===t.id
                ?{background:`linear-gradient(135deg,${C.primary},${C.primary2})`,color:"white",boxShadow:C.shadowPrimary,borderRadius:"10px"}
                :{background:C.card,border:`1px solid ${C.border}`,color:C.textSub,borderRadius:"10px",boxShadow:C.shadow}
              }
              className="text-xs px-3 py-1.5 font-medium transition-all hover:text-gray-700">
              {t.label}
            </button>
          ))}
        </div>

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
                <button onClick={handleGenerate} disabled={loading}
                  style={{background:`linear-gradient(135deg,${C.primary},${C.primary2})`,boxShadow:C.shadowPrimary,borderRadius:"12px"}}
                  className="text-white text-sm font-bold px-6 py-2.5 hover:opacity-90 disabled:opacity-50 transition-all">
                  {loading ? "生成中..." : "🔬 診断レポートを生成"}
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
              <p className="text-xs mb-4" style={{color:C.textSub}}>戦略と方針の矛盾・整合性を検証します</p>
              <textarea value={strategy} onChange={e=>setStrategy(e.target.value)} placeholder="戦略・目標を入力&#10;例：2年で売上2倍・新規顧客比率50%以上"
                style={{background:"rgba(0,0,0,0.02)",border:`1px solid ${C.border}`,borderRadius:"12px",color:C.textMain,width:"100%",resize:"none"}}
                className="text-sm px-4 py-3 focus:outline-none placeholder-gray-400" rows={3}/>
              <textarea value={policy} onChange={e=>setPolicy(e.target.value)} placeholder="方針・制約・現在の施策を入力&#10;例：値下げ禁止・紹介のみ集客・月広告費5万上限"
                style={{background:"rgba(0,0,0,0.02)",border:`1px solid ${C.border}`,borderRadius:"12px",color:C.textMain,width:"100%",resize:"none",marginTop:"8px"}}
                className="text-sm px-4 py-3 focus:outline-none placeholder-gray-400" rows={3}/>
              <button onClick={()=>handleConsult("contradiction")} disabled={loading||!strategy.trim()}
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
                  value={inputText}
                  onChange={e=>setInputText(e.target.value)}
                  placeholder="銘柄コードまたは社名を入力（例: 9984 ソフトバンク）"
                  style={{background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.2)",borderRadius:"10px",padding:"8px 14px",fontSize:"13px",color:"white",flex:1,minWidth:"200px"}}
                />
                <button
                  onClick={fetchStockAnalysis}
                  disabled={stockLoading||!inputText.trim()}
                  style={{background:"rgba(255,255,255,0.12)",border:"1px solid rgba(255,255,255,0.2)",borderRadius:"10px",padding:"8px 16px",color:"white",fontSize:"12px",fontWeight:600,cursor:"pointer",whiteSpace:"nowrap" as const}}
                  className="hover:bg-white/20 transition-all disabled:opacity-50">
                  🔍 個別分析
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
                                <td style={{border:`1px solid ${C.border}`,padding:"6px 10px",color:C.textMain}}>{String(r.company_name||"")}</td>
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
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:"16px",boxShadow:C.shadow}} className="p-5">
              <p className="text-sm font-bold mb-2" style={{color:C.textMain}}>📊 会話ネットワーク可視化</p>
              <p className="text-xs mb-3" style={{color:C.textSub}}>直近のチャット履歴を会話グラフとして可視化します。ノードをドラッグして動かせます。</p>
              <button onClick={fetchGraphData} disabled={graphLoading}
                style={{background:`linear-gradient(135deg,${C.primary},${C.primary2})`,borderRadius:"12px",padding:"10px 24px",border:"none",cursor:"pointer",boxShadow:"0 4px 12px rgba(79,70,229,0.3)",opacity:graphLoading?0.7:1,marginBottom:"16px",display:"inline-block"}}
                className="text-white font-bold text-sm hover:opacity-90 transition-all disabled:cursor-not-allowed">
                {graphLoading ? "生成中..." : "📊 会話グラフを生成"}
              </button>
              {graphLoading && (
                <div className="text-center py-8">
                  <div style={{display:"inline-block",width:"32px",height:"32px",border:`3px solid ${C.border}`,borderTop:`3px solid ${C.primary}`,borderRadius:"50%",animation:"spin 1s linear infinite"}}/>
                  <p className="text-xs mt-3" style={{color:C.textMuted}}>チャット履歴を解析中...</p>
                  <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                </div>
              )}
              {!graphData && !graphLoading && (
                <p className="text-xs text-center py-8" style={{color:C.textMuted}}>「会話グラフを生成」を押すと直近チャット履歴を可視化します</p>
              )}
              <div ref={graphRef} style={{width:"100%",height:"400px",background:"rgba(0,0,0,0.02)",borderRadius:"12px",border:`1px solid ${C.border}`}}/>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
