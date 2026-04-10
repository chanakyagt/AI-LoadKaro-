"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";

type SearchResult = {
  type: "user" | "truck" | "load";
  id: string;
  title: string;
  subtitle: string;
};

const TYPE_STYLE: Record<string, string> = {
  user: "bg-amber-50 text-amber-700 border-amber-200",
  truck: "bg-blue-50 text-blue-700 border-blue-200",
  load: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

export function GlobalSearch({ basePath }: { basePath: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/admin/search?q=${encodeURIComponent(query.trim())}`,
          { credentials: "include" }
        );
        const json = await res.json();
        setResults(json.results ?? []);
        setOpen(true);
        setSelected(-1);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const navigate = useCallback(
    (result: SearchResult) => {
      setOpen(false);
      setQuery("");
      const base = basePath;
      if (result.type === "user") {
        router.push(`${base}/users/${result.id}`);
      } else if (result.type === "truck") {
        router.push(`${base}/trucks/${result.id}`);
      } else if (result.type === "load") {
        router.push(`${base}/loads`);
      }
    },
    [basePath, router]
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((s) => Math.min(s + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter" && selected >= 0 && results[selected]) {
      navigate(results[selected]);
    }
  };

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (results.length > 0) setOpen(true);
          }}
          onKeyDown={onKeyDown}
          placeholder="Search users, trucks, loads…"
          className="h-9 w-full rounded-lg border border-[#e5e7eb] bg-white pl-9 pr-12 text-sm text-[#111827] placeholder:text-[#9ca3af] focus:border-[#111827] focus:outline-none focus:ring-1 focus:ring-[#111827]"
        />
        <svg
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-[#e5e7eb] bg-[#f9fafb] px-1.5 py-0.5 text-[10px] font-medium text-[#9ca3af] sm:inline-block">
          Ctrl+K
        </kbd>
      </div>

      {open && (
        <div className="absolute top-full z-50 mt-1 w-full rounded-lg border border-[#e5e7eb] bg-white shadow-lg">
          {loading ? (
            <div className="px-4 py-3 text-center text-sm text-[#9ca3af]">
              Searching…
            </div>
          ) : results.length === 0 ? (
            <div className="px-4 py-3 text-center text-sm text-[#9ca3af]">
              No results for &ldquo;{query}&rdquo;
            </div>
          ) : (
            <ul className="max-h-72 overflow-y-auto py-1">
              {results.map((r, i) => (
                <li key={`${r.type}-${r.id}`}>
                  <button
                    type="button"
                    className={`flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors ${
                      i === selected
                        ? "bg-[#f3f4f6]"
                        : "hover:bg-[#f9fafb]"
                    }`}
                    onClick={() => navigate(r)}
                    onMouseEnter={() => setSelected(i)}
                  >
                    <Badge
                      className={`mt-0.5 border text-[10px] ${TYPE_STYLE[r.type] ?? ""}`}
                    >
                      {r.type}
                    </Badge>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[#111827]">
                        {r.title}
                      </p>
                      <p className="truncate text-xs text-[#6b7280]">
                        {r.subtitle}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
