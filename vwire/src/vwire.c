/* vwire: a virtual EtherCAT line for teaching. See vwire.h for what is real and what is modelled.
 *
 * One frame's trip, as this file computes it (slave i, port 0 = towards the master, port 1 = onwards):
 *
 *   master --cable--> [p0 -> processing unit -> p1] --cable--> [p0 -> PU -> p1] ... last slave: p1 closed,
 *   master <--cable-- [p0 <------------------- p1] <--cable-- [p0 <-------- p1] <-- loops back to p0
 *
 * Heads of frames are timed (cut-through: a slave starts sending before the tail has arrived).
 * Datagrams are executed in the processing unit, in slave order, on the way out only.
 */
#include "vwire.h"

#include <errno.h>
#include <poll.h>
#include <math.h>
#include <pthread.h>
#include <stdarg.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

#define VW_FD          4242
#define VW_MAXSLAVE    16
#define VW_MEM         0x10000
#define VW_MAXFRAME    1536
#define VW_QUEUE       64

/* ---------------- model parameters (all overridable from the environment) ---------------- */

/* Delays inside a slave: Beckhoff ET1100 datasheet, Table 91 "Forwarding delays", MII port to MII port, average
 * (through the processing unit 305 ns, alongside it 265 ns: tDiff = 40 ns). The PHYs' own delays come on top in a
 * real device; they are not modelled. */
typedef struct
{
   double cable_ns_per_m; /* signal speed in Cat5 copper, ~0.66 c */
   int fwd_ns;            /* port 0 in -> processing unit -> port 1 out ("processing" direction) */
   int ret_ns;            /* port 1 in -> port 0 out, alongside the processing unit ("forwarding" direction) */
   int loop_ns;           /* port 0 in -> processing unit -> closed port 1 loops back -> port 0 out */
   int epu_ns;            /* port 0 in -> start of frame at the processing unit */
   double ctrl_wn;        /* time control loop model: natural frequency, rad/s */
   double ctrl_zeta;      /* time control loop model: damping */
   double ctrl_max_rate;  /* largest speed correction, ns per ns */
} vw_params;

static vw_params P = {5.0, 305, 265, 305, 40, 10.0, 1.0, 200e-6};

/* ---------------- slaves ---------------- */

enum { KIND_AI = 1, KIND_JOINT = 2 };

typedef struct
{
   const char *name;
   int kind;
   uint32_t product;
   double ppm;          /* crystal error of this slave's 25 MHz oscillator, parts per million */
   double power_on_s;   /* seconds before the line was opened when this slave was switched on */
   double cable_m;      /* cable from the previous node (master or slave) into this slave's port 0 */
} vw_slavecfg;

typedef struct
{
   vw_slavecfg cfg;
   uint8_t mem[VW_MEM];
   uint8_t sii[1024];
   int sii_len;
   int linked1;         /* port 1 has a link (a next slave is plugged in and the cable is whole) */
   int64_t power_on;    /* true time of power-on: local time 0 */
   /* time control loop (model) */
   double corr_base;    /* ns added to the local clock, accumulated up to corr_t0 */
   int64_t corr_t0;
   double rate;         /* current speed correction, ns per ns */
   double rate_i;       /* its integral part (learnt crystal error) */
   int64_t last_ctrl_t;
   double diff_filt;
   int ctrl_count;
   /* SYNC0 unit */
   int sync_on;
   int64_t sync_next;   /* system time of the next pulse */
   uint32_t sync_cycle;
   int64_t last_adv;
   /* latch of 0x0900: waiting for the return pass to stamp port 1 */
   int latch_pending;
} vw_slave;

static vw_slave S[VW_MAXSLAVE];
static int NS;
static char line_name[64];
static int line_break = 0; /* cable after slave k cut (0 = whole) */

/* ---------------- run state ---------------- */

static pthread_mutex_t mu = PTHREAD_MUTEX_INITIALIZER;
static int opened;
static int64_t t_open;
static uint64_t frame_no;

typedef struct
{
   int64_t ready;
   int len;
   uint8_t buf[VW_MAXFRAME];
} vw_rx;
static vw_rx rxq[VW_QUEUE];
static int rx_head, rx_count;

static FILE *ftrace, *fpcap;
static int hops_mode;   /* 0 none, 1 frames with logical/DC datagrams, 2 every frame */
static int frames_mode; /* log a one-line summary of every frame */

/* ---------------- small helpers ---------------- */

static uint16_t rd16(const uint8_t *p) { return (uint16_t)(p[0] | (p[1] << 8)); }
static uint32_t rd32(const uint8_t *p) { return (uint32_t)rd16(p) | ((uint32_t)rd16(p + 2) << 16); }
static uint64_t rd64(const uint8_t *p) { return (uint64_t)rd32(p) | ((uint64_t)rd32(p + 4) << 32); }
static void wr16(uint8_t *p, uint16_t v) { p[0] = (uint8_t)v; p[1] = (uint8_t)(v >> 8); }
static void wr32(uint8_t *p, uint32_t v) { wr16(p, (uint16_t)v); wr16(p + 2, (uint16_t)(v >> 16)); }
static void wr64(uint8_t *p, uint64_t v) { wr32(p, (uint32_t)v); wr32(p + 4, (uint32_t)(v >> 32)); }

int64_t vwire_now(void)
{
   struct timespec ts;
   clock_gettime(CLOCK_MONOTONIC, &ts);
   return (int64_t)ts.tv_sec * 1000000000LL + ts.tv_nsec;
}

static double rel_us(int64_t t) { return (double)(t - t_open) / 1000.0; }

static void trace(const char *fmt, ...)
{
   va_list ap;
   if (!ftrace) return;
   va_start(ap, fmt);
   vfprintf(ftrace, fmt, ap);
   va_end(ap);
   fputc('\n', ftrace);
}

static void hex(char *out, const uint8_t *p, int n)
{
   static const char *h = "0123456789abcdef";
   int i;
   for (i = 0; i < n; i++)
   {
      out[2 * i] = h[p[i] >> 4];
      out[2 * i + 1] = h[p[i] & 15];
   }
   out[2 * n] = 0;
}

/* ---------------- local clocks and system time ---------------- */

/* the slave's own 64-bit clock: ns since its power-on, counted in 10 ns ticks of a crystal that is ppm off */
static int64_t local_time(vw_slave *s, int64_t t)
{
   double raw = (double)(t - s->power_on) * (1.0 + s->cfg.ppm * 1e-6);
   int64_t q = (int64_t)raw;
   return q - (q % 10);
}

static double corr_at(vw_slave *s, int64_t t)
{
   return s->corr_base + s->rate * (double)(t - s->corr_t0);
}

/* register 0x0910: local time + offset (0x0920) + what the time control loop has added */
static int64_t sys_time(vw_slave *s, int64_t t)
{
   return local_time(s, t) + (int64_t)rd64(&s->mem[0x0920]) + (int64_t)llround(corr_at(s, t));
}

int64_t vwire_systime(int slave, int64_t t)
{
   if (slave < 1 || slave > NS) return 0;
   return sys_time(&S[slave - 1], t);
}

int vwire_slave_count(void) { return NS; }

/* ---------------- slave applications ---------------- */

static void ai_update(vw_slave *s, int64_t t)
{
   /* the simulated card reports each channel in millivolts (0..5000) */
   double ts = (double)(t - t_open) * 1e-9;
   int16_t ch[8] = {0};
   int i;
   ch[0] = 3142;                                               /* a steady 3.142 V source */
   ch[1] = (int16_t)lround(2500.0 + 1500.0 * sin(2 * M_PI * 0.5 * ts)); /* a 0.5 Hz sine */
   ch[2] = (int16_t)lround(1000.0 + 1000.0 * ((ts - floor(ts)) )); /* a 1 Hz ramp, 1..2 V */
   ch[3] = 4750;
   for (i = 0; i < 8; i++) wr16(&s->mem[0x1000 + 2 * i], (uint16_t)ch[i]);
}

/* a joint drive in cyclic synchronous position mode: at its trigger it takes the target it holds */
static void joint_apply(vw_slave *s, int idx, int64_t t, const char *why)
{
   uint16_t cw = rd16(&s->mem[0x1000]);
   int32_t target = (int32_t)rd32(&s->mem[0x1002]);
   uint16_t sw = ((cw & 0x000F) == 0x000F) ? 0x0237 : 0x0250;
   if (sw == 0x0237) wr32(&s->mem[0x1102], (uint32_t)target);
   wr16(&s->mem[0x1100], sw);
   trace("{\"ev\":\"act\",\"s\":%d,\"t_us\":%.4f,\"by\":\"%s\",\"target\":%d,\"sw\":%d}", idx + 1,
         rel_us(t), why, target, sw);
}

/* run this slave's SYNC0 unit up to true time t (pulses are placed exactly where the system time crossed them) */
static void advance(vw_slave *s, int idx, int64_t t)
{
   if (s->sync_on && s->sync_cycle > 0)
   {
      int guard = 0;
      while (sys_time(s, t) >= s->sync_next && guard++ < 100000)
      {
         double slope = (1.0 + s->cfg.ppm * 1e-6) + s->rate;
         double back = (double)(sys_time(s, t) - s->sync_next) / slope;
         int64_t te = t - (int64_t)llround(back);
         if (te < s->last_adv) te = s->last_adv;
         trace("{\"ev\":\"sync0\",\"s\":%d,\"t_us\":%.4f,\"sys\":%lld}", idx + 1, rel_us(te),
               (long long)s->sync_next);
         if (s->cfg.kind == KIND_JOINT && (rd16(&s->mem[0x0130]) & 0x0F) == 0x08) joint_apply(s, idx, te, "sync0");
         s->sync_next += s->sync_cycle;
      }
   }
   if (s->cfg.kind == KIND_AI) ai_update(s, t);
   s->last_adv = t;
}

/* ---------------- SII EEPROM image ---------------- */

static void sii_cat(vw_slave *s, uint16_t type, const uint8_t *data, int n)
{
   int words = (n + 1) / 2;
   wr16(&s->sii[s->sii_len], type);
   wr16(&s->sii[s->sii_len + 2], (uint16_t)words);
   memcpy(&s->sii[s->sii_len + 4], data, (size_t)n);
   s->sii_len += 4 + 2 * words;
}

static int pdo_bytes(uint8_t *p, uint16_t index, uint8_t sm, const uint16_t *ent_idx, const uint8_t *bits, int n)
{
   int i, k = 0;
   wr16(&p[k], index); k += 2;
   p[k++] = (uint8_t)n;
   p[k++] = sm;
   p[k++] = 0; p[k++] = 0; /* synchronization, name index */
   wr16(&p[k], 0); k += 2;  /* flags */
   for (i = 0; i < n; i++)
   {
      wr16(&p[k], ent_idx[i]); k += 2;
      p[k++] = (ent_idx[i] == 0x6000) ? (uint8_t)(i + 1) : 0; /* subindex */
      p[k++] = 0;                                              /* name index */
      p[k++] = (bits[i] == 16) ? 3 : 4;                         /* data type INT16 / INT32 */
      p[k++] = bits[i];
      wr16(&p[k], 0); k += 2;
   }
   return k;
}

static void build_sii(vw_slave *s)
{
   uint8_t b[256];
   int n;
   memset(s->sii, 0xff, sizeof(s->sii));
   memset(s->sii, 0, 0x80);
   wr32(&s->sii[0x0008 * 2], 0xE0000ECA);       /* vendor id: not a real vendor (teaching line) */
   wr32(&s->sii[0x000A * 2], s->cfg.product);
   wr32(&s->sii[0x000C * 2], 0x00010000);       /* revision */
   wr32(&s->sii[0x000E * 2], 0x1000 + (uint32_t)(s - S)); /* serial */
   wr16(&s->sii[0x003E * 2], 0x0007);           /* EEPROM size: 1 kbyte */
   wr16(&s->sii[0x003F * 2], 0x0001);           /* SII version */
   s->sii_len = 0x0040 * 2;

   /* strings: 1 = device name */
   n = (int)strlen(s->cfg.name);
   b[0] = 1;
   b[1] = (uint8_t)n;
   memcpy(&b[2], s->cfg.name, (size_t)n);
   sii_cat(s, 10, b, 2 + n);

   /* general: name = string 1, no mailbox protocols */
   memset(b, 0, 32);
   b[3] = 1;
   sii_cat(s, 30, b, 32);

   if (s->cfg.kind == KIND_AI)
   {
      uint16_t ents[8] = {0x6000, 0x6000, 0x6000, 0x6000, 0x6000, 0x6000, 0x6000, 0x6000};
      uint8_t bits[8] = {16, 16, 16, 16, 16, 16, 16, 16};
      uint8_t fmmu[2] = {2, 0xff};                 /* FMMU0 = inputs */
      uint8_t sm[8];
      sii_cat(s, 40, fmmu, 2);
      wr16(&sm[0], 0x1000); wr16(&sm[2], 16); sm[4] = 0x20; sm[5] = 0; sm[6] = 1; sm[7] = 4; /* SM0: inputs */
      sii_cat(s, 41, sm, 8);
      n = pdo_bytes(b, 0x1A00, 0, ents, bits, 8);
      sii_cat(s, 50, b, n);                         /* TxPDO: slave -> master */
   }
   else
   {
      uint16_t rx[2] = {0x6040, 0x607A}, tx[2] = {0x6041, 0x6064};
      uint8_t bits[2] = {16, 32};
      uint8_t fmmu[2] = {1, 2};                    /* FMMU0 = outputs, FMMU1 = inputs */
      uint8_t sm[16];
      sii_cat(s, 40, fmmu, 2);
      wr16(&sm[0], 0x1000); wr16(&sm[2], 6); sm[4] = 0x64; sm[5] = 0; sm[6] = 1; sm[7] = 3;  /* SM0: outputs */
      wr16(&sm[8], 0x1100); wr16(&sm[10], 6); sm[12] = 0x20; sm[13] = 0; sm[14] = 1; sm[15] = 4; /* SM1: inputs */
      sii_cat(s, 41, sm, 16);
      n = pdo_bytes(b, 0x1A00, 1, tx, bits, 2);
      sii_cat(s, 50, b, n);
      n = pdo_bytes(b, 0x1600, 0, rx, bits, 2);
      sii_cat(s, 51, b, n);
   }
   wr16(&s->sii[s->sii_len], 0xffff);
   s->sii_len += 2;
}

/* ---------------- line presets ---------------- */

static const vw_slavecfg AI = {"AI-4 analog input", KIND_AI, 0x00000A14, 0, 0, 0};
static const vw_slavecfg JOINT = {"Joint drive", KIND_JOINT, 0x0000D402, 0, 0, 0};

static void add_slave(vw_slavecfg c, const char *name, double ppm, double power_on_s, double cable_m)
{
   vw_slave *s = &S[NS++];
   memset(s, 0, sizeof(*s));
   c.name = name;
   c.ppm = ppm;
   c.power_on_s = power_on_s;
   c.cable_m = cable_m;
   s->cfg = c;
}

static int load_line(const char *ifname)
{
   const char *p = strchr(ifname, ':');
   const char *line = p ? p + 1 : ifname;
   NS = 0;
   snprintf(line_name, sizeof(line_name), "%s", line);
   if (!strcmp(line, "ai1"))
   {
      add_slave(AI, "AI-4 analog input", +18.0, 2.000, 2.0);
   }
   else if (!strcmp(line, "chain3"))
   {
      add_slave(AI, "AI-4 analog input", +18.0, 2.000, 2.0);
      add_slave(JOINT, "Joint drive", -27.0, 1.500, 1.0);
      add_slave(JOINT, "Joint drive", +41.0, 1.200, 1.0);
   }
   else if (!strcmp(line, "arm6"))
   {
      static const char *names[6] = {"Joint drive J1", "Joint drive J2", "Joint drive J3",
                                     "Joint drive J4", "Joint drive J5", "Joint drive J6"};
      static const double ppm[6] = {+18, -27, +41, -9, +33, -45};
      int i;
      for (i = 0; i < 6; i++) add_slave(JOINT, names[i], ppm[i], 2.0 - 0.1 * i, i ? 0.5 : 2.0);
   }
   else
   {
      return 0;
   }
   return 1;
}

static double envd(const char *k, double d)
{
   const char *v = getenv(k);
   return v ? atof(v) : d;
}

static void reset_slave(vw_slave *s)
{
   memset(s->mem, 0, VW_MEM);
   s->mem[0x0000] = 0x11;        /* ESC type (generic, as an ET1100-class chip) */
   s->mem[0x0004] = 8;           /* FMMUs */
   s->mem[0x0005] = 8;           /* SyncManagers */
   s->mem[0x0007] = 0x0F;        /* port descriptor: ports 0 and 1 are MII, 2 and 3 not implemented */
   wr16(&s->mem[0x0008], 0x000C); /* features: DC available, 64-bit DC */
   wr16(&s->mem[0x0130], 0x0001); /* AL status: INIT */
   s->mem[0x0140] = 0x05;        /* PDI: SPI */
   wr16(&s->mem[0x0502], 0x0040); /* EEPROM: can read 8 bytes at a time, idle */
   wr16(&s->mem[0x0930], 0x1000);
}

static void dl_status(vw_slave *s)
{
   /* per port: link bit (4+p), and two loop bits at 8+2p: 10 = open and communicating, 01 = closed */
   uint16_t v = 0x0001 | 0x0010 | 0x0200; /* PDI ok, port 0 link, port 0 open + communicating */
   if (s->linked1) v |= 0x0020 | 0x0800;
   else v |= 0x0400;
   v |= 0x1000 | 0x4000; /* ports 2 and 3: closed */
   wr16(&s->mem[0x0110], v);
}

static void open_line(void)
{
   int i;
   const char *tp = getenv("VWIRE_TRACE");
   const char *pp = getenv("VWIRE_PCAP");
   const char *h = getenv("VWIRE_HOPS");
   P.cable_ns_per_m = envd("VWIRE_CABLE_NS_PER_M", P.cable_ns_per_m);
   P.fwd_ns = (int)envd("VWIRE_FWD_NS", P.fwd_ns);
   P.ret_ns = (int)envd("VWIRE_RET_NS", P.ret_ns);
   P.loop_ns = (int)envd("VWIRE_LOOP_NS", P.loop_ns);
   P.ctrl_wn = envd("VWIRE_CTRL_WN", P.ctrl_wn);
   line_break = (int)envd("VWIRE_BREAK", 0);
   hops_mode = h ? (strcmp(h, "all") == 0 ? 2 : 1) : 0;
   frames_mode = getenv("VWIRE_FRAMES") != NULL;
   if (getenv("VWIRE_NO_DRIFT"))
      for (i = 0; i < NS; i++) S[i].cfg.ppm = 0;

   t_open = vwire_now();
   frame_no = 0;
   rx_head = rx_count = 0;
   for (i = 0; i < NS; i++)
   {
      vw_slave *s = &S[i];
      s->power_on = t_open - (int64_t)(s->cfg.power_on_s * 1e9);
      s->linked1 = (i + 1 < NS) && (line_break != i + 1);
      reset_slave(s);
      dl_status(s);
      build_sii(s);
      s->last_adv = t_open;
      s->corr_t0 = t_open;
   }
   if (tp) ftrace = fopen(tp, "w");
   if (pp)
   {
      /* pcap with nanosecond timestamps, Ethernet link type: Wireshark decodes EtherCAT (0x88A4) */
      uint8_t g[24] = {0};
      fpcap = fopen(pp, "wb");
      wr32(&g[0], 0xa1b23c4d);
      wr16(&g[4], 2);
      wr16(&g[6], 4);
      wr32(&g[16], 65535);
      wr32(&g[20], 1);
      if (fpcap) fwrite(g, 1, 24, fpcap);
   }
   trace("{\"ev\":\"open\",\"line\":\"%s\",\"slaves\":%d,\"cable_ns_per_m\":%.2f,\"fwd_ns\":%d,\"ret_ns\":%d,"
         "\"loop_ns\":%d,\"break_after\":%d}",
         line_name, NS, P.cable_ns_per_m, P.fwd_ns, P.ret_ns, P.loop_ns, line_break);
   for (i = 0; i < NS; i++)
      trace("{\"ev\":\"slave\",\"s\":%d,\"name\":\"%s\",\"ppm\":%.1f,\"power_on_s\":%.3f,\"cable_m\":%.2f,"
            "\"port1\":%s}",
            i + 1, S[i].cfg.name, S[i].cfg.ppm, S[i].cfg.power_on_s, S[i].cfg.cable_m,
            S[i].linked1 ? "\"open\"" : "\"closed\"");
   opened = 1;
}

void vwire_mark(const char *what)
{
   pthread_mutex_lock(&mu);
   trace("{\"ev\":\"mark\",\"t_us\":%.4f,\"what\":\"%s\"}", rel_us(vwire_now()), what);
   pthread_mutex_unlock(&mu);
}

void vwire_flush(void)
{
   pthread_mutex_lock(&mu);
   if (ftrace) fflush(ftrace);
   if (fpcap) fflush(fpcap);
   pthread_mutex_unlock(&mu);
}

/* ---------------- register access ---------------- */

static void time_control(vw_slave *s, int idx, int64_t t, int64_t received, int bytes)
{
   int64_t delay = (int32_t)rd32(&s->mem[0x0928]);
   int64_t own = sys_time(s, t);
   int64_t d = own - (received + delay); /* > 0: my clock is ahead of the reference */
   double dt, k_i, tau;
   uint32_t reg;
   if (bytes < 8) d = (int32_t)((uint32_t)own - (uint32_t)(received + delay));

   /* fold the correction so far, then pick a new speed (model of the ESC's control loop) */
   s->corr_base = corr_at(s, t);
   s->corr_t0 = t;
   dt = s->last_ctrl_t ? (double)(t - s->last_ctrl_t) * 1e-9 : 1e-3;
   if (dt > 0.01) dt = 0.01;
   s->last_ctrl_t = t;
   k_i = P.ctrl_wn * P.ctrl_wn * dt * 1e-9; /* speed change per ns of error */
   tau = 1.0 / (2.0 * P.ctrl_zeta * P.ctrl_wn);
   s->rate_i -= k_i * (double)d;
   if (s->rate_i > P.ctrl_max_rate) s->rate_i = P.ctrl_max_rate;
   if (s->rate_i < -P.ctrl_max_rate) s->rate_i = -P.ctrl_max_rate;
   s->rate = s->rate_i - (double)d * 1e-9 / tau;
   if (s->rate > P.ctrl_max_rate) s->rate = P.ctrl_max_rate;
   if (s->rate < -P.ctrl_max_rate) s->rate = -P.ctrl_max_rate;
   s->ctrl_count++;

   /* 0x092C system time difference: sign bit 31 set when the local copy is smaller */
   s->diff_filt += ((double)d - s->diff_filt) / 4.0;
   reg = (uint32_t)llabs((long long)llround(s->diff_filt)) & 0x7fffffff;
   if (s->diff_filt < 0) reg |= 0x80000000u;
   wr32(&s->mem[0x092C], reg);
   trace("{\"ev\":\"ctrl\",\"s\":%d,\"t_us\":%.4f,\"diff_ns\":%lld,\"rate_ppm\":%.3f}", idx + 1, rel_us(t),
         (long long)d, s->rate * 1e6);
}

static void reg_before_read(vw_slave *s, int64_t t, uint16_t ado, int len)
{
   if (ado < 0x0918 && ado + len > 0x0910) wr64(&s->mem[0x0910], (uint64_t)sys_time(s, t));
}

static void reg_after_write(vw_slave *s, int idx, int64_t t, int64_t t_port0, uint16_t ado, int len, const uint8_t *data)
{
#define HIT(a) (ado <= (a) && ado + len > (a))
   if (HIT(0x0120))
   {
      uint16_t req = rd16(&s->mem[0x0120]) & 0x0F;
      uint16_t old = rd16(&s->mem[0x0130]) & 0x0F;
      wr16(&s->mem[0x0130], req);
      if (req != old)
         trace("{\"ev\":\"al\",\"s\":%d,\"t_us\":%.4f,\"from\":%d,\"to\":%d}", idx + 1, rel_us(t), old, req);
   }
   if (HIT(0x0502))
   {
      uint16_t cmd = rd16(&s->mem[0x0502]) & 0x0700;
      if (cmd == 0x0100)
      {
         uint32_t wa = rd32(&s->mem[0x0504]);
         int i;
         for (i = 0; i < 8; i++)
         {
            uint32_t a = wa * 2 + (uint32_t)i;
            s->mem[0x0508 + i] = (a < sizeof(s->sii)) ? s->sii[a] : 0xff;
         }
      }
      wr16(&s->mem[0x0502], 0x0040);
   }
   if (HIT(0x0900))
   {
      /* latch: port 0 = this frame's head arriving now; processing unit; port 1 on the way back */
      wr32(&s->mem[0x0900], (uint32_t)local_time(s, t_port0));
      wr64(&s->mem[0x0918], (uint64_t)local_time(s, t));
      s->latch_pending = 1;
   }
   if (HIT(0x0910) && len >= 4 && ado == 0x0910)
   {
      int64_t v = (len >= 8) ? (int64_t)rd64(data) : (int64_t)rd32(data);
      time_control(s, idx, t, v, len >= 8 ? 8 : 4);
   }
   if (HIT(0x0930))
   {
      /* new speed counter start: the time control loop starts over */
      s->corr_base = 0;
      s->corr_t0 = t;
      s->rate = s->rate_i = 0;
      s->diff_filt = 0;
      s->last_ctrl_t = 0;
      wr32(&s->mem[0x092C], 0);
   }
   if (HIT(0x0981))
   {
      uint8_t a = s->mem[0x0981];
      s->sync_on = (a & 0x03) == 0x03;
      s->sync_next = (int64_t)rd64(&s->mem[0x0990]);
      s->sync_cycle = rd32(&s->mem[0x09A0]);
      trace("{\"ev\":\"sync_cfg\",\"s\":%d,\"t_us\":%.4f,\"on\":%d,\"start\":%lld,\"cycle_ns\":%u,\"sys_now\":%lld}",
            idx + 1, rel_us(t), s->sync_on, (long long)s->sync_next, s->sync_cycle, (long long)sys_time(s, t));
   }
#undef HIT
}

/* write targets through FMMU: did this datagram write the drive's output area? */
static int fmmu_xfer(vw_slave *s, uint32_t L, int len, uint8_t *data, int want_read, int want_write,
                     int *did_r, int *did_w)
{
   int f;
   for (f = 0; f < 8; f++)
   {
      const uint8_t *r = &s->mem[0x0600 + 16 * f];
      uint32_t fl = rd32(r);
      uint16_t flen = rd16(r + 4);
      uint16_t phys = rd16(r + 8);
      uint8_t type = r[11], act = r[12];
      uint32_t a0, a1;
      if (!(act & 1) || flen == 0) continue;
      a0 = (fl > L) ? fl : L;
      a1 = ((fl + flen) < (L + (uint32_t)len)) ? (fl + flen) : (L + (uint32_t)len);
      if (a0 >= a1) continue;
      if ((type & 1) && want_read)
      {
         memcpy(&data[a0 - L], &s->mem[phys + (a0 - fl)], a1 - a0);
         *did_r = 1;
      }
      if ((type & 2) && want_write)
      {
         memcpy(&s->mem[phys + (a0 - fl)], &data[a0 - L], a1 - a0);
         *did_w = 1;
      }
   }
   return *did_r || *did_w;
}

/* execute every datagram of the frame in slave idx's processing unit at true time t */
static void process_at(int idx, int64_t t, int64_t t_port0, uint8_t *ecat, int ecat_len, int *touched_out)
{
   vw_slave *s = &S[idx];
   int off = 2;
   advance(s, idx, t);
   while (off + 12 <= ecat_len)
   {
      uint8_t *h = &ecat[off];
      int cmd = h[0];
      uint16_t adp = rd16(&h[2]), ado = rd16(&h[4]);
      uint16_t lf = rd16(&h[6]);
      int len = lf & 0x07ff;
      uint8_t *data = &h[10];
      uint8_t *wkcp = &h[10 + len];
      uint16_t wkc;
      int more = (lf & 0x8000) != 0;
      int addressed = 0;
      if (off + 12 + len > ecat_len) break;
      wkc = rd16(wkcp);
      switch (cmd)
      {
      case 1: case 2: case 3: case 13: /* auto-increment: the slave that sees 0 is addressed; everyone adds 1 */
         addressed = (adp == 0);
         wr16(&h[2], (uint16_t)(adp + 1));
         break;
      case 4: case 5: case 6: case 14: /* configured address */
         addressed = (adp == rd16(&s->mem[0x0010]));
         break;
      case 7: case 8: case 9: /* broadcast: everyone, position counter still counts */
         addressed = 1;
         wr16(&h[2], (uint16_t)(adp + 1));
         break;
      default:
         break;
      }
      if (cmd == 1 || cmd == 4)
      {
         if (addressed)
         {
            reg_before_read(s, t, ado, len);
            memcpy(data, &s->mem[ado], (size_t)len);
            wkc++;
         }
      }
      else if (cmd == 2 || cmd == 5 || cmd == 8)
      {
         if (addressed)
         {
            memcpy(&s->mem[ado], data, (size_t)len);
            reg_after_write(s, idx, t, t_port0, ado, len, data);
            wkc++;
         }
      }
      else if (cmd == 7)
      {
         int i;
         reg_before_read(s, t, ado, len);
         for (i = 0; i < len; i++) data[i] |= s->mem[ado + i];
         wkc++;
      }
      else if (cmd == 3 || cmd == 6 || cmd == 9)
      {
         if (addressed)
         {
            uint8_t tmp[VW_MAXFRAME];
            reg_before_read(s, t, ado, len);
            memcpy(tmp, &s->mem[ado], (size_t)len);
            memcpy(&s->mem[ado], data, (size_t)len);
            reg_after_write(s, idx, t, t_port0, ado, len, data);
            memcpy(data, tmp, (size_t)len);
            wkc += 3;
         }
      }
      else if (cmd == 13 || cmd == 14)
      {
         /* read-multiple-write: the addressed slave puts its value in, every other slave takes it */
         if (addressed)
         {
            reg_before_read(s, t, ado, len);
            memcpy(data, &s->mem[ado], (size_t)len);
         }
         else
         {
            memcpy(&s->mem[ado], data, (size_t)len);
            reg_after_write(s, idx, t, t_port0, ado, len, data);
         }
         wkc++;
      }
      else if (cmd >= 10 && cmd <= 12)
      {
         uint32_t L = rd32(&h[2]);
         int r = 0, w = 0;
         fmmu_xfer(s, L, len, data, cmd != 11, cmd != 10, &r, &w);
         if (cmd == 12) wkc = (uint16_t)(wkc + (r ? 1 : 0) + (w ? 2 : 0));
         else if (r || w) wkc++;
         if (w) *touched_out = 1;
      }
      wr16(wkcp, wkc);
      off += 12 + len;
      if (!more) break;
   }
   /* a drive without SYNC0 acts the moment new outputs arrive (SyncManager event) */
   if (*touched_out && s->cfg.kind == KIND_JOINT && !s->sync_on && (rd16(&s->mem[0x0130]) & 0x0F) == 0x08)
      joint_apply(s, idx, t, "frame");
}

static void pcap_write(int64_t t, const uint8_t *buf, int len)
{
   uint8_t r[16];
   if (!fpcap) return;
   wr32(&r[0], (uint32_t)(t / 1000000000LL));
   wr32(&r[4], (uint32_t)(t % 1000000000LL));
   wr32(&r[8], (uint32_t)len);
   wr32(&r[12], (uint32_t)len);
   fwrite(r, 1, 16, fpcap);
   fwrite(buf, 1, (size_t)len, fpcap);
}

static int frame_is_interesting(const uint8_t *ecat, int n)
{
   int off = 2;
   while (off + 12 <= n)
   {
      int cmd = ecat[off];
      uint16_t ado = rd16(&ecat[off + 4]);
      int len = rd16(&ecat[off + 6]) & 0x07ff;
      if ((cmd >= 10 && cmd <= 14) || (ado >= 0x0900 && ado < 0x0A00)) return 1;
      if (!(rd16(&ecat[off + 6]) & 0x8000)) break;
      off += 12 + len;
   }
   return 0;
}

static void log_hop(uint64_t fno, int s, const char *where, int64_t t, const uint8_t *ecat, int n)
{
   char buf[2 * VW_MAXFRAME + 1];
   hex(buf, ecat, n);
   trace("{\"ev\":\"hop\",\"f\":%llu,\"s\":%d,\"at\":\"%s\",\"t_us\":%.4f,\"ecat\":\"%s\"}", (unsigned long long)fno, s,
         where, rel_us(t), buf);
}

/* one frame from the master: walk it down the line and back, return the time its head is back at the master */
static int64_t run_frame(uint8_t *f, int len, int64_t t0)
{
   int64_t arr0[VW_MAXSLAVE], epu[VW_MAXSLAVE], arr1[VW_MAXSLAVE], back0[VW_MAXSLAVE];
   int i, reach = NS, touched;
   uint8_t *ecat = f + 14;
   int ecat_len = len - 14;
   int hop = 0;
   uint64_t fno = ++frame_no;

   if (line_break > 0 && line_break < NS) reach = line_break;
   if (hops_mode == 2 || (hops_mode == 1 && frame_is_interesting(ecat, ecat_len))) hop = 1;
   if (hop) log_hop(fno, 0, "master_tx", t0, ecat, ecat_len);

   /* outgoing lane: port 0 -> processing unit -> port 1 */
   for (i = 0; i < reach; i++)
   {
      int64_t prev_out = (i == 0) ? t0 : arr0[i - 1] + P.fwd_ns;
      arr0[i] = prev_out + (int64_t)llround(S[i].cfg.cable_m * P.cable_ns_per_m);
      epu[i] = arr0[i] + P.epu_ns;
      touched = 0;
      f[6] |= 0x02; /* every processing unit sets SOURCE_MAC[1]: the master can tell returning frames apart */
      process_at(i, epu[i], arr0[i], ecat, ecat_len, &touched);
      if (hop) log_hop(fno, i + 1, "pu", epu[i], ecat, ecat_len);
   }
   /* the last reachable slave has port 1 closed: the frame loops back to its port 0 */
   back0[reach - 1] = arr0[reach - 1] + P.loop_ns;
   /* return lane: port 1 -> port 0, passed through untouched */
   for (i = reach - 2; i >= 0; i--)
   {
      arr1[i] = back0[i + 1] + (int64_t)llround(S[i + 1].cfg.cable_m * P.cable_ns_per_m);
      back0[i] = arr1[i] + P.ret_ns;
   }
   for (i = 0; i < reach; i++)
   {
      if (S[i].latch_pending)
      {
         int has1 = S[i].linked1 && i < reach - 1;
         char p1[32];
         if (has1)
         {
            wr32(&S[i].mem[0x0904], (uint32_t)local_time(&S[i], arr1[i]));
            snprintf(p1, sizeof(p1), "%.4f", rel_us(arr1[i]));
         }
         else
         {
            snprintf(p1, sizeof(p1), "null");
         }
         S[i].latch_pending = 0;
         trace("{\"ev\":\"latch\",\"f\":%llu,\"s\":%d,\"port0_true_us\":%.4f,\"port1_true_us\":%s,"
               "\"port0_reg\":%u,\"port1_reg\":%u,\"pu_reg\":%llu}",
               (unsigned long long)fno, i + 1, rel_us(arr0[i]), p1, rd32(&S[i].mem[0x0900]),
               rd32(&S[i].mem[0x0904]), (unsigned long long)rd64(&S[i].mem[0x0918]));
      }
   }
   {
      int64_t back = back0[0] + (int64_t)llround(S[0].cfg.cable_m * P.cable_ns_per_m);
      if (hop) log_hop(fno, 0, "master_rx", back, ecat, ecat_len);
      if (frames_mode || hop)
      {
         trace("{\"ev\":\"frame\",\"f\":%llu,\"t0_us\":%.4f,\"rtt_ns\":%lld,\"bytes\":%d}", (unsigned long long)fno,
               rel_us(t0), (long long)(back - t0), len);
         for (i = 0; i < reach; i++)
            trace("{\"ev\":\"path\",\"f\":%llu,\"s\":%d,\"in0_ns\":%lld,\"pu_ns\":%lld,\"in1_ns\":%lld,\"out0_ns\":%lld}",
                  (unsigned long long)fno, i + 1, (long long)(arr0[i] - t0), (long long)(epu[i] - t0),
                  (long long)((i < reach - 1) ? arr1[i] - t0 : -1), (long long)(back0[i] - t0));
      }
      return back;
   }
}

/* ---------------- the socket face SOEM's nicdrv.c talks to ---------------- */

int vwire_socket(int domain, int type, int protocol)
{
   (void)domain; (void)type; (void)protocol;
   return VW_FD;
}

int vwire_setsockopt(int s, int level, int opt, const void *val, unsigned int len)
{
   (void)s; (void)level; (void)opt; (void)val; (void)len;
   return 0;
}

int vwire_ioctl(int fd, unsigned long req, void *arg)
{
   /* SIOCGIFINDEX is the first call that carries the interface name: open that line */
   const char *name = (const char *)arg; /* struct ifreq starts with ifr_name */
   (void)fd; (void)req;
   pthread_mutex_lock(&mu);
   if (!opened)
   {
      if (!load_line(name))
      {
         fprintf(stderr, "vwire: unknown line \"%s\" (try vwire:ai1, vwire:chain3, vwire:arm6)\n", name);
         pthread_mutex_unlock(&mu);
         return -1;
      }
      open_line();
   }
   pthread_mutex_unlock(&mu);
   return 0;
}

int vwire_bind(int fd, const void *addr, unsigned int len)
{
   (void)fd; (void)addr; (void)len;
   return 0;
}

ssize_t vwire_send(int fd, const void *buf, size_t len, int flags)
{
   int64_t t0, back;
   vw_rx *r;
   (void)fd; (void)flags;
   if (len < 16 || len > VW_MAXFRAME) return -1;
   pthread_mutex_lock(&mu);
   if (rx_count == VW_QUEUE)
   {
      pthread_mutex_unlock(&mu);
      errno = ENOBUFS;
      return -1;
   }
   t0 = vwire_now();
   r = &rxq[(rx_head + rx_count) % VW_QUEUE];
   memcpy(r->buf, buf, len);
   r->len = (int)len;
   pcap_write(t0, r->buf, r->len);
   back = run_frame(r->buf, r->len, t0);
   /* the whole frame is in once its tail has arrived: 8 bytes preamble + frame (padded to Ethernet's 60-byte
      minimum by the NIC) + 4 bytes FCS, at 80 ns per byte */
   r->ready = back + (int64_t)((len < 60 ? 60 : len) + 12) * 80;
   pcap_write(r->ready, r->buf, r->len);
   rx_count++;
   pthread_mutex_unlock(&mu);
   return (ssize_t)len;
}

ssize_t vwire_recv(int fd, void *buf, size_t len, int flags)
{
   vw_rx *r;
   (void)fd; (void)flags;
   pthread_mutex_lock(&mu);
   if (rx_count == 0)
   {
      pthread_mutex_unlock(&mu);
      errno = EAGAIN;
      return -1;
   }
   r = &rxq[rx_head];
   if (vwire_now() < r->ready)
   {
      pthread_mutex_unlock(&mu);
      errno = EAGAIN;
      return -1;
   }
   if ((size_t)r->len < len) len = (size_t)r->len;
   memcpy(buf, r->buf, len);
   rx_head = (rx_head + 1) % VW_QUEUE;
   rx_count--;
   pthread_mutex_unlock(&mu);
   return (ssize_t)len;
}

/* wait until the frame at the head of the queue has fully arrived, or the timeout passes */
int vwire_ppoll(struct pollfd *fds, unsigned int n, const struct timespec *timeout, const void *sigmask)
{
   int64_t limit = vwire_now() + (timeout ? (int64_t)timeout->tv_sec * 1000000000LL + timeout->tv_nsec : 0);
   unsigned int i;
   (void)sigmask;
   for (;;)
   {
      int64_t ready = -1, now;
      pthread_mutex_lock(&mu);
      if (rx_count) ready = rxq[rx_head].ready;
      pthread_mutex_unlock(&mu);
      now = vwire_now();
      if (ready >= 0 && now >= ready)
      {
         for (i = 0; i < n; i++) fds[i].revents = (short)(i == 0 ? POLLIN : 0);
         return 1;
      }
      if (now >= limit)
      {
         for (i = 0; i < n; i++) fds[i].revents = 0;
         return 0;
      }
   }
}

int vwire_close(int fd)
{
   (void)fd;
   pthread_mutex_lock(&mu);
   if (ftrace) fclose(ftrace);
   if (fpcap) fclose(fpcap);
   ftrace = fpcap = NULL;
   opened = 0;
   pthread_mutex_unlock(&mu);
   return 0;
}
