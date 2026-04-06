"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

function GalleryInner({uid, C}: {uid:string, C:any}) {
  const [images, setImages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

  useEffect(()=>{
    setLoading(true);
    const token = typeof window !== "undefined" ? localStorage.getItem("ascend_token")||"" : "";
    fetch(`${API_BASE}/api/chat/images`, {headers:{Authorization:`Bearer ${token}`}})
      .then(r=>r.json()).then(d=>setImages(d.images||[])).catch(()=>{}).finally(()=>setLoading(false));
  },[]);

  function handleDelete(image_id: string) {
    const token = typeof window !== "undefined" ? localStorage.getItem("ascend_token")||"" : "";
    fetch(`${API_BASE}/api/chat/images/${image_id}`, {method:"DELETE", headers:{Authorization:`Bearer ${token}`}})
      .then(()=>setImages(prev=>prev.filter(i=>i.image_id!==image_id)));
  }

  if (loading) return <p style={{color:C.textMuted,fontSize:"13px"}}>読み込み中...</p>;
  if (images.length===0) return <p style={{color:C.textMuted,fontSize:"13px"}}>生成した画像がまだありません。</p>;

  return (
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:"12px"}}>
      {images.map((img,i)=>(
        <div key={i} style={{border:`1px solid ${C.border}`,borderRadius:"12px",overflow:"hidden",background:C.card,boxShadow:C.shadow}}>
          <img src={img.gcs_url} alt={`img_${i}`} style={{width:"100%",height:"140px",objectFit:"cover",display:"block"}}/>
          <div style={{padding:"8px"}}>
            <p style={{color:C.textMuted,fontSize:"9px",marginBottom:"4px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{img.prompt||""}</p>
            <div style={{display:"flex",gap:"4px"}}>
              <a href={img.gcs_url} target="_blank" rel="noreferrer"
                style={{flex:1,background:`rgba(79,70,229,0.08)`,border:`1px solid ${C.borderPrimary}`,borderRadius:"6px",color:C.primary,fontSize:"10px",fontWeight:600,textAlign:"center",padding:"3px 0",textDecoration:"none"}}>
                📥 保存
              </a>
              <button onClick={()=>handleDelete(img.image_id)}
                style={{flex:1,background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:"6px",color:"#ef4444",fontSize:"10px",fontWeight:600,cursor:"pointer"}}>
                🗑️ 削除
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
import dynamic from "next/dynamic";
const ReactMarkdown = dynamic(() => import("react-markdown"), { ssr: false, loading: () => null });
import {
  getStoredUser, logout, getUserStats, getFcReport, getMyFeatures,
  getRankupTips, getManual, getUserGuide, getUsageLogs,
  getCustomPrompt, saveCustomPrompt, getHeaderConfig, listInquiries, getTheme,
  UserStats, ThemeConfig,
} from "@/lib/api";
type Tab = "overview"|"metrics"|"fc"|"dm"|"logs"|"rankup"|"manual"|"guide"|"about"|"cookie"|"settings"|"gallery";
const C = {
  bg:"#f8f9fc", card:"#ffffff", primary:"#4f46e5", primary2:"#7c3aed",
  textMain:"#111827", textSub:"#6b7280", textMuted:"#9ca3af",
  border:"rgba(0,0,0,0.08)", borderPrimary:"rgba(79,70,229,0.2)",
  shadow:"0 1px 3px rgba(0,0,0,0.08)", shadowMd:"0 4px 16px rgba(0,0,0,0.08)",
  shadowPrimary:"0 4px 16px rgba(79,70,229,0.2)",
};
export default function MyPage() {
  const router = useRouter();
  const [uid, setUid] = useState("");
  const [stats, setStats] = useState<UserStats|null>(null);
  const [fcData, setFcData] = useState<{report:Record<string,unknown>|null;use_count_since_report:number}>({report:null,use_count_since_report:0});
  const [tab, setTab] = useState<Tab>("overview");
  const [content, setContent] = useState("");
  const [logs, setLogs] = useState<{prompt:string;timestamp:string}[]>([]);
  const [loading, setLoading] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const [customPromptMode, setCustomPromptMode] = useState("append");
  const [customPromptSaved, setCustomPromptSaved] = useState(false);
  const [ultraEnabled, setUltraEnabled] = useState(false);
  const [apexEnabled, setApexEnabled] = useState(false);
  const [features, setFeatures] = useState<Record<string,boolean>>({});
  const [headerCfg, setHeaderCfg] = useState<Record<string,string>>({});
  const [inquiryUnread, setInquiryUnread] = useState(0);
  const [theme, setTheme] = useState<ThemeConfig|null>(null);
  const [settings, setSettings] = useState({
    notify_reply: true,
    notify_rankup: true,
    notify_fc: true,
    notify_inquiry: true,
    display_suggestions: true,
    display_mode_bar: true,
    display_score: true,
    ai_tier_default: "core",
    language: "ja",
    theme_mode: "light",
    font_size: "medium",
  });
  useEffect(() => {
    const user = getStoredUser();
    if (!user) { router.push("/"); return; }
    setUid(user.uid);
    getUserStats().then(setStats);
    getMyFeatures().then(f=>{ setUltraEnabled(!!f.ascend_ultra); setApexEnabled(!!f.ascend_apex); setFeatures(f); });
    getFcReport().then(setFcData);
    getCustomPrompt().then(d=>{ setCustomPrompt(d.custom_sys_prompt||""); setCustomPromptMode(d.custom_prompt_mode||"append"); });
    getHeaderConfig().then(setHeaderCfg);
    listInquiries().then(list=>{ setInquiryUnread(list.filter(i=>i.unread_for_user).length); });
    getTheme().then(t=>{ setTheme(t); if(t?.favicon_url){let l=document.querySelector("link[rel~='icon']") as HTMLLinkElement;if(!l){l=document.createElement("link");l.rel="icon";document.head.appendChild(l);}l.href=t.favicon_url;} });
    // localStorageから設定を復元
    const savedTier = localStorage.getItem("ascend_ai_tier_default");
    const savedSugg = localStorage.getItem("ascend_display_suggestions");
    const savedMode = localStorage.getItem("ascend_display_mode_bar");
    setSettings(s=>({
      ...s,
      ai_tier_default: savedTier || "core",
      display_suggestions: savedSugg !== null ? savedSugg === "true" : true,
      display_mode_bar: savedMode !== null ? savedMode === "true" : true,
    }));
  }, []);
  async function switchTab(t: Tab) {
    setTab(t); setContent("");
    if (t==="rankup") { setLoading(true); const c = await getRankupTips(); setContent(c); setLoading(false); }
    if (t==="manual") { setLoading(true); const c = await getManual(); setContent(c); setLoading(false); }
    if (t==="guide")  { setLoading(true); const c = await getUserGuide(); setContent(c); setLoading(false); }
    if (t==="logs")   { setLoading(true); const l = await getUsageLogs(); setLogs(l); setLoading(false); }
  }
  const dm = stats?.decision_metrics;
  const fcThreshold = stats?.fc_report_threshold || 12;
  const fcCount = fcData.use_count_since_report;
  const fcPct = Math.min((fcCount/fcThreshold)*100, 100);
  const TABS = [
    {id:"overview",label:"📊 概要"},
    {id:"metrics",label:"🎯 Decision Metrics"},
    {id:"fc",label:"🧠 固定概念"},
    {id:"dm",label:"📩 個人相談", badge: inquiryUnread},
    {id:"rankup",label:"🏆 ランクアップ"},
    {id:"manual",label:"📖 マニュアル"},
    {id:"guide",label:"📝 ガイド"},
    {id:"logs",label:"📋 履歴"},
    ...(features?.image_generation!==false ? [{id:"gallery" as Tab,label:"🎨 ギャラリー"}] : []),
    {id:"cookie",label:"🍪 Cookie"},
    {id:"settings",label:"⚙️ 設定"},
  ] as {id:Tab;label:string;badge?:number}[];
  return (
    <div className="min-h-screen" style={{background:C.bg, fontFamily:"'Inter','Noto Sans JP',sans-serif", color:C.textMain}}>
      {/* NAV */}
      <nav style={{background:"rgba(255,255,255,0.95)",borderBottom:`1px solid ${C.border}`,backdropFilter:"blur(12px)",position:"sticky",top:0,zIndex:50,boxShadow:C.shadow}} className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={()=>router.push("/chat")} className="text-sm transition-colors" style={{color:C.textSub}}>← チャット</button>
          <span style={{color:C.textMuted}}>|</span>
          <span className="font-black text-sm" style={{color:C.textMain}}>マイページ</span>
        </div>
        <div style={{background:`linear-gradient(135deg,${C.primary},${C.primary2})`,borderRadius:"12px",padding:"4px 14px",boxShadow:C.shadowPrimary}}>
          <span className="text-white font-black text-sm">{uid}</span>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* タブ */}
        <div className="flex gap-1.5 flex-wrap mb-6">
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>switchTab(t.id)}
              style={tab===t.id
                ?{background:`linear-gradient(135deg,${C.primary},${C.primary2})`,color:"white",boxShadow:C.shadowPrimary,borderRadius:"10px"}
                :{background:C.card,border:`1px solid ${C.border}`,color:C.textSub,borderRadius:"10px",boxShadow:C.shadow}
              }
              className="text-xs px-3 py-1.5 font-medium transition-all">
              {t.label}{(t.badge??0)>0&&<span style={{background:"#ef4444",color:"white",borderRadius:"99px",fontSize:"9px",fontWeight:900,padding:"1px 5px",marginLeft:"4px",display:"inline-block",lineHeight:"14px",minWidth:"14px",textAlign:"center"}}>{t.badge}</span>}
            </button>
          ))}
        </div>

        {/* 概要 */}
        {tab==="overview" && stats && (
          <div className="space-y-4">
            {/* ASCENDヘッダー箇条書き */}
            {(headerCfg.point_1_label||headerCfg.point_1_body) && (
              <div style={{background:"linear-gradient(160deg,#080810 0%,#0e0e1c 50%,#0a0a16 100%)",borderRadius:"24px",boxShadow:"0 8px 40px rgba(0,0,0,0.28),inset 0 1px 0 rgba(255,255,255,0.06)",border:"1px solid rgba(99,102,241,0.12)",overflow:"hidden",position:"relative"}} className="p-6">
                {/* 背景装飾 */}
                <div style={{position:"absolute",top:"-40px",right:"-40px",width:"180px",height:"180px",background:"radial-gradient(circle,rgba(99,102,241,0.08) 0%,transparent 70%)",pointerEvents:"none"}}/>
                <div style={{position:"absolute",bottom:"-30px",left:"-30px",width:"140px",height:"140px",background:"radial-gradient(circle,rgba(124,58,237,0.06) 0%,transparent 70%)",pointerEvents:"none"}}/>
                {/* ヘッダー */}
                <div className="flex items-center gap-3 mb-5">
                  <div style={{width:"3px",height:"16px",background:"linear-gradient(180deg,#6366f1,#8b5cf6)",borderRadius:"2px",flexShrink:0}}/>
                  <p style={{color:"rgba(255,255,255,0.25)",fontSize:"9px",fontWeight:800,letterSpacing:"0.2em"}}>ASCEND PLATFORM</p>
                  <div style={{flex:1,height:"1px",background:"linear-gradient(90deg,rgba(99,102,241,0.2),transparent)"}}/>
                </div>
                {/* 項目 */}
                <div className="space-y-4">
                  {[
                    {label:headerCfg.point_1_label,body:headerCfg.point_1_body},
                    {label:headerCfg.point_2_label,body:headerCfg.point_2_body},
                    {label:headerCfg.point_3_label,body:headerCfg.point_3_body},
                  ].filter(p=>p.label||p.body).map((p,i)=>(
                    <div key={i} className="flex gap-4 items-start">
                      <div style={{flexShrink:0,width:"32px",height:"32px",borderRadius:"10px",background:"linear-gradient(135deg,rgba(99,102,241,0.15),rgba(124,58,237,0.1))",border:"1px solid rgba(99,102,241,0.25)",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 2px 8px rgba(99,102,241,0.15)"}}>
                        <span style={{color:"#818cf8",fontWeight:900,fontSize:"12px",fontFamily:"'Inter',sans-serif"}}>{String(i+1).padStart(2,"0")}</span>
                      </div>
                      <div style={{flex:1,paddingTop:"2px"}}>
                        <p style={{color:"rgba(255,255,255,0.92)",fontWeight:700,fontSize:"13px",lineHeight:"1.4",letterSpacing:"0.01em"}}>{p.label}</p>
                        {p.body && (
                          <p style={{color:"rgba(255,255,255,0.38)",fontSize:"11px",lineHeight:"1.7",marginTop:"4px",fontWeight:400}}>{p.body}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {/* フッターライン */}
                <div style={{marginTop:"20px",paddingTop:"14px",borderTop:"1px solid rgba(255,255,255,0.05)",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <p style={{color:"rgba(255,255,255,0.15)",fontSize:"9px",fontWeight:600,letterSpacing:"0.12em"}}>Ys Consulting Office</p>
                  <p style={{color:"rgba(99,102,241,0.5)",fontSize:"9px",fontWeight:700,letterSpacing:"0.08em"}}>PRECISION · STRATEGY · EXECUTION</p>
                </div>
              </div>
            )}
            {/* ランクカード */}
            <div style={{background:`linear-gradient(135deg,${C.primary},${C.primary2})`,borderRadius:"24px",boxShadow:C.shadowPrimary}} className="p-6 text-white">
              <p style={{color:"rgba(255,255,255,0.6)",letterSpacing:"0.12em",fontSize:"10px",fontWeight:700}} className="mb-1">RANK STATUS</p>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-4xl font-black">{stats.rank_name}</p>
                  <p style={{color:"rgba(255,255,255,0.7)"}} className="text-sm mt-1">Next: {stats.next_pt}</p>
                </div>
                <div style={{background:"rgba(255,255,255,0.15)",borderRadius:"16px",padding:"10px 18px",textAlign:"right"}}>
                  <p className="text-3xl font-black leading-none">{stats.level_score}</p>
                  <p style={{color:"rgba(255,255,255,0.6)"}} className="text-xs mt-1">pt</p>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                {[stats.rank_cfg.rank_1_name,stats.rank_cfg.rank_2_name,stats.rank_cfg.rank_3_name,stats.rank_cfg.rank_4_name].map(r=>(
                  <span key={r} style={r===stats.rank_name
                    ?{background:"rgba(255,255,255,0.25)",color:"white",fontWeight:700,padding:"4px 12px",borderRadius:"99px"}
                    :{background:"rgba(255,255,255,0.08)",color:"rgba(255,255,255,0.5)",padding:"4px 12px",borderRadius:"99px"}
                  } className="text-xs">{r}</span>
                ))}
              </div>
            </div>

            {/* 統計グリッド */}
            <div className="grid grid-cols-2 gap-3">
              {[
                ["💬 総チャット数",`${stats.total_chat_count} 回`],
                ["🔬 診断回数",`${stats.diagnosis_count} 回`],
                ["🧠 固定概念観測",`${fcCount} / ${fcThreshold}`],
                ["🎯 Decision Rank", dm ? String(dm.diagnosis_rank||"—") : "—"],
              ].map(([k,v])=>(
                <div key={k} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:"16px",boxShadow:C.shadow}} className="p-4">
                  <p className="text-xs mb-1" style={{color:C.textMuted}}>{k}</p>
                  <p className="font-bold text-lg" style={{color:C.textMain}}>{v}</p>
                </div>
              ))}
            </div>

            {/* 現状課題診断 */}
            <div style={{background:stats.diag_available?"rgba(16,185,129,0.06)":C.card,border:stats.diag_available?"1px solid rgba(16,185,129,0.3)":`1px solid ${C.border}`,borderRadius:"16px",boxShadow:C.shadow}} className="p-4">
              <div className="flex justify-between items-center mb-2">
                <p className="text-sm font-bold" style={{color:stats.diag_available?"#10b981":C.textMain}}>🔬 現状課題診断</p>
                {stats.diag_available
                  ? <span style={{background:"rgba(16,185,129,0.1)",border:"1px solid rgba(16,185,129,0.3)",color:"#10b981"}} className="text-xs px-2 py-0.5 rounded-full font-bold">✅ 実行可能</span>
                  : <span className="text-xs" style={{color:C.textMuted}}>次: {stats.diag_next_unlock} チャット時点</span>
                }
              </div>
              <p className="text-xs" style={{color:C.textMuted}}>累計 {stats.total_chat_count} チャット / 12回ごとに生成</p>
              <button onClick={()=>router.push("/diagnosis")} style={{background:stats.diag_available?"linear-gradient(135deg,#10b981,#059669)":"linear-gradient(135deg,#4f46e5,#7c3aed)",borderRadius:"12px",boxShadow:stats.diag_available?"0 4px 12px rgba(16,185,129,0.3)":"0 4px 12px rgba(79,70,229,0.3)"}} className="w-full mt-3 text-white font-bold py-2 text-sm hover:opacity-90 transition-all">{stats.diag_available?"🔬 診断レポートを生成 →":"📊 診断・分析ページへ →"}</button>
              <div style={{display:"flex",gap:"6px",flexWrap:"wrap",marginTop:"8px"}}>
                {([["🔬","現状課題診断","diagnosis",true],["🏗️","構造診断","structure",features.diag_structure!==false],["🎯","課題仮説","issue",features.diag_issue!==false],["⚖️","比較分析","comparison",features.diag_comparison!==false],["⚡","矛盾検知","contradiction",features.diag_contradiction!==false],["📋","実行計画","execution",features.diag_execution!==false],["📈","投資シグナル","investment",features.diag_investment===true],["📊","会話の可視化","graph",features.diag_graph!==false],["🧾","ファイル診断","file",features.diag_file!==false]] as [string,string,string,boolean][]).map(([icon,label,tab,enabled])=>(
                  <button key={tab} onClick={()=>{
                    if(!enabled){alert("この機能は現在ご利用いただけません。\nYs Consulting Officeにご連絡ください。");return;}
                    router.push(`/diagnosis?tab=${tab}`);
                  }} style={{background:enabled?"linear-gradient(135deg,rgba(99,102,241,0.35),rgba(139,92,246,0.35))":"rgba(100,100,100,0.06)",border:enabled?"1px solid rgba(139,92,246,0.7)":"1px solid rgba(100,100,100,0.15)",borderRadius:"8px",padding:"4px 10px",color:enabled?"#ffffff":"rgba(150,150,150,0.5)",fontSize:"11px",fontWeight:enabled?"700":"400",cursor:enabled?"pointer":"default",whiteSpace:"nowrap",opacity:enabled?1:0.4,boxShadow:enabled?"0 0 8px rgba(139,92,246,0.3)":"none"}}>{icon} {label}</button>
                ))}
              </div>
            </div>

            {/* 固定概念レポート */}
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:"16px",boxShadow:C.shadow}} className="p-4">
              <div className="flex justify-between mb-2">
                <p className="text-sm font-bold" style={{color:C.primary2}}>🧠 固定概念レポート</p>
                <p className="text-xs" style={{color:C.textMuted}}>{fcCount}/{fcThreshold}</p>
              </div>
              <div style={{background:"rgba(0,0,0,0.06)",borderRadius:"99px",height:"6px"}} className="mb-2">
                <div style={{width:`${fcPct}%`,background:`linear-gradient(90deg,${C.primary},${C.primary2})`,borderRadius:"99px",height:"6px",transition:"width 0.6s ease"}}/>
              </div>
              {fcCount>=fcThreshold
                ? <button onClick={()=>switchTab("fc")} className="text-xs font-bold transition-all" style={{color:C.primary}}>レポートを確認 →</button>
                : <p className="text-xs" style={{color:C.textMuted}}>あと {fcThreshold-fcCount} 回で解放</p>
              }
            </div>

            {/* ショートカット */}
            <div className="grid grid-cols-2 gap-3">
              {[
                {l:"🏆 ランクアップのコツ",fn:()=>switchTab("rankup")},
                {l:"📖 完全マニュアル",fn:()=>switchTab("manual")},
                {l:"📩 個人相談（DM）",fn:()=>switchTab("dm")},
                {l:"📋 利用履歴",fn:()=>switchTab("logs")},
              ].map(item=>(
                <button key={item.l} onClick={item.fn}
                  style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:"16px",boxShadow:C.shadow}}
                  className="p-4 text-left text-sm font-medium transition-all hover:border-indigo-300 hover:shadow-md">
                  <span style={{color:C.textSub}}>{item.l}</span>
                </button>
              ))}
            </div>
            <button onClick={()=>{logout();router.push("/");}} className="w-full text-xs py-3 transition-colors" style={{color:C.textMuted}}>ログアウト</button>
          </div>
        )}

        {/* Decision Metrics */}
        {tab==="metrics" && (
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:"24px",boxShadow:C.shadowMd,overflow:"hidden"}}>
            {dm ? (
              <>
                {/* ダークヘッダー */}
                <div style={{background:"linear-gradient(135deg,#0f0c29,#302b63,#24243e)",padding:"24px 24px 20px"}}>
                  <p style={{color:"rgba(255,255,255,0.35)",fontSize:"9px",letterSpacing:"0.2em",fontWeight:700,marginBottom:"8px"}}>DECISION INTELLIGENCE MATRIX</p>
                  <div className="flex items-start justify-between" style={{marginBottom:"18px"}}>
                    <div>
                      <h2 style={{color:"white",fontWeight:900,fontSize:"18px",marginBottom:"4px"}}>意思決定精度診断</h2>
                      <p style={{color:"rgba(255,255,255,0.38)",fontSize:"11px",lineHeight:1.5}}>
                        {Number(dm.diagnosis_total_score||0)>=80?"全指標が高水準で安定しています":Number(dm.diagnosis_total_score||0)>=65?"複数の指標に改善余地があります":Number(dm.diagnosis_total_score||0)>=50?"重点的な強化が必要な指標があります":"判断構造に根本的な課題があります"}
                      </p>
                    </div>
                    <div style={{textAlign:"center" as const,flexShrink:0,marginLeft:"16px"}}>
                      <div style={{
                        background:String(dm.diagnosis_rank||"C")==="S"?"linear-gradient(135deg,#f59e0b,#ef4444)":String(dm.diagnosis_rank||"C").startsWith("A")?"linear-gradient(135deg,#6366f1,#8b5cf6)":String(dm.diagnosis_rank||"C").startsWith("B")?"linear-gradient(135deg,#0891b2,#06b6d4)":"linear-gradient(135deg,#6b7280,#9ca3af)",
                        borderRadius:"14px",padding:"8px 18px",boxShadow:"0 4px 20px rgba(0,0,0,0.4)",minWidth:"56px"
                      }}>
                        <span style={{color:"white",fontWeight:900,fontSize:"22px",letterSpacing:"0.05em",display:"block",textAlign:"center" as const}}>{String(dm.diagnosis_rank||"C")}</span>
                      </div>
                      <p style={{color:"rgba(255,255,255,0.3)",fontSize:"9px",marginTop:"4px",letterSpacing:"0.12em",textAlign:"center" as const}}>RANK</p>
                    </div>
                  </div>
                  <div className="flex justify-between items-center" style={{marginBottom:"6px"}}>
                    <span style={{color:"rgba(255,255,255,0.4)",fontSize:"10px",fontWeight:600,letterSpacing:"0.12em"}}>TOTAL SCORE</span>
                    <span style={{color:"white",fontWeight:900,fontSize:"20px"}}>{Number(dm.diagnosis_total_score||0).toFixed(1)}</span>
                  </div>
                  <div style={{background:"rgba(255,255,255,0.1)",borderRadius:"99px",height:"4px"}}>
                    <div style={{
                      width:`${Math.min(Number(dm.diagnosis_total_score||0),100)}%`,
                      background:Number(dm.diagnosis_total_score||0)>=80?"linear-gradient(90deg,#059669,#10b981)":Number(dm.diagnosis_total_score||0)>=65?"linear-gradient(90deg,#0891b2,#06b6d4)":Number(dm.diagnosis_total_score||0)>=50?"linear-gradient(90deg,#d97706,#f59e0b)":"linear-gradient(90deg,#dc2626,#ef4444)",
                      borderRadius:"99px",height:"4px",transition:"width 0.8s ease",
                      boxShadow:Number(dm.diagnosis_total_score||0)>=80?"0 0 8px rgba(16,185,129,0.7)":Number(dm.diagnosis_total_score||0)>=65?"0 0 8px rgba(6,182,212,0.7)":Number(dm.diagnosis_total_score||0)>=50?"0 0 8px rgba(245,158,11,0.7)":"0 0 8px rgba(239,68,68,0.7)"
                    }}/>
                  </div>
                </div>
                {/* 6指標 */}
                <div style={{padding:"20px 24px"}} className="space-y-5">
                  {([
                    ["Q", dm.label_q||"意思決定精度", dm.decision_quality_score, "構造的思考による判断の質"],
                    ["R", dm.label_r||"リスク耐性",   dm.risk_tolerance,          "リスクを定量化し許容する能力"],
                    ["S", dm.label_s||"構造理解",     dm.structural_intelligence, "問題の本質と因果を把握する力"],
                    ["V", dm.label_v||"判断速度",     dm.decision_velocity,       "適切なスピードで決断する能力"],
                    ["P", dm.label_p||"予測精度",     dm.prediction_accuracy,     "継続的な利用から算出される精度"],
                    ["E", dm.label_e||"実行一貫性",   dm.execution_consistency,   "判断と行動の整合性・一貫性"],
                  ] as [string,string,unknown,string][]).map(([k,l,v,desc])=>{
                    const val = Number(v);
                    const gc = val>=80?"linear-gradient(90deg,#059669,#10b981)":val>=65?"linear-gradient(90deg,#0891b2,#06b6d4)":val>=50?"linear-gradient(90deg,#d97706,#f59e0b)":"linear-gradient(90deg,#dc2626,#ef4444)";
                    const tc = val>=80?"#059669":val>=65?"#0891b2":val>=50?"#d97706":"#dc2626";
                    const lb = val>=80?"HIGH":val>=65?"MID":val>=50?"LOW":"CRITICAL";
                    return (
                      <div key={k}>
                        <div className="flex items-center justify-between" style={{marginBottom:"7px"}}>
                          <div className="flex items-center gap-3">
                            <div style={{width:"30px",height:"30px",borderRadius:"9px",background:`${tc}15`,border:`1.5px solid ${tc}35`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                              <span style={{color:tc,fontWeight:900,fontSize:"12px"}}>{k}</span>
                            </div>
                            <div>
                              <p style={{color:C.textMain,fontWeight:700,fontSize:"13px",lineHeight:1.2}}>{String(l).replace(/^[A-Z] /,"")}</p>
                              <p style={{color:C.textMuted,fontSize:"10px",marginTop:"1px"}}>{desc}</p>
                            </div>
                          </div>
                          <div style={{textAlign:"right" as const,flexShrink:0,marginLeft:"12px"}}>
                            <p style={{color:tc,fontWeight:900,fontSize:"18px",lineHeight:1}}>{val.toFixed(0)}</p>
                            <p style={{color:tc,fontSize:"9px",fontWeight:700,letterSpacing:"0.08em",marginTop:"1px"}}>{lb}</p>
                          </div>
                        </div>
                        <div style={{background:"rgba(0,0,0,0.05)",borderRadius:"99px",height:"5px"}}>
                          <div style={{width:`${Math.min(val,100)}%`,background:gc,borderRadius:"99px",height:"5px",transition:"width 0.7s ease",boxShadow:`0 0 6px ${tc}55`}}/>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* フッター注記 */}
                <div style={{borderTop:`1px solid ${C.border}`,margin:"0 24px",padding:"14px 0 18px"}}>
                  <p style={{color:C.textMuted,fontSize:"11px",textAlign:"center" as const,lineHeight:1.7}}>
                    スコアは直近60件のチャット履歴から算出されます。<br/>
                    入力の質・継続頻度・語彙の構造性がすべての指標に影響します。
                  </p>
                </div>
              </>
            ) : <p className="text-center py-12" style={{color:C.textMuted}}>診断データがありません。チャットを重ねると計算されます。</p>}
          </div>
        )}

        {/* 固定概念 */}
        {tab==="fc" && (
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:"24px",boxShadow:C.shadowMd}} className="p-6">
            <h2 className="text-lg font-black mb-4" style={{color:C.textMain}}>🧠 固定概念レポート</h2>
            {fcData.report
              ? <div className="prose prose-sm max-w-none" style={{color:C.textMain}}><ReactMarkdown>{String(fcData.report.report_text||JSON.stringify(fcData.report,null,2))}</ReactMarkdown></div>
              : <div className="text-center py-12">
                  <p className="text-4xl mb-4">🔒</p>
                  <p className="font-bold mb-2" style={{color:C.textMain}}>レポート未解放</p>
                  <p className="text-sm" style={{color:C.textMuted}}>あと {fcThreshold-fcCount} 回のチャットで解放されます</p>
                  <div style={{background:"rgba(0,0,0,0.06)",borderRadius:"99px",height:"8px",margin:"16px 0"}}>
                    <div style={{width:`${fcPct}%`,background:`linear-gradient(90deg,${C.primary},${C.primary2})`,borderRadius:"99px",height:"8px"}}/>
                  </div>
                  <p className="text-xs" style={{color:C.textMuted}}>{fcCount} / {fcThreshold}</p>
                </div>
            }
          </div>
        )}

        {/* 個人相談DM */}
        {tab==="dm" && (
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:"24px",boxShadow:C.shadowMd}} className="p-6">
            <h2 className="text-lg font-black mb-2" style={{color:C.textMain}}>📩 個人相談（DM）</h2>
            <p className="text-sm mb-6" style={{color:C.textSub}}>Ys Consulting Officeへの個人相談スレッドです。チャットAIとは別に、直接コンサルタントに相談できます。</p>
            <button onClick={()=>router.push("/inquiry")} style={{background:`linear-gradient(135deg,${C.primary},${C.primary2})`,borderRadius:"14px",color:"white",fontWeight:700,fontSize:"14px",padding:"12px 28px",border:"none",cursor:"pointer",boxShadow:C.shadowPrimary,width:"100%"}}
              className="hover:opacity-90 transition-all">
              📩 個人相談ページへ →
            </button>
          </div>
        )}

        {/* ランクアップ/マニュアル/ガイド */}
        {tab==="rankup" && stats && (
          <div className="space-y-4">
            <div style={{background:`linear-gradient(135deg,${C.primary},${C.primary2})`,borderRadius:"20px",boxShadow:C.shadowPrimary,textAlign:"center",padding:"32px"}}>
              <h2 style={{color:"white",fontWeight:900,fontSize:"22px",marginBottom:"8px"}}>🏆 ランクアップのコツ</h2>
              <p style={{color:"rgba(255,255,255,0.8)",fontSize:"13px"}}>現在のランクから次のランクへ上がるための戦略と行動指針</p>
            </div>
            {(()=>{
              const _rnames = stats.rank_cfg ? [stats.rank_cfg.rank_1_name,stats.rank_cfg.rank_2_name,stats.rank_cfg.rank_3_name,stats.rank_cfg.rank_4_name] : ["1段目","2段目","3段目","4段目"];
              const _ci = _rnames.indexOf(stats.rank_name);
              return (
                <div className="flex gap-2 flex-wrap">
                  {_rnames.map((rn,i)=>(
                    <div key={i} style={{background:i===_ci?`linear-gradient(135deg,${C.primary},${C.primary2})`:"rgba(0,0,0,0.04)",border:i===_ci?"none":`1px solid ${C.border}`,borderRadius:"10px",padding:"6px 16px",fontSize:"12px",fontWeight:700,color:i===_ci?"white":C.textMuted}}>
                      {rn}
                    </div>
                  ))}
                </div>
              );
            })()}
            {loading ? (
              <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:"16px",padding:"32px",textAlign:"center"}}>
                <p style={{color:C.textMuted}}>読み込み中...</p>
              </div>
            ) : content ? (() => {
              const _rn = stats?.rank_cfg ? [stats.rank_cfg.rank_1_name,stats.rank_cfg.rank_2_name,stats.rank_cfg.rank_3_name,stats.rank_cfg.rank_4_name] : [];
              const _rl = ["1段目","2段目","3段目","4段目"];
              let _dc = content; _rn.forEach((r,i)=>{ _dc = _dc.split(r).join(_rl[i]); });
              return (<>
              {_dc.split(/\n(?=#{1,3}\s)/).map((section:string, i:number) => {
                const slines = section.trim().split("\n");
                const heading = slines[0].replace(/^#+\s*/, "").trim();
                const body = slines.slice(1).join("\n").trim();
                if (!heading) return null;
                const colors = [C.primary,"#0891b2","#059669","#d97706","#dc2626","#7c3aed","#0891b2","#059669","#d97706"];
                const color = colors[i % colors.length];
                return (
                  <div key={i} style={{background:C.card,border:`1px solid ${color}20`,borderRadius:"20px",boxShadow:C.shadow,overflow:"hidden"}}>
                    <div style={{background:`linear-gradient(135deg,${color}12,${color}06)`,borderBottom:`1px solid ${color}15`,padding:"14px 20px",display:"flex",alignItems:"center",gap:"10px"}}>
                      <div style={{width:"4px",height:"20px",background:color,borderRadius:"2px",flexShrink:0}}/>
                      <p style={{color,fontWeight:800,fontSize:"14px"}}>{heading}</p>
                    </div>
                    {body && (
                      <div style={{padding:"16px 20px"}}>
                        {body.split("\n").map((line:string,j:number)=>{
                          const t=line.trim();
                          if(!t) return null;
                          const isBullet=/^[-*▶]/.test(t);
                          const clean=t.replace(/^[-*▶]\s*/,"");
                          const renderText=(s:string)=>s.split(/\*\*(.+?)\*\*/).map((p:string,k:number)=>k%2===1?<strong key={k} style={{color:C.textMain}}>{p}</strong>:p);
                          if(isBullet) return (
                            <div key={j} style={{display:"flex",alignItems:"flex-start",gap:"8px",marginBottom:"6px"}}>
                              <span style={{color,fontWeight:700,fontSize:"12px",flexShrink:0,marginTop:"3px"}}>▶</span>
                              <p style={{color:C.textSub,fontSize:"13px",lineHeight:"1.7"}}>{renderText(clean)}</p>
                            </div>
                          );
                          return <p key={j} style={{color:C.textSub,fontSize:"13px",lineHeight:"1.8",marginBottom:"4px"}}>{renderText(clean)}</p>;
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
              </>); })() : (
              <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:"16px",padding:"32px",textAlign:"center"}}>
                <p style={{color:C.textMuted}}>データがありません</p>
              </div>
            )}
          </div>
        )}
        {(tab==="manual"||tab==="guide") && (
          <div className="space-y-4">
            <div style={{background:`linear-gradient(135deg,${C.primary},${C.primary2})`,borderRadius:"20px",boxShadow:C.shadowPrimary,textAlign:"center",padding:"32px"}}>
              <h2 style={{color:"white",fontWeight:900,fontSize:"22px",marginBottom:"8px"}}>
                {tab==="manual"?"📖 ASCEND 完全マニュアル":"📝 実践ユーザーガイド"}
              </h2>
              <p style={{color:"rgba(255,255,255,0.8)",fontSize:"13px"}}>
                {tab==="manual"?"ASCENDの全機能と活用方法を完全解説":"ASCENDを最大限活用するための実践的な手順書"}
              </p>
            </div>
            {loading ? (
              <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:"16px",padding:"32px",textAlign:"center"}}>
                <p style={{color:C.textMuted}}>読み込み中...</p>
              </div>
            ) : content ? (
              <>
                {content.split(/\n(?=#{1,3}\s)/).map((section:string, i:number) => {
                  const slines = section.trim().split("\n");
                  const heading = slines[0].replace(/^#+\s*/, "").trim();
                  const body = slines.slice(1).join("\n").trim();
                  if (!heading) return null;
                  const colors = [C.primary,"#0891b2","#059669","#d97706","#dc2626","#7c3aed","#0891b2","#059669","#d97706"];
                  const color = colors[i % colors.length];
                  return (
                    <div key={i} style={{background:C.card,border:`1px solid ${color}20`,borderRadius:"20px",boxShadow:C.shadow,overflow:"hidden"}}>
                      <div style={{background:`linear-gradient(135deg,${color}12,${color}06)`,borderBottom:`1px solid ${color}15`,padding:"14px 20px",display:"flex",alignItems:"center",gap:"10px"}}>
                        <div style={{width:"4px",height:"20px",background:color,borderRadius:"2px",flexShrink:0}}/>
                        <p style={{color,fontWeight:800,fontSize:"14px"}}>{heading}</p>
                      </div>
                      {body && (
                        <div style={{padding:"16px 20px"}}>
                          {body.split("\n").map((line:string,j:number)=>{
                            const t=line.trim();
                            if(!t) return null;
                            const isBullet=/^[-*▶]/.test(t);
                            const clean=t.replace(/^[-*▶]\s*/,"");
                            const renderText=(s:string)=>s.split(/\*\*(.+?)\*\*/).map((p:string,k:number)=>k%2===1?<strong key={k} style={{color:C.textMain}}>{p}</strong>:p);
                            if(isBullet) return (
                              <div key={j} style={{display:"flex",alignItems:"flex-start",gap:"8px",marginBottom:"6px"}}>
                                <span style={{color,fontWeight:700,fontSize:"12px",flexShrink:0,marginTop:"3px"}}>▶</span>
                                <p style={{color:C.textSub,fontSize:"13px",lineHeight:"1.7"}}>{renderText(clean)}</p>
                              </div>
                            );
                            return <p key={j} style={{color:C.textSub,fontSize:"13px",lineHeight:"1.8",marginBottom:"4px"}}>{renderText(clean)}</p>;
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            ) : (
              <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:"16px",padding:"32px",textAlign:"center"}}>
                <p style={{color:C.textMuted}}>データがありません</p>
              </div>
            )}
          </div>
        )}

        {/* 利用履歴 */}
        {tab==="gallery" && (
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:"24px",boxShadow:C.shadowMd,padding:"24px"}}>
            <p style={{color:C.textMain,fontWeight:900,fontSize:"16px",marginBottom:"16px"}}>🎨 生成画像ギャラリー</p>
            <GalleryInner uid={uid} C={C}/>
          </div>
        )}
        {tab==="logs" && (
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:"24px",boxShadow:C.shadowMd}} className="p-6">
            <h2 className="text-lg font-black mb-4" style={{color:C.textMain}}>📋 利用履歴</h2>
            {loading ? <p style={{color:C.textMuted}}>読み込み中...</p>
              : logs.length===0 ? <p style={{color:C.textMuted}}>履歴がありません</p>
              : <div className="space-y-2">
                  {logs.map((l,i)=>(
                    <div key={i} style={{background:"rgba(0,0,0,0.02)",border:`1px solid ${C.border}`,borderRadius:"12px"}} className="p-3">
                      <p className="text-xs font-medium mb-1" style={{color:C.textMain}}>{l.prompt}</p>
                      <p className="text-xs" style={{color:C.textMuted}}>{l.timestamp}</p>
                    </div>
                  ))}
                </div>
            }
          </div>
        )}

        {/* Cookie */}
        {tab==="cookie" && (
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:"24px",boxShadow:C.shadowMd}} className="p-6 space-y-4">
            <h2 className="text-lg font-black" style={{color:C.textMain}}>🍪 Cookie/セッション設定</h2>
            <div style={{background:"rgba(0,0,0,0.02)",border:`1px solid ${C.border}`,borderRadius:"16px"}} className="p-4 space-y-2">
              <p className="font-bold text-sm mb-2" style={{color:C.textMain}}>セッション情報</p>
              <p className="text-xs" style={{color:C.textMuted}}>認証トークン: ブラウザのlocalStorageに保存</p>
              <p className="text-xs" style={{color:C.textMuted}}>有効期限: {stats?.is_unlimited ? "無期限" : "ログインから7日間"}</p>
              <p className="text-xs" style={{color:C.textMuted}}>UID: {uid}</p>
            </div>
            <button onClick={()=>{logout();router.push("/");}} style={{background:"rgba(239,68,68,0.06)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:"16px",color:"#ef4444"}} className="w-full py-3 text-sm font-medium transition-all hover:bg-red-50">
              セッションをクリアしてログアウト
            </button>
          </div>
        )}

        {/* 設定 */}
        {tab==="settings" && (
          <div className="space-y-4">
            {/* 通知設定 */}
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:"16px",boxShadow:C.shadow}} className="p-5">
              <p className="text-sm font-bold mb-4" style={{color:C.textMain}}>🔔 通知設定</p>
              <div className="space-y-3">
                {([
                  {key:"notify_reply",label:"AI返答完了の通知"},
                  {key:"notify_rankup",label:"ランクアップ時の通知"},
                  {key:"notify_fc",label:"固定概念レポート解放の通知"},
                  {key:"notify_inquiry",label:"📩 個人相談への返信通知"},
                ] as {key:keyof typeof settings;label:string}[]).map(item=>(
                  <div key={item.key} className="flex items-center justify-between">
                    <span className="text-sm" style={{color:C.textSub}}>{item.label}</span>
                    <button onClick={()=>setSettings(s=>({...s,[item.key]:!s[item.key]}))}
                      style={{background:settings[item.key]?`linear-gradient(135deg,${C.primary},${C.primary2})`:"rgba(0,0,0,0.08)",borderRadius:"99px",width:"44px",height:"24px",position:"relative",transition:"all 0.2s",boxShadow:settings[item.key]?C.shadowPrimary:"none",border:"none",cursor:"pointer"}}>
                      <span style={{position:"absolute",top:"3px",left:settings[item.key]?"23px":"3px",width:"18px",height:"18px",borderRadius:"50%",background:"#fff",transition:"all 0.2s",boxShadow:"0 1px 3px rgba(0,0,0,0.2)",display:"block"}}/>
                    </button>
                  </div>
                ))}
              </div>
            </div>
            {/* 表示設定 */}
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:"16px",boxShadow:C.shadow}} className="p-5">
              <p className="text-sm font-bold mb-4" style={{color:C.textMain}}>🖥️ 表示設定</p>
              <div className="space-y-3">
                {([
                  {key:"display_suggestions",label:"次の質問候補を表示"},
                  {key:"display_mode_bar",label:"目的モードバーを表示"},
                  {key:"display_score",label:"スコア・ランクを表示"},
                ] as {key:keyof typeof settings;label:string}[]).map(item=>(
                  <div key={item.key} className="flex items-center justify-between">
                    <span className="text-sm" style={{color:C.textSub}}>{item.label}</span>
                    <button onClick={()=>setSettings(s=>({...s,[item.key]:!s[item.key]}))}
                      style={{background:settings[item.key]?`linear-gradient(135deg,${C.primary},${C.primary2})`:"rgba(0,0,0,0.08)",borderRadius:"99px",width:"44px",height:"24px",position:"relative",transition:"all 0.2s",boxShadow:settings[item.key]?C.shadowPrimary:"none",border:"none",cursor:"pointer"}}>
                      <span style={{position:"absolute",top:"3px",left:settings[item.key]?"23px":"3px",width:"18px",height:"18px",borderRadius:"50%",background:"#fff",transition:"all 0.2s",boxShadow:"0 1px 3px rgba(0,0,0,0.2)",display:"block"}}/>
                    </button>
                  </div>
                ))}
              </div>
            </div>
            {/* AIエンジン設定 */}
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:"16px",boxShadow:C.shadow}} className="p-5">
              <p className="text-sm font-bold mb-4" style={{color:C.textMain}}>⚡ AIエンジン設定</p>
              <div className="flex items-center justify-between">
                <span className="text-sm" style={{color:C.textSub}}>デフォルトエンジン</span>
                <select value={settings.ai_tier_default} onChange={e=>setSettings(p=>({...p,ai_tier_default:e.target.value}))}
                  style={{background:`rgba(79,70,229,0.06)`,border:`1px solid ${C.borderPrimary}`,borderRadius:"10px",color:C.primary,padding:"6px 12px",fontSize:"13px"}}>
                  <option value="core">Core（標準）</option>
                  {ultraEnabled && <option value="ultra">Ultra（高精度）</option>}
                  {apexEnabled && <option value="apex">Apex（最上位）</option>}
                </select>
              </div>
            </div>
            {/* カスタムプロンプト */}
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:"16px",boxShadow:C.shadow}} className="p-5 space-y-3">
              <p className="text-sm font-bold" style={{color:C.textMain}}>💬 カスタムプロンプト</p>
              <p className="text-xs" style={{color:C.textMuted}}>AIへの個別指示を追加できます。</p>
              <select value={customPromptMode} onChange={e=>setCustomPromptMode(e.target.value)}
                style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:"10px",padding:"6px 10px",fontSize:"12px",color:C.textMain,width:"100%"}}>
                <option value="append">追記（システムプロンプトに追加）</option>
                <option value="replace">置換（完全に置き換え）</option>
              </select>
              <textarea value={customPrompt} onChange={e=>setCustomPrompt(e.target.value)}
                rows={4} placeholder="例: 回答は必ず箇条書きで、結論から述べること。"
                style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:"12px",padding:"10px",fontSize:"12px",color:C.textMain,width:"100%",resize:"vertical"}}/>
              <button onClick={async()=>{
                await saveCustomPrompt(customPrompt, customPromptMode);
                setCustomPromptSaved(true);
                setTimeout(()=>setCustomPromptSaved(false),2000);
              }} style={{background:`linear-gradient(135deg,${C.primary},${C.primary2})`,borderRadius:"12px",boxShadow:C.shadowPrimary,width:"100%",border:"none",cursor:"pointer"}} className="text-white font-bold py-2.5 text-sm hover:opacity-90 transition-all">
                {customPromptSaved ? "✅ 保存しました" : "💾 保存する"}
              </button>
            </div>
            {/* 全設定保存 */}
            <button onClick={()=>{
              localStorage.setItem("ascend_ai_tier_default", settings.ai_tier_default);
              localStorage.setItem("ascend_display_suggestions", String(settings.display_suggestions));
              localStorage.setItem("ascend_display_mode_bar", String(settings.display_mode_bar));
              setCustomPromptSaved(true);
              setTimeout(()=>setCustomPromptSaved(false),2000);
            }} style={{background:`linear-gradient(135deg,${C.primary},${C.primary2})`,borderRadius:"14px",boxShadow:C.shadowPrimary,width:"100%",border:"none",cursor:"pointer"}} className="text-white font-bold py-3 text-sm hover:opacity-90 transition-all">
              {customPromptSaved ? "✅ 設定を保存しました" : "💾 全設定を保存"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
