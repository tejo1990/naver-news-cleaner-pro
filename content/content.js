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
    btn.onclick = async (e) => {
      e.preventDefault(); e.stopPropagation();

      const title = titleLink.textContent.trim();
      const content = container.textContent.trim().substring(0, 500); // 전송 토큰 절약

      btn.innerHTML = '⏳';
      btn.style.opacity = '0.5';
      btn.disabled = true;

      chrome.runtime.sendMessage({ type: 'ANALYZE_ARTICLE', title, content }, (response) => {
        btn.innerHTML = '🤖';
        btn.style.opacity = '1';
        btn.disabled = false;

        if (response && response.success) {
          showAiResultModal(response.result);
        } else {
          alert('AI 분석 실패: ' + (response?.error || '알 수 없는 오류'));
        }
      });
    };

    Object.assign(btn.style, { marginLeft: '8px', fontSize: '12px', cursor: 'pointer', border: 'none', background: 'rgba(108,92,231,0.1)', borderRadius: '4px', padding: '2px 4px', verticalAlign: 'middle', zIndex: '10' });
    titleLink.after(btn);
  }

  function showAiResultModal(result) {
    const overlay = document.createElement('div');
    overlay.className = 'nnc-ai-overlay';
    Object.assign(overlay.style, {
      position: 'fixed', top: '0', left: '0', width: '100vw', height: '100vh',
      backgroundColor: 'rgba(0,0,0,0.5)', zIndex: '10000', display: 'flex',
      alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif'
    });

    const modal = document.createElement('div');
    Object.assign(modal.style, {
      backgroundColor: '#fff', padding: '24px', borderRadius: '12px',
      maxWidth: '450px', width: '90%', boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
      position: 'relative', animation: 'nnc-slide-up 0.3s ease-out'
    });

    const getScoreColor = (s) => s > 70 ? '#4caf50' : (s > 40 ? '#ff9800' : '#f44336');

    modal.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
        <h2 style="margin:0; font-size:18px; color:#333;">🤖 AI 뉴스 분석 결과</h2>
        <button id="nnc-modal-close" style="background:none; border:none; font-size:24px; cursor:pointer; color:#999;">&times;</button>
      </div>
      <div style="margin-bottom:20px;">
        <div style="display:flex; align-items:center; margin-bottom:12px;">
          <div style="flex:1; height:8px; background:#eee; borderRadius:4px; margin-right:12px;">
            <div style="width:${result.objectivity_score}%; height:100%; background:${getScoreColor(result.objectivity_score)}; borderRadius:4px;"></div>
          </div>
          <span style="font-weight:bold; color:${getScoreColor(result.objectivity_score)}">${result.objectivity_score}점 (객관성)</span>
        </div>
        <div style="background:#f8f9fa; padding:12px; borderRadius:8px; margin-bottom:12px; font-size:14px;">
          <p style="margin:0 0 8px 0;"><strong>편향성:</strong> ${result.bias_rating} (${result.bias_direction})</p>
          <p style="margin:0;"><strong>요약:</strong> ${result.summary}</p>
        </div>
        <div style="font-size:13px; color:#666; line-height:1.5;">
          <p style="margin:0 0 8px 0;">🔍 <strong>팩트체크:</strong> ${result.fact_check}</p>
          <p style="margin:0;">💡 <strong>판단:</strong> ${result.verdict}</p>
        </div>
      </div>
      <button id="nnc-modal-confirm" style="width:100%; padding:10px; background:#6c5ce7; color:#fff; border:none; borderRadius:6px; cursor:pointer; font-weight:bold;">확인</button>
      <style>
        @keyframes nnc-slide-up { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      </style>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    modal.querySelector('#nnc-modal-close').onclick = close;
    modal.querySelector('#nnc-modal-confirm').onclick = close;
    overlay.onclick = (e) => { if (e.target === overlay) close(); };
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
