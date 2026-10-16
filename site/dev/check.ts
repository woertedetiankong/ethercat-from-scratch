// Check every dojo's tests: the reference passes every level, the starter passes none,
// and each broken variant (dev/mutations.ts) fails at the level that teaches the fix.
//
//	npm run check            # all dojos
//	npm run check -- warmup  # one dojo
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { addStarters, DOJOS, findDojos, learnerDir, prepareWorkspace, refreshHarness, runLevel, SITE } from "../lib/runner.ts";
import { MUTATIONS } from "./mutations.ts";

const only = process.argv.slice(2);
const ws = join(SITE, "dev", ".cache", "workspace");   // reused between runs so installs and builds stay cached
const readDir = (d: string) => Object.fromEntries(readdirSync(d).filter((f) => statSync(join(d, f)).isFile()).map((f) => [f, readFileSync(join(d, f), "utf8")]));

function variant(id: string, repl: Record<string, [string, string][]>): Record<string, string> {
	const files = readDir(join(DOJOS, id, "reference"));
	for (const [f, pairs] of Object.entries(repl))
		for (const [a, b] of pairs) {
			if (!files[f]?.includes(a)) throw new Error(`${id}/${f}: mutation text not found: ${JSON.stringify(a)}`);
			files[f] = files[f].replace(a, b);
		}
	return files;
}

const dojos = Object.values(findDojos(console.log)).filter((d) => !only.length || only.includes(d.id));
const missing = prepareWorkspace(ws, dojos, console.log);
let bad = 0;
for (const d of dojos) {
	if (missing[d.id]) { console.log(`✗ ${d.id}: ${missing[d.id]}`); bad++; continue; }
	const levels = Array.from({ length: d.levels }, (_, i) => i + 1);
	const cases: Record<string, [Record<string, string>, Record<number, string>]> = {
		reference: [variant(d.id, {}), Object.fromEntries(levels.map((l) => [l, "ok"]))],
		starter: [readDir(join(DOJOS, d.id, "starter")), Object.fromEntries(levels.map((l) => [l, "fail"]))],
	};
	for (const [name, [repl, expect]] of Object.entries(MUTATIONS[d.id] ?? {})) cases[name] = [variant(d.id, repl), expect];
	for (const [name, [files, expect]] of Object.entries(cases)) {
		// a fresh dojo folder per case (build caches outside it stay warm)
		for (const f of existsSync(join(ws, d.id)) ? readdirSync(join(ws, d.id)) : []) if (f !== "target") rmSync(join(ws, d.id, f), { recursive: true, force: true });
		addStarters(ws, d);                     // files the reference doesn't override
		mkdirSync(learnerDir(ws, d), { recursive: true });
		for (const [f, src] of Object.entries(files)) writeFileSync(join(learnerDir(ws, d), f), src);
		refreshHarness(ws, d);
		const got: Record<number, string> = {};
		for (const l of levels) {
			const r = await runLevel(ws, d, l);
			const codes = [...new Set([r.fatal?.code, ...r.tests.filter((t) => !t.ok).map((t) => t.code)].filter(Boolean))];
			got[l] = r.ok ? "ok" : codes.sort().join(",") || "fail";
		}
		const miss = Object.entries(expect).filter(([l, want]) => {
			const g = got[+l];
			return want === "ok" ? g !== "ok" : want === "fail" ? g === "ok" : !g.split(",").includes(want);
		});
		bad += miss.length ? 1 : 0;
		console.log(`${miss.length ? "✗" : "✓"} ${d.id.padEnd(10)} ${name.padEnd(18)} ${levels.map((l) => `L${l}:${got[l]}`).join(" ")}${miss.length ? "  expected " + miss.map(([l, w]) => `L${l}:${w}`).join(", ") : ""}`);
	}
}
process.exit(bad ? 1 : 0);
