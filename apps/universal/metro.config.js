// Learn more: https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

config.resolver.sourceExts.push('mjs');
config.resolver.unstable_enablePackageExports = true;

// Zod 4 ships dual CJS/ESM. Metro can pick the CJS graph (`*.cjs`) which then
// fails to resolve sibling `../locales/index.cjs` under package-exports mode.
// Prefer the ESM entry so intake schemas (and any other zod imports) bundle.
const defaultResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'zod' || moduleName.startsWith('zod/')) {
    const zodRoot = path.dirname(require.resolve('zod/package.json'));
    if (moduleName === 'zod') {
      return { type: 'sourceFile', filePath: path.join(zodRoot, 'index.js') };
    }
    // e.g. zod/v4 → v4/index.js
    const sub = moduleName.slice('zod/'.length);
    const candidates = [
      path.join(zodRoot, `${sub}.js`),
      path.join(zodRoot, sub, 'index.js'),
    ];
    for (const filePath of candidates) {
      try {
        require('fs').accessSync(filePath);
        return { type: 'sourceFile', filePath };
      } catch {
        /* try next */
      }
    }
  }
  if (defaultResolve) {
    return defaultResolve(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
