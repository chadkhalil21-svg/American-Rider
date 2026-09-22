import { t } from '../i18n';
// A WEB STAND-IN FOR STRIPE'S NATIVE SDK.
//
// @stripe/stripe-react-native imports React Native internals that do not exist on web, so the
// web bundle would not build at all — which is why this app had no web build until 5 Sept
// 2026, and therefore no way to show anybody the product without an iPhone and a signed
// TestFlight invitation.
//
// WHAT THE WEB BUILD IS FOR. Review. Somebody — a person or another model — needs to walk
// every screen, read every string in five languages, and say what a traveler would expect to
// be there. That needs the app, not a description of it, and not a code dump.
//
// SO PAYMENT IS THE ONE THING IT CANNOT DO, and this shim makes that explicit rather than
// silent. Every function refuses with a plain message, the review build says so on the
// payment step, and nothing here ever pretends a charge happened. A stub that returned
// success would produce a demo where the money path appears to work — the exact class of
// lie this codebase keeps having to remove.
const unavailable = { code: 'WebUnsupported', message: t('traveler.webPaymentUnavailable') };

export async function initStripe(): Promise<void> {
  /* nothing to initialise; the native SDK is absent on web */
}

export async function initPaymentSheet() {
  return { error: unavailable };
}

export async function presentPaymentSheet() {
  return { error: unavailable };
}

export async function retrievePaymentIntent() {
  return { error: unavailable };
}
