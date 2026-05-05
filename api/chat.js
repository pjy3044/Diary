/**
 * api/chat.js - Vercel 서버리스 함수 (CommonJS 방식)
 *
 * ⚠️ 주의: Vercel은 package.json에 "type":"module"이 없으면
 *          .js 파일을 CommonJS로 처리합니다.
 *          그래서 export default 대신 module.exports 를 사용합니다.
 */

module.exports = async function handler(req, res) {

    // CORS 헤더 설정: 브라우저에서 이 API를 호출할 수 있게 허용
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // 브라우저가 사전 요청(preflight)을 보낼 때 처리
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // POST 요청만 허용
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // 요청 본문에서 일기 내용 추출
    const { diaryContent } = req.body;

    if (!diaryContent || diaryContent.trim().length === 0) {
        return res.status(400).json({ error: '일기 내용이 없습니다.' });
    }

    // Vercel 환경 변수에서 API 키 가져오기
    // Vercel 대시보드 > Settings > Environment Variables 에서 설정
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        console.error('GEMINI_API_KEY 환경 변수가 설정되지 않았습니다.');
        return res.status(500).json({ error: 'API 키가 설정되지 않았습니다.' });
    }

    // ─────────────────────────────────────────
    // Gemini에게 보낼 프롬프트
    // JSON 형식으로 답하게 해서 파싱을 안정적으로 만듦
    // ─────────────────────────────────────────
    const prompt = `
다음은 학생이 오늘 쓴 감정 일기입니다:
"${diaryContent}"

위 일기를 읽고, 반드시 아래 JSON 형식으로만 답변하세요.
마크다운 코드블록(\`\`\`json)이나 다른 텍스트는 절대 포함하지 마세요.

{
  "emotion": "오늘의 감정을 가장 잘 나타내는 단어 딱 하나 (예: 불안, 설렘, 외로움, 뿌듯함)",
  "counseling": "학생에게 전하는 따뜻한 공감 메시지. 반드시 2~3문장 이내. 존댓말 사용. 감정을 인정하고 위로하는 내용.",
  "tags": ["#태그1", "#태그2"]
}`;

    try {
        // Gemini 2.0 Flash 모델 호출
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.7,   // 창의성 조절 (0=일관적, 1=창의적)
                        maxOutputTokens: 300 // 응답 최대 길이 제한
                    }
                })
            }
        );

        // HTTP 오류 상태 코드 처리
        if (!response.ok) {
            const errBody = await response.text();
            console.error('Gemini API 응답 오류:', response.status, errBody);
            throw new Error(`Gemini API 오류: ${response.status}`);
        }

        const data = await response.json();

        // 응답 텍스트 추출
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!rawText) {
            throw new Error('Gemini로부터 유효한 응답을 받지 못했습니다.');
        }

        // Gemini가 가끔 ```json ... ``` 블록으로 감싸는 경우를 제거
        const cleanText = rawText.replace(/```json|```/g, '').trim();

        // JSON 파싱
        const parsed = JSON.parse(cleanText);

        return res.status(200).json({
            emotion:    parsed.emotion    || '복잡한 감정',
            counseling: parsed.counseling || '오늘도 수고 많았어요.',
            tags:       parsed.tags       || ['#공감해요'],
        });

    } catch (err) {
        console.error('서버 오류 상세:', err.message);
        return res.status(500).json({
            error:  'AI 상담사 응답 처리 중 오류가 발생했습니다.',
            detail: err.message
        });
    }
};
