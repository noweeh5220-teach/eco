// 🧟 좀비 탭 및 브라우저 상태 관리 엔진 (background.js)

let tabLastAccessed = {};
let userThemeOverride = null;

// 최초 구동 시 타임스탬프 초기화
chrome.runtime.onInstalled.addListener(async () => {
    const allTabs = await chrome.tabs.query({});
    const now = Date.now();
    allTabs.forEach(tab => {
        tabLastAccessed[tab.id] = now;
    });
    broadcastNavData();
});

// 생명주기 리스너 등록
chrome.tabs.onActivated.addListener((activeInfo) => {
    tabLastAccessed[activeInfo.tabId] = Date.now();
    broadcastNavData();
});

chrome.tabs.onRemoved.addListener((tabId) => {
    delete tabLastAccessed[tabId];
    broadcastNavData();
});

chrome.tabs.onCreated.addListener((tab) => {
    tabLastAccessed[tab.id] = Date.now();
    broadcastNavData();
});

// 좀비 탭 산정 비즈니스 로직
async function getZombieTabCount() {
    const allTabs = await chrome.tabs.query({});
    const now = Date.now();
    const ZOMBIE_TIMEOUT = 10 * 1000; // ⏳ 테스트용 10초 (실 배포시 10 * 60 * 1000 으로 수정하면 10분)

    const zombieTabs = allTabs.filter(tab => {
        if (tab.active) return false; 
        if (tab.pinned) return false; 
        if (tab.audible) return false; 

        const lastTime = tabLastAccessed[tab.id] || now;
        return (now - lastTime) >= ZOMBIE_TIMEOUT;
    });

    return zombieTabs.length;
}

// 현재 활성화된 페이지로 데이터를 푸시하는 함수
async function broadcastNavData() {
    const zombieCount = await getZombieTabCount();
    const activeTabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (activeTabs.length === 0) return;

    const activeTab = activeTabs[0];
    if (activeTab.url && (activeTab.url.startsWith('http') || activeTab.url.startsWith('file'))) {
        try {
            
            const finalTheme = (userThemeOverride !== null) ? userThemeOverride : false;
            const isOverridden = (userThemeOverride !== null);
            chrome.tabs.sendMessage(activeTab.id, {
                action: "UPDATE_STATUS",
                zombieTabCount: zombieCount,
                isDarkMode: finalTheme,
                hasOverride: (userThemeOverride !== null)
            }, (response) => {
                // 수신측 부재 시 런타임 라스트에러 무시 처리
                if (chrome.runtime.lastError) return;
            });
        } catch (e) {
            // 예외 방어
        }
    }
}

// 공통 메시지 리스너 (원천 차단 에러 가드 포함)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "THEME_CHANGED") {
        broadcastNavData();
        sendResponse({ status: "ok" });
    }
    // 🔥 [이 분기를 새로 추가합니다] 좀비 탭 일괄 소탕 로직
    // 🌓 웹사이트 버튼 조작 신호를 받아서 테마 기억
    if (request.action === "TOGGLE_THEME_OVERRIDE") {
        // 사용자가 선택한 테마를 전역 변수에 고정합니다.
        userThemeOverride = request.requestedDarkMode;
        
        getZombieTabCount().then((zombieCount) => {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs.length > 0) {
                    chrome.tabs.sendMessage(tabs[0].id, {
                        action: "UPDATE_STATUS",
                        zombieTabCount: zombieCount,
                        isDarkMode: userThemeOverride,
                        hasOverride: true
                    }, () => {
                        if (chrome.runtime.lastError) return;
                    });
                }
            });
        });
        sendResponse({ status: "success" });
    }

    if (request.action === "getZombieData") {
        getZombieTabCount().then((zombieCount) => {
            sendResponse({ zombieTabCount: zombieCount });
        });
        return true; // 비동기 응답 유지
    }
    return true;
});

// 5초 주기 강제 하트비트 브로드캐스트
setInterval(broadcastNavData, 5000);

// ====== 여기부터 기존 코드 밑에 그대로 추가하세요 ======

// 웹페이지 버튼 조작 신호를 익스텐션 내부 파이프라인으로 안전하게 바이패스 전송
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "TOGGLE_THEME_OVERRIDE") {
        sendResponse({ status: "success" });
    }
    return true;
});