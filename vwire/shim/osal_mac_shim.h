/* vwire shim, force-included into SOEM's unmodified osal/linux/osal.c.
 * macOS has no clock_nanosleep(); this gives osal.c the two forms it uses. */
#ifndef VWIRE_OSAL_MAC_SHIM_H
#define VWIRE_OSAL_MAC_SHIM_H
#include <time.h>
#include <errno.h>
#ifndef TIMER_ABSTIME
#define TIMER_ABSTIME 1
#endif
static inline int vwire_clock_nanosleep(clockid_t clk, int flags, const struct timespec *req,
                                        struct timespec *rem)
{
   struct timespec now, d;
   (void)rem;
   if (flags & TIMER_ABSTIME)
   {
      clock_gettime(clk, &now);
      d.tv_sec = req->tv_sec - now.tv_sec;
      d.tv_nsec = req->tv_nsec - now.tv_nsec;
      if (d.tv_nsec < 0)
      {
         d.tv_nsec += 1000000000L;
         d.tv_sec--;
      }
      if (d.tv_sec < 0) return 0;
   }
   else
   {
      d = *req;
   }
   while (nanosleep(&d, &d) != 0 && errno == EINTR)
      ;
   return 0;
}
#define clock_nanosleep(c, f, r, m) vwire_clock_nanosleep(c, f, r, m)
#endif
