// English text for course.js. Only the fields written here change in English mode; everything else
// (ids, steps, links, status) comes from course.js. Episodes are matched by id. An array replaces the
// Chinese one wholesale; to change only some fields of objects in an array, key them by index ({0: {...}}).
// Every episode added to course.js gets its English here too.
enOverlay(window.COURSE_META, {
  title: 'EtherCAT from Scratch',
  subtitle: 'How robot joints talk and stay in sync, read through SOEM on a virtual line',
  mapNote: 'From why sync matters to distributed clocks, one mechanism per episode. Every number comes from the real SOEM master running on a virtual line.',
  footer: 'The master code is the open-source SOEM (v2.0.1, GPLv3). The slaves are simulated EtherCAT slave controllers in vwire; the videos label everything that is simulated. Videos and slides are original self-study material.',
});

enOverlay(window.EPISODES, {
  ep01: {title: 'The 1 ms problem: why sync is accuracy', group: 'Foundations',
    desc: 'For a moving machine, timing error is position error. Tell skew from jitter, then see a real run: tens of microseconds of jitter when drives act on arrival, about 5 ns with distributed clocks.',
    videoTime: 'about 8 min · subtitles'},
  ep02: {title: 'One cable is already a ring', group: 'Foundations',
    desc: 'One pair sends, one pair receives. Slaves work on the frame going out, and a port with no cable closes so the frame turns round. A line of slaves is already a ring: in a real scan the frame is back after 1485 ns, and a cut cable only makes the ring shorter.',
    videoTime: 'about 8 min · subtitles'},
  ep03a: {title: 'One frame, never stopped: processing on the fly', group: 'Frames and addressing',
    desc: 'A frame is a stream of bits: our cyclic frame is 8 µs long on the wire, far longer than the line. Slaves never store it; each reads and writes its own seats as the bits pass. The checksum comes last, so a bad frame can only be marked and dropped at the end.',
    videoTime: 'about 8 min · subtitles'},
  ep03b: {title: 'What is inside the frame: datagrams, logical addresses, the working counter', group: 'Frames and addressing'},
  ep04a: {title: 'From power-on to data: the state machine', group: 'Startup and configuration'},
  ep04b: {title: 'Two channels: mailbox and process data (CoE)', group: 'Startup and configuration'},
  ep05a: {title: 'Distributed clocks 1: measuring the delay of every hop', group: 'Distributed clocks'},
  ep05b: {title: 'Distributed clocks 2: setting the clocks, and keeping them set', group: 'Distributed clocks'},
  ep05c: {title: 'Distributed clocks 3: SYNC0, one starting pistol', group: 'Distributed clocks'},
  ep06: {title: 'A broken cable: the redundant port', group: 'Further'}
});
