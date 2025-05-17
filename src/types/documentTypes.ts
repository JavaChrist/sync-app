export interface FolderType {
  id: string;
  nom: string;
  path: string;
  niveau: number;
  parent: string | null;
  ordre: number;
  dateCreation: Date;
  creePar: string;
}

export interface FileType {
  id: string;
  nom: string;
  type: string;
  taille: number;
  dossierId: string;
  cheminStockage: string;
  dateUpload: Date;
  uploadPar: string;
  url: string;
} 