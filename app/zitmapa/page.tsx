import Link from "next/link";

export const metadata = {
  title: "Žitmapa · PSJG Tools",
};

export default function Zitmapa() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
        Žitmapa
      </h1>
      <p className="mt-3 text-foreground/60">This tool is under construction.</p>
      <Link
        href="/"
        className="mt-8 text-sm font-medium text-foreground/70 underline underline-offset-4 hover:text-foreground"
      >
        ← Back to PSJG Tools
      </Link>
    </main>
  );
}
