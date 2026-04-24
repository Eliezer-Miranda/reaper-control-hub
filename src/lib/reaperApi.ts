// Busca dados de sistema do servidor Express (CPU, RAM, rede)
export async function getServerSysInfo(cfg: ConnectionConfig): Promise<any> {
  const url = cfg.localProxyUrl.replace(/\/$/, "") + "/sysinfo";
  const r = await fetch(url);
  if (!r.ok) throw new Error("Erro ao buscar sysinfo");
  return await r.json();
}
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
  volume: number; // amplitude linear (1.0 == 0dB no Reaper)
  pan: number; // -1..1
  mute: boolean;
  solo: boolean;
  recarm: boolean;
  isMaster: boolean;
  isFolder: boolean;
  folderDepth: number;
  selected: boolean;
  hasFx: boolean;
  peakL: number; // 0..1 normalizado
  peakR: number;
  color?: string;
  fx: string[];
}

export function parseTracks(body: string): Track[] {
  const lines = body.split("\n").filter((l) => l.startsWith("TRACK"));
  const tracks: Track[] = [];
  let autoIdx = 0;
  for (const l of lines) {
    const c = l.split("\t");
    const c1IsInt = /^-?\d+$/.test(c[1] ?? "");
    const c3IsInt = /^-?\d+$/.test(c[3] ?? "");
    let idx: number, name: string, flags: number, volume: number, pan: number, peakLast: number, color: string | undefined;
    if (c1IsInt && c3IsInt) {
      idx = parseInt(c[1], 10);
      name = c[2] ?? "";
      flags = parseInt(c[3] ?? "0", 10);
      volume = parseFloat(c[4] ?? "1");
      pan = parseFloat(c[5] ?? "0");
      peakLast = parseFloat(c[6] ?? "-150");
      color = c[13] && c[13] !== "0" ? c[13] : undefined;
    } else {
      idx = autoIdx;
      name = c[1] ?? "";
      flags = parseInt(c[2] ?? "0", 10);
      volume = parseFloat(c[3] ?? "1");
      pan = parseFloat(c[4] ?? "0");
      peakLast = parseFloat(c[5] ?? "-150");
      color = c[12] && c[12] !== "0" ? c[12] : undefined;
    }
    autoIdx++;

    let peak = 0;
    if (Number.isFinite(peakLast)) {
      peak = Math.max(0, Math.min(1, (peakLast + 60) / 66));
    }

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

export function parseVu(body: string): { peakL: number; peakR: number } | null {
  const line = body.split("\n").find((l) => l.startsWith("VU"));
  if (!line) return null;
  const c = line.split("\t");
  const dbL = parseFloat(c[1] ?? "-150");
  const dbR = parseFloat(c[2] ?? "-150");
  const norm = (db: number) => Number.isFinite(db) ? Math.max(0, Math.min(1, (db + 60) / 66)) : 0;
  return { peakL: norm(dbL), peakR: norm(dbR) };
}

// ---------------------------------------------------------------------------
// Curva de fader calibrada para o Reaper (igual ao fader nativo).
//
// O Reaper usa amplitude linear onde 1.0 = 0dB.
// A curva do fader nativo é:  amp = slider^4 * 4
//   slider=0.00 → amp=0.000 → -inf dB
//   slider=0.75 → amp=1.006 → ~0 dB   ← 0dB fica em 75% do fader ✓
//   slider=1.00 → amp=4.000 → +6.02 dB
//
// Verificação:
//   ampToSlider(1.0) = (1.0/4)^(1/4) = 0.25^0.25 = 0.7071... ≈ 0.75 ✓
// ---------------------------------------------------------------------------

/**
 * Converte valor do slider (0 a 1) para amplitude, usando curva do REAPER.
 * Permite modular faixa de saída (ex: -inf a +12dB, ou -60 a +6dB).
 *
 * @param slider Valor do slider (0 a 1)
 * @param minAmp Amplitude mínima (default: 0, -inf dB)
 * @param maxAmp Amplitude máxima (default: 4, +6dB)
 * @returns Amplitude linear
 */
export function sliderToAmp(slider: number, minAmp = 0, maxAmp = 4): number {
  if (slider <= 0) return minAmp;
  const x = Math.min(1, Math.max(0, slider));
  // Interpola entre minAmp e maxAmp usando curva do REAPER
  return minAmp + (maxAmp - minAmp) * Math.pow(x, 4);
}


/**
 * Converte amplitude linear para valor do slider (0 a 1), usando curva do REAPER.
 * Permite modular faixa de entrada (ex: -inf a +12dB, ou -60 a +6dB).
 *
 * @param amp Amplitude linear
 * @param minAmp Amplitude mínima (default: 0, -inf dB)
 * @param maxAmp Amplitude máxima (default: 4, +6dB)
 * @returns Valor do slider (0 a 1)
 */
export function ampToSlider(amp: number, minAmp = 0, maxAmp = 4): number {
  if (amp <= minAmp) return 0;
  if (amp >= maxAmp) return 1;
  // slider = ((amp - minAmp) / (maxAmp - minAmp)) ^ (1/4)
  return Math.pow((amp - minAmp) / (maxAmp - minAmp), 0.25);
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
  getServerSysInfo,
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
  async getTrackFx(cfg: ConnectionConfig, idx: number): Promise<string[]> {
    try {
      const r = await callProxy(cfg, `/_/GET/TRACK/${idx}/FX`);
      if (!r.ok) return [];
      return r.body
        .split("\n")
        .filter((l) => l.startsWith("FX"))
        .map((l) => l.split("\t")[3] ?? "")
        .filter(Boolean);
    } catch {
      return [];
    }
  },
  async getProjectName(cfg: ConnectionConfig): Promise<string | null> {
    try {
      const r = await callProxy(cfg, "/_/PROJECT");
      if (!r.ok) return null;
      const line = r.body.split("\n").find((l) => l.startsWith("PROJECT"));
      if (line) {
        const cols = line.split("\t");
        const n = (cols[1] ?? "").trim();
        if (n) return n.replace(/\.rpp$/i, "");
      }
      const nameLine = r.body.split("\n").find((l) => l.startsWith("NAME"));
      if (nameLine) {
        const n = nameLine.split("\t")[1] ?? "";
        if (n) return n.replace(/\.rpp$/i, "");
      }
      return null;
    } catch {
      return null;
    }
  },
  async getTrackVu(cfg: ConnectionConfig, idx: number): Promise<{ peakL: number; peakR: number } | null> {
    try {
      const r = await callProxy(cfg, `/_/GET/TRACK/${idx}/VU`);
      if (!r.ok) return null;
      return parseVu(r.body);
    } catch {
      return null;
    }
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