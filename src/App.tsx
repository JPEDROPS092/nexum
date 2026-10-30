import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Braces, Check, ChevronLeft, ChevronRight, CircleHelp, Code2, FileText, FunctionSquare, Globe2, Layers3, Library, LoaderCircle, Menu, Network, Pause, Play, Plus, RotateCcw, Search, Sparkles, X } from "lucide-react";
import SceneCanvas from "@/components/SceneCanvas";
import NewTrailDialog from "@/components/NewTrailDialog";
import { localizedSample, sampleLessons } from "@/data/samples";
import { trpc } from "@/providers/trpc";
import type { Language, Lesson } from "@contracts/lesson";
import { copy, type UiLanguage } from "@/lib/i18n";

const getWorkspace = () => {
  const key = "nexum-workspace";
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const id = crypto.randomUUID(); localStorage.setItem(key, id); return id;
};

export default function App() {
  const [language, setLanguage] = useState<UiLanguage>(() => localStorage.getItem("nexum-language") === "en" ? "en" : "pt");
  const t = copy[language];
  const workspaceId = useMemo(getWorkspace, []);
  const [view, setView] = useState<"studio" | "library">("studio");
  const [lesson, setLesson] = useState<Lesson>(() => localizedSample(sampleLessons[0], language));
  const [stepIndex, setStepIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [howOpen, setHowOpen] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [sceneTab, setSceneTab] = useState<"scene" | "code">("scene");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "matematica" | "codigo">("all");
  const [toast, setToast] = useState("");
  const [parameters, setParameters] = useState<Record<string, number>>({});
  const utils = trpc.useUtils();
  const trailsQuery = trpc.trails.list.useQuery({ workspaceId });
  const saveProgress = trpc.trails.saveProgress.useMutation();
  const narrativeRef = useRef<HTMLDivElement>(null);
  const step = lesson.steps[stepIndex];
  const samples = useMemo(() => sampleLessons.map(item => localizedSample(item, language)), [language]);

  const selectLesson = useCallback((next: Lesson) => {
    setLesson(next); setStepIndex(0); setPlaying(false); setSceneTab("scene");
    setParameters(Object.fromEntries(next.parameters.map(p => [p.id, p.value])));
    setView("studio"); setMobileMenu(false); window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);
  const openGenerated = async (id: string) => {
    try { const result = await utils.trails.get.fetch({ workspaceId, id }); selectLesson(result); }
    catch { setToast(language === "pt" ? "Não foi possível abrir a trilha." : "Could not open the trail."); }
  };
  const goTo = useCallback((index: number) => {
    const next = Math.max(0, Math.min(lesson.steps.length - 1, index));
    setStepIndex(next); setPlaying(false);
    if (!lesson.id.startsWith("sample-")) saveProgress.mutate({ workspaceId, trailId: lesson.id, stepIndex: next });
  }, [lesson, workspaceId]);

  useEffect(() => { localStorage.setItem("nexum-language", language); document.documentElement.lang = language === "pt" ? "pt-BR" : "en"; }, [language]);
  useEffect(() => { setParameters(Object.fromEntries(lesson.parameters.map(p => [p.id, p.value]))); }, [lesson.id]);
  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => {
      if (stepIndex < lesson.steps.length - 1) setStepIndex(i => i + 1);
      else setPlaying(false);
    }, step.duration * 1000 / speed);
    return () => window.clearTimeout(timer);
  }, [playing, stepIndex, step.duration, speed, lesson.steps.length]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (createOpen || howOpen || /^(INPUT|TEXTAREA|SELECT)$/.test((event.target as HTMLElement).tagName)) return;
      if (event.key === "ArrowRight") { event.preventDefault(); goTo(stepIndex + 1); }
      if (event.key === "ArrowLeft") { event.preventDefault(); goTo(stepIndex - 1); }
      if (event.key === " ") { event.preventDefault(); setPlaying(p => !p); }
      if (event.key.toLowerCase() === "r") { setStepIndex(0); setPlaying(false); }
    };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, [stepIndex, goTo, createOpen, howOpen]);
  useEffect(() => { if (!toast) return; const id = window.setTimeout(() => setToast(""), 4500); return () => clearTimeout(id); }, [toast]);

  const generatedSummaries = trailsQuery.data || [];
  const allLibrary = [
    ...generatedSummaries.map(item => ({ ...item, sample: false })),
    ...samples.map(item => ({ id: item.id, title: item.title, topic: item.topic, description: item.description, language: item.language, level: item.level, category: item.category, stepCount: item.steps.length, createdAt: item.createdAt, sample: true })),
  ];
  const filtered = allLibrary.filter(item => (filter === "all" || item.category === filter) && `${item.title} ${item.topic}`.toLowerCase().includes(search.toLowerCase()));
  const openLibraryItem = (id: string) => id.startsWith("sample-") ? selectLesson(samples.find(item => item.id === id)!) : openGenerated(id);
  const agents = [[BookOpen, t.researcher, t.researcherRole, "01"], [Network, t.architect, t.architectRole, "02"], [Sparkles, t.director, t.directorRole, "03"], [Check, t.reviewer, t.reviewerRole, "04"]] as const;

  return <div className="nexum-app">
    <header className="topbar">
      <button className="brand" onClick={() => setView("studio")} aria-label="Nexum"><span className="brand-mark"><i /><i /><i /></span><span>nexum<span className="brand-slash">/</span></span></button>
      <nav className="main-nav" aria-label="Principal"><button className={view === "studio" ? "active" : ""} onClick={() => setView("studio")}><Layers3 size={16} />{t.studio}</button><button className={view === "library" ? "active" : ""} onClick={() => setView("library")}><Library size={16} />{t.library}</button></nav>
      <div className="topbar-right"><span className="system-badge"><i />{t.model}</span><button className="how-button" onClick={() => setHowOpen(true)}><CircleHelp size={16} />{t.how}</button><div className="language-switch" aria-label={t.selectLanguage}><Globe2 size={15} /><select value={language} onChange={e => { const lang = e.target.value as UiLanguage; setLanguage(lang); if (lesson.id.startsWith("sample-")) { const original = sampleLessons.find(item => item.id === lesson.id)!; setLesson(localizedSample(original, lang)); } }} aria-label={t.selectLanguage}><option value="pt">PT</option><option value="en">EN</option></select></div><button className="mobile-menu icon-button" onClick={() => setMobileMenu(v => !v)} aria-label={t.menu}>{mobileMenu ? <X size={20} /> : <Menu size={20} />}</button></div>
    </header>

    {view === "studio" ? <div className="studio-shell">
      <aside className={`trail-rail ${mobileMenu ? "mobile-open" : ""}`}>
        <button className="new-trail-button" onClick={() => setCreateOpen(true)}><Plus size={18} />{t.newTrail}<span>⌘ N</span></button>
        <div className="rail-section"><div className="rail-heading"><span>{t.yourTrails}</span><button onClick={() => setView("library")} aria-label={t.openLibrary}><ArrowRight size={14} /></button></div>
          {trailsQuery.isPending ? <div className="rail-loading"><LoaderCircle className="spin" size={16} /></div> : generatedSummaries.length === 0 ? <p className="rail-empty">{t.noTrails}</p> : generatedSummaries.slice(0, 5).map(item => <button className={`trail-link ${lesson.id === item.id ? "active" : ""}`} key={item.id} onClick={() => openGenerated(item.id)}><span className="trail-icon">{item.category === "codigo" ? <Code2 size={15} /> : <FunctionSquare size={15} />}</span><span><strong>{item.title}</strong><small>{item.stepCount} {t.steps} · {item.language.toUpperCase()}</small></span></button>)}
        </div>
        <div className="rail-section examples"><div className="rail-heading"><span>{t.examples.toUpperCase()}</span></div>{samples.map(item => <button className={`trail-link ${lesson.id === item.id ? "active" : ""}`} key={item.id} onClick={() => selectLesson(item)}><span className="trail-icon">{item.category === "codigo" ? <Code2 size={15} /> : <FunctionSquare size={15} />}</span><span><strong>{item.title}</strong><small>{item.steps.length} {t.steps} · {t.sample}</small></span></button>)}</div>
        <div className="rail-bottom"><div className="workspace-dot"><span>N</span><div><strong>{t.noAccount}</strong><small>{t.workspaceHint}</small></div></div></div>
      </aside>
      {mobileMenu && <button className="rail-scrim" onClick={() => setMobileMenu(false)} aria-label={t.close} />}

      <main className="lesson-workspace">
        <div className="lesson-topline"><div><span className="content-tag">{lesson.category === "codigo" ? <Code2 size={13} /> : <FunctionSquare size={13} />}{lesson.category === "codigo" ? t.coding : t.math}</span><span className="level-label">{lesson.level === "iniciante" ? t.beginner : lesson.level === "intermediario" ? t.intermediate : t.advanced}</span></div><span className="lesson-duration">{lesson.duration} · {lesson.steps.length} {t.steps}</span></div>
        <div className="learning-grid">
          <section className="narrative-panel" ref={narrativeRef}>
            <div className="lesson-heading"><span className="eyebrow">{lesson.topic}</span><h1>{lesson.title}</h1><p>{lesson.description}</p></div>
            <div className="active-narrative" key={`${lesson.id}-${stepIndex}`}><div className="step-kicker"><span>{t.step} {String(stepIndex + 1).padStart(2, "0")}</span><span>{t.of} {String(lesson.steps.length).padStart(2, "0")}</span></div><h2>{step.title}</h2><p className="step-body">{step.body}</p>{step.formula && <div className="formula-block"><span>ƒ</span><code>{step.formula}</code></div>}{step.insight && <div className="insight"><Sparkles size={16} /><p>{step.insight}</p></div>}</div>
            <div className="step-outline">{lesson.steps.map((item, index) => <button key={item.id} className={index === stepIndex ? "active" : index < stepIndex ? "done" : ""} onClick={() => goTo(index)}><span>{String(index + 1).padStart(2, "0")}</span><strong>{item.title}</strong>{index < stepIndex ? <Check size={13} /> : <ChevronRight size={13} />}</button>)}</div>
          </section>

          <section className="visual-panel">
            <div className="visual-toolbar"><div className="view-tabs"><button className={sceneTab === "scene" ? "active" : ""} onClick={() => setSceneTab("scene")}><Sparkles size={14} />{t.scene}</button>{lesson.category === "codigo" && <button className={sceneTab === "code" ? "active" : ""} onClick={() => setSceneTab("code")}><Braces size={14} />{t.code}</button>}</div><span className="scene-schema"><i />SceneSchema · v1</span></div>
            <div className="scene-wrap">
              {sceneTab === "code" && step.code ? <pre className="code-view"><code>{step.code.split("\n").map((line, index) => <div key={index} className={index === step.activeLine ? "active-line" : ""}><span>{String(index + 1).padStart(2, "0")}</span>{line || " "}</div>)}</code></pre> : <SceneCanvas scene={step.scene} previous={stepIndex > 0 ? lesson.steps[stepIndex - 1].scene : undefined} stepKey={`${lesson.id}-${step.id}`} parameters={parameters} playing={playing} />}
              <div className="scene-index">{String(stepIndex + 1).padStart(2, "0")} / {String(lesson.steps.length).padStart(2, "0")}</div>
              {step.scene.caption && <div className="scene-caption"><span>VISUAL NOTE</span>{step.scene.caption}</div>}
            </div>
            {lesson.parameters.length > 0 && <div className="parameter-dock"><div className="parameter-title"><span>{t.params}</span><small>{t.paramsHint}</small></div><div className="parameter-list">{lesson.parameters.map(param => <label key={param.id}><span>{param.label}<output>{parameters[param.id]?.toFixed(2)}{param.unit || ""}</output></span><input type="range" min={param.min} max={param.max} step={param.step} value={parameters[param.id] ?? param.value} onChange={e => { setPlaying(false); setParameters(p => ({ ...p, [param.id]: Number(e.target.value) })); }} /></label>)}</div></div>}
            <div className="source-note"><FileText size={13} /><span>{t.sourcesUsed}: {lesson.sourceNames.length ? lesson.sourceNames.join(" · ") : (language === "pt" ? "Síntese do modelo" : "Model synthesis")}</span></div>
          </section>
        </div>

        <div className="playback-bar">
          <div className="playback-buttons"><button className="icon-button" disabled={stepIndex === 0} onClick={() => goTo(stepIndex - 1)} aria-label={t.previous}><ChevronLeft size={19} /></button><button className="play-button" onClick={() => { if (stepIndex === lesson.steps.length - 1 && !playing) setStepIndex(0); setPlaying(p => !p); }} aria-label={playing ? t.pause : t.play}>{playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}<span>{playing ? t.pause : t.play}</span></button><button className="icon-button" disabled={stepIndex === lesson.steps.length - 1} onClick={() => goTo(stepIndex + 1)} aria-label={t.next}><ChevronRight size={19} /></button><button className="icon-button reset-button" onClick={() => { setStepIndex(0); setPlaying(false); }} aria-label={t.reset}><RotateCcw size={16} /></button></div>
          <div className="timeline"><div className="timeline-track">{lesson.steps.map((item, index) => <button key={item.id} className={index === stepIndex ? "active" : index < stepIndex ? "done" : ""} onClick={() => goTo(index)} aria-label={`${t.step} ${index + 1}: ${item.title}`}><span /></button>)}</div><div className="timeline-labels"><span>{String(stepIndex + 1).padStart(2, "0")} — {step.title}</span><span>{step.duration}s</span></div></div>
          <label className="speed-control"><span>{t.speed}</span><select value={speed} onChange={e => setSpeed(Number(e.target.value))}><option value={0.75}>0.75×</option><option value={1}>1×</option><option value={1.5}>1.5×</option><option value={2}>2×</option></select></label>
        </div>
      </main>
    </div> : <main className="library-page">
      <div className="library-hero"><span className="eyebrow">NEXUM / {t.library.toUpperCase()}</span><h1>{t.library}</h1><p>{generatedSummaries.length} {t.saved}</p><button className="primary-button" onClick={() => setCreateOpen(true)}><Plus size={17} />{t.newTrail}</button></div>
      <div className="library-tools"><label className="search-field"><Search size={18} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder={t.search} /></label><div className="filter-tabs"><button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>{t.all}</button><button className={filter === "matematica" ? "active" : ""} onClick={() => setFilter("matematica")}>{t.math}</button><button className={filter === "codigo" ? "active" : ""} onClick={() => setFilter("codigo")}>{t.coding}</button></div></div>
      {filtered.length ? <div className="library-grid">{filtered.map((item, index) => <button className="library-card" key={item.id} onClick={() => openLibraryItem(item.id)}><div className="card-visual"><span className="card-number">{String(index + 1).padStart(2, "0")}</span>{item.category === "codigo" ? <Code2 size={54} strokeWidth={1} /> : <FunctionSquare size={58} strokeWidth={1} />}<span className="card-kind">{item.sample ? t.sample : t.generated}</span></div><div className="card-content"><span className="eyebrow">{item.topic}</span><h2>{item.title}</h2><p>{item.description}</p><div><span>{item.stepCount} {t.steps}</span><span>{item.language.toUpperCase()}</span><ArrowRight size={18} /></div></div></button>)}</div> : <div className="empty-library"><Search size={30} /><p>{t.noResults}</p></div>}
    </main>}

    <NewTrailDialog open={createOpen} onClose={() => setCreateOpen(false)} onCreated={(created) => { selectLesson(created); utils.trails.list.invalidate({ workspaceId }); setToast(t.ready); }} workspaceId={workspaceId} language={language} t={t} />
    {howOpen && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setHowOpen(false); }}><section className="how-modal" role="dialog" aria-modal="true" aria-labelledby="how-title"><header className="modal-header"><div className="modal-symbol"><Network size={19} /></div><div><span className="eyebrow">LANGGRAPH + OPENAI</span><h2 id="how-title">{t.agentPipeline}</h2></div><button className="icon-button" onClick={() => setHowOpen(false)} aria-label={t.close}><X size={19} /></button></header><div className="how-content"><h3>{t.architectureTitle}</h3><p>{t.architectureBody}</p><div className="architecture-flow">{agents.map(([Icon, name, role, number], index) => <div className="architecture-agent" key={name}><span>{number}</span><Icon size={22} /><strong>{name}</strong><p>{role}</p>{index < 3 && <ArrowRight className="flow-arrow" size={17} />}</div>)}</div><div className="schema-explainer"><Braces size={25} /><div><h4>{t.safeScenes}</h4><p>{t.safeBody}</p></div></div><p className="persistence-note">{t.persistence}</p></div></section></div>}
    {toast && <div className="toast" role="status"><Check size={17} />{toast}<button onClick={() => setToast("")} aria-label={t.close}><X size={15} /></button></div>}
  </div>;
}
