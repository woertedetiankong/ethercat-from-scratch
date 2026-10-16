# EtherCAT 从零读懂

[English](README.en.md)

一门视频课（视频 + 课件），讲清 EtherCAT 是怎么通信、怎么同步的。不需要任何硬件：
主站是真正的 SOEM 代码，从站是 `vwire/` 里模拟的 EtherCAT 从站芯片（ESC）。

**看视频：** 在 [Releases](https://github.com/woertedetiankong/ethercat-from-scratch/releases) 下载（无旁白，中英双语字幕）。每集课件在 `site/content/epNN/`。

## 目录

| 路径 | 是什么 |
|---|---|
| `soem/` | SOEM 主站源码，git 子模块，固定在 **v2.0.1**（`49fc349`）。视频按行号引用它，不要随手移动。 |
| `vwire/` | 虚拟总线：SOEM 的 Linux 网卡驱动原样编译，socket 调用被接到模拟从站上。 |
| `vwire/src/vwire.c` | 模拟的从站链：端口、边走边处理、寄存器、SII EEPROM、FMMU、分布式时钟、SYNC0。 |
| `vwire/apps/` | 主站小程序：`scan`（找从站、量延迟）、`cycle`（进 OP、跑周期数据、对比有无 DC）。 |
| `vwire/runs.sh` | 课程引用的每一次运行；输出在 `vwire/data/`（trace 是 JSON lines，`.pcap` 可以用 Wireshark 打开）。 |
| `episodes/epNN-*/` | 每一集的视频制作目录（脚本、动画、配音、课件）。 |
| `site/` | 课程首页：`cd site && npm start`。 |

## 常用命令

```sh
git submodule update --init          # 第一次拉下 SOEM
vwire/build.sh                       # 编译（macOS / Linux，cc 即可）
vwire/build/scan vwire:chain3        # 扫描虚拟总线：3 个从站和它们之间的延迟
vwire/build/cycle vwire:chain3 --frame   # 不用分布式时钟：关节在帧到达时动作
vwire/build/cycle vwire:chain3 --dc      # 用分布式时钟：关节在 SYNC0 时动作
vwire/runs.sh                        # 重新生成课程用到的全部数据
```

可用的虚拟总线：`vwire:ai1`（只有一块模拟量采集卡）、`vwire:chain3`（采集卡 + 2 个关节驱动器）、`vwire:arm6`（6 个关节）。
环境变量：`VWIRE_TRACE`、`VWIRE_PCAP`、`VWIRE_HOPS=1|all`（记录每一站处理后的帧）、`VWIRE_FWD_NS`、`VWIRE_RET_NS`、
`VWIRE_CABLE_NS_PER_M`、`VWIRE_BREAK=k`（第 k 站之后断线）、`VWIRE_NO_DRIFT=1`（晶振无误差）。

## 什么是真的，什么是模拟的

- **真的：** 主站发出的每一个字节、SOEM 的每一个决定（扫描、读 EEPROM、映射、测延迟、写偏移）、Mac 上主站周期的真实抖动。
- **模拟的（视频里会标注）：** 网线延迟（5 ns/m）和芯片内部延迟（取自 ET1100 数据手册：经过处理单元 305 ns、旁路 265 ns；PHY 延迟未建模）、每个从站晶振的误差（±几十 ppm）、
  从站芯片里的时间控制环、从站应用（采集卡的电压、关节驱动器）。这些参数在 `vwire/src/vwire.c` 开头。

## 踩过的坑

- macOS 没有 `clock_nanosleep` 和 `ppoll`：`vwire/shim/` 只给 SOEM 补上这两个，SOEM 源码一行不改。
- SOEM 发现两个从站的厂商号、产品号、版本号都相同，就直接复用前一个的 SII 信息（`ecx_lookup_prev_sii`），所以两个关节驱动器名字相同。

## 许可

SOEM 是 GPLv3；`vwire/` 链接了它，也按 GPLv3 发布。
