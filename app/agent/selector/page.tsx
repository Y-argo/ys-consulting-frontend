"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import { updateMediaSelectors, listMediaMappings } from "@/lib/api";

function SelectorSettingsContent() {
  const router = useRouter();
  const params = useSearchParams();
  const mappingId = params.get("id") || "";
  const mediaName = params.get("name") || "";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submit, setSubmit] = useState("");
  const [verify, setVerify] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!mappingId) return;
    listMediaMappings().then(r => {
      const m = r.mappings.find((x) => x.mapping_id === mappingId);
      if (m) {
        const ds = (m.dom_selectors || {}) as Record<string,string>;
        setUsername(ds.username || "");
        setPassword(ds.password || "");
        setSubmit(ds.login_submit || "");
        setVerify((m.verify_selector as unknown as string) || "");
      }
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, [mappingId]);

  async function handleSave() {
    if (!username || !password || !submit) {
      setMsg("ID・パスワード・ログインボタンのセレクターを入力してください");
      return;
    }
    setSaving(true);
    try {
      await updateMediaSelectors(
        mappingId,
        { username, password, login_submit: submit },
        verify || undefined
      );
      setMsg("保存しました");
      setTimeout(() => router.push("/agent"), 800);
    } catch (e: unknown) {
      setMsg((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) return (
    <div style={{ minHeight: "100vh", background: "var(--color-background-tertiary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "var(--color-text-secondary)", fontSize: 14 }}>読み込み中...</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-background-tertiary)", padding: "24px 16px" }}>
      <div style={{ maxWidth: 540, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
          <button onClick={() => router.push("/agent")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "var(--color-text-secondary)" }}>←</button>
          <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "var(--color-text-primary)" }}>⚙️ ログインフォーム設定</h1>
        </div>

        <div style={{ background: "var(--color-background-secondary)", border: "1px solid var(--color-border-tertiary)", borderRadius: 14, padding: 24 }}>
          <div style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 12, lineHeight: 1.7 }}>
            「{mediaName}」のログイン画面にある入力欄・ボタンのCSSセレクターを設定してください。
          </div>
          <div style={{ background: "var(--color-background-tertiary)", borderRadius: 10, padding: "14px 16px", marginBottom: 20, fontSize: 12, color: "var(--color-text-secondary)", lineHeight: 1.8 }}>
            <div style={{ fontWeight: 700, color: "var(--color-text-primary)", marginBottom: 8 }}>📖 CSSセレクターの確認方法</div>
            <div style={{ marginBottom: 6 }}>① 対象サイトのログインページをブラウザで開く</div>
            <div style={{ marginBottom: 6 }}>② ID入力欄を右クリック →「検証」または「要素を調べる」を選択</div>
            <div style={{ marginBottom: 6 }}>③ 表示されたHTMLの該当要素を右クリック → Copy → Copy selector</div>
            <div style={{ marginBottom: 6 }}>④ コピーした値を下の各フィールドに貼り付ける</div>
            <div style={{ marginTop: 10, padding: "8px 10px", background: "var(--color-background-secondary)", borderRadius: 6, fontFamily: "monospace", fontSize: 11 }}>
              例: input[name=&quot;email&quot;] / input[type=&quot;password&quot;] / button[type=&quot;submit&quot;]
            </div>
          </div>

          {[
            { label: "IDフィールド（必須）", placeholder: 'input[name="email"]', val: username, set: setUsername },
            { label: "パスワードフィールド（必須）", placeholder: 'input[name="password"]', val: password, set: setPassword },
            { label: "ログインボタン（必須）", placeholder: 'button[type="submit"]', val: submit, set: setSubmit },
            { label: "ログイン確認要素（任意）", placeholder: ".user-menu", val: verify, set: setVerify },
          ].map(f => (
            <div key={f.label} style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-secondary)", display: "block", marginBottom: 4 }}>{f.label}</label>
              <input value={f.val} onChange={e => f.set(e.target.value)} placeholder={f.placeholder}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--color-border-secondary)", background: "var(--color-background-primary)", color: "var(--color-text-primary)", fontSize: 13, fontFamily: "monospace", boxSizing: "border-box" }} />
            </div>
          ))}

          {msg && (
            <div style={{ padding: "10px 14px", borderRadius: 8, marginBottom: 14, background: msg === "保存しました" ? "#15803d11" : "#b91c1c11", border: `1px solid ${msg === "保存しました" ? "#15803d44" : "#b91c1c44"}`, color: msg === "保存しました" ? "#15803d" : "#b91c1c", fontSize: 13 }}>
              {msg}
            </div>
          )}

          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <button onClick={() => router.push("/agent")}
              style={{ flex: 1, padding: "11px", borderRadius: 8, border: "1px solid var(--color-border-secondary)", background: "none", color: "var(--color-text-secondary)", cursor: "pointer", fontSize: 14 }}>
              キャンセル
            </button>
            <button onClick={handleSave} disabled={saving}
              style={{ flex: 1, padding: "11px", borderRadius: 8, border: "none", background: saving ? "#9ca3af" : "#7c3aed", color: "#fff", fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", fontSize: 14 }}>
              {saving ? "保存中..." : "保存する"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SelectorSettingsPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "var(--color-background-tertiary)", display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ color: "var(--color-text-secondary)", fontSize: 14 }}>読み込み中...</div></div>}>
      <SelectorSettingsContent />
    </Suspense>
  );
}
