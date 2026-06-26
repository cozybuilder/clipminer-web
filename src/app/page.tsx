import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center gap-6 px-6 py-24">
      <header className="flex flex-col gap-2">
        <span className="text-sm font-medium uppercase tracking-widest text-zinc-400">
          ClipMiner
        </span>
        <h1 className="text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          ClipMiner Web
        </h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400">
          영상 클립을 모으고, 직접 제목과 태그를 붙여 정리하는 웹 앱.
        </p>
      </header>

      <section className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400">
        <p className="font-medium text-zinc-800 dark:text-zinc-200">
          Local Library (MVP)
        </p>
        <p className="mt-1">
          영상 메타데이터·태그·메모·상태를 이 브라우저(IndexedDB)에 저장합니다.
          외부 DB나 로그인 없이 바로 사용할 수 있습니다.
        </p>
      </section>

      <div>
        <Link
          href="/videos"
          className="inline-flex items-center rounded-full bg-zinc-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          내 라이브러리 열기 →
        </Link>
      </div>

      <footer className="text-xs text-zinc-400">
        app_key: clipminer · 정식 launch 대상: ClipMiner Web
      </footer>
    </main>
  );
}
