// Language drivers. A driver tells the runner core how one language's dojos work.
// To add a language: write lib/langs/<lang>.ts implementing Driver, register it below, and add
// course/shared/<lang>/ helpers with fail()/say() (see references/dojo.md, "Adding a language").
import type { BuildError, Dojo, Parsed } from "../runner.ts";
import { go } from "./go.ts";
import { python } from "./python.ts";
import { rust } from "./rust.ts";
import { typescript } from "./typescript.ts";

export interface Driver {
	/** CodeMirror mode for the editor, e.g. "text/x-go". */
	readonly editor: string;
	/** What the UI says it runs, e.g. "go test -race". */
	label(dojo: Dojo): string;
	/** Where the learner's files sit inside workspace/<id>/ ("" = the dojo folder itself). */
	readonly learnerDir: string;
	/** Where tests/ is copied inside workspace/<id>/. */
	readonly testsDir: string;
	/** Seconds before a whole run is killed (first builds can be slow). */
	readonly timeoutSec: number;
	isLearnerFile(name: string): boolean;
	/** The level a test file belongs to, from its name, or null if it is a helper. */
	levelOf(testFile: string): number | null;
	/** The toolchain's version, or why it can't be used (shown to the learner, in both languages). */
	toolchain(): { version?: string; missing?: string };
	/** One-time workspace setup for these dojos (module files, installs). Throws a readable message. */
	prepare(ws: string, dojos: Dojo[], log: (s: string) => void): void;
	/** Copy course/shared/<lang>/ where this language's tests can import it. */
	copyShared(ws: string, dojo: Dojo, from: string): void;
	command(ws: string, dojo: Dojo, level: number, report: string): { argv: string[]; cwd: string; env?: Record<string, string> };
	parse(run: { stdout: string; stderr: string; code: number | null; report: string; ws: string; dojo: Dojo; level: number }): Parsed;
}

export const DRIVERS: Record<string, Driver> = { go, typescript, python, rust };

// ---------------------------------------------------------------- helpers for drivers

import { spawnSync } from "node:child_process";

/** `cmd --version`-style probe: the first line of output, or null if the command is missing. */
export function probe(argv: string[]): string | null {
	const r = spawnSync(argv[0], argv.slice(1), { encoding: "utf8", shell: process.platform === "win32" });
	if (r.error || r.status !== 0) return null;
	return (r.stdout || r.stderr).trim().split("\n")[0];
}

/** Find "<file>:<line>:<col>" (or "<file>", line <n>) mentions of the learner's files in compiler or loader output. */
export function findBuildErrors(text: string, re: RegExp, isLearner: (f: string) => boolean, msgOf: (match: RegExpMatchArray) => string): BuildError[] {
	const out: BuildError[] = [];
	for (const m of text.matchAll(re)) {
		const file = (m.groups!.file).split(/[\\/]/).pop()!;
		if (!isLearner(file)) continue;
		const line = +m.groups!.line, col = +(m.groups!.col ?? 1);
		if (!out.some((b) => b.file === file && b.line === line)) out.push({ file, line, col, msg: msgOf(m).trim() });
	}
	return out;
}

/** Keep stack/traceback lines that point at the learner's code, with paths shortened to the file name. */
export function learnerLines(text: string, dojoId: string): string {
	return text.split("\n")
		.filter((s) => !/node:internal|node_modules|site-packages|\/rustc\/|\/\.cargo\/|\/shared\//.test(s))
		.map((s) => s.replace(new RegExp(`(?:file://)?[^\\s("']*/${dojoId}/(?:src/)?`, "g"), ""))
		.join("\n").trim();
}

export const tail = (s: string, n: number) => (s.length > n ? "…" + s.slice(-n) : s);
