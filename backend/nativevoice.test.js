const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const root = path.resolve(__dirname, '..');
const configPath = path.join(root, 'app.config.js');
const saved = Object.fromEntries(['EXPO_PUBLIC_NATIVE_VOICE_ENABLED','AR_VOICE_GOOGLE_SERVICES_FILE','AR_VOICE_APNS_ENV'].map((k) => [k, process.env[k]]));
function config() { delete require.cache[require.resolve(configPath)]; return require(configPath); }
try {
  delete process.env.EXPO_PUBLIC_NATIVE_VOICE_ENABLED;
  assert.ok(!config().plugins.some((p) => String(p).includes('@twilio/voice-react-native-sdk')),
    'ordinary builds must not activate native Voice or request microphone access');
  process.env.EXPO_PUBLIC_NATIVE_VOICE_ENABLED = 'true';
  delete process.env.AR_VOICE_GOOGLE_SERVICES_FILE;
  assert.throws(config, /GOOGLE_SERVICES_FILE/, 'no real FCM config must fail a voice build');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ar-voice-config-'));
  try {
    const file = path.join(dir, 'google-services.json');
    fs.writeFileSync(file, '{}\n'); // test-only placeholder, never a deployed Firebase credential
    process.env.AR_VOICE_GOOGLE_SERVICES_FILE = file;
    delete process.env.AR_VOICE_APNS_ENV;
    assert.throws(config, /APNS_ENV/);
    process.env.AR_VOICE_APNS_ENV = 'production';
    const built = config();
    assert.ok(built.plugins.some((p) => Array.isArray(p) && p[0] === '@twilio/voice-react-native-sdk' && p[1].apsEnvironment === 'production'));
    assert.equal(built.android.googleServicesFile, file);
    assert.ok(built.android.permissions.includes('android.permission.RECORD_AUDIO'));
    assert.equal(require(path.join(root,'node_modules/@twilio/voice-react-native-sdk/package.json')).version, '1.8.0');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  const provider = fs.readFileSync(path.join(root, 'src/state/VoiceContext.tsx'), 'utf8');
  const traveler = fs.readFileSync(path.join(root, 'app/ride.tsx'), 'utf8');
  const operator = fs.readFileSync(path.join(root, 'app/operator/communicate.tsx'), 'utf8');
  const server = fs.readFileSync(path.join(root, 'backend/server.js'), 'utf8');
  assert.match(provider, /travelVoiceToken\(activeId\)/, 'incoming registrations must have fresh server authority');
  assert.match(provider, /travelVoiceToken\(id\)/, 'each outgoing call must recheck live Travel authority');
  assert.match(provider, /next\.reject\(\)/, 'an unknown or ended Travel cannot receive a call');
  assert.match(traveler, /voice\.available && voice\.activeId === ride\.matchedOp\.rideId/);
  assert.match(operator, /voice\.available && voice\.activeId === op\.op\.rideId/);
  assert.match(server, /authorizeVoiceTravel\(\{ db, uid: req\.uid, rideId \}\)/);
  console.log('PASS native Voice opt-in, signing prerequisites and server-derived Travel identity source gates');
} finally {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
  delete require.cache[require.resolve(configPath)];
}
