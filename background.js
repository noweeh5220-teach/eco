let tabLastAccessed = {};

chrome.runtime.onInstalled.addListener(async () => {
    const allTabs = await chrome.tabs.query({});
    const now = Date.now();
    allTabs.forEach(tab => {
        tabLastAccessed[tab.id] = now;
    });
    broadcastNavData();
});

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

// 좀비 탭 계산 함수
async function getZombieTabCount() {
    const allTabs = await chrome.tabs.query({});
    const now = Date.now();
    
    // ⏳ 테스트용: 10초 동안 안 본 백그라운드 탭을 좀비 탭으로 판정
    // (나중에 실제 쓸 때는 10 * 60 * 1000 으로 바꾸면 10분이 됩니다!)
    const ZOMBIE_TIMEOUT = 10 * 1000; 

    const zombieTabs = allTabs.filter(tab => {
        if (tab.active) return false; // 현재 보고 있는 탭 제외
        if (tab.pinned) return false; // 고정된 탭 제외
        if (tab.audible) return false; // 소리(유튜브 등) 나는 탭 제외

        const lastTime = tabLastAccessed[tab.id] || now;
        return (now - lastTime) >= ZOMBIE_TIMEOUT;
    });

    return zombieTabs.length;
}

// 데이터를 content.js로 쏴주는 함수
async function broadcastNavData() {
    const zombieCount = await getZombieTabCount();
    const activeTabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (activeTabs.length === 0) return;

    const activeTab = activeTabs[0];
    if (activeTab.url && (activeTab.url.startsWith('http') || activeTab.url.startsWith('file'))) {
        try {
            chrome.tabs.sendMessage(activeTab.id, {
                action: "UPDATE_STATUS",
                zombieTabCount: zombieCount
            });
        } catch (e) {
            // 콘텐트 스크립트 연결 대기 예외 처리
        }
    }
}

// 테마 변경 신호 수신
chrome.runtime.onMessage.addListener((request) => {
    if (request.action === "THEME_CHANGED") broadcastNavData();
});

// 5초마다 한 번씩 강제로 탭 상태를 갱신해서 다마고치로 전송
setInterval(broadcastNavData, 5000);