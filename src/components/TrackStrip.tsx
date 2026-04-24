import { Track } from "@/lib/reaperApi";
import { useReaper } from "@/hooks/useReaper";
import { ampToSlider, formatDb, sliderToAmp } from "@/lib/reaperApi";
// import { debounce } from "@/lib/debounce";
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
  // Optimistic UI state for M / S / R — toggles immediately on click,
  // then resyncs from the next poll.
  const [optMute, setOptMute] = useState<boolean | null>(null);
  const [optSolo, setOptSolo] = useState<boolean | null>(null);
  const [optRec, setOptRec] = useState<boolean | null>(null);
  const selected = selectedTrack === track.index;

  const muted = optMute ?? track.mute;
  const soloed = optSolo ?? track.solo;
  const armed = optRec ?? track.recarm;

  useEffect(() => { setLocalVol(ampToSlider(track.volume)); }, [track.volume]);
  useEffect(() => { setLocalPan(track.pan); }, [track.pan]);
  // Reconcile optimistic state once the server confirms it (or stops drifting).
  useEffect(() => { if (optMute !== null && optMute === track.mute) setOptMute(null); }, [track.mute, optMute]);
  useEffect(() => { if (optSolo !== null && optSolo === track.solo) setOptSolo(null); }, [track.solo, optSolo]);
  useEffect(() => { if (optRec !== null && optRec === track.recarm) setOptRec(null); }, [track.recarm, optRec]);

  // Envio imediato, sem debounce
  const commitVol = (v: number) => {
    api.setVolume(config, track.index, v).catch(() => undefined);
  };
  const commitPan = (v: number) => api.setPan(config, track.index, v).catch(() => undefined);

  const label = track.isMaster ? "MASTER" : (track.name || `${track.index}`);
  const width = compact ? "w-[58px]" : "w-[78px]";

  const headerStyle = groupColor
    ? {
        background: `linear-gradient(180deg, hsl(${groupColor} / 0.85), hsl(${groupColor} / 0.55))`,
        borderBottom: `1px solid hsl(${groupColor} / 0.7)`,
      }
    : undefined;
  const sideStyle = groupColor
    ? { borderLeftColor: `hsl(${groupColor} / 0.5)`, borderRightColor: `hsl(${groupColor} / 0.5)` }
    : undefined;

  return (
    <div
      style={sideStyle}
      className={cn(
        "flex flex-col items-stretch shrink-0 select-none transition-all duration-200",
        width,
        "bg-surface border-l border-r border-border",
        selected
          ? "ring-4 ring-primary/90 bg-primary/10 scale-105 z-10"
          : "hover:ring-2 hover:ring-primary/40 hover:bg-neutral-800/80 opacity-80 hover:opacity-100"
      )}
    >
      {/* Header: track name (tinted by group color) */}
      <div
        className={cn(
          "flex items-center gap-0.5 px-1 py-0.5 border-b border-border h-5 bg-surface-3 cursor-pointer relative",
          track.isFolder && groupColor && "shadow-[0_0_0_2px_hsl(var(--primary)/0.25)]"
        )}
        style={headerStyle}
        onClick={() => setSelectedTrack(track.index)}
      >
        {groupColor && (
          track.isFolder ? (
            <span
              className="absolute left-0 top-0 h-full w-3 rounded-l bg-primary/80 border-r-2 border-primary"
              style={{ background: `hsl(${groupColor} / 0.98)`, borderColor: `hsl(${groupColor} / 0.85)` }}
            />
          ) : (
            <span
              className="absolute left-0 top-0 h-full w-1.5 rounded-l"
              style={{ background: `hsl(${groupColor} / 0.95)` }}
            />
          )
        )}
        <span
          className={cn(
            "text-[10px] truncate flex-1 font-medium",
            groupColor ? "text-black/85" : "text-foreground/90",
          )}
        >
          {label}
        </span>
        <ChevronDown className={cn("h-2.5 w-2.5 shrink-0", groupColor ? "text-black/60" : "text-muted-foreground")} />
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
          active={muted}
          activeClass="bg-mute text-black shadow-[inset_0_0_0_1px_hsl(var(--mute))]"
          onClick={(e) => {
            e.stopPropagation();
            const next = !muted;
            setOptMute(next);
            api.setMute(config, track.index, next).catch(() => setOptMute(null));
          }}
        >M</MiniBtn>
        <MiniBtn
          active={soloed}
          activeClass="bg-solo text-white shadow-[inset_0_0_0_1px_hsl(var(--solo))]"
          onClick={(e) => {
            e.stopPropagation();
            const next = !soloed;
            setOptSolo(next);
            api.setSolo(config, track.index, next).catch(() => setOptSolo(null));
          }}
        >S</MiniBtn>
      </div>

      {/* Fader area: real VU + fader */}
      <div className="flex gap-0.5 px-1 py-1.5 h-[160px] justify-center">
        <div className="flex gap-px w-2.5">
          {/*
            active é sempre true para que o decay suave via requestAnimationFrame
            funcione mesmo quando parado. O pico vai naturalmente para 0 via release
            quando não há sinal. Passamos muted para zerar o target quando mutado.
          */}
          <VuMeter peak={track.peakL} muted={muted} />
          <VuMeter peak={track.peakR} muted={muted} />
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
          onClick={(e) => {
            e.stopPropagation();
            const next = !armed;
            setOptRec(next);
            api.setRecArm(config, track.index, next).catch(() => setOptRec(null));
          }}
          title="Record arm"
          className={cn(
            "h-4 w-4 rounded-full border-2 flex items-center justify-center transition-colors",
            armed
              ? "border-record bg-record shadow-[0_0_8px_hsl(var(--record)/0.8)] animate-pulse"
              : "border-border bg-surface-3 hover:bg-surface-2",
          )}
        >
          <Circle className={cn("h-1.5 w-1.5", armed ? "fill-white text-white" : "fill-muted-foreground/40 text-muted-foreground/40")} />
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
    onCommit(rel); // Envia volume em tempo real durante o arraste (sem debounce)
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

  // Escala dB para o fader (igual ao REAPER)
  // Escala de -∞ a +12 dB, distribuída para caber visualmente
  const dbMarks = [
    { db: '+12', val: 1.0 },
    { db: '+6', val: 0.85 },
    { db: '0', val: 0.7 },
    { db: '-6', val: 0.55 },
    { db: '-12', val: 0.4 },
    { db: '-24', val: 0.25 },
    { db: '-∞', val: 0.0 },
  ];

  return (
    <div className="relative flex flex-row w-10 h-full cursor-ns-resize">
      {/* Escala dB */}
      <div className="flex flex-col items-end justify-between h-full pr-0.5 select-none text-[9px] text-muted-foreground font-mono w-5">
        {dbMarks.map((m) => (
          <div key={m.db} style={{ position: 'absolute', bottom: `calc(${m.val * 100}% - 7px)` }}>
            {m.db}
          </div>
        ))}
      </div>
      {/* Fader */}
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
        {dbMarks.map((m) => (
          <div key={m.db} className="absolute left-0 w-full" style={{ bottom: `calc(${m.val * 100}% - 1px)` }}>
            <div className="h-px w-2 bg-muted-foreground/60" />
          </div>
        ))}
        <div
          className={[
            "fader-cap absolute left-1/2 -translate-x-1/2",
            "w-3 h-6",
            "rounded-full border border-white/70",
            "bg-gradient-to-b from-neutral-100 via-neutral-400 to-neutral-800",
            "shadow-[0_2px_6px_0_rgba(0,0,0,0.30),inset_0_2px_6px_0_rgba(255,255,255,0.15)]",
            "flex flex-col justify-center items-stretch gap-0.5 px-0.5",
            dragging.current ? "ring-2 ring-primary/60" : "hover:ring-2 hover:ring-primary/30 transition"
          ].join(" ")}
          style={{ bottom: `calc(${value * 100}% - 12px)` }}
        >
          {/* Brilho no topo */}
          <div className="absolute left-1/2 -translate-x-1/2 top-0.5 w-2 h-0.5 rounded-full bg-white/60 opacity-70 blur-[1px]" />
          {/* Linhas horizontais */}
          <div className="h-0.5 w-full bg-white/40 mb-0.5 rounded" />
          <div className="h-0.5 w-full bg-white/20 mb-0.5 rounded" />
        </div>
      </div>
    </div>
  );
}

// VU meter com decay suave via requestAnimationFrame.
// - active é sempre true para o loop de RAF rodar continuamente.
// - Quando muted=true o target vai para 0 e o decay natural zera a barra suavemente.
// - attack rápido (0.6) para subir junto com o sinal.
// - release lento (0.06) para o decay visual parecer natural como um VU analógico.
function VuMeter({ peak, muted }: { peak: number; muted: boolean }) {
  const [v, setV] = useState(0);
  const target = useRef(0);

  useEffect(() => {
    // Quando mutado zera o target — o decay cuida de baixar suavemente.
    target.current = muted ? 0 : Math.min(1, Math.max(0, peak));
  }, [peak, muted]);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      setV((cur) => {
        const t = target.current;
        // Attack rápido para subir, release lento para cair (comportamento VU analógico).
        const next = t > cur
          ? cur + (t - cur) * 0.6   // attack
          : cur + (t - cur) * 0.06; // release — mais lento = mais fluido
        // Para de atualizar quando já estiver praticamente em zero para não ficar em loop infinito.
        if (Math.abs(next) < 0.0005) return 0;
        return next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Color zones: green 0-70%, yellow 70-90%, red 90-100%
  const greenH  = Math.min(v, 0.7) * 100;
  const yellowH = Math.max(0, Math.min(v, 0.9) - 0.7) * 100;
  const redH    = Math.max(0, v - 0.9) * 100;

  return (
    <div className="relative w-1.5 h-full well rounded-sm overflow-hidden flex flex-col-reverse">
      <div className="bg-vu-green"  style={{ height: `${greenH}%` }} />
      <div className="bg-vu-yellow" style={{ height: `${yellowH}%` }} />
      <div className="bg-vu-red"    style={{ height: `${redH}%` }} />
    </div>
  );
}
