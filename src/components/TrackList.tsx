import { useReaper } from "@/hooks/useReaper";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, ListMusic } from "lucide-react";
import { cn } from "@/lib/utils";
import { logEvent } from "@/lib/eventLog";
import { REAPER_ACTIONS } from "@/lib/reaperApi";

const TRACK_COLORS = [
  "33 80% 52%", "200 80% 55%", "280 60% 60%", "340 75% 60%",
  "150 60% 50%", "20 80% 55%", "190 70% 50%", "260 70% 60%",
];

export function TrackList() {
  const { tracks, selectedTrack, setSelectedTrack, api, config, status } = useReaper();
  const channels = tracks.filter((t) => !t.isMaster);

  const newTrack = async () => {
    if (status !== "connected") return;
    try { await api.runAction(config, REAPER_ACTIONS.NEW_TRACK); logEvent("ok", "Nova faixa"); }
    catch (e) { logEvent("error", `Nova faixa: ${e instanceof Error ? e.message : "erro"}`); }
  };
  const delTrack = async () => {
    if (status !== "connected") return;
    try { await api.runAction(config, REAPER_ACTIONS.DELETE_SELECTED_TRACK); logEvent("ok", "Faixa removida"); }
    catch (e) { logEvent("error", `Remover: ${e instanceof Error ? e.message : "erro"}`); }
  };

  return (
    <div className="panel flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border text-primary">
        <ListMusic className="h-4 w-4" />
        <h3 className="text-sm font-semibold uppercase tracking-wider">Faixas</h3>
        <span className="ml-auto text-[10px] text-muted-foreground font-mono">{channels.length}</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {channels.length === 0 && (
          <div className="px-3 py-6 text-xs text-muted-foreground text-center">
            Sem faixas no projeto.
          </div>
        )}
        {channels.map((t) => {
          const c = TRACK_COLORS[(t.index - 1) % TRACK_COLORS.length];
          const sel = selectedTrack === t.index;
          return (
            <button
              key={t.index}
              onClick={() => setSelectedTrack(t.index)}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 text-left text-xs border-b border-border/50 transition-colors",
                sel ? "bg-primary/15 text-primary" : "hover:bg-surface-2",
              )}
            >
              <div className="w-1 h-5 rounded-full shrink-0" style={{ background: `hsl(${c})` }} />
              <span className="font-mono text-[10px] text-muted-foreground w-5">{t.index}</span>
              <span className="truncate flex-1">{t.name}</span>
              {t.recarm && <span className="led bg-record text-record" />}
              {t.solo && <span className="led bg-solo text-solo" />}
              {t.mute && <span className="led bg-mute text-mute" />}
            </button>
          );
        })}
      </div>

      <div className="border-t border-border p-2 flex gap-2">
        <Button size="sm" onClick={newTrack} className="flex-1 gap-1 bg-primary/90 text-primary-foreground hover:bg-primary">
          <Plus className="h-3.5 w-3.5" /> Nova
        </Button>
        <Button size="sm" variant="ghost" onClick={delTrack} className="gap-1 border border-border hover:border-destructive hover:text-destructive">
          <Trash2 className="h-3.5 w-3.5" /> Excluir
        </Button>
      </div>
    </div>
  );
}
