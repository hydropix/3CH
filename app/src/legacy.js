// Converts a legacy 3CH theme folder (structure.txt + one comma-separated
// list per slot, Windows-1252 encoded) into the v2 JSON theme format.
//
// Faithful to the original data, with the parsing bugs fixed:
//  - entries separated by a newline but missing their comma are split apart
//  - a ";" typed instead of "," at the end of a line is treated as a comma
//  - accidental empty entries ("child, ,") are dropped, but lists that use
//    many empty entries on purpose (Darwin adverbs) keep them as a weighted
//    "nothing" entry
//  - duplicates become an explicit weight, preserving the original odds
//  - single-word lists such as "with" / "and" become literal words

const fs = require('fs');
const path = require('path');

const INTENTIONAL_EMPTY_MIN = 3;

function readLegacyFile(file) {
  const buf = fs.readFileSync(file);
  // Files written before 2008 on French Windows: ANSI code page, not UTF-8.
  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    text = new TextDecoder('windows-1252').decode(buf);
  }
  return text.replace(/^﻿/, '');
}

function cleanEntry(raw) {
  let s = raw.replace(/\s+/g, ' ').trim().replace(/^"+|"+$/g, '').trim();
  // Stray opening brackets, e.g. "(  (in black and white)".
  const count = (ch) => s.split(ch).length - 1;
  while (s.startsWith('(') && count('(') > count(')')) s = s.slice(1).trim();
  return s;
}

function parseList(text) {
  const normalized = text.replace(/;[ \t]*(\r?\n)/g, ',$1');
  const pieces = [];
  for (const chunk of normalized.split(',')) {
    const lines = chunk.split(/\r?\n/).map(cleanEntry);
    const nonEmpty = lines.filter(Boolean);
    if (nonEmpty.length === 0) pieces.push('');
    else pieces.push(...nonEmpty);
  }
  // A trailing comma is the norm in legacy files, not an empty entry.
  while (pieces.length && pieces[pieces.length - 1] === '') pieces.pop();

  const counts = new Map();
  for (const p of pieces) counts.set(p, (counts.get(p) || 0) + 1);

  const empties = counts.get('') || 0;
  if (empties < INTENTIONAL_EMPTY_MIN) counts.delete('');

  return [...counts].map(([text, weight]) => (weight === 1 ? text : { text, weight }));
}

function slugify(name) {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function isLegacyThemeDir(dir) {
  return fs.existsSync(path.join(dir, 'structure.txt'));
}

function convertLegacyTheme(dir) {
  const name = path.basename(dir);
  // Read structure.txt directly: slot order and repeats matter.
  const order = readLegacyFile(path.join(dir, 'structure.txt'))
    .split(',')
    .map(cleanEntry)
    .filter(Boolean);

  const lists = {};
  const structure = [];
  const missing = [];
  for (const slot of order) {
    const file = path.join(dir, `${slot}.txt`);
    if (!fs.existsSync(file)) {
      missing.push(`${slot}.txt`);
      continue;
    }
    if (!(slot in lists)) lists[slot] = parseList(readLegacyFile(file));
    const entries = lists[slot];
    if (entries.length === 1 && typeof entries[0] === 'string') {
      structure.push({ text: entries[0] });
      delete lists[slot];
    } else {
      structure.push(slot);
    }
  }
  if (missing.length) {
    throw new Error(`Theme "${name}" is missing: ${missing.join(', ')}`);
  }

  return {
    format: '3ch-theme/2',
    id: slugify(name),
    name,
    lang: 'en',
    source: 'legacy',
    structure,
    lists,
  };
}

// Theme folders sit a level or two below the folder the user picks. The depth
// limit keeps a scan of a whole drive short, and unreadable folders (access
// denied, broken links) are skipped and passed to `onSkip`.
const MAX_SCAN_DEPTH = 4;
const SKIP_DIRS = new Set(['node_modules']);

function findLegacyThemes(root, { maxDepth = MAX_SCAN_DEPTH, onSkip = () => {} } = {}) {
  if (isLegacyThemeDir(root)) return [root];
  if (maxDepth <= 0) return [];
  let entries;
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch (err) {
    onSkip(root, err);
    return [];
  }
  return entries
    .filter((d) => d.isDirectory() && !d.name.startsWith('.') && !SKIP_DIRS.has(d.name))
    .flatMap((d) => findLegacyThemes(path.join(root, d.name), { maxDepth: maxDepth - 1, onSkip }));
}

module.exports = { convertLegacyTheme, findLegacyThemes, parseList, slugify };
