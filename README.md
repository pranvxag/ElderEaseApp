# ElderEase App

Lightweight mobile app for elder care: medication reminders, scan & parse prescriptions, upload lab reports, and an AI-assisted voice call flow for capturing blood sugar readings.

Release note: updates applied Apr 27, 2026 — switched the AI call flow to Groq through the local server proxy, kept Google Speech APIs for STT/TTS, and improved retry/backoff behavior.

---


29/04
v5.0.0  

## Recent Updates

### Firebase Firestore Fix
- Fixed "Unsupported field value: undefined" error when writing to Firestore
- Added cleanForFirestore() utility in lib/firebase.ts that strips undefined 
  fields before any Firestore write
- Applied cleanForFirestore() across all write helpers in the codebase
- Affected path: users/{uid}/profile/data




**Quick summary of changes (Apr 27, 2026)**
- **Server proxy**: Added a local Express proxy at `/server` which forwards AI calls to Groq and speech calls to Google Text-to-Speech and Speech-to-Text APIs. See [server/index.js](server/index.js).
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

- **Groq**
  - Purpose: AI agent generation (used by AI call flow)
  - Server env var: `EXPO_PUBLIC_GROQ_API_KEY`
  - Optional server env var: `GROQ_MODEL` (defaults to `llama-3.1-8b-instant`)
  - Proxy endpoint: `POST /api/groq` (implemented in [server/index.js](server/index.js))

- **Google Text-to-Speech (Cloud TTS)**
  - Purpose: Generate MP3 audio for voice calls
  - Server env var: `EXPO_PUBLIC_GOOGLE_SPEECH_API_KEY`
  - Proxy endpoint: `POST /api/tts` (implemented in [server/index.js](server/index.js))

- **Google Speech-to-Text (Cloud STT)**
  - Purpose: Transcribe user audio during calls
  - Server env var: `EXPO_PUBLIC_GOOGLE_SPEECH_API_KEY` (same key as TTS can be used if enabled)
  - Proxy endpoint: `POST /api/stt` (implemented in [server/index.js](server/index.js))

- **Firebase / Google Services (optional)**
  - Purpose: auth + cloud sync
  - Client env vars (used elsewhere in project): `EXPO_PUBLIC_FIREBASE_*` (see previous README section for full list)
  - Android config: `android/google-services.json` contains an API key entry under `current_key` — **do not publish** this file with keys in public repos; rotate if necessary.

Client-side configuration:

- `EXPO_PUBLIC_API_PROXY_URL` — URL the client will use to reach the server proxy (e.g. `http://localhost:3000`). Set this in your Expo environment or CI config. The client now uses this value from `process.env.EXPO_PUBLIC_API_PROXY_URL`.

Notes:
- Do NOT put these keys into `EXPO_PUBLIC_...` variables unless you intentionally want them exposed to the Expo client bundle. The proxy is still used so the app can run consistently across devices.

---

**How to run the proxy locally**

From the project root:

PowerShell
```powershell
cd server
npm install
$env:EXPO_PUBLIC_GROQ_API_KEY="your_server_groq_key"
$env:EXPO_PUBLIC_GOOGLE_SPEECH_API_KEY="your_server_speech_key"
npm start
```

bash
```bash
cd server
npm install
EXPO_PUBLIC_GROQ_API_KEY=your_server_groq_key EXPO_PUBLIC_GOOGLE_SPEECH_API_KEY=your_server_speech_key npm start
```

Health check: `GET http://localhost:3000/health` should return `{ "status": "ok" }`.

Quick proxy test (no real keys required for the health check; real keys needed for `/api/groq`):

```bash
curl -i http://localhost:3000/health

# example Groq forward test (you'll get a 4xx/401 if key is invalid)
curl -i -X POST http://localhost:3000/api/groq \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"hello"}],"max_tokens":10}'
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

**Firestore cloud sync check (if local data works but cloud does not)**

1. In Firebase Console, verify project `elderease-pranvxag` exists and Firestore Database is created.
2. Ensure Firestore API is enabled for the Google Cloud project.
3. Confirm app env vars are from the same Firebase project (`EXPO_PUBLIC_FIREBASE_PROJECT_ID`, `EXPO_PUBLIC_FIREBASE_API_KEY`, etc.).
4. If Firestore is unavailable, ElderEase will continue using local AsyncStorage and disable cloud sync for the current run.

---

**Files changed in this update**

- [app/(tabs)/ai-call.tsx](app/(tabs)/ai-call.tsx) — switched client to use proxy and improved backoff logic.
- [server/index.js](server/index.js) — Express proxy implementing `/api/groq`, `/api/tts`, `/api/stt`, plus `/health`.
- [server/package.json](server/package.json) — server dependencies and `npm start` script.
- [android/google-services.json](android/google-services.json) — contains `current_key` entry (rotate if exposed).

---

**Security & best practices**

- Keep `EXPO_PUBLIC_GROQ_API_KEY` and `EXPO_PUBLIC_GOOGLE_SPEECH_API_KEY` in the environment used by the proxy and Expo app.
- Do not commit `android/google-services.json` with real keys to public repos; use CI secrets / env vars for builds.
- Use a rate-limiter / quota aware logic on the server if you expect many concurrent requests.

---

If you'd like, I can:

- add a `/server/.env.example` file showing the three env vars, or
- add a short `server/README.md` with deployment notes and how to set secrets in popular hosts.

---

Thank you — open an issue or ask for follow-ups if you want the `.env.example` or CI deploy steps added.
