// Lovable Cloud edge function: proxy HTTP requests to a REAPER Web Interface.
// IMPORTANT: REAPER must be reachable from the internet (port forwarding,
// Tailscale Funnel, ngrok, etc.) for this to work. For pure LAN setups,
// run the local Express proxy in /server instead.
//
// Request body: { host: string, port: number, password?: string, path: string }
// `path` is the REAPER URL path, e.g. "/_/TRANSPORT" or "/_/TRACK/1/VOLUME/0.7"

import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

interface ProxyBody {
  host: string;
  port: number;
  password?: string;
  path: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as ProxyBody;
    const { host, port, password, path } = body;

    if (!host || !port || !path) {
      return new Response(
        JSON.stringify({ error: "host, port and path are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Basic validation – avoid being a generic open proxy.
    if (!/^[a-zA-Z0-9.\-_]+$/.test(host)) {
      return new Response(
        JSON.stringify({ error: "Invalid host" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const safePath = path.startsWith("/") ? path : `/${path}`;

    const url = `http://${host}:${port}${safePath}`;
    const headers: Record<string, string> = {};
    if (password) {
      // REAPER uses Basic Auth with empty username
      const token = btoa(`:${password}`);
      headers["Authorization"] = `Basic ${token}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    let upstream: Response;
    try {
      upstream = await fetch(url, { method: "GET", headers, signal: controller.signal });
    } catch (err) {
      clearTimeout(timeout);
      const message = err instanceof Error ? err.message : "fetch failed";
      return new Response(
        JSON.stringify({ error: "REAPER unreachable", detail: message }),
        { status: 504, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    clearTimeout(timeout);

    const text = await upstream.text();
    return new Response(
      JSON.stringify({
        status: upstream.status,
        ok: upstream.ok,
        body: text,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
