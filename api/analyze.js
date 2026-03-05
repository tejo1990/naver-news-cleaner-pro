/**
 * Gemini AI News Analysis Proxy (Vercel Serverless Function)
 * 
 * 이 파일은 사장님의 API 키를 서버 쪽에 안전하게 보관하고,
 * 클라이언트(확장 프로그램)의 요청을 대신 전달하는 중계기 역할을 합니다.
 */

export default async function handler(req, res) {
    // CORS 설정 (확장 프로그램에서 접근 가능하도록)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // OPTIONS 요청 (Preflight) 대응
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // POST 요청만 허용
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { title, content } = req.body;
    const API_KEY = process.env.GEMINI_API_KEY;

    if (!API_KEY) {
        return res.status(500).json({ error: '서버에 API 키가 설정되지 않았습니다. (GEMINI_API_KEY 환경변수 확인 필요)' });
    }

    const MODEL_ID = 'gemini-2.5-flash';
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_ID}:generateContent?key=${API_KEY}`;

    const prompt = `
당신은 베테랑 언론인이며 중립적인 기사 분석가입니다. 
다음 뉴스 기사의 제목과 본문(일부)을 분석하여 아래 형식의 JSON으로만 응답하세요. 다른 설명은 생략하세요.

[기사 제목]: ${title}
[기사 본문]: ${content}

응답 형식 (JSON):
{
  "objectivity_score": 0~100 (객관성 점수),
  "bias_rating": "매우 중립" | "중립" | "약간 편향" | "편향" | "매우 편향",
  "bias_direction": "좌편향" | "우편향" | "상업적" | "해당없음",
  "fact_check": "기사에서 근거가 부족하거나 검증이 필요한 부분 (짧게)",
  "summary": "한 줄 요약",
  "verdict": "이 기사를 신뢰할 수 있는지에 대한 짧은 의견"
}
`;

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.1,
                    response_mime_type: "application/json"
                }
            })
        });

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json(data);
        }

        // Gemini API 응답에서 분석 결과 텍스트만 추출하여 전달
        const resultText = data.candidates[0].content.parts[0].text;
        res.status(200).json(JSON.parse(resultText));

    } catch (error) {
        console.error('Proxy Server Error:', error);
        res.status(500).json({ error: '분석 요청 처리 중 서버 오류가 발생했습니다.' });
    }
}
