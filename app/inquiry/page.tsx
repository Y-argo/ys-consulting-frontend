"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  getStoredUser, listInquiries, getInquiryMessages,
  createInquiry, addInquiryMessage, Inquiry, InquiryMessage,
} from "@/lib/api";

const CATEGORIES = ["戦略・方針相談","売上・マーケティング","組織・人材","財務・資金調達","オペレーション改善","その他"];
const STATUS_COLORS: Record<string,string> = {
  "new":"#ef4444","in_progress":"#f59e0b","replied":"#3b82f6","waiting_user":"#8b5cf6","closed":"#6b7280"
};

export default function InquiryPage() {
  const router = useRouter();
  const [uid, setUid] = useState("");
  const [view, setView] = useState<"list"|"create"|"thread">("list");
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [selected, setSelected] = useState<Inquiry|null>(null);
  const [messages, setMessages] = useState<InquiryMessage[]>([]);
  const [replyText, setReplyText] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [supplement, setSupplement] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const user = getStoredUser();
    if (!user) { router.push("/"); return; }
    setUid(user.uid);
    fetchInquiries();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function fetchInquiries() {
    const list = await listInquiries();
    setInquiries(list);
  }

  async function openThread(inq: Inquiry) {
    setSelected(inq);
    setView("thread");
    const msgs = await getInquiryMessages(inq.inquiry_id);
    setMessages(msgs);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !body.trim()) { setError("タイトルと内容を入力してください"); return; }
    setLoading(true);
    setError("");
    try {
      await createInquiry(title, body, category, supplement);
      setTitle(""); setBody(""); setSupplement("");
      await fetchInquiries();
      setView("list");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally { setLoading(false); }
  }

  async function handleReply(e: React.FormEvent) {
    e.preventDefault();
    if (!replyText.trim() || !selected) return;
    setLoading(true);
    try {
      await addInquiryMessage(selected.inquiry_id, replyText);
      setReplyText("");
      const msgs = await getInquiryMessages(selected.inquiry_id);
      setMessages(msgs);
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen flex flex-col" style={{background:"#070710",fontFamily:"'Inter','Noto Sans JP',sans-serif",color:"#e8e8f0"}}>
      {/* NAV */}
      <nav style={{background:"rgba(10,10,20,0.95)",borderBottom:"1px solid rgba(99,102,241,0.15)"}} className="flex items-center justify-between px-5 py-3 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={()=>router.push("/chat")} className="text-gray-500 hover:text-white text-sm transition-colors">← チャットに戻る</button>
          <span className="text-gray-700">|</span>
          <div className="flex items-center gap-2">
            <div style={{background:"linear-gradient(135deg,#6366f1,#8b5cf6)"}} className="w-6 h-6 rounded-lg flex items-center justify-center">
              <span className="text-white font-black text-xs">A</span>
            </div>
            <span className="font-black text-sm text-white">ASCEND</span>
            <span className="text-gray-600 text-xs">｜📩 Ys Consulting Officeに個人相談</span>
          </div>
        </div>
        <span className="text-xs text-emerald-400">● {uid}</span>
      </nav>

      <div className="flex-1 max-w-3xl mx-auto w-full px-4 py-6">
        {/* LIST VIEW */}
        {view === "list" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h1 className="text-xl font-black text-white">相談一覧</h1>
              <button onClick={()=>setView("create")}
                style={{background:"linear-gradient(135deg,#6366f1,#8b5cf6)",boxShadow:"0 4px 15px rgba(99,102,241,0.3)"}}
                className="text-xs font-bold text-white rounded-xl px-4 py-2 hover:opacity-90 transition-all">
                ＋ 新しい相談を作成
              </button>
            </div>
            {inquiries.length === 0 ? (
              <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"20px"}} className="p-12 text-center">
                <p className="text-4xl mb-4">📩</p>
                <p className="text-gray-400 text-sm mb-2">まだ相談はありません</p>
                <p className="text-gray-600 text-xs">「新しい相談を作成」から相談を送ってください</p>
              </div>
            ) : (
              <div className="space-y-3">
                {inquiries.map(inq => (
                  <button key={inq.inquiry_id} onClick={()=>openThread(inq)}
                    style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:"16px"}}
                    className="w-full text-left p-4 hover:border-indigo-500/40 hover:bg-indigo-500/5 transition-all">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-white font-bold text-sm">{inq.title}</span>
                      <div className="flex items-center gap-2">
                        {inq.unread_for_user && (
                          <span style={{background:"#ef4444"}} className="text-xs text-white px-2 py-0.5 rounded-full font-bold">NEW</span>
                        )}
                        <span style={{background:`${STATUS_COLORS[inq.status]}20`,border:`1px solid ${STATUS_COLORS[inq.status]}50`,color:STATUS_COLORS[inq.status]}}
                          className="text-xs px-2 py-0.5 rounded-full">{inq.status_label}</span>
                      </div>
                    </div>
                    <div className="flex gap-3 text-xs text-gray-600">
                      <span>📂 {inq.category}</span>
                      <span>🕐 {inq.updated_at.slice(0,16)}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* CREATE VIEW */}
        {view === "create" && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <button onClick={()=>setView("list")} className="text-gray-500 hover:text-white text-sm transition-colors">← 一覧に戻る</button>
              <h1 className="text-xl font-black text-white">新しい相談を作成</h1>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1.5 font-medium">カテゴリ</label>
                <select value={category} onChange={e=>setCategory(e.target.value)}
                  style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:"14px"}}
                  className="w-full text-white text-sm px-4 py-2.5 focus:outline-none focus:border-indigo-500 transition-colors">
                  {CATEGORIES.map(c=><option key={c} value={c} style={{background:"#1a1a2e"}}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1.5 font-medium">タイトル <span className="text-red-400">*</span></label>
                <input value={title} onChange={e=>setTitle(e.target.value)} required placeholder="相談のタイトルを入力"
                  style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:"14px"}}
                  className="w-full text-white text-sm px-4 py-2.5 focus:outline-none focus:border-indigo-500 transition-colors placeholder-gray-700"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1.5 font-medium">相談内容 <span className="text-red-400">*</span></label>
                <textarea value={body} onChange={e=>setBody(e.target.value)} required placeholder="具体的な状況・課題・質問を記載してください&#10;&#10;例：&#10;【目的】&#10;【現状】&#10;【制約】&#10;【質問】"
                  rows={8}
                  style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:"14px",resize:"none"}}
                  className="w-full text-white text-sm px-4 py-3 focus:outline-none focus:border-indigo-500 transition-colors placeholder-gray-700 leading-relaxed"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1.5 font-medium">補足情報（任意）</label>
                <textarea value={supplement} onChange={e=>setSupplement(e.target.value)} placeholder="補足があれば記載"
                  rows={3}
                  style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:"14px",resize:"none"}}
                  className="w-full text-white text-sm px-4 py-3 focus:outline-none focus:border-indigo-500 transition-colors placeholder-gray-700"
                />
              </div>
              {error && (
                <div style={{background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:"12px"}} className="px-4 py-2.5">
                  <p className="text-red-400 text-xs">{error}</p>
                </div>
              )}
              <button type="submit" disabled={loading}
                style={{background:"linear-gradient(135deg,#6366f1,#8b5cf6)",boxShadow:"0 4px 20px rgba(99,102,241,0.3)"}}
                className="w-full text-white font-bold rounded-2xl py-3 text-sm hover:opacity-90 disabled:opacity-50 transition-all">
                {loading ? "送信中..." : "相談を送信する"}
              </button>
            </form>
          </div>
        )}

        {/* THREAD VIEW */}
        {view === "thread" && selected && (
          <div className="flex flex-col h-full space-y-4">
            <div className="flex items-center gap-3">
              <button onClick={()=>{setView("list");fetchInquiries();}} className="text-gray-500 hover:text-white text-sm transition-colors">← 一覧に戻る</button>
              <div className="flex-1">
                <h1 className="text-base font-black text-white">{selected.title}</h1>
                <div className="flex gap-3 text-xs text-gray-600 mt-0.5">
                  <span>📂 {selected.category}</span>
                  <span style={{color:STATUS_COLORS[selected.status]}}>{selected.status_label}</span>
                </div>
              </div>
            </div>

            {/* メッセージ */}
            <div style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:"20px",minHeight:"400px",maxHeight:"500px",overflowY:"auto"}} className="p-4 space-y-4">
              {messages.length === 0 && (
                <p className="text-gray-600 text-sm text-center py-8">メッセージがありません</p>
              )}
              {messages.map(m => (
                <div key={m.message_id} className={`flex ${m.sender_type==="user"?"justify-end":"justify-start"} gap-2`}>
                  {m.sender_type === "admin" && (
                    <div style={{background:"linear-gradient(135deg,#6366f1,#8b5cf6)",flexShrink:0}} className="w-7 h-7 rounded-xl flex items-center justify-center mt-0.5">
                      <span className="text-white font-black text-xs">Y</span>
                    </div>
                  )}
                  <div style={m.sender_type==="user"
                    ?{background:"linear-gradient(135deg,#6366f1,#7c3aed)",borderRadius:"18px 18px 4px 18px",maxWidth:"75%"}
                    :{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:"4px 18px 18px 18px",maxWidth:"75%"}
                  } className="px-4 py-3">
                    {m.sender_type === "admin" && (
                      <p className="text-xs text-indigo-300 font-bold mb-1">Ys Consulting Office</p>
                    )}
                    <p className="text-sm text-white leading-relaxed whitespace-pre-wrap">{m.body}</p>
                    <p className="text-xs mt-1" style={{color:"rgba(255,255,255,0.3)"}}>{m.created_at.slice(0,16)}</p>
                  </div>
                </div>
              ))}
              <div ref={bottomRef}/>
            </div>

            {/* 返信 */}
            {selected.status !== "closed" && (
              <form onSubmit={handleReply} className="flex gap-2 items-end">
                <div style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:"18px"}} className="flex-1 focus-within:border-indigo-500/60 transition-all">
                  <textarea value={replyText} onChange={e=>setReplyText(e.target.value)}
                    placeholder="返信内容を入力..."
                    rows={2}
                    style={{background:"transparent",resize:"none"}}
                    className="w-full text-white text-sm px-4 py-3 focus:outline-none placeholder-gray-700 leading-relaxed"
                  />
                </div>
                <button type="submit" disabled={loading||!replyText.trim()}
                  style={{background:"linear-gradient(135deg,#6366f1,#8b5cf6)",borderRadius:"14px"}}
                  className="text-white font-bold p-3 transition-all disabled:opacity-50">
                  ▶
                </button>
              </form>
            )}
            {selected.status === "closed" && (
              <div style={{background:"rgba(107,114,128,0.1)",border:"1px solid rgba(107,114,128,0.3)",borderRadius:"14px"}} className="px-4 py-3 text-center">
                <p className="text-gray-500 text-sm">この相談は完了済みです</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
