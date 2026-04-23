import { Track } from "@/lib/reaperApi";
import { useReaper } from "@/hooks/useReaper";
import { ampToSlider, formatDb, sliderToAmp } from "@/lib/reaperApi";
import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Circle } from "lucide-react";

interface Props {
  track: Track;
  compact?: boolean;
  groupColor?: string; // "H S% L%" hsl triplet
}

export function TrackStrip({ track, compact = true, groupColor }: Props) {
  const { api, config, selectedTrack, setSelectedTrack, transport } = useReaper();
  const [localVol, setLocalVol] = useState(() => ampToSlider(track.volume));
  const [localPan, setLocalPan] = useState(track.pan);
  const isPlaying = transport?.playstate === 1;
  const selected = selectedTrack === track.index;

  useEffect(() => { setLocalVol(ampToSlider(track.volume)); }, [track.volume]);
  useEffect(() => { setLocalPan(track.pan); }, [track.pan]);

  const commitVol = (v: number) => api.setVolume(config, track.index, v).catch(() => undefined);
  const commitPan = (v: number) => api.setPan(config, track.index, v).catch(() => undefined);

  const label = track.isMaster ? "MASTER" : (track.name || `${track.index}`);
  const width = compact ? "w-[58px]" : "w-[78px]";

  return (
    <div
      onClick={() => setSelectedTrack(track.index)}
      className={cn(
        "flex flex-col items-stretch shrink-0 select-none",
        width,
        "bg-surface border-l border-r border-border cursor-pointer",
        selected && "bg-surface-2",
      )}
    >
      {/* Header: track name */}
      <div className="flex items-center gap-0.5 px-1 py-0.5 bg-surface-3 border-b border-border h-5">
        <span className="text-[10px] truncate flex-1 text-foreground/90">{label}</span>
        <ChevronDown className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
      </div>

      {/* Pan knob centered */}
      <div className="flex justify-center py-1 border-b border-border">
        <PanKnob value={localPan} onChange={(v) => { setLocalPan(v); commitPan(v); }} />
      </div>

      {/* dB readout */}
      <div className="text-center text-[9px] text-muted-foreground font-mono py-0.5 border-b border-border">
        {formatDb(sliderToAmp(localVol))}
      </div>

      {/* Mute / Solo */}
      <div className="flex gap-0.5 px-1 py-0.5 border-b border-border">
        <MiniBtn
          active={track.mute}
          activeClass="bg-mute text-black"
          onClick={(e) => { e.stopPropagation(); api.setMute(config, track.index, !track.mute); }}
        >M</MiniBtn>
        <MiniBtn
          active={track.solo}
          activeClass="bg-solo text-white"
          onClick={(e) => { e.stopPropagation(); api.setSolo(config, track.index, !track.solo); }}
        >S</MiniBtn>
      </div>

      {/* Fader area: real VU + fader */}
      <div className="flex gap-0.5 px-1 py-1.5 h-[160px] justify-center">
        <div className="flex gap-px w-2.5">
          <VuMeter active={isPlaying && !track.mute} peak={track.peakL} />
          <VuMeter active={isPlaying && !track.mute} peak={track.peakR} />
        </div>
        <FaderTrack
          value={localVol}
          onChange={(v) => setLocalVol(v)}
          onCommit={(v) => commitVol(v)}
        />
      </div>

      {/* FX list */}
      <div className="px-1 py-0.5 border-t border-border min-h-[18px]">
        {track.fx.length === 0 ? (
          <div className="text-[8px] text-muted-foreground/60 text-center leading-tight">
            {track.hasFx ? "…" : "—"}
          </div>
        ) : (
          <div className="flex flex-col gap-px">
            {track.fx.slice(0, 3).map((name, i) => (
              <div
                key={i}
                title={name}
                className="text-[8px] leading-tight truncate bg-primary/20 text-primary border border-primary/30 rounded-sm px-0.5"
              >
                {name.replace(/^(VST3?:|VSTi?:|JS:|AU:)\s*/, "").split("(")[0].trim()}
              </div>
            ))}
            {track.fx.length > 3 && (
              <div className="text-[8px] text-muted-foreground text-center">+{track.fx.length - 3}</div>
            )}
          </div>
        )}
      </div>

      {/* Record arm */}
      <div className="flex justify-center py-1 border-t border-border">
        <button
          onClick={(e) => { e.stopPropagation(); api.setRecArm(config, track.index, !track.recarm); }}
          title="Record arm"
          className={cn(
            "h-4 w-4 rounded-full border-2 flex items-center justify-center transition-colors",
            track.recarm
              ? "border-record bg-record/30 animate-record"
              : "border-border-light bg-surface-3 hover:bg-surface-2",
          )}
        >
          <Circle className={cn("h-1.5 w-1.5", track.recarm ? "fill-record text-record" : "fill-muted-foreground/40 text-muted-foreground/40")} />
        </button>
      </div>

      {/* Track index footer */}
      <div className="text-center text-[10px] text-muted-foreground py-0.5 bg-background border-t border-border font-mono">
        {track.isMaster ? "M" : track.index}
      </div>
    </div>
  );
}

function MiniBtn({
  children, onClick, active, activeClass,
}: {
  children: React.ReactNode;
  onClick: (e: React.MouseEvent) => void;
  active: boolean;
  activeClass: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-1 h-4 text-[10px] font-bold leading-none rounded-sm border border-border bg-surface-3 hover:bg-surface-2 transition-colors",
        active && activeClass,
      )}
    >
      {children}
    </button>
  );
}

function PanKnob({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const angle = value * 135;
  const dragging = useRef(false);
  const startY = useRef(0);
  const startVal = useRef(0);

  useEffect(() => {
    function move(e: PointerEvent) {
      if (!dragging.current) return;
      const dy = startY.current - e.clientY;
      const next = Math.max(-1, Math.min(1, startVal.current + dy / 100));
      onChange(next);
    }
    function up() { dragging.current = false; }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [onChange]);

  return (
    <div
      onPointerDown={(e) => {
        e.stopPropagation();
        dragging.current = true;
        startY.current = e.clientY;
        startVal.current = value;
      }}
      onDoubleClick={(e) => { e.stopPropagation(); onChange(0); }}
      className="relative h-5 w-5 rounded-full cursor-ns-resize"
      style={{
        background: "radial-gradient(circle at 35% 30%, hsl(0 0% 38%), hsl(0 0% 18%) 70%)",
        border: "1px solid hsl(0 0% 8%)",
        boxShadow: "0 1px 2px hsl(0 0% 0% / 0.6), inset 0 1px 0 hsl(0 0% 100% / 0.1)",
      }}
      title={`Pan: ${value === 0 ? "C" : `${value < 0 ? "L" : "R"}${Math.round(Math.abs(value) * 100)}`}`}
    >
      <div
        className="absolute left-1/2 top-0.5 h-1.5 w-px bg-foreground"
        style={{ transformOrigin: "50% 7px", transform: `translateX(-50%) rotate(${angle}deg)` }}
      />
    </div>
  );
}

function FaderTrack({
  value, onChange, onCommit,
}: { value: number; onChange: (v: number) => void; onCommit: (v: number) => void }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const setFromY = (clientY: number) => {
    const el = trackRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const rel = 1 - Math.max(0, Math.min(1, (clientY - r.top) / r.height));
    onChange(rel);
  };

  useEffect(() => {
    function move(e: PointerEvent) { if (dragging.current) setFromY(e.clientY); }
    function up() {
      if (dragging.current) onCommit(value);
      dragging.current = false;
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [value, onCommit]);

  const ticks = [
    { db: "0", pos: 0.5 },
    { db: "6", pos: 0.36 },
    { db: "12", pos: 0.27 },
    { db: "18", pos: 0.21 },
    { db: "24", pos: 0.15 },
  ];

  return (
    <div
      ref={trackRef}
      onPointerDown={(e) => {
        e.stopPropagation();
        dragging.current = true;
        setFromY(e.clientY);
      }}
      onDoubleClick={(e) => { e.stopPropagation(); onChange(ampToSlider(1)); onCommit(ampToSlider(1)); }}
      className="relative w-4 h-full cursor-ns-resize"
    >
      <div className="absolute left-1/2 top-0 bottom-0 -translate-x-1/2 w-1 bg-black border border-border rounded-sm" />
      {ticks.map((t) => (
        <div key={t.db} className="absolute right-0 flex items-center gap-0.5" style={{ bottom: `calc(${t.pos * 100}% - 1px)` }}>
          <div className="h-px w-1 bg-muted-foreground/60" />
        </div>
      ))}
      <div
        className="fader-cap absolute left-1/2 -translate-x-1/2 w-4 h-2.5 rounded-sm"
        style={{ bottom: `calc(${value * 100}% - 5px)` }}
      />
    </div>
  );
}

// Real VU meter — uses the actual peak amplitude from REAPER (track.peakL/R)
// Falls back to a slow decay so jumps look natural between polls.
function VuMeter({ active, peak }: { active: boolean; peak: number }) {
  const [v, setV] = useState(0);
  const target = useRef(0);

  useEffect(() => {
    if (!active) { target.current = 0; return; }
    // amplitude 0..1+ → clamp
    target.current = Math.min(1, Math.max(0, peak));
  }, [peak, active]);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      setV((cur) => {
        const t = active ? target.current : 0;
        // attack fast, release slow
        const next = t > cur ? cur + (t - cur) * 0.6 : cur + (t - cur) * 0.08;
        return next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]);

  // Color zones: green 0-70%, yellow 70-90%, red 90-100%
  const greenH = Math.min(v, 0.7) * 100;
  const yellowH = Math.max(0, Math.min(v, 0.9) - 0.7) * 100;
  const redH = Math.max(0, v - 0.9) * 100;

  return (
    <div className="relative w-1.5 h-full well rounded-sm overflow-hidden flex flex-col-reverse">
      <div className="bg-vu-green" style={{ height: `${greenH}%` }} />
      <div className="bg-vu-yellow" style={{ height: `${yellowH}%` }} />
      <div className="bg-vu-red" style={{ height: `${redH}%` }} />
    </div>
  );
}
