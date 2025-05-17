import React, { useState, useEffect } from 'react';
import { db, storage } from '../firebaseConfig';
import { collection, query, where, getDocs, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import Breadcrumb from '../components/Breadcrumb';
import FolderList from '../components/FolderList';
import FileList from '../components/FileList';
import SearchBar from '../components/SearchBar';
import { FolderType, FileType } from '../types/documentTypes';
import UploadButton from '../components/UploadButton';

interface FileExplorerProps {
  userId: string;
}

type SortField = 'nom' | 'type' | 'taille' | 'dateUpload';
type SortDirection = 'asc' | 'desc';
type ViewMode = 'list' | 'grid';

const FileExplorer: React.FC<FileExplorerProps> = ({ userId }) => {
  const [currentPath, setCurrentPath] = useState<string>('');
  const [breadcrumbItems, setBreadcrumbItems] = useState<{ id: string; name: string; path: string }[]>([]);
  const [folders, setFolders] = useState<FolderType[]>([]);
  const [files, setFiles] = useState<FileType[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  const [error, setError] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<FileType[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [sortField, setSortField] = useState<SortField>('nom');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  // Fonction pour charger les dossiers et fichiers du chemin actuel
  useEffect(() => {
    const loadFoldersAndFiles = async () => {
      setIsLoading(true);
      setError('');

      try {
        // Charger les dossiers
        const foldersQuery = query(
          collection(db, 'dossiers'),
          where('parent', '==', currentPath || null)
          // Temporairement commenté en attendant que les index soient construits
          // orderBy('ordre', 'asc')
        );
        const foldersSnapshot = await getDocs(foldersQuery);
        const foldersData = foldersSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as FolderType));
        // Tri côté client pour remplacer le orderBy temporairement désactivé
        foldersData.sort((a, b) => a.ordre - b.ordre);
        setFolders(foldersData);

        // Charger les fichiers
        const filesQuery = query(
          collection(db, 'fichiers'),
          where('dossierId', '==', currentPath || 'root')
        );
        const filesSnapshot = await getDocs(filesQuery);
        const filesData = filesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as FileType));
        setFiles(filesData);

        // Mettre à jour le fil d'Ariane
        if (currentPath) {
          const pathParts = currentPath.split('/');
          let cumulativePath = '';
          const items = await Promise.all(
            pathParts.map(async (part, index) => {
              cumulativePath = index === 0 ? part : `${cumulativePath}/${part}`;
              // Rechercher les informations du dossier par son chemin
              const folderSnap = await getDocs(query(collection(db, 'dossiers'), where('path', '==', cumulativePath)));
              const folderData = folderSnap.docs[0]?.data();
              return { 
                id: part, 
                name: folderData?.nom || part, 
                path: cumulativePath 
              };
            })
          );
          setBreadcrumbItems([{ id: 'root', name: 'Accueil', path: '' }, ...items]);
        } else {
          setBreadcrumbItems([{ id: 'root', name: 'Accueil', path: '' }]);
        }
      } catch (err) {
        console.error('Erreur lors du chargement des dossiers et fichiers:', err);
        setError('Impossible de charger les données. Veuillez réessayer plus tard.');
      } finally {
        setIsLoading(false);
      }
    };

    loadFoldersAndFiles();
  }, [currentPath]);

  // Fonction pour trier les fichiers
  const sortFiles = (filesToSort: FileType[]): FileType[] => {
    return [...filesToSort].sort((a, b) => {
      // Gérer les valeurs potentiellement undefined
      const aValue = a[sortField] || '';
      const bValue = b[sortField] || '';
      
      // Traitement spécial pour les dates
      if (sortField === 'dateUpload') {
        const dateA = aValue instanceof Date ? aValue : new Date(aValue);
        const dateB = bValue instanceof Date ? bValue : new Date(bValue);
        return sortDirection === 'asc' 
          ? dateA.getTime() - dateB.getTime()
          : dateB.getTime() - dateA.getTime();
      }
      
      // Tri numérique pour la taille
      if (sortField === 'taille') {
        return sortDirection === 'asc' 
          ? Number(aValue) - Number(bValue)
          : Number(bValue) - Number(aValue);
      }
      
      // Tri alphabétique pour le reste
      const strA = String(aValue).toLowerCase();
      const strB = String(bValue).toLowerCase();
      
      return sortDirection === 'asc'
        ? strA.localeCompare(strB)
        : strB.localeCompare(strA);
    });
  };

  // Fonction pour naviguer vers un dossier
  const handleFolderClick = (folder: FolderType) => {
    setCurrentPath(folder.path);
  };

  // Fonction pour revenir au dossier parent
  const handleBreadcrumbClick = (path: string) => {
    setCurrentPath(path);
  };

  // Fonction pour changer le mode d'affichage
  const toggleViewMode = () => {
    setViewMode(prev => prev === 'list' ? 'grid' : 'list');
  };

  // Fonction pour changer le tri
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Si on clique sur le même champ, inverser la direction
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      // Sinon, changer le champ et réinitialiser la direction
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Fonction pour créer un nouveau dossier
  const handleCreateFolder = async (folderName: string) => {
    try {
      setError(''); // Réinitialiser les erreurs

      // Déterminer le niveau et le chemin
      const level = currentPath ? currentPath.split('/').length + 1 : 1;
      let path = folderName;
      if (currentPath) {
        path = `${currentPath}/${folderName}`;
      }

      // Au lieu d'utiliser orderBy, nous allons simplement compter les dossiers existants
      // et utiliser ce nombre comme ordre pour le nouveau dossier
      const existingFoldersQuery = query(
        collection(db, 'dossiers'),
        where('parent', '==', currentPath || null)
      );
      const existingFoldersSnapshot = await getDocs(existingFoldersQuery);
      const newOrder = existingFoldersSnapshot.size + 1;

      console.log(`Création de dossier: ${folderName}, Chemin: ${path}, Niveau: ${level}, Ordre: ${newOrder}`);

      // Créer le dossier dans Firestore
      const newFolderRef = await addDoc(collection(db, 'dossiers'), {
        nom: folderName,
        path,
        niveau: level,
        parent: currentPath || null,
        ordre: newOrder,
        dateCreation: new Date(),
        creePar: userId
      });

      console.log(`Dossier créé avec ID: ${newFolderRef.id}`);

      // Mettre à jour la liste des dossiers sans utiliser orderBy
      const foldersQuery = query(
        collection(db, 'dossiers'),
        where('parent', '==', currentPath || null)
      );
      const foldersSnapshot = await getDocs(foldersQuery);
      const foldersData = foldersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as FolderType));
      
      // Tri côté client pour remplacer orderBy
      foldersData.sort((a, b) => a.ordre - b.ordre);
      setFolders(foldersData);
      
    } catch (err) {
      console.error('Erreur lors de la création du dossier:', err);
      setError('Impossible de créer le dossier. Veuillez réessayer plus tard.');
    }
  };

  // Fonction pour uploader un fichier
  const handleFileUpload = async (file: File) => {
    try {
      setError(''); // Réinitialiser les erreurs précédentes
      
      // Vérification de la taille (limite à 50 Mo pour éviter les problèmes)
      const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 Mo en octets
      if (file.size > MAX_FILE_SIZE) {
        setError(`Le fichier ${file.name} dépasse la limite de 50 Mo. Veuillez choisir un fichier plus petit.`);
        return;
      }

      // Log pour débogage
      console.log(`Début d'upload du fichier ${file.name}, taille: ${file.size} octets, type: ${file.type}`);
      
      // Créer une référence de stockage unique
      const fileName = Date.now() + '_' + file.name.replace(/[^a-zA-Z0-9.-]/g, '_'); // Sanitize le nom de fichier
      const fileType = file.name.split('.').pop()?.toLowerCase() || '';
      const storageRef = ref(storage, `files/${currentPath || 'root'}/${fileName}`);
      
      // Commencer l'upload
      const uploadTask = uploadBytesResumable(storageRef, file);
      
      // Suivre la progression
      uploadTask.on('state_changed', 
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          console.log(`Progression de l'upload pour ${file.name}: ${progress.toFixed(1)}%`);
          setUploadProgress(prev => ({ ...prev, [file.name]: progress }));
        },
        (error) => {
          console.error('Erreur d\'upload détaillée:', error);
          
          // Déterminer un message d'erreur plus spécifique
          let errorMessage = `Erreur lors de l'upload de ${file.name}`;
          
          // Traiter les erreurs courantes de Firebase Storage
          if (error.code === 'storage/unauthorized') {
            errorMessage += ": Vous n'avez pas l'autorisation d'accéder à ce dossier.";
          } else if (error.code === 'storage/canceled') {
            errorMessage += ": L'upload a été annulé.";
          } else if (error.code === 'storage/unknown') {
            errorMessage += ": Une erreur inconnue s'est produite. Vérifiez votre connexion internet.";
          } else if (error.code === 'storage/retry-limit-exceeded') {
            errorMessage += ": Limite de tentatives dépassée. Vérifiez votre connexion internet.";
          } else if (error.message) {
            // Si un message d'erreur spécifique est disponible, l'afficher
            errorMessage += `: ${error.message}`;
          }
          
          setError(errorMessage);
          setUploadProgress(prev => ({ ...prev, [file.name]: 0 }));
        },
        async () => {
          try {
            console.log(`Upload réussi pour ${file.name}, obtention de l'URL...`);
            // Upload terminé avec succès, obtenir l'URL de téléchargement
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            
            console.log(`URL obtenue: ${downloadURL}, enregistrement dans Firestore...`);
            // Ajouter les informations du fichier à Firestore
            await addDoc(collection(db, 'fichiers'), {
              nom: file.name,
              type: fileType,
              taille: file.size,
              dossierId: currentPath || 'root',
              cheminStockage: storageRef.fullPath,
              dateUpload: new Date(),
              uploadPar: userId,
              url: downloadURL
            });
            
            console.log(`Fichier ${file.name} enregistré avec succès dans Firestore.`);
            
            // Mettre à jour la liste des fichiers
            const filesQuery = query(
              collection(db, 'fichiers'),
              where('dossierId', '==', currentPath || 'root')
            );
            const filesSnapshot = await getDocs(filesQuery);
            const filesData = filesSnapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            } as FileType));
            setFiles(filesData);
            
            // Nettoyer la progression
            setUploadProgress(prev => {
              const newProgress = { ...prev };
              delete newProgress[file.name];
              return newProgress;
            });
          } catch (completeError) {
            console.error('Erreur lors de la finalisation de l\'upload:', completeError);
            setError(`Erreur lors de la finalisation de l'upload de ${file.name}. Le fichier a été téléchargé mais n'a pas pu être enregistré.`);
            setUploadProgress(prev => ({ ...prev, [file.name]: 0 }));
          }
        }
      );
    } catch (err) {
      console.error('Erreur initiale lors de l\'upload du fichier:', err);
      setError(`Impossible d'uploader ${file.name}. Veuillez réessayer plus tard.`);
    }
  };

  // Fonction pour télécharger un fichier
  const handleFileDownload = (file: FileType) => {
    window.open(file.url, '_blank');
  };

  // Fonction pour supprimer un fichier
  const handleFileDelete = async (file: FileType) => {
    try {
      // Supprimer le fichier du stockage Firebase
      const storageReference = ref(storage, file.cheminStockage);
      await deleteObject(storageReference);
      
      // Supprimer l'entrée de la base de données
      await deleteDoc(doc(db, 'fichiers', file.id));
      
      // Mettre à jour la liste des fichiers
      setFiles(files.filter(f => f.id !== file.id));
    } catch (err) {
      console.error('Erreur lors de la suppression du fichier:', err);
      setError('Impossible de supprimer le fichier. Veuillez réessayer plus tard.');
    }
  };

  // Fonction pour supprimer un dossier
  const handleFolderDelete = async (folder: FolderType) => {
    try {
      // Vérifier si le dossier contient des fichiers ou sous-dossiers
      const filesQuery = query(collection(db, 'fichiers'), where('dossierId', '==', folder.path));
      const filesSnapshot = await getDocs(filesQuery);
      
      const subFoldersQuery = query(collection(db, 'dossiers'), where('parent', '==', folder.path));
      const subFoldersSnapshot = await getDocs(subFoldersQuery);
      
      if (!filesSnapshot.empty || !subFoldersSnapshot.empty) {
        setError('Impossible de supprimer un dossier non vide.');
        return;
      }
      
      // Supprimer le dossier
      await deleteDoc(doc(db, 'dossiers', folder.id));
      
      // Mettre à jour la liste des dossiers
      setFolders(folders.filter(f => f.id !== folder.id));
    } catch (err) {
      console.error('Erreur lors de la suppression du dossier:', err);
      setError('Impossible de supprimer le dossier. Veuillez réessayer plus tard.');
    }
  };

  // Fonction pour renommer un dossier
  const handleFolderRename = (folder: FolderType) => {
    // Utiliser une prompt pour obtenir le nouveau nom (à remplacer par un modal plus élégant à l'avenir)
    const newName = prompt('Entrez le nouveau nom du dossier:', folder.nom);
    
    if (!newName || newName === folder.nom) {
      return; // L'utilisateur a annulé ou n'a pas changé le nom
    }
    
    // Mettre à jour le dossier
    updateFolder(folder, newName);
  };
  
  // Fonction pour mettre à jour un dossier dans Firestore
  const updateFolder = async (folder: FolderType, newName: string) => {
    try {
      setError('');
      
      // Calculer le nouveau chemin (path)
      let newPath = newName;
      if (folder.parent) {
        // Si c'est un sous-dossier, conserver le chemin parent et mettre à jour uniquement le dernier segment
        const pathParts = folder.path.split('/');
        pathParts[pathParts.length - 1] = newName;
        newPath = pathParts.join('/');
      }
      
      console.log(`Renommage du dossier: ${folder.nom} -> ${newName}, Nouveau chemin: ${newPath}`);
      
      // Mettre à jour le document dans Firestore
      const folderRef = doc(db, 'dossiers', folder.id);
      await updateDoc(folderRef, {
        nom: newName,
        path: newPath
      });
      
      console.log('Dossier renommé avec succès!');
      
      // Mettre à jour les fichiers qui se trouvent dans ce dossier
      if (folder.path !== newPath) {
        const filesQuery = query(
          collection(db, 'fichiers'),
          where('dossierId', '==', folder.path)
        );
        const filesSnapshot = await getDocs(filesQuery);
        
        // Mettre à jour le dossierId de chaque fichier
        const updatePromises = filesSnapshot.docs.map(fileDoc => {
          return updateDoc(doc(db, 'fichiers', fileDoc.id), {
            dossierId: newPath
          });
        });
        
        if (updatePromises.length > 0) {
          await Promise.all(updatePromises);
          console.log(`${updatePromises.length} fichiers mis à jour.`);
        }
      }
      
      // Mettre à jour les sous-dossiers
      const subFoldersQuery = query(
        collection(db, 'dossiers'),
        where('parent', '==', folder.path)
      );
      const subFoldersSnapshot = await getDocs(subFoldersQuery);
      
      const subFolderUpdatePromises = subFoldersSnapshot.docs.map(subFolderDoc => {
        const subFolderData = subFolderDoc.data() as FolderType;
        const newSubFolderPath = subFolderData.path.replace(folder.path, newPath);
        
        return updateDoc(doc(db, 'dossiers', subFolderDoc.id), {
          parent: newPath,
          path: newSubFolderPath
        });
      });
      
      if (subFolderUpdatePromises.length > 0) {
        await Promise.all(subFolderUpdatePromises);
        console.log(`${subFolderUpdatePromises.length} sous-dossiers mis à jour.`);
      }
      
      // Recharger les dossiers
      const refreshQuery = query(
        collection(db, 'dossiers'),
        where('parent', '==', currentPath || null)
      );
      const refreshSnapshot = await getDocs(refreshQuery);
      const refreshData = refreshSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as FolderType));
      
      // Tri côté client pour remplacer orderBy
      refreshData.sort((a, b) => a.ordre - b.ordre);
      setFolders(refreshData);
      
    } catch (err) {
      console.error('Erreur lors du renommage du dossier:', err);
      setError('Impossible de renommer le dossier. Veuillez réessayer plus tard.');
    }
  };

  // Fonction pour effectuer une recherche de fichiers
  const handleSearch = async (query: string) => {
    // Si on efface la recherche
    if (!query) {
      setIsSearching(false);
      setSearchResults([]);
      return;
    }
    
    // Définir d'abord l'état de recherche
    const wasSearching = isSearching;
    setIsSearching(true);
    
    // Ne mettre isLoading à true que si on n'était pas déjà en recherche
    if (!wasSearching) {
      setIsLoading(true);
    }
    
    try {
      // Récupérer tous les fichiers de la base de données
      const filesRef = collection(db, 'fichiers');
      const filesSnapshot = await getDocs(filesRef);
      
      // Convertir les données en objets FileType
      const allFiles = filesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as FileType));
      
      // Filtrer les fichiers selon le terme de recherche (insensible à la casse)
      const queryLower = query.toLowerCase();
      const filteredFiles = allFiles.filter(file => 
        file.nom.toLowerCase().includes(queryLower)
      );
      
      setSearchResults(filteredFiles);
    } catch (err) {
      console.error('Erreur lors de la recherche:', err);
      setError('Impossible d\'effectuer la recherche. Veuillez réessayer plus tard.');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Fonction pour effacer la recherche et revenir à la navigation normale
  const clearSearch = () => {
    setIsSearching(false);
    setSearchResults([]);
    setSearchQuery('');
  };

  // Appliquer le tri aux fichiers affichés
  const displayedFiles = isSearching ? sortFiles(searchResults) : sortFiles(files);

  return (
    <div className="bg-white dark:bg-gray-700 p-6 rounded-lg shadow-md">
      {error && <div className="mb-4 p-3 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 rounded">{error}</div>}
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
        {/* Barre de recherche */}
        <div className="w-full sm:w-auto mb-4 sm:mb-0">
          <SearchBar 
            onSearch={(query) => {
              setSearchQuery(query);
              handleSearch(query);
            }}
            placeholder="Rechercher des fichiers..."
          />
        </div>
        
        {/* Boutons d'action */}
        <div className="flex space-x-2">
          <button
            onClick={toggleViewMode}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 flex items-center"
            title={viewMode === 'list' ? 'Vue grille' : 'Vue liste'}
          >
            {viewMode === 'list' ? (
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path>
              </svg>
            ) : (
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16"></path>
              </svg>
            )}
            {viewMode === 'list' ? 'Vue grille' : 'Vue liste'}
          </button>
          
          <NewFolderButton onCreateFolder={handleCreateFolder} />
          <UploadButton onFileUpload={handleFileUpload} />
        </div>
      </div>
      
      {/* Fil d'Ariane et titre de la section - caché en mode recherche */}
      {!isSearching && (
        <>
          <Breadcrumb items={breadcrumbItems} onItemClick={handleBreadcrumbClick} />
          
          <div className="flex justify-between mb-4 mt-6">
            <div className="flex items-center">
              {/* Bouton de retour - visible uniquement si on n'est pas à la racine */}
              {currentPath && (
                <button
                  onClick={() => {
                    // Extraire le chemin parent
                    const pathParts = currentPath.split('/');
                    pathParts.pop(); // Retirer le dernier segment
                    const parentPath = pathParts.join('/');
                    setCurrentPath(parentPath);
                  }}
                  className="mr-4 px-3 py-1.5 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-500 flex items-center"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 15l-3-3m0 0l3-3m-3 3h8M3 12a9 9 0 1118 0 9 9 0 01-18 0z"></path>
                  </svg>
                  Retour
                </button>
              )}
              <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
                {currentPath ? breadcrumbItems[breadcrumbItems.length - 1]?.name : 'Accueil'}
              </h2>
            </div>
          </div>
        </>
      )}
      
      {/* Options de tri */}
      {!isLoading && (displayedFiles.length > 0) && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-sm text-gray-600 dark:text-gray-400">Trier par:</span>
          <button 
            onClick={() => handleSort('nom')}
            className={`px-3 py-1 text-sm rounded ${
              sortField === 'nom' 
                ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' 
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            Nom {sortField === 'nom' && (sortDirection === 'asc' ? '↑' : '↓')}
          </button>
          <button 
            onClick={() => handleSort('type')}
            className={`px-3 py-1 text-sm rounded ${
              sortField === 'type' 
                ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' 
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            Type {sortField === 'type' && (sortDirection === 'asc' ? '↑' : '↓')}
          </button>
          <button 
            onClick={() => handleSort('taille')}
            className={`px-3 py-1 text-sm rounded ${
              sortField === 'taille' 
                ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' 
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            Taille {sortField === 'taille' && (sortDirection === 'asc' ? '↑' : '↓')}
          </button>
          <button 
            onClick={() => handleSort('dateUpload')}
            className={`px-3 py-1 text-sm rounded ${
              sortField === 'dateUpload' 
                ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' 
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            Date {sortField === 'dateUpload' && (sortDirection === 'asc' ? '↑' : '↓')}
          </button>
        </div>
      )}
      
      {/* Affichage du titre de recherche si en mode recherche */}
      {isSearching && (
        <div className="mb-4 mt-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
              Résultats de recherche pour "{searchQuery}"
            </h2>
            <button
              onClick={clearSearch}
              className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm font-medium"
            >
              Revenir à la navigation
            </button>
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            {searchResults.length} fichier(s) trouvé(s)
          </p>
        </div>
      )}
      
      {isLoading ? (
        <div className="flex justify-center items-center h-40">
          <p className="text-gray-500 dark:text-gray-400">Chargement...</p>
        </div>
      ) : (
        <>
          {/* Afficher les dossiers uniquement en mode navigation normale */}
          {!isSearching && (
            <FolderList 
              folders={folders} 
              onFolderClick={handleFolderClick} 
              onFolderDelete={handleFolderDelete} 
              onFolderRename={handleFolderRename}
            />
          )}
          
          {/* En mode recherche, afficher les résultats de recherche */}
          {isSearching ? (
            <FileList 
              files={displayedFiles}
              uploadProgress={{}}
              onFileDownload={handleFileDownload}
              onFileDelete={handleFileDelete}
              viewMode={viewMode}
            />
          ) : (
            <FileList 
              files={displayedFiles}
              uploadProgress={uploadProgress}
              onFileDownload={handleFileDownload}
              onFileDelete={handleFileDelete}
              viewMode={viewMode}
            />
          )}
        </>
      )}
    </div>
  );
};

// Composant pour le bouton de création de dossier
const NewFolderButton: React.FC<{ onCreateFolder: (name: string) => void }> = ({ onCreateFolder }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [folderName, setFolderName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (folderName.trim()) {
      onCreateFolder(folderName.trim());
      setFolderName('');
      setIsModalOpen(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center"
      >
        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
        </svg>
        Nouveau dossier
      </button>

      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4 dark:text-white">Créer un nouveau dossier</h3>
            <form onSubmit={handleSubmit}>
              <input
                type="text"
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                placeholder="Nom du dossier"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                autoFocus
              />
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-white"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Créer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default FileExplorer; 