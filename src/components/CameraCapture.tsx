import React, { useState, useRef, useEffect } from 'react';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { storage, db, auth } from '../firebaseConfig';

interface CameraCaptureProps {
  currentPath: string;
  onClose: () => void;
  onPhotoUploaded: () => void;
}

const CameraCapture: React.FC<CameraCaptureProps> = ({ currentPath, onClose, onPhotoUploaded }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string>('');
  const [hasPhoto, setHasPhoto] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');

  // Initialiser la caméra au chargement du composant
  useEffect(() => {
    startCamera();
    
    // Nettoyer le flux vidéo à la fermeture
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [facingMode]);

  const startCamera = async () => {
    try {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });
      
      setStream(newStream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }
      
      setCameraError('');
      setHasPhoto(false);
    } catch (err) {
      console.error('Erreur d\'accès à la caméra:', err);
      setCameraError('Impossible d\'accéder à la caméra. Veuillez vérifier vos permissions de navigateur.');
    }
  };

  const switchCamera = () => {
    setFacingMode(prevMode => prevMode === 'user' ? 'environment' : 'user');
  };

  const takePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    const width = video.videoWidth;
    const height = video.videoHeight;
    
    canvas.width = width;
    canvas.height = height;
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Si la caméra frontale est utilisée, retourner l'image horizontalement
      if (facingMode === 'user') {
        ctx.translate(width, 0);
        ctx.scale(-1, 1);
      }
      
      ctx.drawImage(video, 0, 0, width, height);
      setHasPhoto(true);
    }
  };

  const retakePhoto = () => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setHasPhoto(false);
    }
  };

  const uploadPhoto = async () => {
    if (!canvasRef.current || !auth.currentUser) return;
    
    try {
      setIsUploading(true);
      
      // Convertir le canvas en blob
      const canvas = canvasRef.current;
      
      // Utiliser toBlob pour obtenir l'image au format JPEG avec une qualité de 90%
      canvas.toBlob(async (blob) => {
        if (blob) {
          // Générer un nom de fichier unique avec date et extension
          const fileName = `photo_${new Date().toISOString().replace(/:/g, '-')}.jpg`;
          const filePath = currentPath ? `${currentPath}/${fileName}` : fileName;
          
          // Référence au fichier dans Firebase Storage
          const storageRef = ref(storage, `documents/${filePath}`);
          
          // Téléverser le fichier avec suivi de progression
          const uploadTask = uploadBytesResumable(storageRef, blob);
          
          uploadTask.on(
            'state_changed',
            (snapshot) => {
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              setUploadProgress(progress);
            },
            (error) => {
              console.error('Erreur lors du téléversement:', error);
              setCameraError('Erreur lors du téléversement de la photo.');
              setIsUploading(false);
            },
            async () => {
              // Téléversement terminé, obtenir l'URL de téléchargement
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              
              // S'assurer que l'utilisateur est toujours connecté
              if (auth.currentUser) {
                // Ajouter les métadonnées du fichier dans Firestore
                await addDoc(collection(db, 'fichiers'), {
                  nom: fileName,
                  type: 'image/jpeg',
                  taille: blob.size,
                  url: downloadURL,
                  path: currentPath,
                  dateCreation: serverTimestamp(),
                  createdBy: auth.currentUser.uid,
                  fullPath: `documents/${filePath}`
                });
              } else {
                console.error('Utilisateur déconnecté pendant le téléversement');
                setCameraError('Erreur: Vous avez été déconnecté pendant le téléversement.');
                setIsUploading(false);
                return;
              }
              
              setIsUploading(false);
              setUploadProgress(0);
              onPhotoUploaded();
              onClose();
            }
          );
        }
      }, 'image/jpeg', 0.9);
      
    } catch (error) {
      console.error('Erreur lors du traitement de la photo:', error);
      setCameraError('Erreur lors du traitement de la photo.');
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex flex-col justify-center items-center p-4">
      <div className="bg-white dark:bg-gray-800 w-full max-w-lg rounded-lg overflow-hidden shadow-xl">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Prendre une photo</h3>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
        
        <div className="relative bg-black">
          {hasPhoto ? (
            <canvas 
              ref={canvasRef} 
              className="w-full h-auto"
            ></canvas>
          ) : (
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline
              muted
              className="w-full h-auto"
            ></video>
          )}
        </div>
        
        {cameraError && (
          <div className="p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-sm">
            {cameraError}
          </div>
        )}
        
        <div className="p-4 flex justify-between">
          {!hasPhoto ? (
            <>
              <button
                onClick={switchCamera}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path>
                </svg>
              </button>
              <button
                onClick={takePhoto}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full w-14 h-14 flex items-center justify-center focus:outline-none"
              >
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path>
                </svg>
              </button>
              <div className="w-10"></div> {/* Spacer pour équilibrer la mise en page */}
            </>
          ) : (
            <>
              <button
                onClick={retakePhoto}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded"
                disabled={isUploading}
              >
                Reprendre
              </button>
              <button
                onClick={uploadPhoto}
                className={`px-4 py-2 ${
                  isUploading ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'
                } text-white rounded`}
                disabled={isUploading}
              >
                {isUploading ? `Téléversement ${Math.round(uploadProgress)}%` : 'Téléverser'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CameraCapture; 