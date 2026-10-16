// Rust: each dojo is a Cargo package workspace/<id>/ (harness/Cargo.toml names it), the learner edits src/*.rs,
// tests are integration tests tests/lv<N>.rs with functions lv<N>_*, run with `cargo test --test lv<N>` and read
// from libtest's plain output. course/shared/rust/dojo.rs (fail/say/Trace) becomes tests/dojo/mod.rs (`mod dojo;`).
// Builds share workspace/.target so later runs are fast; the first build of a dojo takes a while.
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Parsed } from "../runner.ts";
import { type Driver, learnerLines, probe, tail } from "./index.ts";

const LEARNER = /^[a-z][a-z0-9_]*\.rs$/;

export const rust: Driver = {
	editor: "text/x-rustsrc",
	label: () => "cargo test",
	learnerDir: "src",
	testsDir: "tests",
	timeoutSec: 300,
	isLearnerFile: (n) => LEARNER.test(n),
	levelOf: (f) => { const m = /^lv(\d+)\.rs$/.exec(f); return m ? +m[1] : null; },
	toolchain() {
		const v = probe(["cargo", "--version"]);
		return v ? { version: v.split(" (")[0] } : { missing: "没有找到 cargo。请安装 Rust：https://www.rust-lang.org/tools/install / cargo was not found. Install Rust: https://www.rust-lang.org/tools/install" };
	},
	prepare() {},
	copyShared(ws, d, from) {
		const f = join(from, "dojo.rs");
		if (!existsSync(f)) return;
		mkdirSync(join(ws, d.id, "tests", "dojo"), { recursive: true });
		cpSync(f, join(ws, d.id, "tests", "dojo", "mod.rs"));
	},
	command(ws, d, level) {
		return { argv: ["cargo", "test", "--color", "never", "--test", `lv${level}`, "--", "--test-threads=1", "--color", "never"], cwd: join(ws, d.id), env: { CARGO_TARGET_DIR: join(ws, ".target"), CARGO_TERM_COLOR: "never", RUST_BACKTRACE: "0" } };
	},
	parse({ stdout, stderr, dojo, level }) {
		const out: Parsed = { tests: [] };
		const failures = new Map<string, string>();
		// ---- lv1_counts stdout ----  …panic message…  (until the next block or the "failures:" list)
		for (const m of stdout.matchAll(/^---- (\S+) stdout ----\n([\s\S]*?)(?=^---- \S+ stdout ----|^failures:$|^test result:)/gm)) failures.set(m[1], m[2]);
		for (const m of stdout.matchAll(/^test (\S+) \.\.\. (ok|FAILED|ignored)$/gm)) {
			if (!m[1].startsWith(`lv${level}_`) || m[2] === "ignored") continue;
			const msg = failures.get(m[1]) ?? "";
			const output = msg.replace(/^.*DOJO_FAIL .*$/gm, "").replace(/^thread '.*' panicked at .*$/gm, "").replace(/^note: run with `RUST_BACKTRACE.*$/gm, "").trim();
			out.tests.push({ name: m[1], ok: m[2] === "ok", elapsed: 0, message: m[2] === "ok" ? undefined : (msg.includes("DOJO_FAIL ") ? msg : learnerLines(msg, dojo.id)), output: output || undefined });
		}
		if (!out.tests.length && /error(\[E\d+\])?:|could not compile/.test(stderr)) {
			// error: this file contains an unclosed delimiter      <- message
			//   --> src/lib.rs:20:3                              <- where rustc noticed (here: end of file)
			//    |
			// 5  | fn broken( {                                   <- lines the snippet labels are often the real spot
			//    |           - unclosed delimiter
			const errs: { file: string; line: number; col: number; msg: string }[] = [];
			const add = (file: string, line: number, col: number, msg: string) => { if (!errs.some((e) => e.file === file && e.line === line)) errs.push({ file, line, col, msg }); };
			for (const m of stderr.matchAll(/^(error(?:\[E\d+\])?: [^\n]*)\n\s*--> (?:[^\n]*[\\/])?src[\\/]([a-z][a-z0-9_]*\.rs):(\d+):(\d+)\n((?:[ \t]*(?:\d+[ \t]*)?\|[^\n]*\n)*)/gm)) {
				const msg = m[1].replace(/^error(\[E\d+\])?: /, "");
				for (const l of m[5].matchAll(/^[ \t]*(\d+)[ \t]*\|[^\n]*\n[ \t]*\|[ \t]*[-^]+[ \t]*([^\n]*)/gm)) { const label = l[2].replace(/^[-^\s]+/, "").trim(); add(m[2], +l[1], 1, label ? `${msg} (${label})` : msg); }
				add(m[2], +m[3], +m[4], msg);
			}
			if (errs.length) out.buildErrors = errs;
			out.fatal = { code: "build", msg: "代码没能编译，先修好编译错误。", msg_en: "Your code did not compile; fix the build errors first.", detail: tail(stderr.split("\n").filter((l) => !/^\s*(Compiling|Finished|Running|warning: unused)/.test(l)).join("\n").trim(), 4000) };
		}
		return out;
	},
};
