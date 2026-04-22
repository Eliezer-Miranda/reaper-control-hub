import { useReaper } from "@/hooks/useReaper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { Settings2, Power, RotateCw, Server, Cloud } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import { ProxyMode } from "@/lib/reaperApi";

export function ConnectionPanel() {
  const { config, setConfig, connect, disconnect, status, lastError } = useReaper();
  const [draft, setDraft] = useState(config);

  const apply = () => {
    setConfig(draft);
    setTimeout(() => connect(), 50);
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" className="gap-2 border border-border">
          <Settings2 className="h-4 w-4" />
          <span className="hidden md:inline">Conexão</span>
          <span className={cn(
            "led ml-1",
            status === "connected" && "bg-success text-success",
            status === "connecting" && "bg-warning text-warning animate-pulse-led",
            status === "disconnected" && "bg-destructive text-destructive",
          )} />
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto bg-surface border-border">
        <SheetHeader>
          <SheetTitle className="text-primary uppercase tracking-wider">Conexão REAPER</SheetTitle>
          <SheetDescription>
            Configure o acesso à Web Interface nativa do REAPER.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 mt-6">
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider">Modo de proxy</Label>
            <div className="grid grid-cols-2 gap-2">
              <ProxyOption
                active={draft.proxyMode === "local"}
                onClick={() => setDraft({ ...draft, proxyMode: "local" })}
                icon={<Server className="h-4 w-4" />}
                title="Local"
                desc="Express na rede"
              />
              <ProxyOption
                active={draft.proxyMode === "cloud"}
                onClick={() => setDraft({ ...draft, proxyMode: "cloud" })}
                icon={<Cloud className="h-4 w-4" />}
                title="Cloud"
                desc="REAPER público"
              />
            </div>
          </div>

          {draft.proxyMode === "local" && (
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider">URL do proxy local</Label>
              <Input
                value={draft.localProxyUrl}
                onChange={(e) => setDraft({ ...draft, localProxyUrl: e.target.value })}
                placeholder="http://localhost:3001"
              />
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2 space-y-2">
              <Label className="text-xs uppercase tracking-wider">IP do REAPER</Label>
              <Input
                value={draft.host}
                onChange={(e) => setDraft({ ...draft, host: e.target.value })}
                placeholder="192.168.1.10"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider">Porta</Label>
              <Input
                type="number"
                value={draft.port}
                onChange={(e) => setDraft({ ...draft, port: parseInt(e.target.value || "0", 10) })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider">Senha (opcional)</Label>
            <Input
              type="password"
              value={draft.password}
              onChange={(e) => setDraft({ ...draft, password: e.target.value })}
              placeholder="(vazio se não houver)"
            />
          </div>

          <div className="flex gap-2">
            <Button onClick={apply} className="flex-1 gap-2 bg-gradient-amber text-primary-foreground hover:opacity-90">
              <Power className="h-4 w-4" /> Conectar
            </Button>
            <Button onClick={disconnect} variant="outline" className="gap-2">
              <RotateCw className="h-4 w-4" /> Reset
            </Button>
          </div>

          {lastError && (
            <div className="p-3 bg-destructive/10 border border-destructive/40 rounded text-xs text-destructive">
              {lastError}
            </div>
          )}

          <div className="border-t border-border pt-4 mt-6">
            <h3 className="text-sm font-semibold uppercase tracking-wider mb-3 text-primary">
              Como ativar no REAPER
            </h3>
            <ol className="space-y-2 text-xs text-muted-foreground list-decimal pl-4">
              <li>REAPER → <strong>Options</strong> → <strong>Preferences</strong> → <strong>Control Surfaces</strong>.</li>
              <li>Clique em <strong>Add</strong> e selecione <em>"Web browser interface"</em>.</li>
              <li>Defina a <strong>porta</strong> (padrão 8080) e uma senha opcional.</li>
              <li>OK e reinicie o REAPER.</li>
              <li>Libere a porta no <strong>firewall</strong> do sistema.</li>
              <li>No modo <strong>Local</strong>, rode o servidor proxy: <code className="bg-surface-3 px-1 rounded">npm run server</code> (veja README).</li>
              <li>No modo <strong>Cloud</strong>, exponha o REAPER à internet (port-forward, ngrok, Tailscale Funnel).</li>
            </ol>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ProxyOption({
  active, onClick, icon, title, desc,
}: { active: boolean; onClick: () => void; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "p-3 rounded-md border text-left transition-all",
        active ? "border-primary bg-primary/10 shadow-amber" : "border-border bg-surface-2 hover:bg-surface-3",
      )}
    >
      <div className="flex items-center gap-2 text-sm font-semibold">
        {icon}{title}
      </div>
      <div className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider">{desc}</div>
    </button>
  );
}
