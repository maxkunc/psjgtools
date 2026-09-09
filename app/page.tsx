import Link from "next/link";

function PlaceholderTile({
  area,
  tint,
  icon,
}: {
  area: string;
  tint: string;
  icon: React.ReactNode;
}) {
  return (
    <div
      className={`area-${area} ${tint} relative flex flex-col justify-between rounded-3xl border-2 border-dashed border-black/10 p-6 dark:border-white/10`}
    >
      <span className="absolute right-5 top-5 rounded-full bg-black/5 px-3 py-1 text-xs font-medium text-black/50 dark:bg-white/10 dark:text-white/50">
        Coming soon
      </span>
      <div className="text-black/30 dark:text-white/25">{icon}</div>
      <div>
        <h3 className="text-lg font-semibold text-black/40 dark:text-white/40">
          New tool
        </h3>
        <p className="mt-1 text-sm text-black/30 dark:text-white/30">
          A tool will land here soon.
        </p>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-16 sm:py-24">
      <h1 className="text-center text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
        PSJG Tools
      </h1>
      <p className="mx-auto mt-3 max-w-md text-center text-base text-foreground/60">
        A growing collection of small, handy tools.
      </p>

      <div className="bento-grid mt-12">
        <Link
          href="/zitmapa"
          className="area-zitmapa group relative flex flex-col justify-between overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 to-indigo-500 p-6 text-white shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-lg sm:p-8"
        >
          <span className="absolute right-5 top-5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur-sm">
            Live
          </span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            className="h-10 w-10 opacity-90"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
            />
          </svg>
          <div>
            <h2 className="text-2xl font-semibold sm:text-3xl">Žitmapa</h2>
            <p className="mt-2 max-w-xs text-sm text-white/80">
              A useful tool for Žitná’s map remembering assignments.
            </p>
          </div>
        </Link>

        <PlaceholderTile
          area="sched"
          tint="bg-rose-50 dark:bg-rose-950/30"
          icon={
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              className="h-8 w-8"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6.75 3v2.25M17.25 3v2.25M3.75 18.75V7.5a2.25 2.25 0 012.25-2.25h12a2.25 2.25 0 012.25 2.25v11.25m-16.5 0A2.25 2.25 0 006 21h12a2.25 2.25 0 002.25-2.25m-16.5 0V11.25a2.25 2.25 0 012.25-2.25h12a2.25 2.25 0 012.25 2.25v7.5"
              />
            </svg>
          }
        />

        <PlaceholderTile
          area="wallet"
          tint="bg-lime-50 dark:bg-lime-950/30"
          icon={
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              className="h-8 w-8"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9v3"
              />
            </svg>
          }
        />

        <PlaceholderTile
          area="inbox"
          tint="bg-amber-50 dark:bg-amber-950/30"
          icon={
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              className="h-8 w-8"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 9.75h4.5l1.5 3h4.5l1.5-3h4.5M3.75 9.75l1.263-4.673A1.5 1.5 0 016.462 4h11.076a1.5 1.5 0 011.449 1.077L20.25 9.75M3.75 9.75v8.25A1.5 1.5 0 005.25 19.5h13.5a1.5 1.5 0 001.5-1.5V9.75"
              />
            </svg>
          }
        />

        <PlaceholderTile
          area="gifts"
          tint="bg-orange-50 dark:bg-orange-950/30"
          icon={
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              className="h-8 w-8"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H4.5a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 1014.625 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 109.375 7.5H12m0 0V21m-9-9.75h18a.75.75 0 00.75-.75V8.25a.75.75 0 00-.75-.75H3a.75.75 0 00-.75.75v2.25c0 .414.336.75.75.75z"
              />
            </svg>
          }
        />

        <a
          href="https://openschoolsucks-xjlu.onrender.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="area-remind group relative flex flex-col justify-between overflow-hidden rounded-3xl bg-gradient-to-br from-sky-500 to-blue-600 p-6 text-white shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-lg"
        >
          <span className="absolute right-5 top-5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur-sm">
            Live
          </span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            className="h-8 w-8 opacity-90"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.62 48.62 0 0112 20.904a48.62 48.62 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.636 50.636 0 00-2.658-.813A59.906 59.906 0 0112 3.493a59.903 59.903 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5"
            />
          </svg>
          <div>
            <h2 className="text-lg font-semibold">is psjg</h2>
            <p className="mt-1 text-sm text-white/80">
              Redesigned system for grading, portfolio and exam planning.
            </p>
          </div>
        </a>
      </div>
    </main>
  );
}
