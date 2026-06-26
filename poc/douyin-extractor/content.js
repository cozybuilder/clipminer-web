// ClipMiner PoC — content script (Douyin video page).
// 페이지 내부 데이터에서 후보 URL 수집 → content-type로 "실제 영상"만 선별 → 세션 fetch → Blob → mp4 저장.
// 커버/이미지(image/*)는 성공으로 인정하지 않는다. 5개 성공 기준을 패널 + 콘솔로 자가진단.

(function () {
  "use strict";
  const TAG = "[ClipMiner PoC]";

  function panel() {
    let el = document.getElementById("clipminer-poc-panel");
    if (el) return el;
    el = document.createElement("div");
    el.id = "clipminer-poc-panel";
    el.style.cssText =
      "position:fixed;z-index:2147483647;right:16px;bottom:16px;width:400px;max-height:70vh;overflow:auto;" +
      "background:#1A1D26;color:#F5F7FA;border:1px solid #2B2F3A;border-radius:12px;padding:12px 14px;" +
      "font:12px/1.5 system-ui,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.5)";
    el.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">' +
      '<b style="color:#7C5CFC">ClipMiner PoC — Douyin</b>' +
      '<button id="cmpoc-run" style="background:#7C5CFC;color:#fff;border:0;border-radius:8px;padding:4px 10px;cursor:pointer">추출 시도</button>' +
      "</div><div id='cmpoc-log'></div>";
    document.documentElement.appendChild(el);
    el.querySelector("#cmpoc-run").addEventListener("click", run);
    return el;
  }
  function log(label, ok, detail) {
    const c = ok === true ? "#34d399" : ok === false ? "#f87171" : "#9AA4B2";
    const mark = ok === true ? "✓" : ok === false ? "✗" : "·";
    const row = document.createElement("div");
    row.style.cssText = "margin:3px 0;word-break:break-all";
    row.innerHTML =
      `<span style="color:${c}">${mark}</span> <b>${label}</b>` +
      (detail ? `<div style="color:#9AA4B2">${detail}</div>` : "");
    panel().querySelector("#cmpoc-log").appendChild(row);
    console.log(TAG, mark, label, detail || "");
  }

  let lastPayload = null;

  function saveLocally(blob, name) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.documentElement.appendChild(a);
    a.click();
    a.remove();
  }
  function webButtons() {
    const wrap = document.createElement("div");
    wrap.style.cssText = "margin-top:6px;display:flex;gap:6px";
    const mk = (t, fn) => {
      const b = document.createElement("button");
      b.textContent = t;
      b.style.cssText =
        "background:#2B2F3A;color:#F5F7FA;border:0;border-radius:8px;padding:4px 10px;cursor:pointer";
      b.onclick = fn;
      return b;
    };
    wrap.appendChild(mk("ClipMiner Web 열기", () => chrome.runtime.sendMessage({ type: "openWeb" })));
    wrap.appendChild(
      mk("재등록 시도", () => {
        if (lastPayload) chrome.runtime.sendMessage({ type: "registerToWeb", payload: lastPayload });
      }),
    );
    panel().querySelector("#cmpoc-log").appendChild(wrap);
  }

  // Web 등록 결과 수신 (background → 이 Douyin 탭)
  chrome.runtime.onMessage.addListener((msg) => {
    if (!msg || msg.type !== "registerResult") return;
    const r = msg.result;
    if (r && r.ok && r.status === "added") log("ClipMiner Web 등록", true, "완료 · " + r.title);
    else if (r && r.ok && r.status === "duplicate") log("ClipMiner Web", null, "이미 등록됨 · " + r.title);
    else log("ClipMiner Web 등록", false, (r && r.error) || "실패");
  });

  function readEmbeddedData() {
    const out = {};
    try {
      if (window._ROUTER_DATA) out._ROUTER_DATA = window._ROUTER_DATA;
    } catch (_) {}
    try {
      const s = document.getElementById("RENDER_DATA");
      if (s && s.textContent)
        out.RENDER_DATA = JSON.parse(decodeURIComponent(s.textContent));
    } catch (_) {}
    return out;
  }

  // url_list를 부모 key와 함께 수집
  function collectUrlLists(root) {
    const found = [];
    const seen = new Set();
    function walk(node, keyName) {
      if (!node || typeof node !== "object" || seen.has(node)) return;
      seen.add(node);
      if (Array.isArray(node)) {
        for (const v of node) walk(v, keyName);
        return;
      }
      const list = node.url_list || node.urlList;
      if (Array.isArray(list)) {
        const urls = list.filter((u) => typeof u === "string" && /^https?:\/\//.test(u));
        if (urls.length) found.push({ key: keyName || "", urls });
      }
      for (const k of Object.keys(node)) walk(node[k], k);
    }
    walk(root, "");
    return found;
  }

  const IMG_KEY = /cover|avatar|image|logo|sticker|icon|poster|thumb/i;
  const VID_KEY = /play.?addr|playapi|main_url|download_addr|video|bit_rate|media/i;
  const IMG_URL = /\.(jpe?g|png|webp|gif|heic|bmp)(\?|$)/i;

  function collectCandidates(embedded) {
    const lists = collectUrlLists(embedded);
    const cands = [];
    const pushUrl = (url, source, rank) => {
      if (!/^https?:\/\//.test(url)) return;
      if (IMG_URL.test(url)) return; // 확장자가 이미지면 제외
      if (!cands.some((c) => c.url === url)) cands.push({ url, source, rank });
    };
    // 1) play_addr 등 영상 키 (rank 0)
    for (const l of lists) {
      if (VID_KEY.test(l.key) && !IMG_KEY.test(l.key))
        for (const u of l.urls) pushUrl(u, l.key, 0);
    }
    // 2) 중립 키 (rank 1) — 이미지 키 제외
    for (const l of lists) {
      if (!VID_KEY.test(l.key) && !IMG_KEY.test(l.key))
        for (const u of l.urls) pushUrl(u, l.key, 1);
    }
    // 3) <video> https src (rank 0)
    for (const v of document.querySelectorAll("video")) {
      const u = v.currentSrc || v.src;
      if (u && /^https?:/.test(u)) pushUrl(u, "video-el", 0);
    }
    // 4) 이미 로드된 리소스 중 mp4/미디어 (rank 0)
    try {
      for (const e of performance.getEntriesByType("resource")) {
        const u = e.name;
        if (/\.mp4(\?|$)|mime_type=video|media-video|\/video\//i.test(u)) pushUrl(u, "perf", 0);
      }
    } catch (_) {}
    return cands.sort((a, b) => a.rank - b.rank);
  }

  function extractTitle(embedded) {
    let desc = "";
    try {
      const hit = JSON.stringify(embedded).match(/"desc"\s*:\s*"((?:[^"\\]|\\.){1,200})"/);
      if (hit) desc = JSON.parse('"' + hit[1] + '"');
    } catch (_) {}
    const og = document.querySelector('meta[property="og:title"]')?.content || "";
    return (desc || og || document.title || "").trim();
  }

  const isVideoCT = (ct) => /^video\//i.test(ct) || /application\/octet-stream/i.test(ct);
  const isImageCT = (ct) => /^image\//i.test(ct);

  function base64ToBlob(b64, type) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: type || "video/mp4" });
  }
  function safeName(t) {
    const base = (t || "douyin")
      .replace(/[\\/:*?"<>|]+/g, "_")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80);
    return (base || "douyin") + ".mp4";
  }
  const hostOf = (u) => {
    try {
      return new URL(u).hostname;
    } catch (_) {
      return "";
    }
  };

  async function run() {
    panel().querySelector("#cmpoc-log").innerHTML = "";

    const onDouyin = /douyin\.com|iesdouyin\.com/.test(location.host);
    log("기준1) Douyin 컨텍스트", onDouyin, location.href.slice(0, 70));

    const embedded = readEmbeddedData();
    log("페이지 내장 데이터", Object.keys(embedded).length > 0, "sources: " + (Object.keys(embedded).join(", ") || "없음"));

    const title = extractTitle(embedded);
    log("기준3) 제목 추출", !!title, title ? JSON.stringify(title).slice(0, 120) : "실패");

    const cands = collectCandidates(embedded);
    log("기준2) 후보 URL", cands.length > 0, cands.length + "개 (이미지 확장자/이미지 키 제외)");
    cands.slice(0, 12).forEach((c, i) =>
      log(`  #${i + 1} [${c.source}]`, null, c.url.slice(0, 110)),
    );
    if (!cands.length) {
      log("판정", false, "후보 없음 — 영상 URL 미발견");
      return;
    }

    // content-type로 실제 영상 후보 선별
    log("후보 검사(content-type)", null, "각 후보를 Range GET으로 확인...");
    let chosen = null;
    for (const c of cands.slice(0, 12)) {
      let p;
      try {
        p = await chrome.runtime.sendMessage({ type: "probe", url: c.url });
      } catch (e) {
        log(`  검사 [${c.source}]`, false, "메시지 오류: " + e);
        continue;
      }
      const ct = (p && p.contentType) || "";
      const verdict = p && p.ok && isVideoCT(ct) ? true : isImageCT(ct) ? false : null;
      log(`  검사 ${hostOf(c.url)}`, verdict, `status ${p && p.status} · type ${ct || "?"}`);
      if (p && p.ok && isVideoCT(ct)) {
        chosen = c;
        break;
      }
    }

    if (!chosen) {
      log("기준2) 영상 URL 선별", false, "영상 URL 없음 / 커버·이미지 URL만 발견 — 영상 페이지(/video/{id})에서 재시도 또는 네트워크 캡처 필요");
      return;
    }
    log("기준2) 영상 URL 선별", true, `[${chosen.source}] ${chosen.url.slice(0, 100)}`);

    // 전체 fetch → Blob
    let resp;
    try {
      resp = await chrome.runtime.sendMessage({ type: "fetchVideo", url: chosen.url });
    } catch (e) {
      log("기준4) 세션 fetch", false, "메시지 오류: " + e);
      return;
    }
    if (!resp || !resp.ok) {
      log("기준4) 세션 fetch", false, resp && resp.phase === "http" ? `HTTP ${resp.status}(403=서명 가능)` : (resp && resp.error) || "실패");
      return;
    }
    if (isImageCT(resp.contentType)) {
      log("기준4) 영상 검증", false, "content-type이 image — 성공으로 인정하지 않음(커버 URL)");
      return;
    }
    const blob = base64ToBlob(resp.b64, resp.contentType || "video/mp4");
    log("기준4) Blob 생성", blob.size > 0, `size: ${blob.size.toLocaleString()} bytes · type: ${resp.contentType || "?"}`);

    // ClipMiner Web으로 등록 payload 전송 (Web이 작업 폴더 저장 + 라이브러리 등록)
    const payload = {
      platform: "douyin",
      originalTitle: title,
      sourceUrl: location.href,
      videoUrl: chosen.url,
      localFileName: safeName(title),
      fileSize: blob.size,
      mimeType: resp.contentType || "video/mp4",
      bytesBase64: resp.b64,
    };
    lastPayload = payload;

    log("ClipMiner Web 전송", null, "등록 요청...");
    let r;
    try {
      r = await chrome.runtime.sendMessage({ type: "registerToWeb", payload });
    } catch (e) {
      r = { ok: false, reason: "bridge_error", error: String(e) };
    }

    if (r && r.reason === "sent") {
      log("기준5·6) Web 전송됨", true, "ClipMiner Web에서 작업 폴더 저장+등록 진행(결과 대기)");
    } else if (r && r.reason === "web_closed") {
      saveLocally(blob, payload.localFileName);
      log("mp4 저장(로컬)", true, payload.localFileName);
      log("ClipMiner Web 등록", false, "ClipMiner Web이 열려 있지 않음");
      webButtons();
    } else {
      saveLocally(blob, payload.localFileName);
      log("mp4 저장(로컬)", true, payload.localFileName);
      log("Web 전송 실패", false, (r && r.error) || "?");
      webButtons();
    }
  }

  panel();
  console.log(TAG, "loaded. 영상 페이지에서 우측 하단 패널의 '추출 시도'를 누르세요.");
})();
