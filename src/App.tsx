import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import { auth } from './firebaseConfig'; // Importer auth
import { onAuthStateChanged, User } from 'firebase/auth'; // Importer onAuthStateChanged et User
import './App.css'; // Assure-toi que ce fichier existe si tu veux l'utiliser

function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loadingAuthState, setLoadingAuthState] = useState<boolean>(true);

  useEffect(() => {
    // Observer les changements d'état d'authentification
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoadingAuthState(false);
    });

    // Nettoyer l'abonnement lors du démontage du composant
    return () => unsubscribe();
  }, []);

  // Afficher un indicateur de chargement pendant que l'état d'auth est vérifié
  if (loadingAuthState) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <p className="text-gray-700">Chargement de l'application...</p>
        {/* Tu peux ajouter un spinner ou un indicateur plus sophistiqué ici */}
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route 
          path="/login" 
          element={!currentUser ? <LoginPage /> : <Navigate to="/dashboard" replace />}
        />
        <Route 
          path="/dashboard" 
          element={currentUser ? <DashboardPage /> : <Navigate to="/login" replace />}
        />
        {/* Route pour la réinitialisation de mot de passe - accessible par tous */}
        <Route 
          path="/reset-password" 
          element={<ResetPasswordPage />}
        />
        {/* Redirection par défaut */}
        <Route 
          path="*" 
          element={<Navigate to={currentUser ? "/dashboard" : "/login"} replace />}
        />
      </Routes>
    </Router>
  );
}

export default App;
