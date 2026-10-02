"use client";

import { useEffect, useRef, useState } from "react";
import { Gauge } from "lucide-react";

/** Narration plays a little slower by default so it's easier to follow. */
export const DEFAULT_NARRATION_RATE = 0.9;
const RATES = [0.75, 0.85, 0.9, 1, 1.15, 1.25];

/**
 * Audio player with a speed control. Browsers keep the pitch when slowing down
 * (`preservesPitch`), so slower narration still sounds natural. The learner's
 * choice is remembered on this device.
 */
export function NarrationPlayer({ src, className }: { src: string; className?: string }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [rate, setRate] = useState(DEFAULT_NARRATION_RATE);

  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem("afe.narrationRate"));
      if (RATES.includes(saved)) setRate(saved);
    } catch {
      /* storage unavailable — keep the default */
    }
  }, []);

  // playbackRate resets whenever the source (re)loads, so apply it on every change.
  const apply = () => {
    const el = ref.current;
    if (!el) return;
    el.preservesPitch = true;
    el.playbackRate = rate;
  };
  useEffect(apply, [rate, src]);

  const choose = (r: number) => {
    setRate(r);
    try {
      localStorage.setItem("afe.narrationRate", String(r));
    } catch {
      /* ignore */
    }
  };

  return (
    <div className={className}>
      <audio
        ref={ref}
        src={src}
        controls
        preload="metadata"
        controlsList="nodownload noplaybackrate"
        onLoadedMetadata={apply}
        className="w-full"
      >
        Your browser does not support audio.
      </audio>
      <label className="mt-2 inline-flex items-center gap-2 text-[12px] text-muted-foreground">
        <Gauge className="w-3.5 h-3.5" aria-hidden />
        Speed
        <select
          value={rate}
          onChange={(e) => choose(Number(e.target.value))}
          className="h-7 rounded-lg border border-input bg-card px-1.5 text-[12px] text-foreground"
          aria-label="Narration speed"
        >
          {RATES.map((r) => (
            <option key={r} value={r}>
              {r === 1 ? "Normal (1×)" : `${r}×`}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
