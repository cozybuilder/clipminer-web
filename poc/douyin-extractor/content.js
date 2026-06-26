// ClipMiner PoC — content script (Douyin video page).
// 페이지 내부 데이터에서 후보 URL 수집 → content-type로 "실제 영상"만 선별 → 세션 fetch → Blob → mp4 저장.
// 커버/이미지(image/*)는 성공으로 인정하지 않는다. 5개 성공 기준을 패널 + 콘솔로 자가진단.

(function () {
  "use strict";
  const TAG = "[ClipMiner]";

  // 사용자용 패널: "영상 저장" 버튼 + 상태 한 줄. (개발 로그는 콘솔로만)
  function panel() {
    let el = document.getElementById("clipminer-poc-panel");
    if (el) return el;
    el = document.createElement("div");
    el.id = "clipminer-poc-panel";
    el.style.cssText =
      "position:fixed;z-index:2147483647;right:16px;bottom:16px;width:280px;" +
      "background:#1A1D26;color:#F5F7FA;border:1px solid #2B2F3A;border-radius:12px;padding:12px 14px;" +
      "font:13px/1.5 system-ui,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.5)";
    el.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px">' +
      '<b style="color:#7C5CFC">ClipMiner</b>' +
      '<button id="cmpoc-run" style="background:#7C5CFC;color:#fff;border:0;border-radius:8px;padding:6px 12px;cursor:pointer;font-weight:600">영상 저장</button>' +
      "</div>" +
      '<div id="cmpoc-status" style="margin-top:8px;color:#9AA4B2"></div>' +
      '<div id="cmpoc-log"></div>';
    document.documentElement.appendChild(el);
    el.querySelector("#cmpoc-run").addEventListener("click", run);
    return el;
  }

  // 사용자 상태 표시 (사용자 언어). kind: info | ok | error
  function setStatus(text, kind) {
    const c = kind === "ok" ? "#34d399" : kind === "error" ? "#f87171" : "#9AA4B2";
    const s = panel().querySelector("#cmpoc-status");
    if (s) {
      s.style.color = c;
      s.textContent = text;
    }
  }

  // 개발 로그(콘솔 전용 — 사용자에겐 보이지 않음)
  function log(label, ok, detail) {
    const mark = ok === true ? "OK" : ok === false ? "FAIL" : "·";
    console.log(TAG, mark, label, detail || "");
  }

  // 저장 진행 상태를 "콘텐츠 저장" 페이지로 보고
  function reportSave(state, extra) {
    try {
      chrome.runtime.sendMessage({
        type: "saveStatus",
        state,
        title: extra && extra.title,
        error: extra && extra.error,
      });
    } catch (_) {
      /* noop */
    }
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
    wrap.appendChild(mk("라이브러리 열기", () => chrome.runtime.sendMessage({ type: "openWeb" })));
    wrap.appendChild(
      mk("다시 시도", () => {
        if (lastPayload) chrome.runtime.sendMessage({ type: "registerToWeb", payload: lastPayload });
      }),
    );
    panel().querySelector("#cmpoc-log").appendChild(wrap);
  }

  // 라이브러리 등록 결과 수신 (background → 이 Douyin 탭) — 사용자 언어로 표시 + 저장 페이지 보고
  chrome.runtime.onMessage.addListener((msg) => {
    if (!msg || msg.type !== "registerResult") return;
    const r = msg.result;
    if (r && r.ok && r.status === "added") {
      setStatus("저장 완료! 라이브러리에 추가되었습니다.", "ok");
      reportSave("done", { title: r.title });
    } else if (r && r.ok && r.status === "duplicate") {
      setStatus("이미 저장된 영상이에요.", "ok");
      reportSave("already_exists", { title: r.title });
    } else {
      setStatus("저장에 실패했어요. 다시 시도해주세요.", "error");
      reportSave("error", { error: (r && r.error) || "등록 실패" });
    }
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
    setStatus("영상을 저장하고 있어요...", "info");
    reportSave("saving");

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
      setStatus("이 페이지에서 영상을 찾지 못했어요. 영상 페이지에서 다시 시도해주세요.", "error");
      reportSave("error", { error: "영상을 찾지 못함" });
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
      log("기준2) 영상 URL 선별", false, "영상 URL 없음 / 커버·이미지 URL만 발견");
      setStatus("이 페이지에서 영상을 찾지 못했어요. 영상 페이지에서 다시 시도해주세요.", "error");
      reportSave("error", { error: "영상 URL을 찾지 못함" });
      return;
    }
    log("기준2) 영상 URL 선별", true, `[${chosen.source}] ${chosen.url.slice(0, 100)}`);

    // 전체 fetch → Blob
    let resp;
    try {
      resp = await chrome.runtime.sendMessage({ type: "fetchVideo", url: chosen.url });
    } catch (e) {
      log("fetch", false, "메시지 오류: " + e);
      setStatus("저장에 실패했어요. 다시 시도해주세요.", "error");
      reportSave("error", { error: "fetch 오류" });
      return;
    }
    if (!resp || !resp.ok) {
      log("fetch", false, resp && resp.phase === "http" ? `HTTP ${resp.status}` : (resp && resp.error) || "실패");
      setStatus("저장에 실패했어요. 다시 시도해주세요.", "error");
      reportSave("error", { error: (resp && resp.error) || "다운로드 실패" });
      return;
    }
    if (isImageCT(resp.contentType)) {
      log("영상 검증", false, "content-type image");
      setStatus("영상이 아닌 이미지예요. 영상 페이지에서 다시 시도해주세요.", "error");
      reportSave("error", { error: "영상이 아님" });
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
      // 최종 결과는 registerResult 수신부에서 "저장 완료/실패"로 갱신
      setStatus("저장 중... 라이브러리에 추가하고 있어요.", "info");
    } else if (r && r.reason === "web_closed") {
      saveLocally(blob, payload.localFileName);
      log("local save", true, payload.localFileName);
      setStatus("라이브러리를 열어두면 자동으로 추가돼요.", "error");
      reportSave("error", { error: "라이브러리(/videos)를 열어두세요" });
      webButtons();
    } else {
      saveLocally(blob, payload.localFileName);
      log("local save", true, payload.localFileName);
      setStatus("저장에 실패했어요. 다시 시도해주세요.", "error");
      reportSave("error", { error: (r && r.error) || "전송 실패" });
      webButtons();
    }
  }

  panel();
  console.log(TAG, "loaded.");

  // 자동 저장 대상 탭이면(= '콘텐츠 저장'에서 연 탭) 사용자 클릭 없이 자동 실행
  (async () => {
    try {
      const res = await chrome.runtime.sendMessage({ type: "isAutoSave" });
      if (res && res.auto) {
        setStatus("영상을 저장할 준비 중...", "info");
        // 페이지 데이터가 채워질 시간을 잠깐 준 뒤 실행
        setTimeout(run, 1200);
      } else {
        setStatus("‘영상 저장’을 누르면 이 영상이 저장됩니다.", "info");
      }
    } catch (_) {
      setStatus("‘영상 저장’을 누르면 이 영상이 저장됩니다.", "info");
    }
  })();
})();
