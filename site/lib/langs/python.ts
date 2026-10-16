// Python: learner files are workspace/<id>/*.py, tests are test_lv<N>.py with functions test_lv<N>_*,
// run with pytest from a private virtual environment (workspace/.venv) and read from its JUnit XML report.
// course/shared/python/dojo_support.py (fail/say/Trace) is copied next to each dojo's tests.
// dojo.json may list pip packages: {"lang": "python", "packages": ["requests==2.32.3"]}; pytest is always installed.
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Parsed } from "../runner.ts";
import { type Driver, learnerLines, probe, tail } from "./index.ts";

const LEARNER = /^[a-z][a-z0-9_]*\.py$/;
const PY = process.platform === "win32" ? "python" : "python3";
const venvPython = (ws: string) => join(ws, ".venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");

export const python: Driver = {
	editor: "text/x-python",
	label: () => "pytest",
	learnerDir: "",
	testsDir: "",
	timeoutSec: 120,
	isLearnerFile: (n) => LEARNER.test(n) && !n.startsWith("test_") && !n.endsWith("_support.py") && n !== "conftest.py",
	levelOf: (f) => { const m = /^test_lv(\d+)\.py$/.exec(f); return m ? +m[1] : null; },
	toolchain() {
		const v = probe([PY, "--version"]);
		const ok = v && /Python 3\.(\d+)/.exec(v) && +/Python 3\.(\d+)/.exec(v)![1] >= 9;
		return ok ? { version: v! } : { missing: `需要 Python 3.9 或更新的版本（找到的是 ${v ?? "无"}）：https://www.python.org/downloads/ / Needs Python 3.9 or newer (found ${v ?? "none"}): https://www.python.org/downloads/` };
	},
	prepare(ws, dojos, log) {
		const want = ["pytest", ...dojos.flatMap((d) => (d.config.packages as string[]) ?? [])].sort();
		const stamp = join(ws, ".venv", "dojo-packages.json");
		if (existsSync(venvPython(ws)) && existsSync(stamp) && readFileSync(stamp, "utf8") === JSON.stringify(want)) return;
		log(`正在准备 Python 虚拟环境并安装 ${want.join("、")}（只在第一次需要）…… / Preparing a Python virtual environment and installing ${want.join(", ")} (first run only)…`);
		if (!existsSync(venvPython(ws)) && spawnSync(PY, ["-m", "venv", join(ws, ".venv")], { stdio: "inherit" }).status !== 0)
			throw new Error("创建虚拟环境失败（python3 -m venv）。 / Could not create a virtual environment (python3 -m venv).");
		if (spawnSync(venvPython(ws), ["-m", "pip", "install", "--quiet", "--disable-pip-version-check", ...want], { stdio: "inherit" }).status !== 0)
			throw new Error("pip install 失败，检查网络后重新启动运行器。 / pip install failed; check the network and restart the runner.");
		writeFileSync(stamp, JSON.stringify(want));
	},
	copyShared(ws, d, from) {
		if (!existsSync(from)) return;
		for (const f of readdirSync(from)) cpSync(join(from, f), join(ws, d.id, f), { recursive: true });
	},
	command(ws, d, level, report) {
		return { argv: [venvPython(ws), "-m", "pytest", "-q", "-p", "no:cacheprovider", "-o", "junit_family=xunit1", `--junitxml=${report}`, `${d.id}/test_lv${level}.py`], cwd: ws, env: { PYTHONDONTWRITEBYTECODE: "1" } };
	},
	parse({ stdout, stderr, report, dojo, level }) {
		const out: Parsed = { tests: [] };
		const xml = existsSync(report) ? readFileSync(report, "utf8") : "";
		let collect = "";
		for (const tc of junitCases(xml)) {
			if (!tc.name.startsWith(`test_lv${level}_`)) { if (tc.failure) collect += tc.failure + "\n"; continue; }
			out.tests.push({ name: tc.name, ok: !tc.failure, elapsed: tc.time, message: tc.failure ? (tc.failure.includes("DOJO_FAIL ") ? tc.failure : learnerLines(tc.failure, dojo.id)) : undefined, output: tc.stdout });
		}
		if (!out.tests.length) {
			const text = collect + stdout + stderr;
			const build = /SyntaxError|IndentationError|ImportError|ModuleNotFoundError|NameError/.test(text);
			out.fatal = build
				? { code: "build", msg: "代码没能导入：有语法错误、缩进错误，或者导入的名字不存在。", msg_en: "Your code did not import: a syntax or indentation error, or an imported name doesn't exist.", detail: tail(learnerLines(text, dojo.id), 4000) }
				: { code: "crash", msg: "测试没能运行。", msg_en: "The tests could not run.", detail: tail(text.trim(), 4000) };
			const msg = /^E?\s*((?:SyntaxError|IndentationError|ImportError|ModuleNotFoundError|NameError)[^\n]*)/m.exec(text)?.[1] ?? "";
			// tracebacks say File "…/<id>/words.py", line 12; pytest's own summary says <id>/words.py:12.
			// Only paths inside this dojo's folder count: pytest and the standard library show up in tracebacks too.
			const inDojo = (p: string) => p.split(/[\\/]/).slice(-2, -1)[0] === dojo.id;
			const errs = [...text.matchAll(/File "([^"]+\.py)", line (\d+)|([\w./-]+\.py):(\d+)/g)]
				.filter((m) => inDojo(m[1] ?? m[3]))
				.map((m) => ({ file: (m[1] ?? m[3]).split(/[\\/]/).pop()!, line: +(m[2] ?? m[4]), col: 1, msg }))
				.filter((e, i, all) => python.isLearnerFile(e.file) && all.findIndex((x) => x.file === e.file && x.line === e.line) === i);
			if (errs.length) out.buildErrors = errs;
		}
		return out;
	},
};

/** The test cases of a pytest JUnit XML report: name, time, failure/error text, captured stdout. */
function junitCases(xml: string) {
	const un = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&amp;/g, "&");
	const attr = (tag: string, a: string) => { const m = new RegExp(`\\b${a}="([^"]*)"`).exec(tag); return m ? un(m[1]) : ""; };
	const cases: { name: string; time: number; failure?: string; stdout?: string }[] = [];
	for (const m of xml.matchAll(/<testcase\b([^>]*?)(?:\/>|>([\s\S]*?)<\/testcase>)/g)) {
		const body = m[2] ?? "";
		const f = /<(failure|error)\b([^>]*?)(?:\/>|>([\s\S]*?)<\/\1>)/.exec(body);
		const so = /<system-out>([\s\S]*?)<\/system-out>/.exec(body);
		cases.push({
			name: attr(m[1], "name"),
			time: +attr(m[1], "time") || 0,
			failure: f ? `${attr(f[2], "message")}\n${un(f[3] ?? "")}`.trim() : undefined,
			stdout: so ? un(so[1]).trim() : undefined,
		});
	}
	return cases;
}
