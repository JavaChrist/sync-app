import React, { useState, useRef, useEffect } from 'react';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { addDoc, collection } from 'firebase/firestore';
import { storage, db, auth } from '../firebaseConfig';

interface CameraCaptureProps {
  currentPath: string;
  onClose: () => void;
  onPhotoUploaded: () => void;
}

const CameraCapture: React.FC<CameraCaptureProps> = ({ currentPath, onClose, onPhotoUploaded }) => {
  // Références avec initialisation explicite
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [cameraError, setCameraError] = useState<string>('');
  const [hasPhoto, setHasPhoto] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [videoInitialized, setVideoInitialized] = useState<boolean>(false);

  // Nettoyer flux vidéo
  const cleanupStream = () => {
    console.log("Nettoyage du flux vidéo");
    if (stream) {
      stream.getTracks().forEach(track => {
        console.log(`Arrêt de la piste: ${track.kind}`);
        track.stop();
      });
      setStream(null);
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    setVideoInitialized(false);
  };

  // Nettoyer à la fermeture
  useEffect(() => {
    return () => {
      console.log("Démontage - nettoyage des ressources");
      cleanupStream();
    };
  }, []);

  // Initialiser la vidéo après avoir obtenu le flux
  const initializeVideo = async (mediaStream: MediaStream) => {
    console.log("Initialisation de la vidéo");
    
    // Vérifier que videoRef existe
    if (!videoRef.current) {
      console.error("Élément vidéo non disponible");
      setCameraError("Élément vidéo non disponible");
      setIsLoading(false);
      return false;
    }
    
    try {
      // Appliquer le flux à l'élément vidéo
      videoRef.current.srcObject = mediaStream;
      
      // Configurer les attributs - autoplay plutôt que play() manuel
      videoRef.current.autoplay = true;
      videoRef.current.playsInline = true;
      videoRef.current.muted = true;
      
      // Événements pour détecter l'état de la vidéo
      videoRef.current.onloadeddata = () => {
        console.log("Vidéo - données chargées");
      };
      
      videoRef.current.oncanplay = () => {
        console.log("Vidéo - peut être lue");
        setVideoInitialized(true);
        setIsLoading(false);
      };
      
      // NE PAS appeler play() manuellement, utiliser autoplay à la place
      // Définir un délai de secours pour s'assurer que l'état est mis à jour
      setTimeout(() => {
        if (videoRef.current && videoRef.current.readyState >= 2) {
          console.log("Vidéo prête (par timeout)");
          setVideoInitialized(true);
          setIsLoading(false);
        }
      }, 2000);
      
      return true;
    } catch (error) {
      console.error("Erreur d'initialisation vidéo:", error);
      setCameraError(`Erreur d'initialisation vidéo: ${error}`);
      setIsLoading(false);
      return false;
    }
  };

  // Démarrer caméra avec gestion d'erreurs améliorée
  const startCamera = async () => {
    setIsLoading(true);
    setCameraError('');
    
    // Nettoyer l'ancien flux
    cleanupStream();
    
    try {
      // Vérifier support de mediaDevices
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError("Votre navigateur ne supporte pas l'accès à la caméra");
        setIsLoading(false);
        return;
      }
      
      console.log(`Demande d'accès caméra: ${facingMode}`);
      
      // Options simples et compatibles
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: facingMode,
          width: { ideal: 640 },
          height: { ideal: 480 }
        },
        audio: false
      };
      
      // Obtenir le flux
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log("Flux obtenu:", mediaStream.id);
      
      // Stocker le flux
      setStream(mediaStream);
      
      // Initialiser la vidéo avec le flux
      const initialized = await initializeVideo(mediaStream);
      
      if (!initialized) {
        throw new Error("Échec d'initialisation de la vidéo");
      }
      
    } catch (err: any) {
      console.error("Erreur caméra:", err);
      
      let msg = "Erreur d'accès à la caméra";
      
      // Messages spécifiques par type d'erreur
      if (err.name === 'NotAllowedError') {
        msg = "Accès refusé à la caméra. Vérifiez les permissions de votre navigateur.";
      } else if (err.name === 'NotFoundError') {
        msg = "Aucune caméra trouvée sur cet appareil.";
      } else if (err.name === 'NotReadableError') {
        msg = "La caméra est utilisée par une autre application.";
      } else if (err.name === 'OverconstrainedError') {
        msg = "Votre caméra ne supporte pas les options demandées.";
      } else if (err.name === 'TypeError') {
        msg = "Erreur technique lors de l'accès à la caméra.";
      }
      
      setCameraError(`${msg} (${err.name})`);
      setStream(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Démarrer au chargement
  useEffect(() => {
    startCamera();
  }, []);

  // Changer de caméra (avant/arrière)
  const switchCamera = () => {
    const newMode = facingMode === 'user' ? 'environment' : 'user';
    console.log(`Changement caméra: ${facingMode} → ${newMode}`);
    setFacingMode(newMode);
    
    // Redémarrer
    startCamera();
  };

  // Prendre une photo avec debug amélioré
  const takePhoto = () => {
    console.log("Tentative de prise de photo...");
    
    // Vérification des références avec messages précis
    if (!videoRef.current) {
      console.error("Référence vidéo manquante");
      setCameraError("Élément vidéo non disponible");
      return;
    }
    
    if (!canvasRef.current) {
      console.error("Référence canvas manquante");
      setCameraError("Élément canvas non disponible");
      return;
    }
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    try {
      // Vérifier que la vidéo est initialisée
      if (!video.videoWidth || !video.videoHeight || video.videoWidth <= 0 || video.videoHeight <= 0) {
        console.error("Vidéo non initialisée:", {
          width: video.videoWidth,
          height: video.videoHeight,
          ready: video.readyState,
          initialized: videoInitialized
        });
        setCameraError("La vidéo n'est pas prête. Veuillez réessayer.");
        return;
      }
      
      // Dimensions
      const width = video.videoWidth;
      const height = video.videoHeight;
      
      console.log(`Capture photo: ${width}x${height}`);
      
      // Configuration canvas
      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        console.error("Impossible d'obtenir le contexte 2D");
        setCameraError("Erreur technique lors de la capture");
        return;
      }
      
      // Effacer d'abord
      ctx.clearRect(0, 0, width, height);
      
      // Mode miroir pour caméra frontale
      if (facingMode === 'user') {
        ctx.translate(width, 0);
        ctx.scale(-1, 1);
      }
      
      // Dessin
      ctx.drawImage(video, 0, 0, width, height);
      console.log("Photo capturée avec succès");
      
      // Indiquer succès
      setHasPhoto(true);
    } catch (err) {
      console.error("Erreur lors de la capture:", err);
      setCameraError(`Erreur lors de la capture: ${err}`);
    }
  };

  // Reprise de photo
  const retakePhoto = () => {
    console.log("Reprise de photo");
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setHasPhoto(false);
    }
  };

  // Téléversement de la photo
  const uploadPhoto = async () => {
    console.log("Début téléversement...");
    
    if (!canvasRef.current || !auth.currentUser) {
      console.error("Canvas ou utilisateur non disponible");
      setCameraError("Impossible de téléverser: canvas ou utilisateur non disponible");
      return;
    }
    
    try {
      setIsUploading(true);
      setUploadProgress(0);
      
      const canvas = canvasRef.current;
      
      // Obtenir l'image au format JPEG
      canvas.toBlob(async (blob) => {
        if (!blob) {
          setCameraError("Impossible de créer l'image");
          setIsUploading(false);
          return;
        }
        
        console.log(`Image générée: ${blob.size} octets`);
        
        // Nom de fichier unique
        const fileName = `photo_${Date.now()}.jpg`;
        const storagePath = `files/${currentPath}/${fileName}`;
        
        console.log(`Destination: ${storagePath}`);
        
        // Référence Firebase
        const storageRef = ref(storage, storagePath);
        
        // Upload avec progression
        const uploadTask = uploadBytesResumable(storageRef, blob);
        
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            console.log(`Progression: ${progress.toFixed(1)}%`);
            setUploadProgress(progress);
          },
          (error) => {
            console.error("Erreur upload:", error);
            setCameraError(`Erreur lors du téléversement: ${error.message}`);
            setIsUploading(false);
          },
          async () => {
            try {
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              
              if (!auth.currentUser) {
                setCameraError("Déconnecté pendant le téléversement");
                setIsUploading(false);
                return;
              }
              
              // Enregistrer métadonnées
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
              
              console.log("Photo enregistrée avec succès");
              
              setIsUploading(false);
              onPhotoUploaded();
              onClose();
            } catch (err) {
              console.error("Erreur finalisation:", err);
              setCameraError("Erreur lors de l'enregistrement");
              setIsUploading(false);
            }
          }
        );
      }, 'image/jpeg', 0.85);
      
    } catch (err: any) {
      console.error("Erreur générale:", err);
      setCameraError(`Erreur: ${err.message || "Erreur inconnue"}`);
      setIsUploading(false);
    }
  };

  // Rendu du composant
  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex flex-col justify-center items-center p-4">
      <div className="bg-white dark:bg-gray-800 w-full max-w-lg rounded-lg overflow-hidden shadow-xl">
        {/* Entête */}
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
        
        {/* Affichage principal */}
        <div className="relative bg-black">
          {/* Canvas pour capture de photo - toujours présent mais visible seulement si hasPhoto=true */}
          <canvas 
            ref={canvasRef} 
            className={`w-full h-auto ${hasPhoto ? 'block' : 'hidden'}`}
          ></canvas>
          
          {/* Vidéo - visible seulement si hasPhoto=false */}
          {!hasPhoto && (
            <div className="relative">
              <video 
                ref={videoRef} 
                className="w-full h-auto"
                style={{ minHeight: "250px" }}
              ></video>
              
              {/* Indicateur de chargement */}
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
                  <svg className="animate-spin h-10 w-10 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
              )}
              
              {/* Message si vidéo non disponible */}
              {!isLoading && !videoInitialized && !cameraError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-50">
                  <p className="text-white text-center mb-4">L'appareil photo n'est pas disponible</p>
                  <button 
                    onClick={startCamera}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
                  >
                    Réessayer
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Message d'erreur */}
        {cameraError && (
          <div className="p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-sm">
            {cameraError}
          </div>
        )}
        
        {/* Barre de progression */}
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
        
        {/* Actions */}
        <div className="p-4 flex justify-between">
          {!hasPhoto ? (
            <>
              <button
                onClick={switchCamera}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded"
                disabled={isLoading || !stream}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                </svg>
              </button>
              <button
                id="captureButton"
                onClick={takePhoto}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full w-14 h-14 flex items-center justify-center focus:outline-none transition-transform active:scale-95"
                disabled={isLoading || !stream || !videoInitialized}
              >
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path>
                </svg>
              </button>
              <div className="w-10"></div>
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
          )}
        </div>
      </div>
    </div>
  );
};

export default CameraCapture; 