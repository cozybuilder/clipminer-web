// ClipMiner — web-bridge content script (ClipMiner Web 페이지에 주입).
// 확장(background) ↔ ClipMiner Web 페이지(window.postMessage) 중계 + 확장 존재 알림.

function announce() {
  window.postMessage({ type: "clipminer:connector-ready" }, "*");
}

window.addEventListener("message", (e) => {
  const d = e.data;
  if (!d) return;
  if (d.type === "clipminer:connector-ping") announce();
  // 페이지 → background: 등록 결과 회수
  if (d.type === "clipminer:register:result") {
    chrome.runtime.sendMessage({ type: "registerResult", result: d.result });
  }
  // 페이지("콘텐츠 저장") → background: 링크 저장 요청
  if (d.type === "clipminer:save" && d.url) {
    chrome.runtime.sendMessage({ type: "saveDouyin", url: d.url, requestId: d.requestId });
  }
  // 페이지("콘텐츠 저장") → background: 작업 폴더 저장 결과(백그라운드 Douyin 탭 정리)
  if (d.type === "clipminer:save-result") {
    chrome.runtime.sendMessage({ type: "pageSaveResult", requestId: d.requestId, state: d.state });
  }
});
announce();

// background → 페이지
chrome.runtime.onMessage.addListener((msg) => {
  if (!msg) return;
  if (msg.type === "register" && msg.payload) {
    window.postMessage({ type: "clipminer:register", payload: msg.payload }, "*");
  }
  // background → "콘텐츠 저장" 페이지: mp4 payload(작업 폴더 저장은 페이지가 수행)
  if (msg.type === "registerPayloadToPage" && msg.payload) {
    window.postMessage(
      { type: "clipminer:register-payload", requestId: msg.requestId, payload: msg.payload },
      "*",
    );
  }
  // 저장 진행 상태 → 페이지(사용자 언어)
  if (msg.type === "saveStatusToPage") {
    window.postMessage(
      {
        type: "clipminer:save-status",
        state: msg.state,
        title: msg.title,
        error: msg.error,
        requestId: msg.requestId,
      },
      "*",
    );
  }
});
