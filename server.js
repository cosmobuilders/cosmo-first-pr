require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Claude (Anthropic) ──────────────────────────────────────────────────────
async function askClaude(message, model) {
  const Anthropic = require('@anthropic-ai/sdk');
  const client = new Anthropic.default({ apiKey: process.env.ANTHROPIC_API_KEY });
  const res = await client.messages.create({
    model: model || 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{ role: 'user', content: message }],
  });
  return res.content[0].text;
}

// ── OpenAI (GPT) ────────────────────────────────────────────────────────────
async function askOpenAI(message, model) {
  const OpenAI = require('openai');
  const client = new OpenAI.default({ apiKey: process.env.OPENAI_API_KEY });
  const res = await client.chat.completions.create({
    model: model || 'gpt-4o-mini',
    messages: [{ role: 'user', content: message }],
  });
  return res.choices[0].message.content;
}

// ── Google Gemini ───────────────────────────────────────────────────────────
async function askGemini(message, model) {
  const fetch = (await import('node-fetch')).default;
  const key = process.env.GEMINI_API_KEY;
  const m = model || 'gemini-1.5-flash';
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: message }] }] }),
    }
  );
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.candidates[0].content.parts[0].text;
}

// ── Groq (Llama / Mixtral) ──────────────────────────────────────────────────
async function askGroq(message, model) {
  const fetch = (await import('node-fetch')).default;
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: model || 'llama3-70b-8192',
      messages: [{ role: 'user', content: message }],
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.choices[0].message.content;
}

// ── Router ──────────────────────────────────────────────────────────────────
const providers = { claude: askClaude, openai: askOpenAI, gemini: askGemini, groq: askGroq };

app.post('/api/chat', async (req, res) => {
  const { provider, model, message } = req.body;
  if (!message) return res.status(400).json({ error: 'message is required' });
  const fn = providers[provider];
  if (!fn) return res.status(400).json({ error: `Unknown provider: ${provider}` });
  try {
    const reply = await fn(message, model);
    res.json({ reply });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/providers', (_req, res) => {
  res.json([
    {
      id: 'claude', name: 'Claude (Anthropic)',
      models: ['claude-opus-4-8', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'],
      envKey: 'ANTHROPIC_API_KEY',
    },
    {
      id: 'openai', name: 'GPT (OpenAI)',
      models: ['gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo'],
      envKey: 'OPENAI_API_KEY',
    },
    {
      id: 'gemini', name: 'Gemini (Google)',
      models: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-2.0-flash'],
      envKey: 'GEMINI_API_KEY',
    },
    {
      id: 'groq', name: 'Groq (Llama / Mixtral)',
      models: ['llama3-70b-8192', 'llama3-8b-8192', 'mixtral-8x7b-32768'],
      envKey: 'GROQ_API_KEY',
    },
  ]);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`CosmoAI Hub running → http://localhost:${PORT}`));
