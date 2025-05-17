import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

// Initialiser Firebase Admin SDK (une seule fois)
if (admin.apps.length === 0) {
  admin.initializeApp();
}

// Fonction simple "hello world" pour tester le déploiement (utilise l'API v1)
export const helloWorldV1 = functions.https.onCall(
  (data, context) => {
    return {
      message: "Hello from Firebase Functions V1!",
    };
  }
);

// Fonction hello world la plus basique possible
export const helloSimple = functions.https.onRequest((request, response) => {
  response.send("Hello, World!");
});
