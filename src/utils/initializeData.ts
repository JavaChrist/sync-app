import { collection, query, getDocs, addDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';

/**
 * Initialise les données de base dans Firestore si elles n'existent pas déjà
 * @param userId ID de l'utilisateur connecté (pour définir comme créateur)
 * @returns Promise<void>
 */
export const initializeDefaultFolders = async (userId: string): Promise<void> => {
  try {
    console.log('Vérification des dossiers existants...');
    // Vérifier si des dossiers existent déjà
    const foldersQuery = query(collection(db, 'dossiers'));
    const foldersSnapshot = await getDocs(foldersQuery);
    
    console.log(`Nombre de dossiers trouvés: ${foldersSnapshot.size}`);
    
    // Si aucun dossier n'existe, créer les dossiers par défaut
    if (foldersSnapshot.empty) {
      console.log('Création des dossiers par défaut...');
      
      // Liste des dossiers par défaut à créer
      const defaultFolders = [
        { nom: '#ecycle', path: '#ecycle', niveau: 1, parent: null, ordre: 1 },
        { nom: '1 - Expertise', path: '1 - Expertise', niveau: 1, parent: null, ordre: 2 },
        { nom: '2 - Gestion technique', path: '2 - Gestion technique', niveau: 1, parent: null, ordre: 3 },
        { nom: '3 - Gestion technique expertise', path: '3 - Gestion technique expertise', niveau: 1, parent: null, ordre: 4 }
      ];
      
      try {
        // Créer chaque dossier
        for (const folder of defaultFolders) {
          console.log(`Création du dossier: ${folder.nom}`);
          await addDoc(collection(db, 'dossiers'), {
            ...folder,
            dateCreation: new Date(),
            creePar: userId
          });
        }
        console.log('Dossiers par défaut créés avec succès !');
      } catch (folderError) {
        console.error('Erreur lors de la création des dossiers:', folderError);
        throw folderError;
      }
      
      return;
    }
    
    console.log('Des dossiers existent déjà, aucune initialisation nécessaire.');
  } catch (error) {
    console.error('Erreur lors de l\'initialisation des dossiers par défaut:', error);
    throw new Error('Impossible d\'initialiser les données par défaut.');
  }
}; 