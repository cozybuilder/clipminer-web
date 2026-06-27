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
let saveStatusTab = null; // "콘텐츠 저장" 페이지 탭(진행 상태 회신 대상)
const tabSave = new Map(); // douyinTabId -> { requestId, watchdog, done }

const OVERALL_TIMEOUT_MS = 30000;

function genRequestId() {
  return (self.crypto && self.crypto.randomUUID && self.crypto.randomUUID()) || String(Date.now()) + "-" + Math.random().toString(16).slice(2);
}

// 저장 진행 상태를 "콘텐츠 저장" 페이지로 중계 (requestId 부착)
function relayStatus(requestId, state, extra) {
  if (saveStatusTab == null) return;
  chrome.tabs
    .sendMessage(saveStatusTab, {
      type: "saveStatusToPage",
      requestId,
      state,
      title: extra && extra.title,
      error: extra && extra.error,
    })
    .catch(() => {});
}

function finishSave(tabId, removeTab) {
  const info = tabSave.get(tabId);
  if (info && info.watchdog) clearTimeout(info.watchdog);
  tabSave.delete(tabId);
  if (removeTab) chrome.tabs.remove(tabId).catch(() => {});
}

// 핸드셰이크: content script가 준비됐는지 ping → 없으면 강제 주입 → save 명령
async function handshakeAndSave(tabId, requestId) {
  const ping = () =>
    new Promise((res) => {
      let settled = false;
      try {
        chrome.tabs.sendMessage(tabId, { type: "ping" }, (resp) => {
          settled = true;
          res(!chrome.runtime.lastError && resp && resp.ready === true);
        });
      } catch (_) {
        res(false);
      }
      setTimeout(() => { if (!settled) res(false); }, 1500);
    });

  let ready = await ping();
  if (!ready) {
    // content script 미주입 → 강제 주입 시도
    try {
      await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
    } catch (e) {
      relayStatus(requestId, "error", { error: "저장 준비에 실패했어요. 잠시 후 다시 시도해주세요." });
      finishSave(tabId, true);
      return;
    }
    await new Promise((r) => setTimeout(r, 500));
    ready = await ping();
  }
  if (!ready) {
    relayStatus(requestId, "error", { error: "저장 준비에 실패했어요. 잠시 후 다시 시도해주세요." });
    finishSave(tabId, true);
    return;
  }
  // 준비 완료 → 저장 명령
  chrome.tabs.sendMessage(tabId, { type: "save", requestId }).catch(() => {});
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  // "콘텐츠 저장" 페이지 → Douyin 탭을 백그라운드로 열고 자동 저장 오케스트레이션
  if (msg && msg.type === "saveDouyin") {
    saveStatusTab = _sender && _sender.tab ? _sender.tab.id : null;
    const requestId = genRequestId(); // background가 생성/관리
    relayStatus(requestId, "saving");
    chrome.tabs.create({ url: msg.url, active: false }, (tab) => {
      if (!tab || tab.id == null) {
        relayStatus(requestId, "error", { error: "영상 페이지를 열지 못했어요. 다시 시도해주세요." });
        sendResponse({ ok: false });
        return;
      }
      const tabId = tab.id;
      const watchdog = setTimeout(() => {
        const info = tabSave.get(tabId);
        if (info && !info.done) {
          relayStatus(requestId, "error", { error: "시간이 초과됐어요. 다시 시도해주세요." });
          finishSave(tabId, true);
        }
      }, OVERALL_TIMEOUT_MS);
      tabSave.set(tabId, { requestId, watchdog, done: false });

      // 탭 로드 완료 시점에 핸드셰이크
      const onUpd = (id, changeInfo) => {
        if (id === tabId && changeInfo.status === "complete") {
          chrome.tabs.onUpdated.removeListener(onUpd);
          handshakeAndSave(tabId, requestId);
        }
      };
      chrome.tabs.onUpdated.addListener(onUpd);
      sendResponse({ ok: true });
    });
    return true;
  }
  // Douyin content → 핸드셰이크 응답
  if (msg && msg.type === "ping") {
    sendResponse({ ready: true });
    return false;
  }
  // Douyin content → 저장 진행 상태를 페이지로 중계 (탭의 requestId 부착)
  if (msg && msg.type === "saveStatus") {
    const id = _sender && _sender.tab ? _sender.tab.id : null;
    const info = id != null ? tabSave.get(id) : null;
    const requestId = info ? info.requestId : msg.requestId || null;
    relayStatus(requestId, msg.state, { title: msg.title, error: msg.error });
    if (info && (msg.state === "done" || msg.state === "error" || msg.state === "already_exists")) {
      info.done = true;
      // 성공/중복이면 백그라운드 탭 정리, 실패는 사용자가 볼 수 있게 둘 수도 있으나 자동이므로 정리
      finishSave(id, true);
    }
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
