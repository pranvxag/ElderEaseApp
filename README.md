# ElderEase App

Lightweight mobile app for elder care: medication reminders, scan & parse prescriptions, upload lab reports, and an AI-assisted voice call flow for capturing blood sugar readings.

Release note: updates applied Apr 26, 2026 — added a small server proxy to avoid embedding Google API keys in client builds, updated the AI call flow to use that proxy, and improved retry/backoff behavior.

---

**Quick summary of changes (Apr 26, 2026)**
- **Server proxy**: Added a local Express proxy at `/server` which forward calls to Google Gemini (Generative Language), Text-to-Speech and Speech-to-Text APIs. See [server/index.js](server/index.js).
- **Client updates**: `app/(tabs)/ai-call.tsx` now calls the proxy (`EXPO_PUBLIC_API_PROXY_URL`) instead of embedding API keys. See [app/(tabs)/ai-call.tsx](app/(tabs)/ai-call.tsx).
- **Retry/backoff**: Increased initial backoff and added server-side retries for 429 responses.
- **Security**: Removed client-side usage of public API keys (store real keys on server only). Rotate any keys exposed in `android/google-services.json` (see [android/google-services.json](android/google-services.json)).

---

**Project structure (high level)**

Root layout (important files & folders):

```
app/
  (tabs)/
    ai-call.tsx            # AI call flow (updated to use proxy)
    ...
  onboarding.tsx
  index.tsx
components/
lib/
hooks/
android/
  google-services.json    # contains firebase / google config (rotate if exposed)
ios/
server/                   # New: small Express proxy for Google APIs
  index.js
  package.json
README.md
package.json
```

Refer to the app folder for the full file-based routing layout.

---

**APIs required (no real keys included)**

Add the following API credentials to your *server-side* environment (never in client/public env):

- **Google Generative Language (Gemini)**
  - Purpose: AI agent generation (used by AI call flow)
  - Server env var: `GEMINI_API_KEY`
  - Proxy endpoint: `POST /api/gemini` (implemented in [server/index.js](server/index.js))

- **Google Text-to-Speech (Cloud TTS)**
  - Purpose: Generate MP3 audio for voice calls
  - Server env var: `SPEECH_API_KEY`
  - Proxy endpoint: `POST /api/tts` (implemented in [server/index.js](server/index.js))

- **Google Speech-to-Text (Cloud STT)**
  - Purpose: Transcribe user audio during calls
  - Server env var: `SPEECH_API_KEY` (same key as TTS can be used if enabled)
  - Proxy endpoint: `POST /api/stt` (implemented in [server/index.js](server/index.js))

- **Firebase / Google Services (optional)**
  - Purpose: auth + cloud sync
  - Client env vars (used elsewhere in project): `EXPO_PUBLIC_FIREBASE_*` (see previous README section for full list)
  - Android config: `android/google-services.json` contains an API key entry under `current_key` — **do not publish** this file with keys in public repos; rotate if necessary.

Client-side configuration:

- `EXPO_PUBLIC_API_PROXY_URL` — URL the client will use to reach the server proxy (e.g. `http://localhost:3000`). Set this in your Expo environment or CI config. The client now uses this value from `process.env.EXPO_PUBLIC_API_PROXY_URL`.

Notes:
- Do NOT put `GEMINI_API_KEY` or `SPEECH_API_KEY` into `EXPO_PUBLIC_...` variables or commit them to source. The proxy is deliberately used so client bundles never contain secrets.

---

**How to run the proxy locally**

From the project root:

PowerShell
```powershell
cd server
npm install
$env:GEMINI_API_KEY="your_server_gemini_key"
$env:SPEECH_API_KEY="your_server_speech_key"
npm start
```

bash
```bash
cd server
npm install
GEMINI_API_KEY=your_server_gemini_key SPEECH_API_KEY=your_server_speech_key npm start
```

Health check: `GET http://localhost:3000/health` should return `{ "status": "ok" }`.

Quick proxy test (no real keys required for the health check; real keys needed for `/api/gemini`):

```bash
curl -i http://localhost:3000/health

# example Gemini forward test (you'll get a 4xx/403 if key is invalid)
curl -i -X POST http://localhost:3000/api/gemini \
  -H "Content-Type: application/json" \
  -d '{"system_instruction":{"parts":[{"text":"hello"}]},"contents":[],"generationConfig":{"maxOutputTokens":10}}'
```

---

**Client setup (Expo)**

1. Set `EXPO_PUBLIC_API_PROXY_URL` in your environment or CI (for local dev you can leave it as `http://localhost:3000`).
2. Remove any `EXPO_PUBLIC_GEMINI_API_KEY` and `EXPO_PUBLIC_GOOGLE_SPEECH_API_KEY` entries from client envs — move keys to server.
3. Start Expo as usual:

```bash
npx expo start
```

---

**Files changed in this update**

- [app/(tabs)/ai-call.tsx](app/(tabs)/ai-call.tsx) — switched client to use proxy and improved backoff logic.
- [server/index.js](server/index.js) — new Express proxy implementing `/api/gemini`, `/api/tts`, `/api/stt`, plus `/health`.
- [server/package.json](server/package.json) — server dependencies and `npm start` script.
- [android/google-services.json](android/google-services.json) — contains `current_key` entry (rotate if exposed).

---

**Security & best practices**

- Keep `GEMINI_API_KEY` and `SPEECH_API_KEY` only on the server or in a cloud secret manager.
- Do not commit `android/google-services.json` with real keys to public repos; use CI secrets / env vars for builds.
- Use a rate-limiter / quota aware logic on the server if you expect many concurrent requests.

---

If you'd like, I can:

- add a `/server/.env.example` file showing the three env vars, or
- add a short `server/README.md` with deployment notes and how to set secrets in popular hosts.

---

Thank you — open an issue or ask for follow-ups if you want the `.env.example` or CI deploy steps added.
