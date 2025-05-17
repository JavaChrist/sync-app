import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebaseConfig';
import { signInWithEmailAndPassword, onAuthStateChanged, sendPasswordResetEmail } from "firebase/auth";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { useTheme } from '../context/ThemeContext';

const LoginPage: React.FC = () => {
  const [nni, setNni] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [info, setInfo] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [resetLoading, setResetLoading] = useState<boolean>(false);
  const navigate = useNavigate();
  const { theme } = useTheme();

  // Rediriger si déjà connecté (ceci sera géré plus globalement dans App.tsx bientôt)
  useEffect(() => {
    if (auth.currentUser) {
      // navigate('/dashboard'); // Sera géré par App.tsx
    }
  }, [navigate]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);

    if (!nni || !password) {
      setError('Veuillez remplir tous les champs.');
      setLoading(false);
      return;
    }

    try {
      // 1. Rechercher l'utilisateur par NNI dans Firestore
      const usersRef = collection(db, "utilisateurs");
      const q = query(usersRef, where("nni", "==", nni.toUpperCase()));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setError('NNI non trouvé. Veuillez vérifier vos identifiants.');
        setLoading(false);
        return;
      }

      // Supposons qu'un NNI est unique, donc on prend le premier résultat
      const userData = querySnapshot.docs[0].data();
      const userEmail = userData.email;

      if (!userEmail) {
        setError('Erreur: Email non associé à ce NNI. Contactez l\'administrateur.');
        setLoading(false);
        return;
      }

      // 2. Tenter de se connecter avec l'email et le mot de passe
      await signInWithEmailAndPassword(auth, userEmail, password);
      
      // La redirection sera gérée par l'observer d'état d'authentification dans App.tsx
      // navigate('/dashboard'); // Donc, plus besoin de naviguer ici directement après connexion

    } catch (err: any) {
      console.error("Erreur de connexion:", err);
      if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        // Note: 'auth/user-not-found' peut arriver si l'email récupéré de Firestore n'existe pas dans Auth
        setError('NNI ou mot de passe incorrect.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Format d\'email invalide récupéré depuis la base de données.');
      } else {
        setError('Une erreur est survenue lors de la connexion. Veuillez réessayer.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    setError('');
    setInfo('');
    if (!nni) {
      setError('Veuillez saisir votre NNI pour réinitialiser le mot de passe.');
      return;
    }
    setResetLoading(true);
    try {
      const usersRef = collection(db, "utilisateurs");
      const q = query(usersRef, where("nni", "==", nni.toUpperCase()));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        // Ne pas révéler si le NNI existe ou non pour des raisons de sécurité.
        // Afficher un message générique.
        setInfo('Si un compte est associé à ce NNI, un email de réinitialisation a été envoyé.');
        setResetLoading(false);
        return;
      }

      const userData = querySnapshot.docs[0].data();
      const userEmail = userData.email;

      if (!userEmail) {
        // Cas peu probable si la base de données est cohérente, mais sécurité.
        setInfo('Si un compte est associé à ce NNI, un email de réinitialisation a été envoyé.');
        setResetLoading(false);
        return;
      }

      // Utiliser l'URL personnalisée pour la réinitialisation
      const actionCodeSettings = {
        // Utiliser l'URL de production même en développement pour les tests d'email
        url: process.env.NODE_ENV === 'production' 
          ? 'https://sync-pro.javachrist.eu/reset-password'
          : window.location.origin + '/reset-password',
        handleCodeInApp: true
      };
      
      await sendPasswordResetEmail(auth, userEmail, actionCodeSettings);
      setInfo(`Un email de réinitialisation a été envoyé à l'adresse associée à ce NNI.`);

    } catch (err: any) {
      console.error("Erreur lors de la demande de réinitialisation du mot de passe:", err);
      // Afficher un message d'erreur générique pour ne pas donner trop d'informations.
      setError('Une erreur est survenue. Veuillez réessayer plus tard.');
    } finally {
      setResetLoading(false);
    }
  };

  // Mettre cela au niveau supérieur de votre composant ou dans un useEffect
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      // L'utilisateur EST authentifié
      // C'EST ICI que vous pouvez effectuer des opérations Firestore qui nécessitent request.auth != null
      console.log("Utilisateur connecté:", user.uid);
      try {
        // Exemple: lire un document utilisateur après connexion
        const userDocRef = doc(db, "utilisateurs", user.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          console.log("Données utilisateur:", userDocSnap.data());
          // Rediriger vers le tableau de bord, mettre à jour l'état de l'application, etc.
        } else {
          // Gérer le cas où le document utilisateur n'existe pas, si nécessaire
        }
      } catch (firestoreError) {
        // Gérer les erreurs Firestore spécifiques qui pourraient survenir ici
        // C'est ici que votre erreur "Missing or insufficient permissions" se manifeste si les règles bloquent
        console.error("Erreur Firestore après connexion (dans onAuthStateChanged):", firestoreError);
        // Afficher un message d'erreur plus générique à l'utilisateur si cela se produit ici
        // ou déconnecter l'utilisateur si l'accès aux données est critique.
      }
    } else {
      // L'utilisateur est déconnecté
      console.log("Utilisateur déconnecté");
    }
  });

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 to-blue-100 dark:from-gray-800 dark:to-gray-900">
      <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-md border border-blue-100 dark:border-gray-700">
        {/* Logo et Titre */}
        <div className="flex flex-col items-center mb-8">
          <img src="/logo-edf.png" alt="Logo EDF" className="h-24 w-auto mb-4" />
          <h1 className="text-3xl font-bold text-blue-600 dark:text-blue-400">Sync Pro</h1>
          <p className="text-gray-600 dark:text-gray-300 mt-2">Gestion documentaire EDF</p>
        </div>
        
        {/* Formulaire de connexion */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="nni" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              NNI
            </label>
            <input
              type="text"
              id="nni"
              value={nni}
              onChange={(e) => setNni(e.target.value.toUpperCase())}
              className="mt-1 block w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white sm:text-sm"
              placeholder="Entrez votre NNI"
              required
              disabled={loading || resetLoading}
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Mot de passe
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white sm:text-sm"
              placeholder="Votre mot de passe"
              required
              disabled={loading || resetLoading}
            />
          </div>
          
          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 border-l-4 border-red-500 p-4 rounded">
              <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
            </div>
          )}
          
          {info && (
            <div className="bg-blue-50 dark:bg-blue-900/30 border-l-4 border-blue-500 p-4 rounded">
              <p className="text-blue-700 dark:text-blue-400 text-sm">{info}</p>
            </div>
          )}
          
          <button
            type="submit"
            className={`w-full font-bold py-3 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200 ${
              loading || resetLoading
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
            disabled={loading || resetLoading}
          >
            {loading ? 'Connexion en cours...' : 'Se connecter'}
          </button>
        </form>
        
        <div className="mt-6 text-center border-t border-gray-200 dark:border-gray-700 pt-4">
          <button
            onClick={handlePasswordReset}
            disabled={resetLoading || loading}
            className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {resetLoading ? 'Envoi en cours...' : 'Mot de passe oublié ?'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginPage; 