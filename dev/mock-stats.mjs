#!/usr/bin/env node
// =====================================================================================
// MOCK DATA GENERATOR: LOCAL UI TESTING ONLY
//
// Every number, job, company and headline this script produces is INVENTED so you can see
// how the stats dashboard lays out with non-zero data. None of it comes from the TALON
// pipeline. Do not commit its output, do not push it to GitHub Pages, and do not point the
// portfolio's `statsFeed` at it in production.
//
// Safety rails:
//  * By default it never writes to ./stats.json or ./index.html (the real files). Output goes to
//    ./dev/out/. Only the explicit --publish flag (used by the daily Action) writes to the repo root.
//  * Every generated JSON has "_MOCK": true, and its time label starts with "MOCK DATA".
//  * The seed is the UTC date (YYYY-MM-DD), so numbers change once a day and are reproducible.
//  * The dashboard template (github-export.mjs) shows a red "MOCK DATA, NOT REAL" bar and a magenta
//    DEMO indicator instead of LIVE whenever the stats carry "_MOCK": true; real exports are unchanged.
//
// Usage (from the repo root):
//   node dev/mock-stats.mjs                      # scenario "typical" (every count under 1,000), random seed
//   node dev/mock-stats.mjs --scenario busy      # bigger numbers
//   node dev/mock-stats.mjs --scenario huge      # 5-6 digit numbers, long strings (overflow test)
//   node dev/mock-stats.mjs --scenario empty     # all zeros, no jobs (empty-state test)
//   node dev/mock-stats.mjs --seed 42            # fixed seed, same output every run
//   node dev/mock-stats.mjs --date 2026-11-09    # seed from a specific YYYY-MM-DD (default: today, UTC)
//   node dev/mock-stats.mjs --publish            # write ./stats.json and ./index.html (used by the daily
//                                                # GitHub Action; see .github/workflows/daily-mock-stats.yml)
//   node dev/mock-stats.mjs --serve              # also serve dev/out on http://localhost:4180
//
// To test the portfolio's live panel locally, serve dev/out (--serve) and temporarily use
//   "statsFeed": "http://localhost:4180/stats.json"   (only in your local checkout, never committed;
//   the site's CSP/CORS may need the --serve flag, which sends Access-Control-Allow-Origin: *).
// =====================================================================================

import fs from "fs";
import path from "path";
import http from "http";
import { fileURLToPath, pathToFileURL } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");

// ---- args ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : true;
};
const scenario = String(opt("scenario", "typical"));
const serve = args.includes("--serve");
const publish = args.includes("--publish");
// Published files go to the repo root; everything else stays in dev/out (git-ignored).
const outDir = publish ? repoRoot : path.join(here, "out");

// Date-based seed: YYYY-MM-DD (UTC) -> 32-bit FNV-1a hash. Same day = same numbers; a new UTC day
// (midnight UTC, when the daily Action runs) = new numbers. --seed N overrides, --date picks a day.
const dateStr = String(opt("date", new Date().toISOString().slice(0, 10)));
if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) { console.error("--date must be YYYY-MM-DD"); process.exit(1); }
const fnv1a = (str) => { let h = 0x811c9dc5; for (const c of str) { h ^= c.charCodeAt(0); h = Math.imul(h, 0x01000193); } return h >>> 0; };
const seedArg = opt("seed", null);
const seed = seedArg === null || seedArg === true ? fnv1a(dateStr) : Number(seedArg);
if (publish && scenario !== "typical") { console.error("--publish only allows the typical scenario (all values under 1,000)."); process.exit(1); }
if (!["typical", "busy", "huge", "empty"].includes(scenario)) {
  console.error('Unknown --scenario. Use: typical | busy | huge | empty');
  process.exit(1);
}

// ---- seeded RNG (mulberry32) so a seed reproduces the same mock data ----------------
let a = seed >>> 0;
const rnd = () => {
  a |= 0; a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const int = (lo, hi) => Math.floor(lo + rnd() * (hi - lo + 1));
const pick = (arr) => arr[int(0, arr.length - 1)];

// ---- mock pipeline numbers (all invented). Funnel is kept self-consistent so the layout
// ---- is realistic: scanned >= eligible >= score7plus, applications >= interviews, etc.
const RANGES = {
  typical: { scanned: [300, 900], elig: [0.25, 0.6], s7: [0.2, 0.5], app: [5, 60], crm: [10, 80], calls: [200, 900] },
  busy:    { scanned: [2000, 9000], elig: [0.3, 0.7], s7: [0.25, 0.6], app: [80, 400], crm: [100, 400], calls: [80000, 400000] },
  huge:    { scanned: [120000, 999999], elig: [0.4, 0.8], s7: [0.3, 0.7], app: [5000, 99999], crm: [5000, 99999], calls: [1000000, 9999999] },
  empty:   null,
};
const R = RANGES[scenario];
let pipeline, aiCosts;
if (R) {
  const scanned = int(...R.scanned);
  const eligible = Math.round(scanned * (R.elig[0] + rnd() * (R.elig[1] - R.elig[0])));
  const score7plus = Math.round(eligible * (R.s7[0] + rnd() * (R.s7[1] - R.s7[0])));
  const applications = Math.min(score7plus, int(...R.app));
  const interviews = Math.round(applications * (0.05 + rnd() * 0.15));
  const rejections = Math.round(applications * (0.2 + rnd() * 0.4));
  pipeline = {
    jobsScanned: scanned,
    eligible,
    score7plus,
    approved: Math.min(score7plus, int(5, Math.max(6, Math.round(score7plus * 0.4)))),
    applications,
    interviews,
    rejections,
    recruiters: int(0, Math.max(1, Math.round(interviews * 1.5))),
    crmTracked: int(...R.crm),
  };
  aiCosts = { totalSpent: Number((rnd() * (scenario === "typical" ? 0.9 : 40)).toFixed(4)), totalCalls: int(...R.calls) };
} else {
  pipeline = { jobsScanned: 0, eligible: 0, score7plus: 0, approved: 0, applications: 0, interviews: 0, rejections: 0, recruiters: 0, crmTracked: 0 };
  aiCosts = { totalSpent: 0, totalCalls: 0 };
}

// ---- mock jobs / headlines: fictional companies and generic titles ------------------
const COMPANIES = ["Example Corp", "Acme Analytics", "Northwind Labs", "Globex Systems", "Initech Cloud", "Umbrella Data", "Hooli Works"];
const TITLES = ["Technical Program Manager", "Business Analyst", "Product Operations Associate", "Project Coordinator", "AI Product Manager", "Data Operations Analyst"];
const LONG_TITLE = "Senior Associate Technical Program Manager, Applied AI Platform and Developer Experience (Hybrid, Multiple Locations)";
const PLACES = ["Indianapolis, IN", "Remote (US)", "Chicago, IL", "Columbus, OH", "Austin, TX"];
const nJobs = scenario === "empty" ? 0 : 5;
const topJobs = Array.from({ length: nJobs }, (_, i) => ({
  title: scenario === "huge" && i === 0 ? LONG_TITLE : pick(TITLES),
  company: pick(COMPANIES),
  location: pick(PLACES),
  score: int(7, 10),
  url: "https://example.com/mock-job/" + (1000 + i),
})).sort((x, y) => y.score - x.score);

const bullets = (arr) => arr.map((s) => "• " + s).join("\n");
const recentNews = scenario === "empty"
  ? { visa: "", tech: "", breaking: "" }
  : {
      visa: bullets(["[MOCK] Sample visa headline one for layout testing", "[MOCK] Sample visa headline two with a somewhat longer title to test wrapping"]),
      tech: bullets(["[MOCK] Sample tech headline one", "[MOCK] Sample tech headline two", "[MOCK] Sample tech headline three"]),
      breaking: bullets(["[MOCK] Sample breaking headline one for layout testing"]),
    };

// ---- assemble in the exact shape github-export.mjs writes ---------------------------
const now = new Date();
const iso = (d) => d.toISOString();
const ago = (h) => iso(new Date(now.getTime() - h * 3600e3));
const stats = {
  _MOCK: true,
  _MOCK_NOTE: `INVENTED DEMO DATA (scenario=${scenario}, date seed=${dateStr}, seed=${seed}). Not from the TALON pipeline.`,
  generatedAt: iso(now),
  // The label every consumer shows as "updated ...": it must read as mock wherever it appears
  // (the dashboard header and the portfolio's TALON feed panel).
  generatedAtET: `MOCK DATA · ${dateStr}`,
  pipeline,
  lastRuns: { jobScan: scenario === "empty" ? null : ago(5), news: ago(9), gmailParsed: ago(2), newsGenerated: ago(9) },
  aiCosts: { ...aiCosts, lastUpdated: ago(1) },
  recentNews,
  topJobs,
};

// Guard: the typical scenario must keep every count under 1,000.
if (scenario === "typical") {
  const nums = [...Object.values(stats.pipeline), stats.aiCosts.totalCalls, stats.aiCosts.totalSpent];
  if (!nums.every((n) => Number.isFinite(n) && n >= 0 && n < 1000)) { console.error("Mock value out of range (must be < 1000):", nums); process.exit(1); }
}

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "stats.json"), JSON.stringify(stats, null, 2) + "\n");

// ---- render the REAL dashboard template with the mock stats ------------------------
// buildStaticHTML() is not exported by github-export.mjs, and we must not edit that file, so
// load a throwaway copy that exports it. Nothing here touches GitHub or the real index.html.
try {
  const src = fs.readFileSync(path.join(repoRoot, "github-export.mjs"), "utf-8");
  const tmp = path.join(here, ".exporter-copy.mjs");
  fs.writeFileSync(tmp, src + "\nexport { buildStaticHTML };\n");
  const mod = await import(pathToFileURL(tmp).href);
  let html = mod.buildStaticHTML(stats);
  if (!html.includes("MOCK DATA, NOT REAL") || !html.includes("status--demo\"")) throw new Error("MOCK banner or DEMO indicator missing from generated HTML");
  fs.writeFileSync(path.join(outDir, "index.html"), html);
  fs.unlinkSync(tmp);
} catch (e) {
  try { fs.unlinkSync(path.join(here, ".exporter-copy.mjs")); } catch {}
  if (publish) { console.error("Refusing to publish without a bannered index.html:", e.message); process.exit(1); }
  console.warn("Could not render index.html from the exporter template:", e.message);
  console.warn("stats.json was still written.");
}

console.log(`MOCK stats written to ${path.relative(process.cwd(), outDir) || "."}/ (scenario=${scenario}, seed=${seed})`);
console.log(JSON.stringify(stats.pipeline));

// ---- optional local server (CORS open) ----------------------------------------------
if (serve) {
  const types = { ".html": "text/html", ".json": "application/json" };
  http.createServer((req, res) => {
    const f = path.join(outDir, req.url === "/" ? "index.html" : decodeURIComponent(req.url.split("?")[0]));
    if (!path.resolve(f).startsWith(path.resolve(outDir)) || !fs.existsSync(f)) { res.writeHead(404); return res.end("not found"); }
    res.writeHead(200, { "content-type": types[path.extname(f)] || "text/plain", "access-control-allow-origin": "*" });
    fs.createReadStream(f).pipe(res);
  }).listen(4180, "127.0.0.1", () => console.log("Serving MOCK data at http://localhost:4180  (Ctrl+C to stop)"));
}
