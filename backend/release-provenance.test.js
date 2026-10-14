'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {provenance,EXPECTED_REPOSITORY,EXPECTED_BRANCH}=require('./release-provenance');
const sha='854774bef619b01202004a53888dde43dc50a4a6';
for(let pass=1;pass<=2;pass++){
  const matching=provenance({
    RENDER_GIT_REPO_SLUG:EXPECTED_REPOSITORY,
    RENDER_GIT_BRANCH:EXPECTED_BRANCH,
    RENDER_GIT_COMMIT:sha,
    STRIPE_SECRET_KEY:'never-expose-this'
  });
  assert.equal(matching.codeSourceStatus,'matches');
  assert.equal(matching.codeSourceMatches,true);
  assert.equal(matching.commit,sha);
  assert.equal(matching.commercialReadinessCertified,false);
  assert.equal(JSON.stringify(matching).includes('never-expose-this'),false);

  const wrong=provenance({RENDER_GIT_REPO_SLUG:'chadkhalil21-svg/American-Rider-Commercial',
    RENDER_GIT_BRANCH:EXPECTED_BRANCH,RENDER_GIT_COMMIT:sha});
  assert.equal(wrong.codeSourceStatus,'mismatch');
  assert.equal(wrong.codeSourceMatches,false);

  const wrongBranch=provenance({RENDER_GIT_REPO_SLUG:EXPECTED_REPOSITORY,
    RENDER_GIT_BRANCH:'staging',RENDER_GIT_COMMIT:sha});
  assert.equal(wrongBranch.codeSourceStatus,'mismatch');

  for(const env of [{},{RENDER_GIT_REPO_SLUG:EXPECTED_REPOSITORY,
    RENDER_GIT_BRANCH:EXPECTED_BRANCH,RENDER_GIT_COMMIT:'not-a-sha'}]){
    const unavailable=provenance(env);
    assert.equal(unavailable.codeSourceStatus,'unverified');
    assert.equal(unavailable.commercialReadinessCertified,false);
  }
}
const server=fs.readFileSync(path.join(__dirname,'server.js'),'utf8');
assert.match(server,/app\.get\('\/ops\/release-provenance', requireOps,/, 
  'release details are available only to authenticated Operations');
assert.doesNotMatch(server,/app\.get\('\/release-provenance',/, 'never expose production source details to the public');
console.log('PASS twice: true Render source identity, repo drift, branch drift and missing evidence');
