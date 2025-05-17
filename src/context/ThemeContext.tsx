import React, { createContext, useState, useEffect, useContext } from 'react';

type ThemeType = 'light' | 'dark';

interface ThemeContextType {
  theme: ThemeType;
  toggleTheme: () => void;
}

// Créer le contexte avec une valeur par défaut
const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',
  toggleTheme: () => {},
});

// Hook personnalisé pour utiliser le thème
export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Vérifier si un thème est déjà enregistré dans localStorage
  const [theme, setTheme] = useState<ThemeType>(() => {
    const savedTheme = localStorage.getItem('theme');
    return (savedTheme === 'dark' ? 'dark' : 'light') as ThemeType;
  });

  // Appliquer le thème au document HTML
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    // Sauvegarder le thème dans localStorage
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Fonction pour basculer entre les thèmes
  const toggleTheme = () => {
    setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export default ThemeProvider; 