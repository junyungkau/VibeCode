// api/summarize.js — 3줄 요약기 서버리스 함수
// NVIDIA API 키는 여기서만 사용됩니다. Vercel 환경변수 NVIDIA_API_KEY 필요.

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST만 허용됩니다.' });

  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) return res.status(500).json({ error: '서버에 NVIDIA_API_KEY가 없습니다.' });

  const { text } = req.body || {};
  if (!text || text.length < 50) return res.status(400).json({ error: '요약할 글이 너무 짧습니다.' });

  const systemPrompt = `너는 한국어 요약 전문가다. 주어진 글을 정확히 3줄로 요약한다.

규칙:
- 각 줄은 한 문장, 40자 이내로 간결하게
- 글에 없는 내용을 추가하지 않는다
- 핵심 키워드 3~5개를 함께 뽑는다

반드시 아래 JSON으로만 응답 (다른 텍스트, 마크다운 금지):
{"lines": ["첫째 줄", "둘째 줄", "셋째 줄"], "keywords": ["키워드1", "키워드2", "키워드3"]}`;

  try {
    const r = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'deepseek-ai/deepseek-v4-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text.slice(0, 6000) }
        ],
        temperature: 0.3,
        max_tokens: 500,
        stream: false
      })
    });
    if (!r.ok) {
      console.error('NVIDIA API error:', r.status, await r.text());
      return res.status(502).json({ error: 'AI 호출 실패' });
    }
    const data = await r.json();
    const parsed = extractJson(data?.choices?.[0]?.message?.content || '');
    if (!parsed || !Array.isArray(parsed.lines)) return res.status(502).json({ error: 'AI 응답 해석 실패' });
    return res.status(200).json(parsed);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: '서버 오류' });
  }
}

function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const c = fenced ? fenced[1] : text;
  const s = c.indexOf('{'), e = c.lastIndexOf('}');
  if (s === -1 || e === -1) return null;
  try { return JSON.parse(c.slice(s, e + 1)); } catch { return null; }
}
