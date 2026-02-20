# 🧹 NNC: Naver News Cleaner (Pro)

![Version](https://img.shields.io/badge/version-3.4.2-blue.svg)
![Technology](https://img.shields.io/badge/engine-Rust%2FWasm-orange.svg)
![Platform](https://img.shields.io/badge/platform-Chrome%20Extension-success.svg)

**NNC(Naver News Cleaner)**는 네이버 뉴스의 무질서하고 난잡한 정보를 정화하여, 당신이 원하는 뉴스만 읽을 수 있게 돕는 고성능 브라우저 확장 프로그램입니다.

## 🚀 Key Features

- **Sentinel Scan Engine (v3.4)**: 네이버의 동적 클래스 모듈 및 복잡한 DOM 구조를 실시간으로 추적하여 숨겨진 언론사 흔적까지 99.9% 제거합니다.
- **Rust/Wasm Core**: 대량의 뉴스 데이터를 필터링할 때 브라우저 속도 저하가 없도록 고성능 Rust 엔진을 사용합니다.
- **Bottom-up Trace**: 텍스트뿐만 아니라 이미지 `alt`, `title`, 배지 형태의 언론사 정보까지 역방향으로 추적하여 차단합니다.
- **Zero-Noise Operation**: 사용자 경험을 방해하지 않는 무소음 차단 기능.
- **AI Sentiment Filtering (Pro)**: (준비 중) AI 기반 긍정/부정 감성 분석을 통한 뉴스 필터링.

## 🛠 Tech Stack

- **Logic**: Vanilla JavaScript (ES6+)
- **Engine**: Rust (wasm-pack)
- **Styling**: Modern CSS (Glassmorphism UI)
- **Detection**: MutationObserver & Periodic Heartbeat Scan

## 📦 How to Install (Developer Mode)

1. 이 저장소를 클론하거나 ZIP으로 다운로드합니다.
2. 크롬 브라우저에서 `chrome://extensions`로 이동합니다.
3. 오른쪽 상단의 '개발자 모드'를 활성화합니다.
4. '압축해제된 확장 프로그램을 로드합니다'를 클릭하고 프로젝트 폴더를 선택합니다.

## 📄 License

Copyright (c) 2026. All rights reserved.
이 프로젝트의 소유권은 사용자에게 있으며, 허가되지 않은 상업적 재배포를 금합니다.
