/* cycle: bring the line to OP and run cyclic process data, the way a robot controller does.
 *
 *   build/cycle [line] [--dc|--frame] [--sync-master] [--cycle-us N] [--seconds S]
 *
 *   --frame        drives act the moment a frame brings new targets (no distributed clock)
 *   --dc           drives act on SYNC0 from their own synchronised clocks (default)
 *   --sync-master  steer the master's cycle onto the reference clock (as SOEM's ec_sample does)
 *
 * The analog card's channels are printed now and then; everything else goes to the trace
 * (VWIRE_TRACE=file.jsonl): act / sync0 / ctrl events, and "diff" lines with register 0x092C
 * read back over the wire.
 */
#include "soem/soem.h"
#include "vwire.h"
#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static ecx_contextt ctx;
static uint8 iomap[4096];

static void add_ns(ec_timet *ts, int64 ns)
{
   ts->tv_nsec += ns;
   while (ts->tv_nsec >= 1000000000L) { ts->tv_nsec -= 1000000000L; ts->tv_sec++; }
   while (ts->tv_nsec < 0) { ts->tv_nsec += 1000000000L; ts->tv_sec--; }
}

int main(int argc, char **argv)
{
   const char *ifname = "vwire:chain3";
   int use_dc = 1, sync_master = 0, i, expected, wkc;
   int64 cycle_ns = 1000000, toff = 0, integral = 0;
   double seconds = 3.0;
   long n, ncycles;
   ec_timet ts;
   FILE *tr = NULL;

   for (i = 1; i < argc; i++)
   {
      if (!strcmp(argv[i], "--dc")) use_dc = 1;
      else if (!strcmp(argv[i], "--frame")) use_dc = 0;
      else if (!strcmp(argv[i], "--sync-master")) sync_master = 1;
      else if (!strcmp(argv[i], "--cycle-us") && i + 1 < argc) cycle_ns = atol(argv[++i]) * 1000;
      else if (!strcmp(argv[i], "--seconds") && i + 1 < argc) seconds = atof(argv[++i]);
      else ifname = argv[i];
   }
   if (getenv("CYCLE_DIFF_LOG")) tr = fopen(getenv("CYCLE_DIFF_LOG"), "w");

   if (!ecx_init(&ctx, ifname) || ecx_config_init(&ctx) <= 0)
   {
      printf("no slaves on %s\n", ifname);
      return 1;
   }
   vwire_mark("config_map");
   ecx_config_map_group(&ctx, iomap, 0);
   vwire_mark("configdc");
   ecx_configdc(&ctx);
   printf("%d slaves, %d output + %d input bytes, DC %s\n", ctx.slavecount, ctx.grouplist[0].Obytes,
          ctx.grouplist[0].Ibytes, ctx.slavelist[0].hasdc ? "found" : "none");
   for (i = 1; i <= ctx.slavecount; i++)
      printf("  slave %d %-18s  outputs at iomap+%-3d (%d B)  inputs at iomap+%-3d (%d B)  pdelay %d ns\n", i,
             ctx.slavelist[i].name, ctx.slavelist[i].outputs ? (int)(ctx.slavelist[i].outputs - iomap) : -1,
             ctx.slavelist[i].Obytes, ctx.slavelist[i].inputs ? (int)(ctx.slavelist[i].inputs - iomap) : -1,
             ctx.slavelist[i].Ibytes, ctx.slavelist[i].pdelay);

   ecx_statecheck(&ctx, 0, EC_STATE_SAFE_OP, EC_TIMEOUTSTATE * 4);
   if (use_dc)
   {
      vwire_mark("dcsync0");
      for (i = 1; i <= ctx.slavecount; i++) ecx_dcsync0(&ctx, (uint16)i, TRUE, (uint32)cycle_ns, 0);
   }
   expected = ctx.grouplist[0].outputsWKC * 2 + ctx.grouplist[0].inputsWKC;

   /* to OP: keep frames flowing while the slaves switch */
   ecx_send_processdata(&ctx);
   ecx_receive_processdata(&ctx, EC_TIMEOUTRET);
   ctx.slavelist[0].state = EC_STATE_OPERATIONAL;
   ecx_writestate(&ctx, 0);
   for (i = 0; i < 40 && ctx.slavelist[0].state != EC_STATE_OPERATIONAL; i++)
   {
      ecx_send_processdata(&ctx);
      ecx_receive_processdata(&ctx, EC_TIMEOUTRET);
      ecx_statecheck(&ctx, 0, EC_STATE_OPERATIONAL, 50000);
   }
   printf("state: %s, expected WKC %d, mode: %s%s\n",
          ctx.slavelist[0].state == EC_STATE_OPERATIONAL ? "OP" : "not OP", expected,
          use_dc ? "SYNC0 (distributed clock)" : "act on frame", sync_master ? ", master steered to DC" : "");
   vwire_mark(use_dc ? "run_dc" : "run_frame");

   ncycles = (long)(seconds * 1e9 / (double)cycle_ns);
   osal_get_monotonic_time(&ts);
   for (n = 0; n < ncycles; n++)
   {
      double t = (double)n * (double)cycle_ns * 1e-9;
      add_ns(&ts, cycle_ns + toff);
      osal_monotonic_sleep(&ts);

      /* outputs: every joint follows the same 0.5 Hz sine, so they should all be at the same place */
      for (i = 1; i <= ctx.slavecount; i++)
      {
         uint8 *o = ctx.slavelist[i].outputs;
         if (o && ctx.slavelist[i].Obytes >= 6)
         {
            int32 target = (int32)lround(100000.0 * sin(2 * M_PI * 0.5 * t));
            uint16 cw = 0x000F;
            memcpy(o, &cw, 2);
            memcpy(o + 2, &target, 4);
         }
      }
      ecx_send_processdata(&ctx);
      wkc = ecx_receive_processdata(&ctx, EC_TIMEOUTRET);

      if (sync_master && ctx.slavelist[0].hasdc && wkc > 0)
      {
         /* PI on the master's cycle: aim the master's send at 300 us before each SYNC0 */
         int64 delta = (ctx.DCtime - 700000) % cycle_ns, err;
         if (delta > cycle_ns / 2) delta -= cycle_ns;
         err = -delta;
         integral += err;
         toff = (int64)(err * 0.01 + integral * 0.00002);
      }

      if (n % 100 == 0)
      {
         uint8 *in = ctx.slavelist[1].inputs;
         if (n % 500 == 0 && ctx.slavelist[1].Ibytes == 16)
         {
            int16 ch[8];
            memcpy(ch, in, 16);
            printf("cycle %5ld  wkc %d  AI mV: %5d %5d %5d %5d | %d %d %d %d\n", n, wkc, ch[0], ch[1], ch[2],
                   ch[3], ch[4], ch[5], ch[6], ch[7]);
         }
         if (tr && ctx.slavelist[0].hasdc)
         {
            /* read each slave's 0x092C over the wire: how far is its clock from the reference? */
            fprintf(tr, "{\"cycle\":%ld,\"t_s\":%.4f", n, t);
            for (i = 1; i <= ctx.slavecount; i++)
            {
               uint32 d = 0;
               int32 sd;
               ecx_FPRD(&ctx.port, ctx.slavelist[i].configadr, ECT_REG_DCSYSDIFF, 4, &d, EC_TIMEOUTRET);
               sd = (int32)(d & 0x7fffffff);
               if (d & 0x80000000u) sd = -sd;
               fprintf(tr, ",\"s%d\":%d", i, sd);
            }
            fprintf(tr, ",\"toff\":%lld}\n", (long long)toff);
         }
      }
   }
   vwire_mark("stop");
   if (tr) fclose(tr);
   ctx.slavelist[0].state = EC_STATE_INIT;
   ecx_writestate(&ctx, 0);
   ecx_close(&ctx);
   return 0;
}
