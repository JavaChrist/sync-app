import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebaseConfig';
import FileExplorer from '../components/FileExplorer';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { initializeDefaultFolders } from '../utils/initializeData';
import ThemeToggle from '../components/ThemeToggle';

const DocumentManager: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [userId, setUserId] = useState<string>('');
  const [userRole, setUserRole] = useState<string>('');
  const [dataInitialized, setDataInitialized] = useState<boolean>(false);

  useEffect(() => {
    // Vérifier si l'utilisateur est connecté
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        setUserId(user.uid);
      } else {
        // Rediriger vers la page de connexion si non connecté
        navigate('/login');
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        if (auth.currentUser) {
          const uid = auth.currentUser.uid;
          setUserId(uid);
          
          // Récupérer les informations de l'utilisateur pour déterminer son rôle
          const userDocRef = doc(db, "utilisateurs", uid);
          const userDocSnap = await getDoc(userDocRef);
          
          if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            setUserRole(userData.role || 'user');
          }
          
          // Initialiser les données par défaut
          try {
            await initializeDefaultFolders(uid);
            setDataInitialized(true);
          } catch (initError) {
            console.error("Erreur lors de l'initialisation des données:", initError);
            // Ne pas bloquer l'accès même si l'initialisation échoue
            setDataInitialized(true);
          }
          
          setLoading(false);
        } else {
          // L'utilisateur n'est pas connecté, la redirection sera gérée par App.tsx
          setError('Vous devez être connecté pour accéder à cette page.');
          setLoading(false);
        }
      } catch (err) {
        console.error('Erreur lors de la vérification de l\'authentification:', err);
        setError('Une erreur est survenue. Veuillez réessayer plus tard.');
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <p className="text-gray-700">Chargement...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
          <p className="text-red-500 text-center">{error}</p>
        </div>
      </div>
    );
  }

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
          <a
            href="/dashboard"
            className="w-full text-left py-2.5 px-4 rounded transition duration-200 hover:bg-gray-700 hover:text-white block mb-2"
          >
            Tableau de Bord
          </a>
          
          <a
            href="/documents"
            className="w-full text-left py-2.5 px-4 rounded bg-blue-600 text-white block mb-2"
          >
            Gestion Documentaire
          </a>
          
          {/* Options supplémentaires pour les administrateurs */}
          {userRole === 'admin' && (
            <>
              <a 
                href="/admin/users" 
                className="w-full text-left py-2.5 px-4 rounded transition duration-200 hover:bg-gray-700 hover:text-white block mb-2"
              >
                Gestion des comptes
              </a>
            </>
          )}
        </nav>

        {/* Bouton de déconnexion */}
        <button
          onClick={() => auth.signOut()}
          className="w-full mt-auto bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded focus:outline-none focus:shadow-outline text-sm"
        >
          Se déconnecter
        </button>
      </div>

      {/* Contenu Principal */}
      <div className="flex-grow p-6 md:p-12">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Gestion Documentaire</h1>
          <p className="text-gray-600 dark:text-gray-400">Organisez et accédez à vos documents</p>
        </div>

        {dataInitialized ? (
          <FileExplorer userId={userId} />
        ) : (
          <div className="bg-white p-6 rounded-lg shadow-md">
            <p className="text-gray-700">Initialisation des données en cours...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentManager; 