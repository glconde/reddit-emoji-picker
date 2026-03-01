// scripts/generate-emojis.js
// Usage: node scripts/generate-emojis.js
// Reads: data/emoji-test.txt (from Unicode)
// Writes: emoji-data.json

"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const INPUT = path.join(ROOT, "data", "emoji-test.txt");
const ALIASES_PATH = path.join(ROOT, "data", "aliases.json");
const OUTPUT = path.join(ROOT, "emoji-data.json");

// Basic stopwords to keep keywords useful
const STOPWORDS = new Set([
  "and",
  "or",
  "with",
  "of",
  "the",
  "a",
  "an",
  "to",
  "for",
  "on",
  "in",
  "at",
  "face", // optional; remove if you prefer it searchable
]);

/**
 * Map Unicode groups to your extension categories.
 * emoji-test.txt groups include things like "Smileys & Emotion", "People & Body", etc.
 */
function mapGroupToCategory(group) {
  const g = (group || "").toLowerCase();

  if (g.includes("smileys")) return "smileys";
  if (g.includes("people") || g.includes("body")) return "people";
  if (g.includes("animals") || g.includes("nature")) return "animals";
  if (g.includes("food") || g.includes("drink")) return "food";
  if (g.includes("travel") || g.includes("places")) return "places";
  if (g.includes("activities")) return "activities";
  if (g.includes("objects")) return "objects";
  if (g.includes("symbols")) return "symbols";
  if (g.includes("flags")) return "flags";

  return "other";
}

function safeReadJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return {};
  }
}

function normalizeName(name) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function tokenize(name) {
  return normalizeName(name)
    .split(/[^a-z0-9]+/i)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
    .filter((t) => !STOPWORDS.has(t));
}

function uniq(arr) {
  return [...new Set(arr)];
}

function makeShortcode(name) {
  // Basic :like_this: without colons (you can add colons in UI later if you want)
  return normalizeName(name)
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * Parse Unicode emoji-test.txt
 * Keep only "fully-qualified" entries.
 * Format example:
 * 1F600                                      ; fully-qualified     # 😀 E1.0 grinning face
 */
function parseEmojiTestFile(text) {
  const lines = text.split(/\r?\n/);

  let currentGroup = "";
  let currentSubgroup = "";

  /** @type {Array<{emoji:string,name:string,group:string,subgroup:string}>} */
  const out = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) continue;

    // Group header: "# group: Smileys & Emotion"
    if (trimmed.startsWith("# group:")) {
      currentGroup = trimmed.replace("# group:", "").trim();
      continue;
    }

    // Subgroup header: "# subgroup: face-smiling"
    if (trimmed.startsWith("# subgroup:")) {
      currentSubgroup = trimmed.replace("# subgroup:", "").trim();
      continue;
    }

    // Skip comments
    if (trimmed.startsWith("#")) continue;

    // Only keep lines that contain "; fully-qualified"
    if (!trimmed.includes("; fully-qualified")) continue;

    // Extract the comment portion after "#"
    const hashIdx = trimmed.indexOf("#");
    if (hashIdx === -1) continue;

    const comment = trimmed.slice(hashIdx + 1).trim();
    // comment example: "😀 E1.0 grinning face"

    // First token in comment is emoji char(s)
    const parts = comment.split(/\s+/);
    const emoji = parts[0];

    // Name is after version token like "E1.0"
    // Find the token that matches /^E\d+(\.\d+)?$/
    const versionIdx = parts.findIndex((p) => /^E\d+(\.\d+)?$/.test(p));
    if (versionIdx === -1) continue;

    const name = parts
      .slice(versionIdx + 1)
      .join(" ")
      .trim();
    if (!emoji || !name) continue;

    out.push({ emoji, name, group: currentGroup, subgroup: currentSubgroup });
  }

  return out;
}

function buildKeywords(name, tokenAliases, phraseAliases) {
  const tokens = tokenize(name);

  const extra = [];

  // token-based aliases
  for (const t of tokens) {
    const aliases = tokenAliases[t];
    if (Array.isArray(aliases))
      extra.push(...aliases.map((x) => String(x).toLowerCase()));
  }

  // phrase-based aliases (full name match)
  const phrase = normalizeName(name);
  const pal = phraseAliases[phrase];
  if (Array.isArray(pal))
    extra.push(...pal.map((x) => String(x).toLowerCase()));

  return uniq([...tokens, ...extra]);
}

function main() {
  if (!fs.existsSync(INPUT)) {
    console.error(`Missing input file: ${INPUT}`);
    console.error(`Put Unicode emoji-test.txt into data/emoji-test.txt`);
    process.exit(1);
  }

  //const aliasesMap = safeReadJson(ALIASES_PATH);
  const aliasesCfg = safeReadJson(ALIASES_PATH);
  const tokenAliases = aliasesCfg.tokens || {};
  const phraseAliases = aliasesCfg.phrases || {};

  const raw = fs.readFileSync(INPUT, "utf8");
  const parsed = parseEmojiTestFile(raw);

  // Deduplicate by emoji character (some entries can repeat with variation selectors)
  const seen = new Set();

  const final = [];
  for (const item of parsed) {
    // Simple dedupe key: emoji itself
    if (seen.has(item.emoji)) continue;
    seen.add(item.emoji);

    const category = mapGroupToCategory(item.group);
    const name = normalizeName(item.name);

    final.push({
      emoji: item.emoji,
      name,
      category,
      keywords: buildKeywords(name, tokenAliases, phraseAliases),
      shortcodes: uniq([makeShortcode(name)]),
      // optional debug fields (comment these out if you don’t want them)
      // group: item.group,
      // subgroup: item.subgroup,
    });
  }

  fs.writeFileSync(OUTPUT, JSON.stringify(final, null, 2), "utf8");
  console.log(`Wrote ${final.length} emojis to ${OUTPUT}`);
}

main();
