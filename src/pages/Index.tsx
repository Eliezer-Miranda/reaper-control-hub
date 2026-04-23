import { ReaperProvider, useReaper } from "@/hooks/useReaper";
import { Transport } from "@/components/Transport";
import { Mixer } from "@/components/Mixer";
import { ConnectionPanel } from "@/components/ConnectionPanel";
import { ActionPanel } from "@/components/ActionPanel";
import { StatusBar } from "@/components/StatusBar";
import { LogConsole } from "@/components/LogConsole";
import { TrackList } from "@/components/TrackList";

function Header() {
  const { projectName, status } = useReaper();
  return (
    <header className="bg-surface-2 border-b border-border px-2 py-1 flex items-center gap-3 h-8 shrink-0">
      <div className="flex items-center gap-1.5">
        <div className="h-5 w-5 rounded-sm bg-surface-3 border border-border grid place-items-center text-[10px] font-bold text-foreground">
          R
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground/90">REAPER Remote</span>
      </div>

      {/* Project name from REAPER */}
      <div className="flex items-center gap-2 px-2 py-0.5 well rounded-sm min-w-[180px] max-w-[420px]">
        <span className="text-[10px] uppercase text-muted-foreground tracking-wider">Projeto</span>
        <span className="text-[11px] font-mono text-primary truncate">
          {status === "connected" ? (projectName ?? "—") : "—"}
        </span>
      </div>

      <div className="ml-auto">
        <ConnectionPanel />
      </div>
    </header>
  );
}

const Index = () => {
  return (
    <ReaperProvider>
      <div className="h-screen flex flex-col bg-background text-foreground overflow-hidden">
        <Header />
        <Transport />

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-[200px_1fr_260px] gap-1 p-1 min-h-0 overflow-hidden">
          <aside className="hidden lg:block min-h-0">
            <TrackList />
          </aside>

          <main className="min-h-0 flex flex-col gap-1 overflow-hidden">
            <div className="flex-1 min-h-0">
              <Mixer />
            </div>
            <div className="shrink-0 max-h-[180px]">
              <LogConsole />
            </div>
          </main>

          <aside className="min-h-0 flex flex-col gap-1 overflow-hidden">
            <ActionPanel />
            <div className="lg:hidden">
              <TrackList />
            </div>
          </aside>
        </div>

        <StatusBar />
      </div>
    </ReaperProvider>
  );
};

export default Index;
