-- 001_initial_schema.sql
-- Mind Pieces 초기 데이터베이스 설계

-- 1. 일기 테이블 생성
CREATE TABLE diaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,                  -- 일기 내용
    sentiment_color VARCHAR(20),            -- 사용자가 선택한 오늘의 색상 (추후 기능)
    sentiment_score FLOAT,                  -- AI 분석 감정 점수
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 2. AI 상담사 응답 테이블 생성
CREATE TABLE ai_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    diary_id UUID REFERENCES diaries(id) ON DELETE CASCADE,
    response_text TEXT NOT NULL,            -- AI가 작성한 따뜻한 답변
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 3. 보안 설정 (Row Level Security)
ALTER TABLE diaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_responses ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신의 일기만 볼 수 있음
CREATE POLICY "Users can view their own diaries" 
ON diaries FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own diaries" 
ON diaries FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- 사용자는 자신의 일기에 대한 AI 응답만 볼 수 있음
CREATE POLICY "Users can view AI responses for their diaries" 
ON ai_responses FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM diaries 
        WHERE diaries.id = ai_responses.diary_id 
        AND diaries.user_id = auth.uid()
    )
);

-- 인덱스 추가 (성능 최적화)
CREATE INDEX idx_diaries_user_id ON diaries(user_id);
CREATE INDEX idx_ai_responses_diary_id ON ai_responses(diary_id);
