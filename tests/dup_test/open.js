

// The Module object: Our interface to the outside world. We import
// and export values on it. There are various ways Module can be used:
// 1. Not defined. We create it here
// 2. A function parameter, function(Module) { ..generated code.. }
// 3. pre-run appended it, var Module = {}; ..generated code..
// 4. External script tag defines var Module.
// We need to check if Module already exists (e.g. case 3 above).
// Substitution will be replaced with actual code on later stage of the build,
// this way Closure Compiler will not mangle it (e.g. case 4. above).
// Note that if you want to run closure, and also to use Module
// after the generated code, you will need to define   var Module = {};
// before the code. Then that object will be used in the code, and you
// can continue to use Module afterwards as well.
var Module = typeof Module !== 'undefined' ? Module : {};

// --pre-jses are emitted after the Module integration code, so that they can
// refer to Module (if they choose; they can also define Module)
// {{PRE_JSES}}

// Sometimes an existing Module object exists with properties
// meant to overwrite the default module functionality. Here
// we collect those properties and reapply _after_ we configure
// the current environment's defaults to avoid having to be so
// defensive during initialization.
var moduleOverrides = {};
var key;
for (key in Module) {
  if (Module.hasOwnProperty(key)) {
    moduleOverrides[key] = Module[key];
  }
}

var arguments_ = [];
var thisProgram = './this.program';
var quit_ = function(status, toThrow) {
  throw toThrow;
};

// Determine the runtime environment we are in. You can customize this by
// setting the ENVIRONMENT setting at compile time (see settings.js).

// Attempt to auto-detect the environment
var ENVIRONMENT_IS_WEB = typeof window === 'object';
var ENVIRONMENT_IS_WORKER = typeof importScripts === 'function';
// N.b. Electron.js environment is simultaneously a NODE-environment, but
// also a web environment.
var ENVIRONMENT_IS_NODE = typeof process === 'object' && typeof process.versions === 'object' && typeof process.versions.node === 'string';
var ENVIRONMENT_IS_SHELL = !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER;

if (Module['ENVIRONMENT']) {
  throw new Error('Module.ENVIRONMENT has been deprecated. To force the environment, use the ENVIRONMENT compile-time option (for example, -s ENVIRONMENT=web or -s ENVIRONMENT=node)');
}

// `/` should be present at the end if `scriptDirectory` is not empty
var scriptDirectory = '';
function locateFile(path) {
  if (Module['locateFile']) {
    return Module['locateFile'](path, scriptDirectory);
  }
  return scriptDirectory + path;
}

// Hooks that are implemented differently in different runtime environments.
var read_,
    readAsync,
    readBinary,
    setWindowTitle;

// Normally we don't log exceptions but instead let them bubble out the top
// level where the embedding environment (e.g. the browser) can handle
// them.
// However under v8 and node we sometimes exit the process direcly in which case
// its up to use us to log the exception before exiting.
// If we fix https://github.com/emscripten-core/emscripten/issues/15080
// this may no longer be needed under node.
function logExceptionOnExit(e) {
  if (e instanceof ExitStatus) return;
  var toLog = e;
  if (e && typeof e === 'object' && e.stack) {
    toLog = [e, e.stack];
  }
  err('exiting due to exception: ' + toLog);
}

var nodeFS;
var nodePath;

if (ENVIRONMENT_IS_NODE) {
  if (!(typeof process === 'object' && typeof require === 'function')) throw new Error('not compiled for this environment (did you build to HTML and try to run it not on the web, or set ENVIRONMENT to something - like node - and run it someplace else - like on the web?)');
  if (ENVIRONMENT_IS_WORKER) {
    scriptDirectory = require('path').dirname(scriptDirectory) + '/';
  } else {
    scriptDirectory = __dirname + '/';
  }

// include: node_shell_read.js


read_ = function shell_read(filename, binary) {
  var ret = tryParseAsDataURI(filename);
  if (ret) {
    return binary ? ret : ret.toString();
  }
  if (!nodeFS) nodeFS = require('fs');
  if (!nodePath) nodePath = require('path');
  filename = nodePath['normalize'](filename);
  return nodeFS['readFileSync'](filename, binary ? null : 'utf8');
};

readBinary = function readBinary(filename) {
  var ret = read_(filename, true);
  if (!ret.buffer) {
    ret = new Uint8Array(ret);
  }
  assert(ret.buffer);
  return ret;
};

readAsync = function readAsync(filename, onload, onerror) {
  var ret = tryParseAsDataURI(filename);
  if (ret) {
    onload(ret);
  }
  if (!nodeFS) nodeFS = require('fs');
  if (!nodePath) nodePath = require('path');
  filename = nodePath['normalize'](filename);
  nodeFS['readFile'](filename, function(err, data) {
    if (err) onerror(err);
    else onload(data.buffer);
  });
};

// end include: node_shell_read.js
  if (process['argv'].length > 1) {
    thisProgram = process['argv'][1].replace(/\\/g, '/');
  }

  arguments_ = process['argv'].slice(2);

  if (typeof module !== 'undefined') {
    module['exports'] = Module;
  }

  process['on']('uncaughtException', function(ex) {
    // suppress ExitStatus exceptions from showing an error
    if (!(ex instanceof ExitStatus)) {
      throw ex;
    }
  });

  // Without this older versions of node (< v15) will log unhandled rejections
  // but return 0, which is not normally the desired behaviour.  This is
  // not be needed with node v15 and about because it is now the default
  // behaviour:
  // See https://nodejs.org/api/cli.html#cli_unhandled_rejections_mode
  process['on']('unhandledRejection', function(reason) { throw reason; });

  quit_ = function(status, toThrow) {
    if (keepRuntimeAlive()) {
      process['exitCode'] = status;
      throw toThrow;
    }
    logExceptionOnExit(toThrow);
    process['exit'](status);
  };

  Module['inspect'] = function () { return '[Emscripten Module object]'; };

} else
if (ENVIRONMENT_IS_SHELL) {

  if ((typeof process === 'object' && typeof require === 'function') || typeof window === 'object' || typeof importScripts === 'function') throw new Error('not compiled for this environment (did you build to HTML and try to run it not on the web, or set ENVIRONMENT to something - like node - and run it someplace else - like on the web?)');

  if (typeof read != 'undefined') {
    read_ = function shell_read(f) {
      var data = tryParseAsDataURI(f);
      if (data) {
        return intArrayToString(data);
      }
      return read(f);
    };
  }

  readBinary = function readBinary(f) {
    var data;
    data = tryParseAsDataURI(f);
    if (data) {
      return data;
    }
    if (typeof readbuffer === 'function') {
      return new Uint8Array(readbuffer(f));
    }
    data = read(f, 'binary');
    assert(typeof data === 'object');
    return data;
  };

  readAsync = function readAsync(f, onload, onerror) {
    setTimeout(function() { onload(readBinary(f)); }, 0);
  };

  if (typeof scriptArgs != 'undefined') {
    arguments_ = scriptArgs;
  } else if (typeof arguments != 'undefined') {
    arguments_ = arguments;
  }

  if (typeof quit === 'function') {
    quit_ = function(status, toThrow) {
      logExceptionOnExit(toThrow);
      quit(status);
    };
  }

  if (typeof print !== 'undefined') {
    // Prefer to use print/printErr where they exist, as they usually work better.
    if (typeof console === 'undefined') console = /** @type{!Console} */({});
    console.log = /** @type{!function(this:Console, ...*): undefined} */ (print);
    console.warn = console.error = /** @type{!function(this:Console, ...*): undefined} */ (typeof printErr !== 'undefined' ? printErr : print);
  }

} else

// Note that this includes Node.js workers when relevant (pthreads is enabled).
// Node.js workers are detected as a combination of ENVIRONMENT_IS_WORKER and
// ENVIRONMENT_IS_NODE.
if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
  if (ENVIRONMENT_IS_WORKER) { // Check worker, not web, since window could be polyfilled
    scriptDirectory = self.location.href;
  } else if (typeof document !== 'undefined' && document.currentScript) { // web
    scriptDirectory = document.currentScript.src;
  }
  // blob urls look like blob:http://site.com/etc/etc and we cannot infer anything from them.
  // otherwise, slice off the final part of the url to find the script directory.
  // if scriptDirectory does not contain a slash, lastIndexOf will return -1,
  // and scriptDirectory will correctly be replaced with an empty string.
  // If scriptDirectory contains a query (starting with ?) or a fragment (starting with #),
  // they are removed because they could contain a slash.
  if (scriptDirectory.indexOf('blob:') !== 0) {
    scriptDirectory = scriptDirectory.substr(0, scriptDirectory.replace(/[?#].*/, "").lastIndexOf('/')+1);
  } else {
    scriptDirectory = '';
  }

  if (!(typeof window === 'object' || typeof importScripts === 'function')) throw new Error('not compiled for this environment (did you build to HTML and try to run it not on the web, or set ENVIRONMENT to something - like node - and run it someplace else - like on the web?)');

  // Differentiate the Web Worker from the Node Worker case, as reading must
  // be done differently.
  {

// include: web_or_worker_shell_read.js


  read_ = function(url) {
    try {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', url, false);
      xhr.send(null);
      return xhr.responseText;
    } catch (err) {
      var data = tryParseAsDataURI(url);
      if (data) {
        return intArrayToString(data);
      }
      throw err;
    }
  };

  if (ENVIRONMENT_IS_WORKER) {
    readBinary = function(url) {
      try {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, false);
        xhr.responseType = 'arraybuffer';
        xhr.send(null);
        return new Uint8Array(/** @type{!ArrayBuffer} */(xhr.response));
      } catch (err) {
        var data = tryParseAsDataURI(url);
        if (data) {
          return data;
        }
        throw err;
      }
    };
  }

  readAsync = function(url, onload, onerror) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'arraybuffer';
    xhr.onload = function() {
      if (xhr.status == 200 || (xhr.status == 0 && xhr.response)) { // file URLs can return 0
        onload(xhr.response);
        return;
      }
      var data = tryParseAsDataURI(url);
      if (data) {
        onload(data.buffer);
        return;
      }
      onerror();
    };
    xhr.onerror = onerror;
    xhr.send(null);
  };

// end include: web_or_worker_shell_read.js
  }

  setWindowTitle = function(title) { document.title = title };
} else
{
  throw new Error('environment detection error');
}

// Set up the out() and err() hooks, which are how we can print to stdout or
// stderr, respectively.
var out = Module['print'] || console.log.bind(console);
var err = Module['printErr'] || console.warn.bind(console);

// Merge back in the overrides
for (key in moduleOverrides) {
  if (moduleOverrides.hasOwnProperty(key)) {
    Module[key] = moduleOverrides[key];
  }
}
// Free the object hierarchy contained in the overrides, this lets the GC
// reclaim data used e.g. in memoryInitializerRequest, which is a large typed array.
moduleOverrides = null;

// Emit code to handle expected values on the Module object. This applies Module.x
// to the proper local x. This has two benefits: first, we only emit it if it is
// expected to arrive, and second, by using a local everywhere else that can be
// minified.

if (Module['arguments']) arguments_ = Module['arguments'];
if (!Object.getOwnPropertyDescriptor(Module, 'arguments')) {
  Object.defineProperty(Module, 'arguments', {
    configurable: true,
    get: function() {
      abort('Module.arguments has been replaced with plain arguments_ (the initial value can be provided on Module, but after startup the value is only looked for on a local variable of that name)')
    }
  });
}

if (Module['thisProgram']) thisProgram = Module['thisProgram'];
if (!Object.getOwnPropertyDescriptor(Module, 'thisProgram')) {
  Object.defineProperty(Module, 'thisProgram', {
    configurable: true,
    get: function() {
      abort('Module.thisProgram has been replaced with plain thisProgram (the initial value can be provided on Module, but after startup the value is only looked for on a local variable of that name)')
    }
  });
}

if (Module['quit']) quit_ = Module['quit'];
if (!Object.getOwnPropertyDescriptor(Module, 'quit')) {
  Object.defineProperty(Module, 'quit', {
    configurable: true,
    get: function() {
      abort('Module.quit has been replaced with plain quit_ (the initial value can be provided on Module, but after startup the value is only looked for on a local variable of that name)')
    }
  });
}

// perform assertions in shell.js after we set up out() and err(), as otherwise if an assertion fails it cannot print the message
// Assertions on removed incoming Module JS APIs.
assert(typeof Module['memoryInitializerPrefixURL'] === 'undefined', 'Module.memoryInitializerPrefixURL option was removed, use Module.locateFile instead');
assert(typeof Module['pthreadMainPrefixURL'] === 'undefined', 'Module.pthreadMainPrefixURL option was removed, use Module.locateFile instead');
assert(typeof Module['cdInitializerPrefixURL'] === 'undefined', 'Module.cdInitializerPrefixURL option was removed, use Module.locateFile instead');
assert(typeof Module['filePackagePrefixURL'] === 'undefined', 'Module.filePackagePrefixURL option was removed, use Module.locateFile instead');
assert(typeof Module['read'] === 'undefined', 'Module.read option was removed (modify read_ in JS)');
assert(typeof Module['readAsync'] === 'undefined', 'Module.readAsync option was removed (modify readAsync in JS)');
assert(typeof Module['readBinary'] === 'undefined', 'Module.readBinary option was removed (modify readBinary in JS)');
assert(typeof Module['setWindowTitle'] === 'undefined', 'Module.setWindowTitle option was removed (modify setWindowTitle in JS)');
assert(typeof Module['TOTAL_MEMORY'] === 'undefined', 'Module.TOTAL_MEMORY has been renamed Module.INITIAL_MEMORY');

if (!Object.getOwnPropertyDescriptor(Module, 'read')) {
  Object.defineProperty(Module, 'read', {
    configurable: true,
    get: function() {
      abort('Module.read has been replaced with plain read_ (the initial value can be provided on Module, but after startup the value is only looked for on a local variable of that name)')
    }
  });
}

if (!Object.getOwnPropertyDescriptor(Module, 'readAsync')) {
  Object.defineProperty(Module, 'readAsync', {
    configurable: true,
    get: function() {
      abort('Module.readAsync has been replaced with plain readAsync (the initial value can be provided on Module, but after startup the value is only looked for on a local variable of that name)')
    }
  });
}

if (!Object.getOwnPropertyDescriptor(Module, 'readBinary')) {
  Object.defineProperty(Module, 'readBinary', {
    configurable: true,
    get: function() {
      abort('Module.readBinary has been replaced with plain readBinary (the initial value can be provided on Module, but after startup the value is only looked for on a local variable of that name)')
    }
  });
}

if (!Object.getOwnPropertyDescriptor(Module, 'setWindowTitle')) {
  Object.defineProperty(Module, 'setWindowTitle', {
    configurable: true,
    get: function() {
      abort('Module.setWindowTitle has been replaced with plain setWindowTitle (the initial value can be provided on Module, but after startup the value is only looked for on a local variable of that name)')
    }
  });
}
var IDBFS = 'IDBFS is no longer included by default; build with -lidbfs.js';
var PROXYFS = 'PROXYFS is no longer included by default; build with -lproxyfs.js';
var WORKERFS = 'WORKERFS is no longer included by default; build with -lworkerfs.js';
var NODEFS = 'NODEFS is no longer included by default; build with -lnodefs.js';
function alignMemory() { abort('`alignMemory` is now a library function and not included by default; add it to your library.js __deps or to DEFAULT_LIBRARY_FUNCS_TO_INCLUDE on the command line'); }

assert(!ENVIRONMENT_IS_SHELL, "shell environment detected but not enabled at build time.  Add 'shell' to `-s ENVIRONMENT` to enable.");




var STACK_ALIGN = 16;

function getNativeTypeSize(type) {
  switch (type) {
    case 'i1': case 'i8': return 1;
    case 'i16': return 2;
    case 'i32': return 4;
    case 'i64': return 8;
    case 'float': return 4;
    case 'double': return 8;
    default: {
      if (type[type.length-1] === '*') {
        return 4; // A pointer
      } else if (type[0] === 'i') {
        var bits = Number(type.substr(1));
        assert(bits % 8 === 0, 'getNativeTypeSize invalid bits ' + bits + ', type ' + type);
        return bits / 8;
      } else {
        return 0;
      }
    }
  }
}

function warnOnce(text) {
  if (!warnOnce.shown) warnOnce.shown = {};
  if (!warnOnce.shown[text]) {
    warnOnce.shown[text] = 1;
    err(text);
  }
}

// include: runtime_functions.js


// Wraps a JS function as a wasm function with a given signature.
function convertJsFunctionToWasm(func, sig) {
  return func;
}

var freeTableIndexes = [];

// Weak map of functions in the table to their indexes, created on first use.
var functionsInTableMap;

function getEmptyTableSlot() {
  // Reuse a free index if there is one, otherwise grow.
  if (freeTableIndexes.length) {
    return freeTableIndexes.pop();
  }
  // Grow the table
  try {
    wasmTable.grow(1);
  } catch (err) {
    if (!(err instanceof RangeError)) {
      throw err;
    }
    throw 'Unable to grow wasm table. Set ALLOW_TABLE_GROWTH.';
  }
  return wasmTable.length - 1;
}

// Add a wasm function to the table.
function addFunctionWasm(func, sig) {
  // Check if the function is already in the table, to ensure each function
  // gets a unique index. First, create the map if this is the first use.
  if (!functionsInTableMap) {
    functionsInTableMap = new WeakMap();
    for (var i = 0; i < wasmTable.length; i++) {
      var item = wasmTable.get(i);
      // Ignore null values.
      if (item) {
        functionsInTableMap.set(item, i);
      }
    }
  }
  if (functionsInTableMap.has(func)) {
    return functionsInTableMap.get(func);
  }

  // It's not in the table, add it now.

  var ret = getEmptyTableSlot();

  // Set the new value.
  try {
    // Attempting to call this with JS function will cause of table.set() to fail
    wasmTable.set(ret, func);
  } catch (err) {
    if (!(err instanceof TypeError)) {
      throw err;
    }
    assert(typeof sig !== 'undefined', 'Missing signature argument to addFunction: ' + func);
    var wrapped = convertJsFunctionToWasm(func, sig);
    wasmTable.set(ret, wrapped);
  }

  functionsInTableMap.set(func, ret);

  return ret;
}

function removeFunction(index) {
  functionsInTableMap.delete(wasmTable.get(index));
  freeTableIndexes.push(index);
}

// 'sig' parameter is required for the llvm backend but only when func is not
// already a WebAssembly function.
function addFunction(func, sig) {
  assert(typeof func !== 'undefined');

  return addFunctionWasm(func, sig);
}

// end include: runtime_functions.js
// include: runtime_debug.js


// end include: runtime_debug.js
var tempRet0 = 0;

var setTempRet0 = function(value) {
  tempRet0 = value;
};

var getTempRet0 = function() {
  return tempRet0;
};



// === Preamble library stuff ===

// Documentation for the public APIs defined in this file must be updated in:
//    site/source/docs/api_reference/preamble.js.rst
// A prebuilt local version of the documentation is available at:
//    site/build/text/docs/api_reference/preamble.js.txt
// You can also build docs locally as HTML or other formats in site/
// An online HTML version (which may be of a different version of Emscripten)
//    is up at http://kripken.github.io/emscripten-site/docs/api_reference/preamble.js.html

var wasmBinary;
if (Module['wasmBinary']) wasmBinary = Module['wasmBinary'];
if (!Object.getOwnPropertyDescriptor(Module, 'wasmBinary')) {
  Object.defineProperty(Module, 'wasmBinary', {
    configurable: true,
    get: function() {
      abort('Module.wasmBinary has been replaced with plain wasmBinary (the initial value can be provided on Module, but after startup the value is only looked for on a local variable of that name)')
    }
  });
}
var noExitRuntime = Module['noExitRuntime'] || true;
if (!Object.getOwnPropertyDescriptor(Module, 'noExitRuntime')) {
  Object.defineProperty(Module, 'noExitRuntime', {
    configurable: true,
    get: function() {
      abort('Module.noExitRuntime has been replaced with plain noExitRuntime (the initial value can be provided on Module, but after startup the value is only looked for on a local variable of that name)')
    }
  });
}

// include: wasm2js.js


// wasm2js.js - enough of a polyfill for the WebAssembly object so that we can load
// wasm2js code that way.

// Emit "var WebAssembly" if definitely using wasm2js. Otherwise, in MAYBE_WASM2JS
// mode, we can't use a "var" since it would prevent normal wasm from working.
/** @suppress{duplicate, const} */
var
WebAssembly = {
  // Note that we do not use closure quoting (this['buffer'], etc.) on these
  // functions, as they are just meant for internal use. In other words, this is
  // not a fully general polyfill.
  Memory: function(opts) {
    this.buffer = new ArrayBuffer(opts['initial'] * 65536);
  },

  Module: function(binary) {
    // TODO: use the binary and info somehow - right now the wasm2js output is embedded in
    // the main JS
  },

  Instance: function(module, info) {
    // TODO: use the module and info somehow - right now the wasm2js output is embedded in
    // the main JS
    // This will be replaced by the actual wasm2js code.
    this.exports = (
function instantiate(asmLibraryArg) {
function Table(ret) {
  // grow method not included; table is not growable
  ret.set = function(i, func) {
    this[i] = func;
  };
  ret.get = function(i) {
    return this[i];
  };
  return ret;
}

  var bufferView;
  var base64ReverseLookup = new Uint8Array(123/*'z'+1*/);
  for (var i = 25; i >= 0; --i) {
    base64ReverseLookup[48+i] = 52+i; // '0-9'
    base64ReverseLookup[65+i] = i; // 'A-Z'
    base64ReverseLookup[97+i] = 26+i; // 'a-z'
  }
  base64ReverseLookup[43] = 62; // '+'
  base64ReverseLookup[47] = 63; // '/'
  /** @noinline Inlining this function would mean expanding the base64 string 4x times in the source code, which Closure seems to be happy to do. */
  function base64DecodeToExistingUint8Array(uint8Array, offset, b64) {
    var b1, b2, i = 0, j = offset, bLength = b64.length, end = offset + (bLength*3>>2) - (b64[bLength-2] == '=') - (b64[bLength-1] == '=');
    for (; i < bLength; i += 4) {
      b1 = base64ReverseLookup[b64.charCodeAt(i+1)];
      b2 = base64ReverseLookup[b64.charCodeAt(i+2)];
      uint8Array[j++] = base64ReverseLookup[b64.charCodeAt(i)] << 2 | b1 >> 4;
      if (j < end) uint8Array[j++] = b1 << 4 | b2 >> 2;
      if (j < end) uint8Array[j++] = b2 << 6 | base64ReverseLookup[b64.charCodeAt(i+3)];
    }
  }
function initActiveSegments(imports) {
  base64DecodeToExistingUint8Array(bufferView, 1024, "dW5pcXVlX2xvY2s6OmxvY2s6IHJlZmVyZW5jZXMgbnVsbCBtdXRleAB2ZWN0b3IAc3RkOjpleGNlcHRpb24AX19jeGFfZ3VhcmRfYWNxdWlyZSBkZXRlY3RlZCByZWN1cnNpdmUgaW5pdGlhbGl6YXRpb24AYmFzaWNfc3RyaW5nAGFsbG9jYXRvcjxUPjo6YWxsb2NhdGUoc2l6ZV90IG4pICduJyBleGNlZWRzIG1heGltdW0gc3VwcG9ydGVkIHNpemUAbXV0ZXggbG9jayBmYWlsZWQAdW5pcXVlX2xvY2s6OmxvY2s6IGFscmVhZHkgbG9ja2VkAGRldi9zdGRpbi8AU3Rkb3V0RmlsZTo6cmVhZCgpIGhhcyBub3QgYmVlbiBpbXBsZW1lbnRlZCB5ZXQuAFN0ZGVyckZpbGU6OnJlYWQoKSBoYXMgbm90IGJlZW4gaW1wbGVtZW50ZWQgeWV0LgBTdGRpbkZpbGU6OnJlYWQoKSBoYXMgbm90IGJlZW4gaW1wbGVtZW50ZWQgeWV0LgBQdXJlIHZpcnR1YWwgZnVuY3Rpb24gY2FsbGVkIQAAAAAAAAAA7AUAAAYAAAAHAAAACAAAAAkAAAA5U3RkaW5GaWxlADRGaWxlAAAAALwJAADbBQAA5AkAANAFAADkBQAAAAAAACAGAAAKAAAACwAAAAwAAAANAAAAMTBTdGRvdXRGaWxlAAAAAOQJAAAQBgAA5AUAAAAAAABUBgAADgAAAA8AAAAQAAAAEQAAADEwU3RkZXJyRmlsZQAAAADkCQAARAYAAOQFAAAAAAAA5AUAABIAAAASAAAAEwAAABQAAAAAAAAA3AYAABcAAAAYAAAAGQAAABoAAAAbAAAATlN0M19fMjIwX19zaGFyZWRfcHRyX2VtcGxhY2VJMThPcGVuRmlsZURlc2NyaXB0b3JOU185YWxsb2NhdG9ySVMxX0VFRUUA5AkAAJQGAACUCAAAAAAAAEQHAAAcAAAAHQAAAB4AAAAaAAAAHwAAAE5TdDNfXzIyMF9fc2hhcmVkX3B0cl9lbXBsYWNlSTlTdGRpbkZpbGVOU185YWxsb2NhdG9ySVMxX0VFRUUAAADkCQAABAcAAJQIAAAAAAAArAcAACAAAAAhAAAAIgAAABoAAAAjAAAATlN0M19fMjIwX19zaGFyZWRfcHRyX2VtcGxhY2VJMTBTdGRvdXRGaWxlTlNfOWFsbG9jYXRvcklTMV9FRUVFAOQJAABsBwAAlAgAAAAAAAAUCAAAJAAAACUAAAAmAAAAGgAAACcAAABOU3QzX18yMjBfX3NoYXJlZF9wdHJfZW1wbGFjZUkxMFN0ZGVyckZpbGVOU185YWxsb2NhdG9ySVMxX0VFRUUA5AkAANQHAACUCAAAAAAAAFAIAAAoAAAAKQAAABIAAABOU3QzX18yMTRfX3NoYXJlZF9jb3VudEUAAAAAvAkAADQIAAAAAAAAlAgAACgAAAAqAAAAEgAAABoAAAASAAAATlN0M19fMjE5X19zaGFyZWRfd2Vha19jb3VudEUAAABACgAAdAgAAAAAAAABAAAAUAgAAAAAAAAAAAAA0AgAACsAAAAsAAAALQAAAFN0OWV4Y2VwdGlvbgAAAAC8CQAAwAgAAAAAAAD8CAAAAQAAAC4AAAAvAAAAU3QxMWxvZ2ljX2Vycm9yAOQJAADsCAAA0AgAAAAAAAAwCQAAAQAAADAAAAAvAAAAU3QxMmxlbmd0aF9lcnJvcgAAAADkCQAAHAkAAPwIAABTdDl0eXBlX2luZm8AAAAAvAkAADwJAABOMTBfX2N4eGFiaXYxMTZfX3NoaW1fdHlwZV9pbmZvRQAAAADkCQAAVAkAAEwJAABOMTBfX2N4eGFiaXYxMTdfX2NsYXNzX3R5cGVfaW5mb0UAAADkCQAAhAkAAHgJAAAAAAAAqAkAADEAAAAyAAAAMwAAADQAAAA1AAAANgAAADcAAAA4AAAAAAAAACwKAAAxAAAAOQAAADMAAAA0AAAANQAAADoAAAA7AAAAPAAAAE4xMF9fY3h4YWJpdjEyMF9fc2lfY2xhc3NfdHlwZV9pbmZvRQAAAADkCQAABAoAAKgJAAAAAAAAiAoAADEAAAA9AAAAMwAAADQAAAA1AAAAPgAAAD8AAABAAAAATjEwX19jeHhhYml2MTIxX192bWlfY2xhc3NfdHlwZV9pbmZvRQAAAOQJAABgCgAAqAkAAA==");
  base64DecodeToExistingUint8Array(bufferView, 2708, "4AxQAA==");
  base64DecodeToExistingUint8Array(bufferView, 2712, "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
}
function asmFunc(env) {
 var memory = env.memory;
 var buffer = memory.buffer;
 var HEAP8 = new Int8Array(buffer);
 var HEAP16 = new Int16Array(buffer);
 var HEAP32 = new Int32Array(buffer);
 var HEAPU8 = new Uint8Array(buffer);
 var HEAPU16 = new Uint16Array(buffer);
 var HEAPU32 = new Uint32Array(buffer);
 var HEAPF32 = new Float32Array(buffer);
 var HEAPF64 = new Float64Array(buffer);
 var Math_imul = Math.imul;
 var Math_fround = Math.fround;
 var Math_abs = Math.abs;
 var Math_clz32 = Math.clz32;
 var Math_min = Math.min;
 var Math_max = Math.max;
 var Math_floor = Math.floor;
 var Math_ceil = Math.ceil;
 var Math_trunc = Math.trunc;
 var Math_sqrt = Math.sqrt;
 var abort = env.abort;
 var nan = NaN;
 var infinity = Infinity;
 var emscripten_console_log = env.emscripten_console_log;
 var abort = env.abort;
 var __cxa_allocate_exception = env.__cxa_allocate_exception;
 var __cxa_throw = env.__cxa_throw;
 var __cxa_atexit = env.__cxa_atexit;
 var emscripten_console_error = env.emscripten_console_error;
 var emscripten_resize_heap = env.emscripten_resize_heap;
 var emscripten_memcpy_big = env.emscripten_memcpy_big;
 var __stack_pointer = 5246176;
 var __stack_end = 0;
 var __stack_base = 0;
 var i64toi32_i32$HIGH_BITS = 0;
 // EMSCRIPTEN_START_FUNCS
;
 function __wasm_call_ctors() {
  emscripten_stack_init();
  _GLOBAL__sub_I_file_cpp();
  _GLOBAL__sub_I_file_table_cpp();
 }
 
 function __original_main() {
  var $2 = 0, $5 = 0;
  $2 = __stack_pointer - 16 | 0;
  __stack_pointer = $2;
  HEAP32[($2 + 12 | 0) >> 2] = 0;
  $5 = 0;
  open(1274 | 0, $5 | 0, $5 | 0) | 0;
  __stack_pointer = $2 + 16 | 0;
  return 0 | 0;
 }
 
 function main($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  return __original_main() | 0 | 0;
 }
 
 function std____2__shared_ptr_OpenFileDescriptor____shared_ptr_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $4 = 0, $13 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 8 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 8 | 0) >> 2] | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $4;
  label$1 : {
   if (!((HEAP32[($4 + 4 | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0)) {
    break label$1
   }
   std____2____shared_weak_count____release_shared_28_29(HEAP32[($4 + 4 | 0) >> 2] | 0 | 0);
  }
  $13 = HEAP32[($3 + 12 | 0) >> 2] | 0;
  __stack_pointer = $3 + 16 | 0;
  return $13 | 0;
 }
 
 function Locked_FileTable____Locked_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $4 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 12 | 0) >> 2] | 0;
  std____2__unique_lock_std____2__mutex____unique_lock_28_29($4 + 4 | 0 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $4 | 0;
 }
 
 function std____2____shared_weak_count____release_shared_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $4 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 12 | 0) >> 2] | 0;
  label$1 : {
   if (!((std____2____shared_count____release_shared_28_29($4 | 0) | 0) & 1 | 0)) {
    break label$1
   }
   std____2____shared_weak_count____release_weak_28_29($4 | 0);
  }
  __stack_pointer = $3 + 16 | 0;
  return;
 }
 
 function std____2__unique_lock_std____2__mutex____unique_lock_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $4 = 0, $9 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 8 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 8 | 0) >> 2] | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $4;
  label$1 : {
   if (!((HEAPU8[($4 + 4 | 0) >> 0] | 0) & 1 | 0)) {
    break label$1
   }
   std____2__mutex__unlock_28_29(HEAP32[$4 >> 2] | 0 | 0);
  }
  $9 = HEAP32[($3 + 12 | 0) >> 2] | 0;
  __stack_pointer = $3 + 16 | 0;
  return $9 | 0;
 }
 
 function __syscall_open($0, $1, $2) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  var $5 = 0, $12 = 0, $47 = 0, $65 = 0, $46 = 0, $61 = 0;
  $5 = __stack_pointer - 160 | 0;
  __stack_pointer = $5;
  HEAP32[($5 + 156 | 0) >> 2] = $0;
  HEAP32[($5 + 152 | 0) >> 2] = $1;
  HEAP32[($5 + 148 | 0) >> 2] = $2;
  FileTable__get_28_29($5 + 136 | 0 | 0);
  HEAP32[($5 + 132 | 0) >> 2] = (HEAP32[($5 + 152 | 0) >> 2] | 0) & 2097155 | 0;
  HEAP8[($5 + 131 | 0) >> 0] = 0;
  $12 = HEAP32[($5 + 132 | 0) >> 2] | 0;
  label$1 : {
   switch ($12 | 0) {
   case 0:
    HEAP8[($5 + 131 | 0) >> 0] = 0;
   case 1:
    HEAP8[($5 + 131 | 0) >> 0] = 1;
   case 2:
    HEAP8[($5 + 131 | 0) >> 0] = 1;
    break;
   default:
    break label$1;
   };
  }
  HEAP8[($5 + 131 | 0) >> 0] = 0;
  std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___basic_string_std__nullptr_t__28char_20const__29($5 + 112 | 0 | 0, 1460 | 0) | 0;
  std____2__vector_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20___vector_28_29($5 + 96 | 0 | 0) | 0;
  HEAP32[($5 + 92 | 0) >> 2] = HEAP32[($5 + 156 | 0) >> 2] | 0;
  std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___basic_string_std__nullptr_t__28char_20const__29($5 + 80 | 0 | 0, HEAP32[($5 + 92 | 0) >> 2] | 0 | 0) | 0;
  HEAP32[($5 + 76 | 0) >> 2] = 0;
  label$5 : {
   label$6 : while (1) {
    if (!((HEAP32[($5 + 76 | 0) >> 2] | 0) >>> 0 < (std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___size_28_29_20const($5 + 80 | 0 | 0) | 0) >>> 0 & 1 | 0)) {
     break label$5
    }
    $46 = HEAPU8[(std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___operator_5b_5d_28unsigned_20long_29($5 + 80 | 0 | 0, HEAP32[($5 + 76 | 0) >> 2] | 0 | 0) | 0) >> 0] | 0;
    $47 = 24;
    label$7 : {
     label$8 : {
      if (!((($46 << $47 | 0) >> $47 | 0 | 0) != (47 | 0) & 1 | 0)) {
       break label$8
      }
      $61 = HEAPU8[(std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___operator_5b_5d_28unsigned_20long_29($5 + 80 | 0 | 0, HEAP32[($5 + 76 | 0) >> 2] | 0 | 0) | 0) >> 0] | 0;
      $65 = 24;
      std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___operator___28char_29($5 + 112 | 0 | 0, ($61 << $65 | 0) >> $65 | 0 | 0) | 0;
      break label$7;
     }
     std____2__vector_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20___push_back_28std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20const__29($5 + 96 | 0 | 0, $5 + 112 | 0 | 0);
     std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___operator__28char_20const__29($5 + 112 | 0 | 0, 1460 | 0) | 0;
    }
    HEAP32[($5 + 76 | 0) >> 2] = (HEAP32[($5 + 76 | 0) >> 2] | 0) + 1 | 0;
    continue label$6;
   };
  }
  HEAP32[($5 + 72 | 0) >> 2] = $5 + 96 | 0;
  HEAP32[($5 + 64 | 0) >> 2] = std____2__vector_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20___begin_28_29(HEAP32[($5 + 72 | 0) >> 2] | 0 | 0) | 0;
  HEAP32[($5 + 56 | 0) >> 2] = std____2__vector_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20___end_28_29(HEAP32[($5 + 72 | 0) >> 2] | 0 | 0) | 0;
  label$9 : {
   label$10 : while (1) {
    if (!((bool_20std____2__operator___std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20____28std____2____wrap_iter_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20____20const__2c_20std____2____wrap_iter_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20____20const__29($5 + 64 | 0 | 0, $5 + 56 | 0 | 0) | 0) & 1 | 0)) {
     break label$9
    }
    std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___basic_string_28std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20const__29($5 + 40 | 0 | 0, std____2____wrap_iter_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____operator__28_29_20const($5 + 64 | 0 | 0) | 0 | 0) | 0;
    HEAP32[($5 + 16 | 0) >> 2] = std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___begin_28_29($5 + 40 | 0 | 0) | 0;
    HEAP32[($5 + 8 | 0) >> 2] = std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___end_28_29($5 + 40 | 0 | 0) | 0;
    std____2__vector_char_2c_20std____2__allocator_char__20___vector_std____2____wrap_iter_char___20__28std____2____wrap_iter_char___2c_20std____2__enable_if__28__is_cpp17_forward_iterator_std____2____wrap_iter_char___20___value_29_20___20_28is_constructible_char_2c_20std____2__iterator_traits_std____2____wrap_iter_char___20___reference___value_29_2c_20std____2____wrap_iter_char___20___type_29($5 + 24 | 0 | 0, HEAP32[($5 + 16 | 0) >> 2] | 0 | 0, HEAP32[($5 + 8 | 0) >> 2] | 0 | 0) | 0;
    emscripten_console_log(std____2__vector_char_2c_20std____2__allocator_char__20___operator_5b_5d_28unsigned_20long_29($5 + 24 | 0 | 0, 0 | 0) | 0 | 0);
    std____2__vector_char_2c_20std____2__allocator_char__20____vector_28_29($5 + 24 | 0 | 0) | 0;
    std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20____basic_string_28_29($5 + 40 | 0 | 0) | 0;
    std____2____wrap_iter_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____operator___28_29($5 + 64 | 0 | 0) | 0;
    continue label$10;
   };
  }
  std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20____basic_string_28_29($5 + 80 | 0 | 0) | 0;
  std____2__vector_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20____vector_28_29($5 + 96 | 0 | 0) | 0;
  std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20____basic_string_28_29($5 + 112 | 0 | 0) | 0;
  Locked_FileTable____Locked_28_29($5 + 136 | 0 | 0) | 0;
  __stack_pointer = $5 + 160 | 0;
  return 1 | 0;
 }
 
 function std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___basic_string_std__nullptr_t__28char_20const__29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0, $5 = 0;
  $4 = __stack_pointer - 32 | 0;
  __stack_pointer = $4;
  HEAP32[($4 + 28 | 0) >> 2] = $0;
  HEAP32[($4 + 24 | 0) >> 2] = $1;
  $5 = HEAP32[($4 + 28 | 0) >> 2] | 0;
  std____2____compressed_pair_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____rep_2c_20std____2__allocator_char__20_____compressed_pair_std____2____default_init_tag_2c_20std____2____default_init_tag__28std____2____default_init_tag___2c_20std____2____default_init_tag___29($5 | 0, $4 + 16 | 0 | 0, $4 + 8 | 0 | 0) | 0;
  std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____init_28char_20const__2c_20unsigned_20long_29($5 | 0, HEAP32[($4 + 24 | 0) >> 2] | 0 | 0, std____2__char_traits_char___length_28char_20const__29(HEAP32[($4 + 24 | 0) >> 2] | 0 | 0) | 0 | 0);
  __stack_pointer = $4 + 32 | 0;
  return $5 | 0;
 }
 
 function std____2__vector_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20___vector_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $4 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 12 | 0) >> 2] | 0;
  std____2____vector_base_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20_____vector_base_28_29($4 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $4 | 0;
 }
 
 function std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___size_28_29_20const($0) {
  $0 = $0 | 0;
  var $3 = 0, $4 = 0, $9 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 12 | 0) >> 2] | 0;
  label$1 : {
   label$2 : {
    if (!((std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____is_long_28_29_20const($4 | 0) | 0) & 1 | 0)) {
     break label$2
    }
    $9 = std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____get_long_size_28_29_20const($4 | 0) | 0;
    break label$1;
   }
   $9 = std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____get_short_size_28_29_20const($4 | 0) | 0;
  }
  __stack_pointer = $3 + 16 | 0;
  return $9 | 0;
 }
 
 function std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___operator_5b_5d_28unsigned_20long_29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0, $8 = 0;
  $4 = __stack_pointer - 16 | 0;
  __stack_pointer = $4;
  HEAP32[($4 + 12 | 0) >> 2] = $0;
  HEAP32[($4 + 8 | 0) >> 2] = $1;
  $8 = (std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____get_pointer_28_29(HEAP32[($4 + 12 | 0) >> 2] | 0 | 0) | 0) + (HEAP32[($4 + 8 | 0) >> 2] | 0) | 0;
  __stack_pointer = $4 + 16 | 0;
  return $8 | 0;
 }
 
 function std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___operator___28char_29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0, $5 = 0, $7 = 0;
  $4 = __stack_pointer - 16 | 0;
  __stack_pointer = $4;
  HEAP32[($4 + 12 | 0) >> 2] = $0;
  HEAP8[($4 + 11 | 0) >> 0] = $1;
  $5 = HEAP32[($4 + 12 | 0) >> 2] | 0;
  $7 = 24;
  std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___push_back_28char_29($5 | 0, ((HEAPU8[($4 + 11 | 0) >> 0] | 0) << $7 | 0) >> $7 | 0 | 0);
  __stack_pointer = $4 + 16 | 0;
  return $5 | 0;
 }
 
 function std____2__vector_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20___push_back_28std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20const__29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0, $5 = 0;
  $4 = __stack_pointer - 16 | 0;
  __stack_pointer = $4;
  HEAP32[($4 + 12 | 0) >> 2] = $0;
  HEAP32[($4 + 8 | 0) >> 2] = $1;
  $5 = HEAP32[($4 + 12 | 0) >> 2] | 0;
  label$1 : {
   label$2 : {
    if (!((HEAP32[($5 + 4 | 0) >> 2] | 0 | 0) != (HEAP32[(std____2____vector_base_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20_____end_cap_28_29($5 | 0) | 0) >> 2] | 0 | 0) & 1 | 0)) {
     break label$2
    }
    void_20std____2__vector_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20_____construct_one_at_end_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20const___28std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20const__29($5 | 0, HEAP32[($4 + 8 | 0) >> 2] | 0 | 0);
    break label$1;
   }
   void_20std____2__vector_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20_____push_back_slow_path_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20const___28std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20const__29($5 | 0, HEAP32[($4 + 8 | 0) >> 2] | 0 | 0);
  }
  __stack_pointer = $4 + 16 | 0;
  return;
 }
 
 function std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___operator__28char_20const__29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0, $7 = 0;
  $4 = __stack_pointer - 16 | 0;
  __stack_pointer = $4;
  HEAP32[($4 + 12 | 0) >> 2] = $0;
  HEAP32[($4 + 8 | 0) >> 2] = $1;
  $7 = std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___assign_28char_20const__29(HEAP32[($4 + 12 | 0) >> 2] | 0 | 0, HEAP32[($4 + 8 | 0) >> 2] | 0 | 0) | 0;
  __stack_pointer = $4 + 16 | 0;
  return $7 | 0;
 }
 
 function std____2__vector_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20___begin_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $4 = 0, $7 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 4 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 4 | 0) >> 2] | 0;
  HEAP32[($3 + 8 | 0) >> 2] = std____2__vector_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20_____make_iter_28std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___29($4 | 0, HEAP32[$4 >> 2] | 0 | 0) | 0;
  $7 = HEAP32[($3 + 8 | 0) >> 2] | 0;
  __stack_pointer = $3 + 16 | 0;
  return $7 | 0;
 }
 
 function std____2__vector_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20___end_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $4 = 0, $7 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 4 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 4 | 0) >> 2] | 0;
  HEAP32[($3 + 8 | 0) >> 2] = std____2__vector_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20_____make_iter_28std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___29($4 | 0, HEAP32[($4 + 4 | 0) >> 2] | 0 | 0) | 0;
  $7 = HEAP32[($3 + 8 | 0) >> 2] | 0;
  __stack_pointer = $3 + 16 | 0;
  return $7 | 0;
 }
 
 function bool_20std____2__operator___std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20____28std____2____wrap_iter_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20____20const__2c_20std____2____wrap_iter_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20____20const__29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0, $7 = 0;
  $4 = __stack_pointer - 16 | 0;
  __stack_pointer = $4;
  HEAP32[($4 + 12 | 0) >> 2] = $0;
  HEAP32[($4 + 8 | 0) >> 2] = $1;
  $7 = bool_20std____2__operator___std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___2c_20std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20____28std____2____wrap_iter_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20____20const__2c_20std____2____wrap_iter_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20____20const__29(HEAP32[($4 + 12 | 0) >> 2] | 0 | 0, HEAP32[($4 + 8 | 0) >> 2] | 0 | 0) | 0;
  __stack_pointer = $4 + 16 | 0;
  return ($7 ^ -1 | 0) & 1 | 0 | 0;
 }
 
 function std____2____wrap_iter_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____operator__28_29_20const($0) {
  $0 = $0 | 0;
  var $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  return HEAP32[(HEAP32[($3 + 12 | 0) >> 2] | 0) >> 2] | 0 | 0;
 }
 
 function std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___basic_string_28std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20const__29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0, i64toi32_i32$0 = 0, $5 = 0, $19 = 0, $22 = 0, $20 = 0, i64toi32_i32$1 = 0, $81 = 0, $31 = 0;
  $4 = __stack_pointer - 32 | 0;
  __stack_pointer = $4;
  HEAP32[($4 + 24 | 0) >> 2] = $0;
  HEAP32[($4 + 20 | 0) >> 2] = $1;
  $5 = HEAP32[($4 + 24 | 0) >> 2] | 0;
  HEAP32[($4 + 28 | 0) >> 2] = $5;
  std____2__allocator_char__20std____2__allocator_traits_std____2__allocator_char__20___select_on_container_copy_construction_std____2__allocator_char__2c_20void_2c_20void__28std____2__allocator_char__20const__29(std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____alloc_28_29_20const(HEAP32[($4 + 20 | 0) >> 2] | 0 | 0) | 0 | 0);
  std____2____compressed_pair_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____rep_2c_20std____2__allocator_char__20_____compressed_pair_std____2____default_init_tag_2c_20std____2__allocator_char__20__28std____2____default_init_tag___2c_20std____2__allocator_char____29($5 | 0, $4 + 16 | 0 | 0, $4 + 8 | 0 | 0) | 0;
  label$1 : {
   label$2 : {
    if ((std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____is_long_28_29_20const(HEAP32[($4 + 20 | 0) >> 2] | 0 | 0) | 0) & 1 | 0) {
     break label$2
    }
    $19 = std____2____compressed_pair_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____rep_2c_20std____2__allocator_char__20___first_28_29_20const(HEAP32[($4 + 20 | 0) >> 2] | 0 | 0) | 0;
    $20 = std____2____compressed_pair_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____rep_2c_20std____2__allocator_char__20___first_28_29($5 | 0) | 0;
    i64toi32_i32$0 = HEAP32[$19 >> 2] | 0;
    i64toi32_i32$1 = HEAP32[($19 + 4 | 0) >> 2] | 0;
    $81 = i64toi32_i32$0;
    i64toi32_i32$0 = $20;
    HEAP32[i64toi32_i32$0 >> 2] = $81;
    HEAP32[(i64toi32_i32$0 + 4 | 0) >> 2] = i64toi32_i32$1;
    $22 = 8;
    HEAP32[(i64toi32_i32$0 + $22 | 0) >> 2] = HEAP32[($19 + $22 | 0) >> 2] | 0;
    break label$1;
   }
   std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____init_copy_ctor_external_28char_20const__2c_20unsigned_20long_29($5 | 0, char_20const__20std____2____to_address_char_20const__28char_20const__29(std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____get_long_pointer_28_29_20const(HEAP32[($4 + 20 | 0) >> 2] | 0 | 0) | 0 | 0) | 0 | 0, std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____get_long_size_28_29_20const(HEAP32[($4 + 20 | 0) >> 2] | 0 | 0) | 0 | 0);
  }
  $31 = HEAP32[($4 + 28 | 0) >> 2] | 0;
  __stack_pointer = $4 + 32 | 0;
  return $31 | 0;
 }
 
 function std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___begin_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $9 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 4 | 0) >> 2] = $0;
  std____2____wrap_iter_char______wrap_iter_28char__29($3 + 8 | 0 | 0, std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____get_pointer_28_29(HEAP32[($3 + 4 | 0) >> 2] | 0 | 0) | 0 | 0) | 0;
  $9 = HEAP32[($3 + 8 | 0) >> 2] | 0;
  __stack_pointer = $3 + 16 | 0;
  return $9 | 0;
 }
 
 function std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___end_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $4 = 0, $11 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 4 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 4 | 0) >> 2] | 0;
  std____2____wrap_iter_char______wrap_iter_28char__29($3 + 8 | 0 | 0, (std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____get_pointer_28_29($4 | 0) | 0) + (std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___size_28_29_20const($4 | 0) | 0) | 0 | 0) | 0;
  $11 = HEAP32[($3 + 8 | 0) >> 2] | 0;
  __stack_pointer = $3 + 16 | 0;
  return $11 | 0;
 }
 
 function std____2__vector_char_2c_20std____2__allocator_char__20___vector_std____2____wrap_iter_char___20__28std____2____wrap_iter_char___2c_20std____2__enable_if__28__is_cpp17_forward_iterator_std____2____wrap_iter_char___20___value_29_20___20_28is_constructible_char_2c_20std____2__iterator_traits_std____2____wrap_iter_char___20___reference___value_29_2c_20std____2____wrap_iter_char___20___type_29($0, $1, $2) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  var $5 = 0, $6 = 0, $49 = 0;
  $5 = __stack_pointer - 64 | 0;
  __stack_pointer = $5;
  HEAP32[($5 + 56 | 0) >> 2] = $1;
  HEAP32[($5 + 48 | 0) >> 2] = $2;
  HEAP32[($5 + 44 | 0) >> 2] = $0;
  $6 = HEAP32[($5 + 44 | 0) >> 2] | 0;
  HEAP32[($5 + 60 | 0) >> 2] = $6;
  std____2____vector_base_char_2c_20std____2__allocator_char__20_____vector_base_28_29($6 | 0) | 0;
  HEAP32[($5 + 32 | 0) >> 2] = HEAP32[($5 + 56 | 0) >> 2] | 0;
  HEAP32[($5 + 24 | 0) >> 2] = HEAP32[($5 + 48 | 0) >> 2] | 0;
  HEAP32[($5 + 40 | 0) >> 2] = std____2__iterator_traits_std____2____wrap_iter_char___20___difference_type_20std____2__distance_std____2____wrap_iter_char___20__28std____2____wrap_iter_char___2c_20std____2____wrap_iter_char___29(HEAP32[($5 + 32 | 0) >> 2] | 0 | 0, HEAP32[($5 + 24 | 0) >> 2] | 0 | 0) | 0;
  label$1 : {
   if (!((HEAP32[($5 + 40 | 0) >> 2] | 0) >>> 0 > 0 >>> 0 & 1 | 0)) {
    break label$1
   }
   std____2__vector_char_2c_20std____2__allocator_char__20_____vallocate_28unsigned_20long_29($6 | 0, HEAP32[($5 + 40 | 0) >> 2] | 0 | 0);
   HEAP32[($5 + 16 | 0) >> 2] = HEAP32[($5 + 56 | 0) >> 2] | 0;
   HEAP32[($5 + 8 | 0) >> 2] = HEAP32[($5 + 48 | 0) >> 2] | 0;
   std____2__enable_if___is_cpp17_forward_iterator_std____2____wrap_iter_char___20___value_2c_20void___type_20std____2__vector_char_2c_20std____2__allocator_char__20_____construct_at_end_std____2____wrap_iter_char___20__28std____2____wrap_iter_char___2c_20std____2____wrap_iter_char___2c_20unsigned_20long_29($6 | 0, HEAP32[($5 + 16 | 0) >> 2] | 0 | 0, HEAP32[($5 + 8 | 0) >> 2] | 0 | 0, HEAP32[($5 + 40 | 0) >> 2] | 0 | 0);
  }
  $49 = HEAP32[($5 + 60 | 0) >> 2] | 0;
  __stack_pointer = $5 + 64 | 0;
  return $49 | 0;
 }
 
 function std____2__vector_char_2c_20std____2__allocator_char__20___operator_5b_5d_28unsigned_20long_29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0;
  $4 = __stack_pointer - 16 | 0;
  HEAP32[($4 + 12 | 0) >> 2] = $0;
  HEAP32[($4 + 8 | 0) >> 2] = $1;
  return (HEAP32[(HEAP32[($4 + 12 | 0) >> 2] | 0) >> 2] | 0) + (HEAP32[($4 + 8 | 0) >> 2] | 0) | 0 | 0;
 }
 
 function std____2__vector_char_2c_20std____2__allocator_char__20____vector_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $4 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 12 | 0) >> 2] | 0;
  std____2__vector_char_2c_20std____2__allocator_char__20_____annotate_delete_28_29_20const($4 | 0);
  std____2____vector_base_char_2c_20std____2__allocator_char__20______vector_base_28_29($4 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $4 | 0;
 }
 
 function std____2____wrap_iter_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____operator___28_29($0) {
  $0 = $0 | 0;
  var $4 = 0, $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 12 | 0) >> 2] | 0;
  HEAP32[$4 >> 2] = (HEAP32[$4 >> 2] | 0) + 12 | 0;
  return $4 | 0;
 }
 
 function std____2__vector_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20____vector_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $4 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 12 | 0) >> 2] | 0;
  std____2__vector_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20_____annotate_delete_28_29_20const($4 | 0);
  std____2____vector_base_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20______vector_base_28_29($4 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $4 | 0;
 }
 
 function std____2____compressed_pair_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____rep_2c_20std____2__allocator_char__20_____compressed_pair_std____2____default_init_tag_2c_20std____2____default_init_tag__28std____2____default_init_tag___2c_20std____2____default_init_tag___29($0, $1, $2) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  var $5 = 0, $6 = 0;
  $5 = __stack_pointer - 32 | 0;
  __stack_pointer = $5;
  HEAP32[($5 + 28 | 0) >> 2] = $0;
  HEAP32[($5 + 24 | 0) >> 2] = $1;
  HEAP32[($5 + 20 | 0) >> 2] = $2;
  $6 = HEAP32[($5 + 28 | 0) >> 2] | 0;
  std____2____default_init_tag___20std____2__forward_std____2____default_init_tag__28std____2__remove_reference_std____2____default_init_tag___type__29(HEAP32[($5 + 24 | 0) >> 2] | 0 | 0) | 0;
  std____2____compressed_pair_elem_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____rep_2c_200_2c_20false_____compressed_pair_elem_28std____2____default_init_tag_29($6 | 0) | 0;
  std____2____default_init_tag___20std____2__forward_std____2____default_init_tag__28std____2__remove_reference_std____2____default_init_tag___type__29(HEAP32[($5 + 20 | 0) >> 2] | 0 | 0) | 0;
  std____2____compressed_pair_elem_std____2__allocator_char__2c_201_2c_20true_____compressed_pair_elem_28std____2____default_init_tag_29($6 | 0) | 0;
  __stack_pointer = $5 + 32 | 0;
  return $6 | 0;
 }
 
 function std____2__char_traits_char___length_28char_20const__29($0) {
  $0 = $0 | 0;
  var $3 = 0, $5 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $5 = strlen(HEAP32[($3 + 12 | 0) >> 2] | 0 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $5 | 0;
 }
 
 function std____2____vector_base_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20_____vector_base_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $4 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 12 | 0) >> 2] | 0;
  std____2____vector_base_common_true_____vector_base_common_28_29($4 | 0) | 0;
  HEAP32[$4 >> 2] = 0;
  HEAP32[($4 + 4 | 0) >> 2] = 0;
  HEAP32[($3 + 8 | 0) >> 2] = 0;
  std____2____compressed_pair_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20_____compressed_pair_std__nullptr_t_2c_20std____2____default_init_tag__28std__nullptr_t___2c_20std____2____default_init_tag___29($4 + 8 | 0 | 0, $3 + 8 | 0 | 0, $3 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $4 | 0;
 }
 
 function std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____is_long_28_29_20const($0) {
  $0 = $0 | 0;
  var $3 = 0, $6 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $6 = HEAPU8[((std____2____compressed_pair_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____rep_2c_20std____2__allocator_char__20___first_28_29_20const(HEAP32[($3 + 12 | 0) >> 2] | 0 | 0) | 0) + 11 | 0) >> 0] | 0;
  __stack_pointer = $3 + 16 | 0;
  return (($6 & 255 | 0) & 128 | 0 | 0) != (0 | 0) & 1 | 0 | 0;
 }
 
 function std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____get_long_size_28_29_20const($0) {
  $0 = $0 | 0;
  var $3 = 0, $6 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $6 = HEAP32[((std____2____compressed_pair_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____rep_2c_20std____2__allocator_char__20___first_28_29_20const(HEAP32[($3 + 12 | 0) >> 2] | 0 | 0) | 0) + 4 | 0) >> 2] | 0;
  __stack_pointer = $3 + 16 | 0;
  return $6 | 0;
 }
 
 function std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____get_short_size_28_29_20const($0) {
  $0 = $0 | 0;
  var $3 = 0, $6 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $6 = HEAPU8[((std____2____compressed_pair_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____rep_2c_20std____2__allocator_char__20___first_28_29_20const(HEAP32[($3 + 12 | 0) >> 2] | 0 | 0) | 0) + 11 | 0) >> 0] | 0;
  __stack_pointer = $3 + 16 | 0;
  return $6 & 255 | 0 | 0;
 }
 
 function std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____get_pointer_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $4 = 0, $9 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 12 | 0) >> 2] | 0;
  label$1 : {
   label$2 : {
    if (!((std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____is_long_28_29_20const($4 | 0) | 0) & 1 | 0)) {
     break label$2
    }
    $9 = std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____get_long_pointer_28_29($4 | 0) | 0;
    break label$1;
   }
   $9 = std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____get_short_pointer_28_29($4 | 0) | 0;
  }
  __stack_pointer = $3 + 16 | 0;
  return $9 | 0;
 }
 
 function std____2____vector_base_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20_____end_cap_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $7 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $7 = std____2____compressed_pair_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20___first_28_29((HEAP32[($3 + 12 | 0) >> 2] | 0) + 8 | 0 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $7 | 0;
 }
 
 function void_20std____2__vector_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20_____construct_one_at_end_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20const___28std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20const__29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0, $5 = 0;
  $4 = __stack_pointer - 32 | 0;
  __stack_pointer = $4;
  HEAP32[($4 + 28 | 0) >> 2] = $0;
  HEAP32[($4 + 24 | 0) >> 2] = $1;
  $5 = HEAP32[($4 + 28 | 0) >> 2] | 0;
  std____2__vector_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20____ConstructTransaction___ConstructTransaction_28std____2__vector_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20___2c_20unsigned_20long_29($4 + 8 | 0 | 0, $5 | 0, 1 | 0) | 0;
  void_20std____2__allocator_traits_std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20___construct_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20const__2c_20void__28std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20___2c_20std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___2c_20std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20const__29(std____2____vector_base_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20_____alloc_28_29($5 | 0) | 0 | 0, std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___20std____2____to_address_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__28std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___29(HEAP32[($4 + 12 | 0) >> 2] | 0 | 0) | 0 | 0, std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20const__20std____2__forward_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20const___28std____2__remove_reference_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20const____type__29(HEAP32[($4 + 24 | 0) >> 2] | 0 | 0) | 0 | 0);
  HEAP32[($4 + 12 | 0) >> 2] = (HEAP32[($4 + 12 | 0) >> 2] | 0) + 12 | 0;
  std____2__vector_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20____ConstructTransaction____ConstructTransaction_28_29($4 + 8 | 0 | 0) | 0;
  __stack_pointer = $4 + 32 | 0;
  return;
 }
 
 function void_20std____2__vector_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20_____push_back_slow_path_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20const___28std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20const__29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0, $5 = 0;
  $4 = __stack_pointer - 32 | 0;
  __stack_pointer = $4;
  HEAP32[($4 + 28 | 0) >> 2] = $0;
  HEAP32[($4 + 24 | 0) >> 2] = $1;
  $5 = HEAP32[($4 + 28 | 0) >> 2] | 0;
  HEAP32[($4 + 20 | 0) >> 2] = std____2____vector_base_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20_____alloc_28_29($5 | 0) | 0;
  std____2____split_buffer_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20_______split_buffer_28unsigned_20long_2c_20unsigned_20long_2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20___29($4 | 0, std____2__vector_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20_____recommend_28unsigned_20long_29_20const($5 | 0, (std____2__vector_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20___size_28_29_20const($5 | 0) | 0) + 1 | 0 | 0) | 0 | 0, std____2__vector_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20___size_28_29_20const($5 | 0) | 0 | 0, HEAP32[($4 + 20 | 0) >> 2] | 0 | 0) | 0;
  void_20std____2__allocator_traits_std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20___construct_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20const__2c_20void__28std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20___2c_20std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___2c_20std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20const__29(HEAP32[($4 + 20 | 0) >> 2] | 0 | 0, std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___20std____2____to_address_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__28std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___29(HEAP32[($4 + 8 | 0) >> 2] | 0 | 0) | 0 | 0, std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20const__20std____2__forward_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20const___28std____2__remove_reference_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20const____type__29(HEAP32[($4 + 24 | 0) >> 2] | 0 | 0) | 0 | 0);
  HEAP32[($4 + 8 | 0) >> 2] = (HEAP32[($4 + 8 | 0) >> 2] | 0) + 12 | 0;
  std____2__vector_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20_____swap_out_circular_buffer_28std____2____split_buffer_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20_____29($5 | 0, $4 | 0);
  std____2____split_buffer_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20________split_buffer_28_29($4 | 0) | 0;
  __stack_pointer = $4 + 32 | 0;
  return;
 }
 
 function std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___assign_28char_20const__29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0, $7 = 0;
  $4 = __stack_pointer - 16 | 0;
  __stack_pointer = $4;
  HEAP32[($4 + 12 | 0) >> 2] = $0;
  HEAP32[($4 + 8 | 0) >> 2] = $1;
  $7 = std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____assign_external_28char_20const__29(HEAP32[($4 + 12 | 0) >> 2] | 0 | 0, HEAP32[($4 + 8 | 0) >> 2] | 0 | 0) | 0;
  __stack_pointer = $4 + 16 | 0;
  return $7 | 0;
 }
 
 function std____2__vector_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20_____make_iter_28std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0, $9 = 0;
  $4 = __stack_pointer - 16 | 0;
  __stack_pointer = $4;
  HEAP32[($4 + 4 | 0) >> 2] = $0;
  HEAP32[$4 >> 2] = $1;
  std____2____wrap_iter_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_______wrap_iter_28std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___29($4 + 8 | 0 | 0, HEAP32[$4 >> 2] | 0 | 0) | 0;
  $9 = HEAP32[($4 + 8 | 0) >> 2] | 0;
  __stack_pointer = $4 + 16 | 0;
  return $9 | 0;
 }
 
 function bool_20std____2__operator___std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___2c_20std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20____28std____2____wrap_iter_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20____20const__2c_20std____2____wrap_iter_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20____20const__29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0, $6 = 0, $8 = 0;
  $4 = __stack_pointer - 16 | 0;
  __stack_pointer = $4;
  HEAP32[($4 + 12 | 0) >> 2] = $0;
  HEAP32[($4 + 8 | 0) >> 2] = $1;
  $6 = std____2____wrap_iter_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____base_28_29_20const(HEAP32[($4 + 12 | 0) >> 2] | 0 | 0) | 0;
  $8 = std____2____wrap_iter_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____base_28_29_20const(HEAP32[($4 + 8 | 0) >> 2] | 0 | 0) | 0;
  __stack_pointer = $4 + 16 | 0;
  return ($6 | 0) == ($8 | 0) & 1 | 0 | 0;
 }
 
 function std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____alloc_28_29_20const($0) {
  $0 = $0 | 0;
  var $3 = 0, $5 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $5 = std____2____compressed_pair_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____rep_2c_20std____2__allocator_char__20___second_28_29_20const(HEAP32[($3 + 12 | 0) >> 2] | 0 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $5 | 0;
 }
 
 function std____2__allocator_char__20std____2__allocator_traits_std____2__allocator_char__20___select_on_container_copy_construction_std____2__allocator_char__2c_20void_2c_20void__28std____2__allocator_char__20const__29($0) {
  $0 = $0 | 0;
  HEAP32[((__stack_pointer - 16 | 0) + 12 | 0) >> 2] = $0;
  return;
 }
 
 function std____2____compressed_pair_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____rep_2c_20std____2__allocator_char__20_____compressed_pair_std____2____default_init_tag_2c_20std____2__allocator_char__20__28std____2____default_init_tag___2c_20std____2__allocator_char____29($0, $1, $2) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  var $5 = 0, $6 = 0;
  $5 = __stack_pointer - 16 | 0;
  __stack_pointer = $5;
  HEAP32[($5 + 12 | 0) >> 2] = $0;
  HEAP32[($5 + 8 | 0) >> 2] = $1;
  HEAP32[($5 + 4 | 0) >> 2] = $2;
  $6 = HEAP32[($5 + 12 | 0) >> 2] | 0;
  std____2____default_init_tag___20std____2__forward_std____2____default_init_tag__28std____2__remove_reference_std____2____default_init_tag___type__29(HEAP32[($5 + 8 | 0) >> 2] | 0 | 0) | 0;
  std____2____compressed_pair_elem_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____rep_2c_200_2c_20false_____compressed_pair_elem_28std____2____default_init_tag_29($6 | 0) | 0;
  std____2____compressed_pair_elem_std____2__allocator_char__2c_201_2c_20true_____compressed_pair_elem_std____2__allocator_char__2c_20void__28std____2__allocator_char____29($6 | 0, std____2__allocator_char____20std____2__forward_std____2__allocator_char__20__28std____2__remove_reference_std____2__allocator_char__20___type__29(HEAP32[($5 + 4 | 0) >> 2] | 0 | 0) | 0 | 0) | 0;
  __stack_pointer = $5 + 16 | 0;
  return $6 | 0;
 }
 
 function std____2____compressed_pair_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____rep_2c_20std____2__allocator_char__20___first_28_29_20const($0) {
  $0 = $0 | 0;
  var $3 = 0, $5 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $5 = std____2____compressed_pair_elem_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____rep_2c_200_2c_20false_____get_28_29_20const(HEAP32[($3 + 12 | 0) >> 2] | 0 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $5 | 0;
 }
 
 function std____2____compressed_pair_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____rep_2c_20std____2__allocator_char__20___first_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $5 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $5 = std____2____compressed_pair_elem_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____rep_2c_200_2c_20false_____get_28_29(HEAP32[($3 + 12 | 0) >> 2] | 0 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $5 | 0;
 }
 
 function std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____get_long_pointer_28_29_20const($0) {
  $0 = $0 | 0;
  var $3 = 0, $6 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $6 = HEAP32[(std____2____compressed_pair_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____rep_2c_20std____2__allocator_char__20___first_28_29_20const(HEAP32[($3 + 12 | 0) >> 2] | 0 | 0) | 0) >> 2] | 0;
  __stack_pointer = $3 + 16 | 0;
  return $6 | 0;
 }
 
 function char_20const__20std____2____to_address_char_20const__28char_20const__29($0) {
  $0 = $0 | 0;
  var $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  return HEAP32[($3 + 12 | 0) >> 2] | 0 | 0;
 }
 
 function std____2____wrap_iter_char______wrap_iter_28char__29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0, $5 = 0;
  $4 = __stack_pointer - 16 | 0;
  HEAP32[($4 + 12 | 0) >> 2] = $0;
  HEAP32[($4 + 8 | 0) >> 2] = $1;
  $5 = HEAP32[($4 + 12 | 0) >> 2] | 0;
  HEAP32[$5 >> 2] = HEAP32[($4 + 8 | 0) >> 2] | 0;
  return $5 | 0;
 }
 
 function std____2____vector_base_char_2c_20std____2__allocator_char__20_____vector_base_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $4 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 12 | 0) >> 2] | 0;
  std____2____vector_base_common_true_____vector_base_common_28_29($4 | 0) | 0;
  HEAP32[$4 >> 2] = 0;
  HEAP32[($4 + 4 | 0) >> 2] = 0;
  HEAP32[($3 + 8 | 0) >> 2] = 0;
  std____2____compressed_pair_char__2c_20std____2__allocator_char__20_____compressed_pair_std__nullptr_t_2c_20std____2____default_init_tag__28std__nullptr_t___2c_20std____2____default_init_tag___29($4 + 8 | 0 | 0, $3 + 8 | 0 | 0, $3 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $4 | 0;
 }
 
 function std____2__iterator_traits_std____2____wrap_iter_char___20___difference_type_20std____2__distance_std____2____wrap_iter_char___20__28std____2____wrap_iter_char___2c_20std____2____wrap_iter_char___29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0, $21 = 0;
  $4 = __stack_pointer - 48 | 0;
  __stack_pointer = $4;
  HEAP32[($4 + 40 | 0) >> 2] = $0;
  HEAP32[($4 + 32 | 0) >> 2] = $1;
  HEAP32[($4 + 24 | 0) >> 2] = HEAP32[($4 + 40 | 0) >> 2] | 0;
  HEAP32[($4 + 16 | 0) >> 2] = HEAP32[($4 + 32 | 0) >> 2] | 0;
  $21 = std____2__iterator_traits_std____2____wrap_iter_char___20___difference_type_20std____2____distance_std____2____wrap_iter_char___20__28std____2____wrap_iter_char___2c_20std____2____wrap_iter_char___2c_20std____2__random_access_iterator_tag_29(HEAP32[($4 + 24 | 0) >> 2] | 0 | 0, HEAP32[($4 + 16 | 0) >> 2] | 0 | 0) | 0;
  __stack_pointer = $4 + 48 | 0;
  return $21 | 0;
 }
 
 function std____2__vector_char_2c_20std____2__allocator_char__20_____vallocate_28unsigned_20long_29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0, $5 = 0, $15 = 0, $18 = 0;
  $4 = __stack_pointer - 16 | 0;
  __stack_pointer = $4;
  HEAP32[($4 + 12 | 0) >> 2] = $0;
  HEAP32[($4 + 8 | 0) >> 2] = $1;
  $5 = HEAP32[($4 + 12 | 0) >> 2] | 0;
  label$1 : {
   if (!((HEAP32[($4 + 8 | 0) >> 2] | 0) >>> 0 > (std____2__vector_char_2c_20std____2__allocator_char__20___max_size_28_29_20const($5 | 0) | 0) >>> 0 & 1 | 0)) {
    break label$1
   }
   std____2____vector_base_common_true_____throw_length_error_28_29_20const($5 | 0);
   abort();
  }
  $15 = std____2__allocator_traits_std____2__allocator_char__20___allocate_28std____2__allocator_char___2c_20unsigned_20long_29(std____2____vector_base_char_2c_20std____2__allocator_char__20_____alloc_28_29($5 | 0) | 0 | 0, HEAP32[($4 + 8 | 0) >> 2] | 0 | 0) | 0;
  HEAP32[($5 + 4 | 0) >> 2] = $15;
  HEAP32[$5 >> 2] = $15;
  $18 = (HEAP32[$5 >> 2] | 0) + (HEAP32[($4 + 8 | 0) >> 2] | 0) | 0;
  HEAP32[(std____2____vector_base_char_2c_20std____2__allocator_char__20_____end_cap_28_29($5 | 0) | 0) >> 2] = $18;
  std____2__vector_char_2c_20std____2__allocator_char__20_____annotate_new_28unsigned_20long_29_20const($5 | 0, 0 | 0);
  __stack_pointer = $4 + 16 | 0;
  return;
 }
 
 function std____2__enable_if___is_cpp17_forward_iterator_std____2____wrap_iter_char___20___value_2c_20void___type_20std____2__vector_char_2c_20std____2__allocator_char__20_____construct_at_end_std____2____wrap_iter_char___20__28std____2____wrap_iter_char___2c_20std____2____wrap_iter_char___2c_20unsigned_20long_29($0, $1, $2, $3) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  $3 = $3 | 0;
  var $6 = 0, $7 = 0, $12 = 0;
  $6 = __stack_pointer - 64 | 0;
  __stack_pointer = $6;
  HEAP32[($6 + 56 | 0) >> 2] = $1;
  HEAP32[($6 + 48 | 0) >> 2] = $2;
  HEAP32[($6 + 44 | 0) >> 2] = $0;
  HEAP32[($6 + 40 | 0) >> 2] = $3;
  $7 = HEAP32[($6 + 44 | 0) >> 2] | 0;
  std____2__vector_char_2c_20std____2__allocator_char__20____ConstructTransaction___ConstructTransaction_28std____2__vector_char_2c_20std____2__allocator_char__20___2c_20unsigned_20long_29($6 + 24 | 0 | 0, $7 | 0, HEAP32[($6 + 40 | 0) >> 2] | 0 | 0) | 0;
  $12 = std____2____vector_base_char_2c_20std____2__allocator_char__20_____alloc_28_29($7 | 0) | 0;
  HEAP32[($6 + 16 | 0) >> 2] = HEAP32[($6 + 56 | 0) >> 2] | 0;
  HEAP32[($6 + 8 | 0) >> 2] = HEAP32[($6 + 48 | 0) >> 2] | 0;
  void_20std____2____construct_range_forward_std____2__allocator_char__2c_20std____2____wrap_iter_char___2c_20char___28std____2__allocator_char___2c_20std____2____wrap_iter_char___2c_20std____2____wrap_iter_char___2c_20char___29($12 | 0, HEAP32[($6 + 16 | 0) >> 2] | 0 | 0, HEAP32[($6 + 8 | 0) >> 2] | 0 | 0, ($6 + 24 | 0) + 4 | 0 | 0);
  std____2__vector_char_2c_20std____2__allocator_char__20____ConstructTransaction____ConstructTransaction_28_29($6 + 24 | 0 | 0) | 0;
  __stack_pointer = $6 + 64 | 0;
  return;
 }
 
 function std____2__vector_char_2c_20std____2__allocator_char__20_____annotate_delete_28_29_20const($0) {
  $0 = $0 | 0;
  var $4 = 0, $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 12 | 0) >> 2] | 0;
  std____2__vector_char_2c_20std____2__allocator_char__20_____annotate_contiguous_container_28void_20const__2c_20void_20const__2c_20void_20const__2c_20void_20const__29_20const($4 | 0, std____2__vector_char_2c_20std____2__allocator_char__20___data_28_29_20const($4 | 0) | 0 | 0, (std____2__vector_char_2c_20std____2__allocator_char__20___data_28_29_20const($4 | 0) | 0) + (std____2__vector_char_2c_20std____2__allocator_char__20___capacity_28_29_20const($4 | 0) | 0) | 0 | 0, (std____2__vector_char_2c_20std____2__allocator_char__20___data_28_29_20const($4 | 0) | 0) + (std____2__vector_char_2c_20std____2__allocator_char__20___size_28_29_20const($4 | 0) | 0) | 0 | 0, (std____2__vector_char_2c_20std____2__allocator_char__20___data_28_29_20const($4 | 0) | 0) + (std____2__vector_char_2c_20std____2__allocator_char__20___capacity_28_29_20const($4 | 0) | 0) | 0 | 0);
  __stack_pointer = $3 + 16 | 0;
  return;
 }
 
 function std____2____vector_base_char_2c_20std____2__allocator_char__20______vector_base_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $4 = 0, $15 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 8 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 8 | 0) >> 2] | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $4;
  label$1 : {
   if (!((HEAP32[$4 >> 2] | 0 | 0) != (0 | 0) & 1 | 0)) {
    break label$1
   }
   std____2____vector_base_char_2c_20std____2__allocator_char__20___clear_28_29($4 | 0);
   std____2__allocator_traits_std____2__allocator_char__20___deallocate_28std____2__allocator_char___2c_20char__2c_20unsigned_20long_29(std____2____vector_base_char_2c_20std____2__allocator_char__20_____alloc_28_29($4 | 0) | 0 | 0, HEAP32[$4 >> 2] | 0 | 0, std____2____vector_base_char_2c_20std____2__allocator_char__20___capacity_28_29_20const($4 | 0) | 0 | 0);
  }
  $15 = HEAP32[($3 + 12 | 0) >> 2] | 0;
  __stack_pointer = $3 + 16 | 0;
  return $15 | 0;
 }
 
 function std____2__vector_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20_____annotate_delete_28_29_20const($0) {
  $0 = $0 | 0;
  var $4 = 0, $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 12 | 0) >> 2] | 0;
  std____2__vector_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20_____annotate_contiguous_container_28void_20const__2c_20void_20const__2c_20void_20const__2c_20void_20const__29_20const($4 | 0, std____2__vector_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20___data_28_29_20const($4 | 0) | 0 | 0, (std____2__vector_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20___data_28_29_20const($4 | 0) | 0) + Math_imul(std____2__vector_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20___capacity_28_29_20const($4 | 0) | 0, 12) | 0 | 0, (std____2__vector_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20___data_28_29_20const($4 | 0) | 0) + Math_imul(std____2__vector_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20___size_28_29_20const($4 | 0) | 0, 12) | 0 | 0, (std____2__vector_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20___data_28_29_20const($4 | 0) | 0) + Math_imul(std____2__vector_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20___capacity_28_29_20const($4 | 0) | 0, 12) | 0 | 0);
  __stack_pointer = $3 + 16 | 0;
  return;
 }
 
 function std____2____vector_base_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20______vector_base_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $4 = 0, $15 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 8 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 8 | 0) >> 2] | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $4;
  label$1 : {
   if (!((HEAP32[$4 >> 2] | 0 | 0) != (0 | 0) & 1 | 0)) {
    break label$1
   }
   std____2____vector_base_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20___clear_28_29($4 | 0);
   std____2__allocator_traits_std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20___deallocate_28std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20___2c_20std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___2c_20unsigned_20long_29(std____2____vector_base_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20_____alloc_28_29($4 | 0) | 0 | 0, HEAP32[$4 >> 2] | 0 | 0, std____2____vector_base_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20___capacity_28_29_20const($4 | 0) | 0 | 0);
  }
  $15 = HEAP32[($3 + 12 | 0) >> 2] | 0;
  __stack_pointer = $3 + 16 | 0;
  return $15 | 0;
 }
 
 function std____2____wrap_iter_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____base_28_29_20const($0) {
  $0 = $0 | 0;
  var $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  return HEAP32[(HEAP32[($3 + 12 | 0) >> 2] | 0) >> 2] | 0 | 0;
 }
 
 function std____2____shared_count____release_shared_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $4 = 0, $24 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 8 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 8 | 0) >> 2] | 0;
  label$1 : {
   label$2 : {
    if (!((long_20std____2____libcpp_atomic_refcount_decrement_long__28long__29($4 + 4 | 0 | 0) | 0 | 0) == (-1 | 0) & 1 | 0)) {
     break label$2
    }
    FUNCTION_TABLE[HEAP32[((HEAP32[$4 >> 2] | 0) + 8 | 0) >> 2] | 0 | 0]($4);
    HEAP8[($3 + 15 | 0) >> 0] = 1 & 1 | 0;
    break label$1;
   }
   HEAP8[($3 + 15 | 0) >> 0] = 0 & 1 | 0;
  }
  $24 = (HEAPU8[($3 + 15 | 0) >> 0] | 0) & 1 | 0;
  __stack_pointer = $3 + 16 | 0;
  return $24 | 0;
 }
 
 function long_20std____2____libcpp_atomic_refcount_decrement_long__28long__29($0) {
  $0 = $0 | 0;
  var $3 = 0, $4 = 0, $6 = 0, $7 = 0;
  $3 = __stack_pointer - 16 | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 12 | 0) >> 2] | 0;
  HEAP32[($3 + 8 | 0) >> 2] = -1;
  $6 = HEAP32[($3 + 8 | 0) >> 2] | 0;
  $7 = HEAP32[$4 >> 2] | 0;
  HEAP32[$4 >> 2] = $7 + $6 | 0;
  HEAP32[($3 + 4 | 0) >> 2] = $7 + $6 | 0;
  return HEAP32[($3 + 4 | 0) >> 2] | 0 | 0;
 }
 
 function std____2____default_init_tag___20std____2__forward_std____2____default_init_tag__28std____2__remove_reference_std____2____default_init_tag___type__29($0) {
  $0 = $0 | 0;
  var $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  return HEAP32[($3 + 12 | 0) >> 2] | 0 | 0;
 }
 
 function std____2____compressed_pair_elem_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____rep_2c_200_2c_20false_____compressed_pair_elem_28std____2____default_init_tag_29($0) {
  $0 = $0 | 0;
  var $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  HEAP32[($3 + 4 | 0) >> 2] = $0;
  return HEAP32[($3 + 4 | 0) >> 2] | 0 | 0;
 }
 
 function std____2____compressed_pair_elem_std____2__allocator_char__2c_201_2c_20true_____compressed_pair_elem_28std____2____default_init_tag_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $4 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 4 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 4 | 0) >> 2] | 0;
  std____2__allocator_char___allocator_28_29($4 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $4 | 0;
 }
 
 function std____2__allocator_char___allocator_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  return HEAP32[($3 + 12 | 0) >> 2] | 0 | 0;
 }
 
 function std____2____vector_base_common_true_____vector_base_common_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  return HEAP32[($3 + 12 | 0) >> 2] | 0 | 0;
 }
 
 function std____2____compressed_pair_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20_____compressed_pair_std__nullptr_t_2c_20std____2____default_init_tag__28std__nullptr_t___2c_20std____2____default_init_tag___29($0, $1, $2) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  var $5 = 0, $6 = 0;
  $5 = __stack_pointer - 16 | 0;
  __stack_pointer = $5;
  HEAP32[($5 + 12 | 0) >> 2] = $0;
  HEAP32[($5 + 8 | 0) >> 2] = $1;
  HEAP32[($5 + 4 | 0) >> 2] = $2;
  $6 = HEAP32[($5 + 12 | 0) >> 2] | 0;
  std____2____compressed_pair_elem_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___2c_200_2c_20false_____compressed_pair_elem_std__nullptr_t_2c_20void__28std__nullptr_t___29($6 | 0, std__nullptr_t___20std____2__forward_std__nullptr_t__28std____2__remove_reference_std__nullptr_t___type__29(HEAP32[($5 + 8 | 0) >> 2] | 0 | 0) | 0 | 0) | 0;
  std____2____default_init_tag___20std____2__forward_std____2____default_init_tag__28std____2__remove_reference_std____2____default_init_tag___type__29(HEAP32[($5 + 4 | 0) >> 2] | 0 | 0) | 0;
  std____2____compressed_pair_elem_std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__2c_201_2c_20true_____compressed_pair_elem_28std____2____default_init_tag_29($6 | 0) | 0;
  __stack_pointer = $5 + 16 | 0;
  return $6 | 0;
 }
 
 function std__nullptr_t___20std____2__forward_std__nullptr_t__28std____2__remove_reference_std__nullptr_t___type__29($0) {
  $0 = $0 | 0;
  var $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  return HEAP32[($3 + 12 | 0) >> 2] | 0 | 0;
 }
 
 function std____2____compressed_pair_elem_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___2c_200_2c_20false_____compressed_pair_elem_std__nullptr_t_2c_20void__28std__nullptr_t___29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0, $5 = 0;
  $4 = __stack_pointer - 16 | 0;
  __stack_pointer = $4;
  HEAP32[($4 + 12 | 0) >> 2] = $0;
  HEAP32[($4 + 8 | 0) >> 2] = $1;
  $5 = HEAP32[($4 + 12 | 0) >> 2] | 0;
  std__nullptr_t___20std____2__forward_std__nullptr_t__28std____2__remove_reference_std__nullptr_t___type__29(HEAP32[($4 + 8 | 0) >> 2] | 0 | 0) | 0;
  HEAP32[$5 >> 2] = 0;
  __stack_pointer = $4 + 16 | 0;
  return $5 | 0;
 }
 
 function std____2____compressed_pair_elem_std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__2c_201_2c_20true_____compressed_pair_elem_28std____2____default_init_tag_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $4 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 4 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 4 | 0) >> 2] | 0;
  std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20___allocator_28_29($4 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $4 | 0;
 }
 
 function std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20___allocator_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  return HEAP32[($3 + 12 | 0) >> 2] | 0 | 0;
 }
 
 function std____2__vector_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20___data_28_29_20const($0) {
  $0 = $0 | 0;
  var $3 = 0, $6 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $6 = std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___20std____2____to_address_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__28std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___29(HEAP32[(HEAP32[($3 + 12 | 0) >> 2] | 0) >> 2] | 0 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $6 | 0;
 }
 
 function std____2__vector_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20___capacity_28_29_20const($0) {
  $0 = $0 | 0;
  var $3 = 0, $5 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $5 = std____2____vector_base_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20___capacity_28_29_20const(HEAP32[($3 + 12 | 0) >> 2] | 0 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $5 | 0;
 }
 
 function std____2__vector_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20___size_28_29_20const($0) {
  $0 = $0 | 0;
  var $3 = 0, $4 = 0;
  $3 = __stack_pointer - 16 | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 12 | 0) >> 2] | 0;
  return ((HEAP32[($4 + 4 | 0) >> 2] | 0) - (HEAP32[$4 >> 2] | 0) | 0 | 0) / (12 | 0) | 0 | 0;
 }
 
 function std____2__vector_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20_____annotate_contiguous_container_28void_20const__2c_20void_20const__2c_20void_20const__2c_20void_20const__29_20const($0, $1, $2, $3, $4) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  $3 = $3 | 0;
  $4 = $4 | 0;
  var $7 = 0;
  $7 = __stack_pointer - 32 | 0;
  HEAP32[($7 + 28 | 0) >> 2] = $0;
  HEAP32[($7 + 24 | 0) >> 2] = $1;
  HEAP32[($7 + 20 | 0) >> 2] = $2;
  HEAP32[($7 + 16 | 0) >> 2] = $3;
  HEAP32[($7 + 12 | 0) >> 2] = $4;
  return;
 }
 
 function std____2____vector_base_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20___clear_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $4 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 12 | 0) >> 2] | 0;
  std____2____vector_base_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20_____destruct_at_end_28std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___29($4 | 0, HEAP32[$4 >> 2] | 0 | 0);
  __stack_pointer = $3 + 16 | 0;
  return;
 }
 
 function std____2____vector_base_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20_____alloc_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $7 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $7 = std____2____compressed_pair_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20___second_28_29((HEAP32[($3 + 12 | 0) >> 2] | 0) + 8 | 0 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $7 | 0;
 }
 
 function std____2____vector_base_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20___capacity_28_29_20const($0) {
  $0 = $0 | 0;
  var $3 = 0, $4 = 0, $10 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 12 | 0) >> 2] | 0;
  $10 = ((HEAP32[(std____2____vector_base_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20_____end_cap_28_29_20const($4 | 0) | 0) >> 2] | 0) - (HEAP32[$4 >> 2] | 0) | 0 | 0) / (12 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $10 | 0;
 }
 
 function std____2__allocator_traits_std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20___deallocate_28std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20___2c_20std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___2c_20unsigned_20long_29($0, $1, $2) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  var $5 = 0;
  $5 = __stack_pointer - 16 | 0;
  __stack_pointer = $5;
  HEAP32[($5 + 12 | 0) >> 2] = $0;
  HEAP32[($5 + 8 | 0) >> 2] = $1;
  HEAP32[($5 + 4 | 0) >> 2] = $2;
  std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20___deallocate_28std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___2c_20unsigned_20long_29(HEAP32[($5 + 12 | 0) >> 2] | 0 | 0, HEAP32[($5 + 8 | 0) >> 2] | 0 | 0, HEAP32[($5 + 4 | 0) >> 2] | 0 | 0);
  __stack_pointer = $5 + 16 | 0;
  return;
 }
 
 function std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___20std____2____to_address_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__28std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___29($0) {
  $0 = $0 | 0;
  var $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  return HEAP32[($3 + 12 | 0) >> 2] | 0 | 0;
 }
 
 function std____2____vector_base_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20_____end_cap_28_29_20const($0) {
  $0 = $0 | 0;
  var $3 = 0, $7 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $7 = std____2____compressed_pair_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20___first_28_29_20const((HEAP32[($3 + 12 | 0) >> 2] | 0) + 8 | 0 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $7 | 0;
 }
 
 function std____2____compressed_pair_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20___first_28_29_20const($0) {
  $0 = $0 | 0;
  var $3 = 0, $5 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $5 = std____2____compressed_pair_elem_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___2c_200_2c_20false_____get_28_29_20const(HEAP32[($3 + 12 | 0) >> 2] | 0 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $5 | 0;
 }
 
 function std____2____compressed_pair_elem_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___2c_200_2c_20false_____get_28_29_20const($0) {
  $0 = $0 | 0;
  var $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  return HEAP32[($3 + 12 | 0) >> 2] | 0 | 0;
 }
 
 function std____2____vector_base_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20_____destruct_at_end_28std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0, $5 = 0, $17 = 0, $14 = 0;
  $4 = __stack_pointer - 16 | 0;
  __stack_pointer = $4;
  HEAP32[($4 + 12 | 0) >> 2] = $0;
  HEAP32[($4 + 8 | 0) >> 2] = $1;
  $5 = HEAP32[($4 + 12 | 0) >> 2] | 0;
  HEAP32[($4 + 4 | 0) >> 2] = HEAP32[($5 + 4 | 0) >> 2] | 0;
  label$1 : {
   label$2 : while (1) {
    if (!((HEAP32[($4 + 8 | 0) >> 2] | 0 | 0) != (HEAP32[($4 + 4 | 0) >> 2] | 0 | 0) & 1 | 0)) {
     break label$1
    }
    $14 = std____2____vector_base_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20_____alloc_28_29($5 | 0) | 0;
    $17 = (HEAP32[($4 + 4 | 0) >> 2] | 0) + -12 | 0;
    HEAP32[($4 + 4 | 0) >> 2] = $17;
    void_20std____2__allocator_traits_std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20___destroy_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20void__28std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20___2c_20std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___29($14 | 0, std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___20std____2____to_address_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__28std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___29($17 | 0) | 0 | 0);
    continue label$2;
   };
  }
  HEAP32[($5 + 4 | 0) >> 2] = HEAP32[($4 + 8 | 0) >> 2] | 0;
  __stack_pointer = $4 + 16 | 0;
  return;
 }
 
 function std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20___deallocate_28std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___2c_20unsigned_20long_29($0, $1, $2) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  var $5 = 0;
  $5 = __stack_pointer - 16 | 0;
  __stack_pointer = $5;
  HEAP32[($5 + 12 | 0) >> 2] = $0;
  HEAP32[($5 + 8 | 0) >> 2] = $1;
  HEAP32[($5 + 4 | 0) >> 2] = $2;
  std____2____libcpp_deallocate_28void__2c_20unsigned_20long_2c_20unsigned_20long_29(HEAP32[($5 + 8 | 0) >> 2] | 0 | 0, Math_imul(HEAP32[($5 + 4 | 0) >> 2] | 0, 12) | 0, 4 | 0);
  __stack_pointer = $5 + 16 | 0;
  return;
 }
 
 function std____2____compressed_pair_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20___second_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $5 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $5 = std____2____compressed_pair_elem_std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__2c_201_2c_20true_____get_28_29(HEAP32[($3 + 12 | 0) >> 2] | 0 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $5 | 0;
 }
 
 function void_20std____2__allocator_traits_std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20___destroy_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20void__28std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20___2c_20std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0;
  $4 = __stack_pointer - 16 | 0;
  __stack_pointer = $4;
  HEAP32[($4 + 12 | 0) >> 2] = $0;
  HEAP32[($4 + 8 | 0) >> 2] = $1;
  std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20___destroy_28std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___29(HEAP32[($4 + 12 | 0) >> 2] | 0 | 0, HEAP32[($4 + 8 | 0) >> 2] | 0 | 0);
  __stack_pointer = $4 + 16 | 0;
  return;
 }
 
 function std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20___destroy_28std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0;
  $4 = __stack_pointer - 16 | 0;
  __stack_pointer = $4;
  HEAP32[($4 + 12 | 0) >> 2] = $0;
  HEAP32[($4 + 8 | 0) >> 2] = $1;
  std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20____basic_string_28_29(HEAP32[($4 + 8 | 0) >> 2] | 0 | 0) | 0;
  __stack_pointer = $4 + 16 | 0;
  return;
 }
 
 function std____2____libcpp_deallocate_28void__2c_20unsigned_20long_2c_20unsigned_20long_29($0, $1, $2) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  var $5 = 0;
  $5 = __stack_pointer - 16 | 0;
  __stack_pointer = $5;
  HEAP32[($5 + 12 | 0) >> 2] = $0;
  HEAP32[($5 + 8 | 0) >> 2] = $1;
  HEAP32[($5 + 4 | 0) >> 2] = $2;
  void_20std____2____do_deallocate_handle_size___28void__2c_20unsigned_20long_29(HEAP32[($5 + 12 | 0) >> 2] | 0 | 0, HEAP32[($5 + 8 | 0) >> 2] | 0 | 0);
  __stack_pointer = $5 + 16 | 0;
  return;
 }
 
 function void_20std____2____do_deallocate_handle_size___28void__2c_20unsigned_20long_29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0;
  $4 = __stack_pointer - 16 | 0;
  __stack_pointer = $4;
  HEAP32[($4 + 12 | 0) >> 2] = $0;
  HEAP32[($4 + 8 | 0) >> 2] = $1;
  void_20std____2____libcpp_operator_delete_void___28void__29(HEAP32[($4 + 12 | 0) >> 2] | 0 | 0);
  __stack_pointer = $4 + 16 | 0;
  return;
 }
 
 function void_20std____2____libcpp_operator_delete_void___28void__29($0) {
  $0 = $0 | 0;
  var $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  operator_20delete_28void__29(HEAP32[($3 + 12 | 0) >> 2] | 0 | 0);
  __stack_pointer = $3 + 16 | 0;
  return;
 }
 
 function std____2____compressed_pair_elem_std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__2c_201_2c_20true_____get_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  return HEAP32[($3 + 12 | 0) >> 2] | 0 | 0;
 }
 
 function std____2____compressed_pair_elem_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____rep_2c_200_2c_20false_____get_28_29_20const($0) {
  $0 = $0 | 0;
  var $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  return HEAP32[($3 + 12 | 0) >> 2] | 0 | 0;
 }
 
 function std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____get_long_pointer_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $6 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $6 = HEAP32[(std____2____compressed_pair_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____rep_2c_20std____2__allocator_char__20___first_28_29(HEAP32[($3 + 12 | 0) >> 2] | 0 | 0) | 0) >> 2] | 0;
  __stack_pointer = $3 + 16 | 0;
  return $6 | 0;
 }
 
 function std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____get_short_pointer_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $6 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $6 = std____2__pointer_traits_char____pointer_to_28char__29(std____2____compressed_pair_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____rep_2c_20std____2__allocator_char__20___first_28_29(HEAP32[($3 + 12 | 0) >> 2] | 0 | 0) | 0 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $6 | 0;
 }
 
 function std____2__pointer_traits_char____pointer_to_28char__29($0) {
  $0 = $0 | 0;
  var $3 = 0, $5 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $5 = char__20std____2__addressof_char__28char__29(HEAP32[($3 + 12 | 0) >> 2] | 0 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $5 | 0;
 }
 
 function std____2____compressed_pair_elem_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____rep_2c_200_2c_20false_____get_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  return HEAP32[($3 + 12 | 0) >> 2] | 0 | 0;
 }
 
 function char__20std____2__addressof_char__28char__29($0) {
  $0 = $0 | 0;
  var $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  return HEAP32[($3 + 12 | 0) >> 2] | 0 | 0;
 }
 
 function std____2____compressed_pair_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20___first_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $5 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $5 = std____2____compressed_pair_elem_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___2c_200_2c_20false_____get_28_29(HEAP32[($3 + 12 | 0) >> 2] | 0 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $5 | 0;
 }
 
 function std____2__vector_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20____ConstructTransaction___ConstructTransaction_28std____2__vector_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20___2c_20unsigned_20long_29($0, $1, $2) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  var $5 = 0, $6 = 0;
  $5 = __stack_pointer - 16 | 0;
  HEAP32[($5 + 12 | 0) >> 2] = $0;
  HEAP32[($5 + 8 | 0) >> 2] = $1;
  HEAP32[($5 + 4 | 0) >> 2] = $2;
  $6 = HEAP32[($5 + 12 | 0) >> 2] | 0;
  HEAP32[$6 >> 2] = HEAP32[($5 + 8 | 0) >> 2] | 0;
  HEAP32[($6 + 4 | 0) >> 2] = HEAP32[((HEAP32[($5 + 8 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0;
  HEAP32[($6 + 8 | 0) >> 2] = (HEAP32[((HEAP32[($5 + 8 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0) + Math_imul(HEAP32[($5 + 4 | 0) >> 2] | 0, 12) | 0;
  return $6 | 0;
 }
 
 function std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20const__20std____2__forward_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20const___28std____2__remove_reference_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20const____type__29($0) {
  $0 = $0 | 0;
  var $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  return HEAP32[($3 + 12 | 0) >> 2] | 0 | 0;
 }
 
 function void_20std____2__allocator_traits_std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20___construct_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20const__2c_20void__28std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20___2c_20std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___2c_20std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20const__29($0, $1, $2) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  var $5 = 0;
  $5 = __stack_pointer - 16 | 0;
  __stack_pointer = $5;
  HEAP32[($5 + 12 | 0) >> 2] = $0;
  HEAP32[($5 + 8 | 0) >> 2] = $1;
  HEAP32[($5 + 4 | 0) >> 2] = $2;
  void_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20___construct_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20const___28std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___2c_20std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20const__29(HEAP32[($5 + 12 | 0) >> 2] | 0 | 0, HEAP32[($5 + 8 | 0) >> 2] | 0 | 0, std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20const__20std____2__forward_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20const___28std____2__remove_reference_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20const____type__29(HEAP32[($5 + 4 | 0) >> 2] | 0 | 0) | 0 | 0);
  __stack_pointer = $5 + 16 | 0;
  return;
 }
 
 function std____2__vector_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20____ConstructTransaction____ConstructTransaction_28_29($0) {
  $0 = $0 | 0;
  var $4 = 0, $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 12 | 0) >> 2] | 0;
  HEAP32[((HEAP32[$4 >> 2] | 0) + 4 | 0) >> 2] = HEAP32[($4 + 4 | 0) >> 2] | 0;
  return $4 | 0;
 }
 
 function std____2__vector_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20_____recommend_28unsigned_20long_29_20const($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0, $5 = 0, $36 = 0;
  $4 = __stack_pointer - 32 | 0;
  __stack_pointer = $4;
  HEAP32[($4 + 24 | 0) >> 2] = $0;
  HEAP32[($4 + 20 | 0) >> 2] = $1;
  $5 = HEAP32[($4 + 24 | 0) >> 2] | 0;
  HEAP32[($4 + 16 | 0) >> 2] = std____2__vector_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20___max_size_28_29_20const($5 | 0) | 0;
  label$1 : {
   if (!((HEAP32[($4 + 20 | 0) >> 2] | 0) >>> 0 > (HEAP32[($4 + 16 | 0) >> 2] | 0) >>> 0 & 1 | 0)) {
    break label$1
   }
   std____2____vector_base_common_true_____throw_length_error_28_29_20const($5 | 0);
   abort();
  }
  HEAP32[($4 + 12 | 0) >> 2] = std____2__vector_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20___capacity_28_29_20const($5 | 0) | 0;
  label$2 : {
   label$3 : {
    if (!((HEAP32[($4 + 12 | 0) >> 2] | 0) >>> 0 >= ((HEAP32[($4 + 16 | 0) >> 2] | 0) >>> 1 | 0) >>> 0 & 1 | 0)) {
     break label$3
    }
    HEAP32[($4 + 28 | 0) >> 2] = HEAP32[($4 + 16 | 0) >> 2] | 0;
    break label$2;
   }
   HEAP32[($4 + 8 | 0) >> 2] = (HEAP32[($4 + 12 | 0) >> 2] | 0) << 1 | 0;
   HEAP32[($4 + 28 | 0) >> 2] = HEAP32[(unsigned_20long_20const__20std____2__max_unsigned_20long__28unsigned_20long_20const__2c_20unsigned_20long_20const__29($4 + 8 | 0 | 0, $4 + 20 | 0 | 0) | 0) >> 2] | 0;
  }
  $36 = HEAP32[($4 + 28 | 0) >> 2] | 0;
  __stack_pointer = $4 + 32 | 0;
  return $36 | 0;
 }
 
 function std____2____split_buffer_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20_______split_buffer_28unsigned_20long_2c_20unsigned_20long_2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20___29($0, $1, $2, $3) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  $3 = $3 | 0;
  var $6 = 0, $7 = 0, $19 = 0, $26 = 0, $31 = 0, $33 = 0;
  $6 = __stack_pointer - 32 | 0;
  __stack_pointer = $6;
  HEAP32[($6 + 24 | 0) >> 2] = $0;
  HEAP32[($6 + 20 | 0) >> 2] = $1;
  HEAP32[($6 + 16 | 0) >> 2] = $2;
  HEAP32[($6 + 12 | 0) >> 2] = $3;
  $7 = HEAP32[($6 + 24 | 0) >> 2] | 0;
  HEAP32[($6 + 28 | 0) >> 2] = $7;
  HEAP32[($6 + 8 | 0) >> 2] = 0;
  std____2____compressed_pair_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20_______compressed_pair_std__nullptr_t_2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20____28std__nullptr_t___2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20___29($7 + 12 | 0 | 0, $6 + 8 | 0 | 0, HEAP32[($6 + 12 | 0) >> 2] | 0 | 0) | 0;
  label$1 : {
   label$2 : {
    if (!(HEAP32[($6 + 20 | 0) >> 2] | 0)) {
     break label$2
    }
    $19 = std____2__allocator_traits_std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20___allocate_28std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20___2c_20unsigned_20long_29(std____2____split_buffer_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20_______alloc_28_29($7 | 0) | 0 | 0, HEAP32[($6 + 20 | 0) >> 2] | 0 | 0) | 0;
    break label$1;
   }
   $19 = 0;
  }
  HEAP32[$7 >> 2] = $19;
  $26 = (HEAP32[$7 >> 2] | 0) + Math_imul(HEAP32[($6 + 16 | 0) >> 2] | 0, 12) | 0;
  HEAP32[($7 + 8 | 0) >> 2] = $26;
  HEAP32[($7 + 4 | 0) >> 2] = $26;
  $31 = (HEAP32[$7 >> 2] | 0) + Math_imul(HEAP32[($6 + 20 | 0) >> 2] | 0, 12) | 0;
  HEAP32[(std____2____split_buffer_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20_______end_cap_28_29($7 | 0) | 0) >> 2] = $31;
  $33 = HEAP32[($6 + 28 | 0) >> 2] | 0;
  __stack_pointer = $6 + 32 | 0;
  return $33 | 0;
 }
 
 function std____2__vector_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20_____swap_out_circular_buffer_28std____2____split_buffer_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20_____29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0, $5 = 0;
  $4 = __stack_pointer - 16 | 0;
  __stack_pointer = $4;
  HEAP32[($4 + 12 | 0) >> 2] = $0;
  HEAP32[($4 + 8 | 0) >> 2] = $1;
  $5 = HEAP32[($4 + 12 | 0) >> 2] | 0;
  std____2__vector_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20_____annotate_delete_28_29_20const($5 | 0);
  void_20std____2____construct_backward_with_exception_guarantees_std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__2c_20std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20____28std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20___2c_20std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___2c_20std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___2c_20std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20____29(std____2____vector_base_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20_____alloc_28_29($5 | 0) | 0 | 0, HEAP32[$5 >> 2] | 0 | 0, HEAP32[($5 + 4 | 0) >> 2] | 0 | 0, (HEAP32[($4 + 8 | 0) >> 2] | 0) + 4 | 0 | 0);
  std____2__enable_if__28is_move_constructible_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____value_29_20___20_28is_move_assignable_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____value_29_2c_20void___type_20std____2__swap_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20____28std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20____2c_20std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20____29($5 | 0, (HEAP32[($4 + 8 | 0) >> 2] | 0) + 4 | 0 | 0);
  std____2__enable_if__28is_move_constructible_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____value_29_20___20_28is_move_assignable_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____value_29_2c_20void___type_20std____2__swap_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20____28std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20____2c_20std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20____29($5 + 4 | 0 | 0, (HEAP32[($4 + 8 | 0) >> 2] | 0) + 8 | 0 | 0);
  std____2__enable_if__28is_move_constructible_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____value_29_20___20_28is_move_assignable_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____value_29_2c_20void___type_20std____2__swap_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20____28std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20____2c_20std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20____29(std____2____vector_base_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20_____end_cap_28_29($5 | 0) | 0 | 0, std____2____split_buffer_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20_______end_cap_28_29(HEAP32[($4 + 8 | 0) >> 2] | 0 | 0) | 0 | 0);
  HEAP32[(HEAP32[($4 + 8 | 0) >> 2] | 0) >> 2] = HEAP32[((HEAP32[($4 + 8 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0;
  std____2__vector_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20_____annotate_new_28unsigned_20long_29_20const($5 | 0, std____2__vector_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20___size_28_29_20const($5 | 0) | 0 | 0);
  std____2__vector_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20_____invalidate_all_iterators_28_29($5 | 0);
  __stack_pointer = $4 + 16 | 0;
  return;
 }
 
 function std____2____split_buffer_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20________split_buffer_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $4 = 0, $15 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 8 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 8 | 0) >> 2] | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $4;
  std____2____split_buffer_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20_____clear_28_29($4 | 0);
  label$1 : {
   if (!((HEAP32[$4 >> 2] | 0 | 0) != (0 | 0) & 1 | 0)) {
    break label$1
   }
   std____2__allocator_traits_std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20___deallocate_28std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20___2c_20std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___2c_20unsigned_20long_29(std____2____split_buffer_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20_______alloc_28_29($4 | 0) | 0 | 0, HEAP32[$4 >> 2] | 0 | 0, std____2____split_buffer_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20_____capacity_28_29_20const($4 | 0) | 0 | 0);
  }
  $15 = HEAP32[($3 + 12 | 0) >> 2] | 0;
  __stack_pointer = $3 + 16 | 0;
  return $15 | 0;
 }
 
 function std____2____compressed_pair_elem_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___2c_200_2c_20false_____get_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  return HEAP32[($3 + 12 | 0) >> 2] | 0 | 0;
 }
 
 function void_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20___construct_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20const___28std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___2c_20std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20const__29($0, $1, $2) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  var $5 = 0;
  $5 = __stack_pointer - 16 | 0;
  __stack_pointer = $5;
  HEAP32[($5 + 12 | 0) >> 2] = $0;
  HEAP32[($5 + 8 | 0) >> 2] = $1;
  HEAP32[($5 + 4 | 0) >> 2] = $2;
  std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___basic_string_28std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20const__29(HEAP32[($5 + 8 | 0) >> 2] | 0 | 0, std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20const__20std____2__forward_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20const___28std____2__remove_reference_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20const____type__29(HEAP32[($5 + 4 | 0) >> 2] | 0 | 0) | 0 | 0) | 0;
  __stack_pointer = $5 + 16 | 0;
  return;
 }
 
 function std____2__vector_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20___max_size_28_29_20const($0) {
  $0 = $0 | 0;
  var $3 = 0, $15 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  HEAP32[($3 + 8 | 0) >> 2] = unsigned_20long_20std____2__allocator_traits_std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20___max_size_std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__2c_20void__28std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20const__29(std____2____vector_base_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20_____alloc_28_29_20const(HEAP32[($3 + 12 | 0) >> 2] | 0 | 0) | 0 | 0) | 0;
  HEAP32[($3 + 4 | 0) >> 2] = std____2__numeric_limits_long___max_28_29() | 0;
  $15 = HEAP32[(unsigned_20long_20const__20std____2__min_unsigned_20long__28unsigned_20long_20const__2c_20unsigned_20long_20const__29($3 + 8 | 0 | 0, $3 + 4 | 0 | 0) | 0) >> 2] | 0;
  __stack_pointer = $3 + 16 | 0;
  return $15 | 0;
 }
 
 function unsigned_20long_20const__20std____2__max_unsigned_20long__28unsigned_20long_20const__2c_20unsigned_20long_20const__29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0, $7 = 0;
  $4 = __stack_pointer - 16 | 0;
  __stack_pointer = $4;
  HEAP32[($4 + 12 | 0) >> 2] = $0;
  HEAP32[($4 + 8 | 0) >> 2] = $1;
  $7 = unsigned_20long_20const__20std____2__max_unsigned_20long_2c_20std____2____less_unsigned_20long_2c_20unsigned_20long__20__28unsigned_20long_20const__2c_20unsigned_20long_20const__2c_20std____2____less_unsigned_20long_2c_20unsigned_20long__29(HEAP32[($4 + 12 | 0) >> 2] | 0 | 0, HEAP32[($4 + 8 | 0) >> 2] | 0 | 0) | 0;
  __stack_pointer = $4 + 16 | 0;
  return $7 | 0;
 }
 
 function std____2____compressed_pair_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20_______compressed_pair_std__nullptr_t_2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20____28std__nullptr_t___2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20___29($0, $1, $2) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  var $5 = 0, $6 = 0;
  $5 = __stack_pointer - 16 | 0;
  __stack_pointer = $5;
  HEAP32[($5 + 12 | 0) >> 2] = $0;
  HEAP32[($5 + 8 | 0) >> 2] = $1;
  HEAP32[($5 + 4 | 0) >> 2] = $2;
  $6 = HEAP32[($5 + 12 | 0) >> 2] | 0;
  std____2____compressed_pair_elem_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___2c_200_2c_20false_____compressed_pair_elem_std__nullptr_t_2c_20void__28std__nullptr_t___29($6 | 0, std__nullptr_t___20std____2__forward_std__nullptr_t__28std____2__remove_reference_std__nullptr_t___type__29(HEAP32[($5 + 8 | 0) >> 2] | 0 | 0) | 0 | 0) | 0;
  std____2____compressed_pair_elem_std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20___2c_201_2c_20false_____compressed_pair_elem_std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20___2c_20void__28std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20___29($6 + 4 | 0 | 0, std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20___20std____2__forward_std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20____28std____2__remove_reference_std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20_____type__29(HEAP32[($5 + 4 | 0) >> 2] | 0 | 0) | 0 | 0) | 0;
  __stack_pointer = $5 + 16 | 0;
  return $6 | 0;
 }
 
 function std____2____split_buffer_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20_______alloc_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $7 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $7 = std____2____compressed_pair_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20_____second_28_29((HEAP32[($3 + 12 | 0) >> 2] | 0) + 12 | 0 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $7 | 0;
 }
 
 function std____2__allocator_traits_std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20___allocate_28std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20___2c_20unsigned_20long_29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0, $7 = 0;
  $4 = __stack_pointer - 16 | 0;
  __stack_pointer = $4;
  HEAP32[($4 + 12 | 0) >> 2] = $0;
  HEAP32[($4 + 8 | 0) >> 2] = $1;
  $7 = std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20___allocate_28unsigned_20long_29(HEAP32[($4 + 12 | 0) >> 2] | 0 | 0, HEAP32[($4 + 8 | 0) >> 2] | 0 | 0) | 0;
  __stack_pointer = $4 + 16 | 0;
  return $7 | 0;
 }
 
 function std____2____split_buffer_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20_______end_cap_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $7 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $7 = std____2____compressed_pair_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20_____first_28_29((HEAP32[($3 + 12 | 0) >> 2] | 0) + 12 | 0 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $7 | 0;
 }
 
 function void_20std____2____construct_backward_with_exception_guarantees_std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__2c_20std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20____28std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20___2c_20std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___2c_20std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___2c_20std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20____29($0, $1, $2, $3) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  $3 = $3 | 0;
  var $6 = 0, $22 = 0, $24 = 0, $14 = 0, $19 = 0;
  $6 = __stack_pointer - 16 | 0;
  __stack_pointer = $6;
  HEAP32[($6 + 12 | 0) >> 2] = $0;
  HEAP32[($6 + 8 | 0) >> 2] = $1;
  HEAP32[($6 + 4 | 0) >> 2] = $2;
  HEAP32[$6 >> 2] = $3;
  label$1 : {
   label$2 : while (1) {
    if (!((HEAP32[($6 + 4 | 0) >> 2] | 0 | 0) != (HEAP32[($6 + 8 | 0) >> 2] | 0 | 0) & 1 | 0)) {
     break label$1
    }
    $14 = HEAP32[($6 + 12 | 0) >> 2] | 0;
    $19 = std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___20std____2____to_address_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__28std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___29((HEAP32[(HEAP32[$6 >> 2] | 0) >> 2] | 0) + -12 | 0 | 0) | 0;
    $22 = (HEAP32[($6 + 4 | 0) >> 2] | 0) + -12 | 0;
    HEAP32[($6 + 4 | 0) >> 2] = $22;
    void_20std____2__allocator_traits_std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20___construct_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20void__28std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20___2c_20std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___2c_20std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20____29($14 | 0, $19 | 0, std____2__conditional__28__28is_nothrow_move_constructible_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20___value_29_29_20___20_28is_copy_constructible_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20___value_29_2c_20std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20const__2c_20std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20______type_20std____2__move_if_noexcept_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__28std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___29($22 | 0) | 0 | 0);
    $24 = HEAP32[$6 >> 2] | 0;
    HEAP32[$24 >> 2] = (HEAP32[$24 >> 2] | 0) + -12 | 0;
    continue label$2;
   };
  }
  __stack_pointer = $6 + 16 | 0;
  return;
 }
 
 function std____2__enable_if__28is_move_constructible_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____value_29_20___20_28is_move_assignable_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____value_29_2c_20void___type_20std____2__swap_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20____28std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20____2c_20std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20____29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0, $10 = 0, $16 = 0;
  $4 = __stack_pointer - 16 | 0;
  __stack_pointer = $4;
  HEAP32[($4 + 12 | 0) >> 2] = $0;
  HEAP32[($4 + 8 | 0) >> 2] = $1;
  HEAP32[($4 + 4 | 0) >> 2] = HEAP32[(std____2__remove_reference_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20______type___20std____2__move_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____28std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20____29(HEAP32[($4 + 12 | 0) >> 2] | 0 | 0) | 0) >> 2] | 0;
  $10 = HEAP32[(std____2__remove_reference_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20______type___20std____2__move_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____28std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20____29(HEAP32[($4 + 8 | 0) >> 2] | 0 | 0) | 0) >> 2] | 0;
  HEAP32[(HEAP32[($4 + 12 | 0) >> 2] | 0) >> 2] = $10;
  $16 = HEAP32[(std____2__remove_reference_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20______type___20std____2__move_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____28std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20____29($4 + 4 | 0 | 0) | 0) >> 2] | 0;
  HEAP32[(HEAP32[($4 + 8 | 0) >> 2] | 0) >> 2] = $16;
  __stack_pointer = $4 + 16 | 0;
  return;
 }
 
 function std____2__vector_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20_____annotate_new_28unsigned_20long_29_20const($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $5 = 0, $4 = 0;
  $4 = __stack_pointer - 16 | 0;
  __stack_pointer = $4;
  HEAP32[($4 + 12 | 0) >> 2] = $0;
  HEAP32[($4 + 8 | 0) >> 2] = $1;
  $5 = HEAP32[($4 + 12 | 0) >> 2] | 0;
  std____2__vector_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20_____annotate_contiguous_container_28void_20const__2c_20void_20const__2c_20void_20const__2c_20void_20const__29_20const($5 | 0, std____2__vector_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20___data_28_29_20const($5 | 0) | 0 | 0, (std____2__vector_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20___data_28_29_20const($5 | 0) | 0) + Math_imul(std____2__vector_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20___capacity_28_29_20const($5 | 0) | 0, 12) | 0 | 0, (std____2__vector_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20___data_28_29_20const($5 | 0) | 0) + Math_imul(std____2__vector_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20___capacity_28_29_20const($5 | 0) | 0, 12) | 0 | 0, (std____2__vector_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20___data_28_29_20const($5 | 0) | 0) + Math_imul(HEAP32[($4 + 8 | 0) >> 2] | 0, 12) | 0 | 0);
  __stack_pointer = $4 + 16 | 0;
  return;
 }
 
 function std____2__vector_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20_____invalidate_all_iterators_28_29($0) {
  $0 = $0 | 0;
  HEAP32[((__stack_pointer - 16 | 0) + 12 | 0) >> 2] = $0;
  return;
 }
 
 function std____2____split_buffer_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20_____clear_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $4 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 12 | 0) >> 2] | 0;
  std____2____split_buffer_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20_______destruct_at_end_28std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___29($4 | 0, HEAP32[($4 + 4 | 0) >> 2] | 0 | 0);
  __stack_pointer = $3 + 16 | 0;
  return;
 }
 
 function std____2____split_buffer_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20_____capacity_28_29_20const($0) {
  $0 = $0 | 0;
  var $3 = 0, $4 = 0, $10 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 12 | 0) >> 2] | 0;
  $10 = ((HEAP32[(std____2____split_buffer_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20_______end_cap_28_29_20const($4 | 0) | 0) >> 2] | 0) - (HEAP32[$4 >> 2] | 0) | 0 | 0) / (12 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $10 | 0;
 }
 
 function std____2____vector_base_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20_____alloc_28_29_20const($0) {
  $0 = $0 | 0;
  var $3 = 0, $7 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $7 = std____2____compressed_pair_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20___second_28_29_20const((HEAP32[($3 + 12 | 0) >> 2] | 0) + 8 | 0 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $7 | 0;
 }
 
 function unsigned_20long_20std____2__allocator_traits_std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20___max_size_std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__2c_20void__28std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20const__29($0) {
  $0 = $0 | 0;
  var $3 = 0, $5 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $5 = std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20___max_size_28_29_20const(HEAP32[($3 + 12 | 0) >> 2] | 0 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $5 | 0;
 }
 
 function std____2__numeric_limits_long___max_28_29() {
  return std____2____libcpp_numeric_limits_long_2c_20true___max_28_29() | 0 | 0;
 }
 
 function unsigned_20long_20const__20std____2__min_unsigned_20long__28unsigned_20long_20const__2c_20unsigned_20long_20const__29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0, $7 = 0;
  $4 = __stack_pointer - 16 | 0;
  __stack_pointer = $4;
  HEAP32[($4 + 12 | 0) >> 2] = $0;
  HEAP32[($4 + 8 | 0) >> 2] = $1;
  $7 = unsigned_20long_20const__20std____2__min_unsigned_20long_2c_20std____2____less_unsigned_20long_2c_20unsigned_20long__20__28unsigned_20long_20const__2c_20unsigned_20long_20const__2c_20std____2____less_unsigned_20long_2c_20unsigned_20long__29(HEAP32[($4 + 12 | 0) >> 2] | 0 | 0, HEAP32[($4 + 8 | 0) >> 2] | 0 | 0) | 0;
  __stack_pointer = $4 + 16 | 0;
  return $7 | 0;
 }
 
 function unsigned_20long_20const__20std____2__max_unsigned_20long_2c_20std____2____less_unsigned_20long_2c_20unsigned_20long__20__28unsigned_20long_20const__2c_20unsigned_20long_20const__2c_20std____2____less_unsigned_20long_2c_20unsigned_20long__29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0, $14 = 0;
  $4 = __stack_pointer - 16 | 0;
  __stack_pointer = $4;
  HEAP32[($4 + 4 | 0) >> 2] = $0;
  HEAP32[$4 >> 2] = $1;
  label$1 : {
   label$2 : {
    if (!((std____2____less_unsigned_20long_2c_20unsigned_20long___operator_28_29_28unsigned_20long_20const__2c_20unsigned_20long_20const__29_20const($4 + 8 | 0 | 0, HEAP32[($4 + 4 | 0) >> 2] | 0 | 0, HEAP32[$4 >> 2] | 0 | 0) | 0) & 1 | 0)) {
     break label$2
    }
    $14 = HEAP32[$4 >> 2] | 0;
    break label$1;
   }
   $14 = HEAP32[($4 + 4 | 0) >> 2] | 0;
  }
  __stack_pointer = $4 + 16 | 0;
  return $14 | 0;
 }
 
 function unsigned_20long_20const__20std____2__min_unsigned_20long_2c_20std____2____less_unsigned_20long_2c_20unsigned_20long__20__28unsigned_20long_20const__2c_20unsigned_20long_20const__2c_20std____2____less_unsigned_20long_2c_20unsigned_20long__29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0, $14 = 0;
  $4 = __stack_pointer - 16 | 0;
  __stack_pointer = $4;
  HEAP32[($4 + 4 | 0) >> 2] = $0;
  HEAP32[$4 >> 2] = $1;
  label$1 : {
   label$2 : {
    if (!((std____2____less_unsigned_20long_2c_20unsigned_20long___operator_28_29_28unsigned_20long_20const__2c_20unsigned_20long_20const__29_20const($4 + 8 | 0 | 0, HEAP32[$4 >> 2] | 0 | 0, HEAP32[($4 + 4 | 0) >> 2] | 0 | 0) | 0) & 1 | 0)) {
     break label$2
    }
    $14 = HEAP32[$4 >> 2] | 0;
    break label$1;
   }
   $14 = HEAP32[($4 + 4 | 0) >> 2] | 0;
  }
  __stack_pointer = $4 + 16 | 0;
  return $14 | 0;
 }
 
 function std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20___max_size_28_29_20const($0) {
  $0 = $0 | 0;
  HEAP32[((__stack_pointer - 16 | 0) + 12 | 0) >> 2] = $0;
  return 357913941 | 0;
 }
 
 function std____2____compressed_pair_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20___second_28_29_20const($0) {
  $0 = $0 | 0;
  var $3 = 0, $5 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $5 = std____2____compressed_pair_elem_std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__2c_201_2c_20true_____get_28_29_20const(HEAP32[($3 + 12 | 0) >> 2] | 0 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $5 | 0;
 }
 
 function std____2____libcpp_numeric_limits_long_2c_20true___max_28_29() {
  return 2147483647 | 0;
 }
 
 function std____2____less_unsigned_20long_2c_20unsigned_20long___operator_28_29_28unsigned_20long_20const__2c_20unsigned_20long_20const__29_20const($0, $1, $2) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  var $5 = 0;
  $5 = __stack_pointer - 16 | 0;
  HEAP32[($5 + 12 | 0) >> 2] = $0;
  HEAP32[($5 + 8 | 0) >> 2] = $1;
  HEAP32[($5 + 4 | 0) >> 2] = $2;
  return (HEAP32[(HEAP32[($5 + 8 | 0) >> 2] | 0) >> 2] | 0) >>> 0 < (HEAP32[(HEAP32[($5 + 4 | 0) >> 2] | 0) >> 2] | 0) >>> 0 & 1 | 0 | 0;
 }
 
 function std____2____compressed_pair_elem_std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__2c_201_2c_20true_____get_28_29_20const($0) {
  $0 = $0 | 0;
  var $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  return HEAP32[($3 + 12 | 0) >> 2] | 0 | 0;
 }
 
 function std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20___20std____2__forward_std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20____28std____2__remove_reference_std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20_____type__29($0) {
  $0 = $0 | 0;
  var $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  return HEAP32[($3 + 12 | 0) >> 2] | 0 | 0;
 }
 
 function std____2____compressed_pair_elem_std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20___2c_201_2c_20false_____compressed_pair_elem_std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20___2c_20void__28std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20___29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0, $5 = 0;
  $4 = __stack_pointer - 16 | 0;
  __stack_pointer = $4;
  HEAP32[($4 + 12 | 0) >> 2] = $0;
  HEAP32[($4 + 8 | 0) >> 2] = $1;
  $5 = HEAP32[($4 + 12 | 0) >> 2] | 0;
  HEAP32[$5 >> 2] = std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20___20std____2__forward_std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20____28std____2__remove_reference_std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20_____type__29(HEAP32[($4 + 8 | 0) >> 2] | 0 | 0) | 0;
  __stack_pointer = $4 + 16 | 0;
  return $5 | 0;
 }
 
 function std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20___allocate_28unsigned_20long_29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0, $18 = 0;
  $4 = __stack_pointer - 16 | 0;
  __stack_pointer = $4;
  HEAP32[($4 + 12 | 0) >> 2] = $0;
  HEAP32[($4 + 8 | 0) >> 2] = $1;
  label$1 : {
   if (!((HEAP32[($4 + 8 | 0) >> 2] | 0) >>> 0 > (unsigned_20long_20std____2__allocator_traits_std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20___max_size_std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__2c_20void__28std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20const__29(HEAP32[($4 + 12 | 0) >> 2] | 0 | 0) | 0) >>> 0 & 1 | 0)) {
    break label$1
   }
   std____2____throw_length_error_28char_20const__29(1154 | 0);
   abort();
  }
  $18 = std____2____libcpp_allocate_28unsigned_20long_2c_20unsigned_20long_29(Math_imul(HEAP32[($4 + 8 | 0) >> 2] | 0, 12) | 0, 4 | 0) | 0;
  __stack_pointer = $4 + 16 | 0;
  return $18 | 0;
 }
 
 function std____2____compressed_pair_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20_____second_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $7 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $7 = std____2____compressed_pair_elem_std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20___2c_201_2c_20false_____get_28_29((HEAP32[($3 + 12 | 0) >> 2] | 0) + 4 | 0 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $7 | 0;
 }
 
 function std____2____compressed_pair_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20_____first_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $5 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $5 = std____2____compressed_pair_elem_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___2c_200_2c_20false_____get_28_29(HEAP32[($3 + 12 | 0) >> 2] | 0 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $5 | 0;
 }
 
 function std____2____throw_length_error_28char_20const__29($0) {
  $0 = $0 | 0;
  var $3 = 0, $5 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $5 = __cxa_allocate_exception(8 | 0) | 0;
  std__length_error__length_error_28char_20const__29($5 | 0, HEAP32[($3 + 12 | 0) >> 2] | 0 | 0) | 0;
  __cxa_throw($5 | 0, 2352 | 0, 1 | 0);
  abort();
 }
 
 function std____2____libcpp_allocate_28unsigned_20long_2c_20unsigned_20long_29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0, $6 = 0;
  $4 = __stack_pointer - 16 | 0;
  __stack_pointer = $4;
  HEAP32[($4 + 12 | 0) >> 2] = $0;
  HEAP32[($4 + 8 | 0) >> 2] = $1;
  $6 = void__20std____2____libcpp_operator_new_unsigned_20long__28unsigned_20long_29(HEAP32[($4 + 12 | 0) >> 2] | 0 | 0) | 0;
  __stack_pointer = $4 + 16 | 0;
  return $6 | 0;
 }
 
 function std__length_error__length_error_28char_20const__29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0, $5 = 0;
  $4 = __stack_pointer - 16 | 0;
  __stack_pointer = $4;
  HEAP32[($4 + 12 | 0) >> 2] = $0;
  HEAP32[($4 + 8 | 0) >> 2] = $1;
  $5 = HEAP32[($4 + 12 | 0) >> 2] | 0;
  std__logic_error__logic_error_28char_20const__29($5 | 0, HEAP32[($4 + 8 | 0) >> 2] | 0 | 0) | 0;
  HEAP32[$5 >> 2] = 2312 + 8 | 0;
  __stack_pointer = $4 + 16 | 0;
  return $5 | 0;
 }
 
 function void__20std____2____libcpp_operator_new_unsigned_20long__28unsigned_20long_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $5 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $5 = operator_20new_28unsigned_20long_29(HEAP32[($3 + 12 | 0) >> 2] | 0 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $5 | 0;
 }
 
 function std____2____compressed_pair_elem_std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20___2c_201_2c_20false_____get_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  return HEAP32[(HEAP32[($3 + 12 | 0) >> 2] | 0) >> 2] | 0 | 0;
 }
 
 function std____2__conditional__28__28is_nothrow_move_constructible_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20___value_29_29_20___20_28is_copy_constructible_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20___value_29_2c_20std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20const__2c_20std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20______type_20std____2__move_if_noexcept_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__28std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___29($0) {
  $0 = $0 | 0;
  var $3 = 0, $5 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $5 = std____2__remove_reference_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____type___20std____2__move_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20____28std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___29(HEAP32[($3 + 12 | 0) >> 2] | 0 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $5 | 0;
 }
 
 function void_20std____2__allocator_traits_std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20___construct_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20void__28std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20___2c_20std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___2c_20std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20____29($0, $1, $2) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  var $5 = 0;
  $5 = __stack_pointer - 16 | 0;
  __stack_pointer = $5;
  HEAP32[($5 + 12 | 0) >> 2] = $0;
  HEAP32[($5 + 8 | 0) >> 2] = $1;
  HEAP32[($5 + 4 | 0) >> 2] = $2;
  void_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20___construct_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__28std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___2c_20std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20____29(HEAP32[($5 + 12 | 0) >> 2] | 0 | 0, HEAP32[($5 + 8 | 0) >> 2] | 0 | 0, std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20____20std____2__forward_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__28std____2__remove_reference_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20___type__29(HEAP32[($5 + 4 | 0) >> 2] | 0 | 0) | 0 | 0);
  __stack_pointer = $5 + 16 | 0;
  return;
 }
 
 function std____2__remove_reference_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20______type___20std____2__move_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____28std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20____29($0) {
  $0 = $0 | 0;
  var $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  return HEAP32[($3 + 12 | 0) >> 2] | 0 | 0;
 }
 
 function std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20____20std____2__forward_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__28std____2__remove_reference_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20___type__29($0) {
  $0 = $0 | 0;
  var $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  return HEAP32[($3 + 12 | 0) >> 2] | 0 | 0;
 }
 
 function void_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20___construct_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__28std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___2c_20std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20____29($0, $1, $2) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  var $5 = 0;
  $5 = __stack_pointer - 16 | 0;
  __stack_pointer = $5;
  HEAP32[($5 + 12 | 0) >> 2] = $0;
  HEAP32[($5 + 8 | 0) >> 2] = $1;
  HEAP32[($5 + 4 | 0) >> 2] = $2;
  std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___basic_string_28std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20____29(HEAP32[($5 + 8 | 0) >> 2] | 0 | 0, std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20____20std____2__forward_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__28std____2__remove_reference_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20___type__29(HEAP32[($5 + 4 | 0) >> 2] | 0 | 0) | 0 | 0) | 0;
  __stack_pointer = $5 + 16 | 0;
  return;
 }
 
 function std____2__remove_reference_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____type___20std____2__move_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20____28std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___29($0) {
  $0 = $0 | 0;
  var $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  return HEAP32[($3 + 12 | 0) >> 2] | 0 | 0;
 }
 
 function std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___basic_string_28std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20____29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0, $5 = 0, $7 = 0, $9 = 0, i64toi32_i32$1 = 0;
  $4 = __stack_pointer - 16 | 0;
  __stack_pointer = $4;
  HEAP32[($4 + 12 | 0) >> 2] = $0;
  HEAP32[($4 + 8 | 0) >> 2] = $1;
  $5 = HEAP32[($4 + 12 | 0) >> 2] | 0;
  $7 = std____2__remove_reference_std____2____compressed_pair_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____rep_2c_20std____2__allocator_char__20_____type___20std____2__move_std____2____compressed_pair_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____rep_2c_20std____2__allocator_char__20____28std____2____compressed_pair_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____rep_2c_20std____2__allocator_char__20___29(HEAP32[($4 + 8 | 0) >> 2] | 0 | 0) | 0;
  i64toi32_i32$1 = HEAP32[($7 + 4 | 0) >> 2] | 0;
  HEAP32[$5 >> 2] = HEAP32[$7 >> 2] | 0;
  HEAP32[($5 + 4 | 0) >> 2] = i64toi32_i32$1;
  $9 = 8;
  HEAP32[($5 + $9 | 0) >> 2] = HEAP32[($7 + $9 | 0) >> 2] | 0;
  std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____zero_28_29(HEAP32[($4 + 8 | 0) >> 2] | 0 | 0);
  __stack_pointer = $4 + 16 | 0;
  return $5 | 0;
 }
 
 function std____2__remove_reference_std____2____compressed_pair_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____rep_2c_20std____2__allocator_char__20_____type___20std____2__move_std____2____compressed_pair_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____rep_2c_20std____2__allocator_char__20____28std____2____compressed_pair_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____rep_2c_20std____2__allocator_char__20___29($0) {
  $0 = $0 | 0;
  var $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  return HEAP32[($3 + 12 | 0) >> 2] | 0 | 0;
 }
 
 function std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____zero_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  HEAP32[($3 + 8 | 0) >> 2] = std____2____compressed_pair_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____rep_2c_20std____2__allocator_char__20___first_28_29(HEAP32[($3 + 12 | 0) >> 2] | 0 | 0) | 0;
  HEAP32[($3 + 4 | 0) >> 2] = 0;
  label$1 : {
   label$2 : while (1) {
    if (!((HEAP32[($3 + 4 | 0) >> 2] | 0) >>> 0 < 3 >>> 0 & 1 | 0)) {
     break label$1
    }
    HEAP32[((HEAP32[($3 + 8 | 0) >> 2] | 0) + ((HEAP32[($3 + 4 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] = 0;
    HEAP32[($3 + 4 | 0) >> 2] = (HEAP32[($3 + 4 | 0) >> 2] | 0) + 1 | 0;
    continue label$2;
   };
  }
  __stack_pointer = $3 + 16 | 0;
  return;
 }
 
 function std____2____split_buffer_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20_______destruct_at_end_28std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0;
  $4 = __stack_pointer - 16 | 0;
  __stack_pointer = $4;
  HEAP32[($4 + 12 | 0) >> 2] = $0;
  HEAP32[($4 + 8 | 0) >> 2] = $1;
  std____2____split_buffer_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20_______destruct_at_end_28std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___2c_20std____2__integral_constant_bool_2c_20false__29(HEAP32[($4 + 12 | 0) >> 2] | 0 | 0, HEAP32[($4 + 8 | 0) >> 2] | 0 | 0);
  __stack_pointer = $4 + 16 | 0;
  return;
 }
 
 function std____2____split_buffer_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20_______end_cap_28_29_20const($0) {
  $0 = $0 | 0;
  var $3 = 0, $7 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $7 = std____2____compressed_pair_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20_____first_28_29_20const((HEAP32[($3 + 12 | 0) >> 2] | 0) + 12 | 0 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $7 | 0;
 }
 
 function std____2____split_buffer_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20_______destruct_at_end_28std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___2c_20std____2__integral_constant_bool_2c_20false__29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0, $5 = 0, $16 = 0, $13 = 0;
  $4 = __stack_pointer - 16 | 0;
  __stack_pointer = $4;
  HEAP32[($4 + 4 | 0) >> 2] = $0;
  HEAP32[$4 >> 2] = $1;
  $5 = HEAP32[($4 + 4 | 0) >> 2] | 0;
  label$1 : {
   label$2 : while (1) {
    if (!((HEAP32[$4 >> 2] | 0 | 0) != (HEAP32[($5 + 8 | 0) >> 2] | 0 | 0) & 1 | 0)) {
     break label$1
    }
    $13 = std____2____split_buffer_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20_______alloc_28_29($5 | 0) | 0;
    $16 = (HEAP32[($5 + 8 | 0) >> 2] | 0) + -12 | 0;
    HEAP32[($5 + 8 | 0) >> 2] = $16;
    void_20std____2__allocator_traits_std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__20___destroy_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__2c_20void__28std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20___2c_20std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___29($13 | 0, std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___20std____2____to_address_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20__28std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___29($16 | 0) | 0 | 0);
    continue label$2;
   };
  }
  __stack_pointer = $4 + 16 | 0;
  return;
 }
 
 function std____2____compressed_pair_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___2c_20std____2__allocator_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20__20_____first_28_29_20const($0) {
  $0 = $0 | 0;
  var $3 = 0, $5 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $5 = std____2____compressed_pair_elem_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___2c_200_2c_20false_____get_28_29_20const(HEAP32[($3 + 12 | 0) >> 2] | 0 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $5 | 0;
 }
 
 function std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____set_long_size_28unsigned_20long_29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0, $6 = 0;
  $4 = __stack_pointer - 16 | 0;
  __stack_pointer = $4;
  HEAP32[($4 + 12 | 0) >> 2] = $0;
  HEAP32[($4 + 8 | 0) >> 2] = $1;
  $6 = HEAP32[($4 + 8 | 0) >> 2] | 0;
  HEAP32[((std____2____compressed_pair_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____rep_2c_20std____2__allocator_char__20___first_28_29(HEAP32[($4 + 12 | 0) >> 2] | 0 | 0) | 0) + 4 | 0) >> 2] = $6;
  __stack_pointer = $4 + 16 | 0;
  return;
 }
 
 function std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____set_short_size_28unsigned_20long_29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0, $6 = 0;
  $4 = __stack_pointer - 16 | 0;
  __stack_pointer = $4;
  HEAP32[($4 + 12 | 0) >> 2] = $0;
  HEAP32[($4 + 8 | 0) >> 2] = $1;
  $6 = HEAP32[($4 + 8 | 0) >> 2] | 0;
  HEAP8[((std____2____compressed_pair_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____rep_2c_20std____2__allocator_char__20___first_28_29(HEAP32[($4 + 12 | 0) >> 2] | 0 | 0) | 0) + 11 | 0) >> 0] = $6;
  __stack_pointer = $4 + 16 | 0;
  return;
 }
 
 function char__20std____2____to_address_char__28char__29($0) {
  $0 = $0 | 0;
  var $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  return HEAP32[($3 + 12 | 0) >> 2] | 0 | 0;
 }
 
 function std____2__char_traits_char___move_28char__2c_20char_20const__2c_20unsigned_20long_29($0, $1, $2) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  var $5 = 0, $8 = 0, $9 = 0;
  $5 = __stack_pointer - 16 | 0;
  __stack_pointer = $5;
  HEAP32[($5 + 12 | 0) >> 2] = $0;
  HEAP32[($5 + 8 | 0) >> 2] = $1;
  HEAP32[($5 + 4 | 0) >> 2] = $2;
  label$1 : {
   label$2 : {
    if (HEAP32[($5 + 4 | 0) >> 2] | 0) {
     break label$2
    }
    $8 = HEAP32[($5 + 12 | 0) >> 2] | 0;
    break label$1;
   }
   $9 = HEAP32[($5 + 12 | 0) >> 2] | 0;
   memmove($9 | 0, HEAP32[($5 + 8 | 0) >> 2] | 0 | 0, HEAP32[($5 + 4 | 0) >> 2] | 0 | 0) | 0;
   $8 = $9;
  }
  __stack_pointer = $5 + 16 | 0;
  return $8 | 0;
 }
 
 function std____2__char_traits_char___assign_28char__2c_20char_20const__29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0;
  $4 = __stack_pointer - 16 | 0;
  HEAP32[($4 + 12 | 0) >> 2] = $0;
  HEAP32[($4 + 8 | 0) >> 2] = $1;
  HEAP8[(HEAP32[($4 + 12 | 0) >> 2] | 0) >> 0] = HEAPU8[(HEAP32[($4 + 8 | 0) >> 2] | 0) >> 0] | 0;
  return;
 }
 
 function std____2____wrap_iter_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_______wrap_iter_28std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0, $5 = 0;
  $4 = __stack_pointer - 16 | 0;
  HEAP32[($4 + 12 | 0) >> 2] = $0;
  HEAP32[($4 + 8 | 0) >> 2] = $1;
  $5 = HEAP32[($4 + 12 | 0) >> 2] | 0;
  HEAP32[$5 >> 2] = HEAP32[($4 + 8 | 0) >> 2] | 0;
  return $5 | 0;
 }
 
 function std____2____compressed_pair_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____rep_2c_20std____2__allocator_char__20___second_28_29_20const($0) {
  $0 = $0 | 0;
  var $3 = 0, $5 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $5 = std____2____compressed_pair_elem_std____2__allocator_char__2c_201_2c_20true_____get_28_29_20const(HEAP32[($3 + 12 | 0) >> 2] | 0 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $5 | 0;
 }
 
 function std____2__allocator_char____20std____2__forward_std____2__allocator_char__20__28std____2__remove_reference_std____2__allocator_char__20___type__29($0) {
  $0 = $0 | 0;
  var $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  return HEAP32[($3 + 12 | 0) >> 2] | 0 | 0;
 }
 
 function std____2____compressed_pair_elem_std____2__allocator_char__2c_201_2c_20true_____compressed_pair_elem_std____2__allocator_char__2c_20void__28std____2__allocator_char____29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0, $5 = 0;
  $4 = __stack_pointer - 16 | 0;
  __stack_pointer = $4;
  HEAP32[($4 + 12 | 0) >> 2] = $0;
  HEAP32[($4 + 8 | 0) >> 2] = $1;
  $5 = HEAP32[($4 + 12 | 0) >> 2] | 0;
  std____2__allocator_char____20std____2__forward_std____2__allocator_char__20__28std____2__remove_reference_std____2__allocator_char__20___type__29(HEAP32[($4 + 8 | 0) >> 2] | 0 | 0) | 0;
  __stack_pointer = $4 + 16 | 0;
  return $5 | 0;
 }
 
 function std____2____compressed_pair_elem_std____2__allocator_char__2c_201_2c_20true_____get_28_29_20const($0) {
  $0 = $0 | 0;
  var $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  return HEAP32[($3 + 12 | 0) >> 2] | 0 | 0;
 }
 
 function std____2____compressed_pair_char__2c_20std____2__allocator_char__20_____compressed_pair_std__nullptr_t_2c_20std____2____default_init_tag__28std__nullptr_t___2c_20std____2____default_init_tag___29($0, $1, $2) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  var $5 = 0, $6 = 0;
  $5 = __stack_pointer - 16 | 0;
  __stack_pointer = $5;
  HEAP32[($5 + 12 | 0) >> 2] = $0;
  HEAP32[($5 + 8 | 0) >> 2] = $1;
  HEAP32[($5 + 4 | 0) >> 2] = $2;
  $6 = HEAP32[($5 + 12 | 0) >> 2] | 0;
  std____2____compressed_pair_elem_char__2c_200_2c_20false_____compressed_pair_elem_std__nullptr_t_2c_20void__28std__nullptr_t___29($6 | 0, std__nullptr_t___20std____2__forward_std__nullptr_t__28std____2__remove_reference_std__nullptr_t___type__29(HEAP32[($5 + 8 | 0) >> 2] | 0 | 0) | 0 | 0) | 0;
  std____2____default_init_tag___20std____2__forward_std____2____default_init_tag__28std____2__remove_reference_std____2____default_init_tag___type__29(HEAP32[($5 + 4 | 0) >> 2] | 0 | 0) | 0;
  std____2____compressed_pair_elem_std____2__allocator_char__2c_201_2c_20true_____compressed_pair_elem_28std____2____default_init_tag_29($6 | 0) | 0;
  __stack_pointer = $5 + 16 | 0;
  return $6 | 0;
 }
 
 function std____2__iterator_traits_std____2____wrap_iter_char___20___difference_type_20std____2____distance_std____2____wrap_iter_char___20__28std____2____wrap_iter_char___2c_20std____2____wrap_iter_char___2c_20std____2__random_access_iterator_tag_29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0, $11 = 0;
  $4 = __stack_pointer - 32 | 0;
  __stack_pointer = $4;
  HEAP32[($4 + 24 | 0) >> 2] = $0;
  HEAP32[($4 + 16 | 0) >> 2] = $1;
  $11 = decltype_28_28fp_base_28_29_29_20__20_28fp0_base_28_29_29_29_20std____2__operator__char__2c_20char___28std____2____wrap_iter_char___20const__2c_20std____2____wrap_iter_char___20const__29($4 + 16 | 0 | 0, $4 + 24 | 0 | 0) | 0;
  __stack_pointer = $4 + 32 | 0;
  return $11 | 0;
 }
 
 function std____2__vector_char_2c_20std____2__allocator_char__20___max_size_28_29_20const($0) {
  $0 = $0 | 0;
  var $3 = 0, $15 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  HEAP32[($3 + 8 | 0) >> 2] = unsigned_20long_20std____2__allocator_traits_std____2__allocator_char__20___max_size_std____2__allocator_char__2c_20void__28std____2__allocator_char__20const__29(std____2____vector_base_char_2c_20std____2__allocator_char__20_____alloc_28_29_20const(HEAP32[($3 + 12 | 0) >> 2] | 0 | 0) | 0 | 0) | 0;
  HEAP32[($3 + 4 | 0) >> 2] = std____2__numeric_limits_long___max_28_29() | 0;
  $15 = HEAP32[(unsigned_20long_20const__20std____2__min_unsigned_20long__28unsigned_20long_20const__2c_20unsigned_20long_20const__29($3 + 8 | 0 | 0, $3 + 4 | 0 | 0) | 0) >> 2] | 0;
  __stack_pointer = $3 + 16 | 0;
  return $15 | 0;
 }
 
 function std____2____vector_base_char_2c_20std____2__allocator_char__20_____alloc_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $7 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $7 = std____2____compressed_pair_char__2c_20std____2__allocator_char__20___second_28_29((HEAP32[($3 + 12 | 0) >> 2] | 0) + 8 | 0 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $7 | 0;
 }
 
 function std____2__allocator_traits_std____2__allocator_char__20___allocate_28std____2__allocator_char___2c_20unsigned_20long_29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0, $7 = 0;
  $4 = __stack_pointer - 16 | 0;
  __stack_pointer = $4;
  HEAP32[($4 + 12 | 0) >> 2] = $0;
  HEAP32[($4 + 8 | 0) >> 2] = $1;
  $7 = std____2__allocator_char___allocate_28unsigned_20long_29(HEAP32[($4 + 12 | 0) >> 2] | 0 | 0, HEAP32[($4 + 8 | 0) >> 2] | 0 | 0) | 0;
  __stack_pointer = $4 + 16 | 0;
  return $7 | 0;
 }
 
 function std____2____vector_base_char_2c_20std____2__allocator_char__20_____end_cap_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $7 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $7 = std____2____compressed_pair_char__2c_20std____2__allocator_char__20___first_28_29((HEAP32[($3 + 12 | 0) >> 2] | 0) + 8 | 0 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $7 | 0;
 }
 
 function std____2__vector_char_2c_20std____2__allocator_char__20_____annotate_new_28unsigned_20long_29_20const($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $5 = 0, $4 = 0;
  $4 = __stack_pointer - 16 | 0;
  __stack_pointer = $4;
  HEAP32[($4 + 12 | 0) >> 2] = $0;
  HEAP32[($4 + 8 | 0) >> 2] = $1;
  $5 = HEAP32[($4 + 12 | 0) >> 2] | 0;
  std____2__vector_char_2c_20std____2__allocator_char__20_____annotate_contiguous_container_28void_20const__2c_20void_20const__2c_20void_20const__2c_20void_20const__29_20const($5 | 0, std____2__vector_char_2c_20std____2__allocator_char__20___data_28_29_20const($5 | 0) | 0 | 0, (std____2__vector_char_2c_20std____2__allocator_char__20___data_28_29_20const($5 | 0) | 0) + (std____2__vector_char_2c_20std____2__allocator_char__20___capacity_28_29_20const($5 | 0) | 0) | 0 | 0, (std____2__vector_char_2c_20std____2__allocator_char__20___data_28_29_20const($5 | 0) | 0) + (std____2__vector_char_2c_20std____2__allocator_char__20___capacity_28_29_20const($5 | 0) | 0) | 0 | 0, (std____2__vector_char_2c_20std____2__allocator_char__20___data_28_29_20const($5 | 0) | 0) + (HEAP32[($4 + 8 | 0) >> 2] | 0) | 0 | 0);
  __stack_pointer = $4 + 16 | 0;
  return;
 }
 
 function std____2__vector_char_2c_20std____2__allocator_char__20____ConstructTransaction___ConstructTransaction_28std____2__vector_char_2c_20std____2__allocator_char__20___2c_20unsigned_20long_29($0, $1, $2) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  var $5 = 0, $6 = 0;
  $5 = __stack_pointer - 16 | 0;
  HEAP32[($5 + 12 | 0) >> 2] = $0;
  HEAP32[($5 + 8 | 0) >> 2] = $1;
  HEAP32[($5 + 4 | 0) >> 2] = $2;
  $6 = HEAP32[($5 + 12 | 0) >> 2] | 0;
  HEAP32[$6 >> 2] = HEAP32[($5 + 8 | 0) >> 2] | 0;
  HEAP32[($6 + 4 | 0) >> 2] = HEAP32[((HEAP32[($5 + 8 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0;
  HEAP32[($6 + 8 | 0) >> 2] = (HEAP32[((HEAP32[($5 + 8 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0) + (HEAP32[($5 + 4 | 0) >> 2] | 0) | 0;
  return $6 | 0;
 }
 
 function void_20std____2____construct_range_forward_std____2__allocator_char__2c_20std____2____wrap_iter_char___2c_20char___28std____2__allocator_char___2c_20std____2____wrap_iter_char___2c_20std____2____wrap_iter_char___2c_20char___29($0, $1, $2, $3) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  $3 = $3 | 0;
  var $6 = 0, $27 = 0;
  $6 = __stack_pointer - 32 | 0;
  __stack_pointer = $6;
  HEAP32[($6 + 24 | 0) >> 2] = $1;
  HEAP32[($6 + 16 | 0) >> 2] = $2;
  HEAP32[($6 + 12 | 0) >> 2] = $0;
  HEAP32[($6 + 8 | 0) >> 2] = $3;
  label$1 : {
   label$2 : while (1) {
    if (!((bool_20std____2__operator___char___28std____2____wrap_iter_char___20const__2c_20std____2____wrap_iter_char___20const__29($6 + 24 | 0 | 0, $6 + 16 | 0 | 0) | 0) & 1 | 0)) {
     break label$1
    }
    void_20std____2__allocator_traits_std____2__allocator_char__20___construct_char_2c_20char__2c_20void__28std____2__allocator_char___2c_20char__2c_20char__29(HEAP32[($6 + 12 | 0) >> 2] | 0 | 0, char__20std____2____to_address_char__28char__29(HEAP32[(HEAP32[($6 + 8 | 0) >> 2] | 0) >> 2] | 0 | 0) | 0 | 0, std____2____wrap_iter_char____operator__28_29_20const($6 + 24 | 0 | 0) | 0 | 0);
    std____2____wrap_iter_char____operator___28_29($6 + 24 | 0 | 0) | 0;
    $27 = HEAP32[($6 + 8 | 0) >> 2] | 0;
    HEAP32[$27 >> 2] = (HEAP32[$27 >> 2] | 0) + 1 | 0;
    continue label$2;
   };
  }
  __stack_pointer = $6 + 32 | 0;
  return;
 }
 
 function std____2__vector_char_2c_20std____2__allocator_char__20____ConstructTransaction____ConstructTransaction_28_29($0) {
  $0 = $0 | 0;
  var $4 = 0, $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 12 | 0) >> 2] | 0;
  HEAP32[((HEAP32[$4 >> 2] | 0) + 4 | 0) >> 2] = HEAP32[($4 + 4 | 0) >> 2] | 0;
  return $4 | 0;
 }
 
 function std____2____compressed_pair_elem_char__2c_200_2c_20false_____compressed_pair_elem_std__nullptr_t_2c_20void__28std__nullptr_t___29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0, $5 = 0;
  $4 = __stack_pointer - 16 | 0;
  __stack_pointer = $4;
  HEAP32[($4 + 12 | 0) >> 2] = $0;
  HEAP32[($4 + 8 | 0) >> 2] = $1;
  $5 = HEAP32[($4 + 12 | 0) >> 2] | 0;
  std__nullptr_t___20std____2__forward_std__nullptr_t__28std____2__remove_reference_std__nullptr_t___type__29(HEAP32[($4 + 8 | 0) >> 2] | 0 | 0) | 0;
  HEAP32[$5 >> 2] = 0;
  __stack_pointer = $4 + 16 | 0;
  return $5 | 0;
 }
 
 function decltype_28_28fp_base_28_29_29_20__20_28fp0_base_28_29_29_29_20std____2__operator__char__2c_20char___28std____2____wrap_iter_char___20const__2c_20std____2____wrap_iter_char___20const__29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0, $6 = 0, $8 = 0;
  $4 = __stack_pointer - 16 | 0;
  __stack_pointer = $4;
  HEAP32[($4 + 12 | 0) >> 2] = $0;
  HEAP32[($4 + 8 | 0) >> 2] = $1;
  $6 = std____2____wrap_iter_char____base_28_29_20const(HEAP32[($4 + 12 | 0) >> 2] | 0 | 0) | 0;
  $8 = std____2____wrap_iter_char____base_28_29_20const(HEAP32[($4 + 8 | 0) >> 2] | 0 | 0) | 0;
  __stack_pointer = $4 + 16 | 0;
  return $6 - $8 | 0 | 0;
 }
 
 function std____2____wrap_iter_char____base_28_29_20const($0) {
  $0 = $0 | 0;
  var $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  return HEAP32[(HEAP32[($3 + 12 | 0) >> 2] | 0) >> 2] | 0 | 0;
 }
 
 function std____2____vector_base_char_2c_20std____2__allocator_char__20_____alloc_28_29_20const($0) {
  $0 = $0 | 0;
  var $3 = 0, $7 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $7 = std____2____compressed_pair_char__2c_20std____2__allocator_char__20___second_28_29_20const((HEAP32[($3 + 12 | 0) >> 2] | 0) + 8 | 0 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $7 | 0;
 }
 
 function unsigned_20long_20std____2__allocator_traits_std____2__allocator_char__20___max_size_std____2__allocator_char__2c_20void__28std____2__allocator_char__20const__29($0) {
  $0 = $0 | 0;
  var $3 = 0, $5 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $5 = std____2__allocator_char___max_size_28_29_20const(HEAP32[($3 + 12 | 0) >> 2] | 0 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $5 | 0;
 }
 
 function std____2__allocator_char___allocate_28unsigned_20long_29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0, $18 = 0;
  $4 = __stack_pointer - 16 | 0;
  __stack_pointer = $4;
  HEAP32[($4 + 12 | 0) >> 2] = $0;
  HEAP32[($4 + 8 | 0) >> 2] = $1;
  label$1 : {
   if (!((HEAP32[($4 + 8 | 0) >> 2] | 0) >>> 0 > (unsigned_20long_20std____2__allocator_traits_std____2__allocator_char__20___max_size_std____2__allocator_char__2c_20void__28std____2__allocator_char__20const__29(HEAP32[($4 + 12 | 0) >> 2] | 0 | 0) | 0) >>> 0 & 1 | 0)) {
    break label$1
   }
   std____2____throw_length_error_28char_20const__29(1154 | 0);
   abort();
  }
  $18 = std____2____libcpp_allocate_28unsigned_20long_2c_20unsigned_20long_29((HEAP32[($4 + 8 | 0) >> 2] | 0) << 0 | 0 | 0, 1 | 0) | 0;
  __stack_pointer = $4 + 16 | 0;
  return $18 | 0;
 }
 
 function std____2____compressed_pair_char__2c_20std____2__allocator_char__20___second_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $5 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $5 = std____2____compressed_pair_elem_std____2__allocator_char__2c_201_2c_20true_____get_28_29(HEAP32[($3 + 12 | 0) >> 2] | 0 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $5 | 0;
 }
 
 function std____2____compressed_pair_char__2c_20std____2__allocator_char__20___first_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $5 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $5 = std____2____compressed_pair_elem_char__2c_200_2c_20false_____get_28_29(HEAP32[($3 + 12 | 0) >> 2] | 0 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $5 | 0;
 }
 
 function std____2__vector_char_2c_20std____2__allocator_char__20___data_28_29_20const($0) {
  $0 = $0 | 0;
  var $3 = 0, $6 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $6 = char__20std____2____to_address_char__28char__29(HEAP32[(HEAP32[($3 + 12 | 0) >> 2] | 0) >> 2] | 0 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $6 | 0;
 }
 
 function std____2__vector_char_2c_20std____2__allocator_char__20___capacity_28_29_20const($0) {
  $0 = $0 | 0;
  var $3 = 0, $5 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $5 = std____2____vector_base_char_2c_20std____2__allocator_char__20___capacity_28_29_20const(HEAP32[($3 + 12 | 0) >> 2] | 0 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $5 | 0;
 }
 
 function std____2__vector_char_2c_20std____2__allocator_char__20_____annotate_contiguous_container_28void_20const__2c_20void_20const__2c_20void_20const__2c_20void_20const__29_20const($0, $1, $2, $3, $4) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  $3 = $3 | 0;
  $4 = $4 | 0;
  var $7 = 0;
  $7 = __stack_pointer - 32 | 0;
  HEAP32[($7 + 28 | 0) >> 2] = $0;
  HEAP32[($7 + 24 | 0) >> 2] = $1;
  HEAP32[($7 + 20 | 0) >> 2] = $2;
  HEAP32[($7 + 16 | 0) >> 2] = $3;
  HEAP32[($7 + 12 | 0) >> 2] = $4;
  return;
 }
 
 function std____2__allocator_char___max_size_28_29_20const($0) {
  $0 = $0 | 0;
  HEAP32[((__stack_pointer - 16 | 0) + 12 | 0) >> 2] = $0;
  return -1 | 0;
 }
 
 function std____2____compressed_pair_char__2c_20std____2__allocator_char__20___second_28_29_20const($0) {
  $0 = $0 | 0;
  var $3 = 0, $5 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $5 = std____2____compressed_pair_elem_std____2__allocator_char__2c_201_2c_20true_____get_28_29_20const(HEAP32[($3 + 12 | 0) >> 2] | 0 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $5 | 0;
 }
 
 function std____2____compressed_pair_elem_std____2__allocator_char__2c_201_2c_20true_____get_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  return HEAP32[($3 + 12 | 0) >> 2] | 0 | 0;
 }
 
 function std____2____compressed_pair_elem_char__2c_200_2c_20false_____get_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  return HEAP32[($3 + 12 | 0) >> 2] | 0 | 0;
 }
 
 function std____2____vector_base_char_2c_20std____2__allocator_char__20___capacity_28_29_20const($0) {
  $0 = $0 | 0;
  var $3 = 0, $4 = 0, $8 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 12 | 0) >> 2] | 0;
  $8 = (HEAP32[(std____2____vector_base_char_2c_20std____2__allocator_char__20_____end_cap_28_29_20const($4 | 0) | 0) >> 2] | 0) - (HEAP32[$4 >> 2] | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $8 | 0;
 }
 
 function std____2____vector_base_char_2c_20std____2__allocator_char__20_____end_cap_28_29_20const($0) {
  $0 = $0 | 0;
  var $3 = 0, $7 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $7 = std____2____compressed_pair_char__2c_20std____2__allocator_char__20___first_28_29_20const((HEAP32[($3 + 12 | 0) >> 2] | 0) + 8 | 0 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $7 | 0;
 }
 
 function std____2____compressed_pair_char__2c_20std____2__allocator_char__20___first_28_29_20const($0) {
  $0 = $0 | 0;
  var $3 = 0, $5 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $5 = std____2____compressed_pair_elem_char__2c_200_2c_20false_____get_28_29_20const(HEAP32[($3 + 12 | 0) >> 2] | 0 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $5 | 0;
 }
 
 function std____2____compressed_pair_elem_char__2c_200_2c_20false_____get_28_29_20const($0) {
  $0 = $0 | 0;
  var $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  return HEAP32[($3 + 12 | 0) >> 2] | 0 | 0;
 }
 
 function bool_20std____2__operator___char___28std____2____wrap_iter_char___20const__2c_20std____2____wrap_iter_char___20const__29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0, $7 = 0;
  $4 = __stack_pointer - 16 | 0;
  __stack_pointer = $4;
  HEAP32[($4 + 12 | 0) >> 2] = $0;
  HEAP32[($4 + 8 | 0) >> 2] = $1;
  $7 = bool_20std____2__operator___char__2c_20char___28std____2____wrap_iter_char___20const__2c_20std____2____wrap_iter_char___20const__29(HEAP32[($4 + 12 | 0) >> 2] | 0 | 0, HEAP32[($4 + 8 | 0) >> 2] | 0 | 0) | 0;
  __stack_pointer = $4 + 16 | 0;
  return ($7 ^ -1 | 0) & 1 | 0 | 0;
 }
 
 function std____2____wrap_iter_char____operator__28_29_20const($0) {
  $0 = $0 | 0;
  var $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  return HEAP32[(HEAP32[($3 + 12 | 0) >> 2] | 0) >> 2] | 0 | 0;
 }
 
 function void_20std____2__allocator_traits_std____2__allocator_char__20___construct_char_2c_20char__2c_20void__28std____2__allocator_char___2c_20char__2c_20char__29($0, $1, $2) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  var $5 = 0;
  $5 = __stack_pointer - 16 | 0;
  __stack_pointer = $5;
  HEAP32[($5 + 12 | 0) >> 2] = $0;
  HEAP32[($5 + 8 | 0) >> 2] = $1;
  HEAP32[($5 + 4 | 0) >> 2] = $2;
  void_20std____2__allocator_char___construct_char_2c_20char___28char__2c_20char__29(HEAP32[($5 + 12 | 0) >> 2] | 0 | 0, HEAP32[($5 + 8 | 0) >> 2] | 0 | 0, char__20std____2__forward_char___28std____2__remove_reference_char____type__29(HEAP32[($5 + 4 | 0) >> 2] | 0 | 0) | 0 | 0);
  __stack_pointer = $5 + 16 | 0;
  return;
 }
 
 function std____2____wrap_iter_char____operator___28_29($0) {
  $0 = $0 | 0;
  var $4 = 0, $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 12 | 0) >> 2] | 0;
  HEAP32[$4 >> 2] = (HEAP32[$4 >> 2] | 0) + 1 | 0;
  return $4 | 0;
 }
 
 function bool_20std____2__operator___char__2c_20char___28std____2____wrap_iter_char___20const__2c_20std____2____wrap_iter_char___20const__29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0, $6 = 0, $8 = 0;
  $4 = __stack_pointer - 16 | 0;
  __stack_pointer = $4;
  HEAP32[($4 + 12 | 0) >> 2] = $0;
  HEAP32[($4 + 8 | 0) >> 2] = $1;
  $6 = std____2____wrap_iter_char____base_28_29_20const(HEAP32[($4 + 12 | 0) >> 2] | 0 | 0) | 0;
  $8 = std____2____wrap_iter_char____base_28_29_20const(HEAP32[($4 + 8 | 0) >> 2] | 0 | 0) | 0;
  __stack_pointer = $4 + 16 | 0;
  return ($6 | 0) == ($8 | 0) & 1 | 0 | 0;
 }
 
 function char__20std____2__forward_char___28std____2__remove_reference_char____type__29($0) {
  $0 = $0 | 0;
  var $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  return HEAP32[($3 + 12 | 0) >> 2] | 0 | 0;
 }
 
 function void_20std____2__allocator_char___construct_char_2c_20char___28char__2c_20char__29($0, $1, $2) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  var $5 = 0;
  $5 = __stack_pointer - 16 | 0;
  __stack_pointer = $5;
  HEAP32[($5 + 12 | 0) >> 2] = $0;
  HEAP32[($5 + 8 | 0) >> 2] = $1;
  HEAP32[($5 + 4 | 0) >> 2] = $2;
  HEAP8[(HEAP32[($5 + 8 | 0) >> 2] | 0) >> 0] = HEAPU8[(char__20std____2__forward_char___28std____2__remove_reference_char____type__29(HEAP32[($5 + 4 | 0) >> 2] | 0 | 0) | 0) >> 0] | 0;
  __stack_pointer = $5 + 16 | 0;
  return;
 }
 
 function std____2__vector_char_2c_20std____2__allocator_char__20___size_28_29_20const($0) {
  $0 = $0 | 0;
  var $3 = 0, $4 = 0;
  $3 = __stack_pointer - 16 | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 12 | 0) >> 2] | 0;
  return (HEAP32[($4 + 4 | 0) >> 2] | 0) - (HEAP32[$4 >> 2] | 0) | 0 | 0;
 }
 
 function std____2____vector_base_char_2c_20std____2__allocator_char__20___clear_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $4 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 12 | 0) >> 2] | 0;
  std____2____vector_base_char_2c_20std____2__allocator_char__20_____destruct_at_end_28char__29($4 | 0, HEAP32[$4 >> 2] | 0 | 0);
  __stack_pointer = $3 + 16 | 0;
  return;
 }
 
 function std____2__allocator_traits_std____2__allocator_char__20___deallocate_28std____2__allocator_char___2c_20char__2c_20unsigned_20long_29($0, $1, $2) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  var $5 = 0;
  $5 = __stack_pointer - 16 | 0;
  __stack_pointer = $5;
  HEAP32[($5 + 12 | 0) >> 2] = $0;
  HEAP32[($5 + 8 | 0) >> 2] = $1;
  HEAP32[($5 + 4 | 0) >> 2] = $2;
  std____2__allocator_char___deallocate_28char__2c_20unsigned_20long_29(HEAP32[($5 + 12 | 0) >> 2] | 0 | 0, HEAP32[($5 + 8 | 0) >> 2] | 0 | 0, HEAP32[($5 + 4 | 0) >> 2] | 0 | 0);
  __stack_pointer = $5 + 16 | 0;
  return;
 }
 
 function std____2____vector_base_char_2c_20std____2__allocator_char__20_____destruct_at_end_28char__29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0, $5 = 0, $17 = 0, $14 = 0;
  $4 = __stack_pointer - 16 | 0;
  __stack_pointer = $4;
  HEAP32[($4 + 12 | 0) >> 2] = $0;
  HEAP32[($4 + 8 | 0) >> 2] = $1;
  $5 = HEAP32[($4 + 12 | 0) >> 2] | 0;
  HEAP32[($4 + 4 | 0) >> 2] = HEAP32[($5 + 4 | 0) >> 2] | 0;
  label$1 : {
   label$2 : while (1) {
    if (!((HEAP32[($4 + 8 | 0) >> 2] | 0 | 0) != (HEAP32[($4 + 4 | 0) >> 2] | 0 | 0) & 1 | 0)) {
     break label$1
    }
    $14 = std____2____vector_base_char_2c_20std____2__allocator_char__20_____alloc_28_29($5 | 0) | 0;
    $17 = (HEAP32[($4 + 4 | 0) >> 2] | 0) + -1 | 0;
    HEAP32[($4 + 4 | 0) >> 2] = $17;
    void_20std____2__allocator_traits_std____2__allocator_char__20___destroy_char_2c_20void__28std____2__allocator_char___2c_20char__29($14 | 0, char__20std____2____to_address_char__28char__29($17 | 0) | 0 | 0);
    continue label$2;
   };
  }
  HEAP32[($5 + 4 | 0) >> 2] = HEAP32[($4 + 8 | 0) >> 2] | 0;
  __stack_pointer = $4 + 16 | 0;
  return;
 }
 
 function std____2__allocator_char___deallocate_28char__2c_20unsigned_20long_29($0, $1, $2) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  var $5 = 0;
  $5 = __stack_pointer - 16 | 0;
  __stack_pointer = $5;
  HEAP32[($5 + 12 | 0) >> 2] = $0;
  HEAP32[($5 + 8 | 0) >> 2] = $1;
  HEAP32[($5 + 4 | 0) >> 2] = $2;
  std____2____libcpp_deallocate_28void__2c_20unsigned_20long_2c_20unsigned_20long_29(HEAP32[($5 + 8 | 0) >> 2] | 0 | 0, (HEAP32[($5 + 4 | 0) >> 2] | 0) << 0 | 0 | 0, 1 | 0);
  __stack_pointer = $5 + 16 | 0;
  return;
 }
 
 function void_20std____2__allocator_traits_std____2__allocator_char__20___destroy_char_2c_20void__28std____2__allocator_char___2c_20char__29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0;
  $4 = __stack_pointer - 16 | 0;
  __stack_pointer = $4;
  HEAP32[($4 + 12 | 0) >> 2] = $0;
  HEAP32[($4 + 8 | 0) >> 2] = $1;
  std____2__allocator_char___destroy_28char__29(HEAP32[($4 + 12 | 0) >> 2] | 0 | 0, HEAP32[($4 + 8 | 0) >> 2] | 0 | 0);
  __stack_pointer = $4 + 16 | 0;
  return;
 }
 
 function std____2__allocator_char___destroy_28char__29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0;
  $4 = __stack_pointer - 16 | 0;
  HEAP32[($4 + 12 | 0) >> 2] = $0;
  HEAP32[($4 + 8 | 0) >> 2] = $1;
  return;
 }
 
 function __cxx_global_var_init() {
  std____2__vector_char_2c_20std____2__allocator_char__20___vector_28_29(2712 | 0) | 0;
  __cxa_atexit(2 | 0, 0 | 0, 1024 | 0) | 0;
  return;
 }
 
 function std____2__vector_char_2c_20std____2__allocator_char__20___vector_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $4 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 12 | 0) >> 2] | 0;
  std____2____vector_base_char_2c_20std____2__allocator_char__20_____vector_base_28_29($4 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $4 | 0;
 }
 
 function __cxx_global_array_dtor($0) {
  $0 = $0 | 0;
  var $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  std____2__vector_char_2c_20std____2__allocator_char__20____vector_28_29(2712 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return;
 }
 
 function __cxx_global_var_init_1() {
  std____2__vector_char_2c_20std____2__allocator_char__20___vector_28_29(2724 | 0) | 0;
  __cxa_atexit(3 | 0, 0 | 0, 1024 | 0) | 0;
  return;
 }
 
 function __cxx_global_array_dtor_2($0) {
  $0 = $0 | 0;
  var $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  std____2__vector_char_2c_20std____2__allocator_char__20____vector_28_29(2724 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return;
 }
 
 function StdinFile__write_28__wasi_ciovec_t_20const__2c_20unsigned_20long_2c_20unsigned_20long__29($0, $1, $2, $3) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  $3 = $3 | 0;
  var $6 = 0;
  $6 = __stack_pointer - 16 | 0;
  HEAP32[($6 + 12 | 0) >> 2] = $0;
  HEAP32[($6 + 8 | 0) >> 2] = $1;
  HEAP32[($6 + 4 | 0) >> 2] = $2;
  HEAP32[$6 >> 2] = $3;
  return 0 & 65535 | 0 | 0;
 }
 
 function StdoutFile__write_28__wasi_ciovec_t_20const__2c_20unsigned_20long_2c_20unsigned_20long__29($0, $1, $2, $3) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  $3 = $3 | 0;
  var $6 = 0, $12 = 0;
  $6 = __stack_pointer - 16 | 0;
  __stack_pointer = $6;
  HEAP32[($6 + 12 | 0) >> 2] = $0;
  HEAP32[($6 + 8 | 0) >> 2] = $1;
  HEAP32[($6 + 4 | 0) >> 2] = $2;
  HEAP32[$6 >> 2] = $3;
  $12 = writeStdBuffer_28__wasi_ciovec_t_20const__2c_20unsigned_20long_2c_20unsigned_20long__2c_20void_20_28__29_28char_20const__29_2c_20std____2__vector_char_2c_20std____2__allocator_char__20___29(HEAP32[($6 + 8 | 0) >> 2] | 0 | 0, HEAP32[($6 + 4 | 0) >> 2] | 0 | 0, HEAP32[$6 >> 2] | 0 | 0, 4 | 0, 2712 | 0) | 0;
  __stack_pointer = $6 + 16 | 0;
  return $12 & 65535 | 0 | 0;
 }
 
 function writeStdBuffer_28__wasi_ciovec_t_20const__2c_20unsigned_20long_2c_20unsigned_20long__2c_20void_20_28__29_28char_20const__29_2c_20std____2__vector_char_2c_20std____2__allocator_char__20___29($0, $1, $2, $3, $4) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  $3 = $3 | 0;
  $4 = $4 | 0;
  var $7 = 0, $53 = 0, $58 = 0, $63 = 0;
  $7 = __stack_pointer - 48 | 0;
  __stack_pointer = $7;
  HEAP32[($7 + 44 | 0) >> 2] = $0;
  HEAP32[($7 + 40 | 0) >> 2] = $1;
  HEAP32[($7 + 36 | 0) >> 2] = $2;
  HEAP32[($7 + 32 | 0) >> 2] = $3;
  HEAP32[($7 + 28 | 0) >> 2] = $4;
  HEAP32[($7 + 24 | 0) >> 2] = 0;
  HEAP32[($7 + 20 | 0) >> 2] = 0;
  label$1 : {
   label$2 : while (1) {
    if (!((HEAP32[($7 + 20 | 0) >> 2] | 0) >>> 0 < (HEAP32[($7 + 40 | 0) >> 2] | 0) >>> 0 & 1 | 0)) {
     break label$1
    }
    HEAP32[($7 + 16 | 0) >> 2] = HEAP32[((HEAP32[($7 + 44 | 0) >> 2] | 0) + ((HEAP32[($7 + 20 | 0) >> 2] | 0) << 3 | 0) | 0) >> 2] | 0;
    HEAP32[($7 + 12 | 0) >> 2] = HEAP32[(((HEAP32[($7 + 44 | 0) >> 2] | 0) + ((HEAP32[($7 + 20 | 0) >> 2] | 0) << 3 | 0) | 0) + 4 | 0) >> 2] | 0;
    HEAP32[($7 + 8 | 0) >> 2] = 0;
    label$3 : {
     label$4 : while (1) {
      if (!((HEAP32[($7 + 8 | 0) >> 2] | 0) >>> 0 < (HEAP32[($7 + 12 | 0) >> 2] | 0) >>> 0 & 1 | 0)) {
       break label$3
      }
      HEAP8[($7 + 7 | 0) >> 0] = HEAPU8[((HEAP32[($7 + 16 | 0) >> 2] | 0) + (HEAP32[($7 + 8 | 0) >> 2] | 0) | 0) >> 0] | 0;
      label$5 : {
       label$6 : {
        label$7 : {
         if (!((HEAPU8[($7 + 7 | 0) >> 0] | 0) & 255 | 0)) {
          break label$7
         }
         if (!(((HEAPU8[($7 + 7 | 0) >> 0] | 0) & 255 | 0 | 0) == (10 | 0) & 1 | 0)) {
          break label$6
         }
        }
        $53 = HEAP32[($7 + 28 | 0) >> 2] | 0;
        HEAP8[($7 + 6 | 0) >> 0] = 0;
        std____2__vector_char_2c_20std____2__allocator_char__20___push_back_28char___29($53 | 0, $7 + 6 | 0 | 0);
        $58 = HEAP32[($7 + 32 | 0) >> 2] | 0;
        FUNCTION_TABLE[$58 | 0](std____2__vector_char_2c_20std____2__allocator_char__20___operator_5b_5d_28unsigned_20long_29(HEAP32[($7 + 28 | 0) >> 2] | 0 | 0, 0 | 0) | 0);
        std____2__vector_char_2c_20std____2__allocator_char__20___clear_28_29(HEAP32[($7 + 28 | 0) >> 2] | 0 | 0);
        break label$5;
       }
       $63 = HEAP32[($7 + 28 | 0) >> 2] | 0;
       HEAP8[($7 + 5 | 0) >> 0] = HEAPU8[($7 + 7 | 0) >> 0] | 0;
       std____2__vector_char_2c_20std____2__allocator_char__20___push_back_28char___29($63 | 0, $7 + 5 | 0 | 0);
      }
      HEAP32[($7 + 8 | 0) >> 2] = (HEAP32[($7 + 8 | 0) >> 2] | 0) + 1 | 0;
      continue label$4;
     };
    }
    HEAP32[($7 + 24 | 0) >> 2] = (HEAP32[($7 + 24 | 0) >> 2] | 0) + (HEAP32[($7 + 12 | 0) >> 2] | 0) | 0;
    HEAP32[($7 + 20 | 0) >> 2] = (HEAP32[($7 + 20 | 0) >> 2] | 0) + 1 | 0;
    continue label$2;
   };
  }
  HEAP32[(HEAP32[($7 + 36 | 0) >> 2] | 0) >> 2] = HEAP32[($7 + 24 | 0) >> 2] | 0;
  __stack_pointer = $7 + 48 | 0;
  return 0 & 65535 | 0 | 0;
 }
 
 function std____2__vector_char_2c_20std____2__allocator_char__20___push_back_28char___29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0, $5 = 0;
  $4 = __stack_pointer - 16 | 0;
  __stack_pointer = $4;
  HEAP32[($4 + 12 | 0) >> 2] = $0;
  HEAP32[($4 + 8 | 0) >> 2] = $1;
  $5 = HEAP32[($4 + 12 | 0) >> 2] | 0;
  label$1 : {
   label$2 : {
    if (!((HEAP32[($5 + 4 | 0) >> 2] | 0) >>> 0 < (HEAP32[(std____2____vector_base_char_2c_20std____2__allocator_char__20_____end_cap_28_29($5 | 0) | 0) >> 2] | 0) >>> 0 & 1 | 0)) {
     break label$2
    }
    void_20std____2__vector_char_2c_20std____2__allocator_char__20_____construct_one_at_end_char__28char___29($5 | 0, std____2__remove_reference_char____type___20std____2__move_char___28char__29(HEAP32[($4 + 8 | 0) >> 2] | 0 | 0) | 0 | 0);
    break label$1;
   }
   void_20std____2__vector_char_2c_20std____2__allocator_char__20_____push_back_slow_path_char__28char___29($5 | 0, std____2__remove_reference_char____type___20std____2__move_char___28char__29(HEAP32[($4 + 8 | 0) >> 2] | 0 | 0) | 0 | 0);
  }
  __stack_pointer = $4 + 16 | 0;
  return;
 }
 
 function std____2__vector_char_2c_20std____2__allocator_char__20___clear_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $4 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 12 | 0) >> 2] | 0;
  HEAP32[($3 + 8 | 0) >> 2] = std____2__vector_char_2c_20std____2__allocator_char__20___size_28_29_20const($4 | 0) | 0;
  std____2____vector_base_char_2c_20std____2__allocator_char__20___clear_28_29($4 | 0);
  std____2__vector_char_2c_20std____2__allocator_char__20_____annotate_shrink_28unsigned_20long_29_20const($4 | 0, HEAP32[($3 + 8 | 0) >> 2] | 0 | 0);
  std____2__vector_char_2c_20std____2__allocator_char__20_____invalidate_all_iterators_28_29($4 | 0);
  __stack_pointer = $3 + 16 | 0;
  return;
 }
 
 function StderrFile__write_28__wasi_ciovec_t_20const__2c_20unsigned_20long_2c_20unsigned_20long__29($0, $1, $2, $3) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  $3 = $3 | 0;
  var $6 = 0, $12 = 0;
  $6 = __stack_pointer - 16 | 0;
  __stack_pointer = $6;
  HEAP32[($6 + 12 | 0) >> 2] = $0;
  HEAP32[($6 + 8 | 0) >> 2] = $1;
  HEAP32[($6 + 4 | 0) >> 2] = $2;
  HEAP32[$6 >> 2] = $3;
  $12 = writeStdBuffer_28__wasi_ciovec_t_20const__2c_20unsigned_20long_2c_20unsigned_20long__2c_20void_20_28__29_28char_20const__29_2c_20std____2__vector_char_2c_20std____2__allocator_char__20___29(HEAP32[($6 + 8 | 0) >> 2] | 0 | 0, HEAP32[($6 + 4 | 0) >> 2] | 0 | 0, HEAP32[$6 >> 2] | 0 | 0, 5 | 0, 2724 | 0) | 0;
  __stack_pointer = $6 + 16 | 0;
  return $12 & 65535 | 0 | 0;
 }
 
 function StdinFile__read_28__wasi_iovec_t_20const__2c_20unsigned_20long_2c_20unsigned_20long__29($0, $1, $2, $3) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  $3 = $3 | 0;
  var $6 = 0;
  $6 = __stack_pointer - 16 | 0;
  __stack_pointer = $6;
  HEAP32[($6 + 12 | 0) >> 2] = $0;
  HEAP32[($6 + 8 | 0) >> 2] = $1;
  HEAP32[($6 + 4 | 0) >> 2] = $2;
  HEAP32[$6 >> 2] = $3;
  emscripten_console_log(1383 | 0);
  abort();
  abort();
 }
 
 function StdinFile___StdinFile_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $4 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 12 | 0) >> 2] | 0;
  File___File_28_29($4 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $4 | 0;
 }
 
 function File___File_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $4 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 12 | 0) >> 2] | 0;
  HEAP32[$4 >> 2] = 1632 + 8 | 0;
  std____2__mutex___mutex_28_29($4 + 4 | 0 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $4 | 0;
 }
 
 function StdinFile___StdinFile_28_29_1($0) {
  $0 = $0 | 0;
  var $3 = 0, $4 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 12 | 0) >> 2] | 0;
  StdinFile___StdinFile_28_29($4 | 0) | 0;
  operator_20delete_28void__29($4 | 0);
  __stack_pointer = $3 + 16 | 0;
  return;
 }
 
 function StdoutFile__read_28__wasi_iovec_t_20const__2c_20unsigned_20long_2c_20unsigned_20long__29($0, $1, $2, $3) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  $3 = $3 | 0;
  var $6 = 0;
  $6 = __stack_pointer - 16 | 0;
  __stack_pointer = $6;
  HEAP32[($6 + 12 | 0) >> 2] = $0;
  HEAP32[($6 + 8 | 0) >> 2] = $1;
  HEAP32[($6 + 4 | 0) >> 2] = $2;
  HEAP32[$6 >> 2] = $3;
  emscripten_console_log(1285 | 0);
  abort();
  abort();
 }
 
 function StdoutFile___StdoutFile_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $4 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 12 | 0) >> 2] | 0;
  File___File_28_29($4 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $4 | 0;
 }
 
 function StdoutFile___StdoutFile_28_29_1($0) {
  $0 = $0 | 0;
  var $3 = 0, $4 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 12 | 0) >> 2] | 0;
  StdoutFile___StdoutFile_28_29($4 | 0) | 0;
  operator_20delete_28void__29($4 | 0);
  __stack_pointer = $3 + 16 | 0;
  return;
 }
 
 function StderrFile__read_28__wasi_iovec_t_20const__2c_20unsigned_20long_2c_20unsigned_20long__29($0, $1, $2, $3) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  $3 = $3 | 0;
  var $6 = 0;
  $6 = __stack_pointer - 16 | 0;
  __stack_pointer = $6;
  HEAP32[($6 + 12 | 0) >> 2] = $0;
  HEAP32[($6 + 8 | 0) >> 2] = $1;
  HEAP32[($6 + 4 | 0) >> 2] = $2;
  HEAP32[$6 >> 2] = $3;
  emscripten_console_log(1334 | 0);
  abort();
  abort();
 }
 
 function StderrFile___StderrFile_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $4 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 12 | 0) >> 2] | 0;
  File___File_28_29($4 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $4 | 0;
 }
 
 function StderrFile___StderrFile_28_29_1($0) {
  $0 = $0 | 0;
  var $3 = 0, $4 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 12 | 0) >> 2] | 0;
  StderrFile___StderrFile_28_29($4 | 0) | 0;
  operator_20delete_28void__29($4 | 0);
  __stack_pointer = $3 + 16 | 0;
  return;
 }
 
 function std____2__remove_reference_char____type___20std____2__move_char___28char__29($0) {
  $0 = $0 | 0;
  var $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  return HEAP32[($3 + 12 | 0) >> 2] | 0 | 0;
 }
 
 function void_20std____2__vector_char_2c_20std____2__allocator_char__20_____construct_one_at_end_char__28char___29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0, $5 = 0;
  $4 = __stack_pointer - 32 | 0;
  __stack_pointer = $4;
  HEAP32[($4 + 28 | 0) >> 2] = $0;
  HEAP32[($4 + 24 | 0) >> 2] = $1;
  $5 = HEAP32[($4 + 28 | 0) >> 2] | 0;
  std____2__vector_char_2c_20std____2__allocator_char__20____ConstructTransaction___ConstructTransaction_28std____2__vector_char_2c_20std____2__allocator_char__20___2c_20unsigned_20long_29($4 + 8 | 0 | 0, $5 | 0, 1 | 0) | 0;
  void_20std____2__allocator_traits_std____2__allocator_char__20___construct_char_2c_20char_2c_20void__28std____2__allocator_char___2c_20char__2c_20char___29(std____2____vector_base_char_2c_20std____2__allocator_char__20_____alloc_28_29($5 | 0) | 0 | 0, char__20std____2____to_address_char__28char__29(HEAP32[($4 + 12 | 0) >> 2] | 0 | 0) | 0 | 0, char___20std____2__forward_char__28std____2__remove_reference_char___type__29(HEAP32[($4 + 24 | 0) >> 2] | 0 | 0) | 0 | 0);
  HEAP32[($4 + 12 | 0) >> 2] = (HEAP32[($4 + 12 | 0) >> 2] | 0) + 1 | 0;
  std____2__vector_char_2c_20std____2__allocator_char__20____ConstructTransaction____ConstructTransaction_28_29($4 + 8 | 0 | 0) | 0;
  __stack_pointer = $4 + 32 | 0;
  return;
 }
 
 function void_20std____2__vector_char_2c_20std____2__allocator_char__20_____push_back_slow_path_char__28char___29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0, $5 = 0;
  $4 = __stack_pointer - 32 | 0;
  __stack_pointer = $4;
  HEAP32[($4 + 28 | 0) >> 2] = $0;
  HEAP32[($4 + 24 | 0) >> 2] = $1;
  $5 = HEAP32[($4 + 28 | 0) >> 2] | 0;
  HEAP32[($4 + 20 | 0) >> 2] = std____2____vector_base_char_2c_20std____2__allocator_char__20_____alloc_28_29($5 | 0) | 0;
  std____2____split_buffer_char_2c_20std____2__allocator_char_______split_buffer_28unsigned_20long_2c_20unsigned_20long_2c_20std____2__allocator_char___29($4 | 0, std____2__vector_char_2c_20std____2__allocator_char__20_____recommend_28unsigned_20long_29_20const($5 | 0, (std____2__vector_char_2c_20std____2__allocator_char__20___size_28_29_20const($5 | 0) | 0) + 1 | 0 | 0) | 0 | 0, std____2__vector_char_2c_20std____2__allocator_char__20___size_28_29_20const($5 | 0) | 0 | 0, HEAP32[($4 + 20 | 0) >> 2] | 0 | 0) | 0;
  void_20std____2__allocator_traits_std____2__allocator_char__20___construct_char_2c_20char_2c_20void__28std____2__allocator_char___2c_20char__2c_20char___29(HEAP32[($4 + 20 | 0) >> 2] | 0 | 0, char__20std____2____to_address_char__28char__29(HEAP32[($4 + 8 | 0) >> 2] | 0 | 0) | 0 | 0, char___20std____2__forward_char__28std____2__remove_reference_char___type__29(HEAP32[($4 + 24 | 0) >> 2] | 0 | 0) | 0 | 0);
  HEAP32[($4 + 8 | 0) >> 2] = (HEAP32[($4 + 8 | 0) >> 2] | 0) + 1 | 0;
  std____2__vector_char_2c_20std____2__allocator_char__20_____swap_out_circular_buffer_28std____2____split_buffer_char_2c_20std____2__allocator_char_____29($5 | 0, $4 | 0);
  std____2____split_buffer_char_2c_20std____2__allocator_char________split_buffer_28_29($4 | 0) | 0;
  __stack_pointer = $4 + 32 | 0;
  return;
 }
 
 function std____2__vector_char_2c_20std____2__allocator_char__20_____annotate_shrink_28unsigned_20long_29_20const($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $5 = 0, $4 = 0;
  $4 = __stack_pointer - 16 | 0;
  __stack_pointer = $4;
  HEAP32[($4 + 12 | 0) >> 2] = $0;
  HEAP32[($4 + 8 | 0) >> 2] = $1;
  $5 = HEAP32[($4 + 12 | 0) >> 2] | 0;
  std____2__vector_char_2c_20std____2__allocator_char__20_____annotate_contiguous_container_28void_20const__2c_20void_20const__2c_20void_20const__2c_20void_20const__29_20const($5 | 0, std____2__vector_char_2c_20std____2__allocator_char__20___data_28_29_20const($5 | 0) | 0 | 0, (std____2__vector_char_2c_20std____2__allocator_char__20___data_28_29_20const($5 | 0) | 0) + (std____2__vector_char_2c_20std____2__allocator_char__20___capacity_28_29_20const($5 | 0) | 0) | 0 | 0, (std____2__vector_char_2c_20std____2__allocator_char__20___data_28_29_20const($5 | 0) | 0) + (HEAP32[($4 + 8 | 0) >> 2] | 0) | 0 | 0, (std____2__vector_char_2c_20std____2__allocator_char__20___data_28_29_20const($5 | 0) | 0) + (std____2__vector_char_2c_20std____2__allocator_char__20___size_28_29_20const($5 | 0) | 0) | 0 | 0);
  __stack_pointer = $4 + 16 | 0;
  return;
 }
 
 function std____2__vector_char_2c_20std____2__allocator_char__20_____invalidate_all_iterators_28_29($0) {
  $0 = $0 | 0;
  HEAP32[((__stack_pointer - 16 | 0) + 12 | 0) >> 2] = $0;
  return;
 }
 
 function char___20std____2__forward_char__28std____2__remove_reference_char___type__29($0) {
  $0 = $0 | 0;
  var $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  return HEAP32[($3 + 12 | 0) >> 2] | 0 | 0;
 }
 
 function void_20std____2__allocator_traits_std____2__allocator_char__20___construct_char_2c_20char_2c_20void__28std____2__allocator_char___2c_20char__2c_20char___29($0, $1, $2) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  var $5 = 0;
  $5 = __stack_pointer - 16 | 0;
  __stack_pointer = $5;
  HEAP32[($5 + 12 | 0) >> 2] = $0;
  HEAP32[($5 + 8 | 0) >> 2] = $1;
  HEAP32[($5 + 4 | 0) >> 2] = $2;
  void_20std____2__allocator_char___construct_char_2c_20char__28char__2c_20char___29(HEAP32[($5 + 12 | 0) >> 2] | 0 | 0, HEAP32[($5 + 8 | 0) >> 2] | 0 | 0, char___20std____2__forward_char__28std____2__remove_reference_char___type__29(HEAP32[($5 + 4 | 0) >> 2] | 0 | 0) | 0 | 0);
  __stack_pointer = $5 + 16 | 0;
  return;
 }
 
 function std____2__vector_char_2c_20std____2__allocator_char__20_____recommend_28unsigned_20long_29_20const($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0, $5 = 0, $36 = 0;
  $4 = __stack_pointer - 32 | 0;
  __stack_pointer = $4;
  HEAP32[($4 + 24 | 0) >> 2] = $0;
  HEAP32[($4 + 20 | 0) >> 2] = $1;
  $5 = HEAP32[($4 + 24 | 0) >> 2] | 0;
  HEAP32[($4 + 16 | 0) >> 2] = std____2__vector_char_2c_20std____2__allocator_char__20___max_size_28_29_20const($5 | 0) | 0;
  label$1 : {
   if (!((HEAP32[($4 + 20 | 0) >> 2] | 0) >>> 0 > (HEAP32[($4 + 16 | 0) >> 2] | 0) >>> 0 & 1 | 0)) {
    break label$1
   }
   std____2____vector_base_common_true_____throw_length_error_28_29_20const($5 | 0);
   abort();
  }
  HEAP32[($4 + 12 | 0) >> 2] = std____2__vector_char_2c_20std____2__allocator_char__20___capacity_28_29_20const($5 | 0) | 0;
  label$2 : {
   label$3 : {
    if (!((HEAP32[($4 + 12 | 0) >> 2] | 0) >>> 0 >= ((HEAP32[($4 + 16 | 0) >> 2] | 0) >>> 1 | 0) >>> 0 & 1 | 0)) {
     break label$3
    }
    HEAP32[($4 + 28 | 0) >> 2] = HEAP32[($4 + 16 | 0) >> 2] | 0;
    break label$2;
   }
   HEAP32[($4 + 8 | 0) >> 2] = (HEAP32[($4 + 12 | 0) >> 2] | 0) << 1 | 0;
   HEAP32[($4 + 28 | 0) >> 2] = HEAP32[(unsigned_20long_20const__20std____2__max_unsigned_20long__28unsigned_20long_20const__2c_20unsigned_20long_20const__29($4 + 8 | 0 | 0, $4 + 20 | 0 | 0) | 0) >> 2] | 0;
  }
  $36 = HEAP32[($4 + 28 | 0) >> 2] | 0;
  __stack_pointer = $4 + 32 | 0;
  return $36 | 0;
 }
 
 function std____2____split_buffer_char_2c_20std____2__allocator_char_______split_buffer_28unsigned_20long_2c_20unsigned_20long_2c_20std____2__allocator_char___29($0, $1, $2, $3) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  $3 = $3 | 0;
  var $6 = 0, $7 = 0, $19 = 0, $24 = 0, $27 = 0, $29 = 0;
  $6 = __stack_pointer - 32 | 0;
  __stack_pointer = $6;
  HEAP32[($6 + 24 | 0) >> 2] = $0;
  HEAP32[($6 + 20 | 0) >> 2] = $1;
  HEAP32[($6 + 16 | 0) >> 2] = $2;
  HEAP32[($6 + 12 | 0) >> 2] = $3;
  $7 = HEAP32[($6 + 24 | 0) >> 2] | 0;
  HEAP32[($6 + 28 | 0) >> 2] = $7;
  HEAP32[($6 + 8 | 0) >> 2] = 0;
  std____2____compressed_pair_char__2c_20std____2__allocator_char_______compressed_pair_std__nullptr_t_2c_20std____2__allocator_char____28std__nullptr_t___2c_20std____2__allocator_char___29($7 + 12 | 0 | 0, $6 + 8 | 0 | 0, HEAP32[($6 + 12 | 0) >> 2] | 0 | 0) | 0;
  label$1 : {
   label$2 : {
    if (!(HEAP32[($6 + 20 | 0) >> 2] | 0)) {
     break label$2
    }
    $19 = std____2__allocator_traits_std____2__allocator_char__20___allocate_28std____2__allocator_char___2c_20unsigned_20long_29(std____2____split_buffer_char_2c_20std____2__allocator_char_______alloc_28_29($7 | 0) | 0 | 0, HEAP32[($6 + 20 | 0) >> 2] | 0 | 0) | 0;
    break label$1;
   }
   $19 = 0;
  }
  HEAP32[$7 >> 2] = $19;
  $24 = (HEAP32[$7 >> 2] | 0) + (HEAP32[($6 + 16 | 0) >> 2] | 0) | 0;
  HEAP32[($7 + 8 | 0) >> 2] = $24;
  HEAP32[($7 + 4 | 0) >> 2] = $24;
  $27 = (HEAP32[$7 >> 2] | 0) + (HEAP32[($6 + 20 | 0) >> 2] | 0) | 0;
  HEAP32[(std____2____split_buffer_char_2c_20std____2__allocator_char_______end_cap_28_29($7 | 0) | 0) >> 2] = $27;
  $29 = HEAP32[($6 + 28 | 0) >> 2] | 0;
  __stack_pointer = $6 + 32 | 0;
  return $29 | 0;
 }
 
 function std____2__vector_char_2c_20std____2__allocator_char__20_____swap_out_circular_buffer_28std____2____split_buffer_char_2c_20std____2__allocator_char_____29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0, $5 = 0;
  $4 = __stack_pointer - 16 | 0;
  __stack_pointer = $4;
  HEAP32[($4 + 12 | 0) >> 2] = $0;
  HEAP32[($4 + 8 | 0) >> 2] = $1;
  $5 = HEAP32[($4 + 12 | 0) >> 2] | 0;
  std____2__vector_char_2c_20std____2__allocator_char__20_____annotate_delete_28_29_20const($5 | 0);
  void_20std____2____construct_backward_with_exception_guarantees_std____2__allocator_char__2c_20char_2c_20void__28std____2__allocator_char___2c_20char__2c_20char__2c_20char___29(std____2____vector_base_char_2c_20std____2__allocator_char__20_____alloc_28_29($5 | 0) | 0 | 0, HEAP32[$5 >> 2] | 0 | 0, HEAP32[($5 + 4 | 0) >> 2] | 0 | 0, (HEAP32[($4 + 8 | 0) >> 2] | 0) + 4 | 0 | 0);
  std____2__enable_if__28is_move_constructible_char____value_29_20___20_28is_move_assignable_char____value_29_2c_20void___type_20std____2__swap_char___28char___2c_20char___29($5 | 0, (HEAP32[($4 + 8 | 0) >> 2] | 0) + 4 | 0 | 0);
  std____2__enable_if__28is_move_constructible_char____value_29_20___20_28is_move_assignable_char____value_29_2c_20void___type_20std____2__swap_char___28char___2c_20char___29($5 + 4 | 0 | 0, (HEAP32[($4 + 8 | 0) >> 2] | 0) + 8 | 0 | 0);
  std____2__enable_if__28is_move_constructible_char____value_29_20___20_28is_move_assignable_char____value_29_2c_20void___type_20std____2__swap_char___28char___2c_20char___29(std____2____vector_base_char_2c_20std____2__allocator_char__20_____end_cap_28_29($5 | 0) | 0 | 0, std____2____split_buffer_char_2c_20std____2__allocator_char_______end_cap_28_29(HEAP32[($4 + 8 | 0) >> 2] | 0 | 0) | 0 | 0);
  HEAP32[(HEAP32[($4 + 8 | 0) >> 2] | 0) >> 2] = HEAP32[((HEAP32[($4 + 8 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0;
  std____2__vector_char_2c_20std____2__allocator_char__20_____annotate_new_28unsigned_20long_29_20const($5 | 0, std____2__vector_char_2c_20std____2__allocator_char__20___size_28_29_20const($5 | 0) | 0 | 0);
  std____2__vector_char_2c_20std____2__allocator_char__20_____invalidate_all_iterators_28_29($5 | 0);
  __stack_pointer = $4 + 16 | 0;
  return;
 }
 
 function std____2____split_buffer_char_2c_20std____2__allocator_char________split_buffer_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $4 = 0, $15 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 8 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 8 | 0) >> 2] | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $4;
  std____2____split_buffer_char_2c_20std____2__allocator_char_____clear_28_29($4 | 0);
  label$1 : {
   if (!((HEAP32[$4 >> 2] | 0 | 0) != (0 | 0) & 1 | 0)) {
    break label$1
   }
   std____2__allocator_traits_std____2__allocator_char__20___deallocate_28std____2__allocator_char___2c_20char__2c_20unsigned_20long_29(std____2____split_buffer_char_2c_20std____2__allocator_char_______alloc_28_29($4 | 0) | 0 | 0, HEAP32[$4 >> 2] | 0 | 0, std____2____split_buffer_char_2c_20std____2__allocator_char_____capacity_28_29_20const($4 | 0) | 0 | 0);
  }
  $15 = HEAP32[($3 + 12 | 0) >> 2] | 0;
  __stack_pointer = $3 + 16 | 0;
  return $15 | 0;
 }
 
 function void_20std____2__allocator_char___construct_char_2c_20char__28char__2c_20char___29($0, $1, $2) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  var $5 = 0;
  $5 = __stack_pointer - 16 | 0;
  __stack_pointer = $5;
  HEAP32[($5 + 12 | 0) >> 2] = $0;
  HEAP32[($5 + 8 | 0) >> 2] = $1;
  HEAP32[($5 + 4 | 0) >> 2] = $2;
  HEAP8[(HEAP32[($5 + 8 | 0) >> 2] | 0) >> 0] = HEAPU8[(char___20std____2__forward_char__28std____2__remove_reference_char___type__29(HEAP32[($5 + 4 | 0) >> 2] | 0 | 0) | 0) >> 0] | 0;
  __stack_pointer = $5 + 16 | 0;
  return;
 }
 
 function std____2____compressed_pair_char__2c_20std____2__allocator_char_______compressed_pair_std__nullptr_t_2c_20std____2__allocator_char____28std__nullptr_t___2c_20std____2__allocator_char___29($0, $1, $2) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  var $5 = 0, $6 = 0;
  $5 = __stack_pointer - 16 | 0;
  __stack_pointer = $5;
  HEAP32[($5 + 12 | 0) >> 2] = $0;
  HEAP32[($5 + 8 | 0) >> 2] = $1;
  HEAP32[($5 + 4 | 0) >> 2] = $2;
  $6 = HEAP32[($5 + 12 | 0) >> 2] | 0;
  std____2____compressed_pair_elem_char__2c_200_2c_20false_____compressed_pair_elem_std__nullptr_t_2c_20void__28std__nullptr_t___29($6 | 0, std__nullptr_t___20std____2__forward_std__nullptr_t__28std____2__remove_reference_std__nullptr_t___type__29(HEAP32[($5 + 8 | 0) >> 2] | 0 | 0) | 0 | 0) | 0;
  std____2____compressed_pair_elem_std____2__allocator_char___2c_201_2c_20false_____compressed_pair_elem_std____2__allocator_char___2c_20void__28std____2__allocator_char___29($6 + 4 | 0 | 0, std____2__allocator_char___20std____2__forward_std____2__allocator_char____28std____2__remove_reference_std____2__allocator_char_____type__29(HEAP32[($5 + 4 | 0) >> 2] | 0 | 0) | 0 | 0) | 0;
  __stack_pointer = $5 + 16 | 0;
  return $6 | 0;
 }
 
 function std____2____split_buffer_char_2c_20std____2__allocator_char_______alloc_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $7 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $7 = std____2____compressed_pair_char__2c_20std____2__allocator_char_____second_28_29((HEAP32[($3 + 12 | 0) >> 2] | 0) + 12 | 0 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $7 | 0;
 }
 
 function std____2____split_buffer_char_2c_20std____2__allocator_char_______end_cap_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $7 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $7 = std____2____compressed_pair_char__2c_20std____2__allocator_char_____first_28_29((HEAP32[($3 + 12 | 0) >> 2] | 0) + 12 | 0 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $7 | 0;
 }
 
 function void_20std____2____construct_backward_with_exception_guarantees_std____2__allocator_char__2c_20char_2c_20void__28std____2__allocator_char___2c_20char__2c_20char__2c_20char___29($0, $1, $2, $3) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  $3 = $3 | 0;
  var $6 = 0, $11 = 0;
  $6 = __stack_pointer - 32 | 0;
  __stack_pointer = $6;
  HEAP32[($6 + 28 | 0) >> 2] = $0;
  HEAP32[($6 + 24 | 0) >> 2] = $1;
  HEAP32[($6 + 20 | 0) >> 2] = $2;
  HEAP32[($6 + 16 | 0) >> 2] = $3;
  HEAP32[($6 + 12 | 0) >> 2] = (HEAP32[($6 + 20 | 0) >> 2] | 0) - (HEAP32[($6 + 24 | 0) >> 2] | 0) | 0;
  $11 = HEAP32[($6 + 16 | 0) >> 2] | 0;
  HEAP32[$11 >> 2] = (HEAP32[$11 >> 2] | 0) + (0 - (HEAP32[($6 + 12 | 0) >> 2] | 0) | 0) | 0;
  label$1 : {
   if (!((HEAP32[($6 + 12 | 0) >> 2] | 0 | 0) > (0 | 0) & 1 | 0)) {
    break label$1
   }
   __memcpy(HEAP32[(HEAP32[($6 + 16 | 0) >> 2] | 0) >> 2] | 0 | 0, HEAP32[($6 + 24 | 0) >> 2] | 0 | 0, (HEAP32[($6 + 12 | 0) >> 2] | 0) << 0 | 0 | 0) | 0;
  }
  __stack_pointer = $6 + 32 | 0;
  return;
 }
 
 function std____2__enable_if__28is_move_constructible_char____value_29_20___20_28is_move_assignable_char____value_29_2c_20void___type_20std____2__swap_char___28char___2c_20char___29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0, $10 = 0, $16 = 0;
  $4 = __stack_pointer - 16 | 0;
  __stack_pointer = $4;
  HEAP32[($4 + 12 | 0) >> 2] = $0;
  HEAP32[($4 + 8 | 0) >> 2] = $1;
  HEAP32[($4 + 4 | 0) >> 2] = HEAP32[(std____2__remove_reference_char_____type___20std____2__move_char____28char___29(HEAP32[($4 + 12 | 0) >> 2] | 0 | 0) | 0) >> 2] | 0;
  $10 = HEAP32[(std____2__remove_reference_char_____type___20std____2__move_char____28char___29(HEAP32[($4 + 8 | 0) >> 2] | 0 | 0) | 0) >> 2] | 0;
  HEAP32[(HEAP32[($4 + 12 | 0) >> 2] | 0) >> 2] = $10;
  $16 = HEAP32[(std____2__remove_reference_char_____type___20std____2__move_char____28char___29($4 + 4 | 0 | 0) | 0) >> 2] | 0;
  HEAP32[(HEAP32[($4 + 8 | 0) >> 2] | 0) >> 2] = $16;
  __stack_pointer = $4 + 16 | 0;
  return;
 }
 
 function std____2____split_buffer_char_2c_20std____2__allocator_char_____clear_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $4 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 12 | 0) >> 2] | 0;
  std____2____split_buffer_char_2c_20std____2__allocator_char_______destruct_at_end_28char__29($4 | 0, HEAP32[($4 + 4 | 0) >> 2] | 0 | 0);
  __stack_pointer = $3 + 16 | 0;
  return;
 }
 
 function std____2____split_buffer_char_2c_20std____2__allocator_char_____capacity_28_29_20const($0) {
  $0 = $0 | 0;
  var $3 = 0, $4 = 0, $8 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 12 | 0) >> 2] | 0;
  $8 = (HEAP32[(std____2____split_buffer_char_2c_20std____2__allocator_char_______end_cap_28_29_20const($4 | 0) | 0) >> 2] | 0) - (HEAP32[$4 >> 2] | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $8 | 0;
 }
 
 function std____2__allocator_char___20std____2__forward_std____2__allocator_char____28std____2__remove_reference_std____2__allocator_char_____type__29($0) {
  $0 = $0 | 0;
  var $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  return HEAP32[($3 + 12 | 0) >> 2] | 0 | 0;
 }
 
 function std____2____compressed_pair_elem_std____2__allocator_char___2c_201_2c_20false_____compressed_pair_elem_std____2__allocator_char___2c_20void__28std____2__allocator_char___29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0, $5 = 0;
  $4 = __stack_pointer - 16 | 0;
  __stack_pointer = $4;
  HEAP32[($4 + 12 | 0) >> 2] = $0;
  HEAP32[($4 + 8 | 0) >> 2] = $1;
  $5 = HEAP32[($4 + 12 | 0) >> 2] | 0;
  HEAP32[$5 >> 2] = std____2__allocator_char___20std____2__forward_std____2__allocator_char____28std____2__remove_reference_std____2__allocator_char_____type__29(HEAP32[($4 + 8 | 0) >> 2] | 0 | 0) | 0;
  __stack_pointer = $4 + 16 | 0;
  return $5 | 0;
 }
 
 function std____2____compressed_pair_char__2c_20std____2__allocator_char_____second_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $7 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $7 = std____2____compressed_pair_elem_std____2__allocator_char___2c_201_2c_20false_____get_28_29((HEAP32[($3 + 12 | 0) >> 2] | 0) + 4 | 0 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $7 | 0;
 }
 
 function std____2____compressed_pair_char__2c_20std____2__allocator_char_____first_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $5 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $5 = std____2____compressed_pair_elem_char__2c_200_2c_20false_____get_28_29(HEAP32[($3 + 12 | 0) >> 2] | 0 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $5 | 0;
 }
 
 function std____2____compressed_pair_elem_std____2__allocator_char___2c_201_2c_20false_____get_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  return HEAP32[(HEAP32[($3 + 12 | 0) >> 2] | 0) >> 2] | 0 | 0;
 }
 
 function std____2__remove_reference_char_____type___20std____2__move_char____28char___29($0) {
  $0 = $0 | 0;
  var $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  return HEAP32[($3 + 12 | 0) >> 2] | 0 | 0;
 }
 
 function std____2____split_buffer_char_2c_20std____2__allocator_char_______destruct_at_end_28char__29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0;
  $4 = __stack_pointer - 16 | 0;
  __stack_pointer = $4;
  HEAP32[($4 + 12 | 0) >> 2] = $0;
  HEAP32[($4 + 8 | 0) >> 2] = $1;
  std____2____split_buffer_char_2c_20std____2__allocator_char_______destruct_at_end_28char__2c_20std____2__integral_constant_bool_2c_20false__29(HEAP32[($4 + 12 | 0) >> 2] | 0 | 0, HEAP32[($4 + 8 | 0) >> 2] | 0 | 0);
  __stack_pointer = $4 + 16 | 0;
  return;
 }
 
 function std____2____split_buffer_char_2c_20std____2__allocator_char_______end_cap_28_29_20const($0) {
  $0 = $0 | 0;
  var $3 = 0, $7 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $7 = std____2____compressed_pair_char__2c_20std____2__allocator_char_____first_28_29_20const((HEAP32[($3 + 12 | 0) >> 2] | 0) + 12 | 0 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $7 | 0;
 }
 
 function std____2____split_buffer_char_2c_20std____2__allocator_char_______destruct_at_end_28char__2c_20std____2__integral_constant_bool_2c_20false__29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0, $5 = 0, $16 = 0, $13 = 0;
  $4 = __stack_pointer - 16 | 0;
  __stack_pointer = $4;
  HEAP32[($4 + 4 | 0) >> 2] = $0;
  HEAP32[$4 >> 2] = $1;
  $5 = HEAP32[($4 + 4 | 0) >> 2] | 0;
  label$1 : {
   label$2 : while (1) {
    if (!((HEAP32[$4 >> 2] | 0 | 0) != (HEAP32[($5 + 8 | 0) >> 2] | 0 | 0) & 1 | 0)) {
     break label$1
    }
    $13 = std____2____split_buffer_char_2c_20std____2__allocator_char_______alloc_28_29($5 | 0) | 0;
    $16 = (HEAP32[($5 + 8 | 0) >> 2] | 0) + -1 | 0;
    HEAP32[($5 + 8 | 0) >> 2] = $16;
    void_20std____2__allocator_traits_std____2__allocator_char__20___destroy_char_2c_20void__28std____2__allocator_char___2c_20char__29($13 | 0, char__20std____2____to_address_char__28char__29($16 | 0) | 0 | 0);
    continue label$2;
   };
  }
  __stack_pointer = $4 + 16 | 0;
  return;
 }
 
 function std____2____compressed_pair_char__2c_20std____2__allocator_char_____first_28_29_20const($0) {
  $0 = $0 | 0;
  var $3 = 0, $5 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $5 = std____2____compressed_pair_elem_char__2c_200_2c_20false_____get_28_29_20const(HEAP32[($3 + 12 | 0) >> 2] | 0 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $5 | 0;
 }
 
 function File___File_28_29_1($0) {
  $0 = $0 | 0;
  HEAP32[((__stack_pointer - 16 | 0) + 12 | 0) >> 2] = $0;
  abort();
 }
 
 function _GLOBAL__sub_I_file_cpp() {
  __cxx_global_var_init();
  __cxx_global_var_init_1();
  return;
 }
 
 function __cxx_global_var_init_2() {
  std____2__vector_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20___vector_28_29(2736 | 0) | 0;
  __cxa_atexit(21 | 0, 0 | 0, 1024 | 0) | 0;
  return;
 }
 
 function std____2__vector_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20___vector_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $4 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 12 | 0) >> 2] | 0;
  std____2____vector_base_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20_____vector_base_28_29($4 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $4 | 0;
 }
 
 function __cxx_global_array_dtor_1($0) {
  $0 = $0 | 0;
  var $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  std____2__vector_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20____vector_28_29(2736 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return;
 }
 
 function std____2____vector_base_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20_____vector_base_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $4 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 12 | 0) >> 2] | 0;
  std____2____vector_base_common_true_____vector_base_common_28_29($4 | 0) | 0;
  HEAP32[$4 >> 2] = 0;
  HEAP32[($4 + 4 | 0) >> 2] = 0;
  HEAP32[($3 + 8 | 0) >> 2] = 0;
  std____2____compressed_pair_std____2__shared_ptr_OpenFileDescriptor___2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20_____compressed_pair_std__nullptr_t_2c_20std____2____default_init_tag__28std__nullptr_t___2c_20std____2____default_init_tag___29($4 + 8 | 0 | 0, $3 + 8 | 0 | 0, $3 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $4 | 0;
 }
 
 function std____2__vector_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20____vector_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $4 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 12 | 0) >> 2] | 0;
  std____2__vector_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20_____annotate_delete_28_29_20const($4 | 0);
  std____2____vector_base_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20______vector_base_28_29($4 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $4 | 0;
 }
 
 function std____2__vector_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20_____annotate_delete_28_29_20const($0) {
  $0 = $0 | 0;
  var $4 = 0, $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 12 | 0) >> 2] | 0;
  std____2__vector_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20_____annotate_contiguous_container_28void_20const__2c_20void_20const__2c_20void_20const__2c_20void_20const__29_20const($4 | 0, std____2__vector_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20___data_28_29_20const($4 | 0) | 0 | 0, (std____2__vector_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20___data_28_29_20const($4 | 0) | 0) + ((std____2__vector_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20___capacity_28_29_20const($4 | 0) | 0) << 3 | 0) | 0 | 0, (std____2__vector_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20___data_28_29_20const($4 | 0) | 0) + ((std____2__vector_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20___size_28_29_20const($4 | 0) | 0) << 3 | 0) | 0 | 0, (std____2__vector_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20___data_28_29_20const($4 | 0) | 0) + ((std____2__vector_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20___capacity_28_29_20const($4 | 0) | 0) << 3 | 0) | 0 | 0);
  __stack_pointer = $3 + 16 | 0;
  return;
 }
 
 function std____2____vector_base_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20______vector_base_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $4 = 0, $15 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 8 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 8 | 0) >> 2] | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $4;
  label$1 : {
   if (!((HEAP32[$4 >> 2] | 0 | 0) != (0 | 0) & 1 | 0)) {
    break label$1
   }
   std____2____vector_base_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20___clear_28_29($4 | 0);
   std____2__allocator_traits_std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20___deallocate_28std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20___2c_20std____2__shared_ptr_OpenFileDescriptor___2c_20unsigned_20long_29(std____2____vector_base_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20_____alloc_28_29($4 | 0) | 0 | 0, HEAP32[$4 >> 2] | 0 | 0, std____2____vector_base_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20___capacity_28_29_20const($4 | 0) | 0 | 0);
  }
  $15 = HEAP32[($3 + 12 | 0) >> 2] | 0;
  __stack_pointer = $3 + 16 | 0;
  return $15 | 0;
 }
 
 function std____2__vector_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20___size_28_29_20const($0) {
  $0 = $0 | 0;
  var $3 = 0, $4 = 0;
  $3 = __stack_pointer - 16 | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 12 | 0) >> 2] | 0;
  return ((HEAP32[($4 + 4 | 0) >> 2] | 0) - (HEAP32[$4 >> 2] | 0) | 0) >> 3 | 0 | 0;
 }
 
 function std____2____vector_base_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20_____end_cap_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $7 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $7 = std____2____compressed_pair_std____2__shared_ptr_OpenFileDescriptor___2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20___first_28_29((HEAP32[($3 + 12 | 0) >> 2] | 0) + 8 | 0 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $7 | 0;
 }
 
 function std____2__remove_reference_std____2__shared_ptr_OpenFileDescriptor_____type___20std____2__move_std____2__shared_ptr_OpenFileDescriptor____28std____2__shared_ptr_OpenFileDescriptor___29($0) {
  $0 = $0 | 0;
  var $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  return HEAP32[($3 + 12 | 0) >> 2] | 0 | 0;
 }
 
 function std____2__shared_ptr_OpenFileDescriptor___shared_ptr_28std____2__shared_ptr_OpenFileDescriptor____29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0, $5 = 0;
  $4 = __stack_pointer - 16 | 0;
  HEAP32[($4 + 12 | 0) >> 2] = $0;
  HEAP32[($4 + 8 | 0) >> 2] = $1;
  $5 = HEAP32[($4 + 12 | 0) >> 2] | 0;
  HEAP32[$5 >> 2] = HEAP32[(HEAP32[($4 + 8 | 0) >> 2] | 0) >> 2] | 0;
  HEAP32[($5 + 4 | 0) >> 2] = HEAP32[((HEAP32[($4 + 8 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0;
  HEAP32[(HEAP32[($4 + 8 | 0) >> 2] | 0) >> 2] = 0;
  HEAP32[((HEAP32[($4 + 8 | 0) >> 2] | 0) + 4 | 0) >> 2] = 0;
  return $5 | 0;
 }
 
 function FileTable__get_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  label$1 : {
   if (!((((HEAPU8[(0 + 2780 | 0) >> 0] | 0) & 1 | 0) & 255 | 0 | 0) == (0 & 255 | 0 | 0) & 1 | 0)) {
    break label$1
   }
   if (!(__cxa_guard_acquire(2780 | 0) | 0)) {
    break label$1
   }
   Lockable_FileTable___Lockable___28_29(2748 | 0) | 0;
   __cxa_atexit(22 | 0, 0 | 0, 1024 | 0) | 0;
   __cxa_guard_release(2780 | 0);
  }
  Lockable_FileTable___get_28_29($0 | 0, 2748 | 0);
  __stack_pointer = $3 + 16 | 0;
  return;
 }
 
 function Lockable_FileTable___Lockable___28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $4 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 12 | 0) >> 2] | 0;
  FileTable__FileTable_28_29($4 | 0) | 0;
  std____2__mutex__mutex_28_29($4 + 4 | 0 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $4 | 0;
 }
 
 function __cxx_global_array_dtor_2_1($0) {
  $0 = $0 | 0;
  var $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  Lockable_FileTable____Lockable_28_29(2748 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return;
 }
 
 function Lockable_FileTable___get_28_29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0, $5 = 0;
  $4 = __stack_pointer - 16 | 0;
  __stack_pointer = $4;
  HEAP32[($4 + 12 | 0) >> 2] = $0;
  HEAP32[($4 + 8 | 0) >> 2] = $1;
  $5 = HEAP32[($4 + 8 | 0) >> 2] | 0;
  Locked_FileTable___Locked_28FileTable__2c_20std____2__mutex__29($0 | 0, $5 | 0, $5 + 4 | 0 | 0) | 0;
  __stack_pointer = $4 + 16 | 0;
  return;
 }
 
 function FileTable__FileTable_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $4 = 0;
  $3 = __stack_pointer - 80 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 76 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 76 | 0) >> 2] | 0;
  HEAP32[($3 + 60 | 0) >> 2] = 0;
  std____2__shared_ptr_StdinFile__20std____2__make_shared_StdinFile_2c_20void__28_29($3 + 48 | 0 | 0);
  std____2__shared_ptr_OpenFileDescriptor__20std____2__make_shared_OpenFileDescriptor_2c_20int_2c_20std____2__shared_ptr_StdinFile__2c_20void__28int___2c_20std____2__shared_ptr_StdinFile____29($3 + 64 | 0 | 0, $3 + 60 | 0 | 0, $3 + 48 | 0 | 0);
  std____2__vector_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20___push_back_28std____2__shared_ptr_OpenFileDescriptor____29(2736 | 0, $3 + 64 | 0 | 0);
  std____2__shared_ptr_OpenFileDescriptor____shared_ptr_28_29($3 + 64 | 0 | 0) | 0;
  std____2__shared_ptr_StdinFile____shared_ptr_28_29($3 + 48 | 0 | 0) | 0;
  HEAP32[($3 + 36 | 0) >> 2] = 0;
  std____2__shared_ptr_StdoutFile__20std____2__make_shared_StdoutFile_2c_20void__28_29($3 + 24 | 0 | 0);
  std____2__shared_ptr_OpenFileDescriptor__20std____2__make_shared_OpenFileDescriptor_2c_20int_2c_20std____2__shared_ptr_StdoutFile__2c_20void__28int___2c_20std____2__shared_ptr_StdoutFile____29($3 + 40 | 0 | 0, $3 + 36 | 0 | 0, $3 + 24 | 0 | 0);
  std____2__vector_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20___push_back_28std____2__shared_ptr_OpenFileDescriptor____29(2736 | 0, $3 + 40 | 0 | 0);
  std____2__shared_ptr_OpenFileDescriptor____shared_ptr_28_29($3 + 40 | 0 | 0) | 0;
  std____2__shared_ptr_StdoutFile____shared_ptr_28_29($3 + 24 | 0 | 0) | 0;
  HEAP32[($3 + 12 | 0) >> 2] = 0;
  std____2__shared_ptr_StderrFile__20std____2__make_shared_StderrFile_2c_20void__28_29($3 | 0);
  std____2__shared_ptr_OpenFileDescriptor__20std____2__make_shared_OpenFileDescriptor_2c_20int_2c_20std____2__shared_ptr_StderrFile__2c_20void__28int___2c_20std____2__shared_ptr_StderrFile____29($3 + 16 | 0 | 0, $3 + 12 | 0 | 0, $3 | 0);
  std____2__vector_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20___push_back_28std____2__shared_ptr_OpenFileDescriptor____29(2736 | 0, $3 + 16 | 0 | 0);
  std____2__shared_ptr_OpenFileDescriptor____shared_ptr_28_29($3 + 16 | 0 | 0) | 0;
  std____2__shared_ptr_StderrFile____shared_ptr_28_29($3 | 0) | 0;
  __stack_pointer = $3 + 80 | 0;
  return $4 | 0;
 }
 
 function std____2__mutex__mutex_28_29($0) {
  $0 = $0 | 0;
  var i64toi32_i32$1 = 0, $4 = 0, i64toi32_i32$0 = 0, $5 = 0, $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 12 | 0) >> 2] | 0;
  i64toi32_i32$0 = 0;
  $5 = 0;
  i64toi32_i32$1 = $4;
  HEAP32[i64toi32_i32$1 >> 2] = $5;
  HEAP32[(i64toi32_i32$1 + 4 | 0) >> 2] = i64toi32_i32$0;
  HEAP32[(i64toi32_i32$1 + 24 | 0) >> 2] = 0;
  i64toi32_i32$1 = i64toi32_i32$1 + 16 | 0;
  HEAP32[i64toi32_i32$1 >> 2] = $5;
  HEAP32[(i64toi32_i32$1 + 4 | 0) >> 2] = i64toi32_i32$0;
  i64toi32_i32$1 = $4 + 8 | 0;
  HEAP32[i64toi32_i32$1 >> 2] = $5;
  HEAP32[(i64toi32_i32$1 + 4 | 0) >> 2] = i64toi32_i32$0;
  return $4 | 0;
 }
 
 function Lockable_FileTable____Lockable_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $4 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 12 | 0) >> 2] | 0;
  std____2__mutex___mutex_28_29($4 + 4 | 0 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $4 | 0;
 }
 
 function Locked_FileTable___Locked_28FileTable__2c_20std____2__mutex__29($0, $1, $2) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  var $5 = 0, $6 = 0;
  $5 = __stack_pointer - 16 | 0;
  __stack_pointer = $5;
  HEAP32[($5 + 12 | 0) >> 2] = $0;
  HEAP32[($5 + 8 | 0) >> 2] = $1;
  HEAP32[($5 + 4 | 0) >> 2] = $2;
  $6 = HEAP32[($5 + 12 | 0) >> 2] | 0;
  HEAP32[$6 >> 2] = HEAP32[($5 + 8 | 0) >> 2] | 0;
  std____2__unique_lock_std____2__mutex___unique_lock_28std____2__mutex__2c_20std____2__defer_lock_t_29($6 + 4 | 0 | 0, HEAP32[($5 + 4 | 0) >> 2] | 0 | 0) | 0;
  std____2__unique_lock_std____2__mutex___lock_28_29($6 + 4 | 0 | 0);
  __stack_pointer = $5 + 16 | 0;
  return $6 | 0;
 }
 
 function std____2____shared_weak_count____add_shared_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  std____2____shared_count____add_shared_28_29(HEAP32[($3 + 12 | 0) >> 2] | 0 | 0);
  __stack_pointer = $3 + 16 | 0;
  return;
 }
 
 function std____2____compressed_pair_std____2__shared_ptr_OpenFileDescriptor___2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20_____compressed_pair_std__nullptr_t_2c_20std____2____default_init_tag__28std__nullptr_t___2c_20std____2____default_init_tag___29($0, $1, $2) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  var $5 = 0, $6 = 0;
  $5 = __stack_pointer - 16 | 0;
  __stack_pointer = $5;
  HEAP32[($5 + 12 | 0) >> 2] = $0;
  HEAP32[($5 + 8 | 0) >> 2] = $1;
  HEAP32[($5 + 4 | 0) >> 2] = $2;
  $6 = HEAP32[($5 + 12 | 0) >> 2] | 0;
  std____2____compressed_pair_elem_std____2__shared_ptr_OpenFileDescriptor___2c_200_2c_20false_____compressed_pair_elem_std__nullptr_t_2c_20void__28std__nullptr_t___29($6 | 0, std__nullptr_t___20std____2__forward_std__nullptr_t__28std____2__remove_reference_std__nullptr_t___type__29(HEAP32[($5 + 8 | 0) >> 2] | 0 | 0) | 0 | 0) | 0;
  std____2____default_init_tag___20std____2__forward_std____2____default_init_tag__28std____2__remove_reference_std____2____default_init_tag___type__29(HEAP32[($5 + 4 | 0) >> 2] | 0 | 0) | 0;
  std____2____compressed_pair_elem_std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__2c_201_2c_20true_____compressed_pair_elem_28std____2____default_init_tag_29($6 | 0) | 0;
  __stack_pointer = $5 + 16 | 0;
  return $6 | 0;
 }
 
 function std____2____compressed_pair_elem_std____2__shared_ptr_OpenFileDescriptor___2c_200_2c_20false_____compressed_pair_elem_std__nullptr_t_2c_20void__28std__nullptr_t___29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0, $5 = 0;
  $4 = __stack_pointer - 16 | 0;
  __stack_pointer = $4;
  HEAP32[($4 + 12 | 0) >> 2] = $0;
  HEAP32[($4 + 8 | 0) >> 2] = $1;
  $5 = HEAP32[($4 + 12 | 0) >> 2] | 0;
  std__nullptr_t___20std____2__forward_std__nullptr_t__28std____2__remove_reference_std__nullptr_t___type__29(HEAP32[($4 + 8 | 0) >> 2] | 0 | 0) | 0;
  HEAP32[$5 >> 2] = 0;
  __stack_pointer = $4 + 16 | 0;
  return $5 | 0;
 }
 
 function std____2____compressed_pair_elem_std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__2c_201_2c_20true_____compressed_pair_elem_28std____2____default_init_tag_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $4 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 4 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 4 | 0) >> 2] | 0;
  std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20___allocator_28_29($4 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $4 | 0;
 }
 
 function std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20___allocator_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  return HEAP32[($3 + 12 | 0) >> 2] | 0 | 0;
 }
 
 function std____2__vector_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20___data_28_29_20const($0) {
  $0 = $0 | 0;
  var $3 = 0, $6 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $6 = std____2__shared_ptr_OpenFileDescriptor___20std____2____to_address_std____2__shared_ptr_OpenFileDescriptor__20__28std____2__shared_ptr_OpenFileDescriptor___29(HEAP32[(HEAP32[($3 + 12 | 0) >> 2] | 0) >> 2] | 0 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $6 | 0;
 }
 
 function std____2__vector_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20___capacity_28_29_20const($0) {
  $0 = $0 | 0;
  var $3 = 0, $5 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $5 = std____2____vector_base_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20___capacity_28_29_20const(HEAP32[($3 + 12 | 0) >> 2] | 0 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $5 | 0;
 }
 
 function std____2__vector_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20_____annotate_contiguous_container_28void_20const__2c_20void_20const__2c_20void_20const__2c_20void_20const__29_20const($0, $1, $2, $3, $4) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  $3 = $3 | 0;
  $4 = $4 | 0;
  var $7 = 0;
  $7 = __stack_pointer - 32 | 0;
  HEAP32[($7 + 28 | 0) >> 2] = $0;
  HEAP32[($7 + 24 | 0) >> 2] = $1;
  HEAP32[($7 + 20 | 0) >> 2] = $2;
  HEAP32[($7 + 16 | 0) >> 2] = $3;
  HEAP32[($7 + 12 | 0) >> 2] = $4;
  return;
 }
 
 function std____2____vector_base_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20___clear_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $4 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 12 | 0) >> 2] | 0;
  std____2____vector_base_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20_____destruct_at_end_28std____2__shared_ptr_OpenFileDescriptor___29($4 | 0, HEAP32[$4 >> 2] | 0 | 0);
  __stack_pointer = $3 + 16 | 0;
  return;
 }
 
 function std____2____vector_base_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20_____alloc_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $7 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $7 = std____2____compressed_pair_std____2__shared_ptr_OpenFileDescriptor___2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20___second_28_29((HEAP32[($3 + 12 | 0) >> 2] | 0) + 8 | 0 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $7 | 0;
 }
 
 function std____2____vector_base_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20___capacity_28_29_20const($0) {
  $0 = $0 | 0;
  var $3 = 0, $4 = 0, $10 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 12 | 0) >> 2] | 0;
  $10 = ((HEAP32[(std____2____vector_base_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20_____end_cap_28_29_20const($4 | 0) | 0) >> 2] | 0) - (HEAP32[$4 >> 2] | 0) | 0) >> 3 | 0;
  __stack_pointer = $3 + 16 | 0;
  return $10 | 0;
 }
 
 function std____2__allocator_traits_std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20___deallocate_28std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20___2c_20std____2__shared_ptr_OpenFileDescriptor___2c_20unsigned_20long_29($0, $1, $2) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  var $5 = 0;
  $5 = __stack_pointer - 16 | 0;
  __stack_pointer = $5;
  HEAP32[($5 + 12 | 0) >> 2] = $0;
  HEAP32[($5 + 8 | 0) >> 2] = $1;
  HEAP32[($5 + 4 | 0) >> 2] = $2;
  std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20___deallocate_28std____2__shared_ptr_OpenFileDescriptor___2c_20unsigned_20long_29(HEAP32[($5 + 12 | 0) >> 2] | 0 | 0, HEAP32[($5 + 8 | 0) >> 2] | 0 | 0, HEAP32[($5 + 4 | 0) >> 2] | 0 | 0);
  __stack_pointer = $5 + 16 | 0;
  return;
 }
 
 function std____2__shared_ptr_OpenFileDescriptor___20std____2____to_address_std____2__shared_ptr_OpenFileDescriptor__20__28std____2__shared_ptr_OpenFileDescriptor___29($0) {
  $0 = $0 | 0;
  var $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  return HEAP32[($3 + 12 | 0) >> 2] | 0 | 0;
 }
 
 function std____2____vector_base_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20_____end_cap_28_29_20const($0) {
  $0 = $0 | 0;
  var $3 = 0, $7 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $7 = std____2____compressed_pair_std____2__shared_ptr_OpenFileDescriptor___2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20___first_28_29_20const((HEAP32[($3 + 12 | 0) >> 2] | 0) + 8 | 0 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $7 | 0;
 }
 
 function std____2____compressed_pair_std____2__shared_ptr_OpenFileDescriptor___2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20___first_28_29_20const($0) {
  $0 = $0 | 0;
  var $3 = 0, $5 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $5 = std____2____compressed_pair_elem_std____2__shared_ptr_OpenFileDescriptor___2c_200_2c_20false_____get_28_29_20const(HEAP32[($3 + 12 | 0) >> 2] | 0 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $5 | 0;
 }
 
 function std____2____compressed_pair_elem_std____2__shared_ptr_OpenFileDescriptor___2c_200_2c_20false_____get_28_29_20const($0) {
  $0 = $0 | 0;
  var $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  return HEAP32[($3 + 12 | 0) >> 2] | 0 | 0;
 }
 
 function std____2____vector_base_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20_____destruct_at_end_28std____2__shared_ptr_OpenFileDescriptor___29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0, $5 = 0, $17 = 0, $14 = 0;
  $4 = __stack_pointer - 16 | 0;
  __stack_pointer = $4;
  HEAP32[($4 + 12 | 0) >> 2] = $0;
  HEAP32[($4 + 8 | 0) >> 2] = $1;
  $5 = HEAP32[($4 + 12 | 0) >> 2] | 0;
  HEAP32[($4 + 4 | 0) >> 2] = HEAP32[($5 + 4 | 0) >> 2] | 0;
  label$1 : {
   label$2 : while (1) {
    if (!((HEAP32[($4 + 8 | 0) >> 2] | 0 | 0) != (HEAP32[($4 + 4 | 0) >> 2] | 0 | 0) & 1 | 0)) {
     break label$1
    }
    $14 = std____2____vector_base_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20_____alloc_28_29($5 | 0) | 0;
    $17 = (HEAP32[($4 + 4 | 0) >> 2] | 0) + -8 | 0;
    HEAP32[($4 + 4 | 0) >> 2] = $17;
    void_20std____2__allocator_traits_std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20___destroy_std____2__shared_ptr_OpenFileDescriptor__2c_20void__28std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20___2c_20std____2__shared_ptr_OpenFileDescriptor___29($14 | 0, std____2__shared_ptr_OpenFileDescriptor___20std____2____to_address_std____2__shared_ptr_OpenFileDescriptor__20__28std____2__shared_ptr_OpenFileDescriptor___29($17 | 0) | 0 | 0);
    continue label$2;
   };
  }
  HEAP32[($5 + 4 | 0) >> 2] = HEAP32[($4 + 8 | 0) >> 2] | 0;
  __stack_pointer = $4 + 16 | 0;
  return;
 }
 
 function std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20___deallocate_28std____2__shared_ptr_OpenFileDescriptor___2c_20unsigned_20long_29($0, $1, $2) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  var $5 = 0;
  $5 = __stack_pointer - 16 | 0;
  __stack_pointer = $5;
  HEAP32[($5 + 12 | 0) >> 2] = $0;
  HEAP32[($5 + 8 | 0) >> 2] = $1;
  HEAP32[($5 + 4 | 0) >> 2] = $2;
  std____2____libcpp_deallocate_28void__2c_20unsigned_20long_2c_20unsigned_20long_29(HEAP32[($5 + 8 | 0) >> 2] | 0 | 0, (HEAP32[($5 + 4 | 0) >> 2] | 0) << 3 | 0 | 0, 4 | 0);
  __stack_pointer = $5 + 16 | 0;
  return;
 }
 
 function std____2____compressed_pair_std____2__shared_ptr_OpenFileDescriptor___2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20___second_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $5 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $5 = std____2____compressed_pair_elem_std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__2c_201_2c_20true_____get_28_29(HEAP32[($3 + 12 | 0) >> 2] | 0 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $5 | 0;
 }
 
 function void_20std____2__allocator_traits_std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20___destroy_std____2__shared_ptr_OpenFileDescriptor__2c_20void__28std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20___2c_20std____2__shared_ptr_OpenFileDescriptor___29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0;
  $4 = __stack_pointer - 16 | 0;
  __stack_pointer = $4;
  HEAP32[($4 + 12 | 0) >> 2] = $0;
  HEAP32[($4 + 8 | 0) >> 2] = $1;
  std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20___destroy_28std____2__shared_ptr_OpenFileDescriptor___29(HEAP32[($4 + 12 | 0) >> 2] | 0 | 0, HEAP32[($4 + 8 | 0) >> 2] | 0 | 0);
  __stack_pointer = $4 + 16 | 0;
  return;
 }
 
 function std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20___destroy_28std____2__shared_ptr_OpenFileDescriptor___29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0;
  $4 = __stack_pointer - 16 | 0;
  __stack_pointer = $4;
  HEAP32[($4 + 12 | 0) >> 2] = $0;
  HEAP32[($4 + 8 | 0) >> 2] = $1;
  std____2__shared_ptr_OpenFileDescriptor____shared_ptr_28_29(HEAP32[($4 + 8 | 0) >> 2] | 0 | 0) | 0;
  __stack_pointer = $4 + 16 | 0;
  return;
 }
 
 function std____2____compressed_pair_elem_std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__2c_201_2c_20true_____get_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  return HEAP32[($3 + 12 | 0) >> 2] | 0 | 0;
 }
 
 function std____2____compressed_pair_std____2__shared_ptr_OpenFileDescriptor___2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20___first_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $5 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $5 = std____2____compressed_pair_elem_std____2__shared_ptr_OpenFileDescriptor___2c_200_2c_20false_____get_28_29(HEAP32[($3 + 12 | 0) >> 2] | 0 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $5 | 0;
 }
 
 function std____2__vector_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20____ConstructTransaction___ConstructTransaction_28std____2__vector_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20___2c_20unsigned_20long_29($0, $1, $2) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  var $5 = 0, $6 = 0;
  $5 = __stack_pointer - 16 | 0;
  HEAP32[($5 + 12 | 0) >> 2] = $0;
  HEAP32[($5 + 8 | 0) >> 2] = $1;
  HEAP32[($5 + 4 | 0) >> 2] = $2;
  $6 = HEAP32[($5 + 12 | 0) >> 2] | 0;
  HEAP32[$6 >> 2] = HEAP32[($5 + 8 | 0) >> 2] | 0;
  HEAP32[($6 + 4 | 0) >> 2] = HEAP32[((HEAP32[($5 + 8 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0;
  HEAP32[($6 + 8 | 0) >> 2] = (HEAP32[((HEAP32[($5 + 8 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0) + ((HEAP32[($5 + 4 | 0) >> 2] | 0) << 3 | 0) | 0;
  return $6 | 0;
 }
 
 function std____2__vector_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20____ConstructTransaction____ConstructTransaction_28_29($0) {
  $0 = $0 | 0;
  var $4 = 0, $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 12 | 0) >> 2] | 0;
  HEAP32[((HEAP32[$4 >> 2] | 0) + 4 | 0) >> 2] = HEAP32[($4 + 4 | 0) >> 2] | 0;
  return $4 | 0;
 }
 
 function std____2__vector_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20_____recommend_28unsigned_20long_29_20const($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0, $5 = 0, $36 = 0;
  $4 = __stack_pointer - 32 | 0;
  __stack_pointer = $4;
  HEAP32[($4 + 24 | 0) >> 2] = $0;
  HEAP32[($4 + 20 | 0) >> 2] = $1;
  $5 = HEAP32[($4 + 24 | 0) >> 2] | 0;
  HEAP32[($4 + 16 | 0) >> 2] = std____2__vector_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20___max_size_28_29_20const($5 | 0) | 0;
  label$1 : {
   if (!((HEAP32[($4 + 20 | 0) >> 2] | 0) >>> 0 > (HEAP32[($4 + 16 | 0) >> 2] | 0) >>> 0 & 1 | 0)) {
    break label$1
   }
   std____2____vector_base_common_true_____throw_length_error_28_29_20const($5 | 0);
   abort();
  }
  HEAP32[($4 + 12 | 0) >> 2] = std____2__vector_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20___capacity_28_29_20const($5 | 0) | 0;
  label$2 : {
   label$3 : {
    if (!((HEAP32[($4 + 12 | 0) >> 2] | 0) >>> 0 >= ((HEAP32[($4 + 16 | 0) >> 2] | 0) >>> 1 | 0) >>> 0 & 1 | 0)) {
     break label$3
    }
    HEAP32[($4 + 28 | 0) >> 2] = HEAP32[($4 + 16 | 0) >> 2] | 0;
    break label$2;
   }
   HEAP32[($4 + 8 | 0) >> 2] = (HEAP32[($4 + 12 | 0) >> 2] | 0) << 1 | 0;
   HEAP32[($4 + 28 | 0) >> 2] = HEAP32[(unsigned_20long_20const__20std____2__max_unsigned_20long__28unsigned_20long_20const__2c_20unsigned_20long_20const__29($4 + 8 | 0 | 0, $4 + 20 | 0 | 0) | 0) >> 2] | 0;
  }
  $36 = HEAP32[($4 + 28 | 0) >> 2] | 0;
  __stack_pointer = $4 + 32 | 0;
  return $36 | 0;
 }
 
 function std____2____split_buffer_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20_______split_buffer_28unsigned_20long_2c_20unsigned_20long_2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20___29($0, $1, $2, $3) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  $3 = $3 | 0;
  var $6 = 0, $7 = 0, $19 = 0, $26 = 0, $31 = 0, $33 = 0;
  $6 = __stack_pointer - 32 | 0;
  __stack_pointer = $6;
  HEAP32[($6 + 24 | 0) >> 2] = $0;
  HEAP32[($6 + 20 | 0) >> 2] = $1;
  HEAP32[($6 + 16 | 0) >> 2] = $2;
  HEAP32[($6 + 12 | 0) >> 2] = $3;
  $7 = HEAP32[($6 + 24 | 0) >> 2] | 0;
  HEAP32[($6 + 28 | 0) >> 2] = $7;
  HEAP32[($6 + 8 | 0) >> 2] = 0;
  std____2____compressed_pair_std____2__shared_ptr_OpenFileDescriptor___2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20_______compressed_pair_std__nullptr_t_2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20____28std__nullptr_t___2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20___29($7 + 12 | 0 | 0, $6 + 8 | 0 | 0, HEAP32[($6 + 12 | 0) >> 2] | 0 | 0) | 0;
  label$1 : {
   label$2 : {
    if (!(HEAP32[($6 + 20 | 0) >> 2] | 0)) {
     break label$2
    }
    $19 = std____2__allocator_traits_std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20___allocate_28std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20___2c_20unsigned_20long_29(std____2____split_buffer_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20_______alloc_28_29($7 | 0) | 0 | 0, HEAP32[($6 + 20 | 0) >> 2] | 0 | 0) | 0;
    break label$1;
   }
   $19 = 0;
  }
  HEAP32[$7 >> 2] = $19;
  $26 = (HEAP32[$7 >> 2] | 0) + ((HEAP32[($6 + 16 | 0) >> 2] | 0) << 3 | 0) | 0;
  HEAP32[($7 + 8 | 0) >> 2] = $26;
  HEAP32[($7 + 4 | 0) >> 2] = $26;
  $31 = (HEAP32[$7 >> 2] | 0) + ((HEAP32[($6 + 20 | 0) >> 2] | 0) << 3 | 0) | 0;
  HEAP32[(std____2____split_buffer_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20_______end_cap_28_29($7 | 0) | 0) >> 2] = $31;
  $33 = HEAP32[($6 + 28 | 0) >> 2] | 0;
  __stack_pointer = $6 + 32 | 0;
  return $33 | 0;
 }
 
 function std____2__vector_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20_____swap_out_circular_buffer_28std____2____split_buffer_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20_____29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0, $5 = 0;
  $4 = __stack_pointer - 16 | 0;
  __stack_pointer = $4;
  HEAP32[($4 + 12 | 0) >> 2] = $0;
  HEAP32[($4 + 8 | 0) >> 2] = $1;
  $5 = HEAP32[($4 + 12 | 0) >> 2] | 0;
  std____2__vector_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20_____annotate_delete_28_29_20const($5 | 0);
  void_20std____2____construct_backward_with_exception_guarantees_std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__2c_20std____2__shared_ptr_OpenFileDescriptor____28std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20___2c_20std____2__shared_ptr_OpenFileDescriptor___2c_20std____2__shared_ptr_OpenFileDescriptor___2c_20std____2__shared_ptr_OpenFileDescriptor____29(std____2____vector_base_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20_____alloc_28_29($5 | 0) | 0 | 0, HEAP32[$5 >> 2] | 0 | 0, HEAP32[($5 + 4 | 0) >> 2] | 0 | 0, (HEAP32[($4 + 8 | 0) >> 2] | 0) + 4 | 0 | 0);
  std____2__enable_if__28is_move_constructible_std____2__shared_ptr_OpenFileDescriptor_____value_29_20___20_28is_move_assignable_std____2__shared_ptr_OpenFileDescriptor_____value_29_2c_20void___type_20std____2__swap_std____2__shared_ptr_OpenFileDescriptor____28std____2__shared_ptr_OpenFileDescriptor____2c_20std____2__shared_ptr_OpenFileDescriptor____29($5 | 0, (HEAP32[($4 + 8 | 0) >> 2] | 0) + 4 | 0 | 0);
  std____2__enable_if__28is_move_constructible_std____2__shared_ptr_OpenFileDescriptor_____value_29_20___20_28is_move_assignable_std____2__shared_ptr_OpenFileDescriptor_____value_29_2c_20void___type_20std____2__swap_std____2__shared_ptr_OpenFileDescriptor____28std____2__shared_ptr_OpenFileDescriptor____2c_20std____2__shared_ptr_OpenFileDescriptor____29($5 + 4 | 0 | 0, (HEAP32[($4 + 8 | 0) >> 2] | 0) + 8 | 0 | 0);
  std____2__enable_if__28is_move_constructible_std____2__shared_ptr_OpenFileDescriptor_____value_29_20___20_28is_move_assignable_std____2__shared_ptr_OpenFileDescriptor_____value_29_2c_20void___type_20std____2__swap_std____2__shared_ptr_OpenFileDescriptor____28std____2__shared_ptr_OpenFileDescriptor____2c_20std____2__shared_ptr_OpenFileDescriptor____29(std____2____vector_base_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20_____end_cap_28_29($5 | 0) | 0 | 0, std____2____split_buffer_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20_______end_cap_28_29(HEAP32[($4 + 8 | 0) >> 2] | 0 | 0) | 0 | 0);
  HEAP32[(HEAP32[($4 + 8 | 0) >> 2] | 0) >> 2] = HEAP32[((HEAP32[($4 + 8 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0;
  std____2__vector_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20_____annotate_new_28unsigned_20long_29_20const($5 | 0, std____2__vector_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20___size_28_29_20const($5 | 0) | 0 | 0);
  std____2__vector_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20_____invalidate_all_iterators_28_29($5 | 0);
  __stack_pointer = $4 + 16 | 0;
  return;
 }
 
 function std____2____split_buffer_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20________split_buffer_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $4 = 0, $15 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 8 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 8 | 0) >> 2] | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $4;
  std____2____split_buffer_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20_____clear_28_29($4 | 0);
  label$1 : {
   if (!((HEAP32[$4 >> 2] | 0 | 0) != (0 | 0) & 1 | 0)) {
    break label$1
   }
   std____2__allocator_traits_std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20___deallocate_28std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20___2c_20std____2__shared_ptr_OpenFileDescriptor___2c_20unsigned_20long_29(std____2____split_buffer_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20_______alloc_28_29($4 | 0) | 0 | 0, HEAP32[$4 >> 2] | 0 | 0, std____2____split_buffer_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20_____capacity_28_29_20const($4 | 0) | 0 | 0);
  }
  $15 = HEAP32[($3 + 12 | 0) >> 2] | 0;
  __stack_pointer = $3 + 16 | 0;
  return $15 | 0;
 }
 
 function std____2____compressed_pair_elem_std____2__shared_ptr_OpenFileDescriptor___2c_200_2c_20false_____get_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  return HEAP32[($3 + 12 | 0) >> 2] | 0 | 0;
 }
 
 function std____2__vector_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20___max_size_28_29_20const($0) {
  $0 = $0 | 0;
  var $3 = 0, $15 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  HEAP32[($3 + 8 | 0) >> 2] = unsigned_20long_20std____2__allocator_traits_std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20___max_size_std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__2c_20void__28std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20const__29(std____2____vector_base_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20_____alloc_28_29_20const(HEAP32[($3 + 12 | 0) >> 2] | 0 | 0) | 0 | 0) | 0;
  HEAP32[($3 + 4 | 0) >> 2] = std____2__numeric_limits_long___max_28_29() | 0;
  $15 = HEAP32[(unsigned_20long_20const__20std____2__min_unsigned_20long__28unsigned_20long_20const__2c_20unsigned_20long_20const__29($3 + 8 | 0 | 0, $3 + 4 | 0 | 0) | 0) >> 2] | 0;
  __stack_pointer = $3 + 16 | 0;
  return $15 | 0;
 }
 
 function std____2____compressed_pair_std____2__shared_ptr_OpenFileDescriptor___2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20_______compressed_pair_std__nullptr_t_2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20____28std__nullptr_t___2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20___29($0, $1, $2) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  var $5 = 0, $6 = 0;
  $5 = __stack_pointer - 16 | 0;
  __stack_pointer = $5;
  HEAP32[($5 + 12 | 0) >> 2] = $0;
  HEAP32[($5 + 8 | 0) >> 2] = $1;
  HEAP32[($5 + 4 | 0) >> 2] = $2;
  $6 = HEAP32[($5 + 12 | 0) >> 2] | 0;
  std____2____compressed_pair_elem_std____2__shared_ptr_OpenFileDescriptor___2c_200_2c_20false_____compressed_pair_elem_std__nullptr_t_2c_20void__28std__nullptr_t___29($6 | 0, std__nullptr_t___20std____2__forward_std__nullptr_t__28std____2__remove_reference_std__nullptr_t___type__29(HEAP32[($5 + 8 | 0) >> 2] | 0 | 0) | 0 | 0) | 0;
  std____2____compressed_pair_elem_std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20___2c_201_2c_20false_____compressed_pair_elem_std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20___2c_20void__28std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20___29($6 + 4 | 0 | 0, std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20___20std____2__forward_std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20____28std____2__remove_reference_std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20_____type__29(HEAP32[($5 + 4 | 0) >> 2] | 0 | 0) | 0 | 0) | 0;
  __stack_pointer = $5 + 16 | 0;
  return $6 | 0;
 }
 
 function std____2____split_buffer_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20_______alloc_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $7 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $7 = std____2____compressed_pair_std____2__shared_ptr_OpenFileDescriptor___2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20_____second_28_29((HEAP32[($3 + 12 | 0) >> 2] | 0) + 12 | 0 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $7 | 0;
 }
 
 function std____2__allocator_traits_std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20___allocate_28std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20___2c_20unsigned_20long_29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0, $7 = 0;
  $4 = __stack_pointer - 16 | 0;
  __stack_pointer = $4;
  HEAP32[($4 + 12 | 0) >> 2] = $0;
  HEAP32[($4 + 8 | 0) >> 2] = $1;
  $7 = std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20___allocate_28unsigned_20long_29(HEAP32[($4 + 12 | 0) >> 2] | 0 | 0, HEAP32[($4 + 8 | 0) >> 2] | 0 | 0) | 0;
  __stack_pointer = $4 + 16 | 0;
  return $7 | 0;
 }
 
 function std____2____split_buffer_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20_______end_cap_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $7 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $7 = std____2____compressed_pair_std____2__shared_ptr_OpenFileDescriptor___2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20_____first_28_29((HEAP32[($3 + 12 | 0) >> 2] | 0) + 12 | 0 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $7 | 0;
 }
 
 function void_20std____2____construct_backward_with_exception_guarantees_std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__2c_20std____2__shared_ptr_OpenFileDescriptor____28std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20___2c_20std____2__shared_ptr_OpenFileDescriptor___2c_20std____2__shared_ptr_OpenFileDescriptor___2c_20std____2__shared_ptr_OpenFileDescriptor____29($0, $1, $2, $3) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  $3 = $3 | 0;
  var $6 = 0, $22 = 0, $24 = 0, $14 = 0, $19 = 0;
  $6 = __stack_pointer - 16 | 0;
  __stack_pointer = $6;
  HEAP32[($6 + 12 | 0) >> 2] = $0;
  HEAP32[($6 + 8 | 0) >> 2] = $1;
  HEAP32[($6 + 4 | 0) >> 2] = $2;
  HEAP32[$6 >> 2] = $3;
  label$1 : {
   label$2 : while (1) {
    if (!((HEAP32[($6 + 4 | 0) >> 2] | 0 | 0) != (HEAP32[($6 + 8 | 0) >> 2] | 0 | 0) & 1 | 0)) {
     break label$1
    }
    $14 = HEAP32[($6 + 12 | 0) >> 2] | 0;
    $19 = std____2__shared_ptr_OpenFileDescriptor___20std____2____to_address_std____2__shared_ptr_OpenFileDescriptor__20__28std____2__shared_ptr_OpenFileDescriptor___29((HEAP32[(HEAP32[$6 >> 2] | 0) >> 2] | 0) + -8 | 0 | 0) | 0;
    $22 = (HEAP32[($6 + 4 | 0) >> 2] | 0) + -8 | 0;
    HEAP32[($6 + 4 | 0) >> 2] = $22;
    void_20std____2__allocator_traits_std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20___construct_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__shared_ptr_OpenFileDescriptor__2c_20void__28std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20___2c_20std____2__shared_ptr_OpenFileDescriptor___2c_20std____2__shared_ptr_OpenFileDescriptor____29($14 | 0, $19 | 0, std____2__conditional__28__28is_nothrow_move_constructible_std____2__shared_ptr_OpenFileDescriptor__20___value_29_29_20___20_28is_copy_constructible_std____2__shared_ptr_OpenFileDescriptor__20___value_29_2c_20std____2__shared_ptr_OpenFileDescriptor__20const__2c_20std____2__shared_ptr_OpenFileDescriptor______type_20std____2__move_if_noexcept_std____2__shared_ptr_OpenFileDescriptor__20__28std____2__shared_ptr_OpenFileDescriptor___29($22 | 0) | 0 | 0);
    $24 = HEAP32[$6 >> 2] | 0;
    HEAP32[$24 >> 2] = (HEAP32[$24 >> 2] | 0) + -8 | 0;
    continue label$2;
   };
  }
  __stack_pointer = $6 + 16 | 0;
  return;
 }
 
 function std____2__enable_if__28is_move_constructible_std____2__shared_ptr_OpenFileDescriptor_____value_29_20___20_28is_move_assignable_std____2__shared_ptr_OpenFileDescriptor_____value_29_2c_20void___type_20std____2__swap_std____2__shared_ptr_OpenFileDescriptor____28std____2__shared_ptr_OpenFileDescriptor____2c_20std____2__shared_ptr_OpenFileDescriptor____29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0, $10 = 0, $16 = 0;
  $4 = __stack_pointer - 16 | 0;
  __stack_pointer = $4;
  HEAP32[($4 + 12 | 0) >> 2] = $0;
  HEAP32[($4 + 8 | 0) >> 2] = $1;
  HEAP32[($4 + 4 | 0) >> 2] = HEAP32[(std____2__remove_reference_std____2__shared_ptr_OpenFileDescriptor______type___20std____2__move_std____2__shared_ptr_OpenFileDescriptor_____28std____2__shared_ptr_OpenFileDescriptor____29(HEAP32[($4 + 12 | 0) >> 2] | 0 | 0) | 0) >> 2] | 0;
  $10 = HEAP32[(std____2__remove_reference_std____2__shared_ptr_OpenFileDescriptor______type___20std____2__move_std____2__shared_ptr_OpenFileDescriptor_____28std____2__shared_ptr_OpenFileDescriptor____29(HEAP32[($4 + 8 | 0) >> 2] | 0 | 0) | 0) >> 2] | 0;
  HEAP32[(HEAP32[($4 + 12 | 0) >> 2] | 0) >> 2] = $10;
  $16 = HEAP32[(std____2__remove_reference_std____2__shared_ptr_OpenFileDescriptor______type___20std____2__move_std____2__shared_ptr_OpenFileDescriptor_____28std____2__shared_ptr_OpenFileDescriptor____29($4 + 4 | 0 | 0) | 0) >> 2] | 0;
  HEAP32[(HEAP32[($4 + 8 | 0) >> 2] | 0) >> 2] = $16;
  __stack_pointer = $4 + 16 | 0;
  return;
 }
 
 function std____2__vector_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20_____annotate_new_28unsigned_20long_29_20const($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $5 = 0, $4 = 0;
  $4 = __stack_pointer - 16 | 0;
  __stack_pointer = $4;
  HEAP32[($4 + 12 | 0) >> 2] = $0;
  HEAP32[($4 + 8 | 0) >> 2] = $1;
  $5 = HEAP32[($4 + 12 | 0) >> 2] | 0;
  std____2__vector_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20_____annotate_contiguous_container_28void_20const__2c_20void_20const__2c_20void_20const__2c_20void_20const__29_20const($5 | 0, std____2__vector_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20___data_28_29_20const($5 | 0) | 0 | 0, (std____2__vector_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20___data_28_29_20const($5 | 0) | 0) + ((std____2__vector_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20___capacity_28_29_20const($5 | 0) | 0) << 3 | 0) | 0 | 0, (std____2__vector_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20___data_28_29_20const($5 | 0) | 0) + ((std____2__vector_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20___capacity_28_29_20const($5 | 0) | 0) << 3 | 0) | 0 | 0, (std____2__vector_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20___data_28_29_20const($5 | 0) | 0) + ((HEAP32[($4 + 8 | 0) >> 2] | 0) << 3 | 0) | 0 | 0);
  __stack_pointer = $4 + 16 | 0;
  return;
 }
 
 function std____2__vector_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20_____invalidate_all_iterators_28_29($0) {
  $0 = $0 | 0;
  HEAP32[((__stack_pointer - 16 | 0) + 12 | 0) >> 2] = $0;
  return;
 }
 
 function std____2____split_buffer_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20_____clear_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $4 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 12 | 0) >> 2] | 0;
  std____2____split_buffer_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20_______destruct_at_end_28std____2__shared_ptr_OpenFileDescriptor___29($4 | 0, HEAP32[($4 + 4 | 0) >> 2] | 0 | 0);
  __stack_pointer = $3 + 16 | 0;
  return;
 }
 
 function std____2____split_buffer_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20_____capacity_28_29_20const($0) {
  $0 = $0 | 0;
  var $3 = 0, $4 = 0, $10 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 12 | 0) >> 2] | 0;
  $10 = ((HEAP32[(std____2____split_buffer_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20_______end_cap_28_29_20const($4 | 0) | 0) >> 2] | 0) - (HEAP32[$4 >> 2] | 0) | 0) >> 3 | 0;
  __stack_pointer = $3 + 16 | 0;
  return $10 | 0;
 }
 
 function std____2____vector_base_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20_____alloc_28_29_20const($0) {
  $0 = $0 | 0;
  var $3 = 0, $7 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $7 = std____2____compressed_pair_std____2__shared_ptr_OpenFileDescriptor___2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20___second_28_29_20const((HEAP32[($3 + 12 | 0) >> 2] | 0) + 8 | 0 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $7 | 0;
 }
 
 function unsigned_20long_20std____2__allocator_traits_std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20___max_size_std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__2c_20void__28std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20const__29($0) {
  $0 = $0 | 0;
  var $3 = 0, $5 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $5 = std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20___max_size_28_29_20const(HEAP32[($3 + 12 | 0) >> 2] | 0 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $5 | 0;
 }
 
 function std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20___max_size_28_29_20const($0) {
  $0 = $0 | 0;
  HEAP32[((__stack_pointer - 16 | 0) + 12 | 0) >> 2] = $0;
  return 536870911 | 0;
 }
 
 function std____2____compressed_pair_std____2__shared_ptr_OpenFileDescriptor___2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20___second_28_29_20const($0) {
  $0 = $0 | 0;
  var $3 = 0, $5 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $5 = std____2____compressed_pair_elem_std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__2c_201_2c_20true_____get_28_29_20const(HEAP32[($3 + 12 | 0) >> 2] | 0 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $5 | 0;
 }
 
 function std____2____compressed_pair_elem_std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__2c_201_2c_20true_____get_28_29_20const($0) {
  $0 = $0 | 0;
  var $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  return HEAP32[($3 + 12 | 0) >> 2] | 0 | 0;
 }
 
 function std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20___20std____2__forward_std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20____28std____2__remove_reference_std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20_____type__29($0) {
  $0 = $0 | 0;
  var $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  return HEAP32[($3 + 12 | 0) >> 2] | 0 | 0;
 }
 
 function std____2____compressed_pair_elem_std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20___2c_201_2c_20false_____compressed_pair_elem_std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20___2c_20void__28std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20___29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0, $5 = 0;
  $4 = __stack_pointer - 16 | 0;
  __stack_pointer = $4;
  HEAP32[($4 + 12 | 0) >> 2] = $0;
  HEAP32[($4 + 8 | 0) >> 2] = $1;
  $5 = HEAP32[($4 + 12 | 0) >> 2] | 0;
  HEAP32[$5 >> 2] = std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20___20std____2__forward_std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20____28std____2__remove_reference_std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20_____type__29(HEAP32[($4 + 8 | 0) >> 2] | 0 | 0) | 0;
  __stack_pointer = $4 + 16 | 0;
  return $5 | 0;
 }
 
 function std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20___allocate_28unsigned_20long_29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0, $18 = 0;
  $4 = __stack_pointer - 16 | 0;
  __stack_pointer = $4;
  HEAP32[($4 + 12 | 0) >> 2] = $0;
  HEAP32[($4 + 8 | 0) >> 2] = $1;
  label$1 : {
   if (!((HEAP32[($4 + 8 | 0) >> 2] | 0) >>> 0 > (unsigned_20long_20std____2__allocator_traits_std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20___max_size_std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__2c_20void__28std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20const__29(HEAP32[($4 + 12 | 0) >> 2] | 0 | 0) | 0) >>> 0 & 1 | 0)) {
    break label$1
   }
   std____2____throw_length_error_28char_20const__29(1154 | 0);
   abort();
  }
  $18 = std____2____libcpp_allocate_28unsigned_20long_2c_20unsigned_20long_29((HEAP32[($4 + 8 | 0) >> 2] | 0) << 3 | 0 | 0, 4 | 0) | 0;
  __stack_pointer = $4 + 16 | 0;
  return $18 | 0;
 }
 
 function std____2____compressed_pair_std____2__shared_ptr_OpenFileDescriptor___2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20_____second_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $7 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $7 = std____2____compressed_pair_elem_std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20___2c_201_2c_20false_____get_28_29((HEAP32[($3 + 12 | 0) >> 2] | 0) + 4 | 0 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $7 | 0;
 }
 
 function std____2____compressed_pair_std____2__shared_ptr_OpenFileDescriptor___2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20_____first_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $5 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $5 = std____2____compressed_pair_elem_std____2__shared_ptr_OpenFileDescriptor___2c_200_2c_20false_____get_28_29(HEAP32[($3 + 12 | 0) >> 2] | 0 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $5 | 0;
 }
 
 function std____2____compressed_pair_elem_std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20___2c_201_2c_20false_____get_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  return HEAP32[(HEAP32[($3 + 12 | 0) >> 2] | 0) >> 2] | 0 | 0;
 }
 
 function std____2__conditional__28__28is_nothrow_move_constructible_std____2__shared_ptr_OpenFileDescriptor__20___value_29_29_20___20_28is_copy_constructible_std____2__shared_ptr_OpenFileDescriptor__20___value_29_2c_20std____2__shared_ptr_OpenFileDescriptor__20const__2c_20std____2__shared_ptr_OpenFileDescriptor______type_20std____2__move_if_noexcept_std____2__shared_ptr_OpenFileDescriptor__20__28std____2__shared_ptr_OpenFileDescriptor___29($0) {
  $0 = $0 | 0;
  var $3 = 0, $5 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $5 = std____2__remove_reference_std____2__shared_ptr_OpenFileDescriptor_____type___20std____2__move_std____2__shared_ptr_OpenFileDescriptor____28std____2__shared_ptr_OpenFileDescriptor___29(HEAP32[($3 + 12 | 0) >> 2] | 0 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $5 | 0;
 }
 
 function void_20std____2__allocator_traits_std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20___construct_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__shared_ptr_OpenFileDescriptor__2c_20void__28std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20___2c_20std____2__shared_ptr_OpenFileDescriptor___2c_20std____2__shared_ptr_OpenFileDescriptor____29($0, $1, $2) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  var $5 = 0;
  $5 = __stack_pointer - 16 | 0;
  __stack_pointer = $5;
  HEAP32[($5 + 12 | 0) >> 2] = $0;
  HEAP32[($5 + 8 | 0) >> 2] = $1;
  HEAP32[($5 + 4 | 0) >> 2] = $2;
  void_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20___construct_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__shared_ptr_OpenFileDescriptor__20__28std____2__shared_ptr_OpenFileDescriptor___2c_20std____2__shared_ptr_OpenFileDescriptor____29(HEAP32[($5 + 12 | 0) >> 2] | 0 | 0, HEAP32[($5 + 8 | 0) >> 2] | 0 | 0, std____2__shared_ptr_OpenFileDescriptor____20std____2__forward_std____2__shared_ptr_OpenFileDescriptor__20__28std____2__remove_reference_std____2__shared_ptr_OpenFileDescriptor__20___type__29(HEAP32[($5 + 4 | 0) >> 2] | 0 | 0) | 0 | 0);
  __stack_pointer = $5 + 16 | 0;
  return;
 }
 
 function std____2__remove_reference_std____2__shared_ptr_OpenFileDescriptor______type___20std____2__move_std____2__shared_ptr_OpenFileDescriptor_____28std____2__shared_ptr_OpenFileDescriptor____29($0) {
  $0 = $0 | 0;
  var $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  return HEAP32[($3 + 12 | 0) >> 2] | 0 | 0;
 }
 
 function std____2__shared_ptr_OpenFileDescriptor____20std____2__forward_std____2__shared_ptr_OpenFileDescriptor__20__28std____2__remove_reference_std____2__shared_ptr_OpenFileDescriptor__20___type__29($0) {
  $0 = $0 | 0;
  var $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  return HEAP32[($3 + 12 | 0) >> 2] | 0 | 0;
 }
 
 function void_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20___construct_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__shared_ptr_OpenFileDescriptor__20__28std____2__shared_ptr_OpenFileDescriptor___2c_20std____2__shared_ptr_OpenFileDescriptor____29($0, $1, $2) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  var $5 = 0;
  $5 = __stack_pointer - 16 | 0;
  __stack_pointer = $5;
  HEAP32[($5 + 12 | 0) >> 2] = $0;
  HEAP32[($5 + 8 | 0) >> 2] = $1;
  HEAP32[($5 + 4 | 0) >> 2] = $2;
  std____2__shared_ptr_OpenFileDescriptor___shared_ptr_28std____2__shared_ptr_OpenFileDescriptor____29(HEAP32[($5 + 8 | 0) >> 2] | 0 | 0, std____2__shared_ptr_OpenFileDescriptor____20std____2__forward_std____2__shared_ptr_OpenFileDescriptor__20__28std____2__remove_reference_std____2__shared_ptr_OpenFileDescriptor__20___type__29(HEAP32[($5 + 4 | 0) >> 2] | 0 | 0) | 0 | 0) | 0;
  __stack_pointer = $5 + 16 | 0;
  return;
 }
 
 function std____2____split_buffer_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20_______destruct_at_end_28std____2__shared_ptr_OpenFileDescriptor___29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0;
  $4 = __stack_pointer - 16 | 0;
  __stack_pointer = $4;
  HEAP32[($4 + 12 | 0) >> 2] = $0;
  HEAP32[($4 + 8 | 0) >> 2] = $1;
  std____2____split_buffer_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20_______destruct_at_end_28std____2__shared_ptr_OpenFileDescriptor___2c_20std____2__integral_constant_bool_2c_20false__29(HEAP32[($4 + 12 | 0) >> 2] | 0 | 0, HEAP32[($4 + 8 | 0) >> 2] | 0 | 0);
  __stack_pointer = $4 + 16 | 0;
  return;
 }
 
 function std____2____split_buffer_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20_______end_cap_28_29_20const($0) {
  $0 = $0 | 0;
  var $3 = 0, $7 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $7 = std____2____compressed_pair_std____2__shared_ptr_OpenFileDescriptor___2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20_____first_28_29_20const((HEAP32[($3 + 12 | 0) >> 2] | 0) + 12 | 0 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $7 | 0;
 }
 
 function std____2____split_buffer_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20_______destruct_at_end_28std____2__shared_ptr_OpenFileDescriptor___2c_20std____2__integral_constant_bool_2c_20false__29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0, $5 = 0, $16 = 0, $13 = 0;
  $4 = __stack_pointer - 16 | 0;
  __stack_pointer = $4;
  HEAP32[($4 + 4 | 0) >> 2] = $0;
  HEAP32[$4 >> 2] = $1;
  $5 = HEAP32[($4 + 4 | 0) >> 2] | 0;
  label$1 : {
   label$2 : while (1) {
    if (!((HEAP32[$4 >> 2] | 0 | 0) != (HEAP32[($5 + 8 | 0) >> 2] | 0 | 0) & 1 | 0)) {
     break label$1
    }
    $13 = std____2____split_buffer_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20_______alloc_28_29($5 | 0) | 0;
    $16 = (HEAP32[($5 + 8 | 0) >> 2] | 0) + -8 | 0;
    HEAP32[($5 + 8 | 0) >> 2] = $16;
    void_20std____2__allocator_traits_std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20___destroy_std____2__shared_ptr_OpenFileDescriptor__2c_20void__28std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20___2c_20std____2__shared_ptr_OpenFileDescriptor___29($13 | 0, std____2__shared_ptr_OpenFileDescriptor___20std____2____to_address_std____2__shared_ptr_OpenFileDescriptor__20__28std____2__shared_ptr_OpenFileDescriptor___29($16 | 0) | 0 | 0);
    continue label$2;
   };
  }
  __stack_pointer = $4 + 16 | 0;
  return;
 }
 
 function std____2____compressed_pair_std____2__shared_ptr_OpenFileDescriptor___2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20_____first_28_29_20const($0) {
  $0 = $0 | 0;
  var $3 = 0, $5 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $5 = std____2____compressed_pair_elem_std____2__shared_ptr_OpenFileDescriptor___2c_200_2c_20false_____get_28_29_20const(HEAP32[($3 + 12 | 0) >> 2] | 0 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $5 | 0;
 }
 
 function std____2__shared_ptr_StdinFile__20std____2__make_shared_StdinFile_2c_20void__28_29($0) {
  $0 = $0 | 0;
  var $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  std____2__allocator_StdinFile___allocator_28_29($3 + 8 | 0 | 0) | 0;
  std____2__shared_ptr_StdinFile__20std____2__allocate_shared_StdinFile_2c_20std____2__allocator_StdinFile__2c_20void__28std____2__allocator_StdinFile__20const__29($0 | 0, $3 + 8 | 0 | 0);
  __stack_pointer = $3 + 16 | 0;
  return;
 }
 
 function std____2__shared_ptr_OpenFileDescriptor__20std____2__make_shared_OpenFileDescriptor_2c_20int_2c_20std____2__shared_ptr_StdinFile__2c_20void__28int___2c_20std____2__shared_ptr_StdinFile____29($0, $1, $2) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  var $5 = 0;
  $5 = __stack_pointer - 16 | 0;
  __stack_pointer = $5;
  HEAP32[($5 + 12 | 0) >> 2] = $1;
  HEAP32[($5 + 8 | 0) >> 2] = $2;
  std____2__allocator_OpenFileDescriptor___allocator_28_29($5 | 0) | 0;
  std____2__shared_ptr_OpenFileDescriptor__20std____2__allocate_shared_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__2c_20int_2c_20std____2__shared_ptr_StdinFile__2c_20void__28std____2__allocator_OpenFileDescriptor__20const__2c_20int___2c_20std____2__shared_ptr_StdinFile____29($0 | 0, $5 | 0, int___20std____2__forward_int__28std____2__remove_reference_int___type__29(HEAP32[($5 + 12 | 0) >> 2] | 0 | 0) | 0 | 0, std____2__shared_ptr_StdinFile____20std____2__forward_std____2__shared_ptr_StdinFile__20__28std____2__remove_reference_std____2__shared_ptr_StdinFile__20___type__29(HEAP32[($5 + 8 | 0) >> 2] | 0 | 0) | 0 | 0);
  __stack_pointer = $5 + 16 | 0;
  return;
 }
 
 function std____2__vector_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20___push_back_28std____2__shared_ptr_OpenFileDescriptor____29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0, $5 = 0;
  $4 = __stack_pointer - 16 | 0;
  __stack_pointer = $4;
  HEAP32[($4 + 12 | 0) >> 2] = $0;
  HEAP32[($4 + 8 | 0) >> 2] = $1;
  $5 = HEAP32[($4 + 12 | 0) >> 2] | 0;
  label$1 : {
   label$2 : {
    if (!((HEAP32[($5 + 4 | 0) >> 2] | 0) >>> 0 < (HEAP32[(std____2____vector_base_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20_____end_cap_28_29($5 | 0) | 0) >> 2] | 0) >>> 0 & 1 | 0)) {
     break label$2
    }
    void_20std____2__vector_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20_____construct_one_at_end_std____2__shared_ptr_OpenFileDescriptor__20__28std____2__shared_ptr_OpenFileDescriptor____29($5 | 0, std____2__remove_reference_std____2__shared_ptr_OpenFileDescriptor_____type___20std____2__move_std____2__shared_ptr_OpenFileDescriptor____28std____2__shared_ptr_OpenFileDescriptor___29(HEAP32[($4 + 8 | 0) >> 2] | 0 | 0) | 0 | 0);
    break label$1;
   }
   void_20std____2__vector_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20_____push_back_slow_path_std____2__shared_ptr_OpenFileDescriptor__20__28std____2__shared_ptr_OpenFileDescriptor____29($5 | 0, std____2__remove_reference_std____2__shared_ptr_OpenFileDescriptor_____type___20std____2__move_std____2__shared_ptr_OpenFileDescriptor____28std____2__shared_ptr_OpenFileDescriptor___29(HEAP32[($4 + 8 | 0) >> 2] | 0 | 0) | 0 | 0);
  }
  __stack_pointer = $4 + 16 | 0;
  return;
 }
 
 function std____2__shared_ptr_StdinFile____shared_ptr_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $4 = 0, $13 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 8 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 8 | 0) >> 2] | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $4;
  label$1 : {
   if (!((HEAP32[($4 + 4 | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0)) {
    break label$1
   }
   std____2____shared_weak_count____release_shared_28_29(HEAP32[($4 + 4 | 0) >> 2] | 0 | 0);
  }
  $13 = HEAP32[($3 + 12 | 0) >> 2] | 0;
  __stack_pointer = $3 + 16 | 0;
  return $13 | 0;
 }
 
 function std____2__shared_ptr_StdoutFile__20std____2__make_shared_StdoutFile_2c_20void__28_29($0) {
  $0 = $0 | 0;
  var $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  std____2__allocator_StdoutFile___allocator_28_29($3 + 8 | 0 | 0) | 0;
  std____2__shared_ptr_StdoutFile__20std____2__allocate_shared_StdoutFile_2c_20std____2__allocator_StdoutFile__2c_20void__28std____2__allocator_StdoutFile__20const__29($0 | 0, $3 + 8 | 0 | 0);
  __stack_pointer = $3 + 16 | 0;
  return;
 }
 
 function std____2__shared_ptr_OpenFileDescriptor__20std____2__make_shared_OpenFileDescriptor_2c_20int_2c_20std____2__shared_ptr_StdoutFile__2c_20void__28int___2c_20std____2__shared_ptr_StdoutFile____29($0, $1, $2) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  var $5 = 0;
  $5 = __stack_pointer - 16 | 0;
  __stack_pointer = $5;
  HEAP32[($5 + 12 | 0) >> 2] = $1;
  HEAP32[($5 + 8 | 0) >> 2] = $2;
  std____2__allocator_OpenFileDescriptor___allocator_28_29($5 | 0) | 0;
  std____2__shared_ptr_OpenFileDescriptor__20std____2__allocate_shared_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__2c_20int_2c_20std____2__shared_ptr_StdoutFile__2c_20void__28std____2__allocator_OpenFileDescriptor__20const__2c_20int___2c_20std____2__shared_ptr_StdoutFile____29($0 | 0, $5 | 0, int___20std____2__forward_int__28std____2__remove_reference_int___type__29(HEAP32[($5 + 12 | 0) >> 2] | 0 | 0) | 0 | 0, std____2__shared_ptr_StdoutFile____20std____2__forward_std____2__shared_ptr_StdoutFile__20__28std____2__remove_reference_std____2__shared_ptr_StdoutFile__20___type__29(HEAP32[($5 + 8 | 0) >> 2] | 0 | 0) | 0 | 0);
  __stack_pointer = $5 + 16 | 0;
  return;
 }
 
 function std____2__shared_ptr_StdoutFile____shared_ptr_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $4 = 0, $13 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 8 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 8 | 0) >> 2] | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $4;
  label$1 : {
   if (!((HEAP32[($4 + 4 | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0)) {
    break label$1
   }
   std____2____shared_weak_count____release_shared_28_29(HEAP32[($4 + 4 | 0) >> 2] | 0 | 0);
  }
  $13 = HEAP32[($3 + 12 | 0) >> 2] | 0;
  __stack_pointer = $3 + 16 | 0;
  return $13 | 0;
 }
 
 function std____2__shared_ptr_StderrFile__20std____2__make_shared_StderrFile_2c_20void__28_29($0) {
  $0 = $0 | 0;
  var $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  std____2__allocator_StderrFile___allocator_28_29($3 + 8 | 0 | 0) | 0;
  std____2__shared_ptr_StderrFile__20std____2__allocate_shared_StderrFile_2c_20std____2__allocator_StderrFile__2c_20void__28std____2__allocator_StderrFile__20const__29($0 | 0, $3 + 8 | 0 | 0);
  __stack_pointer = $3 + 16 | 0;
  return;
 }
 
 function std____2__shared_ptr_OpenFileDescriptor__20std____2__make_shared_OpenFileDescriptor_2c_20int_2c_20std____2__shared_ptr_StderrFile__2c_20void__28int___2c_20std____2__shared_ptr_StderrFile____29($0, $1, $2) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  var $5 = 0;
  $5 = __stack_pointer - 16 | 0;
  __stack_pointer = $5;
  HEAP32[($5 + 12 | 0) >> 2] = $1;
  HEAP32[($5 + 8 | 0) >> 2] = $2;
  std____2__allocator_OpenFileDescriptor___allocator_28_29($5 | 0) | 0;
  std____2__shared_ptr_OpenFileDescriptor__20std____2__allocate_shared_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__2c_20int_2c_20std____2__shared_ptr_StderrFile__2c_20void__28std____2__allocator_OpenFileDescriptor__20const__2c_20int___2c_20std____2__shared_ptr_StderrFile____29($0 | 0, $5 | 0, int___20std____2__forward_int__28std____2__remove_reference_int___type__29(HEAP32[($5 + 12 | 0) >> 2] | 0 | 0) | 0 | 0, std____2__shared_ptr_StderrFile____20std____2__forward_std____2__shared_ptr_StderrFile__20__28std____2__remove_reference_std____2__shared_ptr_StderrFile__20___type__29(HEAP32[($5 + 8 | 0) >> 2] | 0 | 0) | 0 | 0);
  __stack_pointer = $5 + 16 | 0;
  return;
 }
 
 function std____2__shared_ptr_StderrFile____shared_ptr_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $4 = 0, $13 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 8 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 8 | 0) >> 2] | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $4;
  label$1 : {
   if (!((HEAP32[($4 + 4 | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0)) {
    break label$1
   }
   std____2____shared_weak_count____release_shared_28_29(HEAP32[($4 + 4 | 0) >> 2] | 0 | 0);
  }
  $13 = HEAP32[($3 + 12 | 0) >> 2] | 0;
  __stack_pointer = $3 + 16 | 0;
  return $13 | 0;
 }
 
 function void_20std____2__vector_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20_____construct_one_at_end_std____2__shared_ptr_OpenFileDescriptor__20__28std____2__shared_ptr_OpenFileDescriptor____29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0, $5 = 0;
  $4 = __stack_pointer - 32 | 0;
  __stack_pointer = $4;
  HEAP32[($4 + 28 | 0) >> 2] = $0;
  HEAP32[($4 + 24 | 0) >> 2] = $1;
  $5 = HEAP32[($4 + 28 | 0) >> 2] | 0;
  std____2__vector_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20____ConstructTransaction___ConstructTransaction_28std____2__vector_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20___2c_20unsigned_20long_29($4 + 8 | 0 | 0, $5 | 0, 1 | 0) | 0;
  void_20std____2__allocator_traits_std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20___construct_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__shared_ptr_OpenFileDescriptor__2c_20void__28std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20___2c_20std____2__shared_ptr_OpenFileDescriptor___2c_20std____2__shared_ptr_OpenFileDescriptor____29(std____2____vector_base_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20_____alloc_28_29($5 | 0) | 0 | 0, std____2__shared_ptr_OpenFileDescriptor___20std____2____to_address_std____2__shared_ptr_OpenFileDescriptor__20__28std____2__shared_ptr_OpenFileDescriptor___29(HEAP32[($4 + 12 | 0) >> 2] | 0 | 0) | 0 | 0, std____2__shared_ptr_OpenFileDescriptor____20std____2__forward_std____2__shared_ptr_OpenFileDescriptor__20__28std____2__remove_reference_std____2__shared_ptr_OpenFileDescriptor__20___type__29(HEAP32[($4 + 24 | 0) >> 2] | 0 | 0) | 0 | 0);
  HEAP32[($4 + 12 | 0) >> 2] = (HEAP32[($4 + 12 | 0) >> 2] | 0) + 8 | 0;
  std____2__vector_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20____ConstructTransaction____ConstructTransaction_28_29($4 + 8 | 0 | 0) | 0;
  __stack_pointer = $4 + 32 | 0;
  return;
 }
 
 function void_20std____2__vector_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20_____push_back_slow_path_std____2__shared_ptr_OpenFileDescriptor__20__28std____2__shared_ptr_OpenFileDescriptor____29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0, $5 = 0;
  $4 = __stack_pointer - 32 | 0;
  __stack_pointer = $4;
  HEAP32[($4 + 28 | 0) >> 2] = $0;
  HEAP32[($4 + 24 | 0) >> 2] = $1;
  $5 = HEAP32[($4 + 28 | 0) >> 2] | 0;
  HEAP32[($4 + 20 | 0) >> 2] = std____2____vector_base_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20_____alloc_28_29($5 | 0) | 0;
  std____2____split_buffer_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20_______split_buffer_28unsigned_20long_2c_20unsigned_20long_2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20___29($4 | 0, std____2__vector_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20_____recommend_28unsigned_20long_29_20const($5 | 0, (std____2__vector_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20___size_28_29_20const($5 | 0) | 0) + 1 | 0 | 0) | 0 | 0, std____2__vector_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20___size_28_29_20const($5 | 0) | 0 | 0, HEAP32[($4 + 20 | 0) >> 2] | 0 | 0) | 0;
  void_20std____2__allocator_traits_std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20___construct_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__shared_ptr_OpenFileDescriptor__2c_20void__28std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20___2c_20std____2__shared_ptr_OpenFileDescriptor___2c_20std____2__shared_ptr_OpenFileDescriptor____29(HEAP32[($4 + 20 | 0) >> 2] | 0 | 0, std____2__shared_ptr_OpenFileDescriptor___20std____2____to_address_std____2__shared_ptr_OpenFileDescriptor__20__28std____2__shared_ptr_OpenFileDescriptor___29(HEAP32[($4 + 8 | 0) >> 2] | 0 | 0) | 0 | 0, std____2__shared_ptr_OpenFileDescriptor____20std____2__forward_std____2__shared_ptr_OpenFileDescriptor__20__28std____2__remove_reference_std____2__shared_ptr_OpenFileDescriptor__20___type__29(HEAP32[($4 + 24 | 0) >> 2] | 0 | 0) | 0 | 0);
  HEAP32[($4 + 8 | 0) >> 2] = (HEAP32[($4 + 8 | 0) >> 2] | 0) + 8 | 0;
  std____2__vector_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20__20_____swap_out_circular_buffer_28std____2____split_buffer_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20_____29($5 | 0, $4 | 0);
  std____2____split_buffer_std____2__shared_ptr_OpenFileDescriptor__2c_20std____2__allocator_std____2__shared_ptr_OpenFileDescriptor__20________split_buffer_28_29($4 | 0) | 0;
  __stack_pointer = $4 + 32 | 0;
  return;
 }
 
 function std____2__allocator_OpenFileDescriptor___allocator_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  return HEAP32[($3 + 12 | 0) >> 2] | 0 | 0;
 }
 
 function int___20std____2__forward_int__28std____2__remove_reference_int___type__29($0) {
  $0 = $0 | 0;
  var $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  return HEAP32[($3 + 12 | 0) >> 2] | 0 | 0;
 }
 
 function std____2__shared_ptr_StdinFile____20std____2__forward_std____2__shared_ptr_StdinFile__20__28std____2__remove_reference_std____2__shared_ptr_StdinFile__20___type__29($0) {
  $0 = $0 | 0;
  var $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  return HEAP32[($3 + 12 | 0) >> 2] | 0 | 0;
 }
 
 function std____2__shared_ptr_OpenFileDescriptor__20std____2__allocate_shared_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__2c_20int_2c_20std____2__shared_ptr_StdinFile__2c_20void__28std____2__allocator_OpenFileDescriptor__20const__2c_20int___2c_20std____2__shared_ptr_StdinFile____29($0, $1, $2, $3) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  $3 = $3 | 0;
  var $6 = 0;
  $6 = __stack_pointer - 48 | 0;
  __stack_pointer = $6;
  HEAP32[($6 + 44 | 0) >> 2] = $1;
  HEAP32[($6 + 40 | 0) >> 2] = $2;
  HEAP32[($6 + 36 | 0) >> 2] = $3;
  std____2____allocation_guard_std____2__allocator_std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20__20__20_____allocation_guard_std____2__allocator_OpenFileDescriptor__20__28std____2__allocator_OpenFileDescriptor__2c_20unsigned_20long_29($6 + 24 | 0 | 0, 1 | 0) | 0;
  std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20_____shared_ptr_emplace_int_2c_20std____2__shared_ptr_StdinFile__20__28std____2__allocator_OpenFileDescriptor__2c_20int___2c_20std____2__shared_ptr_StdinFile____29(std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20___20std____2__addressof_std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20__20__28std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20___29(std____2____allocation_guard_std____2__allocator_std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20__20__20_____get_28_29_20const($6 + 24 | 0 | 0) | 0 | 0) | 0 | 0, int___20std____2__forward_int__28std____2__remove_reference_int___type__29(HEAP32[($6 + 40 | 0) >> 2] | 0 | 0) | 0 | 0, std____2__shared_ptr_StdinFile____20std____2__forward_std____2__shared_ptr_StdinFile__20__28std____2__remove_reference_std____2__shared_ptr_StdinFile__20___type__29(HEAP32[($6 + 36 | 0) >> 2] | 0 | 0) | 0 | 0) | 0;
  HEAP32[($6 + 4 | 0) >> 2] = std____2____allocation_guard_std____2__allocator_std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20__20__20_____release_ptr_28_29($6 + 24 | 0 | 0) | 0;
  std____2__shared_ptr_OpenFileDescriptor__20std____2__shared_ptr_OpenFileDescriptor_____create_with_control_block_OpenFileDescriptor_2c_20std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20__20__28OpenFileDescriptor__2c_20std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20___29($0 | 0, std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20_____get_elem_28_29(HEAP32[($6 + 4 | 0) >> 2] | 0 | 0) | 0 | 0, std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20___20std____2__addressof_std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20__20__28std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20___29(HEAP32[($6 + 4 | 0) >> 2] | 0 | 0) | 0 | 0);
  std____2____allocation_guard_std____2__allocator_std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20__20__20______allocation_guard_28_29($6 + 24 | 0 | 0) | 0;
  __stack_pointer = $6 + 48 | 0;
  return;
 }
 
 function std____2__allocator_StdinFile___allocator_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  return HEAP32[($3 + 12 | 0) >> 2] | 0 | 0;
 }
 
 function std____2__shared_ptr_StdinFile__20std____2__allocate_shared_StdinFile_2c_20std____2__allocator_StdinFile__2c_20void__28std____2__allocator_StdinFile__20const__29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0;
  $4 = __stack_pointer - 48 | 0;
  __stack_pointer = $4;
  HEAP32[($4 + 44 | 0) >> 2] = $1;
  std____2____allocation_guard_std____2__allocator_std____2____shared_ptr_emplace_StdinFile_2c_20std____2__allocator_StdinFile__20__20__20_____allocation_guard_std____2__allocator_StdinFile__20__28std____2__allocator_StdinFile__2c_20unsigned_20long_29($4 + 32 | 0 | 0, 1 | 0) | 0;
  std____2____shared_ptr_emplace_StdinFile_2c_20std____2__allocator_StdinFile__20_____shared_ptr_emplace___28std____2__allocator_StdinFile__29(std____2____shared_ptr_emplace_StdinFile_2c_20std____2__allocator_StdinFile__20___20std____2__addressof_std____2____shared_ptr_emplace_StdinFile_2c_20std____2__allocator_StdinFile__20__20__28std____2____shared_ptr_emplace_StdinFile_2c_20std____2__allocator_StdinFile__20___29(std____2____allocation_guard_std____2__allocator_std____2____shared_ptr_emplace_StdinFile_2c_20std____2__allocator_StdinFile__20__20__20_____get_28_29_20const($4 + 32 | 0 | 0) | 0 | 0) | 0 | 0) | 0;
  HEAP32[($4 + 12 | 0) >> 2] = std____2____allocation_guard_std____2__allocator_std____2____shared_ptr_emplace_StdinFile_2c_20std____2__allocator_StdinFile__20__20__20_____release_ptr_28_29($4 + 32 | 0 | 0) | 0;
  std____2__shared_ptr_StdinFile__20std____2__shared_ptr_StdinFile_____create_with_control_block_StdinFile_2c_20std____2____shared_ptr_emplace_StdinFile_2c_20std____2__allocator_StdinFile__20__20__28StdinFile__2c_20std____2____shared_ptr_emplace_StdinFile_2c_20std____2__allocator_StdinFile__20___29($0 | 0, std____2____shared_ptr_emplace_StdinFile_2c_20std____2__allocator_StdinFile__20_____get_elem_28_29(HEAP32[($4 + 12 | 0) >> 2] | 0 | 0) | 0 | 0, std____2____shared_ptr_emplace_StdinFile_2c_20std____2__allocator_StdinFile__20___20std____2__addressof_std____2____shared_ptr_emplace_StdinFile_2c_20std____2__allocator_StdinFile__20__20__28std____2____shared_ptr_emplace_StdinFile_2c_20std____2__allocator_StdinFile__20___29(HEAP32[($4 + 12 | 0) >> 2] | 0 | 0) | 0 | 0);
  std____2____allocation_guard_std____2__allocator_std____2____shared_ptr_emplace_StdinFile_2c_20std____2__allocator_StdinFile__20__20__20______allocation_guard_28_29($4 + 32 | 0 | 0) | 0;
  __stack_pointer = $4 + 48 | 0;
  return;
 }
 
 function std____2__shared_ptr_StdoutFile____20std____2__forward_std____2__shared_ptr_StdoutFile__20__28std____2__remove_reference_std____2__shared_ptr_StdoutFile__20___type__29($0) {
  $0 = $0 | 0;
  var $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  return HEAP32[($3 + 12 | 0) >> 2] | 0 | 0;
 }
 
 function std____2__shared_ptr_OpenFileDescriptor__20std____2__allocate_shared_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__2c_20int_2c_20std____2__shared_ptr_StdoutFile__2c_20void__28std____2__allocator_OpenFileDescriptor__20const__2c_20int___2c_20std____2__shared_ptr_StdoutFile____29($0, $1, $2, $3) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  $3 = $3 | 0;
  var $6 = 0;
  $6 = __stack_pointer - 48 | 0;
  __stack_pointer = $6;
  HEAP32[($6 + 44 | 0) >> 2] = $1;
  HEAP32[($6 + 40 | 0) >> 2] = $2;
  HEAP32[($6 + 36 | 0) >> 2] = $3;
  std____2____allocation_guard_std____2__allocator_std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20__20__20_____allocation_guard_std____2__allocator_OpenFileDescriptor__20__28std____2__allocator_OpenFileDescriptor__2c_20unsigned_20long_29($6 + 24 | 0 | 0, 1 | 0) | 0;
  std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20_____shared_ptr_emplace_int_2c_20std____2__shared_ptr_StdoutFile__20__28std____2__allocator_OpenFileDescriptor__2c_20int___2c_20std____2__shared_ptr_StdoutFile____29(std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20___20std____2__addressof_std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20__20__28std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20___29(std____2____allocation_guard_std____2__allocator_std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20__20__20_____get_28_29_20const($6 + 24 | 0 | 0) | 0 | 0) | 0 | 0, int___20std____2__forward_int__28std____2__remove_reference_int___type__29(HEAP32[($6 + 40 | 0) >> 2] | 0 | 0) | 0 | 0, std____2__shared_ptr_StdoutFile____20std____2__forward_std____2__shared_ptr_StdoutFile__20__28std____2__remove_reference_std____2__shared_ptr_StdoutFile__20___type__29(HEAP32[($6 + 36 | 0) >> 2] | 0 | 0) | 0 | 0) | 0;
  HEAP32[($6 + 4 | 0) >> 2] = std____2____allocation_guard_std____2__allocator_std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20__20__20_____release_ptr_28_29($6 + 24 | 0 | 0) | 0;
  std____2__shared_ptr_OpenFileDescriptor__20std____2__shared_ptr_OpenFileDescriptor_____create_with_control_block_OpenFileDescriptor_2c_20std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20__20__28OpenFileDescriptor__2c_20std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20___29($0 | 0, std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20_____get_elem_28_29(HEAP32[($6 + 4 | 0) >> 2] | 0 | 0) | 0 | 0, std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20___20std____2__addressof_std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20__20__28std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20___29(HEAP32[($6 + 4 | 0) >> 2] | 0 | 0) | 0 | 0);
  std____2____allocation_guard_std____2__allocator_std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20__20__20______allocation_guard_28_29($6 + 24 | 0 | 0) | 0;
  __stack_pointer = $6 + 48 | 0;
  return;
 }
 
 function std____2__allocator_StdoutFile___allocator_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  return HEAP32[($3 + 12 | 0) >> 2] | 0 | 0;
 }
 
 function std____2__shared_ptr_StdoutFile__20std____2__allocate_shared_StdoutFile_2c_20std____2__allocator_StdoutFile__2c_20void__28std____2__allocator_StdoutFile__20const__29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0;
  $4 = __stack_pointer - 48 | 0;
  __stack_pointer = $4;
  HEAP32[($4 + 44 | 0) >> 2] = $1;
  std____2____allocation_guard_std____2__allocator_std____2____shared_ptr_emplace_StdoutFile_2c_20std____2__allocator_StdoutFile__20__20__20_____allocation_guard_std____2__allocator_StdoutFile__20__28std____2__allocator_StdoutFile__2c_20unsigned_20long_29($4 + 32 | 0 | 0, 1 | 0) | 0;
  std____2____shared_ptr_emplace_StdoutFile_2c_20std____2__allocator_StdoutFile__20_____shared_ptr_emplace___28std____2__allocator_StdoutFile__29(std____2____shared_ptr_emplace_StdoutFile_2c_20std____2__allocator_StdoutFile__20___20std____2__addressof_std____2____shared_ptr_emplace_StdoutFile_2c_20std____2__allocator_StdoutFile__20__20__28std____2____shared_ptr_emplace_StdoutFile_2c_20std____2__allocator_StdoutFile__20___29(std____2____allocation_guard_std____2__allocator_std____2____shared_ptr_emplace_StdoutFile_2c_20std____2__allocator_StdoutFile__20__20__20_____get_28_29_20const($4 + 32 | 0 | 0) | 0 | 0) | 0 | 0) | 0;
  HEAP32[($4 + 12 | 0) >> 2] = std____2____allocation_guard_std____2__allocator_std____2____shared_ptr_emplace_StdoutFile_2c_20std____2__allocator_StdoutFile__20__20__20_____release_ptr_28_29($4 + 32 | 0 | 0) | 0;
  std____2__shared_ptr_StdoutFile__20std____2__shared_ptr_StdoutFile_____create_with_control_block_StdoutFile_2c_20std____2____shared_ptr_emplace_StdoutFile_2c_20std____2__allocator_StdoutFile__20__20__28StdoutFile__2c_20std____2____shared_ptr_emplace_StdoutFile_2c_20std____2__allocator_StdoutFile__20___29($0 | 0, std____2____shared_ptr_emplace_StdoutFile_2c_20std____2__allocator_StdoutFile__20_____get_elem_28_29(HEAP32[($4 + 12 | 0) >> 2] | 0 | 0) | 0 | 0, std____2____shared_ptr_emplace_StdoutFile_2c_20std____2__allocator_StdoutFile__20___20std____2__addressof_std____2____shared_ptr_emplace_StdoutFile_2c_20std____2__allocator_StdoutFile__20__20__28std____2____shared_ptr_emplace_StdoutFile_2c_20std____2__allocator_StdoutFile__20___29(HEAP32[($4 + 12 | 0) >> 2] | 0 | 0) | 0 | 0);
  std____2____allocation_guard_std____2__allocator_std____2____shared_ptr_emplace_StdoutFile_2c_20std____2__allocator_StdoutFile__20__20__20______allocation_guard_28_29($4 + 32 | 0 | 0) | 0;
  __stack_pointer = $4 + 48 | 0;
  return;
 }
 
 function std____2__shared_ptr_StderrFile____20std____2__forward_std____2__shared_ptr_StderrFile__20__28std____2__remove_reference_std____2__shared_ptr_StderrFile__20___type__29($0) {
  $0 = $0 | 0;
  var $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  return HEAP32[($3 + 12 | 0) >> 2] | 0 | 0;
 }
 
 function std____2__shared_ptr_OpenFileDescriptor__20std____2__allocate_shared_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__2c_20int_2c_20std____2__shared_ptr_StderrFile__2c_20void__28std____2__allocator_OpenFileDescriptor__20const__2c_20int___2c_20std____2__shared_ptr_StderrFile____29($0, $1, $2, $3) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  $3 = $3 | 0;
  var $6 = 0;
  $6 = __stack_pointer - 48 | 0;
  __stack_pointer = $6;
  HEAP32[($6 + 44 | 0) >> 2] = $1;
  HEAP32[($6 + 40 | 0) >> 2] = $2;
  HEAP32[($6 + 36 | 0) >> 2] = $3;
  std____2____allocation_guard_std____2__allocator_std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20__20__20_____allocation_guard_std____2__allocator_OpenFileDescriptor__20__28std____2__allocator_OpenFileDescriptor__2c_20unsigned_20long_29($6 + 24 | 0 | 0, 1 | 0) | 0;
  std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20_____shared_ptr_emplace_int_2c_20std____2__shared_ptr_StderrFile__20__28std____2__allocator_OpenFileDescriptor__2c_20int___2c_20std____2__shared_ptr_StderrFile____29(std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20___20std____2__addressof_std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20__20__28std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20___29(std____2____allocation_guard_std____2__allocator_std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20__20__20_____get_28_29_20const($6 + 24 | 0 | 0) | 0 | 0) | 0 | 0, int___20std____2__forward_int__28std____2__remove_reference_int___type__29(HEAP32[($6 + 40 | 0) >> 2] | 0 | 0) | 0 | 0, std____2__shared_ptr_StderrFile____20std____2__forward_std____2__shared_ptr_StderrFile__20__28std____2__remove_reference_std____2__shared_ptr_StderrFile__20___type__29(HEAP32[($6 + 36 | 0) >> 2] | 0 | 0) | 0 | 0) | 0;
  HEAP32[($6 + 4 | 0) >> 2] = std____2____allocation_guard_std____2__allocator_std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20__20__20_____release_ptr_28_29($6 + 24 | 0 | 0) | 0;
  std____2__shared_ptr_OpenFileDescriptor__20std____2__shared_ptr_OpenFileDescriptor_____create_with_control_block_OpenFileDescriptor_2c_20std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20__20__28OpenFileDescriptor__2c_20std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20___29($0 | 0, std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20_____get_elem_28_29(HEAP32[($6 + 4 | 0) >> 2] | 0 | 0) | 0 | 0, std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20___20std____2__addressof_std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20__20__28std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20___29(HEAP32[($6 + 4 | 0) >> 2] | 0 | 0) | 0 | 0);
  std____2____allocation_guard_std____2__allocator_std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20__20__20______allocation_guard_28_29($6 + 24 | 0 | 0) | 0;
  __stack_pointer = $6 + 48 | 0;
  return;
 }
 
 function std____2__allocator_StderrFile___allocator_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  return HEAP32[($3 + 12 | 0) >> 2] | 0 | 0;
 }
 
 function std____2__shared_ptr_StderrFile__20std____2__allocate_shared_StderrFile_2c_20std____2__allocator_StderrFile__2c_20void__28std____2__allocator_StderrFile__20const__29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0;
  $4 = __stack_pointer - 48 | 0;
  __stack_pointer = $4;
  HEAP32[($4 + 44 | 0) >> 2] = $1;
  std____2____allocation_guard_std____2__allocator_std____2____shared_ptr_emplace_StderrFile_2c_20std____2__allocator_StderrFile__20__20__20_____allocation_guard_std____2__allocator_StderrFile__20__28std____2__allocator_StderrFile__2c_20unsigned_20long_29($4 + 32 | 0 | 0, 1 | 0) | 0;
  std____2____shared_ptr_emplace_StderrFile_2c_20std____2__allocator_StderrFile__20_____shared_ptr_emplace___28std____2__allocator_StderrFile__29(std____2____shared_ptr_emplace_StderrFile_2c_20std____2__allocator_StderrFile__20___20std____2__addressof_std____2____shared_ptr_emplace_StderrFile_2c_20std____2__allocator_StderrFile__20__20__28std____2____shared_ptr_emplace_StderrFile_2c_20std____2__allocator_StderrFile__20___29(std____2____allocation_guard_std____2__allocator_std____2____shared_ptr_emplace_StderrFile_2c_20std____2__allocator_StderrFile__20__20__20_____get_28_29_20const($4 + 32 | 0 | 0) | 0 | 0) | 0 | 0) | 0;
  HEAP32[($4 + 12 | 0) >> 2] = std____2____allocation_guard_std____2__allocator_std____2____shared_ptr_emplace_StderrFile_2c_20std____2__allocator_StderrFile__20__20__20_____release_ptr_28_29($4 + 32 | 0 | 0) | 0;
  std____2__shared_ptr_StderrFile__20std____2__shared_ptr_StderrFile_____create_with_control_block_StderrFile_2c_20std____2____shared_ptr_emplace_StderrFile_2c_20std____2__allocator_StderrFile__20__20__28StderrFile__2c_20std____2____shared_ptr_emplace_StderrFile_2c_20std____2__allocator_StderrFile__20___29($0 | 0, std____2____shared_ptr_emplace_StderrFile_2c_20std____2__allocator_StderrFile__20_____get_elem_28_29(HEAP32[($4 + 12 | 0) >> 2] | 0 | 0) | 0 | 0, std____2____shared_ptr_emplace_StderrFile_2c_20std____2__allocator_StderrFile__20___20std____2__addressof_std____2____shared_ptr_emplace_StderrFile_2c_20std____2__allocator_StderrFile__20__20__28std____2____shared_ptr_emplace_StderrFile_2c_20std____2__allocator_StderrFile__20___29(HEAP32[($4 + 12 | 0) >> 2] | 0 | 0) | 0 | 0);
  std____2____allocation_guard_std____2__allocator_std____2____shared_ptr_emplace_StderrFile_2c_20std____2__allocator_StderrFile__20__20__20______allocation_guard_28_29($4 + 32 | 0 | 0) | 0;
  __stack_pointer = $4 + 48 | 0;
  return;
 }
 
 function std____2____allocation_guard_std____2__allocator_std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20__20__20_____allocation_guard_std____2__allocator_OpenFileDescriptor__20__28std____2__allocator_OpenFileDescriptor__2c_20unsigned_20long_29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0, $5 = 0;
  $4 = __stack_pointer - 16 | 0;
  __stack_pointer = $4;
  HEAP32[($4 + 4 | 0) >> 2] = $0;
  HEAP32[$4 >> 2] = $1;
  $5 = HEAP32[($4 + 4 | 0) >> 2] | 0;
  std____2__allocator_std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20__20___allocator_OpenFileDescriptor__28std____2__allocator_OpenFileDescriptor__20const__29($5 | 0, std____2__remove_reference_std____2__allocator_OpenFileDescriptor_____type___20std____2__move_std____2__allocator_OpenFileDescriptor____28std____2__allocator_OpenFileDescriptor___29($4 + 8 | 0 | 0) | 0 | 0) | 0;
  HEAP32[($5 + 4 | 0) >> 2] = HEAP32[$4 >> 2] | 0;
  HEAP32[($5 + 8 | 0) >> 2] = std____2__allocator_traits_std____2__allocator_std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20__20__20___allocate_28std____2__allocator_std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20__20___2c_20unsigned_20long_29($5 | 0, HEAP32[($5 + 4 | 0) >> 2] | 0 | 0) | 0;
  __stack_pointer = $4 + 16 | 0;
  return $5 | 0;
 }
 
 function std____2____allocation_guard_std____2__allocator_std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20__20__20_____get_28_29_20const($0) {
  $0 = $0 | 0;
  var $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  return HEAP32[((HEAP32[($3 + 12 | 0) >> 2] | 0) + 8 | 0) >> 2] | 0 | 0;
 }
 
 function std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20___20std____2__addressof_std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20__20__28std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20___29($0) {
  $0 = $0 | 0;
  var $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  return HEAP32[($3 + 12 | 0) >> 2] | 0 | 0;
 }
 
 function std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20_____shared_ptr_emplace_int_2c_20std____2__shared_ptr_StdinFile__20__28std____2__allocator_OpenFileDescriptor__2c_20int___2c_20std____2__shared_ptr_StdinFile____29($0, $1, $2) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  var $5 = 0, $6 = 0, $18 = 0, $21 = 0, $23 = 0, i64toi32_i32$1 = 0;
  $5 = __stack_pointer - 48 | 0;
  __stack_pointer = $5;
  HEAP32[($5 + 36 | 0) >> 2] = $0;
  HEAP32[($5 + 32 | 0) >> 2] = $1;
  HEAP32[($5 + 28 | 0) >> 2] = $2;
  $6 = HEAP32[($5 + 36 | 0) >> 2] | 0;
  std____2____shared_weak_count____shared_weak_count_28long_29($6 | 0, 0 | 0) | 0;
  HEAP32[$6 >> 2] = 1656 + 8 | 0;
  std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20____Storage___Storage_28std____2__allocator_OpenFileDescriptor____29($6 + 16 | 0 | 0, std____2__remove_reference_std____2__allocator_OpenFileDescriptor_____type___20std____2__move_std____2__allocator_OpenFileDescriptor____28std____2__allocator_OpenFileDescriptor___29($5 + 40 | 0 | 0) | 0 | 0) | 0;
  $18 = std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20_____get_elem_28_29($6 | 0) | 0;
  $21 = HEAP32[(int___20std____2__forward_int__28std____2__remove_reference_int___type__29(HEAP32[($5 + 32 | 0) >> 2] | 0 | 0) | 0) >> 2] | 0;
  $23 = std____2__shared_ptr_StdinFile____20std____2__forward_std____2__shared_ptr_StdinFile__20__28std____2__remove_reference_std____2__shared_ptr_StdinFile__20___type__29(HEAP32[($5 + 28 | 0) >> 2] | 0 | 0) | 0;
  HEAP32[($5 + 8 | 0) >> 2] = 0;
  std____2__shared_ptr_File___shared_ptr_StdinFile__28std____2__shared_ptr_StdinFile____2c_20std____2__enable_if___compatible_with_StdinFile_2c_20File___value_2c_20std____2__shared_ptr_File_____nat___type_29($5 + 16 | 0 | 0, $23 | 0, HEAP32[($5 + 8 | 0) >> 2] | 0 | 0) | 0;
  i64toi32_i32$1 = HEAP32[($5 + 20 | 0) >> 2] | 0;
  HEAP32[$5 >> 2] = HEAP32[($5 + 16 | 0) >> 2] | 0;
  HEAP32[($5 + 4 | 0) >> 2] = i64toi32_i32$1;
  OpenFileDescriptor__OpenFileDescriptor_28unsigned_20int_2c_20std____2__shared_ptr_File__29($18 | 0, $21 | 0, $5 | 0) | 0;
  __stack_pointer = $5 + 48 | 0;
  return $6 | 0;
 }
 
 function std____2____allocation_guard_std____2__allocator_std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20__20__20_____release_ptr_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $4 = 0;
  $3 = __stack_pointer - 16 | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 12 | 0) >> 2] | 0;
  HEAP32[($3 + 8 | 0) >> 2] = HEAP32[($4 + 8 | 0) >> 2] | 0;
  HEAP32[($4 + 8 | 0) >> 2] = 0;
  return HEAP32[($3 + 8 | 0) >> 2] | 0 | 0;
 }
 
 function std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20_____get_elem_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $7 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $7 = std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20____Storage____get_elem_28_29((HEAP32[($3 + 12 | 0) >> 2] | 0) + 16 | 0 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $7 | 0;
 }
 
 function std____2__shared_ptr_OpenFileDescriptor__20std____2__shared_ptr_OpenFileDescriptor_____create_with_control_block_OpenFileDescriptor_2c_20std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20__20__28OpenFileDescriptor__2c_20std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20___29($0, $1, $2) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  var $5 = 0, $11 = 0;
  $5 = __stack_pointer - 32 | 0;
  __stack_pointer = $5;
  HEAP32[($5 + 28 | 0) >> 2] = $1;
  HEAP32[($5 + 24 | 0) >> 2] = $2;
  HEAP8[($5 + 23 | 0) >> 0] = 0 & 1 | 0;
  std____2__shared_ptr_OpenFileDescriptor___shared_ptr_28_29($0 | 0) | 0;
  HEAP32[$0 >> 2] = HEAP32[($5 + 28 | 0) >> 2] | 0;
  HEAP32[($0 + 4 | 0) >> 2] = HEAP32[($5 + 24 | 0) >> 2] | 0;
  $11 = HEAP32[$0 >> 2] | 0;
  HEAP32[($5 + 4 | 0) >> 2] = HEAP32[$0 >> 2] | 0;
  HEAP32[$5 >> 2] = $11;
  std____2__shared_ptr_OpenFileDescriptor_____enable_weak_this_28____29($0 | 0, $5 | 0);
  HEAP8[($5 + 23 | 0) >> 0] = 1 & 1 | 0;
  label$1 : {
   if ((HEAPU8[($5 + 23 | 0) >> 0] | 0) & 1 | 0) {
    break label$1
   }
   std____2__shared_ptr_OpenFileDescriptor____shared_ptr_28_29($0 | 0) | 0;
  }
  __stack_pointer = $5 + 32 | 0;
  return;
 }
 
 function std____2____allocation_guard_std____2__allocator_std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20__20__20______allocation_guard_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $4 = 0, $14 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 8 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 8 | 0) >> 2] | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $4;
  label$1 : {
   if (!((HEAP32[($4 + 8 | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0)) {
    break label$1
   }
   std____2__allocator_traits_std____2__allocator_std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20__20__20___deallocate_28std____2__allocator_std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20__20___2c_20std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20___2c_20unsigned_20long_29($4 | 0, HEAP32[($4 + 8 | 0) >> 2] | 0 | 0, HEAP32[($4 + 4 | 0) >> 2] | 0 | 0);
  }
  $14 = HEAP32[($3 + 12 | 0) >> 2] | 0;
  __stack_pointer = $3 + 16 | 0;
  return $14 | 0;
 }
 
 function std____2__remove_reference_std____2__allocator_OpenFileDescriptor_____type___20std____2__move_std____2__allocator_OpenFileDescriptor____28std____2__allocator_OpenFileDescriptor___29($0) {
  $0 = $0 | 0;
  var $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  return HEAP32[($3 + 12 | 0) >> 2] | 0 | 0;
 }
 
 function std____2__allocator_std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20__20___allocator_OpenFileDescriptor__28std____2__allocator_OpenFileDescriptor__20const__29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0;
  $4 = __stack_pointer - 16 | 0;
  HEAP32[($4 + 12 | 0) >> 2] = $0;
  HEAP32[($4 + 8 | 0) >> 2] = $1;
  return HEAP32[($4 + 12 | 0) >> 2] | 0 | 0;
 }
 
 function std____2__allocator_traits_std____2__allocator_std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20__20__20___allocate_28std____2__allocator_std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20__20___2c_20unsigned_20long_29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0, $7 = 0;
  $4 = __stack_pointer - 16 | 0;
  __stack_pointer = $4;
  HEAP32[($4 + 12 | 0) >> 2] = $0;
  HEAP32[($4 + 8 | 0) >> 2] = $1;
  $7 = std____2__allocator_std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20__20___allocate_28unsigned_20long_29(HEAP32[($4 + 12 | 0) >> 2] | 0 | 0, HEAP32[($4 + 8 | 0) >> 2] | 0 | 0) | 0;
  __stack_pointer = $4 + 16 | 0;
  return $7 | 0;
 }
 
 function std____2____shared_weak_count____shared_weak_count_28long_29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0, $5 = 0;
  $4 = __stack_pointer - 16 | 0;
  __stack_pointer = $4;
  HEAP32[($4 + 12 | 0) >> 2] = $0;
  HEAP32[($4 + 8 | 0) >> 2] = $1;
  $5 = HEAP32[($4 + 12 | 0) >> 2] | 0;
  std____2____shared_count____shared_count_28long_29($5 | 0, HEAP32[($4 + 8 | 0) >> 2] | 0 | 0) | 0;
  HEAP32[$5 >> 2] = 2136 + 8 | 0;
  HEAP32[($5 + 8 | 0) >> 2] = HEAP32[($4 + 8 | 0) >> 2] | 0;
  __stack_pointer = $4 + 16 | 0;
  return $5 | 0;
 }
 
 function std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20____Storage___Storage_28std____2__allocator_OpenFileDescriptor____29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0, $5 = 0;
  $4 = __stack_pointer - 16 | 0;
  __stack_pointer = $4;
  HEAP32[($4 + 12 | 0) >> 2] = $0;
  HEAP32[($4 + 8 | 0) >> 2] = $1;
  $5 = HEAP32[($4 + 12 | 0) >> 2] | 0;
  std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20____Storage____get_alloc_28_29($5 | 0) | 0;
  std____2__remove_reference_std____2__allocator_OpenFileDescriptor_____type___20std____2__move_std____2__allocator_OpenFileDescriptor____28std____2__allocator_OpenFileDescriptor___29(HEAP32[($4 + 8 | 0) >> 2] | 0 | 0) | 0;
  __stack_pointer = $4 + 16 | 0;
  return $5 | 0;
 }
 
 function std____2__shared_ptr_File___shared_ptr_StdinFile__28std____2__shared_ptr_StdinFile____2c_20std____2__enable_if___compatible_with_StdinFile_2c_20File___value_2c_20std____2__shared_ptr_File_____nat___type_29($0, $1, $2) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  var $5 = 0, $6 = 0;
  $5 = __stack_pointer - 16 | 0;
  HEAP32[($5 + 8 | 0) >> 2] = $2;
  HEAP32[($5 + 4 | 0) >> 2] = $0;
  HEAP32[$5 >> 2] = $1;
  $6 = HEAP32[($5 + 4 | 0) >> 2] | 0;
  HEAP32[$6 >> 2] = HEAP32[(HEAP32[$5 >> 2] | 0) >> 2] | 0;
  HEAP32[($6 + 4 | 0) >> 2] = HEAP32[((HEAP32[$5 >> 2] | 0) + 4 | 0) >> 2] | 0;
  HEAP32[(HEAP32[$5 >> 2] | 0) >> 2] = 0;
  HEAP32[((HEAP32[$5 >> 2] | 0) + 4 | 0) >> 2] = 0;
  return $6 | 0;
 }
 
 function OpenFileDescriptor__OpenFileDescriptor_28unsigned_20int_2c_20std____2__shared_ptr_File__29($0, $1, $2) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  var $5 = 0, $6 = 0, i64toi32_i32$0 = 0;
  $5 = __stack_pointer - 16 | 0;
  __stack_pointer = $5;
  HEAP32[($5 + 12 | 0) >> 2] = $0;
  HEAP32[($5 + 8 | 0) >> 2] = $1;
  $6 = HEAP32[($5 + 12 | 0) >> 2] | 0;
  std____2__shared_ptr_File___shared_ptr_28std____2__shared_ptr_File__20const__29($6 | 0, $2 | 0) | 0;
  i64toi32_i32$0 = 0;
  HEAP32[($6 + 8 | 0) >> 2] = HEAP32[($5 + 8 | 0) >> 2] | 0;
  HEAP32[($6 + 12 | 0) >> 2] = i64toi32_i32$0;
  std____2__mutex__mutex_28_29($6 + 16 | 0 | 0) | 0;
  std____2__shared_ptr_File____shared_ptr_28_29($2 | 0) | 0;
  __stack_pointer = $5 + 16 | 0;
  return $6 | 0;
 }
 
 function std____2__shared_ptr_OpenFileDescriptor___shared_ptr_28_29($0) {
  $0 = $0 | 0;
  var $4 = 0, $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 12 | 0) >> 2] | 0;
  HEAP32[$4 >> 2] = 0;
  HEAP32[($4 + 4 | 0) >> 2] = 0;
  return $4 | 0;
 }
 
 function std____2__shared_ptr_OpenFileDescriptor_____enable_weak_this_28____29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  HEAP32[((__stack_pointer - 16 | 0) + 12 | 0) >> 2] = $0;
  return;
 }
 
 function std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20____Storage____get_elem_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $8 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  HEAP32[($3 + 8 | 0) >> 2] = HEAP32[($3 + 12 | 0) >> 2] | 0;
  HEAP32[($3 + 4 | 0) >> 2] = std____2____compressed_pair_std____2__allocator_OpenFileDescriptor__2c_20OpenFileDescriptor_____get_second_base_28std____2____compressed_pair_std____2__allocator_OpenFileDescriptor__2c_20OpenFileDescriptor___29(HEAP32[($3 + 8 | 0) >> 2] | 0 | 0) | 0;
  HEAP32[$3 >> 2] = HEAP32[($3 + 4 | 0) >> 2] | 0;
  $8 = HEAP32[$3 >> 2] | 0;
  __stack_pointer = $3 + 16 | 0;
  return $8 | 0;
 }
 
 function std____2__allocator_traits_std____2__allocator_std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20__20__20___deallocate_28std____2__allocator_std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20__20___2c_20std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20___2c_20unsigned_20long_29($0, $1, $2) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  var $5 = 0;
  $5 = __stack_pointer - 16 | 0;
  __stack_pointer = $5;
  HEAP32[($5 + 12 | 0) >> 2] = $0;
  HEAP32[($5 + 8 | 0) >> 2] = $1;
  HEAP32[($5 + 4 | 0) >> 2] = $2;
  std____2__allocator_std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20__20___deallocate_28std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20___2c_20unsigned_20long_29(HEAP32[($5 + 12 | 0) >> 2] | 0 | 0, HEAP32[($5 + 8 | 0) >> 2] | 0 | 0, HEAP32[($5 + 4 | 0) >> 2] | 0 | 0);
  __stack_pointer = $5 + 16 | 0;
  return;
 }
 
 function std____2__allocator_std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20__20___allocate_28unsigned_20long_29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0, $18 = 0;
  $4 = __stack_pointer - 16 | 0;
  __stack_pointer = $4;
  HEAP32[($4 + 12 | 0) >> 2] = $0;
  HEAP32[($4 + 8 | 0) >> 2] = $1;
  label$1 : {
   if (!((HEAP32[($4 + 8 | 0) >> 2] | 0) >>> 0 > (unsigned_20long_20std____2__allocator_traits_std____2__allocator_std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20__20__20___max_size_std____2__allocator_std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20__20__2c_20void__28std____2__allocator_std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20__20__20const__29(HEAP32[($4 + 12 | 0) >> 2] | 0 | 0) | 0) >>> 0 & 1 | 0)) {
    break label$1
   }
   std____2____throw_length_error_28char_20const__29(1154 | 0);
   abort();
  }
  $18 = std____2____libcpp_allocate_28unsigned_20long_2c_20unsigned_20long_29((HEAP32[($4 + 8 | 0) >> 2] | 0) << 6 | 0 | 0, 8 | 0) | 0;
  __stack_pointer = $4 + 16 | 0;
  return $18 | 0;
 }
 
 function unsigned_20long_20std____2__allocator_traits_std____2__allocator_std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20__20__20___max_size_std____2__allocator_std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20__20__2c_20void__28std____2__allocator_std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20__20__20const__29($0) {
  $0 = $0 | 0;
  var $3 = 0, $5 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $5 = std____2__allocator_std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20__20___max_size_28_29_20const(HEAP32[($3 + 12 | 0) >> 2] | 0 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $5 | 0;
 }
 
 function std____2__allocator_std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20__20___max_size_28_29_20const($0) {
  $0 = $0 | 0;
  HEAP32[((__stack_pointer - 16 | 0) + 12 | 0) >> 2] = $0;
  return 67108863 | 0;
 }
 
 function std____2____shared_count____shared_count_28long_29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0, $5 = 0;
  $4 = __stack_pointer - 16 | 0;
  HEAP32[($4 + 12 | 0) >> 2] = $0;
  HEAP32[($4 + 8 | 0) >> 2] = $1;
  $5 = HEAP32[($4 + 12 | 0) >> 2] | 0;
  HEAP32[$5 >> 2] = 2080 + 8 | 0;
  HEAP32[($5 + 4 | 0) >> 2] = HEAP32[($4 + 8 | 0) >> 2] | 0;
  return $5 | 0;
 }
 
 function std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20____Storage____get_alloc_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $8 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  HEAP32[($3 + 8 | 0) >> 2] = HEAP32[($3 + 12 | 0) >> 2] | 0;
  HEAP32[($3 + 4 | 0) >> 2] = std____2____compressed_pair_std____2__allocator_OpenFileDescriptor__2c_20OpenFileDescriptor_____get_first_base_28std____2____compressed_pair_std____2__allocator_OpenFileDescriptor__2c_20OpenFileDescriptor___29(HEAP32[($3 + 8 | 0) >> 2] | 0 | 0) | 0;
  HEAP32[$3 >> 2] = HEAP32[($3 + 4 | 0) >> 2] | 0;
  $8 = HEAP32[$3 >> 2] | 0;
  __stack_pointer = $3 + 16 | 0;
  return $8 | 0;
 }
 
 function std____2__shared_ptr_File___shared_ptr_28std____2__shared_ptr_File__20const__29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0, $5 = 0, $18 = 0;
  $4 = __stack_pointer - 16 | 0;
  __stack_pointer = $4;
  HEAP32[($4 + 8 | 0) >> 2] = $0;
  HEAP32[($4 + 4 | 0) >> 2] = $1;
  $5 = HEAP32[($4 + 8 | 0) >> 2] | 0;
  HEAP32[($4 + 12 | 0) >> 2] = $5;
  HEAP32[$5 >> 2] = HEAP32[(HEAP32[($4 + 4 | 0) >> 2] | 0) >> 2] | 0;
  HEAP32[($5 + 4 | 0) >> 2] = HEAP32[((HEAP32[($4 + 4 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0;
  label$1 : {
   if (!((HEAP32[($5 + 4 | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0)) {
    break label$1
   }
   std____2____shared_weak_count____add_shared_28_29(HEAP32[($5 + 4 | 0) >> 2] | 0 | 0);
  }
  $18 = HEAP32[($4 + 12 | 0) >> 2] | 0;
  __stack_pointer = $4 + 16 | 0;
  return $18 | 0;
 }
 
 function std____2__shared_ptr_File____shared_ptr_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $4 = 0, $13 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 8 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 8 | 0) >> 2] | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $4;
  label$1 : {
   if (!((HEAP32[($4 + 4 | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0)) {
    break label$1
   }
   std____2____shared_weak_count____release_shared_28_29(HEAP32[($4 + 4 | 0) >> 2] | 0 | 0);
  }
  $13 = HEAP32[($3 + 12 | 0) >> 2] | 0;
  __stack_pointer = $3 + 16 | 0;
  return $13 | 0;
 }
 
 function std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20______shared_ptr_emplace_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $4 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 12 | 0) >> 2] | 0;
  HEAP32[$4 >> 2] = 1656 + 8 | 0;
  std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20____Storage____Storage_28_29($4 + 16 | 0 | 0) | 0;
  std____2____shared_count_____shared_count_28_29($4 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $4 | 0;
 }
 
 function std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20____Storage____Storage_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $4 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 12 | 0) >> 2] | 0;
  std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20____Storage____get_alloc_28_29($4 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $4 | 0;
 }
 
 function std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20______shared_ptr_emplace_28_29_1($0) {
  $0 = $0 | 0;
  var $3 = 0, $4 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 12 | 0) >> 2] | 0;
  std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20______shared_ptr_emplace_28_29($4 | 0) | 0;
  operator_20delete_28void__29($4 | 0);
  __stack_pointer = $3 + 16 | 0;
  return;
 }
 
 function std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20_____on_zero_shared_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  OpenFileDescriptor___OpenFileDescriptor_28_29(std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20_____get_elem_28_29(HEAP32[($3 + 12 | 0) >> 2] | 0 | 0) | 0 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return;
 }
 
 function OpenFileDescriptor___OpenFileDescriptor_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $4 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 12 | 0) >> 2] | 0;
  std____2__mutex___mutex_28_29($4 + 16 | 0 | 0) | 0;
  std____2__shared_ptr_File____shared_ptr_28_29($4 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $4 | 0;
 }
 
 function std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20_____on_zero_shared_weak_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $4 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 12 | 0) >> 2] | 0;
  std____2__allocator_std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20__20___allocator_OpenFileDescriptor__28std____2__allocator_OpenFileDescriptor__20const__29($3 + 8 | 0 | 0, std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20_____get_alloc_28_29($4 | 0) | 0 | 0) | 0;
  std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20____Storage____Storage_28_29($4 + 16 | 0 | 0) | 0;
  std____2__allocator_traits_std____2__allocator_std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20__20__20___deallocate_28std____2__allocator_std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20__20___2c_20std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20___2c_20unsigned_20long_29($3 + 8 | 0 | 0, std____2__pointer_traits_std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20_____pointer_to_28std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20___29($4 | 0) | 0 | 0, 1 | 0);
  __stack_pointer = $3 + 16 | 0;
  return;
 }
 
 function std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20_____get_alloc_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $7 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $7 = std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20____Storage____get_alloc_28_29((HEAP32[($3 + 12 | 0) >> 2] | 0) + 16 | 0 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $7 | 0;
 }
 
 function std____2__pointer_traits_std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20_____pointer_to_28std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20___29($0) {
  $0 = $0 | 0;
  var $3 = 0, $5 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $5 = std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20___20std____2__addressof_std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20__20__28std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20___29(HEAP32[($3 + 12 | 0) >> 2] | 0 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $5 | 0;
 }
 
 function std____2____compressed_pair_std____2__allocator_OpenFileDescriptor__2c_20OpenFileDescriptor_____get_first_base_28std____2____compressed_pair_std____2__allocator_OpenFileDescriptor__2c_20OpenFileDescriptor___29($0) {
  $0 = $0 | 0;
  var $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  return HEAP32[($3 + 12 | 0) >> 2] | 0 | 0;
 }
 
 function std____2____shared_count____add_shared_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  long_20std____2____libcpp_atomic_refcount_increment_long__28long__29((HEAP32[($3 + 12 | 0) >> 2] | 0) + 4 | 0 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return;
 }
 
 function long_20std____2____libcpp_atomic_refcount_increment_long__28long__29($0) {
  $0 = $0 | 0;
  var $3 = 0, $4 = 0, $6 = 0, $7 = 0;
  $3 = __stack_pointer - 16 | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 12 | 0) >> 2] | 0;
  HEAP32[($3 + 8 | 0) >> 2] = 1;
  $6 = HEAP32[($3 + 8 | 0) >> 2] | 0;
  $7 = HEAP32[$4 >> 2] | 0;
  HEAP32[$4 >> 2] = $7 + $6 | 0;
  HEAP32[($3 + 4 | 0) >> 2] = $7 + $6 | 0;
  return HEAP32[($3 + 4 | 0) >> 2] | 0 | 0;
 }
 
 function std____2__allocator_std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20__20___deallocate_28std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20___2c_20unsigned_20long_29($0, $1, $2) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  var $5 = 0;
  $5 = __stack_pointer - 16 | 0;
  __stack_pointer = $5;
  HEAP32[($5 + 12 | 0) >> 2] = $0;
  HEAP32[($5 + 8 | 0) >> 2] = $1;
  HEAP32[($5 + 4 | 0) >> 2] = $2;
  std____2____libcpp_deallocate_28void__2c_20unsigned_20long_2c_20unsigned_20long_29(HEAP32[($5 + 8 | 0) >> 2] | 0 | 0, (HEAP32[($5 + 4 | 0) >> 2] | 0) << 6 | 0 | 0, 8 | 0);
  __stack_pointer = $5 + 16 | 0;
  return;
 }
 
 function std____2____compressed_pair_std____2__allocator_OpenFileDescriptor__2c_20OpenFileDescriptor_____get_second_base_28std____2____compressed_pair_std____2__allocator_OpenFileDescriptor__2c_20OpenFileDescriptor___29($0) {
  $0 = $0 | 0;
  var $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  return HEAP32[($3 + 12 | 0) >> 2] | 0 | 0;
 }
 
 function std____2____allocation_guard_std____2__allocator_std____2____shared_ptr_emplace_StdinFile_2c_20std____2__allocator_StdinFile__20__20__20_____allocation_guard_std____2__allocator_StdinFile__20__28std____2__allocator_StdinFile__2c_20unsigned_20long_29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0, $5 = 0;
  $4 = __stack_pointer - 16 | 0;
  __stack_pointer = $4;
  HEAP32[($4 + 4 | 0) >> 2] = $0;
  HEAP32[$4 >> 2] = $1;
  $5 = HEAP32[($4 + 4 | 0) >> 2] | 0;
  std____2__allocator_std____2____shared_ptr_emplace_StdinFile_2c_20std____2__allocator_StdinFile__20__20___allocator_StdinFile__28std____2__allocator_StdinFile__20const__29($5 | 0, std____2__remove_reference_std____2__allocator_StdinFile_____type___20std____2__move_std____2__allocator_StdinFile____28std____2__allocator_StdinFile___29($4 + 8 | 0 | 0) | 0 | 0) | 0;
  HEAP32[($5 + 4 | 0) >> 2] = HEAP32[$4 >> 2] | 0;
  HEAP32[($5 + 8 | 0) >> 2] = std____2__allocator_traits_std____2__allocator_std____2____shared_ptr_emplace_StdinFile_2c_20std____2__allocator_StdinFile__20__20__20___allocate_28std____2__allocator_std____2____shared_ptr_emplace_StdinFile_2c_20std____2__allocator_StdinFile__20__20___2c_20unsigned_20long_29($5 | 0, HEAP32[($5 + 4 | 0) >> 2] | 0 | 0) | 0;
  __stack_pointer = $4 + 16 | 0;
  return $5 | 0;
 }
 
 function std____2____allocation_guard_std____2__allocator_std____2____shared_ptr_emplace_StdinFile_2c_20std____2__allocator_StdinFile__20__20__20_____get_28_29_20const($0) {
  $0 = $0 | 0;
  var $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  return HEAP32[((HEAP32[($3 + 12 | 0) >> 2] | 0) + 8 | 0) >> 2] | 0 | 0;
 }
 
 function std____2____shared_ptr_emplace_StdinFile_2c_20std____2__allocator_StdinFile__20___20std____2__addressof_std____2____shared_ptr_emplace_StdinFile_2c_20std____2__allocator_StdinFile__20__20__28std____2____shared_ptr_emplace_StdinFile_2c_20std____2__allocator_StdinFile__20___29($0) {
  $0 = $0 | 0;
  var $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  return HEAP32[($3 + 12 | 0) >> 2] | 0 | 0;
 }
 
 function std____2____shared_ptr_emplace_StdinFile_2c_20std____2__allocator_StdinFile__20_____shared_ptr_emplace___28std____2__allocator_StdinFile__29($0) {
  $0 = $0 | 0;
  var i64toi32_i32$1 = 0, $3 = 0, $4 = 0, $16 = 0, i64toi32_i32$0 = 0, $17 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 4 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 4 | 0) >> 2] | 0;
  std____2____shared_weak_count____shared_weak_count_28long_29($4 | 0, 0 | 0) | 0;
  HEAP32[$4 >> 2] = 1768 + 8 | 0;
  std____2____shared_ptr_emplace_StdinFile_2c_20std____2__allocator_StdinFile__20____Storage___Storage_28std____2__allocator_StdinFile____29($4 + 12 | 0 | 0, std____2__remove_reference_std____2__allocator_StdinFile_____type___20std____2__move_std____2__allocator_StdinFile____28std____2__allocator_StdinFile___29($3 + 8 | 0 | 0) | 0 | 0) | 0;
  $16 = std____2____shared_ptr_emplace_StdinFile_2c_20std____2__allocator_StdinFile__20_____get_elem_28_29($4 | 0) | 0;
  i64toi32_i32$0 = 0;
  $17 = 0;
  i64toi32_i32$1 = $16;
  HEAP32[i64toi32_i32$1 >> 2] = $17;
  HEAP32[(i64toi32_i32$1 + 4 | 0) >> 2] = i64toi32_i32$0;
  i64toi32_i32$1 = i64toi32_i32$1 + 24 | 0;
  HEAP32[i64toi32_i32$1 >> 2] = $17;
  HEAP32[(i64toi32_i32$1 + 4 | 0) >> 2] = i64toi32_i32$0;
  i64toi32_i32$1 = $16 + 16 | 0;
  HEAP32[i64toi32_i32$1 >> 2] = $17;
  HEAP32[(i64toi32_i32$1 + 4 | 0) >> 2] = i64toi32_i32$0;
  i64toi32_i32$1 = $16 + 8 | 0;
  HEAP32[i64toi32_i32$1 >> 2] = $17;
  HEAP32[(i64toi32_i32$1 + 4 | 0) >> 2] = i64toi32_i32$0;
  StdinFile__StdinFile_28_29($16 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $4 | 0;
 }
 
 function std____2____allocation_guard_std____2__allocator_std____2____shared_ptr_emplace_StdinFile_2c_20std____2__allocator_StdinFile__20__20__20_____release_ptr_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $4 = 0;
  $3 = __stack_pointer - 16 | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 12 | 0) >> 2] | 0;
  HEAP32[($3 + 8 | 0) >> 2] = HEAP32[($4 + 8 | 0) >> 2] | 0;
  HEAP32[($4 + 8 | 0) >> 2] = 0;
  return HEAP32[($3 + 8 | 0) >> 2] | 0 | 0;
 }
 
 function std____2____shared_ptr_emplace_StdinFile_2c_20std____2__allocator_StdinFile__20_____get_elem_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $7 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $7 = std____2____shared_ptr_emplace_StdinFile_2c_20std____2__allocator_StdinFile__20____Storage____get_elem_28_29((HEAP32[($3 + 12 | 0) >> 2] | 0) + 12 | 0 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $7 | 0;
 }
 
 function std____2__shared_ptr_StdinFile__20std____2__shared_ptr_StdinFile_____create_with_control_block_StdinFile_2c_20std____2____shared_ptr_emplace_StdinFile_2c_20std____2__allocator_StdinFile__20__20__28StdinFile__2c_20std____2____shared_ptr_emplace_StdinFile_2c_20std____2__allocator_StdinFile__20___29($0, $1, $2) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  var $5 = 0, $11 = 0;
  $5 = __stack_pointer - 32 | 0;
  __stack_pointer = $5;
  HEAP32[($5 + 28 | 0) >> 2] = $1;
  HEAP32[($5 + 24 | 0) >> 2] = $2;
  HEAP8[($5 + 23 | 0) >> 0] = 0 & 1 | 0;
  std____2__shared_ptr_StdinFile___shared_ptr_28_29($0 | 0) | 0;
  HEAP32[$0 >> 2] = HEAP32[($5 + 28 | 0) >> 2] | 0;
  HEAP32[($0 + 4 | 0) >> 2] = HEAP32[($5 + 24 | 0) >> 2] | 0;
  $11 = HEAP32[$0 >> 2] | 0;
  HEAP32[($5 + 4 | 0) >> 2] = HEAP32[$0 >> 2] | 0;
  HEAP32[$5 >> 2] = $11;
  std____2__shared_ptr_StdinFile_____enable_weak_this_28____29($0 | 0, $5 | 0);
  HEAP8[($5 + 23 | 0) >> 0] = 1 & 1 | 0;
  label$1 : {
   if ((HEAPU8[($5 + 23 | 0) >> 0] | 0) & 1 | 0) {
    break label$1
   }
   std____2__shared_ptr_StdinFile____shared_ptr_28_29($0 | 0) | 0;
  }
  __stack_pointer = $5 + 32 | 0;
  return;
 }
 
 function std____2____allocation_guard_std____2__allocator_std____2____shared_ptr_emplace_StdinFile_2c_20std____2__allocator_StdinFile__20__20__20______allocation_guard_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $4 = 0, $14 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 8 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 8 | 0) >> 2] | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $4;
  label$1 : {
   if (!((HEAP32[($4 + 8 | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0)) {
    break label$1
   }
   std____2__allocator_traits_std____2__allocator_std____2____shared_ptr_emplace_StdinFile_2c_20std____2__allocator_StdinFile__20__20__20___deallocate_28std____2__allocator_std____2____shared_ptr_emplace_StdinFile_2c_20std____2__allocator_StdinFile__20__20___2c_20std____2____shared_ptr_emplace_StdinFile_2c_20std____2__allocator_StdinFile__20___2c_20unsigned_20long_29($4 | 0, HEAP32[($4 + 8 | 0) >> 2] | 0 | 0, HEAP32[($4 + 4 | 0) >> 2] | 0 | 0);
  }
  $14 = HEAP32[($3 + 12 | 0) >> 2] | 0;
  __stack_pointer = $3 + 16 | 0;
  return $14 | 0;
 }
 
 function std____2__remove_reference_std____2__allocator_StdinFile_____type___20std____2__move_std____2__allocator_StdinFile____28std____2__allocator_StdinFile___29($0) {
  $0 = $0 | 0;
  var $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  return HEAP32[($3 + 12 | 0) >> 2] | 0 | 0;
 }
 
 function std____2__allocator_std____2____shared_ptr_emplace_StdinFile_2c_20std____2__allocator_StdinFile__20__20___allocator_StdinFile__28std____2__allocator_StdinFile__20const__29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0;
  $4 = __stack_pointer - 16 | 0;
  HEAP32[($4 + 12 | 0) >> 2] = $0;
  HEAP32[($4 + 8 | 0) >> 2] = $1;
  return HEAP32[($4 + 12 | 0) >> 2] | 0 | 0;
 }
 
 function std____2__allocator_traits_std____2__allocator_std____2____shared_ptr_emplace_StdinFile_2c_20std____2__allocator_StdinFile__20__20__20___allocate_28std____2__allocator_std____2____shared_ptr_emplace_StdinFile_2c_20std____2__allocator_StdinFile__20__20___2c_20unsigned_20long_29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0, $7 = 0;
  $4 = __stack_pointer - 16 | 0;
  __stack_pointer = $4;
  HEAP32[($4 + 12 | 0) >> 2] = $0;
  HEAP32[($4 + 8 | 0) >> 2] = $1;
  $7 = std____2__allocator_std____2____shared_ptr_emplace_StdinFile_2c_20std____2__allocator_StdinFile__20__20___allocate_28unsigned_20long_29(HEAP32[($4 + 12 | 0) >> 2] | 0 | 0, HEAP32[($4 + 8 | 0) >> 2] | 0 | 0) | 0;
  __stack_pointer = $4 + 16 | 0;
  return $7 | 0;
 }
 
 function std____2____shared_ptr_emplace_StdinFile_2c_20std____2__allocator_StdinFile__20____Storage___Storage_28std____2__allocator_StdinFile____29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0, $5 = 0;
  $4 = __stack_pointer - 16 | 0;
  __stack_pointer = $4;
  HEAP32[($4 + 12 | 0) >> 2] = $0;
  HEAP32[($4 + 8 | 0) >> 2] = $1;
  $5 = HEAP32[($4 + 12 | 0) >> 2] | 0;
  std____2____shared_ptr_emplace_StdinFile_2c_20std____2__allocator_StdinFile__20____Storage____get_alloc_28_29($5 | 0) | 0;
  std____2__remove_reference_std____2__allocator_StdinFile_____type___20std____2__move_std____2__allocator_StdinFile____28std____2__allocator_StdinFile___29(HEAP32[($4 + 8 | 0) >> 2] | 0 | 0) | 0;
  __stack_pointer = $4 + 16 | 0;
  return $5 | 0;
 }
 
 function StdinFile__StdinFile_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $4 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 12 | 0) >> 2] | 0;
  File__File_28_29($4 | 0) | 0;
  HEAP32[$4 >> 2] = 1464 + 8 | 0;
  __stack_pointer = $3 + 16 | 0;
  return $4 | 0;
 }
 
 function std____2__shared_ptr_StdinFile___shared_ptr_28_29($0) {
  $0 = $0 | 0;
  var $4 = 0, $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 12 | 0) >> 2] | 0;
  HEAP32[$4 >> 2] = 0;
  HEAP32[($4 + 4 | 0) >> 2] = 0;
  return $4 | 0;
 }
 
 function std____2__shared_ptr_StdinFile_____enable_weak_this_28____29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  HEAP32[((__stack_pointer - 16 | 0) + 12 | 0) >> 2] = $0;
  return;
 }
 
 function std____2____shared_ptr_emplace_StdinFile_2c_20std____2__allocator_StdinFile__20____Storage____get_elem_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $8 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  HEAP32[($3 + 8 | 0) >> 2] = HEAP32[($3 + 12 | 0) >> 2] | 0;
  HEAP32[($3 + 4 | 0) >> 2] = std____2____compressed_pair_std____2__allocator_StdinFile__2c_20StdinFile_____get_second_base_28std____2____compressed_pair_std____2__allocator_StdinFile__2c_20StdinFile___29(HEAP32[($3 + 8 | 0) >> 2] | 0 | 0) | 0;
  HEAP32[$3 >> 2] = HEAP32[($3 + 4 | 0) >> 2] | 0;
  $8 = HEAP32[$3 >> 2] | 0;
  __stack_pointer = $3 + 16 | 0;
  return $8 | 0;
 }
 
 function std____2__allocator_traits_std____2__allocator_std____2____shared_ptr_emplace_StdinFile_2c_20std____2__allocator_StdinFile__20__20__20___deallocate_28std____2__allocator_std____2____shared_ptr_emplace_StdinFile_2c_20std____2__allocator_StdinFile__20__20___2c_20std____2____shared_ptr_emplace_StdinFile_2c_20std____2__allocator_StdinFile__20___2c_20unsigned_20long_29($0, $1, $2) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  var $5 = 0;
  $5 = __stack_pointer - 16 | 0;
  __stack_pointer = $5;
  HEAP32[($5 + 12 | 0) >> 2] = $0;
  HEAP32[($5 + 8 | 0) >> 2] = $1;
  HEAP32[($5 + 4 | 0) >> 2] = $2;
  std____2__allocator_std____2____shared_ptr_emplace_StdinFile_2c_20std____2__allocator_StdinFile__20__20___deallocate_28std____2____shared_ptr_emplace_StdinFile_2c_20std____2__allocator_StdinFile__20___2c_20unsigned_20long_29(HEAP32[($5 + 12 | 0) >> 2] | 0 | 0, HEAP32[($5 + 8 | 0) >> 2] | 0 | 0, HEAP32[($5 + 4 | 0) >> 2] | 0 | 0);
  __stack_pointer = $5 + 16 | 0;
  return;
 }
 
 function std____2__allocator_std____2____shared_ptr_emplace_StdinFile_2c_20std____2__allocator_StdinFile__20__20___allocate_28unsigned_20long_29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0, $18 = 0;
  $4 = __stack_pointer - 16 | 0;
  __stack_pointer = $4;
  HEAP32[($4 + 12 | 0) >> 2] = $0;
  HEAP32[($4 + 8 | 0) >> 2] = $1;
  label$1 : {
   if (!((HEAP32[($4 + 8 | 0) >> 2] | 0) >>> 0 > (unsigned_20long_20std____2__allocator_traits_std____2__allocator_std____2____shared_ptr_emplace_StdinFile_2c_20std____2__allocator_StdinFile__20__20__20___max_size_std____2__allocator_std____2____shared_ptr_emplace_StdinFile_2c_20std____2__allocator_StdinFile__20__20__2c_20void__28std____2__allocator_std____2____shared_ptr_emplace_StdinFile_2c_20std____2__allocator_StdinFile__20__20__20const__29(HEAP32[($4 + 12 | 0) >> 2] | 0 | 0) | 0) >>> 0 & 1 | 0)) {
    break label$1
   }
   std____2____throw_length_error_28char_20const__29(1154 | 0);
   abort();
  }
  $18 = std____2____libcpp_allocate_28unsigned_20long_2c_20unsigned_20long_29(Math_imul(HEAP32[($4 + 8 | 0) >> 2] | 0, 44) | 0, 4 | 0) | 0;
  __stack_pointer = $4 + 16 | 0;
  return $18 | 0;
 }
 
 function unsigned_20long_20std____2__allocator_traits_std____2__allocator_std____2____shared_ptr_emplace_StdinFile_2c_20std____2__allocator_StdinFile__20__20__20___max_size_std____2__allocator_std____2____shared_ptr_emplace_StdinFile_2c_20std____2__allocator_StdinFile__20__20__2c_20void__28std____2__allocator_std____2____shared_ptr_emplace_StdinFile_2c_20std____2__allocator_StdinFile__20__20__20const__29($0) {
  $0 = $0 | 0;
  var $3 = 0, $5 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $5 = std____2__allocator_std____2____shared_ptr_emplace_StdinFile_2c_20std____2__allocator_StdinFile__20__20___max_size_28_29_20const(HEAP32[($3 + 12 | 0) >> 2] | 0 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $5 | 0;
 }
 
 function std____2__allocator_std____2____shared_ptr_emplace_StdinFile_2c_20std____2__allocator_StdinFile__20__20___max_size_28_29_20const($0) {
  $0 = $0 | 0;
  HEAP32[((__stack_pointer - 16 | 0) + 12 | 0) >> 2] = $0;
  return 97612893 | 0;
 }
 
 function std____2____shared_ptr_emplace_StdinFile_2c_20std____2__allocator_StdinFile__20____Storage____get_alloc_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $8 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  HEAP32[($3 + 8 | 0) >> 2] = HEAP32[($3 + 12 | 0) >> 2] | 0;
  HEAP32[($3 + 4 | 0) >> 2] = std____2____compressed_pair_std____2__allocator_StdinFile__2c_20StdinFile_____get_first_base_28std____2____compressed_pair_std____2__allocator_StdinFile__2c_20StdinFile___29(HEAP32[($3 + 8 | 0) >> 2] | 0 | 0) | 0;
  HEAP32[$3 >> 2] = HEAP32[($3 + 4 | 0) >> 2] | 0;
  $8 = HEAP32[$3 >> 2] | 0;
  __stack_pointer = $3 + 16 | 0;
  return $8 | 0;
 }
 
 function File__File_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $4 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 12 | 0) >> 2] | 0;
  HEAP32[$4 >> 2] = 1632 + 8 | 0;
  std____2__mutex__mutex_28_29($4 + 4 | 0 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $4 | 0;
 }
 
 function std____2____shared_ptr_emplace_StdinFile_2c_20std____2__allocator_StdinFile__20______shared_ptr_emplace_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $4 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 12 | 0) >> 2] | 0;
  HEAP32[$4 >> 2] = 1768 + 8 | 0;
  std____2____shared_ptr_emplace_StdinFile_2c_20std____2__allocator_StdinFile__20____Storage____Storage_28_29($4 + 12 | 0 | 0) | 0;
  std____2____shared_count_____shared_count_28_29($4 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $4 | 0;
 }
 
 function std____2____shared_ptr_emplace_StdinFile_2c_20std____2__allocator_StdinFile__20____Storage____Storage_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $4 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 12 | 0) >> 2] | 0;
  std____2____shared_ptr_emplace_StdinFile_2c_20std____2__allocator_StdinFile__20____Storage____get_alloc_28_29($4 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $4 | 0;
 }
 
 function std____2____shared_ptr_emplace_StdinFile_2c_20std____2__allocator_StdinFile__20______shared_ptr_emplace_28_29_1($0) {
  $0 = $0 | 0;
  var $3 = 0, $4 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 12 | 0) >> 2] | 0;
  std____2____shared_ptr_emplace_StdinFile_2c_20std____2__allocator_StdinFile__20______shared_ptr_emplace_28_29($4 | 0) | 0;
  operator_20delete_28void__29($4 | 0);
  __stack_pointer = $3 + 16 | 0;
  return;
 }
 
 function std____2____shared_ptr_emplace_StdinFile_2c_20std____2__allocator_StdinFile__20_____on_zero_shared_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $5 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $5 = std____2____shared_ptr_emplace_StdinFile_2c_20std____2__allocator_StdinFile__20_____get_elem_28_29(HEAP32[($3 + 12 | 0) >> 2] | 0 | 0) | 0;
  FUNCTION_TABLE[HEAP32[((HEAP32[$5 >> 2] | 0) + 8 | 0) >> 2] | 0 | 0]($5) | 0;
  __stack_pointer = $3 + 16 | 0;
  return;
 }
 
 function std____2____shared_ptr_emplace_StdinFile_2c_20std____2__allocator_StdinFile__20_____on_zero_shared_weak_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $4 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 12 | 0) >> 2] | 0;
  std____2__allocator_std____2____shared_ptr_emplace_StdinFile_2c_20std____2__allocator_StdinFile__20__20___allocator_StdinFile__28std____2__allocator_StdinFile__20const__29($3 + 8 | 0 | 0, std____2____shared_ptr_emplace_StdinFile_2c_20std____2__allocator_StdinFile__20_____get_alloc_28_29($4 | 0) | 0 | 0) | 0;
  std____2____shared_ptr_emplace_StdinFile_2c_20std____2__allocator_StdinFile__20____Storage____Storage_28_29($4 + 12 | 0 | 0) | 0;
  std____2__allocator_traits_std____2__allocator_std____2____shared_ptr_emplace_StdinFile_2c_20std____2__allocator_StdinFile__20__20__20___deallocate_28std____2__allocator_std____2____shared_ptr_emplace_StdinFile_2c_20std____2__allocator_StdinFile__20__20___2c_20std____2____shared_ptr_emplace_StdinFile_2c_20std____2__allocator_StdinFile__20___2c_20unsigned_20long_29($3 + 8 | 0 | 0, std____2__pointer_traits_std____2____shared_ptr_emplace_StdinFile_2c_20std____2__allocator_StdinFile__20_____pointer_to_28std____2____shared_ptr_emplace_StdinFile_2c_20std____2__allocator_StdinFile__20___29($4 | 0) | 0 | 0, 1 | 0);
  __stack_pointer = $3 + 16 | 0;
  return;
 }
 
 function std____2____shared_ptr_emplace_StdinFile_2c_20std____2__allocator_StdinFile__20_____get_alloc_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $7 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $7 = std____2____shared_ptr_emplace_StdinFile_2c_20std____2__allocator_StdinFile__20____Storage____get_alloc_28_29((HEAP32[($3 + 12 | 0) >> 2] | 0) + 12 | 0 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $7 | 0;
 }
 
 function std____2__pointer_traits_std____2____shared_ptr_emplace_StdinFile_2c_20std____2__allocator_StdinFile__20_____pointer_to_28std____2____shared_ptr_emplace_StdinFile_2c_20std____2__allocator_StdinFile__20___29($0) {
  $0 = $0 | 0;
  var $3 = 0, $5 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $5 = std____2____shared_ptr_emplace_StdinFile_2c_20std____2__allocator_StdinFile__20___20std____2__addressof_std____2____shared_ptr_emplace_StdinFile_2c_20std____2__allocator_StdinFile__20__20__28std____2____shared_ptr_emplace_StdinFile_2c_20std____2__allocator_StdinFile__20___29(HEAP32[($3 + 12 | 0) >> 2] | 0 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $5 | 0;
 }
 
 function std____2____compressed_pair_std____2__allocator_StdinFile__2c_20StdinFile_____get_first_base_28std____2____compressed_pair_std____2__allocator_StdinFile__2c_20StdinFile___29($0) {
  $0 = $0 | 0;
  var $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  return HEAP32[($3 + 12 | 0) >> 2] | 0 | 0;
 }
 
 function std____2__allocator_std____2____shared_ptr_emplace_StdinFile_2c_20std____2__allocator_StdinFile__20__20___deallocate_28std____2____shared_ptr_emplace_StdinFile_2c_20std____2__allocator_StdinFile__20___2c_20unsigned_20long_29($0, $1, $2) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  var $5 = 0;
  $5 = __stack_pointer - 16 | 0;
  __stack_pointer = $5;
  HEAP32[($5 + 12 | 0) >> 2] = $0;
  HEAP32[($5 + 8 | 0) >> 2] = $1;
  HEAP32[($5 + 4 | 0) >> 2] = $2;
  std____2____libcpp_deallocate_28void__2c_20unsigned_20long_2c_20unsigned_20long_29(HEAP32[($5 + 8 | 0) >> 2] | 0 | 0, Math_imul(HEAP32[($5 + 4 | 0) >> 2] | 0, 44) | 0, 4 | 0);
  __stack_pointer = $5 + 16 | 0;
  return;
 }
 
 function std____2____compressed_pair_std____2__allocator_StdinFile__2c_20StdinFile_____get_second_base_28std____2____compressed_pair_std____2__allocator_StdinFile__2c_20StdinFile___29($0) {
  $0 = $0 | 0;
  var $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  return HEAP32[($3 + 12 | 0) >> 2] | 0 | 0;
 }
 
 function std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20_____shared_ptr_emplace_int_2c_20std____2__shared_ptr_StdoutFile__20__28std____2__allocator_OpenFileDescriptor__2c_20int___2c_20std____2__shared_ptr_StdoutFile____29($0, $1, $2) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  var $5 = 0, $6 = 0, $18 = 0, $21 = 0, $23 = 0, i64toi32_i32$1 = 0;
  $5 = __stack_pointer - 48 | 0;
  __stack_pointer = $5;
  HEAP32[($5 + 36 | 0) >> 2] = $0;
  HEAP32[($5 + 32 | 0) >> 2] = $1;
  HEAP32[($5 + 28 | 0) >> 2] = $2;
  $6 = HEAP32[($5 + 36 | 0) >> 2] | 0;
  std____2____shared_weak_count____shared_weak_count_28long_29($6 | 0, 0 | 0) | 0;
  HEAP32[$6 >> 2] = 1656 + 8 | 0;
  std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20____Storage___Storage_28std____2__allocator_OpenFileDescriptor____29($6 + 16 | 0 | 0, std____2__remove_reference_std____2__allocator_OpenFileDescriptor_____type___20std____2__move_std____2__allocator_OpenFileDescriptor____28std____2__allocator_OpenFileDescriptor___29($5 + 40 | 0 | 0) | 0 | 0) | 0;
  $18 = std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20_____get_elem_28_29($6 | 0) | 0;
  $21 = HEAP32[(int___20std____2__forward_int__28std____2__remove_reference_int___type__29(HEAP32[($5 + 32 | 0) >> 2] | 0 | 0) | 0) >> 2] | 0;
  $23 = std____2__shared_ptr_StdoutFile____20std____2__forward_std____2__shared_ptr_StdoutFile__20__28std____2__remove_reference_std____2__shared_ptr_StdoutFile__20___type__29(HEAP32[($5 + 28 | 0) >> 2] | 0 | 0) | 0;
  HEAP32[($5 + 8 | 0) >> 2] = 0;
  std____2__shared_ptr_File___shared_ptr_StdoutFile__28std____2__shared_ptr_StdoutFile____2c_20std____2__enable_if___compatible_with_StdoutFile_2c_20File___value_2c_20std____2__shared_ptr_File_____nat___type_29($5 + 16 | 0 | 0, $23 | 0, HEAP32[($5 + 8 | 0) >> 2] | 0 | 0) | 0;
  i64toi32_i32$1 = HEAP32[($5 + 20 | 0) >> 2] | 0;
  HEAP32[$5 >> 2] = HEAP32[($5 + 16 | 0) >> 2] | 0;
  HEAP32[($5 + 4 | 0) >> 2] = i64toi32_i32$1;
  OpenFileDescriptor__OpenFileDescriptor_28unsigned_20int_2c_20std____2__shared_ptr_File__29($18 | 0, $21 | 0, $5 | 0) | 0;
  __stack_pointer = $5 + 48 | 0;
  return $6 | 0;
 }
 
 function std____2__shared_ptr_File___shared_ptr_StdoutFile__28std____2__shared_ptr_StdoutFile____2c_20std____2__enable_if___compatible_with_StdoutFile_2c_20File___value_2c_20std____2__shared_ptr_File_____nat___type_29($0, $1, $2) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  var $5 = 0, $6 = 0;
  $5 = __stack_pointer - 16 | 0;
  HEAP32[($5 + 8 | 0) >> 2] = $2;
  HEAP32[($5 + 4 | 0) >> 2] = $0;
  HEAP32[$5 >> 2] = $1;
  $6 = HEAP32[($5 + 4 | 0) >> 2] | 0;
  HEAP32[$6 >> 2] = HEAP32[(HEAP32[$5 >> 2] | 0) >> 2] | 0;
  HEAP32[($6 + 4 | 0) >> 2] = HEAP32[((HEAP32[$5 >> 2] | 0) + 4 | 0) >> 2] | 0;
  HEAP32[(HEAP32[$5 >> 2] | 0) >> 2] = 0;
  HEAP32[((HEAP32[$5 >> 2] | 0) + 4 | 0) >> 2] = 0;
  return $6 | 0;
 }
 
 function std____2____allocation_guard_std____2__allocator_std____2____shared_ptr_emplace_StdoutFile_2c_20std____2__allocator_StdoutFile__20__20__20_____allocation_guard_std____2__allocator_StdoutFile__20__28std____2__allocator_StdoutFile__2c_20unsigned_20long_29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0, $5 = 0;
  $4 = __stack_pointer - 16 | 0;
  __stack_pointer = $4;
  HEAP32[($4 + 4 | 0) >> 2] = $0;
  HEAP32[$4 >> 2] = $1;
  $5 = HEAP32[($4 + 4 | 0) >> 2] | 0;
  std____2__allocator_std____2____shared_ptr_emplace_StdoutFile_2c_20std____2__allocator_StdoutFile__20__20___allocator_StdoutFile__28std____2__allocator_StdoutFile__20const__29($5 | 0, std____2__remove_reference_std____2__allocator_StdoutFile_____type___20std____2__move_std____2__allocator_StdoutFile____28std____2__allocator_StdoutFile___29($4 + 8 | 0 | 0) | 0 | 0) | 0;
  HEAP32[($5 + 4 | 0) >> 2] = HEAP32[$4 >> 2] | 0;
  HEAP32[($5 + 8 | 0) >> 2] = std____2__allocator_traits_std____2__allocator_std____2____shared_ptr_emplace_StdoutFile_2c_20std____2__allocator_StdoutFile__20__20__20___allocate_28std____2__allocator_std____2____shared_ptr_emplace_StdoutFile_2c_20std____2__allocator_StdoutFile__20__20___2c_20unsigned_20long_29($5 | 0, HEAP32[($5 + 4 | 0) >> 2] | 0 | 0) | 0;
  __stack_pointer = $4 + 16 | 0;
  return $5 | 0;
 }
 
 function std____2____allocation_guard_std____2__allocator_std____2____shared_ptr_emplace_StdoutFile_2c_20std____2__allocator_StdoutFile__20__20__20_____get_28_29_20const($0) {
  $0 = $0 | 0;
  var $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  return HEAP32[((HEAP32[($3 + 12 | 0) >> 2] | 0) + 8 | 0) >> 2] | 0 | 0;
 }
 
 function std____2____shared_ptr_emplace_StdoutFile_2c_20std____2__allocator_StdoutFile__20___20std____2__addressof_std____2____shared_ptr_emplace_StdoutFile_2c_20std____2__allocator_StdoutFile__20__20__28std____2____shared_ptr_emplace_StdoutFile_2c_20std____2__allocator_StdoutFile__20___29($0) {
  $0 = $0 | 0;
  var $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  return HEAP32[($3 + 12 | 0) >> 2] | 0 | 0;
 }
 
 function std____2____shared_ptr_emplace_StdoutFile_2c_20std____2__allocator_StdoutFile__20_____shared_ptr_emplace___28std____2__allocator_StdoutFile__29($0) {
  $0 = $0 | 0;
  var i64toi32_i32$1 = 0, $3 = 0, $4 = 0, $16 = 0, i64toi32_i32$0 = 0, $17 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 4 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 4 | 0) >> 2] | 0;
  std____2____shared_weak_count____shared_weak_count_28long_29($4 | 0, 0 | 0) | 0;
  HEAP32[$4 >> 2] = 1872 + 8 | 0;
  std____2____shared_ptr_emplace_StdoutFile_2c_20std____2__allocator_StdoutFile__20____Storage___Storage_28std____2__allocator_StdoutFile____29($4 + 12 | 0 | 0, std____2__remove_reference_std____2__allocator_StdoutFile_____type___20std____2__move_std____2__allocator_StdoutFile____28std____2__allocator_StdoutFile___29($3 + 8 | 0 | 0) | 0 | 0) | 0;
  $16 = std____2____shared_ptr_emplace_StdoutFile_2c_20std____2__allocator_StdoutFile__20_____get_elem_28_29($4 | 0) | 0;
  i64toi32_i32$0 = 0;
  $17 = 0;
  i64toi32_i32$1 = $16;
  HEAP32[i64toi32_i32$1 >> 2] = $17;
  HEAP32[(i64toi32_i32$1 + 4 | 0) >> 2] = i64toi32_i32$0;
  i64toi32_i32$1 = i64toi32_i32$1 + 24 | 0;
  HEAP32[i64toi32_i32$1 >> 2] = $17;
  HEAP32[(i64toi32_i32$1 + 4 | 0) >> 2] = i64toi32_i32$0;
  i64toi32_i32$1 = $16 + 16 | 0;
  HEAP32[i64toi32_i32$1 >> 2] = $17;
  HEAP32[(i64toi32_i32$1 + 4 | 0) >> 2] = i64toi32_i32$0;
  i64toi32_i32$1 = $16 + 8 | 0;
  HEAP32[i64toi32_i32$1 >> 2] = $17;
  HEAP32[(i64toi32_i32$1 + 4 | 0) >> 2] = i64toi32_i32$0;
  StdoutFile__StdoutFile_28_29($16 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $4 | 0;
 }
 
 function std____2____allocation_guard_std____2__allocator_std____2____shared_ptr_emplace_StdoutFile_2c_20std____2__allocator_StdoutFile__20__20__20_____release_ptr_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $4 = 0;
  $3 = __stack_pointer - 16 | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 12 | 0) >> 2] | 0;
  HEAP32[($3 + 8 | 0) >> 2] = HEAP32[($4 + 8 | 0) >> 2] | 0;
  HEAP32[($4 + 8 | 0) >> 2] = 0;
  return HEAP32[($3 + 8 | 0) >> 2] | 0 | 0;
 }
 
 function std____2____shared_ptr_emplace_StdoutFile_2c_20std____2__allocator_StdoutFile__20_____get_elem_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $7 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $7 = std____2____shared_ptr_emplace_StdoutFile_2c_20std____2__allocator_StdoutFile__20____Storage____get_elem_28_29((HEAP32[($3 + 12 | 0) >> 2] | 0) + 12 | 0 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $7 | 0;
 }
 
 function std____2__shared_ptr_StdoutFile__20std____2__shared_ptr_StdoutFile_____create_with_control_block_StdoutFile_2c_20std____2____shared_ptr_emplace_StdoutFile_2c_20std____2__allocator_StdoutFile__20__20__28StdoutFile__2c_20std____2____shared_ptr_emplace_StdoutFile_2c_20std____2__allocator_StdoutFile__20___29($0, $1, $2) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  var $5 = 0, $11 = 0;
  $5 = __stack_pointer - 32 | 0;
  __stack_pointer = $5;
  HEAP32[($5 + 28 | 0) >> 2] = $1;
  HEAP32[($5 + 24 | 0) >> 2] = $2;
  HEAP8[($5 + 23 | 0) >> 0] = 0 & 1 | 0;
  std____2__shared_ptr_StdoutFile___shared_ptr_28_29($0 | 0) | 0;
  HEAP32[$0 >> 2] = HEAP32[($5 + 28 | 0) >> 2] | 0;
  HEAP32[($0 + 4 | 0) >> 2] = HEAP32[($5 + 24 | 0) >> 2] | 0;
  $11 = HEAP32[$0 >> 2] | 0;
  HEAP32[($5 + 4 | 0) >> 2] = HEAP32[$0 >> 2] | 0;
  HEAP32[$5 >> 2] = $11;
  std____2__shared_ptr_StdoutFile_____enable_weak_this_28____29($0 | 0, $5 | 0);
  HEAP8[($5 + 23 | 0) >> 0] = 1 & 1 | 0;
  label$1 : {
   if ((HEAPU8[($5 + 23 | 0) >> 0] | 0) & 1 | 0) {
    break label$1
   }
   std____2__shared_ptr_StdoutFile____shared_ptr_28_29($0 | 0) | 0;
  }
  __stack_pointer = $5 + 32 | 0;
  return;
 }
 
 function std____2____allocation_guard_std____2__allocator_std____2____shared_ptr_emplace_StdoutFile_2c_20std____2__allocator_StdoutFile__20__20__20______allocation_guard_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $4 = 0, $14 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 8 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 8 | 0) >> 2] | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $4;
  label$1 : {
   if (!((HEAP32[($4 + 8 | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0)) {
    break label$1
   }
   std____2__allocator_traits_std____2__allocator_std____2____shared_ptr_emplace_StdoutFile_2c_20std____2__allocator_StdoutFile__20__20__20___deallocate_28std____2__allocator_std____2____shared_ptr_emplace_StdoutFile_2c_20std____2__allocator_StdoutFile__20__20___2c_20std____2____shared_ptr_emplace_StdoutFile_2c_20std____2__allocator_StdoutFile__20___2c_20unsigned_20long_29($4 | 0, HEAP32[($4 + 8 | 0) >> 2] | 0 | 0, HEAP32[($4 + 4 | 0) >> 2] | 0 | 0);
  }
  $14 = HEAP32[($3 + 12 | 0) >> 2] | 0;
  __stack_pointer = $3 + 16 | 0;
  return $14 | 0;
 }
 
 function std____2__remove_reference_std____2__allocator_StdoutFile_____type___20std____2__move_std____2__allocator_StdoutFile____28std____2__allocator_StdoutFile___29($0) {
  $0 = $0 | 0;
  var $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  return HEAP32[($3 + 12 | 0) >> 2] | 0 | 0;
 }
 
 function std____2__allocator_std____2____shared_ptr_emplace_StdoutFile_2c_20std____2__allocator_StdoutFile__20__20___allocator_StdoutFile__28std____2__allocator_StdoutFile__20const__29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0;
  $4 = __stack_pointer - 16 | 0;
  HEAP32[($4 + 12 | 0) >> 2] = $0;
  HEAP32[($4 + 8 | 0) >> 2] = $1;
  return HEAP32[($4 + 12 | 0) >> 2] | 0 | 0;
 }
 
 function std____2__allocator_traits_std____2__allocator_std____2____shared_ptr_emplace_StdoutFile_2c_20std____2__allocator_StdoutFile__20__20__20___allocate_28std____2__allocator_std____2____shared_ptr_emplace_StdoutFile_2c_20std____2__allocator_StdoutFile__20__20___2c_20unsigned_20long_29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0, $7 = 0;
  $4 = __stack_pointer - 16 | 0;
  __stack_pointer = $4;
  HEAP32[($4 + 12 | 0) >> 2] = $0;
  HEAP32[($4 + 8 | 0) >> 2] = $1;
  $7 = std____2__allocator_std____2____shared_ptr_emplace_StdoutFile_2c_20std____2__allocator_StdoutFile__20__20___allocate_28unsigned_20long_29(HEAP32[($4 + 12 | 0) >> 2] | 0 | 0, HEAP32[($4 + 8 | 0) >> 2] | 0 | 0) | 0;
  __stack_pointer = $4 + 16 | 0;
  return $7 | 0;
 }
 
 function std____2____shared_ptr_emplace_StdoutFile_2c_20std____2__allocator_StdoutFile__20____Storage___Storage_28std____2__allocator_StdoutFile____29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0, $5 = 0;
  $4 = __stack_pointer - 16 | 0;
  __stack_pointer = $4;
  HEAP32[($4 + 12 | 0) >> 2] = $0;
  HEAP32[($4 + 8 | 0) >> 2] = $1;
  $5 = HEAP32[($4 + 12 | 0) >> 2] | 0;
  std____2____shared_ptr_emplace_StdoutFile_2c_20std____2__allocator_StdoutFile__20____Storage____get_alloc_28_29($5 | 0) | 0;
  std____2__remove_reference_std____2__allocator_StdoutFile_____type___20std____2__move_std____2__allocator_StdoutFile____28std____2__allocator_StdoutFile___29(HEAP32[($4 + 8 | 0) >> 2] | 0 | 0) | 0;
  __stack_pointer = $4 + 16 | 0;
  return $5 | 0;
 }
 
 function StdoutFile__StdoutFile_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $4 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 12 | 0) >> 2] | 0;
  File__File_28_29($4 | 0) | 0;
  HEAP32[$4 >> 2] = 1528 + 8 | 0;
  __stack_pointer = $3 + 16 | 0;
  return $4 | 0;
 }
 
 function std____2__shared_ptr_StdoutFile___shared_ptr_28_29($0) {
  $0 = $0 | 0;
  var $4 = 0, $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 12 | 0) >> 2] | 0;
  HEAP32[$4 >> 2] = 0;
  HEAP32[($4 + 4 | 0) >> 2] = 0;
  return $4 | 0;
 }
 
 function std____2__shared_ptr_StdoutFile_____enable_weak_this_28____29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  HEAP32[((__stack_pointer - 16 | 0) + 12 | 0) >> 2] = $0;
  return;
 }
 
 function std____2____shared_ptr_emplace_StdoutFile_2c_20std____2__allocator_StdoutFile__20____Storage____get_elem_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $8 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  HEAP32[($3 + 8 | 0) >> 2] = HEAP32[($3 + 12 | 0) >> 2] | 0;
  HEAP32[($3 + 4 | 0) >> 2] = std____2____compressed_pair_std____2__allocator_StdoutFile__2c_20StdoutFile_____get_second_base_28std____2____compressed_pair_std____2__allocator_StdoutFile__2c_20StdoutFile___29(HEAP32[($3 + 8 | 0) >> 2] | 0 | 0) | 0;
  HEAP32[$3 >> 2] = HEAP32[($3 + 4 | 0) >> 2] | 0;
  $8 = HEAP32[$3 >> 2] | 0;
  __stack_pointer = $3 + 16 | 0;
  return $8 | 0;
 }
 
 function std____2__allocator_traits_std____2__allocator_std____2____shared_ptr_emplace_StdoutFile_2c_20std____2__allocator_StdoutFile__20__20__20___deallocate_28std____2__allocator_std____2____shared_ptr_emplace_StdoutFile_2c_20std____2__allocator_StdoutFile__20__20___2c_20std____2____shared_ptr_emplace_StdoutFile_2c_20std____2__allocator_StdoutFile__20___2c_20unsigned_20long_29($0, $1, $2) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  var $5 = 0;
  $5 = __stack_pointer - 16 | 0;
  __stack_pointer = $5;
  HEAP32[($5 + 12 | 0) >> 2] = $0;
  HEAP32[($5 + 8 | 0) >> 2] = $1;
  HEAP32[($5 + 4 | 0) >> 2] = $2;
  std____2__allocator_std____2____shared_ptr_emplace_StdoutFile_2c_20std____2__allocator_StdoutFile__20__20___deallocate_28std____2____shared_ptr_emplace_StdoutFile_2c_20std____2__allocator_StdoutFile__20___2c_20unsigned_20long_29(HEAP32[($5 + 12 | 0) >> 2] | 0 | 0, HEAP32[($5 + 8 | 0) >> 2] | 0 | 0, HEAP32[($5 + 4 | 0) >> 2] | 0 | 0);
  __stack_pointer = $5 + 16 | 0;
  return;
 }
 
 function std____2__allocator_std____2____shared_ptr_emplace_StdoutFile_2c_20std____2__allocator_StdoutFile__20__20___allocate_28unsigned_20long_29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0, $18 = 0;
  $4 = __stack_pointer - 16 | 0;
  __stack_pointer = $4;
  HEAP32[($4 + 12 | 0) >> 2] = $0;
  HEAP32[($4 + 8 | 0) >> 2] = $1;
  label$1 : {
   if (!((HEAP32[($4 + 8 | 0) >> 2] | 0) >>> 0 > (unsigned_20long_20std____2__allocator_traits_std____2__allocator_std____2____shared_ptr_emplace_StdoutFile_2c_20std____2__allocator_StdoutFile__20__20__20___max_size_std____2__allocator_std____2____shared_ptr_emplace_StdoutFile_2c_20std____2__allocator_StdoutFile__20__20__2c_20void__28std____2__allocator_std____2____shared_ptr_emplace_StdoutFile_2c_20std____2__allocator_StdoutFile__20__20__20const__29(HEAP32[($4 + 12 | 0) >> 2] | 0 | 0) | 0) >>> 0 & 1 | 0)) {
    break label$1
   }
   std____2____throw_length_error_28char_20const__29(1154 | 0);
   abort();
  }
  $18 = std____2____libcpp_allocate_28unsigned_20long_2c_20unsigned_20long_29(Math_imul(HEAP32[($4 + 8 | 0) >> 2] | 0, 44) | 0, 4 | 0) | 0;
  __stack_pointer = $4 + 16 | 0;
  return $18 | 0;
 }
 
 function unsigned_20long_20std____2__allocator_traits_std____2__allocator_std____2____shared_ptr_emplace_StdoutFile_2c_20std____2__allocator_StdoutFile__20__20__20___max_size_std____2__allocator_std____2____shared_ptr_emplace_StdoutFile_2c_20std____2__allocator_StdoutFile__20__20__2c_20void__28std____2__allocator_std____2____shared_ptr_emplace_StdoutFile_2c_20std____2__allocator_StdoutFile__20__20__20const__29($0) {
  $0 = $0 | 0;
  var $3 = 0, $5 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $5 = std____2__allocator_std____2____shared_ptr_emplace_StdoutFile_2c_20std____2__allocator_StdoutFile__20__20___max_size_28_29_20const(HEAP32[($3 + 12 | 0) >> 2] | 0 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $5 | 0;
 }
 
 function std____2__allocator_std____2____shared_ptr_emplace_StdoutFile_2c_20std____2__allocator_StdoutFile__20__20___max_size_28_29_20const($0) {
  $0 = $0 | 0;
  HEAP32[((__stack_pointer - 16 | 0) + 12 | 0) >> 2] = $0;
  return 97612893 | 0;
 }
 
 function std____2____shared_ptr_emplace_StdoutFile_2c_20std____2__allocator_StdoutFile__20____Storage____get_alloc_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $8 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  HEAP32[($3 + 8 | 0) >> 2] = HEAP32[($3 + 12 | 0) >> 2] | 0;
  HEAP32[($3 + 4 | 0) >> 2] = std____2____compressed_pair_std____2__allocator_StdoutFile__2c_20StdoutFile_____get_first_base_28std____2____compressed_pair_std____2__allocator_StdoutFile__2c_20StdoutFile___29(HEAP32[($3 + 8 | 0) >> 2] | 0 | 0) | 0;
  HEAP32[$3 >> 2] = HEAP32[($3 + 4 | 0) >> 2] | 0;
  $8 = HEAP32[$3 >> 2] | 0;
  __stack_pointer = $3 + 16 | 0;
  return $8 | 0;
 }
 
 function std____2____shared_ptr_emplace_StdoutFile_2c_20std____2__allocator_StdoutFile__20______shared_ptr_emplace_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $4 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 12 | 0) >> 2] | 0;
  HEAP32[$4 >> 2] = 1872 + 8 | 0;
  std____2____shared_ptr_emplace_StdoutFile_2c_20std____2__allocator_StdoutFile__20____Storage____Storage_28_29($4 + 12 | 0 | 0) | 0;
  std____2____shared_count_____shared_count_28_29($4 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $4 | 0;
 }
 
 function std____2____shared_ptr_emplace_StdoutFile_2c_20std____2__allocator_StdoutFile__20____Storage____Storage_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $4 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 12 | 0) >> 2] | 0;
  std____2____shared_ptr_emplace_StdoutFile_2c_20std____2__allocator_StdoutFile__20____Storage____get_alloc_28_29($4 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $4 | 0;
 }
 
 function std____2____shared_ptr_emplace_StdoutFile_2c_20std____2__allocator_StdoutFile__20______shared_ptr_emplace_28_29_1($0) {
  $0 = $0 | 0;
  var $3 = 0, $4 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 12 | 0) >> 2] | 0;
  std____2____shared_ptr_emplace_StdoutFile_2c_20std____2__allocator_StdoutFile__20______shared_ptr_emplace_28_29($4 | 0) | 0;
  operator_20delete_28void__29($4 | 0);
  __stack_pointer = $3 + 16 | 0;
  return;
 }
 
 function std____2____shared_ptr_emplace_StdoutFile_2c_20std____2__allocator_StdoutFile__20_____on_zero_shared_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $5 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $5 = std____2____shared_ptr_emplace_StdoutFile_2c_20std____2__allocator_StdoutFile__20_____get_elem_28_29(HEAP32[($3 + 12 | 0) >> 2] | 0 | 0) | 0;
  FUNCTION_TABLE[HEAP32[((HEAP32[$5 >> 2] | 0) + 8 | 0) >> 2] | 0 | 0]($5) | 0;
  __stack_pointer = $3 + 16 | 0;
  return;
 }
 
 function std____2____shared_ptr_emplace_StdoutFile_2c_20std____2__allocator_StdoutFile__20_____on_zero_shared_weak_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $4 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 12 | 0) >> 2] | 0;
  std____2__allocator_std____2____shared_ptr_emplace_StdoutFile_2c_20std____2__allocator_StdoutFile__20__20___allocator_StdoutFile__28std____2__allocator_StdoutFile__20const__29($3 + 8 | 0 | 0, std____2____shared_ptr_emplace_StdoutFile_2c_20std____2__allocator_StdoutFile__20_____get_alloc_28_29($4 | 0) | 0 | 0) | 0;
  std____2____shared_ptr_emplace_StdoutFile_2c_20std____2__allocator_StdoutFile__20____Storage____Storage_28_29($4 + 12 | 0 | 0) | 0;
  std____2__allocator_traits_std____2__allocator_std____2____shared_ptr_emplace_StdoutFile_2c_20std____2__allocator_StdoutFile__20__20__20___deallocate_28std____2__allocator_std____2____shared_ptr_emplace_StdoutFile_2c_20std____2__allocator_StdoutFile__20__20___2c_20std____2____shared_ptr_emplace_StdoutFile_2c_20std____2__allocator_StdoutFile__20___2c_20unsigned_20long_29($3 + 8 | 0 | 0, std____2__pointer_traits_std____2____shared_ptr_emplace_StdoutFile_2c_20std____2__allocator_StdoutFile__20_____pointer_to_28std____2____shared_ptr_emplace_StdoutFile_2c_20std____2__allocator_StdoutFile__20___29($4 | 0) | 0 | 0, 1 | 0);
  __stack_pointer = $3 + 16 | 0;
  return;
 }
 
 function std____2____shared_ptr_emplace_StdoutFile_2c_20std____2__allocator_StdoutFile__20_____get_alloc_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $7 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $7 = std____2____shared_ptr_emplace_StdoutFile_2c_20std____2__allocator_StdoutFile__20____Storage____get_alloc_28_29((HEAP32[($3 + 12 | 0) >> 2] | 0) + 12 | 0 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $7 | 0;
 }
 
 function std____2__pointer_traits_std____2____shared_ptr_emplace_StdoutFile_2c_20std____2__allocator_StdoutFile__20_____pointer_to_28std____2____shared_ptr_emplace_StdoutFile_2c_20std____2__allocator_StdoutFile__20___29($0) {
  $0 = $0 | 0;
  var $3 = 0, $5 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $5 = std____2____shared_ptr_emplace_StdoutFile_2c_20std____2__allocator_StdoutFile__20___20std____2__addressof_std____2____shared_ptr_emplace_StdoutFile_2c_20std____2__allocator_StdoutFile__20__20__28std____2____shared_ptr_emplace_StdoutFile_2c_20std____2__allocator_StdoutFile__20___29(HEAP32[($3 + 12 | 0) >> 2] | 0 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $5 | 0;
 }
 
 function std____2____compressed_pair_std____2__allocator_StdoutFile__2c_20StdoutFile_____get_first_base_28std____2____compressed_pair_std____2__allocator_StdoutFile__2c_20StdoutFile___29($0) {
  $0 = $0 | 0;
  var $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  return HEAP32[($3 + 12 | 0) >> 2] | 0 | 0;
 }
 
 function std____2__allocator_std____2____shared_ptr_emplace_StdoutFile_2c_20std____2__allocator_StdoutFile__20__20___deallocate_28std____2____shared_ptr_emplace_StdoutFile_2c_20std____2__allocator_StdoutFile__20___2c_20unsigned_20long_29($0, $1, $2) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  var $5 = 0;
  $5 = __stack_pointer - 16 | 0;
  __stack_pointer = $5;
  HEAP32[($5 + 12 | 0) >> 2] = $0;
  HEAP32[($5 + 8 | 0) >> 2] = $1;
  HEAP32[($5 + 4 | 0) >> 2] = $2;
  std____2____libcpp_deallocate_28void__2c_20unsigned_20long_2c_20unsigned_20long_29(HEAP32[($5 + 8 | 0) >> 2] | 0 | 0, Math_imul(HEAP32[($5 + 4 | 0) >> 2] | 0, 44) | 0, 4 | 0);
  __stack_pointer = $5 + 16 | 0;
  return;
 }
 
 function std____2____compressed_pair_std____2__allocator_StdoutFile__2c_20StdoutFile_____get_second_base_28std____2____compressed_pair_std____2__allocator_StdoutFile__2c_20StdoutFile___29($0) {
  $0 = $0 | 0;
  var $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  return HEAP32[($3 + 12 | 0) >> 2] | 0 | 0;
 }
 
 function std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20_____shared_ptr_emplace_int_2c_20std____2__shared_ptr_StderrFile__20__28std____2__allocator_OpenFileDescriptor__2c_20int___2c_20std____2__shared_ptr_StderrFile____29($0, $1, $2) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  var $5 = 0, $6 = 0, $18 = 0, $21 = 0, $23 = 0, i64toi32_i32$1 = 0;
  $5 = __stack_pointer - 48 | 0;
  __stack_pointer = $5;
  HEAP32[($5 + 36 | 0) >> 2] = $0;
  HEAP32[($5 + 32 | 0) >> 2] = $1;
  HEAP32[($5 + 28 | 0) >> 2] = $2;
  $6 = HEAP32[($5 + 36 | 0) >> 2] | 0;
  std____2____shared_weak_count____shared_weak_count_28long_29($6 | 0, 0 | 0) | 0;
  HEAP32[$6 >> 2] = 1656 + 8 | 0;
  std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20____Storage___Storage_28std____2__allocator_OpenFileDescriptor____29($6 + 16 | 0 | 0, std____2__remove_reference_std____2__allocator_OpenFileDescriptor_____type___20std____2__move_std____2__allocator_OpenFileDescriptor____28std____2__allocator_OpenFileDescriptor___29($5 + 40 | 0 | 0) | 0 | 0) | 0;
  $18 = std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20_____get_elem_28_29($6 | 0) | 0;
  $21 = HEAP32[(int___20std____2__forward_int__28std____2__remove_reference_int___type__29(HEAP32[($5 + 32 | 0) >> 2] | 0 | 0) | 0) >> 2] | 0;
  $23 = std____2__shared_ptr_StderrFile____20std____2__forward_std____2__shared_ptr_StderrFile__20__28std____2__remove_reference_std____2__shared_ptr_StderrFile__20___type__29(HEAP32[($5 + 28 | 0) >> 2] | 0 | 0) | 0;
  HEAP32[($5 + 8 | 0) >> 2] = 0;
  std____2__shared_ptr_File___shared_ptr_StderrFile__28std____2__shared_ptr_StderrFile____2c_20std____2__enable_if___compatible_with_StderrFile_2c_20File___value_2c_20std____2__shared_ptr_File_____nat___type_29($5 + 16 | 0 | 0, $23 | 0, HEAP32[($5 + 8 | 0) >> 2] | 0 | 0) | 0;
  i64toi32_i32$1 = HEAP32[($5 + 20 | 0) >> 2] | 0;
  HEAP32[$5 >> 2] = HEAP32[($5 + 16 | 0) >> 2] | 0;
  HEAP32[($5 + 4 | 0) >> 2] = i64toi32_i32$1;
  OpenFileDescriptor__OpenFileDescriptor_28unsigned_20int_2c_20std____2__shared_ptr_File__29($18 | 0, $21 | 0, $5 | 0) | 0;
  __stack_pointer = $5 + 48 | 0;
  return $6 | 0;
 }
 
 function std____2__shared_ptr_File___shared_ptr_StderrFile__28std____2__shared_ptr_StderrFile____2c_20std____2__enable_if___compatible_with_StderrFile_2c_20File___value_2c_20std____2__shared_ptr_File_____nat___type_29($0, $1, $2) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  var $5 = 0, $6 = 0;
  $5 = __stack_pointer - 16 | 0;
  HEAP32[($5 + 8 | 0) >> 2] = $2;
  HEAP32[($5 + 4 | 0) >> 2] = $0;
  HEAP32[$5 >> 2] = $1;
  $6 = HEAP32[($5 + 4 | 0) >> 2] | 0;
  HEAP32[$6 >> 2] = HEAP32[(HEAP32[$5 >> 2] | 0) >> 2] | 0;
  HEAP32[($6 + 4 | 0) >> 2] = HEAP32[((HEAP32[$5 >> 2] | 0) + 4 | 0) >> 2] | 0;
  HEAP32[(HEAP32[$5 >> 2] | 0) >> 2] = 0;
  HEAP32[((HEAP32[$5 >> 2] | 0) + 4 | 0) >> 2] = 0;
  return $6 | 0;
 }
 
 function std____2____allocation_guard_std____2__allocator_std____2____shared_ptr_emplace_StderrFile_2c_20std____2__allocator_StderrFile__20__20__20_____allocation_guard_std____2__allocator_StderrFile__20__28std____2__allocator_StderrFile__2c_20unsigned_20long_29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0, $5 = 0;
  $4 = __stack_pointer - 16 | 0;
  __stack_pointer = $4;
  HEAP32[($4 + 4 | 0) >> 2] = $0;
  HEAP32[$4 >> 2] = $1;
  $5 = HEAP32[($4 + 4 | 0) >> 2] | 0;
  std____2__allocator_std____2____shared_ptr_emplace_StderrFile_2c_20std____2__allocator_StderrFile__20__20___allocator_StderrFile__28std____2__allocator_StderrFile__20const__29($5 | 0, std____2__remove_reference_std____2__allocator_StderrFile_____type___20std____2__move_std____2__allocator_StderrFile____28std____2__allocator_StderrFile___29($4 + 8 | 0 | 0) | 0 | 0) | 0;
  HEAP32[($5 + 4 | 0) >> 2] = HEAP32[$4 >> 2] | 0;
  HEAP32[($5 + 8 | 0) >> 2] = std____2__allocator_traits_std____2__allocator_std____2____shared_ptr_emplace_StderrFile_2c_20std____2__allocator_StderrFile__20__20__20___allocate_28std____2__allocator_std____2____shared_ptr_emplace_StderrFile_2c_20std____2__allocator_StderrFile__20__20___2c_20unsigned_20long_29($5 | 0, HEAP32[($5 + 4 | 0) >> 2] | 0 | 0) | 0;
  __stack_pointer = $4 + 16 | 0;
  return $5 | 0;
 }
 
 function std____2____allocation_guard_std____2__allocator_std____2____shared_ptr_emplace_StderrFile_2c_20std____2__allocator_StderrFile__20__20__20_____get_28_29_20const($0) {
  $0 = $0 | 0;
  var $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  return HEAP32[((HEAP32[($3 + 12 | 0) >> 2] | 0) + 8 | 0) >> 2] | 0 | 0;
 }
 
 function std____2____shared_ptr_emplace_StderrFile_2c_20std____2__allocator_StderrFile__20___20std____2__addressof_std____2____shared_ptr_emplace_StderrFile_2c_20std____2__allocator_StderrFile__20__20__28std____2____shared_ptr_emplace_StderrFile_2c_20std____2__allocator_StderrFile__20___29($0) {
  $0 = $0 | 0;
  var $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  return HEAP32[($3 + 12 | 0) >> 2] | 0 | 0;
 }
 
 function std____2____shared_ptr_emplace_StderrFile_2c_20std____2__allocator_StderrFile__20_____shared_ptr_emplace___28std____2__allocator_StderrFile__29($0) {
  $0 = $0 | 0;
  var i64toi32_i32$1 = 0, $3 = 0, $4 = 0, $16 = 0, i64toi32_i32$0 = 0, $17 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 4 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 4 | 0) >> 2] | 0;
  std____2____shared_weak_count____shared_weak_count_28long_29($4 | 0, 0 | 0) | 0;
  HEAP32[$4 >> 2] = 1976 + 8 | 0;
  std____2____shared_ptr_emplace_StderrFile_2c_20std____2__allocator_StderrFile__20____Storage___Storage_28std____2__allocator_StderrFile____29($4 + 12 | 0 | 0, std____2__remove_reference_std____2__allocator_StderrFile_____type___20std____2__move_std____2__allocator_StderrFile____28std____2__allocator_StderrFile___29($3 + 8 | 0 | 0) | 0 | 0) | 0;
  $16 = std____2____shared_ptr_emplace_StderrFile_2c_20std____2__allocator_StderrFile__20_____get_elem_28_29($4 | 0) | 0;
  i64toi32_i32$0 = 0;
  $17 = 0;
  i64toi32_i32$1 = $16;
  HEAP32[i64toi32_i32$1 >> 2] = $17;
  HEAP32[(i64toi32_i32$1 + 4 | 0) >> 2] = i64toi32_i32$0;
  i64toi32_i32$1 = i64toi32_i32$1 + 24 | 0;
  HEAP32[i64toi32_i32$1 >> 2] = $17;
  HEAP32[(i64toi32_i32$1 + 4 | 0) >> 2] = i64toi32_i32$0;
  i64toi32_i32$1 = $16 + 16 | 0;
  HEAP32[i64toi32_i32$1 >> 2] = $17;
  HEAP32[(i64toi32_i32$1 + 4 | 0) >> 2] = i64toi32_i32$0;
  i64toi32_i32$1 = $16 + 8 | 0;
  HEAP32[i64toi32_i32$1 >> 2] = $17;
  HEAP32[(i64toi32_i32$1 + 4 | 0) >> 2] = i64toi32_i32$0;
  StderrFile__StderrFile_28_29($16 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $4 | 0;
 }
 
 function std____2____allocation_guard_std____2__allocator_std____2____shared_ptr_emplace_StderrFile_2c_20std____2__allocator_StderrFile__20__20__20_____release_ptr_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $4 = 0;
  $3 = __stack_pointer - 16 | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 12 | 0) >> 2] | 0;
  HEAP32[($3 + 8 | 0) >> 2] = HEAP32[($4 + 8 | 0) >> 2] | 0;
  HEAP32[($4 + 8 | 0) >> 2] = 0;
  return HEAP32[($3 + 8 | 0) >> 2] | 0 | 0;
 }
 
 function std____2____shared_ptr_emplace_StderrFile_2c_20std____2__allocator_StderrFile__20_____get_elem_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $7 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $7 = std____2____shared_ptr_emplace_StderrFile_2c_20std____2__allocator_StderrFile__20____Storage____get_elem_28_29((HEAP32[($3 + 12 | 0) >> 2] | 0) + 12 | 0 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $7 | 0;
 }
 
 function std____2__shared_ptr_StderrFile__20std____2__shared_ptr_StderrFile_____create_with_control_block_StderrFile_2c_20std____2____shared_ptr_emplace_StderrFile_2c_20std____2__allocator_StderrFile__20__20__28StderrFile__2c_20std____2____shared_ptr_emplace_StderrFile_2c_20std____2__allocator_StderrFile__20___29($0, $1, $2) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  var $5 = 0, $11 = 0;
  $5 = __stack_pointer - 32 | 0;
  __stack_pointer = $5;
  HEAP32[($5 + 28 | 0) >> 2] = $1;
  HEAP32[($5 + 24 | 0) >> 2] = $2;
  HEAP8[($5 + 23 | 0) >> 0] = 0 & 1 | 0;
  std____2__shared_ptr_StderrFile___shared_ptr_28_29($0 | 0) | 0;
  HEAP32[$0 >> 2] = HEAP32[($5 + 28 | 0) >> 2] | 0;
  HEAP32[($0 + 4 | 0) >> 2] = HEAP32[($5 + 24 | 0) >> 2] | 0;
  $11 = HEAP32[$0 >> 2] | 0;
  HEAP32[($5 + 4 | 0) >> 2] = HEAP32[$0 >> 2] | 0;
  HEAP32[$5 >> 2] = $11;
  std____2__shared_ptr_StderrFile_____enable_weak_this_28____29($0 | 0, $5 | 0);
  HEAP8[($5 + 23 | 0) >> 0] = 1 & 1 | 0;
  label$1 : {
   if ((HEAPU8[($5 + 23 | 0) >> 0] | 0) & 1 | 0) {
    break label$1
   }
   std____2__shared_ptr_StderrFile____shared_ptr_28_29($0 | 0) | 0;
  }
  __stack_pointer = $5 + 32 | 0;
  return;
 }
 
 function std____2____allocation_guard_std____2__allocator_std____2____shared_ptr_emplace_StderrFile_2c_20std____2__allocator_StderrFile__20__20__20______allocation_guard_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $4 = 0, $14 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 8 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 8 | 0) >> 2] | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $4;
  label$1 : {
   if (!((HEAP32[($4 + 8 | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0)) {
    break label$1
   }
   std____2__allocator_traits_std____2__allocator_std____2____shared_ptr_emplace_StderrFile_2c_20std____2__allocator_StderrFile__20__20__20___deallocate_28std____2__allocator_std____2____shared_ptr_emplace_StderrFile_2c_20std____2__allocator_StderrFile__20__20___2c_20std____2____shared_ptr_emplace_StderrFile_2c_20std____2__allocator_StderrFile__20___2c_20unsigned_20long_29($4 | 0, HEAP32[($4 + 8 | 0) >> 2] | 0 | 0, HEAP32[($4 + 4 | 0) >> 2] | 0 | 0);
  }
  $14 = HEAP32[($3 + 12 | 0) >> 2] | 0;
  __stack_pointer = $3 + 16 | 0;
  return $14 | 0;
 }
 
 function std____2__remove_reference_std____2__allocator_StderrFile_____type___20std____2__move_std____2__allocator_StderrFile____28std____2__allocator_StderrFile___29($0) {
  $0 = $0 | 0;
  var $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  return HEAP32[($3 + 12 | 0) >> 2] | 0 | 0;
 }
 
 function std____2__allocator_std____2____shared_ptr_emplace_StderrFile_2c_20std____2__allocator_StderrFile__20__20___allocator_StderrFile__28std____2__allocator_StderrFile__20const__29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0;
  $4 = __stack_pointer - 16 | 0;
  HEAP32[($4 + 12 | 0) >> 2] = $0;
  HEAP32[($4 + 8 | 0) >> 2] = $1;
  return HEAP32[($4 + 12 | 0) >> 2] | 0 | 0;
 }
 
 function std____2__allocator_traits_std____2__allocator_std____2____shared_ptr_emplace_StderrFile_2c_20std____2__allocator_StderrFile__20__20__20___allocate_28std____2__allocator_std____2____shared_ptr_emplace_StderrFile_2c_20std____2__allocator_StderrFile__20__20___2c_20unsigned_20long_29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0, $7 = 0;
  $4 = __stack_pointer - 16 | 0;
  __stack_pointer = $4;
  HEAP32[($4 + 12 | 0) >> 2] = $0;
  HEAP32[($4 + 8 | 0) >> 2] = $1;
  $7 = std____2__allocator_std____2____shared_ptr_emplace_StderrFile_2c_20std____2__allocator_StderrFile__20__20___allocate_28unsigned_20long_29(HEAP32[($4 + 12 | 0) >> 2] | 0 | 0, HEAP32[($4 + 8 | 0) >> 2] | 0 | 0) | 0;
  __stack_pointer = $4 + 16 | 0;
  return $7 | 0;
 }
 
 function std____2____shared_ptr_emplace_StderrFile_2c_20std____2__allocator_StderrFile__20____Storage___Storage_28std____2__allocator_StderrFile____29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0, $5 = 0;
  $4 = __stack_pointer - 16 | 0;
  __stack_pointer = $4;
  HEAP32[($4 + 12 | 0) >> 2] = $0;
  HEAP32[($4 + 8 | 0) >> 2] = $1;
  $5 = HEAP32[($4 + 12 | 0) >> 2] | 0;
  std____2____shared_ptr_emplace_StderrFile_2c_20std____2__allocator_StderrFile__20____Storage____get_alloc_28_29($5 | 0) | 0;
  std____2__remove_reference_std____2__allocator_StderrFile_____type___20std____2__move_std____2__allocator_StderrFile____28std____2__allocator_StderrFile___29(HEAP32[($4 + 8 | 0) >> 2] | 0 | 0) | 0;
  __stack_pointer = $4 + 16 | 0;
  return $5 | 0;
 }
 
 function StderrFile__StderrFile_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $4 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 12 | 0) >> 2] | 0;
  File__File_28_29($4 | 0) | 0;
  HEAP32[$4 >> 2] = 1580 + 8 | 0;
  __stack_pointer = $3 + 16 | 0;
  return $4 | 0;
 }
 
 function std____2__shared_ptr_StderrFile___shared_ptr_28_29($0) {
  $0 = $0 | 0;
  var $4 = 0, $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 12 | 0) >> 2] | 0;
  HEAP32[$4 >> 2] = 0;
  HEAP32[($4 + 4 | 0) >> 2] = 0;
  return $4 | 0;
 }
 
 function std____2__shared_ptr_StderrFile_____enable_weak_this_28____29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  HEAP32[((__stack_pointer - 16 | 0) + 12 | 0) >> 2] = $0;
  return;
 }
 
 function std____2____shared_ptr_emplace_StderrFile_2c_20std____2__allocator_StderrFile__20____Storage____get_elem_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $8 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  HEAP32[($3 + 8 | 0) >> 2] = HEAP32[($3 + 12 | 0) >> 2] | 0;
  HEAP32[($3 + 4 | 0) >> 2] = std____2____compressed_pair_std____2__allocator_StderrFile__2c_20StderrFile_____get_second_base_28std____2____compressed_pair_std____2__allocator_StderrFile__2c_20StderrFile___29(HEAP32[($3 + 8 | 0) >> 2] | 0 | 0) | 0;
  HEAP32[$3 >> 2] = HEAP32[($3 + 4 | 0) >> 2] | 0;
  $8 = HEAP32[$3 >> 2] | 0;
  __stack_pointer = $3 + 16 | 0;
  return $8 | 0;
 }
 
 function std____2__allocator_traits_std____2__allocator_std____2____shared_ptr_emplace_StderrFile_2c_20std____2__allocator_StderrFile__20__20__20___deallocate_28std____2__allocator_std____2____shared_ptr_emplace_StderrFile_2c_20std____2__allocator_StderrFile__20__20___2c_20std____2____shared_ptr_emplace_StderrFile_2c_20std____2__allocator_StderrFile__20___2c_20unsigned_20long_29($0, $1, $2) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  var $5 = 0;
  $5 = __stack_pointer - 16 | 0;
  __stack_pointer = $5;
  HEAP32[($5 + 12 | 0) >> 2] = $0;
  HEAP32[($5 + 8 | 0) >> 2] = $1;
  HEAP32[($5 + 4 | 0) >> 2] = $2;
  std____2__allocator_std____2____shared_ptr_emplace_StderrFile_2c_20std____2__allocator_StderrFile__20__20___deallocate_28std____2____shared_ptr_emplace_StderrFile_2c_20std____2__allocator_StderrFile__20___2c_20unsigned_20long_29(HEAP32[($5 + 12 | 0) >> 2] | 0 | 0, HEAP32[($5 + 8 | 0) >> 2] | 0 | 0, HEAP32[($5 + 4 | 0) >> 2] | 0 | 0);
  __stack_pointer = $5 + 16 | 0;
  return;
 }
 
 function std____2__allocator_std____2____shared_ptr_emplace_StderrFile_2c_20std____2__allocator_StderrFile__20__20___allocate_28unsigned_20long_29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0, $18 = 0;
  $4 = __stack_pointer - 16 | 0;
  __stack_pointer = $4;
  HEAP32[($4 + 12 | 0) >> 2] = $0;
  HEAP32[($4 + 8 | 0) >> 2] = $1;
  label$1 : {
   if (!((HEAP32[($4 + 8 | 0) >> 2] | 0) >>> 0 > (unsigned_20long_20std____2__allocator_traits_std____2__allocator_std____2____shared_ptr_emplace_StderrFile_2c_20std____2__allocator_StderrFile__20__20__20___max_size_std____2__allocator_std____2____shared_ptr_emplace_StderrFile_2c_20std____2__allocator_StderrFile__20__20__2c_20void__28std____2__allocator_std____2____shared_ptr_emplace_StderrFile_2c_20std____2__allocator_StderrFile__20__20__20const__29(HEAP32[($4 + 12 | 0) >> 2] | 0 | 0) | 0) >>> 0 & 1 | 0)) {
    break label$1
   }
   std____2____throw_length_error_28char_20const__29(1154 | 0);
   abort();
  }
  $18 = std____2____libcpp_allocate_28unsigned_20long_2c_20unsigned_20long_29(Math_imul(HEAP32[($4 + 8 | 0) >> 2] | 0, 44) | 0, 4 | 0) | 0;
  __stack_pointer = $4 + 16 | 0;
  return $18 | 0;
 }
 
 function unsigned_20long_20std____2__allocator_traits_std____2__allocator_std____2____shared_ptr_emplace_StderrFile_2c_20std____2__allocator_StderrFile__20__20__20___max_size_std____2__allocator_std____2____shared_ptr_emplace_StderrFile_2c_20std____2__allocator_StderrFile__20__20__2c_20void__28std____2__allocator_std____2____shared_ptr_emplace_StderrFile_2c_20std____2__allocator_StderrFile__20__20__20const__29($0) {
  $0 = $0 | 0;
  var $3 = 0, $5 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $5 = std____2__allocator_std____2____shared_ptr_emplace_StderrFile_2c_20std____2__allocator_StderrFile__20__20___max_size_28_29_20const(HEAP32[($3 + 12 | 0) >> 2] | 0 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $5 | 0;
 }
 
 function std____2__allocator_std____2____shared_ptr_emplace_StderrFile_2c_20std____2__allocator_StderrFile__20__20___max_size_28_29_20const($0) {
  $0 = $0 | 0;
  HEAP32[((__stack_pointer - 16 | 0) + 12 | 0) >> 2] = $0;
  return 97612893 | 0;
 }
 
 function std____2____shared_ptr_emplace_StderrFile_2c_20std____2__allocator_StderrFile__20____Storage____get_alloc_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $8 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  HEAP32[($3 + 8 | 0) >> 2] = HEAP32[($3 + 12 | 0) >> 2] | 0;
  HEAP32[($3 + 4 | 0) >> 2] = std____2____compressed_pair_std____2__allocator_StderrFile__2c_20StderrFile_____get_first_base_28std____2____compressed_pair_std____2__allocator_StderrFile__2c_20StderrFile___29(HEAP32[($3 + 8 | 0) >> 2] | 0 | 0) | 0;
  HEAP32[$3 >> 2] = HEAP32[($3 + 4 | 0) >> 2] | 0;
  $8 = HEAP32[$3 >> 2] | 0;
  __stack_pointer = $3 + 16 | 0;
  return $8 | 0;
 }
 
 function std____2____shared_ptr_emplace_StderrFile_2c_20std____2__allocator_StderrFile__20______shared_ptr_emplace_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $4 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 12 | 0) >> 2] | 0;
  HEAP32[$4 >> 2] = 1976 + 8 | 0;
  std____2____shared_ptr_emplace_StderrFile_2c_20std____2__allocator_StderrFile__20____Storage____Storage_28_29($4 + 12 | 0 | 0) | 0;
  std____2____shared_count_____shared_count_28_29($4 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $4 | 0;
 }
 
 function std____2____shared_ptr_emplace_StderrFile_2c_20std____2__allocator_StderrFile__20____Storage____Storage_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $4 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 12 | 0) >> 2] | 0;
  std____2____shared_ptr_emplace_StderrFile_2c_20std____2__allocator_StderrFile__20____Storage____get_alloc_28_29($4 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $4 | 0;
 }
 
 function std____2____shared_ptr_emplace_StderrFile_2c_20std____2__allocator_StderrFile__20______shared_ptr_emplace_28_29_1($0) {
  $0 = $0 | 0;
  var $3 = 0, $4 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 12 | 0) >> 2] | 0;
  std____2____shared_ptr_emplace_StderrFile_2c_20std____2__allocator_StderrFile__20______shared_ptr_emplace_28_29($4 | 0) | 0;
  operator_20delete_28void__29($4 | 0);
  __stack_pointer = $3 + 16 | 0;
  return;
 }
 
 function std____2____shared_ptr_emplace_StderrFile_2c_20std____2__allocator_StderrFile__20_____on_zero_shared_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $5 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $5 = std____2____shared_ptr_emplace_StderrFile_2c_20std____2__allocator_StderrFile__20_____get_elem_28_29(HEAP32[($3 + 12 | 0) >> 2] | 0 | 0) | 0;
  FUNCTION_TABLE[HEAP32[((HEAP32[$5 >> 2] | 0) + 8 | 0) >> 2] | 0 | 0]($5) | 0;
  __stack_pointer = $3 + 16 | 0;
  return;
 }
 
 function std____2____shared_ptr_emplace_StderrFile_2c_20std____2__allocator_StderrFile__20_____on_zero_shared_weak_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $4 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 12 | 0) >> 2] | 0;
  std____2__allocator_std____2____shared_ptr_emplace_StderrFile_2c_20std____2__allocator_StderrFile__20__20___allocator_StderrFile__28std____2__allocator_StderrFile__20const__29($3 + 8 | 0 | 0, std____2____shared_ptr_emplace_StderrFile_2c_20std____2__allocator_StderrFile__20_____get_alloc_28_29($4 | 0) | 0 | 0) | 0;
  std____2____shared_ptr_emplace_StderrFile_2c_20std____2__allocator_StderrFile__20____Storage____Storage_28_29($4 + 12 | 0 | 0) | 0;
  std____2__allocator_traits_std____2__allocator_std____2____shared_ptr_emplace_StderrFile_2c_20std____2__allocator_StderrFile__20__20__20___deallocate_28std____2__allocator_std____2____shared_ptr_emplace_StderrFile_2c_20std____2__allocator_StderrFile__20__20___2c_20std____2____shared_ptr_emplace_StderrFile_2c_20std____2__allocator_StderrFile__20___2c_20unsigned_20long_29($3 + 8 | 0 | 0, std____2__pointer_traits_std____2____shared_ptr_emplace_StderrFile_2c_20std____2__allocator_StderrFile__20_____pointer_to_28std____2____shared_ptr_emplace_StderrFile_2c_20std____2__allocator_StderrFile__20___29($4 | 0) | 0 | 0, 1 | 0);
  __stack_pointer = $3 + 16 | 0;
  return;
 }
 
 function std____2____shared_ptr_emplace_StderrFile_2c_20std____2__allocator_StderrFile__20_____get_alloc_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $7 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $7 = std____2____shared_ptr_emplace_StderrFile_2c_20std____2__allocator_StderrFile__20____Storage____get_alloc_28_29((HEAP32[($3 + 12 | 0) >> 2] | 0) + 12 | 0 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $7 | 0;
 }
 
 function std____2__pointer_traits_std____2____shared_ptr_emplace_StderrFile_2c_20std____2__allocator_StderrFile__20_____pointer_to_28std____2____shared_ptr_emplace_StderrFile_2c_20std____2__allocator_StderrFile__20___29($0) {
  $0 = $0 | 0;
  var $3 = 0, $5 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $5 = std____2____shared_ptr_emplace_StderrFile_2c_20std____2__allocator_StderrFile__20___20std____2__addressof_std____2____shared_ptr_emplace_StderrFile_2c_20std____2__allocator_StderrFile__20__20__28std____2____shared_ptr_emplace_StderrFile_2c_20std____2__allocator_StderrFile__20___29(HEAP32[($3 + 12 | 0) >> 2] | 0 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $5 | 0;
 }
 
 function std____2____compressed_pair_std____2__allocator_StderrFile__2c_20StderrFile_____get_first_base_28std____2____compressed_pair_std____2__allocator_StderrFile__2c_20StderrFile___29($0) {
  $0 = $0 | 0;
  var $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  return HEAP32[($3 + 12 | 0) >> 2] | 0 | 0;
 }
 
 function std____2__allocator_std____2____shared_ptr_emplace_StderrFile_2c_20std____2__allocator_StderrFile__20__20___deallocate_28std____2____shared_ptr_emplace_StderrFile_2c_20std____2__allocator_StderrFile__20___2c_20unsigned_20long_29($0, $1, $2) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  var $5 = 0;
  $5 = __stack_pointer - 16 | 0;
  __stack_pointer = $5;
  HEAP32[($5 + 12 | 0) >> 2] = $0;
  HEAP32[($5 + 8 | 0) >> 2] = $1;
  HEAP32[($5 + 4 | 0) >> 2] = $2;
  std____2____libcpp_deallocate_28void__2c_20unsigned_20long_2c_20unsigned_20long_29(HEAP32[($5 + 8 | 0) >> 2] | 0 | 0, Math_imul(HEAP32[($5 + 4 | 0) >> 2] | 0, 44) | 0, 4 | 0);
  __stack_pointer = $5 + 16 | 0;
  return;
 }
 
 function std____2____compressed_pair_std____2__allocator_StderrFile__2c_20StderrFile_____get_second_base_28std____2____compressed_pair_std____2__allocator_StderrFile__2c_20StderrFile___29($0) {
  $0 = $0 | 0;
  var $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  return HEAP32[($3 + 12 | 0) >> 2] | 0 | 0;
 }
 
 function std____2__unique_lock_std____2__mutex___unique_lock_28std____2__mutex__2c_20std____2__defer_lock_t_29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0, $5 = 0;
  $4 = __stack_pointer - 16 | 0;
  __stack_pointer = $4;
  HEAP32[($4 + 4 | 0) >> 2] = $0;
  HEAP32[$4 >> 2] = $1;
  $5 = HEAP32[($4 + 4 | 0) >> 2] | 0;
  HEAP32[$5 >> 2] = std____2__mutex__20std____2__addressof_std____2__mutex__28std____2__mutex__29(HEAP32[$4 >> 2] | 0 | 0) | 0;
  HEAP8[($5 + 4 | 0) >> 0] = 0;
  __stack_pointer = $4 + 16 | 0;
  return $5 | 0;
 }
 
 function std____2__unique_lock_std____2__mutex___lock_28_29($0) {
  $0 = $0 | 0;
  var $3 = 0, $4 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  $4 = HEAP32[($3 + 12 | 0) >> 2] | 0;
  label$1 : {
   if (!((HEAP32[$4 >> 2] | 0 | 0) == (0 | 0) & 1 | 0)) {
    break label$1
   }
   std____2____throw_system_error_28int_2c_20char_20const__29(63 | 0, 1024 | 0);
   abort();
  }
  label$2 : {
   if (!((HEAPU8[($4 + 4 | 0) >> 0] | 0) & 1 | 0)) {
    break label$2
   }
   std____2____throw_system_error_28int_2c_20char_20const__29(16 | 0, 1240 | 0);
   abort();
  }
  std____2__mutex__lock_28_29(HEAP32[$4 >> 2] | 0 | 0);
  HEAP8[($4 + 4 | 0) >> 0] = 1;
  __stack_pointer = $3 + 16 | 0;
  return;
 }
 
 function std____2__mutex__20std____2__addressof_std____2__mutex__28std____2__mutex__29($0) {
  $0 = $0 | 0;
  var $3 = 0;
  $3 = __stack_pointer - 16 | 0;
  HEAP32[($3 + 12 | 0) >> 2] = $0;
  return HEAP32[($3 + 12 | 0) >> 2] | 0 | 0;
 }
 
 function _GLOBAL__sub_I_file_table_cpp() {
  __cxx_global_var_init_2();
  return;
 }
 
 function __errno_location() {
  return 2784 | 0;
 }
 
 function __syscall_ret($0) {
  $0 = $0 | 0;
  label$1 : {
   if ($0 >>> 0 < -4095 >>> 0) {
    break label$1
   }
   HEAP32[(__errno_location() | 0) >> 2] = 0 - $0 | 0;
   $0 = -1;
  }
  return $0 | 0;
 }
 
 function open($0, $1, $2) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  var $3 = 0, $4 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  label$1 : {
   label$2 : {
    if ($1 & 64 | 0) {
     break label$2
    }
    $4 = 0;
    if (($1 & 4259840 | 0 | 0) != (4259840 | 0)) {
     break label$1
    }
   }
   HEAP32[($3 + 12 | 0) >> 2] = $2 + 4 | 0;
   $4 = HEAP32[$2 >> 2] | 0;
  }
  HEAP32[$3 >> 2] = $4;
  $1 = __syscall_ret(__syscall_open($0 | 0, $1 | 32768 | 0 | 0, $3 | 0) | 0 | 0) | 0;
  __stack_pointer = $3 + 16 | 0;
  return $1 | 0;
 }
 
 function __pthread_mutex_lock($0) {
  $0 = $0 | 0;
  return 0 | 0;
 }
 
 function __pthread_mutex_unlock($0) {
  $0 = $0 | 0;
  return 0 | 0;
 }
 
 function pthread_mutex_destroy($0) {
  $0 = $0 | 0;
  return 0 | 0;
 }
 
 function std____2____shared_count_____shared_count_28_29($0) {
  $0 = $0 | 0;
  return $0 | 0;
 }
 
 function std____2____shared_count_____shared_count_28_29_1($0) {
  $0 = $0 | 0;
  abort();
 }
 
 function std____2____shared_weak_count_____shared_weak_count_28_29($0) {
  $0 = $0 | 0;
  abort();
 }
 
 function std____2____shared_weak_count____release_weak_28_29($0) {
  $0 = $0 | 0;
  var $1 = 0;
  label$1 : {
   label$2 : {
    $1 = $0 + 8 | 0;
    if (!(long_20std____2___28anonymous_20namespace_29____libcpp_atomic_load_long__28long_20const__2c_20int_29($1 | 0, 2 | 0) | 0)) {
     break label$2
    }
    if ((long_20std____2____libcpp_atomic_refcount_decrement_long__28long__29($1 | 0) | 0 | 0) != (-1 | 0)) {
     break label$1
    }
   }
   FUNCTION_TABLE[HEAP32[((HEAP32[$0 >> 2] | 0) + 16 | 0) >> 2] | 0 | 0]($0);
  }
 }
 
 function long_20std____2___28anonymous_20namespace_29____libcpp_atomic_load_long__28long_20const__2c_20int_29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  return HEAP32[$0 >> 2] | 0 | 0;
 }
 
 function std____2____shared_weak_count____get_deleter_28std__type_info_20const__29_20const($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  return 0 | 0;
 }
 
 function std____2____libcpp_mutex_lock_28pthread_mutex_t__29($0) {
  $0 = $0 | 0;
  return __pthread_mutex_lock($0 | 0) | 0 | 0;
 }
 
 function std____2____libcpp_mutex_unlock_28pthread_mutex_t__29($0) {
  $0 = $0 | 0;
  return __pthread_mutex_unlock($0 | 0) | 0 | 0;
 }
 
 function std____2__mutex__lock_28_29($0) {
  $0 = $0 | 0;
  label$1 : {
   $0 = std____2____libcpp_mutex_lock_28pthread_mutex_t__29($0 | 0) | 0;
   if (!$0) {
    break label$1
   }
   std____2____throw_system_error_28int_2c_20char_20const__29($0 | 0, 1222 | 0);
   abort();
  }
 }
 
 function std____2__mutex__unlock_28_29($0) {
  $0 = $0 | 0;
  std____2____libcpp_mutex_unlock_28pthread_mutex_t__29($0 | 0) | 0;
 }
 
 function std__exception__exception_28_29($0) {
  $0 = $0 | 0;
  HEAP32[$0 >> 2] = 2220 + 8 | 0;
  return $0 | 0;
 }
 
 function std____2____libcpp_refstring____libcpp_refstring_28char_20const__29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $2 = 0, $3 = 0;
  $2 = strlen($1 | 0) | 0;
  $3 = operator_20new_28unsigned_20long_29($2 + 13 | 0 | 0) | 0;
  HEAP32[($3 + 8 | 0) >> 2] = 0;
  HEAP32[($3 + 4 | 0) >> 2] = $2;
  HEAP32[$3 >> 2] = $2;
  HEAP32[$0 >> 2] = __memcpy(std____2____refstring_imp___28anonymous_20namespace_29__data_from_rep_28std____2____refstring_imp___28anonymous_20namespace_29___Rep_base__29($3 | 0) | 0 | 0, $1 | 0, $2 + 1 | 0 | 0) | 0;
  return $0 | 0;
 }
 
 function std____2____refstring_imp___28anonymous_20namespace_29__data_from_rep_28std____2____refstring_imp___28anonymous_20namespace_29___Rep_base__29($0) {
  $0 = $0 | 0;
  return $0 + 12 | 0 | 0;
 }
 
 function std__logic_error__logic_error_28char_20const__29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  std__exception__exception_28_29($0 | 0) | 0;
  HEAP32[$0 >> 2] = 2264 + 8 | 0;
  std____2____libcpp_refstring____libcpp_refstring_28char_20const__29($0 + 4 | 0 | 0, $1 | 0) | 0;
  return $0 | 0;
 }
 
 function std____2____libcpp_refstring____uses_refcount_28_29_20const($0) {
  $0 = $0 | 0;
  return 1 | 0;
 }
 
 function std____2__mutex___mutex_28_29($0) {
  $0 = $0 | 0;
  std____2____libcpp_mutex_destroy_28pthread_mutex_t__29($0 | 0) | 0;
  return $0 | 0;
 }
 
 function std____2____libcpp_mutex_destroy_28pthread_mutex_t__29($0) {
  $0 = $0 | 0;
  return pthread_mutex_destroy($0 | 0) | 0 | 0;
 }
 
 function std____2____basic_string_common_true_____throw_length_error_28_29_20const($0) {
  $0 = $0 | 0;
  std____2____throw_length_error_28char_20const__29(1141 | 0);
  abort();
 }
 
 function std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___capacity_28_29_20const($0) {
  $0 = $0 | 0;
  var $1 = 0;
  $1 = 10;
  label$1 : {
   if (!(std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____is_long_28_29_20const($0 | 0) | 0)) {
    break label$1
   }
   $1 = (std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____get_long_cap_28_29_20const($0 | 0) | 0) + -1 | 0;
  }
  return $1 | 0;
 }
 
 function std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____grow_by_and_replace_28unsigned_20long_2c_20unsigned_20long_2c_20unsigned_20long_2c_20unsigned_20long_2c_20unsigned_20long_2c_20unsigned_20long_2c_20char_20const__29($0, $1, $2, $3, $4, $5, $6, $7) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  $3 = $3 | 0;
  $4 = $4 | 0;
  $5 = $5 | 0;
  $6 = $6 | 0;
  $7 = $7 | 0;
  var $8 = 0, $9 = 0, $10 = 0, $11 = 0, $47 = 0;
  $8 = __stack_pointer - 16 | 0;
  __stack_pointer = $8;
  label$1 : {
   $9 = std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___max_size_28_29_20const($0 | 0) | 0;
   if (($9 + ($1 ^ -1 | 0) | 0) >>> 0 < $2 >>> 0) {
    break label$1
   }
   $10 = std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____get_pointer_28_29($0 | 0) | 0;
   label$2 : {
    label$3 : {
     if ((($9 >>> 1 | 0) + -16 | 0) >>> 0 <= $1 >>> 0) {
      break label$3
     }
     HEAP32[($8 + 8 | 0) >> 2] = $1 << 1 | 0;
     HEAP32[($8 + 12 | 0) >> 2] = $2 + $1 | 0;
     $2 = std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____recommend_28unsigned_20long_29(HEAP32[(unsigned_20long_20const__20std____2__max_unsigned_20long__28unsigned_20long_20const__2c_20unsigned_20long_20const__29($8 + 12 | 0 | 0, $8 + 8 | 0 | 0) | 0) >> 2] | 0 | 0) | 0;
     break label$2;
    }
    $2 = $9 + -1 | 0;
   }
   $47 = std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____alloc_28_29($0 | 0) | 0;
   $11 = $2 + 1 | 0;
   $2 = std____2__allocator_traits_std____2__allocator_char__20___allocate_28std____2__allocator_char___2c_20unsigned_20long_29($47 | 0, $11 | 0) | 0;
   std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____invalidate_all_iterators_28_29($0 | 0);
   label$4 : {
    if (!$4) {
     break label$4
    }
    std____2__char_traits_char___copy_28char__2c_20char_20const__2c_20unsigned_20long_29(char__20std____2____to_address_char__28char__29($2 | 0) | 0 | 0, char__20std____2____to_address_char__28char__29($10 | 0) | 0 | 0, $4 | 0) | 0;
   }
   label$5 : {
    if (!$6) {
     break label$5
    }
    std____2__char_traits_char___copy_28char__2c_20char_20const__2c_20unsigned_20long_29((char__20std____2____to_address_char__28char__29($2 | 0) | 0) + $4 | 0 | 0, $7 | 0, $6 | 0) | 0;
   }
   label$6 : {
    $9 = $3 - ($4 + $5 | 0) | 0;
    if (!$9) {
     break label$6
    }
    std____2__char_traits_char___copy_28char__2c_20char_20const__2c_20unsigned_20long_29(((char__20std____2____to_address_char__28char__29($2 | 0) | 0) + $4 | 0) + $6 | 0 | 0, ((char__20std____2____to_address_char__28char__29($10 | 0) | 0) + $4 | 0) + $5 | 0 | 0, $9 | 0) | 0;
   }
   label$7 : {
    $1 = $1 + 1 | 0;
    if (($1 | 0) == (11 | 0)) {
     break label$7
    }
    std____2__allocator_traits_std____2__allocator_char__20___deallocate_28std____2__allocator_char___2c_20char__2c_20unsigned_20long_29(std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____alloc_28_29($0 | 0) | 0 | 0, $10 | 0, $1 | 0);
   }
   std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____set_long_pointer_28char__29($0 | 0, $2 | 0);
   std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____set_long_cap_28unsigned_20long_29($0 | 0, $11 | 0);
   $4 = ($6 + $4 | 0) + $9 | 0;
   std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____set_long_size_28unsigned_20long_29($0 | 0, $4 | 0);
   HEAP8[($8 + 7 | 0) >> 0] = 0;
   std____2__char_traits_char___assign_28char__2c_20char_20const__29($2 + $4 | 0 | 0, $8 + 7 | 0 | 0);
   __stack_pointer = $8 + 16 | 0;
   return;
  }
  std____2____basic_string_common_true_____throw_length_error_28_29_20const($0 | 0);
  abort();
 }
 
 function std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____set_size_28unsigned_20long_29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  label$1 : {
   if (!(std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____is_long_28_29_20const($0 | 0) | 0)) {
    break label$1
   }
   std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____set_long_size_28unsigned_20long_29($0 | 0, $1 | 0);
   return;
  }
  std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____set_short_size_28unsigned_20long_29($0 | 0, $1 | 0);
 }
 
 function std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____invalidate_iterators_past_28unsigned_20long_29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
 }
 
 function std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____get_long_cap_28_29_20const($0) {
  $0 = $0 | 0;
  return (HEAP32[((std____2____compressed_pair_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____rep_2c_20std____2__allocator_char__20___first_28_29_20const($0 | 0) | 0) + 8 | 0) >> 2] | 0) & 2147483647 | 0 | 0;
 }
 
 function std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___max_size_28_29_20const($0) {
  $0 = $0 | 0;
  return (unsigned_20long_20std____2__allocator_traits_std____2__allocator_char__20___max_size_std____2__allocator_char__2c_20void__28std____2__allocator_char__20const__29(std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____alloc_28_29_20const($0 | 0) | 0 | 0) | 0) + -16 | 0 | 0;
 }
 
 function std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____recommend_28unsigned_20long_29($0) {
  $0 = $0 | 0;
  var $1 = 0, $7 = 0;
  $1 = 10;
  label$1 : {
   if ($0 >>> 0 < 11 >>> 0) {
    break label$1
   }
   $0 = unsigned_20long_20std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____align_it_16ul__28unsigned_20long_29($0 + 1 | 0 | 0) | 0;
   $7 = $0;
   $0 = $0 + -1 | 0;
   $1 = ($0 | 0) == (11 | 0) ? $7 : $0;
  }
  return $1 | 0;
 }
 
 function std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____alloc_28_29($0) {
  $0 = $0 | 0;
  return std____2____compressed_pair_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____rep_2c_20std____2__allocator_char__20___second_28_29($0 | 0) | 0 | 0;
 }
 
 function std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____invalidate_all_iterators_28_29($0) {
  $0 = $0 | 0;
 }
 
 function std____2__char_traits_char___copy_28char__2c_20char_20const__2c_20unsigned_20long_29($0, $1, $2) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  label$1 : {
   if (!$2) {
    break label$1
   }
   __memcpy($0 | 0, $1 | 0, $2 | 0) | 0;
  }
  return $0 | 0;
 }
 
 function std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____set_long_pointer_28char__29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  HEAP32[(std____2____compressed_pair_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____rep_2c_20std____2__allocator_char__20___first_28_29($0 | 0) | 0) >> 2] = $1;
 }
 
 function std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____set_long_cap_28unsigned_20long_29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  HEAP32[((std____2____compressed_pair_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____rep_2c_20std____2__allocator_char__20___first_28_29($0 | 0) | 0) + 8 | 0) >> 2] = $1 | -2147483648 | 0;
 }
 
 function unsigned_20long_20std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____align_it_16ul__28unsigned_20long_29($0) {
  $0 = $0 | 0;
  return ($0 + 15 | 0) & -16 | 0 | 0;
 }
 
 function std____2____compressed_pair_std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____rep_2c_20std____2__allocator_char__20___second_28_29($0) {
  $0 = $0 | 0;
  return std____2____compressed_pair_elem_std____2__allocator_char__2c_201_2c_20true_____get_28_29($0 | 0) | 0 | 0;
 }
 
 function std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20____basic_string_28_29($0) {
  $0 = $0 | 0;
  label$1 : {
   if (!(std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____is_long_28_29_20const($0 | 0) | 0)) {
    break label$1
   }
   std____2__allocator_traits_std____2__allocator_char__20___deallocate_28std____2__allocator_char___2c_20char__2c_20unsigned_20long_29(std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____alloc_28_29($0 | 0) | 0 | 0, std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____get_long_pointer_28_29($0 | 0) | 0 | 0, std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____get_long_cap_28_29_20const($0 | 0) | 0 | 0);
  }
  return $0 | 0;
 }
 
 function std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____grow_by_28unsigned_20long_2c_20unsigned_20long_2c_20unsigned_20long_2c_20unsigned_20long_2c_20unsigned_20long_2c_20unsigned_20long_29($0, $1, $2, $3, $4, $5, $6) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  $3 = $3 | 0;
  $4 = $4 | 0;
  $5 = $5 | 0;
  $6 = $6 | 0;
  var $7 = 0, $8 = 0, $9 = 0, $44 = 0;
  $7 = __stack_pointer - 16 | 0;
  __stack_pointer = $7;
  label$1 : {
   $8 = std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___max_size_28_29_20const($0 | 0) | 0;
   if (($8 - $1 | 0) >>> 0 < $2 >>> 0) {
    break label$1
   }
   $9 = std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____get_pointer_28_29($0 | 0) | 0;
   label$2 : {
    label$3 : {
     if ((($8 >>> 1 | 0) + -16 | 0) >>> 0 <= $1 >>> 0) {
      break label$3
     }
     HEAP32[($7 + 8 | 0) >> 2] = $1 << 1 | 0;
     HEAP32[($7 + 12 | 0) >> 2] = $2 + $1 | 0;
     $2 = std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____recommend_28unsigned_20long_29(HEAP32[(unsigned_20long_20const__20std____2__max_unsigned_20long__28unsigned_20long_20const__2c_20unsigned_20long_20const__29($7 + 12 | 0 | 0, $7 + 8 | 0 | 0) | 0) >> 2] | 0 | 0) | 0;
     break label$2;
    }
    $2 = $8 + -1 | 0;
   }
   $44 = std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____alloc_28_29($0 | 0) | 0;
   $8 = $2 + 1 | 0;
   $2 = std____2__allocator_traits_std____2__allocator_char__20___allocate_28std____2__allocator_char___2c_20unsigned_20long_29($44 | 0, $8 | 0) | 0;
   std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____invalidate_all_iterators_28_29($0 | 0);
   label$4 : {
    if (!$4) {
     break label$4
    }
    std____2__char_traits_char___copy_28char__2c_20char_20const__2c_20unsigned_20long_29(char__20std____2____to_address_char__28char__29($2 | 0) | 0 | 0, char__20std____2____to_address_char__28char__29($9 | 0) | 0 | 0, $4 | 0) | 0;
   }
   label$5 : {
    $3 = $3 - ($4 + $5 | 0) | 0;
    if (!$3) {
     break label$5
    }
    std____2__char_traits_char___copy_28char__2c_20char_20const__2c_20unsigned_20long_29(((char__20std____2____to_address_char__28char__29($2 | 0) | 0) + $4 | 0) + $6 | 0 | 0, ((char__20std____2____to_address_char__28char__29($9 | 0) | 0) + $4 | 0) + $5 | 0 | 0, $3 | 0) | 0;
   }
   label$6 : {
    $1 = $1 + 1 | 0;
    if (($1 | 0) == (11 | 0)) {
     break label$6
    }
    std____2__allocator_traits_std____2__allocator_char__20___deallocate_28std____2__allocator_char___2c_20char__2c_20unsigned_20long_29(std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____alloc_28_29($0 | 0) | 0 | 0, $9 | 0, $1 | 0);
   }
   std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____set_long_pointer_28char__29($0 | 0, $2 | 0);
   std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____set_long_cap_28unsigned_20long_29($0 | 0, $8 | 0);
   __stack_pointer = $7 + 16 | 0;
   return;
  }
  std____2____basic_string_common_true_____throw_length_error_28_29_20const($0 | 0);
  abort();
 }
 
 function std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____init_28char_20const__2c_20unsigned_20long_29($0, $1, $2) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  var $4 = 0, $3 = 0, $5 = 0, $23 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  label$1 : {
   if ((std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___max_size_28_29_20const($0 | 0) | 0) >>> 0 < $2 >>> 0) {
    break label$1
   }
   label$2 : {
    label$3 : {
     if ($2 >>> 0 > 10 >>> 0) {
      break label$3
     }
     std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____set_short_size_28unsigned_20long_29($0 | 0, $2 | 0);
     $4 = std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____get_short_pointer_28_29($0 | 0) | 0;
     break label$2;
    }
    $4 = std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____recommend_28unsigned_20long_29($2 | 0) | 0;
    $23 = std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____alloc_28_29($0 | 0) | 0;
    $5 = $4 + 1 | 0;
    $4 = std____2__allocator_traits_std____2__allocator_char__20___allocate_28std____2__allocator_char___2c_20unsigned_20long_29($23 | 0, $5 | 0) | 0;
    std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____set_long_pointer_28char__29($0 | 0, $4 | 0);
    std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____set_long_cap_28unsigned_20long_29($0 | 0, $5 | 0);
    std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____set_long_size_28unsigned_20long_29($0 | 0, $2 | 0);
   }
   std____2__char_traits_char___copy_28char__2c_20char_20const__2c_20unsigned_20long_29(char__20std____2____to_address_char__28char__29($4 | 0) | 0 | 0, $1 | 0, $2 | 0) | 0;
   HEAP8[($3 + 15 | 0) >> 0] = 0;
   std____2__char_traits_char___assign_28char__2c_20char_20const__29($4 + $2 | 0 | 0, $3 + 15 | 0 | 0);
   __stack_pointer = $3 + 16 | 0;
   return;
  }
  std____2____basic_string_common_true_____throw_length_error_28_29_20const($0 | 0);
  abort();
 }
 
 function std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____init_copy_ctor_external_28char_20const__2c_20unsigned_20long_29($0, $1, $2) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  var $3 = 0, $4 = 0, $19 = 0;
  label$1 : {
   label$2 : {
    label$3 : {
     if ($2 >>> 0 > 10 >>> 0) {
      break label$3
     }
     $3 = std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____get_short_pointer_28_29($0 | 0) | 0;
     std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____set_short_size_28unsigned_20long_29($0 | 0, $2 | 0);
     break label$2;
    }
    if ((std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___max_size_28_29_20const($0 | 0) | 0) >>> 0 < $2 >>> 0) {
     break label$1
    }
    $3 = std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____recommend_28unsigned_20long_29($2 | 0) | 0;
    $19 = std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____alloc_28_29($0 | 0) | 0;
    $4 = $3 + 1 | 0;
    $3 = std____2__allocator_traits_std____2__allocator_char__20___allocate_28std____2__allocator_char___2c_20unsigned_20long_29($19 | 0, $4 | 0) | 0;
    std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____set_long_pointer_28char__29($0 | 0, $3 | 0);
    std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____set_long_cap_28unsigned_20long_29($0 | 0, $4 | 0);
    std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____set_long_size_28unsigned_20long_29($0 | 0, $2 | 0);
   }
   std____2__char_traits_char___copy_28char__2c_20char_20const__2c_20unsigned_20long_29(char__20std____2____to_address_char__28char__29($3 | 0) | 0 | 0, $1 | 0, $2 + 1 | 0 | 0) | 0;
   return;
  }
  std____2____basic_string_common_true_____throw_length_error_28_29_20const($0 | 0);
  abort();
 }
 
 function std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____assign_external_28char_20const__2c_20unsigned_20long_29($0, $1, $2) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  var $4 = 0, $3 = 0, $5 = 0, $35 = 0;
  $3 = __stack_pointer - 16 | 0;
  __stack_pointer = $3;
  label$1 : {
   label$2 : {
    $4 = std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___capacity_28_29_20const($0 | 0) | 0;
    if ($4 >>> 0 < $2 >>> 0) {
     break label$2
    }
    $4 = char__20std____2____to_address_char__28char__29(std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____get_pointer_28_29($0 | 0) | 0 | 0) | 0;
    std____2__char_traits_char___move_28char__2c_20char_20const__2c_20unsigned_20long_29($4 | 0, $1 | 0, $2 | 0) | 0;
    HEAP8[($3 + 15 | 0) >> 0] = 0;
    std____2__char_traits_char___assign_28char__2c_20char_20const__29($4 + $2 | 0 | 0, $3 + 15 | 0 | 0);
    std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____set_size_28unsigned_20long_29($0 | 0, $2 | 0);
    std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____invalidate_iterators_past_28unsigned_20long_29($0 | 0, $2 | 0);
    break label$1;
   }
   $35 = $2 - $4 | 0;
   $5 = std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___size_28_29_20const($0 | 0) | 0;
   std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____grow_by_and_replace_28unsigned_20long_2c_20unsigned_20long_2c_20unsigned_20long_2c_20unsigned_20long_2c_20unsigned_20long_2c_20unsigned_20long_2c_20char_20const__29($0 | 0, $4 | 0, $35 | 0, $5 | 0, 0 | 0, $5 | 0, $2 | 0, $1 | 0);
  }
  __stack_pointer = $3 + 16 | 0;
  return $0 | 0;
 }
 
 function std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____assign_external_28char_20const__29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  return std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____assign_external_28char_20const__2c_20unsigned_20long_29($0 | 0, $1 | 0, std____2__char_traits_char___length_28char_20const__29($1 | 0) | 0 | 0) | 0 | 0;
 }
 
 function std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20___push_back_28char_29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $4 = 0, $2 = 0, $3 = 0;
  $2 = __stack_pointer - 16 | 0;
  __stack_pointer = $2;
  HEAP8[($2 + 15 | 0) >> 0] = $1;
  label$1 : {
   label$2 : {
    label$3 : {
     label$4 : {
      label$5 : {
       if (!(std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____is_long_28_29_20const($0 | 0) | 0)) {
        break label$5
       }
       $1 = std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____get_long_cap_28_29_20const($0 | 0) | 0;
       $3 = std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____get_long_size_28_29_20const($0 | 0) | 0;
       $4 = $1 + -1 | 0;
       if (($3 | 0) == ($4 | 0)) {
        break label$4
       }
       break label$2;
      }
      $3 = 10;
      $4 = 10;
      $1 = std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____get_short_size_28_29_20const($0 | 0) | 0;
      if (($1 | 0) != (10 | 0)) {
       break label$3
      }
     }
     std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____grow_by_28unsigned_20long_2c_20unsigned_20long_2c_20unsigned_20long_2c_20unsigned_20long_2c_20unsigned_20long_2c_20unsigned_20long_29($0 | 0, $4 | 0, 1 | 0, $4 | 0, $4 | 0, 0 | 0, 0 | 0);
     $1 = $3;
     if (std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____is_long_28_29_20const($0 | 0) | 0) {
      break label$2
     }
    }
    $4 = std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____get_short_pointer_28_29($0 | 0) | 0;
    std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____set_short_size_28unsigned_20long_29($0 | 0, $1 + 1 | 0 | 0);
    break label$1;
   }
   $4 = std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____get_long_pointer_28_29($0 | 0) | 0;
   std____2__basic_string_char_2c_20std____2__char_traits_char__2c_20std____2__allocator_char__20_____set_long_size_28unsigned_20long_29($0 | 0, $3 + 1 | 0 | 0);
   $1 = $3;
  }
  $0 = $4 + $1 | 0;
  std____2__char_traits_char___assign_28char__2c_20char_20const__29($0 | 0, $2 + 15 | 0 | 0);
  HEAP8[($2 + 14 | 0) >> 0] = 0;
  std____2__char_traits_char___assign_28char__2c_20char_20const__29($0 + 1 | 0 | 0, $2 + 14 | 0 | 0);
  __stack_pointer = $2 + 16 | 0;
 }
 
 function operator_20new_28unsigned_20long_29($0) {
  $0 = $0 | 0;
  var $1 = 0;
  $1 = $0 ? $0 : 1;
  label$1 : {
   label$2 : while (1) {
    $0 = dlmalloc($1 | 0) | 0;
    if ($0) {
     break label$1
    }
    label$3 : {
     $0 = std__get_new_handler_28_29() | 0;
     if (!$0) {
      break label$3
     }
     FUNCTION_TABLE[$0 | 0]();
     continue label$2;
    }
    break label$2;
   };
   abort();
   abort();
  }
  return $0 | 0;
 }
 
 function operator_20delete_28void__29($0) {
  $0 = $0 | 0;
  dlfree($0 | 0);
 }
 
 function std____2____vector_base_common_true_____throw_length_error_28_29_20const($0) {
  $0 = $0 | 0;
  std____2____throw_length_error_28char_20const__29(1065 | 0);
  abort();
 }
 
 function std____2____throw_system_error_28int_2c_20char_20const__29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  abort();
  abort();
 }
 
 function abort_message($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  abort();
 }
 
 function __cxa_guard_acquire($0) {
  $0 = $0 | 0;
  var $1 = 0;
  $1 = __stack_pointer - 16 | 0;
  __stack_pointer = $1;
  $0 = __cxxabiv1___28anonymous_20namespace_29__GuardObject___cxxabiv1___28anonymous_20namespace_29__InitByteNoThreads___cxa_guard_acquire_28_29(__cxxabiv1___28anonymous_20namespace_29__InitByteNoThreads__InitByteNoThreads_28unsigned_20int__29($1 | 0, $0 | 0) | 0 | 0) | 0;
  __stack_pointer = $1 + 16 | 0;
  return $0 | 0;
 }
 
 function __cxxabiv1___28anonymous_20namespace_29__InitByteNoThreads__InitByteNoThreads_28unsigned_20int__29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  __cxxabiv1___28anonymous_20namespace_29__GuardObject___cxxabiv1___28anonymous_20namespace_29__InitByteNoThreads___GuardObject_28unsigned_20int__29($0 | 0, $1 | 0) | 0;
  return $0 | 0;
 }
 
 function __cxxabiv1___28anonymous_20namespace_29__GuardObject___cxxabiv1___28anonymous_20namespace_29__InitByteNoThreads___cxa_guard_acquire_28_29($0) {
  $0 = $0 | 0;
  var $1 = 0, $2 = 0;
  $1 = __stack_pointer - 16 | 0;
  __stack_pointer = $1;
  $2 = 0;
  label$1 : {
   if (__cxxabiv1___28anonymous_20namespace_29__AtomicInt_unsigned_20char___load_28std____2___28anonymous_20namespace_29____libcpp_atomic_order_29(__cxxabiv1___28anonymous_20namespace_29__AtomicInt_unsigned_20char___AtomicInt_28unsigned_20char__29($1 + 8 | 0 | 0, HEAP32[($0 + 4 | 0) >> 2] | 0 | 0) | 0 | 0) | 0) {
    break label$1
   }
   $2 = __cxxabiv1___28anonymous_20namespace_29__InitByteNoThreads__acquire_init_byte_28_29(__cxxabiv1___28anonymous_20namespace_29__GuardObject___cxxabiv1___28anonymous_20namespace_29__InitByteNoThreads___derived_28_29($0 | 0) | 0 | 0) | 0;
  }
  __stack_pointer = $1 + 16 | 0;
  return $2 | 0;
 }
 
 function __cxxabiv1___28anonymous_20namespace_29__GuardObject___cxxabiv1___28anonymous_20namespace_29__InitByteNoThreads___GuardObject_28unsigned_20int__29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  HEAP32[($0 + 12 | 0) >> 2] = 0;
  HEAP32[($0 + 4 | 0) >> 2] = $1;
  HEAP32[$0 >> 2] = $1;
  HEAP32[($0 + 8 | 0) >> 2] = $1 + 1 | 0;
  return $0 | 0;
 }
 
 function __cxxabiv1___28anonymous_20namespace_29__AtomicInt_unsigned_20char___AtomicInt_28unsigned_20char__29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  HEAP32[$0 >> 2] = $1;
  return $0 | 0;
 }
 
 function __cxxabiv1___28anonymous_20namespace_29__AtomicInt_unsigned_20char___load_28std____2___28anonymous_20namespace_29____libcpp_atomic_order_29($0) {
  $0 = $0 | 0;
  return unsigned_20char_20std____2___28anonymous_20namespace_29____libcpp_atomic_load_unsigned_20char__28unsigned_20char_20const__2c_20int_29(HEAP32[$0 >> 2] | 0 | 0) | 0 | 0;
 }
 
 function __cxxabiv1___28anonymous_20namespace_29__GuardObject___cxxabiv1___28anonymous_20namespace_29__InitByteNoThreads___derived_28_29($0) {
  $0 = $0 | 0;
  return $0 | 0;
 }
 
 function __cxxabiv1___28anonymous_20namespace_29__InitByteNoThreads__acquire_init_byte_28_29($0) {
  $0 = $0 | 0;
  var $1 = 0, $2 = 0;
  $1 = 0;
  label$1 : {
   label$2 : {
    $2 = HEAP32[($0 + 8 | 0) >> 2] | 0;
    $0 = HEAPU8[$2 >> 0] | 0;
    if (($0 | 0) == (1 | 0)) {
     break label$2
    }
    if ($0 & 2 | 0) {
     break label$1
    }
    HEAP8[$2 >> 0] = 2;
    $1 = 1;
   }
   return $1 | 0;
  }
  abort_message(1087 | 0, 0 | 0);
  abort();
 }
 
 function __cxa_guard_release($0) {
  $0 = $0 | 0;
  var $1 = 0;
  $1 = __stack_pointer - 16 | 0;
  __stack_pointer = $1;
  __cxxabiv1___28anonymous_20namespace_29__GuardObject___cxxabiv1___28anonymous_20namespace_29__InitByteNoThreads___cxa_guard_release_28_29(__cxxabiv1___28anonymous_20namespace_29__InitByteNoThreads__InitByteNoThreads_28unsigned_20int__29($1 | 0, $0 | 0) | 0 | 0);
  __stack_pointer = $1 + 16 | 0;
 }
 
 function __cxxabiv1___28anonymous_20namespace_29__GuardObject___cxxabiv1___28anonymous_20namespace_29__InitByteNoThreads___cxa_guard_release_28_29($0) {
  $0 = $0 | 0;
  var $1 = 0;
  $1 = __stack_pointer - 16 | 0;
  __stack_pointer = $1;
  __cxxabiv1___28anonymous_20namespace_29__AtomicInt_unsigned_20char___store_28unsigned_20char_2c_20std____2___28anonymous_20namespace_29____libcpp_atomic_order_29(__cxxabiv1___28anonymous_20namespace_29__AtomicInt_unsigned_20char___AtomicInt_28unsigned_20char__29($1 + 8 | 0 | 0, HEAP32[($0 + 4 | 0) >> 2] | 0 | 0) | 0 | 0);
  __cxxabiv1___28anonymous_20namespace_29__InitByteNoThreads__release_init_byte_28_29(__cxxabiv1___28anonymous_20namespace_29__GuardObject___cxxabiv1___28anonymous_20namespace_29__InitByteNoThreads___derived_28_29($0 | 0) | 0 | 0);
  __stack_pointer = $1 + 16 | 0;
 }
 
 function __cxxabiv1___28anonymous_20namespace_29__AtomicInt_unsigned_20char___store_28unsigned_20char_2c_20std____2___28anonymous_20namespace_29____libcpp_atomic_order_29($0) {
  $0 = $0 | 0;
  void_20std____2___28anonymous_20namespace_29____libcpp_atomic_store_unsigned_20char_2c_20unsigned_20char__28unsigned_20char__2c_20unsigned_20char_2c_20int_29(HEAP32[$0 >> 2] | 0 | 0);
 }
 
 function __cxxabiv1___28anonymous_20namespace_29__InitByteNoThreads__release_init_byte_28_29($0) {
  $0 = $0 | 0;
  HEAP8[(HEAP32[($0 + 8 | 0) >> 2] | 0) >> 0] = 1;
 }
 
 function unsigned_20char_20std____2___28anonymous_20namespace_29____libcpp_atomic_load_unsigned_20char__28unsigned_20char_20const__2c_20int_29($0) {
  $0 = $0 | 0;
  return HEAPU8[$0 >> 0] | 0 | 0;
 }
 
 function void_20std____2___28anonymous_20namespace_29____libcpp_atomic_store_unsigned_20char_2c_20unsigned_20char__28unsigned_20char__2c_20unsigned_20char_2c_20int_29($0) {
  $0 = $0 | 0;
  HEAP8[$0 >> 0] = 1;
 }
 
 function void_20_28_std____2___28anonymous_20namespace_29____libcpp_atomic_load_void_20_28__29_28_29__28void_20_28__20const__29_28_29_2c_20int_29_29_28_29($0) {
  $0 = $0 | 0;
  return HEAP32[$0 >> 2] | 0 | 0;
 }
 
 function std__get_new_handler_28_29() {
  return void_20_28_std____2___28anonymous_20namespace_29____libcpp_atomic_load_void_20_28__29_28_29__28void_20_28__20const__29_28_29_2c_20int_29_29_28_29(2788 | 0) | 0 | 0;
 }
 
 function __cxa_pure_virtual() {
  abort_message(1431 | 0, 0 | 0);
  abort();
 }
 
 function std__exception___exception_28_29($0) {
  $0 = $0 | 0;
  return $0 | 0;
 }
 
 function std__exception___exception_28_29_1($0) {
  $0 = $0 | 0;
  operator_20delete_28void__29($0 | 0);
 }
 
 function std__exception__what_28_29_20const($0) {
  $0 = $0 | 0;
  return 1072 | 0;
 }
 
 function std__logic_error___logic_error_28_29($0) {
  $0 = $0 | 0;
  HEAP32[$0 >> 2] = 2264 + 8 | 0;
  std____2____libcpp_refstring_____libcpp_refstring_28_29($0 + 4 | 0 | 0) | 0;
  std__exception___exception_28_29($0 | 0) | 0;
  return $0 | 0;
 }
 
 function std____2____libcpp_refstring_____libcpp_refstring_28_29($0) {
  $0 = $0 | 0;
  var $1 = 0;
  label$1 : {
   if (!(std____2____libcpp_refstring____uses_refcount_28_29_20const($0 | 0) | 0)) {
    break label$1
   }
   $1 = std____2____refstring_imp___28anonymous_20namespace_29__rep_from_data_28char_20const__29(HEAP32[$0 >> 2] | 0 | 0) | 0;
   if ((int_20std____2___28anonymous_20namespace_29____libcpp_atomic_add_int_2c_20int__28int__2c_20int_2c_20int_29($1 + 8 | 0 | 0) | 0 | 0) > (-1 | 0)) {
    break label$1
   }
   operator_20delete_28void__29($1 | 0);
  }
  return $0 | 0;
 }
 
 function std____2____refstring_imp___28anonymous_20namespace_29__rep_from_data_28char_20const__29($0) {
  $0 = $0 | 0;
  return $0 + -12 | 0 | 0;
 }
 
 function int_20std____2___28anonymous_20namespace_29____libcpp_atomic_add_int_2c_20int__28int__2c_20int_2c_20int_29($0) {
  $0 = $0 | 0;
  var $1 = 0;
  $1 = (HEAP32[$0 >> 2] | 0) + -1 | 0;
  HEAP32[$0 >> 2] = $1;
  return $1 | 0;
 }
 
 function std__logic_error___logic_error_28_29_1($0) {
  $0 = $0 | 0;
  operator_20delete_28void__29(std__logic_error___logic_error_28_29($0 | 0) | 0 | 0);
 }
 
 function std__logic_error__what_28_29_20const($0) {
  $0 = $0 | 0;
  return std____2____libcpp_refstring__c_str_28_29_20const($0 + 4 | 0 | 0) | 0 | 0;
 }
 
 function std____2____libcpp_refstring__c_str_28_29_20const($0) {
  $0 = $0 | 0;
  return HEAP32[$0 >> 2] | 0 | 0;
 }
 
 function std__length_error___length_error_28_29($0) {
  $0 = $0 | 0;
  std__logic_error___logic_error_28_29($0 | 0) | 0;
  operator_20delete_28void__29($0 | 0);
 }
 
 function std__type_info___type_info_28_29($0) {
  $0 = $0 | 0;
  return $0 | 0;
 }
 
 function strcmp($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  var $3 = 0, $2 = 0;
  $2 = HEAPU8[$1 >> 0] | 0;
  label$1 : {
   $3 = HEAPU8[$0 >> 0] | 0;
   if (!$3) {
    break label$1
   }
   if (($3 | 0) != ($2 & 255 | 0 | 0)) {
    break label$1
   }
   label$2 : while (1) {
    $2 = HEAPU8[($1 + 1 | 0) >> 0] | 0;
    $3 = HEAPU8[($0 + 1 | 0) >> 0] | 0;
    if (!$3) {
     break label$1
    }
    $1 = $1 + 1 | 0;
    $0 = $0 + 1 | 0;
    if (($3 | 0) == ($2 & 255 | 0 | 0)) {
     continue label$2
    }
    break label$2;
   };
  }
  return $3 - ($2 & 255 | 0) | 0 | 0;
 }
 
 function __cxxabiv1____shim_type_info_____shim_type_info_28_29($0) {
  $0 = $0 | 0;
  std__type_info___type_info_28_29($0 | 0) | 0;
  return $0 | 0;
 }
 
 function __cxxabiv1____shim_type_info__noop1_28_29_20const($0) {
  $0 = $0 | 0;
 }
 
 function __cxxabiv1____shim_type_info__noop2_28_29_20const($0) {
  $0 = $0 | 0;
 }
 
 function __cxxabiv1____class_type_info_____class_type_info_28_29($0) {
  $0 = $0 | 0;
  __cxxabiv1____shim_type_info_____shim_type_info_28_29($0 | 0) | 0;
  operator_20delete_28void__29($0 | 0);
 }
 
 function __cxxabiv1____si_class_type_info_____si_class_type_info_28_29($0) {
  $0 = $0 | 0;
  __cxxabiv1____shim_type_info_____shim_type_info_28_29($0 | 0) | 0;
  operator_20delete_28void__29($0 | 0);
 }
 
 function __cxxabiv1____vmi_class_type_info_____vmi_class_type_info_28_29($0) {
  $0 = $0 | 0;
  __cxxabiv1____shim_type_info_____shim_type_info_28_29($0 | 0) | 0;
  operator_20delete_28void__29($0 | 0);
 }
 
 function is_equal_28std__type_info_20const__2c_20std__type_info_20const__2c_20bool_29($0, $1, $2) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  label$1 : {
   if ($2) {
    break label$1
   }
   return (HEAP32[($0 + 4 | 0) >> 2] | 0 | 0) == (HEAP32[($1 + 4 | 0) >> 2] | 0 | 0) | 0;
  }
  label$2 : {
   if (($0 | 0) != ($1 | 0)) {
    break label$2
   }
   return 1 | 0;
  }
  return !(strcmp(std__type_info__name_28_29_20const($0 | 0) | 0 | 0, std__type_info__name_28_29_20const($1 | 0) | 0 | 0) | 0) | 0;
 }
 
 function std__type_info__name_28_29_20const($0) {
  $0 = $0 | 0;
  return HEAP32[($0 + 4 | 0) >> 2] | 0 | 0;
 }
 
 function __cxxabiv1____class_type_info__can_catch_28__cxxabiv1____shim_type_info_20const__2c_20void___29_20const($0, $1, $2) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  var $3 = 0, $4 = 0;
  $3 = __stack_pointer - 64 | 0;
  __stack_pointer = $3;
  $4 = 1;
  label$1 : {
   if (is_equal_28std__type_info_20const__2c_20std__type_info_20const__2c_20bool_29($0 | 0, $1 | 0, 0 | 0) | 0) {
    break label$1
   }
   $4 = 0;
   if (!$1) {
    break label$1
   }
   $4 = 0;
   $1 = __dynamic_cast($1 | 0, 2424 | 0, 2472 | 0, 0 | 0) | 0;
   if (!$1) {
    break label$1
   }
   memset($3 + 8 | 0 | 4 | 0 | 0, 0 | 0, 52 | 0) | 0;
   HEAP32[($3 + 56 | 0) >> 2] = 1;
   HEAP32[($3 + 20 | 0) >> 2] = -1;
   HEAP32[($3 + 16 | 0) >> 2] = $0;
   HEAP32[($3 + 8 | 0) >> 2] = $1;
   FUNCTION_TABLE[HEAP32[((HEAP32[$1 >> 2] | 0) + 28 | 0) >> 2] | 0 | 0]($1, $3 + 8 | 0, HEAP32[$2 >> 2] | 0, 1);
   label$2 : {
    $4 = HEAP32[($3 + 32 | 0) >> 2] | 0;
    if (($4 | 0) != (1 | 0)) {
     break label$2
    }
    HEAP32[$2 >> 2] = HEAP32[($3 + 24 | 0) >> 2] | 0;
   }
   $4 = ($4 | 0) == (1 | 0);
  }
  __stack_pointer = $3 + 64 | 0;
  return $4 | 0;
 }
 
 function __dynamic_cast($0, $1, $2, $3) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  $3 = $3 | 0;
  var $4 = 0, $6 = 0, $5 = 0, wasm2js_i32$0 = 0, wasm2js_i32$1 = 0, wasm2js_i32$2 = 0, wasm2js_i32$3 = 0, wasm2js_i32$4 = 0, wasm2js_i32$5 = 0, wasm2js_i32$6 = 0, wasm2js_i32$7 = 0, wasm2js_i32$8 = 0;
  $4 = __stack_pointer - 64 | 0;
  __stack_pointer = $4;
  $5 = HEAP32[$0 >> 2] | 0;
  $6 = HEAP32[($5 + -4 | 0) >> 2] | 0;
  $5 = HEAP32[($5 + -8 | 0) >> 2] | 0;
  HEAP32[($4 + 20 | 0) >> 2] = $3;
  HEAP32[($4 + 16 | 0) >> 2] = $1;
  HEAP32[($4 + 12 | 0) >> 2] = $0;
  HEAP32[($4 + 8 | 0) >> 2] = $2;
  $1 = 0;
  memset($4 + 24 | 0 | 0, 0 | 0, 39 | 0) | 0;
  $0 = $0 + $5 | 0;
  label$1 : {
   label$2 : {
    if (!(is_equal_28std__type_info_20const__2c_20std__type_info_20const__2c_20bool_29($6 | 0, $2 | 0, 0 | 0) | 0)) {
     break label$2
    }
    HEAP32[($4 + 56 | 0) >> 2] = 1;
    FUNCTION_TABLE[HEAP32[((HEAP32[$6 >> 2] | 0) + 20 | 0) >> 2] | 0 | 0]($6, $4 + 8 | 0, $0, $0, 1, 0);
    $1 = (HEAP32[($4 + 32 | 0) >> 2] | 0 | 0) == (1 | 0) ? $0 : 0;
    break label$1;
   }
   FUNCTION_TABLE[HEAP32[((HEAP32[$6 >> 2] | 0) + 24 | 0) >> 2] | 0 | 0]($6, $4 + 8 | 0, $0, 1, 0);
   label$3 : {
    switch (HEAP32[($4 + 44 | 0) >> 2] | 0 | 0) {
    case 0:
     $1 = (wasm2js_i32$0 = (wasm2js_i32$3 = (wasm2js_i32$6 = HEAP32[($4 + 28 | 0) >> 2] | 0, wasm2js_i32$7 = 0, wasm2js_i32$8 = (HEAP32[($4 + 40 | 0) >> 2] | 0 | 0) == (1 | 0), wasm2js_i32$8 ? wasm2js_i32$6 : wasm2js_i32$7), wasm2js_i32$4 = 0, wasm2js_i32$5 = (HEAP32[($4 + 36 | 0) >> 2] | 0 | 0) == (1 | 0), wasm2js_i32$5 ? wasm2js_i32$3 : wasm2js_i32$4), wasm2js_i32$1 = 0, wasm2js_i32$2 = (HEAP32[($4 + 48 | 0) >> 2] | 0 | 0) == (1 | 0), wasm2js_i32$2 ? wasm2js_i32$0 : wasm2js_i32$1);
     break label$1;
    case 1:
     break label$3;
    default:
     break label$1;
    };
   }
   label$5 : {
    if ((HEAP32[($4 + 32 | 0) >> 2] | 0 | 0) == (1 | 0)) {
     break label$5
    }
    if (HEAP32[($4 + 48 | 0) >> 2] | 0) {
     break label$1
    }
    if ((HEAP32[($4 + 36 | 0) >> 2] | 0 | 0) != (1 | 0)) {
     break label$1
    }
    if ((HEAP32[($4 + 40 | 0) >> 2] | 0 | 0) != (1 | 0)) {
     break label$1
    }
   }
   $1 = HEAP32[($4 + 24 | 0) >> 2] | 0;
  }
  __stack_pointer = $4 + 64 | 0;
  return $1 | 0;
 }
 
 function __cxxabiv1____class_type_info__process_found_base_class_28__cxxabiv1____dynamic_cast_info__2c_20void__2c_20int_29_20const($0, $1, $2, $3) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  $3 = $3 | 0;
  var $4 = 0;
  label$1 : {
   $4 = HEAP32[($1 + 16 | 0) >> 2] | 0;
   if ($4) {
    break label$1
   }
   HEAP32[($1 + 36 | 0) >> 2] = 1;
   HEAP32[($1 + 24 | 0) >> 2] = $3;
   HEAP32[($1 + 16 | 0) >> 2] = $2;
   return;
  }
  label$2 : {
   label$3 : {
    if (($4 | 0) != ($2 | 0)) {
     break label$3
    }
    if ((HEAP32[($1 + 24 | 0) >> 2] | 0 | 0) != (2 | 0)) {
     break label$2
    }
    HEAP32[($1 + 24 | 0) >> 2] = $3;
    return;
   }
   HEAP8[($1 + 54 | 0) >> 0] = 1;
   HEAP32[($1 + 24 | 0) >> 2] = 2;
   HEAP32[($1 + 36 | 0) >> 2] = (HEAP32[($1 + 36 | 0) >> 2] | 0) + 1 | 0;
  }
 }
 
 function __cxxabiv1____class_type_info__has_unambiguous_public_base_28__cxxabiv1____dynamic_cast_info__2c_20void__2c_20int_29_20const($0, $1, $2, $3) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  $3 = $3 | 0;
  label$1 : {
   if (!(is_equal_28std__type_info_20const__2c_20std__type_info_20const__2c_20bool_29($0 | 0, HEAP32[($1 + 8 | 0) >> 2] | 0 | 0, 0 | 0) | 0)) {
    break label$1
   }
   __cxxabiv1____class_type_info__process_found_base_class_28__cxxabiv1____dynamic_cast_info__2c_20void__2c_20int_29_20const($1 | 0, $1 | 0, $2 | 0, $3 | 0);
  }
 }
 
 function __cxxabiv1____si_class_type_info__has_unambiguous_public_base_28__cxxabiv1____dynamic_cast_info__2c_20void__2c_20int_29_20const($0, $1, $2, $3) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  $3 = $3 | 0;
  label$1 : {
   if (!(is_equal_28std__type_info_20const__2c_20std__type_info_20const__2c_20bool_29($0 | 0, HEAP32[($1 + 8 | 0) >> 2] | 0 | 0, 0 | 0) | 0)) {
    break label$1
   }
   __cxxabiv1____class_type_info__process_found_base_class_28__cxxabiv1____dynamic_cast_info__2c_20void__2c_20int_29_20const($1 | 0, $1 | 0, $2 | 0, $3 | 0);
   return;
  }
  $0 = HEAP32[($0 + 8 | 0) >> 2] | 0;
  FUNCTION_TABLE[HEAP32[((HEAP32[$0 >> 2] | 0) + 28 | 0) >> 2] | 0 | 0]($0, $1, $2, $3);
 }
 
 function __cxxabiv1____base_class_type_info__has_unambiguous_public_base_28__cxxabiv1____dynamic_cast_info__2c_20void__2c_20int_29_20const($0, $1, $2, $3) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  $3 = $3 | 0;
  var $5 = 0, $4 = 0;
  $4 = HEAP32[($0 + 4 | 0) >> 2] | 0;
  label$1 : {
   label$2 : {
    if ($2) {
     break label$2
    }
    $5 = 0;
    break label$1;
   }
   $5 = $4 >> 8 | 0;
   if (!($4 & 1 | 0)) {
    break label$1
   }
   $5 = update_offset_to_base_28char_20const__2c_20long_29(HEAP32[$2 >> 2] | 0 | 0, $5 | 0) | 0;
  }
  $0 = HEAP32[$0 >> 2] | 0;
  FUNCTION_TABLE[HEAP32[((HEAP32[$0 >> 2] | 0) + 28 | 0) >> 2] | 0 | 0]($0, $1, $2 + $5 | 0, $4 & 2 | 0 ? $3 : 2);
 }
 
 function update_offset_to_base_28char_20const__2c_20long_29($0, $1) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  return HEAP32[($0 + $1 | 0) >> 2] | 0 | 0;
 }
 
 function __cxxabiv1____vmi_class_type_info__has_unambiguous_public_base_28__cxxabiv1____dynamic_cast_info__2c_20void__2c_20int_29_20const($0, $1, $2, $3) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  $3 = $3 | 0;
  var $4 = 0, $5 = 0;
  label$1 : {
   if (!(is_equal_28std__type_info_20const__2c_20std__type_info_20const__2c_20bool_29($0 | 0, HEAP32[($1 + 8 | 0) >> 2] | 0 | 0, 0 | 0) | 0)) {
    break label$1
   }
   __cxxabiv1____class_type_info__process_found_base_class_28__cxxabiv1____dynamic_cast_info__2c_20void__2c_20int_29_20const($0 | 0, $1 | 0, $2 | 0, $3 | 0);
   return;
  }
  $4 = HEAP32[($0 + 12 | 0) >> 2] | 0;
  $5 = $0 + 16 | 0;
  __cxxabiv1____base_class_type_info__has_unambiguous_public_base_28__cxxabiv1____dynamic_cast_info__2c_20void__2c_20int_29_20const($5 | 0, $1 | 0, $2 | 0, $3 | 0);
  label$2 : {
   if (($4 | 0) < (2 | 0)) {
    break label$2
   }
   $4 = $5 + ($4 << 3 | 0) | 0;
   $0 = $0 + 24 | 0;
   label$3 : while (1) {
    __cxxabiv1____base_class_type_info__has_unambiguous_public_base_28__cxxabiv1____dynamic_cast_info__2c_20void__2c_20int_29_20const($0 | 0, $1 | 0, $2 | 0, $3 | 0);
    if (HEAPU8[($1 + 54 | 0) >> 0] | 0) {
     break label$2
    }
    $0 = $0 + 8 | 0;
    if ($0 >>> 0 < $4 >>> 0) {
     continue label$3
    }
    break label$3;
   };
  }
 }
 
 function __cxxabiv1____class_type_info__process_static_type_above_dst_28__cxxabiv1____dynamic_cast_info__2c_20void_20const__2c_20void_20const__2c_20int_29_20const($0, $1, $2, $3, $4) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  $3 = $3 | 0;
  $4 = $4 | 0;
  HEAP8[($1 + 53 | 0) >> 0] = 1;
  label$1 : {
   if ((HEAP32[($1 + 4 | 0) >> 2] | 0 | 0) != ($3 | 0)) {
    break label$1
   }
   HEAP8[($1 + 52 | 0) >> 0] = 1;
   label$2 : {
    label$3 : {
     $3 = HEAP32[($1 + 16 | 0) >> 2] | 0;
     if ($3) {
      break label$3
     }
     HEAP32[($1 + 36 | 0) >> 2] = 1;
     HEAP32[($1 + 24 | 0) >> 2] = $4;
     HEAP32[($1 + 16 | 0) >> 2] = $2;
     if ((HEAP32[($1 + 48 | 0) >> 2] | 0 | 0) != (1 | 0)) {
      break label$1
     }
     if (($4 | 0) == (1 | 0)) {
      break label$2
     }
     break label$1;
    }
    label$4 : {
     if (($3 | 0) != ($2 | 0)) {
      break label$4
     }
     label$5 : {
      $3 = HEAP32[($1 + 24 | 0) >> 2] | 0;
      if (($3 | 0) != (2 | 0)) {
       break label$5
      }
      HEAP32[($1 + 24 | 0) >> 2] = $4;
      $3 = $4;
     }
     if ((HEAP32[($1 + 48 | 0) >> 2] | 0 | 0) != (1 | 0)) {
      break label$1
     }
     if (($3 | 0) == (1 | 0)) {
      break label$2
     }
     break label$1;
    }
    HEAP32[($1 + 36 | 0) >> 2] = (HEAP32[($1 + 36 | 0) >> 2] | 0) + 1 | 0;
   }
   HEAP8[($1 + 54 | 0) >> 0] = 1;
  }
 }
 
 function __cxxabiv1____class_type_info__process_static_type_below_dst_28__cxxabiv1____dynamic_cast_info__2c_20void_20const__2c_20int_29_20const($0, $1, $2, $3) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  $3 = $3 | 0;
  label$1 : {
   if ((HEAP32[($1 + 4 | 0) >> 2] | 0 | 0) != ($2 | 0)) {
    break label$1
   }
   if ((HEAP32[($1 + 28 | 0) >> 2] | 0 | 0) == (1 | 0)) {
    break label$1
   }
   HEAP32[($1 + 28 | 0) >> 2] = $3;
  }
 }
 
 function __cxxabiv1____vmi_class_type_info__search_below_dst_28__cxxabiv1____dynamic_cast_info__2c_20void_20const__2c_20int_2c_20bool_29_20const($0, $1, $2, $3, $4) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  $3 = $3 | 0;
  $4 = $4 | 0;
  var $5 = 0, $8 = 0, $6 = 0, $7 = 0;
  label$1 : {
   if (!(is_equal_28std__type_info_20const__2c_20std__type_info_20const__2c_20bool_29($0 | 0, HEAP32[($1 + 8 | 0) >> 2] | 0 | 0, $4 | 0) | 0)) {
    break label$1
   }
   __cxxabiv1____class_type_info__process_static_type_below_dst_28__cxxabiv1____dynamic_cast_info__2c_20void_20const__2c_20int_29_20const($1 | 0, $1 | 0, $2 | 0, $3 | 0);
   return;
  }
  label$2 : {
   label$3 : {
    if (!(is_equal_28std__type_info_20const__2c_20std__type_info_20const__2c_20bool_29($0 | 0, HEAP32[$1 >> 2] | 0 | 0, $4 | 0) | 0)) {
     break label$3
    }
    label$4 : {
     label$5 : {
      if ((HEAP32[($1 + 16 | 0) >> 2] | 0 | 0) == ($2 | 0)) {
       break label$5
      }
      if ((HEAP32[($1 + 20 | 0) >> 2] | 0 | 0) != ($2 | 0)) {
       break label$4
      }
     }
     if (($3 | 0) != (1 | 0)) {
      break label$2
     }
     HEAP32[($1 + 32 | 0) >> 2] = 1;
     return;
    }
    HEAP32[($1 + 32 | 0) >> 2] = $3;
    label$6 : {
     if ((HEAP32[($1 + 44 | 0) >> 2] | 0 | 0) == (4 | 0)) {
      break label$6
     }
     $5 = $0 + 16 | 0;
     $3 = $5 + ((HEAP32[($0 + 12 | 0) >> 2] | 0) << 3 | 0) | 0;
     $6 = 0;
     $7 = 0;
     label$7 : {
      label$8 : {
       label$9 : {
        label$10 : while (1) {
         if ($5 >>> 0 >= $3 >>> 0) {
          break label$9
         }
         HEAP16[($1 + 52 | 0) >> 1] = 0;
         __cxxabiv1____base_class_type_info__search_above_dst_28__cxxabiv1____dynamic_cast_info__2c_20void_20const__2c_20void_20const__2c_20int_2c_20bool_29_20const($5 | 0, $1 | 0, $2 | 0, $2 | 0, 1 | 0, $4 | 0);
         if (HEAPU8[($1 + 54 | 0) >> 0] | 0) {
          break label$9
         }
         label$11 : {
          if (!(HEAPU8[($1 + 53 | 0) >> 0] | 0)) {
           break label$11
          }
          label$12 : {
           if (!(HEAPU8[($1 + 52 | 0) >> 0] | 0)) {
            break label$12
           }
           $8 = 1;
           if ((HEAP32[($1 + 24 | 0) >> 2] | 0 | 0) == (1 | 0)) {
            break label$8
           }
           $6 = 1;
           $7 = 1;
           $8 = 1;
           if ((HEAPU8[($0 + 8 | 0) >> 0] | 0) & 2 | 0) {
            break label$11
           }
           break label$8;
          }
          $6 = 1;
          $8 = $7;
          if (!((HEAPU8[($0 + 8 | 0) >> 0] | 0) & 1 | 0)) {
           break label$8
          }
         }
         $5 = $5 + 8 | 0;
         continue label$10;
        };
       }
       $5 = 4;
       $8 = $7;
       if (!($6 & 1 | 0)) {
        break label$7
       }
      }
      $5 = 3;
     }
     HEAP32[($1 + 44 | 0) >> 2] = $5;
     if ($8 & 1 | 0) {
      break label$2
     }
    }
    HEAP32[($1 + 20 | 0) >> 2] = $2;
    HEAP32[($1 + 40 | 0) >> 2] = (HEAP32[($1 + 40 | 0) >> 2] | 0) + 1 | 0;
    if ((HEAP32[($1 + 36 | 0) >> 2] | 0 | 0) != (1 | 0)) {
     break label$2
    }
    if ((HEAP32[($1 + 24 | 0) >> 2] | 0 | 0) != (2 | 0)) {
     break label$2
    }
    HEAP8[($1 + 54 | 0) >> 0] = 1;
    return;
   }
   $5 = HEAP32[($0 + 12 | 0) >> 2] | 0;
   $8 = $0 + 16 | 0;
   __cxxabiv1____base_class_type_info__search_below_dst_28__cxxabiv1____dynamic_cast_info__2c_20void_20const__2c_20int_2c_20bool_29_20const($8 | 0, $1 | 0, $2 | 0, $3 | 0, $4 | 0);
   if (($5 | 0) < (2 | 0)) {
    break label$2
   }
   $8 = $8 + ($5 << 3 | 0) | 0;
   $5 = $0 + 24 | 0;
   label$13 : {
    label$14 : {
     $0 = HEAP32[($0 + 8 | 0) >> 2] | 0;
     if ($0 & 2 | 0) {
      break label$14
     }
     if ((HEAP32[($1 + 36 | 0) >> 2] | 0 | 0) != (1 | 0)) {
      break label$13
     }
    }
    label$15 : while (1) {
     if (HEAPU8[($1 + 54 | 0) >> 0] | 0) {
      break label$2
     }
     __cxxabiv1____base_class_type_info__search_below_dst_28__cxxabiv1____dynamic_cast_info__2c_20void_20const__2c_20int_2c_20bool_29_20const($5 | 0, $1 | 0, $2 | 0, $3 | 0, $4 | 0);
     $5 = $5 + 8 | 0;
     if ($5 >>> 0 < $8 >>> 0) {
      continue label$15
     }
     break label$2;
    };
   }
   label$16 : {
    if ($0 & 1 | 0) {
     break label$16
    }
    label$17 : while (1) {
     if (HEAPU8[($1 + 54 | 0) >> 0] | 0) {
      break label$2
     }
     if ((HEAP32[($1 + 36 | 0) >> 2] | 0 | 0) == (1 | 0)) {
      break label$2
     }
     __cxxabiv1____base_class_type_info__search_below_dst_28__cxxabiv1____dynamic_cast_info__2c_20void_20const__2c_20int_2c_20bool_29_20const($5 | 0, $1 | 0, $2 | 0, $3 | 0, $4 | 0);
     $5 = $5 + 8 | 0;
     if ($5 >>> 0 < $8 >>> 0) {
      continue label$17
     }
     break label$2;
    };
   }
   label$18 : while (1) {
    if (HEAPU8[($1 + 54 | 0) >> 0] | 0) {
     break label$2
    }
    label$19 : {
     if ((HEAP32[($1 + 36 | 0) >> 2] | 0 | 0) != (1 | 0)) {
      break label$19
     }
     if ((HEAP32[($1 + 24 | 0) >> 2] | 0 | 0) == (1 | 0)) {
      break label$2
     }
    }
    __cxxabiv1____base_class_type_info__search_below_dst_28__cxxabiv1____dynamic_cast_info__2c_20void_20const__2c_20int_2c_20bool_29_20const($5 | 0, $1 | 0, $2 | 0, $3 | 0, $4 | 0);
    $5 = $5 + 8 | 0;
    if ($5 >>> 0 < $8 >>> 0) {
     continue label$18
    }
    break label$18;
   };
  }
 }
 
 function __cxxabiv1____base_class_type_info__search_above_dst_28__cxxabiv1____dynamic_cast_info__2c_20void_20const__2c_20void_20const__2c_20int_2c_20bool_29_20const($0, $1, $2, $3, $4, $5) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  $3 = $3 | 0;
  $4 = $4 | 0;
  $5 = $5 | 0;
  var $6 = 0, $7 = 0;
  $6 = HEAP32[($0 + 4 | 0) >> 2] | 0;
  $7 = $6 >> 8 | 0;
  label$1 : {
   if (!($6 & 1 | 0)) {
    break label$1
   }
   $7 = update_offset_to_base_28char_20const__2c_20long_29(HEAP32[$3 >> 2] | 0 | 0, $7 | 0) | 0;
  }
  $0 = HEAP32[$0 >> 2] | 0;
  FUNCTION_TABLE[HEAP32[((HEAP32[$0 >> 2] | 0) + 20 | 0) >> 2] | 0 | 0]($0, $1, $2, $3 + $7 | 0, $6 & 2 | 0 ? $4 : 2, $5);
 }
 
 function __cxxabiv1____base_class_type_info__search_below_dst_28__cxxabiv1____dynamic_cast_info__2c_20void_20const__2c_20int_2c_20bool_29_20const($0, $1, $2, $3, $4) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  $3 = $3 | 0;
  $4 = $4 | 0;
  var $5 = 0, $6 = 0;
  $5 = HEAP32[($0 + 4 | 0) >> 2] | 0;
  $6 = $5 >> 8 | 0;
  label$1 : {
   if (!($5 & 1 | 0)) {
    break label$1
   }
   $6 = update_offset_to_base_28char_20const__2c_20long_29(HEAP32[$2 >> 2] | 0 | 0, $6 | 0) | 0;
  }
  $0 = HEAP32[$0 >> 2] | 0;
  FUNCTION_TABLE[HEAP32[((HEAP32[$0 >> 2] | 0) + 24 | 0) >> 2] | 0 | 0]($0, $1, $2 + $6 | 0, $5 & 2 | 0 ? $3 : 2, $4);
 }
 
 function __cxxabiv1____si_class_type_info__search_below_dst_28__cxxabiv1____dynamic_cast_info__2c_20void_20const__2c_20int_2c_20bool_29_20const($0, $1, $2, $3, $4) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  $3 = $3 | 0;
  $4 = $4 | 0;
  label$1 : {
   if (!(is_equal_28std__type_info_20const__2c_20std__type_info_20const__2c_20bool_29($0 | 0, HEAP32[($1 + 8 | 0) >> 2] | 0 | 0, $4 | 0) | 0)) {
    break label$1
   }
   __cxxabiv1____class_type_info__process_static_type_below_dst_28__cxxabiv1____dynamic_cast_info__2c_20void_20const__2c_20int_29_20const($1 | 0, $1 | 0, $2 | 0, $3 | 0);
   return;
  }
  label$2 : {
   label$3 : {
    if (!(is_equal_28std__type_info_20const__2c_20std__type_info_20const__2c_20bool_29($0 | 0, HEAP32[$1 >> 2] | 0 | 0, $4 | 0) | 0)) {
     break label$3
    }
    label$4 : {
     label$5 : {
      if ((HEAP32[($1 + 16 | 0) >> 2] | 0 | 0) == ($2 | 0)) {
       break label$5
      }
      if ((HEAP32[($1 + 20 | 0) >> 2] | 0 | 0) != ($2 | 0)) {
       break label$4
      }
     }
     if (($3 | 0) != (1 | 0)) {
      break label$2
     }
     HEAP32[($1 + 32 | 0) >> 2] = 1;
     return;
    }
    HEAP32[($1 + 32 | 0) >> 2] = $3;
    label$6 : {
     if ((HEAP32[($1 + 44 | 0) >> 2] | 0 | 0) == (4 | 0)) {
      break label$6
     }
     HEAP16[($1 + 52 | 0) >> 1] = 0;
     $0 = HEAP32[($0 + 8 | 0) >> 2] | 0;
     FUNCTION_TABLE[HEAP32[((HEAP32[$0 >> 2] | 0) + 20 | 0) >> 2] | 0 | 0]($0, $1, $2, $2, 1, $4);
     label$7 : {
      if (!(HEAPU8[($1 + 53 | 0) >> 0] | 0)) {
       break label$7
      }
      HEAP32[($1 + 44 | 0) >> 2] = 3;
      if (!(HEAPU8[($1 + 52 | 0) >> 0] | 0)) {
       break label$6
      }
      break label$2;
     }
     HEAP32[($1 + 44 | 0) >> 2] = 4;
    }
    HEAP32[($1 + 20 | 0) >> 2] = $2;
    HEAP32[($1 + 40 | 0) >> 2] = (HEAP32[($1 + 40 | 0) >> 2] | 0) + 1 | 0;
    if ((HEAP32[($1 + 36 | 0) >> 2] | 0 | 0) != (1 | 0)) {
     break label$2
    }
    if ((HEAP32[($1 + 24 | 0) >> 2] | 0 | 0) != (2 | 0)) {
     break label$2
    }
    HEAP8[($1 + 54 | 0) >> 0] = 1;
    return;
   }
   $0 = HEAP32[($0 + 8 | 0) >> 2] | 0;
   FUNCTION_TABLE[HEAP32[((HEAP32[$0 >> 2] | 0) + 24 | 0) >> 2] | 0 | 0]($0, $1, $2, $3, $4);
  }
 }
 
 function __cxxabiv1____class_type_info__search_below_dst_28__cxxabiv1____dynamic_cast_info__2c_20void_20const__2c_20int_2c_20bool_29_20const($0, $1, $2, $3, $4) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  $3 = $3 | 0;
  $4 = $4 | 0;
  label$1 : {
   if (!(is_equal_28std__type_info_20const__2c_20std__type_info_20const__2c_20bool_29($0 | 0, HEAP32[($1 + 8 | 0) >> 2] | 0 | 0, $4 | 0) | 0)) {
    break label$1
   }
   __cxxabiv1____class_type_info__process_static_type_below_dst_28__cxxabiv1____dynamic_cast_info__2c_20void_20const__2c_20int_29_20const($1 | 0, $1 | 0, $2 | 0, $3 | 0);
   return;
  }
  label$2 : {
   if (!(is_equal_28std__type_info_20const__2c_20std__type_info_20const__2c_20bool_29($0 | 0, HEAP32[$1 >> 2] | 0 | 0, $4 | 0) | 0)) {
    break label$2
   }
   label$3 : {
    label$4 : {
     if ((HEAP32[($1 + 16 | 0) >> 2] | 0 | 0) == ($2 | 0)) {
      break label$4
     }
     if ((HEAP32[($1 + 20 | 0) >> 2] | 0 | 0) != ($2 | 0)) {
      break label$3
     }
    }
    if (($3 | 0) != (1 | 0)) {
     break label$2
    }
    HEAP32[($1 + 32 | 0) >> 2] = 1;
    return;
   }
   HEAP32[($1 + 20 | 0) >> 2] = $2;
   HEAP32[($1 + 32 | 0) >> 2] = $3;
   HEAP32[($1 + 40 | 0) >> 2] = (HEAP32[($1 + 40 | 0) >> 2] | 0) + 1 | 0;
   label$5 : {
    if ((HEAP32[($1 + 36 | 0) >> 2] | 0 | 0) != (1 | 0)) {
     break label$5
    }
    if ((HEAP32[($1 + 24 | 0) >> 2] | 0 | 0) != (2 | 0)) {
     break label$5
    }
    HEAP8[($1 + 54 | 0) >> 0] = 1;
   }
   HEAP32[($1 + 44 | 0) >> 2] = 4;
  }
 }
 
 function __cxxabiv1____vmi_class_type_info__search_above_dst_28__cxxabiv1____dynamic_cast_info__2c_20void_20const__2c_20void_20const__2c_20int_2c_20bool_29_20const($0, $1, $2, $3, $4, $5) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  $3 = $3 | 0;
  $4 = $4 | 0;
  $5 = $5 | 0;
  var $7 = 0, $6 = 0, $8 = 0, $9 = 0, $10 = 0, $11 = 0;
  label$1 : {
   if (!(is_equal_28std__type_info_20const__2c_20std__type_info_20const__2c_20bool_29($0 | 0, HEAP32[($1 + 8 | 0) >> 2] | 0 | 0, $5 | 0) | 0)) {
    break label$1
   }
   __cxxabiv1____class_type_info__process_static_type_above_dst_28__cxxabiv1____dynamic_cast_info__2c_20void_20const__2c_20void_20const__2c_20int_29_20const($1 | 0, $1 | 0, $2 | 0, $3 | 0, $4 | 0);
   return;
  }
  $6 = HEAPU8[($1 + 53 | 0) >> 0] | 0;
  $7 = HEAP32[($0 + 12 | 0) >> 2] | 0;
  HEAP8[($1 + 53 | 0) >> 0] = 0;
  $8 = HEAPU8[($1 + 52 | 0) >> 0] | 0;
  HEAP8[($1 + 52 | 0) >> 0] = 0;
  $9 = $0 + 16 | 0;
  __cxxabiv1____base_class_type_info__search_above_dst_28__cxxabiv1____dynamic_cast_info__2c_20void_20const__2c_20void_20const__2c_20int_2c_20bool_29_20const($9 | 0, $1 | 0, $2 | 0, $3 | 0, $4 | 0, $5 | 0);
  $10 = HEAPU8[($1 + 53 | 0) >> 0] | 0;
  $6 = $6 | $10 | 0;
  $11 = HEAPU8[($1 + 52 | 0) >> 0] | 0;
  $8 = $8 | $11 | 0;
  label$2 : {
   if (($7 | 0) < (2 | 0)) {
    break label$2
   }
   $9 = $9 + ($7 << 3 | 0) | 0;
   $7 = $0 + 24 | 0;
   label$3 : while (1) {
    if (HEAPU8[($1 + 54 | 0) >> 0] | 0) {
     break label$2
    }
    label$4 : {
     label$5 : {
      if (!($11 & 255 | 0)) {
       break label$5
      }
      if ((HEAP32[($1 + 24 | 0) >> 2] | 0 | 0) == (1 | 0)) {
       break label$2
      }
      if ((HEAPU8[($0 + 8 | 0) >> 0] | 0) & 2 | 0) {
       break label$4
      }
      break label$2;
     }
     if (!($10 & 255 | 0)) {
      break label$4
     }
     if (!((HEAPU8[($0 + 8 | 0) >> 0] | 0) & 1 | 0)) {
      break label$2
     }
    }
    HEAP16[($1 + 52 | 0) >> 1] = 0;
    __cxxabiv1____base_class_type_info__search_above_dst_28__cxxabiv1____dynamic_cast_info__2c_20void_20const__2c_20void_20const__2c_20int_2c_20bool_29_20const($7 | 0, $1 | 0, $2 | 0, $3 | 0, $4 | 0, $5 | 0);
    $10 = HEAPU8[($1 + 53 | 0) >> 0] | 0;
    $6 = $10 | $6 | 0;
    $11 = HEAPU8[($1 + 52 | 0) >> 0] | 0;
    $8 = $11 | $8 | 0;
    $7 = $7 + 8 | 0;
    if ($7 >>> 0 < $9 >>> 0) {
     continue label$3
    }
    break label$3;
   };
  }
  HEAP8[($1 + 53 | 0) >> 0] = ($6 & 255 | 0 | 0) != (0 | 0);
  HEAP8[($1 + 52 | 0) >> 0] = ($8 & 255 | 0 | 0) != (0 | 0);
 }
 
 function __cxxabiv1____si_class_type_info__search_above_dst_28__cxxabiv1____dynamic_cast_info__2c_20void_20const__2c_20void_20const__2c_20int_2c_20bool_29_20const($0, $1, $2, $3, $4, $5) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  $3 = $3 | 0;
  $4 = $4 | 0;
  $5 = $5 | 0;
  label$1 : {
   if (!(is_equal_28std__type_info_20const__2c_20std__type_info_20const__2c_20bool_29($0 | 0, HEAP32[($1 + 8 | 0) >> 2] | 0 | 0, $5 | 0) | 0)) {
    break label$1
   }
   __cxxabiv1____class_type_info__process_static_type_above_dst_28__cxxabiv1____dynamic_cast_info__2c_20void_20const__2c_20void_20const__2c_20int_29_20const($1 | 0, $1 | 0, $2 | 0, $3 | 0, $4 | 0);
   return;
  }
  $0 = HEAP32[($0 + 8 | 0) >> 2] | 0;
  FUNCTION_TABLE[HEAP32[((HEAP32[$0 >> 2] | 0) + 20 | 0) >> 2] | 0 | 0]($0, $1, $2, $3, $4, $5);
 }
 
 function __cxxabiv1____class_type_info__search_above_dst_28__cxxabiv1____dynamic_cast_info__2c_20void_20const__2c_20void_20const__2c_20int_2c_20bool_29_20const($0, $1, $2, $3, $4, $5) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  $3 = $3 | 0;
  $4 = $4 | 0;
  $5 = $5 | 0;
  label$1 : {
   if (!(is_equal_28std__type_info_20const__2c_20std__type_info_20const__2c_20bool_29($0 | 0, HEAP32[($1 + 8 | 0) >> 2] | 0 | 0, $5 | 0) | 0)) {
    break label$1
   }
   __cxxabiv1____class_type_info__process_static_type_above_dst_28__cxxabiv1____dynamic_cast_info__2c_20void_20const__2c_20void_20const__2c_20int_29_20const($1 | 0, $1 | 0, $2 | 0, $3 | 0, $4 | 0);
  }
 }
 
 function dlmalloc($0) {
  $0 = $0 | 0;
  var $4 = 0, $5 = 0, $6 = 0, $8 = 0, $3 = 0, $2 = 0, $11 = 0, $7 = 0, i64toi32_i32$0 = 0, i64toi32_i32$1 = 0, $9 = 0, i64toi32_i32$2 = 0, $10 = 0, $1 = 0, $79 = 0, $92 = 0, $103 = 0, $111 = 0, $119 = 0, $210 = 0, $221 = 0, $229 = 0, $237 = 0, $272 = 0, $339 = 0, $346 = 0, $353 = 0, $444 = 0, $455 = 0, $463 = 0, $471 = 0, $1157 = 0, $1164 = 0, $1171 = 0, $1293 = 0, $1295 = 0, $1356 = 0, $1363 = 0, $1370 = 0, $1606 = 0, $1613 = 0, $1620 = 0;
  $1 = __stack_pointer - 16 | 0;
  __stack_pointer = $1;
  label$1 : {
   label$2 : {
    label$3 : {
     label$4 : {
      label$5 : {
       label$6 : {
        label$7 : {
         label$8 : {
          label$9 : {
           label$10 : {
            label$11 : {
             label$12 : {
              if ($0 >>> 0 > 244 >>> 0) {
               break label$12
              }
              label$13 : {
               $2 = HEAP32[(0 + 2792 | 0) >> 2] | 0;
               $3 = $0 >>> 0 < 11 >>> 0 ? 16 : ($0 + 11 | 0) & -8 | 0;
               $4 = $3 >>> 3 | 0;
               $0 = $2 >>> $4 | 0;
               if (!($0 & 3 | 0)) {
                break label$13
               }
               $5 = (($0 ^ -1 | 0) & 1 | 0) + $4 | 0;
               $6 = $5 << 3 | 0;
               $4 = HEAP32[($6 + 2840 | 0) >> 2] | 0;
               $0 = $4 + 8 | 0;
               label$14 : {
                label$15 : {
                 $3 = HEAP32[($4 + 8 | 0) >> 2] | 0;
                 $6 = $6 + 2832 | 0;
                 if (($3 | 0) != ($6 | 0)) {
                  break label$15
                 }
                 HEAP32[(0 + 2792 | 0) >> 2] = $2 & (__wasm_rotl_i32(-2 | 0, $5 | 0) | 0) | 0;
                 break label$14;
                }
                HEAP32[($3 + 12 | 0) >> 2] = $6;
                HEAP32[($6 + 8 | 0) >> 2] = $3;
               }
               $5 = $5 << 3 | 0;
               HEAP32[($4 + 4 | 0) >> 2] = $5 | 3 | 0;
               $4 = $4 + $5 | 0;
               HEAP32[($4 + 4 | 0) >> 2] = HEAP32[($4 + 4 | 0) >> 2] | 0 | 1 | 0;
               break label$1;
              }
              $7 = HEAP32[(0 + 2800 | 0) >> 2] | 0;
              if ($3 >>> 0 <= $7 >>> 0) {
               break label$11
              }
              label$16 : {
               if (!$0) {
                break label$16
               }
               label$17 : {
                label$18 : {
                 $79 = $0 << $4 | 0;
                 $0 = 2 << $4 | 0;
                 $0 = $79 & ($0 | (0 - $0 | 0) | 0) | 0;
                 $0 = ($0 & (0 - $0 | 0) | 0) + -1 | 0;
                 $92 = $0;
                 $0 = ($0 >>> 12 | 0) & 16 | 0;
                 $4 = $92 >>> $0 | 0;
                 $5 = ($4 >>> 5 | 0) & 8 | 0;
                 $103 = $5 | $0 | 0;
                 $0 = $4 >>> $5 | 0;
                 $4 = ($0 >>> 2 | 0) & 4 | 0;
                 $111 = $103 | $4 | 0;
                 $0 = $0 >>> $4 | 0;
                 $4 = ($0 >>> 1 | 0) & 2 | 0;
                 $119 = $111 | $4 | 0;
                 $0 = $0 >>> $4 | 0;
                 $4 = ($0 >>> 1 | 0) & 1 | 0;
                 $5 = ($119 | $4 | 0) + ($0 >>> $4 | 0) | 0;
                 $6 = $5 << 3 | 0;
                 $4 = HEAP32[($6 + 2840 | 0) >> 2] | 0;
                 $0 = HEAP32[($4 + 8 | 0) >> 2] | 0;
                 $6 = $6 + 2832 | 0;
                 if (($0 | 0) != ($6 | 0)) {
                  break label$18
                 }
                 $2 = $2 & (__wasm_rotl_i32(-2 | 0, $5 | 0) | 0) | 0;
                 HEAP32[(0 + 2792 | 0) >> 2] = $2;
                 break label$17;
                }
                HEAP32[($0 + 12 | 0) >> 2] = $6;
                HEAP32[($6 + 8 | 0) >> 2] = $0;
               }
               $0 = $4 + 8 | 0;
               HEAP32[($4 + 4 | 0) >> 2] = $3 | 3 | 0;
               $6 = $4 + $3 | 0;
               $8 = $5 << 3 | 0;
               $5 = $8 - $3 | 0;
               HEAP32[($6 + 4 | 0) >> 2] = $5 | 1 | 0;
               HEAP32[($4 + $8 | 0) >> 2] = $5;
               label$19 : {
                if (!$7) {
                 break label$19
                }
                $8 = $7 >>> 3 | 0;
                $3 = ($8 << 3 | 0) + 2832 | 0;
                $4 = HEAP32[(0 + 2812 | 0) >> 2] | 0;
                label$20 : {
                 label$21 : {
                  $8 = 1 << $8 | 0;
                  if ($2 & $8 | 0) {
                   break label$21
                  }
                  HEAP32[(0 + 2792 | 0) >> 2] = $2 | $8 | 0;
                  $8 = $3;
                  break label$20;
                 }
                 $8 = HEAP32[($3 + 8 | 0) >> 2] | 0;
                }
                HEAP32[($3 + 8 | 0) >> 2] = $4;
                HEAP32[($8 + 12 | 0) >> 2] = $4;
                HEAP32[($4 + 12 | 0) >> 2] = $3;
                HEAP32[($4 + 8 | 0) >> 2] = $8;
               }
               HEAP32[(0 + 2812 | 0) >> 2] = $6;
               HEAP32[(0 + 2800 | 0) >> 2] = $5;
               break label$1;
              }
              $9 = HEAP32[(0 + 2796 | 0) >> 2] | 0;
              if (!$9) {
               break label$11
              }
              $0 = ($9 & (0 - $9 | 0) | 0) + -1 | 0;
              $210 = $0;
              $0 = ($0 >>> 12 | 0) & 16 | 0;
              $4 = $210 >>> $0 | 0;
              $5 = ($4 >>> 5 | 0) & 8 | 0;
              $221 = $5 | $0 | 0;
              $0 = $4 >>> $5 | 0;
              $4 = ($0 >>> 2 | 0) & 4 | 0;
              $229 = $221 | $4 | 0;
              $0 = $0 >>> $4 | 0;
              $4 = ($0 >>> 1 | 0) & 2 | 0;
              $237 = $229 | $4 | 0;
              $0 = $0 >>> $4 | 0;
              $4 = ($0 >>> 1 | 0) & 1 | 0;
              $6 = HEAP32[(((($237 | $4 | 0) + ($0 >>> $4 | 0) | 0) << 2 | 0) + 3096 | 0) >> 2] | 0;
              $4 = ((HEAP32[($6 + 4 | 0) >> 2] | 0) & -8 | 0) - $3 | 0;
              $5 = $6;
              label$22 : {
               label$23 : while (1) {
                label$24 : {
                 $0 = HEAP32[($5 + 16 | 0) >> 2] | 0;
                 if ($0) {
                  break label$24
                 }
                 $0 = HEAP32[($5 + 20 | 0) >> 2] | 0;
                 if (!$0) {
                  break label$22
                 }
                }
                $5 = ((HEAP32[($0 + 4 | 0) >> 2] | 0) & -8 | 0) - $3 | 0;
                $272 = $5;
                $5 = $5 >>> 0 < $4 >>> 0;
                $4 = $5 ? $272 : $4;
                $6 = $5 ? $0 : $6;
                $5 = $0;
                continue label$23;
               };
              }
              $10 = HEAP32[($6 + 24 | 0) >> 2] | 0;
              label$25 : {
               $8 = HEAP32[($6 + 12 | 0) >> 2] | 0;
               if (($8 | 0) == ($6 | 0)) {
                break label$25
               }
               $0 = HEAP32[($6 + 8 | 0) >> 2] | 0;
               HEAP32[(0 + 2808 | 0) >> 2] | 0;
               HEAP32[($0 + 12 | 0) >> 2] = $8;
               HEAP32[($8 + 8 | 0) >> 2] = $0;
               break label$2;
              }
              label$26 : {
               $5 = $6 + 20 | 0;
               $0 = HEAP32[$5 >> 2] | 0;
               if ($0) {
                break label$26
               }
               $0 = HEAP32[($6 + 16 | 0) >> 2] | 0;
               if (!$0) {
                break label$10
               }
               $5 = $6 + 16 | 0;
              }
              label$27 : while (1) {
               $11 = $5;
               $8 = $0;
               $5 = $0 + 20 | 0;
               $0 = HEAP32[$5 >> 2] | 0;
               if ($0) {
                continue label$27
               }
               $5 = $8 + 16 | 0;
               $0 = HEAP32[($8 + 16 | 0) >> 2] | 0;
               if ($0) {
                continue label$27
               }
               break label$27;
              };
              HEAP32[$11 >> 2] = 0;
              break label$2;
             }
             $3 = -1;
             if ($0 >>> 0 > -65 >>> 0) {
              break label$11
             }
             $0 = $0 + 11 | 0;
             $3 = $0 & -8 | 0;
             $7 = HEAP32[(0 + 2796 | 0) >> 2] | 0;
             if (!$7) {
              break label$11
             }
             $11 = 0;
             label$28 : {
              if ($3 >>> 0 < 256 >>> 0) {
               break label$28
              }
              $11 = 31;
              if ($3 >>> 0 > 16777215 >>> 0) {
               break label$28
              }
              $0 = $0 >>> 8 | 0;
              $339 = $0;
              $0 = (($0 + 1048320 | 0) >>> 16 | 0) & 8 | 0;
              $4 = $339 << $0 | 0;
              $346 = $4;
              $4 = (($4 + 520192 | 0) >>> 16 | 0) & 4 | 0;
              $5 = $346 << $4 | 0;
              $353 = $5;
              $5 = (($5 + 245760 | 0) >>> 16 | 0) & 2 | 0;
              $0 = (($353 << $5 | 0) >>> 15 | 0) - ($0 | $4 | 0 | $5 | 0) | 0;
              $11 = ($0 << 1 | 0 | (($3 >>> ($0 + 21 | 0) | 0) & 1 | 0) | 0) + 28 | 0;
             }
             $4 = 0 - $3 | 0;
             label$29 : {
              label$30 : {
               label$31 : {
                label$32 : {
                 $5 = HEAP32[(($11 << 2 | 0) + 3096 | 0) >> 2] | 0;
                 if ($5) {
                  break label$32
                 }
                 $0 = 0;
                 $8 = 0;
                 break label$31;
                }
                $0 = 0;
                $6 = $3 << (($11 | 0) == (31 | 0) ? 0 : 25 - ($11 >>> 1 | 0) | 0) | 0;
                $8 = 0;
                label$33 : while (1) {
                 label$34 : {
                  $2 = ((HEAP32[($5 + 4 | 0) >> 2] | 0) & -8 | 0) - $3 | 0;
                  if ($2 >>> 0 >= $4 >>> 0) {
                   break label$34
                  }
                  $4 = $2;
                  $8 = $5;
                  if ($4) {
                   break label$34
                  }
                  $4 = 0;
                  $8 = $5;
                  $0 = $5;
                  break label$30;
                 }
                 $2 = HEAP32[($5 + 20 | 0) >> 2] | 0;
                 $5 = HEAP32[(($5 + (($6 >>> 29 | 0) & 4 | 0) | 0) + 16 | 0) >> 2] | 0;
                 $0 = $2 ? (($2 | 0) == ($5 | 0) ? $0 : $2) : $0;
                 $6 = $6 << 1 | 0;
                 if ($5) {
                  continue label$33
                 }
                 break label$33;
                };
               }
               label$35 : {
                if ($0 | $8 | 0) {
                 break label$35
                }
                $8 = 0;
                $0 = 2 << $11 | 0;
                $0 = ($0 | (0 - $0 | 0) | 0) & $7 | 0;
                if (!$0) {
                 break label$11
                }
                $0 = ($0 & (0 - $0 | 0) | 0) + -1 | 0;
                $444 = $0;
                $0 = ($0 >>> 12 | 0) & 16 | 0;
                $5 = $444 >>> $0 | 0;
                $6 = ($5 >>> 5 | 0) & 8 | 0;
                $455 = $6 | $0 | 0;
                $0 = $5 >>> $6 | 0;
                $5 = ($0 >>> 2 | 0) & 4 | 0;
                $463 = $455 | $5 | 0;
                $0 = $0 >>> $5 | 0;
                $5 = ($0 >>> 1 | 0) & 2 | 0;
                $471 = $463 | $5 | 0;
                $0 = $0 >>> $5 | 0;
                $5 = ($0 >>> 1 | 0) & 1 | 0;
                $0 = HEAP32[(((($471 | $5 | 0) + ($0 >>> $5 | 0) | 0) << 2 | 0) + 3096 | 0) >> 2] | 0;
               }
               if (!$0) {
                break label$29
               }
              }
              label$36 : while (1) {
               $2 = ((HEAP32[($0 + 4 | 0) >> 2] | 0) & -8 | 0) - $3 | 0;
               $6 = $2 >>> 0 < $4 >>> 0;
               label$37 : {
                $5 = HEAP32[($0 + 16 | 0) >> 2] | 0;
                if ($5) {
                 break label$37
                }
                $5 = HEAP32[($0 + 20 | 0) >> 2] | 0;
               }
               $4 = $6 ? $2 : $4;
               $8 = $6 ? $0 : $8;
               $0 = $5;
               if ($0) {
                continue label$36
               }
               break label$36;
              };
             }
             if (!$8) {
              break label$11
             }
             if ($4 >>> 0 >= ((HEAP32[(0 + 2800 | 0) >> 2] | 0) - $3 | 0) >>> 0) {
              break label$11
             }
             $11 = HEAP32[($8 + 24 | 0) >> 2] | 0;
             label$38 : {
              $6 = HEAP32[($8 + 12 | 0) >> 2] | 0;
              if (($6 | 0) == ($8 | 0)) {
               break label$38
              }
              $0 = HEAP32[($8 + 8 | 0) >> 2] | 0;
              HEAP32[(0 + 2808 | 0) >> 2] | 0;
              HEAP32[($0 + 12 | 0) >> 2] = $6;
              HEAP32[($6 + 8 | 0) >> 2] = $0;
              break label$3;
             }
             label$39 : {
              $5 = $8 + 20 | 0;
              $0 = HEAP32[$5 >> 2] | 0;
              if ($0) {
               break label$39
              }
              $0 = HEAP32[($8 + 16 | 0) >> 2] | 0;
              if (!$0) {
               break label$9
              }
              $5 = $8 + 16 | 0;
             }
             label$40 : while (1) {
              $2 = $5;
              $6 = $0;
              $5 = $0 + 20 | 0;
              $0 = HEAP32[$5 >> 2] | 0;
              if ($0) {
               continue label$40
              }
              $5 = $6 + 16 | 0;
              $0 = HEAP32[($6 + 16 | 0) >> 2] | 0;
              if ($0) {
               continue label$40
              }
              break label$40;
             };
             HEAP32[$2 >> 2] = 0;
             break label$3;
            }
            label$41 : {
             $0 = HEAP32[(0 + 2800 | 0) >> 2] | 0;
             if ($0 >>> 0 < $3 >>> 0) {
              break label$41
             }
             $4 = HEAP32[(0 + 2812 | 0) >> 2] | 0;
             label$42 : {
              label$43 : {
               $5 = $0 - $3 | 0;
               if ($5 >>> 0 < 16 >>> 0) {
                break label$43
               }
               HEAP32[(0 + 2800 | 0) >> 2] = $5;
               $6 = $4 + $3 | 0;
               HEAP32[(0 + 2812 | 0) >> 2] = $6;
               HEAP32[($6 + 4 | 0) >> 2] = $5 | 1 | 0;
               HEAP32[($4 + $0 | 0) >> 2] = $5;
               HEAP32[($4 + 4 | 0) >> 2] = $3 | 3 | 0;
               break label$42;
              }
              HEAP32[(0 + 2812 | 0) >> 2] = 0;
              HEAP32[(0 + 2800 | 0) >> 2] = 0;
              HEAP32[($4 + 4 | 0) >> 2] = $0 | 3 | 0;
              $0 = $4 + $0 | 0;
              HEAP32[($0 + 4 | 0) >> 2] = HEAP32[($0 + 4 | 0) >> 2] | 0 | 1 | 0;
             }
             $0 = $4 + 8 | 0;
             break label$1;
            }
            label$44 : {
             $6 = HEAP32[(0 + 2804 | 0) >> 2] | 0;
             if ($6 >>> 0 <= $3 >>> 0) {
              break label$44
             }
             $4 = $6 - $3 | 0;
             HEAP32[(0 + 2804 | 0) >> 2] = $4;
             $0 = HEAP32[(0 + 2816 | 0) >> 2] | 0;
             $5 = $0 + $3 | 0;
             HEAP32[(0 + 2816 | 0) >> 2] = $5;
             HEAP32[($5 + 4 | 0) >> 2] = $4 | 1 | 0;
             HEAP32[($0 + 4 | 0) >> 2] = $3 | 3 | 0;
             $0 = $0 + 8 | 0;
             break label$1;
            }
            label$45 : {
             label$46 : {
              if (!(HEAP32[(0 + 3264 | 0) >> 2] | 0)) {
               break label$46
              }
              $4 = HEAP32[(0 + 3272 | 0) >> 2] | 0;
              break label$45;
             }
             i64toi32_i32$1 = 0;
             i64toi32_i32$0 = -1;
             HEAP32[(i64toi32_i32$1 + 3276 | 0) >> 2] = -1;
             HEAP32[(i64toi32_i32$1 + 3280 | 0) >> 2] = i64toi32_i32$0;
             i64toi32_i32$1 = 0;
             i64toi32_i32$0 = 4096;
             HEAP32[(i64toi32_i32$1 + 3268 | 0) >> 2] = 4096;
             HEAP32[(i64toi32_i32$1 + 3272 | 0) >> 2] = i64toi32_i32$0;
             HEAP32[(0 + 3264 | 0) >> 2] = (($1 + 12 | 0) & -16 | 0) ^ 1431655768 | 0;
             HEAP32[(0 + 3284 | 0) >> 2] = 0;
             HEAP32[(0 + 3236 | 0) >> 2] = 0;
             $4 = 4096;
            }
            $0 = 0;
            $7 = $3 + 47 | 0;
            $2 = $4 + $7 | 0;
            $11 = 0 - $4 | 0;
            $8 = $2 & $11 | 0;
            if ($8 >>> 0 <= $3 >>> 0) {
             break label$1
            }
            $0 = 0;
            label$47 : {
             $4 = HEAP32[(0 + 3232 | 0) >> 2] | 0;
             if (!$4) {
              break label$47
             }
             $5 = HEAP32[(0 + 3224 | 0) >> 2] | 0;
             $9 = $5 + $8 | 0;
             if ($9 >>> 0 <= $5 >>> 0) {
              break label$1
             }
             if ($9 >>> 0 > $4 >>> 0) {
              break label$1
             }
            }
            if ((HEAPU8[(0 + 3236 | 0) >> 0] | 0) & 4 | 0) {
             break label$6
            }
            label$48 : {
             label$49 : {
              label$50 : {
               $4 = HEAP32[(0 + 2816 | 0) >> 2] | 0;
               if (!$4) {
                break label$50
               }
               $0 = 3240;
               label$51 : while (1) {
                label$52 : {
                 $5 = HEAP32[$0 >> 2] | 0;
                 if ($5 >>> 0 > $4 >>> 0) {
                  break label$52
                 }
                 if (($5 + (HEAP32[($0 + 4 | 0) >> 2] | 0) | 0) >>> 0 > $4 >>> 0) {
                  break label$49
                 }
                }
                $0 = HEAP32[($0 + 8 | 0) >> 2] | 0;
                if ($0) {
                 continue label$51
                }
                break label$51;
               };
              }
              $6 = sbrk(0 | 0) | 0;
              if (($6 | 0) == (-1 | 0)) {
               break label$7
              }
              $2 = $8;
              label$53 : {
               $0 = HEAP32[(0 + 3268 | 0) >> 2] | 0;
               $4 = $0 + -1 | 0;
               if (!($4 & $6 | 0)) {
                break label$53
               }
               $2 = ($8 - $6 | 0) + (($4 + $6 | 0) & (0 - $0 | 0) | 0) | 0;
              }
              if ($2 >>> 0 <= $3 >>> 0) {
               break label$7
              }
              if ($2 >>> 0 > 2147483646 >>> 0) {
               break label$7
              }
              label$54 : {
               $0 = HEAP32[(0 + 3232 | 0) >> 2] | 0;
               if (!$0) {
                break label$54
               }
               $4 = HEAP32[(0 + 3224 | 0) >> 2] | 0;
               $5 = $4 + $2 | 0;
               if ($5 >>> 0 <= $4 >>> 0) {
                break label$7
               }
               if ($5 >>> 0 > $0 >>> 0) {
                break label$7
               }
              }
              $0 = sbrk($2 | 0) | 0;
              if (($0 | 0) != ($6 | 0)) {
               break label$48
              }
              break label$5;
             }
             $2 = ($2 - $6 | 0) & $11 | 0;
             if ($2 >>> 0 > 2147483646 >>> 0) {
              break label$7
             }
             $6 = sbrk($2 | 0) | 0;
             if (($6 | 0) == ((HEAP32[$0 >> 2] | 0) + (HEAP32[($0 + 4 | 0) >> 2] | 0) | 0 | 0)) {
              break label$8
             }
             $0 = $6;
            }
            label$55 : {
             if (($0 | 0) == (-1 | 0)) {
              break label$55
             }
             if (($3 + 48 | 0) >>> 0 <= $2 >>> 0) {
              break label$55
             }
             label$56 : {
              $4 = HEAP32[(0 + 3272 | 0) >> 2] | 0;
              $4 = (($7 - $2 | 0) + $4 | 0) & (0 - $4 | 0) | 0;
              if ($4 >>> 0 <= 2147483646 >>> 0) {
               break label$56
              }
              $6 = $0;
              break label$5;
             }
             label$57 : {
              if ((sbrk($4 | 0) | 0 | 0) == (-1 | 0)) {
               break label$57
              }
              $2 = $4 + $2 | 0;
              $6 = $0;
              break label$5;
             }
             sbrk(0 - $2 | 0 | 0) | 0;
             break label$7;
            }
            $6 = $0;
            if (($0 | 0) != (-1 | 0)) {
             break label$5
            }
            break label$7;
           }
           $8 = 0;
           break label$2;
          }
          $6 = 0;
          break label$3;
         }
         if (($6 | 0) != (-1 | 0)) {
          break label$5
         }
        }
        HEAP32[(0 + 3236 | 0) >> 2] = HEAP32[(0 + 3236 | 0) >> 2] | 0 | 4 | 0;
       }
       if ($8 >>> 0 > 2147483646 >>> 0) {
        break label$4
       }
       $6 = sbrk($8 | 0) | 0;
       $0 = sbrk(0 | 0) | 0;
       if (($6 | 0) == (-1 | 0)) {
        break label$4
       }
       if (($0 | 0) == (-1 | 0)) {
        break label$4
       }
       if ($6 >>> 0 >= $0 >>> 0) {
        break label$4
       }
       $2 = $0 - $6 | 0;
       if ($2 >>> 0 <= ($3 + 40 | 0) >>> 0) {
        break label$4
       }
      }
      $0 = (HEAP32[(0 + 3224 | 0) >> 2] | 0) + $2 | 0;
      HEAP32[(0 + 3224 | 0) >> 2] = $0;
      label$58 : {
       if ($0 >>> 0 <= (HEAP32[(0 + 3228 | 0) >> 2] | 0) >>> 0) {
        break label$58
       }
       HEAP32[(0 + 3228 | 0) >> 2] = $0;
      }
      label$59 : {
       label$60 : {
        label$61 : {
         label$62 : {
          $4 = HEAP32[(0 + 2816 | 0) >> 2] | 0;
          if (!$4) {
           break label$62
          }
          $0 = 3240;
          label$63 : while (1) {
           $5 = HEAP32[$0 >> 2] | 0;
           $8 = HEAP32[($0 + 4 | 0) >> 2] | 0;
           if (($6 | 0) == ($5 + $8 | 0 | 0)) {
            break label$61
           }
           $0 = HEAP32[($0 + 8 | 0) >> 2] | 0;
           if ($0) {
            continue label$63
           }
           break label$60;
          };
         }
         label$64 : {
          label$65 : {
           $0 = HEAP32[(0 + 2808 | 0) >> 2] | 0;
           if (!$0) {
            break label$65
           }
           if ($6 >>> 0 >= $0 >>> 0) {
            break label$64
           }
          }
          HEAP32[(0 + 2808 | 0) >> 2] = $6;
         }
         $0 = 0;
         HEAP32[(0 + 3244 | 0) >> 2] = $2;
         HEAP32[(0 + 3240 | 0) >> 2] = $6;
         HEAP32[(0 + 2824 | 0) >> 2] = -1;
         HEAP32[(0 + 2828 | 0) >> 2] = HEAP32[(0 + 3264 | 0) >> 2] | 0;
         HEAP32[(0 + 3252 | 0) >> 2] = 0;
         label$66 : while (1) {
          $4 = $0 << 3 | 0;
          $5 = $4 + 2832 | 0;
          HEAP32[($4 + 2840 | 0) >> 2] = $5;
          HEAP32[($4 + 2844 | 0) >> 2] = $5;
          $0 = $0 + 1 | 0;
          if (($0 | 0) != (32 | 0)) {
           continue label$66
          }
          break label$66;
         };
         $0 = $2 + -40 | 0;
         $4 = ($6 + 8 | 0) & 7 | 0 ? (-8 - $6 | 0) & 7 | 0 : 0;
         $5 = $0 - $4 | 0;
         HEAP32[(0 + 2804 | 0) >> 2] = $5;
         $4 = $6 + $4 | 0;
         HEAP32[(0 + 2816 | 0) >> 2] = $4;
         HEAP32[($4 + 4 | 0) >> 2] = $5 | 1 | 0;
         HEAP32[(($6 + $0 | 0) + 4 | 0) >> 2] = 40;
         HEAP32[(0 + 2820 | 0) >> 2] = HEAP32[(0 + 3280 | 0) >> 2] | 0;
         break label$59;
        }
        if ((HEAPU8[($0 + 12 | 0) >> 0] | 0) & 8 | 0) {
         break label$60
        }
        if ($5 >>> 0 > $4 >>> 0) {
         break label$60
        }
        if ($6 >>> 0 <= $4 >>> 0) {
         break label$60
        }
        HEAP32[($0 + 4 | 0) >> 2] = $8 + $2 | 0;
        $0 = ($4 + 8 | 0) & 7 | 0 ? (-8 - $4 | 0) & 7 | 0 : 0;
        $5 = $4 + $0 | 0;
        HEAP32[(0 + 2816 | 0) >> 2] = $5;
        $6 = (HEAP32[(0 + 2804 | 0) >> 2] | 0) + $2 | 0;
        $0 = $6 - $0 | 0;
        HEAP32[(0 + 2804 | 0) >> 2] = $0;
        HEAP32[($5 + 4 | 0) >> 2] = $0 | 1 | 0;
        HEAP32[(($4 + $6 | 0) + 4 | 0) >> 2] = 40;
        HEAP32[(0 + 2820 | 0) >> 2] = HEAP32[(0 + 3280 | 0) >> 2] | 0;
        break label$59;
       }
       label$67 : {
        $8 = HEAP32[(0 + 2808 | 0) >> 2] | 0;
        if ($6 >>> 0 >= $8 >>> 0) {
         break label$67
        }
        HEAP32[(0 + 2808 | 0) >> 2] = $6;
        $8 = $6;
       }
       $5 = $6 + $2 | 0;
       $0 = 3240;
       label$68 : {
        label$69 : {
         label$70 : {
          label$71 : {
           label$72 : {
            label$73 : {
             label$74 : {
              label$75 : while (1) {
               if ((HEAP32[$0 >> 2] | 0 | 0) == ($5 | 0)) {
                break label$74
               }
               $0 = HEAP32[($0 + 8 | 0) >> 2] | 0;
               if ($0) {
                continue label$75
               }
               break label$73;
              };
             }
             if (!((HEAPU8[($0 + 12 | 0) >> 0] | 0) & 8 | 0)) {
              break label$72
             }
            }
            $0 = 3240;
            label$76 : while (1) {
             label$77 : {
              $5 = HEAP32[$0 >> 2] | 0;
              if ($5 >>> 0 > $4 >>> 0) {
               break label$77
              }
              $5 = $5 + (HEAP32[($0 + 4 | 0) >> 2] | 0) | 0;
              if ($5 >>> 0 > $4 >>> 0) {
               break label$71
              }
             }
             $0 = HEAP32[($0 + 8 | 0) >> 2] | 0;
             continue label$76;
            };
           }
           HEAP32[$0 >> 2] = $6;
           HEAP32[($0 + 4 | 0) >> 2] = (HEAP32[($0 + 4 | 0) >> 2] | 0) + $2 | 0;
           $11 = $6 + (($6 + 8 | 0) & 7 | 0 ? (-8 - $6 | 0) & 7 | 0 : 0) | 0;
           HEAP32[($11 + 4 | 0) >> 2] = $3 | 3 | 0;
           $2 = $5 + (($5 + 8 | 0) & 7 | 0 ? (-8 - $5 | 0) & 7 | 0 : 0) | 0;
           $3 = $11 + $3 | 0;
           $5 = $2 - $3 | 0;
           label$78 : {
            if (($4 | 0) != ($2 | 0)) {
             break label$78
            }
            HEAP32[(0 + 2816 | 0) >> 2] = $3;
            $0 = (HEAP32[(0 + 2804 | 0) >> 2] | 0) + $5 | 0;
            HEAP32[(0 + 2804 | 0) >> 2] = $0;
            HEAP32[($3 + 4 | 0) >> 2] = $0 | 1 | 0;
            break label$69;
           }
           label$79 : {
            if ((HEAP32[(0 + 2812 | 0) >> 2] | 0 | 0) != ($2 | 0)) {
             break label$79
            }
            HEAP32[(0 + 2812 | 0) >> 2] = $3;
            $0 = (HEAP32[(0 + 2800 | 0) >> 2] | 0) + $5 | 0;
            HEAP32[(0 + 2800 | 0) >> 2] = $0;
            HEAP32[($3 + 4 | 0) >> 2] = $0 | 1 | 0;
            HEAP32[($3 + $0 | 0) >> 2] = $0;
            break label$69;
           }
           label$80 : {
            $0 = HEAP32[($2 + 4 | 0) >> 2] | 0;
            if (($0 & 3 | 0 | 0) != (1 | 0)) {
             break label$80
            }
            $7 = $0 & -8 | 0;
            label$81 : {
             label$82 : {
              if ($0 >>> 0 > 255 >>> 0) {
               break label$82
              }
              $4 = HEAP32[($2 + 8 | 0) >> 2] | 0;
              $8 = $0 >>> 3 | 0;
              $6 = ($8 << 3 | 0) + 2832 | 0;
              label$83 : {
               $0 = HEAP32[($2 + 12 | 0) >> 2] | 0;
               if (($0 | 0) != ($4 | 0)) {
                break label$83
               }
               HEAP32[(0 + 2792 | 0) >> 2] = (HEAP32[(0 + 2792 | 0) >> 2] | 0) & (__wasm_rotl_i32(-2 | 0, $8 | 0) | 0) | 0;
               break label$81;
              }
              HEAP32[($4 + 12 | 0) >> 2] = $0;
              HEAP32[($0 + 8 | 0) >> 2] = $4;
              break label$81;
             }
             $9 = HEAP32[($2 + 24 | 0) >> 2] | 0;
             label$84 : {
              label$85 : {
               $6 = HEAP32[($2 + 12 | 0) >> 2] | 0;
               if (($6 | 0) == ($2 | 0)) {
                break label$85
               }
               $0 = HEAP32[($2 + 8 | 0) >> 2] | 0;
               HEAP32[($0 + 12 | 0) >> 2] = $6;
               HEAP32[($6 + 8 | 0) >> 2] = $0;
               break label$84;
              }
              label$86 : {
               $0 = $2 + 20 | 0;
               $4 = HEAP32[$0 >> 2] | 0;
               if ($4) {
                break label$86
               }
               $0 = $2 + 16 | 0;
               $4 = HEAP32[$0 >> 2] | 0;
               if ($4) {
                break label$86
               }
               $6 = 0;
               break label$84;
              }
              label$87 : while (1) {
               $8 = $0;
               $6 = $4;
               $0 = $4 + 20 | 0;
               $4 = HEAP32[$0 >> 2] | 0;
               if ($4) {
                continue label$87
               }
               $0 = $6 + 16 | 0;
               $4 = HEAP32[($6 + 16 | 0) >> 2] | 0;
               if ($4) {
                continue label$87
               }
               break label$87;
              };
              HEAP32[$8 >> 2] = 0;
             }
             if (!$9) {
              break label$81
             }
             label$88 : {
              label$89 : {
               $4 = HEAP32[($2 + 28 | 0) >> 2] | 0;
               $0 = ($4 << 2 | 0) + 3096 | 0;
               if ((HEAP32[$0 >> 2] | 0 | 0) != ($2 | 0)) {
                break label$89
               }
               HEAP32[$0 >> 2] = $6;
               if ($6) {
                break label$88
               }
               HEAP32[(0 + 2796 | 0) >> 2] = (HEAP32[(0 + 2796 | 0) >> 2] | 0) & (__wasm_rotl_i32(-2 | 0, $4 | 0) | 0) | 0;
               break label$81;
              }
              HEAP32[($9 + ((HEAP32[($9 + 16 | 0) >> 2] | 0 | 0) == ($2 | 0) ? 16 : 20) | 0) >> 2] = $6;
              if (!$6) {
               break label$81
              }
             }
             HEAP32[($6 + 24 | 0) >> 2] = $9;
             label$90 : {
              $0 = HEAP32[($2 + 16 | 0) >> 2] | 0;
              if (!$0) {
               break label$90
              }
              HEAP32[($6 + 16 | 0) >> 2] = $0;
              HEAP32[($0 + 24 | 0) >> 2] = $6;
             }
             $0 = HEAP32[($2 + 20 | 0) >> 2] | 0;
             if (!$0) {
              break label$81
             }
             HEAP32[($6 + 20 | 0) >> 2] = $0;
             HEAP32[($0 + 24 | 0) >> 2] = $6;
            }
            $5 = $7 + $5 | 0;
            $2 = $2 + $7 | 0;
           }
           HEAP32[($2 + 4 | 0) >> 2] = (HEAP32[($2 + 4 | 0) >> 2] | 0) & -2 | 0;
           HEAP32[($3 + 4 | 0) >> 2] = $5 | 1 | 0;
           HEAP32[($3 + $5 | 0) >> 2] = $5;
           label$91 : {
            if ($5 >>> 0 > 255 >>> 0) {
             break label$91
            }
            $4 = $5 >>> 3 | 0;
            $0 = ($4 << 3 | 0) + 2832 | 0;
            label$92 : {
             label$93 : {
              $5 = HEAP32[(0 + 2792 | 0) >> 2] | 0;
              $4 = 1 << $4 | 0;
              if ($5 & $4 | 0) {
               break label$93
              }
              HEAP32[(0 + 2792 | 0) >> 2] = $5 | $4 | 0;
              $4 = $0;
              break label$92;
             }
             $4 = HEAP32[($0 + 8 | 0) >> 2] | 0;
            }
            HEAP32[($0 + 8 | 0) >> 2] = $3;
            HEAP32[($4 + 12 | 0) >> 2] = $3;
            HEAP32[($3 + 12 | 0) >> 2] = $0;
            HEAP32[($3 + 8 | 0) >> 2] = $4;
            break label$69;
           }
           $0 = 31;
           label$94 : {
            if ($5 >>> 0 > 16777215 >>> 0) {
             break label$94
            }
            $0 = $5 >>> 8 | 0;
            $1157 = $0;
            $0 = (($0 + 1048320 | 0) >>> 16 | 0) & 8 | 0;
            $4 = $1157 << $0 | 0;
            $1164 = $4;
            $4 = (($4 + 520192 | 0) >>> 16 | 0) & 4 | 0;
            $6 = $1164 << $4 | 0;
            $1171 = $6;
            $6 = (($6 + 245760 | 0) >>> 16 | 0) & 2 | 0;
            $0 = (($1171 << $6 | 0) >>> 15 | 0) - ($0 | $4 | 0 | $6 | 0) | 0;
            $0 = ($0 << 1 | 0 | (($5 >>> ($0 + 21 | 0) | 0) & 1 | 0) | 0) + 28 | 0;
           }
           HEAP32[($3 + 28 | 0) >> 2] = $0;
           i64toi32_i32$1 = $3;
           i64toi32_i32$0 = 0;
           HEAP32[($3 + 16 | 0) >> 2] = 0;
           HEAP32[($3 + 20 | 0) >> 2] = i64toi32_i32$0;
           $4 = ($0 << 2 | 0) + 3096 | 0;
           label$95 : {
            label$96 : {
             $6 = HEAP32[(0 + 2796 | 0) >> 2] | 0;
             $8 = 1 << $0 | 0;
             if ($6 & $8 | 0) {
              break label$96
             }
             HEAP32[(0 + 2796 | 0) >> 2] = $6 | $8 | 0;
             HEAP32[$4 >> 2] = $3;
             HEAP32[($3 + 24 | 0) >> 2] = $4;
             break label$95;
            }
            $0 = $5 << (($0 | 0) == (31 | 0) ? 0 : 25 - ($0 >>> 1 | 0) | 0) | 0;
            $6 = HEAP32[$4 >> 2] | 0;
            label$97 : while (1) {
             $4 = $6;
             if (((HEAP32[($4 + 4 | 0) >> 2] | 0) & -8 | 0 | 0) == ($5 | 0)) {
              break label$70
             }
             $6 = $0 >>> 29 | 0;
             $0 = $0 << 1 | 0;
             $8 = ($4 + ($6 & 4 | 0) | 0) + 16 | 0;
             $6 = HEAP32[$8 >> 2] | 0;
             if ($6) {
              continue label$97
             }
             break label$97;
            };
            HEAP32[$8 >> 2] = $3;
            HEAP32[($3 + 24 | 0) >> 2] = $4;
           }
           HEAP32[($3 + 12 | 0) >> 2] = $3;
           HEAP32[($3 + 8 | 0) >> 2] = $3;
           break label$69;
          }
          $0 = $2 + -40 | 0;
          $8 = ($6 + 8 | 0) & 7 | 0 ? (-8 - $6 | 0) & 7 | 0 : 0;
          $11 = $0 - $8 | 0;
          HEAP32[(0 + 2804 | 0) >> 2] = $11;
          $8 = $6 + $8 | 0;
          HEAP32[(0 + 2816 | 0) >> 2] = $8;
          HEAP32[($8 + 4 | 0) >> 2] = $11 | 1 | 0;
          HEAP32[(($6 + $0 | 0) + 4 | 0) >> 2] = 40;
          HEAP32[(0 + 2820 | 0) >> 2] = HEAP32[(0 + 3280 | 0) >> 2] | 0;
          $0 = ($5 + (($5 + -39 | 0) & 7 | 0 ? (39 - $5 | 0) & 7 | 0 : 0) | 0) + -47 | 0;
          $8 = $0 >>> 0 < ($4 + 16 | 0) >>> 0 ? $4 : $0;
          HEAP32[($8 + 4 | 0) >> 2] = 27;
          i64toi32_i32$2 = 0;
          i64toi32_i32$0 = HEAP32[(i64toi32_i32$2 + 3248 | 0) >> 2] | 0;
          i64toi32_i32$1 = HEAP32[(i64toi32_i32$2 + 3252 | 0) >> 2] | 0;
          $1293 = i64toi32_i32$0;
          i64toi32_i32$0 = $8 + 16 | 0;
          HEAP32[i64toi32_i32$0 >> 2] = $1293;
          HEAP32[(i64toi32_i32$0 + 4 | 0) >> 2] = i64toi32_i32$1;
          i64toi32_i32$2 = 0;
          i64toi32_i32$1 = HEAP32[(i64toi32_i32$2 + 3240 | 0) >> 2] | 0;
          i64toi32_i32$0 = HEAP32[(i64toi32_i32$2 + 3244 | 0) >> 2] | 0;
          $1295 = i64toi32_i32$1;
          i64toi32_i32$1 = $8;
          HEAP32[($8 + 8 | 0) >> 2] = $1295;
          HEAP32[($8 + 12 | 0) >> 2] = i64toi32_i32$0;
          HEAP32[(0 + 3248 | 0) >> 2] = $8 + 8 | 0;
          HEAP32[(0 + 3244 | 0) >> 2] = $2;
          HEAP32[(0 + 3240 | 0) >> 2] = $6;
          HEAP32[(0 + 3252 | 0) >> 2] = 0;
          $0 = $8 + 24 | 0;
          label$98 : while (1) {
           HEAP32[($0 + 4 | 0) >> 2] = 7;
           $6 = $0 + 8 | 0;
           $0 = $0 + 4 | 0;
           if ($5 >>> 0 > $6 >>> 0) {
            continue label$98
           }
           break label$98;
          };
          if (($8 | 0) == ($4 | 0)) {
           break label$59
          }
          HEAP32[($8 + 4 | 0) >> 2] = (HEAP32[($8 + 4 | 0) >> 2] | 0) & -2 | 0;
          $2 = $8 - $4 | 0;
          HEAP32[($4 + 4 | 0) >> 2] = $2 | 1 | 0;
          HEAP32[$8 >> 2] = $2;
          label$99 : {
           if ($2 >>> 0 > 255 >>> 0) {
            break label$99
           }
           $5 = $2 >>> 3 | 0;
           $0 = ($5 << 3 | 0) + 2832 | 0;
           label$100 : {
            label$101 : {
             $6 = HEAP32[(0 + 2792 | 0) >> 2] | 0;
             $5 = 1 << $5 | 0;
             if ($6 & $5 | 0) {
              break label$101
             }
             HEAP32[(0 + 2792 | 0) >> 2] = $6 | $5 | 0;
             $5 = $0;
             break label$100;
            }
            $5 = HEAP32[($0 + 8 | 0) >> 2] | 0;
           }
           HEAP32[($0 + 8 | 0) >> 2] = $4;
           HEAP32[($5 + 12 | 0) >> 2] = $4;
           HEAP32[($4 + 12 | 0) >> 2] = $0;
           HEAP32[($4 + 8 | 0) >> 2] = $5;
           break label$59;
          }
          $0 = 31;
          label$102 : {
           if ($2 >>> 0 > 16777215 >>> 0) {
            break label$102
           }
           $0 = $2 >>> 8 | 0;
           $1356 = $0;
           $0 = (($0 + 1048320 | 0) >>> 16 | 0) & 8 | 0;
           $5 = $1356 << $0 | 0;
           $1363 = $5;
           $5 = (($5 + 520192 | 0) >>> 16 | 0) & 4 | 0;
           $6 = $1363 << $5 | 0;
           $1370 = $6;
           $6 = (($6 + 245760 | 0) >>> 16 | 0) & 2 | 0;
           $0 = (($1370 << $6 | 0) >>> 15 | 0) - ($0 | $5 | 0 | $6 | 0) | 0;
           $0 = ($0 << 1 | 0 | (($2 >>> ($0 + 21 | 0) | 0) & 1 | 0) | 0) + 28 | 0;
          }
          i64toi32_i32$1 = $4;
          i64toi32_i32$0 = 0;
          HEAP32[($4 + 16 | 0) >> 2] = 0;
          HEAP32[($4 + 20 | 0) >> 2] = i64toi32_i32$0;
          HEAP32[($4 + 28 | 0) >> 2] = $0;
          $5 = ($0 << 2 | 0) + 3096 | 0;
          label$103 : {
           label$104 : {
            $6 = HEAP32[(0 + 2796 | 0) >> 2] | 0;
            $8 = 1 << $0 | 0;
            if ($6 & $8 | 0) {
             break label$104
            }
            HEAP32[(0 + 2796 | 0) >> 2] = $6 | $8 | 0;
            HEAP32[$5 >> 2] = $4;
            HEAP32[($4 + 24 | 0) >> 2] = $5;
            break label$103;
           }
           $0 = $2 << (($0 | 0) == (31 | 0) ? 0 : 25 - ($0 >>> 1 | 0) | 0) | 0;
           $6 = HEAP32[$5 >> 2] | 0;
           label$105 : while (1) {
            $5 = $6;
            if (((HEAP32[($6 + 4 | 0) >> 2] | 0) & -8 | 0 | 0) == ($2 | 0)) {
             break label$68
            }
            $6 = $0 >>> 29 | 0;
            $0 = $0 << 1 | 0;
            $8 = ($5 + ($6 & 4 | 0) | 0) + 16 | 0;
            $6 = HEAP32[$8 >> 2] | 0;
            if ($6) {
             continue label$105
            }
            break label$105;
           };
           HEAP32[$8 >> 2] = $4;
           HEAP32[($4 + 24 | 0) >> 2] = $5;
          }
          HEAP32[($4 + 12 | 0) >> 2] = $4;
          HEAP32[($4 + 8 | 0) >> 2] = $4;
          break label$59;
         }
         $0 = HEAP32[($4 + 8 | 0) >> 2] | 0;
         HEAP32[($0 + 12 | 0) >> 2] = $3;
         HEAP32[($4 + 8 | 0) >> 2] = $3;
         HEAP32[($3 + 24 | 0) >> 2] = 0;
         HEAP32[($3 + 12 | 0) >> 2] = $4;
         HEAP32[($3 + 8 | 0) >> 2] = $0;
        }
        $0 = $11 + 8 | 0;
        break label$1;
       }
       $0 = HEAP32[($5 + 8 | 0) >> 2] | 0;
       HEAP32[($0 + 12 | 0) >> 2] = $4;
       HEAP32[($5 + 8 | 0) >> 2] = $4;
       HEAP32[($4 + 24 | 0) >> 2] = 0;
       HEAP32[($4 + 12 | 0) >> 2] = $5;
       HEAP32[($4 + 8 | 0) >> 2] = $0;
      }
      $0 = HEAP32[(0 + 2804 | 0) >> 2] | 0;
      if ($0 >>> 0 <= $3 >>> 0) {
       break label$4
      }
      $4 = $0 - $3 | 0;
      HEAP32[(0 + 2804 | 0) >> 2] = $4;
      $0 = HEAP32[(0 + 2816 | 0) >> 2] | 0;
      $5 = $0 + $3 | 0;
      HEAP32[(0 + 2816 | 0) >> 2] = $5;
      HEAP32[($5 + 4 | 0) >> 2] = $4 | 1 | 0;
      HEAP32[($0 + 4 | 0) >> 2] = $3 | 3 | 0;
      $0 = $0 + 8 | 0;
      break label$1;
     }
     HEAP32[(__errno_location() | 0) >> 2] = 48;
     $0 = 0;
     break label$1;
    }
    label$106 : {
     if (!$11) {
      break label$106
     }
     label$107 : {
      label$108 : {
       $5 = HEAP32[($8 + 28 | 0) >> 2] | 0;
       $0 = ($5 << 2 | 0) + 3096 | 0;
       if (($8 | 0) != (HEAP32[$0 >> 2] | 0 | 0)) {
        break label$108
       }
       HEAP32[$0 >> 2] = $6;
       if ($6) {
        break label$107
       }
       $7 = $7 & (__wasm_rotl_i32(-2 | 0, $5 | 0) | 0) | 0;
       HEAP32[(0 + 2796 | 0) >> 2] = $7;
       break label$106;
      }
      HEAP32[($11 + ((HEAP32[($11 + 16 | 0) >> 2] | 0 | 0) == ($8 | 0) ? 16 : 20) | 0) >> 2] = $6;
      if (!$6) {
       break label$106
      }
     }
     HEAP32[($6 + 24 | 0) >> 2] = $11;
     label$109 : {
      $0 = HEAP32[($8 + 16 | 0) >> 2] | 0;
      if (!$0) {
       break label$109
      }
      HEAP32[($6 + 16 | 0) >> 2] = $0;
      HEAP32[($0 + 24 | 0) >> 2] = $6;
     }
     $0 = HEAP32[($8 + 20 | 0) >> 2] | 0;
     if (!$0) {
      break label$106
     }
     HEAP32[($6 + 20 | 0) >> 2] = $0;
     HEAP32[($0 + 24 | 0) >> 2] = $6;
    }
    label$110 : {
     label$111 : {
      if ($4 >>> 0 > 15 >>> 0) {
       break label$111
      }
      $0 = $4 + $3 | 0;
      HEAP32[($8 + 4 | 0) >> 2] = $0 | 3 | 0;
      $0 = $8 + $0 | 0;
      HEAP32[($0 + 4 | 0) >> 2] = HEAP32[($0 + 4 | 0) >> 2] | 0 | 1 | 0;
      break label$110;
     }
     HEAP32[($8 + 4 | 0) >> 2] = $3 | 3 | 0;
     $6 = $8 + $3 | 0;
     HEAP32[($6 + 4 | 0) >> 2] = $4 | 1 | 0;
     HEAP32[($6 + $4 | 0) >> 2] = $4;
     label$112 : {
      if ($4 >>> 0 > 255 >>> 0) {
       break label$112
      }
      $4 = $4 >>> 3 | 0;
      $0 = ($4 << 3 | 0) + 2832 | 0;
      label$113 : {
       label$114 : {
        $5 = HEAP32[(0 + 2792 | 0) >> 2] | 0;
        $4 = 1 << $4 | 0;
        if ($5 & $4 | 0) {
         break label$114
        }
        HEAP32[(0 + 2792 | 0) >> 2] = $5 | $4 | 0;
        $4 = $0;
        break label$113;
       }
       $4 = HEAP32[($0 + 8 | 0) >> 2] | 0;
      }
      HEAP32[($0 + 8 | 0) >> 2] = $6;
      HEAP32[($4 + 12 | 0) >> 2] = $6;
      HEAP32[($6 + 12 | 0) >> 2] = $0;
      HEAP32[($6 + 8 | 0) >> 2] = $4;
      break label$110;
     }
     $0 = 31;
     label$115 : {
      if ($4 >>> 0 > 16777215 >>> 0) {
       break label$115
      }
      $0 = $4 >>> 8 | 0;
      $1606 = $0;
      $0 = (($0 + 1048320 | 0) >>> 16 | 0) & 8 | 0;
      $5 = $1606 << $0 | 0;
      $1613 = $5;
      $5 = (($5 + 520192 | 0) >>> 16 | 0) & 4 | 0;
      $3 = $1613 << $5 | 0;
      $1620 = $3;
      $3 = (($3 + 245760 | 0) >>> 16 | 0) & 2 | 0;
      $0 = (($1620 << $3 | 0) >>> 15 | 0) - ($0 | $5 | 0 | $3 | 0) | 0;
      $0 = ($0 << 1 | 0 | (($4 >>> ($0 + 21 | 0) | 0) & 1 | 0) | 0) + 28 | 0;
     }
     HEAP32[($6 + 28 | 0) >> 2] = $0;
     i64toi32_i32$1 = $6;
     i64toi32_i32$0 = 0;
     HEAP32[($6 + 16 | 0) >> 2] = 0;
     HEAP32[($6 + 20 | 0) >> 2] = i64toi32_i32$0;
     $5 = ($0 << 2 | 0) + 3096 | 0;
     label$116 : {
      label$117 : {
       label$118 : {
        $3 = 1 << $0 | 0;
        if ($7 & $3 | 0) {
         break label$118
        }
        HEAP32[(0 + 2796 | 0) >> 2] = $7 | $3 | 0;
        HEAP32[$5 >> 2] = $6;
        HEAP32[($6 + 24 | 0) >> 2] = $5;
        break label$117;
       }
       $0 = $4 << (($0 | 0) == (31 | 0) ? 0 : 25 - ($0 >>> 1 | 0) | 0) | 0;
       $3 = HEAP32[$5 >> 2] | 0;
       label$119 : while (1) {
        $5 = $3;
        if (((HEAP32[($5 + 4 | 0) >> 2] | 0) & -8 | 0 | 0) == ($4 | 0)) {
         break label$116
        }
        $3 = $0 >>> 29 | 0;
        $0 = $0 << 1 | 0;
        $2 = ($5 + ($3 & 4 | 0) | 0) + 16 | 0;
        $3 = HEAP32[$2 >> 2] | 0;
        if ($3) {
         continue label$119
        }
        break label$119;
       };
       HEAP32[$2 >> 2] = $6;
       HEAP32[($6 + 24 | 0) >> 2] = $5;
      }
      HEAP32[($6 + 12 | 0) >> 2] = $6;
      HEAP32[($6 + 8 | 0) >> 2] = $6;
      break label$110;
     }
     $0 = HEAP32[($5 + 8 | 0) >> 2] | 0;
     HEAP32[($0 + 12 | 0) >> 2] = $6;
     HEAP32[($5 + 8 | 0) >> 2] = $6;
     HEAP32[($6 + 24 | 0) >> 2] = 0;
     HEAP32[($6 + 12 | 0) >> 2] = $5;
     HEAP32[($6 + 8 | 0) >> 2] = $0;
    }
    $0 = $8 + 8 | 0;
    break label$1;
   }
   label$120 : {
    if (!$10) {
     break label$120
    }
    label$121 : {
     label$122 : {
      $5 = HEAP32[($6 + 28 | 0) >> 2] | 0;
      $0 = ($5 << 2 | 0) + 3096 | 0;
      if (($6 | 0) != (HEAP32[$0 >> 2] | 0 | 0)) {
       break label$122
      }
      HEAP32[$0 >> 2] = $8;
      if ($8) {
       break label$121
      }
      HEAP32[(0 + 2796 | 0) >> 2] = $9 & (__wasm_rotl_i32(-2 | 0, $5 | 0) | 0) | 0;
      break label$120;
     }
     HEAP32[($10 + ((HEAP32[($10 + 16 | 0) >> 2] | 0 | 0) == ($6 | 0) ? 16 : 20) | 0) >> 2] = $8;
     if (!$8) {
      break label$120
     }
    }
    HEAP32[($8 + 24 | 0) >> 2] = $10;
    label$123 : {
     $0 = HEAP32[($6 + 16 | 0) >> 2] | 0;
     if (!$0) {
      break label$123
     }
     HEAP32[($8 + 16 | 0) >> 2] = $0;
     HEAP32[($0 + 24 | 0) >> 2] = $8;
    }
    $0 = HEAP32[($6 + 20 | 0) >> 2] | 0;
    if (!$0) {
     break label$120
    }
    HEAP32[($8 + 20 | 0) >> 2] = $0;
    HEAP32[($0 + 24 | 0) >> 2] = $8;
   }
   label$124 : {
    label$125 : {
     if ($4 >>> 0 > 15 >>> 0) {
      break label$125
     }
     $0 = $4 + $3 | 0;
     HEAP32[($6 + 4 | 0) >> 2] = $0 | 3 | 0;
     $0 = $6 + $0 | 0;
     HEAP32[($0 + 4 | 0) >> 2] = HEAP32[($0 + 4 | 0) >> 2] | 0 | 1 | 0;
     break label$124;
    }
    HEAP32[($6 + 4 | 0) >> 2] = $3 | 3 | 0;
    $5 = $6 + $3 | 0;
    HEAP32[($5 + 4 | 0) >> 2] = $4 | 1 | 0;
    HEAP32[($5 + $4 | 0) >> 2] = $4;
    label$126 : {
     if (!$7) {
      break label$126
     }
     $8 = $7 >>> 3 | 0;
     $3 = ($8 << 3 | 0) + 2832 | 0;
     $0 = HEAP32[(0 + 2812 | 0) >> 2] | 0;
     label$127 : {
      label$128 : {
       $8 = 1 << $8 | 0;
       if ($8 & $2 | 0) {
        break label$128
       }
       HEAP32[(0 + 2792 | 0) >> 2] = $8 | $2 | 0;
       $8 = $3;
       break label$127;
      }
      $8 = HEAP32[($3 + 8 | 0) >> 2] | 0;
     }
     HEAP32[($3 + 8 | 0) >> 2] = $0;
     HEAP32[($8 + 12 | 0) >> 2] = $0;
     HEAP32[($0 + 12 | 0) >> 2] = $3;
     HEAP32[($0 + 8 | 0) >> 2] = $8;
    }
    HEAP32[(0 + 2812 | 0) >> 2] = $5;
    HEAP32[(0 + 2800 | 0) >> 2] = $4;
   }
   $0 = $6 + 8 | 0;
  }
  __stack_pointer = $1 + 16 | 0;
  return $0 | 0;
 }
 
 function dlfree($0) {
  $0 = $0 | 0;
  var $2 = 0, $6 = 0, $1 = 0, $4 = 0, $3 = 0, $5 = 0, $7 = 0, $379 = 0, $386 = 0, $393 = 0;
  label$1 : {
   if (!$0) {
    break label$1
   }
   $1 = $0 + -8 | 0;
   $2 = HEAP32[($0 + -4 | 0) >> 2] | 0;
   $0 = $2 & -8 | 0;
   $3 = $1 + $0 | 0;
   label$2 : {
    if ($2 & 1 | 0) {
     break label$2
    }
    if (!($2 & 3 | 0)) {
     break label$1
    }
    $2 = HEAP32[$1 >> 2] | 0;
    $1 = $1 - $2 | 0;
    $4 = HEAP32[(0 + 2808 | 0) >> 2] | 0;
    if ($1 >>> 0 < $4 >>> 0) {
     break label$1
    }
    $0 = $2 + $0 | 0;
    label$3 : {
     if ((HEAP32[(0 + 2812 | 0) >> 2] | 0 | 0) == ($1 | 0)) {
      break label$3
     }
     label$4 : {
      if ($2 >>> 0 > 255 >>> 0) {
       break label$4
      }
      $4 = HEAP32[($1 + 8 | 0) >> 2] | 0;
      $5 = $2 >>> 3 | 0;
      $6 = ($5 << 3 | 0) + 2832 | 0;
      label$5 : {
       $2 = HEAP32[($1 + 12 | 0) >> 2] | 0;
       if (($2 | 0) != ($4 | 0)) {
        break label$5
       }
       HEAP32[(0 + 2792 | 0) >> 2] = (HEAP32[(0 + 2792 | 0) >> 2] | 0) & (__wasm_rotl_i32(-2 | 0, $5 | 0) | 0) | 0;
       break label$2;
      }
      HEAP32[($4 + 12 | 0) >> 2] = $2;
      HEAP32[($2 + 8 | 0) >> 2] = $4;
      break label$2;
     }
     $7 = HEAP32[($1 + 24 | 0) >> 2] | 0;
     label$6 : {
      label$7 : {
       $6 = HEAP32[($1 + 12 | 0) >> 2] | 0;
       if (($6 | 0) == ($1 | 0)) {
        break label$7
       }
       $2 = HEAP32[($1 + 8 | 0) >> 2] | 0;
       HEAP32[($2 + 12 | 0) >> 2] = $6;
       HEAP32[($6 + 8 | 0) >> 2] = $2;
       break label$6;
      }
      label$8 : {
       $2 = $1 + 20 | 0;
       $4 = HEAP32[$2 >> 2] | 0;
       if ($4) {
        break label$8
       }
       $2 = $1 + 16 | 0;
       $4 = HEAP32[$2 >> 2] | 0;
       if ($4) {
        break label$8
       }
       $6 = 0;
       break label$6;
      }
      label$9 : while (1) {
       $5 = $2;
       $6 = $4;
       $2 = $6 + 20 | 0;
       $4 = HEAP32[$2 >> 2] | 0;
       if ($4) {
        continue label$9
       }
       $2 = $6 + 16 | 0;
       $4 = HEAP32[($6 + 16 | 0) >> 2] | 0;
       if ($4) {
        continue label$9
       }
       break label$9;
      };
      HEAP32[$5 >> 2] = 0;
     }
     if (!$7) {
      break label$2
     }
     label$10 : {
      label$11 : {
       $4 = HEAP32[($1 + 28 | 0) >> 2] | 0;
       $2 = ($4 << 2 | 0) + 3096 | 0;
       if ((HEAP32[$2 >> 2] | 0 | 0) != ($1 | 0)) {
        break label$11
       }
       HEAP32[$2 >> 2] = $6;
       if ($6) {
        break label$10
       }
       HEAP32[(0 + 2796 | 0) >> 2] = (HEAP32[(0 + 2796 | 0) >> 2] | 0) & (__wasm_rotl_i32(-2 | 0, $4 | 0) | 0) | 0;
       break label$2;
      }
      HEAP32[($7 + ((HEAP32[($7 + 16 | 0) >> 2] | 0 | 0) == ($1 | 0) ? 16 : 20) | 0) >> 2] = $6;
      if (!$6) {
       break label$2
      }
     }
     HEAP32[($6 + 24 | 0) >> 2] = $7;
     label$12 : {
      $2 = HEAP32[($1 + 16 | 0) >> 2] | 0;
      if (!$2) {
       break label$12
      }
      HEAP32[($6 + 16 | 0) >> 2] = $2;
      HEAP32[($2 + 24 | 0) >> 2] = $6;
     }
     $2 = HEAP32[($1 + 20 | 0) >> 2] | 0;
     if (!$2) {
      break label$2
     }
     HEAP32[($6 + 20 | 0) >> 2] = $2;
     HEAP32[($2 + 24 | 0) >> 2] = $6;
     break label$2;
    }
    $2 = HEAP32[($3 + 4 | 0) >> 2] | 0;
    if (($2 & 3 | 0 | 0) != (3 | 0)) {
     break label$2
    }
    HEAP32[(0 + 2800 | 0) >> 2] = $0;
    HEAP32[($3 + 4 | 0) >> 2] = $2 & -2 | 0;
    HEAP32[($1 + 4 | 0) >> 2] = $0 | 1 | 0;
    HEAP32[($1 + $0 | 0) >> 2] = $0;
    return;
   }
   if ($3 >>> 0 <= $1 >>> 0) {
    break label$1
   }
   $2 = HEAP32[($3 + 4 | 0) >> 2] | 0;
   if (!($2 & 1 | 0)) {
    break label$1
   }
   label$13 : {
    label$14 : {
     if ($2 & 2 | 0) {
      break label$14
     }
     label$15 : {
      if ((HEAP32[(0 + 2816 | 0) >> 2] | 0 | 0) != ($3 | 0)) {
       break label$15
      }
      HEAP32[(0 + 2816 | 0) >> 2] = $1;
      $0 = (HEAP32[(0 + 2804 | 0) >> 2] | 0) + $0 | 0;
      HEAP32[(0 + 2804 | 0) >> 2] = $0;
      HEAP32[($1 + 4 | 0) >> 2] = $0 | 1 | 0;
      if (($1 | 0) != (HEAP32[(0 + 2812 | 0) >> 2] | 0 | 0)) {
       break label$1
      }
      HEAP32[(0 + 2800 | 0) >> 2] = 0;
      HEAP32[(0 + 2812 | 0) >> 2] = 0;
      return;
     }
     label$16 : {
      if ((HEAP32[(0 + 2812 | 0) >> 2] | 0 | 0) != ($3 | 0)) {
       break label$16
      }
      HEAP32[(0 + 2812 | 0) >> 2] = $1;
      $0 = (HEAP32[(0 + 2800 | 0) >> 2] | 0) + $0 | 0;
      HEAP32[(0 + 2800 | 0) >> 2] = $0;
      HEAP32[($1 + 4 | 0) >> 2] = $0 | 1 | 0;
      HEAP32[($1 + $0 | 0) >> 2] = $0;
      return;
     }
     $0 = ($2 & -8 | 0) + $0 | 0;
     label$17 : {
      label$18 : {
       if ($2 >>> 0 > 255 >>> 0) {
        break label$18
       }
       $4 = HEAP32[($3 + 8 | 0) >> 2] | 0;
       $5 = $2 >>> 3 | 0;
       $6 = ($5 << 3 | 0) + 2832 | 0;
       label$19 : {
        $2 = HEAP32[($3 + 12 | 0) >> 2] | 0;
        if (($2 | 0) != ($4 | 0)) {
         break label$19
        }
        HEAP32[(0 + 2792 | 0) >> 2] = (HEAP32[(0 + 2792 | 0) >> 2] | 0) & (__wasm_rotl_i32(-2 | 0, $5 | 0) | 0) | 0;
        break label$17;
       }
       HEAP32[($4 + 12 | 0) >> 2] = $2;
       HEAP32[($2 + 8 | 0) >> 2] = $4;
       break label$17;
      }
      $7 = HEAP32[($3 + 24 | 0) >> 2] | 0;
      label$20 : {
       label$21 : {
        $6 = HEAP32[($3 + 12 | 0) >> 2] | 0;
        if (($6 | 0) == ($3 | 0)) {
         break label$21
        }
        $2 = HEAP32[($3 + 8 | 0) >> 2] | 0;
        HEAP32[(0 + 2808 | 0) >> 2] | 0;
        HEAP32[($2 + 12 | 0) >> 2] = $6;
        HEAP32[($6 + 8 | 0) >> 2] = $2;
        break label$20;
       }
       label$22 : {
        $2 = $3 + 20 | 0;
        $4 = HEAP32[$2 >> 2] | 0;
        if ($4) {
         break label$22
        }
        $2 = $3 + 16 | 0;
        $4 = HEAP32[$2 >> 2] | 0;
        if ($4) {
         break label$22
        }
        $6 = 0;
        break label$20;
       }
       label$23 : while (1) {
        $5 = $2;
        $6 = $4;
        $2 = $6 + 20 | 0;
        $4 = HEAP32[$2 >> 2] | 0;
        if ($4) {
         continue label$23
        }
        $2 = $6 + 16 | 0;
        $4 = HEAP32[($6 + 16 | 0) >> 2] | 0;
        if ($4) {
         continue label$23
        }
        break label$23;
       };
       HEAP32[$5 >> 2] = 0;
      }
      if (!$7) {
       break label$17
      }
      label$24 : {
       label$25 : {
        $4 = HEAP32[($3 + 28 | 0) >> 2] | 0;
        $2 = ($4 << 2 | 0) + 3096 | 0;
        if ((HEAP32[$2 >> 2] | 0 | 0) != ($3 | 0)) {
         break label$25
        }
        HEAP32[$2 >> 2] = $6;
        if ($6) {
         break label$24
        }
        HEAP32[(0 + 2796 | 0) >> 2] = (HEAP32[(0 + 2796 | 0) >> 2] | 0) & (__wasm_rotl_i32(-2 | 0, $4 | 0) | 0) | 0;
        break label$17;
       }
       HEAP32[($7 + ((HEAP32[($7 + 16 | 0) >> 2] | 0 | 0) == ($3 | 0) ? 16 : 20) | 0) >> 2] = $6;
       if (!$6) {
        break label$17
       }
      }
      HEAP32[($6 + 24 | 0) >> 2] = $7;
      label$26 : {
       $2 = HEAP32[($3 + 16 | 0) >> 2] | 0;
       if (!$2) {
        break label$26
       }
       HEAP32[($6 + 16 | 0) >> 2] = $2;
       HEAP32[($2 + 24 | 0) >> 2] = $6;
      }
      $2 = HEAP32[($3 + 20 | 0) >> 2] | 0;
      if (!$2) {
       break label$17
      }
      HEAP32[($6 + 20 | 0) >> 2] = $2;
      HEAP32[($2 + 24 | 0) >> 2] = $6;
     }
     HEAP32[($1 + 4 | 0) >> 2] = $0 | 1 | 0;
     HEAP32[($1 + $0 | 0) >> 2] = $0;
     if (($1 | 0) != (HEAP32[(0 + 2812 | 0) >> 2] | 0 | 0)) {
      break label$13
     }
     HEAP32[(0 + 2800 | 0) >> 2] = $0;
     return;
    }
    HEAP32[($3 + 4 | 0) >> 2] = $2 & -2 | 0;
    HEAP32[($1 + 4 | 0) >> 2] = $0 | 1 | 0;
    HEAP32[($1 + $0 | 0) >> 2] = $0;
   }
   label$27 : {
    if ($0 >>> 0 > 255 >>> 0) {
     break label$27
    }
    $2 = $0 >>> 3 | 0;
    $0 = ($2 << 3 | 0) + 2832 | 0;
    label$28 : {
     label$29 : {
      $4 = HEAP32[(0 + 2792 | 0) >> 2] | 0;
      $2 = 1 << $2 | 0;
      if ($4 & $2 | 0) {
       break label$29
      }
      HEAP32[(0 + 2792 | 0) >> 2] = $4 | $2 | 0;
      $2 = $0;
      break label$28;
     }
     $2 = HEAP32[($0 + 8 | 0) >> 2] | 0;
    }
    HEAP32[($0 + 8 | 0) >> 2] = $1;
    HEAP32[($2 + 12 | 0) >> 2] = $1;
    HEAP32[($1 + 12 | 0) >> 2] = $0;
    HEAP32[($1 + 8 | 0) >> 2] = $2;
    return;
   }
   $2 = 31;
   label$30 : {
    if ($0 >>> 0 > 16777215 >>> 0) {
     break label$30
    }
    $2 = $0 >>> 8 | 0;
    $379 = $2;
    $2 = (($2 + 1048320 | 0) >>> 16 | 0) & 8 | 0;
    $4 = $379 << $2 | 0;
    $386 = $4;
    $4 = (($4 + 520192 | 0) >>> 16 | 0) & 4 | 0;
    $6 = $386 << $4 | 0;
    $393 = $6;
    $6 = (($6 + 245760 | 0) >>> 16 | 0) & 2 | 0;
    $2 = (($393 << $6 | 0) >>> 15 | 0) - ($2 | $4 | 0 | $6 | 0) | 0;
    $2 = ($2 << 1 | 0 | (($0 >>> ($2 + 21 | 0) | 0) & 1 | 0) | 0) + 28 | 0;
   }
   HEAP32[($1 + 16 | 0) >> 2] = 0;
   HEAP32[($1 + 20 | 0) >> 2] = 0;
   HEAP32[($1 + 28 | 0) >> 2] = $2;
   $4 = ($2 << 2 | 0) + 3096 | 0;
   label$31 : {
    label$32 : {
     label$33 : {
      label$34 : {
       $6 = HEAP32[(0 + 2796 | 0) >> 2] | 0;
       $3 = 1 << $2 | 0;
       if ($6 & $3 | 0) {
        break label$34
       }
       HEAP32[(0 + 2796 | 0) >> 2] = $6 | $3 | 0;
       HEAP32[$4 >> 2] = $1;
       HEAP32[($1 + 24 | 0) >> 2] = $4;
       break label$33;
      }
      $2 = $0 << (($2 | 0) == (31 | 0) ? 0 : 25 - ($2 >>> 1 | 0) | 0) | 0;
      $6 = HEAP32[$4 >> 2] | 0;
      label$35 : while (1) {
       $4 = $6;
       if (((HEAP32[($6 + 4 | 0) >> 2] | 0) & -8 | 0 | 0) == ($0 | 0)) {
        break label$32
       }
       $6 = $2 >>> 29 | 0;
       $2 = $2 << 1 | 0;
       $3 = ($4 + ($6 & 4 | 0) | 0) + 16 | 0;
       $6 = HEAP32[$3 >> 2] | 0;
       if ($6) {
        continue label$35
       }
       break label$35;
      };
      HEAP32[$3 >> 2] = $1;
      HEAP32[($1 + 24 | 0) >> 2] = $4;
     }
     HEAP32[($1 + 12 | 0) >> 2] = $1;
     HEAP32[($1 + 8 | 0) >> 2] = $1;
     break label$31;
    }
    $0 = HEAP32[($4 + 8 | 0) >> 2] | 0;
    HEAP32[($0 + 12 | 0) >> 2] = $1;
    HEAP32[($4 + 8 | 0) >> 2] = $1;
    HEAP32[($1 + 24 | 0) >> 2] = 0;
    HEAP32[($1 + 12 | 0) >> 2] = $4;
    HEAP32[($1 + 8 | 0) >> 2] = $0;
   }
   $1 = (HEAP32[(0 + 2824 | 0) >> 2] | 0) + -1 | 0;
   HEAP32[(0 + 2824 | 0) >> 2] = $1 ? $1 : -1;
  }
 }
 
 function emscripten_get_heap_size() {
  return __wasm_memory_size() << 16 | 0 | 0;
 }
 
 function sbrk($0) {
  $0 = $0 | 0;
  var $1 = 0, $2 = 0;
  $1 = HEAP32[(0 + 2708 | 0) >> 2] | 0;
  $2 = ($0 + 3 | 0) & -4 | 0;
  $0 = $1 + $2 | 0;
  label$1 : {
   label$2 : {
    if (!$2) {
     break label$2
    }
    if ($0 >>> 0 <= $1 >>> 0) {
     break label$1
    }
   }
   label$3 : {
    if ($0 >>> 0 <= (emscripten_get_heap_size() | 0) >>> 0) {
     break label$3
    }
    if (!(emscripten_resize_heap($0 | 0) | 0)) {
     break label$1
    }
   }
   HEAP32[(0 + 2708 | 0) >> 2] = $0;
   return $1 | 0;
  }
  HEAP32[(__errno_location() | 0) >> 2] = 48;
  return -1 | 0;
 }
 
 function __memcpy($0, $1, $2) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  var $4 = 0, $3 = 0, $5 = 0;
  label$1 : {
   if ($2 >>> 0 < 512 >>> 0) {
    break label$1
   }
   emscripten_memcpy_big($0 | 0, $1 | 0, $2 | 0) | 0;
   return $0 | 0;
  }
  $3 = $0 + $2 | 0;
  label$2 : {
   label$3 : {
    if (($1 ^ $0 | 0) & 3 | 0) {
     break label$3
    }
    label$4 : {
     label$5 : {
      if ($0 & 3 | 0) {
       break label$5
      }
      $2 = $0;
      break label$4;
     }
     label$6 : {
      if (($2 | 0) >= (1 | 0)) {
       break label$6
      }
      $2 = $0;
      break label$4;
     }
     $2 = $0;
     label$7 : while (1) {
      HEAP8[$2 >> 0] = HEAPU8[$1 >> 0] | 0;
      $1 = $1 + 1 | 0;
      $2 = $2 + 1 | 0;
      if (!($2 & 3 | 0)) {
       break label$4
      }
      if ($2 >>> 0 < $3 >>> 0) {
       continue label$7
      }
      break label$7;
     };
    }
    label$8 : {
     $4 = $3 & -4 | 0;
     if ($4 >>> 0 < 64 >>> 0) {
      break label$8
     }
     $5 = $4 + -64 | 0;
     if ($2 >>> 0 > $5 >>> 0) {
      break label$8
     }
     label$9 : while (1) {
      HEAP32[$2 >> 2] = HEAP32[$1 >> 2] | 0;
      HEAP32[($2 + 4 | 0) >> 2] = HEAP32[($1 + 4 | 0) >> 2] | 0;
      HEAP32[($2 + 8 | 0) >> 2] = HEAP32[($1 + 8 | 0) >> 2] | 0;
      HEAP32[($2 + 12 | 0) >> 2] = HEAP32[($1 + 12 | 0) >> 2] | 0;
      HEAP32[($2 + 16 | 0) >> 2] = HEAP32[($1 + 16 | 0) >> 2] | 0;
      HEAP32[($2 + 20 | 0) >> 2] = HEAP32[($1 + 20 | 0) >> 2] | 0;
      HEAP32[($2 + 24 | 0) >> 2] = HEAP32[($1 + 24 | 0) >> 2] | 0;
      HEAP32[($2 + 28 | 0) >> 2] = HEAP32[($1 + 28 | 0) >> 2] | 0;
      HEAP32[($2 + 32 | 0) >> 2] = HEAP32[($1 + 32 | 0) >> 2] | 0;
      HEAP32[($2 + 36 | 0) >> 2] = HEAP32[($1 + 36 | 0) >> 2] | 0;
      HEAP32[($2 + 40 | 0) >> 2] = HEAP32[($1 + 40 | 0) >> 2] | 0;
      HEAP32[($2 + 44 | 0) >> 2] = HEAP32[($1 + 44 | 0) >> 2] | 0;
      HEAP32[($2 + 48 | 0) >> 2] = HEAP32[($1 + 48 | 0) >> 2] | 0;
      HEAP32[($2 + 52 | 0) >> 2] = HEAP32[($1 + 52 | 0) >> 2] | 0;
      HEAP32[($2 + 56 | 0) >> 2] = HEAP32[($1 + 56 | 0) >> 2] | 0;
      HEAP32[($2 + 60 | 0) >> 2] = HEAP32[($1 + 60 | 0) >> 2] | 0;
      $1 = $1 + 64 | 0;
      $2 = $2 + 64 | 0;
      if ($2 >>> 0 <= $5 >>> 0) {
       continue label$9
      }
      break label$9;
     };
    }
    if ($2 >>> 0 >= $4 >>> 0) {
     break label$2
    }
    label$10 : while (1) {
     HEAP32[$2 >> 2] = HEAP32[$1 >> 2] | 0;
     $1 = $1 + 4 | 0;
     $2 = $2 + 4 | 0;
     if ($2 >>> 0 < $4 >>> 0) {
      continue label$10
     }
     break label$2;
    };
   }
   label$11 : {
    if ($3 >>> 0 >= 4 >>> 0) {
     break label$11
    }
    $2 = $0;
    break label$2;
   }
   label$12 : {
    $4 = $3 + -4 | 0;
    if ($4 >>> 0 >= $0 >>> 0) {
     break label$12
    }
    $2 = $0;
    break label$2;
   }
   $2 = $0;
   label$13 : while (1) {
    HEAP8[$2 >> 0] = HEAPU8[$1 >> 0] | 0;
    HEAP8[($2 + 1 | 0) >> 0] = HEAPU8[($1 + 1 | 0) >> 0] | 0;
    HEAP8[($2 + 2 | 0) >> 0] = HEAPU8[($1 + 2 | 0) >> 0] | 0;
    HEAP8[($2 + 3 | 0) >> 0] = HEAPU8[($1 + 3 | 0) >> 0] | 0;
    $1 = $1 + 4 | 0;
    $2 = $2 + 4 | 0;
    if ($2 >>> 0 <= $4 >>> 0) {
     continue label$13
    }
    break label$13;
   };
  }
  label$14 : {
   if ($2 >>> 0 >= $3 >>> 0) {
    break label$14
   }
   label$15 : while (1) {
    HEAP8[$2 >> 0] = HEAPU8[$1 >> 0] | 0;
    $1 = $1 + 1 | 0;
    $2 = $2 + 1 | 0;
    if (($2 | 0) != ($3 | 0)) {
     continue label$15
    }
    break label$15;
   };
  }
  return $0 | 0;
 }
 
 function memset($0, $1, $2) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  var $3 = 0, i64toi32_i32$0 = 0, $4 = 0, i64toi32_i32$1 = 0, $6 = 0, $5 = 0, $6$hi = 0;
  label$1 : {
   if (!$2) {
    break label$1
   }
   $3 = $2 + $0 | 0;
   HEAP8[($3 + -1 | 0) >> 0] = $1;
   HEAP8[$0 >> 0] = $1;
   if ($2 >>> 0 < 3 >>> 0) {
    break label$1
   }
   HEAP8[($3 + -2 | 0) >> 0] = $1;
   HEAP8[($0 + 1 | 0) >> 0] = $1;
   HEAP8[($3 + -3 | 0) >> 0] = $1;
   HEAP8[($0 + 2 | 0) >> 0] = $1;
   if ($2 >>> 0 < 7 >>> 0) {
    break label$1
   }
   HEAP8[($3 + -4 | 0) >> 0] = $1;
   HEAP8[($0 + 3 | 0) >> 0] = $1;
   if ($2 >>> 0 < 9 >>> 0) {
    break label$1
   }
   $4 = (0 - $0 | 0) & 3 | 0;
   $3 = $0 + $4 | 0;
   $1 = Math_imul($1 & 255 | 0, 16843009);
   HEAP32[$3 >> 2] = $1;
   $4 = ($2 - $4 | 0) & -4 | 0;
   $2 = $3 + $4 | 0;
   HEAP32[($2 + -4 | 0) >> 2] = $1;
   if ($4 >>> 0 < 9 >>> 0) {
    break label$1
   }
   HEAP32[($3 + 8 | 0) >> 2] = $1;
   HEAP32[($3 + 4 | 0) >> 2] = $1;
   HEAP32[($2 + -8 | 0) >> 2] = $1;
   HEAP32[($2 + -12 | 0) >> 2] = $1;
   if ($4 >>> 0 < 25 >>> 0) {
    break label$1
   }
   HEAP32[($3 + 24 | 0) >> 2] = $1;
   HEAP32[($3 + 20 | 0) >> 2] = $1;
   HEAP32[($3 + 16 | 0) >> 2] = $1;
   HEAP32[($3 + 12 | 0) >> 2] = $1;
   HEAP32[($2 + -16 | 0) >> 2] = $1;
   HEAP32[($2 + -20 | 0) >> 2] = $1;
   HEAP32[($2 + -24 | 0) >> 2] = $1;
   HEAP32[($2 + -28 | 0) >> 2] = $1;
   $5 = $3 & 4 | 0 | 24 | 0;
   $2 = $4 - $5 | 0;
   if ($2 >>> 0 < 32 >>> 0) {
    break label$1
   }
   i64toi32_i32$0 = 0;
   i64toi32_i32$1 = 1;
   i64toi32_i32$1 = __wasm_i64_mul($1 | 0, i64toi32_i32$0 | 0, 1 | 0, i64toi32_i32$1 | 0) | 0;
   i64toi32_i32$0 = i64toi32_i32$HIGH_BITS;
   $6 = i64toi32_i32$1;
   $6$hi = i64toi32_i32$0;
   $1 = $3 + $5 | 0;
   label$2 : while (1) {
    i64toi32_i32$0 = $6$hi;
    i64toi32_i32$1 = $1;
    HEAP32[($1 + 24 | 0) >> 2] = $6;
    HEAP32[($1 + 28 | 0) >> 2] = i64toi32_i32$0;
    i64toi32_i32$1 = $1;
    HEAP32[($1 + 16 | 0) >> 2] = $6;
    HEAP32[($1 + 20 | 0) >> 2] = i64toi32_i32$0;
    i64toi32_i32$1 = $1;
    HEAP32[($1 + 8 | 0) >> 2] = $6;
    HEAP32[($1 + 12 | 0) >> 2] = i64toi32_i32$0;
    i64toi32_i32$1 = $1;
    HEAP32[$1 >> 2] = $6;
    HEAP32[($1 + 4 | 0) >> 2] = i64toi32_i32$0;
    $1 = $1 + 32 | 0;
    $2 = $2 + -32 | 0;
    if ($2 >>> 0 > 31 >>> 0) {
     continue label$2
    }
    break label$2;
   };
  }
  return $0 | 0;
 }
 
 function memmove($0, $1, $2) {
  $0 = $0 | 0;
  $1 = $1 | 0;
  $2 = $2 | 0;
  var $3 = 0, $4 = 0;
  label$1 : {
   if (($0 | 0) == ($1 | 0)) {
    break label$1
   }
   label$2 : {
    $3 = $0 + $2 | 0;
    if (($1 - $3 | 0) >>> 0 > (0 - ($2 << 1 | 0) | 0) >>> 0) {
     break label$2
    }
    return __memcpy($0 | 0, $1 | 0, $2 | 0) | 0 | 0;
   }
   $4 = ($1 ^ $0 | 0) & 3 | 0;
   label$3 : {
    label$4 : {
     label$5 : {
      if ($0 >>> 0 >= $1 >>> 0) {
       break label$5
      }
      label$6 : {
       if (!$4) {
        break label$6
       }
       $3 = $0;
       break label$3;
      }
      label$7 : {
       if ($0 & 3 | 0) {
        break label$7
       }
       $3 = $0;
       break label$4;
      }
      $3 = $0;
      label$8 : while (1) {
       if (!$2) {
        break label$1
       }
       HEAP8[$3 >> 0] = HEAPU8[$1 >> 0] | 0;
       $1 = $1 + 1 | 0;
       $2 = $2 + -1 | 0;
       $3 = $3 + 1 | 0;
       if (!($3 & 3 | 0)) {
        break label$4
       }
       continue label$8;
      };
     }
     label$9 : {
      if ($4) {
       break label$9
      }
      label$10 : {
       if (!($3 & 3 | 0)) {
        break label$10
       }
       label$11 : while (1) {
        if (!$2) {
         break label$1
        }
        $2 = $2 + -1 | 0;
        $3 = $0 + $2 | 0;
        HEAP8[$3 >> 0] = HEAPU8[($1 + $2 | 0) >> 0] | 0;
        if ($3 & 3 | 0) {
         continue label$11
        }
        break label$11;
       };
      }
      if ($2 >>> 0 <= 3 >>> 0) {
       break label$9
      }
      label$12 : while (1) {
       $2 = $2 + -4 | 0;
       HEAP32[($0 + $2 | 0) >> 2] = HEAP32[($1 + $2 | 0) >> 2] | 0;
       if ($2 >>> 0 > 3 >>> 0) {
        continue label$12
       }
       break label$12;
      };
     }
     if (!$2) {
      break label$1
     }
     label$13 : while (1) {
      $2 = $2 + -1 | 0;
      HEAP8[($0 + $2 | 0) >> 0] = HEAPU8[($1 + $2 | 0) >> 0] | 0;
      if ($2) {
       continue label$13
      }
      break label$1;
     };
    }
    if ($2 >>> 0 <= 3 >>> 0) {
     break label$3
    }
    label$14 : while (1) {
     HEAP32[$3 >> 2] = HEAP32[$1 >> 2] | 0;
     $1 = $1 + 4 | 0;
     $3 = $3 + 4 | 0;
     $2 = $2 + -4 | 0;
     if ($2 >>> 0 > 3 >>> 0) {
      continue label$14
     }
     break label$14;
    };
   }
   if (!$2) {
    break label$1
   }
   label$15 : while (1) {
    HEAP8[$3 >> 0] = HEAPU8[$1 >> 0] | 0;
    $3 = $3 + 1 | 0;
    $1 = $1 + 1 | 0;
    $2 = $2 + -1 | 0;
    if ($2) {
     continue label$15
    }
    break label$15;
   };
  }
  return $0 | 0;
 }
 
 function strlen($0) {
  $0 = $0 | 0;
  var $1 = 0, $2 = 0, $3 = 0;
  $1 = $0;
  label$1 : {
   label$2 : {
    if (!($1 & 3 | 0)) {
     break label$2
    }
    $1 = $0;
    label$3 : while (1) {
     if (!(HEAPU8[$1 >> 0] | 0)) {
      break label$1
     }
     $1 = $1 + 1 | 0;
     if ($1 & 3 | 0) {
      continue label$3
     }
     break label$3;
    };
   }
   label$4 : while (1) {
    $2 = $1;
    $1 = $1 + 4 | 0;
    $3 = HEAP32[$2 >> 2] | 0;
    if (!((($3 ^ -1 | 0) & ($3 + -16843009 | 0) | 0) & -2139062144 | 0)) {
     continue label$4
    }
    break label$4;
   };
   label$5 : {
    if ($3 & 255 | 0) {
     break label$5
    }
    return $2 - $0 | 0 | 0;
   }
   label$6 : while (1) {
    $3 = HEAPU8[($2 + 1 | 0) >> 0] | 0;
    $1 = $2 + 1 | 0;
    $2 = $1;
    if ($3) {
     continue label$6
    }
    break label$6;
   };
  }
  return $1 - $0 | 0 | 0;
 }
 
 function stackSave() {
  return __stack_pointer | 0;
 }
 
 function stackRestore($0) {
  $0 = $0 | 0;
  __stack_pointer = $0;
 }
 
 function stackAlloc($0) {
  $0 = $0 | 0;
  var $1 = 0;
  $1 = (__stack_pointer - $0 | 0) & -16 | 0;
  __stack_pointer = $1;
  return $1 | 0;
 }
 
 function emscripten_stack_init() {
  __stack_base = 5246176;
  __stack_end = (3288 + 15 | 0) & -16 | 0;
 }
 
 function emscripten_stack_get_free() {
  return __stack_pointer - __stack_end | 0 | 0;
 }
 
 function emscripten_stack_get_end() {
  return __stack_end | 0;
 }
 
 function _ZN17compiler_builtins3int3mul3Mul3mul17h070e9a1c69faec5bE(var$0, var$0$hi, var$1, var$1$hi) {
  var$0 = var$0 | 0;
  var$0$hi = var$0$hi | 0;
  var$1 = var$1 | 0;
  var$1$hi = var$1$hi | 0;
  var i64toi32_i32$4 = 0, i64toi32_i32$0 = 0, i64toi32_i32$1 = 0, var$2 = 0, i64toi32_i32$2 = 0, i64toi32_i32$3 = 0, var$3 = 0, var$4 = 0, var$5 = 0, $21 = 0, $22 = 0, var$6 = 0, $24 = 0, $17 = 0, $18 = 0, $23 = 0, $29 = 0, $45 = 0, $56$hi = 0, $62$hi = 0;
  i64toi32_i32$0 = var$1$hi;
  var$2 = var$1;
  var$4 = var$2 >>> 16 | 0;
  i64toi32_i32$0 = var$0$hi;
  var$3 = var$0;
  var$5 = var$3 >>> 16 | 0;
  $17 = Math_imul(var$4, var$5);
  $18 = var$2;
  i64toi32_i32$2 = var$3;
  i64toi32_i32$1 = 0;
  i64toi32_i32$3 = 32;
  i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
  if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
   i64toi32_i32$1 = 0;
   $21 = i64toi32_i32$0 >>> i64toi32_i32$4 | 0;
  } else {
   i64toi32_i32$1 = i64toi32_i32$0 >>> i64toi32_i32$4 | 0;
   $21 = (((1 << i64toi32_i32$4 | 0) - 1 | 0) & i64toi32_i32$0 | 0) << (32 - i64toi32_i32$4 | 0) | 0 | (i64toi32_i32$2 >>> i64toi32_i32$4 | 0) | 0;
  }
  $23 = $17 + Math_imul($18, $21) | 0;
  i64toi32_i32$1 = var$1$hi;
  i64toi32_i32$0 = var$1;
  i64toi32_i32$2 = 0;
  i64toi32_i32$3 = 32;
  i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
  if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
   i64toi32_i32$2 = 0;
   $22 = i64toi32_i32$1 >>> i64toi32_i32$4 | 0;
  } else {
   i64toi32_i32$2 = i64toi32_i32$1 >>> i64toi32_i32$4 | 0;
   $22 = (((1 << i64toi32_i32$4 | 0) - 1 | 0) & i64toi32_i32$1 | 0) << (32 - i64toi32_i32$4 | 0) | 0 | (i64toi32_i32$0 >>> i64toi32_i32$4 | 0) | 0;
  }
  $29 = $23 + Math_imul($22, var$3) | 0;
  var$2 = var$2 & 65535 | 0;
  var$3 = var$3 & 65535 | 0;
  var$6 = Math_imul(var$2, var$3);
  var$2 = (var$6 >>> 16 | 0) + Math_imul(var$2, var$5) | 0;
  $45 = $29 + (var$2 >>> 16 | 0) | 0;
  var$2 = (var$2 & 65535 | 0) + Math_imul(var$4, var$3) | 0;
  i64toi32_i32$2 = 0;
  i64toi32_i32$1 = $45 + (var$2 >>> 16 | 0) | 0;
  i64toi32_i32$0 = 0;
  i64toi32_i32$3 = 32;
  i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
  if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
   i64toi32_i32$0 = i64toi32_i32$1 << i64toi32_i32$4 | 0;
   $24 = 0;
  } else {
   i64toi32_i32$0 = ((1 << i64toi32_i32$4 | 0) - 1 | 0) & (i64toi32_i32$1 >>> (32 - i64toi32_i32$4 | 0) | 0) | 0 | (i64toi32_i32$2 << i64toi32_i32$4 | 0) | 0;
   $24 = i64toi32_i32$1 << i64toi32_i32$4 | 0;
  }
  $56$hi = i64toi32_i32$0;
  i64toi32_i32$0 = 0;
  $62$hi = i64toi32_i32$0;
  i64toi32_i32$0 = $56$hi;
  i64toi32_i32$2 = $24;
  i64toi32_i32$1 = $62$hi;
  i64toi32_i32$3 = var$2 << 16 | 0 | (var$6 & 65535 | 0) | 0;
  i64toi32_i32$1 = i64toi32_i32$0 | i64toi32_i32$1 | 0;
  i64toi32_i32$2 = i64toi32_i32$2 | i64toi32_i32$3 | 0;
  i64toi32_i32$HIGH_BITS = i64toi32_i32$1;
  return i64toi32_i32$2 | 0;
 }
 
 function __wasm_i64_mul(var$0, var$0$hi, var$1, var$1$hi) {
  var$0 = var$0 | 0;
  var$0$hi = var$0$hi | 0;
  var$1 = var$1 | 0;
  var$1$hi = var$1$hi | 0;
  var i64toi32_i32$0 = 0, i64toi32_i32$1 = 0;
  i64toi32_i32$0 = var$0$hi;
  i64toi32_i32$0 = var$1$hi;
  i64toi32_i32$0 = var$0$hi;
  i64toi32_i32$1 = var$1$hi;
  i64toi32_i32$1 = _ZN17compiler_builtins3int3mul3Mul3mul17h070e9a1c69faec5bE(var$0 | 0, i64toi32_i32$0 | 0, var$1 | 0, i64toi32_i32$1 | 0) | 0;
  i64toi32_i32$0 = i64toi32_i32$HIGH_BITS;
  i64toi32_i32$HIGH_BITS = i64toi32_i32$0;
  return i64toi32_i32$1 | 0;
 }
 
 function __wasm_rotl_i32(var$0, var$1) {
  var$0 = var$0 | 0;
  var$1 = var$1 | 0;
  var var$2 = 0;
  var$2 = var$1 & 31 | 0;
  var$1 = (0 - var$1 | 0) & 31 | 0;
  return ((-1 >>> var$2 | 0) & var$0 | 0) << var$2 | 0 | (((-1 << var$1 | 0) & var$0 | 0) >>> var$1 | 0) | 0 | 0;
 }
 
 // EMSCRIPTEN_END_FUNCS
;
 bufferView = HEAPU8;
 initActiveSegments(env);
 var FUNCTION_TABLE = Table([null, std__logic_error___logic_error_28_29, __cxx_global_array_dtor, __cxx_global_array_dtor_2, emscripten_console_log, emscripten_console_error, StdinFile__read_28__wasi_iovec_t_20const__2c_20unsigned_20long_2c_20unsigned_20long__29, StdinFile__write_28__wasi_ciovec_t_20const__2c_20unsigned_20long_2c_20unsigned_20long__29, StdinFile___StdinFile_28_29, StdinFile___StdinFile_28_29_1, StdoutFile__read_28__wasi_iovec_t_20const__2c_20unsigned_20long_2c_20unsigned_20long__29, StdoutFile__write_28__wasi_ciovec_t_20const__2c_20unsigned_20long_2c_20unsigned_20long__29, StdoutFile___StdoutFile_28_29, StdoutFile___StdoutFile_28_29_1, StderrFile__read_28__wasi_iovec_t_20const__2c_20unsigned_20long_2c_20unsigned_20long__29, StderrFile__write_28__wasi_ciovec_t_20const__2c_20unsigned_20long_2c_20unsigned_20long__29, StderrFile___StderrFile_28_29, StderrFile___StderrFile_28_29_1, __cxa_pure_virtual, File___File_28_29, File___File_28_29_1, __cxx_global_array_dtor_1, __cxx_global_array_dtor_2_1, std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20______shared_ptr_emplace_28_29, std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20______shared_ptr_emplace_28_29_1, std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20_____on_zero_shared_28_29, std____2____shared_weak_count____get_deleter_28std__type_info_20const__29_20const, std____2____shared_ptr_emplace_OpenFileDescriptor_2c_20std____2__allocator_OpenFileDescriptor__20_____on_zero_shared_weak_28_29, std____2____shared_ptr_emplace_StdinFile_2c_20std____2__allocator_StdinFile__20______shared_ptr_emplace_28_29, std____2____shared_ptr_emplace_StdinFile_2c_20std____2__allocator_StdinFile__20______shared_ptr_emplace_28_29_1, std____2____shared_ptr_emplace_StdinFile_2c_20std____2__allocator_StdinFile__20_____on_zero_shared_28_29, std____2____shared_ptr_emplace_StdinFile_2c_20std____2__allocator_StdinFile__20_____on_zero_shared_weak_28_29, std____2____shared_ptr_emplace_StdoutFile_2c_20std____2__allocator_StdoutFile__20______shared_ptr_emplace_28_29, std____2____shared_ptr_emplace_StdoutFile_2c_20std____2__allocator_StdoutFile__20______shared_ptr_emplace_28_29_1, std____2____shared_ptr_emplace_StdoutFile_2c_20std____2__allocator_StdoutFile__20_____on_zero_shared_28_29, std____2____shared_ptr_emplace_StdoutFile_2c_20std____2__allocator_StdoutFile__20_____on_zero_shared_weak_28_29, std____2____shared_ptr_emplace_StderrFile_2c_20std____2__allocator_StderrFile__20______shared_ptr_emplace_28_29, std____2____shared_ptr_emplace_StderrFile_2c_20std____2__allocator_StderrFile__20______shared_ptr_emplace_28_29_1, std____2____shared_ptr_emplace_StderrFile_2c_20std____2__allocator_StderrFile__20_____on_zero_shared_28_29, std____2____shared_ptr_emplace_StderrFile_2c_20std____2__allocator_StderrFile__20_____on_zero_shared_weak_28_29, std____2____shared_count_____shared_count_28_29, std____2____shared_count_____shared_count_28_29_1, std____2____shared_weak_count_____shared_weak_count_28_29, std__exception___exception_28_29, std__exception___exception_28_29_1, std__exception__what_28_29_20const, std__logic_error___logic_error_28_29_1, std__logic_error__what_28_29_20const, std__length_error___length_error_28_29, __cxxabiv1____shim_type_info_____shim_type_info_28_29, __cxxabiv1____class_type_info_____class_type_info_28_29, __cxxabiv1____shim_type_info__noop1_28_29_20const, __cxxabiv1____shim_type_info__noop2_28_29_20const, __cxxabiv1____class_type_info__can_catch_28__cxxabiv1____shim_type_info_20const__2c_20void___29_20const, __cxxabiv1____class_type_info__search_above_dst_28__cxxabiv1____dynamic_cast_info__2c_20void_20const__2c_20void_20const__2c_20int_2c_20bool_29_20const, __cxxabiv1____class_type_info__search_below_dst_28__cxxabiv1____dynamic_cast_info__2c_20void_20const__2c_20int_2c_20bool_29_20const, __cxxabiv1____class_type_info__has_unambiguous_public_base_28__cxxabiv1____dynamic_cast_info__2c_20void__2c_20int_29_20const, __cxxabiv1____si_class_type_info_____si_class_type_info_28_29, __cxxabiv1____si_class_type_info__search_above_dst_28__cxxabiv1____dynamic_cast_info__2c_20void_20const__2c_20void_20const__2c_20int_2c_20bool_29_20const, __cxxabiv1____si_class_type_info__search_below_dst_28__cxxabiv1____dynamic_cast_info__2c_20void_20const__2c_20int_2c_20bool_29_20const, __cxxabiv1____si_class_type_info__has_unambiguous_public_base_28__cxxabiv1____dynamic_cast_info__2c_20void__2c_20int_29_20const, __cxxabiv1____vmi_class_type_info_____vmi_class_type_info_28_29, __cxxabiv1____vmi_class_type_info__search_above_dst_28__cxxabiv1____dynamic_cast_info__2c_20void_20const__2c_20void_20const__2c_20int_2c_20bool_29_20const, __cxxabiv1____vmi_class_type_info__search_below_dst_28__cxxabiv1____dynamic_cast_info__2c_20void_20const__2c_20int_2c_20bool_29_20const, __cxxabiv1____vmi_class_type_info__has_unambiguous_public_base_28__cxxabiv1____dynamic_cast_info__2c_20void__2c_20int_29_20const]);
 function __wasm_memory_size() {
  return buffer.byteLength / 65536 | 0;
 }
 
 return {
  "__wasm_call_ctors": __wasm_call_ctors, 
  "main": main, 
  "__indirect_function_table": FUNCTION_TABLE, 
  "__errno_location": __errno_location, 
  "stackSave": stackSave, 
  "stackRestore": stackRestore, 
  "stackAlloc": stackAlloc, 
  "emscripten_stack_init": emscripten_stack_init, 
  "emscripten_stack_get_free": emscripten_stack_get_free, 
  "emscripten_stack_get_end": emscripten_stack_get_end
 };
}

  return asmFunc(asmLibraryArg);
}

)(asmLibraryArg);
  },

  instantiate: /** @suppress{checkTypes} */ function(binary, info) {
    return {
      then: function(ok) {
        var module = new WebAssembly.Module(binary);
        ok({
          'instance': new WebAssembly.Instance(module)
        });
        // Emulate a simple WebAssembly.instantiate(..).then(()=>{}).catch(()=>{}) syntax.
        return { catch: function() {} };
      }
    };
  },

  RuntimeError: Error
};

// We don't need to actually download a wasm binary, mark it as present but empty.
wasmBinary = [];

// end include: wasm2js.js
if (typeof WebAssembly !== 'object') {
  abort('no native wasm support detected');
}

// include: runtime_safe_heap.js


// In MINIMAL_RUNTIME, setValue() and getValue() are only available when building with safe heap enabled, for heap safety checking.
// In traditional runtime, setValue() and getValue() are always available (although their use is highly discouraged due to perf penalties)

/** @param {number} ptr
    @param {number} value
    @param {string} type
    @param {number|boolean=} noSafe */
function setValue(ptr, value, type, noSafe) {
  type = type || 'i8';
  if (type.charAt(type.length-1) === '*') type = 'i32'; // pointers are 32-bit
    switch (type) {
      case 'i1': HEAP8[((ptr)>>0)] = value; break;
      case 'i8': HEAP8[((ptr)>>0)] = value; break;
      case 'i16': HEAP16[((ptr)>>1)] = value; break;
      case 'i32': HEAP32[((ptr)>>2)] = value; break;
      case 'i64': (tempI64 = [value>>>0,(tempDouble=value,(+(Math.abs(tempDouble))) >= 1.0 ? (tempDouble > 0.0 ? ((Math.min((+(Math.floor((tempDouble)/4294967296.0))), 4294967295.0))|0)>>>0 : (~~((+(Math.ceil((tempDouble - +(((~~(tempDouble)))>>>0))/4294967296.0)))))>>>0) : 0)],HEAP32[((ptr)>>2)] = tempI64[0],HEAP32[(((ptr)+(4))>>2)] = tempI64[1]); break;
      case 'float': HEAPF32[((ptr)>>2)] = value; break;
      case 'double': HEAPF64[((ptr)>>3)] = value; break;
      default: abort('invalid type for setValue: ' + type);
    }
}

/** @param {number} ptr
    @param {string} type
    @param {number|boolean=} noSafe */
function getValue(ptr, type, noSafe) {
  type = type || 'i8';
  if (type.charAt(type.length-1) === '*') type = 'i32'; // pointers are 32-bit
    switch (type) {
      case 'i1': return HEAP8[((ptr)>>0)];
      case 'i8': return HEAP8[((ptr)>>0)];
      case 'i16': return HEAP16[((ptr)>>1)];
      case 'i32': return HEAP32[((ptr)>>2)];
      case 'i64': return HEAP32[((ptr)>>2)];
      case 'float': return HEAPF32[((ptr)>>2)];
      case 'double': return HEAPF64[((ptr)>>3)];
      default: abort('invalid type for getValue: ' + type);
    }
  return null;
}

// end include: runtime_safe_heap.js
// Wasm globals

var wasmMemory;

//========================================
// Runtime essentials
//========================================

// whether we are quitting the application. no code should run after this.
// set in exit() and abort()
var ABORT = false;

// set by exit() and abort().  Passed to 'onExit' handler.
// NOTE: This is also used as the process return code code in shell environments
// but only when noExitRuntime is false.
var EXITSTATUS;

/** @type {function(*, string=)} */
function assert(condition, text) {
  if (!condition) {
    abort('Assertion failed: ' + text);
  }
}

// Returns the C function with a specified identifier (for C++, you need to do manual name mangling)
function getCFunc(ident) {
  var func = Module['_' + ident]; // closure exported function
  assert(func, 'Cannot call unknown function ' + ident + ', make sure it is exported');
  return func;
}

// C calling interface.
/** @param {string|null=} returnType
    @param {Array=} argTypes
    @param {Arguments|Array=} args
    @param {Object=} opts */
function ccall(ident, returnType, argTypes, args, opts) {
  // For fast lookup of conversion functions
  var toC = {
    'string': function(str) {
      var ret = 0;
      if (str !== null && str !== undefined && str !== 0) { // null string
        // at most 4 bytes per UTF-8 code point, +1 for the trailing '\0'
        var len = (str.length << 2) + 1;
        ret = stackAlloc(len);
        stringToUTF8(str, ret, len);
      }
      return ret;
    },
    'array': function(arr) {
      var ret = stackAlloc(arr.length);
      writeArrayToMemory(arr, ret);
      return ret;
    }
  };

  function convertReturnValue(ret) {
    if (returnType === 'string') return UTF8ToString(ret);
    if (returnType === 'boolean') return Boolean(ret);
    return ret;
  }

  var func = getCFunc(ident);
  var cArgs = [];
  var stack = 0;
  assert(returnType !== 'array', 'Return type should not be "array".');
  if (args) {
    for (var i = 0; i < args.length; i++) {
      var converter = toC[argTypes[i]];
      if (converter) {
        if (stack === 0) stack = stackSave();
        cArgs[i] = converter(args[i]);
      } else {
        cArgs[i] = args[i];
      }
    }
  }
  var ret = func.apply(null, cArgs);
  function onDone(ret) {
    if (stack !== 0) stackRestore(stack);
    return convertReturnValue(ret);
  }

  ret = onDone(ret);
  return ret;
}

/** @param {string=} returnType
    @param {Array=} argTypes
    @param {Object=} opts */
function cwrap(ident, returnType, argTypes, opts) {
  return function() {
    return ccall(ident, returnType, argTypes, arguments, opts);
  }
}

// We used to include malloc/free by default in the past. Show a helpful error in
// builds with assertions.
function _malloc() {
  abort("malloc() called but not included in the build - add '_malloc' to EXPORTED_FUNCTIONS");
}
function _free() {
  // Show a helpful error since we used to include free by default in the past.
  abort("free() called but not included in the build - add '_free' to EXPORTED_FUNCTIONS");
}

var ALLOC_NORMAL = 0; // Tries to use _malloc()
var ALLOC_STACK = 1; // Lives for the duration of the current function call

// allocate(): This is for internal use. You can use it yourself as well, but the interface
//             is a little tricky (see docs right below). The reason is that it is optimized
//             for multiple syntaxes to save space in generated code. So you should
//             normally not use allocate(), and instead allocate memory using _malloc(),
//             initialize it with setValue(), and so forth.
// @slab: An array of data.
// @allocator: How to allocate memory, see ALLOC_*
/** @type {function((Uint8Array|Array<number>), number)} */
function allocate(slab, allocator) {
  var ret;
  assert(typeof allocator === 'number', 'allocate no longer takes a type argument')
  assert(typeof slab !== 'number', 'allocate no longer takes a number as arg0')

  if (allocator == ALLOC_STACK) {
    ret = stackAlloc(slab.length);
  } else {
    ret = abort('malloc was not included, but is needed in allocate. Adding "_malloc" to EXPORTED_FUNCTIONS should fix that. This may be a bug in the compiler, please file an issue.');;
  }

  if (slab.subarray || slab.slice) {
    HEAPU8.set(/** @type {!Uint8Array} */(slab), ret);
  } else {
    HEAPU8.set(new Uint8Array(slab), ret);
  }
  return ret;
}

// include: runtime_strings.js


// runtime_strings.js: Strings related runtime functions that are part of both MINIMAL_RUNTIME and regular runtime.

// Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the given array that contains uint8 values, returns
// a copy of that string as a Javascript String object.

var UTF8Decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf8') : undefined;

/**
 * @param {number} idx
 * @param {number=} maxBytesToRead
 * @return {string}
 */
function UTF8ArrayToString(heap, idx, maxBytesToRead) {
  var endIdx = idx + maxBytesToRead;
  var endPtr = idx;
  // TextDecoder needs to know the byte length in advance, it doesn't stop on null terminator by itself.
  // Also, use the length info to avoid running tiny strings through TextDecoder, since .subarray() allocates garbage.
  // (As a tiny code save trick, compare endPtr against endIdx using a negation, so that undefined means Infinity)
  while (heap[endPtr] && !(endPtr >= endIdx)) ++endPtr;

  if (endPtr - idx > 16 && heap.subarray && UTF8Decoder) {
    return UTF8Decoder.decode(heap.subarray(idx, endPtr));
  } else {
    var str = '';
    // If building with TextDecoder, we have already computed the string length above, so test loop end condition against that
    while (idx < endPtr) {
      // For UTF8 byte structure, see:
      // http://en.wikipedia.org/wiki/UTF-8#Description
      // https://www.ietf.org/rfc/rfc2279.txt
      // https://tools.ietf.org/html/rfc3629
      var u0 = heap[idx++];
      if (!(u0 & 0x80)) { str += String.fromCharCode(u0); continue; }
      var u1 = heap[idx++] & 63;
      if ((u0 & 0xE0) == 0xC0) { str += String.fromCharCode(((u0 & 31) << 6) | u1); continue; }
      var u2 = heap[idx++] & 63;
      if ((u0 & 0xF0) == 0xE0) {
        u0 = ((u0 & 15) << 12) | (u1 << 6) | u2;
      } else {
        if ((u0 & 0xF8) != 0xF0) warnOnce('Invalid UTF-8 leading byte 0x' + u0.toString(16) + ' encountered when deserializing a UTF-8 string in wasm memory to a JS string!');
        u0 = ((u0 & 7) << 18) | (u1 << 12) | (u2 << 6) | (heap[idx++] & 63);
      }

      if (u0 < 0x10000) {
        str += String.fromCharCode(u0);
      } else {
        var ch = u0 - 0x10000;
        str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
      }
    }
  }
  return str;
}

// Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the emscripten HEAP, returns a
// copy of that string as a Javascript String object.
// maxBytesToRead: an optional length that specifies the maximum number of bytes to read. You can omit
//                 this parameter to scan the string until the first \0 byte. If maxBytesToRead is
//                 passed, and the string at [ptr, ptr+maxBytesToReadr[ contains a null byte in the
//                 middle, then the string will cut short at that byte index (i.e. maxBytesToRead will
//                 not produce a string of exact length [ptr, ptr+maxBytesToRead[)
//                 N.B. mixing frequent uses of UTF8ToString() with and without maxBytesToRead may
//                 throw JS JIT optimizations off, so it is worth to consider consistently using one
//                 style or the other.
/**
 * @param {number} ptr
 * @param {number=} maxBytesToRead
 * @return {string}
 */
function UTF8ToString(ptr, maxBytesToRead) {
  return ptr ? UTF8ArrayToString(HEAPU8, ptr, maxBytesToRead) : '';
}

// Copies the given Javascript String object 'str' to the given byte array at address 'outIdx',
// encoded in UTF8 form and null-terminated. The copy will require at most str.length*4+1 bytes of space in the HEAP.
// Use the function lengthBytesUTF8 to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   heap: the array to copy to. Each index in this array is assumed to be one 8-byte element.
//   outIdx: The starting offset in the array to begin the copying.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array.
//                    This count should include the null terminator,
//                    i.e. if maxBytesToWrite=1, only the null terminator will be written and nothing else.
//                    maxBytesToWrite=0 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF8Array(str, heap, outIdx, maxBytesToWrite) {
  if (!(maxBytesToWrite > 0)) // Parameter maxBytesToWrite is not optional. Negative values, 0, null, undefined and false each don't write out any bytes.
    return 0;

  var startIdx = outIdx;
  var endIdx = outIdx + maxBytesToWrite - 1; // -1 for string null terminator.
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! So decode UTF16->UTF32->UTF8.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    // For UTF8 byte structure, see http://en.wikipedia.org/wiki/UTF-8#Description and https://www.ietf.org/rfc/rfc2279.txt and https://tools.ietf.org/html/rfc3629
    var u = str.charCodeAt(i); // possibly a lead surrogate
    if (u >= 0xD800 && u <= 0xDFFF) {
      var u1 = str.charCodeAt(++i);
      u = 0x10000 + ((u & 0x3FF) << 10) | (u1 & 0x3FF);
    }
    if (u <= 0x7F) {
      if (outIdx >= endIdx) break;
      heap[outIdx++] = u;
    } else if (u <= 0x7FF) {
      if (outIdx + 1 >= endIdx) break;
      heap[outIdx++] = 0xC0 | (u >> 6);
      heap[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0xFFFF) {
      if (outIdx + 2 >= endIdx) break;
      heap[outIdx++] = 0xE0 | (u >> 12);
      heap[outIdx++] = 0x80 | ((u >> 6) & 63);
      heap[outIdx++] = 0x80 | (u & 63);
    } else {
      if (outIdx + 3 >= endIdx) break;
      if (u > 0x10FFFF) warnOnce('Invalid Unicode code point 0x' + u.toString(16) + ' encountered when serializing a JS string to a UTF-8 string in wasm memory! (Valid unicode code points should be in range 0-0x10FFFF).');
      heap[outIdx++] = 0xF0 | (u >> 18);
      heap[outIdx++] = 0x80 | ((u >> 12) & 63);
      heap[outIdx++] = 0x80 | ((u >> 6) & 63);
      heap[outIdx++] = 0x80 | (u & 63);
    }
  }
  // Null-terminate the pointer to the buffer.
  heap[outIdx] = 0;
  return outIdx - startIdx;
}

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF8 form. The copy will require at most str.length*4+1 bytes of space in the HEAP.
// Use the function lengthBytesUTF8 to compute the exact number of bytes (excluding null terminator) that this function will write.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF8(str, outPtr, maxBytesToWrite) {
  assert(typeof maxBytesToWrite == 'number', 'stringToUTF8(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!');
  return stringToUTF8Array(str, HEAPU8,outPtr, maxBytesToWrite);
}

// Returns the number of bytes the given Javascript string takes if encoded as a UTF8 byte array, EXCLUDING the null terminator byte.
function lengthBytesUTF8(str) {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! So decode UTF16->UTF32->UTF8.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var u = str.charCodeAt(i); // possibly a lead surrogate
    if (u >= 0xD800 && u <= 0xDFFF) u = 0x10000 + ((u & 0x3FF) << 10) | (str.charCodeAt(++i) & 0x3FF);
    if (u <= 0x7F) ++len;
    else if (u <= 0x7FF) len += 2;
    else if (u <= 0xFFFF) len += 3;
    else len += 4;
  }
  return len;
}

// end include: runtime_strings.js
// include: runtime_strings_extra.js


// runtime_strings_extra.js: Strings related runtime functions that are available only in regular runtime.

// Given a pointer 'ptr' to a null-terminated ASCII-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

function AsciiToString(ptr) {
  var str = '';
  while (1) {
    var ch = HEAPU8[((ptr++)>>0)];
    if (!ch) return str;
    str += String.fromCharCode(ch);
  }
}

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in ASCII form. The copy will require at most str.length+1 bytes of space in the HEAP.

function stringToAscii(str, outPtr) {
  return writeAsciiToMemory(str, outPtr, false);
}

// Given a pointer 'ptr' to a null-terminated UTF16LE-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

var UTF16Decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-16le') : undefined;

function UTF16ToString(ptr, maxBytesToRead) {
  assert(ptr % 2 == 0, 'Pointer passed to UTF16ToString must be aligned to two bytes!');
  var endPtr = ptr;
  // TextDecoder needs to know the byte length in advance, it doesn't stop on null terminator by itself.
  // Also, use the length info to avoid running tiny strings through TextDecoder, since .subarray() allocates garbage.
  var idx = endPtr >> 1;
  var maxIdx = idx + maxBytesToRead / 2;
  // If maxBytesToRead is not passed explicitly, it will be undefined, and this
  // will always evaluate to true. This saves on code size.
  while (!(idx >= maxIdx) && HEAPU16[idx]) ++idx;
  endPtr = idx << 1;

  if (endPtr - ptr > 32 && UTF16Decoder) {
    return UTF16Decoder.decode(HEAPU8.subarray(ptr, endPtr));
  } else {
    var str = '';

    // If maxBytesToRead is not passed explicitly, it will be undefined, and the for-loop's condition
    // will always evaluate to true. The loop is then terminated on the first null char.
    for (var i = 0; !(i >= maxBytesToRead / 2); ++i) {
      var codeUnit = HEAP16[(((ptr)+(i*2))>>1)];
      if (codeUnit == 0) break;
      // fromCharCode constructs a character from a UTF-16 code unit, so we can pass the UTF16 string right through.
      str += String.fromCharCode(codeUnit);
    }

    return str;
  }
}

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF16 form. The copy will require at most str.length*4+2 bytes of space in the HEAP.
// Use the function lengthBytesUTF16() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outPtr: Byte address in Emscripten HEAP where to write the string to.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null
//                    terminator, i.e. if maxBytesToWrite=2, only the null terminator will be written and nothing else.
//                    maxBytesToWrite<2 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF16(str, outPtr, maxBytesToWrite) {
  assert(outPtr % 2 == 0, 'Pointer passed to stringToUTF16 must be aligned to two bytes!');
  assert(typeof maxBytesToWrite == 'number', 'stringToUTF16(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!');
  // Backwards compatibility: if max bytes is not specified, assume unsafe unbounded write is allowed.
  if (maxBytesToWrite === undefined) {
    maxBytesToWrite = 0x7FFFFFFF;
  }
  if (maxBytesToWrite < 2) return 0;
  maxBytesToWrite -= 2; // Null terminator.
  var startPtr = outPtr;
  var numCharsToWrite = (maxBytesToWrite < str.length*2) ? (maxBytesToWrite / 2) : str.length;
  for (var i = 0; i < numCharsToWrite; ++i) {
    // charCodeAt returns a UTF-16 encoded code unit, so it can be directly written to the HEAP.
    var codeUnit = str.charCodeAt(i); // possibly a lead surrogate
    HEAP16[((outPtr)>>1)] = codeUnit;
    outPtr += 2;
  }
  // Null-terminate the pointer to the HEAP.
  HEAP16[((outPtr)>>1)] = 0;
  return outPtr - startPtr;
}

// Returns the number of bytes the given Javascript string takes if encoded as a UTF16 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF16(str) {
  return str.length*2;
}

function UTF32ToString(ptr, maxBytesToRead) {
  assert(ptr % 4 == 0, 'Pointer passed to UTF32ToString must be aligned to four bytes!');
  var i = 0;

  var str = '';
  // If maxBytesToRead is not passed explicitly, it will be undefined, and this
  // will always evaluate to true. This saves on code size.
  while (!(i >= maxBytesToRead / 4)) {
    var utf32 = HEAP32[(((ptr)+(i*4))>>2)];
    if (utf32 == 0) break;
    ++i;
    // Gotcha: fromCharCode constructs a character from a UTF-16 encoded code (pair), not from a Unicode code point! So encode the code point to UTF-16 for constructing.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    if (utf32 >= 0x10000) {
      var ch = utf32 - 0x10000;
      str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
    } else {
      str += String.fromCharCode(utf32);
    }
  }
  return str;
}

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF32 form. The copy will require at most str.length*4+4 bytes of space in the HEAP.
// Use the function lengthBytesUTF32() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outPtr: Byte address in Emscripten HEAP where to write the string to.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null
//                    terminator, i.e. if maxBytesToWrite=4, only the null terminator will be written and nothing else.
//                    maxBytesToWrite<4 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF32(str, outPtr, maxBytesToWrite) {
  assert(outPtr % 4 == 0, 'Pointer passed to stringToUTF32 must be aligned to four bytes!');
  assert(typeof maxBytesToWrite == 'number', 'stringToUTF32(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!');
  // Backwards compatibility: if max bytes is not specified, assume unsafe unbounded write is allowed.
  if (maxBytesToWrite === undefined) {
    maxBytesToWrite = 0x7FFFFFFF;
  }
  if (maxBytesToWrite < 4) return 0;
  var startPtr = outPtr;
  var endPtr = startPtr + maxBytesToWrite - 4;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! We must decode the string to UTF-32 to the heap.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var codeUnit = str.charCodeAt(i); // possibly a lead surrogate
    if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) {
      var trailSurrogate = str.charCodeAt(++i);
      codeUnit = 0x10000 + ((codeUnit & 0x3FF) << 10) | (trailSurrogate & 0x3FF);
    }
    HEAP32[((outPtr)>>2)] = codeUnit;
    outPtr += 4;
    if (outPtr + 4 > endPtr) break;
  }
  // Null-terminate the pointer to the HEAP.
  HEAP32[((outPtr)>>2)] = 0;
  return outPtr - startPtr;
}

// Returns the number of bytes the given Javascript string takes if encoded as a UTF16 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF32(str) {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! We must decode the string to UTF-32 to the heap.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var codeUnit = str.charCodeAt(i);
    if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) ++i; // possibly a lead surrogate, so skip over the tail surrogate.
    len += 4;
  }

  return len;
}

// Allocate heap space for a JS string, and write it there.
// It is the responsibility of the caller to free() that memory.
function allocateUTF8(str) {
  var size = lengthBytesUTF8(str) + 1;
  var ret = abort('malloc was not included, but is needed in allocateUTF8. Adding "_malloc" to EXPORTED_FUNCTIONS should fix that. This may be a bug in the compiler, please file an issue.');;
  if (ret) stringToUTF8Array(str, HEAP8, ret, size);
  return ret;
}

// Allocate stack space for a JS string, and write it there.
function allocateUTF8OnStack(str) {
  var size = lengthBytesUTF8(str) + 1;
  var ret = stackAlloc(size);
  stringToUTF8Array(str, HEAP8, ret, size);
  return ret;
}

// Deprecated: This function should not be called because it is unsafe and does not provide
// a maximum length limit of how many bytes it is allowed to write. Prefer calling the
// function stringToUTF8Array() instead, which takes in a maximum length that can be used
// to be secure from out of bounds writes.
/** @deprecated
    @param {boolean=} dontAddNull */
function writeStringToMemory(string, buffer, dontAddNull) {
  warnOnce('writeStringToMemory is deprecated and should not be called! Use stringToUTF8() instead!');

  var /** @type {number} */ lastChar, /** @type {number} */ end;
  if (dontAddNull) {
    // stringToUTF8Array always appends null. If we don't want to do that, remember the
    // character that existed at the location where the null will be placed, and restore
    // that after the write (below).
    end = buffer + lengthBytesUTF8(string);
    lastChar = HEAP8[end];
  }
  stringToUTF8(string, buffer, Infinity);
  if (dontAddNull) HEAP8[end] = lastChar; // Restore the value under the null character.
}

function writeArrayToMemory(array, buffer) {
  assert(array.length >= 0, 'writeArrayToMemory array must have a length (should be an array or typed array)')
  HEAP8.set(array, buffer);
}

/** @param {boolean=} dontAddNull */
function writeAsciiToMemory(str, buffer, dontAddNull) {
  for (var i = 0; i < str.length; ++i) {
    assert(str.charCodeAt(i) === str.charCodeAt(i)&0xff);
    HEAP8[((buffer++)>>0)] = str.charCodeAt(i);
  }
  // Null-terminate the pointer to the HEAP.
  if (!dontAddNull) HEAP8[((buffer)>>0)] = 0;
}

// end include: runtime_strings_extra.js
// Memory management

function alignUp(x, multiple) {
  if (x % multiple > 0) {
    x += multiple - (x % multiple);
  }
  return x;
}

var HEAP,
/** @type {ArrayBuffer} */
  buffer,
/** @type {Int8Array} */
  HEAP8,
/** @type {Uint8Array} */
  HEAPU8,
/** @type {Int16Array} */
  HEAP16,
/** @type {Uint16Array} */
  HEAPU16,
/** @type {Int32Array} */
  HEAP32,
/** @type {Uint32Array} */
  HEAPU32,
/** @type {Float32Array} */
  HEAPF32,
/** @type {Float64Array} */
  HEAPF64;

function updateGlobalBufferAndViews(buf) {
  buffer = buf;
  Module['HEAP8'] = HEAP8 = new Int8Array(buf);
  Module['HEAP16'] = HEAP16 = new Int16Array(buf);
  Module['HEAP32'] = HEAP32 = new Int32Array(buf);
  Module['HEAPU8'] = HEAPU8 = new Uint8Array(buf);
  Module['HEAPU16'] = HEAPU16 = new Uint16Array(buf);
  Module['HEAPU32'] = HEAPU32 = new Uint32Array(buf);
  Module['HEAPF32'] = HEAPF32 = new Float32Array(buf);
  Module['HEAPF64'] = HEAPF64 = new Float64Array(buf);
}

var TOTAL_STACK = 5242880;
if (Module['TOTAL_STACK']) assert(TOTAL_STACK === Module['TOTAL_STACK'], 'the stack size can no longer be determined at runtime')

var INITIAL_MEMORY = Module['INITIAL_MEMORY'] || 16777216;
if (!Object.getOwnPropertyDescriptor(Module, 'INITIAL_MEMORY')) {
  Object.defineProperty(Module, 'INITIAL_MEMORY', {
    configurable: true,
    get: function() {
      abort('Module.INITIAL_MEMORY has been replaced with plain INITIAL_MEMORY (the initial value can be provided on Module, but after startup the value is only looked for on a local variable of that name)')
    }
  });
}

assert(INITIAL_MEMORY >= TOTAL_STACK, 'INITIAL_MEMORY should be larger than TOTAL_STACK, was ' + INITIAL_MEMORY + '! (TOTAL_STACK=' + TOTAL_STACK + ')');

// check for full engine support (use string 'subarray' to avoid closure compiler confusion)
assert(typeof Int32Array !== 'undefined' && typeof Float64Array !== 'undefined' && Int32Array.prototype.subarray !== undefined && Int32Array.prototype.set !== undefined,
       'JS engine does not provide full typed array support');

// In non-standalone/normal mode, we create the memory here.
// include: runtime_init_memory.js


// Create the wasm memory. (Note: this only applies if IMPORTED_MEMORY is defined)

  if (Module['wasmMemory']) {
    wasmMemory = Module['wasmMemory'];
  } else
  {
    wasmMemory = new WebAssembly.Memory({
      'initial': INITIAL_MEMORY / 65536,
      'maximum': INITIAL_MEMORY / 65536
    });
  }

if (wasmMemory) {
  buffer = wasmMemory.buffer;
}

// If the user provides an incorrect length, just use that length instead rather than providing the user to
// specifically provide the memory length with Module['INITIAL_MEMORY'].
INITIAL_MEMORY = buffer.byteLength;
assert(INITIAL_MEMORY % 65536 === 0);
updateGlobalBufferAndViews(buffer);

// end include: runtime_init_memory.js

// include: runtime_init_table.js
// In regular non-RELOCATABLE mode the table is exported
// from the wasm module and this will be assigned once
// the exports are available.
var wasmTable;

// end include: runtime_init_table.js
// include: runtime_stack_check.js


// Initializes the stack cookie. Called at the startup of main and at the startup of each thread in pthreads mode.
function writeStackCookie() {
  var max = _emscripten_stack_get_end();
  assert((max & 3) == 0);
  // The stack grows downwards
  HEAPU32[(max >> 2)+1] = 0x2135467;
  HEAPU32[(max >> 2)+2] = 0x89BACDFE;
  // Also test the global address 0 for integrity.
  HEAP32[0] = 0x63736d65; /* 'emsc' */
}

function checkStackCookie() {
  if (ABORT) return;
  var max = _emscripten_stack_get_end();
  var cookie1 = HEAPU32[(max >> 2)+1];
  var cookie2 = HEAPU32[(max >> 2)+2];
  if (cookie1 != 0x2135467 || cookie2 != 0x89BACDFE) {
    abort('Stack overflow! Stack cookie has been overwritten, expected hex dwords 0x89BACDFE and 0x2135467, but received 0x' + cookie2.toString(16) + ' ' + cookie1.toString(16));
  }
  // Also test the global address 0 for integrity.
  if (HEAP32[0] !== 0x63736d65 /* 'emsc' */) abort('Runtime error: The application has corrupted its heap memory area (address zero)!');
}

// end include: runtime_stack_check.js
// include: runtime_assertions.js


// Endianness check
(function() {
  var h16 = new Int16Array(1);
  var h8 = new Int8Array(h16.buffer);
  h16[0] = 0x6373;
  if (h8[0] !== 0x73 || h8[1] !== 0x63) throw 'Runtime error: expected the system to be little-endian! (Run with -s SUPPORT_BIG_ENDIAN=1 to bypass)';
})();

// end include: runtime_assertions.js
var __ATPRERUN__  = []; // functions called before the runtime is initialized
var __ATINIT__    = []; // functions called during startup
var __ATMAIN__    = []; // functions called when main() is to be run
var __ATEXIT__    = []; // functions called during shutdown
var __ATPOSTRUN__ = []; // functions called after the main() is called

var runtimeInitialized = false;
var runtimeExited = false;
var runtimeKeepaliveCounter = 0;

function keepRuntimeAlive() {
  return noExitRuntime || runtimeKeepaliveCounter > 0;
}

function preRun() {

  if (Module['preRun']) {
    if (typeof Module['preRun'] == 'function') Module['preRun'] = [Module['preRun']];
    while (Module['preRun'].length) {
      addOnPreRun(Module['preRun'].shift());
    }
  }

  callRuntimeCallbacks(__ATPRERUN__);
}

function initRuntime() {
  checkStackCookie();
  assert(!runtimeInitialized);
  runtimeInitialized = true;

  
  callRuntimeCallbacks(__ATINIT__);
}

function preMain() {
  checkStackCookie();
  
  callRuntimeCallbacks(__ATMAIN__);
}

function exitRuntime() {
  checkStackCookie();
  runtimeExited = true;
}

function postRun() {
  checkStackCookie();

  if (Module['postRun']) {
    if (typeof Module['postRun'] == 'function') Module['postRun'] = [Module['postRun']];
    while (Module['postRun'].length) {
      addOnPostRun(Module['postRun'].shift());
    }
  }

  callRuntimeCallbacks(__ATPOSTRUN__);
}

function addOnPreRun(cb) {
  __ATPRERUN__.unshift(cb);
}

function addOnInit(cb) {
  __ATINIT__.unshift(cb);
}

function addOnPreMain(cb) {
  __ATMAIN__.unshift(cb);
}

function addOnExit(cb) {
}

function addOnPostRun(cb) {
  __ATPOSTRUN__.unshift(cb);
}

// include: runtime_math.js


// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/imul

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/fround

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/clz32

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/trunc

assert(Math.imul, 'This browser does not support Math.imul(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill');
assert(Math.fround, 'This browser does not support Math.fround(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill');
assert(Math.clz32, 'This browser does not support Math.clz32(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill');
assert(Math.trunc, 'This browser does not support Math.trunc(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill');

// end include: runtime_math.js
// A counter of dependencies for calling run(). If we need to
// do asynchronous work before running, increment this and
// decrement it. Incrementing must happen in a place like
// Module.preRun (used by emcc to add file preloading).
// Note that you can add dependencies in preRun, even though
// it happens right before run - run will be postponed until
// the dependencies are met.
var runDependencies = 0;
var runDependencyWatcher = null;
var dependenciesFulfilled = null; // overridden to take different actions when all run dependencies are fulfilled
var runDependencyTracking = {};

function getUniqueRunDependency(id) {
  var orig = id;
  while (1) {
    if (!runDependencyTracking[id]) return id;
    id = orig + Math.random();
  }
}

function addRunDependency(id) {
  runDependencies++;

  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }

  if (id) {
    assert(!runDependencyTracking[id]);
    runDependencyTracking[id] = 1;
    if (runDependencyWatcher === null && typeof setInterval !== 'undefined') {
      // Check for missing dependencies every few seconds
      runDependencyWatcher = setInterval(function() {
        if (ABORT) {
          clearInterval(runDependencyWatcher);
          runDependencyWatcher = null;
          return;
        }
        var shown = false;
        for (var dep in runDependencyTracking) {
          if (!shown) {
            shown = true;
            err('still waiting on run dependencies:');
          }
          err('dependency: ' + dep);
        }
        if (shown) {
          err('(end of list)');
        }
      }, 10000);
    }
  } else {
    err('warning: run dependency added without ID');
  }
}

function removeRunDependency(id) {
  runDependencies--;

  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }

  if (id) {
    assert(runDependencyTracking[id]);
    delete runDependencyTracking[id];
  } else {
    err('warning: run dependency removed without ID');
  }
  if (runDependencies == 0) {
    if (runDependencyWatcher !== null) {
      clearInterval(runDependencyWatcher);
      runDependencyWatcher = null;
    }
    if (dependenciesFulfilled) {
      var callback = dependenciesFulfilled;
      dependenciesFulfilled = null;
      callback(); // can add another dependenciesFulfilled
    }
  }
}

Module["preloadedImages"] = {}; // maps url to image data
Module["preloadedAudios"] = {}; // maps url to audio data

/** @param {string|number=} what */
function abort(what) {
  {
    if (Module['onAbort']) {
      Module['onAbort'](what);
    }
  }

  what = 'Aborted(' + what + ')';
  // TODO(sbc): Should we remove printing and leave it up to whoever
  // catches the exception?
  err(what);

  ABORT = true;
  EXITSTATUS = 1;

  // Use a wasm runtime error, because a JS error might be seen as a foreign
  // exception, which means we'd run destructors on it. We need the error to
  // simply make the program stop.
  var e = new WebAssembly.RuntimeError(what);

  // Throw the error whether or not MODULARIZE is set because abort is used
  // in code paths apart from instantiation where an exception is expected
  // to be thrown when abort is called.
  throw e;
}

// {{MEM_INITIALIZER}}

// include: memoryprofiler.js


// end include: memoryprofiler.js
// include: URIUtils.js


// Prefix of data URIs emitted by SINGLE_FILE and related options.
var dataURIPrefix = 'data:application/octet-stream;base64,';

// Indicates whether filename is a base64 data URI.
function isDataURI(filename) {
  // Prefix of data URIs emitted by SINGLE_FILE and related options.
  return filename.startsWith(dataURIPrefix);
}

// Indicates whether filename is delivered via file protocol (as opposed to http/https)
function isFileURI(filename) {
  return filename.startsWith('file://');
}

// end include: URIUtils.js
function createExportWrapper(name, fixedasm) {
  return function() {
    var displayName = name;
    var asm = fixedasm;
    if (!fixedasm) {
      asm = Module['asm'];
    }
    assert(runtimeInitialized, 'native function `' + displayName + '` called before runtime initialization');
    assert(!runtimeExited, 'native function `' + displayName + '` called after runtime exit (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
    if (!asm[name]) {
      assert(asm[name], 'exported native function `' + displayName + '` not found');
    }
    return asm[name].apply(null, arguments);
  };
}

var wasmBinaryFile;
  wasmBinaryFile = 'open.wasm';
  if (!isDataURI(wasmBinaryFile)) {
    wasmBinaryFile = locateFile(wasmBinaryFile);
  }

function getBinary(file) {
  try {
    if (file == wasmBinaryFile && wasmBinary) {
      return new Uint8Array(wasmBinary);
    }
    var binary = tryParseAsDataURI(file);
    if (binary) {
      return binary;
    }
    if (readBinary) {
      return readBinary(file);
    } else {
      throw "both async and sync fetching of the wasm failed";
    }
  }
  catch (err) {
    abort(err);
  }
}

function getBinaryPromise() {
  // If we don't have the binary yet, try to to load it asynchronously.
  // Fetch has some additional restrictions over XHR, like it can't be used on a file:// url.
  // See https://github.com/github/fetch/pull/92#issuecomment-140665932
  // Cordova or Electron apps are typically loaded from a file:// url.
  // So use fetch if it is available and the url is not a file, otherwise fall back to XHR.
  if (!wasmBinary && (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER)) {
    if (typeof fetch === 'function'
      && !isFileURI(wasmBinaryFile)
    ) {
      return fetch(wasmBinaryFile, { credentials: 'same-origin' }).then(function(response) {
        if (!response['ok']) {
          throw "failed to load wasm binary file at '" + wasmBinaryFile + "'";
        }
        return response['arrayBuffer']();
      }).catch(function () {
          return getBinary(wasmBinaryFile);
      });
    }
    else {
      if (readAsync) {
        // fetch is not available or url is file => try XHR (readAsync uses XHR internally)
        return new Promise(function(resolve, reject) {
          readAsync(wasmBinaryFile, function(response) { resolve(new Uint8Array(/** @type{!ArrayBuffer} */(response))) }, reject)
        });
      }
    }
  }

  // Otherwise, getBinary should be able to get it synchronously
  return Promise.resolve().then(function() { return getBinary(wasmBinaryFile); });
}

// Create the wasm instance.
// Receives the wasm imports, returns the exports.
function createWasm() {
  // prepare imports
  var info = {
    'env': asmLibraryArg,
    'wasi_snapshot_preview1': asmLibraryArg,
  };
  // Load the wasm module and create an instance of using native support in the JS engine.
  // handle a generated wasm instance, receiving its exports and
  // performing other necessary setup
  /** @param {WebAssembly.Module=} module*/
  function receiveInstance(instance, module) {
    var exports = instance.exports;

    Module['asm'] = exports;

    wasmTable = Module['asm']['__indirect_function_table'];
    assert(wasmTable, "table not found in wasm exports");

    addOnInit(Module['asm']['__wasm_call_ctors']);

    removeRunDependency('wasm-instantiate');
  }
  // we can't run yet (except in a pthread, where we have a custom sync instantiator)
  addRunDependency('wasm-instantiate');

  // Prefer streaming instantiation if available.
  // Async compilation can be confusing when an error on the page overwrites Module
  // (for example, if the order of elements is wrong, and the one defining Module is
  // later), so we save Module and check it later.
  var trueModule = Module;
  function receiveInstantiationResult(result) {
    // 'result' is a ResultObject object which has both the module and instance.
    // receiveInstance() will swap in the exports (to Module.asm) so they can be called
    assert(Module === trueModule, 'the Module object should not be replaced during async compilation - perhaps the order of HTML elements is wrong?');
    trueModule = null;
    // TODO: Due to Closure regression https://github.com/google/closure-compiler/issues/3193, the above line no longer optimizes out down to the following line.
    // When the regression is fixed, can restore the above USE_PTHREADS-enabled path.
    receiveInstance(result['instance']);
  }

  function instantiateArrayBuffer(receiver) {
    return getBinaryPromise().then(function(binary) {
      return WebAssembly.instantiate(binary, info);
    }).then(function (instance) {
      return instance;
    }).then(receiver, function(reason) {
      err('failed to asynchronously prepare wasm: ' + reason);

      // Warn on some common problems.
      if (isFileURI(wasmBinaryFile)) {
        err('warning: Loading from a file URI (' + wasmBinaryFile + ') is not supported in most browsers. See https://emscripten.org/docs/getting_started/FAQ.html#how-do-i-run-a-local-webserver-for-testing-why-does-my-program-stall-in-downloading-or-preparing');
      }
      abort(reason);
    });
  }

  function instantiateAsync() {
    if (!wasmBinary &&
        typeof WebAssembly.instantiateStreaming === 'function' &&
        !isDataURI(wasmBinaryFile) &&
        // Don't use streaming for file:// delivered objects in a webview, fetch them synchronously.
        !isFileURI(wasmBinaryFile) &&
        typeof fetch === 'function') {
      return fetch(wasmBinaryFile, { credentials: 'same-origin' }).then(function (response) {
        var result = WebAssembly.instantiateStreaming(response, info);

        return result.then(
          receiveInstantiationResult,
          function(reason) {
            // We expect the most common failure cause to be a bad MIME type for the binary,
            // in which case falling back to ArrayBuffer instantiation should work.
            err('wasm streaming compile failed: ' + reason);
            err('falling back to ArrayBuffer instantiation');
            return instantiateArrayBuffer(receiveInstantiationResult);
          });
      });
    } else {
      return instantiateArrayBuffer(receiveInstantiationResult);
    }
  }

  // User shell pages can write their own Module.instantiateWasm = function(imports, successCallback) callback
  // to manually instantiate the Wasm module themselves. This allows pages to run the instantiation parallel
  // to any other async startup actions they are performing.
  if (Module['instantiateWasm']) {
    try {
      var exports = Module['instantiateWasm'](info, receiveInstance);
      return exports;
    } catch(e) {
      err('Module.instantiateWasm callback failed with error: ' + e);
      return false;
    }
  }

  instantiateAsync();
  return {}; // no exports yet; we'll fill them in later
}

// Globals used by JS i64 conversions (see makeSetValue)
var tempDouble;
var tempI64;

// === Body ===

var ASM_CONSTS = {
  
};






  function callRuntimeCallbacks(callbacks) {
      while (callbacks.length > 0) {
        var callback = callbacks.shift();
        if (typeof callback == 'function') {
          callback(Module); // Pass the module as the first argument.
          continue;
        }
        var func = callback.func;
        if (typeof func === 'number') {
          if (callback.arg === undefined) {
            wasmTable.get(func)();
          } else {
            wasmTable.get(func)(callback.arg);
          }
        } else {
          func(callback.arg === undefined ? null : callback.arg);
        }
      }
    }

  function demangle(func) {
      warnOnce('warning: build with  -s DEMANGLE_SUPPORT=1  to link in libcxxabi demangling');
      return func;
    }

  function demangleAll(text) {
      var regex =
        /\b_Z[\w\d_]+/g;
      return text.replace(regex,
        function(x) {
          var y = demangle(x);
          return x === y ? x : (y + ' [' + x + ']');
        });
    }

  function handleException(e) {
      // Certain exception types we do not treat as errors since they are used for
      // internal control flow.
      // 1. ExitStatus, which is thrown by exit()
      // 2. "unwind", which is thrown by emscripten_unwind_to_js_event_loop() and others
      //    that wish to return to JS event loop.
      if (e instanceof ExitStatus || e == 'unwind') {
        return EXITSTATUS;
      }
      quit_(1, e);
    }

  function jsStackTrace() {
      var error = new Error();
      if (!error.stack) {
        // IE10+ special cases: It does have callstack info, but it is only populated if an Error object is thrown,
        // so try that as a special-case.
        try {
          throw new Error();
        } catch(e) {
          error = e;
        }
        if (!error.stack) {
          return '(no stack trace available)';
        }
      }
      return error.stack.toString();
    }

  function stackTrace() {
      var js = jsStackTrace();
      if (Module['extraStackTrace']) js += '\n' + Module['extraStackTrace']();
      return demangleAll(js);
    }

  function ___cxa_allocate_exception(size) {
      // Thrown object is prepended by exception metadata block
      return _malloc(size + 16) + 16;
    }

  function _atexit(func, arg) {
    }
  function ___cxa_atexit(a0,a1
  ) {
  return _atexit(a0,a1);
  }

  function ExceptionInfo(excPtr) {
      this.excPtr = excPtr;
      this.ptr = excPtr - 16;
  
      this.set_type = function(type) {
        HEAP32[(((this.ptr)+(4))>>2)] = type;
      };
  
      this.get_type = function() {
        return HEAP32[(((this.ptr)+(4))>>2)];
      };
  
      this.set_destructor = function(destructor) {
        HEAP32[(((this.ptr)+(8))>>2)] = destructor;
      };
  
      this.get_destructor = function() {
        return HEAP32[(((this.ptr)+(8))>>2)];
      };
  
      this.set_refcount = function(refcount) {
        HEAP32[((this.ptr)>>2)] = refcount;
      };
  
      this.set_caught = function (caught) {
        caught = caught ? 1 : 0;
        HEAP8[(((this.ptr)+(12))>>0)] = caught;
      };
  
      this.get_caught = function () {
        return HEAP8[(((this.ptr)+(12))>>0)] != 0;
      };
  
      this.set_rethrown = function (rethrown) {
        rethrown = rethrown ? 1 : 0;
        HEAP8[(((this.ptr)+(13))>>0)] = rethrown;
      };
  
      this.get_rethrown = function () {
        return HEAP8[(((this.ptr)+(13))>>0)] != 0;
      };
  
      // Initialize native structure fields. Should be called once after allocated.
      this.init = function(type, destructor) {
        this.set_type(type);
        this.set_destructor(destructor);
        this.set_refcount(0);
        this.set_caught(false);
        this.set_rethrown(false);
      }
  
      this.add_ref = function() {
        var value = HEAP32[((this.ptr)>>2)];
        HEAP32[((this.ptr)>>2)] = value + 1;
      };
  
      // Returns true if last reference released.
      this.release_ref = function() {
        var prev = HEAP32[((this.ptr)>>2)];
        HEAP32[((this.ptr)>>2)] = prev - 1;
        assert(prev > 0);
        return prev === 1;
      };
    }
  
  var exceptionLast = 0;
  
  var uncaughtExceptionCount = 0;
  function ___cxa_throw(ptr, type, destructor) {
      var info = new ExceptionInfo(ptr);
      // Initialize ExceptionInfo content after it was allocated in __cxa_allocate_exception.
      info.init(type, destructor);
      exceptionLast = ptr;
      uncaughtExceptionCount++;
      throw ptr + " - Exception catching is disabled, this exception cannot be caught. Compile with -s NO_DISABLE_EXCEPTION_CATCHING or -s EXCEPTION_CATCHING_ALLOWED=[..] to catch.";
    }

  function _abort() {
      abort('native code called abort()');
    }

  function _emscripten_console_error(str) {
      assert(typeof str === 'number');
      err(UTF8ToString(str));
    }

  function _emscripten_console_log(str) {
      assert(typeof str === 'number');
      out(UTF8ToString(str));
    }

  function _emscripten_memcpy_big(dest, src, num) {
      HEAPU8.copyWithin(dest, src, src + num);
    }

  function abortOnCannotGrowMemory(requestedSize) {
      abort('Cannot enlarge memory arrays to size ' + requestedSize + ' bytes (OOM). Either (1) compile with  -s INITIAL_MEMORY=X  with X higher than the current value ' + HEAP8.length + ', (2) compile with  -s ALLOW_MEMORY_GROWTH=1  which allows increasing the size at runtime, or (3) if you want malloc to return NULL (0) instead of this abort, compile with  -s ABORTING_MALLOC=0 ');
    }
  function _emscripten_resize_heap(requestedSize) {
      var oldSize = HEAPU8.length;
      requestedSize = requestedSize >>> 0;
      abortOnCannotGrowMemory(requestedSize);
    }
var ASSERTIONS = true;



/** @type {function(string, boolean=, number=)} */
function intArrayFromString(stringy, dontAddNull, length) {
  var len = length > 0 ? length : lengthBytesUTF8(stringy)+1;
  var u8array = new Array(len);
  var numBytesWritten = stringToUTF8Array(stringy, u8array, 0, u8array.length);
  if (dontAddNull) u8array.length = numBytesWritten;
  return u8array;
}

function intArrayToString(array) {
  var ret = [];
  for (var i = 0; i < array.length; i++) {
    var chr = array[i];
    if (chr > 0xFF) {
      if (ASSERTIONS) {
        assert(false, 'Character code ' + chr + ' (' + String.fromCharCode(chr) + ')  at offset ' + i + ' not in 0x00-0xFF.');
      }
      chr &= 0xFF;
    }
    ret.push(String.fromCharCode(chr));
  }
  return ret.join('');
}


// Copied from https://github.com/strophe/strophejs/blob/e06d027/src/polyfills.js#L149

// This code was written by Tyler Akins and has been placed in the
// public domain.  It would be nice if you left this header intact.
// Base64 code from Tyler Akins -- http://rumkin.com

/**
 * Decodes a base64 string.
 * @param {string} input The string to decode.
 */
var decodeBase64 = typeof atob === 'function' ? atob : function (input) {
  var keyStr = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

  var output = '';
  var chr1, chr2, chr3;
  var enc1, enc2, enc3, enc4;
  var i = 0;
  // remove all characters that are not A-Z, a-z, 0-9, +, /, or =
  input = input.replace(/[^A-Za-z0-9\+\/\=]/g, '');
  do {
    enc1 = keyStr.indexOf(input.charAt(i++));
    enc2 = keyStr.indexOf(input.charAt(i++));
    enc3 = keyStr.indexOf(input.charAt(i++));
    enc4 = keyStr.indexOf(input.charAt(i++));

    chr1 = (enc1 << 2) | (enc2 >> 4);
    chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
    chr3 = ((enc3 & 3) << 6) | enc4;

    output = output + String.fromCharCode(chr1);

    if (enc3 !== 64) {
      output = output + String.fromCharCode(chr2);
    }
    if (enc4 !== 64) {
      output = output + String.fromCharCode(chr3);
    }
  } while (i < input.length);
  return output;
};

// Converts a string of base64 into a byte array.
// Throws error on invalid input.
function intArrayFromBase64(s) {
  if (typeof ENVIRONMENT_IS_NODE === 'boolean' && ENVIRONMENT_IS_NODE) {
    var buf = Buffer.from(s, 'base64');
    return new Uint8Array(buf['buffer'], buf['byteOffset'], buf['byteLength']);
  }

  try {
    var decoded = decodeBase64(s);
    var bytes = new Uint8Array(decoded.length);
    for (var i = 0 ; i < decoded.length ; ++i) {
      bytes[i] = decoded.charCodeAt(i);
    }
    return bytes;
  } catch (_) {
    throw new Error('Converting base64 string to bytes failed.');
  }
}

// If filename is a base64 data URI, parses and returns data (Buffer on node,
// Uint8Array otherwise). If filename is not a base64 data URI, returns undefined.
function tryParseAsDataURI(filename) {
  if (!isDataURI(filename)) {
    return;
  }

  return intArrayFromBase64(filename.slice(dataURIPrefix.length));
}


var asmLibraryArg = {
  "__cxa_allocate_exception": ___cxa_allocate_exception,
  "__cxa_atexit": ___cxa_atexit,
  "__cxa_throw": ___cxa_throw,
  "abort": _abort,
  "emscripten_console_error": _emscripten_console_error,
  "emscripten_console_log": _emscripten_console_log,
  "emscripten_memcpy_big": _emscripten_memcpy_big,
  "emscripten_resize_heap": _emscripten_resize_heap,
  "getTempRet0": getTempRet0,
  "memory": wasmMemory,
  "setTempRet0": setTempRet0
};
var asm = createWasm();
/** @type {function(...*):?} */
var ___wasm_call_ctors = Module["___wasm_call_ctors"] = createExportWrapper("__wasm_call_ctors");

/** @type {function(...*):?} */
var _main = Module["_main"] = createExportWrapper("main");

/** @type {function(...*):?} */
var ___errno_location = Module["___errno_location"] = createExportWrapper("__errno_location");

/** @type {function(...*):?} */
var stackSave = Module["stackSave"] = createExportWrapper("stackSave");

/** @type {function(...*):?} */
var stackRestore = Module["stackRestore"] = createExportWrapper("stackRestore");

/** @type {function(...*):?} */
var stackAlloc = Module["stackAlloc"] = createExportWrapper("stackAlloc");

/** @type {function(...*):?} */
var _emscripten_stack_init = Module["_emscripten_stack_init"] = function() {
  return (_emscripten_stack_init = Module["_emscripten_stack_init"] = Module["asm"]["emscripten_stack_init"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var _emscripten_stack_get_free = Module["_emscripten_stack_get_free"] = function() {
  return (_emscripten_stack_get_free = Module["_emscripten_stack_get_free"] = Module["asm"]["emscripten_stack_get_free"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var _emscripten_stack_get_end = Module["_emscripten_stack_get_end"] = function() {
  return (_emscripten_stack_get_end = Module["_emscripten_stack_get_end"] = Module["asm"]["emscripten_stack_get_end"]).apply(null, arguments);
};





// === Auto-generated postamble setup entry stuff ===

if (!Object.getOwnPropertyDescriptor(Module, "intArrayFromString")) Module["intArrayFromString"] = function() { abort("'intArrayFromString' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "intArrayToString")) Module["intArrayToString"] = function() { abort("'intArrayToString' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "ccall")) Module["ccall"] = function() { abort("'ccall' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "cwrap")) Module["cwrap"] = function() { abort("'cwrap' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "setValue")) Module["setValue"] = function() { abort("'setValue' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "getValue")) Module["getValue"] = function() { abort("'getValue' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "allocate")) Module["allocate"] = function() { abort("'allocate' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "UTF8ArrayToString")) Module["UTF8ArrayToString"] = function() { abort("'UTF8ArrayToString' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "UTF8ToString")) Module["UTF8ToString"] = function() { abort("'UTF8ToString' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "stringToUTF8Array")) Module["stringToUTF8Array"] = function() { abort("'stringToUTF8Array' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "stringToUTF8")) Module["stringToUTF8"] = function() { abort("'stringToUTF8' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "lengthBytesUTF8")) Module["lengthBytesUTF8"] = function() { abort("'lengthBytesUTF8' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "stackTrace")) Module["stackTrace"] = function() { abort("'stackTrace' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "addOnPreRun")) Module["addOnPreRun"] = function() { abort("'addOnPreRun' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "addOnInit")) Module["addOnInit"] = function() { abort("'addOnInit' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "addOnPreMain")) Module["addOnPreMain"] = function() { abort("'addOnPreMain' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "addOnExit")) Module["addOnExit"] = function() { abort("'addOnExit' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "addOnPostRun")) Module["addOnPostRun"] = function() { abort("'addOnPostRun' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "writeStringToMemory")) Module["writeStringToMemory"] = function() { abort("'writeStringToMemory' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "writeArrayToMemory")) Module["writeArrayToMemory"] = function() { abort("'writeArrayToMemory' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "writeAsciiToMemory")) Module["writeAsciiToMemory"] = function() { abort("'writeAsciiToMemory' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "addRunDependency")) Module["addRunDependency"] = function() { abort("'addRunDependency' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Object.getOwnPropertyDescriptor(Module, "removeRunDependency")) Module["removeRunDependency"] = function() { abort("'removeRunDependency' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Object.getOwnPropertyDescriptor(Module, "FS_createFolder")) Module["FS_createFolder"] = function() { abort("'FS_createFolder' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "FS_createPath")) Module["FS_createPath"] = function() { abort("'FS_createPath' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Object.getOwnPropertyDescriptor(Module, "FS_createDataFile")) Module["FS_createDataFile"] = function() { abort("'FS_createDataFile' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Object.getOwnPropertyDescriptor(Module, "FS_createPreloadedFile")) Module["FS_createPreloadedFile"] = function() { abort("'FS_createPreloadedFile' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Object.getOwnPropertyDescriptor(Module, "FS_createLazyFile")) Module["FS_createLazyFile"] = function() { abort("'FS_createLazyFile' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Object.getOwnPropertyDescriptor(Module, "FS_createLink")) Module["FS_createLink"] = function() { abort("'FS_createLink' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "FS_createDevice")) Module["FS_createDevice"] = function() { abort("'FS_createDevice' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Object.getOwnPropertyDescriptor(Module, "FS_unlink")) Module["FS_unlink"] = function() { abort("'FS_unlink' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Object.getOwnPropertyDescriptor(Module, "getLEB")) Module["getLEB"] = function() { abort("'getLEB' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "getFunctionTables")) Module["getFunctionTables"] = function() { abort("'getFunctionTables' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "alignFunctionTables")) Module["alignFunctionTables"] = function() { abort("'alignFunctionTables' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "registerFunctions")) Module["registerFunctions"] = function() { abort("'registerFunctions' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "addFunction")) Module["addFunction"] = function() { abort("'addFunction' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "removeFunction")) Module["removeFunction"] = function() { abort("'removeFunction' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "getFuncWrapper")) Module["getFuncWrapper"] = function() { abort("'getFuncWrapper' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "prettyPrint")) Module["prettyPrint"] = function() { abort("'prettyPrint' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "dynCall")) Module["dynCall"] = function() { abort("'dynCall' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "getCompilerSetting")) Module["getCompilerSetting"] = function() { abort("'getCompilerSetting' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "print")) Module["print"] = function() { abort("'print' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "printErr")) Module["printErr"] = function() { abort("'printErr' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "getTempRet0")) Module["getTempRet0"] = function() { abort("'getTempRet0' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "setTempRet0")) Module["setTempRet0"] = function() { abort("'setTempRet0' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "callMain")) Module["callMain"] = function() { abort("'callMain' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "abort")) Module["abort"] = function() { abort("'abort' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "keepRuntimeAlive")) Module["keepRuntimeAlive"] = function() { abort("'keepRuntimeAlive' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "zeroMemory")) Module["zeroMemory"] = function() { abort("'zeroMemory' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "stringToNewUTF8")) Module["stringToNewUTF8"] = function() { abort("'stringToNewUTF8' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "setFileTime")) Module["setFileTime"] = function() { abort("'setFileTime' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "abortOnCannotGrowMemory")) Module["abortOnCannotGrowMemory"] = function() { abort("'abortOnCannotGrowMemory' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "emscripten_realloc_buffer")) Module["emscripten_realloc_buffer"] = function() { abort("'emscripten_realloc_buffer' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "ENV")) Module["ENV"] = function() { abort("'ENV' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "ERRNO_CODES")) Module["ERRNO_CODES"] = function() { abort("'ERRNO_CODES' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "ERRNO_MESSAGES")) Module["ERRNO_MESSAGES"] = function() { abort("'ERRNO_MESSAGES' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "setErrNo")) Module["setErrNo"] = function() { abort("'setErrNo' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "inetPton4")) Module["inetPton4"] = function() { abort("'inetPton4' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "inetNtop4")) Module["inetNtop4"] = function() { abort("'inetNtop4' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "inetPton6")) Module["inetPton6"] = function() { abort("'inetPton6' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "inetNtop6")) Module["inetNtop6"] = function() { abort("'inetNtop6' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "readSockaddr")) Module["readSockaddr"] = function() { abort("'readSockaddr' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "writeSockaddr")) Module["writeSockaddr"] = function() { abort("'writeSockaddr' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "DNS")) Module["DNS"] = function() { abort("'DNS' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "getHostByName")) Module["getHostByName"] = function() { abort("'getHostByName' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "GAI_ERRNO_MESSAGES")) Module["GAI_ERRNO_MESSAGES"] = function() { abort("'GAI_ERRNO_MESSAGES' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "Protocols")) Module["Protocols"] = function() { abort("'Protocols' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "Sockets")) Module["Sockets"] = function() { abort("'Sockets' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "getRandomDevice")) Module["getRandomDevice"] = function() { abort("'getRandomDevice' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "traverseStack")) Module["traverseStack"] = function() { abort("'traverseStack' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "UNWIND_CACHE")) Module["UNWIND_CACHE"] = function() { abort("'UNWIND_CACHE' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "readAsmConstArgsArray")) Module["readAsmConstArgsArray"] = function() { abort("'readAsmConstArgsArray' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "readAsmConstArgs")) Module["readAsmConstArgs"] = function() { abort("'readAsmConstArgs' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "mainThreadEM_ASM")) Module["mainThreadEM_ASM"] = function() { abort("'mainThreadEM_ASM' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "jstoi_q")) Module["jstoi_q"] = function() { abort("'jstoi_q' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "jstoi_s")) Module["jstoi_s"] = function() { abort("'jstoi_s' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "getExecutableName")) Module["getExecutableName"] = function() { abort("'getExecutableName' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "listenOnce")) Module["listenOnce"] = function() { abort("'listenOnce' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "autoResumeAudioContext")) Module["autoResumeAudioContext"] = function() { abort("'autoResumeAudioContext' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "dynCallLegacy")) Module["dynCallLegacy"] = function() { abort("'dynCallLegacy' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "getDynCaller")) Module["getDynCaller"] = function() { abort("'getDynCaller' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "dynCall")) Module["dynCall"] = function() { abort("'dynCall' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "callRuntimeCallbacks")) Module["callRuntimeCallbacks"] = function() { abort("'callRuntimeCallbacks' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "handleException")) Module["handleException"] = function() { abort("'handleException' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "runtimeKeepalivePush")) Module["runtimeKeepalivePush"] = function() { abort("'runtimeKeepalivePush' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "runtimeKeepalivePop")) Module["runtimeKeepalivePop"] = function() { abort("'runtimeKeepalivePop' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "callUserCallback")) Module["callUserCallback"] = function() { abort("'callUserCallback' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "maybeExit")) Module["maybeExit"] = function() { abort("'maybeExit' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "safeSetTimeout")) Module["safeSetTimeout"] = function() { abort("'safeSetTimeout' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "asmjsMangle")) Module["asmjsMangle"] = function() { abort("'asmjsMangle' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "asyncLoad")) Module["asyncLoad"] = function() { abort("'asyncLoad' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "alignMemory")) Module["alignMemory"] = function() { abort("'alignMemory' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "mmapAlloc")) Module["mmapAlloc"] = function() { abort("'mmapAlloc' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "reallyNegative")) Module["reallyNegative"] = function() { abort("'reallyNegative' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "unSign")) Module["unSign"] = function() { abort("'unSign' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "reSign")) Module["reSign"] = function() { abort("'reSign' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "formatString")) Module["formatString"] = function() { abort("'formatString' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "PATH")) Module["PATH"] = function() { abort("'PATH' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "PATH_FS")) Module["PATH_FS"] = function() { abort("'PATH_FS' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "SYSCALLS")) Module["SYSCALLS"] = function() { abort("'SYSCALLS' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "syscallMmap2")) Module["syscallMmap2"] = function() { abort("'syscallMmap2' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "syscallMunmap")) Module["syscallMunmap"] = function() { abort("'syscallMunmap' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "getSocketFromFD")) Module["getSocketFromFD"] = function() { abort("'getSocketFromFD' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "getSocketAddress")) Module["getSocketAddress"] = function() { abort("'getSocketAddress' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "JSEvents")) Module["JSEvents"] = function() { abort("'JSEvents' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "registerKeyEventCallback")) Module["registerKeyEventCallback"] = function() { abort("'registerKeyEventCallback' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "specialHTMLTargets")) Module["specialHTMLTargets"] = function() { abort("'specialHTMLTargets' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "maybeCStringToJsString")) Module["maybeCStringToJsString"] = function() { abort("'maybeCStringToJsString' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "findEventTarget")) Module["findEventTarget"] = function() { abort("'findEventTarget' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "findCanvasEventTarget")) Module["findCanvasEventTarget"] = function() { abort("'findCanvasEventTarget' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "getBoundingClientRect")) Module["getBoundingClientRect"] = function() { abort("'getBoundingClientRect' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "fillMouseEventData")) Module["fillMouseEventData"] = function() { abort("'fillMouseEventData' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "registerMouseEventCallback")) Module["registerMouseEventCallback"] = function() { abort("'registerMouseEventCallback' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "registerWheelEventCallback")) Module["registerWheelEventCallback"] = function() { abort("'registerWheelEventCallback' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "registerUiEventCallback")) Module["registerUiEventCallback"] = function() { abort("'registerUiEventCallback' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "registerFocusEventCallback")) Module["registerFocusEventCallback"] = function() { abort("'registerFocusEventCallback' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "fillDeviceOrientationEventData")) Module["fillDeviceOrientationEventData"] = function() { abort("'fillDeviceOrientationEventData' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "registerDeviceOrientationEventCallback")) Module["registerDeviceOrientationEventCallback"] = function() { abort("'registerDeviceOrientationEventCallback' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "fillDeviceMotionEventData")) Module["fillDeviceMotionEventData"] = function() { abort("'fillDeviceMotionEventData' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "registerDeviceMotionEventCallback")) Module["registerDeviceMotionEventCallback"] = function() { abort("'registerDeviceMotionEventCallback' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "screenOrientation")) Module["screenOrientation"] = function() { abort("'screenOrientation' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "fillOrientationChangeEventData")) Module["fillOrientationChangeEventData"] = function() { abort("'fillOrientationChangeEventData' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "registerOrientationChangeEventCallback")) Module["registerOrientationChangeEventCallback"] = function() { abort("'registerOrientationChangeEventCallback' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "fillFullscreenChangeEventData")) Module["fillFullscreenChangeEventData"] = function() { abort("'fillFullscreenChangeEventData' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "registerFullscreenChangeEventCallback")) Module["registerFullscreenChangeEventCallback"] = function() { abort("'registerFullscreenChangeEventCallback' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "registerRestoreOldStyle")) Module["registerRestoreOldStyle"] = function() { abort("'registerRestoreOldStyle' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "hideEverythingExceptGivenElement")) Module["hideEverythingExceptGivenElement"] = function() { abort("'hideEverythingExceptGivenElement' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "restoreHiddenElements")) Module["restoreHiddenElements"] = function() { abort("'restoreHiddenElements' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "setLetterbox")) Module["setLetterbox"] = function() { abort("'setLetterbox' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "currentFullscreenStrategy")) Module["currentFullscreenStrategy"] = function() { abort("'currentFullscreenStrategy' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "restoreOldWindowedStyle")) Module["restoreOldWindowedStyle"] = function() { abort("'restoreOldWindowedStyle' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "softFullscreenResizeWebGLRenderTarget")) Module["softFullscreenResizeWebGLRenderTarget"] = function() { abort("'softFullscreenResizeWebGLRenderTarget' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "doRequestFullscreen")) Module["doRequestFullscreen"] = function() { abort("'doRequestFullscreen' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "fillPointerlockChangeEventData")) Module["fillPointerlockChangeEventData"] = function() { abort("'fillPointerlockChangeEventData' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "registerPointerlockChangeEventCallback")) Module["registerPointerlockChangeEventCallback"] = function() { abort("'registerPointerlockChangeEventCallback' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "registerPointerlockErrorEventCallback")) Module["registerPointerlockErrorEventCallback"] = function() { abort("'registerPointerlockErrorEventCallback' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "requestPointerLock")) Module["requestPointerLock"] = function() { abort("'requestPointerLock' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "fillVisibilityChangeEventData")) Module["fillVisibilityChangeEventData"] = function() { abort("'fillVisibilityChangeEventData' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "registerVisibilityChangeEventCallback")) Module["registerVisibilityChangeEventCallback"] = function() { abort("'registerVisibilityChangeEventCallback' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "registerTouchEventCallback")) Module["registerTouchEventCallback"] = function() { abort("'registerTouchEventCallback' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "fillGamepadEventData")) Module["fillGamepadEventData"] = function() { abort("'fillGamepadEventData' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "registerGamepadEventCallback")) Module["registerGamepadEventCallback"] = function() { abort("'registerGamepadEventCallback' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "registerBeforeUnloadEventCallback")) Module["registerBeforeUnloadEventCallback"] = function() { abort("'registerBeforeUnloadEventCallback' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "fillBatteryEventData")) Module["fillBatteryEventData"] = function() { abort("'fillBatteryEventData' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "battery")) Module["battery"] = function() { abort("'battery' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "registerBatteryEventCallback")) Module["registerBatteryEventCallback"] = function() { abort("'registerBatteryEventCallback' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "setCanvasElementSize")) Module["setCanvasElementSize"] = function() { abort("'setCanvasElementSize' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "getCanvasElementSize")) Module["getCanvasElementSize"] = function() { abort("'getCanvasElementSize' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "demangle")) Module["demangle"] = function() { abort("'demangle' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "demangleAll")) Module["demangleAll"] = function() { abort("'demangleAll' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "jsStackTrace")) Module["jsStackTrace"] = function() { abort("'jsStackTrace' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "stackTrace")) Module["stackTrace"] = function() { abort("'stackTrace' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "getEnvStrings")) Module["getEnvStrings"] = function() { abort("'getEnvStrings' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "checkWasiClock")) Module["checkWasiClock"] = function() { abort("'checkWasiClock' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "flush_NO_FILESYSTEM")) Module["flush_NO_FILESYSTEM"] = function() { abort("'flush_NO_FILESYSTEM' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "writeI53ToI64")) Module["writeI53ToI64"] = function() { abort("'writeI53ToI64' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "writeI53ToI64Clamped")) Module["writeI53ToI64Clamped"] = function() { abort("'writeI53ToI64Clamped' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "writeI53ToI64Signaling")) Module["writeI53ToI64Signaling"] = function() { abort("'writeI53ToI64Signaling' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "writeI53ToU64Clamped")) Module["writeI53ToU64Clamped"] = function() { abort("'writeI53ToU64Clamped' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "writeI53ToU64Signaling")) Module["writeI53ToU64Signaling"] = function() { abort("'writeI53ToU64Signaling' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "readI53FromI64")) Module["readI53FromI64"] = function() { abort("'readI53FromI64' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "readI53FromU64")) Module["readI53FromU64"] = function() { abort("'readI53FromU64' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "convertI32PairToI53")) Module["convertI32PairToI53"] = function() { abort("'convertI32PairToI53' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "convertU32PairToI53")) Module["convertU32PairToI53"] = function() { abort("'convertU32PairToI53' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "setImmediateWrapped")) Module["setImmediateWrapped"] = function() { abort("'setImmediateWrapped' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "clearImmediateWrapped")) Module["clearImmediateWrapped"] = function() { abort("'clearImmediateWrapped' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "polyfillSetImmediate")) Module["polyfillSetImmediate"] = function() { abort("'polyfillSetImmediate' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "uncaughtExceptionCount")) Module["uncaughtExceptionCount"] = function() { abort("'uncaughtExceptionCount' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "exceptionLast")) Module["exceptionLast"] = function() { abort("'exceptionLast' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "exceptionCaught")) Module["exceptionCaught"] = function() { abort("'exceptionCaught' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "ExceptionInfo")) Module["ExceptionInfo"] = function() { abort("'ExceptionInfo' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "CatchInfo")) Module["CatchInfo"] = function() { abort("'CatchInfo' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "exception_addRef")) Module["exception_addRef"] = function() { abort("'exception_addRef' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "exception_decRef")) Module["exception_decRef"] = function() { abort("'exception_decRef' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "Browser")) Module["Browser"] = function() { abort("'Browser' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "funcWrappers")) Module["funcWrappers"] = function() { abort("'funcWrappers' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "getFuncWrapper")) Module["getFuncWrapper"] = function() { abort("'getFuncWrapper' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "setMainLoop")) Module["setMainLoop"] = function() { abort("'setMainLoop' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "wget")) Module["wget"] = function() { abort("'wget' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "tempFixedLengthArray")) Module["tempFixedLengthArray"] = function() { abort("'tempFixedLengthArray' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "miniTempWebGLFloatBuffers")) Module["miniTempWebGLFloatBuffers"] = function() { abort("'miniTempWebGLFloatBuffers' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "heapObjectForWebGLType")) Module["heapObjectForWebGLType"] = function() { abort("'heapObjectForWebGLType' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "heapAccessShiftForWebGLHeap")) Module["heapAccessShiftForWebGLHeap"] = function() { abort("'heapAccessShiftForWebGLHeap' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "GL")) Module["GL"] = function() { abort("'GL' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "emscriptenWebGLGet")) Module["emscriptenWebGLGet"] = function() { abort("'emscriptenWebGLGet' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "computeUnpackAlignedImageSize")) Module["computeUnpackAlignedImageSize"] = function() { abort("'computeUnpackAlignedImageSize' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "emscriptenWebGLGetTexPixelData")) Module["emscriptenWebGLGetTexPixelData"] = function() { abort("'emscriptenWebGLGetTexPixelData' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "emscriptenWebGLGetUniform")) Module["emscriptenWebGLGetUniform"] = function() { abort("'emscriptenWebGLGetUniform' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "webglGetUniformLocation")) Module["webglGetUniformLocation"] = function() { abort("'webglGetUniformLocation' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "webglPrepareUniformLocationsBeforeFirstUse")) Module["webglPrepareUniformLocationsBeforeFirstUse"] = function() { abort("'webglPrepareUniformLocationsBeforeFirstUse' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "webglGetLeftBracePos")) Module["webglGetLeftBracePos"] = function() { abort("'webglGetLeftBracePos' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "emscriptenWebGLGetVertexAttrib")) Module["emscriptenWebGLGetVertexAttrib"] = function() { abort("'emscriptenWebGLGetVertexAttrib' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "writeGLArray")) Module["writeGLArray"] = function() { abort("'writeGLArray' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "AL")) Module["AL"] = function() { abort("'AL' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "SDL_unicode")) Module["SDL_unicode"] = function() { abort("'SDL_unicode' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "SDL_ttfContext")) Module["SDL_ttfContext"] = function() { abort("'SDL_ttfContext' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "SDL_audio")) Module["SDL_audio"] = function() { abort("'SDL_audio' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "SDL")) Module["SDL"] = function() { abort("'SDL' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "SDL_gfx")) Module["SDL_gfx"] = function() { abort("'SDL_gfx' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "GLUT")) Module["GLUT"] = function() { abort("'GLUT' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "EGL")) Module["EGL"] = function() { abort("'EGL' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "GLFW_Window")) Module["GLFW_Window"] = function() { abort("'GLFW_Window' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "GLFW")) Module["GLFW"] = function() { abort("'GLFW' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "GLEW")) Module["GLEW"] = function() { abort("'GLEW' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "IDBStore")) Module["IDBStore"] = function() { abort("'IDBStore' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "runAndAbortIfError")) Module["runAndAbortIfError"] = function() { abort("'runAndAbortIfError' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "warnOnce")) Module["warnOnce"] = function() { abort("'warnOnce' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "stackSave")) Module["stackSave"] = function() { abort("'stackSave' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "stackRestore")) Module["stackRestore"] = function() { abort("'stackRestore' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "stackAlloc")) Module["stackAlloc"] = function() { abort("'stackAlloc' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "AsciiToString")) Module["AsciiToString"] = function() { abort("'AsciiToString' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "stringToAscii")) Module["stringToAscii"] = function() { abort("'stringToAscii' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "UTF16ToString")) Module["UTF16ToString"] = function() { abort("'UTF16ToString' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "stringToUTF16")) Module["stringToUTF16"] = function() { abort("'stringToUTF16' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "lengthBytesUTF16")) Module["lengthBytesUTF16"] = function() { abort("'lengthBytesUTF16' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "UTF32ToString")) Module["UTF32ToString"] = function() { abort("'UTF32ToString' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "stringToUTF32")) Module["stringToUTF32"] = function() { abort("'stringToUTF32' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "lengthBytesUTF32")) Module["lengthBytesUTF32"] = function() { abort("'lengthBytesUTF32' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "allocateUTF8")) Module["allocateUTF8"] = function() { abort("'allocateUTF8' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "allocateUTF8OnStack")) Module["allocateUTF8OnStack"] = function() { abort("'allocateUTF8OnStack' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
Module["writeStackCookie"] = writeStackCookie;
Module["checkStackCookie"] = checkStackCookie;
if (!Object.getOwnPropertyDescriptor(Module, "intArrayFromBase64")) Module["intArrayFromBase64"] = function() { abort("'intArrayFromBase64' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "tryParseAsDataURI")) Module["tryParseAsDataURI"] = function() { abort("'tryParseAsDataURI' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "ALLOC_NORMAL")) Object.defineProperty(Module, "ALLOC_NORMAL", { configurable: true, get: function() { abort("'ALLOC_NORMAL' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") } });
if (!Object.getOwnPropertyDescriptor(Module, "ALLOC_STACK")) Object.defineProperty(Module, "ALLOC_STACK", { configurable: true, get: function() { abort("'ALLOC_STACK' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") } });

var calledRun;

/**
 * @constructor
 * @this {ExitStatus}
 */
function ExitStatus(status) {
  this.name = "ExitStatus";
  this.message = "Program terminated with exit(" + status + ")";
  this.status = status;
}

var calledMain = false;

dependenciesFulfilled = function runCaller() {
  // If run has never been called, and we should call run (INVOKE_RUN is true, and Module.noInitialRun is not false)
  if (!calledRun) run();
  if (!calledRun) dependenciesFulfilled = runCaller; // try this again later, after new deps are fulfilled
};

function callMain(args) {
  assert(runDependencies == 0, 'cannot call main when async dependencies remain! (listen on Module["onRuntimeInitialized"])');
  assert(__ATPRERUN__.length == 0, 'cannot call main when preRun functions remain to be called');

  var entryFunction = Module['_main'];

  args = args || [];

  var argc = args.length+1;
  var argv = stackAlloc((argc + 1) * 4);
  HEAP32[argv >> 2] = allocateUTF8OnStack(thisProgram);
  for (var i = 1; i < argc; i++) {
    HEAP32[(argv >> 2) + i] = allocateUTF8OnStack(args[i - 1]);
  }
  HEAP32[(argv >> 2) + argc] = 0;

  try {

    var ret = entryFunction(argc, argv);

    // In PROXY_TO_PTHREAD builds, we should never exit the runtime below, as
    // execution is asynchronously handed off to a pthread.
    // if we're not running an evented main loop, it's time to exit
    exit(ret, /* implicit = */ true);
    return ret;
  }
  catch (e) {
    return handleException(e);
  } finally {
    calledMain = true;

  }
}

function stackCheckInit() {
  // This is normally called automatically during __wasm_call_ctors but need to
  // get these values before even running any of the ctors so we call it redundantly
  // here.
  // TODO(sbc): Move writeStackCookie to native to to avoid this.
  _emscripten_stack_init();
  writeStackCookie();
}

/** @type {function(Array=)} */
function run(args) {
  args = args || arguments_;

  if (runDependencies > 0) {
    return;
  }

  stackCheckInit();

  preRun();

  // a preRun added a dependency, run will be called later
  if (runDependencies > 0) {
    return;
  }

  function doRun() {
    // run may have just been called through dependencies being fulfilled just in this very frame,
    // or while the async setStatus time below was happening
    if (calledRun) return;
    calledRun = true;
    Module['calledRun'] = true;

    if (ABORT) return;

    initRuntime();

    preMain();

    if (Module['onRuntimeInitialized']) Module['onRuntimeInitialized']();

    if (shouldRunNow) callMain(args);

    postRun();
  }

  if (Module['setStatus']) {
    Module['setStatus']('Running...');
    setTimeout(function() {
      setTimeout(function() {
        Module['setStatus']('');
      }, 1);
      doRun();
    }, 1);
  } else
  {
    doRun();
  }
  checkStackCookie();
}
Module['run'] = run;

function checkUnflushedContent() {
  // Compiler settings do not allow exiting the runtime, so flushing
  // the streams is not possible. but in ASSERTIONS mode we check
  // if there was something to flush, and if so tell the user they
  // should request that the runtime be exitable.
  // Normally we would not even include flush() at all, but in ASSERTIONS
  // builds we do so just for this check, and here we see if there is any
  // content to flush, that is, we check if there would have been
  // something a non-ASSERTIONS build would have not seen.
  // How we flush the streams depends on whether we are in SYSCALLS_REQUIRE_FILESYSTEM=0
  // mode (which has its own special function for this; otherwise, all
  // the code is inside libc)
  var oldOut = out;
  var oldErr = err;
  var has = false;
  out = err = function(x) {
    has = true;
  }
  try { // it doesn't matter if it fails
    var flush = null;
    if (flush) flush();
  } catch(e) {}
  out = oldOut;
  err = oldErr;
  if (has) {
    warnOnce('stdio streams had content in them that was not flushed. you should set EXIT_RUNTIME to 1 (see the FAQ), or make sure to emit a newline when you printf etc.');
    warnOnce('(this may also be due to not including full filesystem support - try building with -s FORCE_FILESYSTEM=1)');
  }
}

/** @param {boolean|number=} implicit */
function exit(status, implicit) {
  EXITSTATUS = status;

  checkUnflushedContent();

  if (keepRuntimeAlive()) {
    // if exit() was called, we may warn the user if the runtime isn't actually being shut down
    if (!implicit) {
      var msg = 'program exited (with status: ' + status + '), but EXIT_RUNTIME is not set, so halting execution but not exiting the runtime or preventing further async execution (build with EXIT_RUNTIME=1, if you want a true shutdown)';
      err(msg);
    }
  } else {
    exitRuntime();
  }

  procExit(status);
}

function procExit(code) {
  EXITSTATUS = code;
  if (!keepRuntimeAlive()) {
    if (Module['onExit']) Module['onExit'](code);
    ABORT = true;
  }
  quit_(code, new ExitStatus(code));
}

if (Module['preInit']) {
  if (typeof Module['preInit'] == 'function') Module['preInit'] = [Module['preInit']];
  while (Module['preInit'].length > 0) {
    Module['preInit'].pop()();
  }
}

// shouldRunNow refers to calling main(), not run().
var shouldRunNow = true;

if (Module['noInitialRun']) shouldRunNow = false;

run();





