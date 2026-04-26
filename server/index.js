require('dotenv').config();  // ← Add this as first line
// rest of code...
const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));

// Simple health endpoint for local checks
app.get('/health', (req, res) => res.json({ status: 'ok' }));

const GEMINI_KEY = process.env.GEMINI_API_KEY;
const SPEECH_KEY = process.env.SPEECH_API_KEY;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function proxyWithRetries(baseUrl, opts, key) {
  let backoff = 2000;
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const target = `${baseUrl}?key=${key}`;
    const res = await fetch(target, opts);
    if (res.status === 429 && attempt < maxAttempts) {
      console.warn(`Proxy received 429, retrying in ${backoff}ms (attempt ${attempt})`);
      await sleep(backoff);
      backoff *= 2;
      continue;
    }

    const text = await res.text();
    try {
      const json = JSON.parse(text);
      return { status: res.status, body: json };
    } catch (e) {
      return { status: res.status, body: { raw: text } };
    }
  }

  return { status: 429, body: { error: 'Rate limit exceeded after retries' } };
}

app.post('/api/gemini', async (req, res) => {
  if (!GEMINI_KEY) return res.status(500).json({ error: 'Server missing GEMINI_API_KEY' });
  try {
    const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
    const opts = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(req.body) };
    const result = await proxyWithRetries(url, opts, GEMINI_KEY);
    return res.status(result.status).json(result.body);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: String(err) });
  }
});

app.post('/api/tts', async (req, res) => {
  if (!SPEECH_KEY) return res.status(500).json({ error: 'Server missing SPEECH_API_KEY' });
  try {
    const url = 'https://texttospeech.googleapis.com/v1/text:synthesize';
    const opts = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(req.body) };
    const result = await proxyWithRetries(url, opts, SPEECH_KEY);
    return res.status(result.status).json(result.body);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: String(err) });
  }
});

app.post('/api/stt', async (req, res) => {
  if (!SPEECH_KEY) return res.status(500).json({ error: 'Server missing SPEECH_API_KEY' });
  try {
    const url = 'https://speech.googleapis.com/v1/speech:recognize';
    const opts = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(req.body) };
    const result = await proxyWithRetries(url, opts, SPEECH_KEY);
    return res.status(result.status).json(result.body);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: String(err) });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`ElderEase API proxy listening on port ${port}`);
});
