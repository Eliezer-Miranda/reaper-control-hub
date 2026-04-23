# REAPER Remote — Web Interface

Painel web completo de controle remoto para o DAW **REAPER** (reaper.fm).
Conecta-se à **Web Interface nativa do REAPER** via HTTP na rede local e
oferece um mixer estilo console, transporte, ações rápidas, lista de FX por
faixa e agrupamento colorido por folder.

> Desenvolvido por **Zertec — Zertec Redes e Sistemas**.

---

## ✨ Funcionalidades

- **Transporte**: Play / Stop / Record / Loop / Metrônomo / Go-to-start
- **Mixer multi-linha** com faixas finas (cabe muitos stems)
- **VU meters reais** lidos do REAPER (`last_meter_peak`)
- **Faders** com escala em dB, knobs de pan arrastáveis, M/S/R por faixa
- **Agrupamento por folder** com **cor automática por grupo**
- **Lista de FX** ativos por faixa (até 3 visíveis + contador)
- **Nome do projeto** exibido no topo (lido do REAPER)
- **Painel de ações** com IDs customizáveis (salvos no `localStorage`)
- **Status / log** em tempo real, **reconexão automática**
- **Dois modos de proxy** (CORS workaround):
  - **Local** — servidor Node/Express na sua rede
  - **Cloud** — Edge Function (Lovable Cloud) para acesso remoto

---

## 🏗 Arquitetura

```
┌────────────┐  HTTP   ┌─────────────────┐  HTTP   ┌──────────────┐
│  Browser   │ ──────▶ │  Proxy (Local   │ ──────▶ │   REAPER     │
│  (React)   │ ◀────── │  ou Cloud)      │ ◀────── │  Web Iface   │
└────────────┘         └─────────────────┘         └──────────────┘
```

O proxy é **necessário** porque o REAPER não envia headers CORS, então o
browser não consegue falar diretamente com ele.

```
.
├── src/                        ← Frontend React + Vite + Tailwind
│   ├── components/             ← Mixer, TrackStrip, Transport, etc.
│   ├── hooks/useReaper.tsx     ← Conexão + polling
│   ├── lib/reaperApi.ts        ← Cliente HTTP do REAPER
│   └── pages/Index.tsx
├── server/                     ← Proxy Express (modo local)
│   ├── server.js
│   └── package.json
├── supabase/functions/
│   └── reaper-proxy/index.ts   ← Proxy Edge Function (modo cloud)
└── README.md
```

---

## 1️⃣ Ativar a Web Interface no REAPER

1. Abra o REAPER → menu **Options → Preferences** (`Ctrl+P`).
2. Na lateral, vá em **Control/OSC/web → Control Surfaces**.
3. Clique em **Add** e selecione **"Web browser interface"**.
4. Configure:
   - **Listen on port**: `8080` (ou qualquer outra livre)
   - **Username / password**: opcional, mas **recomendado** (anote)
   - **Allow access from**: marque as redes que poderão acessar
5. Clique em **OK** e reinicie o REAPER.
6. Teste no próprio PC: abra `http://localhost:8080` no navegador — deve
   aparecer a interface web nativa do REAPER. Se pedir login, use as
   credenciais configuradas.
7. Descubra o **IP local** da máquina do REAPER:
   - Windows: `ipconfig`
   - Linux/Mac: `ifconfig` ou `ip a`

   Ex.: `192.168.1.10`.

> ⚠️ **Firewall**: libere a porta `8080` (TCP) no firewall do SO se for
> acessar de outro dispositivo da rede.

---

## 2️⃣ Rodar o Frontend

```bash
npm install
npm run dev
```

Acesse `http://localhost:8080` (Vite). Clique em **Conectar** no canto
superior direito e configure:

| Campo               | Exemplo                   |
|---------------------|---------------------------|
| Host                | `192.168.1.10`            |
| Porta               | `8080`                    |
| Senha               | (se configurada)          |
| Modo de proxy       | `Local` ou `Cloud`        |
| URL do proxy local  | `http://localhost:3001`   |

As configurações são salvas no `localStorage` do navegador.

---

## 3️⃣ Rodar o Proxy Local (modo `Local`)

Em um terminal separado:

```bash
cd server
npm install
npm start
```

O servidor sobe em `http://localhost:3001` por padrão.

Variáveis opcionais (`server/.env`):

```env
PORT=3001
ALLOW_ORIGIN=*
```

> Veja `server/.env.example` para a lista completa.

---

## 4️⃣ Acessar de outro dispositivo (celular, tablet, outro PC)

1. Garanta que o frontend esteja exposto na rede:
   ```bash
   npm run dev -- --host 0.0.0.0
   ```
2. No outro dispositivo, acesse `http://IP_DO_PC:8080`.
3. Configure a conexão apontando para o IP da máquina do REAPER e, se
   estiver em modo Local, para o IP do proxy: `http://IP_DO_PC:3001`.

> Para acesso **fora da rede local**, use o modo **Cloud** ou um túnel
> seguro (Tailscale, Cloudflare Tunnel, ngrok). Sempre proteja com senha.

---

## 5️⃣ Modo Cloud (Edge Function)

Já vem habilitado via **Lovable Cloud**. A Edge Function fica em
`supabase/functions/reaper-proxy/`. Quando o app é publicado, ela já
está deployada — basta selecionar **Cloud** no painel de conexão.

Esse modo só funciona se o IP/porta do REAPER for **acessível pela
internet** (port-forwarding, túnel, IP público).

---

## 🎛 Ações REAPER — IDs principais

| Ação                       | ID      |
|----------------------------|---------|
| Play                       | `1007`  |
| Pause                      | `1008`  |
| Stop                       | `1016`  |
| Record                     | `1013`  |
| Toggle loop                | `1068`  |
| Go to start                | `40042` |
| Salvar projeto             | `40026` |
| Abrir projeto              | `40025` |
| Renderizar                 | `40015` |
| Desfazer                   | `40029` |
| Refazer                    | `40030` |
| Nova faixa                 | `40001` |
| Excluir faixa selecionada  | `40005` |
| Toggle metrônomo           | `40364` |
| Toggle mute selecionada    | `40280` |
| Toggle solo selecionada    | `40281` |

A lista completa pode ser consultada no **Action List** do REAPER
(atalho `?`).

---

## 🧰 Troubleshooting

| Sintoma                                  | Solução                                                                  |
|------------------------------------------|---------------------------------------------------------------------------|
| `401 Unauthorized`                       | Senha errada — confira em REAPER → Preferences → Web Interface           |
| `Failed to fetch` / timeout              | Proxy local não rodando, IP/porta errados, ou firewall bloqueando        |
| Conecta mas não mostra faixas            | A Web Interface está acessível mas o projeto está vazio                  |
| VU sempre zerado                         | REAPER só envia peak quando há sinal tocando                             |
| Não acessa de outro dispositivo          | Use `--host 0.0.0.0` no Vite + libere portas 8080/3001 no firewall       |
| Cloud mode falha em IPs locais           | Edge Functions só alcançam IPs **públicos** — use modo Local na LAN      |
| FX não aparecem na faixa                 | A faixa não tem FX, ou o flag `hasFX` ainda não foi atualizado (4s poll) |

---

## 📦 Dependências

### Frontend (`package.json`)

**Runtime**
- `react` ^18.3, `react-dom` ^18.3, `react-router-dom` ^6.30
- `vite` ^5.4 + `@vitejs/plugin-react-swc`
- `typescript` ^5.8
- `tailwindcss` ^3.4 + `tailwindcss-animate` + `@tailwindcss/typography`
- `@tanstack/react-query` ^5.83
- `@supabase/supabase-js` ^2.104 (cliente da Edge Function)
- `lucide-react` (ícones)
- `class-variance-authority`, `clsx`, `tailwind-merge` (utilidades de classes)
- `sonner` (toasts), `next-themes`
- `react-hook-form` + `@hookform/resolvers` + `zod` (forms/validação)
- `date-fns`, `recharts`, `embla-carousel-react`, `cmdk`, `vaul`,
  `input-otp`, `react-day-picker`, `react-resizable-panels`

**shadcn/ui (Radix primitives)**
`@radix-ui/react-*` — accordion, alert-dialog, aspect-ratio, avatar,
checkbox, collapsible, context-menu, dialog, dropdown-menu, hover-card,
label, menubar, navigation-menu, popover, progress, radio-group,
scroll-area, select, separator, slider, slot, switch, tabs, toast,
toggle, toggle-group, tooltip.

**Dev / Test**
- `eslint` ^9 + `typescript-eslint` + `eslint-plugin-react-hooks` +
  `eslint-plugin-react-refresh`
- `vitest` ^3 + `jsdom` + `@testing-library/react` +
  `@testing-library/jest-dom`
- `autoprefixer`, `postcss`
- `lovable-tagger`

### Proxy Local (`server/package.json`)

- `express` ^4.21
- `cors` ^2.8
- `dotenv` ^16.4

### Edge Function (Cloud)

- Deno runtime — **gerenciado pelo Lovable Cloud**, sem instalação manual.

---

## 🧪 Scripts úteis

| Comando                       | O que faz                              |
|-------------------------------|-----------------------------------------|
| `npm install`                 | Instala dependências do frontend       |
| `npm run dev`                 | Sobe o frontend em modo dev            |
| `npm run build`               | Build de produção                      |
| `npm run preview`             | Serve o build localmente               |
| `npm run lint`                | ESLint                                 |
| `npm test`                    | Testes (vitest)                        |
| `cd server && npm install`    | Instala dependências do proxy          |
| `cd server && npm start`      | Sobe o proxy local em `:3001`          |

---

## 🔐 Boas práticas de segurança

- **Sempre** defina usuário/senha na Web Interface do REAPER.
- Não exponha a porta `8080` diretamente na internet sem túnel + senha forte.
- Para acesso remoto, prefira VPN (Tailscale, WireGuard) ou Cloudflare Tunnel.

---

## 📄 Licença

Uso interno / projeto demonstrativo. Adapte como precisar.

---

**Dev. Zertec** — *Zertec Redes e Sistemas*
