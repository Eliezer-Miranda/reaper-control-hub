// REAPER Web Interface API client.
// Talks to a proxy (either the Lovable Cloud edge function or a local Express
// server) because the browser cannot bypass REAPER's lack of CORS headers.

import { supabase } from "@/integrations/supabase/client";

export type ProxyMode = "cloud" | "local";

export interface ConnectionConfig {
  host: string;
  port: number;
  password: string;
  proxyMode: ProxyMode;
  localProxyUrl: string; // e.g. http://localhost:3001
}

export const DEFAULT_CONFIG: ConnectionConfig = {
  host: "192.168.1.10",
  port: 8080,
  password: "",
  proxyMode: "local",
  localProxyUrl: "http://localhost:3001",
};

export interface ProxyResponse {
  status: number;
  ok: boolean;
  body: string;
}

async function callProxy(cfg: ConnectionConfig, path: string): Promise<ProxyResponse> {
  if (cfg.proxyMode === "local") {
    const url = `${cfg.localProxyUrl.replace(/\/$/, "")}/proxy?path=${encodeURIComponent(path)}`;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 3500);
    try {
      const r = await fetch(url, {
        method: "GET",
        headers: {
          "x-reaper-host": cfg.host,
          "x-reaper-port": String(cfg.port),
          "x-reaper-password": cfg.password ?? "",
        },
        signal: ctrl.signal,
      });
      const json = (await r.json()) as ProxyResponse;
      return json;
    } finally {
      clearTimeout(t);
    }
  }

  // Cloud edge function mode
  const { data, error } = await supabase.functions.invoke("reaper-proxy", {
    body: {
      host: cfg.host,
      port: cfg.port,
      password: cfg.password || undefined,
      path,
    },
  });
  if (error) throw error;
  return data as ProxyResponse;
}

// ---------- Parsing ----------

export interface TransportState {
  playstate: number; // 0 stopped, 1 playing, 2 paused, 5 recording, 6 record paused
  position: number; // seconds
  repeat: boolean;
  positionString: string; // "0:00.000"
  positionBeats: string; // "1.1.00"
}

// REAPER returns plain text rows separated by \n, columns by \t.
// Example TRANSPORT: TRANSPORT\t1\t12.345\t0\t0\t0:12.345\t1.1.00
export function parseTransport(body: string): TransportState | null {
  const line = body.split("\n").find((l) => l.startsWith("TRANSPORT"));
  if (!line) return null;
  const cols = line.split("\t");
  return {
    playstate: parseInt(cols[1] ?? "0", 10),
    position: parseFloat(cols[2] ?? "0"),
    repeat: cols[3] === "1",
    positionString: cols[5] ?? "0:00.000",
    positionBeats: cols[6] ?? "1.1.00",
  };
}

export interface Track {
  index: number; // 1-based; 0 is master
  name: string;
  volume: number; // 0..~4 (1 == 0dB)
  pan: number; // -1..1
  mute: boolean;
  solo: boolean;
  recarm: boolean;
  isMaster: boolean;
  isFolder: boolean;
  folderDepth: number; // 1 starts a folder, -1 ends, 0 normal
  selected: boolean;
  hasFx: boolean;
  peakL: number; // 0..1+ amplitude (last peak L)
  peakR: number; // 0..1+ amplitude (last peak R)
  color?: string;
  fx: string[]; // names of FX on this track
}

// TRACK rows: TRACK\tindex\tname\tflags\tvolume\tpan\tlast_meter_peak\tlast_meter_pos\twidth_or_pan2\tpan_mode\tsendcnt\trecvcnt\thwoutcnt\tcolor
// flags bits per REAPER docs: folder=1, selected=2, hasFx=4, mute=8, solo=16/32, recarm=64
export function parseTracks(body: string): Track[] {
  const lines = body.split("\n").filter((l) => l.startsWith("TRACK"));
  const tracks: Track[] = [];
  for (const l of lines) {
    const c = l.split("\t");
    const idx = parseInt(c[1] ?? "0", 10);
    const name = c[2] ?? "";
    const flags = parseInt(c[3] ?? "0", 10);
    const volume = parseFloat(c[4] ?? "1");
    const pan = parseFloat(c[5] ?? "0");
    const peakLast = parseFloat(c[6] ?? "0"); // mono peak in dB
    const color = c[13] && c[13] !== "0" ? c[13] : undefined;

    // peak comes as dB float (e.g. -inf..0). Convert to 0..1 amplitude approx.
    const peak = Number.isFinite(peakLast) ? Math.pow(10, peakLast / 20) : 0;

    tracks.push({
      index: idx,
      name: idx === 0 ? "MASTER" : name || `Track ${idx}`,
      volume: Number.isFinite(volume) ? volume : 1,
      pan: Number.isFinite(pan) ? pan : 0,
      mute: (flags & 8) !== 0,
      solo: (flags & 16) !== 0 || (flags & 32) !== 0,
      recarm: (flags & 64) !== 0,
      isMaster: idx === 0,
      isFolder: (flags & 1) !== 0,
      folderDepth: 0,
      selected: (flags & 2) !== 0,
      hasFx: (flags & 4) !== 0,
      peakL: peak,
      peakR: peak,
      color,
      fx: [],
    });
  }
  return tracks;
}

// Volume mapping: REAPER uses linear amplitude where 1.0 = 0dB.
// We use 0..1 slider where 0.71 ~= 0dB by mapping to amp = pow(slider, 2) * 4
// but simpler standard: amp 0..2 mapped to slider 0..1 (clip).
export function sliderToAmp(slider: number): number {
  // 0..1 slider, 0.75 == 0dB (1.0), max 1.0 == ~+6dB (2.0)
  if (slider <= 0) return 0;
  const x = Math.min(1, Math.max(0, slider));
  return x * x * 4; // 0..4
}
export function ampToSlider(amp: number): number {
  if (amp <= 0) return 0;
  return Math.min(1, Math.sqrt(amp / 4));
}
export function ampToDb(amp: number): number {
  if (amp <= 0) return -Infinity;
  return 20 * Math.log10(amp);
}
export function formatDb(amp: number): string {
  const db = ampToDb(amp);
  if (!Number.isFinite(db)) return "-inf";
  return `${db >= 0 ? "+" : ""}${db.toFixed(1)} dB`;
}
export function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

// ---------- High-level API ----------
export const reaperApi = {
  async ping(cfg: ConnectionConfig): Promise<{ ok: boolean; status: number; error?: string }> {
    try {
      const r = await callProxy(cfg, "/_/TRANSPORT");
      return { ok: r.ok, status: r.status };
    } catch (e) {
      return { ok: false, status: 0, error: e instanceof Error ? e.message : "error" };
    }
  },
  async getTransport(cfg: ConnectionConfig): Promise<TransportState | null> {
    const r = await callProxy(cfg, "/_/TRANSPORT");
    if (!r.ok) return null;
    return parseTransport(r.body);
  },
  async getTracks(cfg: ConnectionConfig): Promise<Track[]> {
    const r = await callProxy(cfg, "/_/TRACK");
    if (!r.ok) return [];
    return parseTracks(r.body);
  },
  setVolume(cfg: ConnectionConfig, idx: number, slider: number) {
    const amp = sliderToAmp(slider);
    return callProxy(cfg, `/_/SET/TRACK/${idx}/VOL/${amp.toFixed(4)}`);
  },
  setPan(cfg: ConnectionConfig, idx: number, pan: number) {
    return callProxy(cfg, `/_/SET/TRACK/${idx}/PAN/${pan.toFixed(3)}`);
  },
  setMute(cfg: ConnectionConfig, idx: number, on: boolean) {
    return callProxy(cfg, `/_/SET/TRACK/${idx}/MUTE/${on ? 1 : 0}`);
  },
  setSolo(cfg: ConnectionConfig, idx: number, on: boolean) {
    return callProxy(cfg, `/_/SET/TRACK/${idx}/SOLO/${on ? 1 : 0}`);
  },
  setRecArm(cfg: ConnectionConfig, idx: number, on: boolean) {
    return callProxy(cfg, `/_/SET/TRACK/${idx}/RECARM/${on ? 1 : 0}`);
  },
  setPos(cfg: ConnectionConfig, seconds: number) {
    return callProxy(cfg, `/_/SET/POS/${seconds.toFixed(3)}`);
  },
  setTempo(cfg: ConnectionConfig, bpm: number) {
    return callProxy(cfg, `/_/SET/TEMPO/${bpm.toFixed(2)}/1`);
  },
  runAction(cfg: ConnectionConfig, id: number | string) {
    return callProxy(cfg, `/_/${id}`);
  },
};

export const REAPER_ACTIONS = {
  PLAY: 1007,
  PAUSE: 1008,
  STOP: 1016,
  RECORD: 1013,
  TOGGLE_LOOP: 1068,
  GO_TO_START: 40042,
  NEW_TRACK: 40001,
  DELETE_SELECTED_TRACK: 40005,
  SAVE: 40026,
  UNDO: 40029,
  REDO: 40030,
  TOGGLE_METRONOME: 40364,
  RENDER: 40015,
  OPEN: 40025,
  TOGGLE_MUTE_SEL: 40280,
  TOGGLE_SOLO_SEL: 40281,
} as const;

export const QUICK_ACTIONS_DEFAULT: { label: string; id: number }[] = [
  { label: "Salvar", id: REAPER_ACTIONS.SAVE },
  { label: "Desfazer", id: REAPER_ACTIONS.UNDO },
  { label: "Refazer", id: REAPER_ACTIONS.REDO },
  { label: "Renderizar", id: REAPER_ACTIONS.RENDER },
  { label: "Abrir Projeto", id: REAPER_ACTIONS.OPEN },
  { label: "Nova Faixa", id: REAPER_ACTIONS.NEW_TRACK },
];
