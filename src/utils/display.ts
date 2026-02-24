import chalk from "chalk";
import Table from "cli-table3";

// ─── Colors / Badges ──────────────────────────────────────────────────────────

export const c = {
  title: (s: string) => chalk.bold.cyan(s),
  key: (s: string) => chalk.dim(s),
  val: (s: string) => chalk.white(s),
  num: (s: string | number) => chalk.yellow(String(s)),
  link: (s: string) => chalk.underline.blue(s),
  ok: (s: string) => chalk.green(s),
  warn: (s: string) => chalk.yellow(s),
  err: (s: string) => chalk.red(s),
  muted: (s: string) => chalk.dim(s),
  badge: (s: string, color: "green" | "red" | "yellow" | "blue" | "magenta" | "cyan" | "white" = "white") =>
    chalk[color].bold(` ${s} `),
  header: (s: string) => chalk.bold.underline(s),
  section: (s: string) => chalk.bold.magenta(`\n── ${s} ──`),
};

// ─── Print helpers ────────────────────────────────────────────────────────────

export function printKeyValue(pairs: [string, string | number | boolean | undefined | null][], indent = 0) {
  const pad = " ".repeat(indent);
  for (const [key, val] of pairs) {
    if (val === undefined || val === null) continue;
    const formattedVal = typeof val === "boolean"
      ? (val ? c.ok("yes") : c.err("no"))
      : c.val(String(val));
    console.log(`${pad}${c.key(key.padEnd(22))} ${formattedVal}`);
  }
}

export function printTable(
  headers: string[],
  rows: (string | number | undefined | null)[][],
  opts?: { colWidths?: number[] }
) {
  const tableOpts: ConstructorParameters<typeof Table>[0] = {
    head: headers.map((h) => chalk.bold.cyan(h)),
    style: { border: ["dim"], head: [] },
  };
  // Only set colWidths if explicitly provided — passing `undefined` overrides the library default ([])
  if (opts?.colWidths) tableOpts.colWidths = opts.colWidths;
  const table = new Table(tableOpts);
  for (const row of rows) {
    table.push(row.map((cell) => (cell === undefined || cell === null ? c.muted("\u2014") : String(cell))));
  }
  console.log(table.toString());
}

export function printSection(title: string) {
  console.log(c.section(title));
}

export function printTitle(title: string) {
  console.log("\n" + c.title("  " + title));
  console.log(chalk.dim("  " + "─".repeat(title.length + 2)));
}

export function printJSON(data: unknown) {
  console.log(JSON.stringify(data, null, 2));
}

export function printError(msg: string, err?: unknown) {
  const detail = err instanceof Error ? err.message : String(err ?? "");
  console.error(c.err(`✖  ${msg}`) + (detail ? c.muted(`\n   ${detail}`) : ""));
}

export function printSuccess(msg: string) {
  console.log(c.ok(`✔  ${msg}`));
}

export function printWarn(msg: string) {
  console.log(c.warn(`⚠  ${msg}`));
}

export function printInfo(msg: string) {
  console.log(c.muted(`ℹ  ${msg}`));
}

export function truncate(str: string, max: number): string {
  if (!str) return "";
  return str.length > max ? str.slice(0, max - 1) + "…" : str;
}

export function pluralize(n: number, word: string): string {
  return `${n} ${word}${n !== 1 ? "s" : ""}`;
}

export function formatDate(iso: string | undefined | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(iso: string | undefined | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function stateBadge(state: string): string {
  const s = state.toLowerCase();
  if (s === "open") return c.badge("OPEN", "green");
  if (s === "closed") return c.badge("CLOSED", "red");
  if (s === "merged") return c.badge("MERGED", "magenta");
  if (s === "success") return c.badge("SUCCESS", "green");
  if (s === "failure") return c.badge("FAILURE", "red");
  if (s === "pending" || s === "queued" || s === "in_progress") return c.badge(s.toUpperCase(), "yellow");
  return c.badge(state.toUpperCase(), "white");
}
