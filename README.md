# Sync Pro - Solution de gestion documentaire pour EDF

![Logo EDF](public/logo-edf.png)

## Présentation

Sync Pro est une application web moderne de gestion documentaire conçue spécifiquement pour les besoins d'EDF. Elle permet aux employés de stocker, partager et commenter des documents de manière sécurisée et intuitive. L'interface responsive s'adapte à tous les appareils, du poste de travail au smartphone.

## Fonctionnalités principales

- **Authentification sécurisée par NNI** - Connexion avec les identifiants EDF (NNI)
- **Gestion hiérarchique de documents** - Organisation en dossiers et sous-dossiers
- **Téléversement et téléchargement** - Support pour tous types de fichiers
- **Système de commentaires** - Discussion collaborative sur les documents
- **Capture photo mobile** - Ajout de photos directement depuis l'appareil mobile
- **Recherche intelligente** - Recherche rapide de documents par nom
- **Interface adaptative** - Fonctionne sur ordinateurs, tablettes et smartphones
- **Mode sombre/clair** - Interface adaptée à tous les environnements de travail
- **Tableau de bord** - Statistiques d'utilisation et accès rapide aux documents

## Technologies utilisées

- **Frontend**: React, TypeScript, TailwindCSS
- **Backend**: Firebase (Firestore, Authentication, Storage, Functions)
- **Authentification**: Firebase Authentication avec email/password
- **Base de données**: Firestore (NoSQL)
- **Stockage**: Firebase Storage

## Prérequis

- Node.js 14+ et npm
- Compte Firebase
- Espace de stockage Firebase

## Installation

1. **Cloner le dépôt**
   ```bash
   git clone https://github.com/votre-organisation/sync-pro.git
   cd sync-pro
   ```

2. **Installer les dépendances**
   ```bash
   npm install
   ```

3. **Configurer Firebase**
   - Créer un projet Firebase
   - Activer Authentication, Firestore et Storage
   - Créer un fichier `.env` à la racine du projet avec les informations de configuration:
     ```
     REACT_APP_FIREBASE_API_KEY=xxx
     REACT_APP_FIREBASE_AUTH_DOMAIN=xxx
     REACT_APP_FIREBASE_PROJECT_ID=xxx
     REACT_APP_FIREBASE_STORAGE_BUCKET=xxx
     REACT_APP_FIREBASE_MESSAGING_SENDER_ID=xxx
     REACT_APP_FIREBASE_APP_ID=xxx
     ```

4. **Déployer les règles de sécurité et indexes Firestore**
   ```bash
   firebase deploy --only firestore:rules,firestore:indexes
   ```

5. **Démarrer l'application en développement**
   ```bash
   npm start
   ```

## Déploiement en production

1. **Construire l'application**
   ```bash
   npm run build
   ```

2. **Déployer sur Firebase Hosting**
   ```bash
   firebase deploy --only hosting
   ```

## Structure de la base de données

### Collections Firestore

- **utilisateurs** - Informations sur les utilisateurs
- **dossiers** - Structure hiérarchique des dossiers
- **fichiers** - Métadonnées des fichiers stockés
- **commentaires** - Commentaires associés aux documents
- **activites** - Journal des actions des utilisateurs

## Guide utilisateur

### Connexion

- Utilisez votre NNI EDF et votre mot de passe
- Option de réinitialisation du mot de passe disponible

### Navigation dans les documents

- Interface de type explorateur de fichiers
- Fil d'Ariane pour naviguer dans la hiérarchie
- Vue liste ou grille configurable
- Tri par nom, type, taille ou date

### Gestion de fichiers

- Téléversement par glisser-déposer ou sélection
- Téléchargement en un clic
- Commentaires collaboratifs
- Capture photo sur appareils mobiles

## Sécurité

- Authentification sécurisée par Firebase
- Règles de sécurité Firestore pour contrôle d'accès granulaire
- Stockage sécurisé des fichiers
- Transmission chiffrée des données

## Support

Pour toute assistance, contactez l'administrateur système ou créez un ticket via le système de support interne d'EDF.

## Licence

Propriété d'EDF - Tous droits réservés © 2023 