"use client";

import "leaflet/dist/leaflet.css";
import "./zitmapa.css";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { Upload, Share2, Search, MapPin, FileSpreadsheet, X, Check, Loader2, GraduationCap, SkipForward, RotateCcw, Plus, Trash2, List, Home } from "lucide-react";
import {
  parseExcel,
  parseDocx,
  parsePdf,
  geocodeAll,
  decodeShareData,
  encodeShareData,
  colorForCategory,
  haversineKm,
  type LocationRow,
} from "./lib/map-utils";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Sheet, SheetContent, SheetTrigger } from "./components/ui/sheet";
import { toast, Toaster } from "sonner";
import type { QuizFeedback } from "./components/map-view";

const QUIZ_TOLERANCE_KM = 600;

const MapView = dynamic(() => import("./components/map-view"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-muted-foreground">Načítám mapu…</div>
  ),
});

export default function ZitmapaApp() {
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Quiz state
  type QuizState = {
    active: boolean;
    order: string[]; // location ids in shuffled order
    index: number;
    correct: number;
    wrong: number;
    radiusKm: number;
    feedback: QuizFeedback | null;
    finished: boolean;
  };
  const [quiz, setQuiz] = useState<QuizState>({
    active: false,
    order: [],
    index: 0,
    correct: 0,
    wrong: 0,
    radiusKm: QUIZ_TOLERANCE_KM,
    feedback: null,
    finished: false,
  });
  const [addMode, setAddMode] = useState<{ name: string } | null>(null);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.startsWith("#d=")) {
      const decoded = decodeShareData(hash.slice(3));
      if (decoded && decoded.length) {
        // One-time sync from the URL (an external source), not derived from props/state.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLocations(decoded);
        toast.success(`Načteno ${decoded.length} sdílených lokací`);
      }
    }
  }, []);

  const categories = useMemo(
    () => Array.from(new Set(locations.map((l) => l.category).filter(Boolean))) as string[],
    [locations],
  );

  const filtered = useMemo(() => {
    return locations.filter((l) => {
      if (activeCat && l.category !== activeCat) return false;
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        l.name.toLowerCase().includes(q) ||
        l.address?.toLowerCase().includes(q) ||
        l.description?.toLowerCase().includes(q)
      );
    });
  }, [locations, search, activeCat]);

  async function handleFile(file: File) {
    if (!file.name.match(/\.(xlsx|xls|docx|pdf)$/i)) {
      toast.error("Nahrajte prosím soubor .xlsx, .xls, .docx nebo .pdf");
      return;
    }
    setLoading(true);
    try {
      const buf = await file.arrayBuffer();
      const rows = file.name.match(/\.pdf$/i)
        ? await parsePdf(buf)
        : file.name.match(/\.docx$/i)
        ? await parseDocx(buf)
        : parseExcel(buf);
      if (!rows.length) {
        toast.error("V souboru nebyly nalezeny žádné položky");
        return;
      }
      setLocations(rows);
      const needs = rows.filter((r) => (r.lat === undefined || r.lng === undefined) && r.address).length;
      if (needs > 0) {
        setProgress({ done: 0, total: needs });
        toast.info(`Vyhledávám ${needs} lokací (~1 s na lokaci)…`);
        await geocodeAll(rows, (done, total) => setProgress({ done, total }));
        setLocations([...rows]);
      }
      const placed = rows.filter((r) => r.lat !== undefined && r.lng !== undefined).length;
      toast.success(`Na mapě umístěno ${placed} z ${rows.length} lokací`);
    } catch (e) {
      toast.error("Soubor se nepodařilo načíst");
      console.error(e);
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }

  function share() {
    const placed = locations.filter((l) => l.lat !== undefined && l.lng !== undefined);
    if (!placed.length) {
      toast.error("Žádné umístěné lokace ke sdílení");
      return;
    }
    const encoded = encodeShareData(locations);
    const url = `${window.location.origin}${window.location.pathname}#d=${encoded}`;
    if (url.length > 8000) {
      toast.warning("Dataset je velký, odkaz nemusí všude fungovat");
    }
    navigator.clipboard.writeText(url).then(
      () => toast.success("Odkaz pro sdílení zkopírován do schránky"),
      () => toast.error("Odkaz se nepodařilo zkopírovat"),
    );
    window.history.replaceState(null, "", `#d=${encoded}`);
  }

  const hasData = locations.length > 0;
  const placedLocations = useMemo(() => locations.filter((l) => l.lat !== undefined && l.lng !== undefined), [locations]);
  const canQuiz = placedLocations.length >= 2;

  function startQuiz() {
    if (!canQuiz) {
      toast.error("Pro kvíz jsou potřeba alespoň 2 umístěné lokace");
      return;
    }
    const ids = placedLocations.map((l) => l.id);
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    setQuiz({ active: true, order: ids, index: 0, correct: 0, wrong: 0, radiusKm: QUIZ_TOLERANCE_KM, feedback: null, finished: false });
    setFocusId(null);
    setSearch("");
    setActiveCat(null);
    setAddMode(null);
  }

  function moveLocation(id: string, lat: number, lng: number) {
    setLocations((prev) => prev.map((l) => (l.id === id ? { ...l, lat, lng } : l)));
    toast.success("Pozice upravena");
  }

  function deleteLocation(id: string) {
    setLocations((prev) => prev.filter((l) => l.id !== id));
    if (focusId === id) setFocusId(null);
  }

  function goHome() {
    setLocations([]);
    setQuiz({ active: false, order: [], index: 0, correct: 0, wrong: 0, radiusKm: QUIZ_TOLERANCE_KM, feedback: null, finished: false });
    setAddMode(null);
    setSearch("");
    setActiveCat(null);
    setFocusId(null);
    if (window.location.hash) window.history.replaceState(null, "", window.location.pathname);
  }

  function startAdd() {
    const name = window.prompt("Název nové lokace:");
    if (!name || !name.trim()) return;
    setAddMode({ name: name.trim() });
    toast.info("Klikněte na mapu pro umístění lokace");
  }

  function handleMapClick(lat: number, lng: number) {
    if (quiz.active) {
      handleQuizClick(lat, lng);
      return;
    }
    if (addMode) {
      const newLoc: LocationRow = {
        // Only invoked from the map's click handler (a user event), never during render.
        // eslint-disable-next-line react-hooks/purity
        id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: addMode.name,
        lat,
        lng,
        extra: { manual: true },
      };
      setLocations((prev) => [...prev, newLoc]);
      setAddMode(null);
      setFocusId(newLoc.id);
      toast.success(`Přidáno: ${newLoc.name}`);
    }
  }

  function exitQuiz() {
    setQuiz((q) => ({ ...q, active: false, feedback: null, finished: false }));
  }

  function handleQuizClick(lat: number, lng: number) {
    if (!quiz.active || quiz.feedback || quiz.finished) return;
    const loc = locations.find((l) => l.id === quiz.order[quiz.index]);
    if (!loc || loc.lat === undefined || loc.lng === undefined) return;
    const dist = haversineKm({ lat, lng }, { lat: loc.lat, lng: loc.lng });
    const correct = dist <= quiz.radiusKm;
    setQuiz((q) => ({
      ...q,
      correct: q.correct + (correct ? 1 : 0),
      wrong: q.wrong + (correct ? 0 : 1),
      feedback: {
        guess: { lat, lng },
        actual: { lat: loc.lat!, lng: loc.lng! },
        radiusKm: q.radiusKm,
        correct,
        name: loc.name,
      },
    }));
  }

  function nextQuestion() {
    setQuiz((q) => {
      const next = q.index + 1;
      if (next >= q.order.length) {
        return { ...q, feedback: null, finished: true };
      }
      return { ...q, index: next, feedback: null };
    });
  }

  return (
    <div className="zitmapa-app flex h-screen w-full flex-col bg-background">
      <Toaster position="top-right" richColors />

      <header className="flex items-center justify-between gap-2 border-b border-border bg-card/80 px-3 py-3 backdrop-blur sm:px-6">
        <Link href="/zitmapa" onClick={() => goHome()} className="flex min-w-0 cursor-pointer items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-foreground text-background">
            <MapPin className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold text-foreground">ŽitMapa</h1>
            <p className="hidden text-xs text-muted-foreground sm:block">Excel → interaktivní mapa</p>
          </div>
        </Link>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <Button variant="outline" size="sm" onClick={goHome} aria-label="Domů" className="px-2 sm:px-3">
            <Home className="h-3.5 w-3.5 sm:mr-1.5" /> <span className="hidden sm:inline">Domů</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={loading} aria-label="Nahrát" className="px-2 sm:px-3">
            <Upload className="h-3.5 w-3.5 sm:mr-1.5" /> <span className="hidden sm:inline">Nahrát</span>
          </Button>
          <Button variant="outline" size="sm" onClick={startAdd} disabled={loading || quiz.active} aria-label="Přidat" className="px-2 sm:px-3">
            <Plus className="h-3.5 w-3.5 sm:mr-1.5" /> <span className="hidden sm:inline">Přidat</span>
          </Button>
          <Button variant="outline" size="sm" onClick={startQuiz} disabled={!canQuiz || quiz.active} aria-label="Kvíz" className="px-2 sm:px-3">
            <GraduationCap className="h-3.5 w-3.5 sm:mr-1.5" /> <span className="hidden sm:inline">Kvíz</span>
          </Button>
          <Button size="sm" onClick={share} disabled={!hasData} aria-label="Sdílet" className="px-2 sm:px-3">
            <Share2 className="h-3.5 w-3.5 sm:mr-1.5" /> <span className="hidden sm:inline">Sdílet</span>
          </Button>

          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.docx,.pdf"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
        </div>
      </header>

      {!hasData ? (
        <div className="flex flex-1 items-start justify-center overflow-y-auto p-4 sm:items-center sm:p-6">
          <div className="w-full max-w-4xl">
            {/* Hero */}
            <div className="mb-6 text-center sm:mb-10">
              <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-[11px] text-muted-foreground sm:mb-5 sm:text-xs">
                <span className="h-1.5 w-1.5 rounded-full bg-foreground" />
                Excel → interaktivní mapa → kvíz
              </div>
              <h1 className="mb-3 text-4xl font-bold tracking-tight text-foreground sm:mb-4 sm:text-6xl">
                ŽitMapa
              </h1>
              <p className="mx-auto max-w-xl text-sm text-muted-foreground sm:text-base">
                Nahrajte tabulku se seznamem míst (řek, hor, ostrovů, měst…) a my je během chvilky
                najdeme, zobrazíme na mapě a můžete se z nich vyzkoušet.
              </p>
            </div>

            {/* Flow graphic */}
            <div className="mb-6 grid grid-cols-1 gap-3 sm:mb-10 sm:grid-cols-3 sm:gap-4">
              {[
                {
                  icon: <FileSpreadsheet className="h-6 w-6 sm:h-7 sm:w-7" />,
                  title: "1. Nahrajte seznam",
                  desc: "Excel (.xlsx), Word (.docx) nebo PDF se seznamem názvů.",
                },
                {
                  icon: <MapPin className="h-6 w-6 sm:h-7 sm:w-7" />,
                  title: "2. Mapa hned",
                  desc: "Najdeme souřadnice a vykreslíme značky s popisky.",
                },
                {
                  icon: <GraduationCap className="h-6 w-6 sm:h-7 sm:w-7" />,
                  title: "3. Vyzkoušejte se",
                  desc: "Kvíz: klikejte naslepo do mapy a počítáme úspěšnost.",
                },
              ].map((s, i) => (
                <div
                  key={i}
                  className="relative flex items-center gap-4 rounded-2xl border border-border bg-card p-4 transition-all hover:border-foreground/40 sm:block sm:p-5"
                >
                  <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-foreground sm:mb-3 sm:h-11 sm:w-11">
                    {s.icon}
                  </div>
                  <div className="min-w-0">
                    <div className="mb-0.5 text-sm font-semibold text-foreground sm:mb-1">{s.title}</div>
                    <div className="text-xs text-muted-foreground">{s.desc}</div>
                  </div>
                  {i < 2 && (
                    <div className="pointer-events-none absolute right-[-12px] top-1/2 hidden h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background text-muted-foreground sm:flex">
                      →
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Drop zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const f = e.dataTransfer.files[0];
                if (f) handleFile(f);
              }}
              className={`group relative mx-auto w-full max-w-2xl rounded-3xl border-2 border-dashed p-6 text-center transition-all sm:p-10 ${
                dragOver
                  ? "border-foreground bg-accent scale-[1.01]"
                  : "border-border bg-card hover:border-foreground/40"
              }`}
            >
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent sm:mb-5 sm:h-14 sm:w-14">
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-foreground sm:h-6 sm:w-6" />
                ) : (
                  <Upload className="h-5 w-5 text-foreground sm:h-6 sm:w-6" />
                )}
              </div>
              <h2 className="mb-2 text-lg font-semibold tracking-tight text-foreground sm:text-xl">
                {loading ? "Zpracovávám soubor…" : "Přetáhněte soubor sem"}
              </h2>
              <p className="mb-5 text-xs text-muted-foreground sm:text-sm">
                {progress
                  ? `Vyhledávám ${progress.done} z ${progress.total} lokací…`
                  : "Podporuje .xlsx, .xls, .docx a .pdf. Zpracování probíhá ve vašem prohlížeči."}
              </p>
              {progress && (
                <div className="mx-auto mb-5 h-1.5 max-w-xs overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-foreground transition-all"
                    style={{ width: `${(progress.done / progress.total) * 100}%` }}
                  />
                </div>
              )}
              <Button size="lg" onClick={() => fileRef.current?.click()} disabled={loading}>
                <Upload className="mr-2 h-4 w-4" /> Nahrát soubor
              </Button>
            </div>
            <p className="mx-auto mt-5 max-w-2xl text-center text-xs text-muted-foreground">
              Upozornění: Mapa není 100% přesná a může obsahovat chyby. Pro jistotu doporučujeme
              zkontrolovat polohu v atlase.
            </p>
            <div className="mt-8 flex justify-center">
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground/70">reddos</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          {(() => {
            const sidebarContent = quiz.active ? (
              <QuizPanel
                quiz={quiz}
                total={placedLocations.length}
                currentName={
                  quiz.finished
                    ? ""
                    : (locations.find((l) => l.id === quiz.order[quiz.index])?.name ?? "")
                }
                onRadiusChange={(r) => setQuiz((q) => ({ ...q, radiusKm: r }))}
                onNext={nextQuestion}
                onExit={exitQuiz}
                onRestart={startQuiz}
              />
            ) : (
              <>
                <div className="border-b border-border p-3">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Hledat lokace…"
                      className="pl-9"
                    />
                  </div>
                  {categories.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <button
                        onClick={() => setActiveCat(null)}
                        className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
                          !activeCat ? "bg-foreground text-background" : "bg-accent text-foreground hover:bg-accent/70"
                        }`}
                      >
                        Vše ({locations.length})
                      </button>
                      {categories.map((c) => (
                        <button
                          key={c}
                          onClick={() => setActiveCat(c === activeCat ? null : c)}
                          className="flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-xs text-foreground transition-colors hover:bg-accent/70"
                          style={
                            activeCat === c
                              ? { background: colorForCategory(c, categories), color: "white" }
                              : undefined
                          }
                        >
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ background: colorForCategory(c, categories) }}
                          />
                          {c}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto">
                  {filtered.length === 0 ? (
                    <div className="p-6 text-center text-sm text-muted-foreground">Žádné výsledky</div>
                  ) : (
                    filtered.map((loc) => {
                      const placed = loc.lat !== undefined && loc.lng !== undefined;
                      return (
                        <div
                          key={loc.id}
                          className={`group flex items-start gap-2 border-b border-border px-4 py-3 transition-colors hover:bg-accent ${
                            focusId === loc.id ? "bg-accent" : ""
                          } ${!placed ? "opacity-60" : ""}`}
                        >
                          <span
                            className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                            style={{ background: colorForCategory(loc.category, categories) }}
                          />
                          <button
                            onClick={() => {
                              if (placed) {
                                setFocusId(loc.id);
                                setMobileSidebarOpen(false);
                              }
                            }}
                            className="min-w-0 flex-1 text-left"
                          >
                            <div className="truncate text-sm font-medium text-foreground">{loc.name}</div>
                            {loc.address && (
                              <div className="truncate text-xs text-muted-foreground">{loc.address}</div>
                            )}
                            {loc.category && (
                              <div className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                                {loc.category}
                              </div>
                            )}
                          </button>
                          {placed ? (
                            <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          ) : (
                            <X className="mt-1 h-3.5 w-3.5 shrink-0 text-destructive" />
                          )}
                          <button
                            onClick={() => deleteLocation(loc.id)}
                            className="mt-0.5 rounded p-1 text-muted-foreground transition-opacity hover:bg-destructive/10 hover:text-destructive sm:opacity-0 sm:group-hover:opacity-100"
                            title="Smazat"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
                <div className="border-t border-border p-3 text-xs text-muted-foreground">
                  {addMode ? (
                    <span className="text-foreground">Klikněte na mapu pro umístění „{addMode.name}&quot;.</span>
                  ) : (
                    <>
                      Na mapě {placedLocations.length} z {locations.length}. Značky lze přetáhnout.
                    </>
                  )}
                </div>
              </>
            );

            return (
              <>
                <aside className="hidden w-80 shrink-0 flex-col border-r border-border bg-card sm:flex">
                  {sidebarContent}
                </aside>
                <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
                  <SheetContent side="left" className="flex w-[88vw] max-w-sm flex-col gap-0 bg-card p-0 sm:hidden">
                    {sidebarContent}
                  </SheetContent>
                </Sheet>
              </>
            );
          })()}

          <main className="relative flex-1">
            <MapView
              locations={quiz.active ? [] : filtered}
              onSelect={(l) => setFocusId(l.id)}
              focusId={focusId}
              quizMode={quiz.active && !quiz.finished}
              addMode={!!addMode && !quiz.active}
              onMapClick={handleMapClick}
              onMove={quiz.active ? undefined : moveLocation}
              feedback={quiz.feedback}
            />
            <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
              <SheetTrigger asChild>
                <Button
                  size="sm"
                  variant="secondary"
                  className="absolute left-3 top-3 z-[400] shadow-md sm:hidden"
                  aria-label={quiz.active ? "Otevřít kvíz" : "Otevřít seznam"}
                >
                  {quiz.active ? <GraduationCap className="h-4 w-4" /> : <List className="h-4 w-4" />}
                  <span className="ml-1.5 text-xs">{quiz.active ? "Kvíz" : `${placedLocations.length}/${locations.length}`}</span>
                </Button>
              </SheetTrigger>
            </Sheet>
            {quiz.active && !quiz.finished && (
              <div className="pointer-events-none absolute left-1/2 top-4 z-[400] -translate-x-1/2 rounded-2xl bg-card/95 px-4 py-2 shadow-lg backdrop-blur sm:px-6 sm:py-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground sm:text-xs">
                  Otázka {quiz.index + 1} / {quiz.order.length}
                </div>
                <div className="mt-0.5 text-center text-base font-semibold text-foreground sm:text-lg">
                  {locations.find((l) => l.id === quiz.order[quiz.index])?.name}
                </div>
              </div>
            )}
          </main>
        </div>
      )}
    </div>
  );
}

interface QuizPanelProps {
  quiz: {
    active: boolean;
    order: string[];
    index: number;
    correct: number;
    wrong: number;
    radiusKm: number;
    feedback: QuizFeedback | null;
    finished: boolean;
  };
  total: number;
  currentName: string;
  onRadiusChange: (r: number) => void;
  onNext: () => void;
  onExit: () => void;
  onRestart: () => void;
}

function QuizPanel({ quiz, total, currentName, onNext, onExit, onRestart }: QuizPanelProps) {
  const answered = quiz.correct + quiz.wrong;
  const percent = total > 0 ? Math.round((quiz.correct / total) * 100) : 0;

  if (quiz.finished) {
    return (
      <div className="flex h-full flex-col">
        <div className="border-b border-border p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Kvíz dokončen</h3>
            <Button size="sm" variant="ghost" onClick={onExit}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
          <div className="text-6xl font-bold tracking-tight text-foreground">{percent}%</div>
          <div className="text-sm text-muted-foreground">
            {quiz.correct} správně z {total}
          </div>
          <div className="flex w-full max-w-[180px] gap-2 pt-2">
            <Button className="flex-1" onClick={onRestart}>
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Znovu
            </Button>
            <Button className="flex-1" variant="outline" onClick={onExit}>
              Konec
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <GraduationCap className="h-4 w-4" />
            Kvíz
          </div>
          <Button size="sm" variant="ghost" onClick={onExit}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="mt-3 text-xs text-muted-foreground">Najděte na mapě:</div>
        <div className="mt-1 text-lg font-semibold leading-tight text-foreground">{currentName}</div>
      </div>

      <div className="border-b border-border p-4">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Tolerance</span>
          <span className="font-medium text-foreground">{quiz.radiusKm} km</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {quiz.feedback ? (
          <div className="space-y-3">
            <div
              className={`rounded-xl border p-4 ${
                quiz.feedback.correct
                  ? "border-green-500/30 bg-green-500/10"
                  : "border-red-500/30 bg-red-500/10"
              }`}
            >
              <div className="text-sm font-semibold text-foreground">
                {quiz.feedback.correct ? "Správně!" : "Mimo"}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                Vzdálenost: {Math.round(haversineKm(quiz.feedback.guess, quiz.feedback.actual))} km
              </div>
              <div className="text-xs text-muted-foreground">Tolerance: {quiz.feedback.radiusKm} km</div>
            </div>
            <Button className="w-full" onClick={onNext}>
              <SkipForward className="mr-1.5 h-3.5 w-3.5" />
              {quiz.index + 1 >= quiz.order.length ? "Zobrazit výsledek" : "Další otázka"}
            </Button>
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">
            Klikněte na mapu na místo, kde se podle vás lokace nachází.
          </div>
        )}
      </div>

      <div className="border-t border-border p-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Skóre</span>
          <span className="font-medium text-foreground">
            {quiz.correct} / {answered} ({total > 0 ? Math.round((quiz.correct / total) * 100) : 0}%)
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-foreground transition-all"
            style={{ width: `${total > 0 ? (answered / total) * 100 : 0}%` }}
          />
        </div>
      </div>
    </div>
  );
}
