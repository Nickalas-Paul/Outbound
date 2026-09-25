// Learn more: https://docs.expo.dev/guides/customizing-metro/
// Monorepo: https://docs.expo.dev/guides/monorepos/
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(projectRoot);

config.resolver.sourceExts.push('mjs');
config.resolver.unstable_enablePackageExports = true;

// Explicit npm-workspaces roots so hoisted packages resolve even when
// Expo Autolinking sticky resolution clears nodeModulesPaths for a match,
// and so app-local + workspace-root installs are both searchable.
const appNodeModules = path.resolve(projectRoot, 'node_modules');
const workspaceNodeModules = path.resolve(workspaceRoot, 'node_modules');
config.watchFolders = Array.from(
  new Set([...(config.watchFolders || []), workspaceRoot, workspaceNodeModules])
);
config.resolver.nodeModulesPaths = Array.from(
  new Set([
    appNodeModules,
    workspaceNodeModules,
    ...(config.resolver.nodeModulesPaths || []),
  ])
);

// Zod 4 ships dual CJS/ESM. Metro can pick the CJS graph (`*.cjs`) which then
// fails to resolve sibling `../locales/index.cjs` under package-exports mode.
// Prefer the ESM entry so intake schemas (and any other zod imports) bundle.
// Only intercept zod/*; all other modules fall through to Metro/Expo resolution
// (including Autolinking sticky resolution applied after this config loads).
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
  if (typeof defaultResolve === 'function') {
    return defaultResolve(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
