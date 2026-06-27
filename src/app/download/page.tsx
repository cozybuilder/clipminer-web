"use client";

// ClipMiner Web — "콘텐츠 저장" (일반 사용자용).
// 사용자는 링크를 붙여넣고 "영상 저장하기"만 누른다. 저장된 영상은 라이브러리에 자동 추가.
// 내부적으로는 브라우저 확장(ClipMiner Connector)이 영상을 저장하지만, 사용자는 의식하지 않는다.
// (cookies.txt / yt-dlp / 서버 다운로드 방식은 미채택.)

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  Film,
  FolderOpen,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronDown,
  ArrowRight,
  Download,
  Package,
  Puzzle,
} from "lucide-react";

// 배포용 확장 ZIP (public/ 정적 파일 → npm run build:ext 로 생성)
const EXTENSION_ZIP_URL = "/clipminer-extension.zip";
import BackButton from "@/components/BackButton";
import {
  isFsAccessSupported,
  getStoredWorkspace,
  pickWorkspace,
  ensureWritePermission,
  queryWorkspacePermission,
  type Workspace,
} from "@/lib/workspace";
import { registerFromConnector, type ConnectorPayload } from "@/lib/connector";
import { listVideos } from "@/lib/videos";

type SaveState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "done"; title?: string }
  | { kind: "dup"; title?: string }
  | { kind: "error"; text: string };

const SAVE_TIMEOUT_MS = 35000;

export default function SavePage() {
  const [supported, setSupported] = useState(true);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [perm, setPerm] = useState<PermissionState | null>(null);
  const [browserReady, setBrowserReady] = useState(false);
  const [url, setUrl] = useState("");
  const [save, setSave] = useState<SaveState>({ kind: "idle" });
  const [setupOpen, setSetupOpen] = useState(false);

  // 저장 진행 추적: 활성 여부 + background가 부여한 requestId + timeout
  const activeRef = useRef(false);
  const reqRef = useRef<string>("");
  const timeoutRef = useRef<number | null>(null);
  // 메시지 핸들러(useEffect[])에서 최신 작업 폴더 핸들을 읽기 위한 ref
  const workspaceRef = useRef<Workspace | null>(null);
  function clearSaveTimeout() {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }

  const wsConnected = !!workspace && perm === "granted";

  useEffect(() => {
    workspaceRef.current = workspace;
  }, [workspace]);

  useEffect(() => {
    let active = true;
    (async () => {
      const ok = isFsAccessSupported();
      const ws = ok ? await getStoredWorkspace() : null;
      const p = ws ? await queryWorkspacePermission(ws.handle) : null;
      if (active) {
        setSupported(ok);
        setWorkspace(ws);
        setPerm(p);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // 브라우저 준비 여부(확장 존재) 감지 + 저장 상태 수신 — 모두 사용자 언어로 표기
  useEffect(() => {
    // background로 저장 결과 회신(백그라운드 Douyin 탭 정리) + 종료 상태 표시
    const finishLocalSave = (requestId: string | undefined, st: SaveState) => {
      activeRef.current = false;
      clearSaveTimeout();
      setSave(st);
      const state =
        st.kind === "done" ? "done" : st.kind === "dup" ? "already_exists" : "error";
      window.postMessage({ type: "clipminer:save-result", requestId, state }, "*");
    };

    // 확장이 회신한 mp4 payload → /download가 작업 폴더에 직접 저장 + 라이브러리 등록
    const handleRegisterPayload = async (
      requestId: string | undefined,
      payload: ConnectorPayload,
    ) => {
      const ws = workspaceRef.current;
      if (!ws) {
        finishLocalSave(requestId, { kind: "error", text: "작업 폴더가 연결되지 않았어요." });
        return;
      }
      try {
        const existing = await listVideos();
        const res = await registerFromConnector(payload, { workspace: ws, existing });
        if (res.ok && res.status === "added") {
          finishLocalSave(requestId, { kind: "done", title: res.title });
        } else if (res.ok && res.status === "duplicate") {
          finishLocalSave(requestId, { kind: "dup", title: res.title });
        } else {
          finishLocalSave(requestId, {
            kind: "error",
            text: (!res.ok && res.error) || "저장에 실패했어요.",
          });
        }
      } catch (err) {
        finishLocalSave(requestId, {
          kind: "error",
          text: err instanceof Error ? err.message : "저장 중 오류가 발생했어요.",
        });
      }
    };

    const onMsg = (e: MessageEvent) => {
      const d = e.data as {
        type?: string;
        state?: string;
        title?: string;
        error?: string;
        requestId?: string;
        payload?: ConnectorPayload;
      };
      if (!d) return;
      if (d.type === "clipminer:connector-ready") setBrowserReady(true);
      // 확장이 mp4 bytes를 회신 → 작업 폴더 저장 + 등록은 이 페이지가 직접 수행
      if (d.type === "clipminer:register-payload" && d.payload) {
        if (!activeRef.current) return;
        if (reqRef.current && d.requestId && d.requestId !== reqRef.current) return;
        void handleRegisterPayload(d.requestId || reqRef.current, d.payload);
        return;
      }
      if (d.type === "clipminer:save-status") {
        if (d.state === "saving") {
          // 진행 중일 때만, background가 부여한 requestId를 활성 요청으로 채택
          if (activeRef.current) {
            if (d.requestId) reqRef.current = d.requestId;
            setSave({ kind: "saving" });
          }
          return;
        }
        // 종료 상태: 활성 요청이 아니거나 다른 요청이면 무시(지연/취소 회신 방지)
        if (!activeRef.current) return;
        if (reqRef.current && d.requestId && d.requestId !== reqRef.current) return;
        activeRef.current = false;
        clearSaveTimeout();
        if (d.state === "done") setSave({ kind: "done", title: d.title });
        else if (d.state === "already_exists") setSave({ kind: "dup", title: d.title });
        else if (d.state === "error")
          setSave({ kind: "error", text: d.error || "저장에 실패했어요." });
      }
    };
    window.addEventListener("message", onMsg);
    window.postMessage({ type: "clipminer:connector-ping" }, "*");
    const t = setTimeout(() => window.postMessage({ type: "clipminer:connector-ping" }, "*"), 600);
    return () => {
      window.removeEventListener("message", onMsg);
      clearTimeout(t);
      clearSaveTimeout();
    };
  }, []);

  async function handleSelectFolder() {
    try {
      const ws = await pickWorkspace();
      if (ws) {
        setWorkspace(ws);
        setPerm(await queryWorkspacePermission(ws.handle));
      }
    } catch {
      /* 취소 무시 */
    }
  }

  async function handleSave() {
    setSave({ kind: "idle" });
    const u = url.trim();
    if (!u) {
      setSave({ kind: "error", text: "영상 링크를 붙여넣으세요." });
      return;
    }
    const full = /^https?:\/\//i.test(u) ? u : `https://${u}`;

    // 작업 폴더 먼저 연결
    let ws = workspace;
    if (!ws) {
      ws = await pickWorkspace().catch(() => null);
      if (!ws) {
        setSave({ kind: "error", text: "영상을 저장할 폴더를 먼저 선택하세요." });
        setSetupOpen(true);
        return;
      }
      setWorkspace(ws);
    }
    const okWrite = await ensureWritePermission(ws.handle);
    setPerm(okWrite ? "granted" : "prompt");
    if (!okWrite) {
      setSave({ kind: "error", text: "저장 폴더 권한을 허용해주세요." });
      return;
    }

    if (browserReady) {
      // 확장이 백그라운드에서 자동 저장 → 결과는 clipminer:save-status로 수신
      // requestId는 background가 생성/관리 → 다음 'saving' 상태에서 채택
      activeRef.current = true;
      reqRef.current = "";
      setSave({ kind: "saving" });
      window.postMessage({ type: "clipminer:save", url: full }, "*");
      // 무한 대기 방지: 시간 내 결과 없으면 안내 + 버튼 원복
      clearSaveTimeout();
      timeoutRef.current = window.setTimeout(() => {
        if (!activeRef.current) return;
        activeRef.current = false;
        setSave((prev) =>
          prev.kind === "saving"
            ? { kind: "error", text: "저장에 시간이 너무 오래 걸려요. 잠시 후 다시 시도해주세요." }
            : prev,
        );
      }, SAVE_TIMEOUT_MS);
    } else {
      // 확장 미설치 — Douyin 페이지를 열지 않고 설정만 안내(사용자는 영상 페이지를 직접 열지 않는다)
      setSave({
        kind: "error",
        text: "브라우저 확장을 설치하면 자동으로 저장됩니다. 아래 ‘처음 한 번만 설정하세요’를 확인하세요.",
      });
      setSetupOpen(true);
    }
  }

  return (
    <div className="min-h-screen bg-background text-text">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-6 py-4">
          <BackButton href="/videos" label="라이브러리" />
          <div className="flex-1" />
          <Link href="/" className="flex items-center gap-2.5" title="홈">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Film size={16} className="text-white" />
            </div>
            <span className="text-lg font-semibold tracking-tight">ClipMiner</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="text-2xl font-semibold tracking-tight">콘텐츠 저장</h1>
        <p className="mt-2 text-base text-subtext">
          Douyin 영상 링크를 붙여넣고 저장하세요. 저장된 영상은 라이브러리에 자동으로 추가됩니다.
        </p>

        {/* 메인 입력 */}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && save.kind !== "saving") handleSave();
            }}
            placeholder="Douyin 영상 링크"
            disabled={save.kind === "saving"}
            className="flex-1 rounded-xl border border-border bg-card px-4 py-3 text-sm text-text placeholder:text-subtext focus:border-primary/60 focus:outline-none disabled:opacity-60"
          />
          <button
            onClick={handleSave}
            disabled={save.kind === "saving"}
            className="flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            {save.kind === "saving" ? (
              <>
                <Loader2 size={16} className="animate-spin" /> 저장 중...
              </>
            ) : (
              "영상 저장하기"
            )}
          </button>
        </div>

        {/* 저장 상태 (사용자 언어) */}
        {save.kind === "saving" && (
          <p className="mt-3 text-sm text-subtext">영상을 저장하고 있어요...</p>
        )}
        {save.kind === "done" && (
          <div className="mt-3 rounded-card border border-primary/30 bg-primary/10 p-4">
            <p className="text-sm text-text">
              <CheckCircle2 size={15} className="-mt-0.5 mr-1 inline" />
              저장 완료! {save.title ? `‘${save.title}’ ` : ""}라이브러리에 추가되었습니다.
            </p>
            <Link
              href="/videos"
              className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90"
            >
              라이브러리 보기 <ArrowRight size={15} />
            </Link>
          </div>
        )}
        {save.kind === "dup" && (
          <div className="mt-3 rounded-card border border-border bg-card p-4 text-sm text-subtext">
            이미 저장된 영상이에요. {save.title ? `‘${save.title}’ ` : ""}라이브러리에 있습니다.
            <Link
              href="/videos"
              className="ml-2 inline-flex items-center gap-1 text-primary hover:underline"
            >
              라이브러리 보기 <ArrowRight size={13} />
            </Link>
          </div>
        )}
        {save.kind === "error" && (
          <div className="mt-3 flex items-start gap-2 rounded-card border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
            <AlertCircle size={15} className="mt-0.5 shrink-0" />
            <span className="break-words">{save.text}</span>
          </div>
        )}

        {/* 상태 (사용자 언어) */}
        <div className="mt-6 flex flex-wrap gap-2 text-sm">
          {wsConnected ? (
            <span className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-primary">
              <CheckCircle2 size={14} /> 작업 폴더 연결됨
            </span>
          ) : (
            <button
              onClick={handleSelectFolder}
              className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-subtext transition-colors hover:border-primary/50 hover:text-text"
            >
              <FolderOpen size={14} /> 작업 폴더를 선택하세요
            </button>
          )}
          {browserReady ? (
            <span className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-primary">
              <CheckCircle2 size={14} /> 브라우저 준비 완료
            </span>
          ) : (
            <button
              onClick={() => setSetupOpen(true)}
              className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-subtext transition-colors hover:border-primary/50 hover:text-text"
            >
              <Package size={14} /> ClipMiner 확장 설치 방법
            </button>
          )}
        </div>

        {/* 처음 한 번만 설정하면 됩니다 (설치 가이드) */}
        <div className="mt-8 rounded-card border border-border bg-card">
          <button
            onClick={() => setSetupOpen((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold text-text"
          >
            <span className="flex items-center gap-2">
              <Puzzle size={16} className="text-primary" /> 처음 한 번만 설정하면 됩니다
            </span>
            <ChevronDown
              size={16}
              className={`text-subtext transition-transform ${setupOpen ? "rotate-180" : ""}`}
            />
          </button>

          {setupOpen && (
            <div className="space-y-5 border-t border-border px-4 py-5">
              {/* STEP 1 — 작업 폴더 */}
              <div className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                  1
                </span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-text">영상을 저장할 폴더를 선택합니다.</p>
                  <p className="mt-0.5 text-xs text-subtext">저장된 영상이 이 폴더에 모입니다.</p>
                  {!wsConnected ? (
                    <button
                      onClick={handleSelectFolder}
                      className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary/90"
                    >
                      <FolderOpen size={13} /> 작업 폴더 선택
                    </button>
                  ) : (
                    <span className="mt-2 inline-flex items-center gap-1 text-xs text-primary">
                      <CheckCircle2 size={13} /> 폴더 연결됨
                    </span>
                  )}
                </div>
              </div>

              {/* STEP 2 — ZIP 다운로드 */}
              <div className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                  2
                </span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-text">ClipMiner 확장 ZIP 파일을 받습니다.</p>
                  <p className="mt-0.5 text-xs text-subtext">받은 ZIP을 압축 해제하면 <b className="text-text">ClipMiner</b> 폴더가 생깁니다.</p>
                  <a
                    href={EXTENSION_ZIP_URL}
                    download
                    className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary/90"
                  >
                    <Download size={13} /> 확장 ZIP 다운로드
                  </a>
                </div>
              </div>

              {/* STEP 3 — chrome://extensions */}
              <div className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                  3
                </span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-text">Chrome 주소창에 입력해 확장 관리 화면을 엽니다.</p>
                  <code className="mt-1.5 inline-block rounded-md bg-background px-2 py-1 text-xs text-primary select-all">
                    chrome://extensions
                  </code>
                </div>
              </div>

              {/* STEP 4 — 개발자 모드 */}
              <div className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                  4
                </span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-text">우측 상단의 <b className="text-text">개발자 모드</b>를 켭니다.</p>
                </div>
              </div>

              {/* STEP 5 — 압축해제된 확장 로드 */}
              <div className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                  5
                </span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-text"><b className="text-text">[압축해제된 확장 프로그램을 로드합니다]</b> 버튼을 누릅니다.</p>
                </div>
              </div>

              {/* STEP 6 — 폴더 선택 */}
              <div className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                  6
                </span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-text">압축을 해제한 <b className="text-text">ClipMiner</b> 폴더를 선택합니다.</p>
                  <p className="mt-0.5 text-xs text-subtext">화면 상단에 <b className="text-text">브라우저 준비 완료</b>가 뜨면 설치 완료입니다.</p>
                </div>
              </div>

              {/* 마무리 강조 */}
              <div className="rounded-xl border border-primary/30 bg-primary/10 px-4 py-3">
                <p className="text-sm font-medium text-text">
                  설치 후에는 영상 링크를 붙여넣고 <b className="text-primary">영상 저장하기</b> 버튼만 누르면 자동으로 저장됩니다.
                </p>
              </div>

              {!supported && (
                <p className="text-xs text-amber-400">
                  이 브라우저는 폴더 저장을 지원하지 않습니다. Chrome·Edge를 사용하세요.
                </p>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
