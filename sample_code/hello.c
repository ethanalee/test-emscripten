#include <stdio.h>
#include <emscripten.h> // note we added the emscripten header

int EMSCRIPTEN_KEEPALIVE fib(int n){
    if(n == 0 || n == 1)
        return 1;
    else
        return fib(n - 1) + fib(n - 2);
}

int main(){
    printf("Hello world!\n");
    int res = fib(5);
    printf("fib(5) = %d\n", res);
    return 0;
}

// add one to the value in the input ptr and write this to the content of the output ptr
void addOne(int* input_ptr, int* output_ptr, int len){
	int i;
	for(i = 0; i < len; i++)
    	output_ptr[i] = input_ptr[i] + 1;
}