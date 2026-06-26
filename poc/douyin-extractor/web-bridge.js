// ClipMiner PoC — web-bridge content script (ClipMiner Web 페이지에 주입).
// 확장(background) ↔ ClipMiner Web 페이지(window.postMessage) 중계 + 확장 존재 알림.

// 존재 알림: 페이지가 ping하면 ready로 응답 + 로드 시 1회 알림
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
});
announce();

// background → 페이지: 등록 payload 전달
chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === "register" && msg.payload) {
    window.postMessage({ type: "clipminer:register", payload: msg.payload }, "*");
  }
});
