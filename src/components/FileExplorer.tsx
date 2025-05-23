import React, { useState, useEffect } from 'react';
import { db, storage } from '../firebaseConfig';
import { collection, query, where, getDocs, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { FolderType, FileType } from '../types/documentTypes';
import CameraCapture from './CameraCapture';
import CommentPanel from '../components/CommentPanel';

interface FileExplorerProps {
  userId: string;
}

type SortField = 'nom' | 'type' | 'taille' | 'dateUpload';
type SortDirection = 'asc' | 'desc';
type ViewMode = 'list' | 'grid';

const FileExplorer: React.FC<FileExplorerProps> = ({ userId }) => {
  const [currentPath, setCurrentPath] = useState<string>('');
  const [folders, setFolders] = useState<FolderType[]>([]);
  const [files, setFiles] = useState<FileType[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<FileType[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [sortField, setSortField] = useState<SortField>('nom');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [showCamera, setShowCamera] = useState(false);
  const [createFolderModalOpen, setCreateFolderModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<FileType | null>(null);
  const [showComments, setShowComments] = useState<boolean>(false);
  const [folderToDelete, setFolderToDelete] = useState<FolderType | null>(null);
  const [showDeleteFolderConfirm, setShowDeleteFolderConfirm] = useState(false);
  const [showPdfViewer, setShowPdfViewer] = useState<boolean>(false);

  // Fonction pour formater la taille des fichiers
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Fonction pour formater la date
  const formatDate = (dateValue: any): string => {
    if (!dateValue) return 'N/A';
    
    let date;
    if (dateValue instanceof Date) {
      date = dateValue;
    } else {
      date = new Date(dateValue);
    }
    
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Fonction pour charger les dossiers et fichiers du chemin actuel
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

      // Suppression du code relatif à breadcrumbItems
    } catch (err) {
      console.error('Erreur lors du chargement des dossiers et fichiers:', err);
      setError('Impossible de charger les données. Veuillez réessayer plus tard.');
    } finally {
      setIsLoading(false);
    }
  };

  // Fonction pour afficher les commentaires d'un fichier
  const handleShowFileComments = (file: FileType) => {
    setSelectedFile(file);
    setShowComments(true);
  };

  // Effet pour charger les dossiers et fichiers
  useEffect(() => {
    loadFoldersAndFiles();
  }, [currentPath]);

  // Ajout d'un effet pour la recherche automatique après un délai
  useEffect(() => {
    if (!searchQuery.trim()) {
      // Si la recherche est vide, réinitialiser
      if (isSearching) {
        clearSearch();
      }
      return;
    }

    // Attendre 500ms après que l'utilisateur ait arrêté de taper pour lancer la recherche
    const searchTimeout = setTimeout(() => {
      handleSearch(searchQuery);
    }, 500);

    // Nettoyer le timeout si l'utilisateur continue à taper
    return () => clearTimeout(searchTimeout);
  }, [searchQuery]);

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
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) return;
    
    const file = event.target.files[0];
    
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
              dateCreation: new Date(), // Ajouté pour résoudre l'erreur dateCreation
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
          } catch (completeError) {
            console.error('Erreur lors de la finalisation de l\'upload:', completeError);
            setError(`Erreur lors de la finalisation de l'upload de ${file.name}. Le fichier a été téléchargé mais n'a pas pu être enregistré.`);
          }
        }
      );
    } catch (err) {
      console.error('Erreur initiale lors de l\'upload du fichier:', err);
      setError(`Impossible d'uploader ${file.name}. Veuillez réessayer plus tard.`);
    }
  };

  // Fonction pour télécharger un fichier
  const handleDownloadFile = (file: FileType) => {
    // Si c'est un PDF, l'afficher dans un conteneur avec un bouton de fermeture
    if (file.type?.toLowerCase() === 'pdf' || file.nom.toLowerCase().endsWith('.pdf')) {
      // Stocker les informations du fichier pour l'affichage intégré
      setSelectedFile(file);
      setShowPdfViewer(true);
    } else {
      // Pour les autres types de fichiers, ouvrir dans un nouvel onglet comme avant
      window.open(file.url, '_blank');
    }
  };

  // Fonction pour supprimer un fichier
  const handleDeleteFile = async (file: FileType) => {
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
  const handleDeleteFolder = async (folder: FolderType) => {
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
  const handleRenameFolder = (folder: FolderType) => {
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
    if (!query.trim()) {
      clearSearch();
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
      const queryLower = query.toLowerCase().trim();
      const filteredFiles = allFiles.filter(file => 
        file.nom.toLowerCase().includes(queryLower)
      );
      
      console.log(`Recherche pour "${query}" : ${filteredFiles.length} résultats trouvés`);
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

  // Fonction pour ouvrir la caméra
  const handleOpenCamera = () => {
    console.log("Ouverture de la caméra...");
    setShowCamera(true);
  };

  // Fonction appelée après le téléversement d'une photo
  const handlePhotoUploaded = () => {
    console.log("Photo téléversée avec succès!");
    // Rafraîchir la liste des fichiers
    loadFoldersAndFiles();
  };

  return (
    <div className="bg-white dark:bg-gray-750 rounded-lg shadow-md overflow-hidden">
      {/* En-tête avec outils */}
      <div className="border-b border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-col md:flex-row md:items-center mb-4">
          {/* Fil d'Ariane */}
          <div className="mb-2 md:mb-0 md:mr-4 text-sm text-gray-600 dark:text-gray-400 flex items-center overflow-x-auto whitespace-nowrap pb-2 md:pb-0">
            <button 
              onClick={() => setCurrentPath('')}
              className="text-blue-600 dark:text-blue-400 hover:underline px-2 py-1 rounded transition-colors"
            >
              Racine
            </button>
            
            {/* Afficher le chemin actuel sous forme de fil d'Ariane */}
            {currentPath && currentPath.split('/').map((segment, index, array) => {
              // Construire le chemin pour ce segment
              const pathToHere = array.slice(0, index + 1).join('/');
              return (
                <div key={index} className="flex items-center">
                  <span className="mx-2 text-gray-400">/</span>
                  <button 
                    onClick={() => handleBreadcrumbClick(pathToHere)}
                    className="text-blue-600 dark:text-blue-400 hover:underline px-2 py-1 rounded transition-colors"
                  >
                    {segment}
                  </button>
                </div>
              );
            })}
          </div>
          
          {/* Boutons d'actions */}
          <div className="flex items-center space-x-2 ml-auto">
            <button 
              onClick={() => setCreateFolderModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm flex items-center"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"></path>
              </svg>
              Nouveau dossier
            </button>
            
            <label className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm flex items-center cursor-pointer">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path>
              </svg>
              Uploader
              <input type="file" className="hidden" onChange={handleFileUpload} />
            </label>
            
            <button 
              onClick={handleOpenCamera}
              className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded text-sm flex items-center"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path>
              </svg>
              Photo
            </button>
            
            <button 
              onClick={toggleViewMode}
              className="bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 px-2 py-1 rounded text-sm"
            >
              {viewMode === 'list' ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16"></path>
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path>
                </svg>
              )}
            </button>
          </div>
        </div>
        
        {/* Barre de recherche */}
        <div className="flex items-center">
          <div className="relative w-full">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
              </svg>
            </div>
            <input
              type="text"
              placeholder="Rechercher des fichiers... (recherche automatique)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  clearSearch();
                }
              }}
              className="w-full pl-10 pr-10 py-2 rounded border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
            {searchQuery && (
              <button
                onClick={clearSearch}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Corps du gestionnaire de fichiers */}
      <div className="p-3 overflow-x-hidden">
        {/* Message d'erreur */}
        {error && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4">
            <p>{error}</p>
          </div>
        )}

        {/* Indicateur de chargement */}
        {isLoading ? (
          <div className="py-10 text-center">
            <p className="text-gray-600 dark:text-gray-400">Chargement...</p>
          </div>
        ) : isSearching ? (
          // Résultats de recherche
          <>
            <h3 className="text-lg font-medium mb-4 text-gray-700 dark:text-gray-300">
              Résultats de recherche pour "{searchQuery}" ({searchResults.length} fichiers)
            </h3>
            
            {searchResults.length === 0 ? (
              <p className="text-gray-600 dark:text-gray-400 italic">Aucun résultat trouvé.</p>
            ) : viewMode === 'list' ? (
              // Affichage en liste des résultats de recherche
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead>
                    <tr>
                      <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('nom')}>
                        Nom {sortField === 'nom' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('type')}>
                        Type {sortField === 'type' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('taille')}>
                        Taille {sortField === 'taille' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('dateUpload')}>
                        Date {sortField === 'dateUpload' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-750 divide-y divide-gray-200 dark:divide-gray-700">
                    {sortFiles(searchResults).map(file => (
                      <tr key={file.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-3 py-3 whitespace-nowrap">
                          <a 
                            href={file.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            {file.nom}
                          </a>
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{file.type || 'Inconnu'}</td>
                        <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{formatFileSize(file.taille)}</td>
                        <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{formatDate(file.dateUpload)}</td>
                        <td className="px-3 py-3 whitespace-nowrap text-sm font-medium space-x-1 flex">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleShowFileComments(file);
                            }}
                            className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                            </svg>
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownloadFile(file);
                            }}
                            className="text-green-600 dark:text-green-400 hover:text-green-900 dark:hover:text-green-300"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteFile(file);
                            }}
                            className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              // Affichage en grille des résultats de recherche
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {sortFiles(searchResults).map((file) => (
                  <div key={file.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md border border-gray-200 dark:border-gray-700 p-4 flex flex-col items-center relative group">
                    <svg className="w-10 h-10 text-blue-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    <a
                      href={file.url}
                      className="text-sm font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 text-center truncate w-full"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {file.nom}
                    </a>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {formatFileSize(file.taille)}
                    </p>
                    <div className="flex mt-2 space-x-2">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleShowFileComments(file);
                        }}
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300"
                        title="Voir les commentaires"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                        </svg>
                      </button>
                      
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownloadFile(file);
                        }}
                        className="text-green-600 dark:text-green-400 hover:text-green-900 dark:hover:text-green-300"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteFile(file);
                        }}
                        className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          // Vue normale des dossiers et fichiers
          <>
            {folders.length === 0 && files.length === 0 ? (
              <div className="text-center py-12">
                <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
                </svg>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Aucun fichier ou dossier</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Commencez par créer un dossier ou téléverser un fichier.
                </p>
              </div>
            ) : (
              viewMode === 'list' ? (
                <div className="min-w-full overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-800">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Nom
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden sm:table-cell">
                          Type
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden md:table-cell">
                          Taille
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden lg:table-cell">
                          Date
                        </th>
                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
                      {/* Dossiers */}
                      {folders.map((folder) => (
                        <tr key={folder.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                          <td className="px-3 py-2 sm:px-6 sm:py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <svg className="flex-shrink-0 h-5 w-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                                <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                              </svg>
                              <span 
                                className="ml-2 text-sm font-medium text-gray-900 dark:text-white cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 truncate max-w-[120px] sm:max-w-xs"
                                onClick={() => handleFolderClick(folder)}
                              >
                                {folder.nom}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-2 sm:px-6 sm:py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 hidden sm:table-cell">
                            Dossier
                          </td>
                          <td className="px-3 py-2 sm:px-6 sm:py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 hidden md:table-cell">
                            -
                          </td>
                          <td className="px-3 py-2 sm:px-6 sm:py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 hidden lg:table-cell">
                            {formatDate(folder.dateCreation)}
                          </td>
                          <td className="px-2 py-2 sm:px-6 sm:py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex items-center justify-end space-x-2">
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRenameFolder(folder);
                                }}
                                className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setFolderToDelete(folder);
                                  setShowDeleteFolderConfirm(true);
                                }}
                                className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      
                      {/* Fichiers */}
                      {files.map((file) => (
                        <tr key={file.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                          <td className="px-3 py-2 sm:px-6 sm:py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <svg className="flex-shrink-0 h-5 w-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                              </svg>
                              <a
                                href={file.url}
                                className="ml-2 text-sm font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 truncate max-w-[120px] sm:max-w-xs"
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {file.nom}
                              </a>
                            </div>
                          </td>
                          <td className="px-3 py-2 sm:px-6 sm:py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 hidden sm:table-cell">
                            {file.type || 'Fichier'}
                          </td>
                          <td className="px-3 py-2 sm:px-6 sm:py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 hidden md:table-cell">
                            {formatFileSize(file.taille)}
                          </td>
                          <td className="px-3 py-2 sm:px-6 sm:py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 hidden lg:table-cell">
                            {formatDate(file.dateCreation)}
                          </td>
                          <td className="px-2 py-2 sm:px-6 sm:py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex items-center justify-end space-x-2">
                              <button 
                                onClick={() => handleShowFileComments(file)}
                                className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300"
                                title="Voir les commentaires"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                                </svg>
                              </button>
                              
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDownloadFile(file);
                                }}
                                className="text-green-600 dark:text-green-400 hover:text-green-900 dark:hover:text-green-300"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                              </button>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteFile(file);
                                }}
                                className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {/* Dossiers */}
                  {folders.map((folder) => (
                    <div 
                      key={folder.id} 
                      className="bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md border border-gray-200 dark:border-gray-700 p-4 flex flex-col items-center cursor-pointer transition-all duration-200"
                      onClick={() => handleFolderClick(folder)}
                    >
                      <svg className="w-10 h-10 text-yellow-500 mb-2" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                        <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                      </svg>
                      <span className="text-sm font-medium text-gray-900 dark:text-white text-center truncate w-full">
                        {folder.nom}
                      </span>
                      <div className="flex mt-2 space-x-2">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRenameFolder(folder);
                          }}
                          className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setFolderToDelete(folder);
                            setShowDeleteFolderConfirm(true);
                          }}
                          className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                  
                  {/* Fichiers */}
                  {files.map((file) => (
                    <div key={file.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md border border-gray-200 dark:border-gray-700 p-4 flex flex-col items-center relative group">
                      <svg className="w-10 h-10 text-blue-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                      <a
                        href={file.url}
                        className="text-sm font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 text-center truncate w-full"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {file.nom}
                      </a>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {formatFileSize(file.taille)}
                      </p>
                      <div className="flex mt-2 space-x-2">
                        <button 
                          onClick={() => handleShowFileComments(file)}
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300"
                          title="Voir les commentaires"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                          </svg>
                        </button>
                        
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownloadFile(file);
                          }}
                          className="text-green-600 dark:text-green-400 hover:text-green-900 dark:hover:text-green-300"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteFile(file);
                          }}
                          className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </>
        )}
      </div>

      {/* Panneau de commentaires */}
      {showComments && selectedFile && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-11/12 md:w-3/4 h-5/6 flex flex-col">
            <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
                Commentaires sur {selectedFile.nom}
              </h2>
              <button
                onClick={() => setShowComments(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            </div>
            <div className="flex-grow">
              <CommentPanel documentId={selectedFile.id} documentNom={selectedFile.nom} />
            </div>
          </div>
        </div>
      )}

      {/* Afficher la caméra si nécessaire */}
      {showCamera && (
        <CameraCapture
          currentPath={currentPath || 'root'}
          onClose={() => {
            console.log("Fermeture de la caméra");
            setShowCamera(false);
          }}
          onPhotoUploaded={handlePhotoUploaded}
        />
      )}

      {/* Modal de création de dossier */}
      {createFolderModalOpen && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Créer un nouveau dossier</h3>
              <button 
                onClick={() => setCreateFolderModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            </div>
            
            <form onSubmit={(e) => {
              e.preventDefault();
              const input = e.currentTarget.elements.namedItem('folderName') as HTMLInputElement;
              if (input && input.value.trim()) {
                handleCreateFolder(input.value.trim());
                setCreateFolderModalOpen(false);
              }
            }}>
              <div className="mb-4">
                <label htmlFor="folderName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Nom du dossier
                </label>
                <input
                  type="text"
                  id="folderName"
                  name="folderName"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  autoFocus
                  required
                />
              </div>
              
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setCreateFolderModalOpen(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  Créer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de confirmation de suppression de dossier */}
      {showDeleteFolderConfirm && folderToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
                Êtes-vous sûr de vouloir supprimer ce dossier ?
              </h3>
              <button
                onClick={() => setShowDeleteFolderConfirm(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => {
                  handleDeleteFolder(folderToDelete);
                  setShowDeleteFolderConfirm(false);
                }}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                Supprimer
              </button>
              <button
                type="button"
                onClick={() => setShowDeleteFolderConfirm(false)}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal PDF Viewer */}
      {showPdfViewer && selectedFile && (
        <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex flex-col">
          {/* En-tête avec bouton de fermeture */}
          <div className="bg-gray-800 text-white p-3 flex justify-between items-center">
            <h3 className="text-lg font-medium truncate">{selectedFile.nom}</h3>
            <button 
              onClick={() => setShowPdfViewer(false)}
              className="p-2 rounded-full hover:bg-gray-700 focus:outline-none"
              aria-label="Fermer le PDF"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>
          
          {/* PDF intégré */}
          <div className="flex-grow w-full bg-gray-200 overflow-hidden">
            <iframe
              src={`${selectedFile.url}#toolbar=0`} 
              className="w-full h-full"
              title={selectedFile.nom}
            />
          </div>
          
          {/* Bouton de fermeture mobile (plus grand en bas de l'écran) */}
          <button 
            onClick={() => setShowPdfViewer(false)}
            className="bg-red-600 text-white p-4 w-full md:hidden text-center font-medium"
          >
            Fermer
          </button>
        </div>
      )}
    </div>
  );
};

export default FileExplorer; 