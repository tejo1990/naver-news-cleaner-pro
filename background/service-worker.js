// ============================================================
// 네이버 뉴스 클리너 - Service Worker (Background)
// 확장 프로그램 설치, 업데이트, 메시지 처리
// ============================================================

// ── 확장 프로그램 설치/업데이트 시 초기 설정 ──
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        // 최초 설치 시 기본값 설정
        chrome.storage.sync.set({
            blockedSources: [],
            blockedKeywords: [],
            filterEnabled: true,
        });

        chrome.storage.local.set({
            blockedCount: 0,
            totalProcessed: 0,
            totalBlockedAllTime: 0,
            installDate: Date.now(),
        });

        console.log('🧹 네이버 뉴스 클리너 설치 완료');
    } else if (details.reason === 'update') {
        console.log(`🔄 업데이트 완료: v${chrome.runtime.getManifest().version}`);
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
