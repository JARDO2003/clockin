/**
 * FCM via Firebase Admin SDK = API HTTP v1 (l’ancien « Server key » legacy n’est plus utilisé).
 *
 * Déploiement : à la racine du projet, avec Firebase CLI installé :
 *   cd functions && npm install && cd .. && firebase deploy --only functions
 *
 * Compte de service : ne jamais commiter de clé JSON. En local, utilisez
 *   set GOOGLE_APPLICATION_CREDENTIALS=chemin/vers/serviceAccount.json
 * En production, les Functions utilisent automatiquement le compte de service du projet.
 */

const {initializeApp} = require("firebase-admin/app");
const {getFirestore, FieldValue} = require("firebase-admin/firestore");
const {getMessaging} = require("firebase-admin/messaging");
const {onDocumentCreated} = require("firebase-functions/v2/firestore");
const {setGlobalOptions} = require("firebase-functions/v2");

setGlobalOptions({region: "europe-west1", maxInstances: 10});

initializeApp();

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

/**
 * @param {string[]} tokens
 * @param {{title: string, body: string}} notification
 * @param {Record<string, string>} data string values only for data payload
 */
async function sendEachTokens(tokens, notification, data) {
  const messaging = getMessaging();
  const dataFlat = {};
  Object.entries(data || {}).forEach(([k, v]) => {
    dataFlat[k] = String(v ?? "");
  });

  for (const batch of chunk(tokens, 500)) {
    const messages = batch.map((token) => ({
      token,
      notification: {
        title: notification.title,
        body: notification.body,
      },
      data: dataFlat,
      android: {priority: "high"},
      apns: {payload: {aps: {sound: "default"}}},
    }));
    const res = await messaging.sendEach(messages);
    res.responses.forEach((r, i) => {
      if (!r.success) {
        console.warn("FCM error", r.error?.code, batch[i]?.slice?.(0, 24));
      }
    });
  }
}

exports.notifyOnNewPost = onDocumentCreated("posts/{postId}", async (event) => {
  const post = event.data.data();
  const authorUid = post.uid || "";
  const uName = post.uName || "Collaborateur";
  const preview = (post.txt || "Publication / média partagé").slice(0, 180);

  const db = getFirestore();
  const snap = await db.collection("users").get();
  const tokens = [];
  snap.forEach((doc) => {
    if (doc.id === authorUid) return;
    const t = doc.get("fcmToken");
    if (typeof t === "string" && t.length > 20) tokens.push(t);
  });
  const unique = [...new Set(tokens)];
  if (!unique.length) return;

  await sendEachTokens(
      unique,
      {title: `Lambda — ${uName}`, body: preview},
      {type: "new_post", postId: event.params.postId || ""},
  );
});

exports.notifyOnBroadcast = onDocumentCreated("pushBroadcasts/{docId}", async (event) => {
  const d = event.data.data();
  if (d.processed === true) return;

  const title = String(d.title || "Lambda").slice(0, 200);
  const body = String(d.body || "").slice(0, 2000);
  const scope = d.scope === "selected" ? "selected" : "all";
  /** @type {Set<string>|null} */
  let allowed = null;
  if (scope === "selected" && Array.isArray(d.userIds)) {
    allowed = new Set(d.userIds.filter((x) => typeof x === "string"));
  }

  const db = getFirestore();
  const snap = await db.collection("users").get();
  const tokens = [];
  snap.forEach((doc) => {
    if (allowed && !allowed.has(doc.id)) return;
    const t = doc.get("fcmToken");
    if (typeof t === "string" && t.length > 20) tokens.push(t);
  });
  const unique = [...new Set(tokens)];

  if (unique.length) {
    await sendEachTokens(unique, {title, body}, {type: "broadcast"});
  }

  await event.data.ref.update({
    processed: true,
    sentAt: FieldValue.serverTimestamp(),
    recipientCount: unique.length,
  });
});
