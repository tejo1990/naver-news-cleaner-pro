// 테스트 환경에서 content.js의 로직을 독립적으로 테스트하기 위한 모킹 파일입니다.

function buildFilter(sources, keywords) {
    const srcPatterns = sources.filter(Boolean).map(s => s.toLowerCase().trim());
    const kwPatterns = keywords.filter(Boolean).map(k => k.toLowerCase().trim());
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

module.exports = { buildFilter };
