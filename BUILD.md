# KidsBook Studio - Build & Packaging Guide

## 📦 Windows Desktop Packaging

Ce guide explique comment créer un installateur Windows (.exe) pour KidsBook Studio.

---

## 🔧 Prérequis

- Node.js 18+ installé
- npm ou yarn
- Windows 10/11 (pour build Windows)
- ~2 GB d'espace disque libre

---

## 🚀 Build Production

### 1. Installation des dépendances

```bash
npm install
```

### 2. Build React Production

```bash
npm run build
```

Cela crée le dossier `build/` avec les fichiers statiques optimisés.

### 3. Build Installateur Windows

```bash
npm run dist
```

Ou pour build sans compression (plus rapide pour tests) :

```bash
npm run dist:dir
```

Pour générer l'installateur autonome du dépôt, utiliser aussi :

```powershell
.\scripts\build-windows-installer.ps1
```

---

## 📁 Structure des Fichiers

### Fichiers de Build

```
dist/
├── KidsBook Studio Setup 0.1.0.exe    # Installateur NSIS
├── win-unpacked/                       # Version non packagée (pour tests)
└── builder-debug.yml                   # Logs de build
```

Le script `scripts/build-windows-installer.ps1` produit également un `KidsBook Studio Setup.exe` autonome à partir du projet `installer/KidsBookInstaller.csproj`.

### Données Utilisateur

En production, l'application stocke les données dans :

```
C:\Users\[Username]\Documents\KidsBookStudio\
├── Projects/              # Projets utilisateur
├── Config/                # Configuration electron-store
└── Logs/                  # Logs application
```

---

## 🎯 Configuration Installateur

### NSIS (Windows)

L'installateur Windows est configuré avec :

- ✅ **Installation personnalisable** - L'utilisateur peut choisir le dossier
- ✅ **Raccourci Bureau** - Créé automatiquement
- ✅ **Raccourci Menu Démarrer** - Dans "KidsBook Studio"
- ✅ **Désinstallation propre** - Garde les données utilisateur
- ✅ **Lancement après installation** - Option activée

### Fichiers Inclus

```json
"files": [
  "build/**/*",           // Frontend React compilé
  "electron/**/*",        // Code Electron
  "node_modules/**/*",    // Dépendances
  "package.json"
]
```

---

## 🔍 Mode Production vs Développement

### Développement

```bash
npm start
```

- Serveur React sur `http://localhost:3000`
- Hot reload activé
- DevTools ouvert
- Service OpenAI sur port 3001

### Production

```bash
npm run dist
# Puis installer l'exe généré
```

- Fichiers statiques chargés depuis `build/`
- Pas de serveur dev
- DevTools désactivé
- Service OpenAI auto-start
- Données dans `Documents/KidsBookStudio/`

---

## 🧪 Tests Recommandés

Après installation, tester :

### 1. Installation
- [ ] L'installateur se lance sans erreur
- [ ] Choix du dossier d'installation fonctionne
- [ ] Raccourci bureau créé
- [ ] Raccourci menu démarrer créé
- [ ] Application se lance après installation

### 2. Fonctionnalités Core
- [ ] Création d'un nouveau projet
- [ ] Sauvegarde du projet
- [ ] Génération d'histoire (Story Engine)
- [ ] Génération d'images (DALL-E)
- [ ] Export PDF (Interior + Cover)

### 3. Persistance
- [ ] Fermer et rouvrir l'application
- [ ] Les projets sont toujours là
- [ ] La clé API est conservée
- [ ] Les paramètres sont sauvegardés

### 4. Désinstallation
- [ ] Désinstallation propre
- [ ] Données utilisateur conservées dans Documents/
- [ ] Possibilité de réinstaller

---

## 🐛 Dépannage

### Build échoue

**Erreur : "Cannot find module"**
```bash
rm -rf node_modules
npm install
npm run build
npm run dist
```

**Erreur : "ENOENT: no such file or directory, open 'build/index.html'"**
```bash
npm run build  # Build React d'abord
npm run dist   # Puis build Electron
```

### Installateur ne se lance pas

- Vérifier l'antivirus (peut bloquer les .exe non signés)
- Exécuter en tant qu'administrateur
- Vérifier les logs dans `dist/builder-debug.yml`

### Application ne démarre pas après installation

- Vérifier les logs dans `%APPDATA%\KidsBookStudio\logs\`
- Réinstaller avec droits administrateur
- Vérifier que Node.js natifs modules sont compilés correctement

---

## 📝 Scripts Disponibles

| Script | Description |
|--------|-------------|
| `npm start` | Développement (React + Electron) |
| `npm run build` | Build React production |
| `npm run dist` | Build installateur Windows |
| `npm run dist:dir` | Build sans compression (tests) |
| `npm run build:electron` | Build + package Electron |

---

## 🔐 Signature de Code (Optionnel)

Pour éviter les avertissements Windows SmartScreen, signer le .exe :

1. Obtenir un certificat de signature de code
2. Configurer dans `package.json` :

```json
"win": {
  "certificateFile": "path/to/cert.pfx",
  "certificatePassword": "password"
}
```

---

## 📊 Taille de l'Application

| Composant | Taille |
|-----------|--------|
| Installateur | ~150-200 MB |
| Application installée | ~300-400 MB |
| Données utilisateur | Variable (projets) |

---

## 🚀 Optimisations Production

### Déjà Implémentées

- ✅ Code minifié (React build)
- ✅ Tree shaking
- ✅ Compression NSIS
- ✅ Lazy loading des modules
- ✅ Cache des assets

### Futures Optimisations

- [ ] Code splitting avancé
- [ ] Compression Brotli
- [ ] Auto-update (electron-updater)
- [ ] Signature de code

---

## 📞 Support

Pour les problèmes de build :

1. Vérifier les logs dans `dist/builder-debug.yml`
2. Vérifier la console pendant le build
3. Nettoyer et rebuilder (`rm -rf dist build node_modules`)

---

**Dernière mise à jour** : 26 février 2026  
**Version** : 0.1.0
