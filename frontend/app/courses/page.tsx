"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Search, X, BookX } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { CourseCard } from "@/components/CourseCard";
import { CourseCardSkeleton } from "@/components/CourseCardSkeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { courses, type Category, type Level } from "@/data/mock";

const cats: Category[] = ["AI & ML", "Web Dev", "Data Science", "Cloud"];
const levels: Level[] = ["Beginner", "Intermediate", "Advanced"];
const ratings = [4.5, 4.0, 3.5, 0];
const durations = [
  { label: "< 2h", min: 0, max: 2 },
  { label: "2–5h", min: 2, max: 5 },
  { label: "5–10h", min: 5, max: 10 },
  { label: "10h+", min: 10, max: 999 },
];

function parseHrs(d: string) {
  const m = d.match(/(\d+)h/);
  return m ? parseInt(m[1]) : 0;
}

export default function Catalog() {
  const [q, setQ] = useState("");
  const [selCats, setSelCats] = useState<Category[]>([]);
  const [selLevel, setSelLevel] = useState<Level | null>(null);
  const [minRating, setMinRating] = useState(0);
  const [selDur, setSelDur] = useState<string[]>([]);
  const [sort, setSort] = useState("popular");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 300);
    return () => clearTimeout(t);
  }, []);

  const filtered = useMemo(() => {
    let res = courses.filter((c) => {
      if (q && !c.title.toLowerCase().includes(q.toLowerCase())) return false;
      if (selCats.length && !selCats.includes(c.category)) return false;
      if (selLevel && c.level !== selLevel) return false;
      if (c.rating < minRating) return false;
      if (selDur.length) {
        const h = parseHrs(c.duration);
        const ok = selDur.some((label) => {
          const d = durations.find((x) => x.label === label)!;
          return h >= d.min && h < d.max;
        });
        if (!ok) return false;
      }
      return true;
    });
    if (sort === "rating") res = [...res].sort((a, b) => b.rating - a.rating);
    else if (sort === "newest") res = [...res].reverse();
    else res = [...res].sort((a, b) => b.enrolledCount - a.enrolledCount);
    return res;
  }, [q, selCats, selLevel, minRating, selDur, sort]);

  const perPage = 6;
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const pageItems = filtered.slice((page - 1) * perPage, page * perPage);

  const hasFilters = q || selCats.length || selLevel || minRating || selDur.length;
  const clearAll = () => { setQ(""); setSelCats([]); setSelLevel(null); setMinRating(0); setSelDur([]); setPage(1); };

  useEffect(() => { setPage(1); }, [q, selCats, selLevel, minRating, selDur]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 grid lg:grid-cols-[260px_1fr] gap-8">
        {/* Sidebar */}
        <aside className="space-y-6">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search courses..." className="pl-9 rounded-xl h-10" />
          </div>

          {hasFilters && (
            <div className="flex flex-wrap gap-1.5">
              {selCats.map((c) => (
                <button key={c} onClick={() => setSelCats(selCats.filter((x) => x !== c))}
                  className="text-xs bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300 px-2 py-1 rounded inline-flex items-center gap-1">
                  {c} <X className="w-3 h-3" />
                </button>
              ))}
              {selLevel && (
                <button onClick={() => setSelLevel(null)} className="text-xs bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300 px-2 py-1 rounded inline-flex items-center gap-1">
                  {selLevel} <X className="w-3 h-3" />
                </button>
              )}
              <Button variant="ghost" size="sm" onClick={clearAll} className="text-xs h-7">Clear All</Button>
            </div>
          )}

          <FilterGroup title="Category">
            {cats.map((c) => (
              <label key={c} className="flex items-center gap-2 text-sm py-1.5 cursor-pointer">
                <Checkbox checked={selCats.includes(c)} onCheckedChange={(v) => setSelCats(v ? [...selCats, c] : selCats.filter((x) => x !== c))} />
                <span className="text-foreground">{c}</span>
              </label>
            ))}
          </FilterGroup>

          <FilterGroup title="Level">
            {levels.map((l) => (
              <label key={l} className="flex items-center gap-2 text-sm py-1.5 cursor-pointer">
                <input type="radio" checked={selLevel === l} onChange={() => setSelLevel(l)} className="accent-violet-600" />
                <span className="text-foreground">{l}</span>
              </label>
            ))}
          </FilterGroup>

          <FilterGroup title="Rating">
            {ratings.map((r) => (
              <label key={r} className="flex items-center gap-2 text-sm py-1.5 cursor-pointer">
                <input type="radio" checked={minRating === r} onChange={() => setMinRating(r)} className="accent-violet-600" />
                <span className="text-foreground">{r === 0 ? "Any" : `${r}+`}</span>
              </label>
            ))}
          </FilterGroup>

          <FilterGroup title="Duration">
            {durations.map((d) => (
              <label key={d.label} className="flex items-center gap-2 text-sm py-1.5 cursor-pointer">
                <Checkbox checked={selDur.includes(d.label)} onCheckedChange={(v) => setSelDur(v ? [...selDur, d.label] : selDur.filter((x) => x !== d.label))} />
                <span className="text-foreground">{d.label}</span>
              </label>
            ))}
          </FilterGroup>
        </aside>

        {/* Content */}
        <main>
          <div className="flex items-center justify-between mb-6">
            <p className="text-sm text-muted-foreground">{filtered.length} {filtered.length === 1 ? "course" : "courses"}</p>
            <select value={sort} onChange={(e) => setSort(e.target.value)}
              className="h-10 px-3 rounded-xl border border-input bg-card text-sm">
              <option value="popular">Most Popular</option>
              <option value="newest">Newest</option>
              <option value="rating">Highest Rated</option>
            </select>
          </div>

          {loading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => <CourseCardSkeleton key={i} />)}
            </div>
          ) : pageItems.length === 0 ? (
            <div className="text-center py-20">
              <BookX className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600" />
              <h3 className="mt-4 text-lg font-semibold text-foreground">No courses found</h3>
              <p className="text-muted-foreground text-sm mt-1">Try adjusting your filters.</p>
              <Button onClick={clearAll} className="mt-4 rounded-xl bg-violet-600 hover:bg-violet-700 text-white">Clear Filters</Button>
            </div>
          ) : (
            <>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {pageItems.map((c) => <CourseCard key={c.id} course={c} />)}
              </div>
              {totalPages > 1 && (
                <div className="mt-8 flex items-center justify-center gap-2">
                  <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)} className="rounded-xl">Prev</Button>
                  {Array.from({ length: totalPages }).map((_, i) => (
                    <button key={i} onClick={() => setPage(i + 1)}
                      className={`w-9 h-9 rounded-xl text-sm ${page === i + 1 ? "bg-violet-600 text-white" : "hover:bg-gray-100 dark:hover:bg-gray-800"}`}>
                      {i + 1}
                    </button>
                  ))}
                  <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(page + 1)} className="rounded-xl">Next</Button>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function FilterGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h4 className="font-semibold text-sm text-foreground mb-2">{title}</h4>
      <div>{children}</div>
    </div>
  );
}
