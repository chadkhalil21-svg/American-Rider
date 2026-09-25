// Server-authoritative party semantics for a Travel.
//
// Booker = authenticated account that requests and pays for the Travel.
// Traveler = person physically taking the Travel. They may be the Booker or another person.
// At launch, Booker may request Travel for self or another adult. Unaccompanied-minor Travel
// fails closed until carrier/counsel/operations explicitly approve that separate product.

const MAX_NAME = 80;
const clean = (v, n = MAX_NAME) => String(v || '').trim().replace(/\s+/g, ' ').slice(0, n);

function normalizeParty(body = {}, booker = {}) {
  const mode = ['self', 'other_adult'].includes(body.partyMode) ? body.partyMode : 'self';
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


}

function operatorPartyView(party) {
  const p = party || {};
  return {
    travelerName: clean(p.travelerName || 'Traveler'),
    bookedForAnother: p.bookedForAnother === true,
    minor: false,
    guardianName: null,
  };
}

module.exports = { normalizeParty, operatorPartyView };
