import Link from "next/link";
import { Film, ArrowRight } from "lucide-react";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center gap-6 px-6 py-24">
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
          <Film size={18} className="text-white" />
        </div>
        <span className="text-sm font-medium uppercase tracking-widest text-subtext">
          ClipMiner
        </span>
      </div>

      <header className="flex flex-col gap-2">
        <h1 className="text-4xl font-semibold tracking-tight text-text">
          ClipMiner Web
        </h1>
        <p className="text-lg text-subtext">
          영상 클립을 모으고, 직접 제목과 태그를 붙여 정리하는 리서치 보드.
        </p>
      </header>

      <section className="rounded-card border border-border bg-card p-4 text-sm text-subtext">
        <p className="font-medium text-text">Local Library</p>
        <p className="mt-1">
          영상 메타데이터·태그·메모·제작 상태를 이 브라우저(IndexedDB)에 저장합니다.
          외부 DB나 로그인 없이 바로 사용할 수 있습니다.
        </p>
      </section>

      <div>
        <Link
          href="/videos"
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-primary/90"
        >
          내 라이브러리 열기
          <ArrowRight size={16} />
        </Link>
      </div>

      <footer className="text-xs text-subtext/60">
        app_key: clipminer · 정식 launch 대상: ClipMiner Web
      </footer>
    </main>
  );
}
