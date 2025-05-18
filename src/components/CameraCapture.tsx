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
  const [cameraPermission, setCameraPermission] = useState<'granted' | 'denied' | 'prompt'>('prompt');
  const [isStartingCamera, setIsStartingCamera] = useState<boolean>(false);

  // Vérifier si la caméra est disponible
  useEffect(() => {
    // Vérifier si mediaDevices est supporté
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Votre navigateur ne supporte pas l\'accès à la caméra.');
      return;
    }

    // Vérifier les permissions si l'API est disponible
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'camera' as PermissionName })
        .then((permissionStatus) => {
          console.log("État de la permission caméra:", permissionStatus.state);
          setCameraPermission(permissionStatus.state as 'granted' | 'denied' | 'prompt');
          
          if (permissionStatus.state === 'granted') {
            startCamera();
          }
          
          permissionStatus.onchange = () => {
            console.log("Permission caméra changée:", permissionStatus.state);
            setCameraPermission(permissionStatus.state as 'granted' | 'denied' | 'prompt');
            
            if (permissionStatus.state === 'granted') {
              startCamera();
            } else if (permissionStatus.state === 'denied') {
              setCameraError('Vous avez refusé l\'accès à la caméra. Veuillez modifier les paramètres de votre navigateur.');
            }
          };
        })
        .catch(error => {
          console.error("Erreur lors de la vérification des permissions:", error);
          // Si l'API permissions n'est pas supportée ou échoue, essayer d'accéder directement
          startCamera();
        });
    } else {
      // Si l'API permissions n'est pas supportée, essayer d'accéder directement
      startCamera();
    }
    
    // Nettoyage
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Écouter les changements de facingMode
  useEffect(() => {
    if (cameraPermission === 'granted' && !isStartingCamera) {
      if (stream) {
        // Arrêter le flux actuel
        stream.getTracks().forEach(track => track.stop());
      }
      // Redémarrer la caméra avec le nouveau mode
      startCamera();
    }
  }, [facingMode]);

  const startCamera = async () => {
    // Éviter les démarrages simultanés
    if (isStartingCamera) return;
    
    try {
      setIsStartingCamera(true);
      console.log("Démarrage de la caméra avec facingMode:", facingMode);
      
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      };
      
      console.log("Demande d'accès à la caméra avec contraintes:", constraints);
      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      setStream(newStream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        
        // Attendre que les métadonnées soient chargées avant de lancer la lecture
        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current) {
            videoRef.current.play().catch(e => {
              console.error("Erreur lors de la lecture de la vidéo:", e);
              setCameraError('Erreur lors du démarrage de la vidéo: ' + e.message);
            });
          }
        };
      }
      
      setCameraError('');
      setHasPhoto(false);
      setCameraPermission('granted');
    } catch (err: any) {
      console.error('Erreur d\'accès à la caméra:', err);
      setCameraError('Impossible d\'accéder à la caméra: ' + (err.message || 'Erreur inconnue'));
      
      if (err.name === 'NotAllowedError') {
        setCameraPermission('denied');
      }
    } finally {
      setIsStartingCamera(false);
    }
  };

  const requestCameraPermission = () => {
    console.log("Demande manuelle d'accès à la caméra");
    startCamera();
  };

  const switchCamera = () => {
    setFacingMode(prevMode => prevMode === 'user' ? 'environment' : 'user');
  };

  const takePhoto = () => {
    if (!videoRef.current || !canvasRef.current) {
      console.error("Références canvas ou vidéo manquantes");
      return;
    }
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      console.error("Dimensions vidéo invalides:", video.videoWidth, video.videoHeight);
      setCameraError("La vidéo n'est pas prête. Veuillez patienter ou réessayer.");
      return;
    }
    
    const width = video.videoWidth;
    const height = video.videoHeight;
    
    console.log("Capture photo avec dimensions:", width, height);
    
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
    } else {
      console.error("Impossible d'obtenir le contexte canvas");
      setCameraError("Erreur lors de la capture de la photo");
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
    if (!canvasRef.current || !auth.currentUser) {
      console.error("Références canvas ou utilisateur manquantes");
      return;
    }
    
    try {
      setIsUploading(true);
      
      // Convertir le canvas en blob
      const canvas = canvasRef.current;
      
      console.log("Préparation de l'upload...");
      
      // Utiliser toBlob pour obtenir l'image au format JPEG avec une qualité de 90%
      canvas.toBlob(async (blob) => {
        if (blob) {
          console.log("Blob créé, taille:", blob.size);
          
          // Générer un nom de fichier unique avec date et extension
          const fileName = `photo_${new Date().toISOString().replace(/:/g, '-')}.jpg`;
          const storagePath = `files/${currentPath}/${fileName}`;
          
          console.log("Chemin de stockage:", storagePath);
          
          // Référence au fichier dans Firebase Storage
          const storageRef = ref(storage, storagePath);
          
          // Téléverser le fichier avec suivi de progression
          const uploadTask = uploadBytesResumable(storageRef, blob);
          
          uploadTask.on(
            'state_changed',
            (snapshot) => {
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              console.log("Progression:", progress.toFixed(1) + "%");
              setUploadProgress(progress);
            },
            (error) => {
              console.error('Erreur lors du téléversement:', error);
              setCameraError('Erreur lors du téléversement de la photo: ' + error.message);
              setIsUploading(false);
            },
            async () => {
              // Téléversement terminé, obtenir l'URL de téléchargement
              try {
                console.log("Téléversement terminé, obtention de l'URL...");
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                
                // S'assurer que l'utilisateur est toujours connecté
                if (!auth.currentUser) {
                  console.error('Utilisateur déconnecté pendant le téléversement');
                  setCameraError('Erreur: Vous avez été déconnecté pendant le téléversement.');
                  setIsUploading(false);
                  return;
                }
                
                console.log("Enregistrement des métadonnées dans Firestore...");
                
                // Ajouter les métadonnées du fichier dans Firestore
                await addDoc(collection(db, 'fichiers'), {
                  nom: fileName,
                  type: 'jpg',
                  taille: blob.size,
                  dossierId: currentPath,
                  cheminStockage: storagePath,
                  dateUpload: new Date(),
                  dateCreation: new Date(),
                  uploadPar: auth.currentUser.uid,
                  url: downloadURL
                });
                
                console.log("Photo téléversée avec succès!");
                setIsUploading(false);
                setUploadProgress(0);
                onPhotoUploaded();
                onClose();
              } catch (error) {
                console.error("Erreur lors de la finalisation:", error);
                setCameraError('Erreur lors de la finalisation du téléversement.');
                setIsUploading(false);
              }
            }
          );
        } else {
          console.error("Impossible de créer le blob");
          setCameraError('Erreur lors de la création de l\'image.');
          setIsUploading(false);
        }
      }, 'image/jpeg', 0.9);
      
    } catch (error: any) {
      console.error('Erreur lors du traitement de la photo:', error);
      setCameraError('Erreur lors du traitement de la photo: ' + (error.message || 'Erreur inconnue'));
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
          {cameraPermission !== 'granted' ? (
            <div className="flex flex-col items-center justify-center p-8 h-64">
              <svg className="w-16 h-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path>
              </svg>
              <p className="text-gray-600 dark:text-gray-400 text-center mb-4">
                {cameraPermission === 'denied' 
                  ? "L'accès à la caméra a été refusé." 
                  : "Autorisation d'accéder à la caméra requise."}
              </p>
              <button
                onClick={requestCameraPermission}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
              >
                Autoriser l'accès à la caméra
              </button>
            </div>
          ) : hasPhoto ? (
            <canvas 
              ref={canvasRef} 
              className="w-full h-auto"
            ></canvas>
          ) : (
            <div className="relative">
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline
                muted
                className="w-full h-auto"
              ></video>
              {!stream || isStartingCamera ? (
                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
                  <svg className="animate-spin h-10 w-10 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
              ) : null}
            </div>
          )}
        </div>
        
        {cameraError && (
          <div className="p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-sm">
            {cameraError}
          </div>
        )}
        
        {isUploading && (
          <div className="p-3">
            <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
              <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${uploadProgress}%` }}></div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 text-center mt-1">
              Téléversement: {uploadProgress.toFixed(0)}%
            </p>
          </div>
        )}
        
        <div className="p-4 flex justify-between">
          {cameraPermission === 'granted' && (
            !hasPhoto ? (
              <>
                <button
                  onClick={switchCamera}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded"
                  disabled={!stream || isStartingCamera}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path>
                  </svg>
                </button>
                <button
                  onClick={takePhoto}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full w-14 h-14 flex items-center justify-center focus:outline-none"
                  disabled={!stream || isStartingCamera}
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
                  {isUploading ? 'Téléversement...' : 'Téléverser'}
                </button>
              </>
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default CameraCapture; 