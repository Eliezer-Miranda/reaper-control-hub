import { useReaper } from "@/hooks/useReaper";
import { useEventLog } from "@/lib/eventLog";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export function StatusBar() {
  const { transport, status, loop, lastError } = useReaper();
  const log = useEventLog();
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    const last = log[0];
    if (!last) return;
    setFlash(`${last.level.toUpperCase()} · ${last.msg}`);
    const id = setTimeout(() => setFlash(null), 4000);
    return () => clearTimeout(id);
  }, [log]);

  const playState = (() => {
    if (status !== "connected") return "Offline";
    switch (transport?.playstate) {
      case 1: return "Tocando";
      case 2: case 6: return "Pausado";
      case 5: return "Gravando";
      default: return "Parado";
    }
  })();

  const stateColor = transport?.playstate === 5 ? "text-record" :
    transport?.playstate === 1 ? "text-success" :
    "text-muted-foreground";

  return (
    <div className="border-t border-border bg-surface-2 px-2 py-1 flex items-center gap-3 text-[10px] font-mono">
      <span className="text-muted-foreground">CPU: 1.8% · RAM: 80MB</span>
      <span className="text-muted-foreground">·</span>
      <span className={cn("font-bold uppercase", stateColor)}>● {playState}</span>
      <span className="text-muted-foreground">POS {(transport?.position ?? 0).toFixed(2)}s</span>
      <span className={cn("text-muted-foreground", loop && "text-primary")}>LOOP {loop ? "ON" : "OFF"}</span>
      <div className="flex-1" />
      {flash && <span className="text-primary truncate max-w-md">{flash}</span>}
      {lastError && !flash && <span className="text-destructive truncate max-w-md">{lastError}</span>}
    </div>
  );
}
