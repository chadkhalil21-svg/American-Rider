// Server-authoritative party semantics for a Travel.
//
// Booker = authenticated account that requests and pays for the Travel.
// Traveler = person physically taking the Travel. They may be the Booker or another person.
// Guardian = adult Booker responsible for a minor Traveler.
//
// This module deliberately does not infer age or relationship. The Booker declares the party
// arrangement. A minor may travel only under the explicit guardian flow; the Operator receives
// only what is operationally necessary: the Traveler's first name, that the Traveler is a minor,
// and the guardian's in-app contact channel through American Rider. The Operator never receives
// the guardian's payment data, phone number, address book or account history.

const MAX_NAME = 80;
const clean = (v, n = MAX_NAME) => String(v || '').trim().replace(/\s+/g, ' ').slice(0, n);

function normalizeParty(body = {}, booker = {}) {
  const mode = ['self', 'other_adult', 'minor'].includes(body.partyMode) ? body.partyMode : 'self';
  const bookerName = clean(booker.name || body.bookerName || 'Traveler');
  if (mode === 'self') {
    return {
      ok: true,
      party: {
        mode: 'self',
        travelerName: bookerName,
        bookerName,
        guardian: null,
        bookedForAnother: false,
        minor: false,
      },
    };
  }
  const travelerName = clean(body.travelerName);
  if (!travelerName) return { ok: false, code: 'traveler_name_required', error: 'Name the person taking this Travel.' };

  if (mode === 'other_adult') {
    return {
      ok: true,
      party: {
        mode, travelerName, bookerName, guardian: null,
        bookedForAnother: true, minor: false,
      },
    };
  }

  // The product does not accept an unaccompanied-minor booking from a non-guardian account.
  // The declaration is recorded on the Travel and can be audited; do not collect a child's
  // date of birth merely to make the UI look precise.
  // Launch posture: do not create an unaccompanied-minor transportation product until the
  // insurance carrier, Florida counsel and operating procedure explicitly approve it. A
  // parent may book for another ADULT; a minor must travel with their guardian in the vehicle.
  return { ok: false, code: 'unaccompanied_minor_not_supported', error: 'American Rider does not accept unaccompanied-minor Travel.' };

}

function operatorPartyView(party) {
  const p = party || {};
  return {
    travelerName: clean(p.travelerName || 'Traveler'),
    bookedForAnother: p.bookedForAnother === true,
    minor: p.minor === true,
    guardianName: p.minor ? clean(p.guardian?.name || p.bookerName || '') : null,
  };
}

function guardianCanFollow({ ride, uid }) {
  return !!ride && ride.party?.minor === true &&
    String(ride.party?.guardian?.uid || ride.travelerUid || '') === String(uid || '');
}

module.exports = { normalizeParty, operatorPartyView, guardianCanFollow };
