import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import cors from "cors";
import axios from "axios";
import * as querystring from "querystring";

// Initialiser Firebase Admin SDK (une seule fois)
if (admin.apps.length === 0) {
  admin.initializeApp();
}

const corsHandler = cors({origin: true});

// Configuration Microsoft Graph
const MS_CLIENT_ID = process.env.MS_CLIENT_ID || "";
const MS_CLIENT_SECRET = process.env.MS_CLIENT_SECRET || "";
const MS_TENANT_ID = process.env.MS_TENANT_ID || "";
const MS_REDIRECT_URI = process.env.MS_REDIRECT_URI || "https://sync-pro.javachrist.eu/auth/microsoft/callback";

// Fonction simple "hello world" pour tester le déploiement (utilise l'API v1)
export const helloWorldV1 = functions.https.onCall(
  (_, __) => {
    return {
      message: "Hello from Firebase Functions V1!",
    };
  }
);

// Fonction hello world simple
export const helloSimple = functions.https.onRequest((request, response) => {
  response.send("Hello, World!");
});

// Interface pour les données de la requête Office
interface OfficeEditRequest {
  fileId: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
}

// Fonction améliorée pour l'édition Office Online
export const getOfficeOnlineUrl = functions.https.onCall(async (data: OfficeEditRequest, context: functions.https.CallableContext) => {
  // Vérifier l'authentification
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "L'utilisateur doit être connecté pour utiliser cette fonctionnalité."
    );
  }

  try {
    // Vérifier les données requises
    if (!data.fileId || !data.fileName || !data.fileUrl || !data.fileType) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Les informations sur le fichier sont incomplètes"
      );
    }

    // Obtenir un jeton d'accès Microsoft
    const msToken = await getMicrosoftAccessToken();
    
    // En attendant la configuration complète, nous retournons une URL simulée
    // mais dans une vraie implémentation, nous utiliserions Microsoft Graph API
    
    // Cette partie serait remplacée par un vrai appel à l'API Microsoft
    let officeUrl;
    switch (data.fileType) {
      case 'docx':
      case 'doc':
        officeUrl = `https://office.live.com/start/Word.aspx?auth=1&file=${encodeURIComponent(data.fileUrl)}`;
        break;
      case 'xlsx':
      case 'xls':
        officeUrl = `https://office.live.com/start/Excel.aspx?auth=1&file=${encodeURIComponent(data.fileUrl)}`;
        break;
      case 'pptx':
      case 'ppt':
        officeUrl = `https://office.live.com/start/PowerPoint.aspx?auth=1&file=${encodeURIComponent(data.fileUrl)}`;
        break;
      default:
        throw new functions.https.HttpsError(
          "invalid-argument", 
          `Le type de fichier ${data.fileType} n'est pas pris en charge.`
        );
    }
    
    // Enregistrer l'activité dans Firestore
    await admin.firestore().collection("activites").add({
      type: "office_edit",
      userId: context.auth.uid,
      fileId: data.fileId,
      fileName: data.fileName,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      editUrl: officeUrl,
      accessToken: msToken,
      expiresAt: Date.now() + 3600000, // Expire dans 1 heure
    };
  } catch (error) {
    console.error("Erreur dans getOfficeOnlineUrl:", error);
    throw new functions.https.HttpsError(
      "internal",
      "Erreur lors de la génération de l'URL d'édition Office"
    );
  }
});

/**
 * Obtient un jeton d'accès pour l'API Microsoft Graph
 */
async function getMicrosoftAccessToken(): Promise<string> {
  try {
    if (!MS_CLIENT_ID || !MS_CLIENT_SECRET || !MS_TENANT_ID) {
      console.warn("Configuration Microsoft incomplète, retour d'un jeton fictif");
      return "demo-token-simulation";
    }
    
    const tokenEndpoint = `https://login.microsoftonline.com/${MS_TENANT_ID}/oauth2/v2.0/token`;
    
    const data = {
      client_id: MS_CLIENT_ID,
      scope: 'https://graph.microsoft.com/.default',
      client_secret: MS_CLIENT_SECRET,
      grant_type: 'client_credentials'
    };
    
    const response = await axios.post(tokenEndpoint, querystring.stringify(data), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    return response.data.access_token;
  } catch (error) {
    console.error("Erreur lors de l'obtention du jeton Microsoft:", error);
    throw new Error("Impossible d'obtenir un jeton d'accès Microsoft");
  }
}

// Endpoint WOPI pour l'accès aux fichiers
export const wopiFiles = functions.https.onRequest((request, response) => {
  corsHandler(request, response, async () => {
    try {
      const fileId = request.path.split("/").pop();
      const accessToken = request.query.access_token as string;

      if (!fileId || !accessToken) {
        response.status(400).send({error: "Paramètres manquants"});
        return;
      }

      // Vérifier le token d'accès
      const tokenData = verifySecureToken(accessToken);
      if (!tokenData || tokenData.fileId !== fileId) {
        response.status(401).send({error: "Accès non autorisé"});
        return;
      }

      // Récupérer les informations du fichier
      const fileDoc = await admin.firestore().collection("fichiers").doc(fileId).get();
      if (!fileDoc.exists) {
        response.status(404).send({error: "Fichier non trouvé"});
        return;
      }

      // Obtenir l'URL de téléchargement du fichier depuis Storage
      const fileData = fileDoc.data();
      const fileUrl = fileData?.url;
      const fileContents = await downloadFileFromUrl(fileUrl);

      // Répondre selon le type de requête WOPI
      switch (request.method) {
      case "GET":
        // Checkout_File ou GetFile
        response.status(200).send(fileContents);
        break;
      case "POST":
        // PutFile (sauvegarder les modifications)
        await uploadFileToStorage(fileId, request.body);
        response.status(200).send({success: true});
        break;
      default:
        response.status(405).send({error: "Méthode non autorisée"});
      }
    } catch (error) {
      console.error("Erreur dans wopiFiles:", error);
      response.status(500).send({error: "Erreur serveur"});
    }
  });
});

/**
 * Génère un token sécurisé pour l'accès aux fichiers
 * @param {string} fileId - L'ID du fichier
 * @param {string} userId - L'ID de l'utilisateur
 * @return {string} Le token généré
 */
function generateSecureToken(fileId: string, userId: string): string {
  // En production, utilisez un système de token sécurisé
  // comme JWT avec une clé secrète appropriée
  return Buffer.from(JSON.stringify({
    fileId,
    userId,
    timestamp: Date.now(),
  })).toString("base64");
}

/**
 * Vérifie un token sécurisé
 * @param {string} token - Le token à vérifier
 * @return {any} Les données décodées ou null
 */
function verifySecureToken(token: string): any {
  try {
    return JSON.parse(Buffer.from(token, "base64").toString());
  } catch (error) {
    return null;
  }
}

/**
 * Télécharge un fichier depuis une URL
 * @param {string} url - L'URL du fichier à télécharger
 * @return {Buffer} Le contenu du fichier
 */
async function downloadFileFromUrl(_url: string): Promise<Buffer> {
  // Récupérer le contenu du fichier
  // En production, utilisez une méthode appropriée pour votre implémentation
  return Buffer.from("Contenu du fichier");
}

/**
 * Téléverse un fichier modifié
 * @param {string} fileId - L'ID du fichier
 * @param {any} _content - Le contenu du fichier
 */
async function uploadFileToStorage(fileId: string, _content: any): Promise<void> {
  // Enregistrer le contenu modifié
  // En production, implémentez cette fonction selon votre architecture
  console.log(`Fichier ${fileId} mis à jour`);
}
