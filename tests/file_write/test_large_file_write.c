#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include <emscripten.h>

#define MAX_BUFF_SZ 32

int get_filesize(char *filename) {
    FILE *f = fopen(filename, "r");
    fseek(f, 0L, SEEK_END);
    int size = ftell(f);
    fclose(f);

    return size;
}

int main() {
    char str[] = "test";

    EM_ASM(
        console.time("Func #1")
    );

    FILE *file;
    // Append content
    file = fopen("random-text.txt", "a");

    for (int i = 0; i < 100; i++) {
        fwrite(str , 1 , sizeof(str) , file );
    }

    fclose(file);

    file = fopen("random-text.txt", "rb");
    if (!file) {
        printf("cannot open file\n");
        return 1;
    }

    while (!feof(file)) {
        char c = fgetc(file);
        if (c != EOF) {
        putchar(c);

        }
    }
    putchar('\n');
    fclose (file);

    EM_ASM(
        console.timeEnd("Func #1")
    );
}