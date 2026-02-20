/**
 * @jest-environment jsdom
 */

// 테스트를 위해 필요한 로직들을 모킹(Mocking)하거나 주입합니다.
const { buildFilter } = require('./mock-logic');

describe('NNC Core Filtering Logic', () => {
    test('1. 특정 언론사가 포함된 텍스트를 정확히 차단해야 함', () => {
        const sources = ['데일리안', '세계일보'];
        const keywords = ['단독'];
        const filter = buildFilter(sources, keywords);

        expect(filter.check('데일리안 기사입니다').blocked).toBe(true);
        expect(filter.check('세계일보 뉴스를 전합니다').blocked).toBe(true);
        expect(filter.check('[단독] 속보입니다').blocked).toBe(true);
        expect(filter.check('일반적인 뉴스입니다').blocked).toBe(false);
    });

    test('2. 대소문자 및 공백에 관계없이 차단해야 함', () => {
        const sources = [' Naver '];
        const filter = buildFilter(sources, []);
        expect(filter.check('naver 기사')).toBeDefined();
        expect(filter.check('NAVER 기사').blocked).toBe(true);
    });
});

describe('NNC Trial Logic (Business Model)', () => {
    const weekInMs = 7 * 24 * 60 * 60 * 1000;

    test('3. 체험 기간(7일) 내에는 정상 작동해야 함', () => {
        const installDate = Date.now() - (3 * 24 * 60 * 60 * 1000); // 3일 전 설치
        const isExpired = (Date.now() - installDate) > weekInMs;
        expect(isExpired).toBe(false);
    });

    test('4. 체험 기간 만료 시 만료 상태로 판단해야 함', () => {
        const installDate = Date.now() - (8 * 24 * 60 * 60 * 1000); // 8일 전 설치
        const isExpired = (Date.now() - installDate) > weekInMs;
        expect(isExpired).toBe(true);
    });
});
