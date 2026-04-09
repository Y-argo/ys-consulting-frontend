"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { loginUser, registerUser } from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || "";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login"|"register"|"contact">("login");
  useEffect(() => {
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search);
      const m = p.get("mode");
      if (m === "contact" || m === "register") setMode(m);
    }
  }, []);
  const [contactName, setContactName] = useState("");
  const [contactMsg, setContactMsg] = useState("");
  const [contactDone, setContactDone] = useState(false);
  const [contactLoading, setContactLoading] = useState(false);

  async function handleContact(e: React.FormEvent) {
    e.preventDefault();
    setContactLoading(true);
    try {
      await fetch(`${API_BASE}/api/auth/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: contactName, message: contactMsg }),
      });
      setContactDone(true);
    } catch {
      // silent
    } finally {
      setContactLoading(false);
    }
  }
  const [uid, setUid] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (mode === "register" && password !== confirmPassword) {
      setError("パスワードが一致しません"); return;
    }
    if (mode === "register" && password.length < 6) {
      setError("パスワードは6文字以上で入力してください"); return;
    }
    setLoading(true);
    try {
      if (mode === "login") {
        await loginUser(uid, password);
      } else {
        await registerUser(uid, password, displayName);
      }
      router.push("/chat");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4" style={{fontFamily:"'Inter','Noto Sans JP',sans-serif"}}>
      {/* 背景グラデーション */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-900/20 rounded-full blur-3xl"/>
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-900/20 rounded-full blur-3xl"/>
      </div>

      <div className="w-full max-w-md relative">
        {/* ロゴ */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-2xl shadow-blue-900/50 mb-4">
            <span className="text-white font-black text-2xl">A</span>
          </div>
          <h1 className="text-3xl font-black text-white tracking-widest">ASCEND</h1>
          <p className="text-gray-500 text-sm mt-1">Ys Consulting Office</p>
          <p className="text-gray-600 text-xs mt-1">自己変容を通じて、意思決定精度を高めるトレーニング領域。</p>
        </div>

        {/* タブ */}
        <div className="flex bg-[#1a1a2e] border border-[#2a2a4a] rounded-2xl p-1 mb-4">
          <button
            onClick={()=>{setMode("login");setError("");}}
            className={"flex-1 py-2 text-sm font-medium rounded-xl transition-all "+(mode==="login"?"bg-blue-600 text-white shadow-lg":"text-gray-500 hover:text-gray-300")}
          >ログイン</button>
          <button
            onClick={()=>{setMode("register");setError("");}}
            className={"flex-1 py-2 text-sm font-medium rounded-xl transition-all "+(mode==="register"?"bg-blue-600 text-white shadow-lg":"text-gray-500 hover:text-gray-300")}
          >新規登録</button>
          <button
            onClick={()=>{setMode("contact");setError("");setContactDone(false);}}
            className={"flex-1 py-2 text-sm font-medium rounded-xl transition-all "+(mode==="contact"?"bg-blue-600 text-white shadow-lg":"text-gray-500 hover:text-gray-300")}
          >お問い合わせ</button>
        </div>

        {/* フォーム */}
        <div className="bg-[#0d0d14] border border-[#2a2a4a] rounded-2xl p-6 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "register" && (
              <div>
                <label className="block text-xs text-gray-500 mb-1.5 font-medium">表示名（任意）</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={e=>setDisplayName(e.target.value)}
                  className="w-full bg-[#1a1a2e] text-white border border-[#2a2a4a] focus:border-blue-600 rounded-xl px-4 py-2.5 text-sm focus:outline-none transition-colors"
                  placeholder="表示名"
                />
              </div>
            )}
            <div>
              <label className="block text-xs text-gray-500 mb-1.5 font-medium">ユーザーID</label>
              <input
                type="text"
                value={uid}
                onChange={e=>setUid(e.target.value)}
                required
                autoFocus
                className="w-full bg-[#1a1a2e] text-white border border-[#2a2a4a] focus:border-blue-600 rounded-xl px-4 py-2.5 text-sm focus:outline-none transition-colors"
                placeholder="UID"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5 font-medium">パスワード{mode==="register"&&"（6文字以上）"}</label>
              <input
                type="password"
                value={password}
                onChange={e=>setPassword(e.target.value)}
                required
                className="w-full bg-[#1a1a2e] text-white border border-[#2a2a4a] focus:border-blue-600 rounded-xl px-4 py-2.5 text-sm focus:outline-none transition-colors"
                placeholder="Password"
              />
            </div>
            {mode === "register" && (
              <div>
                <label className="block text-xs text-gray-500 mb-1.5 font-medium">パスワード（確認）</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e=>setConfirmPassword(e.target.value)}
                  required
                  className="w-full bg-[#1a1a2e] text-white border border-[#2a2a4a] focus:border-blue-600 rounded-xl px-4 py-2.5 text-sm focus:outline-none transition-colors"
                  placeholder="Confirm Password"
                />
              </div>
            )}

            {error && (
              <div className="bg-red-900/20 border border-red-800/50 rounded-xl px-4 py-2.5">
                {error === "EXPIRED" ? (
                  <>
                    <p className="text-red-400 text-xs font-bold">利用有効期限が失効しています。</p>
                    <p className="text-red-400 text-xs mt-1">Ys Consulting Office までご連絡ください。</p>
                  </>
                ) : (
                  <p className="text-red-400 text-xs">{error}</p>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500 text-white font-bold rounded-xl py-3 text-sm transition-all shadow-lg shadow-blue-900/30 mt-2"
            >
              {loading ? "処理中..." : mode==="login" ? "ログイン" : "アカウントを作成"}
            </button>
          </form>
        </div>

        {mode === "register" && (
          <div className="mt-4 bg-[#0d0d14] border border-[#2a2a4a] rounded-2xl p-4 text-xs text-gray-500 space-y-2">
            <p className="font-bold text-gray-400">📋 新規登録の流れ</p>
            <p>① UID・パスワードを設定してアカウントを作成</p>
            <p>② ログイン後すぐにASCENDをご利用いただけます</p>
            <p>③ 初期有効期限は登録から<span className="text-gray-300 font-bold">7日間</span>です</p>
            <div className="border-t border-[#2a2a4a] pt-2 mt-2">
              <p className="text-gray-600">※ 初期設定では<span className="text-gray-400">デフォルト業種</span>が適用されます。</p>
              <p className="text-gray-600">※ 業種変更・有効期限延長・プラン変更は<span className="text-blue-400 font-bold">Ys Consulting Office</span>までご連絡ください。</p>
            </div>
          </div>
        )}
        {mode === "contact" && (
          <div className="bg-[#0d0d14] border border-[#2a2a4a] rounded-2xl p-6 shadow-2xl mt-0">
            {contactDone ? (
              <div className="text-center py-6">
                <p className="text-green-400 font-bold text-sm mb-2">✅ 送信完了しました</p>
                <p className="text-gray-500 text-xs">内容を確認の上、ご連絡いたします。</p>
                <button onClick={()=>{setMode("login");setContactDone(false);}} className="mt-4 text-xs text-blue-400 underline">ログインに戻る</button>
              </div>
            ) : (
              <form onSubmit={handleContact} className="space-y-4">
                <p className="text-xs text-gray-500">業種変更・有効期限延長・プラン変更などについてお問い合わせください。</p>
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5 font-medium">お名前</label>
                  <input
                    type="text"
                    value={contactName}
                    onChange={e=>setContactName(e.target.value)}
                    required
                    className="w-full bg-[#1a1a2e] text-white border border-[#2a2a4a] focus:border-blue-600 rounded-xl px-4 py-2.5 text-sm focus:outline-none transition-colors"
                    placeholder="お名前またはUID"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5 font-medium">お問い合わせ内容</label>
                  <textarea
                    value={contactMsg}
                    onChange={e=>setContactMsg(e.target.value)}
                    required
                    rows={4}
                    className="w-full bg-[#1a1a2e] text-white border border-[#2a2a4a] focus:border-blue-600 rounded-xl px-4 py-2.5 text-sm focus:outline-none transition-colors resize-none"
                    placeholder="ご要望・ご質問をご記入ください"
                  />
                </div>
                <button
                  type="submit"
                  disabled={contactLoading}
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500 text-white font-bold rounded-xl py-3 text-sm transition-all shadow-lg shadow-blue-900/30"
                >
                  {contactLoading ? "送信中..." : "送信する"}
                </button>
              </form>
            )}
          </div>
        )}
        {/* プランガイドボタン */}
        <div className="text-center mt-5">
          <button
            onClick={() => router.push("/plan")}
            className="text-xs text-blue-400 hover:text-blue-300 underline transition-colors"
          >
            📦 ASCENDのプランガイドを見る
          </button>
        </div>
        {/* フッター */}
        <p className="text-center text-xs text-gray-700 mt-4">
          ※ 本AIの出力は意思決定支援のための提案です。投資・法務・医療等の重要事項は専門家にご確認ください。
        </p>
      </div>
    </div>
  );
}
