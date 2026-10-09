// Production CORS is a browser cross-origin guard, not an authentication mechanism.
// A same-origin POST from /ops has an Origin header too. Denying that header prevents
// legitimate staff sign-in on the Render-hosted Operations page.
function sameOrigin(req, origin) {
  if (typeof origin !== 'string' || !origin) return false;
  const host = req.get?.('host') || req.headers?.host;
  const protocol = req.protocol;
  if (!host || !['http', 'https'].includes(protocol)) return false;
  try {
    return origin === new URL(`${protocol}://${host}`).origin;
  } catch {
    return false;
  }
}

// Dynamic options provide the request's host/protocol to the CORS decision.
// Express trust proxy must be configured for the known Render hop before mounting.
function corsOptionsFor(productionMode, allowedOrigins) {
  return (req, done) => done(null, {
    origin(origin, accept) {
      if (!productionMode || !origin || allowedOrigins.has(origin) || sameOrigin(req, origin)) {
        return accept(null, true);
      }
      return accept(new Error('Origin not allowed'));
    },
  });
}

module.exports = { sameOrigin, corsOptionsFor };
