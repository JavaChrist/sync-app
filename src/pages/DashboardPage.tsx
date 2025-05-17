import React, { useState, useEffect } from 'react';
// import { useNavigate } from 'react-router-dom'; // Supprimé car navigate n'est plus utilisé
import { auth, db } from '../firebaseConfig';
import { signOut } from 'firebase/auth';
import { doc, getDoc } from "firebase/firestore";
import { getFunctions, httpsCallable } from 'firebase/functions';

interface UserData {
  nni: string;
  email: string;
  role?: string; // Le rôle est optionnel
  motDePasseProvisoireActif?: boolean;
  // Ajoute d'autres champs si nécessaire
}

const DashboardPage: React.FC = () => {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isCreateAccountModalOpen, setIsCreateAccountModalOpen] = useState<boolean>(false);

  // États pour le formulaire de création de compte dans la modale
  const [newNni, setNewNni] = useState<string>('');
  const [newEmail, setNewEmail] = useState<string>('');
  const [createError, setCreateError] = useState<string>('');
  const [createSuccess, setCreateSuccess] = useState<string>('');
  const [creatingAccount, setCreatingAccount] = useState<boolean>(false);

  const functions = getFunctions();

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
      const creerCompteUtilisateur = httpsCallable(functions, 'creerCompteUtilisateur');
      const result = await creerCompteUtilisateur({ nni: newNni.toUpperCase(), email: newEmail });
      // La fonction `creerCompteUtilisateur` renvoie un objet avec `success` et `message`
      const data = result.data as { success: boolean; message: string; uid?: string };

      if (data.success) {
        setCreateSuccess(data.message || 'Compte utilisateur créé avec succès.');
        setNewNni('');
        setNewEmail('');
        // Optionnel: fermer la modale après un délai ou laisser l'admin la fermer
        // setTimeout(() => handleCloseCreateAccountModal(), 3000);
      } else {
        setCreateError(data.message || 'Erreur lors de la création du compte.');
      }
    } catch (error: any) {
      console.error("Erreur d'appel de la Cloud Function creerCompteUtilisateur:", error);
      setCreateError(error.message || 'Une erreur technique est survenue.');
    } finally {
      setCreatingAccount(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* Sidebar */}
      <div className="w-64 bg-gray-800 text-white p-6 space-y-6 flex flex-col">
        <h2 className="text-xl font-semibold border-b border-gray-700 pb-4">Menu</h2>
        
        <nav className="flex-grow">
          {/* Bouton Création de compte pour les admins */}
          {userData && userData.role === 'admin' && (
            <button
              onClick={handleOpenCreateAccountModal}
              className="w-full text-left py-2.5 px-4 rounded transition duration-200 hover:bg-gray-700 hover:text-white block"
            >
              Créer un compte
            </button>
          )}
          {/* Vous pouvez ajouter d'autres liens de navigation ici */}
        </nav>

        {/* Bouton de déconnexion en bas de la sidebar */}
        <button
          onClick={handleLogout}
          className="w-full mt-auto bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded focus:outline-none focus:shadow-outline text-sm"
        >
          Se déconnecter
        </button>
      </div>

      {/* Contenu Principal */}
      <div className="flex-grow p-12 flex flex-col items-center">
        <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-4xl">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-800">Tableau de Bord</h1>
            {/* Le bouton de déconnexion a été déplacé dans la sidebar */}
          </div>

          {auth.currentUser && (
            <p className="mb-2 text-gray-600">
              Connecté en tant que: <span className="font-medium">{auth.currentUser.email}</span>
            </p>
          )}
          {userData && userData.nni && (
            <p className="mb-6 text-gray-600">
              NNI: <span className="font-medium">{userData.nni}</span>
            </p>
          )}
          
          <p className="mb-8 text-gray-700">
            Bienvenue sur votre tableau de bord !
          </p>

          {/* Section Administration visible uniquement si userData.role === 'admin' */}
          {userData && userData.role === 'admin' && (
            <div className="mt-10 pt-6 border-t border-gray-200">
              <h2 className="text-xl font-semibold text-gray-700 mb-4">Panneau d'Administration</h2>
              <p className="text-gray-600 mb-4">
                Bienvenue dans la section d'administration.
                Vous pouvez créer de nouveaux comptes utilisateurs via le bouton dans la barre latérale.
              </p>
              {/* Formulaire de création de compte à ajouter ici ou sur une page dédiée */}
              {/* <div className="bg-blue-50 border border-blue-200 p-4 rounded-md">
                <p className="text-blue-700">Le formulaire de création de compte sera ajouté ici.</p>
              </div> */}
            </div>
          )}

          {/* Autre contenu du tableau de bord pour tous les utilisateurs */}
          {!userData || userData.role !== 'admin' && (
               <p className="mt-10 text-gray-600">Vous n'avez pas accès aux fonctionnalités d'administration.</p>
          )}
        </div>
      </div>

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