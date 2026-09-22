// Naming the legs of a Smart Travel journey.
//
// The server reports what OpenTripPlanner planned — modes, agencies and GTFS route names —
// and says nothing a traveler reads. Every visible word comes from the catalogue here, so
// "Metrorail · Orange Line" is the same in five languages and the GTFS feed's upper-case
// stop names ("BRICKELL STATION") never reach a screen as shouted.
import type { SmartLeg, SmartPlan } from './backend/smart';

type T = (key: string, vars?: Record<string, string | number>) => string;

/** GTFS feeds shout. Title-case a string only when it is entirely upper-case. */
export function placeName(name: string): string {
  const trimmed = (name || '').trim();
  if (!trimmed || trimmed !== trimmed.toUpperCase()) return trimmed;
  return trimmed
    .toLowerCase()
    .replace(/(^|[\s\-/(])([a-z])/g, (_, pre: string, c: string) => pre + c.toUpperCase());
}

const agencyOf = (leg: SmartLeg) => leg.route?.agency ?? '';
const routeOf = (leg: SmartLeg) => leg.route?.shortName || leg.route?.longName || '';

/** The service a transit leg rides, without the line: Metrorail, Metromover, Metrobus 150. */
export function serviceName(leg: SmartLeg, t: T): string {
  if (leg.kind === 'walk') return t('traveler.modeWalk');
  if (leg.kind === 'car') return t('traveler.modeCar');
  const agency = agencyOf(leg);
  if (/brightline/i.test(agency)) return t('traveler.brightline');
  if (/tri-?rail|sfrta/i.test(agency)) return t('traveler.triRail');
  if (leg.mode === 'tram') {
    return /\bmia\b|airport/i.test(routeOf(leg)) ? t('traveler.miaMover') : t('traveler.metromover');
  }
  if (leg.mode === 'rail' || leg.mode === 'subway') {
    return /miami-?dade/i.test(agency) ? t('traveler.metrorail') : t('traveler.modeRail');
  }
  if (leg.mode === 'bus') {
    const route = placeName(routeOf(leg));
    return /miami-?dade/i.test(agency) ? t('traveler.metrobus', { route }) : t('traveler.modeBus', { route });
  }
  return placeName(routeOf(leg)) || t('traveler.transit');
}

/** The full leg title: the service plus its line where the line is a name ("Orange Line"). */
export function legTitle(leg: SmartLeg, t: T): string {
  const service = serviceName(leg, t);
  if (leg.kind !== 'transit' || leg.mode === 'bus') return service;
  const line = placeName((leg.route?.longName || leg.route?.shortName || '').replace(/^metrorail\s*/i, ''));
  if (!line || line.toLowerCase() === service.toLowerCase()) return service;
  return `${service} · ${line}`;
}

/** "Car · Metrorail · Car" — one word per leg, in order. */
export function modeLine(plan: SmartPlan, t: T): string {
  return plan.legs.map((l) => serviceName(l, t)).join(' · ');
}

/** The car legs, in order — what American Rider actually operates and charges for. */
export const carLegs = (plan: SmartPlan) => plan.legs.filter((l) => l.kind === 'car');
export const transitLegs = (plan: SmartPlan) => plan.legs.filter((l) => l.kind === 'transit');

/** Clock time from an ISO timestamp, in the device's locale; empty when the plan has none. */
export function clockTime(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
