"use client";

// ClipMiner Web — 콘텐츠 수집 "테스트 런처" + 연결 상태.
// 수집(다운로드)은 Web 버튼이 아니라 **브라우저 확장(ClipMiner Connector)** 에서 실행한다.
// 이 화면은 Douyin 페이지 열기·라이브러리 열기·작업 폴더/확장 상태만 담당한다(직접 다운로드 버튼 없음).
// (cookies.txt 수동 업로드 / 서버 yt-dlp 다운로드 방식은 미채택 — 제거됨)

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Film,
  Puzzle,
  FolderOpen,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  ExternalLink,
  RotateCw,
} from "lucide-react";
import BackButton from "@/components/BackButton";
import {
  isFsAccessSupported,
  getStoredWorkspace,
  pickWorkspace,
  queryWorkspacePermission,
  requestWorkspacePermission,
  type Workspace,
} from "@/lib/workspace";

export default function CollectPage() {
  const [supported, setSupported] = useState(true);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [perm, setPerm] = useState<PermissionState | null>(null);
  const [extReady, setExtReady] = useState(false);
  const [douyinUrl, setDouyinUrl] = useState("");

  function isDouyinUrl(raw: string): boolean {
    try {
      const h = new URL(raw).hostname.replace(/^www\./, "").toLowerCase();
      return h.endsWith("douyin.com") || h.endsWith("iesdouyin.com");
    } catch {
      return false;
    }
  }
  function openDouyin() {
    const u = douyinUrl.trim();
    if (!u) return;
    const url = /^https?:\/\//i.test(u) ? u : `https://${u}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }
  function openLibrary() {
    window.open("/videos", "_blank", "noopener");
  }

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

  // 확장(ClipMiner Connector) 존재 감지: web-bridge가 ready를 알림
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      const d = e.data as { type?: string };
      if (d && d.type === "clipminer:connector-ready") setExtReady(true);
    };
    window.addEventListener("message", onMsg);
    window.postMessage({ type: "clipminer:connector-ping" }, "*");
    const t = setTimeout(() => {
      window.postMessage({ type: "clipminer:connector-ping" }, "*");
    }, 600);
    return () => {
      window.removeEventListener("message", onMsg);
      clearTimeout(t);
    };
  }, []);

  async function handlePick() {
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
  async function handleReauth() {
    if (!workspace) return;
    setPerm(await requestWorkspacePermission(workspace.handle));
  }

  const wsConnected = !!workspace && perm === "granted";

  return (
    <div className="min-h-screen bg-background text-text">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-6 py-4">
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

      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">콘텐츠 수집 — 테스트</h1>
        <p className="mt-2 text-base text-text">
          Douyin 영상 페이지에서 ClipMiner 확장 아이콘을 눌러 수집하세요.
        </p>
        <p className="mt-1 text-sm text-subtext">
          다운로드 성공 후 라이브러리에 자동 등록됩니다. (다운로드 실행은 확장에서 — Web에 다운로드 버튼 없음)
        </p>

        {/* 테스트 순서 */}
        <ol className="mt-6 space-y-1.5 text-sm text-subtext">
          <li>1. <b className="text-text">작업 폴더</b> 연결 (영상 저장 위치)</li>
          <li>2. <b className="text-text">라이브러리(/videos)</b> 탭 열어두기 (자동 등록 수신)</li>
          <li>3. 아래에 <b className="text-text">Douyin URL</b> 입력 → <b className="text-text">Douyin 열기</b></li>
          <li>4. 열린 Douyin 페이지에서 <b className="text-text">ClipMiner 확장 아이콘(패널) 클릭</b></li>
          <li>5. 성공 시 라이브러리에 <b className="text-text">자동 등록</b></li>
        </ol>

        {/* Douyin 테스트 런처 */}
        <div className="mt-6 rounded-card border border-border bg-card p-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-widest text-subtext">
            Douyin 테스트
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={douyinUrl}
              onChange={(e) => setDouyinUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") openDouyin();
              }}
              placeholder="https://www.douyin.com/video/..."
              className="flex-1 rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-text placeholder:text-subtext focus:border-primary/60 focus:outline-none"
            />
            <button
              onClick={openDouyin}
              disabled={!douyinUrl.trim()}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              <ExternalLink size={15} /> Douyin 열기
            </button>
          </div>
          {douyinUrl.trim() !== "" && !isDouyinUrl(douyinUrl) && (
            <p className="mt-1.5 text-xs text-amber-400">
              Douyin URL이 아닌 것 같습니다. (그래도 열기는 가능)
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              onClick={openLibrary}
              className="flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-1.5 text-sm text-subtext transition-colors hover:border-primary/50 hover:text-text"
            >
              <Film size={14} /> 라이브러리 열기
            </button>
            <button
              onClick={() => location.reload()}
              className="flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-1.5 text-sm text-subtext transition-colors hover:border-border/80 hover:text-text"
              title="확장을 새로 로드/업데이트했다면 이 페이지와 /videos 탭을 새로고침하세요"
            >
              <RotateCw size={14} /> 확장 새로고침 안내 (페이지 새로고침)
            </button>
          </div>
          <p className="mt-2 text-xs text-subtext/60">
            확장을 새로 로드/업데이트했다면 <b>이 페이지와 /videos 탭을 새로고침</b>해야 확장이 다시
            주입됩니다. (브리지 연결 오류 시 새로고침)
          </p>
        </div>

        {/* 작업 폴더 연결 상태 */}
        <div className="mt-6">
          <p className="mb-2 text-xs font-medium uppercase tracking-widest text-subtext">작업 폴더</p>
          {!supported ? (
            <StatusCard tone="warn" icon={<AlertCircle size={16} />}
              text="이 브라우저는 작업 폴더(File System Access)를 지원하지 않습니다. Chrome·Edge를 사용하세요." />
          ) : !workspace ? (
            <StatusCard tone="muted" icon={<FolderOpen size={16} />} text="작업 폴더가 선택되지 않았습니다."
              action={<PrimaryBtn onClick={handlePick} icon={<FolderOpen size={15} />} label="작업 폴더 선택" />} />
          ) : wsConnected ? (
            <StatusCard tone="ok" icon={<CheckCircle2 size={16} />}
              text={`연결됨 · ${workspace.name}`} />
          ) : (
            <StatusCard tone="warn" icon={<AlertCircle size={16} />}
              text={`${workspace.name} · 권한 필요`}
              action={<PrimaryBtn onClick={handleReauth} label="권한 다시 허용" />} />
          )}
        </div>

        {/* 확장 연결 상태 */}
        <div className="mt-5">
          <p className="mb-2 text-xs font-medium uppercase tracking-widest text-subtext">브라우저 확장</p>
          {extReady ? (
            <StatusCard tone="ok" icon={<CheckCircle2 size={16} />} text="ClipMiner Connector 확장 연결됨" />
          ) : (
            <StatusCard tone="muted" icon={<Puzzle size={16} />}
              text="확장이 감지되지 않았습니다. ClipMiner Connector를 설치/활성화한 뒤 이 페이지를 새로고침하세요." />
          )}
        </div>

        {/* 라이브러리로 */}
        <div className="mt-8">
          <Link href="/videos"
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary/90">
            라이브러리로 이동 <ArrowRight size={15} />
          </Link>
        </div>
      </main>
    </div>
  );
}

function StatusCard({
  tone,
  icon,
  text,
  action,
}: {
  tone: "ok" | "warn" | "muted";
  icon: React.ReactNode;
  text: string;
  action?: React.ReactNode;
}) {
  const cls =
    tone === "ok"
      ? "border-primary/30 bg-primary/10 text-primary"
      : tone === "warn"
        ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
        : "border-border bg-card text-subtext";
  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 rounded-card border px-4 py-3 text-sm ${cls}`}>
      <span className="flex items-center gap-2.5">
        {icon}
        <span>{text}</span>
      </span>
      {action}
    </div>
  );
}

function PrimaryBtn({
  onClick,
  label,
  icon,
}: {
  onClick: () => void;
  label: string;
  icon?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-primary/90"
    >
      {icon}
      {label}
    </button>
  );
}
