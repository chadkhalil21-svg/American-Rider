// The vehicle verification code: one per travel, the same on both phones.
//
// It replaces a word of the day (BANYAN, OSPREY, …) that only the traveler's screen ever
// showed — the operator's app had no way to know it, so "confirm today's word with your
// operator" was a check nobody could pass. A code that belongs to the travel is derived
// here, from the Travel Number both phones already hold, so it needs no server round-trip
// and cannot disagree between them. Chad, 17 Sept 2026: a code, not a word.
//
// Derived, not random: anybody holding the Travel Number and this function can compute it,
// and the Travel Number is shown only to the traveler and the operator dispatched to it. A
// server-issued random code carried on the assignment is the stronger next step.
export function verificationCode(tripNo: string): string {
  let h = 5381;
  for (let i = 0; i < tripNo.length; i++) h = (Math.imul(h, 33) ^ tripNo.charCodeAt(i)) >>> 0;
  return String(h % 10000).padStart(4, '0');
}
