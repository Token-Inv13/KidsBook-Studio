# KidsBook Studio - Quick Start Guide

## 🚀 Installation rapide

```bash
cd "c:/Users/token/Documents/KidsBook Studio"
npm install
npm start
```

L'application s'ouvrira automatiquement.

---

## ⚙️ Configuration initiale

### 1. Configurer la clé API OpenAI

Au premier lancement :
1. Cliquez sur l'icône **⚙️ Paramètres** en haut à droite
2. Entrez votre clé API OpenAI (format: `sk-...`)
3. Cliquez sur **Enregistrer**

> 🔒 Votre clé est stockée de manière sécurisée dans le trousseau Windows

---

## 📚 Créer votre premier livre (V1.5)

### Méthode 1 : Story Engine (Recommandée)

**Génération complète automatique** ✨

1. Cliquez sur **Nouveau Projet**
2. Remplissez le wizard (titre, auteur, âge, format)
3. Une fois le projet créé, cliquez sur **Créer un livre complet**
4. Remplissez :
   - Thème (ex: "L'amitié")
   - Personnage principal (ex: "Un petit dragon timide")
   - Problème (ex: "Il a peur de voler")
   - Morale (optionnel)
   - Nombre de pages (12 recommandé)
5. Cliquez sur **Générer l'histoire**

⏱️ **Attendez 30-60 secondes**

✅ **Résultat** : Livre complet avec :
- 12 pages structurées
- Texte adapté à l'âge cible
- Personnages extraits automatiquement
- Résumé narratif généré
- Prompts d'illustration prêts

### Méthode 2 : Création manuelle

1. Créez un nouveau projet
2. Allez dans **Écriture**
3. Cliquez sur **Nouvelle Page**
4. Choisissez un template :
   - **Illustration pleine page** : Image + texte en bas
   - **Texte court** : Texte centré (titres)
   - **Mixte** : Image en haut + texte en bas
   - **Double page** : Image plein écran + texte superposé
5. Éditez le texte directement sur la page
6. Utilisez le **Chat IA** pour obtenir de l'aide

---

## 🤖 Utiliser l'assistant IA

Le chat IA est **contextuel** : il connaît votre projet en temps réel.

### Actions rapides disponibles

- **Écrire l'histoire** : Génère une histoire complète
- **Simplifier** : Adapte le texte à l'âge cible
- **Découper en pages** : Découpe une histoire longue

### Exemples de prompts

```
"Ajoute une page où le héros rencontre un ami"
"Rends cette page plus drôle pour des enfants de 5 ans"
"Crée un dialogue entre les deux personnages"
"Propose une fin alternative"
```

> 💡 L'IA connaît automatiquement :
> - Votre résumé
> - Vos personnages
> - Le contenu de toutes vos pages
> - L'âge cible et le type de livre

---

## ✂️ Distribuer du texte long

Si vous avez écrit votre histoire dans Word/Google Docs :

1. Créez d'abord vos pages (ex: 12 pages)
2. Cliquez sur **Distribuer du texte** (en haut de l'espace Écriture)
3. Collez votre texte complet
4. Cliquez sur **Distribuer**

L'IA va :
- Découper intelligemment le texte
- Répartir sur vos pages existantes
- Adapter le vocabulaire à l'âge cible
- Faire des coupures narratives naturelles

---

## 📖 Résumé du livre

Le **panneau Résumé** en haut de l'espace Écriture :

- **Génération auto** : Cliquez sur "Générer"
- **Édition manuelle** : Modifiez directement
- **Utilité** : L'IA l'utilise pour maintenir la cohérence

> 🎯 Le résumé est la "mémoire narrative" de votre livre

---

## 🎨 Templates de pages

Chaque template crée automatiquement les zones appropriées :

### Illustration pleine page
```
┌─────────────────┐
│                 │
│     IMAGE       │
│    (grande)     │
│                 │
├─────────────────┤
│  Texte centré   │
└─────────────────┘
```

### Mixte (Standard)
```
┌─────────────────┐
│     IMAGE       │
│     (60%)       │
├─────────────────┤
│                 │
│  Texte narratif │
│     (40%)       │
└─────────────────┘
```

### Double page
```
┌─────────────────┐
│                 │
│  IMAGE PLEINE   │
│                 │
│  ┌──────────┐   │
│  │  Texte   │   │
│  └──────────┘   │
└─────────────────┘
```

---

## 🔄 Workflow complet

### Workflow rapide (Story Engine)

1. **Nouveau Projet** → Wizard
2. **Créer un livre complet** → Story Engine
3. **Affiner** → Édition manuelle + Chat IA
4. **Illustrations** → V2 (à venir)
5. **Export KDP** → V3 (à venir)

⏱️ **Temps estimé** : 5-10 minutes pour un livre de 12 pages

### Workflow manuel

1. **Nouveau Projet** → Wizard
2. **Nouvelle Page** → Choisir template
3. **Éditer texte** → Directement sur page
4. **Chat IA** → Aide contextuelle
5. **Répéter** pour chaque page

⏱️ **Temps estimé** : 30-60 minutes

---

## 💡 Astuces

### Cohérence narrative
- Générez le **résumé** dès que vous avez quelques pages
- L'IA l'utilisera pour rester cohérent
- Mettez-le à jour si l'histoire évolue

### Personnages
- Utilisez le **Story Engine** pour extraire automatiquement les personnages
- Ou créez-les manuellement (V2)
- L'IA les mentionnera dans ses suggestions

### Édition de texte
- Double-cliquez sur un bloc pour éditer
- Utilisez le panneau en bas pour changer style/taille/couleur
- Les modifications sont sauvegardées automatiquement

### Guides visuels
- Activez les **Guides** pour voir :
  - Zone de bleed (rouge)
  - Safe area (vert)
- Respectez la safe area pour le texte important

---

## 🆘 Problèmes courants

### "OpenAI API key not configured"
→ Allez dans Paramètres et enregistrez votre clé

### "Failed to generate story"
→ Vérifiez votre connexion internet et votre crédit OpenAI

### Les pages ne se sauvegardent pas
→ Vérifiez que le dossier projet existe et est accessible

### L'IA ne respecte pas le contexte
→ Générez/mettez à jour le résumé du livre

---

## 📊 Versions

- **V0** : Structure de base ✅
- **V1** : Écriture + IA basique ✅
- **V1.5** : Story Engine + Templates + Contexte ✅
- **V2** : Personnages + Illustrations (à venir)
- **V3** : Export KDP (à venir)
- **V4** : Polish + Optimisations (à venir)

---

## 🎯 Prochaines étapes

Après avoir créé votre livre :

1. **Affinez le texte** avec le chat IA
2. **Attendez V2** pour générer les illustrations
3. **Attendez V3** pour exporter vers KDP

---

**Besoin d'aide ?** Consultez `README.md` pour plus de détails.

**Version actuelle** : 1.5.0  
**Date** : 26 février 2026
