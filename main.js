/**
 * AI 감정 일기 - main.js (음성 인식 강화 버전)
 *
 * 담당하는 기능:
 * 1. 실시간 글자 수 카운터
 * 2. 음성 입력 - Web Speech API (실시간 중간 결과 표시 + 연속 인식)
 * 3. AI 상담사 응답 시뮬레이션
 * 4. 하단 네비게이션 탭 전환
 */

document.addEventListener('DOMContentLoaded', () => {

    // ─────────────────────────────────────────
    // 1. DOM 요소 참조
    // ─────────────────────────────────────────
    const diaryInput       = document.getElementById('diary-input');
    const charCount        = document.getElementById('char-count');
    const charCounter      = document.querySelector('.char-counter');
    const voiceBtn         = document.getElementById('voice-btn');
    const aiBtn            = document.getElementById('ai-btn');
    const aiResponseText   = document.getElementById('ai-response-text');
    const hashtagContainer = document.getElementById('hashtag-container');
    const navItems         = document.querySelectorAll('.nav-item');


    // ─────────────────────────────────────────
    // 2. 실시간 글자 수 카운터
    // ─────────────────────────────────────────
    const updateCharCount = () => {
        const length = diaryInput.value.length;
        charCount.textContent = length;
        // 1600자(80%) 이상이면 빨간 경고
        charCounter.classList.toggle('warning', length >= 1600);
    };

    diaryInput.addEventListener('input', updateCharCount);


    // ═══════════════════════════════════════════════════════════
    // 3. 음성 입력 기능 (Web Speech API - 완전 강화판)
    //
    //  핵심 원리:
    //  - interimResults: true  → 말하는 도중에도 텍스트를 실시간으로 보여줌
    //  - continuous: true      → 한 문장 끝나도 멈추지 않고 계속 들음
    //  - 최종 확정된 문장(isFinal)만 diaryInput에 누적 저장
    //  - 인식 중인 임시 문장은 placeholder 색상으로 미리보기 표시
    // ═══════════════════════════════════════════════════════════

    let recognition       = null;  // SpeechRecognition 인스턴스
    let isRecording       = false; // 현재 녹음 중 여부
    let confirmedText     = '';    // 최종 확정된 텍스트 (누적 저장됨)

    // 음성 녹음 상태를 보여주는 오버레이 배너를 동적으로 생성
    const voiceBanner = createVoiceBanner();


    /**
     * 마이크 버튼 클릭 이벤트
     * - 녹음 중이 아니면 → 시작
     * - 녹음 중이면     → 중지
     */
    voiceBtn.addEventListener('click', () => {

        // 브라우저 지원 여부 먼저 확인 (Chrome/Edge만 지원)
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            showToast('⚠️ 음성 인식은 Chrome 또는 Edge에서만 사용 가능해요!');
            return;
        }

        if (isRecording) {
            stopRecognition(); // 이미 녹음 중이면 중지
        } else {
            startRecognition(); // 아니면 시작
        }
    });


    /**
     * 음성 인식 시작
     * - SpeechRecognition 객체를 새로 만들고 설정 후 시작
     */
    function startRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();

        recognition.lang           = 'ko-KR'; // 한국어 인식
        recognition.continuous     = true;    // 멈추지 않고 계속 인식 (연속 모드)
        recognition.interimResults = true;    // 확정 전 임시 결과도 받기 (실시간 표시용)
        recognition.maxAlternatives = 1;      // 최적의 후보 1개만

        // ── 인식 시작됐을 때 ──
        recognition.onstart = () => {
            isRecording = true;
            // 현재 textarea에 있는 텍스트를 "확정 텍스트"의 시작점으로 저장
            confirmedText = diaryInput.value;

            // 버튼을 "음성 인식 중.." 텍스트로 변경
            voiceBtn.textContent = '음성 인식 중..';
            voiceBtn.classList.add('recording');
            voiceBtn.title = '클릭하면 음성 입력을 멈춥니다';

            // 녹음 상태 배너 표시
            showVoiceBanner();
        };

        // ── 말을 인식할 때마다 실시간으로 호출 ──
        recognition.onresult = (event) => {
            let interimText = ''; // 아직 확정되지 않은 임시 문장

            // event.results 배열을 순서대로 처리
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;

                if (event.results[i].isFinal) {
                    // ✅ 최종 확정된 문장: 누적 텍스트에 추가
                    //    앞에 공백을 넣어 문장 사이를 자연스럽게 구분
                    const separator = confirmedText.length > 0 ? ' ' : '';
                    confirmedText += separator + transcript;
                } else {
                    // 💬 아직 인식 중인 임시 문장
                    interimText += transcript;
                }
            }

            // textarea에 [확정 텍스트] + [인식 중인 임시 텍스트] 합쳐서 표시
            // 사용자가 "지금 말하는 내용"을 실시간으로 볼 수 있음
            diaryInput.value = confirmedText + (interimText ? ' ' + interimText : '');

            // 항상 textarea의 맨 아래로 스크롤 (내용이 길어질 때)
            diaryInput.scrollTop = diaryInput.scrollHeight;

            // 글자 수 카운터 업데이트
            updateCharCount();
        };

        // ── 인식이 완전히 끝났을 때 (자동 중지 또는 수동 중지) ──
        recognition.onend = () => {
            // continuous 모드라도 네트워크 끊김 등으로 onend가 호출될 수 있음
            // isRecording이 true이면 (수동 중지가 아닌 경우) 자동으로 재시작
            if (isRecording) {
                recognition.start(); // 연속 인식 유지를 위한 자동 재시작
            } else {
                finishRecording();
            }
        };

        // ── 오류 발생 시 ──
        recognition.onerror = (event) => {
            // 'no-speech' 는 조용히 있을 때 발생하는 일반 오류 → 무시
            // 'aborted' 는 수동 중지 시 발생 → 무시
            if (event.error !== 'no-speech') {
                isRecording = false;
                finishRecording();

                // 사용자에게 오류 원인 알려주기
                const errorMessages = {
                    'not-allowed':   '마이크 권한이 거부됩니다. 브라우저 설정에서 마이크를 허용해 주세요.',
                    'network':       '네트워크 오류가 발생했어요. 인터넷 연결을 확인해 주세요.',
                    'audio-capture': '마이크를 찾을 수 없어요. 마이크가 연결되어 있는지 확인해 주세요.',
                };
                showToast(errorMessages[event.error] || `음성 인식 오류: ${event.error}`);
            }
        };

        recognition.start();
    }


    /**
     * 음성 인식 수동 중지
     * - isRecording을 false로 먼저 설정해야 onend에서 재시작하지 않음
     */
    function stopRecognition() {
        isRecording = false;
        if (recognition) {
            recognition.stop(); // 인식 중지 → onend 콜백 호출됨
        }
    }


    /**
     * 녹음 완전 종료 후 UI 정리
     */
    function finishRecording() {
        // 버튼을 "음성 입력" 텍스트로 원상 복구
        voiceBtn.textContent = '음성 입력';
        voiceBtn.classList.remove('recording');
        voiceBtn.title = '음성으로 일기 쓰기';

        // 배너 숨기기
        hideVoiceBanner();

        // textarea 값을 최종 확정 텍스트로 정리
        // (임시 텍스트가 남아있을 수 있어서 confirmedText로 덮어씀)
        diaryInput.value = confirmedText;
        updateCharCount();

        // 텍스트가 실제로 입력된 경우에만 완료 메시지 표시
        if (confirmedText.trim().length > 0) {
            showToast('✅ 음성 입력이 완료됐어요!');
        }
    }


    // ─────────────────────────────────────────
    // 4. 녹음 상태 오버레이 배너 (시각적 피드백)
    // ─────────────────────────────────────────

    /**
     * 음성 녹음 중임을 알려주는 배너 DOM 요소 생성
     * - 페이지에 한 번만 만들고, 필요할 때 보이거나 숨김
     */
    function createVoiceBanner() {
        const banner = document.createElement('div');
        banner.id = 'voice-banner';
        // 배너 내용: 파형 애니메이션 + 안내 텍스트
        banner.innerHTML = `
            <div class="waveform">
                <span></span><span></span><span></span>
                <span></span><span></span>
            </div>
            <span class="banner-text">듣고 있어요... 말씀해 주세요</span>
            <button class="banner-stop-btn" id="banner-stop-btn">중지</button>
        `;
        // 스타일 직접 삽입 (CSS 파일과 분리 방지)
        banner.style.cssText = `
            display: none;
            position: fixed;
            top: 0; left: 50%; transform: translateX(-50%);
            width: 100%; max-width: 430px;
            background: linear-gradient(135deg, #1a1a5e, #3c3c9e);
            color: white;
            padding: 14px 20px;
            z-index: 500;
            flex-direction: row;
            align-items: center;
            gap: 12px;
            box-shadow: 0 4px 20px rgba(26,26,94,0.4);
        `;
        document.body.appendChild(banner);

        // 배너 내부 CSS (파형 + 텍스트 스타일)
        const style = document.createElement('style');
        style.textContent = `
            #voice-banner { font-family: 'Noto Sans KR', sans-serif; }

            /* 파형 애니메이션: 5개의 막대가 높이를 다르게 오르내림 */
            .waveform {
                display: flex; align-items: center; gap: 3px; flex-shrink: 0;
            }
            .waveform span {
                display: block; width: 4px; border-radius: 4px;
                background: rgba(255,255,255,0.85);
                animation: wave 1s ease-in-out infinite;
            }
            /* 각 막대마다 딜레이를 다르게 해서 파형처럼 보이게 */
            .waveform span:nth-child(1) { height: 8px;  animation-delay: 0s; }
            .waveform span:nth-child(2) { height: 18px; animation-delay: 0.15s; }
            .waveform span:nth-child(3) { height: 24px; animation-delay: 0.3s; }
            .waveform span:nth-child(4) { height: 16px; animation-delay: 0.45s; }
            .waveform span:nth-child(5) { height: 10px; animation-delay: 0.6s; }

            @keyframes wave {
                0%, 100% { transform: scaleY(1); opacity: 0.7; }
                50%       { transform: scaleY(1.6); opacity: 1; }
            }

            .banner-text {
                flex: 1; font-size: 0.9rem; font-weight: 600;
            }

            /* 배너 내 중지 버튼 */
            .banner-stop-btn {
                background: rgba(255,255,255,0.2);
                border: 1.5px solid rgba(255,255,255,0.5);
                color: white;
                padding: 6px 16px;
                border-radius: 50px;
                font-size: 0.82rem;
                font-weight: 700;
                cursor: pointer;
                font-family: 'Noto Sans KR', sans-serif;
                flex-shrink: 0;
                transition: background 0.2s;
            }
            .banner-stop-btn:hover { background: rgba(255,255,255,0.35); }

            /* 마이크 버튼 녹음 중 상태 */
            .btn-voice.recording {
                background: #ffe0e4 !important;
                animation: pulse-mic 1.2s ease-in-out infinite;
            }
            @keyframes pulse-mic {
                0%, 100% { box-shadow: 0 0 0 0 rgba(232,93,117,0.5); }
                50%       { box-shadow: 0 0 0 12px rgba(232,93,117,0); }
            }
        `;
        document.head.appendChild(style);

        // 배너 내 "중지" 버튼 클릭 시 녹음 중지
        banner.querySelector('#banner-stop-btn').addEventListener('click', () => {
            stopRecognition();
        });

        return banner;
    }

    function showVoiceBanner() {
        voiceBanner.style.display = 'flex';
    }

    function hideVoiceBanner() {
        voiceBanner.style.display = 'none';
    }


    // ─────────────────────────────────────────
    // 5. AI 상담사 버튼 클릭 (실제 Gemini API 연동)
    // ─────────────────────────────────────────

    aiBtn.addEventListener('click', async () => {
        const content = diaryInput.value.trim();

        // 일기 내용이 없으면 안내 메시지
        if (!content) {
            showToast('오늘 하루 이야기를 먼저 적어주세요 ✏️');
            diaryInput.focus();
            return;
        }

        // 버튼 로딩 상태로 전환
        aiBtn.classList.add('loading');
        aiBtn.disabled = true;
        aiBtn.innerHTML = '<span class="ai-btn-icon">◎</span> 상담사가 읽고 있어요...';

        try {
            // ── Vercel 서버리스 함수(/api/chat)에 일기 내용 전송 ──
            // 브라우저 → 우리 서버 → Gemini API (API 키는 서버에만 존재)
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ diaryContent: content })
            });

            // 서버 응답 파싱
            const data = await res.json();

            if (!res.ok) {
                // 서버에서 오류가 온 경우
                throw new Error(data.error || 'AI 응답 오류');
            }

            // ── AI 상담사 헤더에 감정 단어 표시 ──
            // 예: "AI 상담사의 한마디" → "💙 오늘의 감정: 불안 | AI 상담사의 한마디"
            const emotionBadge = document.querySelector('.ai-response-title');
            emotionBadge.innerHTML =
                `<span class="emotion-badge">${data.emotion}</span> AI 상담사의 한마디`;

            // ── 공감 메시지를 타이핑 효과로 출력 ──
            typewriterEffect(aiResponseText, data.counseling, 25);

            // ── 해시태그 렌더링 ──
            renderHashtags(data.tags);

        } catch (err) {
            // 네트워크 오류 또는 서버 오류 시 사용자에게 알림
            console.error('AI 상담사 오류:', err.message);
            showToast('AI 상담사 연결에 실패했어요. 잠시 후 다시 시도해 주세요.');
            aiResponseText.textContent = '연결에 실패했습니다. 인터넷 연결을 확인해 주세요.';

        } finally {
            // 성공/실패 여부와 무관하게 버튼 원상 복구
            aiBtn.classList.remove('loading');
            aiBtn.disabled = false;
            aiBtn.innerHTML = '<span class="ai-btn-icon">◎</span> AI 상담자에게 물어보기';

            // AI 응답 섹션으로 부드럽게 스크롤
            setTimeout(() => {
                document.querySelector('.ai-response-section')
                    .scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);
        }
    });


    // ─────────────────────────────────────────
    // 6. 하단 네비게이션 탭 전환
    // ─────────────────────────────────────────
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            navItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
        });
    });


    // ─────────────────────────────────────────
    // 7. 유틸리티 함수들
    // ─────────────────────────────────────────

    /**
     * 타이핑 효과: 텍스트를 한 글자씩 출력
     * @param {HTMLElement} element - 대상 요소
     * @param {string}      text    - 출력할 텍스트
     * @param {number}      delay   - 글자 간 딜레이(ms)
     */
    function typewriterEffect(element, text, delay = 30) {
        element.textContent = '';
        let index = 0;
        const timer = setInterval(() => {
            element.textContent += text[index];
            index++;
            if (index >= text.length) clearInterval(timer);
        }, delay);
    }

    /**
     * 해시태그 칩 렌더링
     * @param {string[]} tags - 해시태그 배열
     */
    function renderHashtags(tags) {
        hashtagContainer.innerHTML = '';
        tags.forEach((tag, idx) => {
            const chip = document.createElement('span');
            chip.className = 'hashtag';
            chip.textContent = tag;
            chip.style.animationDelay = `${idx * 100}ms`;
            hashtagContainer.appendChild(chip);
        });
    }

    /**
     * 토스트 메시지 표시 (3초 자동 사라짐)
     * @param {string} message - 표시할 메시지
     */
    function showToast(message) {
        const existing = document.querySelector('.toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            bottom: 96px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(26, 26, 94, 0.92);
            color: white;
            padding: 12px 24px;
            border-radius: 50px;
            font-size: 0.9rem;
            font-weight: 600;
            z-index: 999;
            white-space: nowrap;
            box-shadow: 0 8px 24px rgba(0,0,0,0.2);
            animation: fadeInUp 0.3s ease-out;
            font-family: 'Noto Sans KR', sans-serif;
        `;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

}); // DOMContentLoaded 종료
