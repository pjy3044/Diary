/**
 * api/chat.js - Vercel 서버리스 함수
 *
 * 역할: 브라우저에서 받은 일기 내용을 Gemini API로 전달하고,
 *       AI 상담 응답을 파싱하여 브라우저에 돌려줍니다.
 *
 * ✅ 보안 원칙:
 *   - API 키는 이 파일에 직접 쓰지 않습니다.
 *   - Vercel 대시보드의 Environment Variables에 저장된
 *     process.env.GEMINI_API_KEY 를 사용합니다.
 *   - 브라우저(클라이언트)는 API 키를 절대 볼 수 없습니다.
 */

export default async function handler(req, res) {

    // POST 요청만 허용
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // 요청 본문에서 일기 내용 추출
    const { diaryContent } = req.body;

    // 일기 내용이 없으면 오류 반환
    if (!diaryContent || diaryContent.trim().length === 0) {
        return res.status(400).json({ error: '일기 내용이 없습니다.' });
    }

    // Vercel 환경 변수에서 API 키 가져오기
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'API 키가 설정되지 않았습니다.' });
    }

    // ─────────────────────────────────────────
    // Gemini에게 보낼 프롬프트 작성
    //
    // JSON 형식으로 답하게 하면 파싱이 쉽고 안정적입니다.
    // ─────────────────────────────────────────
    const prompt = `
다음은 학생이 오늘 쓴 감정 일기입니다:
"${diaryContent}"

위 일기를 읽고, 반드시 아래 JSON 형식으로만 답변하세요.
설명, 마크다운, 코드블록 등 다른 텍스트는 절대 포함하지 마세요.

{
  "emotion": "오늘의 감정을 가장 잘 나타내는 단어 딱 하나 (예: 불안, 설렘, 외로움, 뿌듯함)",
  "counseling": "학생에게 전하는 따뜻한 공감 메시지. 반드시 2~3문장 이내. 존댓말 사용. 감정을 인정하고 위로하는 내용.",
  "tags": ["#태그1", "#태그2"]
}
`;

    try {
        // Gemini API 호출 (gemini-2.0-flash 모델 사용)
        const geminiRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [{ text: prompt }]
                        }
                    ],
                    // 응답의 창의성 조절 (0에 가까울수록 안정적, 일관된 응답)
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 300,
                    }
                })
            }
        );

        // Gemini API 응답 파싱
        const geminiData = await geminiRes.json();

        // 응답 구조 확인 후 텍스트 추출
        const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!rawText) {
            throw new Error('Gemini로부터 유효한 응답을 받지 못했습니다.');
        }

        // JSON 파싱: Gemini가 가끔 ```json ... ``` 블록으로 감싸는 경우 제거
        const cleanText = rawText.replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(cleanText);

        // 클라이언트로 결과 반환
        return res.status(200).json({
            emotion:    parsed.emotion   || '알 수 없음',
            counseling: parsed.counseling || '오늘도 수고 많았어요.',
            tags:       parsed.tags      || ['#공감해요'],
        });

    } catch (err) {
        console.error('Gemini API 오류:', err.message);
        return res.status(500).json({
            error: 'AI 상담사 연결에 실패했습니다.',
            detail: err.message
        });
    }
}
