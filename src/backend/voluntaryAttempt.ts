// A client-side request is replayed EXACTLY after an uncertain network outcome.
// This module contains no Firebase, location lookup, storage or payment behavior.
import type { ResearchPrice } from './voluntaryPrices';
export type ResearchDraft = Omit<ResearchPrice,'observationId'|'observedAt'> & {ageHours:number};
export type PreparedResearchAttempt = Readonly<{fingerprint:string;body:ResearchPrice}>;
export function prepareResearchAttempt(
 draft:ResearchDraft, previous:PreparedResearchAttempt|null,
 now:number, observationId:string,
):PreparedResearchAttempt {
 if(!Number.isSafeInteger(now)||!Number.isInteger(draft.ageHours)||
   draft.ageHours<0||draft.ageHours>335)throw new RangeError('invalid research observation clock');
 const fingerprint=JSON.stringify(draft);
 if(previous?.fingerprint===fingerprint)return previous;
 const {ageHours,...fields}=draft;
 if(typeof observationId!=='string'||!/^[A-Za-z0-9_.:-]{12,100}$/.test(observationId))
   throw new TypeError('invalid research observation ID');
 return Object.freeze({fingerprint,body:Object.freeze({...fields,observationId,
   observedAt:new Date(now-ageHours*3600000).toISOString()})});
}
