// EtherCAT 从零读懂：本地运行器。
//
// It serves the course home and the coding dojo on 127.0.0.1, keeps your code as real files in a
// workspace folder, and runs each dojo's real test toolchain on them when you press Run
// (go test, node --test, pytest, cargo test: see lib/langs/). Each dojo lives under course/dojos/<id>/.
//
//	npm start                                  # then open the printed link
//	node server.ts --workspace ~/my-lab --addr 127.0.0.1:9000 --no-open
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createReadStream, existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { extname, join, resolve, sep } from "node:path";
import { parseArgs } from "node:util";
import { addStarters, type Dojo, findDojos, learnerDir, prepareWorkspace, refreshHarness, runLevel, SITE } from "./lib/runner.ts";

const { values: flags } = parseArgs({
	options: {
		addr: { type: "string", default: "127.0.0.1:7891" }, // 监听地址（只允许本机）
		workspace: { type: "string", default: "workspace" }, // 你的代码所在的目录
		content: { type: "string", default: "content" }, // 视频、实验台等课程内容所在的目录
		"no-open": { type: "boolean", default: false }, // 启动后不自动打开浏览器
	},
});

const [major, minor] = process.versions.node.split(".").map(Number);
if (major < 22 || (major === 22 && minor < 19)) {
	console.error(`需要 Node.js 22.19 或更新的版本（当前 ${process.version}）：https://nodejs.org/ / Needs Node.js 22.19 or newer (found ${process.version}): https://nodejs.org/`);
	process.exit(1);
}
const m = /^(127\.0\.0\.1|localhost|\[::1\]):(\d+)$/.exec(flags.addr!);
if (!m) {
	console.error("为了安全，运行器只能监听本机地址，例如 127.0.0.1:7878 / For safety the runner only listens on this machine, e.g. 127.0.0.1:7878");
	process.exit(1);
}
const HOST = m[1].replace(/^\[|\]$/g, ""), PORT = Number(m[2]);
const WS = resolve(flags.workspace!), WEB = join(SITE, "web"), CONTENT = resolve(SITE, flags.content!);
const dojos = findDojos((s) => console.log("  " + s));
const token = randomBytes(16).toString("hex");
let running = false;

// Toolchain checks and installs; a dojo whose toolchain is missing still shows, and explains itself when run.
const missing = prepareWorkspace(WS, Object.values(dojos), (s) => console.log("  " + s));
for (const d of Object.values(dojos)) { addStarters(WS, d); refreshHarness(WS, d); }
const meta = Object.fromEntries(Object.values(dojos).map((d) => [d.id, { lang: d.config.lang, editor: d.driver.editor, label: d.driver.label(d), toolchain: d.driver.toolchain().version ?? null, missing: missing[d.id] ?? null }]));

// ---------------------------------------------------------------- HTTP

const TYPES: Record<string, string> = {
	".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
	".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg",
	".mp4": "video/mp4", ".pdf": "application/pdf", ".vtt": "text/vtt; charset=utf-8", ".ico": "image/x-icon",
};

function send(res: ServerResponse, status: number, body: string, type = "text/plain; charset=utf-8"): void {
	res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store" });
	res.end(body);
}
const json = (res: ServerResponse, v: unknown) => send(res, 200, JSON.stringify(v), TYPES[".json"]);

/** Serve a file under root, with Range support so videos can seek. */
function serveFile(req: IncomingMessage, res: ServerResponse, root: string, rel: string): void {
	const p = resolve(root, "." + decodeURIComponent(rel));
	if (p !== root && !p.startsWith(root + sep)) return send(res, 403, "forbidden");
	let file = p;
	if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
	if (!existsSync(file)) return send(res, 404, "not found");
	const size = statSync(file).size, type = TYPES[extname(file)] ?? "application/octet-stream";
	const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? "");
	if (range) {
		const a = range[1] ? +range[1] : size - +range[2], b = range[1] && range[2] ? +range[2] : size - 1;
		if (a > b || b >= size) { res.writeHead(416, { "Content-Range": `bytes */${size}` }); return void res.end(); }
		res.writeHead(206, { "Content-Type": type, "Content-Range": `bytes ${a}-${b}/${size}`, "Accept-Ranges": "bytes", "Content-Length": b - a + 1 });
		return void createReadStream(file, { start: a, end: b }).pipe(res);
	}
	res.writeHead(200, { "Content-Type": type, "Content-Length": size, "Accept-Ranges": "bytes", "Cache-Control": "no-cache" });
	createReadStream(file).pipe(res);
}

/** Only this page may call the API: right host and port (no DNS rebinding), same origin, and the startup token. */
function allowed(req: IncomingMessage): string | null {
	const host = req.headers.host ?? "";
	const hm = /^(127\.0\.0\.1|localhost|\[::1\]):(\d+)$/.exec(host);
	if (!hm || Number(hm[2]) !== PORT) return "forbidden host";
	const origin = req.headers.origin;
	if (origin && origin !== "http://" + host) return "forbidden origin";
	if (req.headers["x-dojo-token"] !== token) return "missing or wrong token";
	return null;
}

async function body(req: IncomingMessage, limit = 1 << 20): Promise<string> {
	let s = "";
	for await (const chunk of req) { s += chunk; if (s.length > limit) throw new Error("too large"); }
	return s;
}

function userFiles(d: Dojo) {
	const dir = learnerDir(WS, d);
	return readdirSync(dir)
		.filter((n) => d.driver.isLearnerFile(n))
		.sort()
		.map((name) => ({ name, content: readFileSync(join(dir, name), "utf8"), mtime: Math.round(statSync(join(dir, name)).mtimeMs) }));
}

async function handleApi(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
	const deny = allowed(req);
	if (deny) return send(res, deny.startsWith("missing") ? 401 : 403, deny);
	// dojos: {id: levels} for the home page; meta: per-dojo language, editor mode, test command, toolchain
	if (url.pathname === "/api/info") return json(res, { runtime: `Node ${process.version}`, workspace: WS, dojos: Object.fromEntries(Object.values(dojos).map((d) => [d.id, d.levels])), meta });
	const id = url.searchParams.get("dojo") ?? "";
	const d = dojos[id];
	if (!d) return send(res, 400, "unknown dojo");
	if (url.pathname === "/api/files") return json(res, userFiles(d));
	if (url.pathname === "/api/file") {
		const name = url.searchParams.get("name") ?? "";
		if (req.method !== "PUT" || !d.driver.isLearnerFile(name)) return send(res, 400, "bad request");
		const p = join(learnerDir(WS, d), name);
		writeFileSync(p, await body(req));
		return json(res, { mtime: Math.round(statSync(p).mtimeMs) });
	}
	if (url.pathname === "/api/run") {
		let level = 0;
		try { level = JSON.parse(await body(req)).level; } catch {}
		if (req.method !== "POST" || !Number.isInteger(level) || level < 1 || level > d.levels) return send(res, 400, "bad request");
		if (missing[id]) { const [zh, en] = missing[id].split(" / "); return json(res, { dojo: id, level, ok: false, race: false, tests: [], seconds: 0, fatal: { name: "", ok: false, elapsed: 0, code: "toolchain", msg: zh, msg_en: en ?? zh } }); }
		if (running) return send(res, 409, "已经有测试在运行 / Tests are already running");
		running = true;
		try {
			refreshHarness(WS, d);
			return json(res, await runLevel(WS, d, level));
		} finally {
			running = false;
		}
	}
	send(res, 404, "not found");
}

const server = createServer((req, res) => {
	const url = new URL(req.url ?? "/", "http://x");
	if (url.pathname.startsWith("/api/")) {
		handleApi(req, res, url).catch((e) => { if (!res.headersSent) send(res, 500, String(e?.message ?? e)); });
		return;
	}
	if (url.pathname.startsWith("/content/")) return serveFile(req, res, CONTENT, url.pathname.slice("/content".length));
	serveFile(req, res, WEB, url.pathname);
});

server.on("error", (e: NodeJS.ErrnoException) => {
	console.error(e.code === "EADDRINUSE" ? `端口 ${PORT} 被占用了，可以用 --addr 127.0.0.1:<别的端口> 换一个。 / Port ${PORT} is in use; pick another with --addr 127.0.0.1:<port>.` : e.message);
	process.exit(1);
});
server.listen(PORT, HOST, () => {
	const link = `http://${flags.addr}/?t=${token}`;
	const tools = [...new Set(Object.values(meta).map((m) => m.toolchain).filter((t) => t && !t.startsWith("Node ")))].join(" · ");
	console.log(`\n  EtherCAT 从零读懂 已启动 / started\n\n  课程首页 / Home:     ${link}\n  代码目录 / Code:     ${WS}\n  工具链 / Toolchains: Node ${process.version}${tools ? " · " + tools : ""}\n\n  按 Ctrl+C 退出。 / Press Ctrl+C to stop.\n`);
	if (!flags["no-open"]) {
		const [cmd, ...args] = process.platform === "darwin" ? ["open", link] : process.platform === "win32" ? ["cmd", "/c", "start", "", link] : ["xdg-open", link];
		spawn(cmd, args, { stdio: "ignore", detached: true }).on("error", () => {}).unref();
	}
});
