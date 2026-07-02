// Release info, populated at build time by scripts/fetch-release.mjs from
// https://smart-terminal-releases.nyc3.digitaloceanspaces.com/latest.json
// (STABLE channel only). If that fetch fails, scripts/fetch-release.mjs
// falls back to a hardcoded version — see that file to update it manually.
import release from "../generated/release.json";

export const RELEASE: { version: string; dmgUrl: string; pub_date: string | null } =
  release;
