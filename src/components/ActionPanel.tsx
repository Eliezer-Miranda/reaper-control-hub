import { useReaper } from "@/hooks/useReaper";
import { QUICK_ACTIONS_DEFAULT } from "@/lib/reaperApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEffect, useState } from "react";
import { Plus, Trash2, Zap } from "lucide-react";
import { logEvent } from "@/lib/eventLog";

interface CustomAction { id: number; label: string }
const STORAGE = "reaper.customActions.v1";

export function ActionPanel() {
  const { api, config, status } = useReaper();
  const [custom, setCustom] = useState<CustomAction[]>([]);
  const [newLabel, setNewLabel] = useState("");
  const [newId, setNewId] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE);
      if (raw) setCustom(JSON.parse(raw));
    } catch { /* noop */ }
  }, []);

  useEffect(() => {
    try { localStorage.setItem(STORAGE, JSON.stringify(custom)); } catch { /* noop */ }
  }, [custom]);

  const run = async (id: number, label: string) => {
    if (status !== "connected") { logEvent("warn", "Não conectado"); return; }
    try { await api.runAction(config, id); logEvent("ok", `Ação: ${label} (${id})`); }
    catch (e) { logEvent("error", `Ação ${label}: ${e instanceof Error ? e.message : "erro"}`); }
  };

  const add = () => {
    const id = parseInt(newId, 10);
    if (!Number.isFinite(id) || !newLabel.trim()) return;
    setCustom((c) => [...c, { id, label: newLabel.trim() }]);
    setNewLabel(""); setNewId("");
  };

  return (
    <div className="panel p-4 space-y-4">
      <div className="flex items-center gap-2 text-primary">
        <Zap className="h-4 w-4" />
        <h3 className="text-sm font-semibold uppercase tracking-wider">Ações rápidas</h3>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {QUICK_ACTIONS_DEFAULT.map((a) => (
          <Button
            key={a.id}
            variant="ghost"
            className="justify-start h-auto py-2 px-3 bg-surface-2 hover:bg-surface-3 border border-border"
            onClick={() => run(a.id, a.label)}
          >
            <span className="text-xs font-medium">{a.label}</span>
            <span className="ml-auto font-mono text-[10px] text-muted-foreground">{a.id}</span>
          </Button>
        ))}
      </div>

      {custom.length > 0 && (
        <>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground pt-2">Customizadas</div>
          <div className="grid grid-cols-2 gap-2">
            {custom.map((a, idx) => (
              <div key={`${a.id}-${idx}`} className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  className="flex-1 justify-start h-auto py-2 px-3 bg-surface-2 hover:bg-surface-3 border border-border"
                  onClick={() => run(a.id, a.label)}
                >
                  <span className="text-xs font-medium truncate">{a.label}</span>
                  <span className="ml-auto font-mono text-[10px] text-muted-foreground">{a.id}</span>
                </Button>
                <Button
                  size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => setCustom((c) => c.filter((_, i) => i !== idx))}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="border-t border-border pt-3 space-y-2">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Adicionar ação</div>
        <div className="flex gap-2">
          <Input placeholder="Nome" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} className="h-8 text-xs" />
          <Input placeholder="ID" value={newId} onChange={(e) => setNewId(e.target.value)} className="h-8 text-xs w-20" />
          <Button size="icon" onClick={add} className="h-8 w-8 bg-primary text-primary-foreground hover:bg-primary/90">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
