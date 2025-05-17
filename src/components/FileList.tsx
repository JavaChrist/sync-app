import React from 'react';
import { FileType } from '../types/documentTypes';
import { Timestamp } from 'firebase/firestore';

interface FileListProps {
  files: FileType[];
  uploadProgress: { [key: string]: number };
  onFileDownload: (file: FileType) => void;
  onFileDelete: (file: FileType) => void;
}

const FileList: React.FC<FileListProps> = ({ 
  files, 
  uploadProgress, 
  onFileDownload, 
  onFileDelete 
}) => {
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

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

  // Fonction pour obtenir l'icône selon le type de fichier
  const getFileIcon = (fileType: string): React.ReactNode => {
    // Types de fichiers courants
    switch (fileType.toLowerCase()) {
      case 'pdf':
        return (
          <svg className="w-10 h-10 text-red-500" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd"></path>
          </svg>
        );
      case 'doc':
      case 'docx':
      case 'odt':
        return (
          <svg className="w-10 h-10 text-blue-500" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd"></path>
          </svg>
        );
      case 'xls':
      case 'xlsx':
      case 'ods':
        return (
          <svg className="w-10 h-10 text-green-500" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd"></path>
          </svg>
        );
      case 'zip':
      case 'rar':
      case '7z':
        return (
          <svg className="w-10 h-10 text-yellow-600" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd"></path>
          </svg>
        );
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'svg':
        return (
          <svg className="w-10 h-10 text-purple-500" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
            <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd"></path>
          </svg>
        );
      default:
        return (
          <svg className="w-10 h-10 text-gray-500" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd"></path>
          </svg>
        );
    }
  };

  if (files.length === 0 && Object.keys(uploadProgress).length === 0) {
    return (
      <div className="py-4">
        <p className="text-gray-500 text-sm italic">Aucun fichier</p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-lg font-medium text-gray-700 mb-3">Fichiers</h3>
      
      {/* Fichiers en cours d'upload */}
      {Object.keys(uploadProgress).length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-medium text-gray-700 mb-2">En cours d'upload</h4>
          <div className="space-y-2">
            {Object.entries(uploadProgress).map(([fileName, progress]) => (
              <div key={fileName} className="border border-gray-200 rounded p-3">
                <div className="flex items-center mb-1">
                  <svg className="w-5 h-5 text-blue-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
                  </svg>
                  <span className="text-sm">{fileName}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div 
                    className="bg-blue-600 h-2.5 rounded-full" 
                    style={{ width: `${Math.min(progress, 100)}%` }}
                  ></div>
                </div>
                <p className="text-xs text-gray-500 mt-1">{Math.round(progress)}% terminé</p>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Liste des fichiers */}
      {files.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fichier
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Taille
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {files.map(file => (
                <tr key={file.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {getFileIcon(file.type)}
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{file.nom}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="uppercase text-xs inline-block px-2 py-1 rounded-full bg-gray-100 text-gray-800">
                      {file.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatFileSize(file.taille)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(file.dateUpload)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => onFileDownload(file)}
                      className="text-blue-600 hover:text-blue-900 mr-4"
                      title="Télécharger"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                      </svg>
                    </button>
                    <button
                      onClick={() => onFileDelete(file)}
                      className="text-red-600 hover:text-red-900"
                      title="Supprimer"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default FileList; 