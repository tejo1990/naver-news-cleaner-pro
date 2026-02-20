// ============================================================
// 네이버 뉴스 클리너 - Popup Script
// 차단 목록 관리, 통계 표시, 설정 내보내기/가져오기, Premium UI
// ============================================================

(function () {
    'use strict';

    // ── DOM 요소 참조 ──
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    const elements = {
        toggleFilter: $('#toggleFilter'),
        blockedCount: $('#blockedCount'),
        totalBlocked: $('#totalBlocked'),
        sourceCount: $('#sourceCount'),

        sourceInput: $('#sourceInput'),
        addSource: $('#addSource'),
        sourceList: $('#sourceList'),
        sourceEmpty: $('#sourceEmpty'),

        keywordInput: $('#keywordInput'),
        addKeyword: $('#addKeyword'),
        keywordList: $('#keywordList'),
        keywordEmpty: $('#keywordEmpty'),

        exportBtn: $('#exportBtn'),
        importBtn: $('#importBtn'),
        importFile: $('#importFile'),

        // Premium UI Elements
        sentimentSlider: $('#sentimentSlider'),
        sentimentStatus: $('#sentimentStatus'),
        container: $('.container'),

        // Trial Elements
        trialText: $('#trialText'),
        trialProgress: $('#trialProgress'),
        expirationOverlay: $('#expirationOverlay'),
        subscribeBtn: $('#subscribeBtn'),
    };

    // ── 현재 설정 상태 ──
    let state = {
        blockedSources: [],
        blockedKeywords: [],
        filterEnabled: true,
        sentimentFilterLevel: 0, // 0: OFF, 1: LOW, 2: HIGH
        customNegativeWords: [],
    };

    // ── 초기화 ──
    async function init() {
        await loadSettings();
        await loadStats();
        setupEventListeners();
        updateQuickAddButtons();
        checkTrial(); // 체험 기간 확인
    }

    // ── 체험 기간 확인 ──
    async function checkTrial() {
        const data = await chrome.storage.local.get({ installDate: Date.now() });
        const now = Date.now();
        const weekInMs = 7 * 24 * 60 * 60 * 1000;
        const elapsed = now - data.installDate;
        const remaining = Math.max(0, weekInMs - elapsed);
        const percent = Math.min(100, (remaining / weekInMs) * 100);

        // UI 업데이트
        if (elements.trialProgress) {
            elements.trialProgress.style.width = `${percent}%`;
        }

        if (remaining <= 0) {
            elements.trialText.textContent = "체험 기간 만료";
            elements.expirationOverlay.style.display = 'flex';
            elements.container.classList.add('disabled');
        } else {
            const days = Math.floor(remaining / (24 * 60 * 60 * 1000));
            const hours = Math.floor((remaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));

            if (days > 0) {
                elements.trialText.textContent = `무료 체험: ${days}일 ${hours}시간 남음`;
            } else {
                const mins = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
                elements.trialText.textContent = `무료 체험: ${hours}시간 ${mins}분 남음 (곧 만료)`;
            }
        }
    }

    // ── 설정 로드 ──
    async function loadSettings() {
        return new Promise((resolve) => {
            chrome.storage.sync.get(
                {
                    blockedSources: [],
                    blockedKeywords: [],
                    filterEnabled: true,
                    sentimentFilterLevel: 0,
                    customNegativeWords: [],
                },
                (data) => {
                    state = { ...state, ...data };

                    // UI 업데이트
                    renderList('sourceList', state.blockedSources, 'blockedSources');
                    renderList('keywordList', state.blockedKeywords, 'blockedKeywords');
                    updateToggleUI(state.filterEnabled);
                    updateEmptyStates();

                    elements.sourceCount.textContent = state.blockedSources.length;

                    // Premium 슬라이더 업데이트
                    if (elements.sentimentSlider) {
                        elements.sentimentSlider.value = state.sentimentFilterLevel;
                        updateSentimentUI();
                    }

                    resolve();
                }
            );
        });
    }

    // ── 통계 로드 ──
    async function loadStats() {
        return new Promise((resolve) => {
            chrome.storage.local.get(
                {
                    blockedCount: 0,
                    totalBlockedAllTime: 0,
                },
                (data) => {
                    elements.blockedCount.textContent = data.blockedCount;
                    elements.totalBlocked.textContent = formatNumber(data.totalBlockedAllTime);
                    resolve();
                }
            );
        });
    }

    // ── 숫자 포맷 (1000 → 1K) ──
    function formatNumber(num) {
        if (num >= 10000) return (num / 10000).toFixed(1) + '만';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toString();
    }

    // ── 리스트 렌더링 ──
    function renderList(listId, items, storageKey) {
        const list = document.getElementById(listId);
        list.innerHTML = items
            .map(
                (item, index) => `
      <li class="tag">
        <span class="tag-name">${escapeHtml(item)}</span>
        <button class="remove" data-index="${index}" data-key="${storageKey}" title="삭제">×</button>
      </li>
    `
            )
            .join('');
    }

    // ── XSS 방지 ──
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ── Empty State 업데이트 ──
    function updateEmptyStates() {
        elements.sourceEmpty.classList.toggle('hidden', state.blockedSources.length > 0);
        elements.keywordEmpty.classList.toggle('hidden', state.blockedKeywords.length > 0);
    }

    // ── Toggle UI 업데이트 ──
    function updateToggleUI(enabled) {
        elements.toggleFilter.classList.toggle('active', enabled);
        elements.container.classList.toggle('disabled', !enabled);
    }

    // ── Sentiment UI 업데이트 ──
    function updateSentimentUI() {
        const level = parseInt(elements.sentimentSlider.value);
        const labels = ['꺼짐', '약함 (매우 부정적만)', '강함 (부정적 포함)'];
        const status = elements.sentimentStatus;

        status.textContent = labels[level];

        if (level === 0) {
            status.style.color = 'var(--text-secondary)';
        } else if (level === 1) {
            status.style.color = '#ffd700'; // Gold
        } else {
            status.style.color = '#ff6b6b'; // Red
        }
    }

    // ── 항목 추가 ──
    async function addItem(inputElement, storageKey) {
        const value = inputElement.value.trim();
        if (!value) {
            inputElement.focus();
            return;
        }

        // 현재 목록 가져오기
        const items = state[storageKey] || [];

        // 중복 체크
        if (items.some((item) => item.toLowerCase() === value.toLowerCase())) {
            showToast('이미 추가된 항목입니다', 'error');
            return;
        }

        // 추가
        items.push(value);
        state[storageKey] = items;

        await new Promise((resolve) => {
            chrome.storage.sync.set({ [storageKey]: items }, resolve);
        });

        inputElement.value = '';
        inputElement.focus();

        // UI 업데이트
        const listId = storageKey === 'blockedSources' ? 'sourceList' : 'keywordList';
        renderList(listId, items, storageKey);
        updateEmptyStates();
        updateQuickAddButtons();
        elements.sourceCount.textContent = state.blockedSources.length;

        showToast(`"${value}" 추가됨 ✓`, 'success');
    }

    // ── 항목 제거 ──
    async function removeItem(storageKey, index) {
        const items = state[storageKey] || [];
        const removed = items[index];
        items.splice(index, 1);
        state[storageKey] = items;

        await new Promise((resolve) => {
            chrome.storage.sync.set({ [storageKey]: items }, resolve);
        });

        // UI 업데이트
        const listId = storageKey === 'blockedSources' ? 'sourceList' : 'keywordList';
        renderList(listId, items, storageKey);
        updateEmptyStates();
        updateQuickAddButtons();
        elements.sourceCount.textContent = state.blockedSources.length;

        showToast(`"${removed}" 제거됨`, 'success');
    }

    // ── 빠른 추가 버튼 상태 업데이트 ──
    function updateQuickAddButtons() {
        $$('.quick-btn').forEach((btn) => {
            const source = btn.dataset.source;
            const isAdded = state.blockedSources.some(
                (s) => s.toLowerCase() === source.toLowerCase()
            );
            btn.classList.toggle('added', isAdded);
            btn.disabled = isAdded;
        });
    }

    // ── Toast 알림 ──
    function showToast(message, type = '') {
        const existing = document.querySelector('.toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);

        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 350);
        }, 2000);
    }

    // ── 설정 내보내기 ──
    function exportSettings() {
        const settings = {
            blockedSources: state.blockedSources,
            blockedKeywords: state.blockedKeywords,
            sentimentFilterLevel: state.sentimentFilterLevel,
            exportDate: new Date().toISOString(),
            version: '1.0.0',
        };

        const blob = new Blob([JSON.stringify(settings, null, 2)], {
            type: 'application/json',
        });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `naver-news-cleaner-settings-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();

        URL.revokeObjectURL(url);
        showToast('설정 내보내기 완료', 'success');
    }

    // ── 설정 가져오기 ──
    async function importSettings(file) {
        try {
            const text = await file.text();
            const settings = JSON.parse(text);

            if (!settings.blockedSources && !settings.blockedKeywords) {
                showToast('올바르지 않은 파일 형식', 'error');
                return;
            }

            // 기존 설정과 병합 (중복 제거)
            const sources = [...new Set([...state.blockedSources, ...(settings.blockedSources || [])])];
            const keywords = [...new Set([...state.blockedKeywords, ...(settings.blockedKeywords || [])])];
            const sentimentLevel = settings.sentimentFilterLevel !== undefined ? settings.sentimentFilterLevel : state.sentimentFilterLevel;

            state.blockedSources = sources;
            state.blockedKeywords = keywords;
            state.sentimentFilterLevel = sentimentLevel;

            await new Promise((resolve) => {
                chrome.storage.sync.set(
                    {
                        blockedSources: sources,
                        blockedKeywords: keywords,
                        sentimentFilterLevel: sentimentLevel,
                    },
                    resolve
                );
            });

            renderList('sourceList', sources, 'blockedSources');
            renderList('keywordList', keywords, 'blockedKeywords');
            updateEmptyStates();
            updateQuickAddButtons();

            if (elements.sentimentSlider) {
                elements.sentimentSlider.value = sentimentLevel;
                updateSentimentUI();
            }

            elements.sourceCount.textContent = sources.length;

            showToast(
                `가져오기 완료`,
                'success'
            );
        } catch (e) {
            showToast('파일 읽기 오류', 'error');
        }
    }

    // ── 이벤트 리스너 설정 ──
    function setupEventListeners() {
        // Toggle 필터
        elements.toggleFilter.addEventListener('click', async () => {
            state.filterEnabled = !state.filterEnabled;
            await new Promise((resolve) => {
                chrome.storage.sync.set({ filterEnabled: state.filterEnabled }, resolve);
            });
            updateToggleUI(state.filterEnabled);
            showToast(state.filterEnabled ? '필터 활성화 ▶️' : '필터 비활성화 ⏸️');
        });

        // 탭 전환
        $$('.tab').forEach((tab) => {
            tab.addEventListener('click', () => {
                $$('.tab').forEach((t) => t.classList.remove('active'));
                $$('.tab-content').forEach((c) => c.classList.remove('active'));
                tab.classList.add('active');
                $(`#${tab.dataset.tab}Tab`).classList.add('active');
            });
        });

        // Premium 슬라이더
        if (elements.sentimentSlider) {
            elements.sentimentSlider.addEventListener('input', () => {
                updateSentimentUI();
            });

            elements.sentimentSlider.addEventListener('change', async () => {
                const level = parseInt(elements.sentimentSlider.value);
                state.sentimentFilterLevel = level;
                await new Promise((resolve) => {
                    chrome.storage.sync.set({ sentimentFilterLevel: level }, resolve);
                });
                showToast(`AI 필터 레벨 변경됨: ${level}`, 'success');
            });
        }

        // 언론사 추가
        elements.addSource.addEventListener('click', () => {
            addItem(elements.sourceInput, 'blockedSources');
        });

        elements.sourceInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                addItem(elements.sourceInput, 'blockedSources');
            }
        });

        // 키워드 추가
        elements.addKeyword.addEventListener('click', () => {
            addItem(elements.keywordInput, 'blockedKeywords');
        });

        elements.keywordInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                addItem(elements.keywordInput, 'blockedKeywords');
            }
        });

        // 삭제 버튼 (이벤트 위임)
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('remove')) {
                const { index, key } = e.target.dataset;
                removeItem(key, parseInt(index));
            }
        });

        // 빠른 추가 버튼
        $$('.quick-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                if (btn.disabled) return;
                elements.sourceInput.value = btn.dataset.source;
                addItem(elements.sourceInput, 'blockedSources');
            });
        });

        // 내보내기/가져오기
        elements.exportBtn.addEventListener('click', exportSettings);
        elements.importBtn.addEventListener('click', () => {
            elements.importFile.click();
        });
        elements.importFile.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                importSettings(e.target.files[0]);
                e.target.value = ''; // 같은 파일 다시 선택 가능하도록
            }
        });

        // Storage 변경 감지 (다른 탭에서 변경 시)
        chrome.storage.onChanged.addListener((changes, area) => {
            if (area === 'sync') {
                if (changes.blockedSources) {
                    state.blockedSources = changes.blockedSources.newValue || [];
                    renderList('sourceList', state.blockedSources, 'blockedSources');
                    updateEmptyStates();
                    updateQuickAddButtons();
                    elements.sourceCount.textContent = state.blockedSources.length;
                }
                if (changes.blockedKeywords) {
                    state.blockedKeywords = changes.blockedKeywords.newValue || [];
                    renderList('keywordList', state.blockedKeywords, 'blockedKeywords');
                    updateEmptyStates();
                }
                if (changes.sentimentFilterLevel && elements.sentimentSlider) {
                    state.sentimentFilterLevel = changes.sentimentFilterLevel.newValue || 0;
                    elements.sentimentSlider.value = state.sentimentFilterLevel;
                    updateSentimentUI();
                }
            }
            if (area === 'local') {
                if (changes.blockedCount) {
                    elements.blockedCount.textContent = changes.blockedCount.newValue || 0;
                }
                if (changes.totalBlockedAllTime) {
                    elements.totalBlocked.textContent = formatNumber(changes.totalBlockedAllTime.newValue || 0);
                }
            }
        });

        // 구독 버튼 클릭 (Stripe 연결 placeholder)
        if (elements.subscribeBtn) {
            elements.subscribeBtn.addEventListener('click', () => {
                const stripeUrl = 'https://buy.stripe.com/test_6oEcO38O61wS8Ew3cc'; // 사장님이 나중에 바꿀 결제 링크
                window.open(stripeUrl, '_blank');
            });
        }
    }

    // ── 시작 ──
    init();
})();
