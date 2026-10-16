// TypeScript on Node: learner files are workspace/<id>/*.ts, tests are lv<N>.test.ts with tests named Lv<N>_*,
// run with `node --test` and course/shared/typescript/reporter.ts. Node runs .ts directly (erasable syntax only).
// dojo.json may list npm packages: {"lang": "typescript", "packages": {"name": "version"}}; they are pinned in workspace/package.json.
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Parsed } from "../runner.ts";
import { type Driver, findBuildErrors, learnerLines, tail } from "./index.ts";

const LEARNER = /^[a-z][a-z0-9_-]*\.ts$/;

export const typescript: Driver = {
	editor: "text/typescript",
	label: () => "node --test",
	learnerDir: "",
	testsDir: "",
	timeoutSec: 120,
	isLearnerFile: (n) => LEARNER.test(n) && !/\.(test|support)\.ts$/.test(n),
	levelOf: (f) => { const m = /^lv(\d+)\.test\.ts$/.exec(f); return m ? +m[1] : null; },
	toolchain() {
		const [major, minor] = process.versions.node.split(".").map(Number);
		return major > 22 || (major === 22 && minor >= 19) ? { version: `Node ${process.version}` } : { missing: `需要 Node.js 22.19 或更新的版本（当前 ${process.version}）：https://nodejs.org/ / Needs Node.js 22.19 or newer (found ${process.version}): https://nodejs.org/` };
	},
	prepare(ws, dojos, log) {
		const packages: Record<string, string> = {};
		for (const d of dojos) Object.assign(packages, (d.config.packages as Record<string, string>) ?? {});
		const pkg = join(ws, "package.json");
		const want = JSON.stringify({ name: "dojo-workspace", private: true, type: "module", dependencies: packages }, null, "\t") + "\n";
		if (!existsSync(pkg) || readFileSync(pkg, "utf8") !== want) writeFileSync(pkg, want);
		const tsconfig = join(ws, "tsconfig.json");
		if (!existsSync(tsconfig))
			writeFileSync(tsconfig, JSON.stringify({ compilerOptions: { target: "es2023", module: "nodenext", strict: true, noEmit: true, allowImportingTsExtensions: true, verbatimModuleSyntax: true, erasableSyntaxOnly: true, skipLibCheck: true } }, null, "\t") + "\n");
		const installed = Object.entries(packages).every(([name, version]) => {
			try { return JSON.parse(readFileSync(join(ws, "node_modules", name, "package.json"), "utf8")).version === version; } catch { return false; }
		});
		if (installed) return;
		log(`正在安装 ${Object.keys(packages).join("、")}（只在第一次需要）…… / Installing ${Object.keys(packages).join(", ")} (first run only)…`);
		const r = spawnSync(process.platform === "win32" ? "npm.cmd" : "npm", ["install", "--no-audit", "--no-fund", "--loglevel=error"], { cwd: ws, stdio: "inherit", shell: process.platform === "win32" });
		if (r.status !== 0) throw new Error("npm install 失败，检查网络后重新启动运行器。 / npm install failed; check the network and restart the runner.");
	},
	copyShared(ws, _d, from) {
		if (existsSync(from)) cpSync(from, join(ws, "shared"), { recursive: true });
	},
	command(ws, d, level) {
		return { argv: [process.execPath, "--test", `--test-reporter=${join(ws, "shared", "reporter.ts")}`, "--test-timeout=20000", `${d.id}/lv${level}.test.ts`], cwd: ws, env: { NODE_NO_WARNINGS: "1" } };
	},
	parse({ stdout, stderr, dojo, level }) {
		type Line = { k: string; name?: string; nesting?: number; type?: string; ms?: number; ft?: string; msg?: string; stack?: string };
		const lines: Line[] = [];
		let raw = "";
		for (const s of stdout.split("\n")) { if (!s) continue; try { lines.push(JSON.parse(s)); } catch { raw += s + "\n"; } }
		const out_ = lines.filter((l) => l.k === "stdout").map((l) => l.msg).join("");
		const err = lines.filter((l) => l.k === "stderr").map((l) => l.msg).join("") + raw + stderr;
		const out: Parsed = { tests: [], output: out_ };
		let fileFailed = false;
		for (const l of lines) {
			if ((l.k !== "pass" && l.k !== "fail") || l.nesting !== 0 || l.type === "suite") continue;
			if (!l.name!.startsWith(`Lv${level}_`)) { if (l.k === "fail") fileFailed = true; continue; }
			const failed = l.k === "fail";
			const message = failed ? (l.msg?.includes("DOJO_FAIL ") ? l.msg : `${l.msg ?? ""}\n${learnerLines(l.stack ?? "", dojo.id)}`) : undefined;
			out.tests.push({ name: l.name!, ok: !failed, elapsed: (l.ms ?? 0) / 1000, message, timedOut: l.ft === "testTimeoutFailure" });
		}
		if (fileFailed && !out.tests.length) {
			const build = /SyntaxError|ERR_INVALID_TYPESCRIPT_SYNTAX|ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX|does not provide an export named|ERR_MODULE_NOT_FOUND/.test(err);
			out.fatal = build
				? { code: "build", msg: "代码没能加载：有语法错误、导入不对，或者用了 Node 不能直接运行的 TypeScript 写法（enum、构造函数参数属性）。", msg_en: "Your code did not load: a syntax error, a bad import, or TypeScript that Node can't run directly (enum, constructor parameter properties).", detail: tail(learnerLines(err, dojo.id), 4000) }
				: { code: "crash", msg: "测试进程意外退出了。", msg_en: "The test process exited unexpectedly.", detail: tail(learnerLines(err || out_, dojo.id), 4000) };
			const msg = /(SyntaxError[^\n]*|does not provide an export named[^\n]*)/.exec(err)?.[1] ?? "";
			const errs = findBuildErrors(err, new RegExp(`/${dojo.id}/(?<file>[a-z][a-z0-9_-]*\\.ts):(?<line>\\d+)(?::(?<col>\\d+))?`, "g"), typescript.isLearnerFile, () => msg);
			if (errs.length) out.buildErrors = errs;
		}
		return out;
	},
};
