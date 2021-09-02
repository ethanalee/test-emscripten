#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include <emscripten.h>

#define MAX_BUFF_SZ 32

int main() {
    int total_bytes = 0;
    int bytes_read;
    char *buffer;

    EM_ASM(
        console.time("Func #1")
    );

    FILE *file;
    file = fopen("random-text.txt", "w");

    while ((bytes_read = fread(buffer, 1, MAX_BUFF_SZ, file)) > 0) {
        total_bytes += bytes_read;

        memset(buffer, 0, MAX_BUFF_SZ);
    }

    fclose(file);

    EM_ASM(
        console.timeEnd("Func #1")
    );
}