const GEMINI_MODEL = 'gemini-2.5-flash';

const geminiGenerate = async (prompt) => {
  if (!process.env.GEMINI_API_KEY) {
    return { ok: false, status: 500, error: 'GEMINI_API_KEY is not configured on backend.' };
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    });

    const data = await response.json().catch(() => ({}));
    if (response.ok) {
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (text) return { ok: true, model: GEMINI_MODEL, text };
      return { ok: false, status: 502, error: 'Gemini returned an empty response.' };
    }

    const apiMessage = data?.error?.message || `Gemini request failed with status ${response.status}`;
    return { ok: false, status: response.status, error: apiMessage };
  } catch (err) {
    return { ok: false, status: 500, error: err.message || 'Gemini request failed.' };
  }
};

module.exports = { geminiGenerate };
