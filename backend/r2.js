// Private object storage for American Rider.
//
// Cloudflare R2 is S3-compatible. Credentials live only on the backend. The phone receives
// short-lived signed URLs after Firebase authentication and never receives an R2 secret.
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { readKey } = require('./env');

const BUCKET = readKey('R2_BUCKET') || 'american-rider-private';
const ACCOUNT_ID = readKey('R2_ACCOUNT_ID');
const ACCESS_KEY_ID = readKey('R2_ACCESS_KEY_ID');
const SECRET_ACCESS_KEY = readKey('R2_SECRET_ACCESS_KEY');

const ready = () => !!(ACCOUNT_ID && ACCESS_KEY_ID && SECRET_ACCESS_KEY && BUCKET);

function client() {
  if (!ready()) return null;
  return new S3Client({
    region: 'auto',
    endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: ACCESS_KEY_ID, secretAccessKey: SECRET_ACCESS_KEY },
  });
}

const safePart = (v) => String(v || '').replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 100);
const allowedType = (v) => /^image\/(jpeg|png|webp|heic|heif)$/i.test(String(v || ''));

function objectKey({ uid, purpose, kind, id }) {
  const owner = safePart(uid);
  if (!owner) return null;
  if (purpose === 'operator-document') {
    const k = safePart(kind);
    if (!['license', 'registration', 'inspection', 'insurance'].includes(k)) return null;
    return `operator-documents/${owner}/${k}-${Date.now()}-${safePart(id)}`;
  }
  if (purpose === 'lost-item') return `lost-items/${owner}/${Date.now()}-${safePart(id)}`;
  return null;
}

async function uploadUrl({ uid, purpose, kind, contentType, id }) {
  const c = client();
  const key = objectKey({ uid, purpose, kind, id });
  if (!c || !key) return { ok: false, code: 'storage_not_configured' };
  if (!allowedType(contentType)) return { ok: false, code: 'unsupported_type' };
  const command = new PutObjectCommand({
    Bucket: BUCKET, Key: key, ContentType: contentType,
    Metadata: { owner: String(uid), purpose: String(purpose) },
  });
  return { ok: true, key, url: await getSignedUrl(c, command, { expiresIn: 300 }) };
}

async function readUrl(key) {
  const c = client();
  if (!c) return null;
  return getSignedUrl(c, new GetObjectCommand({ Bucket: BUCKET, Key: String(key) }), { expiresIn: 300 });
}

function owns(key, uid, purpose) {
  const prefix = purpose === 'operator-document' ? 'operator-documents' : purpose === 'lost-item' ? 'lost-items' : '';
  return !!prefix && String(key || '').startsWith(`${prefix}/${safePart(uid)}/`);
}

module.exports = { ready, uploadUrl, readUrl, owns, BUCKET };
