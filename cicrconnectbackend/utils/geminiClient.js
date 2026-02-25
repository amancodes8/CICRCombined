const GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
];

const geminiGenerate = async (prompt) => {
  if (!process.env.GEMINI_API_KEY) {
    return { ok: false, status: 500, error: 'GEMINI_API_KEY is not configured on backend.' };
  }

  let lastError = null;

  for (const model of GEMINI_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      });

      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (text) return { ok: true, model, text };
        lastError = { status: 502, message: 'Gemini returned an empty response.' };
        continue;
      }

      const apiMessage = data?.error?.message || `Gemini request failed with status ${response.status}`;
      lastError = { status: response.status, message: apiMessage };
    } catch (err) {
      lastError = { status: 500, message: err.message || 'Gemini request failed.' };
    }
  }

  return {
    ok: false,
    status: lastError?.status || 500,
    error: lastError?.message || 'All Gemini model attempts failed.',
  };
};

module.exports = { geminiGenerate };
