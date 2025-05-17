import React, { useState, useEffect } from 'react';
// import { useNavigate } from 'react-router-dom'; // Supprimé car navigate n'est plus utilisé
import { auth, db } from '../firebaseConfig';
import { signOut, sendPasswordResetEmail, deleteUser } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, getDocs, deleteDoc } from "firebase/firestore";
import { getFunctions, httpsCallable } from 'firebase/functions';
import ThemeToggle from '../components/ThemeToggle';

interface UserData {
  nni: string;
  email: string;
  role?: string; // Le rôle est optionnel
  motDePasseProvisoireActif?: boolean;
  id?: string; // Ajout de l'id pour la gestion des utilisateurs
  // Ajoute d'autres champs si nécessaire
}

const DashboardPage: React.FC = () => {
  // const navigate = useNavigate(); // Supprimé car non utilisé
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isCreateAccountModalOpen, setIsCreateAccountModalOpen] = useState<boolean>(false);
  const [isDeleteAccountModalOpen, setIsDeleteAccountModalOpen] = useState<boolean>(false);

  // États pour le formulaire de création de compte dans la modale
  const [newNni, setNewNni] = useState<string>('');
  const [newEmail, setNewEmail] = useState<string>('');
  const [isAdmin, setIsAdmin] = useState<boolean>(false); // Nouvel état pour gérer le rôle admin
  const [createError, setCreateError] = useState<string>('');
  const [createSuccess, setCreateSuccess] = useState<string>('');
  const [creatingAccount, setCreatingAccount] = useState<boolean>(false);

  // États pour la suppression de compte
  const [deleteNni, setDeleteNni] = useState<string>('');
  const [searchResult, setSearchResult] = useState<UserData | null>(null);
  const [deleteError, setDeleteError] = useState<string>('');
  const [deleteSuccess, setDeleteSuccess] = useState<string>('');
  const [deleteLoading, setDeleteLoading] = useState<boolean>(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState<boolean>(false);

  // Spécifier explicitement la région europe-west1 pour les fonctions
  const functions = getFunctions(undefined, "europe-west1");

  useEffect(() => {
    const fetchUserData = async () => {
      if (auth.currentUser) {
        try {
          const userDocRef = doc(db, "utilisateurs", auth.currentUser.uid);
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            setUserData(userDocSnap.data() as UserData);
          } else {
            console.warn("Document utilisateur non trouvé dans Firestore pour UID:", auth.currentUser.uid);
            // Gérer le cas où le document n'existe pas, peut-être déconnecter l'utilisateur ou afficher une erreur
            // Pour l'instant, on laisse userData à null, ce qui n'affichera pas la section admin
          }
        } catch (error) {
          console.error("Erreur lors de la récupération des données utilisateur:", error);
        }
      }
      setLoading(false);
    };

    fetchUserData();
  }, []); // Se déclenche une fois au montage

  const handleLogout = async () => {
    try {
      await signOut(auth);
      // La redirection est gérée par App.tsx
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <p className="text-gray-700">Chargement du tableau de bord...</p>
      </div>
    );
  }

  const handleOpenCreateAccountModal = () => {
    setIsCreateAccountModalOpen(true);
    setNewNni('');
    setNewEmail('');
    setCreateError('');
    setCreateSuccess('');
  };

  const handleCloseCreateAccountModal = () => {
    setIsCreateAccountModalOpen(false);
  };

  const handleCreateAccount = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreateError('');
    setCreateSuccess('');
    setCreatingAccount(true);

    if (!newNni || !newEmail) {
      setCreateError('Veuillez remplir tous les champs (NNI et Email).');
      setCreatingAccount(false);
      return;
    }

    try {
      // Vérifier que l'utilisateur actuel est admin
      if (!userData || userData.role !== 'admin') {
        throw new Error("Vous n'avez pas les permissions pour créer un compte.");
      }

      // Générer un mot de passe temporaire
      const temporaryPassword = Math.random().toString(36).slice(-8);

      // Créer un nouvel utilisateur dans Firebase Auth via l'API REST
      const authApiEndpoint = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${process.env.REACT_APP_FIREBASE_API_KEY}`;
      const authResponse = await fetch(authApiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: newEmail,
          password: temporaryPassword,
          displayName: newNni.toUpperCase(),
          returnSecureToken: true,
        }),
      });

      const authData = await authResponse.json();
      
      if (!authResponse.ok) {
        throw new Error(authData.error?.message || "Erreur lors de la création du compte");
      }

      // Ajouter l'utilisateur à Firestore (avec la syntaxe Firestore v9)
      const userDocRef = doc(db, "utilisateurs", authData.localId);
      await setDoc(userDocRef, {
        nni: newNni.toUpperCase(),
        email: newEmail,
        role: isAdmin ? "admin" : "user", // Utiliser le rôle selon la case à cocher
        creePar: auth.currentUser?.uid,
        dateCreation: new Date(),
        motDePasseProvisoire: true,
      });

      // Envoyer un email de réinitialisation de mot de passe avec l'URL personnalisée
      try {
        const actionCodeSettings = {
          // Utiliser l'URL de production même en développement pour les tests d'email
          url: process.env.NODE_ENV === 'production' 
            ? 'https://sync-pro.javachrist.eu/reset-password'
            : window.location.origin + '/reset-password',
          handleCodeInApp: true,
        };
        
        await sendPasswordResetEmail(auth, newEmail, actionCodeSettings);
        console.log("Email de réinitialisation envoyé à:", newEmail);
      } catch (error) {
        console.error("Erreur lors de l'envoi de l'email de réinitialisation:", error);
        // Même en cas d'erreur, on continue le processus car le compte a été créé
      }
      
      setCreateSuccess(`Compte créé avec succès : ${newEmail} (Mot de passe temporaire : ${temporaryPassword})`);
      setNewNni('');
      setNewEmail('');
      setIsAdmin(false); // Réinitialiser l'état pour la prochaine création
    } catch (error: any) {
      console.error("Erreur lors de la création du compte:", error);
      if (error.message?.includes('EMAIL_EXISTS')) {
        setCreateError("Cette adresse email est déjà utilisée.");
      } else {
        setCreateError(error.message || 'Une erreur technique est survenue.');
      }
    } finally {
      setCreatingAccount(false);
    }
  };

  const handleOpenDeleteAccountModal = () => {
    setIsDeleteAccountModalOpen(true);
    setDeleteNni('');
    setDeleteError('');
    setDeleteSuccess('');
    setSearchResult(null);
    setConfirmDeleteOpen(false);
  };

  const handleCloseDeleteAccountModal = () => {
    setIsDeleteAccountModalOpen(false);
  };

  // Fonction pour rechercher un utilisateur par NNI
  const handleSearchUser = async () => {
    setDeleteError('');
    setSearchResult(null);
    setConfirmDeleteOpen(false);
    
    if (!deleteNni) {
      setDeleteError('Veuillez entrer un NNI à supprimer.');
      return;
    }
    
    setDeleteLoading(true);
    
    try {
      // Rechercher l'utilisateur dans Firestore
      const usersRef = collection(db, "utilisateurs");
      const q = query(usersRef, where("nni", "==", deleteNni.toUpperCase()));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        setDeleteError(`Aucun utilisateur trouvé avec le NNI "${deleteNni}".`);
        setDeleteLoading(false);
        return;
      }
      
      // Récupérer les données du premier utilisateur trouvé (le NNI est supposé unique)
      const userData = querySnapshot.docs[0].data() as UserData;
      const userId = querySnapshot.docs[0].id;
      setSearchResult({...userData, id: userId});
      setConfirmDeleteOpen(true);
      
    } catch (error) {
      console.error("Erreur lors de la recherche de l'utilisateur:", error);
      setDeleteError('Une erreur est survenue lors de la recherche. Veuillez réessayer.');
    } finally {
      setDeleteLoading(false);
    }
  };

  // Fonction pour supprimer un compte utilisateur
  const handleDeleteUser = async () => {
    setDeleteError('');
    setDeleteSuccess('');
    setDeleteLoading(true);
    
    try {
      if (!searchResult?.id) {
        throw new Error("Identifiant utilisateur manquant.");
      }
      
      // Supprimer le document utilisateur de Firestore
      await deleteDoc(doc(db, "utilisateurs", searchResult.id));
      
      // Note: Idéalement, nous voudrions aussi supprimer l'utilisateur de Firebase Auth
      // Mais cela nécessite des privilèges admin ou une Cloud Function
      
      setDeleteSuccess(`Le compte utilisateur "${searchResult?.nni}" a été supprimé avec succès.`);
      setSearchResult(null);
      setDeleteNni('');
      setConfirmDeleteOpen(false);
      
    } catch (error: any) {
      console.error("Erreur lors de la suppression de l'utilisateur:", error);
      setDeleteError(error.message || 'Une erreur est survenue lors de la suppression du compte.');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-800 flex">
      {/* Sidebar */}
      <div className="w-64 bg-gray-800 dark:bg-gray-900 text-white p-6 space-y-6 flex flex-col">
        {/* Logo EDF */}
        <div className="flex justify-center mb-4">
          <img src="/logo-edf.png" alt="Logo EDF" className="h-20 w-auto" />
        </div>
        
        <div className="flex justify-between items-center border-b border-gray-700 pb-4">
          <h2 className="text-xl font-semibold">Menu</h2>
          <ThemeToggle />
        </div>
        
        <nav className="flex-grow">
          {/* Boutons pour les admins */}
          {userData && userData.role === 'admin' && (
            <>
              <button
                onClick={handleOpenCreateAccountModal}
                className="w-full text-left py-2.5 px-4 rounded transition duration-200 hover:bg-gray-700 hover:text-white block mb-2"
              >
                Créer un compte
              </button>
              <button
                onClick={handleOpenDeleteAccountModal}
                className="w-full text-left py-2.5 px-4 rounded transition duration-200 hover:bg-gray-700 hover:text-white block mb-2"
              >
                Supprimer un compte
              </button>
            </>
          )}
          
          {/* Lien vers la gestion documentaire */}
          <a
            href="/documents"
            className="w-full text-left py-2.5 px-4 rounded transition duration-200 hover:bg-gray-700 hover:text-white block mb-2"
          >
            Gestion Documentaire
          </a>
        </nav>

        {/* Bouton de déconnexion */}
        <button
          onClick={handleLogout}
          className="w-full mt-auto bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded focus:outline-none focus:shadow-outline text-sm"
        >
          Se déconnecter
        </button>
      </div>

      {/* Contenu Principal */}
      <div className="flex-grow p-12 flex flex-col items-center bg-gray-100 dark:bg-gray-800">
        <div className="bg-white dark:bg-gray-700 p-8 rounded-lg shadow-md w-full max-w-4xl">
          {userData && userData.nni && (
            <p className="mb-6 text-gray-600 dark:text-gray-300">
              <span className="text-blue-600 dark:text-blue-400 font-medium">NNI:</span> <span className="text-blue-600 dark:text-blue-400 font-medium">{userData.nni}</span>
            </p>
          )}

          {/* Le contenu principal du dashboard est gardé vide pour le moment */}
        </div>
      </div>

      {/* Modale de suppression de compte */}
      {isDeleteAccountModalOpen && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md mx-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold text-gray-800">Supprimer un compte</h3>
              <button onClick={handleCloseDeleteAccountModal} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor"><path d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            
            {!confirmDeleteOpen ? (
              // Formulaire de recherche
              <div>
                <div className="mb-4">
                  <label htmlFor="deleteNni" className="block text-sm font-medium text-gray-700 mb-1">NNI à supprimer</label>
                  <div className="flex space-x-2">
                    <input 
                      type="text" 
                      id="deleteNni"
                      value={deleteNni}
                      onChange={(e) => setDeleteNni(e.target.value.toUpperCase())}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      placeholder="Ex: CG12345X"
                      required
                      disabled={deleteLoading}
                    />
                    <button 
                      onClick={handleSearchUser}
                      disabled={deleteLoading}
                      className={`px-4 py-2 text-sm font-medium text-white rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${
                        deleteLoading ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'
                      }`}
                    >
                      {deleteLoading ? 'Recherche...' : 'Rechercher'}
                    </button>
                  </div>
                </div>
                
                {deleteError && <p className="text-red-500 text-sm mb-4">{deleteError}</p>}
                {deleteSuccess && <p className="text-green-500 text-sm mb-4">{deleteSuccess}</p>}
              </div>
            ) : (
              // Confirmation de suppression
              <div>
                <p className="text-gray-700 mb-6">
                  Confirmez-vous la suppression du compte suivant ?
                </p>
                <div className="bg-gray-50 p-4 rounded-md mb-6">
                  <p><span className="font-medium">NNI:</span> {searchResult?.nni}</p>
                  <p><span className="font-medium">Email:</span> {searchResult?.email}</p>
                  <p><span className="font-medium">Rôle:</span> {searchResult?.role === 'admin' ? 'Administrateur' : 'Utilisateur standard'}</p>
                </div>
                
                <div className="text-red-600 text-sm mb-6">
                  <p>Attention: Cette action est irréversible.</p>
                </div>
                
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => setConfirmDeleteOpen(false)}
                    className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500"
                    disabled={deleteLoading}
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleDeleteUser}
                    className={`px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 ${
                      deleteLoading ? 'opacity-75 cursor-not-allowed' : ''
                    }`}
                    disabled={deleteLoading}
                  >
                    {deleteLoading ? 'Suppression...' : 'Supprimer'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modale de création de compte */}
      {isCreateAccountModalOpen && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md mx-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold text-gray-800">Créer un nouveau compte</h3>
              <button onClick={handleCloseCreateAccountModal} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor"><path d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            
            <form onSubmit={handleCreateAccount}>
              <div className="mb-4">
                <label htmlFor="newNni" className="block text-sm font-medium text-gray-700 mb-1">NNI</label>
                <input 
                  type="text" 
                  id="newNni"
                  value={newNni}
                  onChange={(e) => setNewNni(e.target.value.toUpperCase())}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="Ex: CG12345X"
                  required
                  disabled={creatingAccount}
                />
              </div>
              <div className="mb-6">
                <label htmlFor="newEmail" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input 
                  type="email" 
                  id="newEmail"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="utilisateur@example.com"
                  required
                  disabled={creatingAccount}
                />
              </div>

              {/* Ajouter la case à cocher pour le rôle admin */}
              <div className="mb-6">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="isAdmin"
                    checked={isAdmin}
                    onChange={(e) => setIsAdmin(e.target.checked)}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    disabled={creatingAccount}
                  />
                  <label htmlFor="isAdmin" className="ml-2 block text-sm text-gray-700">
                    Créer un compte administrateur
                  </label>
                </div>
              </div>

              {createError && <p className="text-red-500 text-sm mb-4 text-center">{createError}</p>}
              {createSuccess && <p className="text-green-500 text-sm mb-4 text-center">{createSuccess}</p>}

              <div className="flex items-center justify-end space-x-4">
                <button 
                  type="button" 
                  onClick={handleCloseCreateAccountModal}
                  disabled={creatingAccount}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                  Annuler
                </button>
                <button 
                  type="submit"
                  disabled={creatingAccount}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-300"
                >
                  {creatingAccount ? 'Création en cours...' : 'Créer le compte'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardPage; 