import { useReaper } from "@/hooks/useReaper";
import { TrackStrip } from "./TrackStrip";
import { Music, Folder } from "lucide-react";
import { Track } from "@/lib/reaperApi";
import { useMemo } from "react";

// Group consecutive tracks into folder buckets when a folder track is detected.
// Heuristic: track flagged as folder starts a group; following tracks go in
// that group until another folder appears or master is hit.
function groupTracks(channels: Track[]): { name: string; tracks: Track[]; isFolder: boolean }[] {
  const groups: { name: string; tracks: Track[]; isFolder: boolean }[] = [];
  let current: { name: string; tracks: Track[]; isFolder: boolean } | null = null;

  for (const t of channels) {
    if (t.isFolder) {
      if (current) groups.push(current);
      current = { name: t.name, tracks: [t], isFolder: true };
    } else if (current) {
      current.tracks.push(t);
    } else {
      // ungrouped run — accumulate into a default bucket
      if (groups.length === 0 || groups[groups.length - 1].isFolder) {
        groups.push({ name: "", tracks: [t], isFolder: false });
      } else {
        groups[groups.length - 1].tracks.push(t);
      }
    }
  }
  if (current) groups.push(current);
  return groups;
}

export function Mixer() {
  const { tracks } = useReaper();
  const master = tracks.find((t) => t.isMaster);
  const channels = tracks.filter((t) => !t.isMaster);

  const groups = useMemo(() => groupTracks(channels), [channels]);
  const hasFolders = groups.some((g) => g.isFolder);

  if (tracks.length === 0) {
    return (
      <div className="panel p-12 flex flex-col items-center justify-center gap-3 text-muted-foreground">
        <Music className="h-10 w-10 opacity-50" />
        <div className="text-sm">Nenhuma faixa carregada.</div>
        <div className="text-xs">Conecte ao REAPER para visualizar o mixer.</div>
      </div>
    );
  }

  return (
    <div className="panel bg-background p-0 overflow-y-auto">
      <div className="flex flex-wrap items-start gap-y-2 p-1">
        {hasFolders ? (
          groups.map((g, gi) => (
            <div key={gi} className="flex items-stretch border border-primary/30 rounded-sm mr-2 mb-1 bg-surface/40">
              {g.isFolder && (
                <div className="flex flex-col items-center justify-start gap-1 px-1 py-2 bg-surface-3/60 border-r border-border min-w-[18px]">
                  <Folder className="h-3 w-3 text-primary" />
                  <div
                    className="text-[9px] font-semibold text-primary uppercase tracking-wider whitespace-nowrap"
                    style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
                  >
                    {g.name || "Grupo"}
                  </div>
                </div>
              )}
              <div className="flex items-stretch">
                {g.tracks.map((t) => (
                  <TrackStrip key={t.index} track={t} />
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="flex items-stretch flex-wrap">
            {channels.map((t) => (
              <TrackStrip key={t.index} track={t} />
            ))}
          </div>
        )}

        {master && (
          <div className="flex items-stretch ml-auto border-l-2 border-primary/40">
            <TrackStrip track={master} />
          </div>
        )}
      </div>
    </div>
  );
}
