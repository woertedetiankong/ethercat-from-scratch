// 课程数据：课程首页（hub.js）和练功房（app.js）都读这里。加一集 = 在 EPISODES 里加一项。
//
// status: ready = 材料齐了；partial = 只有部分材料（比如只有视频）；planned = 还没做，只在课程地图里占位
// part:   拆成几篇的一集（ep11a…ep11d）：n 相同，part 写 'a' 'b'…，显示成“第 11a 集”；map 写 page: 第一篇的 id，共用地图进度
// steps:  按顺序列出这一集有的步骤，可选 video / reading / lab / flow / map / dojo / assignment
//   video       需要 content/<id>/video.mp4 和 chapters.json（dev/sync_content.py 生成）
//   reading     {title, url?, urlLabel?, urlNote?, notes?, notesLabel?, links?: [{label, url, note?}], time?, read: [...], ask: [...]}
//   lab         {questions: 预测题个数, desc, time?, page?} → content/<page 或 id>/lab.html（page：几集共用一页时写那一集的 id）；实验台把答过的题号存进 localStorage 'course.<id>.lab.answered'
//   flow        {questions: 想一想题数, desc, time?} → content/<id>/flow.html；流程图页把答过的题号存进 'course.<id>.flow.answered'
//               （给看不懂代码的学员：用可点击的流程图讲结构，可以代替练功房）
//   map         {questions: 本集地图题数, desc, time?} → atlas.html#<id>（项目地图，整门课一张，见 references/atlas.md）；答对的题号存进 'course.<id>.map.answered'
//   dojo        练功房 id（= course/dojos/<dojo> 目录名），过关记录在 'dojo.<dojo>.passed'；dojoTime、dojoDesc、dojoLinks: [{label, url}]
//   assignment  {title, url, urlLabel?, short?（如 'Lab 1'）, desc?, notes: [...], time?} 真正的课程作业 / Lab
//
// 双语：这里写中文；英文写在 course.en.js 里，按 id 覆盖同名字段，没写英文的字段沿用中文。
// 加一集或改了这里的文字，都要同步改 course.en.js。
window.COURSE_META = {
  title: 'EtherCAT 从零读懂',
  subtitle: '用 SOEM 和一条虚拟总线，看懂机器人关节的通信与同步',
  mapNote: '从“为什么要同步”讲到分布式时钟，一集讲清一个机制。每个数字都来自真实 SOEM 主站在虚拟总线上的运行。',
  footer: '主站代码是开源的 SOEM（v2.0.1，GPLv3）；从站是 vwire 里模拟的 EtherCAT 从站芯片，模拟的部分在视频里都有标注。视频和课件为原创自学材料。',
  atlas: false,
};

window.EPISODES = [
  {id: 'ep01', n: 1, title: '1 毫秒的问题：为什么同步就是精度', group: '基础', status: 'ready',
   desc: '运动中的机器，时间误差就是位置误差。分清偏差和抖动，看真实运行里“到达即动作”的几十微秒抖动，和分布式时钟下的约 5 纳秒。',
   steps: ['video'], videoTime: '约 8 分钟 · 中英字幕', slides: true},
  {id: 'ep02', n: 2, title: '一根网线就是一个环', group: '基础', status: 'ready',
   desc: '网线里一对线发、一对线收；从站在去程上处理帧，没插线的口自动关闭、帧在那里掉头。所以一串从站本身就是一个环：真实扫描里一帧 1485 纳秒回到主站，剪断网线后环只是变短。',
   steps: ['video'], videoTime: '约 8 分钟 · 中英字幕', slides: true},
  {id: 'ep03a', n: 3, part: 'a', title: '一帧走到底：边走边处理', group: '帧与寻址', status: 'ready',
   desc: '帧是一串流动的比特：我们的周期帧在线上长 8 微秒，比整条总线长得多。从站不存帧，比特经过时就读写自己的座位；校验和在最后，所以坏帧只能被标记、最后丢弃。',
   steps: ['video'], videoTime: '约 8 分钟 · 中英字幕', slides: true},
  {id: 'ep03b', n: 3, part: 'b', title: '帧里装了什么：数据报、逻辑地址、工作计数器', group: '帧与寻址', status: 'planned'},
  {id: 'ep04a', n: 4, part: 'a', title: '从上电到交换数据：状态机', group: '启动与配置', status: 'planned'},
  {id: 'ep04b', n: 4, part: 'b', title: '两条通道：邮箱和过程数据（CoE）', group: '启动与配置', status: 'planned'},
  {id: 'ep05a', n: 5, part: 'a', title: '分布式时钟①：量出每段线的延迟', group: '分布式时钟', status: 'planned'},
  {id: 'ep05b', n: 5, part: 'b', title: '分布式时钟②：对表，而且一直对下去', group: '分布式时钟', status: 'planned'},
  {id: 'ep05c', n: 5, part: 'c', title: '分布式时钟③：SYNC0，一声发令枪', group: '分布式时钟', status: 'planned'},
  {id: 'ep06', n: 6, title: '断线了怎么办：冗余口', group: '进阶', status: 'planned'}
];
