#!/usr/bin/env node
// scripts/postinstall.mjs
// A short, friendly greeting printed once after `npm install` / `pnpm add`.
//
// Print-only by design: it reads nothing outside the package, writes only to
// stdout, and never touches the network — satisfying security invariant I-10
// (no postinstall side-effects outside the package's own install directory).
// Any failure is swallowed so a greeting can never break an install.

import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PKG_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const LINKS = [
  ["GitHub", "https://github.com/odere-pro"],
  ["LinkedIn", "https://www.linkedin.com/in/oleksander-derechei/"],
  ["Medium", "https://medium.com/@odere.pub"],
];

// Wrap text in an SGR sequence (no-op when colour is disabled).
const sgr = (code, text, color) => (color ? `\x1b[${code}m${text}\x1b[0m` : text);

// Underline + OSC 8 hyperlink so modern terminals render the URL clickable.
const link = (url, color) =>
  color ? `\x1b]8;;${url}\x1b\\\x1b[4m${url}\x1b[24m\x1b]8;;\x1b\\` : url;

function buildGreeting(color) {
  const widest = Math.max(...LINKS.map(([label]) => label.length));
  const linkLines = LINKS.map(
    ([label, url]) => `  ${sgr("2", `${label}:`.padEnd(widest + 1), color)} ${link(url, color)}`,
  ).join("\n");

  return (
    [
      "",
      `${sgr("1;36", "agentline", color)} — a fast, themeable statusline for Claude Code.`,
      `Run ${sgr("1", "`agentline install`", color)} to wire it into your settings, or ${sgr("1", "`agentline edit`", color)} to customize.`,
      "",
      linkLines,
      "",
      sgr("1;35", "Happy Agentic Engineering ✨", color),
      "",
    ].join("\n") + "\n"
  );
}

function shouldGreet() {
  // Escape hatch for verifying the greeting from inside the source tree.
  if (process.env.AGENTLINE_GREETING_FORCE === "1") return true;
  // Stay quiet during the source repo's own installs (the published package
  // ships no src/) and in CI / other non-interactive runs.
  if (existsSync(resolve(PKG_ROOT, "src"))) return false;
  if (process.env.CI) return false;
  return true;
}

try {
  if (shouldGreet()) {
    const color = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
    process.stdout.write(buildGreeting(color));
  }
} catch {
  // A greeting must never fail an install.
}
