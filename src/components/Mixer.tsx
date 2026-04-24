import { useReaper } from "@/hooks/useReaper";
import { TrackStrip } from "./TrackStrip";
import { Music, Folder } from "lucide-react";
import { Track } from "@/lib/reaperApi";
import { useMemo } from "react";

interface Group {
  name: string;
  tracks: Track[];
  isFolder: boolean;
  color: string; // hsl triplet "H S% L%"
}

// Palette for groups — vivid but theme-friendly hues
const GROUP_PALETTE = [
  "200 75% 55%", // blue
  "30 85% 55%",  // orange
  "140 60% 50%", // green
  "280 60% 60%", // purple
  "340 75% 60%", // pink
  "50 90% 55%",  // yellow
  "180 65% 50%", // teal
  "10 80% 58%",  // red-orange
];

function groupTracks(channels: Track[]): Group[] {
  const groups: Group[] = [];
  let current: Group | null = null;
  let colorIdx = 0;

  const nextColor = () => GROUP_PALETTE[colorIdx++ % GROUP_PALETTE.length];

  for (const t of channels) {
    if (t.isFolder) {
      if (current) groups.push(current);
      current = { name: t.name, tracks: [t], isFolder: true, color: nextColor() };
    } else if (current) {
      current.tracks.push(t);
    } else {
      if (groups.length === 0 || groups[groups.length - 1].isFolder) {
        groups.push({ name: "", tracks: [t], isFolder: false, color: nextColor() });
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
    <div className="panel bg-background p-0 overflow-y-auto h-full">
      <div className="flex flex-wrap items-start gap-y-2 p-1">
        {groups.map((g, gi) => (
          <div
            key={gi}
            className="flex items-stretch rounded-sm mr-2 mb-1 bg-surface/40"
            style={{
              border: `1px solid hsl(${g.color} / 0.55)`,
              boxShadow: `inset 0 0 0 1px hsl(${g.color} / 0.12)`,
            }}
          >
            {g.isFolder && hasFolders && (
              <div
                className="flex flex-col items-center justify-start gap-1 px-1 py-2 border-r border-border min-w-[18px]"
                style={{ background: `hsl(${g.color} / 0.18)` }}
              >
                <Folder className="h-3 w-3" style={{ color: `hsl(${g.color})` }} />
                <div
                  className="text-[9px] font-semibold uppercase tracking-wider whitespace-nowrap"
                  style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", color: `hsl(${g.color})` }}
                >
                  {g.name || "Grupo"}
                </div>
              </div>
            )}
            <div className="flex items-stretch">
              {g.tracks.map((t) => (
                <TrackStrip key={t.index} track={t} groupColor={g.color} />
              ))}
            </div>
          </div>
        ))}

        {/* O fader do master foi movido para o painel de ações rápidas */}
      </div>
    </div>
  );
}
