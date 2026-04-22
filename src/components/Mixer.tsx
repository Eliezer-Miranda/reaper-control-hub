import { useReaper } from "@/hooks/useReaper";
import { TrackStrip } from "./TrackStrip";
import { Music } from "lucide-react";

export function Mixer() {
  const { tracks } = useReaper();
  const master = tracks.find((t) => t.isMaster);
  const channels = tracks.filter((t) => !t.isMaster);

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
    <div className="panel overflow-x-auto bg-background p-0">
      <div className="flex items-stretch min-w-fit">
        {channels.map((t) => (
          <TrackStrip key={t.index} track={t} />
        ))}
        {master && (
          <>
            <div className="w-2 bg-background" />
            <TrackStrip track={master} />
          </>
        )}
      </div>
    </div>
  );
}
