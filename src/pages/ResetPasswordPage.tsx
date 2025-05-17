import React, { useEffect, useState } from 'react';
import { initializeApp } from "firebase/app";
import { getAuth, verifyPasswordResetCode, confirmPasswordReset, signOut } from "firebase/auth";
import { useNavigate } from 'react-router-dom';

// Helper function to get query parameter by name
function getParameterByName(name: string, url = window.location.href): string | null {
    name = name.replace(/[\[\]]/g, '\\$&');
    const regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)'),
        results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, ' '));
}

const ResetPasswordPage: React.FC = () => {
    const [status, setStatus] = useState<'loading' | 'form' | 'success' | 'error'>('loading');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [newPassword, setNewPassword] = useState<string>('');
    const [confirmPassword, setConfirmPassword] = useState<string>('');
    const [accountEmail, setAccountEmail] = useState<string | null>(null);
    const [passwordError, setPasswordError] = useState<string | null>(null);
    const navigate = useNavigate();

    useEffect(() => {
        const mode = getParameterByName('mode');
        const actionCode = getParameterByName('oobCode');
        const apiKey = getParameterByName('apiKey') || process.env.REACT_APP_FIREBASE_API_KEY;
        const lang = getParameterByName('lang') || 'fr';

        // Si l'utilisateur vient de la page Firebase par défaut, on récupère le code depuis l'URL précédente
        const fromFirebasePage = window.location.href.includes('continueUrl');
        if (fromFirebasePage) {
            // Redirection vers notre page avec les paramètres corrects
            window.location.href = getParameterByName('continueUrl') + 
                '?mode=' + getParameterByName('mode') + 
                '&oobCode=' + getParameterByName('oobCode') + 
                '&apiKey=' + getParameterByName('apiKey') +
                '&lang=' + getParameterByName('lang');
            return;
        }
        
        // Détection du cas où l'utilisateur arrive après une réinitialisation réussie sur la page Firebase
        // (cas où nous n'avons pas de mode ou oobCode, mais c'est un redirectionnement de Firebase après succès)
        const isRedirectAfterSuccess = !mode && !actionCode && window.location.href.includes('reset-password');
        if (isRedirectAfterSuccess) {
            // On affiche directement un message de succès plutôt qu'une erreur
            setStatus('success');
            return;
        }

        // Basic validation
        if (mode !== 'resetPassword' || !actionCode) {
            setStatus('error');
            setErrorMessage('Paramètres de requête invalides ou manquants.');
            return;
        }

        // Initialize Firebase if needed (use your existing Firebase config)
        const firebaseConfig = {
            apiKey: apiKey || process.env.REACT_APP_FIREBASE_API_KEY,
            // Add other config values if needed
            // These can be omitted if your app is already initialized elsewhere
        };

        let app;
        try {
            app = initializeApp(firebaseConfig);
        } catch (e) {
            // App already initialized, use the existing one
        }

        const auth = getAuth();
        auth.languageCode = lang;

        // Verify the action code
        verifyPasswordResetCode(auth, actionCode)
            .then((email) => {
                setAccountEmail(email);
                setStatus('form');
            })
            .catch((error) => {
                console.error("Erreur de vérification du code:", error);
                setStatus('error');
                setErrorMessage("Ce lien est invalide ou a expiré. Veuillez demander un nouveau lien de réinitialisation.");
            });
    }, []);

    const handlePasswordReset = async (event: React.FormEvent) => {
        event.preventDefault();
        setPasswordError(null);

        // Validate passwords
        if (newPassword !== confirmPassword) {
            setPasswordError("Les mots de passe ne correspondent pas.");
            return;
        }

        if (newPassword.length < 8) {
            setPasswordError("Le mot de passe doit contenir au moins 8 caractères.");
            return;
        }

        const actionCode = getParameterByName('oobCode');
        if (!actionCode) {
            setErrorMessage("Code d'action manquant.");
            setStatus('error');
            return;
        }

        const auth = getAuth();
        
        try {
            await confirmPasswordReset(auth, actionCode, newPassword);
            setStatus('success');
        } catch (error: any) {
            console.error("Erreur lors de la réinitialisation du mot de passe:", error);
            setStatus('error');
            setErrorMessage(error.message || "Une erreur est survenue lors de la réinitialisation du mot de passe.");
        }
    };

    const handleBackToLogin = async () => {
        // Déconnecter l'utilisateur actuel s'il y en a un
        try {
            const auth = getAuth();
            if (auth.currentUser) {
                await signOut(auth);
            }
        } catch (error) {
            console.error("Erreur lors de la déconnexion:", error);
        }
        
        // Forcer la redirection vers la page de login
        window.location.href = '/login';
    };

    // Loading state
    if (status === 'loading') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100">
                <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
                    <h1 className="text-2xl font-bold mb-6 text-center text-gray-700">Chargement...</h1>
                    <div className="flex justify-center">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gray-900"></div>
                    </div>
                </div>
            </div>
        );
    }

    // Error state
    if (status === 'error') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100">
                <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
                    <h1 className="text-2xl font-bold mb-6 text-center text-red-600">Erreur</h1>
                    <p className="text-gray-700 mb-6 text-center">{errorMessage}</p>
                    <button
                        onClick={handleBackToLogin}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                    >
                        Retour à la page de connexion
                    </button>
                </div>
            </div>
        );
    }

    // Success state
    if (status === 'success') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100">
                <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
                    <h1 className="text-2xl font-bold mb-6 text-center text-green-600">Mot de passe réinitialisé !</h1>
                    <p className="text-gray-700 mb-6 text-center">
                        Votre mot de passe a été mis à jour avec succès. Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.
                    </p>
                    <button
                        onClick={handleBackToLogin}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                    >
                        Se connecter
                    </button>
                </div>
            </div>
        );
    }

    // Form state (default)
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
            <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
                <h1 className="text-2xl font-bold mb-6 text-center text-gray-700">Réinitialisation du mot de passe</h1>
                {accountEmail && (
                    <p className="mb-6 text-gray-600 text-center">
                        Pour le compte: <span className="font-medium">{accountEmail}</span>
                    </p>
                )}
                <form onSubmit={handlePasswordReset}>
                    <div className="mb-4">
                        <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">
                            Nouveau mot de passe
                        </label>
                        <input
                            type="password"
                            id="newPassword"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            required
                            minLength={8}
                        />
                    </div>
                    <div className="mb-6">
                        <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                            Confirmer le mot de passe
                        </label>
                        <input
                            type="password"
                            id="confirmPassword"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            required
                        />
                    </div>
                    
                    {passwordError && <p className="text-red-500 text-sm mb-4 text-center">{passwordError}</p>}
                    
                    <button
                        type="submit"
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                    >
                        Réinitialiser le mot de passe
                    </button>
                </form>
            </div>
        </div>
    );
};

export default ResetPasswordPage; 