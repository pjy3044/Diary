-- ============================================================
-- 002_diaries_rls.sql
-- 감정 일기 테이블 생성 및 RLS 보안 정책 설정
-- Supabase SQL Editor에서 실행하세요.
-- ============================================================

-- 1. 기존 테이블이 있으면 삭제 후 재생성 (초기화 시에만 사용)
-- DROP TABLE IF EXISTS public.diaries;

-- 2. diaries 테이블 생성
CREATE TABLE IF NOT EXISTS public.diaries (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content     TEXT NOT NULL,                    -- 일기 본문
    emotion     TEXT,                             -- AI가 분류한 감정 한 단어
    counseling  TEXT,                             -- AI 상담사 공감 메시지
    tags        TEXT[],                           -- 해시태그 배열
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 3. user_id 인덱스: RLS 정책이 user_id로 필터링하므로 성능 최적화 필수
--    (베스트 프랙티스: supabase.com 공식 권장사항)
CREATE INDEX IF NOT EXISTS idx_diaries_user_id ON public.diaries(user_id);
CREATE INDEX IF NOT EXISTS idx_diaries_created_at ON public.diaries(created_at DESC);

-- 4. RLS 활성화: 활성화하지 않으면 모든 사용자가 모든 데이터에 접근 가능
ALTER TABLE public.diaries ENABLE ROW LEVEL SECURITY;

-- 5. RLS 정책: 자신의 일기만 조회/삽입/수정/삭제 가능
--    auth.uid() = user_id → JWT의 sub 값과 user_id가 일치할 때만 허용
--    TO authenticated → 로그인한 사용자(이메일/구글)에게만 적용
CREATE POLICY "자신의 일기만 접근 가능"
ON public.diaries
FOR ALL
TO authenticated
USING ( (SELECT auth.uid()) = user_id )
WITH CHECK ( (SELECT auth.uid()) = user_id );

-- 6. 익명 로그인 사용 시: 익명 사용자도 자신의 일기에 접근 가능
--    (signInAnonymously()도 auth.users에 등록되므로 동일 정책 적용)
-- ※ 위 정책으로 자동 포함됩니다. 별도 정책 불필요.

-- 완료 확인 메시지
SELECT 'diaries 테이블 및 RLS 설정 완료! ✅' AS status;
