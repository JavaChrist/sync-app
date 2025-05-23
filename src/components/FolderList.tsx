import React from 'react';
import { FolderType } from '../types/documentTypes';
import { Timestamp } from 'firebase/firestore';

interface FolderListProps {
  folders: FolderType[];
  onFolderClick: (folder: FolderType) => void;
  onFolderDelete: (folder: FolderType) => void;
  onFolderRename: (folder: FolderType) => void;
}

const FolderList: React.FC<FolderListProps> = ({ 
  folders, 
  onFolderClick, 
  onFolderDelete,
  onFolderRename 
}) => {
  if (folders.length === 0) {
    return (
      <div className="py-4 border-b border-gray-200 dark:border-gray-700">
        <p className="text-gray-500 dark:text-gray-400 text-sm italic">Aucun dossier</p>
      </div>
    );
  }

  // Fonction pour formater la date (prend en compte les Timestamp de Firestore ou les Date classiques)
  const formatDate = (dateValue: any): string => {
    if (!dateValue) return 'N/A';
    
    let date;
    if (dateValue instanceof Timestamp) {
      date = dateValue.toDate();
    } else {
      date = new Date(dateValue);
    }
    
    return date.toLocaleDateString();
  };

  return (
    <div className="mb-8">
      <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-3">Dossiers</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {folders.map(folder => (
          <div 
            key={folder.id}
            className="bg-blue-50 dark:bg-gray-800 border-2 border-blue-100 dark:border-gray-700 rounded-lg shadow-md hover:shadow-lg p-4 transition-all duration-200 hover:bg-blue-100 dark:hover:bg-gray-750 flex flex-col min-w-0"
          >
            <div className="flex flex-col items-start mb-2 w-full">
              {/* Titre et icône du dossier */}
              <div className="flex items-center w-full mb-3">
                <svg className="flex-shrink-0 w-7 h-7 text-yellow-500 mr-2" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                  <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"></path>
                </svg>
                <button 
                  onClick={() => onFolderClick(folder)} 
                  className="text-blue-600 dark:text-blue-400 font-medium hover:underline text-left truncate max-w-full"
                  title={folder.nom}
                >
                  {folder.nom}
                </button>
              </div>
              
              {/* Info de date et niveau */}
              <div className="text-xs text-gray-600 dark:text-gray-400 mb-3 w-full truncate">
                Niveau: {folder.niveau} • Créé le: {formatDate(folder.dateCreation)}
              </div>
              
              {/* Boutons d'action */}
              <div className="flex space-x-2 w-full justify-end mt-auto">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onFolderRename(folder);
                  }}
                  className="p-1.5 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-blue-200 dark:hover:bg-gray-600 rounded-full"
                  title="Renommer ce dossier"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                  </svg>
                </button>
                
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onFolderDelete(folder);
                  }}
                  className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900 dark:hover:text-red-300 rounded-full"
                  title="Supprimer ce dossier"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FolderList; 