import { useReaper } from "@/hooks/useReaper";
import { useEventLog } from "@/lib/eventLog";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { reaperApi } from "@/lib/reaperApi";


export function StatusBar() {
  const { transport, status, loop, lastError, config } = useReaper();
  const log = useEventLog();
  const [flash, setFlash] = useState<string | null>(null);
  const [sys, setSys] = useState<any>(null);

  // Busca sysinfo a cada 2s
  useEffect(() => {
    let mounted = true;
    async function fetchSys() {
      try {
        const data = await reaperApi.getServerSysInfo(config);
        if (mounted) setSys(data);
      } catch { /* ignore */ }
    }
    fetchSys();
    const id = setInterval(fetchSys, 2000);
    return () => { mounted = false; clearInterval(id); };
  }, [config]);

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
      <span className="text-muted-foreground">
        CPU: {sys ? (sys.cpu.load1 * 100).toFixed(1) : "-"}% · RAM: {sys ? (sys.ram.used / 1024 / 1024).toFixed(0) : "-"}MB
        {sys && sys.net ? ` · RX: ${(sys.net.rx/1024/1024).toFixed(1)}MB TX: ${(sys.net.tx/1024/1024).toFixed(1)}MB` : ""}
      </span>
      <span className="text-muted-foreground">·</span>
      <span className={cn("font-bold uppercase", stateColor)}>● {playState}</span>
      <span className="text-muted-foreground">POS {(transport?.position ?? 0).toFixed(2)}s</span>
      <span className={cn("text-muted-foreground", loop && "text-primary")}>LOOP {loop ? "ON" : "OFF"}</span>
      <div className="flex-1" />
      {flash && <span className="text-primary truncate max-w-md">{flash}</span>}
      {lastError && !flash && <span className="text-destructive truncate max-w-md">{lastError}</span>}
      <span className="text-muted-foreground">·</span>
      <span className="text-muted-foreground">
        Dev. <span className="text-primary font-bold">Zertec</span>
        <span className="text-muted-foreground/70"> — Zertec Redes e Sistemas</span>
      </span>
    </div>
  );
}
