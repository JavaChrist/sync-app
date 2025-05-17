import React, { useState, useEffect, useCallback } from 'react';

interface SearchBarProps {
  onSearch: (query: string) => void;
  placeholder?: string;
}

const SearchBar: React.FC<SearchBarProps> = ({ 
  onSearch, 
  placeholder = "Rechercher des fichiers..." 
}) => {
  const [query, setQuery] = useState<string>('');
  const [debouncedQuery, setDebouncedQuery] = useState<string>('');
  
  // Effet pour le debounce (attendre que l'utilisateur arrête de taper)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 500); // Augmenté à 500ms pour laisser plus de temps entre les frappes
    
    return () => clearTimeout(timer);
  }, [query]);
  
  // Utiliser useCallback pour éviter les rendus inutiles
  const performSearch = useCallback((searchQuery: string) => {
    onSearch(searchQuery);
  }, [onSearch]);
  
  // Lancer la recherche quand debouncedQuery change
  useEffect(() => {
    // Ne déclencher la recherche que si la requête a une longueur minimale ou est vide
    if (debouncedQuery.length >= 1 || debouncedQuery === '') {
      performSearch(debouncedQuery);
    }
  }, [debouncedQuery, performSearch]);
  
  // Réinitialiser la recherche quand le champ est vidé
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    
    // Si la valeur est vide, on lance une recherche vide immédiatement
    if (!value) {
      performSearch('');
    }
  };
  
  // Soumettre la recherche immédiatement quand on appuie sur Entrée
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    performSearch(query);
  };
  
  return (
    <form 
      onSubmit={handleSubmit}
      className="relative w-full max-w-md"
    >
      <div className="relative">
        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
          </svg>
        </div>
        <input
          type="search"
          value={query}
          onChange={handleChange}
          className="block w-full p-2 pl-10 text-sm text-gray-900 border border-gray-300 rounded-lg bg-white focus:ring-blue-500 focus:border-blue-500"
          placeholder={placeholder}
        />
        {query && (
          <button
            type="button"
            className="absolute inset-y-0 right-0 flex items-center pr-3"
            onClick={() => {
              setQuery('');
              performSearch('');
            }}
          >
            <svg className="w-4 h-4 text-gray-500 hover:text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        )}
      </div>
    </form>
  );
};

export default SearchBar; 