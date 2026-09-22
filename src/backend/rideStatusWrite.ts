// The exact Firestore update an operator's app sends to move a travel along.
//
// ONE DEFINITION, IMPORTED BY BOTH SIDES. operatorInbox.ts setStatus() sends this object, and
// infra/rules-emulator imports this same file to send it to the Firestore emulator. The rules
// and the app therefore cannot drift apart silently again: on 22 Sept 2026 an audit found that
// setStatus() wrote onboardAt and completedAt, which firestore.rules did not permit, so the
// write to 'onboard' and to 'completed' would have been refused while the unit tests, which
// sent status alone, passed.
//
// NO IMPORTS, so a test can load it without the app's Firebase set-up.

export type OperatorStatus = 'arrived' | 'onboard' | 'completed' | 'declined';

/** The timestamp each status stamps, written only in the update that enters that status. */
export const STATUS_STAMP: Record<OperatorStatus, 'arrivedAt' | 'onboardAt' | 'completedAt' | 'declinedAt'> = {
  arrived: 'arrivedAt',
  declined: 'declinedAt',
  // WHEN THE TRAVEL RAN. Florida's receipt rule (627.748(6)) wants its total time; that is
  // boarding to completion, and only the operator's app knows both moments.
  onboard: 'onboardAt',
  completed: 'completedAt',
};

/** The update for moving a travel to `status`, stamped with `now`. */
export function operatorStatusWrite(status: OperatorStatus, now: number): Record<string, unknown> {
  return {
    status,
    statusAt: now,
    [STATUS_STAMP[status]]: now,
    // A FLAG THE SETTLEMENT SWEEP CAN QUERY, so it reads the travels that owe somebody money
    // instead of every travel ever completed (`needsPayout == true`; the sweep clears it as it
    // pays). Set only with completion.
    ...(status === 'completed' ? { needsPayout: true } : {}),
  };
}
