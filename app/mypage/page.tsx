"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
const ReactMarkdown = dynamic(() => import("react-markdown"), { ssr: false, loading: () => null });
import {
  getStoredUser, logout, getUserStats, getFcReport,
  getRankupTips, getManual, getUserGuide, getUsageLogs,
  getHeaderConfig, getTheme,
  UserStats, ThemeConfig,
} from "@/lib/api";

type Tab = "overview"|"metrics"|"fc"|"logs"|"rankup"|"manual"|"guide"|"about"|"cookie"|"settings";

export default function MyPage() {
  const router = useRouter();
  const [uid, setUid] = useState("");
  const [stats, setStats] = useState<UserStats|null>(null);
  const [fcData, setFcData] = useState<{report:Record<string,unknown>|null;use_count_since_report:number}>({report:null,use_count_since_report:0});
  const [tab, setTab] = useState<Tab>("overview");
  const [headerCfg, setHeaderCfg] = useState<Record<string,string>>({});
  const [theme, setTheme] = useState<ThemeConfig|null>(null);
  const [customPrompt, setCustomPrompt] = useState("");
  const [customPromptMode, setCustomPromptMode] = useState("append");
  const [content, setContent] = useState("");
  const [logs, setLogs] = useState<{prompt:string;timestamp:string}[]>([]);
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState({
    notify_reply: true,
    notify_rankup: true,
    notify_fc: true,
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
    getFcReport().then(setFcData);
  }, []);

  async function switchTab(t: Tab) {
    setTab(t);
    setContent("");
    if (t==="rankup") { setLoading(true); let c = await getRankupTips(); c = c.replace(/見習い/g,"1段階").replace(/人気嬢/g,"2段階").replace(/ランカー/g,"3段階").replace(/カリスマ/g,"4段階"); setContent(c); setLoading(false); }
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
    {id:"metrics",label:"🎯 DM"},
    {id:"fc",label:"🧠 固定概念"},
    {id:"logs",label:"📋 履歴"},
    {id:"rankup",label:"🏆 ランクアップ"},
    {id:"manual",label:"📖 マニュアル"},
    {id:"guide",label:"📝 ガイド"},
    {id:"about",label:"ℹ️ ASCENDとは"},
    {id:"cookie",label:"🍪 Cookie"},
    {id:"settings",label:"⚙️ 設定"},
  ] as {id:Tab;label:string}[];

  return (
    <div className="min-h-screen" style={{background:"#f8f9fc",fontFamily:"'Inter','Noto Sans JP',sans-serif",color:"#111827"}}>
      <nav style={{background:"rgba(255,255,255,0.95)",borderBottom:"1px solid rgba(0,0,0,0.08)",backdropFilter:"blur(12px)",position:"sticky",top:0,zIndex:50,boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}} className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={()=>router.push("/chat")} className="text-sm transition-colors" style={{color:"#6b7280"}} onMouseOver={e=>(e.target as HTMLElement).style.color="#111827"} onMouseOut={e=>(e.target as HTMLElement).style.color="#6b7280"}>← チャット</button>
          <span className="text-gray-700">|</span>
          <div className="flex items-center gap-2">
            <div style={{background:"linear-gradient(135deg,#6366f1,#8b5cf6)"}} className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-white font-black text-xs">A</span>
            </div>
            <span className="font-black text-sm" style={{color:"#111827"}}>マイページ</span>
          </div>
        </div>
        <span className="text-xs font-medium px-3 py-1 rounded-full" style={{background:"rgba(16,185,129,0.1)",color:"#059669",border:"1px solid rgba(16,185,129,0.2)"}}>● {uid}</span>
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex gap-2 flex-wrap mb-6">
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>switchTab(t.id)}
              style={tab===t.id
                ?{background:"linear-gradient(135deg,#6366f1,#8b5cf6)",color:"white",boxShadow:"0 4px 12px rgba(99,102,241,0.3)"}
                :{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",color:"#9ca3af"}
              }
              className="text-xs px-3 py-1.5 rounded-xl transition-all hover:text-white">
              {t.label}
            </button>
          ))}
        </div>

        {tab==="overview" && stats && (
          <div className="space-y-4">
            {/* ── ヘッダー設定からのバリュープロポジション ── */}
            {(headerCfg.title||headerCfg.point_1_body||headerCfg.point_2_body||headerCfg.point_3_body) && (
              <div style={{background:"linear-gradient(135deg,rgba(79,70,229,0.08),rgba(124,58,237,0.05))",border:"1px solid rgba(79,70,229,0.15)",borderRadius:"20px",padding:"20px 20px 16px 20px"}}>
                {headerCfg.title && <p style={{fontSize:"16px",fontWeight:900,color:"white",marginBottom:"12px",letterSpacing:"0.02em"}}>{headerCfg.title}</p>}
                <div style={{display:"flex",flexDirection:"column" as const,gap:"8px"}}>
                  {headerCfg.point_1_label && (
                    <div style={{display:"flex",alignItems:"flex-start",gap:"10px"}}>
                      <span style={{color:"#818cf8",fontSize:"12px",marginTop:"1px"}}>▶</span>
                      <div><span style={{color:"#818cf8",fontWeight:700,fontSize:"12px"}}>{headerCfg.point_1_label} </span><span style={{color:"rgba(255,255,255,0.7)",fontSize:"12px"}}>{headerCfg.point_1_body}</span></div>
                    </div>
                  )}
                  {!headerCfg.point_1_label && headerCfg.point_1_body && <p style={{color:"rgba(255,255,255,0.7)",fontSize:"12px"}}>▶ {headerCfg.point_1_body}</p>}
                  {headerCfg.point_2_label && (
                    <div style={{display:"flex",alignItems:"flex-start",gap:"10px"}}>
                      <span style={{color:"#818cf8",fontSize:"12px",marginTop:"1px"}}>▶</span>
                      <div><span style={{color:"#818cf8",fontWeight:700,fontSize:"12px"}}>{headerCfg.point_2_label} </span><span style={{color:"rgba(255,255,255,0.7)",fontSize:"12px"}}>{headerCfg.point_2_body}</span></div>
                    </div>
                  )}
                  {!headerCfg.point_2_label && headerCfg.point_2_body && <p style={{color:"rgba(255,255,255,0.7)",fontSize:"12px"}}>▶ {headerCfg.point_2_body}</p>}
                  {headerCfg.point_3_label && (
                    <div style={{display:"flex",alignItems:"flex-start",gap:"10px"}}>
                      <span style={{color:"#818cf8",fontSize:"12px",marginTop:"1px"}}>▶</span>
                      <div><span style={{color:"#818cf8",fontWeight:700,fontSize:"12px"}}>{headerCfg.point_3_label} </span><span style={{color:"rgba(255,255,255,0.7)",fontSize:"12px"}}>{headerCfg.point_3_body}</span></div>
                    </div>
                  )}
                  {!headerCfg.point_3_label && headerCfg.point_3_body && <p style={{color:"rgba(255,255,255,0.7)",fontSize:"12px"}}>▶ {headerCfg.point_3_body}</p>}
                </div>
              </div>
            )}
            <div style={{background:"linear-gradient(135deg,rgba(99,102,241,0.15),rgba(139,92,246,0.08))",border:"1px solid rgba(99,102,241,0.25)",borderRadius:"24px"}} className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p style={{color:"rgba(165,180,252,0.6)",letterSpacing:"0.1em"}} className="text-xs font-bold mb-1">RANK STATUS</p>
                  <p className="text-4xl font-black text-white">{stats.rank_name}</p>
                  <p className="text-sm text-indigo-400 mt-1">Next: {stats.next_pt}</p>
                </div>
                <div style={{background:"linear-gradient(135deg,#6366f1,#8b5cf6)",borderRadius:"20px",padding:"12px 20px",boxShadow:"0 8px 24px rgba(99,102,241,0.4)"}}>
                  <p className="text-3xl font-black text-white leading-none">{stats.level_score}</p>
                  <p className="text-xs text-indigo-200 text-right mt-1">pt</p>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                {[stats.rank_cfg.rank_1_name,stats.rank_cfg.rank_2_name,stats.rank_cfg.rank_3_name,stats.rank_cfg.rank_4_name].map(r=>(
                  <span key={r} style={r===stats.rank_name
                    ?{background:"linear-gradient(135deg,#6366f1,#8b5cf6)",color:"white",fontWeight:"bold",padding:"4px 12px",borderRadius:"99px"}
                    :{background:"rgba(255,255,255,0.05)",color:"#6b7280",border:"1px solid rgba(255,255,255,0.1)",padding:"4px 12px",borderRadius:"99px"}
                  } className="text-xs">{r}</span>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[["総チャット数",`${stats.total_chat_count} 回`],["診断回数",`${stats.diagnosis_count} 回`],["固定概念観測",`${fcCount} / ${fcThreshold}`],["次のランクまで",stats.next_pt]].map(([k,v])=>(
                <div key={k} style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:"16px"}} className="p-4">
                  <p className="text-xs text-gray-600 mb-1">{k}</p>
                  <p className="text-white font-bold">{v}</p>
                </div>
              ))}
            </div>

            <div style={{background:stats.diag_available?"rgba(16,185,129,0.08)":"rgba(255,255,255,0.03)",border:stats.diag_available?"1px solid rgba(16,185,129,0.3)":"1px solid rgba(255,255,255,0.07)",borderRadius:"16px"}} className="p-4">
              <div className="flex justify-between items-center mb-2">
                <p className="text-sm font-bold" style={{color:stats.diag_available?"#10b981":"#9ca3af"}}>🔬 現状課題診断</p>
                {stats.diag_available
                  ? <span style={{background:"rgba(16,185,129,0.2)",border:"1px solid rgba(16,185,129,0.4)",color:"#10b981"}} className="text-xs px-2 py-0.5 rounded-full font-bold">✅ 実行可能</span>
                  : <span className="text-xs text-gray-600">次: {stats.diag_next_unlock} チャット時点</span>
                }
              </div>
              <p className="text-xs text-gray-500">累計 {stats.total_chat_count} チャット</p>
              {stats.diag_available && (
                <button onClick={()=>router.push("/diagnosis")} style={{background:"linear-gradient(135deg,#10b981,#059669)"}} className="w-full mt-3 text-white font-bold rounded-xl py-2 text-sm hover:opacity-90">診断を実行する →</button>
              )}
            </div>

            <div style={{background:"rgba(168,85,247,0.06)",border:"1px solid rgba(168,85,247,0.2)",borderRadius:"16px"}} className="p-4">
              <div className="flex justify-between mb-2">
                <p className="text-sm font-bold text-purple-300">🧠 固定概念レポート</p>
                <p className="text-xs text-purple-400">{fcCount}/{fcThreshold}</p>
              </div>
              <div style={{background:"rgba(255,255,255,0.06)",borderRadius:"99px",height:"6px"}} className="mb-2">
                <div style={{width:`${fcPct}%`,background:"linear-gradient(90deg,#9333ea,#c084fc)",borderRadius:"99px",height:"6px"}}/>
              </div>
              {fcCount>=fcThreshold
                ? <button onClick={()=>switchTab("fc")} className="text-xs text-purple-400 hover:text-white">レポートを確認 →</button>
                : <p className="text-xs text-gray-600">あと {fcThreshold-fcCount} 回で解放</p>
              }
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[{l:"🏆 ランクアップのコツ",t:"rankup" as Tab},{l:"📖 完全マニュアル",t:"manual" as Tab},{l:"📩 個人相談",a:()=>router.push("/inquiry")},{l:"📋 利用履歴",t:"logs" as Tab}].map(item=>(
                <button key={item.l} onClick={item.t?()=>switchTab(item.t!):item.a}
                  style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:"16px"}}
                  className="p-4 text-left text-sm text-gray-400 hover:text-white hover:border-indigo-500/40 transition-all">
                  {item.l}
                </button>
              ))}
            </div>
            <button onClick={()=>{logout();router.push("/");}} className="w-full text-xs text-gray-700 hover:text-red-400 py-3 transition-colors">ログアウト</button>
          </div>
        )}

        {tab==="metrics" && (
          <div style={{background:"linear-gradient(135deg,rgba(79,70,229,0.12),rgba(109,40,217,0.08))",border:"1px solid rgba(79,70,229,0.25)",borderRadius:"24px"}} className="p-6">
            {dm ? (
              <>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-lg font-black text-white">Decision Metrics</h2>
                  <span style={{background:"linear-gradient(135deg,#6366f1,#8b5cf6)",padding:"4px 16px",borderRadius:"99px"}} className="font-black text-white">AI評価 {String(dm.diagnosis_rank||"C")}</span>
                </div>
                <div className="space-y-4 mb-6">
                  {([["Q","意思決定精度",dm.decision_quality_score],["R","リスク耐性",dm.risk_tolerance],["S","構造理解",dm.structural_intelligence],["V","判断速度",dm.decision_velocity],["P","予測精度",dm.prediction_accuracy],["E","実行一貫性",dm.execution_consistency]] as [string,string,unknown][]).map(([k,l,v])=>(
                    <div key={k}>
                      <div className="flex justify-between items-center mb-1.5">
                        <div><span className="text-indigo-400 font-bold">{k}</span><span className="text-white font-medium ml-2">{l}</span></div>
                        <span className="text-white font-black text-xl">{Number(v).toFixed(0)}</span>
                      </div>
                      <div style={{background:"rgba(255,255,255,0.06)",borderRadius:"99px",height:"6px"}}>
                        <div style={{width:`${Math.min(Number(v),100)}%`,background:"linear-gradient(90deg,#6366f1,#a78bfa)",borderRadius:"99px",height:"6px"}}/>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{borderTop:"1px solid rgba(99,102,241,0.2)"}} className="flex justify-between pt-4">
                  <span className="text-indigo-400 font-bold">TOTAL SCORE</span>
                  <span className="text-yellow-400 font-black text-3xl">{Number(dm.diagnosis_total_score||0).toFixed(1)}</span>
                </div>
              </>
            ) : <p className="text-gray-500 text-center py-8">診断データがありません</p>}
          </div>
        )}

        {tab==="fc" && (
          <div style={{background:"rgba(168,85,247,0.06)",border:"1px solid rgba(168,85,247,0.2)",borderRadius:"24px"}} className="p-6">
            <h2 className="text-lg font-black text-white mb-4">🧠 固定概念レポート</h2>
            {fcData.report
              ? <div className="prose prose-invert prose-sm max-w-none"><ReactMarkdown>{String(fcData.report.report_text||JSON.stringify(fcData.report,null,2))}</ReactMarkdown></div>
              : <div className="text-center py-12">
                  <p className="text-4xl mb-4">🔒</p>
                  <p className="text-gray-400 mb-4">あと {Math.max(0,fcThreshold-fcCount)} 回で解放</p>
                  <div style={{background:"rgba(255,255,255,0.05)",borderRadius:"99px",height:"8px",maxWidth:"200px",margin:"0 auto"}}>
                    <div style={{width:`${fcPct}%`,background:"linear-gradient(90deg,#9333ea,#c084fc)",borderRadius:"99px",height:"8px"}}/>
                  </div>
                </div>
            }
          </div>
        )}

        {tab==="logs" && (
          <div className="space-y-3">
            <h2 className="text-lg font-black text-white">📋 利用履歴</h2>
            {loading && <p className="text-gray-500 text-sm">読み込み中...</p>}
            {!loading && logs.length===0 && <p className="text-gray-500 text-sm text-center py-8">履歴がありません</p>}
            {logs.map((l,i)=>(
              <div key={i} style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:"14px"}} className="px-4 py-3">
                <p className="text-xs text-gray-600 mb-1">{l.timestamp.slice(0,16)}</p>
                <p className="text-sm text-gray-300">{l.prompt}</p>
              </div>
            ))}
          </div>
        )}

        {tab==="rankup" && stats && (() => {
          const _ro = stats.rank_cfg ? [stats.rank_cfg.rank_1_name,stats.rank_cfg.rank_2_name,stats.rank_cfg.rank_3_name,stats.rank_cfg.rank_4_name] : ["見習い","人気嬢","ランカー","カリスマ"];
          const _labels = ["1段目","2段目","3段目","4段目"];
          return (
            <div className="space-y-4">
              <div style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:"24px"}} className="p-6">
                <div className="flex gap-2 mb-4 flex-wrap">
                  {_ro.map((rn,i)=>(
                    <div key={i} style={{background:i===_ro.indexOf(stats.rank_name)?"linear-gradient(135deg,#6366f1,#8b5cf6)":"rgba(255,255,255,0.05)",border:i===_ro.indexOf(stats.rank_name)?"none":"1px solid rgba(255,255,255,0.1)",borderRadius:"10px",padding:"6px 14px",fontSize:"12px",fontWeight:700,color:i===_ro.indexOf(stats.rank_name)?"white":"rgba(255,255,255,0.5)"}}>
                      {_labels[i]}
                    </div>
                  ))}
                </div>
                {loading ? <p className="text-gray-500">読み込み中...</p>
                  : <div className="prose prose-invert prose-sm max-w-none [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-gray-700 [&_td]:px-3 [&_td]:py-2 [&_th]:border [&_th]:border-gray-700 [&_th]:px-3 [&_th]:py-2 [&_th]:bg-indigo-900/30"><ReactMarkdown>{content}</ReactMarkdown></div>
                }
              </div>
            </div>
          );
        })()}
        {(tab==="manual"||tab==="guide") && (
          <div style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:"24px"}} className="p-6">
            {loading ? <p className="text-gray-500">読み込み中...</p>
              : <div className="prose prose-invert prose-sm max-w-none [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-gray-700 [&_td]:px-3 [&_td]:py-2 [&_th]:border [&_th]:border-gray-700 [&_th]:px-3 [&_th]:py-2 [&_th]:bg-indigo-900/30"><ReactMarkdown>{content}</ReactMarkdown></div>
            }
          </div>
        )}

        {tab==="about" && (
          <div className="space-y-3">
            <h2 className="text-lg font-black text-white mb-4">ℹ️ ASCENDとは</h2>
            {[["A","Architectural Analysis","構造解剖"],["S","Scoring & Scala","階級スコア"],["C","Case-driven RAG","事例駆動検索"],["E","Executor Strategy","戦術執行"],["N","Nurturing / Mentor","育成・導師"],["D","Dynamic Routing & Diagnosis","動的診断"]].map(([k,en,ja])=>(
              <div key={k} style={{background:"rgba(99,102,241,0.08)",border:"1px solid rgba(99,102,241,0.2)",borderRadius:"16px"}} className="flex items-center gap-4 p-4">
                <div style={{background:"linear-gradient(135deg,#6366f1,#8b5cf6)",borderRadius:"12px",width:"44px",height:"44px",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  <span className="text-white font-black text-xl">{k}</span>
                </div>
                <div><p className="text-white font-bold">{en}</p><p className="text-gray-500 text-sm">{ja}</p></div>
              </div>
            ))}
          </div>
        )}

        {tab==="cookie" && (
          <div style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:"24px"}} className="p-6 space-y-4">
            <h2 className="text-lg font-black text-white">🍪 Cookie/セッション設定</h2>
            <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:"16px"}} className="p-4 space-y-2">
              <p className="text-white font-bold text-sm mb-2">セッション情報</p>
              <p className="text-xs text-gray-500">認証トークン: ブラウザのlocalStorageに保存</p>
              <p className="text-xs text-gray-500">有効期限: ログインから7日間</p>
              <p className="text-xs text-gray-500">UID: {uid}</p>
            </div>
            <button onClick={()=>{logout();router.push("/");}} style={{background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:"16px"}} className="w-full text-red-400 hover:text-white py-3 text-sm transition-all">
              セッションをクリアしてログアウト
            </button>
          </div>
        )}
      </div>

        {tab==="settings" && (
          <div className="space-y-4">
            <h2 className="text-lg font-black" style={{color:"#111827"}}>⚙️ 一般設定</h2>

            {/* 通知設定 */}
            <div style={{background:"#fff",border:"1px solid rgba(0,0,0,0.08)",borderRadius:"16px",boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}} className="p-5">
              <p className="text-sm font-bold mb-4" style={{color:"#111827"}}>🔔 通知設定</p>
              <div className="space-y-3">
                {[
                  {key:"notify_reply",label:"AI返答完了の通知"},
                  {key:"notify_rankup",label:"ランクアップ時の通知"},
                  {key:"notify_fc",label:"固定概念レポート解放の通知"},
                ].map(item=>(
                  <div key={item.key} className="flex items-center justify-between">
                    <span className="text-sm" style={{color:"#374151"}}>{item.label}</span>
                    <button onClick={()=>setSettings(s=>({...s,[item.key]:!s[item.key as keyof typeof s]}))}
                      style={{
                        background: settings[item.key as keyof typeof settings] ? "linear-gradient(135deg,#4f46e5,#7c3aed)" : "rgba(0,0,0,0.08)",
                        borderRadius:"99px", width:"44px", height:"24px", position:"relative", transition:"all 0.2s",
                        boxShadow: settings[item.key as keyof typeof settings] ? "0 2px 8px rgba(79,70,229,0.3)" : "none",
                      }}>
                      <span style={{
                        position:"absolute", top:"3px",
                        left: settings[item.key as keyof typeof settings] ? "23px" : "3px",
                        width:"18px", height:"18px", borderRadius:"50%", background:"#fff",
                        transition:"all 0.2s", boxShadow:"0 1px 3px rgba(0,0,0,0.2)",
                        display:"block",
                      }}/>
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* 表示設定 */}
            <div style={{background:"#fff",border:"1px solid rgba(0,0,0,0.08)",borderRadius:"16px",boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}} className="p-5">
              <p className="text-sm font-bold mb-4" style={{color:"#111827"}}>🖥️ 表示設定</p>
              <div className="space-y-3">
                {[
                  {key:"display_suggestions",label:"次の質問候補を表示"},
                  {key:"display_mode_bar",label:"目的モードバーを表示"},
                  {key:"display_score",label:"スコア・ランクを表示"},
                ].map(item=>(
                  <div key={item.key} className="flex items-center justify-between">
                    <span className="text-sm" style={{color:"#374151"}}>{item.label}</span>
                    <button onClick={()=>setSettings(s=>({...s,[item.key]:!s[item.key as keyof typeof s]}))}
                      style={{
                        background: settings[item.key as keyof typeof settings] ? "linear-gradient(135deg,#4f46e5,#7c3aed)" : "rgba(0,0,0,0.08)",
                        borderRadius:"99px", width:"44px", height:"24px", position:"relative", transition:"all 0.2s",
                        boxShadow: settings[item.key as keyof typeof settings] ? "0 2px 8px rgba(79,70,229,0.3)" : "none",
                      }}>
                      <span style={{
                        position:"absolute", top:"3px",
                        left: settings[item.key as keyof typeof settings] ? "23px" : "3px",
                        width:"18px", height:"18px", borderRadius:"50%", background:"#fff",
                        transition:"all 0.2s", boxShadow:"0 1px 3px rgba(0,0,0,0.2)",
                        display:"block",
                      }}/>
                    </button>
                  </div>
                ))}
              </div>
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm" style={{color:"#374151"}}>文字サイズ</span>
                  <div className="flex gap-1">
                    {["small","medium","large"].map(s=>(
                      <button key={s} onClick={()=>setSettings(p=>({...p,font_size:s}))}
                        style={{
                          background: settings.font_size===s ? "linear-gradient(135deg,#4f46e5,#7c3aed)" : "rgba(0,0,0,0.05)",
                          color: settings.font_size===s ? "#fff" : "#6b7280",
                          borderRadius:"8px", padding:"4px 10px", fontSize:"11px", fontWeight:600,
                        }}>
                        {s==="small"?"小":s==="medium"?"中":"大"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* AIエンジン設定 */}
            <div style={{background:"#fff",border:"1px solid rgba(0,0,0,0.08)",borderRadius:"16px",boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}} className="p-5">
              <p className="text-sm font-bold mb-4" style={{color:"#111827"}}>⚡ AIエンジン設定</p>
              <div className="flex items-center justify-between">
                <span className="text-sm" style={{color:"#374151"}}>デフォルトエンジン</span>
                <select value={settings.ai_tier_default} onChange={e=>setSettings(p=>({...p,ai_tier_default:e.target.value}))}
                  style={{background:"rgba(79,70,229,0.06)",border:"1px solid rgba(79,70,229,0.2)",borderRadius:"10px",color:"#4f46e5",padding:"6px 12px",fontSize:"13px"}}>
                  <option value="core">Core（標準）</option>
                  <option value="ultra">Ultra（高精度）</option>
                  <option value="apex">Apex（最上位）</option>
                </select>
              </div>
            </div>

            {/* 言語設定 */}
            <div style={{background:"#fff",border:"1px solid rgba(0,0,0,0.08)",borderRadius:"16px",boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}} className="p-5">
              <p className="text-sm font-bold mb-4" style={{color:"#111827"}}>🌐 言語・地域</p>
              <div className="flex items-center justify-between">
                <span className="text-sm" style={{color:"#374151"}}>表示言語</span>
                <select value={settings.language} onChange={e=>setSettings(p=>({...p,language:e.target.value}))}
                  style={{background:"rgba(0,0,0,0.03)",border:"1px solid rgba(0,0,0,0.08)",borderRadius:"10px",color:"#374151",padding:"6px 12px",fontSize:"13px"}}>
                  <option value="ja">日本語</option>
                  <option value="en">English</option>
                </select>
              </div>
            </div>

            <button style={{background:"linear-gradient(135deg,#4f46e5,#7c3aed)",boxShadow:"0 4px 16px rgba(79,70,229,0.3)",borderRadius:"14px"}}
              className="w-full text-white font-bold py-3 text-sm hover:opacity-90 transition-all">
              💾 設定を保存
            </button>
          </div>
        )}

    </div>
  );
}
