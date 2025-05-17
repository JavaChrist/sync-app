// Déclarations de types pour les composants personnalisés
declare module './Breadcrumb' {
  interface BreadcrumbItem {
    id: string;
    name: string;
    path: string;
  }
  
  interface BreadcrumbProps {
    items: BreadcrumbItem[];
    onItemClick: (path: string) => void;
  }
  
  const Breadcrumb: React.FC<BreadcrumbProps>;
  export default Breadcrumb;
}

declare module './FolderList' {
  import { FolderType } from '../types/documentTypes';
  
  interface FolderListProps {
    folders: FolderType[];
    onFolderClick: (folder: FolderType) => void;
    onFolderDelete: (folder: FolderType) => void;
    onFolderRename: (folder: FolderType) => void;
  }
  
  const FolderList: React.FC<FolderListProps>;
  export default FolderList;
}

declare module './FileList' {
  import { FileType } from '../types/documentTypes';
  
  interface FileListProps {
    files: FileType[];
    uploadProgress: { [key: string]: number };
    onFileDownload: (file: FileType) => void;
    onFileDelete: (file: FileType) => void;
    viewMode?: 'list' | 'grid';
  }
  
  const FileList: React.FC<FileListProps>;
  export default FileList;
}

declare module './SearchBar' {
  interface SearchBarProps {
    onSearch: (query: string) => void;
    placeholder?: string;
  }
  
  const SearchBar: React.FC<SearchBarProps>;
  export default SearchBar;
}

declare module './UploadButton' {
  interface UploadButtonProps {
    onFileUpload: (file: File) => void;
  }
  
  const UploadButton: React.FC<UploadButtonProps>;
  export default UploadButton;
} 