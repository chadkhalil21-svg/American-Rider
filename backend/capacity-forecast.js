'use strict';
// PURE offline load budget. A simulation of registered users is NOT measured
// provider throughput, concurrency, billing, or guaranteed on-time monitoring.
const TICKS_PER_DAY=1440;
const PAGE_SIZE=200;
function integer(n,name,min=0){
 if(!Number.isSafeInteger(n)||n<min)throw new RangeError(name+' invalid');
 return n;
}
function factor(n,name,min,max){
 if(typeof n!=='number'||!Number.isFinite(n)||n<min||n>max)
  throw new RangeError(name+' invalid');
 return n;
}
function forecast({registeredUsers,dailyTravelRate=0.02,activeMinutes=25,peakMultiplier=6,
                 assignmentCandidatesPerTravel=0}={}){
 integer(registeredUsers,'registeredUsers');
 factor(dailyTravelRate,'dailyTravelRate',0,1);
 factor(activeMinutes,'activeMinutes',1,1440);
 factor(peakMultiplier,'peakMultiplier',1,100);
 integer(assignmentCandidatesPerTravel,'assignmentCandidatesPerTravel');
 const dailyTravels=Math.ceil(registeredUsers*dailyTravelRate);
 const totalActiveTravelMinutes=dailyTravels*activeMinutes;
 const averageConcurrent=totalActiveTravelMinutes/TICKS_PER_DAY;
 const estimatedPeakConcurrent=Math.ceil(averageConcurrent*peakMultiplier);
 const monitorDocumentReadsLowerBound=totalActiveTravelMinutes;
 const monitorReadPagesAtPeak=Math.floor(estimatedPeakConcurrent/PAGE_SIZE)+1;
 const assignmentLookupWorkUpperModel=dailyTravels*assignmentCandidatesPerTravel;
 if(![totalActiveTravelMinutes,monitorReadPagesAtPeak,assignmentLookupWorkUpperModel].every(Number.isSafeInteger))
   throw new RangeError('scenario too large to represent exactly');
 return Object.freeze({
  registeredUsers,dailyTravels,averageConcurrent,estimatedPeakConcurrent,
  monitorDocumentReadsLowerBound,monitorReadPagesAtPeak,
  assignmentLookupWorkUpperModel,
  concurrentLoadsMeasured:false,firestoreIndexReadsIncluded:false,
  firestoreQueriesOtherThanMonitorIncluded:false,billedCostVerified:false,
  benchmarkedLatencyP95Ms:null,benchmarkedLatencyP99Ms:null,
  launchCapacityVerified:false,readAmplificationRisk:estimatedPeakConcurrent>=1000?'requires measured redesign/scale test':'requires measured pilot',
 });
}
function sustained(activeTravels){
 integer(activeTravels,'activeTravels');
 return {
  activeTravels,
  scansPerDay:TICKS_PER_DAY,
  monitorDocumentReadsPerDay:activeTravels*TICKS_PER_DAY,
  pageRequestsPerSweep:Math.floor(activeTravels/PAGE_SIZE)+1,
  provenFirestoreCapacity:false,
 };
}
module.exports={forecast,sustained,PAGE_SIZE,TICKS_PER_DAY};
