/* vwire shim, force-included into SOEM's unmodified oshw/linux/nicdrv.c.
 * Every socket call the driver makes goes to the virtual EtherCAT line instead of a NIC.
 * The interface name picks the line, e.g. "vwire:chain3". */
#ifndef VWIRE_NIC_SHIM_H
#define VWIRE_NIC_SHIM_H
#include <sys/types.h>
#include <sys/socket.h>
#include <sys/ioctl.h>
#include <net/if.h>
#include <unistd.h>
#include <poll.h>
#include <signal.h>
#include "vwire.h"

#ifndef SIOCGIFINDEX
#define SIOCGIFINDEX 0x7f000001UL
#endif
#define ifr_ifindex ifr_ifru.ifru_metric

#define socket(d, t, p)          vwire_socket(d, t, p)
#define setsockopt(s, l, o, v, n) vwire_setsockopt(s, l, o, v, n)
#define ioctl(fd, req, arg)      vwire_ioctl(fd, (unsigned long)(req), (void *)(arg))
#define bind(fd, a, l)           vwire_bind(fd, (const void *)(a), l)
#define send(fd, b, l, f)        vwire_send(fd, b, l, f)
#define recv(fd, b, l, f)        vwire_recv(fd, b, l, f)
#define close(fd)                vwire_close(fd)
#define ppoll(f, n, ts, sig)     vwire_ppoll(f, n, ts, sig)
#endif
