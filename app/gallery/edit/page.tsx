"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { sendImageMessage } from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = String(reader.result || "");
      resolve(result.split(",")[1] || "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function GalleryEditInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const src = sp.get("src") || "";
  const [loading, setLoading] = useState(false);
  const [resultImages, setResultImages] = useState<any[]>([]);
  const [status, setStatus] = useState("");

  const [target, setTarget] = useState("");
  const [area, setArea] = useState("");
  const [change, setChange] = useState("");
  const [color, setColor] = useState("");
  const [keep, setKeep] = useState("");
  const [remove, setRemove] = useState("");
  const [add, setAdd] = useState("");
  const [bg, setBg] = useState("");
  const [texture, setTexture] = useState("");
  const [layout, setLayout] = useState("");
  const [text, setText] = useState("");
  const [forbid, setForbid] = useState("");
  const [mustKeep, setMustKeep] = useState("");
  const [note, setNote] = useState("");

  async function handleGenerate() {
    if (!src) return;
    setLoading(true);

    let imageB64 = "";
    let imageMime = "image/png";

    try {
      setStatus("画像を取得中...");
      console.log("[gallery/edit] fetch image start", { src });

      const imgRes = await fetch(src);

      console.log("[gallery/edit] fetch image response", {
        ok: imgRes.ok,
        status: imgRes.status,
        contentType: imgRes.headers.get("content-type"),
      });

      if (!imgRes.ok) {
        throw new Error(`画像取得失敗: ${imgRes.status}`);
      }

      const blob = await imgRes.blob();

      console.log("[gallery/edit] image blob", {
        size: blob.size,
        type: blob.type,
      });

      imageB64 = await blobToBase64(blob);
      imageMime = blob.type || "image/png";
    } catch (e: any) {
      console.error("[gallery/edit] image fetch/base64 failed", e);
      setStatus("画像取得または変換で失敗: " + (e?.message || String(e)));
      setLoading(false);
      return;
    }

    const parts = [
      target && `編集対象: ${target}`,
      area && `変更箇所: ${area}`,
      change && `変更内容: ${change}`,
      color && `色指定: ${color}`,
      keep && `残す要素: ${keep}`,
      remove && `消す要素: ${remove}`,
      add && `追加要素: ${add}`,
      bg && `背景: ${bg}`,
      texture && `質感: ${texture}`,
      layout && `構図: ${layout}`,
      text && `文字: ${text}`,
      forbid && `禁止事項: ${forbid}`,
      mustKeep && `絶対に変えない部分: ${mustKeep}`,
      note && `補足: ${note}`,
    ].filter(Boolean).join("\n");

    const prompt = `Edit the provided image. Follow only these instructions. Keep all unspecified elements unchanged.\n${parts}`.trim();

    try {
      setStatus("編集画像を生成中...");
      console.log("[gallery/edit] sendImageMessage start", {
        promptLength: prompt.length,
        imageMime,
        imageB64Length: imageB64.length,
      });

      const res = await sendImageMessage(prompt, "main", "core", imageB64, imageMime);

      console.log("[gallery/edit] sendImageMessage response", res);

      const imgs = Array.isArray((res as any).images) ? (res as any).images : [];
      setResultImages(imgs);
      setStatus(
        (res as any).reply ||
          (imgs.length
            ? "編集画像を生成しました。"
            : "処理は完了しました。ギャラリーをご確認ください。")
      );
    } catch (e: any) {
      console.error("[gallery/edit] sendImageMessage failed", e);
      setStatus("API送信で失敗: " + (e?.message || String(e)));
    } finally {
      setLoading(false);
    }
  }

  const field = (label:string, value:string, setter:(v:string)=>void, ph:string) => (
    <label style={{display:"block",marginBottom:12,fontSize:13,fontWeight:700}}>
      {label}
      <textarea value={value} onChange={e=>setter(e.target.value)} placeholder={ph}
        style={{width:"100%",minHeight:54,marginTop:6,padding:10,border:"1px solid #ddd",borderRadius:10}}/>
    </label>
  );

  return (
    <main style={{maxWidth:960,margin:"0 auto",padding:24,fontFamily:"sans-serif"}}>
      <button onClick={()=>router.back()} style={{marginBottom:16}}>← 戻る</button>
      <h1 style={{fontSize:22,fontWeight:900,marginBottom:16}}>ギャラリー画像を編集</h1>
      <p style={{fontSize:11,color:"#999",wordBreak:"break-all",marginBottom:12}}>
        API送信先: {process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || "(empty)"}
      </p>

      {src && <img src={src} style={{width:"100%",maxHeight:360,objectFit:"contain",borderRadius:16,border:"1px solid #ddd",marginBottom:20}}/>}

      {field("編集対象", target, setTarget, "例：中央の人物、背景、ロゴ部分")}
      {field("変更箇所", area, setArea, "例：右上の文字、服の色、背景全体")}
      {field("変更内容", change, setChange, "例：高級感のある雰囲気にする")}
      {field("色指定", color, setColor, "例：黒と金、淡いピンク、赤は禁止")}
      {field("残す要素", keep, setKeep, "例：人物の表情、構図、ロゴ位置")}
      {field("消す要素", remove, setRemove, "例：背景の看板、不要な文字")}
      {field("追加要素", add, setAdd, "例：小さな金色の装飾")}
      {field("背景", bg, setBg, "例：白背景、夜景、無地")}
      {field("質感", texture, setTexture, "例：写真風、艶感、マット")}
      {field("構図", layout, setLayout, "例：構図は維持、中央寄せ")}
      {field("文字", text, setText, "例：追加する文言、削除する文言")}
      {field("禁止事項", forbid, setForbid, "例：顔を変えない、余計な文字を足さない")}
      {field("絶対に変えない部分", mustKeep, setMustKeep, "例：人物、ロゴ、色味")}
      {field("補足", note, setNote, "任意")}

      <button disabled={loading} onClick={handleGenerate}
        style={{width:"100%",padding:14,borderRadius:12,background:"#4f46e5",color:"#fff",fontWeight:900,border:"none"}}>
        {loading ? "生成中..." : "編集画像を生成"}
      </button>

      {status && <p style={{marginTop:12,fontSize:13,color:"#555"}}>{status}</p>}

      {resultImages.length > 0 && (
        <div style={{marginTop:24}}>
          <h2 style={{fontSize:18,fontWeight:900}}>生成結果</h2>
          {resultImages.map((img:any,i:number)=>(
            <img key={i} src={img.gcs_url || `data:${img.mime_type};base64,${img.data}`}
              style={{width:"100%",maxHeight:420,objectFit:"contain",borderRadius:16,border:"1px solid #ddd",marginTop:12}}/>
          ))}
        </div>
      )}
    </main>
  );
}


export default function GalleryEditPage() {
  return (
    <Suspense fallback={<main style={{padding:24}}>読み込み中...</main>}>
      <GalleryEditInner />
    </Suspense>
  );
}
