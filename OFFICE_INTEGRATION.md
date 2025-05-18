# Intégration Microsoft Office 365

Ce document explique comment configurer l'intégration avec Microsoft Office 365 pour permettre l'édition en ligne des documents directement dans l'application Sync Pro.

## Prérequis

1. Un abonnement Microsoft 365 Entreprise (E3, E5, ou Business Premium)
2. Un compte administrateur Azure Active Directory
3. Accès à la console Firebase

## Étapes de configuration

### 1. Enregistrer une application dans Azure AD

1. Connectez-vous au [portail Azure](https://portal.azure.com/)
2. Accédez à "Azure Active Directory" > "Inscriptions d'applications"
3. Cliquez sur "Nouvelle inscription"
   - Nom : Sync Pro
   - Types de comptes pris en charge : Comptes dans cet annuaire d'organisation uniquement
   - URI de redirection : Web - `https://votre-domaine.com/auth/microsoft/callback`
4. Cliquez sur "Inscrire"
5. Notez l'ID d'application (client) et l'ID de locataire (tenant)
6. Sous "Certificats et secrets", créez un nouveau secret client et notez sa valeur

### 2. Configurer les autorisations

1. Dans votre application Azure AD, allez dans "Autorisations d'API"
2. Ajoutez une autorisation > Microsoft Graph > Autorisations d'application
3. Ajoutez les autorisations suivantes :
   - Files.ReadWrite.All
   - Sites.ReadWrite.All
   - User.Read.All
4. Cliquez sur "Accorder le consentement administrateur"

### 3. Configurer les variables d'environnement Firebase

Définissez les variables d'environnement suivantes pour les fonctions Firebase :

```bash
firebase functions:config:set microsoft.client_id="VOTRE_CLIENT_ID" \
                            microsoft.client_secret="VOTRE_CLIENT_SECRET" \
                            microsoft.tenant_id="VOTRE_TENANT_ID" \
                            microsoft.redirect_uri="https://votre-domaine.com/auth/microsoft/callback"
```

### 4. Configurer les variables d'environnement React

Ajoutez les lignes suivantes à votre fichier `.env` :

```
REACT_APP_MS_CLIENT_ID=votre_client_id_azure
REACT_APP_MS_TENANT_ID=votre_tenant_id_office365
REACT_APP_MS_REDIRECT_URI=https://votre-domaine.com/auth/microsoft/callback
REACT_APP_USE_REAL_OFFICE_INTEGRATION=true
```

### 5. Déployer les fonctions Firebase

```bash
firebase deploy --only functions
```

## Tests et validation

1. Téléversez un document Office (Word, Excel, PowerPoint)
2. Cliquez sur l'icône d'édition à côté du fichier
3. Vous devriez être redirigé vers l'interface d'édition Office Online

## Problèmes connus

- Le vidage du cache du navigateur peut être nécessaire après la mise à jour des configurations
- Les fichiers de plus de 50 Mo peuvent rencontrer des problèmes lors de l'édition en ligne

## Support

Pour toute assistance supplémentaire, contactez l'administrateur système. 