// Metro configuration.
//
// ONE JOB: let the app build for web. @stripe/stripe-react-native imports React Native
// internals that do not exist in a browser, so any web bundle failed on it — see
// src/shims/stripe.web.ts for why a web build matters and what it deliberately cannot do.
//
// Native resolution is untouched. This swaps the module only when the platform is web, so an
// iOS build gets the real SDK exactly as before.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const config = getDefaultConfig(__dirname);

// Native-only modules that break a web bundle, and the stand-ins that let it build. Each shim
// explains what it deliberately does not do — see src/shims/.
const WEB_SHIMS = {
  '@stripe/stripe-react-native': path.resolve(__dirname, 'src/shims/stripe.web.ts'),
  'expo-widgets': path.resolve(__dirname, 'src/shims/widgets.web.ts'),
};

const upstream = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && WEB_SHIMS[moduleName]) {
    return { type: 'sourceFile', filePath: WEB_SHIMS[moduleName] };
  }
  return (upstream ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
