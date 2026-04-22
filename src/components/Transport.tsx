import { useReaper } from "@/hooks/useReaper";
import { Slider } from "@/components/ui/slider";
import { logEvent } from "@/lib/eventLog";
import { formatTime, REAPER_ACTIONS } from "@/lib/reaperApi";
import {
  Play, Pause, Square, Circle, SkipBack, SkipForward,
  Rewind, FastForward, Repeat, Music2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

export function Transport() {
  const { transport, status, api, config, bpm, setBpm, loop, metronome, toggleLoop, toggleMetronome } = useReaper();
  const [localBpm, setLocalBpm] = useState(bpm);

  useEffect(() => { setLocalBpm(bpm); }, [bpm]);

  const isPlaying = transport?.playstate === 1;
  const isRecording = transport?.playstate === 5;
  const isPaused = transport?.playstate === 2 || transport?.playstate === 6;
  const pos = transport?.position ?? 0;

  const send = async (id: number, label: string) => {
    if (status !== "connected") {
      logEvent("warn", "Não conectado ao REAPER");
      return;
    }
    try {
      await api.runAction(config, id);
      logEvent("ok", label);
    } catch (e) {
      logEvent("error", `${label}: ${e instanceof Error ? e.message : "falhou"}`);
    }
  };

  const seek = async (delta: number) => {
    if (status !== "connected") return;
    try {
      await api.setPos(config, Math.max(0, pos + delta));
    } catch { /* noop */ }
  };

  const stateLabel = isRecording ? "[Gravando]" : isPlaying ? "[Tocando]" : isPaused ? "[Pausado]" : "[Parado]";

  return (
    <div className="bg-surface-2 border-y border-border flex items-center gap-2 px-2 py-1.5 text-foreground/90">
      {/* Transport buttons — left cluster */}
      <div className="flex items-center gap-px">
        <TBtn onClick={() => send(REAPER_ACTIONS.GO_TO_START, "Início")} title="Início">
          <SkipBack className="h-3.5 w-3.5" />
        </TBtn>
        <TBtn onClick={() => seek(-5)} title="-5s"><Rewind className="h-3.5 w-3.5" /></TBtn>
        <TBtn
          onClick={() => send(REAPER_ACTIONS.RECORD, "Record")}
          title="Record"
          color={isRecording ? "record" : "recordIdle"}
        >
          <Circle className="h-3.5 w-3.5 fill-current" />
        </TBtn>
        <TBtn
          onClick={() => send(REAPER_ACTIONS.PLAY, "Play")}
          title="Play"
          color={isPlaying ? "play" : "playIdle"}
        >
          <Play className="h-4 w-4 fill-current" />
        </TBtn>
        <TBtn onClick={toggleLoop} title="Loop" color={loop ? "play" : "default"}>
          <Repeat className="h-3.5 w-3.5" />
        </TBtn>
        <TBtn onClick={() => send(REAPER_ACTIONS.STOP, "Stop")} title="Stop">
          <Square className="h-3.5 w-3.5 fill-current" />
        </TBtn>
        <TBtn
          onClick={() => send(REAPER_ACTIONS.PAUSE, "Pause")}
          title="Pause"
          color={isPaused ? "play" : "default"}
        >
          <Pause className="h-3.5 w-3.5 fill-current" />
        </TBtn>
      </div>

      {/* Time display */}
      <div className="flex items-center gap-2 ml-3">
        <div className="font-mono-display text-base text-foreground tabular-nums">
          {transport?.positionBeats ?? "1.1.00"}
        </div>
        <span className="text-muted-foreground">/</span>
        <div className="font-mono-display text-base text-foreground tabular-nums">
          {transport?.positionString ?? "0:00.000"}
        </div>
      </div>

      <div className="text-muted-foreground text-xs ml-3">{stateLabel}</div>

      {/* Right cluster: selection / bpm / metronome */}
      <div className="ml-auto flex items-center gap-3">
        <Field label="Seleção">
          <span className="font-mono text-xs">{transport?.positionBeats ?? "1.1.00"}</span>
          <span className="font-mono text-xs">{transport?.positionBeats ?? "1.1.00"}</span>
          <span className="font-mono text-xs">0.0.00</span>
        </Field>

        <Field label="">
          <div className="px-2 py-0.5 bevel rounded-sm font-mono text-xs">4/4</div>
        </Field>

        <div className="flex items-center gap-2 min-w-[180px]">
          <span className="text-muted-foreground text-[10px]">BPM</span>
          <Slider
            min={40}
            max={240}
            step={0.5}
            value={[localBpm]}
            onValueChange={(v) => setLocalBpm(v[0])}
            onValueCommit={(v) => setBpm(v[0])}
            className="flex-1"
          />
          <span className="font-mono-display text-sm tabular-nums w-10 text-right">{localBpm.toFixed(0)}</span>
        </div>

        <button
          onClick={toggleMetronome}
          className={cn(
            "h-7 w-7 grid place-items-center rounded-sm border border-border bevel",
            metronome && "text-primary",
          )}
          title="Metrônomo"
        >
          <Music2 className="h-3.5 w-3.5" />
        </button>

        <Field label="Taxa">
          <span className="font-mono text-xs">1.0</span>
        </Field>

        {/* Connection LED */}
        <div className="flex items-center gap-1.5 pl-2 border-l border-border ml-1">
          <span className={cn(
            "led",
            status === "connected" && "bg-success text-success",
            status === "connecting" && "bg-warning text-warning animate-pulse-led",
            status === "disconnected" && "bg-destructive text-destructive",
          )} />
          <span className="text-[10px] uppercase text-muted-foreground tracking-wider">
            {status === "connected" ? "On" : status === "connecting" ? "..." : "Off"}
          </span>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-0.5">
      {label && <span className="text-[9px] uppercase text-muted-foreground tracking-wider">{label}</span>}
      <div className="flex items-center gap-1">{children}</div>
    </div>
  );
}

type BtnColor = "default" | "play" | "playIdle" | "record" | "recordIdle";

function TBtn({
  children, onClick, title, color = "default",
}: {
  children: React.ReactNode;
  onClick: () => void;
  title?: string;
  color?: BtnColor;
}) {
  const colorClass: Record<BtnColor, string> = {
    default: "text-foreground/80",
    play: "text-success",
    playIdle: "text-success/70 hover:text-success",
    record: "text-record animate-record",
    recordIdle: "text-record/80 hover:text-record",
  };
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        "h-7 w-7 grid place-items-center rounded-sm bevel transition-colors",
        colorClass[color],
      )}
    >
      {children}
    </button>
  );
}
