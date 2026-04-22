import { useEventLog } from "@/lib/eventLog";
import { useState } from "react";
import { ChevronDown, Terminal } from "lucide-react";
import { cn } from "@/lib/utils";

export function LogConsole() {
  const log = useEventLog();
  const [open, setOpen] = useState(false);

  const colorFor = (lvl: string) =>
    lvl === "error" ? "text-destructive" :
    lvl === "warn" ? "text-warning" :
    lvl === "ok" ? "text-success" : "text-muted-foreground";

  return (
    <div className="panel">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
      >
        <Terminal className="h-3.5 w-3.5" />
        <span>Log do sistema</span>
        <span className="ml-2 text-[10px] bg-surface-3 px-1.5 py-0.5 rounded">{log.length}</span>
        <ChevronDown className={cn("h-3.5 w-3.5 ml-auto transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="border-t border-border max-h-48 overflow-y-auto font-mono text-[11px]">
          {log.length === 0 && (
            <div className="px-3 py-2 text-muted-foreground">Sem eventos.</div>
          )}
          {log.map((e) => (
            <div key={e.id} className="px-3 py-1 border-b border-border/50 flex gap-2">
              <span className="text-muted-foreground">{new Date(e.ts).toLocaleTimeString()}</span>
              <span className={cn("uppercase font-bold w-12", colorFor(e.level))}>{e.level}</span>
              <span className="text-foreground/90">{e.msg}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
