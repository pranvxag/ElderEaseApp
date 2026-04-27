const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));

// Simple health endpoint for local checks
app.get('/health', (req, res) => res.json({ status: 'ok' }));

const GROQ_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY;
const SPEECH_KEY = process.env.EXPO_PUBLIC_GOOGLE_SPEECH_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function proxyWithRetries(baseUrl, opts, providerName, key) {
  let backoff = 2000;
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const target = key ? `${baseUrl}?key=${key}` : baseUrl;
    const res = await fetch(target, opts);
    if (res.status === 429 && attempt < maxAttempts) {
      console.warn(`${providerName} received 429, retrying in ${backoff}ms (attempt ${attempt})`);
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

function toGroqMessages(body) {
  if (Array.isArray(body?.messages)) {
    return body.messages;
  }

  const messages = [];
  const systemText = body?.system_instruction?.parts?.[0]?.text;
  if (systemText) {
    messages.push({ role: 'system', content: systemText });
  }

  for (const item of body?.contents ?? []) {
    const text = item?.parts?.map((part) => part?.text ?? '').filter(Boolean).join('\n').trim();
    if (!text) continue;
    messages.push({
      role: item.role === 'model' ? 'assistant' : 'user',
      content: text,
    });
  }

  return messages;
}

async function handleGroqProxy(req, res) {
  if (!GROQ_KEY) return res.status(500).json({ error: 'Server missing EXPO_PUBLIC_GROQ_API_KEY' });
  try {
    const url = 'https://api.groq.com/openai/v1/chat/completions';
    const body = req.body || {};
    const payload = {
      model: body.model || GROQ_MODEL,
      messages: toGroqMessages(body),
      temperature: body.temperature ?? 0.7,
      max_tokens: body.max_tokens ?? 300,
    };
    const opts = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GROQ_KEY}`,
      },
      body: JSON.stringify(payload),
    };
    const result = await proxyWithRetries(url, opts, 'Groq', null);
    return res.status(result.status).json(result.body);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: String(err) });
  }
}

app.post('/api/groq', handleGroqProxy);
app.post('/api/gemini', handleGroqProxy);

app.post('/api/tts', async (req, res) => {
  if (!SPEECH_KEY) return res.status(500).json({ error: 'Server missing EXPO_PUBLIC_GOOGLE_SPEECH_API_KEY' });
  try {
    const url = 'https://texttospeech.googleapis.com/v1/text:synthesize';
    const opts = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(req.body) };
    const result = await proxyWithRetries(url, opts, 'TTS', SPEECH_KEY);
    return res.status(result.status).json(result.body);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: String(err) });
  }
});

app.post('/api/stt', async (req, res) => {
  if (!SPEECH_KEY) return res.status(500).json({ error: 'Server missing EXPO_PUBLIC_GOOGLE_SPEECH_API_KEY' });
  try {
    const url = 'https://speech.googleapis.com/v1/speech:recognize';
    const opts = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(req.body) };
    const result = await proxyWithRetries(url, opts, 'STT', SPEECH_KEY);
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
