// 🔌 에코 다마고치 중계 파이프라인 (content.js)

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "UPDATE_STATUS") {
        const isSystemDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;

        // 웹페이지(index.html)가 기대하는 객체 구조 { data: { ... } } 로 감싸서 전송
        window.postMessage({
            source: "eco-gochi-extension",
            type: "UPDATE_DATA",
            data: {
                zombieTabCount: message.zombieTabCount,
                isDarkMode: isSystemDarkMode
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

// 브라우저 테마 실시간 변경 감지 리스너
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    chrome.runtime.sendMessage({ action: "THEME_CHANGED" }, () => {
        if (chrome.runtime.lastError) return;
    });
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