/* vwire shim: macOS has no <netpacket/packet.h>. SOEM's Linux nicdrv.c only needs
 * these names to compile; the socket it opens is the virtual wire, not AF_PACKET. */
#ifndef VWIRE_SHIM_PACKET_H
#define VWIRE_SHIM_PACKET_H
#include <stdint.h>
#ifndef AF_PACKET
#define AF_PACKET 17
#endif
#ifndef PF_PACKET
#define PF_PACKET AF_PACKET
#endif
struct sockaddr_ll {
   unsigned short sll_family;
   unsigned short sll_protocol;
   int sll_ifindex;
   unsigned short sll_hatype;
   unsigned char sll_pkttype;
   unsigned char sll_halen;
   unsigned char sll_addr[8];
};
#endif
