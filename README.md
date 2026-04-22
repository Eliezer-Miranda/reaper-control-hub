# REAPER Remote Control — Web Interface

Controle remoto web para o **REAPER DAW**, comunicando-se com a *Web browser interface* nativa do REAPER via HTTP.

Inclui **dois modos de proxy** (necessário para contornar a falta de CORS no REAPER):

1. **Local (Express)** — recomendado para uso em LAN. Você roda `server/server.js` na mesma máquina (ou outra na rede) e o frontend fala com ele.
2. **Cloud (edge function Lovable)** — útil quando o REAPER está acessível pela internet (port forwarding, ngrok, Tailscale Funnel).

---

## 1. Ativar a Web Interface no REAPER

1. Abra o REAPER → **Options** → **Preferences**.
2. No menu lateral, vá em **Control/OSC/web → Control Surfaces**.
3. Clique em **Add** e selecione **"Web browser interface"**.
4. Defina:
   - **Port** (padrão `8080`)
   - **Access control username/password** (opcional, mas recomendado)
5. Clique **OK** e reinicie o REAPER.
6. **Libere a porta no firewall** do sistema operacional.

Teste no navegador: `http://IP_DA_MAQUINA:8080/` — você deve ver a interface web nativa.

## 2. Rodar o frontend

```bash
npm install
npm run dev
```

## 3. Rodar o proxy local (modo recomendado)

```bash
cd server
cp .env.example .env       # opcional
npm install
npm start
```

O proxy escuta em `http://localhost:3001` por padrão.

No app, abra **Conexão**, escolha **Local**, defina IP/porta do REAPER e clique **Conectar**.

### Acessar de outro dispositivo na rede

1. Descubra o IP da máquina (ex.: `192.168.1.20`).
2. Em outro dispositivo abra `http://192.168.1.20:5173`.
3. Configure a URL do proxy para `http://192.168.1.20:3001`.

## 4. Modo Cloud

Use quando o REAPER está atrás de um túnel público. Não funciona com IPs privados (192.168.x.x).

---

## 5. Funcionalidades

- Transport completo (Play/Stop/Record, navegação, loop, metrônomo, BPM ao vivo)
- Mixer com volume (dB), pan, mute/solo/rec-arm, VU simulado
- Lista de faixas com seleção, criar e excluir
- Ações rápidas + customizáveis por ID
- Status bar e console de log com últimas 20 requisições
- Reconexão automática a cada 5s
- Configuração persistida no localStorage

## 6. IDs de ação úteis

| ID    | Ação                  |
|-------|-----------------------|
| 1007  | Play                  |
| 1008  | Pause                 |
| 1013  | Record                |
| 1016  | Stop                  |
| 1068  | Toggle Loop           |
| 40001 | New track             |
| 40015 | Render project        |
| 40025 | Open project          |
| 40026 | Save project          |
| 40029 | Undo                  |
| 40030 | Redo                  |
| 40042 | Go to start           |
| 40364 | Toggle metronome      |

## 7. Troubleshooting

- **REAPER offline**: cheque IP/porta, firewall e se REAPER está aberto.
- **HTTP 401**: senha incorreta nas Preferences → Control Surfaces.
- **CORS error**: use modo Local com `server/` rodando, ou modo Cloud.
- **Polling falha**: REAPER pode demorar; timeout do proxy é 3s.

## 8. Stack

- React 18 + TypeScript + Vite + Tailwind + shadcn/ui
- Express 4 + dotenv (proxy local)
- Lovable Cloud edge function (proxy remoto)
