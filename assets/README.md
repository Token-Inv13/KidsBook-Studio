# Assets - Application Icons

## 📋 Required Icons

Pour le packaging Windows, vous devez créer les icônes suivantes :

### Windows
- **icon.ico** - Icône Windows (256x256, 128x128, 64x64, 48x48, 32x32, 16x16)

### macOS (optionnel)
- **icon.icns** - Icône macOS

### Linux (optionnel)
- **icon.png** - Icône PNG (512x512)

---

## 🎨 Création des Icônes

### Option 1 : Outil en ligne
1. Créer un logo 512x512 px
2. Utiliser https://www.icoconverter.com/
3. Générer les formats .ico, .icns, .png

### Option 2 : Photoshop/GIMP
1. Créer un design 512x512 px
2. Exporter en PNG
3. Convertir avec ImageMagick :
```bash
convert icon.png -define icon:auto-resize=256,128,64,48,32,16 icon.ico
```

---

## 🖼️ Recommandations Design

- **Style** : Simple, reconnaissable, professionnel
- **Couleurs** : Vives mais pas agressives
- **Thème** : Livre pour enfants, créativité, éducation
- **Format** : Carré avec coins arrondis
- **Fond** : Transparent ou couleur unie

### Exemple de Concept
- 📚 Livre ouvert avec crayon/pinceau
- 🎨 Palette de couleurs avec livre
- ✨ Étoiles magiques autour d'un livre
- 🌈 Arc-en-ciel avec livre

---

## 🔧 Icône Temporaire

En attendant une icône personnalisée, vous pouvez :

1. Utiliser une icône de placeholder
2. Générer une icône simple avec du texte "KB"
3. Utiliser un emoji converti en icône

---

## 📝 Note

L'application fonctionnera sans icône personnalisée (icône par défaut Electron), mais une icône professionnelle améliore grandement l'expérience utilisateur.

Pour l'instant, le build utilisera l'icône par défaut si `icon.ico` n'existe pas.
