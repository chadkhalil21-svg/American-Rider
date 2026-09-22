// WHY THIS EXISTS, and it is one rule that matters more than the rest.
//
// On 29 Aug 2026 `/operator/disclosure/acknowledge` threw `DISCLOSURE is not defined` on every
// call. server.js used `DISCLOSURE.statute` and imported every other name from disclosure.js
// but not that one — the two-version refactor changed the import line and not the line that
// consumed it. The gate inverted: an operator was told to read the disclosure, read it, said
// so, and was refused. Nobody could go on duty.
//
// All 25 disclosure tests passed, and always had. They exercise disclosure.js directly and
// never call the route. Tests prove a module; they do not prove it is WIRED. `no-undef` proves
// wiring, statically, over every line of every route — including the ones no test reaches.
//
// So this config is deliberately not a style config. Formatting opinions belong somewhere that
// can be argued about; this file is for the class of mistake that silently breaks a route.
//
//   npm run lint      in backend/
const globals = {
  require: 'readonly',
  module: 'writable',
  exports: 'writable',
  process: 'readonly',
  console: 'readonly',
  Buffer: 'readonly',
  __dirname: 'readonly',
  __filename: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
  setImmediate: 'readonly',
  URL: 'readonly',
  URLSearchParams: 'readonly',
  TextEncoder: 'readonly',
  TextDecoder: 'readonly',
  AbortController: 'readonly',
  fetch: 'readonly',
  crypto: 'readonly',
  structuredClone: 'readonly',
};

module.exports = [
  {
    files: ['**/*.js'],
    ignores: ['node_modules/**'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'commonjs',
      globals,
    },
    rules: {
      // THE RULE THIS FILE IS FOR. A name used and never defined is not a style preference.
      'no-undef': 'error',
      // A second one worth having: a `case` that falls into the next is nearly always a typo,
      // and in a route that decides money it is not a typo anyone notices by reading.
      'no-fallthrough': 'error',
      // Assigning to a const, redeclaring, or calling something before it is defined are all
      // the same family: the code says one thing and does another.
      'no-const-assign': 'error',
      'no-redeclare': 'error',
      'no-dupe-keys': 'error',
      'no-dupe-args': 'error',
      'no-unreachable': 'error',
      // Deliberately NOT no-unused-vars: an unused import is untidy, not broken, and turning
      // it on would bury the one error above in noise nobody reads.
    },
  },
];
