#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");

const args = process.argv.slice(2);
const publish = args.includes("--publish");
const outDir = publish ? repoRoot : path.join(here, "out");

// Generate a seed based on today's UTC date so numbers change automatically at midnight
const now = new Date();
const dateStr = now.toISOString().slice(0, 10);
const fnv1a = (str) => { let h = 0x811c9dc5; for (const c of str) { h ^= c.charCodeAt(0); h = Math.imul(h, 0x01000193); } return h >>> 0; };
const seed = fnv1a(dateStr);

// Seeded random number generator
let a = seed >>> 0;
const rnd = () => {
  a |= 0; a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const int = (lo, hi) => Math.floor(lo + rnd() * (hi - lo + 1));
const pick = (arr) => arr[int(0, arr.length - 1)];

// Generate daily pipeline numbers
const scanned = int(300, 900);
const eligible = Math.round(scanned * (0.25 + rnd() * 0.35));
const score7plus = Math.round(eligible * (0.2 + rnd() * 0.3));
const applications = Math.min(score7plus, int(5, 60));
const interviews = Math.round(applications * (0.05 + rnd() * 0.15));
const rejections = Math.round(applications * (0.2 + rnd() * 0.4));

const pipeline = {
  jobsScanned: scanned,
  eligible,
  score7plus,
  approved: Math.min(score7plus, int(5, Math.max(6, Math.round(score7plus * 0.4)))),
  applications,
  interviews,
  rejections,
  recruiters: int(0, Math.max(1, Math.round(interviews * 1.5))),
  crmTracked: int(10, 80),
};

const aiCosts = { 
  totalSpent: Number((rnd() * 0.9).toFixed(4)), 
  totalCalls: int(200, 900) 
};

// Generate job matches
const COMPANIES = ["Example Corp", "Acme Analytics", "Northwind Labs", "Globex Systems", "Initech Cloud", "Umbrella Data", "Hooli Works"];
const TITLES = ["Technical Program Manager", "Business Analyst", "Product Operations Associate", "Project Coordinator", "AI Product Manager", "Data Operations Analyst"];
const PLACES = ["Indianapolis, IN", "Remote (US)", "Chicago, IL", "Columbus, OH", "Austin, TX"];
const topJobs = Array.from({ length: 5 }, (_, i) => ({
  title: pick(TITLES),
  company: pick(COMPANIES),
  location: pick(PLACES),
  score: int(7, 10),
  url: "https://example.com/job/" + (1000 + i),
})).sort((x, y) => y.score - x.score);

// Format timestamps
const iso = (d) => d.toISOString();
const ago = (h) => iso(new Date(now.getTime() - h * 3600e3));
const dateOpts = { timeZone: 'America/New_York', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit' };
const etString = now.toLocaleString('en-US', dateOpts).replace(',', '') + ' ET';

// Assemble the final clean JSON payload (without recentNews)
const stats = {
  generatedAt: iso(now),
  generatedAtET: etString,
  pipeline,
  lastRuns: { 
    jobScan: ago(5), 
    news: ago(9), 
    gmailParsed: ago(2), 
    newsGenerated: ago(9) 
  },
  aiCosts: { 
    ...aiCosts, 
    lastUpdated: ago(1) 
  },
  topJobs,
};

// Write stats.json
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "stats.json"), JSON.stringify(stats, null, 2) + "\n");

// Build and write index.html using your real template
try {
  const src = fs.readFileSync(path.join(repoRoot, "github-export.mjs"), "utf-8");
  const tmp = path.join(here, ".exporter-copy.mjs");
  fs.writeFileSync(tmp, src + "\nexport { buildStaticHTML };\n");
  const mod = await import(pathToFileURL(tmp).href);
  let html = mod.buildStaticHTML(stats);
  fs.writeFileSync(path.join(outDir, "index.html"), html);
  fs.unlinkSync(tmp);
} catch (e) {
  try { fs.unlinkSync(path.join(here, ".exporter-copy.mjs")); } catch {}
  console.warn("Could not render index.html:", e.message);
}#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");

const args = process.argv.slice(2);
const publish = args.includes("--publish");
const outDir = publish ? repoRoot : path.join(here, "out");

// Generate a seed based on today's UTC date so numbers change automatically at midnight
const now = new Date();
const dateStr = now.toISOString().slice(0, 10);
const fnv1a = (str) => { let h = 0x811c9dc5; for (const c of str) { h ^= c.charCodeAt(0); h = Math.imul(h, 0x01000193); } return h >>> 0; };
const seed = fnv1a(dateStr);

// Seeded random number generator
let a = seed >>> 0;
const rnd = () => {
  a |= 0; a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const int = (lo, hi) => Math.floor(lo + rnd() * (hi - lo + 1));
const pick = (arr) => arr[int(0, arr.length - 1)];

// Generate daily pipeline numbers
const scanned = int(300, 900);
const eligible = Math.round(scanned * (0.25 + rnd() * 0.35));
const score7plus = Math.round(eligible * (0.2 + rnd() * 0.3));
const applications = Math.min(score7plus, int(5, 60));
const interviews = Math.round(applications * (0.05 + rnd() * 0.15));
const rejections = Math.round(applications * (0.2 + rnd() * 0.4));

const pipeline = {
  jobsScanned: scanned,
  eligible,
  score7plus,
  approved: Math.min(score7plus, int(5, Math.max(6, Math.round(score7plus * 0.4)))),
  applications,
  interviews,
  rejections,
  recruiters: int(0, Math.max(1, Math.round(interviews * 1.5))),
  crmTracked: int(10, 80),
};

const aiCosts = { 
  totalSpent: Number((rnd() * 0.9).toFixed(4)), 
  totalCalls: int(200, 900) 
};

// Generate job matches
const COMPANIES = ["Example Corp", "Acme Analytics", "Northwind Labs", "Globex Systems", "Initech Cloud", "Umbrella Data", "Hooli Works"];
const TITLES = ["Technical Program Manager", "Business Analyst", "Product Operations Associate", "Project Coordinator", "AI Product Manager", "Data Operations Analyst"];
const PLACES = ["Indianapolis, IN", "Remote (US)", "Chicago, IL", "Columbus, OH", "Austin, TX"];
const topJobs = Array.from({ length: 5 }, (_, i) => ({
  title: pick(TITLES),
  company: pick(COMPANIES),
  location: pick(PLACES),
  score: int(7, 10),
  url: "https://example.com/job/" + (1000 + i),
})).sort((x, y) => y.score - x.score);

// Format timestamps
const iso = (d) => d.toISOString();
const ago = (h) => iso(new Date(now.getTime() - h * 3600e3));
const dateOpts = { timeZone: 'America/New_York', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit' };
const etString = now.toLocaleString('en-US', dateOpts).replace(',', '') + ' ET';

// Assemble the final clean JSON payload (without recentNews)
const stats = {
  generatedAt: iso(now),
  generatedAtET: etString,
  pipeline,
  lastRuns: { 
    jobScan: ago(5), 
    news: ago(9), 
    gmailParsed: ago(2), 
    newsGenerated: ago(9) 
  },
  aiCosts: { 
    ...aiCosts, 
    lastUpdated: ago(1) 
  },
  topJobs,
};

// Write stats.json
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "stats.json"), JSON.stringify(stats, null, 2) + "\n");

// Build and write index.html using your real template
try {
  const src = fs.readFileSync(path.join(repoRoot, "github-export.mjs"), "utf-8");
  const tmp = path.join(here, ".exporter-copy.mjs");
  fs.writeFileSync(tmp, src + "\nexport { buildStaticHTML };\n");
  const mod = await import(pathToFileURL(tmp).href);
  let html = mod.buildStaticHTML(stats);
  fs.writeFileSync(path.join(outDir, "index.html"), html);
  fs.unlinkSync(tmp);
} catch (e) {
  try { fs.unlinkSync(path.join(here, ".exporter-copy.mjs")); } catch {}
  console.warn("Could not render index.html:", e.message);
}
