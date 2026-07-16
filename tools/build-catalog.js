#!/usr/bin/env node
// ============================================================
// DBL Games — catalog builder
// Parses GameMonetize feed dumps (JSON, possibly truncated),
// dedupes against the curated games.js, maps categories,
// and writes:
//   ../more-games.js  (compact catalog, hash-based)
//   ../sitemap.xml    (one URL per game)
// Usage: node build-catalog.js <feed-dir>
// ============================================================
const fs = require("fs");
const path = require("path");

const FEED_DIR = process.argv[2];
const SITE = path.join(__dirname, "..");
const DOMAIN = "https://dblgames.com"; // TODO: replace with your real domain

// ---- load curated titles for dedupe ----
const curated = fs.readFileSync(path.join(SITE, "games.js"), "utf8");
const norm = s => s.toLowerCase().replace(/&amp;|&/g, "and").replace(/[^a-z0-9]+/g, "");
const seen = new Set([...curated.matchAll(/title:\s*"([^"]+)"/g)].map(m => norm(m[1])));
const seenHash = new Set([...curated.matchAll(/gamemonetize\.co\/([a-z0-9]+)\//g)].map(m => m[1]));

// ---- salvage JSON objects even from truncated files ----
function extractGames(text) {
  const start = text.indexOf("[");
  if (start < 0) return [];
  const body = text.slice(start);
  try { return JSON.parse(body); } catch (_) { /* salvage below */ }
  const games = [];
  // objects are flat (no nested braces) — split on "},{" boundaries
  for (const m of body.matchAll(/\{"id":".*?"height":"\d+"\}/gs)) {
    try { games.push(JSON.parse(m[0])); } catch (_) { /* skip broken tail */ }
  }
  return games;
}

// ---- category mapping ----
const BRAIN_RE = /\b(math|brain|memory|sudoku|chess|checkers|2048|quiz|word|iq test|iq |trivia|educational|crossword|backgammon|mahjong)\b/i;
function mapCat(g) {
  const c = (g.category || "").toLowerCase();
  const t = (g.tags || "").toLowerCase();
  const title = g.title || "";
  const all = c + "," + t + "," + title.toLowerCase();
  if (BRAIN_RE.test(title) || BRAIN_RE.test(c + "," + t)) return "brain";
  if (/racing|drift|driving|\bcar\b|traffic|bike|truck|parking/.test(all)) return "driving";
  if (/shooting|shooter|sniper|gun|fps|first person/.test(all)) return "shooting";
  if (/minecraft|\bcraft\b|pixel.*(craft|mine)|voxel/.test(all)) return "minecraft";
  if (/horror|zombie|fnaf|granny|scary|nightmare|siren/.test(all)) return "horror";
  if (/soccer|football|basketball|sports|tennis|golf|baseball|pool|billiard|hockey|bowling/.test(all)) return "sports";
  if (/clicker|idle|tycoon.*click|incremental/.test(all)) return "clicker";
  if (/2 player|2player|two player/.test(all)) return "2player";
  if (/girls|girl|dress up|makeup|makeover|princess|salon|fashion|wedding|nail/.test(all)) return "girls";
  if (/puzzles|puzzle|match 3|match-3|match3|bubble shooter|solitaire|jigsaw|bejeweled|logic|block/.test(all)) return "puzzle";
  if (/cooking|restaurant|simulator|simulation|tycoon|farm|manager/.test(all)) return "sim";
  return "arcade";
}

// ---- collect ----
const files = fs.readdirSync(FEED_DIR).filter(f => f.startsWith("mcp-workspace-web_fetch-"));
let candidates = [];
for (const f of files) {
  const text = fs.readFileSync(path.join(FEED_DIR, f), "utf8");
  if (!text.includes("gamemonetize")) continue; // skip non-feed dumps
  candidates = candidates.concat(extractGames(text));
}
console.log("raw candidates:", candidates.length);

// ---- extra hand-picked games (from feed pages seen inline) ----
const EXTRA = [
  ["CHECKERS - Dames", "brain", "i8j2zx1c8m4pm9f6xx7o1ycf02u0rn3a"],
  ["Backgammonia", "brain", "rg00fk5s40g0kstrnynctsm1mkowdm14"],
  ["Bejeweled Classic", "puzzle", "qwl0zt1wyh78bxjhhax2hn30sv69ssy0"],
  ["Math Playground", "brain", "8wttfggfhrxxl4xfhyslodt3ei83sw0u"],
  ["Dice Math", "brain", "n412slsirp0rlj8kjc4133gdecjvs72k"],
  ["Escape Room: Mystery Word", "brain", "diy0pg8mpyflucxnulnxwm1c2vx7tawj"],
  ["Sort Them All", "brain", "t9sbqi3c9xhq5e2ohjs9uxlufugvfqp8"],
  ["Lines to Fill", "puzzle", "ll5xlw2d9dyh64y15hmupv802eiqq91l"],
  ["Emerland Solitaire", "puzzle", "p64058ybqqb8gwhmesfp87rsqm1m4o7n"],
  ["Magic Solitaire", "puzzle", "j2qpzxqk4a54ho37ilyxj5q06othpvjs"],
  ["Fireboy and Watergirls.IO", "2player", "sre01gq07iyixyhnl51ohykrk3rzx77p"],
  ["Air Hockey Glow", "2player", "od325ee0a7h8dhk3xhykdwddvpuqamsa"],
  ["Fish Eat Fish 2", "2player", "rlr5qfvla8ld3u2b624pmi0ns50opl6g"],
  ["Gang Fall Party", "2player", "i7uarc0zpakotfo600u3t1j18vdzan26"],
  ["Foosball Funny", "2player", "984qz8m6pjfbj7h27k3cn7zv5g74pkwt"],
  ["Nightmare Runners", "2player", "k90ptrr1dyyh2roq34rk4v55uaw8evqk"],
  ["Angry Checkers", "brain", "skma0pcrooj5rpuhitzk7etjqfsctr3l"],
  ["Snake Warz", "arcade", "uxv01zwcngh7d3xm1aqdg9t91qfuh59n"],
  ["Tornado.io", "arcade", "1smka6j97blcuektwham1dtdk7atuhzd"],
  ["Shark Attack", "arcade", "4pf45zrkuykkl00bji0x8owfj6w4ia9m"],
];

// ---- build output list ----
const out = [];
function push(title, cat, hash) {
  const n = norm(title);
  if (!n || seen.has(n) || seenHash.has(hash)) return;
  seen.add(n); seenHash.add(hash);
  out.push({ t: title, c: cat, h: hash });
}
for (const [t, c, h] of EXTRA) push(t, c, h);
for (const g of candidates) {
  const title = (g.title || "").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
  if (!title || title.length > 55) continue;
  const m = (g.url || "").match(/gamemonetize\.co\/([a-z0-9]+)\//);
  if (!m) continue;
  push(title, mapCat(g), m[1]);
}
console.log("unique new games:", out.length);
const counts = {};
out.forEach(g => counts[g.c] = (counts[g.c] || 0) + 1);
console.log(counts);

// ---- write more-games.js ----
const slugify = s => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const js = `// AUTO-GENERATED by tools/build-catalog.js — do not edit by hand.
// Compact GameMonetize catalog: t=title, c=category, h=embed hash.
// embed:  https://html5.gamemonetize.co/{h}/
// thumb:  https://img.gamemonetize.com/{h}/512x384.jpg
const MORE_GAMES = ${JSON.stringify(out)};
`;
fs.writeFileSync(path.join(SITE, "more-games.js"), js);
console.log("wrote more-games.js");

// ---- sitemap ----
const curatedSlugs = [...curated.matchAll(/title:\s*"([^"]+)"/g)].map(m => slugify(m[1]));
const allSlugs = [...new Set(curatedSlugs.concat(out.map(g => slugify(g.t))))];
const urls = ["", ...allSlugs.map(s => "?g=" + s)]
  .map(q => `  <url><loc>${DOMAIN}/${q}</loc></url>`).join("\n");
fs.writeFileSync(path.join(SITE, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
console.log("wrote sitemap.xml with", allSlugs.length + 1, "urls");
