/* vwire: a virtual EtherCAT line for teaching.
 *
 * The master side is real SOEM code. Its Linux NIC driver is compiled unchanged; its socket
 * calls land here instead of on a network card. Here a chain of simulated EtherCAT slave
 * controllers (ESCs) processes each frame the way the hardware does: on the fly, port 0 ->
 * processing unit -> port 1 on the way out, port 1 -> port 0 untouched on the way back.
 *
 * What is modelled (and so labelled in the course): wire and forwarding delays, each slave's
 * crystal error, the ESC's time control loop, the slave applications (an analog input card
 * and two joint drives). What is real: every byte the master sends and every decision SOEM
 * makes about them.
 */
#ifndef VWIRE_H
#define VWIRE_H

#include <stddef.h>
#include <stdint.h>
#include <sys/types.h>

int vwire_socket(int domain, int type, int protocol);
int vwire_setsockopt(int s, int level, int opt, const void *val, unsigned int len);
int vwire_ioctl(int fd, unsigned long req, void *arg);
int vwire_bind(int fd, const void *addr, unsigned int len);
ssize_t vwire_send(int fd, const void *buf, size_t len, int flags);
ssize_t vwire_recv(int fd, void *buf, size_t len, int flags);
int vwire_close(int fd);
struct pollfd;
struct timespec;
int vwire_ppoll(struct pollfd *fds, unsigned int n, const struct timespec *timeout, const void *sigmask);

/* ---- for the teaching apps: look behind the curtain (never used by SOEM) ---- */

/* true time of the virtual world, ns (the host's monotonic clock) */
int64_t vwire_now(void);
/* number of slaves on the line opened last */
int vwire_slave_count(void);
/* a slave's system time at true time t (what its register 0x0910 would read) */
int64_t vwire_systime(int slave, int64_t t);
/* write a note into the trace (apps mark phases: "configdc", "op", ...) */
void vwire_mark(const char *what);
/* flush trace and pcap */
void vwire_flush(void);

#endif
