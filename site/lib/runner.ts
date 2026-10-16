// The runner core, shared by server.ts (the local runner) and dev/check.ts (the dojo verifier).
// It knows nothing about any one language: each dojo names its language in course/dojos/<id>/dojo.json,
// and a driver in lib/langs/ says how to set up the workspace, which files are the learner's,
// how to run one level's tests, and how to read the result.
//
// A dojo:  course/dojos/<id>/
//   dojo.json     {"lang": "go" | "typescript" | "python" | "rust", ...driver options}
//   starter/      the learner's first files (copied once into the workspace; never overwritten)
//   tests/        level tests and test doubles (rewritten on every run)
//   reference/    a full solution, for dev/check.ts (spoilers)
//   harness/      optional: build files the learner doesn't edit (Cargo.toml, …), rewritten on every run
// Shared helpers per language live in course/shared/<lang>/.
import { spawn } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DRIVERS, type Driver } from "./langs/index.ts";

export const SITE = dirname(dirname(fileURLToPath(import.meta.url)));
export const DOJOS = join(SITE, "course", "dojos");
export const SHARED = join(SITE, "course", "shared");
export const ID_RE = /^[a-z][a-z0-9_]*$/;

export type DojoConfig = { lang: string; [option: string]: unknown };
export type Dojo = { id: string; levels: number; config: DojoConfig; driver: Driver };

export type BuildError = { file: string; line: number; col: number; msg: string };
export type TestResult = {
	name: string; ok: boolean; elapsed: number;
	code?: string; msg?: string; msg_en?: string; detail?: string; diff?: unknown; output?: string; events?: unknown; t_end?: number;
};
export type RunResult = {
	dojo: string; level: number; ok: boolean; race: boolean;
	build_errors?: BuildError[]; fatal?: TestResult; tests: TestResult[]; seconds: number;
};
/** What a driver hands back after one run; the core adds failure codes, traces and timing. */
export type Parsed = {
	tests: {
		name: string; ok: boolean; elapsed: number; message?: string; output?: string; timedOut?: boolean;
		/** A failure the language runtime itself detected (data race, panic, …): wins over the test's own DOJO_FAIL. */
		runtime?: { code: string; msg: string; msg_en: string; detail?: string };
	}[];
	buildErrors?: BuildError[];
	/** Text that explains a failure not tied to one test (did not compile, crashed). */
	fatal?: { code: string; msg: string; msg_en: string; detail?: string };
	race?: boolean;
	output?: string;
};

/** Every dojo with its level count. A dojo whose language has no driver is skipped with a warning. */
export function findDojos(warn: (s: string) => void = () => {}): Record<string, Dojo> {
	const out: Record<string, Dojo> = {};
	if (!existsSync(DOJOS)) return out;
	for (const id of readdirSync(DOJOS).sort()) {
		const dir = join(DOJOS, id);
		if (!ID_RE.test(id) || !existsSync(join(dir, "dojo.json"))) continue;
		const config = JSON.parse(readFileSync(join(dir, "dojo.json"), "utf8")) as DojoConfig;
		const driver = DRIVERS[config.lang];
		if (!driver) { warn(`练功房 ${id}：不认识的语言 "${config.lang}"，已跳过。 / Dojo ${id}: unknown language "${config.lang}", skipped.`); continue; }
		const levels = Math.max(0, ...readdirSync(join(dir, "tests"), { recursive: true }).map((f) => driver.levelOf(String(f).split(/[\\/]/).pop()!) ?? 0));
		if (levels > 0) out[id] = { id, levels, config, driver };
	}
	return out;
}

/** Folder of the learner's files inside the workspace. */
export const learnerDir = (ws: string, d: Dojo) => join(ws, d.id, d.driver.learnerDir);
export const isLearnerFile = (d: Dojo, name: string) => d.driver.isLearnerFile(name);

/** Copy starter files the learner doesn't have yet. */
export function addStarters(ws: string, d: Dojo): void {
	const src = join(DOJOS, d.id, "starter"), dst = learnerDir(ws, d);
	mkdirSync(dst, { recursive: true });
	for (const f of readdirSync(src)) if (!existsSync(join(dst, f))) cpSync(join(src, f), join(dst, f), { recursive: true });
}

/** Rewrite everything that isn't the learner's: harness files, tests and shared helpers. */
export function refreshHarness(ws: string, d: Dojo): void {
	const dir = join(ws, d.id);
	mkdirSync(dir, { recursive: true });
	const harness = join(DOJOS, d.id, "harness");
	if (existsSync(harness)) cpSync(harness, dir, { recursive: true });
	cpSync(join(DOJOS, d.id, "tests"), join(dir, d.driver.testsDir), { recursive: true });
	d.driver.copyShared(ws, d, join(SHARED, d.config.lang));
}

/** Set up the workspace for every dojo (toolchain check, package installs). Returns a message per dojo that can't run. */
export function prepareWorkspace(ws: string, dojos: Dojo[], log: (s: string) => void = () => {}): Record<string, string> {
	mkdirSync(ws, { recursive: true });
	const missing: Record<string, string> = {};
	const byLang = new Map<Driver, Dojo[]>();
	for (const d of dojos) byLang.set(d.driver, [...(byLang.get(d.driver) ?? []), d]);
	for (const [driver, list] of byLang) {
		const problem = driver.toolchain().missing;
		if (problem) { for (const d of list) missing[d.id] = problem; log(problem); continue; }
		try { driver.prepare(ws, list, log); }
		catch (e) { for (const d of list) missing[d.id] = String((e as Error).message ?? e); log(String((e as Error).message ?? e)); }
	}
	return missing;
}

const TIMEOUT = { zh: (s: number) => `测试运行超过 ${s} 秒，已经强行停止。可能有死循环、死锁，或者在等一个永远不会结束的东西。`, en: (s: number) => `The tests ran for over ${s} seconds and were stopped. There may be an endless loop, a deadlock, or a wait on something that never finishes.` };

/** Run one level's tests and turn the driver's report into the UI's result JSON. */
export async function runLevel(ws: string, d: Dojo, level: number): Promise<RunResult> {
	const start = Date.now();
	const res: RunResult = { dojo: d.id, level, ok: false, race: false, tests: [], seconds: 0 };
	const traceDir = mkdtempSync(join(tmpdir(), "dojo-trace-"));
	const reportDir = mkdtempSync(join(tmpdir(), "dojo-report-"));
	const cmd = d.driver.command(ws, d, level, join(reportDir, "report"));
	const limit = d.driver.timeoutSec;
	let stdout = "", stderr = "", timedOut = false;
	const code = await new Promise<number | null>((resolve) => {
		const child = spawn(cmd.argv[0], cmd.argv.slice(1), { cwd: cmd.cwd, env: { ...process.env, ...cmd.env, DOJO_TRACE_DIR: traceDir }, shell: process.platform === "win32" });
		const timer = setTimeout(() => { timedOut = true; child.kill("SIGKILL"); }, limit * 1000);
		child.stdout.on("data", (b) => { stdout += b; });
		child.stderr.on("data", (b) => { stderr += b; });
		child.on("error", (e) => { stderr += String(e); });
		child.on("close", (c) => { clearTimeout(timer); resolve(c); });
	});
	res.seconds = (Date.now() - start) / 1000;
	const parsed = d.driver.parse({ stdout, stderr, code, report: join(reportDir, "report"), ws, dojo: d, level });
	rmSync(reportDir, { recursive: true, force: true });
	res.race = !!parsed.race;
	if (parsed.buildErrors?.length) res.build_errors = parsed.buildErrors;
	for (const t of parsed.tests) {
		const r: TestResult = { name: t.name, ok: t.ok, elapsed: t.elapsed };
		if (!t.ok) {
			classify(r, t.message ?? "");
			if (t.runtime) Object.assign(r, t.runtime);
			if (t.timedOut) { r.code = "timeout"; r.msg = "这个测试超时了：可能有死循环、死锁，或者在等一个永远不会结束的东西。"; r.msg_en = "This test timed out: maybe an endless loop, a deadlock, or a wait on something that never finishes."; }
			const out = (t.output ?? parsed.output ?? "").trim();
			if (out) r.output = tail(out, 6000);
		}
		const trace = join(traceDir, t.name + ".json");
		if (existsSync(trace)) { try { const tr = JSON.parse(readFileSync(trace, "utf8")); r.events = tr.events; r.t_end = tr.t_end; } catch {} }
		res.tests.push(r);
	}
	rmSync(traceDir, { recursive: true, force: true });
	if (parsed.fatal) res.fatal = { name: "", ok: false, elapsed: 0, ...parsed.fatal };
	if (timedOut) res.fatal = { name: "", ok: false, elapsed: 0, code: "timeout", msg: TIMEOUT.zh(limit), msg_en: TIMEOUT.en(limit) };
	if (!res.tests.length && !res.fatal && code !== 0)
		res.fatal = { name: "", ok: false, elapsed: 0, code: "crash", msg: "测试没能运行。", msg_en: "The tests could not run.", detail: tail((stderr + "\n" + stdout).trim(), 4000) };
	res.ok = code === 0 && res.tests.length > 0 && res.tests.every((t) => t.ok);
	return res;
}

const MARK = "DOJO_FAIL ";

/** A failure code the UI has hints for. Tests report their own with a `DOJO_FAIL {json}` line (fail() in each language's helper). */
function classify(t: TestResult, message: string): void {
	const i = message.indexOf(MARK);
	if (i >= 0) {
		const rest = message.slice(i + MARK.length);
		const end = jsonEnd(rest);
		try {
			const f = JSON.parse(rest.slice(0, end));
			t.code = f.code; t.msg = f.msg; t.msg_en = f.msg_en ?? f.msg;
			if (f.diff) t.diff = f.diff; if (f.detail) t.detail = f.detail;
			return;
		} catch {}
	}
	t.code = "fail"; t.msg = "测试失败。"; t.msg_en = "Test failed.";
	if (message.trim()) t.detail = tail(message.trim(), 4000);
}

/** Length of the JSON object at the start of s (the message may continue after it). */
function jsonEnd(s: string): number {
	let depth = 0, str = false, esc = false;
	for (let i = 0; i < s.length; i++) {
		const c = s[i];
		if (str) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === '"') str = false; continue; }
		if (c === '"') str = true; else if (c === "{") depth++; else if (c === "}" && --depth === 0) return i + 1;
	}
	return s.length;
}

export function tail(s: string, n: number): string {
	return s.length > n ? "…" + s.slice(-n) : s;
}
