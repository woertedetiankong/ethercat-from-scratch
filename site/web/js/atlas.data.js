/* 项目地图数据（样例）。这是从参考实例 robot-course（magic-alt/servohub）里截出来的一小块，只用来演示格式：
   新课程把它整个换成自己项目的地图，再在 course.js 里把 COURSE_META.atlas 设成 true。
   格式和做法见 course-studio 的 references/atlas.md；写完一定要跑
     node <skill>/scripts/atlas_check.mjs --data site/web/js/atlas.data.js --repo <源码目录>
   完整的参考：~/Documents/ChatGPT/robot-course/site/web/js/atlas.data.js */
window.ATLAS = {
meta: {
  title: L('项目地图', 'Project map'),
  lead: L('整门课只用这一张图。每学一集，地图就亮一块；灰色斜线的地方是还没去过的代码。', 'One map for the whole course. Each episode lights up part of it; hatched areas are code you have not visited yet.'),
  gh: 'https://github.com/magic-alt/servohub/tree/94fc13d2aa20467ecc09339d14379e2d11d6b688/',
  vb: [1200, 524], comment: '//',
  viewSub: {when: L('中断', 'interrupts'), board: L('白板 kAxis', 'whiteboard kAxis')},
  whenTitle: L('代码是被谁叫起来的', 'What wakes the code up'),
  whenLead: L('选一个时钟，看它叫醒了谁。', 'Pick a clock to see what it wakes.'),
  scopeNote: L('放慢 1 万倍。', 'Slowed down 10,000×.'),
  boardLead: L('一个写到白板上，另一个从白板上读。', 'One writes to the whiteboard, another reads it.'),
  footer: L('样例数据，来自 magic-alt/servohub 提交 94fc13d。', 'Sample data from magic-alt/servohub commit 94fc13d.'),
},
layers: [
 {k: 'comm', n: 3, t: L('通信', 'Comms'), a: L('听外面的指令', 'hears commands'), d: ['communication/'], y: 16, h: 132, color: ['#8A3FA6', '#D3A2EC']},
 {k: 'wire', n: 2, t: L('控制循环', 'Control loops'), a: L('把各部分接起来', 'wires it together'), d: ['motor_control/'], y: 160, h: 150, color: ['#C2412D', '#FF9C88']},
 {k: 'hw', n: 1, t: L('硬件与板级', 'Hardware'), a: L('中断入口和硬件接口', 'interrupts and hardware API'), d: ['embedded_project/Y01/'], y: 322, h: 190, color: ['#56677A', '#A8B9CB']},
],
nodes: [
 {id: 'c1', k: 'comm', x: 170, y: 52, w: 200, h: 62, t: L('CAN 收发', 'CAN I/O'), f: 'drv_can_app.c', path: 'embedded_project/Y01/Board/drv_can_app.c',
  plain: L('收发 CAN 报文，交给协议栈。', 'Sends and receives CAN frames for the protocol stack.'), fns: ['CANopen_DispatchFromISR()'], eps: [[1, 's']]},
 {id: 'w1', k: 'wire', x: 170, y: 196, w: 400, h: 76, t: L('心跳的入口', 'Heartbeat entry points'), f: 'motor_ctl_loop.c', path: 'motor_control/motor_ctl_loop.c',
  plain: L('电流环的入口函数在这里：读电流、跑算法、输出电压。', 'The current loop’s entry function: read current, run the math, output voltage.'), fns: ['CurrentLoopCtrl()'], eps: [[1, 'r']]},
 {id: 'h2', k: 'hw', x: 170, y: 360, w: 235, h: 62, t: L('中断入口', 'Interrupt entries'), f: 'board.c', path: 'embedded_project/Y01/Board/board.c',
  plain: L('电流环中断从这里进来。', 'The current-loop interrupt enters here.'), fns: ['CURRENT_LOOP_IRQ_TASK()'], eps: [[1, 's']]},
 {id: 'h5', k: 'hw', x: 422, y: 360, w: 235, h: 62, t: L('硬件接口', 'Hardware API'), f: 'bsp_api.c', path: 'embedded_project/Y01/Board/bsp_api.c',
  plain: L('读电流、输出电压都通过这里。', 'Reading current and outputting voltage both go through here.'), fns: ['bsp_get_phase_current()', 'bsp_set_phase_voltage()'], eps: [[1, 's']]},
 {id: 'kx', k: 'data', board: true, x: 1028, y: 196, w: 150, h: 220, t: 'kAxis', sub: L('共享白板', 'whiteboard'), f: 'motor_ctl_loop.c', path: 'motor_control/motor_ctl_loop.c',
  rows: ['current_ctl_*', '…'], plain: L('控制层的共享数据。', 'The control layer’s shared data.'), fns: ['Axis kAxis;'], eps: [[1, 's']]},
],
clocks: [
 {id: 'cur', t: L('电流环', 'Current loop'), rate: '20 kHz', per: L('每 50 µs', 'every 50 µs'), d: .5, color: 'var(--L-wire)',
  note: L('ADC 采完电流就触发。', 'Fires when the ADC finishes sampling.'),
  calls: [['h2', 'CURRENT_LOOP_IRQ_TASK()'], ['w1', 'CurrentLoopCtrl()'], ['h5', 'bsp_get_phase_current()']]},
],
fields: [
 {f: 'current_ctl_input.iabc_now_A', t: L('三相实际电流', 'Measured phase currents'), w: ['w1', 'h5'], r: ['w1'], wc: L('电流环', 'current loop'), rc: L('电流环', 'current loop'),
  how: L('CurrentLoopCtrl() 调用 bsp_get_phase_current() 写入。', 'CurrentLoopCtrl() writes it through bsp_get_phase_current().')},
],
routes: {
 cur: {ep: 1, t: L('一次电流环', 'One current loop'), sub: L('从中断到输出电压', 'From interrupt to output voltage'), steps: [
  {n: ['h2'], t: L('中断响起', 'The interrupt fires'), p: L('ADC 采完电流。', 'The ADC finished sampling.'), file: 'embedded_project/Y01/Board/board.c', code: 'CurrentLoopCtrl();'},
  {n: ['w1', 'h5'], t: L('读电流', 'Read current'), p: L('电流写上白板。', 'Current goes onto the whiteboard.'), file: 'motor_control/motor_ctl_loop.c', code: 'bsp_get_phase_current(kAxis.current_ctl_input.iabc_now_A);'},
  {n: ['h5'], t: L('输出电压', 'Output voltage'), p: L('电压交给硬件接口。', 'Voltage goes to the hardware API.'), file: 'motor_control/motor_ctl_loop.c', code: 'bsp_set_phase_voltage(kAxis.current_ctl_output.uabc_tar_comp_V);'},
 ]},
},
zoom: {},
eps: {
 1: {routes: ['cur'], qs: [
  {q: L('电流环的中断入口在哪个文件？', 'Which file holds the current-loop interrupt entry?'), a: 'h2', why: L('board.c 的 CURRENT_LOOP_IRQ_TASK()。', 'CURRENT_LOOP_IRQ_TASK() in board.c.')},
  {multi: true, q: L('换一块驱动板，读电流和输出电压要改哪几块？', 'On a new board, which blocks change for reading current and outputting voltage?'), a: ['h5'],
   why: L('只改硬件接口 bsp_api.c；上层只调用 bsp_* 函数。', 'Only the hardware API, bsp_api.c; the layers above only call bsp_* functions.'),
   per: {h5: L('bsp_get_phase_current() 和 bsp_set_phase_voltage() 在这里。', 'bsp_get_phase_current() and bsp_set_phase_voltage() live here.'), w1: L('只调用 bsp_* 函数，不用改。', 'Only calls bsp_* functions; no change.')}},
 ]},
},
};
