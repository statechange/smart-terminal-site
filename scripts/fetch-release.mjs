#!/usr/bin/env node
// Fetches the STABLE release manifest at build time so the version number
// and DMG download link auto-update on every rebuild without a manual edit.
//
// Source of truth: https://smart-terminal-releases.nyc3.digitaloceanspaces.com/latest.json
// This is the STABLE channel only — never point this at a canary/dev manifest.
//
// Output: src/generated/release.json, consumed by src/lib/release.ts

import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const MANIFEST_URL =
  "https://smart-terminal-releases.nyc3.digitaloceanspaces.com/latest.json";

const FALLBACK = {
  version: "0.1.7",
  dmgUrl:
    "https://smart-terminal-releases.nyc3.digitaloceanspaces.com/Smart%20Terminal_0.1.7_aarch64.dmg",
  pub_date: "2026-06-17T14:41:28Z",
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "..", "src", "generated");
const outFile = join(outDir, "release.json");

async function main() {
  let data = FALLBACK;
  try {
    const res = await fetch(MANIFEST_URL);
    if (!res.ok) throw new Error(`manifest fetch failed: ${res.status}`);
    const manifest = await res.json();
    const version = manifest.version;
    if (!version) throw new Error("manifest missing version");
    // The manifest only lists the .app.tar.gz updater artifact, not the
    // human-facing .dmg. The DMG follows a fixed naming convention on the
    // same bucket, so derive it from the version we just fetched.
    const dmgUrl = `https://smart-terminal-releases.nyc3.digitaloceanspaces.com/Smart%20Terminal_${version}_aarch64.dmg`;
    data = { version, dmgUrl, pub_date: manifest.pub_date ?? null };
    console.log(`[fetch-release] using live manifest: v${version}`);
  } catch (err) {
    console.warn(
      `[fetch-release] could not fetch live manifest (${err.message}), falling back to hardcoded v${FALLBACK.version}`,
    );
  }

  mkdirSync(outDir, { recursive: true });
  writeFileSync(outFile, JSON.stringify(data, null, 2) + "\n");
  console.log(`[fetch-release] wrote ${outFile}`);
}

main();
