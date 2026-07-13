// 🔌 에코 다마고치 중계 파이프라인 (content.js)

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "UPDATE_STATUS") {
        // 백그라운드에서 수동 고정 값(hasOverride)을 세워서 보냈다면 넘어온 값을 그대로 쓰고,
        // 평소에는 브라우저의 실제 시스템 다크모드 여부를 판단합니다.
        const isFinalDarkMode = message.hasOverride 
            ? message.isDarkMode 
            : window.matchMedia('(prefers-color-scheme: dark)').matches;

        // 웹페이지(index.html)가 기대하는 기존 객체 구조 그대로 전송
        window.postMessage({
            source: "eco-gochi-extension",
            type: "UPDATE_DATA",
            data: {
                zombieTabCount: message.zombieTabCount,
                isDarkMode: isFinalDarkMode
            }
        }, "*");
        
        sendResponse({ status: "success" });
    }
    return true;
});

// 웹페이지의 최초 핑(연결 확인 요청)을 처리하는 자동 연동 로직
window.addEventListener("message", (event) => {
    if (event.data && event.data.source === "eco-gochi-page" && event.data.type === "REQUEST_INITIAL_DATA") {
        chrome.runtime.sendMessage({ action: "getZombieData" }, (response) => {
            if (chrome.runtime.lastError) return;
            
            if (response) {
                const isSystemDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
                window.postMessage({
                    source: "eco-gochi-extension",
                    type: "UPDATE_DATA",
                    data: {
                        zombieTabCount: response.zombieTabCount,
                        isDarkMode: isSystemDarkMode
                    }
                }, "*");
            }
        });
    }
});

// 🌓 웹페이지의 수동 테마 변경 명령을 background.js로 중계
window.addEventListener("message", (event) => {
    if (event.data && event.data.source === "eco-gochi-page" && event.data.type === "COMMAND_TOGGLE_THEME") {
        chrome.runtime.sendMessage({ 
            action: "TOGGLE_THEME_OVERRIDE", 
            requestedDarkMode: event.data.requestedDarkMode
        });
    }
});

// ⚠️ [자동 복구 현상 해결] 브라우저 테마 실시간 변경 감지 리스너 보완
// 시스템 테마가 바뀔 때 백그라운드 엔진에 즉시 전화를 걸어(THEME_CHANGED) 수동 고정 상태를 반영한 데이터를 새로 받아옵니다.
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    chrome.runtime.sendMessage({ action: "THEME_CHANGED" });
});

// ====== 여기부터 기존 코드 밑에 그대로 추가하세요 ======

// 웹페이지 화면에서 수동으로 선택한 최신 테마 상태를 저장하는 임시 변수
let scriptThemeOverride = null;

// 웹페이지 버튼 신호를 받아서 상태 저장 및 즉시 강제 적용
window.addEventListener("message", (event) => {
    if (event.data && event.data.source === "eco-gochi-page" && event.data.type === "COMMAND_TOGGLE_THEME") {
        scriptThemeOverride = event.data.requestedDarkMode;
    }
});

// 기존 content.js와 background.js가 5초마다 멋대로 UPDATE_DATA를 보낼 때, 
// 그 신호를 가로채서 사용자가 선택했던 테마로 강제 원상복구 시키는 감시 리스너 추가
window.addEventListener("message", (event) => {
    if (event.data && event.data.source === "eco-gochi-extension" && event.data.type === "UPDATE_DATA") {
        if (scriptThemeOverride !== null && event.data.data.isDarkMode !== scriptThemeOverride) {
            // 기존 코드가 변경해버린 값을 수동 고정값으로 다시 변조해서 강제 주입
            event.data.data.isDarkMode = scriptThemeOverride;
            
            // 변경된 데이터로 웹페이지 내부에 한 번 더 신호를 전송하여 화면을 고정합니다.
            window.postMessage({
                source: "eco-gochi-extension",
                type: "UPDATE_DATA",
                data: event.data.data
            }, "*");
        }
    }
});