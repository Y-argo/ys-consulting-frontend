"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getMyFeatures, getUserStats } from "@/lib/api";

const PRIMARY = "#6366f1";
const PRIMARY2 = "#8b5cf6";
const DARK = "linear-gradient(135deg,#0f172a 0%,#1e293b 50%,#0f0c29 100%)";

type FeatureItem = { name: string; desc: string; url: string; flag?: string };

export default function AscendAboutPage() {
  const router = useRouter();
  const [features, setFeatures] = useState<Record<string, boolean>>({});
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [f, s] = await Promise.all([
          getMyFeatures().catch(() => null),
          getUserStats().catch(() => null),
        ]);
        const ff = (f as any) || {};
        setFeatures(ff);
        setStats(s);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleNavigate = (url: string, flag?: string) => {
    if (flag && features[flag] !== true) {
      setToast("未開放のため現在ご利用できません");
      setTimeout(() => setToast(""), 2500);
      return;
    }
    router.push(url);
  };

  const groups: { icon: string; title: string; items: FeatureItem[] }[] = [
    { icon: "🤖", title: "AIチャット系", items: [
        { name: "AIチャット", desc: "テキスト・画像・ファイル対応のメインチャット機能", url: "/chat" },
        { name: "画像解析", desc: "画像をアップロードしてAIが詳細解析", url: "/chat" },
        { name: "ファイル解析", desc: "PDF・Excel等の資料を読み込み解析", url: "/chat" },
      ] },
    { icon: "🔬", title: "診断系", items: [
        { name: "現状課題診断", desc: "現状を構造化し本質的な課題を診断", url: "/diagnosis?tab=diagnosis", flag: "current_issue_diagnosis" },
        { name: "構造診断", desc: "事象を解剖し構造を可視化", url: "/diagnosis?tab=structure", flag: "diag_structure" },
        { name: "課題仮説", desc: "課題仮説を体系的に生成", url: "/diagnosis?tab=issue", flag: "diag_issue" },
        { name: "比較分析", desc: "選択肢を多次元で比較評価", url: "/diagnosis?tab=comparison", flag: "diag_comparison" },
        { name: "矛盾検知", desc: "論理矛盾・整合性ズレを検出", url: "/diagnosis?tab=contradiction", flag: "diag_contradiction" },
        { name: "実行計画", desc: "実行プランの設計・分析", url: "/diagnosis?tab=execution", flag: "diag_execution" },
        { name: "投資シグナル", desc: "投資判断シグナルを分析", url: "/diagnosis?tab=investment", flag: "diag_investment" },
        { name: "思考マップ", desc: "思考の構造をグラフ化", url: "/diagnosis?tab=graph", flag: "diag_graph" },
        { name: "ファイル診断", desc: "Excel/PDF等を数値分析+AI解釈", url: "/diagnosis?tab=file", flag: "diag_file" },
        { name: "未来分岐シミュレーター", desc: "将来の分岐を予測", url: "/diagnosis?tab=future", flag: "diag_future" },
      ] },
    { icon: "📊", title: "分析・レポート", items: [
        { name: "Decision Metrics", desc: "意思決定6指標スコアリング", url: "/mypage?tab=metrics", flag: "decision_metrics" },
        { name: "固定概念レポート", desc: "思考の固定概念を分析", url: "/mypage?tab=fc", flag: "fixed_concept_report" },
        { name: "プレゼン資料生成", desc: "スライドを自動生成", url: "/diagnosis?tab=presentation", flag: "diag_presentation" },
        { name: "🕵️ プロファイル生成", desc: "特徴入力→人柄・行動パターン・強み・接し方を推定（APEX/ULTRA）", url: "/diagnosis?tab=profile", flag: "diag_profile" },
      ] },
    { icon: "🎨", title: "生成系", items: [
        { name: "画像生成", desc: "AIで画像を生成", url: "/chat", flag: "image_generation" },
        { name: "生成画像ギャラリー", desc: "生成画像を一覧管理", url: "/gallery", flag: "image_gallery" },
      ] },
    { icon: "💬", title: "相談", items: [
        { name: "個人相談", desc: "専門コンサルへの個別相談", url: "/inquiry", flag: "personal_consulting" },
      ] },
    { icon: "⚙️", title: "プラットフォーム", items: [
        { name: "ランクシステム", desc: "活用度（level_score）が上がると追従者→実行者→戦略家→設計者の4段階の称号が変化する成長可視化システム", url: "/mypage" },
        { name: "マイページ", desc: "統計・履歴・設定", url: "/mypage" },
        { name: "プラン管理", desc: "ご利用プランの確認・変更", url: "/plan" },
        { name: "用途別モード切替", desc: "用途に応じて柔軟にモード切替", url: "/chat" },
      ] },
    { icon: "🚀", title: "AIエンジン（3段階）", items: [
        { name: "⚡ SWIFT（迅速）", desc: "高速レスポンス・AUTO/7モード対応。日常的な戦略相談・施策整理に最適で、常時ご利用可能です。", url: "/chat" },
        { name: "✨ ADVANCE（高度）", desc: "全19モード対応の高精度エンジン。ファイル診断・固定概念レポート・画像生成・個人相談などが解放されます。", url: "/chat", flag: "ascend_ultra" },
        { name: "👑 SUPREME（至高）", desc: "全機能解放の最上位エンジン。投資シグナルを含む全19モード・全機能で最高難度の経営判断に対応します。", url: "/chat", flag: "ascend_apex" },
      ] },
  ];

  const howTo = [
    { n: 1, t: "ログイン・プラン確認", d: "発行されたIDでログインし、ご利用可能なプランと機能を確認します。" },
    { n: 2, t: "目的に応じたモードを選択", d: "上部のモード選択バーで相談・分析・実行など用途別モードを切替えます。" },
    { n: 3, t: "AIに相談・診断を実行", d: "チャット・診断タブで質問やファイルを投入。AIが構造化した回答を返します。" },
    { n: 4, t: "レポート・履歴を確認", d: "マイページから過去の診断・固定概念レポート・利用履歴を閲覧できます。" },
    { n: 5, t: "ランクで成長を確認・プランで機能を解放", d: "活用度に応じてレベルスコアが加算され称号が変化します（追従者→設計者）。ADVANCE・SUPREME等の上位機能はプランのアップグレードまたは管理者の権限付与により解放されます。" },
  ];

  const faqs = [
    { q: "ASCENDとは何ですか？", a: "戦略・数値・構造・リスク——あらゆる経営判断に即応するAIコンサルティングエンジンです。一般的なチャットAIではなく、診断・分析・実行支援に特化した経営判断専用のエンジンです。" },
    { q: "プランによって使える機能は違いますか？", a: "はい。STARTER / STANDARD / PRO / APEX / ULTRA の5段階プランがあり、上位プランほど高度な診断・分析・上位AIエンジンが利用可能です。詳細はプラン管理ページでご確認ください。" },
    { q: "ランクはどうやって上がりますか？", a: "チャット・診断・相談などのご利用に応じてレベルスコアが加算され、追従者→実行者→戦略家→設計者の4段階の称号が変化します。ランクは成長の可視化指標であり、ADVANCE・SUPREME等の上位機能の解放はプランのアップグレードまたは管理者の権限付与によります。" },
    { q: "ファイル診断はどんな形式に対応していますか？", a: "xlsx / xls / ods / csv / txt / pdf / md に対応しております。pandasで数値分析した上でChain of ThoughtでAIが解釈する独自方式です。" },
    { q: "AIエンジンのSWIFT / ADVANCE / SUPREMEの違いは？", a: "SWIFT（迅速）は高速レスポンスでAUTO/7モード対応、日常的な戦略相談・アイデア出しに最適です。ADVANCE（高度）は全19モード対応の高精度エンジンで、ファイル診断・固定概念レポート・画像生成等が解放されます。SUPREME（至高）は全機能解放の最上位エンジンで、投資シグナルを含む全機能が利用可能です。プラン・権限により段階的に解放されます。" },
    { q: "登録業種以外の質問もできますか？", a: "はい、汎用的な経営相談や戦略相談には全て対応します。ただし、登録業種に特化したRAG検索結果は登録業種に紐付いた事例から優先的に取得されます。" },
    { q: "画像解析・ファイル解析の精度はどの程度ですか？", a: "画像はマルチモーダルAIによる詳細解析、ファイルはpandasによる数値分析+AI解釈の二段構えで、単純な要約ではなく実質的な分析結果を返します。" },
    { q: "個人相談と現状課題診断の違いは何ですか？", a: "個人相談は専門コンサルへの非同期メッセージ相談（人による回答）、現状課題診断はAIによる即時の構造化診断です。両方を使い分けることでより深い洞察が得られます。" },
    { q: "Decision Metrics（DM）とは何ですか？", a: "意思決定の質をQ（精度）/ R（リスク耐性）/ S（構造理解）/ V（速度）/ P（予測）/ E（実行）の6指標でスコアリングし、総合ランクで可視化する独自指標です。" },
    { q: "投資シグナル機能は誰でも使えますか？", a: "デフォルトでは無効化されており、利用には個別の権限付与が必要です。ご希望の場合は管理者にお問い合わせください。" },
    { q: "履歴やレポートのデータは保存されますか？", a: "Firestore上に安全に保存されます。マイページから過去の診断レポート・チャット履歴・固定概念レポートを閲覧できます。" },
    { q: "未開放と表示される機能はどうすれば使えますか？", a: "プランのアップグレード、または管理者による権限付与が必要です。ご希望の機能がある場合はプラン管理、または個人相談からご相談ください。" },
    { q: "登録業種とは何ですか？", a: "ご契約時に登録された業種・店舗情報で、AIの応答や事例検索の優先度に反映されます。マイページから確認できます。" },
    { q: "ファイル診断と通常チャットのファイル解析の違いは？", a: "通常チャットは添付ファイルへの応答、ファイル診断はPython数値分析を行い専用のChain of Thoughtで深く解釈する専門機能です。" },
    { q: "ASCENDの名前の由来は？", a: "A=Architectural Analysis（構造解剖）、S=Scoring & Scale（階級スコア）、C=Case-driven RAG（事例駆動検索）、E=Executor Strategy（戦術執行）、N=Nurturing/Mentor（育成・導師）、D=Dynamic Routing & Diagnosis（動的診断）の頭字語です。" },
  ];

  return (
    <div style={{minHeight:"100vh",background:"#f7f8fb"}}>
      <div style={{background:"#fff",borderBottom:"1px solid rgba(0,0,0,0.06)",padding:"12px 24px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <button onClick={()=>router.push("/chat")} style={{color:"#6b7280",fontSize:"13px",fontWeight:600,background:"transparent",border:"none",cursor:"pointer"}}>← 戻る</button>
        <div style={{fontSize:"13px",fontWeight:800,letterSpacing:"3px",color:PRIMARY}}>ASCEND</div>
        <div style={{width:"60px"}}/>
      </div>

      <div style={{maxWidth:"1100px",margin:"0 auto",padding:"24px 16px 80px"}}>
        <section style={{background:DARK,borderRadius:"24px",padding:"56px 32px",textAlign:"center",color:"#fff",marginBottom:"32px",boxShadow:"0 8px 40px rgba(15,23,42,0.25)"}}>
          <h1 style={{fontSize:"44px",fontWeight:900,letterSpacing:"8px",margin:0,marginBottom:"16px"}}>ASCEND</h1>
          <p style={{fontSize:"16px",fontWeight:700,color:"#93c5fd",marginBottom:"16px"}}>あらゆる経営判断に、構造を。あらゆる戦略に、深度を。</p>
          <p style={{fontSize:"13px",color:"rgba(255,255,255,0.75)",lineHeight:1.8,maxWidth:"720px",margin:"0 auto 28px"}}>
            ASCENDは、戦略・数値・構造・リスク——あらゆる経営判断に即応するAIコンサルティングエンジンです。<br/>
            診断・分析・実行支援に特化した次世代の経営判断プラットフォームです。
          </p>
          <div style={{display:"flex",gap:"12px",justifyContent:"center",flexWrap:"wrap"}}>
            <button onClick={()=>router.push("/chat")} style={{background:`linear-gradient(135deg,${PRIMARY},${PRIMARY2})`,color:"#fff",fontWeight:700,fontSize:"14px",padding:"12px 28px",borderRadius:"12px",boxShadow:"0 4px 16px rgba(99,102,241,0.4)",border:"none",cursor:"pointer"}}>チャットを開始する →</button>
            <button onClick={()=>router.push("/mypage")} style={{background:"transparent",color:"#fff",fontWeight:700,fontSize:"14px",padding:"12px 28px",borderRadius:"12px",border:"2px solid rgba(255,255,255,0.4)",cursor:"pointer"}}>マイページへ</button>
          </div>
        </section>

        <section style={{background:"#fff",borderRadius:"20px",borderLeft:`4px solid ${PRIMARY}`,padding:"24px 28px",marginBottom:"32px",boxShadow:"0 2px 12px rgba(0,0,0,0.04)"}}>
          <h2 style={{color:PRIMARY,fontSize:"16px",fontWeight:900,marginBottom:"12px"}}>哲学・コンセプト</h2>
          <p style={{color:"#374151",fontSize:"13px",lineHeight:1.8,marginBottom:"20px"}}>
            ASCENDは「印象」ではなく「構造」で、「直感」ではなく「数値」で、あらゆる経営判断を支えます。<br/>
            6つの観点を統合した独自エンジンです。
          </p>
          <div style={{background:"rgba(99,102,241,0.06)",border:"1px solid rgba(99,102,241,0.18)",borderRadius:"16px",padding:"20px 24px"}}>
            <p style={{color:PRIMARY,fontSize:"13px",fontWeight:900,marginBottom:"12px"}}>■ 名称の意味</p>
            <div style={{display:"flex",flexDirection:"column",gap:"10px",fontSize:"13px",color:"#111827"}}>
              <p><span style={{color:PRIMARY,fontWeight:900}}>A</span> — Architectural Analysis（構造解剖）</p>
              <p><span style={{color:PRIMARY,fontWeight:900}}>S</span> — Scoring &amp; Scale（階級スコア）</p>
              <p><span style={{color:PRIMARY,fontWeight:900}}>C</span> — Case-driven RAG（事例駆動検索）</p>
              <p><span style={{color:PRIMARY,fontWeight:900}}>E</span> — Executor Strategy（戦術執行）</p>
              <p><span style={{color:PRIMARY,fontWeight:900}}>N</span> — Nurturing / Mentor（育成・導師）</p>
              <p><span style={{color:PRIMARY,fontWeight:900}}>D</span> — Dynamic Routing &amp; Diagnosis（動的診断）</p>
            </div>
          </div>
          {stats?.tenant_id && (
            <div style={{marginTop:"16px",background:"rgba(99,102,241,0.05)",border:"1px solid rgba(99,102,241,0.15)",borderRadius:"14px",padding:"14px 18px",textAlign:"center"}}>
              <p style={{color:"#6b7280",fontSize:"11px",marginBottom:"4px"}}>登録業種</p>
              <p style={{color:"#111827",fontSize:"15px",fontWeight:800}}>{stats.tenant_id}</p>
            </div>
          )}
          <p style={{color:"#6b7280",fontSize:"11px",textAlign:"center",marginTop:"14px"}}>
            戦略・数値・構造・リスク——あらゆる経営判断に即応するAIコンサルティングエンジン
          </p>
        </section>

        <section style={{marginBottom:"40px"}}>
          <h2 style={{textAlign:"center",fontSize:"22px",fontWeight:900,color:"#111827",marginBottom:"24px"}}>主な機能</h2>
          {groups.map(g => (
            <div key={g.title} style={{marginBottom:"28px"}}>
              <h3 style={{fontSize:"14px",fontWeight:900,color:"#111827",marginBottom:"12px",paddingLeft:"4px"}}>{g.icon} {g.title}</h3>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:"12px"}}>
                {g.items.map(it => {
                  const enabled = !it.flag || features[it.flag] === true;
                  return (
                    <button key={it.name} onClick={()=>handleNavigate(it.url, it.flag)} style={{textAlign:"left",background:"#fff",border:`1px solid ${enabled?"rgba(99,102,241,0.2)":"rgba(0,0,0,0.08)"}`,borderRadius:"14px",padding:"14px 16px",boxShadow:"0 1px 4px rgba(0,0,0,0.04)",borderTop:`3px solid ${enabled?PRIMARY:"#cbd5e1"}`,opacity: enabled?1:0.62,cursor:"pointer",transition:"all 0.18s"}}>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"6px"}}>
                        <p style={{fontSize:"13px",fontWeight:800,color:"#111827"}}>{it.name}</p>
                        {!enabled && <span style={{fontSize:"9px",fontWeight:700,color:"#94a3b8",background:"#f1f5f9",borderRadius:"99px",padding:"2px 8px"}}>未開放</span>}
                      </div>
                      <p style={{fontSize:"11px",color:"#6b7280",lineHeight:1.6}}>{it.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </section>

        <section style={{marginBottom:"40px"}}>
          <h2 style={{textAlign:"center",fontSize:"22px",fontWeight:900,color:"#111827",marginBottom:"24px"}}>使い方</h2>
          <div style={{display:"flex",flexDirection:"column",gap:"12px"}}>
            {howTo.map(s => (
              <div key={s.n} style={{background:"#fff",border:`1px solid rgba(99,102,241,0.15)`,borderLeft:`4px solid ${PRIMARY}`,borderRadius:"14px",padding:"14px 18px",display:"flex",gap:"14px",alignItems:"flex-start"}}>
                <div style={{flexShrink:0,width:"32px",height:"32px",borderRadius:"50%",background:`linear-gradient(135deg,${PRIMARY},${PRIMARY2})`,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:"13px"}}>{s.n}</div>
                <div>
                  <p style={{fontSize:"13px",fontWeight:800,color:"#111827",marginBottom:"4px"}}>{s.t}</p>
                  <p style={{fontSize:"12px",color:"#6b7280",lineHeight:1.7}}>{s.d}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section style={{marginBottom:"40px"}}>
          <h2 style={{textAlign:"center",fontSize:"22px",fontWeight:900,color:"#111827",marginBottom:"24px"}}>よくある質問</h2>
          <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
            {faqs.map((f,i) => (
              <div key={i} style={{background:"#fff",border:"1px solid rgba(0,0,0,0.06)",borderRadius:"12px",overflow:"hidden"}}>
                <button onClick={()=>setOpenFaq(openFaq===i?null:i)} style={{width:"100%",textAlign:"left",padding:"14px 18px",cursor:"pointer",display:"flex",alignItems:"center",gap:"10px",background:"transparent",border:"none"}}>
                  <span style={{color:PRIMARY,fontWeight:900,fontSize:"12px",transition:"transform 0.2s",display:"inline-block",transform:openFaq===i?"rotate(90deg)":"rotate(0deg)"}}>▶</span>
                  <span style={{color:PRIMARY,fontWeight:700,fontSize:"13px"}}>{f.q}</span>
                </button>
                {openFaq===i && (
                  <div style={{padding:"0 18px 16px 38px",fontSize:"12px",color:"#374151",lineHeight:1.8,whiteSpace:"pre-wrap"}}>{f.a}</div>
                )}
              </div>
            ))}
          </div>
        </section>

        <section style={{textAlign:"center",padding:"32px 16px",background:DARK,borderRadius:"20px",color:"#fff"}}>
          <p style={{fontSize:"15px",fontWeight:800,marginBottom:"16px"}}>さあ、経営判断にASCENDを。</p>
          <div style={{display:"flex",gap:"12px",justifyContent:"center",flexWrap:"wrap"}}>
            <button onClick={()=>router.push("/chat")} style={{background:`linear-gradient(135deg,${PRIMARY},${PRIMARY2})`,color:"#fff",fontWeight:700,fontSize:"13px",padding:"12px 32px",borderRadius:"12px",boxShadow:"0 4px 16px rgba(99,102,241,0.4)",border:"none",cursor:"pointer"}}>チャットを開始する →</button>
            <button onClick={()=>router.push("/plan")} style={{background:"transparent",color:"#fff",fontWeight:700,fontSize:"13px",padding:"12px 32px",borderRadius:"12px",border:"2px solid rgba(255,255,255,0.4)",cursor:"pointer"}}>ASCENDプラン →</button>
          </div>
        </section>
      </div>

      {toast && (
        <div style={{position:"fixed",bottom:"24px",left:"50%",transform:"translateX(-50%)",background:"rgba(30,30,40,0.94)",color:"#fff",borderRadius:"14px",padding:"12px 24px",fontSize:"13px",fontWeight:700,zIndex:9999,boxShadow:"0 4px 20px rgba(0,0,0,0.3)"}}>
          {toast}
        </div>
      )}

      {loading && (
        <div style={{position:"fixed",inset:0,background:"rgba(255,255,255,0.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9998}}>
          <div style={{color:PRIMARY,fontWeight:700}}>読込中...</div>
        </div>
      )}
    </div>
  );
}
