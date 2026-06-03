// SIGNTAXERA — AI Proxy (Netlify Function)
// Mendukung DeepSeek API (prioritas) dan Anthropic Claude (fallback)
//
// Setup di Netlify Dashboard → Site Settings → Environment Variables:
//   DEEPSEEK_API_KEY   → dari platform.deepseek.com  (prioritas utama)
//   ANTHROPIC_API_KEY  → dari console.anthropic.com  (opsional, fallback)

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  // Auto-detect which API key is available (DeepSeek prioritas)
  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!deepseekKey && !anthropicKey) {
    return {
      statusCode: 500, headers,
      body: JSON.stringify({
        error: 'API Key belum dikonfigurasi. Set DEEPSEEK_API_KEY atau ANTHROPIC_API_KEY di Netlify Environment Variables.'
      })
    };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  const { messages, system, max_tokens = 512 } = body;

  if (!messages || !Array.isArray(messages)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'messages harus berupa array' }) };
  }

  if (max_tokens > 1024) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'max_tokens maksimal 1024' }) };
  }

  // ── DeepSeek (OpenAI-compatible format) ──────────────────────────────────
  if (deepseekKey) {
    // Gabungkan system prompt ke dalam messages array (format OpenAI)
    const fullMessages = system
      ? [{ role: 'system', content: system }, ...messages]
      : messages;

    const payload = {
      model: 'deepseek-chat',
      max_tokens,
      messages: fullMessages,
      temperature: 0.7,
    };

    try {
      const response = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + deepseekKey,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      // Normalisasi response ke format yang sama dengan Anthropic
      // agar frontend tidak perlu tahu provider mana yang dipakai
      if (data.choices && data.choices[0] && data.choices[0].message) {
        const normalized = {
          content: [{ type: 'text', text: data.choices[0].message.content }],
          model: data.model,
          provider: 'deepseek',
        };
        return { statusCode: 200, headers, body: JSON.stringify(normalized) };
      }

      // Jika ada error dari DeepSeek
      return {
        statusCode: response.status, headers,
        body: JSON.stringify({ error: data.error?.message || 'DeepSeek API error', raw: data })
      };

    } catch (err) {
      return {
        statusCode: 502, headers,
        body: JSON.stringify({ error: 'Gagal menghubungi DeepSeek API: ' + err.message })
      };
    }
  }

  // ── Anthropic Claude (fallback) ───────────────────────────────────────────
  const payload = { model: 'claude-haiku-4-5-20251001', max_tokens, messages };
  if (system) payload.system = system;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    return { statusCode: response.status, headers, body: JSON.stringify(data) };
  } catch (err) {
    return {
      statusCode: 502, headers,
      body: JSON.stringify({ error: 'Gagal menghubungi Claude API: ' + err.message })
    };
  }
};
