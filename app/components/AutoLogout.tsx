"use client";
import { useEffect } from "react";
import { logout } from "@/lib/api";

export default function AutoLogout() {
  useEffect(() => {
    let _timeoutMin = 15;
    const _lastAct = { ts: Date.now() };
    const _updateAct = () => { _lastAct.ts = Date.now(); };
    window.addEventListener("mousemove", _updateAct);
    window.addEventListener("keydown", _updateAct);
    window.addEventListener("click", _updateAct);
    window.addEventListener("touchstart", _updateAct);
    let _timer: ReturnType<typeof setInterval> | null = null;
    const _startTimer = (min: number) => {
      if (_timer) clearInterval(_timer);
      _timer = setInterval(() => {
        if (Date.now() - _lastAct.ts > min * 60 * 1000) {
          logout();
          window.location.href = "/";
        }
      }, 30000);
    };
    fetch("/api/user/session_timeout")
      .then(r => r.json())
      .then(d => { _timeoutMin = d.session_timeout_minutes || 15; _startTimer(_timeoutMin); })
      .catch(() => { _startTimer(_timeoutMin); });
    return () => {
      if (_timer) clearInterval(_timer);
      window.removeEventListener("mousemove", _updateAct);
      window.removeEventListener("keydown", _updateAct);
      window.removeEventListener("click", _updateAct);
      window.removeEventListener("touchstart", _updateAct);
    };
  }, []);
  return null;
}
