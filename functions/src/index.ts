import {onCall, HttpsError, CallableRequest} from "firebase-functions/v2/https";
import {logger} from "firebase-functions";
import * as admin from "firebase-admin";

// Initialiser Firebase Admin SDK (une seule fois)
if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = admin.firestore();

interface CreerCompteData {
  nni: string;
  email: string;
}

// La fonction sera déployée dans la région par défaut du projet.
export const creerCompteUtilisateur = onCall(
  {
    region: "europe-west1",
  },
  async (request: CallableRequest<CreerCompteData>) => {
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "L'utilisateur doit être authentifié pour créer un compte."
      );
    }

    const adminUid = request.auth.uid;
    try {
      const adminUserDoc = await db.collection("utilisateurs").doc(adminUid).get();
      if (!adminUserDoc.exists || adminUserDoc.data()?.role !== "admin") {
        throw new HttpsError(
          "permission-denied",
          "L\'utilisateur n\'a pas les droits " +
            "pour créer un compte."
        );
      }
    } catch (error) {
      logger.error("Erreur de vérification du rôle admin:", error);
      throw new HttpsError(
        "internal",
        "Erreur lors de la vérification des permissions administrateur."
      );
    }

    const {nni, email} = request.data;

    if (!nni || typeof nni !== "string" || nni.length < 5) {
      throw new HttpsError("invalid-argument", "Le NNI fourni est invalide.");
    }
    if (!email || typeof email !== "string" || !email.includes("@")) {
      throw new HttpsError("invalid-argument", "L'email fourni est invalide.");
    }

    try {
      const userRecord = await admin.auth().createUser({
        email: email,
        displayName: nni,
      });

      await db.collection("utilisateurs").doc(userRecord.uid).set({
        nni: nni.toUpperCase(),
        email: email,
        role: "user",
        creePar: adminUid,
        dateCreation: admin.firestore.FieldValue.serverTimestamp(),
      });

      return {
        success: true,
        message:
          `Utilisateur ${nni} (${email}) créé avec succès. ` +
          `UID: ${userRecord.uid}`,
        uid: userRecord.uid,
      };
    } catch (error: unknown) {
      logger.error("Erreur lors de la création de l'utilisateur:", error);
      let errorMessage =
        "Une erreur est survenue lors de la création de " +
        "l'utilisateur.";
      if (typeof error === "object" && error !== null && "code" in error) {
        const firebaseError = error as {code: string; message: string};
        if (firebaseError.code === "auth/email-already-exists") {
          throw new HttpsError(
            "already-exists",
            "Cette adresse email est déjà utilisée par un autre compte."
          );
        }
        errorMessage = firebaseError.message;
      }
      throw new HttpsError(
        "internal",
        `Erreur création utilisateur: ${errorMessage}`
      );
    }
  }
);
