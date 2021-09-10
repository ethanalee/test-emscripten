#include <stdio.h>
#include <emscripten.h>
#include <fcntl.h>
#include <unistd.h>
#include <sys/stat.h>
#include <errno.h>
#include <string.h>

void test() {
  int fd;
  struct stat st;

  fd = open("/idbfs/test.txt", O_RDWR | O_CREAT, 0666);
  write(fd,"hello world",11);
  close(fd);

  fd = open("/idbfs/test.txt", O_RDWR);
  char bf[100];
  int bytes_read = read(fd,&bf[0],sizeof(bf));
  printf("Returned: %s\n", bf);

}

int main() {

  EM_ASM(
    FS.mkdir('/idbfs');
    FS.mount(IDBFS, {}, '/idbfs');

    FS.syncfs(true, function (err) {
        ccall('test', 'v');
      });
  );

  return 0;
}