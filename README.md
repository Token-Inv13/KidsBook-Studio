# KidsBook Studio

**Application desktop complète pour la création et publication de livres jeunesse sur Amazon KDP**

## 🎯 Vue d'ensemble

KidsBook Studio est une application desktop Electron qui permet aux auteurs de livres pour enfants de gérer l'intégralité du processus créatif :

- **Idée** → **Écriture** → **Découpage** → **Illustration** → **Mise en page** → **Vérification** → **Export KDP**

### Caractéristiques principales

✅ **Sécurité OpenAI** : Clé API stockée dans le trousseau système, jamais exposée dans l'UI  
✅ **Hors-ligne** : Fonctionne sans connexion (sauf fonctionnalités IA)  
✅ **WYSIWYG** : Éditeur de pages avec aperçu temps réel  
✅ **Assistant IA** : GPT-4 pour l'écriture et la génération d'idées  
✅ **Génération d'images** : DALL-E 3 pour les illustrations  
✅ **Export KDP** : PDF print-ready avec vérifications automatiques  
✅ **Autosave** : Sauvegarde automatique toutes les 2 secondes  

## 📋 Prérequis

- **Node.js** 18+ ([télécharger](https://nodejs.org/))
- **npm** 9+ (inclus avec Node.js)
- **Clé API OpenAI** ([obtenir une clé](https://platform.openai.com/api-keys))

## 🚀 Installation

### 1. Cloner ou télécharger le projet

```bash
cd "c:/Users/token/Documents/KidsBook Studio"
```

### 2. Installer les dépendances

```bash
npm install
```

### 3. Lancer l'application en mode développement

```bash
npm start
```

Cela va :
- Démarrer le serveur React sur `http://localhost:3000`
- Lancer le service OpenAI sécurisé sur `http://localhost:3001`
- Ouvrir l'application Electron

### 4. Configurer la clé API OpenAI

Au premier lancement :
1. Cliquez sur l'icône **Paramètres** (⚙️) en haut à droite
2. Entrez votre clé API OpenAI (format: `sk-...`)
3. Cliquez sur **Enregistrer**

La clé est stockée de manière sécurisée dans le trousseau système Windows (via `keytar`).

## 🏗️ Build pour production

### Build de l'application React

```bash
npm run build
```

### Créer l'installeur Windows

```bash
npm run build:electron
```

L'installeur sera généré dans le dossier `dist/`.

## 📖 Guide d'utilisation

### Créer un nouveau projet

1. Cliquez sur **Nouveau Projet**
2. Suivez l'assistant en 3 étapes :
   - **Étape 1** : Titre, auteur, âge cible
   - **Étape 2** : Format du livre (8.5x8.5", 8x10", etc.)
   - **Étape 3** : Type de livre et emplacement de sauvegarde

### Écrire avec l'assistant IA

1. Ouvrez un projet
2. Allez dans **Écriture**
3. Utilisez les boutons rapides :
   - **Écrire l'histoire** : Génère une histoire complète
   - **Simplifier** : Adapte le texte à l'âge cible
   - **Découper en pages** : Découpe automatiquement l'histoire

4. Insérez le texte dans les pages :
   - Cliquez sur **Insérer** pour ajouter à la page active
   - Cliquez sur **Auto-découpe** pour créer toutes les pages automatiquement

### Éditer les pages

1. Créez des pages avec **Nouvelle Page**
2. Ajoutez du texte avec le bouton **Texte**
3. Déplacez et redimensionnez les blocs
4. Personnalisez style, taille, couleur
5. Activez/désactivez les **Guides** (bleed, safe area)

### Réorganiser les pages

- **Drag & drop** dans la liste de gauche
- Les numéros se mettent à jour automatiquement
- Position gauche/droite calculée automatiquement

## 🔒 Sécurité

### Stockage de la clé API

La clé OpenAI est stockée via `keytar` qui utilise :
- **Windows** : Credential Vault
- **macOS** : Keychain
- **Linux** : Secret Service API / libsecret

### Service OpenAI local

Tous les appels OpenAI passent par un serveur Express local (`localhost:3001`) qui :
- Récupère la clé depuis le trousseau système
- Fait les appels API
- Retourne uniquement les résultats (jamais la clé)

La clé n'est **jamais** :
- Affichée dans l'UI
- Stockée en clair
- Envoyée au frontend
- Loggée dans la console

## 📁 Structure du projet

```
KidsBook Studio/
├── electron/               # Code Electron
│   ├── main.js            # Process principal
│   ├── preload.js         # Bridge sécurisé
│   └── openai-service.js  # Service OpenAI local
├── src/                   # Code React
│   ├── components/        # Composants UI
│   ├── views/            # Vues principales
│   ├── context/          # Context API
│   ├── App.js            # Composant racine
│   └── index.js          # Point d'entrée
├── public/               # Assets statiques
└── package.json          # Dépendances
```

### Structure d'un projet utilisateur

```
MonProjet_abc123/
├── project.json          # Métadonnées du projet
├── images/              # Images générées
├── exports/             # PDFs exportés
└── versions/            # Historique de versions
```

## 🛠️ Technologies utilisées

- **Electron** 27 : Application desktop multi-plateforme
- **React** 18 : Interface utilisateur
- **TailwindCSS** 3 : Styling
- **OpenAI API** : GPT-4 (texte) + DALL-E 3 (images)
- **electron-store** : Persistance locale
- **keytar** : Stockage sécurisé des secrets
- **react-beautiful-dnd** : Drag & drop
- **jsPDF** : Génération de PDF
- **Canvas API** : Rendu/mise en page des pages

## 🐛 Dépannage

### L'application ne démarre pas

```bash
# Nettoyer et réinstaller
rm -rf node_modules package-lock.json
npm install
npm start
```

### Erreur "OpenAI API key not configured"

1. Ouvrez les Paramètres (⚙️)
2. Vérifiez que la clé API est bien enregistrée
3. Testez la clé sur [platform.openai.com](https://platform.openai.com/)

### Les pages ne se sauvegardent pas

- Vérifiez que le dossier du projet existe
- Vérifiez les permissions d'écriture
- Consultez la console Electron (Ctrl+Shift+I)

### Erreur de build

```bash
# Windows : Installer windows-build-tools
npm install --global windows-build-tools

# Puis réinstaller
npm install
```

## 📝 Roadmap

Voir `MILESTONES.md` pour le plan de développement détaillé.

- ✅ **V0** : Structure de base + gestion projets
- ✅ **V1** : Écriture + Assistant IA
- 🚧 **V2** : Personnages + Illustrations
- 🚧 **V3** : Export KDP + Vérifications
- 🚧 **V4** : Polish + Optimisations

## 📄 Licence

© 2026 KidsBook Studio - Tous droits réservés

## 🤝 Support

Pour toute question ou problème :
- Consultez la documentation
- Vérifiez les issues GitHub
- Contactez le support

---

**Fait avec ❤️ pour les auteurs de livres jeunesse**
