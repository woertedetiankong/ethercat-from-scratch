// Go: each dojo is one package in workspace/<id>/, tests are dojo_lv<N>_test.go with TestLv<N>_* functions,
// shared helper packages (course/shared/go/<pkg>/) are imported as "lab/<pkg>". Runs `go test -race -json`.
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Parsed } from "../runner.ts";
import { type Driver, findBuildErrors, probe, tail } from "./index.ts";

let race: boolean | null = null;
const raceOK = () => (race ??= spawnSync("go", ["env", "CGO_ENABLED"], { encoding: "utf8" }).stdout?.trim() === "1");
const LEARNER = /^[a-z][a-z0-9_]*\.go$/;

export const go: Driver = {
	editor: "text/x-go",
	label: () => (raceOK() ? "go test -race" : "go test"),
	learnerDir: "",
	testsDir: "",
	timeoutSec: 150,
	isLearnerFile: (n) => LEARNER.test(n) && !n.endsWith("_test.go"),
	levelOf: (f) => { const m = /^dojo_lv(\d+)_test\.go$/.exec(f); return m ? +m[1] : null; },
	toolchain() {
		const v = probe(["go", "version"]);
		return v ? { version: v.replace(/^go version /, "").split(" ")[0] } : { missing: "没有找到 go 命令。请安装 Go 1.22 或更新的版本：https://go.dev/dl/ / The go command was not found. Install Go 1.22 or newer: https://go.dev/dl/" };
	},
	prepare(ws) {
		const mod = join(ws, "go.mod");
		if (!existsSync(mod)) writeFileSync(mod, "module lab\n\ngo 1.22\n");
	},
	copyShared(ws, _d, from) {
		if (!existsSync(from)) return;
		for (const pkg of readdirSync(from)) if (statSync(join(from, pkg)).isDirectory()) cpSync(join(from, pkg), join(ws, pkg), { recursive: true });
	},
	command(ws, d, level) {
		const argv = ["go", "test", ...(raceOK() ? ["-race"] : []), "-count=1", "-json", "-timeout", "90s", "-run", `^TestLv${level}_`, `./${d.id}/`];
		return { argv, cwd: ws, env: { GOFLAGS: "-mod=mod" } };
	},
	parse({ stdout, stderr, dojo }) {
		const tests = new Map<string, { name: string; ok: boolean; elapsed: number; output: string; done: boolean }>();
		let pkgOut = "", buildOut = "";
		for (const line of stdout.split("\n")) {
			let e: { Action: string; Test?: string; Output?: string; Elapsed?: number };
			try { e = JSON.parse(line); } catch { continue; }
			if (e.Action === "build-output") { buildOut += e.Output ?? ""; continue; }
			if (!e.Test) { if (e.Action === "output") pkgOut += e.Output ?? ""; continue; }
			const name = e.Test.split("/")[0];
			const t = tests.get(name) ?? { name, ok: false, elapsed: 0, output: "", done: false };
			tests.set(name, t);
			if (e.Action === "output" && !/^(=== |--- )/.test(e.Output ?? "")) t.output += e.Output;
			if (e.Action === "pass" || e.Action === "fail") { t.ok = e.Action === "pass"; t.elapsed = e.Elapsed ?? 0; t.done = true; }
		}
		const out: Parsed = { tests: [] };
		for (const t of tests.values()) {
			const runtime = goRuntime(t.output, dojo.id);
			out.tests.push({ name: t.name, ok: t.ok, elapsed: t.elapsed, message: t.output, output: t.output.replace(/^.*DOJO_FAIL .*$/gm, "").trim(), runtime });
			if (runtime?.code === "race") out.race = true;
		}
		const build = buildOut + stderr;
		const errs = findBuildErrors(build, /^(?:\.\/)?(?:[a-z][a-z0-9_]*\/)?(?<file>[A-Za-z0-9_]+\.go):(?<line>\d+):(?<col>\d+): (?<msg>.*)$/gm, go.isLearnerFile, (m) => m.groups!.msg);
		if (errs.length) out.buildErrors = errs;
		if (!out.tests.length && (errs.length || /\[build failed\]|cannot find package|syntax error/.test(build + stdout)))
			out.fatal = { code: "build", msg: "代码没能编译，先修好编译错误。", msg_en: "Your code did not compile; fix the build errors first.", detail: tail(build.trim(), 4000) };
		else if (/fatal error:|panic:/.test(pkgOut) && !out.tests.some((t) => t.runtime))
			out.fatal = { code: "panic", msg: "测试程序崩溃了。", msg_en: "The test program crashed.", detail: tail(pkgOut, 4000) };
		out.race = out.race || raceOK();
		return out;
	},
};

/** Failures the Go runtime detects on its own. A data race wins over everything; a panic only when the test reported nothing itself. */
function goRuntime(out: string, id: string) {
	if (out.includes("WARNING: DATA RACE"))
		return { code: "race", msg: "-race 检测到数据竞争：两个 goroutine 同时访问了同一个变量，而且至少有一个在写。", msg_en: "-race found a data race: two goroutines accessed the same variable at the same time, and at least one was writing.", detail: raceReport(out, id) };
	if (out.includes("concurrent map"))
		return { code: "concurrent_map", msg: "Go 运行时检测到多个 goroutine 同时写同一个 map，程序直接崩溃了。", msg_en: "The Go runtime caught several goroutines writing the same map at once and crashed the program.", detail: section(out, "fatal error:", 30) };
	if (out.includes("panic: test timed out"))
		return { code: "timeout", msg: "测试超时，可能有死锁：比如加了锁忘了解锁，或者在持有锁时等待别的 goroutine。", msg_en: "The test timed out. Maybe a deadlock: a lock taken and never released, or waiting on another goroutine while holding a lock." };
	if (out.includes("panic:") && !out.includes("DOJO_FAIL "))
		return { code: "panic", msg: "代码发生了 panic。", msg_en: "Your code panicked.", detail: section(out, "panic:", 30) };
	return undefined;
}

/** The race detector's frames that point into the learner's package. */
function raceReport(out: string, id: string): string {
	return section(out, "WARNING: DATA RACE", 60).split("\n")
		.filter((ln) => !/\/src\/|\/runtime\//.test(ln))
		.map((ln) => { const i = ln.indexOf(`/${id}/`); return i >= 0 ? ln.match(/^\s*/)![0] + ln.slice(i + id.length + 2) : /\.go:/.test(ln) ? null : ln; })
		.filter((ln): ln is string => ln !== null).join("\n");
}

function section(out: string, start: string, n: number): string {
	const i = out.indexOf(start);
	return i < 0 ? "" : out.slice(i).split("\n").slice(0, n).join("\n");
}
