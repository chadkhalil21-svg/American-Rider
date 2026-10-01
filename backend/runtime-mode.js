const { readKey } = require('./env');

function stripeKeyMode() {
  const key = readKey('STRIPE_SECRET_KEY');
  return /^(sk|rk)_live_/.test(key) ? 'live' : /^(sk|rk)_test_/.test(key) ? 'test' : 'no-key';
}

function deploymentMode() {
  return String(readKey('DEPLOYMENT_MODE') || 'development').toLowerCase();
}

function productionMode() {
  return deploymentMode() === 'production' || stripeKeyMode() === 'live';
}

module.exports = { stripeKeyMode, deploymentMode, productionMode };
