## Test Repository for Testing/Benchmarking



#### File Structure
```
.
├── tests                   # Test Programs
│   ├── file_read           # Test sequential file reads
│   ├── file_write          # Test sequential file writes
│   ├── test_file_access    # FS.trackingDelegate code
│   └── idbfs               # Test using idbfs
├── sample_code             # Code from tutorials
│   └── hello_world.c       # Tutorial file reading code
└── ...
```

### Running Test Programs

#### General Programs
`emcc test_file_access.c -o test_file_access.js -s WASM=1 -s EXPORTED_RUNTIME_METHODS='["print"]'`

#### Using Preloading for Files
`emcc test_large_file_write.c -o test_large_file_write.html --preload-file random-text.txt`

### Force Filesystem
`emcc idbfs.c -o idbfs.html -s -lidbfs.js -s FORCE_FILESYSTEM=1 -s EXPORTED_FUNCTIONS='["_main","_test"]' -s EXPORTED_RUNTIME_METHODS='["ccall"]'`

### Sources
Intro to Wasm: https://marcoselvatici.github.io/WASM_tutorial/#your_first_WASM_WebApp