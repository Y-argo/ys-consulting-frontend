"use client";
import React, { useState, useEffect, useRef } from "react";
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

function toStr(v: any): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map(toStr).join("\n");
  if (typeof v === "object") return Object.entries(v).map(([k,val])=>`${k}: ${toStr(val)}`).join("\n");
  return String(v);
}

function renderMd(text: string) {
  const html = text
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/^## (.+)$/gm,(m,p1)=>`<h3 style="color:#a5b4fc;font-size:13px;font-weight:800;margin:14px 0 6px">${p1}</h3>`)
    .replace(/^### (.+)$/gm,(m,p1)=>`<h4 style="color:#c4b5fd;font-size:12px;font-weight:700;margin:10px 0 4px">${p1}</h4>`)
    .replace(/\*\*(.+?)\*\*/g,(m,p1)=>`<strong style="color:white;font-weight:700">${p1}</strong>`)
    .replace(/^[*-] (.+)$/gm,(m,p1)=>`<div style="display:flex;gap:6px;margin:3px 0"><span style="color:#6366f1;flex-shrink:0">▸</span><span>${p1}</span></div>`)
    .replace(/^(\d+)\. (.+)$/gm,(m,p1,p2)=>`<div style="display:flex;gap:6px;margin:3px 0"><span style="color:#6366f1;font-weight:700;flex-shrink:0">${p1}.</span><span>${p2}</span></div>`)
    .replace(/\n/g,"<br/>");
  return html;
}

type ChatMsg = {role:"ai"|"user", content:string};

function QAInputArea({chatMsgs, chatLoading, userInput, setUserInput, onSend}: {
  chatMsgs: ChatMsg[];
  chatLoading: boolean;
  userInput: string;
  setUserInput: (v:string)=>void;
  onSend: ()=>void;
}) {
  // 最新のAIメッセージからQ1/Q2...を抽出
  const lastAiMsg = [...chatMsgs].reverse().find(m=>m.role==="ai")?.content || "";
  const qMatches = Array.from(lastAiMsg.matchAll(/Q(\d+)[\uff1a:\uFF1A]\s*([^\n]+)/g));
  const questions = qMatches.map(m=>({num:m[1], text:m[2].trim()}));

  const [answers, setAnswers] = React.useState<Record<string,string>>({});
  const [freeQ, setFreeQ] = React.useState("");

  React.useEffect(()=>{
    setAnswers({});
  }, [lastAiMsg]);

  function handleBulkSend() {
    if (questions.length > 0) {
      const combined = questions
        .map(q=>`Q${q.num}: ${q.text}\n回答: ${answers[q.num]||""}`)
        .join("\n\n");
      setUserInput(combined);
      setTimeout(()=>onSend(), 50);
    }
  }

  function handleFreeQSend() {
    if (!freeQ.trim()) return;
    setUserInput(freeQ);
    setFreeQ("");
    setTimeout(()=>onSend(), 50);
  }

  if (questions.length === 0) {
    return (
      <div style={{display:"flex",gap:"8px",flexDirection:"column" as const}}>
        <div style={{display:"flex",gap:"8px"}}>
          <input value={userInput} onChange={e=>setUserInput(e.target.value)}
            onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();onSend();}}}
            placeholder="回答を入力（Enterで送信）"
            style={{flex:1,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:"10px",padding:"10px 14px",color:"white",fontSize:"13px",outline:"none"}}
            disabled={chatLoading}/>
          <button onClick={onSend} disabled={!userInput.trim()||chatLoading}
            style={{background:(!userInput.trim()||chatLoading)?"rgba(255,255,255,0.05)":"linear-gradient(135deg,#6366f1,#8b5cf6)",borderRadius:"10px",padding:"10px 20px",color:"white",fontWeight:700,fontSize:"13px",cursor:"pointer",border:"none",whiteSpace:"nowrap" as const}}>
            送信
          </button>
        </div>
      </div>
    );
  }

  const allAnswered = questions.every(q=>(answers[q.num]||"").trim());

  return (
    <div style={{display:"flex",flexDirection:"column" as const,gap:"10px"}}>
      {/* 各質問の個別回答欄 */}
      {questions.map(q=>(
        <div key={q.num} style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"10px",padding:"10px 14px"}}>
          <p style={{color:"#a5b4fc",fontSize:"12px",fontWeight:700,marginBottom:"6px"}}>Q{q.num}: {q.text}</p>
          <textarea
            value={answers[q.num]||""}
            onChange={e=>setAnswers(prev=>({...prev,[q.num]:e.target.value}))}
            placeholder="回答を入力..."
            rows={2}
            style={{width:"100%",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:"8px",padding:"8px 12px",color:"white",fontSize:"13px",outline:"none",resize:"vertical" as const,boxSizing:"border-box" as const}}
            disabled={chatLoading}
          />
        </div>
      ))}
      {/* 一括送信 */}
      <button onClick={handleBulkSend} disabled={!allAnswered||chatLoading}
        style={{background:(!allAnswered||chatLoading)?"rgba(255,255,255,0.05)":"linear-gradient(135deg,#6366f1,#8b5cf6)",borderRadius:"10px",padding:"10px 20px",color:"white",fontWeight:700,fontSize:"13px",cursor:(!allAnswered||chatLoading)?"not-allowed":"pointer",border:"none"}}>
        {chatLoading?"送信中...":"✅ 回答を送信"}
      </button>
      {/* AIへの逆質問（自由入力） */}
      <div style={{borderTop:"1px solid rgba(255,255,255,0.06)",paddingTop:"10px"}}>
        <p style={{color:"rgba(255,255,255,0.3)",fontSize:"10px",marginBottom:"6px"}}>💬 AIへの質問（質問の意味が不明な場合など）</p>
        <div style={{display:"flex",gap:"8px"}}>
          <input value={freeQ} onChange={e=>setFreeQ(e.target.value)}
            onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();handleFreeQSend();}}}
            placeholder="AIへ質問を入力（Enterで送信）"
            style={{flex:1,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"10px",padding:"8px 12px",color:"white",fontSize:"12px",outline:"none"}}
            disabled={chatLoading}/>
          <button onClick={handleFreeQSend} disabled={!freeQ.trim()||chatLoading}
            style={{background:"rgba(99,102,241,0.2)",border:"1px solid rgba(99,102,241,0.3)",borderRadius:"10px",padding:"8px 16px",color:"#a5b4fc",fontWeight:700,fontSize:"12px",cursor:"pointer",whiteSpace:"nowrap" as const}}>
            質問
          </button>
        </div>
      </div>
    </div>
  );
}

export default function FileDiagnosis({C}: {C: any}) {
  const [file, setFile] = useState<File|null>(null);
  const [token, setToken] = useState("");
  const [mounted, setMounted] = useState(false);

  // フロー管理
  const [phase, setPhase] = useState<"idle"|"scanning"|"clarifying"|"diagnosing"|"done">("idle");

  // 確認チャット
  const [chatMsgs, setChatMsgs] = useState<ChatMsg[]>([]);
  const [userInput, setUserInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [fileSummary, setFileSummary] = useState("");
  const [savedContext, setSavedContext] = useState<{found:boolean,context:any}>({found:false,context:{}});

  // 診断結果
  const [result, setResult] = useState<any>(null);
  const [diagLoading, setDiagLoading] = useState(false);

  // 追加質問
  const [followUp, setFollowUp] = useState("");
  const [followUpLoading, setFollowUpLoading] = useState(false);
  const [history, setHistory] = useState<{q:string,a:string}[]>([]);

  // 診断履歴
  const [savedResults, setSavedResults] = useState<{filename:string,date:string,data:any}[]>([]);

  const fileRef = useRef<HTMLInputElement>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(()=>{
    setMounted(true);
    try {
      setToken(localStorage.getItem("ascend_token")||"");
      const saved = localStorage.getItem("file_diag_result");
      if (saved) setResult(JSON.parse(saved));
      const savedH = localStorage.getItem("file_diag_history");
      if (savedH) setHistory(JSON.parse(savedH));
      const savedR = localStorage.getItem("file_diag_results");
      if (savedR) setSavedResults(JSON.parse(savedR));
    } catch {}
  }, []);

  useEffect(()=>{
    chatBottomRef.current?.scrollIntoView({behavior:"smooth"});
  }, [chatMsgs]);

  // ファイルキー生成（ファイル名ベース）
  function getFileKey(f: File): string {
    return f.name.replace(/[^a-zA-Z0-9_\-\.]/g, "_").slice(0,100);
  }

  // Step1: ファイル選択→保存済みコンテキスト確認→スキャン開始
  async function handleStart() {
    if (!file) return;
    setPhase("scanning");
    setChatMsgs([]);
    setIsReady(false);
    setResult(null);

    const fileKey = getFileKey(file);

    // 保存済みコンテキストを確認
    try {
      const res = await fetch(`${API_BASE}/api/diagnosis/file_clarify_load?file_key=${encodeURIComponent(fileKey)}`, {
        headers: {Authorization:`Bearer ${token}`}
      });
      if (res.ok) {
        const d = await res.json();
        if (d.found && Object.keys(d.context).length > 0) {
          setSavedContext({found:true, context:d.context});
          // ユーザーの回答のみ抽出して表示
          const userAnswers = Object.entries(d.context)
            .filter(([k])=>k.startsWith("Q"))
            .map(([k,v])=>`${k}: ${v}`)
            .join("\n");
          setChatMsgs([{role:"ai",content:`以前の確認内容が保存されています。そのまま診断を開始しますか？\n\n【保存済み回答】\n${userAnswers}\n\n内容を変更したい場合は教えてください。`}]);
          setIsReady(true);
          setPhase("clarifying");
          setFileSummary(userAnswers);
          return;
        }
      }
    } catch {}

    // 保存済みなし→ファイルスキャン
    await scanFile(file);
  }

  async function scanFile(f: File) {
    setChatLoading(true);
    try {
      const form = new FormData();
      form.append("file", f);
      const res = await fetch(`${API_BASE}/api/diagnosis/file_diagnosis_check`, {
        method:"POST",
        headers: token ? {Authorization:`Bearer ${token}`} : {},
        body: form,
      });
      if (!res.ok) throw new Error("スキャン失敗");
      const d = await res.json();

      const summary = `ファイル: ${f.name}\nシート: ${(d.sheets||[]).join(", ")}\n\n【データ概要】\n${d.file_data||""}`;
      setFileSummary(summary);

      if (d.need_clarification && d.questions?.length > 0) {
        // AIの最初の質問
        const firstMsg = `ファイルを確認しました。正確な診断のために、いくつか確認させてください。\n\n${d.questions.join("\n\n")}\n\nご不明な点があれば、逆にご質問いただいても構いません。`;
        setChatMsgs([{role:"ai", content:firstMsg}]);
        setPhase("clarifying");
      } else {
        // 確認不要→直接診断
        setIsReady(true);
        setChatMsgs([{role:"ai", content:"ファイルを確認しました。専門用語の確認は不要です。診断を開始してください。"}]);
        setPhase("clarifying");
      }
    } catch(e:any) {
      setChatMsgs([{role:"ai", content:`スキャンエラー: ${e.message}`}]);
      setPhase("idle");
    } finally {
      setChatLoading(false);
    }
  }

  // Step2: チャット送信（双方向）
  async function handleChatSend() {
    if (!userInput.trim() || chatLoading) return;
    const msg = userInput.trim();
    setUserInput("");

    const newMsgs: ChatMsg[] = [...chatMsgs, {role:"user", content:msg}];
    setChatMsgs(newMsgs);
    setChatLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/diagnosis/file_clarify`, {
        method:"POST",
        headers: {Authorization:`Bearer ${token}`,"Content-Type":"application/json"},
        body: JSON.stringify({
          messages: newMsgs.map(m=>({role:m.role==="ai"?"assistant":"user", content:m.content})),
          file_summary: fileSummary,
          user_message: "",
        }),
      });
      if (!res.ok) throw new Error("通信エラー");
      const d = await res.json();

      const aiMsg: ChatMsg = {role:"ai", content:d.message};
      setChatMsgs([...newMsgs, aiMsg]);

      if (d.is_ready) {
        setIsReady(true);
        // 会話内容をコンテキストとして保存
        await saveContext(newMsgs, d.message);
      }
    } catch(e:any) {
      setChatMsgs([...newMsgs, {role:"ai", content:`エラー: ${e.message}`}]);
    } finally {
      setChatLoading(false);
    }
  }

  // コンテキストをFirestoreに保存
  async function saveContext(msgs: ChatMsg[], lastAiMsg: string) {
    if (!file) return;
    const fileKey = getFileKey(file);
    const contextObj: any = {};
    msgs.forEach((m,i)=>{
      if (m.role==="user") contextObj[`Q${Math.floor(i/2)+1}`] = m.content;
      else contextObj[`A${Math.floor(i/2)+1}`] = m.content;
    });
    contextObj["最終確認"] = lastAiMsg;
    try {
      await fetch(`${API_BASE}/api/diagnosis/file_clarify_save`, {
        method:"POST",
        headers: {Authorization:`Bearer ${token}`,"Content-Type":"application/json"},
        body: JSON.stringify({file_key:fileKey, context:contextObj}),
      });
    } catch {}
  }

  // Step3: 本診断実行
  async function handleDiagnose() {
    if (!file) return;
    setPhase("diagnosing");
    setDiagLoading(true);
    // 保存済みコンテキストがない場合のみ保存（上書き防止）
    if (chatMsgs.length > 0 && !savedContext.found) {
      await saveContext(chatMsgs, "診断開始");
    }

    // チャット内容をコンテキストとしてまとめる
    const chatContext = chatMsgs
      .map(m=>`${m.role==="ai"?"AI":"ユーザー"}: ${m.content}`)
      .join("\n");
    // 保存済みコンテキストがある場合はそちらも含める
    const savedCtxStr = savedContext.found && savedContext.context
      ? "\nユーザー（保存済み確認内容）: " + Object.entries(savedContext.context)
          .filter(([k])=>k.startsWith("Q"))
          .map(([k,v])=>`${k}: ${v}`)
          .join("\nユーザー: ")
      : "";
    const answerContext = chatContext + savedCtxStr;

    try {
      const form = new FormData();
      form.append("file", file);
      form.append("answer_context", answerContext);
      const res = await fetch(`${API_BASE}/api/diagnosis/file_diagnosis`, {
        method:"POST",
        headers: token ? {Authorization:`Bearer ${token}`} : {},
        body: form,
      });
      if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.detail||"診断失敗"); }
      const d = await res.json();
      setResult(d);
      setPhase("done");
      try {
        localStorage.setItem("file_diag_result", JSON.stringify(d));
        const newR = [{filename:file.name, date:new Date().toLocaleString("ja-JP"), data:d}, ...savedResults].slice(0,10);
        setSavedResults(newR);
        localStorage.setItem("file_diag_results", JSON.stringify(newR));
      } catch {}
    } catch(e:any) {
      setChatMsgs(prev=>[...prev, {role:"ai", content:`診断エラー: ${(e as any).message}`}]);
      setPhase("clarifying");
    } finally {
      setDiagLoading(false);
    }
  }

  // 追加質問
  async function handleFollowUp() {
    if (!followUp.trim()||!result) return;
    setFollowUpLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/diagnosis/file_followup`, {
        method:"POST",
        headers: {Authorization:`Bearer ${token}`,"Content-Type":"application/json"},
        body: JSON.stringify({question:followUp, context:JSON.stringify(result), filename:result.filename||""}),
      });
      if (!res.ok) throw new Error("追加分析失敗");
      const d = await res.json();
      const ans = d.answer||"";
      const newH = [...history, {q:followUp, a:ans}];
      setHistory(newH);
      try { localStorage.setItem("file_diag_history", JSON.stringify(newH)); } catch {}
      setFollowUp("");
    } catch(e:any) { } finally { setFollowUpLoading(false); }
  }

  const S = {
    card: {background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"14px",padding:"16px 20px"},
    aiMsg: {background:"rgba(99,102,241,0.1)",border:"1px solid rgba(99,102,241,0.2)",borderRadius:"12px 12px 12px 2px",padding:"12px 16px",maxWidth:"85%"},
    userMsg: {background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:"12px 12px 2px 12px",padding:"12px 16px",maxWidth:"85%",marginLeft:"auto"},
  };

  return (
    <div className="space-y-4">
      {/* ファイル選択 */}
      {phase==="idle" && (
        <div style={{display:"flex",gap:"12px",alignItems:"center",flexWrap:"wrap" as const}}>
          <button onClick={()=>fileRef.current?.click()}
            style={{background:"rgba(99,102,241,0.15)",border:"1px solid rgba(99,102,241,0.4)",borderRadius:"10px",padding:"10px 18px",color:"#a5b4fc",fontSize:"13px",fontWeight:700,cursor:"pointer"}}>
            {file?`📄 ${file.name}`:"📂 ファイルを選択"}
          </button>
          <input ref={fileRef} type="file" style={{display:"none"}}
            accept=".xlsx,.xls,.ods,.csv,.txt,.pdf,.md"
            onChange={e=>{if(e.target.files?.[0]){setFile(e.target.files[0]);}}}/>
          <button onClick={handleStart} disabled={!file}
            style={{background:!file?"rgba(255,255,255,0.05)":"linear-gradient(135deg,#6366f1,#8b5cf6)",borderRadius:"10px",padding:"10px 24px",color:"white",fontWeight:700,fontSize:"13px",cursor:!file?"not-allowed":"pointer",border:"none"}}>
            🔍 診断開始
          </button>
          {file&&<span style={{color:"rgba(255,255,255,0.3)",fontSize:"11px"}}>({(file.size/1024).toFixed(1)}KB)</span>}
        </div>
      )}

      {/* スキャン中 */}
      {phase==="scanning" && (
        <div style={{...S.card,textAlign:"center" as const}}>
          <p style={{color:"rgba(255,255,255,0.6)",fontSize:"13px"}}>🔍 ファイルをスキャン中...</p>
        </div>
      )}

      {/* 双方向確認チャット */}
      {(phase==="clarifying"||phase==="diagnosing") && (
        <div style={{...S.card,padding:"0"}}>
          <div style={{padding:"14px 18px",borderBottom:"1px solid rgba(255,255,255,0.06)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <p style={{color:"rgba(255,255,255,0.4)",fontSize:"9px",fontWeight:700,letterSpacing:"0.15em",marginBottom:"2px"}}>CLARIFICATION CHAT — AIへの逆質問も可能</p>
              <p style={{color:"white",fontSize:"13px",fontWeight:700}}>📄 {file?.name}</p>
            </div>
            <div style={{display:"flex",gap:"8px"}}>
              {mounted && savedContext.found && (
                <span style={{background:"rgba(16,185,129,0.15)",border:"1px solid rgba(16,185,129,0.3)",borderRadius:"6px",padding:"4px 10px",color:"#6ee7b7",fontSize:"10px",fontWeight:700}}>
                  ✅ 保存済みコンテキスト使用
                </span>
              )}
              <button onClick={()=>{setPhase("idle");setChatMsgs([]);setFile(null);setResult(null);setIsReady(false);setSavedContext({found:false,context:{}});}}
                style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:"8px",padding:"6px 12px",color:"rgba(255,255,255,0.4)",fontSize:"11px",cursor:"pointer"}}>
                ✕ リセット
              </button>
            </div>
          </div>

          {/* チャット履歴 */}
          <div style={{padding:"16px 18px",maxHeight:"400px",overflowY:"auto" as const,display:"flex",flexDirection:"column" as const,gap:"12px"}}>
            {mounted && chatMsgs.map((m,i)=>(
              <div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start"}}>
                <div style={m.role==="ai"?S.aiMsg:S.userMsg}>
                  {m.role==="ai"&&<p style={{color:"#a5b4fc",fontSize:"9px",fontWeight:700,marginBottom:"6px"}}>🤖 ASCEND</p>}
                  <p style={{color:"rgba(255,255,255,0.85)",fontSize:"13px",lineHeight:1.7,whiteSpace:"pre-wrap" as const}}>{m.content}</p>
                </div>
              </div>
            ))}
            {chatLoading && (
              <div style={{display:"flex",justifyContent:"flex-start"}}>
                <div style={S.aiMsg}><p style={{color:"rgba(255,255,255,0.4)",fontSize:"12px"}}>考え中...</p></div>
              </div>
            )}
            <div ref={chatBottomRef}/>
          </div>

          {/* 入力エリア（clarifyingフェーズのみ） */}
          {phase==="clarifying" && (
            <div style={{padding:"12px 18px",borderTop:"1px solid rgba(255,255,255,0.06)"}}>
              {!isReady ? (
                <QAInputArea
                  chatMsgs={chatMsgs}
                  chatLoading={chatLoading}
                  userInput={userInput}
                  setUserInput={setUserInput}
                  onSend={handleChatSend}
                />
              ) : (
                <div style={{display:"flex",gap:"8px",alignItems:"center"}}>
                  <p style={{color:"#6ee7b7",fontSize:"12px",flex:1}}>✅ 確認完了。診断を開始できます。</p>
                  <button onClick={handleDiagnose}
                    style={{background:"linear-gradient(135deg,#059669,#10b981)",borderRadius:"10px",padding:"10px 24px",color:"white",fontWeight:700,fontSize:"13px",border:"none",cursor:"pointer"}}>
                    🚀 診断開始
                  </button>
                  <button onClick={()=>setIsReady(false)}
                    style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:"10px",padding:"10px 16px",color:"rgba(255,255,255,0.4)",fontSize:"13px",cursor:"pointer"}}>
                    追加確認
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 診断中 */}
          {phase==="diagnosing" && (
            <div style={{padding:"14px 18px",borderTop:"1px solid rgba(255,255,255,0.06)",textAlign:"center" as const}}>
              <p style={{color:"rgba(255,255,255,0.5)",fontSize:"13px"}}>🔬 診断中...</p>
            </div>
          )}
        </div>
      )}

      {/* 診断結果 */}
      {mounted && result && phase==="done" && (
        <div style={{background:"rgba(16,185,129,0.1)",border:"1px solid rgba(16,185,129,0.3)",borderRadius:"12px",padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <p style={{color:"#6ee7b7",fontSize:"12px",fontWeight:700}}>✅ 診断完了 — 📄 {result.filename}</p>
          <button onClick={()=>{setPhase("idle");setResult(null);setFile(null);setChatMsgs([]);setIsReady(false);setSavedContext({found:false,context:{}});}}
            style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:"8px",padding:"5px 12px",color:"rgba(255,255,255,0.4)",fontSize:"11px",cursor:"pointer"}}>
            ✕ 新しい診断
          </button>
        </div>
      )}
      {mounted && result && phase==="done" && (
        <div className="space-y-4">
          {(!result.overview && !result.structure && !result.issues) && (
            <div style={{background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:"12px",padding:"14px 18px"}}>
              <p style={{color:"#fca5a5",fontSize:"13px",fontWeight:700}}>⚠️ 診断結果が取得できませんでした</p>
              <p style={{color:"rgba(255,255,255,0.5)",fontSize:"12px",marginTop:"4px"}}>「新しい診断」から再実行してください。LLMモデルが無応答でした。</p>
            </div>
          )}
          {result.overview&&<div style={{...S.card}}><p style={{color:"rgba(255,255,255,0.4)",fontSize:"10px",fontWeight:700,letterSpacing:"0.15em",marginBottom:"8px"}}>OVERVIEW</p><div style={{color:"rgba(255,255,255,0.85)",fontSize:"13px",lineHeight:1.8}} suppressHydrationWarning dangerouslySetInnerHTML={{__html:renderMd(toStr(result.overview))}}/></div>}
          {result.structure&&<div style={{background:"rgba(99,102,241,0.08)",border:"1px solid rgba(99,102,241,0.2)",borderRadius:"14px",padding:"16px 20px"}}><p style={{color:"#a5b4fc",fontSize:"10px",fontWeight:700,letterSpacing:"0.15em",marginBottom:"8px"}}>🏗️ 構造診断</p><div style={{color:"rgba(255,255,255,0.8)",fontSize:"13px",lineHeight:1.8}} suppressHydrationWarning dangerouslySetInnerHTML={{__html:renderMd(toStr(result.structure))}}/></div>}
          {result.issues&&<div style={{background:"rgba(234,179,8,0.08)",border:"1px solid rgba(234,179,8,0.2)",borderRadius:"14px",padding:"16px 20px"}}><p style={{color:"#fde047",fontSize:"10px",fontWeight:700,letterSpacing:"0.15em",marginBottom:"8px"}}>🎯 課題仮説</p><div style={{color:"rgba(255,255,255,0.8)",fontSize:"13px",lineHeight:1.8}} suppressHydrationWarning dangerouslySetInnerHTML={{__html:renderMd(toStr(result.issues))}}/></div>}
          {result.action_plan&&<div style={{background:"rgba(16,185,129,0.08)",border:"1px solid rgba(16,185,129,0.2)",borderRadius:"14px",padding:"16px 20px"}}><p style={{color:"#6ee7b7",fontSize:"10px",fontWeight:700,letterSpacing:"0.15em",marginBottom:"8px"}}>📋 実行計画</p><div style={{color:"rgba(255,255,255,0.8)",fontSize:"13px",lineHeight:1.8}} suppressHydrationWarning dangerouslySetInnerHTML={{__html:renderMd(toStr(result.action_plan))}}/></div>}
          {result.key_metrics&&<div style={{background:"rgba(139,92,246,0.08)",border:"1px solid rgba(139,92,246,0.2)",borderRadius:"14px",padding:"16px 20px"}}><p style={{color:"#c4b5fd",fontSize:"10px",fontWeight:700,letterSpacing:"0.15em",marginBottom:"8px"}}>📊 重要指標</p><div style={{color:"rgba(255,255,255,0.8)",fontSize:"13px",lineHeight:1.8}} suppressHydrationWarning dangerouslySetInnerHTML={{__html:renderMd(toStr(result.key_metrics))}}/></div>}
          {result.risks&&<div style={{background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:"14px",padding:"16px 20px"}}><p style={{color:"#fca5a5",fontSize:"10px",fontWeight:700,letterSpacing:"0.15em",marginBottom:"8px"}}>⚠️ リスク</p><div style={{color:"rgba(255,255,255,0.8)",fontSize:"13px",lineHeight:1.8}} suppressHydrationWarning dangerouslySetInnerHTML={{__html:renderMd(toStr(result.risks))}}/></div>}
          {result.sheets&&<div style={{...S.card,padding:"12px 16px"}}><p style={{color:"rgba(255,255,255,0.3)",fontSize:"10px",fontWeight:700,marginBottom:"8px"}}>📋 解析シート</p><div style={{display:"flex",gap:"8px",flexWrap:"wrap" as const}}>{result.sheets.map((s:string)=>(<span key={s} style={{background:"rgba(99,102,241,0.15)",borderRadius:"6px",padding:"3px 10px",color:"#a5b4fc",fontSize:"11px"}}>{s}</span>))}</div></div>}
        </div>
      )}

      {/* 診断履歴一覧 */}
      {mounted && savedResults.length>0 && (
        <div style={{...S.card,padding:"14px 18px"}}>
          <p style={{color:"rgba(255,255,255,0.3)",fontSize:"10px",fontWeight:700,marginBottom:"10px"}}>📂 診断履歴（最新10件）</p>
          <div className="space-y-2">
            {savedResults.map((r,i)=>(
              <div key={i} onClick={()=>{setResult(r.data);setPhase("done");setFile(null);setChatMsgs([]);setIsReady(false);}}
                style={{display:"flex",alignItems:"center",gap:"10px",cursor:"pointer",padding:"8px 10px",borderRadius:"8px",background:"rgba(99,102,241,0.05)",border:"1px solid rgba(255,255,255,0.05)"}}>
                <span style={{color:"#a5b4fc",fontSize:"12px",fontWeight:700,flex:1}}>📄 {r.filename}</span>
                <span style={{color:"rgba(255,255,255,0.3)",fontSize:"11px"}}>{r.date}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 追加質問 */}
      <div style={{...S.card,marginTop:"8px"}}>
        <p style={{color:"rgba(255,255,255,0.4)",fontSize:"10px",fontWeight:700,letterSpacing:"0.15em",marginBottom:"12px"}}>🔍 追加質問・深掘り</p>
        <div style={{display:"flex",gap:"8px"}}>
          <input value={followUp} onChange={e=>setFollowUp(e.target.value)}
            onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey)handleFollowUp();}}
            placeholder="例：各項目の合計・平均を集計して / 課題の優先度を数値で評価して"
            style={{flex:1,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:"10px",padding:"10px 14px",color:"white",fontSize:"13px",outline:"none"}}/>
          <button onClick={handleFollowUp} disabled={!followUp.trim()||followUpLoading||!result}
            style={{background:(!followUp.trim()||followUpLoading||!result)?"rgba(255,255,255,0.05)":"linear-gradient(135deg,#6366f1,#8b5cf6)",borderRadius:"10px",padding:"10px 20px",color:"white",fontWeight:700,fontSize:"13px",cursor:(!followUp.trim()||followUpLoading||!result)?"not-allowed":"pointer",border:"none",whiteSpace:"nowrap" as const}}>
            {followUpLoading?"分析中...":"送信"}
          </button>
        </div>
        {mounted && history.length>0 && (
          <div style={{marginTop:"16px"}}>
            <p style={{color:"rgba(255,255,255,0.3)",fontSize:"10px",fontWeight:700,marginBottom:"8px"}}>📜 追加質問履歴</p>
            <div className="space-y-2">
              {history.map((h,i)=>(
                <div key={i} style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:"10px",padding:"12px 14px"}}>
                  <p style={{color:"#a5b4fc",fontSize:"11px",fontWeight:700,marginBottom:"6px"}}>Q: {h.q}</p>
                  <p style={{color:"rgba(255,255,255,0.7)",fontSize:"12px",lineHeight:1.6,whiteSpace:"pre-wrap" as const}}>{h.a}</p>
                </div>
              ))}
            </div>
            <button onClick={()=>{setHistory([]);try{localStorage.removeItem("file_diag_history");}catch{}}}
              style={{marginTop:"8px",background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:"8px",padding:"6px 14px",color:"#fca5a5",fontSize:"11px",cursor:"pointer"}}>
              🗑️ 履歴クリア
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
