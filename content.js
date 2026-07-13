chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "UPDATE_STATUS") {
        
        // ☀️ 실제 화면의 시스템 다크모드 여부를 정확히 판정 (true / false)
        const isSystemDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;

        // 다마고치 화면(index.html)으로 데이터 전송
        window.postMessage({
            source: "eco-gochi-extension",
            zombieTabCount: message.zombieTabCount,
            isDarkMode: isSystemDarkMode
        }, "*");
    }
});

// 브라우저 테마가 라이트<->다크로 바뀔 때 실시간 감지
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    try {
        chrome.runtime.sendMessage({ action: "THEME_CHANGED" }, (response) => {
            if (chrome.runtime.lastError) return;
        });
    } catch (err) {
    }
});
