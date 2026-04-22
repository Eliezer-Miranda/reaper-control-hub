// Tiny global event log shared across components.
import { useEffect, useState } from "react";

export interface LogEntry {
  id: number;
  ts: number;
  level: "info" | "warn" | "error" | "ok";
  msg: string;
}

let counter = 0;
const entries: LogEntry[] = [];
const listeners = new Set<(e: LogEntry[]) => void>();

export function logEvent(level: LogEntry["level"], msg: string) {
  counter += 1;
  entries.unshift({ id: counter, ts: Date.now(), level, msg });
  if (entries.length > 20) entries.length = 20;
  listeners.forEach((l) => l([...entries]));
}

export function useEventLog() {
  const [list, setList] = useState<LogEntry[]>(() => [...entries]);
  useEffect(() => {
    listeners.add(setList);
    return () => { listeners.delete(setList); };
  }, []);
  return list;
}
