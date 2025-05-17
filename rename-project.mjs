import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Vérifier si un nom de projet a été fourni
if (process.argv.length < 3) {
  console.log('Usage: node rename-project.js <nouveau-nom-du-projet>');
  process.exit(1);
}

const newProjectName = process.argv[2];

// Fonction pour mettre à jour le package.json
function updatePackageJson() {
  const packageJsonPath = path.join(__dirname, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  
  packageJson.name = newProjectName;
  
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
  console.log('✅ package.json mis à jour');
}

// Fonction pour créer le .env.local à partir du .env.example
function setupEnvFile() {
  const envExamplePath = path.join(__dirname, '.env.example');
  const envLocalPath = path.join(__dirname, '.env.local');
  
  if (!fs.existsSync(envLocalPath)) {
    fs.copyFileSync(envExamplePath, envLocalPath);
    console.log('✅ .env.local créé à partir de .env.example');
  } else {
    console.log('ℹ️ .env.local existe déjà');
  }
}

// Exécuter les fonctions
try {
  updatePackageJson();
  setupEnvFile();
  console.log('\n🎉 Projet renommé avec succès !');
  console.log('\nProchaines étapes :');
  console.log('1. Remplir les variables Firebase dans .env.local');
  console.log('2. Installer les dépendances : npm install');
  console.log('3. Démarrer le projet : npm start');
} catch (error) {
  console.error('❌ Erreur lors du renommage :', error.message);
} 
