/* scan: find the slaves on a line and measure the cable delays between them.
 * Like `ethercat slaves` plus a look at what ecx_configdc() worked out.
 *
 *   build/scan [vwire:chain3]
 */
#include "soem/soem.h"
#include "vwire.h"
#include <stdio.h>
#include <string.h>

static ecx_contextt ctx;

int main(int argc, char **argv)
{
   const char *ifname = argc > 1 ? argv[1] : "vwire:chain3";
   int i;

   if (!ecx_init(&ctx, ifname))
   {
      printf("could not open %s\n", ifname);
      return 1;
   }
   vwire_mark("config_init");
   if (ecx_config_init(&ctx) <= 0)
   {
      printf("no slaves found\n");
      return 1;
   }
   printf("%d slaves on %s\n\n", ctx.slavecount, ifname);
   printf("pos  addr    state  name                  vendor      product     ports  DC\n");
   ecx_readstate(&ctx);
   for (i = 1; i <= ctx.slavecount; i++)
   {
      ec_slavet *s = &ctx.slavelist[i];
      printf("%-4d 0x%04x  0x%02x   %-20s  0x%08x  0x%08x  %d%d     %s\n", i, s->configadr, s->state, s->name,
             (unsigned)s->eep_man, (unsigned)s->eep_id, (s->activeports & 1) != 0, (s->activeports & 2) != 0,
             s->hasdc ? "yes" : "no");
   }

   vwire_mark("configdc");
   ecx_configdc(&ctx);
   printf("\nDistributed clocks (ecx_configdc):\n");
   printf("pos  port0 time   port1 time   port1-port0   pdelay (ns)\n");
   for (i = 1; i <= ctx.slavecount; i++)
   {
      ec_slavet *s = &ctx.slavelist[i];
      if (s->activeports & 2)
         printf("%-4d %11u  %11u   %8d      %6d\n", i, (unsigned)s->DCrtA, (unsigned)s->DCrtB, s->DCrtB - s->DCrtA,
                s->pdelay);
      else
         printf("%-4d %11u  %11s   %8s      %6d\n", i, (unsigned)s->DCrtA, "-", "-", s->pdelay);
   }
   vwire_mark("done");
   ecx_close(&ctx);
   return 0;
}
