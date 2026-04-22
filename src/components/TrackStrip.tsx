import { Track } from "@/lib/reaperApi";
import { useReaper } from "@/hooks/useReaper";
import { ampToSlider, formatDb, sliderToAmp } from "@/lib/reaperApi";
import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Circle, Volume2 } from "lucide-react";

interface Props {
  track: Track;
}

export function TrackStrip({ track }: Props) {
  const { api, config, selectedTrack, setSelectedTrack, transport } = useReaper();
  const [localVol, setLocalVol] = useState(() => ampToSlider(track.volume));
  const [localPan, setLocalPan] = useState(track.pan);
  const isPlaying = transport?.playstate === 1;
  const selected = selectedTrack === track.index;

  useEffect(() => { setLocalVol(ampToSlider(track.volume)); }, [track.volume]);
  useEffect(() => { setLocalPan(track.pan); }, [track.pan]);

  const commitVol = (v: number) => api.setVolume(config, track.index, v).catch(() => undefined);
  const commitPan = (v: number) => api.setPan(config, track.index, v).catch(() => undefined);

  const label = track.isMaster ? "MASTER" : (track.name || `Entrada ${track.index}`);

  return (
    <div
      onClick={() => setSelectedTrack(track.index)}
      className={cn(
        "flex flex-col items-stretch w-[78px] shrink-0 select-none",
        "bg-surface border-l border-r border-border cursor-pointer",
        selected && "bg-surface-2",
      )}
    >
      {/* Header: track name dropdown */}
      <div className="flex items-center gap-1 px-1 py-0.5 bg-surface-3 border-b border-border h-5">
        <span className="text-[10px] truncate flex-1 text-foreground/90">{label}</span>
        <ChevronDown className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
      </div>

      {/* Input row: in / IN / FX */}
      <div className="flex items-center gap-0.5 px-1 py-0.5 border-b border-border h-5">
        <span className="text-[9px] text-muted-foreground flex-1">in</span>
        <ChevronDown className="h-2 w-2 text-muted-foreground" />
        <div className="px-1 text-[8px] bg-surface-3 border border-border rounded-sm leading-tight">IN</div>
        <div className="px-1 text-[8px] bg-surface-3 border border-border rounded-sm leading-tight ml-0.5">FX</div>
      </div>

      {/* Pan knob centered */}
      <div className="flex justify-center py-1.5 border-b border-border">
        <PanKnob value={localPan} onChange={(v) => { setLocalPan(v); commitPan(v); }} />
      </div>

      {/* dB readout */}
      <div className="text-center text-[9px] text-muted-foreground font-mono py-0.5 border-b border-border">
        {formatDb(sliderToAmp(localVol))}
      </div>

      {/* Mute / Solo */}
      <div className="flex gap-0.5 px-1 py-1 border-b border-border">
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

      {/* Fader area: dual VU + fader on right */}
      <div className="flex gap-1 px-1 py-2 h-[200px] justify-center">
        {/* Two VU columns (L/R) like REAPER */}
        <div className="flex gap-px w-3">
          <VuMeter active={isPlaying && !track.mute} level={localVol} />
          <VuMeter active={isPlaying && !track.mute} level={localVol} offset={0.05} />
        </div>
        {/* Fader track + cap */}
        <FaderTrack
          value={localVol}
          onChange={(v) => setLocalVol(v)}
          onCommit={(v) => commitVol(v)}
        />
      </div>

      {/* FX / Route placeholder buttons (inactive but for look) */}
      <div className="flex gap-0.5 px-1 py-0.5 border-t border-border">
        <div className="flex-1 text-center text-[9px] bg-surface-2 border border-border rounded-sm py-0.5">FX</div>
      </div>

      {/* Record arm circle */}
      <div className="flex justify-center py-1.5 border-t border-border">
        <button
          onClick={(e) => { e.stopPropagation(); api.setRecArm(config, track.index, !track.recarm); }}
          title="Record arm"
          className={cn(
            "h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors",
            track.recarm
              ? "border-record bg-record/30 animate-record"
              : "border-border-light bg-surface-3 hover:bg-surface-2",
          )}
        >
          <Circle className={cn("h-2 w-2", track.recarm ? "fill-record text-record" : "fill-muted-foreground/40 text-muted-foreground/40")} />
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
      className="relative h-6 w-6 rounded-full cursor-ns-resize"
      style={{
        background: "radial-gradient(circle at 35% 30%, hsl(0 0% 38%), hsl(0 0% 18%) 70%)",
        border: "1px solid hsl(0 0% 8%)",
        boxShadow: "0 1px 2px hsl(0 0% 0% / 0.6), inset 0 1px 0 hsl(0 0% 100% / 0.1)",
      }}
      title={`Pan: ${value === 0 ? "C" : `${value < 0 ? "L" : "R"}${Math.round(Math.abs(value) * 100)}`}`}
    >
      <div
        className="absolute left-1/2 top-1 h-2 w-px bg-foreground"
        style={{ transformOrigin: "50% 8px", transform: `translateX(-50%) rotate(${angle}deg)` }}
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

  // Tick marks at 0, -6, -12, -18, -24, -36 dB approx → slider positions
  const ticks = [
    { db: "0", pos: 0.5 },
    { db: "6", pos: 0.36 },
    { db: "12", pos: 0.27 },
    { db: "18", pos: 0.21 },
    { db: "24", pos: 0.15 },
    { db: "36", pos: 0.08 },
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
      className="relative w-5 h-full cursor-ns-resize"
    >
      {/* Slot */}
      <div className="absolute left-1/2 top-0 bottom-0 -translate-x-1/2 w-1 bg-black border border-border rounded-sm" />

      {/* Ticks */}
      {ticks.map((t) => (
        <div key={t.db} className="absolute right-0 flex items-center gap-0.5" style={{ bottom: `calc(${t.pos * 100}% - 1px)` }}>
          <div className="h-px w-1 bg-muted-foreground/60" />
        </div>
      ))}

      {/* Cap */}
      <div
        className="fader-cap absolute left-1/2 -translate-x-1/2 w-5 h-3 rounded-sm"
        style={{ bottom: `calc(${value * 100}% - 6px)` }}
      />
    </div>
  );
}

function VuMeter({ active, level, offset = 0 }: { active: boolean; level: number; offset?: number }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!active) { setV(0); return; }
    const id = setInterval(() => {
      const base = level * 0.85;
      setV(Math.min(1, Math.max(0, base + (Math.random() - 0.4) * 0.25 + offset)));
    }, 60);
    return () => clearInterval(id);
  }, [active, level, offset]);
  return (
    <div className="relative w-1.5 h-full well rounded-sm overflow-hidden">
      <div
        className="absolute bottom-0 left-0 right-0 vu-bar transition-[height] duration-75"
        style={{ height: `${v * 100}%` }}
      />
    </div>
  );
}
