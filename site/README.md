# EtherCAT 从零读懂

中文 | [English](README.en.md)

用 SOEM 和一条虚拟总线，看懂机器人关节的通信与同步。每一集按五步走：看视频 → 读材料 → 玩实验台 → 练功房写代码 → 做真正的作业。代码保存在你电脑上的真实文件里，测试用真正的工具链运行。题目、测试和代码均为原创。

## 开始

1. 安装 Node.js 22.19 或更新的版本：<https://nodejs.org/>（本地运行器用它）。
2. 
3. 在这个目录下运行：

   ```bash
   npm start
   ```

4. 打开终端里打印出来的链接（会自动打开浏览器），进入**课程首页**。视频可以按章节跳着看，进度自动记录在浏览器里。网页有中文和英文两种模式，点右上角的「中 / EN」切换，默认跟随浏览器语言。

既可以在网页里写，也可以用编辑器改，两边会自动同步。

视频文件较大，没有放进 git 仓库，会发布在 Releases 页面：下载后放到 `content/epNN/video.mp4`。

## 安全

运行器会在你的电脑上运行代码，所以它只监听 127.0.0.1；每次启动生成一个随机口令，网页请求必须带上它；并检查 Host 和 Origin，防止 DNS 重绑定攻击。

## 目录

| 路径 | 内容 |
|---|---|
| `server.ts` | 本地运行器：提供网页、读写代码文件、运行测试（`npm start`） |
| `lib/runner.ts`、`lib/langs/` | 运行器核心，以及每种语言的驱动（Go、TypeScript、Python、Rust） |
| `web/js/course.js`、`course.en.js` | 课程数据：每一集的步骤、链接、练功房 id（中文、英文） |
| `web/index.html`、`web/js/hub.js` | 课程首页 |
| `web/dojo.html`、`web/js/app.js` | 练功房编辑器（`dojo.html?d=<id>`） |
| `web/js/dojos/<id>.js`、`<id>.en.js` | 每个练功房的关卡讲解、分层提示、按失败原因给出的提示 |
| `course/dojos/<id>/` | 每个练功房：`dojo.json`（语言）、`starter/` 初始代码、`tests/` 各关测试、`reference/` 参考答案（**剧透**） |
| `course/shared/<语言>/` | 测试辅助：`fail()`、`say()`、时间线 |
| `content/epNN/` | 各集的视频、章节和实验台（`python3 dev/sync_content.py` 生成） |
| `dev/check.ts`、`dev/mutations.ts` | `npm run check`：参考答案全部通过，初始代码全部不通过，典型错误被对应的关卡抓到 |

## 学术诚信

这个项目帮助你理解原理、练习写代码，不提供原课程作业的答案。如果你正在修这门课，请遵守课程的合作政策，独立完成作业。

## 许可证

MIT
