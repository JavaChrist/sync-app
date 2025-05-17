import React, { useState } from 'react';

interface UploadButtonProps {
  onFileUpload: (file: File) => void;
}

const UploadButton: React.FC<UploadButtonProps> = ({ onFileUpload }) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [showTooltip, setShowTooltip] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        onFileUpload(files[i]);
      }
      // Réinitialiser l'input pour permettre de télécharger le même fichier plusieurs fois
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => fileInputRef.current?.click()}
        className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 flex items-center"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path>
        </svg>
        Téléverser un fichier
      </button>
      
      {showTooltip && (
        <div className="absolute left-0 top-full mt-2 p-3 bg-gray-800 text-white text-xs rounded shadow-lg z-10 w-64">
          <p className="font-bold mb-1">Formats supportés :</p>
          <p>Documents: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT</p>
          <p>Images: JPG, JPEG, PNG, GIF, SVG</p>
          <p>Archives: ZIP* (max 50 Mo)</p>
          <p className="mt-1 text-gray-300 italic">*Pour les fichiers ZIP volumineux, compressez davantage ou divisez-les en parties plus petites.</p>
        </div>
      )}
      
      <input
        ref={fileInputRef}
        type="file"
        onChange={handleFileChange}
        className="hidden"
        multiple
        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.jpg,.jpeg,.png,.gif,.svg,.zip"
      />
    </div>
  );
};

export default UploadButton; 