"use client";
import { useEffect, useState } from "react";
import { fetchAd, recordAdClick } from "@/lib/api";

interface AdData {
  id: string;
  image_url: string;
  link_url: string;
  alt_text: string;
  position: string;
  tenant_id: string;
}

interface Props {
  position: "sidebar" | "mypage";
}

export default function AdBanner({ position }: Props) {
  const [ad, setAd] = useState<AdData | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    fetchAd(position)
      .then((res) => setAd(res.ad))
      .catch(() => setAd(null));
  }, [position]);

  if (!mounted || !ad) return null;

  const handleClick = () => {
    if (!ad.link_url) return;
    recordAdClick(ad.id, ad.tenant_id);
    window.open(ad.link_url, "_blank", "noopener,noreferrer");
  };

  return (
    <div
      style={{
        width: "100%",
        margin: position === "sidebar" ? "12px 0 0" : "12px 0",
        borderRadius: 8,
        overflow: "hidden",
        border: "none",
        cursor: ad.link_url ? "pointer" : "default",
        display: "block",
      }}
      onClick={handleClick}
      title={ad.alt_text || "広告"}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={ad.image_url}
        alt={ad.alt_text || "広告"}
        style={{ width: "100%", height: "auto", display: "block" }}
      />
    </div>
  );
}
