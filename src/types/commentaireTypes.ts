import { Timestamp } from 'firebase/firestore';

export interface Commentaire {
  id: string;
  documentId: string;     // ID du document commenté
  auteurId: string;       // Utilisateur qui commente
  auteurNom: string;      // Nom ou NNI de l'utilisateur
  contenu: string;        // Texte du commentaire
  dateCreation: Timestamp | Date;
  mentions?: string[];    // IDs des utilisateurs mentionnés (@utilisateur)
  modifie?: boolean;      // Si le commentaire a été édité
  dateModification?: Timestamp | Date;
}

export interface CommentaireFormData {
  contenu: string;
  mentions?: string[];
} 