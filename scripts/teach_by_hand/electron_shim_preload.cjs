// electron_shim_preload.cjs -- D-BP164-M0-088/SEG-HN. Loaded via NODE_OPTIONS="--require ...".
// Intercepts require('electron') and redirects it to electron_shim.cjs, so the driver can run as
// a plain Node process against the project's own compiled main-process code (dist/main/), never
// touching node_modules and never editing any file this ticket's mission calls a ground-truth file.
const Module = require('module');
const path = require('path');

const shimPath = path.join(__dirname, 'electron_shim.cjs');
const originalResolveFilename = Module._resolveFilename;

Module._resolveFilename = function (request, ...rest) {
  if (request === 'electron') {
    return shimPath;
  }
  return originalResolveFilename.call(this, request, ...rest);
};
