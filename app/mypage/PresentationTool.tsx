"use client";
import { useState, useRef } from "react";
import { generateSlides, generateEventPlan } from "@/lib/api";

const C = {
  bg:"#f8f9fc", card:"#ffffff", primary:"#4f46e5", primary2:"#7c3aed",
  textMain:"#111827", textSub:"#6b7280", textMuted:"#9ca3af",
  border:"rgba(0,0,0,0.08)", borderPrimary:"rgba(79,70,229,0.2)",
  shadow:"0 1px 3px rgba(0,0,0,0.08)", shadowMd:"0 4px 16px rgba(0,0,0,0.08)",
  shadowPrimary:"0 4px 16px rgba(79,70,229,0.2)",
};

const SLIDE_TYPE_COLOR: Record<string,string> = {
  cover:"#4f46e5", agenda:"#0891b2", situation:"#059669", complication:"#dc2626",
  resolution:"#7c3aed", data:"#d97706", recommendation:"#4f46e5", risk:"#ef4444",
  execution:"#0891b2", conclusion:"#111827", content:"#059669",
};
const SLIDE_TYPE_LABEL: Record<string,string> = {
  cover:"表紙", agenda:"目次", situation:"現状", complication:"問題",
  resolution:"解決策", data:"データ", recommendation:"提言", risk:"リスク",
  execution:"実行", conclusion:"結論", content:"本編",
};

interface SlideData {
  slide_number: number;
  type: string;
  title: string;
  headline: string;
  bullets: string[];
  data_label?: string;
  note?: string;
  chart?: ChartData;
}
interface PresentationData {
  title: string;
  subtitle: string;
  executive_summary: string;
  slides: SlideData[];
  appendix_notes: string;
  logic_skeleton?: {
    governing_thought: string;
    situation: string;
    complication: string;
    resolution: string;
    logic_flow: string;
    objections: string[];
    success_metrics: string[];
  };
}


interface ChartData {
  type: string;
  title?: string;
  labels?: string[];
  values?: number[];
  unit?: string;
  before_label?: string;
  after_label?: string;
  before_value?: string;
  after_value?: string;
  phases?: string[];
}

function ChartRenderer({ chart, color, dark=false }: { chart: ChartData; color: string; dark?: boolean }) {
  if (!chart || chart.type === "none" || !chart.type) return null;
  const W = 320; const H = 160;
  const tx = (s: string) => dark ? "rgba(255,255,255,0.7)" : "#374151";
  const tm = (s: string) => dark ? "rgba(255,255,255,0.4)" : "#9ca3af";
  const bg = dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)";
  const bd = dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";

  // 棒グラフ
  if (chart.type === "bar" && chart.labels && chart.values && chart.values.length > 0) {
    const vals = chart.values.map(Number).filter(v => !isNaN(v));
    if (vals.length === 0) return null;
    const max = Math.max(...vals) * 1.2 || 1;
    const barW = Math.min(48, (W - 40) / vals.length - 8);
    const gap = (W - 40 - barW * vals.length) / (vals.length + 1);
    return (
      <div style={{background:bg,border:`1px solid ${bd}`,borderRadius:"10px",padding:"12px",marginTop:"12px"}}>
        {chart.title && <p style={{color:dark?"rgba(255,255,255,0.5)":C.textMuted,fontSize:"10px",fontWeight:600,marginBottom:"8px"}}>{chart.title}</p>}
        <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{overflow:"visible"}}>
          {vals.map((v, i) => {
            const bh = ((v / max) * (H - 40));
            const x = 20 + gap + i * (barW + gap);
            const y = H - 24 - bh;
            return (
              <g key={i}>
                <rect x={x} y={y} width={barW} height={bh} rx="4"
                  fill={`${color}${i===0?"dd":"88"}`} />
                <text x={x + barW/2} y={y - 4} textAnchor="middle" fontSize="10" fontWeight="700" fill={color}>
                  {v}{chart.unit||""}
                </text>
                <text x={x + barW/2} y={H - 8} textAnchor="middle" fontSize="9" fill={tm("")}>
                  {(chart.labels||[])[i]||""}
                </text>
              </g>
            );
          })}
          <line x1="20" y1={H-24} x2={W-20} y2={H-24} stroke={bd} strokeWidth="1"/>
        </svg>
      </div>
    );
  }

  // 折れ線グラフ
  if (chart.type === "line" && chart.labels && chart.values && chart.values.length > 0) {
    const vals = chart.values.map(Number).filter(v => !isNaN(v));
    if (vals.length < 2) return null;
    const max = Math.max(...vals) * 1.2 || 1;
    const min = Math.min(...vals) * 0.8;
    const range = max - min || 1;
    const pts = vals.map((v, i) => {
      const x = 20 + (i / (vals.length - 1)) * (W - 40);
      const y = H - 24 - ((v - min) / range) * (H - 44);
      return `${x},${y}`;
    });
    return (
      <div style={{background:bg,border:`1px solid ${bd}`,borderRadius:"10px",padding:"12px",marginTop:"12px"}}>
        {chart.title && <p style={{color:dark?"rgba(255,255,255,0.5)":C.textMuted,fontSize:"10px",fontWeight:600,marginBottom:"8px"}}>{chart.title}</p>}
        <svg width="100%" viewBox={`0 0 ${W} ${H}`}>
          <defs>
            <linearGradient id="lg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.3"/>
              <stop offset="100%" stopColor={color} stopOpacity="0"/>
            </linearGradient>
          </defs>
          <polygon points={`20,${H-24} ${pts.join(" ")} ${20+(vals.length-1)/(vals.length-1)*(W-40)},${H-24}`} fill="url(#lg)"/>
          <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round"/>
          {vals.map((v, i) => {
            const x = 20 + (i / (vals.length - 1)) * (W - 40);
            const y = H - 24 - ((v - min) / range) * (H - 44);
            return (
              <g key={i}>
                <circle cx={x} cy={y} r="4" fill={color}/>
                <text x={x} y={y - 8} textAnchor="middle" fontSize="9" fontWeight="700" fill={color}>{v}{chart.unit||""}</text>
                <text x={x} y={H - 8} textAnchor="middle" fontSize="9" fill={tm("")}>{(chart.labels||[])[i]||""}</text>
              </g>
            );
          })}
          <line x1="20" y1={H-24} x2={W-20} y2={H-24} stroke={bd} strokeWidth="1"/>
        </svg>
      </div>
    );
  }

  // 比較グラフ
  if (chart.type === "compare" && chart.labels && chart.values && chart.values.length >= 2) {
    const vals = chart.values.map(Number).filter(v => !isNaN(v));
    if (vals.length < 2) return null;
    const max = Math.max(...vals) * 1.2 || 1;
    const colors = [color, "#dc2626", "#059669", "#d97706", "#0891b2"];
    return (
      <div style={{background:bg,border:`1px solid ${bd}`,borderRadius:"10px",padding:"12px",marginTop:"12px"}}>
        {chart.title && <p style={{color:dark?"rgba(255,255,255,0.5)":C.textMuted,fontSize:"10px",fontWeight:600,marginBottom:"8px"}}>{chart.title}</p>}
        <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
          {vals.map((v, i) => {
            const pct = (v / max) * 100;
            const c = colors[i % colors.length];
            return (
              <div key={i}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:"3px"}}>
                  <span style={{fontSize:"11px",fontWeight:600,color:dark?"rgba(255,255,255,0.7)":"#374151"}}>{(chart.labels||[])[i]||""}</span>
                  <span style={{fontSize:"11px",fontWeight:800,color:c}}>{v}{chart.unit||""}</span>
                </div>
                <div style={{background:dark?"rgba(255,255,255,0.08)":"rgba(0,0,0,0.06)",borderRadius:"99px",height:"8px"}}>
                  <div style={{width:`${pct}%`,background:c,borderRadius:"99px",height:"8px",transition:"width 0.6s ease"}}/>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Before/After
  if (chart.type === "beforeafter") {
    return (
      <div style={{background:bg,border:`1px solid ${bd}`,borderRadius:"10px",padding:"12px",marginTop:"12px"}}>
        {chart.title && <p style={{color:dark?"rgba(255,255,255,0.5)":C.textMuted,fontSize:"10px",fontWeight:600,marginBottom:"8px"}}>{chart.title}</p>}
        <div style={{display:"flex",gap:"8px",alignItems:"stretch"}}>
          <div style={{flex:1,background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:"8px",padding:"10px 12px"}}>
            <p style={{color:"#dc2626",fontSize:"9px",fontWeight:800,letterSpacing:"0.1em",marginBottom:"4px"}}>BEFORE</p>
            <p style={{color:"#dc2626",fontSize:"10px",fontWeight:700,marginBottom:"4px"}}>{chart.before_label||""}</p>
            <p style={{color:dark?"rgba(255,255,255,0.6)":"#6b7280",fontSize:"11px",lineHeight:1.5}}>{chart.before_value||""}</p>
          </div>
          <div style={{display:"flex",alignItems:"center",flexShrink:0}}>
            <span style={{color:color,fontSize:"18px",fontWeight:900}}>→</span>
          </div>
          <div style={{flex:1,background:`${color}10`,border:`1px solid ${color}30`,borderRadius:"8px",padding:"10px 12px"}}>
            <p style={{color:color,fontSize:"9px",fontWeight:800,letterSpacing:"0.1em",marginBottom:"4px"}}>AFTER</p>
            <p style={{color:color,fontSize:"10px",fontWeight:700,marginBottom:"4px"}}>{chart.after_label||""}</p>
            <p style={{color:dark?"rgba(255,255,255,0.6)":"#6b7280",fontSize:"11px",lineHeight:1.5}}>{chart.after_value||""}</p>
          </div>
        </div>
      </div>
    );
  }

  // ロードマップ
  if (chart.type === "roadmap" && chart.phases && chart.phases.length > 0) {
    const phaseColors = [color, "#0891b2", "#059669", "#d97706", "#7c3aed"];
    return (
      <div style={{background:bg,border:`1px solid ${bd}`,borderRadius:"10px",padding:"12px",marginTop:"12px"}}>
        {chart.title && <p style={{color:dark?"rgba(255,255,255,0.5)":C.textMuted,fontSize:"10px",fontWeight:600,marginBottom:"8px"}}>{chart.title}</p>}
        <div style={{display:"flex",gap:"4px",alignItems:"center",flexWrap:"nowrap",overflowX:"auto"}}>
          {chart.phases.map((ph, i) => {
            const c = phaseColors[i % phaseColors.length];
            return (
              <div key={i} style={{display:"flex",alignItems:"center",gap:"4px",flexShrink:0}}>
                <div style={{background:`${c}15`,border:`1px solid ${c}40`,borderRadius:"8px",padding:"8px 10px",minWidth:"80px"}}>
                  <p style={{color:c,fontSize:"9px",fontWeight:800,marginBottom:"2px"}}>PHASE {i+1}</p>
                  <p style={{color:dark?"rgba(255,255,255,0.7)":"#374151",fontSize:"10px",fontWeight:600,lineHeight:1.4}}>{ph}</p>
                </div>
                {i < (chart.phases||[]).length - 1 && (
                  <span style={{color:dark?"rgba(255,255,255,0.2)":C.textMuted,fontSize:"14px",fontWeight:700}}>→</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return null;
}

const FIELDS = [
  { key:"theme",              label:"資料テーマ・タイトル", placeholder:"例：新規事業戦略2026、DX推進計画、コスト削減提案",       required:true,  desc:"この資料が何についてのプレゼンか（タイトルになります）" },
  { key:"target_role",        label:"対象者",             placeholder:"例：取締役会、投資家、営業部長",                          required:false, desc:"誰に見せるか（役職・意思決定権限）" },
  { key:"decision_goal",      label:"意思決定ゴール",     placeholder:"例：新規事業への1億円投資を承認させる",                    required:true,  desc:"この資料で何を決めさせるか（最重要）" },
  { key:"decision_criteria",  label:"評価軸",             placeholder:"例：ROI・リスク・実行速度・競合優位性",                    required:false, desc:"意思決定者が何で判断するか" },
  { key:"current_state",      label:"現状（数値・事実）", placeholder:"例：売上3億円、前年比-15%、市場シェア8%",                  required:false, desc:"今どうなっているか（数値・ファクト）" },
  { key:"problem",            label:"問題（ズレ）",       placeholder:"例：競合との価格差30%、離脱率月次5%増加",                  required:false, desc:"何が問題か（あるべき姿とのギャップ）" },
  { key:"root_cause",         label:"原因（構造）",       placeholder:"例：コスト構造の非効率、調達先の固定化",                   required:false, desc:"なぜ問題が起きているか（根本原因）" },
  { key:"options_comparison", label:"選択肢比較",         placeholder:"例：A案：内製化、B案：外注、C案：提携。A案を推奨",         required:false, desc:"他の選択肢との比較・なぜこの案か" },
  { key:"proposal",           label:"提案（施策）",       placeholder:"例：DX化による業務自動化、インサイドセールス導入",          required:false, desc:"何をするか（具体的な打ち手）" },
  { key:"evidence",           label:"根拠（データ・ロジック）", placeholder:"例：同業他社でコスト25%削減、ROI18ヶ月で回収",       required:false, desc:"なぜその提案が有効か（証拠・ロジック）" },
  { key:"risk",               label:"リスク・障壁",       placeholder:"例：初期投資2000万円、社内反発、導入6ヶ月のダウンタイム",  required:false, desc:"採用した場合の障害・反論対策" },
  { key:"rejection_risk",     label:"非採用リスク",       placeholder:"例：このまま放置すると市場シェアが年10%ずつ低下する",      required:false, desc:"採用しなかった場合に何が起きるか" },
  { key:"execution",          label:"実行条件",           placeholder:"例：Q2開始、担当3名、予算上限5000万",                      required:false, desc:"リソース・スケジュール・制約条件" },
  { key:"priority",           label:"優先順位",           placeholder:"例：Phase1：基盤整備、Phase2：展開、Phase3：最適化",       required:false, desc:"何から着手するか・フェーズ設計" },
  { key:"success_kpi",        label:"成功定義（KPI）",    placeholder:"例：6ヶ月でコスト20%削減、NPS+15、解約率3%以下",           required:false, desc:"何をもって成功とするか（測定可能な指標）" },
];


const EVENT_FIELDS = [
  { key:"event_name",      label:"イベント名",           placeholder:"例：ASCEND Summit 2026、新製品発表会、社内キックオフ",           required:true,  desc:"正式名称・通称" },
  { key:"event_purpose",   label:"開催目的",             placeholder:"例：新規顧客獲得20%増、ブランド認知向上、既存客LTV向上",          required:true,  desc:"何のために開催するか" },
  { key:"concept",         label:"コンセプト（核）",     placeholder:"例：限定体験・非日常感・「今夜しか来れない」理由を作る",           required:false, desc:"なぜこのイベントに来るのか・存在理由" },
  { key:"target",          label:"ターゲット",           placeholder:"例：30代男性・既存顧客200名・新規見込み100名",                   required:false, desc:"参加者像・人数・属性・温度感" },
  { key:"current_state",   label:"現状・課題・原因",     placeholder:"例：現状：来客数-15%、課題：リピート率低下、原因：体験の差別化不足", required:false, desc:"数値・事実・構造的原因" },
  { key:"overview",        label:"開催概要",             placeholder:"例：2026年9月15日、東京国際フォーラム、オフライン+配信",           required:false, desc:"日時・場所・形式" },
  { key:"experience",      label:"体験設計",             placeholder:"例：来場前：期待醸成SNS→当日：限定体験→帰宅後：余韻コンテンツ配信", required:false, desc:"来場前→当日→来場後のストーリー設計" },
  { key:"program",         label:"プログラム構成",       placeholder:"例：13:00開場、基調講演30分、体験ブース、懇親会60分",             required:false, desc:"タイムライン・コンテンツ" },
  { key:"promotion",       label:"集客戦略",             placeholder:"例：既存客：DM300件、新規：SNS広告、口コミ：紹介特典、導線：LP→予約", required:false, desc:"チャネル別に分解（既存・新規・SNS・口コミ・導線）" },
  { key:"monetize",        label:"マネタイズ構造",       placeholder:"例：基本料金5000円、オプション飲食2000円、回転3回転、客単価目標8000円", required:false, desc:"単価・回転・オプション・売上の取り方を分解（入力内容をそのまま表示）" },
  { key:"budget",          label:"予算・収支計画",       placeholder:"例：\n会場費：200万円\n広告費：50万円\n人件費：100万円\n収益目標：500万円", required:false, desc:"入力内容がそのまま表示されます（AI補完なし）" },
  { key:"competitor",      label:"競合・代替比較",       placeholder:"例：通常営業比：+30%客単価、他店イベント比：体験の独自性で差別化",   required:false, desc:"なぜこれを選ぶか・他の選択肢との差" },
  { key:"risk",            label:"リスク・対策",         placeholder:"例：集客未達→早期割引施策、天災→オンライン切替",                 required:false, desc:"発生確率・影響度・対策" },
  { key:"rejection_risk",  label:"非実施リスク",         placeholder:"例：このまま放置すると来客数が月5%ずつ低下し6ヶ月で売上-30%",      required:false, desc:"やらない場合の損失・決裁圧力" },
  { key:"team",            label:"実行体制",             placeholder:"例：PM：田中、当日運営：5名、外注：映像制作、SNS担当：鈴木",        required:false, desc:"入力内容がそのまま表示されます（AI補完なし）" },
  { key:"kpi",             label:"成功指標（KPI）",      placeholder:"例：参加者300名、客単価8000円、満足度4.2以上、SNSリーチ1万件",      required:false, desc:"入力内容がそのまま表示されます（AI補完なし）" },
];

const SECTION_TYPE_COLOR: Record<string,string> = {
  purpose:"#4f46e5", concept:"#7c3aed", target:"#0891b2", situation:"#dc2626",
  overview:"#059669", experience:"#d97706", program:"#7c3aed", promotion:"#0891b2",
  monetize:"#059669", budget:"#059669", competitor:"#d97706", risk:"#ef4444",
  rejection_risk:"#dc2626", team:"#0891b2", kpi:"#4f46e5", appendix:"#6b7280",
};
const SECTION_TYPE_LABEL: Record<string,string> = {
  purpose:"目的", concept:"コンセプト", target:"ターゲット", situation:"現状・課題",
  overview:"概要", experience:"体験設計", program:"プログラム", promotion:"集客戦略",
  monetize:"マネタイズ", budget:"予算", competitor:"競合比較", risk:"リスク",
  rejection_risk:"非実施リスク", team:"体制", kpi:"KPI", appendix:"補足",
};

interface TableData { headers: string[]; rows: string[][]; }
interface SectionData {
  section_number: number;
  type: string;
  title: string;
  headline: string;
  content: string;
  bullets: string[];
  chart?: ChartData;
  table?: TableData;
}
interface EventPlanData {
  title: string;
  subtitle: string;
  executive_summary: string;
  sections: SectionData[];
  appendix_notes: string;
}

function TableRenderer({ table, color }: { table: TableData; color: string }) {
  if (!table || !table.headers || !table.rows) return null;
  return (
    <div style={{marginTop:"12px",overflowX:"auto"}}>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:"11px"}}>
        <thead>
          <tr>
            {table.headers.map((h,i)=>(
              <th key={i} style={{background:`${color}15`,border:`1px solid ${color}25`,padding:"6px 10px",color:color,fontWeight:800,textAlign:"left"}}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row,i)=>(
            <tr key={i} style={{background:i%2===0?"rgba(0,0,0,0.01)":"white"}}>
              {row.map((cell,j)=>(
                <td key={j} style={{border:`1px solid rgba(0,0,0,0.06)`,padding:"6px 10px",color:"#374151"}}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EventPlanTool() {
  const [form, setForm] = useState<Record<string,string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<EventPlanData|null>(null);
  const [showAll, setShowAll] = useState(false);
  const setField = (key:string, val:string) => setForm(f=>({...f,[key]:val}));
  const visibleFields = showAll ? EVENT_FIELDS : EVENT_FIELDS.slice(0,4);

  async function handleGenerate() {
    if (!form["event_name"]?.trim() && !form["event_purpose"]?.trim()) {
      setError("イベント名または開催目的は必須です"); return;
    }
    setError(""); setLoading(true); setData(null);
    const res = await generateEventPlan(form);
    // 予算・KPI・体制はユーザー入力でAI生成セクションを上書き
    if (res.ok && res.data && res.data.sections) {
      const overrides: Record<string, string> = {
        budget: form["budget"] || "",
        kpi: form["kpi"] || "",
        team: form["team"] || "",
        monetize: form["monetize"] || "",
        rejection_risk: form["rejection_risk"] || "",
      };
      res.data.sections = res.data.sections.map((s: SectionData) => {
        if (overrides[s.type] && overrides[s.type].trim()) {
          return {
            ...s,
            content: "",
            bullets: overrides[s.type].split("\n").map((l: string) => l.trim()).filter(Boolean),
            chart: { type: "none", title: "", labels: [], values: [], unit: "", phases: [] },
            table: undefined,
          };
        }
        return s;
      });
    }
    setLoading(false);
    if (!res.ok || !res.data) { setError("生成に失敗しました。再試行してください。"); return; }
    setData(res.data);
  }

  function handlePrint() {
    if (!data) return;
    const html = buildEventPlanHTML(data);
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html); w.document.close(); w.focus();
    setTimeout(() => w.print(), 600);
  }

  function handleSaveHTML() {
    if (!data) return;
    const html = buildEventPlanHTML(data);
    const blob = new Blob([html], { type:"text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${data.title||"event_plan"}.html`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div style={{background:"linear-gradient(135deg,#0f172a,#1e293b,#0f172a)",borderRadius:"20px",padding:"24px 24px 20px",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:"-30px",right:"-30px",width:"180px",height:"180px",background:"radial-gradient(circle,rgba(8,145,178,0.12) 0%,transparent 70%)",pointerEvents:"none"}}/>
        <p style={{color:"rgba(255,255,255,0.3)",fontSize:"9px",fontWeight:800,letterSpacing:"0.2em",marginBottom:"6px"}}>ASCEND CONSULTING TOOLS</p>
        <h2 style={{color:"white",fontWeight:900,fontSize:"20px",marginBottom:"4px"}}>📋 イベント企画書作成</h2>
        <p style={{color:"rgba(255,255,255,0.45)",fontSize:"12px",lineHeight:1.6}}>目的・構成・予算・KPIを入力 → プロ品質の企画書を即時生成</p>
      </div>

      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:"16px",padding:"20px"}} className="space-y-4">
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <p style={{color:C.textMain,fontWeight:800,fontSize:"14px"}}>📝 企画情報の入力</p>
          <span style={{fontSize:"10px",color:C.textMuted}}>* 必須</span>
        </div>
        {visibleFields.map(f=>(
          <div key={f.key}>
            <div style={{display:"flex",alignItems:"baseline",gap:"6px",marginBottom:"4px"}}>
              <p style={{color:C.textMain,fontSize:"12px",fontWeight:700}}>
                {f.label}
                {f.required&&<span style={{color:"#ef4444",marginLeft:"4px"}}>*必須</span>}
              </p>
              <p style={{color:C.textMuted,fontSize:"10px"}}>{f.desc}</p>
            </div>
            <textarea value={form[f.key]||""} onChange={e=>setField(f.key,e.target.value)}
              placeholder={f.placeholder} rows={2}
              style={{width:"100%",background:C.bg,border:`1px solid ${C.border}`,borderRadius:"10px",padding:"10px 12px",fontSize:"12px",color:C.textMain,resize:"vertical",lineHeight:1.6}}/>
          </div>
        ))}
        <button onClick={()=>setShowAll(v=>!v)}
          style={{width:"100%",background:"rgba(0,0,0,0.03)",border:`1px dashed ${C.border}`,borderRadius:"10px",padding:"8px 0",fontSize:"12px",color:C.textMuted,cursor:"pointer"}}>
          {showAll?"▲ 入力欄を折りたたむ":`▼ さらに詳細を入力する（+${EVENT_FIELDS.length-4}項目）`}
        </button>
        {error&&<p style={{color:"#ef4444",fontSize:"12px",fontWeight:600}}>{error}</p>}
        {loading&&(
          <div style={{background:"rgba(8,145,178,0.04)",border:"1px solid rgba(8,145,178,0.2)",borderRadius:"12px",padding:"14px 16px",display:"flex",gap:"12px",alignItems:"center"}}>
            <div style={{width:"28px",height:"28px",borderRadius:"50%",border:"3px solid rgba(8,145,178,0.2)",borderTop:"3px solid #0891b2",animation:"spin 1s linear infinite",flexShrink:0}}/>
            <p style={{color:"#0891b2",fontWeight:700,fontSize:"13px"}}>企画書を生成中...（構成・図表・予算表を自動作成）</p>
          </div>
        )}
        <button onClick={handleGenerate} disabled={loading}
          style={{width:"100%",background:loading?"rgba(0,0,0,0.08)":"linear-gradient(135deg,#0891b2,#0e7490)",borderRadius:"12px",boxShadow:loading?"none":"0 4px 16px rgba(8,145,178,0.3)",border:"none",cursor:loading?"not-allowed":"pointer",padding:"14px 0"}}>
          <span style={{color:loading?"#999":"white",fontWeight:800,fontSize:"14px"}}>{loading?"生成中...":"📋 企画書を生成する"}</span>
        </button>
      </div>

      {data&&(
        <div className="space-y-3">
          <div style={{background:"linear-gradient(135deg,#0f172a,#1e293b)",borderRadius:"16px",padding:"16px 20px"}}>
            <p style={{color:"rgba(255,255,255,0.3)",fontSize:"9px",fontWeight:800,letterSpacing:"0.15em",marginBottom:"6px"}}>EXECUTIVE SUMMARY</p>
            <p style={{color:"white",fontWeight:800,fontSize:"15px",lineHeight:1.4,marginBottom:"6px"}}>{data.title}</p>
            <p style={{color:"rgba(255,255,255,0.6)",fontSize:"12px",lineHeight:1.6}}>{data.executive_summary}</p>
          </div>
          <div style={{display:"flex",gap:"6px"}}>
            <button onClick={handlePrint}
              style={{flex:1,background:"linear-gradient(135deg,#0891b2,#0e7490)",borderRadius:"10px",padding:"9px 0",fontSize:"12px",fontWeight:700,color:"white",border:"none",cursor:"pointer",boxShadow:"0 4px 12px rgba(8,145,178,0.3)"}}>
              🖨️ 印刷する
            </button>
            <button onClick={handleSaveHTML}
              style={{flex:1,background:"linear-gradient(135deg,#059669,#10b981)",borderRadius:"10px",padding:"9px 0",fontSize:"12px",fontWeight:700,color:"white",border:"none",cursor:"pointer",boxShadow:"0 4px 12px rgba(16,185,129,0.3)"}}>
              💾 HTMLで保存
            </button>
            <button onClick={()=>setData(null)}
              style={{flex:1,background:"rgba(0,0,0,0.03)",border:`1px solid ${C.border}`,borderRadius:"10px",padding:"9px 0",fontSize:"12px",color:C.textMuted,cursor:"pointer"}}>
              🔄 再生成
            </button>
          </div>
          <div className="space-y-3">
            {data.sections.map((sec,i)=>{
              const color = SECTION_TYPE_COLOR[sec.type]||C.primary;
              const typeLabel = SECTION_TYPE_LABEL[sec.type]||sec.type;
              return (
                <div key={i} style={{background:C.card,border:`1px solid ${color}25`,borderRadius:"16px",overflow:"hidden"}}>
                  <div style={{background:`linear-gradient(135deg,${color}10,${color}05)`,borderBottom:`1px solid ${color}15`,padding:"12px 16px",display:"flex",alignItems:"center",gap:"10px"}}>
                    <span style={{background:color,color:"white",borderRadius:"8px",padding:"3px 10px",fontSize:"10px",fontWeight:800,flexShrink:0}}>{sec.section_number} / {typeLabel}</span>
                    <p style={{color:C.textMain,fontWeight:800,fontSize:"13px",flex:1}}>{sec.title}</p>
                  </div>
                  <div style={{padding:"14px 16px"}}>
                    {sec.headline&&<div style={{padding:"8px 12px",background:`${color}08`,borderLeft:`3px solid ${color}`,borderRadius:"0 8px 8px 0",marginBottom:"10px"}}>
                      <p style={{color:color,fontWeight:700,fontSize:"12px",lineHeight:1.5}}>{sec.headline}</p>
                    </div>}
                    {sec.content&&<p style={{color:C.textSub,fontSize:"12px",lineHeight:1.7,marginBottom:"10px"}}>{sec.content}</p>}
                    {(sec.bullets||[]).length>0&&(
                      <div className="space-y-2">
                        {sec.bullets.map((b,j)=>(
                          <div key={j} style={{display:"flex",alignItems:"flex-start",gap:"8px"}}>
                            <span style={{color:color,fontWeight:700,fontSize:"12px",flexShrink:0,marginTop:"2px"}}>▶</span>
                            <p style={{color:C.textSub,fontSize:"12px",lineHeight:1.6}}>{b}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    {sec.chart&&sec.chart.type!=="none"&&<ChartRenderer chart={sec.chart} color={color} dark={false}/>}
                    {sec.table&&<TableRenderer table={sec.table} color={color}/>}
                  </div>
                </div>
              );
            })}
            {data.appendix_notes&&(
              <div style={{background:"rgba(0,0,0,0.02)",border:`1px solid ${C.border}`,borderRadius:"12px",padding:"12px 16px"}}>
                <p style={{color:C.textMuted,fontSize:"11px",fontWeight:600,marginBottom:"4px"}}>📎 補足・参考資料</p>
                <p style={{color:C.textMuted,fontSize:"11px",lineHeight:1.6}}>{data.appendix_notes}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function buildEventPlanHTML(data: EventPlanData): string {
  const sectionColors: Record<string,string> = {
    purpose:"#4f46e5",target:"#0891b2",overview:"#059669",program:"#7c3aed",
    promotion:"#d97706",budget:"#059669",risk:"#ef4444",kpi:"#4f46e5",team:"#0891b2",appendix:"#6b7280",
  };
  const sectionLabels: Record<string,string> = {
    purpose:"目的",target:"ターゲット",overview:"概要",program:"プログラム",
    promotion:"集客",budget:"予算",risk:"リスク",kpi:"KPI",team:"体制",appendix:"補足",
  };
  const sections = data.sections.map(s=>{
    const color = sectionColors[s.type]||"#4f46e5";
    const tl = sectionLabels[s.type]||s.type;
    const bullets = (s.bullets||[]).map(b=>`<div class="bullet"><span style="color:${color}">▶</span><span>${b}</span></div>`).join("");
    const table = s.table ? `<table class="tbl"><thead><tr>${s.table.headers.map(h=>`<th style="background:${color}15;color:${color}">${h}</th>`).join("")}</tr></thead><tbody>${s.table.rows.map((r,i)=>`<tr style="background:${i%2===0?"#fafbff":"white"}">${r.map(c=>`<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table>` : "";
    return `<div class="section">
      <div class="sec-header" style="background:${color}0d;border-left:4px solid ${color}">
        <span class="badge" style="background:${color}">${tl}</span>
        <span class="sec-title">${s.title}</span>
      </div>
      <div class="sec-body">
        ${s.headline?`<div class="headline" style="border-left:3px solid ${color};color:${color}">${s.headline}</div>`:""}
        ${s.content?`<p class="content">${s.content}</p>`:""}
        <div class="bullets">${bullets}</div>
        ${table}
      </div>
    </div>`;
  }).join("");
  return `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><title>${data.title}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{font-family:'Noto Sans JP','Helvetica Neue',sans-serif;background:#f0f4f8;color:#111827;}
    .cover{background:linear-gradient(135deg,#0f172a,#1e293b);color:white;padding:56px 52px;page-break-after:always;}
    .cover-label{font-size:10px;font-weight:800;letter-spacing:0.2em;color:rgba(255,255,255,0.3);margin-bottom:14px;}
    .cover-title{font-size:32px;font-weight:900;line-height:1.3;margin-bottom:8px;}
    .cover-sub{font-size:14px;color:rgba(255,255,255,0.5);margin-bottom:24px;}
    .exec{background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:16px 20px;}
    .exec-label{font-size:9px;font-weight:700;letter-spacing:0.12em;color:rgba(255,255,255,0.3);margin-bottom:6px;}
    .exec-text{font-size:13px;line-height:1.8;color:rgba(255,255,255,0.8);}
    .section{background:white;margin:16px 0;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.06);}
    .sec-header{padding:12px 18px;display:flex;align-items:center;gap:10px;}
    .badge{color:white;border-radius:6px;padding:3px 10px;font-size:10px;font-weight:800;}
    .sec-title{font-size:15px;font-weight:800;color:#111827;}
    .sec-body{padding:16px 18px;}
    .headline{font-size:13px;font-weight:700;line-height:1.6;padding:8px 12px;background:#f8f9fc;border-radius:0 8px 8px 0;margin-bottom:10px;}
    .content{font-size:13px;color:#374151;line-height:1.7;margin-bottom:10px;}
    .bullets{display:flex;flex-direction:column;gap:6px;}
    .bullet{display:flex;gap:8px;font-size:12px;color:#374151;line-height:1.6;}
    .tbl{width:100%;border-collapse:collapse;font-size:12px;margin-top:12px;}
    .tbl th,.tbl td{border:1px solid #e5e7eb;padding:7px 10px;text-align:left;}
    .tbl th{font-weight:700;}
    .container{max-width:800px;margin:0 auto;padding:24px;}
    @media print{
      .cover{background:white !important;color:#111827 !important;border:2px solid #111827;}
      .cover-label{color:#6b7280 !important;}
      .cover-title{color:#111827 !important;}
      .cover-sub{color:#374151 !important;}
      .exec-summary{background:#f8f9fc !important;border:1px solid #e5e7eb !important;}
      .exec-label{color:#6b7280 !important;}
      .exec-text{color:#374151 !important;}body{background:white;}.cover{page-break-after:always;}}
  </style></head><body>
  <div class="cover">
    <div class="cover-label">ASCEND CONSULTING · Ys Consulting Office</div>
    <div class="cover-title">${data.title}</div>
    <div class="cover-sub">${data.subtitle}</div>
    <div class="exec"><div class="exec-label">EXECUTIVE SUMMARY</div><div class="exec-text">${data.executive_summary}</div></div>
  </div>
  <div class="container">${sections}
    ${data.appendix_notes?`<div class="section"><div class="sec-body"><p style="font-weight:700;margin-bottom:8px;color:#6b7280">📎 補足・参考資料</p><p class="content">${data.appendix_notes}</p></div></div>`:""}
  </div></body></html>`;
}

export default function PresentationTool() {
  const [toolMode, setToolMode] = useState<"presentation"|"event">("presentation");
  const formRef = useRef<HTMLDivElement>(null);
  const [form, setForm] = useState<Record<string,string>>({});
  const [slideCount, setSlideCount] = useState(6);
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState<"idle"|"stage1"|"stage2">("idle");
  const [error, setError] = useState("");
  const [data, setData] = useState<PresentationData|null>(null);
  const [activeSlide, setActiveSlide] = useState(0);
  const [viewMode, setViewMode] = useState<"list"|"preview"|"logic">("list");
  const [showAllFields, setShowAllFields] = useState(false);

  const setField = (key:string, val:string) => setForm(f=>({...f,[key]:val}));

  async function handleGenerate() {
    if (!form["decision_goal"]?.trim()) {
      setError("「意思決定ゴール」は必須です");
      return;
    }
    setError(""); setLoading(true); setData(null);
    const payload = { ...form, slide_count: slideCount, theme: form["theme"]||"" };
    const token = typeof window !== "undefined" ? localStorage.getItem("ascend_token")||"" : "";
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";
    try {
      // Stage1: 論理骨格生成
      setStage("stage1");
      const res1 = await fetch(`${API_BASE}/api/user/generate_slides_stage1`, {
        method:"POST",
        headers:{ "Content-Type":"application/json", Authorization:`Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (!res1.ok) { setError("論理骨格生成に失敗しました。再試行してください。"); setLoading(false); setStage("idle"); return; }
      const json1 = await res1.json();
      if (!json1.ok || !json1.logic) { setError("論理骨格生成に失敗しました。再試行してください。"); setLoading(false); setStage("idle"); return; }
      // Stage2: スライド生成
      setStage("stage2");
      const res2 = await fetch(`${API_BASE}/api/user/generate_slides`, {
        method:"POST",
        headers:{ "Content-Type":"application/json", Authorization:`Bearer ${token}` },
        body: JSON.stringify({ ...payload, prefetch_logic: json1.logic }),
      });
      if (!res2.ok) { setError("スライド生成に失敗しました。再試行してください。"); setLoading(false); setStage("idle"); return; }
      const json2 = await res2.json();
      if (!json2.ok || !json2.data) { setError("スライド生成に失敗しました。再試行してください。"); setLoading(false); setStage("idle"); return; }
      setData(json2.data);
      setActiveSlide(0);
      setViewMode("list");
    } catch(e) {
      setError("通信エラーが発生しました。");
    }
    setLoading(false); setStage("idle");
  }

  function handlePrint() {
    if (!data) return;
    const html = buildPrintHTML(data);
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 600);
  }

  function handleSaveHTML() {
    if (!data) return;
    const html = buildPrintHTML(data);
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${data.title || "presentation"}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const visibleFields = showAllFields ? FIELDS : FIELDS.slice(0, 4);

  return (
    <div className="space-y-4">
      {/* モード切替 */}
      <div style={{display:"flex",gap:"6px",background:C.card,border:`1px solid ${C.border}`,borderRadius:"14px",padding:"6px"}}>
        {([["presentation","📊 プレゼン資料"],["event","📋 イベント企画書"]] as const).map(([mode,label])=>(
          <button key={mode} onClick={()=>setToolMode(mode)}
            style={{flex:1,padding:"10px 0",borderRadius:"10px",fontSize:"13px",fontWeight:700,border:"none",cursor:"pointer",
              background:toolMode===mode?`linear-gradient(135deg,${C.primary},${C.primary2})`:"transparent",
              color:toolMode===mode?"white":C.textSub,boxShadow:toolMode===mode?C.shadowPrimary:"none",transition:"all 0.2s"}}>
            {label}
          </button>
        ))}
      </div>

      {toolMode==="event" && <EventPlanTool/>}
      {toolMode==="presentation" && <>
      {/* ヘッダー */}
      <div ref={formRef} style={{background:"linear-gradient(135deg,#0f0c29,#302b63,#24243e)",borderRadius:"20px",padding:"24px 24px 20px",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:"-30px",right:"-30px",width:"180px",height:"180px",background:"radial-gradient(circle,rgba(99,102,241,0.12) 0%,transparent 70%)",pointerEvents:"none"}}/>
        <p style={{color:"rgba(255,255,255,0.3)",fontSize:"9px",fontWeight:800,letterSpacing:"0.2em",marginBottom:"6px"}}>ASCEND CONSULTING TOOLS</p>
        <h2 style={{color:"white",fontWeight:900,fontSize:"20px",marginBottom:"4px"}}>📊 プレゼン資料作成</h2>
        <p style={{color:"rgba(255,255,255,0.45)",fontSize:"12px",lineHeight:1.6}}>意思決定構造を入力 → 論理骨格生成 → コンサルスライド化</p>
        <div style={{display:"flex",gap:"8px",marginTop:"12px",flexWrap:"wrap"}}>
          {(["① 構造入力","② 論理骨格生成（AI）","③ スライド化（AI）"] as const).map((s,i)=>{
            const isActive = (!loading&&!data&&i===0)||(loading&&stage==="stage1"&&i===1)||(loading&&stage==="stage2"&&i===2)||(!!data&&!loading&&i===2);
            const isDone = (!!data&&!loading&&i<3)||(loading&&stage==="stage2"&&i===0);
            return (
              <div key={i} style={{display:"flex",alignItems:"center",gap:"4px"}}>
                <span style={{
                  background:isDone?"rgba(16,185,129,0.3)":isActive?"rgba(99,102,241,0.6)":"rgba(255,255,255,0.06)",
                  border:isDone?"1px solid rgba(16,185,129,0.5)":isActive?"1px solid rgba(99,102,241,0.8)":"1px solid rgba(255,255,255,0.1)",
                  borderRadius:"6px",padding:"3px 10px",fontSize:"10px",fontWeight:700,
                  color:isDone?"#6ee7b7":isActive?"white":"rgba(255,255,255,0.35)",
                  boxShadow:isActive?"0 0 12px rgba(99,102,241,0.5)":"none",
                  transition:"all 0.4s ease",
                }}>{isDone?"✓ "+s:s}</span>
                {i<2&&<span style={{color:"rgba(255,255,255,0.2)",fontSize:"10px"}}>→</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* 入力フォーム */}
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:"16px",boxShadow:C.shadow,padding:"20px"}} className="space-y-4">
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <p style={{color:C.textMain,fontWeight:800,fontSize:"14px"}}>🧱 意思決定構造の設計</p>
          <span style={{fontSize:"10px",color:C.textMuted}}>* 必須</span>
        </div>

        {visibleFields.map(f=>(
          <div key={f.key}>
            <div style={{display:"flex",alignItems:"baseline",gap:"6px",marginBottom:"4px"}}>
              <p style={{color:C.textMain,fontSize:"12px",fontWeight:700}}>
                {f.label}
                {f.required&&<span style={{color:"#ef4444",marginLeft:"4px"}}>*必須</span>}
              </p>
              <p style={{color:C.textMuted,fontSize:"10px"}}>{f.desc}</p>
            </div>
            <textarea
              value={form[f.key]||""}
              onChange={e=>setField(f.key,e.target.value)}
              placeholder={f.placeholder}
              rows={2}
              style={{width:"100%",background:f.required&&!form[f.key]?"rgba(239,68,68,0.03)":C.bg,border:f.required&&!form[f.key]?"1px solid rgba(239,68,68,0.3)":`1px solid ${C.border}`,borderRadius:"10px",padding:"10px 12px",fontSize:"12px",color:C.textMain,resize:"vertical",lineHeight:1.6}}
            />
          </div>
        ))}

        <button onClick={()=>setShowAllFields(v=>!v)}
          style={{width:"100%",background:"rgba(0,0,0,0.03)",border:`1px dashed ${C.border}`,borderRadius:"10px",padding:"8px 0",fontSize:"12px",color:C.textMuted,cursor:"pointer"}}>
          {showAllFields ? "▲ 入力欄を折りたたむ" : `▼ さらに詳細を入力する（+${FIELDS.length-4}項目）`}
        </button>

        {/* スライド枚数 */}
        <div>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:"6px"}}>
            <p style={{color:C.textSub,fontSize:"12px",fontWeight:600}}>スライド枚数</p>
            <span style={{color:C.primary,fontWeight:700,fontSize:"13px"}}>{slideCount}枚</span>
          </div>
          <input type="range" min={3} max={12} step={1} value={slideCount}
            onChange={e=>setSlideCount(Number(e.target.value))}
            style={{width:"100%",accentColor:C.primary}}/>
          <div style={{display:"flex",justifyContent:"space-between"}}>
            <span style={{fontSize:"10px",color:C.textMuted}}>3枚（簡潔）</span>
            <span style={{fontSize:"10px",color:C.textMuted}}>12枚（詳細）</span>
          </div>
        </div>

        {error && <p style={{color:"#ef4444",fontSize:"12px",fontWeight:600}}>{error}</p>}

        {/* 生成中ステータス */}
        {loading && (
          <div style={{background:"rgba(79,70,229,0.04)",border:`1px solid ${C.borderPrimary}`,borderRadius:"12px",padding:"14px 16px"}}>
            <div style={{display:"flex",gap:"12px",alignItems:"center"}}>
              <div style={{width:"32px",height:"32px",borderRadius:"50%",border:"3px solid rgba(79,70,229,0.2)",borderTop:`3px solid ${C.primary}`,animation:"spin 1s linear infinite",flexShrink:0}}/>
              <div>
                <p style={{color:C.primary,fontWeight:700,fontSize:"13px",marginBottom:"2px"}}>
                  {stage==="stage1"?"① 論理骨格を設計中...（Pyramid Principle適用）":"② スライドを構築中...（SCR論理連鎖）"}
                </p>
                <p style={{color:C.textMuted,fontSize:"11px"}}>
                  {stage==="stage1"?"Situation / Complication / Resolution を構造化しています":"論理骨格をスライドに変換しています"}
                </p>
              </div>
            </div>
          </div>
        )}

        <button onClick={handleGenerate} disabled={loading}
          style={{width:"100%",background:loading?"rgba(0,0,0,0.08)":`linear-gradient(135deg,${C.primary},${C.primary2})`,borderRadius:"12px",boxShadow:loading?"none":C.shadowPrimary,border:"none",cursor:loading?"not-allowed":"pointer",padding:"14px 0"}}>
          <span style={{color:loading?"#999":"white",fontWeight:800,fontSize:"14px"}}>
            {loading?"生成中..." : "✨ 論理構造からスライドを生成する"}
          </span>
        </button>
      </div>

      {/* 生成結果 */}
      {data && (
        <div className="space-y-3">
          {/* ガバニングソート */}
          {data.logic_skeleton?.governing_thought && (
            <div style={{background:"linear-gradient(135deg,#0f0c29,#1e1b4b)",borderRadius:"16px",padding:"16px 20px"}}>
              <p style={{color:"rgba(255,255,255,0.3)",fontSize:"9px",fontWeight:800,letterSpacing:"0.15em",marginBottom:"6px"}}>GOVERNING THOUGHT · So What</p>
              <p style={{color:"white",fontWeight:800,fontSize:"15px",lineHeight:1.5}}>{data.logic_skeleton.governing_thought}</p>
            </div>
          )}

          {/* エグゼクティブサマリー */}
          <div style={{background:`rgba(79,70,229,0.05)`,border:`1px solid ${C.borderPrimary}`,borderRadius:"16px",padding:"16px 20px"}}>
            <p style={{color:C.primary,fontWeight:800,fontSize:"12px",marginBottom:"6px"}}>📌 Executive Summary</p>
            <p style={{color:C.textMain,fontSize:"13px",lineHeight:1.7}}>{data.executive_summary}</p>
          </div>

          {/* 操作バー */}
          <div style={{display:"flex",gap:"6px",flexWrap:"wrap"}}>
            {(["list","preview","logic"] as const).map(m=>(
              <button key={m} onClick={()=>setViewMode(m)}
                style={{flex:1,background:viewMode===m?`linear-gradient(135deg,${C.primary},${C.primary2})`:C.card,border:viewMode===m?"none":`1px solid ${C.border}`,borderRadius:"10px",padding:"8px 0",fontSize:"11px",fontWeight:700,color:viewMode===m?"white":C.textSub,cursor:"pointer",boxShadow:viewMode===m?C.shadowPrimary:C.shadow}}>
                {m==="list"?"📋 一覧":m==="preview"?"🖥️ プレビュー":"🧠 論理骨格"}
              </button>
            ))}
            <button onClick={handlePrint}
              style={{flex:1,background:"linear-gradient(135deg,#059669,#10b981)",borderRadius:"10px",padding:"8px 0",fontSize:"11px",fontWeight:700,color:"white",border:"none",cursor:"pointer",boxShadow:"0 4px 12px rgba(16,185,129,0.3)"}}>
              🖨️ 印刷
            </button>
            <button onClick={handleSaveHTML}
              style={{flex:1,background:"linear-gradient(135deg,#d97706,#f59e0b)",borderRadius:"10px",padding:"8px 0",fontSize:"11px",fontWeight:700,color:"white",border:"none",cursor:"pointer",boxShadow:"0 4px 12px rgba(245,158,11,0.3)"}}>
              💾 HTML保存
            </button>
          </div>

          <button onClick={()=>{setData(null);setViewMode("list");setTimeout(()=>formRef.current?.scrollIntoView({behavior:"smooth",block:"start"}),100);}}
            style={{width:"100%",background:"rgba(0,0,0,0.03)",border:`1px solid ${C.border}`,borderRadius:"10px",padding:"8px 0",fontSize:"12px",color:C.textMuted,cursor:"pointer"}}>
            🔄 条件を変えて再生成
          </button>

          {/* 論理骨格ビュー */}
          {viewMode==="logic" && data.logic_skeleton && (
            <div className="space-y-3">
              {[
                {label:"S - Situation（現状）", val:data.logic_skeleton.situation, color:"#059669"},
                {label:"C - Complication（問題）", val:data.logic_skeleton.complication, color:"#dc2626"},
                {label:"R - Resolution（解決策）", val:data.logic_skeleton.resolution, color:"#4f46e5"},
                {label:"論理の流れ", val:data.logic_skeleton.logic_flow, color:"#7c3aed"},
              ].map((item,i)=>(
                <div key={i} style={{background:C.card,border:`1px solid ${item.color}20`,borderRadius:"14px",overflow:"hidden"}}>
                  <div style={{background:`${item.color}10`,borderBottom:`1px solid ${item.color}15`,padding:"10px 16px"}}>
                    <p style={{color:item.color,fontWeight:800,fontSize:"12px"}}>{item.label}</p>
                  </div>
                  <p style={{color:C.textSub,fontSize:"13px",lineHeight:1.7,padding:"12px 16px"}}>{item.val}</p>
                </div>
              ))}
              <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:"14px",padding:"14px 16px"}}>
                <p style={{color:"#d97706",fontWeight:800,fontSize:"12px",marginBottom:"8px"}}>⚠️ 想定反論と対策</p>
                {(data.logic_skeleton.objections||[]).map((o,i)=>(
                  <div key={i} style={{display:"flex",gap:"8px",marginBottom:"6px"}}>
                    <span style={{color:"#d97706",fontWeight:700,fontSize:"11px",flexShrink:0}}>Q{i+1}</span>
                    <p style={{color:C.textSub,fontSize:"12px",lineHeight:1.6}}>{o}</p>
                  </div>
                ))}
              </div>
              <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:"14px",padding:"14px 16px"}}>
                <p style={{color:"#059669",fontWeight:800,fontSize:"12px",marginBottom:"8px"}}>✅ 成功指標</p>
                {(data.logic_skeleton.success_metrics||[]).map((m,i)=>(
                  <div key={i} style={{display:"flex",gap:"8px",marginBottom:"6px"}}>
                    <span style={{color:"#059669",fontWeight:700,fontSize:"11px",flexShrink:0}}>▶</span>
                    <p style={{color:C.textSub,fontSize:"12px",lineHeight:1.6}}>{m}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* スライド一覧 */}
          {viewMode==="list" && (
            <div className="space-y-3">
              {data.slides.map((slide, i) => {
                const color = SLIDE_TYPE_COLOR[slide.type] || C.primary;
                const typeLabel = SLIDE_TYPE_LABEL[slide.type] || slide.type;
                return (
                  <div key={i} style={{background:C.card,border:`1px solid ${color}25`,borderRadius:"16px",boxShadow:C.shadow,overflow:"hidden"}}>
                    <div style={{background:`linear-gradient(135deg,${color}10,${color}05)`,borderBottom:`1px solid ${color}15`,padding:"12px 16px",display:"flex",alignItems:"center",gap:"10px"}}>
                      <span style={{background:color,color:"white",borderRadius:"8px",padding:"3px 10px",fontSize:"10px",fontWeight:800,flexShrink:0}}>{slide.slide_number} / {typeLabel}</span>
                      <p style={{color:C.textMain,fontWeight:800,fontSize:"13px",flex:1}}>{slide.title}</p>
                    </div>
                    <div style={{padding:"14px 16px"}}>
                      <div style={{padding:"8px 12px",background:`${color}08`,borderLeft:`3px solid ${color}`,borderRadius:"0 8px 8px 0",marginBottom:"10px"}}>
                        <p style={{color:color,fontWeight:700,fontSize:"12px",lineHeight:1.5}}>{slide.headline}</p>
                      </div>
                      {(slide.bullets||[]).length>0&&(
                        <div className="space-y-2">
                          {slide.bullets.map((b,j)=>(
                            <div key={j} style={{display:"flex",alignItems:"flex-start",gap:"8px"}}>
                              <span style={{color:color,fontWeight:700,fontSize:"12px",flexShrink:0,marginTop:"2px"}}>▶</span>
                              <p style={{color:C.textSub,fontSize:"12px",lineHeight:1.6}}>{b}</p>
                            </div>
                          ))}
                        </div>
                      )}
                      {slide.data_label&&<div style={{marginTop:"10px",background:"rgba(0,0,0,0.03)",border:`1px solid ${C.border}`,borderRadius:"8px",padding:"6px 10px"}}><p style={{color:C.textMuted,fontSize:"10px",fontWeight:600}}>📊 {slide.data_label}</p></div>}
                      {slide.note&&<p style={{color:C.textMuted,fontSize:"10px",marginTop:"8px",fontStyle:"italic"}}>💬 {slide.note}</p>}
                      {slide.chart && slide.chart.type !== "none" && <ChartRenderer chart={slide.chart} color={color} dark={false}/>}
                    </div>
                  </div>
                );
              })}
              {data.appendix_notes&&(
                <div style={{background:"rgba(0,0,0,0.02)",border:`1px solid ${C.border}`,borderRadius:"12px",padding:"12px 16px"}}>
                  <p style={{color:C.textMuted,fontSize:"11px",fontWeight:600,marginBottom:"4px"}}>📎 補足・出典・前提条件</p>
                  <p style={{color:C.textMuted,fontSize:"11px",lineHeight:1.6}}>{data.appendix_notes}</p>
                </div>
              )}
            </div>
          )}

          {/* プレビューモード */}
          {viewMode==="preview" && (
            <div>
              <div style={{display:"flex",gap:"4px",flexWrap:"wrap",marginBottom:"12px"}}>
                {data.slides.map((s,i)=>{
                  const color = SLIDE_TYPE_COLOR[s.type]||C.primary;
                  return (
                    <button key={i} onClick={()=>setActiveSlide(i)}
                      style={{padding:"4px 10px",borderRadius:"8px",fontSize:"11px",fontWeight:700,border:"none",cursor:"pointer",background:activeSlide===i?color:"rgba(0,0,0,0.05)",color:activeSlide===i?"white":C.textMuted}}>
                      {s.slide_number}
                    </button>
                  );
                })}
              </div>
              {(()=>{
                const slide = data.slides[activeSlide];
                if (!slide) return null;
                const color = SLIDE_TYPE_COLOR[slide.type]||C.primary;
                const typeLabel = SLIDE_TYPE_LABEL[slide.type]||slide.type;
                return (
                  <div style={{background:"linear-gradient(135deg,#0f0c29,#1e1b4b)",borderRadius:"20px",padding:"32px",minHeight:"340px",position:"relative",overflow:"hidden",boxShadow:"0 8px 40px rgba(0,0,0,0.3)"}}>
                    <div style={{position:"absolute",top:0,right:0,width:"200px",height:"200px",background:`radial-gradient(circle,${color}15 0%,transparent 70%)`,pointerEvents:"none"}}/>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"20px"}}>
                      <span style={{background:color,color:"white",borderRadius:"8px",padding:"4px 12px",fontSize:"10px",fontWeight:800}}>{typeLabel}</span>
                      <span style={{color:"rgba(255,255,255,0.2)",fontSize:"11px",fontWeight:600}}>{slide.slide_number} / {data.slides.length}</span>
                    </div>
                    <p style={{color:"white",fontWeight:900,fontSize:"20px",lineHeight:1.3,marginBottom:"14px"}}>{slide.title}</p>
                    <div style={{background:`${color}20`,borderLeft:`3px solid ${color}`,borderRadius:"0 8px 8px 0",padding:"10px 14px",marginBottom:"16px"}}>
                      <p style={{color:color,fontWeight:700,fontSize:"13px",lineHeight:1.5}}>{slide.headline}</p>
                    </div>
                    <div className="space-y-2">
                      {(slide.bullets||[]).map((b,j)=>(
                        <div key={j} style={{display:"flex",alignItems:"flex-start",gap:"8px"}}>
                          <span style={{color:color,fontWeight:700,fontSize:"12px",flexShrink:0,marginTop:"2px"}}>▶</span>
                          <p style={{color:"rgba(255,255,255,0.75)",fontSize:"12px",lineHeight:1.6}}>{b}</p>
                        </div>
                      ))}
                    </div>
                    {slide.data_label&&<div style={{marginTop:"14px",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:"8px",padding:"8px 12px"}}><p style={{color:"rgba(255,255,255,0.4)",fontSize:"10px",fontWeight:600}}>📊 {slide.data_label}</p></div>}
                    {slide.chart && slide.chart.type !== "none" && <ChartRenderer chart={slide.chart} color={color} dark={true}/>}
                    <div style={{marginTop:"20px",paddingTop:"14px",borderTop:"1px solid rgba(255,255,255,0.06)",display:"flex",justifyContent:"space-between"}}>
                      <p style={{color:"rgba(255,255,255,0.15)",fontSize:"9px",fontWeight:600,letterSpacing:"0.1em"}}>ASCEND · Ys Consulting Office</p>
                      <p style={{color:`${color}60`,fontSize:"9px",fontWeight:700,letterSpacing:"0.1em"}}>CONFIDENTIAL</p>
                    </div>
                    <div style={{display:"flex",justifyContent:"space-between",marginTop:"16px"}}>
                      <button onClick={()=>setActiveSlide(i=>Math.max(0,i-1))} disabled={activeSlide===0}
                        style={{background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:"8px",padding:"6px 14px",color:"rgba(255,255,255,0.5)",fontSize:"12px",fontWeight:600,cursor:activeSlide===0?"not-allowed":"pointer"}}>← 前へ</button>
                      <button onClick={()=>setActiveSlide(i=>Math.min(data.slides.length-1,i+1))} disabled={activeSlide===data.slides.length-1}
                        style={{background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:"8px",padding:"6px 14px",color:"rgba(255,255,255,0.5)",fontSize:"12px",fontWeight:600,cursor:activeSlide===data.slides.length-1?"not-allowed":"pointer"}}>次へ →</button>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      </>}
    </div>
  );
}

function buildPrintHTML(data: PresentationData): string {
  const slideColors: Record<string,string> = {
    cover:"#4f46e5",agenda:"#0891b2",situation:"#059669",complication:"#dc2626",
    resolution:"#7c3aed",data:"#d97706",recommendation:"#4f46e5",risk:"#ef4444",
    execution:"#0891b2",conclusion:"#111827",content:"#059669",
  };
  const typeLabel: Record<string,string> = {
    cover:"表紙",agenda:"目次",situation:"現状",complication:"問題",
    resolution:"解決策",data:"データ",recommendation:"提言",risk:"リスク",
    execution:"実行",conclusion:"結論",content:"本編",
  };
  const logic = data.logic_skeleton;
  const logicPage = logic ? `
  <div class="slide logic-page">
    <h2 class="slide-title" style="margin-bottom:20px">🧠 論理骨格（Pyramid Principle）</h2>
    <div style="background:#f8f9fc;border-left:4px solid #4f46e5;padding:14px 18px;border-radius:0 10px 10px 0;margin-bottom:16px">
      <p style="font-size:10px;font-weight:800;color:#6b7280;margin-bottom:4px;letter-spacing:0.1em">GOVERNING THOUGHT</p>
      <p style="font-size:15px;font-weight:900;color:#111827">${logic.governing_thought}</p>
    </div>
    ${[["S - Situation","#059669",logic.situation],["C - Complication","#dc2626",logic.complication],["R - Resolution","#7c3aed",logic.resolution]].map(([l,c,v])=>`
    <div style="border-left:3px solid ${c};padding:10px 14px;margin-bottom:10px">
      <p style="font-size:10px;font-weight:800;color:${c};margin-bottom:4px">${l}</p>
      <p style="font-size:13px;color:#374151;line-height:1.6">${v}</p>
    </div>`).join("")}
  </div>` : "";
  const slides = data.slides.map((s, idx)=>{
    const color = slideColors[s.type]||"#4f46e5";
    const tl = typeLabel[s.type]||s.type;
    const bullets = (s.bullets||[]).map(b=>`<div class="bullet"><span class="arrow" style="color:${color}">▶</span><span>${b}</span></div>`).join("");
    const breakClass = "";
    return `
    <div class="slide${breakClass}">
      <div class="slide-header">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
          <span class="badge" style="background:${color}">${tl}</span>
          <span class="slide-num">${s.slide_number} / ${data.slides.length}</span>
        </div>
        <h2 class="slide-title">${s.title}</h2>
      </div>
      <div class="slide-body">
        <div class="headline" style="border-left:3px solid ${color};color:${color}">${s.headline}</div>
        <div class="bullets">${bullets}</div>
        ${s.data_label?`<div class="data-label">📊 ${s.data_label}</div>`:""}
        ${s.note?`<div class="note">💬 ${s.note}</div>`:""}
      </div>
      <div class="slide-footer">
        <span>ASCEND · Ys Consulting Office</span>
        <span style="color:${color}">CONFIDENTIAL</span>
      </div>
    </div>`;
  }).join("");
  return `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><title>${data.title}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{font-family:'Noto Sans JP','Helvetica Neue',sans-serif;background:#f0f0f0;color:#111827;}
    .cover{background:linear-gradient(135deg,#0f0c29,#302b63,#24243e);color:white;padding:40px 48px;page-break-after:always;page-break-inside:avoid;}
    .cover-label{font-size:10px;font-weight:800;letter-spacing:0.2em;color:rgba(255,255,255,0.3);margin-bottom:12px;}
    .cover-title{font-size:28px;font-weight:900;line-height:1.3;margin-bottom:8px;}
    .cover-sub{font-size:13px;color:rgba(255,255,255,0.55);margin-bottom:20px;}
    .exec-summary{background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:14px 18px;}
    .exec-label{font-size:9px;font-weight:700;letter-spacing:0.1em;color:rgba(255,255,255,0.3);margin-bottom:5px;}
    .exec-text{font-size:12px;line-height:1.7;color:rgba(255,255,255,0.8);}
    .slide{background:white;padding:24px 32px;border-bottom:2px solid #e5e7eb;margin-bottom:0;}
    .slide-break{page-break-after:always;}
    .logic-page{background:#fafbff;padding:24px 32px;page-break-inside:avoid;border-bottom:2px solid #e5e7eb;}
    .slide-header{border-bottom:1px solid #e5e7eb;padding-bottom:10px;margin-bottom:14px;}
    .badge{color:white;border-radius:5px;padding:2px 10px;font-size:9px;font-weight:800;}
    .slide-num{color:#9ca3af;font-size:10px;font-weight:600;}
    .slide-title{font-size:17px;font-weight:900;color:#111827;margin-top:6px;}
    .slide-body{flex:1;}
    .headline{font-size:12px;font-weight:700;line-height:1.6;padding:8px 12px;background:#f8f9fc;border-radius:0 6px 6px 0;margin-bottom:10px;}
    .bullets{display:flex;flex-direction:column;gap:6px;}
    .bullet{display:flex;align-items:flex-start;gap:6px;font-size:12px;line-height:1.6;color:#374151;}
    .arrow{font-weight:700;font-size:11px;flex-shrink:0;margin-top:2px;}
    .data-label{margin-top:10px;background:#f8f9fc;border:1px solid #e5e7eb;border-radius:5px;padding:5px 10px;font-size:10px;color:#6b7280;font-weight:600;}
    .note{margin-top:8px;font-size:10px;color:#9ca3af;font-style:italic;}
    .slide-footer{border-top:1px solid #e5e7eb;padding-top:8px;margin-top:14px;display:flex;justify-content:space-between;font-size:8px;font-weight:600;letter-spacing:0.1em;color:#d1d5db;}
    @media print{
      .cover{background:white !important;color:#111827 !important;border:2px solid #111827;}
      .cover-label{color:#6b7280 !important;}
      .cover-title{color:#111827 !important;}
      .cover-sub{color:#374151 !important;}
      .exec-summary{background:#f8f9fc !important;border:1px solid #e5e7eb !important;}
      .exec-label{color:#6b7280 !important;}
      .exec-text{color:#374151 !important;}
      body{background:white;}
      .cover{page-break-after:always;}
      .slide{border-bottom:1px solid #e5e7eb;}
      .slide-break{page-break-after:always;}
    }
  </style></head><body>
  <div class="cover">
    <div class="cover-label">ASCEND CONSULTING · Ys Consulting Office</div>
    <div class="cover-title">${data.title}</div>
    <div class="cover-sub">${data.subtitle}</div>
    <div class="exec-summary">
      <div class="exec-label">EXECUTIVE SUMMARY</div>
      <div class="exec-text">${data.executive_summary}</div>
    </div>
  </div>
  ${logicPage}
  ${slides}
  ${data.appendix_notes?`<div class="slide"><h2 class="slide-title" style="margin-bottom:16px">📎 補足・出典・前提条件</h2><p style="font-size:13px;color:#6b7280;line-height:1.8">${data.appendix_notes}</p></div>`:""}
  </body></html>`;
}
