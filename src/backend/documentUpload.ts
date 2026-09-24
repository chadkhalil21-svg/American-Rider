// Capturing and submitting an operator's documents.
//
// WHAT THIS REPLACES. `verifyDoc` set a flag to 'checking', waited 900 milliseconds, and set it
// to 'ok'. Driver licence, vehicle registration, annual inspection and commercial insurance —
// every one approved by a countdown, and no image ever captured, so there was nothing to
// approve even in principle.
//
// The document now goes to Firebase Storage and its URL to the server, which reads it with
// Claude and applies the written standard in backend/documents.js. What comes back is one of
// three answers — accepted, refused with a reason, or held for a person — and an operator
// never drives on the third.
import * as ImagePicker from 'expo-image-picker';
import { auth } from '../firebase';
import { PAYMENT_SERVER_URL } from '../config';
import { t } from '../i18n';

export type DocKind = 'license' | 'registration' | 'inspection' | 'insurance';

export type DocReview = {
  verdict: 'accept' | 'refuse' | 'review';
  reasons: string[];
  summary: string;
  /** YYYY-MM-DD when the document states one. What the three-year re-check runs from. */
  expiry: string | null;
};

/**
 * Photograph the document, or choose one already taken.
 *
 * THE CAMERA FIRST, and that ordering is deliberate. A licence photographed now is a licence
 * the operator is holding; one chosen from the library may be anything. Both are offered —
 * insurance and inspection documents usually arrive as a PDF or an email screenshot, so
 * refusing the library would refuse the ordinary case.
 *
 * Returns a local uri, or null when the operator declined or the picker is unavailable.
 */
export async function pickDocument(fromCamera: boolean): Promise<string | null> {
  try {
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return null;
    const res = fromCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.75 })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.75 });
    // 0.75 rather than the 0.6 a lost-item photo uses: this one has small print on it, and a
    // licence number the reader cannot resolve becomes a review a person has to do by hand.
    return !res.canceled && res.assets?.[0]?.uri ? res.assets[0].uri : null;
  } catch {
    return null;
  }
}

/** Upload through a short-lived, authenticated R2 URL. Returns the private object key. */
async function upload(kind: DocKind, uri: string): Promise<string | null> {
  const user = auth.currentUser;
  if (!user) return null;
  try {
    const token = await user.getIdToken();
    const local = await fetch(uri);
    const blob = await local.blob();
    const contentType = blob.type || 'image/jpeg';
    const signed = await fetch(`${PAYMENT_SERVER_URL}/storage/upload-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ purpose: 'operator-document', kind, contentType }),
    });
    const grant = await signed.json().catch(() => ({}));
    if (!signed.ok || !grant?.uploadUrl || !grant?.key) return null;
    const put = await fetch(grant.uploadUrl, { method: 'PUT', headers: { 'Content-Type': contentType }, body: blob });
    return put.ok ? String(grant.key) : null;
  } catch { return null; }
}

/**
 * Submit a document and get the verdict.
 *
 * Returns `null` only when the upload itself failed — the caller must then leave the document
 * unverified rather than treating a failure as a pass, which is the whole defect this file
 * exists to remove.
 */
export async function submitDocument(
  kind: DocKind,
  uri: string,
): Promise<DocReview | { error: string } | null> {
  const objectKey = await upload(kind, uri);
  if (!objectKey) return null;
  try {
    const token = await auth.currentUser?.getIdToken().catch(() => null);
    const res = await fetch(`${PAYMENT_SERVER_URL}/operator/document`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ kind, objectKey }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { error: data?.error || `Server error ${res.status}` };
    return data as DocReview;
  } catch {
    return { error: t('traveler.errCheckDocServer') };
  }
}
