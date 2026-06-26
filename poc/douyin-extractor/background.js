// ClipMiner PoC — background service worker.
// content script가 추출한 play URL을 host_permissions 권한으로 cross-origin fetch 한다.
// (페이지 컨텍스트 fetch는 CDN CORS로 막히므로 배경에서 받는다.)
// 바이트는 메시징 안전을 위해 base64 문자열로 돌려준다(ArrayBuffer는 sendMessage 직렬화 불안정).

function abToBase64(ab) {
  const bytes = new Uint8Array(ab);
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

// ClipMiner Web 라이브러리 탭 매칭/열기 (등록 수신부는 /videos 페이지)
const WEB_MATCHES = ["http://localhost:3000/videos*", "https://clipminer.cozybuilder.co.kr/videos*"];
const WEB_OPEN_URL = "http://localhost:3000/videos";
let pendingDouyinTab = null; // 단일 흐름: 마지막 Douyin 탭으로 등록 결과 회신
const autoSaveTabs = new Set(); // 자동 저장하도록 연 Douyin 탭
let saveStatusTab = null; // "콘텐츠 저장" 페이지 탭(진행 상태 회신 대상)

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  // "콘텐츠 저장" 페이지 → Douyin 새 탭을 열고 자동 저장하도록 표시
  if (msg && msg.type === "saveDouyin") {
    saveStatusTab = _sender && _sender.tab ? _sender.tab.id : null;
    chrome.tabs.create({ url: msg.url, active: true }, (tab) => {
      if (tab && tab.id != null) autoSaveTabs.add(tab.id);
      sendResponse({ ok: !!tab });
    });
    return true;
  }
  // Douyin content → 이 탭이 자동 저장 대상인지 (1회성)
  if (msg && msg.type === "isAutoSave") {
    const id = _sender && _sender.tab ? _sender.tab.id : null;
    const auto = id != null && autoSaveTabs.has(id);
    if (auto) autoSaveTabs.delete(id);
    sendResponse({ auto });
    return false;
  }
  // Douyin content → 저장 진행 상태를 "콘텐츠 저장" 페이지로 중계
  if (msg && msg.type === "saveStatus") {
    if (saveStatusTab != null)
      chrome.tabs
        .sendMessage(saveStatusTab, {
          type: "saveStatusToPage",
          state: msg.state,
          title: msg.title,
          error: msg.error,
        })
        .catch(() => {});
    return false;
  }

  // Douyin content → Web 탭으로 등록 payload 전달
  if (msg && msg.type === "registerToWeb") {
    (async () => {
      const tabs = await chrome.tabs.query({ url: WEB_MATCHES });
      if (!tabs.length) {
        sendResponse({ ok: false, reason: "web_closed" });
        return;
      }
      pendingDouyinTab = _sender && _sender.tab ? _sender.tab.id : null;
      try {
        await chrome.tabs.sendMessage(tabs[0].id, { type: "register", payload: msg.payload });
        sendResponse({ ok: true, reason: "sent" });
      } catch (e) {
        sendResponse({ ok: false, reason: "bridge_error", error: String(e && e.message ? e.message : e) });
      }
    })();
    return true;
  }
  // Web → Douyin 탭으로 등록 결과 회신
  if (msg && msg.type === "registerResult") {
    if (pendingDouyinTab != null)
      chrome.tabs.sendMessage(pendingDouyinTab, { type: "registerResult", result: msg.result }).catch(() => {});
    return false;
  }
  // ClipMiner Web 열기
  if (msg && msg.type === "openWeb") {
    chrome.tabs.create({ url: WEB_OPEN_URL });
    return false;
  }

  if (msg && msg.type === "fetchVideo") {
    (async () => {
      try {
        const res = await fetch(msg.url, { credentials: "include" });
        if (!res.ok) {
          // 응답은 받았으나 상태 코드 실패 → 403이면 서명/Referer 문제일 가능성
          sendResponse({ ok: false, phase: "http", status: res.status, error: `HTTP ${res.status}` });
          return;
        }
        const ab = await res.arrayBuffer();
        sendResponse({
          ok: true,
          size: ab.byteLength,
          contentType: res.headers.get("content-type") || "",
          b64: abToBase64(ab),
        });
      } catch (e) {
        // 응답 전 실패(TypeError "Failed to fetch") → 권한 누락/CORS/네트워크
        sendResponse({
          ok: false,
          phase: "network",
          errorName: e && e.name,
          error: String(e && e.message ? e.message : e),
        });
      }
    })();
    return true; // async
  }

  // 후보 검사: Range GET으로 content-type만 확인(전체 다운로드 없이 영상 여부 판정)
  if (msg && msg.type === "probe") {
    (async () => {
      try {
        const res = await fetch(msg.url, {
          method: "GET",
          headers: { Range: "bytes=0-1" },
          credentials: "include",
        });
        const ct = res.headers.get("content-type") || "";
        const len =
          res.headers.get("content-range") || res.headers.get("content-length") || "";
        try {
          await res.arrayBuffer();
        } catch (_) {}
        sendResponse({ ok: res.ok || res.status === 206, status: res.status, contentType: ct, len });
      } catch (e) {
        sendResponse({ ok: false, error: String(e && e.message ? e.message : e) });
      }
    })();
    return true;
  }

  // 대안: 브라우저 다운로드 매니저로 직접 저장(세션/Referer를 브라우저가 처리)
  if (msg && msg.type === "browserDownload") {
    chrome.downloads.download(
      { url: msg.url, filename: msg.filename || "clipminer-poc.mp4" },
      (id) => sendResponse({ ok: !!id, id, error: chrome.runtime.lastError?.message }),
    );
    return true;
  }
});
