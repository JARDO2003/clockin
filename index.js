// functions/index.js
// ══════════════════════════════════════════════════════════════════════════════
// Lambda Workforce — Cloud Function : Notifications Push FCM (HTTP v1 API)
// ══════════════════════════════════════════════════════════════════════════════
//
// DÉPLOIEMENT :
//   1. npm install -g firebase-tools
//   2. firebase login
//   3. cd functions && npm install
//   4. firebase deploy --only functions
//
// Cette fonction écoute les nouveaux documents dans /notifications
// et envoie une notification push FCM à TOUS les utilisateurs abonnés.
// ══════════════════════════════════════════════════════════════════════════════

const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { initializeApp, cert }  = require('firebase-admin/app');
const { getFirestore }         = require('firebase-admin/firestore');
const { getMessaging }         = require('firebase-admin/messaging');

// Initialisation Admin SDK (utilise les credentials du compte de service)
initializeApp();
const db        = getFirestore();
const messaging = getMessaging();

// ── Trigger : nouveau document dans /notifications ─────────────────────────
exports.sendPushOnPost = onDocumentCreated(
  { document: 'notifications/{notifId}', region: 'europe-west1' },
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const notif = snap.data();
    if (notif.type !== 'new_post' || notif.sent) return;

    const { title, body, url, authorUid, postId } = notif;

    try {
      // ── Récupérer tous les tokens FCM enregistrés ──────────────────────
      const usersSnap = await db.collection('users')
        .where('fcmToken', '!=', null)
        .get();

      const tokens = [];
      usersSnap.forEach(doc => {
        const data = doc.data();
        // Ne pas notifier l'auteur de la publication
        if (doc.id !== authorUid && data.fcmToken) {
          tokens.push(data.fcmToken);
        }
      });

      if (tokens.length === 0) {
        console.log('[FCM] Aucun token trouvé.');
        await snap.ref.update({ sent: true, sentAt: new Date(), recipientCount: 0 });
        return;
      }

      console.log(`[FCM] Envoi à ${tokens.length} device(s)...`);

      // ── FCM HTTP v1 : sendEachForMulticast ────────────────────────────
      // (remplace l'ancienne API sendMulticast qui utilisait le Server Key)
      const message = {
        tokens,
        notification: {
          title: title || '🔔 Lambda Workforce',
          body:  body  || 'Nouvelle publication dans le fil d\'actualité',
        },
        webpush: {
          notification: {
            title:   title || '🔔 Lambda Workforce',
            body:    body  || 'Nouvelle publication',
            icon:    '/icons/icon-192.png',
            badge:   '/icons/badge-72.png',
            tag:     `post-${postId}`,
            renotify: true,
            requireInteraction: false,
            actions: [
              { action: 'open',    title: '👁 Voir'    },
              { action: 'dismiss', title: '✕ Ignorer'  }
            ],
            vibrate: [200, 100, 200]
          },
          fcmOptions: {
            link: url || '/dashboard.html#community'
          },
          headers: {
            Urgency: 'normal'
          }
        },
        data: {
          url:    url    || '/dashboard.html#community',
          postId: postId || '',
          type:   'new_post',
          tag:    `post-${postId}`
        }
      };

      const response = await messaging.sendEachForMulticast(message);
      console.log(`[FCM] ✓ ${response.successCount} envoyés, ✗ ${response.failureCount} échecs`);

      // ── Nettoyer les tokens invalides ──────────────────────────────────
      const invalidTokens = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const code = resp.error?.code;
          if (
            code === 'messaging/invalid-registration-token' ||
            code === 'messaging/registration-token-not-registered'
          ) {
            invalidTokens.push(tokens[idx]);
          }
          console.warn(`[FCM] Échec token[${idx}]:`, resp.error?.message);
        }
      });

      if (invalidTokens.length > 0) {
        console.log(`[FCM] Suppression de ${invalidTokens.length} token(s) invalide(s)...`);
        const batch = db.batch();
        usersSnap.forEach(userDoc => {
          if (invalidTokens.includes(userDoc.data().fcmToken)) {
            batch.update(userDoc.ref, { fcmToken: null });
          }
        });
        await batch.commit();
      }

      // ── Marquer la notification comme envoyée ──────────────────────────
      await snap.ref.update({
        sent:           true,
        sentAt:         new Date(),
        recipientCount: response.successCount,
        failureCount:   response.failureCount
      });

    } catch (err) {
      console.error('[FCM] Erreur critique:', err);
      await snap.ref.update({ sent: true, error: err.message });
    }
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// RÈGLES FIRESTORE à ajouter dans firestore.rules :
// ══════════════════════════════════════════════════════════════════════════════
//
// match /notifications/{id} {
//   allow create: if request.auth != null;
//   allow read, update, delete: if false; // uniquement la Cloud Function
// }
// match /users/{uid} {
//   allow read, write: if request.auth != null && request.auth.uid == uid;
// }
// ══════════════════════════════════════════════════════════════════════════════
