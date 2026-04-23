// Connection manager + REAPER polling.
// Exposes a React context with config, status, transport, tracks, and actions.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ConnectionConfig,
  DEFAULT_CONFIG,
  Track,
  TransportState,
  reaperApi,
} from "@/lib/reaperApi";
import { logEvent } from "@/lib/eventLog";

export type ConnStatus = "disconnected" | "connecting" | "connected";

interface Ctx {
  config: ConnectionConfig;
  setConfig: (c: ConnectionConfig) => void;
  status: ConnStatus;
  transport: TransportState | null;
  tracks: Track[];
  selectedTrack: number | null;
  setSelectedTrack: (i: number | null) => void;
  bpm: number;
  setBpm: (b: number) => void;
  loop: boolean;
  metronome: boolean;
  toggleLoop: () => void;
  toggleMetronome: () => void;
  connect: () => Promise<void>;
  disconnect: () => void;
  api: typeof reaperApi;
  lastError: string | null;
  projectName: string | null;
}

const ReaperCtx = createContext<Ctx | null>(null);

const STORAGE_KEY = "reaper.connection.v1";

function loadConfig(): ConnectionConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch { /* noop */ }
  return DEFAULT_CONFIG;
}

export function ReaperProvider({ children }: { children: ReactNode }) {
  const [config, setConfigState] = useState<ConnectionConfig>(loadConfig);
  const [status, setStatus] = useState<ConnStatus>("disconnected");
  const [transport, setTransport] = useState<TransportState | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [selectedTrack, setSelectedTrack] = useState<number | null>(null);
  const [bpm, setBpmState] = useState<number>(120);
  const [loop, setLoop] = useState(false);
  const [metronome, setMetronome] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string | null>(null);

  const pollRef = useRef<number | null>(null);
  const trackRef = useRef<number | null>(null);
  const fxRef = useRef<number | null>(null);
  const vuRef = useRef<number | null>(null);
  const reconnectRef = useRef<number | null>(null);

  const setConfig = useCallback((c: ConnectionConfig) => {
    setConfigState(c);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(c)); } catch { /* noop */ }
  }, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null; }
    if (trackRef.current) { window.clearInterval(trackRef.current); trackRef.current = null; }
    if (fxRef.current) { window.clearInterval(fxRef.current); fxRef.current = null; }
    if (vuRef.current) { window.clearInterval(vuRef.current); vuRef.current = null; }
  }, []);

  const startPolling = useCallback(() => {
    stopPolling();
    pollRef.current = window.setInterval(async () => {
      try {
        const t = await reaperApi.getTransport(config);
        if (t) {
          setTransport(t);
          setStatus("connected");
          setLastError(null);
        }
      } catch (e) {
        setStatus("disconnected");
        const msg = e instanceof Error ? e.message : "polling failed";
        setLastError(msg);
        logEvent("error", `Transport polling: ${msg}`);
        stopPolling();
        scheduleReconnect();
      }
    }, 500);

    // Track polling — fast for VU meters
    trackRef.current = window.setInterval(async () => {
      try {
        const list = await reaperApi.getTracks(config);
        if (list.length) {
          setTracks((prev) => {
            // Preserve fx list across refresh
            const fxMap = new Map(prev.map((t) => [t.index, t.fx]));
            return list.map((t) => ({ ...t, fx: fxMap.get(t.index) ?? [] }));
          });
        }
      } catch { /* handled by transport poll */ }
    }, 250);

    // FX polling — slower
    fxRef.current = window.setInterval(async () => {
      try {
        const current = await reaperApi.getTracks(config);
        if (!current.length) return;
        const fxResults = await Promise.all(
          current.filter((t) => !t.isMaster && t.hasFx).map(async (t) => ({
            index: t.index,
            fx: await reaperApi.getTrackFx(config, t.index),
          })),
        );
        const fxMap = new Map(fxResults.map((r) => [r.index, r.fx]));
        setTracks((prev) => prev.map((t) => ({ ...t, fx: fxMap.get(t.index) ?? t.fx })));
        const name = await reaperApi.getProjectName(config);
        if (name) setProjectName(name);
      } catch { /* noop */ }
    }, 4000);

    // VU polling — fast and dedicated, queries each track's real meter.
    vuRef.current = window.setInterval(async () => {
      try {
        // Snapshot current track indices to query
        const indices = (await reaperApi.getTracks(config)).map((t) => t.index);
        if (!indices.length) return;
        const vus = await Promise.all(
          indices.map(async (idx) => ({ idx, vu: await reaperApi.getTrackVu(config, idx) })),
        );
        setTracks((prev) =>
          prev.map((t) => {
            const found = vus.find((v) => v.idx === t.index);
            if (!found || !found.vu) return t;
            return { ...t, peakL: found.vu.peakL, peakR: found.vu.peakR };
          }),
        );
      } catch { /* noop */ }
    }, 150);
  }, [config, stopPolling]);

  const scheduleReconnect = useCallback(() => {
    if (reconnectRef.current) return;
    reconnectRef.current = window.setTimeout(() => {
      reconnectRef.current = null;
      connect();
    }, 5000) as unknown as number;
  }, []); // eslint-disable-line

  const connect = useCallback(async () => {
    setStatus("connecting");
    setLastError(null);
    logEvent("info", `Conectando a ${config.host}:${config.port} via ${config.proxyMode}`);
    const r = await reaperApi.ping(config);
    if (r.ok) {
      setStatus("connected");
      logEvent("ok", "Conectado ao REAPER");
      // initial track fetch
      try {
        const t = await reaperApi.getTracks(config);
        setTracks(t);
      } catch { /* noop */ }
      startPolling();
    } else {
      setStatus("disconnected");
      const msg = r.status === 401 ? "Credencial inválida (401)" : (r.error || `HTTP ${r.status}`);
      setLastError(msg);
      logEvent("error", `Falha de conexão: ${msg}`);
      scheduleReconnect();
    }
  }, [config, startPolling, scheduleReconnect]);

  const disconnect = useCallback(() => {
    stopPolling();
    if (reconnectRef.current) { window.clearTimeout(reconnectRef.current); reconnectRef.current = null; }
    setStatus("disconnected");
    logEvent("info", "Desconectado");
  }, [stopPolling]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const setBpm = useCallback((b: number) => {
    setBpmState(b);
    if (status === "connected") {
      reaperApi.setTempo(config, b).catch(() => { /* logged by polling */ });
    }
  }, [config, status]);

  const toggleLoop = useCallback(() => {
    setLoop((v) => !v);
    if (status === "connected") reaperApi.runAction(config, 1068).catch(() => undefined);
  }, [config, status]);

  const toggleMetronome = useCallback(() => {
    setMetronome((v) => !v);
    if (status === "connected") reaperApi.runAction(config, 40364).catch(() => undefined);
  }, [config, status]);

  const value = useMemo<Ctx>(() => ({
    config, setConfig, status, transport, tracks,
    selectedTrack, setSelectedTrack, bpm, setBpm,
    loop, metronome, toggleLoop, toggleMetronome,
    connect, disconnect, api: reaperApi, lastError, projectName,
  }), [config, setConfig, status, transport, tracks, selectedTrack, bpm, setBpm,
       loop, metronome, toggleLoop, toggleMetronome, connect, disconnect, lastError, projectName]);

  return <ReaperCtx.Provider value={value}>{children}</ReaperCtx.Provider>;
}

export function useReaper() {
  const ctx = useContext(ReaperCtx);
  if (!ctx) throw new Error("useReaper must be used within ReaperProvider");
  return ctx;
}
