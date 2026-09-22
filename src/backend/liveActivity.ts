// Starting, updating and ending the Live Activity.
//
// KEPT OUT OF RideContext DELIBERATELY. The ride store is already the largest file in the app,
// and a lock-screen surface that fails must never take a travel down with it — every call here
// is wrapped, returns nothing, and is safe to make on a platform that has no such thing.
//
// ONE AT A TIME. ActivityKit will happily run several; a traveler has one travel. The instance
// is held here so a second start replaces rather than stacks, and so a restart of the app can
// still end an activity it did not begin — `TravelActivity.getInstances()` is the only handle
// that survives the process.
import { Platform } from 'react-native';
import { TravelActivity, type TravelActivityProps } from '../widgets/TravelActivity';

type Instance = { update: (p: TravelActivityProps) => Promise<void>; end: (...a: unknown[]) => Promise<void> };

let current: Instance | null = null;

/** Live Activities are iOS 16.1+; everything here is a no-op elsewhere. */
const supported = Platform.OS === 'ios';

/** Begin showing a travel on the lock screen. Safe to call twice — the second replaces. */
export function startTravelActivity(props: TravelActivityProps): void {
  if (!supported) return;
  try {
    endTravelActivity();
    // The deep link is what a tap on the lock screen opens: the travel itself, not the app's
    // front door. Somebody glancing at a Live Activity wants the screen it came from.
    current = TravelActivity.start(props, 'americanrider:///ride') as unknown as Instance;
  } catch {
    // A refused activity (permission off, too many running, unsupported device) costs the
    // lock screen and nothing else. The travel is unaffected.
  }
}

/** Move it along. Silently does nothing when no activity is running. */
export function updateTravelActivity(props: TravelActivityProps): void {
  if (!supported || !current) return;
  try {
    current.update(props).catch(() => {});
  } catch {
    /* see above */
  }
}

/**
 * End it.
 *
 * `immediate` removes it from the lock screen at once — right for a cancellation. The default
 * leaves it briefly, which is right for an arrival: somebody glancing down after getting out
 * should still see which travel it was.
 */
export function endTravelActivity(immediate = false): void {
  if (!supported) return;
  try {
    // Anything still running, including from a previous launch of the app. A Live Activity
    // outliving the process is the one failure mode users actually complain about.
    const running = TravelActivity.getInstances() as unknown as Instance[];
    for (const a of running) a.end(immediate ? 'immediate' : 'default').catch(() => {});
    current?.end(immediate ? 'immediate' : 'default').catch(() => {});
  } catch {
    /* nothing to end, or no ActivityKit here */
  }
  current = null;
}
