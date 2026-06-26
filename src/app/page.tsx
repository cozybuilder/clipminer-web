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
          Phase 1 — Next.js 초기화 완료
        </p>
        <p className="mt-1">
          현재는 기본 골격만 구성된 상태입니다. 수집 · 인증 · 데이터 연동 기능은
          이후 단계에서 추가됩니다.
        </p>
      </section>

      <footer className="text-xs text-zinc-400">
        app_key: clipminer · 정식 launch 대상: ClipMiner Web
      </footer>
    </main>
  );
}
