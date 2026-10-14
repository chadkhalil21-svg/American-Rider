'use strict';
// Render injects these public build-identification fields per deployment.
// Pure, read-only logic: zero Firestore reads, provider calls or writes.
// This identifies source code provenance; it does NOT certify launch readiness.
const EXPECTED_REPOSITORY='chadkhalil21-svg/American-Rider';
const EXPECTED_BRANCH='release/current';
const SHA=/^[0-9a-f]{40}$/i;

function provenance(env={}) {
  const repository=String(env.RENDER_GIT_REPO_SLUG||'').trim();
  const branch=String(env.RENDER_GIT_BRANCH||'').trim();
  const commit=String(env.RENDER_GIT_COMMIT||'').trim();
  const hasGitIdentity=!!repository && !!branch && SHA.test(commit);
  const repositoryMatches=repository.toLowerCase()===EXPECTED_REPOSITORY.toLowerCase();
  const branchMatches=branch===EXPECTED_BRANCH;
  const codeSourceMatches=hasGitIdentity && repositoryMatches && branchMatches;
  return {
    service:'american-rider-server',
    expectedRepository:EXPECTED_REPOSITORY,
    expectedBranch:EXPECTED_BRANCH,
    repository:repository||null,
    branch:branch||null,
    commit:SHA.test(commit)?commit:null,
    codeSourceStatus:!hasGitIdentity?'unverified':codeSourceMatches?'matches':'mismatch',
    codeSourceMatches,
    // Code source alone does not verify insurance, payment, capacity or licensing.
    commercialReadinessCertified:false
  };
}
module.exports={provenance,EXPECTED_REPOSITORY,EXPECTED_BRANCH};
