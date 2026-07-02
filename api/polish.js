// api/polish.js — 공손 번역기 서버리스 함수
// NVIDIA API 키는 여기서만 사용됩니다. Vercel 환경변수 NVIDIA_API_KEY 필요.

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST만 허용됩니다.' });

  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) return res.status(500).json({ error: '서버에 NVIDIA_API_KEY가 없습니다.' });

  const { raw, situation } = req.body || {};
  if (!raw) return res.status(400).json({ error: '변환할 내용이 없습니다.' });

  const systemPrompt = `너는 한국 대학생의 이메일을 다듬어주는 전문가다.
학생이 막 적은 말을, 교수님께 보내기에 적절한 정중하고 간결한 이메일로 변환한다.

규칙:
- 과도하게 비굴하지 않게, 담백하고 예의 바르게
- 핵심 용건이 앞에 오도록
- 학생이 쓴 사실관계를 지어내거나 과장하지 않는다 (없는 병명, 없는 사유 추가 금지)
- 인사말 - 소속/이름 소개 - 용건 - 맺음말 구조
- 소속/이름은 [학과]와 [이름] 플레이스홀더로 남긴다

반드시 아래 JSON으로만 응답 (다른 텍스트, 마크다운 금지):
{"subject": "메일 제목", "body": "메일 본문 전체"}`;

  const userPrompt = `상황: ${situation || '내용으로 판단'}
학생이 하고 싶은 말: ${raw}`;

  try {
    const r = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'deepseek-ai/deepseek-v4-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.6,
        max_tokens: 700,
        stream: false
      })
    });
    if (!r.ok) {
      console.error('NVIDIA API error:', r.status, await r.text());
      return res.status(502).json({ error: 'AI 호출 실패' });
    }
    const data = await r.json();
    const parsed = extractJson(data?.choices?.[0]?.message?.content || '');
    if (!parsed) return res.status(502).json({ error: 'AI 응답 해석 실패' });
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
