export async function callAiProvider(env, { system, input, jsonSchema }) {
  const provider = (env.AI_PROVIDER || 'gemini').toLowerCase();
  if (provider === 'gemini') return callGemini(env, { system, input, jsonSchema });
  if (provider === 'deepseek') return callOpenAICompatible(env, {
    baseUrl: env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
    apiKey: env.DEEPSEEK_API_KEY,
    model: env.AI_MODEL || env.DEEPSEEK_MODEL || 'deepseek-v4-flash',
    system,
    input,
    jsonSchema,
  });
  if (provider === 'openai-compatible') return callOpenAICompatible(env, {
    baseUrl: env.OPENAI_COMPAT_BASE_URL,
    apiKey: env.OPENAI_COMPAT_API_KEY,
    model: env.AI_MODEL || env.OPENAI_COMPAT_MODEL,
    system,
    input,
    jsonSchema,
  });
  throw new Error(`unsupported_ai_provider:${provider}`);
}

async function callGemini(env, { system, input, jsonSchema }) {
  if (!env.GEMINI_API_KEY) throw new Error('missing_GEMINI_API_KEY');
  const model = env.AI_MODEL || env.GEMINI_MODEL || 'gemini-3.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`;
  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: [{ text: input }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      ...(jsonSchema ? { responseJsonSchema: jsonSchema } : {}),
    },
  };
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`gemini_http_${res.status}:${await res.text()}`);
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
  if (!text) throw new Error('gemini_empty_response');
  return JSON.parse(text);
}

async function callOpenAICompatible(env, { baseUrl, apiKey, model, system, input }) {
  if (!baseUrl || !apiKey || !model) throw new Error('incomplete_openai_compatible_config');
  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: input },
      ],
    }),
  });
  if (!res.ok) throw new Error(`openai_compatible_http_${res.status}:${await res.text()}`);
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error('openai_compatible_empty_response');
  return JSON.parse(text);
}
