// ============================================================
// 🧹 NNC - Naver News Cleaner (Pro) v3.5.3
// ============================================================
// v3.5.3 - "Guardian Shield" (철갑 보안 및 에러 전면 차단)
// ============================================================

(async function () {
  'use strict';

  let filter = null;
  let filterEnabled = true;
  let blockedCount = 0;
  let blockedSources = [];
  let blockedKeywords = [];
  let observer = null;
  let heartbeat = null;
  let isDestructed = false;

  // --- 🛡️ 1. 철갑 보안: 생존 확인 및 즉각 자폭 ---
  function safeCall(fn, fallback = null) {
    if (isDestructed) return fallback;
    try {
      if (!chrome.runtime?.id) throw new Error('Dead');
      return fn();
    } catch (e) {
      destruct();
      return fallback;
    }
  }

  function destruct() {
    if (isDestructed) return;
    isDestructed = true;
    if (observer) observer.disconnect();
    if (heartbeat) clearInterval(heartbeat);
    // 콘솔에 더 이상 에러가 남지 않도록 모든 리스너 제거 시도 (선택 사항)
  }

  const log = {
    block: (...a) => {
      safeCall(() => console.log(`%c[NNC 🚫]%c`, 'color:#f44336;font-weight:bold', '', ...a));
    },
  };

  const CHANNEL_SELECTORS = [
    '.cni_channel', '.sa_text_press', '.info.press', '.cnf_channel_sub',
    '.cnf_journal', '.cc_link_channel', '.press_logo', '.source',
    '[class*="press"]', '[class*="channel"]', '[class*="source"]',
    '[class*="news_media"]', '[class*="media_name"]',
    '.news_tit', '.cni_keyword', '.cjs_journal_name'
  ];

  const CONTAINER_SELECTORS = [
    '.cni_issue_item', '.cni_news_item', '.sa_item', '.sa_item_type_hd',
    'li.bx', '.cjs_news_item', '.news_item', '.news_area', 'article',
    '._channel_main_news_card_wrapper', '._persist_wrap',
    '[class*="MediaItemView-module__media_item"]',
    '[class*="ContentHeaderSubView-module__sub_news"]'
  ];

  async function loadConfig() {
    return safeCall(async () => {
      const cfg = await chrome.storage.sync.get({
        blockedSources: [],
        blockedKeywords: [],
        filterEnabled: true,
      });
      filterEnabled = cfg.filterEnabled;
      blockedSources = cfg.blockedSources || [];
      blockedKeywords = cfg.blockedKeywords || [];
      return cfg;
    });
  }

  function buildFilter(sources, keywords) {
    const srcPatterns = (sources || []).filter(Boolean).map(s => s.toLowerCase().trim());
    const kwPatterns = (keywords || []).filter(Boolean).map(k => k.toLowerCase().trim());
    return {
      check(text) {
        if (!text) return { blocked: false };
        const t = text.toLowerCase();
        for (const p of srcPatterns) if (t.includes(p)) return { blocked: true, reason: `언론사: "${p}"` };
        for (const p of kwPatterns) if (t.includes(p)) return { blocked: true, reason: `키워드: "${p}"` };
        return { blocked: false };
      }
    };
  }

  function hideElement(el, reason) {
    if (!el || el.dataset.nncBlocked || isDestructed) return;
    safeCall(() => {
      el.style.setProperty('display', 'none', 'important');
      el.dataset.nncBlocked = '1';
      blockedCount++;
      chrome.storage.local.set({ blockedCount, lastUpdated: Date.now() });
    });
  }

  function scanAll() {
    if (isDestructed || !filter || !filterEnabled) return;

    CHANNEL_SELECTORS.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        if (el.closest('[data-nnc-blocked="1"]')) return;
        const content = el.textContent + ' ' + (el.title || '') + ' ' + (el.getAttribute('alt') || '');
        const res = filter.check(content);
        if (res.blocked) {
          const container = el.closest(CONTAINER_SELECTORS.join(', ')) || el.parentElement;
          if (container) hideElement(container, res.reason);
        }
      });
    });

    document.querySelectorAll('li, [class*="item"]').forEach(item => {
      if (item.dataset.nncBlocked || item.textContent.length > 800) return;

      if (!item.querySelector('.nnc-ai-btn') && item.querySelector('a[href*="article"]')) {
        injectAiButton(item);
      }

      if (filter.check(item.textContent).blocked && item.querySelector('a[href*="naver.com"]')) {
        hideElement(item, '전수조사 차단');
      }
    });
  }

  function injectAiButton(container) {
    if (isDestructed) return;
    const titleLink = container.querySelector('a[href*="article"]') || container.querySelector('.news_tit');
    if (!titleLink || titleLink.parentElement.querySelector('.nnc-ai-btn')) return;

    const btn = document.createElement('button');
    btn.className = 'nnc-ai-btn';
    btn.innerHTML = '🤖';
    btn.onclick = (e) => {
      e.preventDefault(); e.stopPropagation();
      alert('NNC AI 뉴스 가디언 분석 예정 지표:\n1. 객관성\n2. 근거 무결성\n3. 의도성 타진\n4. 팩트 vs 가설\n5. 기자 평판\n6. 저널리즘 가치\n7. 데이터 교차 검증\n8. 출처 족보 추적');
    };

    Object.assign(btn.style, { marginLeft: '8px', fontSize: '12px', cursor: 'pointer', border: 'none', background: 'rgba(108,92,231,0.1)', borderRadius: '4px', padding: '2px 4px', verticalAlign: 'middle', zIndex: '10' });
    titleLink.after(btn);
  }

  function watchDom() {
    if (isDestructed) return;
    observer = new MutationObserver(() => scanAll());
    observer.observe(document.body, {
      childList: true, subtree: true, attributes: true, characterData: true, attributeFilter: ['style', 'class']
    });
  }

  async function main() {
    await safeCall(async () => {
      await loadConfig();
      const stats = await chrome.storage.local.get({ installDate: Date.now() });

      if (Date.now() - stats.installDate > (7 * 24 * 60 * 60 * 1000)) {
        log.block('무료 체험 기간이 만료되었습니다.');
        return;
      }

      if (!filterEnabled || (blockedSources.length === 0 && blockedKeywords.length === 0)) return;

      filter = buildFilter(blockedSources, blockedKeywords);
      scanAll();

      if (heartbeat) clearInterval(heartbeat);
      heartbeat = setInterval(scanAll, 2000);
      watchDom();

      chrome.storage.onChanged.addListener(() => safeCall(() => location.reload()));
    });
  }

  main();
})();
