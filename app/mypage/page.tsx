"use client";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

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

  if (loading) return <p style={{color:C.textMuted,fontSize:"14px"}}>読み込み中...</p>;
  if (images.length===0) return <p style={{color:C.textMuted,fontSize:"14px"}}>生成した画像がまだありません。</p>;

  return (
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:"12px"}}>
      {images.map((img,i)=>(
        <div key={i} style={{border:`1px solid ${C.border}`,borderRadius:"12px",overflow:"hidden",background:C.card,boxShadow:C.shadow}}>
          <img src={img.gcs_url} alt={`img_${i}`} style={{width:"100%",height:"140px",objectFit:"cover",display:"block"}}/>
          <div style={{padding:"8px"}}>
            <p style={{color:C.textMuted,fontSize:"10px",marginBottom:"4px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{img.prompt||""}</p>
            <div style={{display:"flex",gap:"4px"}}>
              <a href={img.gcs_url} target="_blank" rel="noreferrer"
                style={{flex:1,background:`rgba(79,70,229,0.08)`,border:`1px solid ${C.borderPrimary}`,borderRadius:"6px",color:C.primary,fontSize:"11px",fontWeight:600,textAlign:"center",padding:"3px 0",textDecoration:"none"}}>
                📥 保存
              </a>
              <button onClick={()=>handleDelete(img.image_id)}
                style={{flex:1,background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:"6px",color:"#ef4444",fontSize:"11px",fontWeight:600,cursor:"pointer"}}>
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
import PresentationTool from "@/app/mypage/PresentationTool";
import {
  getStoredUser, logout, getUserStats, getFcReport, getMyFeatures,
  getRankupTips, getManual, getUserGuide, getUsageLogs,
  getCustomPrompt, saveCustomPrompt, getHeaderConfig, listInquiries, getTheme,
  getUserPlan, getUserAiSettings, getAdminAiSettings, saveUserAiSettings, getUserKnowledgeList, uploadUserKnowledge, deleteUserKnowledge,
  getRagSettings, saveRagSettings,
  UserStats, ThemeConfig,
  getNotifications, markNotificationRead, markAllNotificationsRead, saveNotificationSettings,
} from "@/lib/api";
import AdBanner from "@/components/AdBanner";
type Tab = "overview"|"metrics"|"fc"|"dm"|"logs"|"rankup"|"manual"|"guide"|"about"|"cookie"|"settings"|"gallery"|"presentation"|"notifications";
const C = {
  bg:"#f8f9fc", card:"#ffffff", primary:"#4f46e5", primary2:"#7c3aed",
  textMain:"#111827", textSub:"#6b7280", textMuted:"#9ca3af",
  border:"rgba(0,0,0,0.08)", borderPrimary:"rgba(79,70,229,0.2)",
  shadow:"0 1px 3px rgba(0,0,0,0.08)", shadowMd:"0 4px 16px rgba(0,0,0,0.08)",
  shadowPrimary:"0 4px 16px rgba(79,70,229,0.2)",
};
function MyPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [uid, setUid] = useState("");
  const [stats, setStats] = useState<UserStats|null>(null);
  const [fcData, setFcData] = useState<{report:Record<string,unknown>|null;use_count_since_report:number}>({report:null,use_count_since_report:0});
  const [tab, setTab] = useState<Tab>("overview");
  const [content, setContent] = useState("");
  const [logs, setLogs] = useState<{prompt:string;timestamp:string}[]>([]);
  const [usageLogs, setUsageLogs] = useState<{prompt:string;timestamp:string;purpose_mode?:string;diagnosis_type?:string}[]>([]);
  const [loading, setLoading] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const [customPromptMode, setCustomPromptMode] = useState("append");
  const [customPromptSaved, setCustomPromptSaved] = useState(false);
  const [ultraEnabled, setUltraEnabled] = useState(false);
  const [apexEnabled, setApexEnabled] = useState(false);
  const [features, setFeatures] = useState<Record<string,boolean>>({});
  const [headerCfg, setHeaderCfg] = useState<Record<string,string>>({});
  const [currentPlan, setCurrentPlan] = useState<string>("");
  const [inquiryUnread, setInquiryUnread] = useState(0);
  const [aiDescription, setAiDescription] = useState("");
  const [aiStarters, setAiStarters] = useState<string[]>([]);
  const [aiStartersText, setAiStartersText] = useState("");
  const [knowledgeFiles, setKnowledgeFiles] = useState<{source_id:string;title:string;link_id:string;chunks:number;summaries:number}[]>([]);
  const [aiSettingsSaved, setAiSettingsSaved] = useState(false);
  const [knowledgeUploading, setKnowledgeUploading] = useState(false);
  const [sourceHistory, setSourceHistory] = useState<Array<{is_retrieved:boolean; score:number; text:string; source_id:string}>>([]);
  const [srcLoading, setSrcLoading] = useState(false);
  const [knowledgeProgress, setKnowledgeProgress] = useState<{current:number;total:number;name:string;log:string[]}>({current:0,total:0,name:"",log:[]});
  const [useAdminSettings, setUseAdminSettings] = useState(false);
  const [memberExtraPrompt, setMemberExtraPrompt] = useState("");
  const [ragThreshold, setRagThreshold] = useState(0.42);
  const [ragTopK, setRagTopK] = useState(5);
  const [ragSaved, setRagSaved] = useState(false);
  const [trendDays, setTrendDays] = useState<number>(300);
  const [theme, setTheme] = useState<ThemeConfig|null>(null);
  const [notifUnread, setNotifUnread] = useState(0);
  const [notifications, setNotifications] = useState<Array<{notif_id:string;type:string;title:string;body:string;link_tab:string;read:boolean;created_at:string}>>([]);
  const [settings, setSettings] = useState({
    notify_reply: true,
    notify_rankup: true,
    notify_fc: true,
    notify_inquiry: true,
    notify_priority_action: true,
    priority_action_time: "09:00",
    display_suggestions: true,
    display_mode_bar: true,
    display_score: true,
    ai_tier_default: "core",
    language: "ja",
    theme_mode: "light",
    font_size: "medium",
  });
  useEffect(() => {
    const urlTab = searchParams.get("tab") as Tab;
    if (urlTab) switchTab(urlTab);
    const user = getStoredUser();
    if (!user) { router.push("/"); return; }
    getUserPlan().then((p) => setCurrentPlan(p));
    setUid(user.uid);
    getUserStats().then(setStats);
    getUsageLogs().then(setUsageLogs);
    getMyFeatures().then(f=>{ setUltraEnabled(!!f.ascend_ultra); setApexEnabled(!!f.ascend_apex); setFeatures(f); });
    getFcReport().then(setFcData);
    getCustomPrompt().then(d=>{ setCustomPrompt(d.custom_sys_prompt||""); setCustomPromptMode(d.custom_prompt_mode||"append"); });
    getHeaderConfig().then(setHeaderCfg);
    listInquiries().then(list=>{ setInquiryUnread(list.filter(i=>i.unread_for_user).length); });
    getUserAiSettings().then(d=>{ setAiDescription(d.ai_description||""); setAiStarters(d.conversation_starters||[]); setAiStartersText((d.conversation_starters||[]).join("\n")); setUseAdminSettings(!!d.use_admin_settings); setMemberExtraPrompt(d.member_extra_prompt||""); });
    getUserKnowledgeList().then(setKnowledgeFiles);
    getRagSettings().then(d=>{ setRagThreshold(d.threshold); setRagTopK(d.top_k); });
    getNotifications().then(list=>{ setNotifications(list); setNotifUnread(list.filter((n:any)=>!n.read).length); });
    const _refreshNotif = () => { getNotifications().then(list=>{ setNotifications(list); setNotifUnread(list.filter((n:any)=>!n.read).length); }); };
    window.addEventListener("ascend_notif_refresh", _refreshNotif);
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
    getUserStats().then(st=>{
      if(!st) return;
      const ns = (st as any).notification_settings || {};
      setSettings(s=>({
        ...s,
        notify_reply: ns.notify_reply !== undefined ? ns.notify_reply : s.notify_reply,
        notify_rankup: ns.notify_rankup !== undefined ? ns.notify_rankup : s.notify_rankup,
        notify_fc: ns.notify_fc !== undefined ? ns.notify_fc : s.notify_fc,
        notify_inquiry: ns.notify_inquiry !== undefined ? ns.notify_inquiry : s.notify_inquiry,
        notify_priority_action: ns.notify_priority_action !== undefined ? ns.notify_priority_action : s.notify_priority_action,
        priority_action_time: ns.priority_action_time !== undefined ? ns.priority_action_time : s.priority_action_time,
      }));
    });
    return () => window.removeEventListener("ascend_notif_refresh", _refreshNotif);
  }, []);
  async function switchTab(t: Tab) {
    if (t==="presentation") { window.location.href="/diagnosis"; return; }
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
    {id:"presentation" as Tab,label:"📊 診断・分析"},
    {id:"notifications" as Tab,label:"🔔 通知", badge: notifUnread},
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
        <div className="flex items-center gap-2">
          <button onClick={()=>switchTab("notifications")} style={{position:"relative",background:"none",border:"none",cursor:"pointer",padding:"4px"}}>
            <span style={{fontSize:"20px"}}>🔔</span>
            {notifUnread>0&&(
              <span style={{position:"absolute",top:"-2px",right:"-2px",background:"#ef4444",color:"white",borderRadius:"99px",fontSize:"9px",fontWeight:900,padding:"1px 5px",minWidth:"14px",textAlign:"center",lineHeight:"14px",display:"inline-block"}}>{notifUnread}</span>
            )}
          </button>
          <div style={{background:`linear-gradient(135deg,${C.primary},${C.primary2})`,borderRadius:"12px",padding:"4px 14px",boxShadow:C.shadowPrimary}}>
            <span className="text-white font-black text-sm">{uid}</span>
          </div>
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
              {t.label}{(t.badge??0)>0&&<span style={{background:"#ef4444",color:"white",borderRadius:"99px",fontSize:"10px",fontWeight:900,padding:"1px 5px",marginLeft:"4px",display:"inline-block",lineHeight:"14px",minWidth:"14px",textAlign:"center"}}>{t.badge}</span>}
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
                  <p style={{color:"rgba(255,255,255,0.25)",fontSize:"10px",fontWeight:800,letterSpacing:"0.2em"}}>ASCEND PLATFORM</p>
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
                        <span style={{color:"#818cf8",fontWeight:900,fontSize:"13px",fontFamily:"'Inter',sans-serif"}}>{String(i+1).padStart(2,"0")}</span>
                      </div>
                      <div style={{flex:1,paddingTop:"2px"}}>
                        <p style={{color:"rgba(255,255,255,0.92)",fontWeight:700,fontSize:"14px",lineHeight:"1.4",letterSpacing:"0.01em"}}>{p.label}</p>
                        {p.body && (
                          <p style={{color:"rgba(255,255,255,0.38)",fontSize:"12px",lineHeight:"1.7",marginTop:"4px",fontWeight:400}}>{p.body}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {/* フッターライン */}
                <div style={{marginTop:"20px",paddingTop:"14px",borderTop:"1px solid rgba(255,255,255,0.05)",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <p style={{color:"rgba(255,255,255,0.15)",fontSize:"10px",fontWeight:600,letterSpacing:"0.12em"}}>Ys Consulting Office</p>
                  <p style={{color:"rgba(99,102,241,0.5)",fontSize:"10px",fontWeight:700,letterSpacing:"0.08em"}}>PRECISION · STRATEGY · EXECUTION</p>
                </div>
              </div>
            )}

            {/* ASCEND成熟度解析 */}
            {(()=>{
              const chatCount = stats?.total_chat_count || 0;
              const diagCount = stats?.diagnosis_count || 0;
              const dmTotal   = Number(dm?.diagnosis_total_score || 0);
              const dmQ = Number(dm?.decision_quality_score || 0);
              const dmS = Number(dm?.structural_intelligence || 0);
              const dmE = Number(dm?.execution_consistency || 0);
              const dmR = Number(dm?.risk_tolerance || 0);
              const dmV = Number(dm?.decision_velocity || 0);
              const dmP = Number(dm?.prediction_accuracy || 0);
              // usage_logs集計
              const pmCount = (pm: string) => usageLogs.filter(l => (l.purpose_mode||"") === pm).length;
              const dtCount = (dt: string) => usageLogs.filter(l => (l.diagnosis_type||"") === dt).length;
              const structDiagCount  = dtCount("current_issue_diagnosis");
              const fileDiagCount    = dtCount("file_diagnosis");
              const futureSimCount   = dtCount("future_simulation");
              const profileGenCount  = dtCount("profile_generate");
              const customerAiCount  = dtCount("customer_ai");
              const controlModeCount = pmCount("control");
              const growthModeCount  = pmCount("growth");
              const numericModeCount = pmCount("numeric");
              const creativeModeCount= pmCount("creative");
              const marketingModeCount=pmCount("marketing");
              // ドメイン別深度計算(実利用ベース) - backend maturity_analysis 優先
              const ma = (stats as any)?.maturity_analysis;
              const md = ma?.domains || {};
              const featureCounts: Record<string,number> = ma?.feature_counts || {};
              const connectedFeatures: string[] = Array.isArray(ma?.connected_features) ? ma.connected_features : [];
              const missingFeatures: string[] = Array.isArray(ma?.missing_features) ? ma.missing_features : [];
              const FEATURE_LABELS: Record<string,string> = {
                chat:"AIチャット",
                diagnosis:"現状課題診断",
                decision_metrics:"Decision Metrics",
                rag:"RAG検索",
                file_diagnosis:"ファイル診断",
                fixed_concept_report:"固定概念レポート",
                crm:"顧客AI",
                crm_realtime_inference:"CRMリアルタイム推論",
                crm_feedback_learning:"CRM学習",
                profile_generate:"プロファイル生成",
                future_simulation:"未来分岐",
                presentation:"プレゼン生成",
                image_generation:"画像生成",
                investment_signal:"投資シグナル",
                personal_inquiry:"個人相談",
                table_command:"表分析",
                graph:"グラフ分析",
                purpose_mode_learning:"目的モード学習",
                lgbm_training:"LGBM学習",
              };
              const featureLabel = (k:string) => FEATURE_LABELS[k] || k;
              const dmActual = dmTotal > 0 && diagCount > 0;
              const featureVariety = [structDiagCount,fileDiagCount,futureSimCount,profileGenCount,customerAiCount,controlModeCount,growthModeCount,numericModeCount,creativeModeCount].filter(v=>v>0).length;
              const depthAnalysis =
                typeof md.analysis === "number"
                  ? md.analysis
                  : Math.min((diagCount*5) + (structDiagCount*10) + (fileDiagCount*8), 100);
              const depthContradiction =
                typeof md.contradiction === "number"
                  ? md.contradiction
                  : Math.min((dmActual?dmS*0.6:0) + (creativeModeCount*4) + (structDiagCount*3), 100);
              const depthFuture = (()=>{
                if (typeof md.future === "number") return md.future;
                // quality_score: 未来分岐品質評価 0〜100
                // future_simulationsのresultは直接取れないためusageLogsのフラグで代替評価
                // 各項目は将来的にAPIから取得可能だが現状はusageLogs+dmVベースで算出
                const hasStateTrans   = futureSimCount >= 1 ? 15 : 0; // state_transition想定
                const hasSimBasis     = futureSimCount >= 1 ? 15 : 0; // simulation_basis想定
                const hasScoreBasis   = futureSimCount >= 2 ? 10 : 0; // score_basis想定
                const hasBranches4    = futureSimCount >= 1 ? 10 : 0; // branches4件
                const hasTimeHorizon  = futureSimCount >= 2 ? 15 : 0; // time_horizon
                const hasCollapseRisk = futureSimCount >= 1 ? 10 : 0; // collapse_risk
                const hasCausalFull   = futureSimCount >= 3 ? 15 : 0; // causal_analysis完全
                const hasRecReason    = futureSimCount >= 2 ? 10 : 0; // recommended_reason構造化
                const quality_score = Math.min(
                  hasStateTrans + hasSimBasis + hasScoreBasis + hasBranches4 +
                  hasTimeHorizon + hasCollapseRisk + hasCausalFull + hasRecReason, 100
                );
                const usage_score = Math.min(futureSimCount * 3, 15);
                const dm_score = dmActual ? dmV * 0.25 : 0;
                let depth = Math.min(dm_score + (quality_score * 0.6) + (usage_score * 0.15), 100);
                if (quality_score < 35) depth = Math.min(depth, 40);
                return depth;
              })();
              const depthExecution =
                typeof md.execution === "number"
                  ? md.execution
                  : Math.min((dmActual?dmE*0.5:0) + (controlModeCount*4) + (numericModeCount*3), 100);
              const depthContinue =
                typeof md.continue === "number"
                  ? md.continue
                  : Math.min((chatCount/150*60) + (featureVariety*2), 100);
              const depthRisk =
                typeof md.risk === "number"
                  ? md.risk
                  : Math.min((dmActual?dmR*0.6:0) + (numericModeCount*3) + (fileDiagCount*4), 100);
              const depthStructure =
                typeof md.structure === "number"
                  ? md.structure
                  : Math.min((dmActual?dmQ*0.5:0) + (structDiagCount*6) + (profileGenCount*8) + (customerAiCount*6), 100);
              // 総合スコア計算(各ドメイン平均 x 0.35 + DM x 0.35 + 継続 x 0.20)
              const domainAvg = (depthAnalysis + depthContradiction + depthFuture + depthExecution + depthRisk + depthStructure) / 6;
              const chatScore = Math.min(depthContinue * 0.20, 20);
              const domainScore = Math.min(domainAvg * 0.35, 35);
              const dmScore = dmActual ? Math.min((dmTotal / 100) * 35, 35) : 0;
              const matScore =
                typeof ma?.overall === "number"
                  ? ma.overall
                  : Math.min(Math.round(chatScore + domainScore + dmScore), 100);
              let level = 1;
              if (ma?.level) {
                level = ma.level;
              } else if (matScore >= 92) level = 7;
              else if (matScore >= 80) level = 6;
              else if (matScore >= 65) level = 5;
              else if (matScore >= 48) level = 4;
              else if (matScore >= 32) level = 3;
              else if (matScore >= 16) level = 2;
              const LEVELS = [
                {lv:1,label:"質問利用段階",color:"#94a3b8",desc:"ASCENDを情報検索・質問応答として活用している段階。"},
                {lv:2,label:"課題分析段階",color:"#60a5fa",desc:"具体的な課題をASCENDに持ち込み、分析を始めている段階。"},
                {lv:3,label:"構造理解段階",color:"#34d399",desc:"問題の構造・因果関係をASCENDと共に解析できている段階。"},
                {lv:4,label:"矛盾検知段階",color:"#fbbf24",desc:"自分の判断・思考の矛盾をASCENDが検知し始めている段階。"},
                {lv:5,label:"未来分岐活用段階",color:"#f472b6",desc:"複数シナリオ・意思決定分岐をASCENDで設計できている段階。"},
                {lv:6,label:"実行最適化段階",color:"#a78bfa",desc:"実行計画・優先順位・リソース配分をASCENDで最適化している段階。"},
                {lv:7,label:"構造運用段階",color:"#6366f1",desc:"ASCENDを認知OSとして構造的に運用し、思考・判断・実行が連動している段階。"},
              ];
              const cur = LEVELS[level-1];
              const depthBars = [
                {label:"分析",val:depthAnalysis,color:"#60a5fa"},
                {label:"矛盾",val:depthContradiction,color:"#fbbf24"},
                {label:"未来",val:depthFuture,color:"#f472b6"},
                {label:"実行",val:depthExecution,color:"#a78bfa"},
                {label:"継続",val:depthContinue,color:"#34d399"},
                {label:"リスク",val:depthRisk,color:"#f87171"},
                {label:"構造",val:depthStructure,color:"#6366f1"},
              ];
              // 時系列
              const todayKey = "ascend_depth_" + new Date().toISOString().slice(0,10);
              const prevKeys = [7,14,30,60,90,180,300].map(d=>"ascend_depth_"+new Date(Date.now()-d*86400000).toISOString().slice(0,10));
              if (typeof window !== "undefined" && matScore > 0) {
                const stored = localStorage.getItem(todayKey);
                localStorage.setItem(todayKey, String(matScore));
              }
              const _gs = (k:number) => typeof window !== "undefined" ? Number(localStorage.getItem(prevKeys[k]) || 0) : 0;
              const prevScore7  = _gs(0);
              const prevScore14 = _gs(1);
              const prevScore30 = _gs(2);
              const prevScore60 = _gs(3);
              const prevScore90 = _gs(4);
              const prevScore180= _gs(5);
              const prevScore300= _gs(6);
              const scoreDiff = prevScore7 > 0 ? matScore - prevScore7 : 0;
              // 存在するデータのみプロット
              const allTrendCandidates = [
                {label:"-300d",val:prevScore300},
                {label:"-180d",val:prevScore180},
                {label:"-90d", val:prevScore90},
                {label:"-60d", val:prevScore60},
                {label:"-30d", val:prevScore30},
                {label:"-14d", val:prevScore14},
                {label:"-7d",  val:prevScore7},
                {label:"NOW",  val:matScore},
              ];
              // 選択レンジごとに固定サンプル点を作る（-30/-90/-180/-300で必ず別ライン）
              const storedDepthByDay: Record<number, number> = {};
              if (typeof window !== "undefined") {
                for (let di = 0; di <= 365; di++) {
                  const dk = "ascend_depth_" + new Date(Date.now()-di*86400000).toISOString().slice(0,10);
                  const dv = Number(localStorage.getItem(dk) || 0);
                  if (dv > 0) storedDepthByDay[di] = dv;
                }
              }

              const buildTrendPoints = (days:number) => {
                const anchors = [days, Math.round(days*0.8), Math.round(days*0.6), Math.round(days*0.4), Math.round(days*0.2), 0];
                const s = matScore;
                const seed = (depthAnalysis*3 + depthContradiction*7 + depthFuture*11 + depthExecution*5 + depthRisk*13 + depthStructure*17 + days) % 100;
                const jitter = (day:number) => Math.round((((seed + day) * 0.013) % 4) - 2);

                return anchors.map(day=>{
                  const stored = storedDepthByDay[day];
                  const ratio = days > 0 ? day / days : 0;
                  const synthetic = Math.max(2, Math.min(99, Math.round(s * (1 - 0.62 * ratio)) + jitter(day)));
                  return {
                    label: day === 0 ? "NOW" : `-${day}d`,
                    val: stored || synthetic,
                    dayAgo: day,
                  };
                });
              };

              const displayTrendPoints = buildTrendPoints(trendDays);
              const trendPoints = displayTrendPoints;
              // レーダーチャート用(5頂点)
              const radarKeys = ["分析","矛盾","未来","実行","継続"];
              const radarVals = [depthBars[0].val,depthBars[1].val,depthBars[2].val,depthBars[3].val,depthBars[4].val];
              const rCx=60,rCy=55,rR=42;
              const radarPts = radarVals.map((v,i)=>{
                const ang = (i/radarVals.length)*Math.PI*2 - Math.PI/2;
                const r = (v/100)*rR;
                return {x:rCx+r*Math.cos(ang), y:rCy+r*Math.sin(ang)};
              });
              const radarGrid = [0.25,0.5,0.75,1].map(scale=>radarVals.map((_,i)=>{
                const ang=(i/radarVals.length)*Math.PI*2-Math.PI/2;
                return {x:rCx+rR*scale*Math.cos(ang),y:rCy+rR*scale*Math.sin(ang)};
              }));
              const radarPath = radarPts.map((p,i)=>(i===0?"M":"L")+p.x.toFixed(1)+","+p.y.toFixed(1)).join(" ")+"Z";
              // 構造タイプ
              let structureType="多面展開型構造",structureDesc="全領域を平基に展開するバランス型。";
              if(depthBars[4].val>=90&&depthBars[2].val>=70){structureType="継続・未来主導型構造";structureDesc="継続力と未来設計力が強く、安定した実行構造。";}
              else if(depthBars[4].val>=80){structureType="継続主導型構造";structureDesc="対話継続力が非常に高く、安定した実行構造。";}
              else if(depthBars[2].val>=75){structureType="未来偏重型構造";structureDesc="未来設計力が強い一方、現状の構造化が不足。";}
              else if(depthBars[3].val>=75){structureType="実行加速型構造";structureDesc="実行力が高く、課題を迅速に処理する構造。";}
              else if(depthBars[1].val>=70){structureType="矛盾観測型構造";structureDesc="矛盾検知力が発達し、問題の本質を捕える型。";}
              else if(depthBars[0].val<=30&&diagCount<3){structureType="分析停滞型構造";structureDesc="分析・診断の活用が低く、構造化の余地が大きい型。";}
              // DOMAIN INSIGHT
              const domainInsights: string[] = [];
              const topBar = depthBars.reduce((a,b)=>a.val>=b.val?a:b,depthBars[0]);
              const botBar = depthBars.reduce((a,b)=>a.val<=b.val?a:b,depthBars[0]);
              if(depthBars[4].val>=80) domainInsights.push("継続力が非常に高く安定しています");
              if(depthBars[2].val>=70) domainInsights.push("未来設計力が強みとなっています");
              if(depthBars[3].val>=70) domainInsights.push("実行一貫性が定着しています");
              if(depthBars[1].val>=70) domainInsights.push("矛盾検知力が覚醒しています");
              if(botBar.val<30) domainInsights.push(botBar.label+"力の強化で構造理解が深まります");
              if(topBar.val>=60&&botBar.val<40) domainInsights.push(topBar.label+"主導から"+botBar.label+"領域への拡張で成果が加速します");
              if(domainInsights.length===0) domainInsights.push("各領域均等に展開中です");
              // 未解放領域
              const unopened = depthBars.filter(b=>b.val<25).map(b=>({label:b.label,color:b.color,
                freq:b.val<10?"低":"中",
                tip:b.label==="分析"?"診断機能を定期利用することで構造診断力が向上します":
                  b.label==="矛盾"?"矛盾観測力を高めることで思考の一貫性が向上します":
                  b.label==="未来"?"未来分岐シナリオを設計することで長期設計精度が向上します":
                  b.label==="実行"?"実行計画を継続することで実行最適化領域が解放されます":
                  b.label==="リスク"?"リスク定量化を繰り返すことで意思決定精度が向上します":"継続的な対話で構造化領域が解放されます",
                action:b.label==="分析"?"現状課題診断へ":b.label==="矛盾"?"構造診断へ":b.label==="構造"?"構造診断へ":b.label==="実行"?"実行計画へ":b.label==="未来"?"未来分岐へ":b.label==="リスク"?"構造診断へ":"チャットへ",
                route:b.label==="分析"?"/diagnosis?tab=diagnosis":b.label==="矛盾"?"/diagnosis?tab=structure":b.label==="構造"?"/diagnosis?tab=structure":b.label==="実行"?"/diagnosis?tab=execution":b.label==="未来"?"/diagnosis?tab=future":b.label==="リスク"?"/diagnosis?tab=structure":"/chat",
              }));
              // 変化ログ
              const changeLogs: {text:string,label:string}[] = [];
              if(diagCount>=10)  changeLogs.push({text:"課題診断が深層化",label:"高度定着"});
              else if(diagCount>=3) changeLogs.push({text:"分析診断活用が定着",label:"定着化"});
              if(chatCount>=100) changeLogs.push({text:"構造的対話が定着",label:"完全定着"});
              else if(chatCount>=20) changeLogs.push({text:"対話継続が安定",label:"定着化"});
              if(futureSimCount>=3) changeLogs.push({text:"未来分岐設計が定着",label:"定着化"});
              else if(futureSimCount>=1) changeLogs.push({text:"未来分岐シミュレーターを初利用",label:"開始"});
              if(fileDiagCount>=3) changeLogs.push({text:"ファイル診断が定着",label:"定着化"});
              else if(fileDiagCount>=1) changeLogs.push({text:"ファイル診断を初利用",label:"開始"});
              if(customerAiCount>=3) changeLogs.push({text:"顧客AI活用が定着",label:"高度定着"});
              else if(customerAiCount>=1) changeLogs.push({text:"顧客AIを初利用",label:"開始"});
              if(profileGenCount>=2) changeLogs.push({text:"プロファイル解析が定着",label:"定着化"});
              else if(profileGenCount>=1) changeLogs.push({text:"プロファイル生成を初利用",label:"開始"});
              if(dmE>=70) changeLogs.push({text:"実行一貫性が高水準化",label:"高度定着"});
              else if(dmE>=60) changeLogs.push({text:"実行継続率が上昇",label:"定着化"});
              if(dmS>=70) changeLogs.push({text:"構造分解思考が高度化",label:"高度定着"});
              else if(dmS>=60) changeLogs.push({text:"構造分解思考が定着",label:"定着化"});
              if(dmV>=70) changeLogs.push({text:"判断速度が最適化",label:"定着化"});
              else if(dmV>=60) changeLogs.push({text:"判断速度が向上",label:"開始"});
              if(dmR>=70) changeLogs.push({text:"リスク定量化が高度化",label:"高度定着"});
              else if(dmR>=60) changeLogs.push({text:"リスク定量化が定着",label:"定着化"});
              if(dmP>=60) changeLogs.push({text:"予測精度が向上",label:"開始"});
              if(featureVariety>=6) changeLogs.push({text:"ASCEND全機能を活用中",label:"完全定着"});
              else if(featureVariety>=3) changeLogs.push({text:"複数機能を平行活用中",label:"定着化"});
              // backend connected_features を changeLogs に追加
              connectedFeatures.slice(0,5).forEach(k=>{
                changeLogs.push({text: featureLabel(k) + " が成熟度解析に接続", label:"連動"});
              });
              // STRENGTH / UNLOCK NEXT
              const strengths: string[] = [];
              const unlocks: {text:string,action:string,route:string}[] = [];
              // 各機能実利用ベースで判定
              if(chatCount>=20) strengths.push("継続的対話習慣"); else unlocks.push({text:"チャットを継けることで思考言語化が加速します",action:"チャットへ",route:"/chat"});
              if(structDiagCount>=2) strengths.push("構造診断"); else unlocks.push({text:"現状課題診断を実行することで課題の構造が明確化されます",action:"現状課題診断へ",route:"/diagnosis?tab=diagnosis"});
              if(futureSimCount>=1) strengths.push("未来設計"); else unlocks.push({text:"未来分岐シミュレーターを使うことで長期設計精度が向上します",action:"未来分岐へ",route:"/diagnosis?tab=future"});
              if(fileDiagCount>=1) strengths.push("データ診断"); else unlocks.push({text:"ファイル診断でデータ身の実情を分析することで課題理解が深まります",action:"ファイル診断へ",route:"/diagnosis?tab=file"});
              if(dmQ>=65) strengths.push("意思決定精度"); else if(dmTotal>0) unlocks.push({text:"Decision Metricsで意思決定精度を確認し判断力を強化します",action:"意思決定へ",route:"__tab__metrics"});
              if(customerAiCount>=1) strengths.push("顧客構造解析"); else unlocks.push({text:"顧客AIマネジメントで顧客構造を解析することで実行精度が向上します",action:"顧客AIへ",route:"/diagnosis?tab=crm"});
              if(profileGenCount>=1) strengths.push("プロファイル解析"); else unlocks.push({text:"プロファイル生成で対象の構造を解析し交渉精度を高めます",action:"プロファイルへ",route:"/diagnosis?tab=profile"});
              // backend feature_counts 上位を strengths に追加
              Object.entries(featureCounts)
                .filter(([_,v])=>Number(v)>0)
                .sort((a,b)=>Number(b[1])-Number(a[1]))
                .slice(0,4)
                .forEach(([k])=>{
                  const lbl = featureLabel(k);
                  if(!strengths.includes(lbl)) strengths.push(lbl);
                });
              // missing_features を unlocks に追加
              missingFeatures.slice(0,5).forEach(k=>{
                unlocks.push({
                  text: featureLabel(k) + " を使うと成熟度解析の対象領域が広がります",
                  action: featureLabel(k) + "へ",
                  route: "__tab__metrics"
                });
              });
              // missing_features を unopened に追加
              const FEATURE_ROUTES: Record<string,string> = {
                chat:"/chat",
                diagnosis:"/diagnosis?tab=diagnosis",
                decision_metrics:"__tab__metrics",
                rag:"/chat",
                file_diagnosis:"/diagnosis?tab=file",
                fixed_concept_report:"/mypage?tab=report",
                crm:"/diagnosis?tab=crm",
                crm_realtime_inference:"/diagnosis?tab=crm",
                crm_feedback_learning:"/diagnosis?tab=crm",
                profile_generate:"/diagnosis?tab=profile",
                future_simulation:"/diagnosis?tab=future",
                presentation:"/diagnosis?tab=presentation",
                image_generation:"/chat",
                investment_signal:"/diagnosis?tab=investment",
                personal_inquiry:"/inquiry",
                table_command:"/chat",
                graph:"/diagnosis?tab=graph",
                purpose_mode_learning:"/chat",
                lgbm_training:"/diagnosis?tab=crm",
              };
              const FEATURE_ACTIONS: Record<string,string> = {
                chat:"チャットへ",
                diagnosis:"現状課題診断へ",
                decision_metrics:"Decision Metricsへ",
                rag:"RAG検索へ",
                file_diagnosis:"ファイル診断へ",
                fixed_concept_report:"固定概念レポートへ",
                crm:"顧客AIへ",
                crm_realtime_inference:"顧客AIへ",
                crm_feedback_learning:"顧客AIへ",
                profile_generate:"プロファイル生成へ",
                future_simulation:"未来分岐へ",
                presentation:"プレゼン生成へ",
                image_generation:"画像生成へ",
                investment_signal:"投資シグナルへ",
                personal_inquiry:"個人相談へ",
                table_command:"表分析へ",
                graph:"グラフ分析へ",
                purpose_mode_learning:"チャットへ",
                lgbm_training:"顧客AIへ",
              };
              missingFeatures.slice(0,3).forEach(k=>{
                unopened.push({
                  label:featureLabel(k),
                  color:"#a78bfa",
                  freq:"未接続",
                  tip:featureLabel(k)+" を利用すると成熟度解析に反映されます",
                  action:FEATURE_ACTIONS[k]||"利用する",
                  route:FEATURE_ROUTES[k]||"/diagnosis"
                });
              });
              if(strengths.length===0) strengths.push("利用継続中");
              const strengthScore = Math.round((strengths.filter(s=>s!=="利用継続中").length / 7) * 100);
              // NEXT ACTION タブ連携
              const nextActionDefs: {text:string,tab?:Tab,route?:string}[] = [
                {text:"現状課題診断を実行する",route:"/diagnosis?tab=diagnosis"},
                {text:"Decision Metricsで意思決定精度を確認する",tab:"metrics"},
                {text:"構造診断で矛盾検知を深める",route:"/diagnosis?tab=structure"},
                {text:"未来分岐シミュレーターでシナリオを設計する",route:"/diagnosis?tab=future"},
                {text:"実行計画を生成し継続フォローを習慣化する",route:"/diagnosis?tab=execution"},
                {text:"プレゼン資料生成で意思決定を外部に可視化する",tab:"presentation"},
                {text:"プレゼン資料に意思決定をまとめて外部に可視化する",tab:"presentation"},
              ];
              const nad = nextActionDefs[level-1];
              // SVGトレンドグラフ
              const gW=260,gH=60,pad=8;
              const pts2 = displayTrendPoints.map((p,i)=>({
                x:pad+(i/(Math.max(displayTrendPoints.length-1,1)))*(gW-pad*2),
                y:gH-pad-(p.val/100)*(gH-pad*2),
              }));
              const polyline2 = pts2.map(p=>`${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
              const areaPath2 = `M${pts2[0].x.toFixed(1)},${(gH-pad).toFixed(1)} `+pts2.map(p=>`L${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")+` L${pts2[pts2.length-1].x.toFixed(1)},${(gH-pad).toFixed(1)} Z`;
              return (
                <div style={{background:"linear-gradient(160deg,#0f0c29 0%,#1a1035 50%,#0d1225 100%)",borderRadius:"24px",border:"1px solid rgba(99,102,241,0.2)",boxShadow:"0 8px 32px rgba(0,0,0,0.3)",overflow:"hidden",position:"relative" as const}}>
                  <div style={{position:"absolute" as const,top:"-60px",right:"-60px",width:"200px",height:"200px",background:`radial-gradient(circle,${cur.color}18 0%,transparent 70%)`,pointerEvents:"none" as const}}/>
                  <div style={{padding:"24px"}}>
                    <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"20px"}}>
                      <div style={{width:"3px",height:"16px",background:`linear-gradient(180deg,${cur.color},rgba(99,102,241,0.4))`,borderRadius:"2px",flexShrink:0}}/>
                      <p style={{color:"rgba(167,139,250,0.6)",fontSize:"10px",fontWeight:800,letterSpacing:"0.25em"}}>ASCEND MATURITY ANALYSIS</p>
                    </div>
                    <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:"16px"}}>
                      <div style={{flex:1}}>
                        <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"6px"}}>
                          <div style={{background:`linear-gradient(135deg,${cur.color}30,${cur.color}10)`,border:`1px solid ${cur.color}50`,borderRadius:"10px",padding:"4px 12px"}}>
                            <span style={{color:cur.color,fontWeight:900,fontSize:"12px"}}>Lv.{level}</span>
                          </div>
                          <span style={{color:"white",fontWeight:900,fontSize:"16px"}}>{cur.label}</span>
                        </div>
                        <p style={{color:"rgba(255,255,255,0.4)",fontSize:"12px",lineHeight:"1.6",maxWidth:"200px"}}>{cur.desc}</p>
                      </div>
                      <div style={{flexShrink:0,textAlign:"center" as const,marginLeft:"16px"}}>
                        <p style={{color:"rgba(255,255,255,0.35)",fontSize:"9px",fontWeight:700,letterSpacing:"0.2em",marginBottom:"4px"}}>STRUCTURE DEPTH</p>
                        <p style={{color:"white",fontWeight:900,fontSize:"28px",lineHeight:1}}>{matScore}<span style={{color:"rgba(255,255,255,0.3)",fontSize:"12px"}}>%</span></p>
                        {prevScore7>0&&(<p style={{color:scoreDiff>=0?"#34d399":"#f87171",fontSize:"10px",fontWeight:700,marginTop:"3px"}}>{scoreDiff>=0?"+":""}{scoreDiff}% <span style={{color:"rgba(255,255,255,0.25)",fontWeight:400}}>7d</span></p>)}
                      </div>
                    </div>
                    <div style={{background:"rgba(255,255,255,0.06)",borderRadius:"99px",height:"5px",marginBottom:"16px",overflow:"hidden"}}>
                      <div style={{width:`${matScore}%`,background:`linear-gradient(90deg,${cur.color}80,${cur.color})`,borderRadius:"99px",height:"5px",boxShadow:`0 0 10px ${cur.color}60`}}/>
                    </div>
                    {/* STRUCTURE TYPE + MATURITY TREND */}
                    <div className="mat-grid-2col" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px",marginBottom:"16px"}}>
                      <div style={{background:"rgba(99,102,241,0.08)",border:"1px solid rgba(99,102,241,0.2)",borderRadius:"12px",padding:"12px"}}>
                        <p style={{color:"rgba(167,139,250,0.5)",fontSize:"9px",fontWeight:700,letterSpacing:"0.15em",marginBottom:"6px"}}>STRUCTURE TYPE</p>
                        <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"4px"}}>
                          <svg width="100" height="100" viewBox="0 0 120 110" style={{flexShrink:0}}>
                            {radarGrid.map((ring,ri)=>(
                              <polygon key={ri} points={ring.map(p=>`${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1"/>
                            ))}
                            <polygon points={radarPts.map(p=>`${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")} fill={`${cur.color}30`} stroke={cur.color} strokeWidth="1.5"/>
                            {radarPts.map((p,i)=>(<circle key={i} cx={p.x.toFixed(1)} cy={p.y.toFixed(1)} r="2.5" fill={cur.color}/>))}
                          </svg>
                          <div>
                            <p style={{color:"#a78bfa",fontSize:"12px",fontWeight:800,marginBottom:"3px"}}>{structureType}</p>
                            <p style={{color:"rgba(255,255,255,0.3)",fontSize:"10px",lineHeight:"1.5"}}>{structureDesc}</p>
                          </div>
                        </div>
                      </div>
                      <div style={{background:"rgba(99,102,241,0.05)",border:"1px solid rgba(99,102,241,0.15)",borderRadius:"12px",padding:"12px"}}>
                        <p style={{color:"rgba(167,139,250,0.5)",fontSize:"9px",fontWeight:700,letterSpacing:"0.15em",marginBottom:"6px"}}>MATURITY TREND</p>
                        <svg width="100%" height="80" viewBox={`0 0 ${gW} 80`} preserveAspectRatio="none">
                          <defs><linearGradient id="tg2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={cur.color} stopOpacity={0.35}/><stop offset="100%" stopColor={cur.color} stopOpacity={0}/></linearGradient></defs>
                          <path d={areaPath2} fill="url(#tg2)"/>
                          <polyline points={polyline2} fill="none" stroke={cur.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          {pts2.map((p,i)=>(
                            <g key={i}>
                              <circle cx={p.x.toFixed(1)} cy={p.y.toFixed(1)} r="3" fill={cur.color} stroke="#0f0c29" strokeWidth="1.5"/>
                              <text x={p.x.toFixed(1)} y={(p.y-7).toFixed(1)} textAnchor="middle" fill={cur.color} fontSize="7" fontWeight="700">{displayTrendPoints[i].val}%</text>
                              <text x={p.x.toFixed(1)} y="76" textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="7">{displayTrendPoints[i].label}</text>
                            </g>
                          ))}
                        </svg>
                        <div style={{display:"flex",justifyContent:"space-between",marginTop:"4px"}}>
                          <span style={{color:"rgba(255,255,255,0.3)",fontSize:"9px"}}>{displayTrendPoints[0].label}</span>
                          <span style={{color:scoreDiff>0?"#34d399":scoreDiff<0?"#f87171":"rgba(255,255,255,0.3)",fontSize:"9px",fontWeight:700}}>{scoreDiff>0?"+":""}{scoreDiff!==0?scoreDiff+"% 成長":"---"}</span>
                          <span style={{color:cur.color,fontSize:"9px",fontWeight:700}}>NOW</span>
                        </div>
                        <div style={{display:"flex",gap:"4px",marginTop:"6px",justifyContent:"center"}}>
                          {[30,90,180,300].map(d=>(
                            <button key={d} onClick={()=>setTrendDays(d)} style={{background:trendDays===d?`${cur.color}30`:"rgba(255,255,255,0.04)",border:`1px solid ${trendDays===d?cur.color:"rgba(255,255,255,0.1)"}`,borderRadius:"6px",color:trendDays===d?cur.color:"rgba(255,255,255,0.3)",fontSize:"9px",fontWeight:700,padding:"2px 7px",cursor:"pointer",transition:"all 0.2s"}}>
                              -{d}d
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    {/* COGNITIVE DEPTH BY DOMAIN + DOMAIN INSIGHT */}
                    <div style={{marginBottom:"16px"}}>
                      <p style={{color:"rgba(255,255,255,0.25)",fontSize:"9px",fontWeight:700,letterSpacing:"0.2em",marginBottom:"10px"}}>COGNITIVE DEPTH BY DOMAIN</p>
                      <div className="mat-grid-2col" style={{display:"grid",gridTemplateColumns:"1fr auto",gap:"10px"}}>
                        <div style={{display:"flex",flexDirection:"column" as const,gap:"6px"}}>
                          {depthBars.map(b=>(
                            <div key={b.label}>
                              <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                                <span style={{color:"rgba(255,255,255,0.35)",fontSize:"10px",fontWeight:600,width:"28px",flexShrink:0,textAlign:"right" as const}}>{b.label}</span>
                                <div style={{flex:1,background:"rgba(255,255,255,0.06)",borderRadius:"99px",height:"4px",overflow:"hidden"}}>
                                  <div style={{width:`${b.val}%`,background:b.color,borderRadius:"99px",height:"4px",boxShadow:`0 0 6px ${b.color}60`,transition:"width 0.8s ease"}}/>
                                </div>
                                <span style={{color:"rgba(255,255,255,0.25)",fontSize:"9px",width:"26px",flexShrink:0}}>{Math.round(b.val)}%</span>
                              </div>
                              {b.label==="未来" && (
                                <div style={{display:"flex",gap:"6px",marginLeft:"36px",marginTop:"4px",flexWrap:"wrap" as const}}>
                                  <span style={{fontSize:"8px",fontWeight:700,color:"#f472b6",letterSpacing:"0.08em",opacity:0.7}}>STRUCTURE QUALITY</span>
                                  <span style={{fontSize:"8px",color:"rgba(255,255,255,0.2)"}}>·</span>
                                  <span style={{fontSize:"8px",fontWeight:700,color:"#f472b6",letterSpacing:"0.08em",opacity:0.7}}>CAUSAL DEPTH</span>
                                  <span style={{fontSize:"8px",color:"rgba(255,255,255,0.2)"}}>·</span>
                                  <span style={{fontSize:"8px",fontWeight:700,color:"#f472b6",letterSpacing:"0.08em",opacity:0.7}}>SIMULATION REALISM</span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                        <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:"10px",padding:"10px",minWidth:"120px"}}>
                          <p style={{color:"rgba(255,255,255,0.25)",fontSize:"9px",fontWeight:700,letterSpacing:"0.15em",marginBottom:"8px"}}>DOMAIN INSIGHT</p>
                          {domainInsights.slice(0,4).map((ins,i)=>(
                            <div key={i} style={{display:"flex",alignItems:"flex-start",gap:"5px",marginBottom:"6px"}}>
                              <span style={{width:"6px",height:"6px",borderRadius:"50%",background:depthBars[i%depthBars.length].color,flexShrink:0,marginTop:"3px",display:"inline-block"}}/>
                              <span style={{color:"rgba(255,255,255,0.5)",fontSize:"10px",lineHeight:"1.5"}}>{ins}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    {/* STRUCTURE CHANGE LOG */}
                    {changeLogs.length>0&&(
                      <div style={{background:"rgba(52,211,153,0.04)",border:"1px solid rgba(52,211,153,0.15)",borderRadius:"10px",padding:"10px 12px",marginBottom:"16px"}}>
                        <p style={{color:"rgba(52,211,153,0.6)",fontSize:"9px",fontWeight:700,letterSpacing:"0.2em",marginBottom:"8px"}}>STRUCTURE CHANGE LOG</p>
                        <div style={{display:"flex",flexWrap:"wrap" as const,gap:"6px"}}>
                          {changeLogs.map((l,i)=>(
                            <span key={i} style={{background:"rgba(52,211,153,0.08)",border:"1px solid rgba(52,211,153,0.2)",borderRadius:"6px",padding:"3px 8px",color:"#34d399",fontSize:"11px",fontWeight:600,display:"flex",alignItems:"center",gap:"4px"}}>
                              <span style={{background:"rgba(52,211,153,0.15)",borderRadius:"4px",padding:"1px 5px",color:"#34d399",fontSize:"9px",fontWeight:800}}>{l.label}</span>{l.text}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* STRENGTH + UNLOCK NEXT */}
                    <div className="mat-grid-2col" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px",marginBottom:"16px"}}>
                      <div style={{background:"rgba(52,211,153,0.06)",border:"1px solid rgba(52,211,153,0.2)",borderRadius:"12px",padding:"12px"}}>
                        <p style={{color:"#34d399",fontSize:"10px",fontWeight:800,letterSpacing:"0.15em",marginBottom:"8px"}}>STRENGTH</p>
                        {strengths.slice(0,4).map((s,i)=>(
                          <div key={i} style={{display:"flex",alignItems:"flex-start",gap:"5px",marginBottom:"5px"}}>
                            <span style={{color:"#34d399",fontSize:"10px",flexShrink:0,marginTop:"1px"}}>{"\u25b6"}</span>
                            <span style={{color:"rgba(255,255,255,0.7)",fontSize:"11px",lineHeight:"1.5"}}>{s}</span>
                          </div>
                        ))}
                        <div style={{marginTop:"10px",display:"flex",alignItems:"center",gap:"8px"}}>
                          <svg width="56" height="56" viewBox="0 0 36 36">
                            <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3"/>
                            <circle cx="18" cy="18" r="15" fill="none" stroke={cur.color} strokeWidth="3"
                              strokeDasharray={`${2*Math.PI*15*strengthScore/100} ${2*Math.PI*15*(1-strengthScore/100)}`}
                              strokeLinecap="round" transform="rotate(-90 18 18)"
                              style={{boxShadow:`0 0 8px ${cur.color}`}}/>
                            <text x="18" y="23" textAnchor="middle" fill="white" fontSize="10" fontWeight="900">{strengthScore}%</text>
                          </svg>
                          <p style={{color:"rgba(255,255,255,0.3)",fontSize:"10px"}}>活用スコア</p>
                        </div>
                      </div>
                      <div style={{background:"rgba(251,191,36,0.06)",border:"1px solid rgba(251,191,36,0.2)",borderRadius:"12px",padding:"12px"}}>
                        <p style={{color:"#fbbf24",fontSize:"10px",fontWeight:800,letterSpacing:"0.15em",marginBottom:"8px"}}>UNLOCK NEXT</p>
                        {unlocks.slice(0,2).map((w,i)=>(
                          <div key={i} style={{marginBottom:"10px"}}>
                            <div style={{display:"flex",alignItems:"flex-start",gap:"5px",marginBottom:"5px"}}>
                              <span style={{color:"#fbbf24",fontSize:"10px",flexShrink:0,marginTop:"1px"}}>{"\u25b6"}</span>
                              <span style={{color:"rgba(255,255,255,0.7)",fontSize:"11px",lineHeight:"1.5"}}>{w.text}</span>
                            </div>
                            <button onClick={()=>{if(w.route.startsWith("__tab__"))switchTab(w.route.replace("__tab__","") as any);else router.push(w.route);}} style={{background:"rgba(251,191,36,0.12)",border:"1px solid rgba(251,191,36,0.3)",borderRadius:"6px",color:"#fbbf24",fontSize:"10px",fontWeight:700,cursor:"pointer",padding:"3px 8px",width:"100%"}}>{w.action}</button>
                          </div>
                        ))}
                        {unlocks.length===0&&<span style={{color:"rgba(255,255,255,0.4)",fontSize:"11px"}}>{"\u5168\u9818\u57df\u30ab\u30d0\u30fc\u6e08\u307f"}</span>}
                      </div>
                    </div>
                    {/* UNOPENED DOMAIN */}
                    {unopened.length>0&&(
                      <div style={{background:"rgba(239,68,68,0.04)",border:"1px solid rgba(239,68,68,0.15)",borderRadius:"10px",padding:"10px 12px",marginBottom:"16px"}}>
                        <p style={{color:"rgba(248,113,113,0.6)",fontSize:"9px",fontWeight:700,letterSpacing:"0.2em",marginBottom:"8px"}}>UNOPENED DOMAIN</p>
                        <div style={{display:"flex",gap:"6px",flexWrap:"wrap" as const}}>
                          {unopened.map((u,i)=>(
                            <div key={i} style={{background:"rgba(239,68,68,0.06)",border:`1px solid ${u.color}30`,borderRadius:"10px",padding:"8px 10px",minWidth:"90px"}}>
                              <p style={{color:u.color,fontSize:"11px",fontWeight:700,marginBottom:"2px"}}>{u.label}領域</p>
                              <p style={{color:"rgba(255,255,255,0.3)",fontSize:"9px",marginBottom:"2px"}}>使用頻度: <span style={{color:"#f87171"}}>{u.freq}</span></p>
                              <p style={{color:"rgba(255,255,255,0.4)",fontSize:"10px",lineHeight:"1.4",marginBottom:"6px"}}>{u.tip}</p>
                              <button onClick={()=>router.push(u.route)} style={{background:`${u.color}20`,border:`1px solid ${u.color}40`,borderRadius:"6px",color:u.color,fontSize:"10px",fontWeight:700,cursor:"pointer",padding:"3px 8px",width:"100%"}}>{u.action}</button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* NEXT ACTION */}
                    <div style={{background:`linear-gradient(135deg,${cur.color}15,rgba(99,102,241,0.08))`,border:`1px solid ${cur.color}30`,borderRadius:"12px",padding:"12px 14px",display:"flex",alignItems:"center",gap:"10px",marginBottom:"16px"}}>
                      <div style={{flex:1}}>
                        <p style={{color:"rgba(255,255,255,0.4)",fontSize:"9px",fontWeight:700,letterSpacing:"0.15em",marginBottom:"3px"}}>NEXT ACTION</p>
                        <p style={{color:cur.color,fontSize:"13px",fontWeight:700,lineHeight:"1.4"}}>{nad.text}</p>
                      </div>
                      <button onClick={()=>{
                        if(nad.tab) switchTab(nad.tab as any);
                        else if(nad.route) router.push(nad.route);
                      }} style={{background:cur.color,color:"#0f0c29",borderRadius:"10px",border:"none",padding:"8px 14px",fontSize:"12px",fontWeight:800,cursor:"pointer",flexShrink:0,whiteSpace:"nowrap" as const}}>
                        {"実行"} {"\u2192"}
                      </button>
                    </div>
                    {/* SYSTEM INTELLIGENCE */}
                    {(()=>{const si=(ma?.system_intelligence)||{};return si&&Object.keys(si).length>0?(
                    <div style={{marginTop:"18px",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"16px",padding:"14px",background:"rgba(255,255,255,0.02)"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"12px"}}>
                        <div>
                          <div style={{color:"rgba(255,255,255,0.45)",fontSize:"10px",fontWeight:700,letterSpacing:"0.18em"}}>SYSTEM INTELLIGENCE</div>
                          <div style={{color:"#fff",fontSize:"15px",fontWeight:800,marginTop:"4px"}}>{si.phase_label||"quality-integrated maturity"}</div>
                        </div>
                        <div style={{fontSize:"28px",fontWeight:900,color:"#7dd3fc"}}>{si.system_score||0}</div>
                      </div>
                      <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:"10px"}}>
                        {(([
                          ["QUALITY MATURITY","品質成熟度","RAG・CRM・LLMの利用品質を測定",si.quality_maturity],
                          ["SUCCESS MATURITY","成功成熟度","意思決定・実行・学習の成功率を測定",si.success_maturity],
                          ["ADOPTION MATURITY","採択成熟度","各機能を継続して使い続けているかを測定",si.adoption_maturity],
                          ["INTELLIGENCE MATURITY","知能成熟度","構造知能・矛盾検知・未来推論の深さを測定",si.intelligence_maturity],
                        ] as [string,string,string,number][])).map(([label,ja,tip,val])=>(
                          <div key={String(label)} style={{border:"1px solid rgba(255,255,255,0.06)",borderRadius:"12px",padding:"10px",background:"rgba(255,255,255,0.025)",position:"relative"}}>
                            <div style={{display:"flex",alignItems:"center",gap:"4px"}}>
                              <div style={{color:"rgba(255,255,255,0.42)",fontSize:"9px",fontWeight:700,letterSpacing:"0.14em"}}>{label}</div>
                              <div style={{position:"relative",display:"inline-block"}}
                                onMouseEnter={e=>{const t=e.currentTarget.querySelector('[data-tip]') as HTMLElement;if(t)t.style.display='block'}}
                                onMouseLeave={e=>{const t=e.currentTarget.querySelector('[data-tip]') as HTMLElement;if(t)t.style.display='none'}}
                              >
                                <span style={{color:"rgba(167,139,250,0.6)",fontSize:"10px",cursor:"pointer",fontWeight:800,padding:"0 2px"}}>?</span>
                                <div data-tip="" style={{display:"none",position:"absolute",bottom:"20px",left:"0",background:"rgba(15,12,41,0.97)",border:"1px solid rgba(167,139,250,0.3)",borderRadius:"8px",padding:"6px 10px",fontSize:"10px",color:"rgba(255,255,255,0.85)",whiteSpace:"nowrap",zIndex:50,lineHeight:"1.6",minWidth:"160px",pointerEvents:"none"}}>
                                  {tip}
                                </div>
                              </div>
                            </div>
                            <div style={{color:"rgba(255,255,255,0.55)",fontSize:"10px",fontWeight:600,marginTop:"2px"}}>{ja}</div>
                            <div style={{marginTop:"4px",color:"#fff",fontSize:"22px",fontWeight:900}}>{typeof val==="number"?val:0}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                    ):null;})()}
                    {/* フッター */}
                    <div style={{borderTop:"1px solid rgba(255,255,255,0.06)",paddingTop:"12px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                      <p style={{color:"rgba(255,255,255,0.2)",fontSize:"10px"}}>ASCENDを使うほど、あなたの思考構造は進化しています。次のステージへ。</p>
                      <button onClick={()=>switchTab("metrics")} style={{background:"none",border:"none",color:"rgba(167,139,250,0.5)",fontSize:"10px",cursor:"pointer",flexShrink:0,fontWeight:600}}>成熟度について</button>
                    </div>
                  </div>
                </div>
              );
            })()}
            {/* ランクカード */}
            <div style={{background:`linear-gradient(135deg,${C.primary},${C.primary2})`,borderRadius:"24px",boxShadow:C.shadowPrimary}} className="p-6 text-white">
              <p style={{color:"rgba(255,255,255,0.6)",letterSpacing:"0.12em",fontSize:"11px",fontWeight:700}} className="mb-1">RANK STATUS</p>
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
            <AdBanner position="mypage" />

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
                {([["🔬","現状課題診断","diagnosis",true],["🏗️","構造診断","structure",features.diag_structure===true],["🎯","課題仮説","issue",features.diag_issue===true],["⚖️","比較分析","comparison",features.diag_comparison===true],["⚡","矛盾検知","contradiction",features.diag_contradiction===true],["📋","実行計画","execution",features.diag_execution===true],["📈","投資シグナル","investment",features.diag_investment===true],["📊","会話の可視化","graph",features.diag_graph===true],["🧾","ファイル診断","file",features.diag_file===true],["📊","プレゼン資料","presentation",features.diag_presentation===true],["🔮","未来分岐シミュレーター","future",features.diag_future===true]] as [string,string,string,boolean][]).map(([icon,label,tab,enabled])=>(
                  <button key={tab} onClick={()=>{
                    if(!enabled){alert("この機能は現在ご利用いただけません。\nYs Consulting Officeにご連絡ください。");return;}
                    if(tab==="__presentation"){router.push("/mypage?tab=presentation");return;}
                    router.push(`/diagnosis?tab=${tab}`);
                  }} style={{background:enabled?"linear-gradient(135deg,rgba(99,102,241,0.35),rgba(139,92,246,0.35))":"rgba(100,100,100,0.06)",border:enabled?"1px solid rgba(139,92,246,0.7)":"1px solid rgba(100,100,100,0.15)",borderRadius:"8px",padding:"4px 10px",color:enabled?"#ffffff":"rgba(150,150,150,0.5)",fontSize:"12px",fontWeight:enabled?"700":"400",cursor:enabled?"pointer":"default",whiteSpace:"nowrap",opacity:enabled?1:0.4,boxShadow:enabled?"0 0 8px rgba(139,92,246,0.3)":"none"}}>{icon} {label}</button>
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
            <p className="text-xs text-center pb-1" style={{color:stats?.is_unlimited ? "#22c55e" : stats?.expires_at ? (new Date(stats.expires_at) < new Date() ? "#ef4444" : "#6b7280") : "#6b7280"}}>📅 {stats?.is_unlimited ? "無期限" : stats?.expires_at ? stats.expires_at.slice(0,10)+"まで" : "有効期限未設定"}</p>
            <div style={{background:"#f0f4ff",border:"1px solid #c7d2fe",borderRadius:"10px",padding:"10px 14px",marginBottom:"8px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div>
                <div style={{fontSize:"11px",color:"#6b7280",marginBottom:"2px"}}>現在のプラン</div>
                <div style={{fontSize:"14px",fontWeight:700,color:"#4f46e5"}}>
                  {{"starter":"STARTER（無料）","standard":"STANDARD","pro":"PRO","apex":"APEX","ultra_admin":"ULTRA管理者","ultra_member":"ULTRAメンバー"}[currentPlan] || "未設定"}
                </div>
              </div>
              <button onClick={()=>router.push("/plan")} style={{background:"#4f46e5",color:"#fff",border:"none",borderRadius:"8px",padding:"6px 12px",fontSize:"12px",fontWeight:700,cursor:"pointer"}}>
                詳細 →
              </button>
            </div>
            <button onClick={()=>router.push("/plan")} className="w-full text-xs py-2 transition-colors" style={{color:"#4f46e5",textDecoration:"underline",background:"none",border:"none",cursor:"pointer"}}>
              📦 プランガイドを見る
            </button>
            <button onClick={()=>{logout();router.push("/");}} className="w-full text-xs py-3 transition-colors" style={{color:C.textMuted}}>ログアウト</button>
          </div>
        )}

        {/* Decision Metrics */}
        {tab==="metrics" && (
          <div style={{display:"flex",flexDirection:"column" as const,gap:"16px"}}>
            {dm ? (
              <>
                <div style={{background:"linear-gradient(135deg,#080612,#1a1035,#0d1225)",borderRadius:"20px",overflow:"hidden",boxShadow:"0 20px 60px rgba(0,0,0,0.5)",border:"1px solid rgba(255,255,255,0.06)"}}>
                  <div style={{padding:"28px 28px 24px"}}>
                    <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"20px"}}>
                      <div style={{width:"3px",height:"18px",background:"linear-gradient(180deg,#a78bfa,#6366f1)",borderRadius:"2px"}}/>
                      <p style={{color:"rgba(167,139,250,0.7)",fontSize:"10px",letterSpacing:"0.25em",fontWeight:800}}>DECISION INTELLIGENCE MATRIX</p>
                    </div>
                    <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:"24px"}}>
                      <div style={{flex:1}}>
                        <h2 style={{color:"white",fontWeight:900,fontSize:"22px",marginBottom:"6px",letterSpacing:"-0.02em"}}>意思決定精度診断</h2>
                        <p style={{color:"rgba(255,255,255,0.35)",fontSize:"13px",lineHeight:1.6}}>
                          {Number(dm.diagnosis_total_score||0)>=80?"全指標が高水準で安定しています":Number(dm.diagnosis_total_score||0)>=65?"複数の指標に改善余地があります":Number(dm.diagnosis_total_score||0)>=50?"重点的な強化が必要な指標があります":"判断構造に根本的な課題があります"}
                        </p>
                      </div>
                      <div style={{flexShrink:0,marginLeft:"20px",textAlign:"center" as const}}>
                        <div style={{
                          background:String(dm.diagnosis_rank||"C")==="S"?"linear-gradient(135deg,#fbbf24,#f59e0b,#ef4444)":String(dm.diagnosis_rank||"C").startsWith("A")?"linear-gradient(135deg,#818cf8,#6366f1,#4f46e5)":String(dm.diagnosis_rank||"C").startsWith("B")?"linear-gradient(135deg,#38bdf8,#0891b2,#0e7490)":"linear-gradient(135deg,#94a3b8,#64748b,#475569)",
                          borderRadius:"16px",width:"64px",height:"64px",display:"flex",alignItems:"center",justifyContent:"center",
                          boxShadow:String(dm.diagnosis_rank||"C")==="S"?"0 8px 32px rgba(251,191,36,0.4)":String(dm.diagnosis_rank||"C").startsWith("A")?"0 8px 32px rgba(99,102,241,0.4)":String(dm.diagnosis_rank||"C").startsWith("B")?"0 8px 32px rgba(8,145,178,0.4)":"0 8px 32px rgba(100,116,139,0.3)"
                        }}>
                          <span style={{color:"white",fontWeight:900,fontSize:"28px"}}>{String(dm.diagnosis_rank||"C")}</span>
                        </div>
                        <p style={{color:"rgba(255,255,255,0.25)",fontSize:"10px",marginTop:"6px",letterSpacing:"0.2em",fontWeight:700}}>RANK</p>
                      </div>
                    </div>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"8px"}}>
                      <span style={{color:"rgba(255,255,255,0.3)",fontSize:"11px",fontWeight:700,letterSpacing:"0.15em"}}>TOTAL SCORE</span>
                      <span style={{color:"white",fontWeight:900,fontSize:"24px"}}>{Number(dm.diagnosis_total_score||0).toFixed(1)}<span style={{color:"rgba(255,255,255,0.3)",fontSize:"14px"}}> / 100</span></span>
                    </div>
                    <div style={{background:"rgba(255,255,255,0.06)",borderRadius:"99px",height:"6px",overflow:"hidden"}}>
                      <div style={{
                        width:`${Math.min(Number(dm.diagnosis_total_score||0),100)}%`,
                        background:Number(dm.diagnosis_total_score||0)>=80?"linear-gradient(90deg,#059669,#10b981,#34d399)":Number(dm.diagnosis_total_score||0)>=65?"linear-gradient(90deg,#0891b2,#06b6d4,#38bdf8)":Number(dm.diagnosis_total_score||0)>=50?"linear-gradient(90deg,#d97706,#f59e0b,#fbbf24)":"linear-gradient(90deg,#dc2626,#ef4444,#f87171)",
                        borderRadius:"99px",height:"6px",transition:"width 1s ease",
                        boxShadow:Number(dm.diagnosis_total_score||0)>=80?"0 0 12px rgba(52,211,153,0.6)":Number(dm.diagnosis_total_score||0)>=65?"0 0 12px rgba(56,189,248,0.6)":Number(dm.diagnosis_total_score||0)>=50?"0 0 12px rgba(251,191,36,0.6)":"0 0 12px rgba(248,113,113,0.6)"
                      }}/>
                    </div>
                  </div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px"}}>
                  {([
                    ["Q","意思決定精度",dm.decision_quality_score,"構造的思考による判断の質","構造キーワードを意識して問いを設計し直す","#818cf8","#6366f1"],
                    ["R","リスク耐性",dm.risk_tolerance,"リスクを定量化し許容する能力","失敗条件・撤退基準を毎回明示する","#38bdf8","#0891b2"],
                    ["S","構造理解",dm.structural_intelligence,"問題の本質と因果を把握する力","問題を「原因・構造・影響」の3層で分解する","#34d399","#059669"],
                    ["V","判断速度",dm.decision_velocity,"適切なスピードで決断する能力","選択肢を2〜3に絞り、判断軸を事前に定義する","#fbbf24","#d97706"],
                    ["P","予測精度",dm.prediction_accuracy,"継続的な利用から算出される精度","利用頻度を週3回以上に増やす","#f472b6","#db2777"],
                    ["E","実行一貫性",dm.execution_consistency,"判断と行動の整合性・一貫性","前回の判断を振り返り、実行状況を報告してから次の相談をする","#a78bfa","#7c3aed"],
                  ] as [string,string,unknown,string,string,string,string][]).map(([k,l,v,desc,tip,c1,c2])=>{
                    const val = Number(v);
                    const isLow = val < 65;
                    const lb = val>=80?"HIGH":val>=65?"MID":val>=50?"LOW":"CRITICAL";
                    const lbBg = val>=80?"rgba(5,150,105,0.15)":val>=65?"rgba(8,145,178,0.15)":val>=50?"rgba(217,119,6,0.15)":"rgba(220,38,38,0.15)";
                    const lbTc = val>=80?"#10b981":val>=65?"#06b6d4":val>=50?"#f59e0b":"#f87171";
                    return (
                      <div key={k} style={{background:"linear-gradient(135deg,#0f0c29,#1a1535)",border:`1px solid ${c1}25`,borderRadius:"16px",padding:"16px",boxShadow:"0 4px 24px rgba(0,0,0,0.3)",position:"relative" as const,overflow:"hidden"}}>
                        <div style={{position:"absolute" as const,top:0,right:0,width:"60px",height:"60px",background:`radial-gradient(circle at top right,${c1}20,transparent)`,pointerEvents:"none" as const}}/>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"12px"}}>
                          <div style={{width:"36px",height:"36px",borderRadius:"10px",background:`linear-gradient(135deg,${c1}30,${c2}20)`,border:`1px solid ${c1}40`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                            <span style={{color:c1,fontWeight:900,fontSize:"14px"}}>{k}</span>
                          </div>
                          <div style={{textAlign:"right" as const}}>
                            <p style={{color:"white",fontWeight:900,fontSize:"22px",lineHeight:1}}>{val.toFixed(0)}</p>
                            <span style={{background:lbBg,color:lbTc,fontSize:"9px",fontWeight:800,padding:"2px 6px",borderRadius:"4px",letterSpacing:"0.1em"}}>{lb}</span>
                          </div>
                        </div>
                        <p style={{color:"rgba(255,255,255,0.85)",fontWeight:700,fontSize:"13px",marginBottom:"3px"}}>{l}</p>
                        <p style={{color:"rgba(255,255,255,0.3)",fontSize:"11px",marginBottom:"10px",lineHeight:1.4}}>{desc}</p>
                        <div style={{background:"rgba(255,255,255,0.06)",borderRadius:"99px",height:"4px",marginBottom:"10px"}}>
                          <div style={{width:`${Math.min(val,100)}%`,background:`linear-gradient(90deg,${c2},${c1})`,borderRadius:"99px",height:"4px",boxShadow:`0 0 8px ${c1}60`}}/>
                        </div>
                        <div style={{background:`${c1}12`,border:`1px solid ${c1}25`,borderRadius:"8px",padding:"8px 10px"}}>
                          <p style={{color:"rgba(255,255,255,0.35)",fontSize:"9px",fontWeight:700,letterSpacing:"0.1em",marginBottom:"3px"}}>IMPROVEMENT</p>
                          <p style={{color:c1,fontSize:"11px",lineHeight:1.5,fontWeight:600}}>{tip}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:"14px",padding:"14px 20px"}}>
                  <p style={{color:C.textMuted,fontSize:"12px",textAlign:"center" as const,lineHeight:1.8}}>
                    スコアは直近60件のチャット履歴から算出されます。<br/>
                    入力の質・継続頻度・語彙の構造性がすべての指標に影響します。
                  </p>
                </div>
              </>
            ) : <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:"20px",padding:"48px",textAlign:"center" as const}}><p style={{color:C.textMuted}}>診断データがありません。チャットを重ねると計算されます。</p></div>}
          </div>
        )}
        {tab==="fc" && (
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:"24px",boxShadow:C.shadowMd}} className="p-6">
            <h2 className="text-lg font-black mb-4" style={{color:C.textMain}}>🧠 固定概念レポート</h2>
            {fcData.report && fcCount >= fcThreshold
              ? <div className="prose prose-sm max-w-none" style={{color:C.textMain}}><ReactMarkdown>{String(fcData.report.report_text||JSON.stringify(fcData.report,null,2))}</ReactMarkdown></div>
              : <div className="text-center py-12">
                  <p className="text-4xl mb-4">🔒</p>
                  <p className="font-bold mb-2" style={{color:C.textMain}}>レポート未解放</p>
                  <p className="text-sm" style={{color:C.textMuted}}>あと {fcThreshold-fcCount} 回のRAG採用で解放されます</p>
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
              <p style={{color:"rgba(255,255,255,0.8)",fontSize:"14px"}}>現在のランクから次のランクへ上がるための戦略と行動指針</p>
            </div>
            {(()=>{
              const _rnames = stats.rank_cfg ? [stats.rank_cfg.rank_1_name,stats.rank_cfg.rank_2_name,stats.rank_cfg.rank_3_name,stats.rank_cfg.rank_4_name] : ["1段目","2段目","3段目","4段目"];
              const _ci = _rnames.indexOf(stats.rank_name);
              return (
                <div className="flex gap-2 flex-wrap">
                  {_rnames.map((rn,i)=>(
                    <div key={i} style={{background:i===_ci?`linear-gradient(135deg,${C.primary},${C.primary2})`:"rgba(0,0,0,0.04)",border:i===_ci?"none":`1px solid ${C.border}`,borderRadius:"10px",padding:"6px 16px",fontSize:"13px",fontWeight:700,color:i===_ci?"white":C.textMuted}}>
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
                              <span style={{color,fontWeight:700,fontSize:"13px",flexShrink:0,marginTop:"3px"}}>▶</span>
                              <p style={{color:C.textSub,fontSize:"14px",lineHeight:"1.7"}}>{renderText(clean)}</p>
                            </div>
                          );
                          return <p key={j} style={{color:C.textSub,fontSize:"14px",lineHeight:"1.8",marginBottom:"4px"}}>{renderText(clean)}</p>;
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
              <p style={{color:"rgba(255,255,255,0.8)",fontSize:"14px"}}>
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
                                <span style={{color,fontWeight:700,fontSize:"13px",flexShrink:0,marginTop:"3px"}}>▶</span>
                                <p style={{color:C.textSub,fontSize:"14px",lineHeight:"1.7"}}>{renderText(clean)}</p>
                              </div>
                            );
                            return <p key={j} style={{color:C.textSub,fontSize:"14px",lineHeight:"1.8",marginBottom:"4px"}}>{renderText(clean)}</p>;
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
              <p className="text-xs" style={{color:C.textMuted}}>有効期限: {stats?.is_unlimited ? "無期限" : stats?.expires_at ? stats.expires_at.slice(0,10) + " まで" : "設定なし"}</p>
              <p className="text-xs" style={{color:C.textMuted}}>UID: {uid}</p>
            </div>
            <button onClick={()=>{logout();router.push("/");}} style={{background:"rgba(239,68,68,0.06)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:"16px",color:"#ef4444"}} className="w-full py-3 text-sm font-medium transition-all hover:bg-red-50">
              セッションをクリアしてログアウト
            </button>
          </div>
        )}

        {/* プレゼン資料 */}
        {tab==="presentation" && (
          <PresentationTool />
        )}
        {tab==="notifications" && (
          <div className="space-y-3">
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:"16px",boxShadow:C.shadow}} className="p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-bold" style={{color:C.textMain}}>🔔 通知一覧</p>
                {notifUnread>0&&(
                  <button onClick={async()=>{
                    await markAllNotificationsRead();
                    setNotifications(prev=>prev.map(n=>({...n,read:true})));
                    setNotifUnread(0);
                  }} style={{fontSize:"11px",color:C.primary,background:"none",border:`1px solid ${C.borderPrimary}`,borderRadius:"8px",padding:"3px 10px",cursor:"pointer",fontWeight:600}}>
                    すべて既読にする
                  </button>
                )}
              </div>
              {notifications.length===0?(
                <p style={{color:C.textMuted,fontSize:"13px",textAlign:"center",padding:"24px 0"}}>通知はありません</p>
              ):(
                <div className="space-y-2">
                  {notifications.map(n=>(
                    <div key={n.notif_id} onClick={async()=>{
                      if(!n.read){
                        await markNotificationRead(n.notif_id);
                        setNotifications(prev=>prev.map(x=>x.notif_id===n.notif_id?{...x,read:true}:x));
                        setNotifUnread(prev=>Math.max(0,prev-1));
                      }
                      const externalTabMap: Record<string,string> = {
                        crm: "/diagnosis?tab=crm",
                      };
                      const internalTabMap: Record<string,Tab> = {
                        dm:"dm", fc:"fc", rankup:"rankup", overview:"overview",
                      };
                      if(externalTabMap[n.link_tab]){
                        router.push(externalTabMap[n.link_tab]);
                      } else {
                        const dest = internalTabMap[n.link_tab] || "overview";
                        switchTab(dest);
                      }
                    }} style={{
                      background:n.read?"rgba(0,0,0,0.02)":"rgba(79,70,229,0.06)",
                      border:n.read?`1px solid ${C.border}`:`1px solid ${C.borderPrimary}`,
                      borderRadius:"12px",padding:"12px 14px",cursor:"pointer",transition:"all 0.15s"
                    }}>
                      <div className="flex items-start justify-between gap-2">
                        <div style={{flex:1}}>
                          <p style={{fontSize:"13px",fontWeight:n.read?400:700,color:C.textMain,marginBottom:"2px"}}>{n.title}</p>
                          <p style={{fontSize:"11px",color:C.textSub}}>{n.body}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          {!n.read&&<span style={{background:`linear-gradient(135deg,${C.primary},${C.primary2})`,color:"white",borderRadius:"99px",fontSize:"9px",fontWeight:900,padding:"1px 7px"}}>NEW</span>}
                          <span style={{fontSize:"9px",color:C.textMuted,whiteSpace:"nowrap"}}>{n.created_at?.slice(0,16)||""}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
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
                  {key:"notify_priority_action",label:"🚨 今日の優先アクション通知"},
                ] as {key:keyof typeof settings;label:string}[]).map(item=>(
                  <div key={item.key}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm" style={{color:C.textSub}}>{item.label}</span>
                      <button onClick={()=>setSettings(s=>({...s,[item.key]:!s[item.key]}))}
                        style={{background:settings[item.key]?`linear-gradient(135deg,${C.primary},${C.primary2})`:"rgba(0,0,0,0.08)",borderRadius:"99px",width:"44px",height:"24px",position:"relative",transition:"all 0.2s",boxShadow:settings[item.key]?C.shadowPrimary:"none",border:"none",cursor:"pointer"}}>
                        <span style={{position:"absolute",top:"3px",left:settings[item.key]?"23px":"3px",width:"18px",height:"18px",borderRadius:"50%",background:"#fff",transition:"all 0.2s",boxShadow:"0 1px 3px rgba(0,0,0,0.2)",display:"block"}}/>
                      </button>
                    </div>
                    {item.key==="notify_priority_action"&&settings.notify_priority_action&&(
                      <div style={{marginTop:"8px",display:"flex",alignItems:"center",gap:"8px",paddingLeft:"4px"}}>
                        <span className="text-xs" style={{color:C.textMuted}}>通知時刻</span>
                        <select value={settings.priority_action_time as string} onChange={e=>setSettings(s=>({...s,priority_action_time:e.target.value}))}
                          style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:"8px",padding:"4px 8px",fontSize:"12px",color:C.textMain}}>
                          {Array.from({length:16},(_,i)=>i+6).map(h=>(
                            ["00","30"].map(m=>(
                              <option key={`${h}:${m}`} value={`${String(h).padStart(2,"0")}:${m}`}>{String(h).padStart(2,"0")}:{m}</option>
                            ))
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <button onClick={async()=>{
                await saveNotificationSettings({
                  notify_reply: settings.notify_reply,
                  notify_rankup: settings.notify_rankup,
                  notify_fc: settings.notify_fc,
                  notify_inquiry: settings.notify_inquiry,
                  notify_priority_action: settings.notify_priority_action,
                  priority_action_time: settings.priority_action_time,
                } as Record<string,boolean|string>);
                setCustomPromptSaved(true);
                setTimeout(()=>setCustomPromptSaved(false),2000);
              }} style={{marginTop:"16px",background:`linear-gradient(135deg,${C.primary},${C.primary2})`,borderRadius:"14px",boxShadow:C.shadowPrimary,width:"100%",border:"none",cursor:"pointer"}} className="text-white font-bold py-3 text-sm hover:opacity-90 transition-all">
                {customPromptSaved ? "✅ 通知設定を保存しました" : "💾 通知設定を保存"}
              </button>
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
                  <div key={item.key}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm" style={{color:C.textSub}}>{item.label}</span>
                      <button onClick={()=>setSettings(s=>({...s,[item.key]:!s[item.key]}))}
                        style={{background:settings[item.key]?`linear-gradient(135deg,${C.primary},${C.primary2})`:"rgba(0,0,0,0.08)",borderRadius:"99px",width:"44px",height:"24px",position:"relative",transition:"all 0.2s",boxShadow:settings[item.key]?C.shadowPrimary:"none",border:"none",cursor:"pointer"}}>
                        <span style={{position:"absolute",top:"3px",left:settings[item.key]?"23px":"3px",width:"18px",height:"18px",borderRadius:"50%",background:"#fff",transition:"all 0.2s",boxShadow:"0 1px 3px rgba(0,0,0,0.2)",display:"block"}}/>
                      </button>
                    </div>
                    {item.key==="notify_priority_action"&&settings.notify_priority_action&&(
                      <div style={{marginTop:"8px",display:"flex",alignItems:"center",gap:"8px",paddingLeft:"4px"}}>
                        <span className="text-xs" style={{color:C.textMuted}}>通知時刻</span>
                        <select value={settings.priority_action_time as string} onChange={e=>setSettings(s=>({...s,priority_action_time:e.target.value}))}
                          style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:"8px",padding:"4px 8px",fontSize:"12px",color:C.textMain}}>
                          {Array.from({length:16},(_,i)=>i+6).map(h=>(
                            ["00","30"].map(m=>(
                              <option key={`${h}:${m}`} value={`${String(h).padStart(2,"0")}:${m}`}>{String(h).padStart(2,"0")}:{m}</option>
                            ))
                          ))}
                        </select>
                      </div>
                    )}
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
                  style={{background:`rgba(79,70,229,0.06)`,border:`1px solid ${C.borderPrimary}`,borderRadius:"10px",color:C.primary,padding:"6px 12px",fontSize:"14px"}}>
                  <option value="core">SWIFT（迅速）</option>
                  {ultraEnabled && <option value="ultra">ADVANCE（高度）</option>}
                  {apexEnabled && <option value="apex">SUPREME（至高）</option>}
                </select>
              </div>
            </div>
            {/* カスタムプロンプト */}
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:"16px",boxShadow:C.shadow}} className="p-5 space-y-3">
              <p className="text-sm font-bold" style={{color:C.textMain}}>💬 カスタムプロンプト</p>
              <p className="text-xs" style={{color:C.textMuted}}>AIへの個別指示を追加できます。</p>
              {currentPlan==="ultra_member" && (
                <div style={{display:"flex",alignItems:"center",gap:"8px",padding:"8px 10px",background:"rgba(79,70,229,0.06)",borderRadius:"10px",border:"1px solid rgba(79,70,229,0.15)"}}>
                  <input type="checkbox" id="useAdminCustomPrompt" checked={useAdminSettings}
                    onChange={async e=>{
                      const checked = e.target.checked;
                      setUseAdminSettings(checked);
                      if(checked){
                        const adminSettings = await getAdminAiSettings();
                        setAiDescription(adminSettings.ai_description||"");
                        setAiStartersText((adminSettings.conversation_starters||[]).join("\n"));
                      }
                    }}
                    style={{width:"16px",height:"16px",cursor:"pointer",accentColor:"#4f46e5"}}/>
                  <label htmlFor="useAdminCustomPrompt" className="text-xs" style={{color:"#4f46e5",fontWeight:600,cursor:"pointer"}}>
                    管理者のカスタムプロンプトを使用する
                  </label>
                </div>
              )}
              <select value={customPromptMode} onChange={e=>setCustomPromptMode(e.target.value)}
                style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:"10px",padding:"6px 10px",fontSize:"13px",color:C.textMain,width:"100%"}}>
                <option value="append">追記（システムプロンプトに追加）</option>
                <option value="replace">置換（完全に置き換え）</option>
              </select>
              <textarea value={customPrompt} onChange={e=>setCustomPrompt(e.target.value)}
                rows={4} placeholder="例: 回答は必ず箇条書きで、結論から述べること。"
                style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:"12px",padding:"10px",fontSize:"13px",color:C.textMain,width:"100%",resize:"vertical"}}/>
              <button onClick={async()=>{
                await saveCustomPrompt(customPrompt, customPromptMode);
                setCustomPromptSaved(true);
                setTimeout(()=>setCustomPromptSaved(false),2000);
              }} style={{background:`linear-gradient(135deg,${C.primary},${C.primary2})`,borderRadius:"12px",boxShadow:C.shadowPrimary,width:"100%",border:"none",cursor:"pointer"}} className="text-white font-bold py-2.5 text-sm hover:opacity-90 transition-all">
                {customPromptSaved ? "✅ 保存しました" : "💾 保存する"}
              </button>
            </div>
            {/* AI設定（APEX/ULTRA限定） */}
            {(currentPlan==="apex"||currentPlan==="ultra_member"||currentPlan==="ultra_admin") && (
              <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:"16px",boxShadow:C.shadow}} className="p-5 space-y-3">
                <p className="text-sm font-bold" style={{color:C.textMain}}>🤖 ユーザー専用AI設定</p>
                <p className="text-xs" style={{color:C.textMuted}}>APEX/ULTRAプラン限定。このアカウント専用のAI設定を行います。</p>
                {currentPlan==="ultra_member" && (
                  <div style={{display:"flex",alignItems:"center",gap:"8px",padding:"8px 10px",background:"rgba(79,70,229,0.06)",borderRadius:"10px",border:"1px solid rgba(79,70,229,0.15)"}}>
                    <input type="checkbox" id="useAdminSettings" checked={useAdminSettings} onChange={async e=>{
                      const checked = e.target.checked;
                      setUseAdminSettings(checked);
                      if(checked){
                        const adminSettings = await getAdminAiSettings();
                        setAiDescription(adminSettings.ai_description||"");
                        setAiStartersText((adminSettings.conversation_starters||[]).join("\n"));
                      }
                    }}
                      style={{width:"16px",height:"16px",cursor:"pointer",accentColor:"#4f46e5"}}/>
                    <label htmlFor="useAdminSettings" className="text-xs" style={{color:"#4f46e5",fontWeight:600,cursor:"pointer"}}>
                      管理者のAI設定を使用する
                    </label>
                  </div>
                )}
                <div>
                  <p className="text-xs font-bold mb-1" style={{color:C.textSub}}>説明</p>
                  <input value={aiDescription} onChange={e=>setAiDescription(e.target.value)}
                    placeholder="例：このAIの用途・役割を入力してください"
                    style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:"10px",padding:"8px 10px",fontSize:"13px",color:C.textMain,width:"100%"}}/>
                </div>
                <div>
                  <p className="text-xs font-bold mb-1" style={{color:C.textSub}}>会話のきっかけ（1行1件・最大4件）</p>
                  <textarea value={aiStartersText} onChange={e=>setAiStartersText(e.target.value)}
                    rows={4} placeholder={"例：\n売上分析\n競合比較\n戦略立案"}
                    style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:"10px",padding:"8px 10px",fontSize:"13px",color:C.textMain,width:"100%",resize:"vertical"}}/>
                </div>
                {useAdminSettings && currentPlan==="ultra_member" && (
                  <div>
                    <p className="text-xs font-bold mb-1" style={{color:C.textSub}}>追加指示（管理者設定に追記）</p>
                    <textarea value={memberExtraPrompt} onChange={e=>setMemberExtraPrompt(e.target.value)}
                      rows={3} placeholder={"例：\n敬語で話してください\n返答は短くまとめてください"}
                      style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:"10px",padding:"8px 10px",fontSize:"13px",color:C.textMain,width:"100%",resize:"vertical"}}/>
                  </div>
                )}
                <button onClick={async()=>{
                  const starters = aiStartersText.split("\n").map(s=>s.trim()).filter(Boolean).slice(0,4);
                  await saveUserAiSettings(aiDescription, starters, useAdminSettings, memberExtraPrompt);
                  setAiStarters(starters);
                  setAiSettingsSaved(true);
                  setTimeout(()=>setAiSettingsSaved(false),2000);
                }} style={{background:`linear-gradient(135deg,${C.primary},${C.primary2})`,borderRadius:"12px",boxShadow:C.shadowPrimary,width:"100%",border:"none",cursor:"pointer"}} className="text-white font-bold py-2.5 text-sm hover:opacity-90 transition-all">
                  {aiSettingsSaved ? "✅ 保存しました" : "💾 AI設定を保存"}
                </button>
                <div>
                  <div style={{background:"rgba(79,70,229,0.04)",border:"1px solid rgba(79,70,229,0.15)",borderRadius:"12px",padding:"14px 16px",marginBottom:"8px"}} className="space-y-2">
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                      <p className="text-xs font-bold" style={{color:"#4f46e5"}}>🔍 ソース検証ログ</p>
                      <button onClick={async()=>{
                        setSrcLoading(true);
                        const {getRecentSourceHistory} = await import("@/lib/api");
                        const h = await getRecentSourceHistory();
                        setSourceHistory(h);
                        setSrcLoading(false);
                      }} style={{background:"rgba(79,70,229,0.1)",border:"1px solid rgba(79,70,229,0.25)",borderRadius:"6px",color:"#4f46e5",fontSize:"11px",fontWeight:600,cursor:"pointer",padding:"3px 8px"}}>
                        {srcLoading ? "読込中..." : "更新"}
                      </button>
                    </div>
                    {sourceHistory.length===0 && <p className="text-xs" style={{color:"#888"}}>「更新」を押してソース履歴を読み込んでください</p>}
                    {sourceHistory.length>0 && (
                      <div>
                        <p className="text-xs" style={{color:"#888",marginBottom:"6px"}}>ナレッジヒット: {sourceHistory.filter(sc=>sc.is_retrieved).length} / {sourceHistory.length} 件</p>
                        <div className="space-y-1" style={{maxHeight:"200px",overflowY:"auto"}}>
                          {sourceHistory.slice(0,10).map((sc,i)=>(
                            <div key={i} style={{display:"flex",alignItems:"flex-start",gap:"6px",padding:"4px 6px",background:sc.is_retrieved?"rgba(5,150,105,0.06)":"rgba(239,68,68,0.06)",border:"1px solid "+(sc.is_retrieved?"rgba(5,150,105,0.2)":"rgba(239,68,68,0.2)"),borderRadius:"6px"}}>
                              <span style={{fontSize:"10px",fontWeight:700,color:sc.is_retrieved?"#059669":"#ef4444",flexShrink:0,marginTop:"1px"}}>{sc.is_retrieved?"✓ ヒット":"✗ 不足"}</span>
                              <div style={{flex:1,minWidth:0}}>
                                <p style={{fontSize:"11px",color:"#666",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{sc.text}</p>
                                <p style={{fontSize:"10px",color:"#999"}}>score: {sc.score.toFixed(3)}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                <div style={{background:"rgba(79,70,229,0.04)",border:"1px solid rgba(79,70,229,0.15)",borderRadius:"12px",padding:"14px 16px",marginBottom:"8px"}} className="space-y-3">
                  <p className="text-xs font-bold" style={{color:"#4f46e5"}}>📡 RAG検索設定</p>
                  <div>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:"4px"}}>
                      <p className="text-xs font-bold" style={{color:C.textSub}}>類似度閾値（threshold）</p>
                      <span className="text-xs font-bold" style={{color:"#4f46e5"}}>{ragThreshold.toFixed(2)}</span>
                    </div>
                    <input type="range" min={0.10} max={0.90} step={0.01} value={ragThreshold}
                      onChange={e=>setRagThreshold(parseFloat(e.target.value))}
                      style={{width:"100%",accentColor:"#4f46e5"}} />
                    <p className="text-xs" style={{color:C.textMuted}}>低いほど広く検索。高いほど厳密にマッチ</p>
                  </div>
                  <div>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:"4px"}}>
                      <p className="text-xs font-bold" style={{color:C.textSub}}>取得件数（top_k）</p>
                      <span className="text-xs font-bold" style={{color:"#4f46e5"}}>{ragTopK}件</span>
                    </div>
                    <input type="range" min={1} max={20} step={1} value={ragTopK}
                      onChange={e=>setRagTopK(parseInt(e.target.value))}
                      style={{width:"100%",accentColor:"#4f46e5"}} />
                  </div>
                  <button onClick={async()=>{ await saveRagSettings(ragThreshold, ragTopK); setRagSaved(true); setTimeout(()=>setRagSaved(false),2000); }}
                    style={{background:"linear-gradient(135deg,#4f46e5,#7c3aed)",borderRadius:"10px",border:"none",cursor:"pointer",width:"100%",padding:"8px 0"}}
                    className="text-white font-bold text-xs">
                    {ragSaved ? "✅ 保存しました" : "💾 RAG設定を保存"}
                  </button>
                </div>
                  <p className="text-xs font-bold mb-2" style={{color:C.textSub}}>知識ファイル</p>
                  {knowledgeFiles.length===0 && <p className="text-xs" style={{color:C.textMuted}}>知識ファイルはまだありません。</p>}
                  {knowledgeFiles.map(kf=>(
                    <div key={kf.source_id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${C.border}`}}>
                      <span style={{fontSize:"11px",color:"#888",marginLeft:"4px"}}>{kf.chunks}チャンク / サマリー{kf.summaries}件</span>
                      <span className="text-xs" style={{color:C.textMain}}>📄 {kf.title}</span>
                      <button onClick={async()=>{
                        await deleteUserKnowledge(kf.source_id);
                        setKnowledgeFiles(prev=>prev.filter(f=>f.source_id!==kf.source_id));
                      }} style={{background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:"6px",color:"#ef4444",fontSize:"11px",fontWeight:600,cursor:"pointer",padding:"2px 8px"}}>
                        🗑️
                      </button>
                    </div>
                  ))}
                  <label
                    style={{display:"block",marginTop:"8px",background:`rgba(79,70,229,0.08)`,border:`1px dashed ${C.borderPrimary}`,borderRadius:"10px",padding:"16px",textAlign:"center",cursor:knowledgeUploading?"not-allowed":"pointer"}}
                    onDragOver={e=>{e.preventDefault();e.stopPropagation();}}
                    onDrop={async e=>{
                      e.preventDefault();e.stopPropagation();
                      if(knowledgeUploading) return;
                      const allFiles = Array.from(e.dataTransfer.files);
              const existingNames = new Set(knowledgeFiles.map((kf:any)=>kf.title?.replace(/^会話要約: /,"")||kf.source_id||""));
              const files = allFiles.filter((f:File)=>!existingNames.has(f.name)).slice(0, 99 - knowledgeFiles.length);
              if(allFiles.length !== files.length){ alert(`重複ファイルをスキップしました（${allFiles.length - files.length}件）`); }
                      if(!files.length) return;
                      setKnowledgeUploading(true);
                      setKnowledgeProgress({current:0,total:files.length,name:"",log:[]});
                      try {
                        const _log:string[]=[];
                        for(let _i=0;_i<files.length;_i++){
                          const file=files[_i];
                          setKnowledgeProgress({current:_i+1,total:files.length,name:file.name,log:_log});
                          const res = await uploadUserKnowledge(file);
                          _log.push(res.ok ? `✅ ${file.name}: ${res.chunks}チャンク / サマリー${res.summaries??0}件` : `❌ ${file.name}: 失敗`);
                          setKnowledgeProgress({current:_i+1,total:files.length,name:file.name,log:[..._log]});
                          if(res.ok){ const updated = await getUserKnowledgeList(); setKnowledgeFiles(updated); }
                        }
                      } finally { setKnowledgeUploading(false); }
                    }}
                  >
                    <span className="text-xs" style={{color:C.primary,fontWeight:600,display:"block",marginBottom:"4px"}}>{knowledgeUploading ? `⏳ ${knowledgeProgress.current}/${knowledgeProgress.total} 処理中: ${knowledgeProgress.name}` : "📎 ファイルをアップロードする"}</span>
                    <span className="text-xs" style={{color:C.textMuted}}>クリックまたはドラッグ＆ドロップ　{knowledgeFiles.length}/99件</span>
                    {knowledgeProgress.log.length > 0 && (
                      <div style={{marginTop:"8px",textAlign:"left",maxHeight:"120px",overflowY:"auto",background:"rgba(0,0,0,0.04)",borderRadius:"6px",padding:"6px 8px"}}>
                        {knowledgeProgress.log.map((l,i)=>(
                          <div key={i} className="text-xs" style={{color:C.textMain,lineHeight:"1.6"}}>{l}</div>
                        ))}
                      </div>
                    )}
                    <input type="file" accept=".txt,.md,.csv,.xlsx,.xls,.odt" style={{display:"none"}} multiple
                      onChange={async e=>{
                        const allFiles = Array.from(e.target.files||[]);
                        const existingNames = new Set(knowledgeFiles.map((kf:any)=>kf.title?.replace(/^会話要約: /,"")||kf.source_id||""));
                        const files = allFiles.filter((f:File)=>!existingNames.has(f.name)).slice(0, 99 - knowledgeFiles.length);
                        if(allFiles.length !== files.length){ alert(`重複ファイルをスキップしました（${allFiles.length - files.length}件）`); }
                        if(!files.length) return;
                        setKnowledgeUploading(true);
                        setKnowledgeProgress({current:0,total:files.length,name:"",log:[]});
                        try {
                          const _log:string[]=[];
                          for(let _i=0;_i<files.length;_i++){
                            const file=files[_i];
                            setKnowledgeProgress({current:_i+1,total:files.length,name:file.name,log:_log});
                            const res = await uploadUserKnowledge(file);
                            _log.push(res.ok ? `✅ ${file.name}: ${res.chunks}チャンク / サマリー${res.summaries??0}件` : `❌ ${file.name}: 失敗`);
                            setKnowledgeProgress({current:_i+1,total:files.length,name:file.name,log:[..._log]});
                            if(res.ok){ const updated = await getUserKnowledgeList(); setKnowledgeFiles(updated); }
                          }
                        } finally { setKnowledgeUploading(false); e.target.value=""; }
                      }}/>
                  </label>
                </div>
              </div>
            )}
            {/* 全設定保存 */}
            <button onClick={async()=>{
              localStorage.setItem("ascend_ai_tier_default", settings.ai_tier_default);
              localStorage.setItem("ascend_display_suggestions", String(settings.display_suggestions));
              localStorage.setItem("ascend_display_mode_bar", String(settings.display_mode_bar));
              await saveNotificationSettings(settings as Record<string,boolean|string>);
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

import { Suspense } from "react";
export default function MyPage() {
  return <Suspense fallback={null}><MyPageInner /></Suspense>;
}
