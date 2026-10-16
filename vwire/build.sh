#!/bin/sh
# Build SOEM (pinned submodule ../soem, compiled unmodified) against the virtual line, plus the apps.
# Output: build/<app>. Run from anywhere.
set -e
HERE=$(cd "$(dirname "$0")" && pwd)
SOEM="$HERE/../soem"
B="$HERE/build"
mkdir -p "$B/include/soem" "$B/obj"

# ec_options.h from SOEM's template with SOEM's own CMake defaults
sed -e 's/@EC_BUFSIZE@/EC_MAXECATFRAME/' -e 's/@EC_MAXBUF@/16/' -e 's/@EC_MAXEEPBITMAP@/128/' \
    -e 's/@EC_MAXEEPBUF@/EC_MAXEEPBITMAP << 5/' -e 's/@EC_LOGGROUPOFFSET@/16/' -e 's/@EC_MAXELIST@/64/' \
    -e 's/@EC_MAXNAME@/40/' -e 's/@EC_MAXSLAVE@/200/' -e 's/@EC_MAXGROUP@/2/' -e 's/@EC_MAXIOSEGMENTS@/64/' \
    -e 's/@EC_MAXMBX@/1486/' -e 's/@EC_MBXPOOLSIZE@/32/' -e 's/@EC_MAXEEPDO@/0x200/' -e 's/@EC_MAXSM@/8/' \
    -e 's/@EC_MAXFMMU@/4/' -e 's/@EC_MAXLEN_ADAPTERNAME@/128/' -e 's/@EC_MAX_MAPT@/1/' -e 's/@EC_MAXODLIST@/1024/' \
    -e 's/@EC_MAXOELIST@/256/' -e 's/@EC_SOE_MAXNAME@/60/' -e 's/@EC_SOE_MAXMAPPING@/64/' \
    -e 's/@EC_TIMEOUTRET@/2000/' -e 's/@EC_TIMEOUTRET3@/EC_TIMEOUTRET * 3/' -e 's/@EC_TIMEOUTSAFE@/20000/' \
    -e 's/@EC_TIMEOUTEEP@/20000/' -e 's/@EC_TIMEOUTTXM@/20000/' -e 's/@EC_TIMEOUTRXM@/700000/' \
    -e 's/@EC_TIMEOUTSTATE@/2000000/' -e 's/@EC_DEFAULTRETRIES@/3/' \
    -e 's/@EC_PRIMARY_MAC_ARRAY@/{0x0101, 0x0101, 0x0101}/' -e 's/@EC_SECONDARY_MAC_ARRAY@/{0x0404, 0x0404, 0x0404}/' \
    "$SOEM/include/soem/ec_options.h.in" > "$B/include/soem/ec_options.h"

CC=${CC:-cc}
CFLAGS="-O2 -g -Wall -Wno-unused-parameter -Wno-deprecated-declarations"
INC="-I$B/include -I$SOEM/include -I$SOEM/osal -I$SOEM/osal/linux -I$SOEM/oshw/linux -I$HERE/src"
OBJS=""
for f in ec_base ec_coe ec_config ec_dc ec_eoe ec_foe ec_main ec_print ec_soe; do
  $CC $CFLAGS $INC -c "$SOEM/src/$f.c" -o "$B/obj/$f.o"; OBJS="$OBJS $B/obj/$f.o"
done
$CC $CFLAGS $INC -include "$HERE/shim/osal_mac_shim.h" -c "$SOEM/osal/linux/osal.c" -o "$B/obj/osal.o"
$CC $CFLAGS $INC -c "$SOEM/oshw/linux/oshw.c" -o "$B/obj/oshw.o"
$CC $CFLAGS $INC -I"$HERE/shim" -include "$HERE/shim/vwire_nic_shim.h" -c "$SOEM/oshw/linux/nicdrv.c" -o "$B/obj/nicdrv.o"
$CC $CFLAGS $INC -c "$HERE/src/vwire.c" -o "$B/obj/vwire.o"
OBJS="$OBJS $B/obj/osal.o $B/obj/oshw.o $B/obj/nicdrv.o $B/obj/vwire.o"

for app in "$HERE"/apps/*.c; do
  name=$(basename "$app" .c)
  $CC $CFLAGS $INC "$app" $OBJS -lpthread -lm -o "$B/$name"
done
echo "built: $(ls "$B" | grep -v -e obj -e include | tr '\n' ' ')"
