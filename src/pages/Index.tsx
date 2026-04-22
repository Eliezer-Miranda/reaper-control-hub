import { ReaperProvider } from "@/hooks/useReaper";
import { Transport } from "@/components/Transport";
import { Mixer } from "@/components/Mixer";
import { ConnectionPanel } from "@/components/ConnectionPanel";
import { ActionPanel } from "@/components/ActionPanel";
import { StatusBar } from "@/components/StatusBar";
import { LogConsole } from "@/components/LogConsole";
import { TrackList } from "@/components/TrackList";

const Index = () => {
  return (
    <ReaperProvider>
      <div className="min-h-screen flex flex-col bg-background text-foreground">
        {/* Top bar — slim toolbar like REAPER */}
        <header className="bg-surface-2 border-b border-border px-2 py-1 flex items-center gap-2 h-8">
          <div className="flex items-center gap-1.5">
            <div className="h-5 w-5 rounded-sm bg-surface-3 border border-border grid place-items-center text-[10px] font-bold text-foreground">
              R
            </div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground/90">REAPER Remote</span>
          </div>
          <div className="ml-auto">
            <ConnectionPanel />
          </div>
        </header>

        {/* Transport bar */}
        <Transport />

        {/* Main grid */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-[200px_1fr_260px] gap-1 p-1 min-h-0">
          <aside className="hidden lg:block min-h-0">
            <TrackList />
          </aside>

          <main className="min-h-0 flex flex-col gap-1">
            <Mixer />
            <LogConsole />
          </main>

          <aside className="min-h-0 flex flex-col gap-1">
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
