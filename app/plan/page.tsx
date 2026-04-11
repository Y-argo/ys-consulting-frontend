"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getUserPlan, getStoredUser } from "../../lib/api";

const PLANS = [
  {
    key: "starter",
    name: "STARTER",
    price: "¥0",
    color: "#6b7280",
    badge: "無料",
    engine: "Core",
    modes: "AUTOのみ",
    features: [
      "AIチャット（AUTOモード）",
      "RAG検索",
      "レベルスコア",
    ],
    locked: [
      "診断機能全般",
      "画像生成",
      "ファイル診断",
      "固定概念レポート",
      "個人相談",
      "投資シグナル",
    ],
  },
  {
    key: "standard",
    name: "STANDARD",
    price: "¥9,800",
    color: "#3b82f6",
    badge: "スタンダード",
    engine: "Core",
    modes: "7モード対応",
    features: [
      "AIチャット（7モード）",
      "RAG検索・レベルスコア",
      "現状課題診断",
      "Decision Metrics",
      "診断タブ（構造/課題/比較/矛盾/実行）",
      "画像生成",
      "画像・ファイル解析（チャット内）",
    ],
    locked: [
      "ファイル診断（Ultraエンジン）",
      "固定概念レポート",
      "個人相談",
      "投資シグナル",
      "ASCEND Ultra / Apex",
    ],
  },
  {
    key: "pro",
    name: "PRO",
    price: "¥39,800",
    color: "#8b5cf6",
    badge: "プロ",
    engine: "Ultra",
    modes: "全19モード対応",
    features: [
      "AIチャット（全19モード）",
      "RAG検索・レベルスコア",
      "現状課題診断・Decision Metrics",
      "診断タブ全6種",
      "ファイル診断（Chain of Thought分析）",
      "固定概念レポート（LGBM自動生成）",
      "画像生成・画像ギャラリー",
      "個人相談（スレッド往復）",
      "ASCEND Ultra解放",
    ],
    locked: [
      "投資シグナル",
      "ASCEND Apex",
    ],
  },
  {
    key: "apex",
    name: "APEX",
    price: "¥89,800",
    color: "#f59e0b",
    badge: "最上位",
    engine: "Apex",
    modes: "全19モード対応",
    features: [
      "全機能すべて解放",
      "AIチャット（全19モード）",
      "ファイル診断・固定概念レポート",
      "投資シグナル（全銘柄）",
      "ASCEND Apex（最上位AIエンジン）",
      "個人相談・画像生成・ギャラリー",
      "診断タブ全8種（投資シグナルタブ含む）",
    ],
    locked: [],
  },
  {
    key: "ultra",
    name: "ULTRA",
    price: "¥300,000",
    color: "#e11d48",
    badge: "顧問契約",
    engine: "Apex",
    modes: "全19モード対応",
    features: [
      "ASCEND全機能完全解放",
      "Ys Consulting Office顧問契約付き",
      "社員10名まで個別アカウント発行",
      "企業テナント共有（RAG・診断履歴）",
      "📊 月次戦術レポート提出",
      "新機能先行利用",
      "月次ミーティング・直接支援",
    ],
    locked: [],
  },
];

const PLAN_LABELS: Record<string, string> = {
  starter: "STARTER",
  standard: "STANDARD",
  pro: "PRO",
  apex: "APEX",
  ultra: "ULTRA",
  ultra_admin: "ULTRA管理者",
  ultra_member: "ULTRAメンバー",
};

export default function PlanPage() {
  const router = useRouter();
  const [currentPlan, setCurrentPlan] = useState<string>("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const user = getStoredUser();
    if (user) {
      getUserPlan().then((p) => setCurrentPlan(p));
    }
  }, []);

  if (!mounted) return null;

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", color: "#f1f5f9", fontFamily: "sans-serif" }}>
      {/* ヘッダー */}
      <div style={{ background: "#1e293b", borderBottom: "1px solid #334155", padding: "16px 24px", display: "flex", alignItems: "center", gap: 16 }}>
        <button
          onClick={() => router.back()}
          style={{ background: "none", border: "1px solid #475569", color: "#94a3b8", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 14 }}
        >
          ← 戻る
        </button>
        <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: 1 }}>ASCEND プランガイド</span>
        {currentPlan && PLAN_LABELS[currentPlan] && (
          <span style={{ marginLeft: "auto", background: "#334155", borderRadius: 20, padding: "4px 14px", fontSize: 13, color: "#94a3b8" }}>
            現在のプラン：<strong style={{ color: "#f1f5f9" }}>{PLAN_LABELS[currentPlan]}</strong>
          </span>
        )}
      </div>

      {/* キャッチ */}
      <div style={{ textAlign: "center", padding: "48px 24px 32px" }}>
        <div style={{ fontSize: 13, color: "#64748b", letterSpacing: 2, marginBottom: 8 }}>SUBSCRIPTION PLANS</div>
        <div style={{ fontSize: 32, fontWeight: 800, marginBottom: 12 }}>
          あなたのビジネスを、次のレベルへ
        </div>
        <div style={{ color: "#94a3b8", fontSize: 15 }}>
          コンサルティングAI「ASCEND」のプランを選択してください
        </div>
      </div>

      {/* プランカード */}
      <div style={{ display: "flex", gap: 20, justifyContent: "center", flexWrap: "wrap", padding: "0 24px 48px" }}>
        {PLANS.map((plan) => {
          const isCurrent = currentPlan === plan.key;
          return (
            <div
              key={plan.key}
              style={{
                width: 260,
                background: isCurrent ? "#1e293b" : "#18202e",
                border: `2px solid ${isCurrent ? plan.color : "#1e293b"}`,
                borderRadius: 16,
                padding: 28,
                position: "relative",
                boxShadow: isCurrent ? `0 0 24px ${plan.color}44` : "none",
                transition: "all 0.2s",
              }}
            >
              {isCurrent && (
                <div style={{ position: "absolute", top: -14, left: "50%", transform: "translateX(-50%)", background: plan.color, color: "#fff", borderRadius: 20, padding: "3px 14px", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>
                  現在のプラン
                </div>
              )}
              {(plan.key === "apex" || plan.key === "ultra") && !isCurrent && (
                <div style={{ position: "absolute", top: -14, left: "50%", transform: "translateX(-50%)", background: plan.key === "ultra" ? "#e11d48" : "#f59e0b", color: plan.key === "ultra" ? "#fff" : "#000", borderRadius: 20, padding: "3px 14px", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>
                  {plan.key === "ultra" ? "顧問契約" : "最上位"}
                </div>
              )}

              <div style={{ color: plan.color, fontWeight: 800, fontSize: 18, letterSpacing: 1, marginBottom: 4 }}>{plan.name}</div>
              <div style={{ fontSize: 30, fontWeight: 800, marginBottom: 4 }}>{plan.price}<span style={{ fontSize: 14, color: "#64748b", fontWeight: 400 }}>{plan.key === "starter" ? "/新規7日間" : plan.key === "ultra" ? "/月〜（要相談）" : "/月"}</span></div>
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 16, paddingBottom: 16, borderBottom: "1px solid #1e293b" }}>
                🤖 {plan.engine}<br />
                ⚡ {plan.modes}
              </div>

              <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 8, fontWeight: 600 }}>✅ 利用可能</div>
              {plan.features.map((f, i) => (
                <div key={i} style={{ fontSize: 13, color: "#e2e8f0", marginBottom: 5, display: "flex", gap: 6, alignItems: "flex-start" }}>
                  <span style={{ color: plan.color, flexShrink: 0 }}>◆</span>{f}
                </div>
              ))}

              {plan.locked.length > 0 && (
                <>
                  <div style={{ fontSize: 13, color: "#475569", marginTop: 14, marginBottom: 8, fontWeight: 600 }}>🔒 対象外</div>
                  {plan.locked.map((f, i) => (
                    <div key={i} style={{ fontSize: 12, color: "#475569", marginBottom: 4, display: "flex", gap: 6, alignItems: "flex-start" }}>
                      <span style={{ flexShrink: 0 }}>—</span>{f}
                    </div>
                  ))}
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* お問い合わせ */}
      <div style={{ textAlign: "center", padding: "32px 24px 64px", borderTop: "1px solid #1e293b" }}>
        <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>プランのご契約・お問い合わせ</div>
        <div style={{ color: "#94a3b8", fontSize: 14, marginBottom: 20, lineHeight: 1.8 }}>
          プランの変更・契約はYs Consulting Officeまでお問い合わせください。<br />
          ご要望・ご質問もお気軽にどうぞ。
        </div>
        <button
          onClick={() => router.push("/?mode=contact")}
          style={{ display: "inline-block", background: "#3b82f6", color: "#fff", borderRadius: 10, padding: "12px 32px", fontWeight: 700, fontSize: 15, border: "none", cursor: "pointer", letterSpacing: 0.5 }}
        >
          📩 Ys Consulting Office に問い合わせる
        </button>
        <div style={{ color: "#64748b", fontSize: 12, marginTop: 12 }}>
          ※ アカウント登録後にお問い合わせください（UID記載必須）
        </div>
        <div style={{ color: "#475569", fontSize: 12, marginTop: 16 }}>
          ※ 現在のプランは管理者が設定します。契約後に反映されます。
        </div>
      </div>
    </div>
  );
}
