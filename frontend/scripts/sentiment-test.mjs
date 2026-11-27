// Runs the same cases as backend/tests/test_sentiment.py against the TypeScript engine.
import { build } from "esbuild";
import { readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const out = join(mkdtempSync(join(tmpdir(), "pulse-")), "engine.mjs");
await build({ entryPoints: ["src/sentiment/engine.ts"], bundle: true, format: "esm", platform: "node", outfile: out, logLevel: "silent" });
const { analyze, assessPriority } = await import(pathToFileURL(out).href);
const cases = JSON.parse(readFileSync("../backend/tests/sentiment_cases.json", "utf8"));
let fail = 0;
for (const c of cases) {
  const a = analyze(c.text);
  a.priority = assessPriority(a, c.text)[0];
  for (const k of ["label", "emotion", "intent", "primary_topic", "possible_sarcasm", "priority"]) {
    if (k in c && a[k] !== c[k]) { fail++; console.log(`FAIL ${k}: got ${a[k]} expected ${c[k]} | ${c.text}`); }
  }
}
console.log(fail ? `${fail} mismatches` : `all ${cases.length} cases match the Python engine expectations`);
process.exit(fail ? 1 : 0);
