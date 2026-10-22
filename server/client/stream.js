"use strict";
// Streams the LetsChat AI answer token by token (like Gemini and ChatGPT).
// Tries each provider whose API key is set, in this order: Gemini, OpenAI, Groq, xAI (Grok).
// Models can be changed with env vars: GEMINI_MODEL, OPENAI_MODEL, GROQ_MODEL, XAI_MODEL.
// If no provider streams, server.js falls back to the normal (non-streaming) AI path.

const OPENAI_COMPAT = (url, keyEnv, modelEnv, fallbackModel) => async (msgs, o) => {
  const body = { model: process.env[modelEnv] || fallbackModel, messages: msgs, temperature: o.temp, max_tokens: o.max, stream: true };
  const res = await post(url, body, o, { Authorization: "Bearer " + process.env[keyEnv] });
  return readSSE(res, (ev) => (ev.choices && ev.choices[0] && ev.choices[0].delta && ev.choices[0].delta.content) || "", o);
};

const geminiStream = async (msgs, o) => {
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const system = msgs.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const contents = msgs.filter((m) => m.role !== "system").map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
  const body = { contents, generationConfig: { temperature: o.temp, maxOutputTokens: o.max } };
  if (system) body.systemInstruction = { parts: [{ text: system }] };
  const url = "https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(model) + ":streamGenerateContent?alt=sse&key=" + encodeURIComponent(process.env.GEMINI_API_KEY);
  const res = await post(url, body, o, {});
  return readSSE(res, (ev) => {
    const parts = (ev.candidates && ev.candidates[0] && ev.candidates[0].content && ev.candidates[0].content.parts) || [];
    return parts.map((p) => p.text || "").join("");
  }, o);
};

const PROVIDERS = [
  { name: "gemini", key: "GEMINI_API_KEY", run: geminiStream },
  { name: "openai", key: "OPENAI_API_KEY", run: OPENAI_COMPAT("https://api.openai.com/v1/chat/completions", "OPENAI_API_KEY", "OPENAI_MODEL", "gpt-4o-mini") },
  { name: "groq", key: "GROQ_API_KEY", run: OPENAI_COMPAT("https://api.groq.com/openai/v1/chat/completions", "GROQ_API_KEY", "GROQ_MODEL", "llama-3.3-70b-versatile") },
  { name: "xai", key: "XAI_API_KEY", run: OPENAI_COMPAT("https://api.x.ai/v1/chat/completions", "XAI_API_KEY", "XAI_MODEL", "grok-3-mini") },
];

async function post(url, body, o, headers) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal: o.signal,
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error("HTTP " + res.status + " " + txt.slice(0, 160));
  }
  return res;
}

// Reads a server-sent-events body and passes every token to onToken as it arrives.
// If the user stops (abort) after some text has arrived, the partial text is returned, not thrown away.
async function readSSE(res, pick, o) {
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "", full = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (!data || data === "[DONE]") continue;
        let ev;
        try { ev = JSON.parse(data); } catch (e) { continue; } // a half-received line: ignore it
        const text = pick(ev);
        if (text) { full += text; o.onToken(text); }
      }
    }
    return full;
  } catch (e) {
    if (o.signal && o.signal.aborted && full) return full; // stopped by the user: keep what was written
    throw e;
  }
}

// messages: [{ role: "system" | "user" | "assistant", content }]
// returns { text, by } or null when no provider could stream an answer
async function streamChat(messages, opts = {}) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), opts.timeout || 60000);
  if (opts.signal) {
    if (opts.signal.aborted) ctl.abort();
    else opts.signal.addEventListener("abort", () => ctl.abort(), { once: true });
  }
  const o = {
    signal: ctl.signal,
    onToken: typeof opts.onToken === "function" ? opts.onToken : () => {},
    temp: typeof opts.temp === "number" ? opts.temp : 0.7,
    max: opts.max || 2000,
  };
  try {
    for (const p of PROVIDERS) {
      if (!process.env[p.key]) continue;
      if (ctl.signal.aborted) break;
      try {
        const text = await p.run(messages, o);
        if (text && text.trim()) return { text: text.trim(), by: p.name };
      } catch (e) {
        console.error("ai stream: " + p.name + " failed (" + (e && e.message) + ")");
      }
    }
    return null;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { streamChat, PROVIDERS };
