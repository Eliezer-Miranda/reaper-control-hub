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
        {/* Top bar */}
        <header className="border-b border-border bg-surface px-4 py-2.5 flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-gradient-amber grid place-items-center font-bold text-primary-foreground">
              R
            </div>
            <div>
              <h1 className="text-sm font-bold uppercase tracking-[0.2em] leading-none">REAPER</h1>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Remote Control</p>
            </div>
          </div>
          <div className="ml-auto">
            <ConnectionPanel />
          </div>
        </header>

        {/* Transport */}
        <div className="px-3 pt-3">
          <Transport />
        </div>

        {/* Main grid */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-[240px_1fr_280px] gap-3 p-3 min-h-0">
          <aside className="hidden lg:block min-h-0">
            <TrackList />
          </aside>

          <main className="min-h-0 flex flex-col gap-3">
            <Mixer />
            <LogConsole />
          </main>

          <aside className="min-h-0 flex flex-col gap-3">
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
