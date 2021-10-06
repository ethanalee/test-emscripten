/*
 * Copyright 2021 The Emscripten Authors.  All rights reserved.
 * Emscripten is available under two separate licenses, the MIT license and the
 * University of Illinois/NCSA Open Source License.  Both these licenses can be
 * found in the LICENSE file.
 */

#include <assert.h>
#include <errno.h>
#include <fcntl.h>
#include <stdio.h>
#include <unistd.h>

int main() {
  int f = 1;

  printf("DUP\n");
  int f2 = dup(f);

  // Print to stdout and print to fd = 3
  printf("%i\n", f2);
  // assert(f2 == 3);
  dprintf(f, "STDOUT\n");
  dprintf(f2, "CAN PRINT TO STDOUT WITH fd = 3\n");

  printf("DUP2\n");
  int f3 = 5;
  int f4 = dup2(f, f3);

  // Print to stdout and print to fd = 4
  assert(f3 == 5);
  assert(f4 == 5);
  dprintf(f, "STDOUT\n");
  dprintf(f3, "CAN PRINT TO STDOUT WITH fd = 5\n");
  dprintf(f4, "CAN PRINT TO STDOUT WITH fd = 5\n");

  // Try printing to a non-existent fd
  //   dprintf(10, "FD DOES NOT EXIST\n");
  //   assert(errno == EBADF);

  // Try setting newfd == oldfd
  int f5 = dup2(f4, 5);
  assert(f5 == 5);
  dprintf(f5, "CAN PRINT TO STDOUT WITH fd = 5\n");

  // Try calling dup2 with an invalid oldfd
  int f6 = dup2(-1, f5);
  //   assert(errno == EBADF);

  //   Try assigning a large fd
  int f7 = 4069;
  int f8 = dup2(f4, f7);

  dprintf(f8, "CAN PRINT TO STDOUT WITH f8 = 4069\n");

  int f9 = dup(-1);
  //   assert(errno == EBADF);

  return 0;
}
