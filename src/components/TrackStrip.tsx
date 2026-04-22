import { Track } from "@/lib/reaperApi";
import { useReaper } from "@/hooks/useReaper";
import { ampToSlider, formatDb, sliderToAmp } from "@/lib/reaperApi";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useRef, useState } from "react";

interface Props {
  track: Track;
}

const TRACK_COLORS = [
  "33 80% 52%", "200 80% 55%", "280 60% 60%", "340 75% 60%",
  "150 60% 50%", "20 80% 55%", "190 70% 50%", "260 70% 60%",
];

export function TrackStrip({ track }: Props) {
  const { api, config, selectedTrack, setSelectedTrack, transport } = useReaper();
  const [localVol, setLocalVol] = useState(() => ampToSlider(track.volume));
  const [localPan, setLocalPan] = useState(track.pan);
  const [editing, setEditing] = useState(false);
  const isPlaying = transport?.playstate === 1;
  const selected = selectedTrack === track.index;

  const colorHsl = track.isMaster ? "33 80% 52%" : TRACK_COLORS[(track.index - 1) % TRACK_COLORS.length];

  useEffect(() => { setLocalVol(ampToSlider(track.volume)); }, [track.volume]);
  useEffect(() => { setLocalPan(track.pan); }, [track.pan]);

  const commitVol = (v: number) => api.setVolume(config, track.index, v).catch(() => undefined);
  const commitPan = (v: number) => api.setPan(config, track.index, v).catch(() => undefined);

  return (
    <div
      onClick={() => setSelectedTrack(track.index)}
      className={cn(
        "flex flex-col items-center gap-3 p-3 rounded-md border transition-all w-[110px] shrink-0 cursor-pointer",
        "bg-surface border-border hover:border-surface-3",
        selected && "border-primary shadow-amber",
        track.isMaster && "bg-surface-2 border-primary/40",
      )}
    >
      {/* Color strip + name */}
      <div
        className="w-full h-1 rounded-full"
        style={{ background: `hsl(${colorHsl})` }}
      />
      {editing ? (
        <input
          autoFocus
          defaultValue={track.name}
          onBlur={() => setEditing(false)}
          onKeyDown={(e) => { if (e.key === "Enter") setEditing(false); }}
          className="w-full bg-input text-center text-xs px-1 py-0.5 rounded border border-border outline-none focus:border-primary"
        />
      ) : (
        <button
          onDoubleClick={() => setEditing(true)}
          className="w-full text-center text-xs font-medium truncate uppercase tracking-wider"
          title={track.name}
        >
          {track.name}
        </button>
      )}

      {/* Pan */}
      <PanKnob value={localPan} onChange={(v) => { setLocalPan(v); commitPan(v); }} />

      {/* Buttons */}
      {!track.isMaster && (
        <div className="flex gap-1 w-full">
          <MiniBtn active={track.mute} activeClass="bg-mute text-black border-mute"
            onClick={(e) => { e.stopPropagation(); api.setMute(config, track.index, !track.mute); }}>
            M
          </MiniBtn>
          <MiniBtn active={track.solo} activeClass="bg-solo text-white border-solo"
            onClick={(e) => { e.stopPropagation(); api.setSolo(config, track.index, !track.solo); }}>
            S
          </MiniBtn>
          <MiniBtn active={track.recarm} activeClass="bg-record text-white border-record"
            onClick={(e) => { e.stopPropagation(); api.setRecArm(config, track.index, !track.recarm); }}>
            R
          </MiniBtn>
        </div>
      )}

      {/* VU + Fader */}
      <div className="flex gap-2 items-stretch h-44">
        <VuMeter active={isPlaying && !track.mute} />
        <div className="flex flex-col items-center justify-between">
          <Slider
            orientation="vertical"
            min={0}
            max={1}
            step={0.001}
            value={[localVol]}
            onValueChange={(v) => setLocalVol(v[0])}
            onValueCommit={(v) => commitVol(v[0])}
            className="h-full"
          />
        </div>
      </div>

      <div className="font-mono text-[10px] text-muted-foreground tabular-nums">
        {formatDb(sliderToAmp(localVol))}
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
        "flex-1 h-7 text-xs font-bold rounded border border-border bg-surface-2 hover:bg-surface-3 transition-colors",
        active && activeClass,
      )}
    >
      {children}
    </button>
  );
}

function PanKnob({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  // value -1..1 => angle -135..135
  const angle = value * 135;
  const ref = useRef<HTMLDivElement>(null);
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
    <div className="flex flex-col items-center gap-0.5">
      <div
        ref={ref}
        onPointerDown={(e) => {
          e.stopPropagation();
          dragging.current = true;
          startY.current = e.clientY;
          startVal.current = value;
        }}
        onDoubleClick={(e) => { e.stopPropagation(); onChange(0); }}
        className="relative h-9 w-9 rounded-full bg-gradient-to-br from-surface-3 to-background border border-border cursor-ns-resize select-none"
        title="Pan (arraste vertical, dbl-click centro)"
      >
        <div
          className="absolute left-1/2 top-1/2 h-3 w-0.5 -translate-x-1/2 origin-bottom bg-primary rounded-full"
          style={{ transform: `translate(-50%, -100%) rotate(${angle}deg)`, transformOrigin: "50% 100%" }}
        />
      </div>
      <span className="text-[9px] text-muted-foreground font-mono">
        {value === 0 ? "C" : `${value < 0 ? "L" : "R"}${Math.round(Math.abs(value) * 100)}`}
      </span>
    </div>
  );
}

function VuMeter({ active }: { active: boolean }) {
  const [level, setLevel] = useState(0);
  useEffect(() => {
    if (!active) { setLevel(0); return; }
    const id = setInterval(() => {
      setLevel(0.4 + Math.random() * 0.55);
    }, 80);
    return () => clearInterval(id);
  }, [active]);
  return (
    <div className="w-2 h-full bg-background rounded-sm overflow-hidden border border-border relative">
      <div
        className="absolute bottom-0 left-0 right-0 vu-bar transition-all duration-75"
        style={{ height: `${level * 100}%` }}
      />
    </div>
  );
}
