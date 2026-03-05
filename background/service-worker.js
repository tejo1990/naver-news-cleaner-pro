// ── Gemini API 호출 ──
async function callGeminiAPI(title, content) {
    const { geminiApiKey, geminiProxyUrl } = await chrome.storage.local.get(['geminiApiKey', 'geminiProxyUrl']);

    // 기본 프록시 주소 (Vercel 배포 주소)
    const DEFAULT_PROXY_URL = 'https://nncchromeextension.vercel.app/api/analyze';
    const activeProxyUrl = geminiProxyUrl || DEFAULT_PROXY_URL;

    // 프록시 서버 사용 (보안 권장 방식)
    if (activeProxyUrl) {
        return await callProxyAPI(activeProxyUrl, title, content);
    }

    // (참고) 프록시가 없는 경우의 직접 호출 백업
    if (!geminiApiKey) {
        throw new Error('API 키가 설정되지 않았습니다. 팝업에서 설정해주세요.');
    }

    const MODEL_ID = 'gemini-2.5-flash';
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_ID}:generateContent?key=${geminiApiKey}`;

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

    const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: 0.1, // 중립적 분석을 위해 낮게 설정
                response_mime_type: "application/json"
            }
        })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'API 호출 실패');
    }

    const data = await response.json();
    try {
        const resultText = data.candidates[0].content.parts[0].text;
        return JSON.parse(resultText);
    } catch (e) {
        console.error('JSON 파싱 에러:', e, data);
        throw new Error('분석 결과 형식이 올바르지 않습니다.');
    }
}

async function callProxyAPI(proxyUrl, title, content) {
    console.log('🛰️ 프록시 요청 시도:', proxyUrl);
    try {
        const response = await fetch(proxyUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, content })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ 프록시 서버 에러 응답:', response.status, errorText);
            throw new Error(`서버 오류(${response.status}): ${errorText.substring(0, 100)} `);
        }

        return await response.json();
    } catch (e) {
        console.error('❌ 프록시 호출 실패:', e);
        throw new Error(`서버 연결 실패: ${e.message} `);
    }
}

// ── 확장 프로그램 설치/업데이트 시 초기 설정 ──
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        // 최초 설치 시 기본값 설정
        chrome.storage.sync.set({
            blockedSources: [],
            blockedKeywords: [],
            filterEnabled: true,
            sentimentFilterLevel: 0,
        });

        chrome.storage.local.set({
            blockedCount: 0,
            totalProcessed: 0,
            totalBlockedAllTime: 0,
            installDate: Date.now(),
        });

        console.log('🧹 네이버 뉴스 클리너 설치 완료');
    } else if (details.reason === 'update') {
        console.log(`🔄 업데이트 완료: v${chrome.runtime.getManifest().version} `);
    }
});

// ── Content Script ↔ Background 메시지 처리 ──
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
        case 'GET_SETTINGS':
            chrome.storage.sync.get(
                {
                    blockedSources: [],
                    blockedKeywords: [],
                    filterEnabled: true,
                },
                (settings) => {
                    sendResponse(settings);
                }
            );
            return true; // 비동기 응답

        case 'ANALYZE_ARTICLE':
            callGeminiAPI(message.title, message.content)
                .then(result => sendResponse({ success: true, result }))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true;

        case 'GET_STATS':
            chrome.storage.local.get(
                {
                    blockedCount: 0,
                    totalProcessed: 0,
                    totalBlockedAllTime: 0,
                    lastUpdated: null,
                },
                (stats) => {
                    sendResponse(stats);
                }
            );
            return true;

        case 'UPDATE_BLOCKED_COUNT':
            chrome.storage.local.get({ totalBlockedAllTime: 0 }, (data) => {
                chrome.storage.local.set({
                    totalBlockedAllTime: data.totalBlockedAllTime + (message.count || 0),
                });
            });
            break;

        case 'TOGGLE_FILTER':
            chrome.storage.sync.get({ filterEnabled: true }, (data) => {
                const newState = !data.filterEnabled;
                chrome.storage.sync.set({ filterEnabled: newState }, () => {
                    sendResponse({ filterEnabled: newState });
                });
            });
            return true;

        default:
            console.log('알 수 없는 메시지:', message);
    }
});

// 매일 자정에 일일 카운트 리셋
chrome.alarms.create('dailyReset', {
    when: getNextMidnight(),
    periodInMinutes: 24 * 60,
});

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'dailyReset') {
        chrome.storage.local.set({
            blockedCount: 0,
            totalProcessed: 0,
        });
        console.log('🔄 일일 카운트 리셋');
    }
});

function getNextMidnight() {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    return midnight.getTime();
}
