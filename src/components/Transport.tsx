import { useReaper } from "@/hooks/useReaper";
import { Button } from "@/components/ui/button";
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

  return (
    <div className="panel flex flex-wrap items-center gap-4 px-4 py-3">
      {/* Time displays */}
      <div className="flex flex-col">
        <div className="font-mono-display text-3xl text-primary leading-none tabular-nums">
          {formatTime(pos)}
        </div>
        <div className="flex gap-3 text-xs text-muted-foreground mt-1">
          <span className="font-mono">{transport?.positionBeats ?? "1.1.00"}</span>
          <span className="font-mono">{transport?.positionString ?? "0:00.000"}</span>
        </div>
      </div>

      <div className="h-10 w-px bg-border" />

      {/* Transport buttons */}
      <div className="flex items-center gap-1">
        <TButton onClick={() => send(REAPER_ACTIONS.GO_TO_START, "Início")} title="Início">
          <SkipBack className="h-4 w-4" />
        </TButton>
        <TButton onClick={() => seek(-5)} title="-5s"><Rewind className="h-4 w-4" /></TButton>
        <TButton
          onClick={() => send(isPlaying ? REAPER_ACTIONS.PAUSE : REAPER_ACTIONS.PLAY, isPlaying ? "Pause" : "Play")}
          variant={isPlaying ? "active" : "default"}
          title="Play/Pause"
        >
          {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
        </TButton>
        <TButton onClick={() => send(REAPER_ACTIONS.STOP, "Stop")} title="Stop">
          <Square className="h-4 w-4" />
        </TButton>
        <TButton
          onClick={() => send(REAPER_ACTIONS.RECORD, "Record")}
          variant={isRecording ? "record" : "default"}
          title="Record"
        >
          <Circle className={cn("h-5 w-5 fill-current", isRecording && "text-record")} />
        </TButton>
        <TButton onClick={() => seek(5)} title="+5s"><FastForward className="h-4 w-4" /></TButton>
        <TButton onClick={() => send(REAPER_ACTIONS.GO_TO_START, "Fim")} title="Fim">
          <SkipForward className="h-4 w-4" />
        </TButton>
      </div>

      <div className="h-10 w-px bg-border" />

      {/* Loop / Metronome */}
      <div className="flex items-center gap-1">
        <TButton onClick={toggleLoop} variant={loop ? "active" : "default"} title="Loop">
          <Repeat className="h-4 w-4" />
        </TButton>
        <TButton onClick={toggleMetronome} variant={metronome ? "active" : "default"} title="Metrônomo">
          <Music2 className="h-4 w-4" />
        </TButton>
      </div>

      <div className="h-10 w-px bg-border" />

      {/* BPM */}
      <div className="flex items-center gap-3 min-w-[220px] flex-1 max-w-md">
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">BPM</span>
          <span className="font-mono-display text-2xl text-primary leading-none tabular-nums">
            {localBpm.toFixed(1)}
          </span>
        </div>
        <Slider
          min={40}
          max={240}
          step={0.5}
          value={[localBpm]}
          onValueChange={(v) => setLocalBpm(v[0])}
          onValueCommit={(v) => setBpm(v[0])}
          className="flex-1"
        />
      </div>

      <div className="ml-auto flex items-center gap-2 text-xs">
        <span className={cn(
          "led",
          status === "connected" && "bg-success text-success",
          status === "connecting" && "bg-warning text-warning animate-pulse-led",
          status === "disconnected" && "bg-destructive text-destructive",
        )} />
        <span className="uppercase tracking-wider text-muted-foreground">
          {status === "connected" ? "Online" : status === "connecting" ? "Conectando" : "Offline"}
        </span>
      </div>
    </div>
  );
}

function TButton({
  children, onClick, variant = "default", title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  variant?: "default" | "active" | "record";
  title?: string;
}) {
  return (
    <Button
      onClick={onClick}
      title={title}
      size="icon"
      variant="ghost"
      className={cn(
        "h-10 w-10 rounded-md transition-all border border-transparent",
        "bg-surface-2 hover:bg-surface-3 active:scale-95",
        variant === "active" && "border-primary text-primary shadow-amber bg-primary/10",
        variant === "record" && "border-record text-record bg-record/10 animate-record",
      )}
    >
      {children}
    </Button>
  );
}
