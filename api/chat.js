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
    const prompt = `학생의 감정일기: "${diaryContent}"

반드시 아래 JSON만 출력. 코드블록, 설명, 마크다운 절대 금지.
{"emotion":"감정한단어","counseling":"따뜻한공감2~3문장존댓말","tags":["#태그1","#태그2"]}`;

    try {
        // Gemini 2.0 Flash 모델 호출
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.7,   // 창의성 조절 (0=일관적, 1=창의적)
                        maxOutputTokens: 600 // 응답 최대 길이 (300→600으로 증가: JSON이 잘리는 문제 방지)
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

        // Gemini 응답에서 { } JSON 블록만 정규식으로 정확히 추출
        // → 마크다운·주석·불필요한 텍스트가 앞뒤에 있어도 안전하게 작동
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error(`JSON 추출 실패. Gemini 원문: ${rawText.slice(0, 200)}`);
        }

        // JSON 파싱
        const parsed = JSON.parse(jsonMatch[0]);

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
