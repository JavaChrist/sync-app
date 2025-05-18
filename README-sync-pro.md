# Sync Pro - Gestion documentaire pour EDF

![Logo EDF](public/logo-edf.png)

## Présentation

**Sync Pro** est une application web moderne de gestion documentaire, conçue spécifiquement pour les équipes EDF. Elle permet de stocker, partager, commenter et capturer des documents de manière sécurisée. L'interface responsive s’adapte aux ordinateurs, tablettes et mobiles, pour un usage terrain comme bureau.

> 🚀 Projet développé par [JavaChrist](https://github.com/JavaChrist)

---

## Fonctionnalités principales

- 🔐 **Authentification via NNI** (identifiant EDF) et mot de passe Firebase
- 📁 **Organisation des fichiers** par dossiers/sous-dossiers
- 📤 **Téléversement & téléchargement** de tous types de fichiers
- 💬 **Commentaires collaboratifs** sur chaque document
- 📸 **Capture photo mobile** (idéal sur chantier ou en déplacement)
- 🔍 **Recherche intelligente** par nom
- 💻 **Interface responsive** (PC, tablette, smartphone)
- 🌙 **Mode sombre / clair**
- 📊 **Tableau de bord** avec statistiques d’utilisation

---

## Technologies utilisées

- **Frontend** : React, TypeScript, TailwindCSS
- **Backend** : Firebase (Firestore, Auth, Storage, Functions)
- **Base de données** : Firestore (NoSQL)
- **Hébergement** : Vercel
- **Authentification** : Firebase (login avec identifiant NNI + mot de passe)

---

## Prérequis

- Node.js 14+
- Compte Firebase configuré (Auth, Firestore, Storage)
- Compte Vercel (gratuit ou pro)

---

## Installation locale

1. **Cloner le projet**
   ```bash
   git clone https://github.com/JavaChrist/sync-pro.git
   cd sync-pro
   ```

2. **Installer les dépendances**
   ```bash
   npm install
   ```

3. **Configurer Firebase**
   - Créer un projet Firebase
   - Activer `Authentication`, `Firestore`, `Storage`
   - Créer un fichier `.env` à la racine avec :

     ```env
     VITE_FIREBASE_API_KEY=xxx
     VITE_FIREBASE_AUTH_DOMAIN=xxx
     VITE_FIREBASE_PROJECT_ID=xxx
     VITE_FIREBASE_STORAGE_BUCKET=xxx
     VITE_FIREBASE_MESSAGING_SENDER_ID=xxx
     VITE_FIREBASE_APP_ID=xxx
     ```

4. **Démarrer en local**
   ```bash
   npm run dev
   ```

---

## Déploiement sur Vercel

Le projet est optimisé pour un déploiement via [Vercel](https://vercel.com/).

### 🔄 Déploiement continu

Chaque push sur la branche `main` déclenche un déploiement automatique.

### 🧪 Déploiement manuel (optionnel)

```bash
vercel login
vercel link
vercel --prod
```

> Les variables d’environnement sont configurables dans le dashboard Vercel.

---

## Structure Firestore

```yaml
utilisateurs (collection)
  └── NNI_ABC123 (document)
      ├── nom: Jean Dupont
      ├── role: admin

dossiers (collection)
  └── root (document)
      ├── nom: Dossiers Généraux
      └── parentId: null

fichiers (collection)
  └── fichier_1 (document)
      ├── nom: rapport.pdf
      ├── dossierId: root

commentaires (collection)
  └── commentaire_1
      ├── fichierId: fichier_1
      ├── auteur: NNI_ABC123
      └── message: "À revoir page 2"

activites (collection)
  └── log_1
      ├── action: "upload"
      ├── utilisateur: NNI_ABC123
```

---

## Guide utilisateur

- **Connexion** : identifiant NNI (en majuscules) + mot de passe Firebase
- **Navigation** : explorer les documents comme un gestionnaire de fichiers
- **Ajout de fichiers** : glisser-déposer ou sélection
- **Commentaires** : accessibles pour chaque fichier
- **Capture mobile** : prend une photo directe depuis smartphone

---

## Aperçu de l'application

> 🖼️ *Screenshots à insérer ici :*

- ![Capture 1](screenshots/capture-1.png)
- ![Capture 2](screenshots/capture-2.png)
- ![Capture mobile](screenshots/mobile-view.png)

---

## Sécurité

- Authentification Firebase
- Règles Firestore strictes par rôle
- Stockage Firebase sécurisé
- Communication HTTPS chiffrée

---

## Support

🛠 Pour toute assistance, merci de contacter l’administrateur Sync Pro ou créer un ticket via le support interne EDF.

---

## Licence

Propriété d’EDF – Tous droits réservés © 2025  
Développé par Christian Grohens – [JavaChrist](https://github.com/JavaChrist)
