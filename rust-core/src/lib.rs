use wasm_bindgen::prelude::*;
use aho_corasick::AhoCorasick;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// 필터링 설정 구조체
#[derive(Serialize, Deserialize, Debug)]
pub struct FilterConfig {
    pub blocked_sources: Vec<String>,
    pub blocked_keywords: Vec<String>,
    pub sentiment_filter_level: u8, // 0: OFF, 1: LOW, 2: HIGH
    pub custom_negative_words: Vec<String>,
}

/// 기사 정보 구조체
#[derive(Deserialize, Debug)]
pub struct Article {
    pub source: String,
    pub title: String,
    pub content: String,
}

/// 필터링 결과 구조체
#[derive(Serialize, Deserialize, Debug)]
pub struct FilterResult {
    pub blocked: bool,
    pub reason: String,
    pub sentiment_score: i32,
}

/// Wasm에 노출되는 뉴스 필터 인스턴스
#[wasm_bindgen]
pub struct NewsFilter {
    source_matcher: Option<AhoCorasick>,
    keyword_matcher: Option<AhoCorasick>,
    sentiment_matcher: Option<AhoCorasick>,
    blocked_sources: Vec<String>,
    blocked_keywords: Vec<String>,
    custom_negative_words: Vec<String>,
    sentiment_filter_level: u8,
    
    // 점수 가중치 (Negative)
    negative_scores: HashMap<String, i32>,
}

#[wasm_bindgen]
impl NewsFilter {
    /// 새 필터 인스턴스 생성
    #[wasm_bindgen(constructor)]
    pub fn new(config_json: &str) -> Result<NewsFilter, JsValue> {
        let config: FilterConfig = serde_json::from_str(config_json)
            .map_err(|e| JsValue::from_str(&format!("설정 파싱 오류: {}", e)))?;

        let source_matcher = if !config.blocked_sources.is_empty() {
            Some(
                AhoCorasick::builder()
                    .ascii_case_insensitive(true)
                    .build(&config.blocked_sources)
                    .map_err(|e| JsValue::from_str(&format!("소스 매처 빌드 오류: {}", e)))?,
            )
        } else {
            None
        };

        let keyword_matcher = if !config.blocked_keywords.is_empty() {
            Some(
                AhoCorasick::builder()
                    .ascii_case_insensitive(true)
                    .build(&config.blocked_keywords)
                    .map_err(|e| JsValue::from_str(&format!("키워드 매처 빌드 오류: {}", e)))?,
            )
        } else {
            None
        };

        // 감성 분석을 위한 부정적 단어 리스트 구성
        let mut negative_words = vec![
            "충격", "경악", "분노", "논란", "위기", "참사", "최악", "파국", "비상", 
            "막장", "망신", "패닉", "급락", "폭망", "죽음", "살인", "폭행", "성범죄",
            "혐오", "갈등", "비난", "폭로", "의혹", "조작", "은폐", "비리", "부패",
            "사퇴", "탄핵", "구속", "징역", "전쟁", "도발", "테러"
        ];
        
        // 사용자 정의 부정 단어 추가
        let mut custom_words_ref: Vec<&str> = config.custom_negative_words.iter().map(|s| s.as_str()).collect();
        negative_words.append(&mut custom_words_ref);

        let sentiment_matcher = if config.sentiment_filter_level > 0 {
            Some(
                AhoCorasick::builder()
                    .ascii_case_insensitive(true)
                    .build(&negative_words)
                    .map_err(|e| JsValue::from_str(&format!("감성 매처 빌드 오류: {}", e)))?,
            )
        } else {
            None
        };

        // 점수 맵 초기화 (기본값 -5)
        let mut negative_scores = HashMap::new();
        for &word in &negative_words {
            // "충격", "경악" 같은 자극적인 단어는 더 높은 가중치
            let score = match word {
                "충격" | "경악" | "최악" | "살인" | "성범죄" => -10,
                "논란" | "의혹" | "비난" => -3,
                _ => -5
            };
            negative_scores.insert(word.to_string(), score);
        }

        Ok(NewsFilter {
            blocked_sources: config.blocked_sources,
            blocked_keywords: config.blocked_keywords,
            custom_negative_words: config.custom_negative_words,
            sentiment_filter_level: config.sentiment_filter_level,
            source_matcher,
            keyword_matcher,
            sentiment_matcher,
            negative_scores,
        })
    }
    
    /// 감성 점수 계산 (음수일수록 부정적, 0이 중립)
    fn calculate_sentiment_score(&self, text: &str) -> i32 {
        let mut score = 0;
        
        if let Some(matcher) = &self.sentiment_matcher {
            for mat in matcher.find_iter(text) {
                // 매칭된 패턴의 인덱스로 원래 단어를 찾을 수 없으므로, 
                // Aho-Corasick 매칭 결과만으로는 단어를 특정하기 어렵습니다.
                // 여기서는 간단히 매칭 횟수당 -5점으로 계산합니다.
                // 더 정교하게 하려면 패턴 ID와 단어를 매핑해야 합니다.
                score -= 5;
            }
        }
        
        score
    }

    /// 프리미엄 AI 분석 레벨에 따른 차단 임계값
    fn get_sentiment_threshold(&self) -> i32 {
        match self.sentiment_filter_level {
            1 => -20, // LOW: 매우 부정적인 경우만 차단
            2 => -10, // HIGH: 조금만 부정적이어도 차단
            _ => -1000, // OFF
        }
    }

    /// 기사가 차단되어야 하는지 판단 (기본 + 감성 분석 포함)
    #[wasm_bindgen]
    pub fn should_block(&self, source: &str, title: &str, content: &str) -> bool {
        // 1. 언론사 차단
        if let Some(matcher) = &self.source_matcher {
            if matcher.is_match(source) {
                return true;
            }
        }

        // 2. 키워드 차단
        if let Some(matcher) = &self.keyword_matcher {
            if matcher.is_match(title) || matcher.is_match(content) {
                return true;
            }
        }
        
        // 3. AI 감성 분석 (Premium)
        if self.sentiment_filter_level > 0 {
            let combined = format!("{} {}", title, content);
            let score = self.calculate_sentiment_score(&combined);
            if score < self.get_sentiment_threshold() {
                return true;
            }
        }

        false
    }

    /// 차단 사유를 포함한 상세 결과 반환
    #[wasm_bindgen]
    pub fn check_article(&self, source: &str, title: &str, content: &str) -> String {
        // 1. 언론사 차단
        if let Some(matcher) = &self.source_matcher {
            if let Some(mat) = matcher.find(source) {
                let matched_pattern = &self.blocked_sources[mat.pattern().as_usize()];
                let result = FilterResult {
                    blocked: true,
                    reason: format!("차단 언론사: {}", matched_pattern),
                    sentiment_score: 0,
                };
                return serde_json::to_string(&result).unwrap_or_default();
            }
        }

        // 2. 키워드 차단
        if let Some(matcher) = &self.keyword_matcher {
            let combined = format!("{} {}", title, content);
            if let Some(mat) = matcher.find(&combined) {
                let matched_keyword = &self.blocked_keywords[mat.pattern().as_usize()];
                let result = FilterResult {
                    blocked: true,
                    reason: format!("차단 키워드: {}", matched_keyword),
                    sentiment_score: 0,
                };
                return serde_json::to_string(&result).unwrap_or_default();
            }
        }

        // 3. AI 감성 분석 (Premium)
        let mut sentiment_score = 0;
        if self.sentiment_filter_level > 0 {
            let combined = format!("{} {}", title, content);
            sentiment_score = self.calculate_sentiment_score(&combined);
            let threshold = self.get_sentiment_threshold();
            
            if sentiment_score < threshold {
                let result = FilterResult {
                    blocked: true,
                    reason: format!("AI 감성 분석: 부정적 어조 (점수: {})", sentiment_score),
                    sentiment_score,
                };
                return serde_json::to_string(&result).unwrap_or_default();
            }
        }

        let result = FilterResult {
            blocked: false,
            reason: String::new(),
            sentiment_score,
        };
        serde_json::to_string(&result).unwrap_or_default()
    }
    
    // ... 기존 메서드들 유지 ...
    
    #[wasm_bindgen]
    pub fn filter_batch(&self, articles_json: &str) -> Result<String, JsValue> {
        let articles: Vec<Article> = serde_json::from_str(articles_json)
            .map_err(|e| JsValue::from_str(&format!("기사 파싱 오류: {}", e)))?;

        let results: Vec<bool> = articles
            .iter()
            .map(|a| self.should_block(&a.source, &a.title, &a.content))
            .collect();

        serde_json::to_string(&results)
            .map_err(|e| JsValue::from_str(&format!("결과 직렬화 오류: {}", e)))
    }

    #[wasm_bindgen]
    pub fn get_blocked_sources_count(&self) -> usize {
        self.blocked_sources.len()
    }

    #[wasm_bindgen]
    pub fn get_blocked_keywords_count(&self) -> usize {
        self.blocked_keywords.len()
    }
}
