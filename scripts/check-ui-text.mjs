import fs from "node:fs";
import path from "node:path";

// Range: U+1F300 to U+1FAFF, U+2600 to U+27BF, U+2013 (en dash), U+2014 (em dash), U+2190 to U+21FF (arrows)
const FORBIDDEN_REGEX = /[\u2013\u2014\u2190-\u21FF\u2600-\u27BF\u{1F300}-\u{1FAFF}]/u;

// Binary files shouldn't be parsed as text
const BINARY_EXTENSIONS = new Set([
  ".ico",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".pdf",
]);

function getFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(getFiles(fullPath));
    } else {
      const ext = path.extname(entry.name).toLowerCase();
      if (!BINARY_EXTENSIONS.has(ext)) {
        files.push(fullPath);
      }
    }
  }
  return files;
}

const targets = ["src", "public"];
const allFiles = targets.flatMap((t) => getFiles(t));
const violations = [];

for (const file of allFiles) {
  let content = "";
  try {
    content = fs.readFileSync(file, "utf8");
  } catch (err) {
    console.error(`Error reading ${file}:`, err);
    continue;
  }

  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(FORBIDDEN_REGEX);
    if (match) {
      violations.push({
        file,
        line: i + 1,
        char: match[0],
        codePoint: "U+" + match[0].codePointAt(0).toString(16).toUpperCase(),
        snippet: line.trim(),
      });
    }
  }
}

if (violations.length > 0) {
  console.error(`Found ${violations.length} forbidden glyph violation(s):`);
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line} [${v.codePoint} "${v.char}"]: ${v.snippet}`);
  }
  process.exit(1);
} else {
  console.log(`✓ check:ui passed. All ${allFiles.length} files in src and public are clean of forbidden glyphs.`);
  process.exit(0);
}

