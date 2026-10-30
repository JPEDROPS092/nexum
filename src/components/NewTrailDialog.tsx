import { useEffect, useRef, useState } from "react";
import {
  BookOpen,
  Check,
  FileText,
  Globe2,
  Link2,
  LoaderCircle,
  Network,
  Plus,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { trpc } from "@/providers/trpc";
import type { Language, Lesson } from "@contracts/lesson";
import type { Copy } from "@/lib/i18n";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (lesson: Lesson) => void;
  workspaceId: string;
  language: Language;
  t: Copy;
}

export default function NewTrailDialog({
  open,
  onClose,
  onCreated,
  workspaceId,
  language,
  t,
}: Props) {
  const [topic, setTopic] = useState("");
  const [userPrompt, setUserPrompt] = useState("");
  const [level, setLevel] = useState<
    "iniciante" | "intermediario" | "avancado"
  >("iniciante");
  const [contentLanguage, setContentLanguage] = useState<Language>(language);
  const [url, setUrl] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();
  const sourcesQuery = trpc.sources.list.useQuery(
    { workspaceId },
    { enabled: open }
  );
  const upload = trpc.sources.uploadPdf.useMutation();
  const addUrl = trpc.sources.addUrl.useMutation();
  const generate = trpc.trails.generate.useMutation();

  useEffect(() => {
    if (open) {
      setError("");
      setContentLanguage(language);
    }
  }, [open, language]);
  useEffect(() => {
    if (!open) return;
    const listener = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !generate.isPending) onClose();
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [open, onClose, generate.isPending]);
  if (!open) return null;

  const busy = upload.isPending || addUrl.isPending;
  const ingestDone = async (id: string) => {
    setSelected(prev => new Set(prev).add(id));
    setError("");
    await utils.sources.list.invalidate({ workspaceId });
  };
  const handleFile = async (file?: File) => {
    if (!file) return;
    if (
      file.type !== "application/pdf" &&
      !file.name.toLowerCase().endsWith(".pdf")
    ) {
      setError(
        language === "pt" ? "Selecione um arquivo PDF." : "Choose a PDF file."
      );
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setError(
        language === "pt" ? "O PDF excede 12 MB." : "The PDF exceeds 12 MB."
      );
      return;
    }
    try {
      const data = new Uint8Array(await file.arrayBuffer());
      let binary = "";
      const chunk = 0x8000;
      for (let i = 0; i < data.length; i += chunk)
        binary += String.fromCharCode(...data.subarray(i, i + chunk));
      const result = await upload.mutateAsync({
        workspaceId,
        name: file.name,
        contentBase64: btoa(binary),
      });
      await ingestDone(result.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.error);
    }
    if (fileRef.current) fileRef.current.value = "";
  };
  const handleUrl = async () => {
    if (!url.trim()) return;
    try {
      const result = await addUrl.mutateAsync({ workspaceId, url: url.trim() });
      setUrl("");
      await ingestDone(result.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.error);
    }
  };
  const submit = async () => {
    if (topic.trim().length < 3 || generate.isPending) return;
    setError("");
    try {
      const result = await generate.mutateAsync({
        workspaceId,
        topic: topic.trim(),
        userPrompt: userPrompt.trim(),
        language: contentLanguage,
        level,
        sourceIds: [...selected],
      });
      onCreated(result.lesson);
      setTopic("");
      setUserPrompt("");
      setSelected(new Set());
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : t.error);
    }
  };
  const agents = [
    [BookOpen, t.researcher, t.researcherRole],
    [Network, t.architect, t.architectRole],
    [Sparkles, t.director, t.directorRole],
    [Check, t.reviewer, t.reviewerRole],
  ] as const;

  return (
    <div
      className="modal-backdrop"
      onMouseDown={e => {
        if (e.target === e.currentTarget && !generate.isPending) onClose();
      }}
    >
      <section
        className="create-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-title"
      >
        <header className="modal-header">
          <div className="modal-symbol">
            <Sparkles size={19} />
          </div>
          <div>
            <span className="eyebrow">NEXUM STUDIO</span>
            <h2 id="create-title">{t.createTitle}</h2>
          </div>
          <button
            className="icon-button"
            onClick={onClose}
            disabled={generate.isPending}
            aria-label={t.close}
          >
            <X size={19} />
          </button>
        </header>
        <div className="modal-scroll">
          <p className="modal-intro">{t.createSubtitle}</p>
          {generate.isPending ? (
            <div className="generation-state">
              <div className="orbit-loader">
                <span />
                <Sparkles size={26} />
              </div>
              <h3>{t.generating}</h3>
              <p>{t.generatingHint}</p>
              <div className="agent-list">
                {agents.map(([Icon, name, role]) => (
                  <div className="agent-row" key={name}>
                    <Icon size={17} />
                    <div>
                      <strong>{name}</strong>
                      <span>{role}</span>
                    </div>
                    <span className="agent-wave" />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              <label className="field-label" htmlFor="trail-topic">
                {t.topic}
              </label>
              <textarea
                id="trail-topic"
                className="topic-input"
                value={topic}
                onChange={e => setTopic(e.target.value)}
                placeholder={t.topicPlaceholder}
                rows={2}
                maxLength={180}
                autoFocus
              />
              <div className="prompt-field">
                <label className="field-label" htmlFor="trail-prompt">
                  {t.promptLabel} <em>{t.optional}</em>
                </label>
                <textarea
                  id="trail-prompt"
                  className="topic-input prompt-input"
                  value={userPrompt}
                  onChange={e => setUserPrompt(e.target.value)}
                  placeholder={t.promptPlaceholder}
                  rows={3}
                  maxLength={3000}
                />
                <p className="prompt-hint">{t.promptHint}</p>
              </div>
              <div className="form-pair">
                <label>
                  <span className="field-label">{t.level}</span>
                  <select
                    value={level}
                    onChange={e => setLevel(e.target.value as typeof level)}
                  >
                    <option value="iniciante">{t.beginner}</option>
                    <option value="intermediario">{t.intermediate}</option>
                    <option value="avancado">{t.advanced}</option>
                  </select>
                </label>
                <label>
                  <span className="field-label">{t.contentLanguage}</span>
                  <select
                    value={contentLanguage}
                    onChange={e =>
                      setContentLanguage(e.target.value as Language)
                    }
                  >
                    <option value="pt">Português</option>
                    <option value="en">English</option>
                  </select>
                </label>
              </div>
              <div className="materials-heading">
                <span className="field-label">
                  {t.materials} <em>{t.optional}</em>
                </span>
                <span>{selected.size}/6</span>
              </div>
              <div className="ingestion-grid">
                <button
                  className="upload-zone"
                  onClick={() => fileRef.current?.click()}
                  disabled={busy || selected.size >= 6}
                >
                  <Upload size={20} />
                  <strong>{t.uploadPdf}</strong>
                  <span>{t.pdfHint}</span>
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  hidden
                  onChange={e => handleFile(e.target.files?.[0])}
                />
                <div className="url-zone">
                  <div>
                    <Globe2 size={18} />
                    <input
                      value={url}
                      onChange={e => setUrl(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter") handleUrl();
                      }}
                      placeholder={t.urlPlaceholder}
                      aria-label={t.urlPlaceholder}
                    />
                  </div>
                  <button
                    onClick={handleUrl}
                    disabled={!url.trim() || busy || selected.size >= 6}
                  >
                    {busy ? (
                      <LoaderCircle className="spin" size={16} />
                    ) : (
                      <Plus size={16} />
                    )}
                    {t.add}
                  </button>
                </div>
              </div>
              <div className="source-picker">
                {(sourcesQuery.data?.length ?? 0) === 0 ? (
                  <p className="empty-source">{t.noSource}</p>
                ) : (
                  sourcesQuery.data?.map(source => (
                    <button
                      key={source.id}
                      className={`source-chip ${selected.has(source.id) ? "selected" : ""}`}
                      onClick={() =>
                        setSelected(prev => {
                          const next = new Set(prev);
                          if (next.has(source.id)) next.delete(source.id);
                          else if (next.size < 6) next.add(source.id);
                          return next;
                        })
                      }
                    >
                      {source.kind === "pdf" ? (
                        <FileText size={15} />
                      ) : (
                        <Link2 size={15} />
                      )}
                      <span>
                        <strong>{source.name}</strong>
                        <small>
                          {Math.round(source.charCount / 1000)}k {t.chars}
                        </small>
                      </span>
                      {selected.has(source.id) && <Check size={15} />}
                    </button>
                  ))
                )}
              </div>
            </>
          )}
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
        </div>
        {!generate.isPending && (
          <footer className="modal-footer">
            <span>
              {selected.size
                ? `${selected.size} ${t.sources.toLowerCase()}`
                : t.noSource}
            </span>
            <button
              className="primary-button"
              onClick={submit}
              disabled={topic.trim().length < 3 || busy}
            >
              <Sparkles size={17} />
              {t.generate}
            </button>
          </footer>
        )}
      </section>
    </div>
  );
}
