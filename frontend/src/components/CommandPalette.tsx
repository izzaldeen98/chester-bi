import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MdAutoAwesome, MdOutlineCloud } from "react-icons/md";
import { GoPackage } from "react-icons/go";
import { RiHomeLine } from "react-icons/ri";
import { FaFileAlt, FaUser, FaKey, FaPlus, FaSearch } from "react-icons/fa";
import { getArtifacts, type ArtifactResponse } from "../lib/Api";

interface Command {
  id: string;
  label: string;
  hint?: string;
  group: string;
  icon: React.ReactNode;
  run: () => void;
}

/* ⌘K: jump anywhere, or open any artifact by name, without going back to a
   list first. Artifacts load once on open so the list is current but the
   palette never blocks on the network. */
export default function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const [artifacts, setArtifacts] = useState<ArtifactResponse[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setCursor(0);
    inputRef.current?.focus();
    getArtifacts().then(setArtifacts).catch(() => undefined);
  }, [open]);

  const commands: Command[] = useMemo(() => {
    const go = (path: string) => () => {
      navigate(path);
      onClose();
    };
    const base: Command[] = [
      { id: "new", label: "New artifact", hint: "Describe an analysis", group: "Actions", icon: <FaPlus size={11} />, run: go("/artifacts/new") },
      { id: "home", label: "Overview", group: "Go to", icon: <RiHomeLine size={13} />, run: go("/home") },
      { id: "artifacts", label: "Artifacts", group: "Go to", icon: <MdAutoAwesome size={13} />, run: go("/artifacts") },
      { id: "connections", label: "Connections", group: "Go to", icon: <MdOutlineCloud size={13} />, run: go("/connections") },
      { id: "models", label: "Models", group: "Go to", icon: <GoPackage size={12} />, run: go("/models") },
      { id: "files", label: "Files", group: "Go to", icon: <FaFileAlt size={11} />, run: go("/files") },
      { id: "providers", label: "AI Providers", group: "Go to", icon: <FaKey size={11} />, run: go("/settings/ai-providers") },
      { id: "users", label: "Users", group: "Go to", icon: <FaUser size={11} />, run: go("/users") },
    ];
    const items: Command[] = artifacts.map((a) => ({
      id: `a-${a.id}`,
      label: a.name,
      hint: `v${a.current_version}`,
      group: "Artifacts",
      icon: <MdAutoAwesome size={13} />,
      run: go(`/artifacts/${a.id}`),
    }));
    return [...base, ...items];
  }, [artifacts, navigate, onClose]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => `${c.label} ${c.hint ?? ""} ${c.group}`.toLowerCase().includes(q));
  }, [commands, query]);

  useEffect(() => setCursor(0), [query]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") return onClose();
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setCursor((c) => Math.min(c + 1, results.length - 1));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setCursor((c) => Math.max(c - 1, 0));
      }
      if (e.key === "Enter") {
        e.preventDefault();
        results[cursor]?.run();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, results, cursor, onClose]);

  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  if (!open) return null;

  let lastGroup = "";
  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-[14vh]"
      style={{ background: "rgba(23,22,20,0.45)", backdropFilter: "blur(2px)" }}
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onClick={(e) => e.stopPropagation()}
        className="settle flex max-h-[62vh] w-full max-w-lg flex-col overflow-hidden"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-lg)",
          boxShadow: "var(--shadow-3)",
        }}
      >
        <div className="flex shrink-0 items-center gap-2.5 px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
          <FaSearch size={12} style={{ color: "var(--text-3)" }} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search artifacts and pages…"
            className="flex-1 bg-transparent text-[14px] outline-none focus-visible:outline-none placeholder:text-[var(--text-3)]"
            style={{ color: "var(--text)" }}
          />
          <kbd
            className="mono rounded-[4px] px-1 py-0.5 text-[10px]"
            style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-3)" }}
          >
            esc
          </kbd>
        </div>

        <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto py-1.5">
          {results.length === 0 ? (
            <p className="px-4 py-8 text-center text-[13px]" style={{ color: "var(--text-3)" }}>
              Nothing matches “{query}”.
            </p>
          ) : (
            results.map((c, i) => {
              const header = c.group !== lastGroup ? c.group : null;
              lastGroup = c.group;
              return (
                <div key={c.id}>
                  {header && <p className="label px-4 pb-1 pt-2.5">{header}</p>}
                  <button
                    type="button"
                    data-active={i === cursor}
                    onMouseEnter={() => setCursor(i)}
                    onClick={c.run}
                    className="mx-1.5 flex w-[calc(100%-12px)] items-center gap-2.5 rounded-[var(--r-sm)] px-2.5 py-2 text-left text-[13.5px] transition-colors"
                    style={{
                      background: i === cursor ? "var(--surface-2)" : "transparent",
                      color: "var(--text)",
                    }}
                  >
                    <span className="shrink-0" style={{ color: i === cursor ? "var(--accent)" : "var(--text-3)" }}>
                      {c.icon}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{c.label}</span>
                    {c.hint && (
                      <span className="shrink-0 text-[12px]" style={{ color: "var(--text-3)" }}>
                        {c.hint}
                      </span>
                    )}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
