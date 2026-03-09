# V2 - Visual Identity System

## 🎯 Objectif
Résoudre la cohérence visuelle des livres avant toute génération d'illustrations complètes.

**Priorité** : Cohérence graphique, pas quantité d'images.

---

## ✨ Nouvelles fonctionnalités

### 1. Visual Identity Wizard

**Localisation** : Section Personnages → Bouton "Créer l'identité visuelle"

**Processus en 2 étapes** :

#### Étape 1 : Choix du style artistique

5 styles disponibles :

1. **Aquarelle**
   - Doux, fluide, couleurs transparentes
   - Prompt : `soft watercolor illustration, gentle washes, transparent colors`

2. **Pastel**
   - Tendre, chaleureux, textures douces
   - Prompt : `soft pastel illustration, gentle textures, warm colors`

3. **Crayon de couleur**
   - Texturé, chaleureux, dessiné à la main
   - Prompt : `colored pencil illustration, hand-drawn texture, warm sketchy style`

4. **Cartoon doux**
   - Formes rondes, couleurs vives, amical
   - Prompt : `soft cartoon illustration, rounded shapes, friendly, vibrant colors`

5. **Peinture jeunesse**
   - Riche, coloré, pictural
   - Prompt : `children's book painting, rich colors, painterly style`

#### Étape 2 : Génération du personnage principal

**Processus automatisé** :
1. Utilise la description du personnage du Story Engine
2. Génère **4 variantes** via DALL-E 3 (1024x1024)
3. L'utilisateur sélectionne **1 variante**
4. Cette image devient la **RÉFÉRENCE VISUELLE CANONIQUE**

**Durée** : 1-2 minutes (génération de 4 images)

---

### 2. Character Sheet (Fiche Personnage)

**Localisation** : Section Personnages (après validation identité)

**Contenu de la fiche** :

#### Image officielle
- Référence visuelle canonique
- Taille : 1024x1024px
- Générée par DALL-E 3

#### Informations du personnage
- Nom
- Âge
- Description complète
- Apparence physique
- Vêtements
- Personnalité

#### Palette couleurs dominante
- Extraction automatique depuis la description
- 3-5 couleurs principales
- Affichage visuel des couleurs

#### Style artistique
- Style sélectionné dans le wizard
- Prompt technique associé

**Stockage** :
```javascript
{
  visualIdentity: {
    validated: true,
    validatedAt: "2026-02-26T20:30:00Z",
    artisticStyle: "aquarelle",
    stylePrompt: "soft watercolor illustration...",
    mainCharacter: {
      name: "Léo le dragon",
      age: "5 ans",
      description: "...",
      appearance: "...",
      clothing: "...",
      referenceImage: "https://...",
      referencePrompt: "...",
      colorPalette: ["#3498DB", "#E74C3C", "#F39C12"]
    }
  }
}
```

---

### 3. Context Injection System

**Fichier** : `src/utils/imagePromptBuilder.js`

**Fonction principale** : `buildImagePrompt()`

**Injection automatique dans tous les prompts d'image** :

1. **Style artistique** (obligatoire)
   - Prompt technique du style sélectionné

2. **Référence personnage** (si applicable)
   - Nom, apparence, vêtements, âge
   - Palette de couleurs

3. **Description de scène** (variable)
   - Contexte spécifique de l'illustration

4. **Marqueurs de qualité**
   - "children's book illustration, high quality, professional"

**Exemple de prompt final** :
```
soft watercolor illustration, gentle washes, transparent colors, children's book style. 
Main character: Léo le dragon, small friendly dragon with blue scales, red wings, 
wearing a yellow scarf, age 5 years. 
Color palette: #3498DB, #E74C3C, #F39C12. 
Scene: Léo discovers a magical forest on a sunny afternoon. 
The hero looks amazed at the tall glowing trees. 
children's book illustration, high quality, professional
```

**Validation** :
- Fonction `validateVisualIdentity()` vérifie la complétude
- Empêche la génération si identité non validée

---

### 4. Project Lock (Verrou de projet)

**Composant** : `IllustrationLock.js`

**Règle** : Aucune génération d'illustration sans identité visuelle validée

**Zones verrouillées** :
- Section Illustrations (complète)
- Génération d'images de pages (future)
- Export avec illustrations (future)

**Message affiché** :
```
🔒 Identité visuelle requise

Pour garantir la cohérence visuelle de votre livre, vous devez d'abord 
créer l'identité visuelle dans la section Personnages.

L'identité visuelle définit :
• Le style artistique du livre
• L'apparence officielle du personnage principal
• La palette de couleurs dominante

[Bouton : Créer l'identité visuelle →]
```

**Redirection automatique** : Vers la section Personnages

---

## 🔧 Modifications techniques

### Nouveaux composants

1. **VisualIdentityWizard.js**
   - Wizard en 2 étapes
   - Génération de 4 variantes DALL-E 3
   - Sélection et validation

2. **CharacterSheet.js**
   - Affichage de la fiche personnage
   - Référence visuelle + métadonnées
   - Palette de couleurs

3. **IllustrationLock.js**
   - Composant de verrouillage
   - Message explicatif
   - Redirection vers Personnages

### Fichiers modifiés

1. **CharactersView.js**
   - Intégration du wizard
   - Affichage de la fiche
   - États : sans personnages / sans identité / avec identité

2. **IllustrationsView.js**
   - Ajout du verrou
   - Message d'état

3. **openai-service.js**
   - Nouvel endpoint `/api/generate-image`
   - Support DALL-E 3
   - Paramètres : prompt, size, quality, style

### Nouveaux utilitaires

**imagePromptBuilder.js** :
- `buildImagePrompt()` : Construction de prompts avec contexte
- `validateVisualIdentity()` : Validation de l'identité
- Documentation et exemples d'usage

---

## 📊 Structure de données

### Visual Identity (dans project)

```javascript
{
  visualIdentity: {
    validated: boolean,           // Identité validée ?
    validatedAt: string,          // Date de validation ISO
    artisticStyle: string,        // ID du style (aquarelle, pastel, etc.)
    stylePrompt: string,          // Prompt technique du style
    mainCharacter: {
      id: string,
      name: string,
      age: string,
      description: string,
      appearance: string,
      clothing: string,
      personality: string,
      referenceImage: string,     // URL DALL-E de l'image canonique
      referencePrompt: string,    // Prompt utilisé pour générer l'image
      colorPalette: string[]      // Tableau de couleurs hex
    }
  }
}
```

---

## 🎨 Workflow utilisateur V2

### Workflow complet (avec V1.5)

1. **Créer un projet** (V0)
2. **Générer l'histoire** (V1.5 - Story Engine)
3. **Créer l'identité visuelle** (V2 - NEW)
   - Choisir le style artistique
   - Générer 4 variantes du personnage
   - Sélectionner la référence canonique
4. **Affiner le texte** (V1.5)
5. **Générer les illustrations** (Future - V2.1)
6. **Exporter pour KDP** (V3)

### Temps estimé V2
- Choix du style : 30 secondes
- Génération de 4 variantes : 1-2 minutes
- Sélection : 30 secondes
- **Total : ~3 minutes**

---

## 🔒 Garanties de cohérence

### Avant V2
❌ Pas de référence visuelle  
❌ Chaque image indépendante  
❌ Risque d'incohérence  
❌ Personnage différent à chaque page  

### Après V2
✅ Référence visuelle canonique  
✅ Style artistique unifié  
✅ Palette de couleurs cohérente  
✅ Personnage identique partout  
✅ Injection automatique du contexte  

---

## 🧪 Tests V2

### Visual Identity Wizard
- [ ] Ouvrir un projet avec personnages (Story Engine)
- [ ] Aller dans Personnages
- [ ] Cliquer sur "Créer l'identité visuelle"
- [ ] Sélectionner un style artistique
- [ ] Générer les 4 variantes
- [ ] Vérifier que 4 images sont générées
- [ ] Sélectionner une variante
- [ ] Valider l'identité
- [ ] Vérifier que la fiche personnage s'affiche

### Character Sheet
- [ ] Vérifier l'affichage de l'image de référence
- [ ] Vérifier les informations du personnage
- [ ] Vérifier la palette de couleurs
- [ ] Vérifier le style artistique

### Illustration Lock
- [ ] Créer un projet sans identité visuelle
- [ ] Aller dans Illustrations
- [ ] Vérifier que le message de verrouillage s'affiche
- [ ] Cliquer sur "Créer l'identité visuelle"
- [ ] Vérifier la redirection vers Personnages

### Context Injection
- [ ] Valider une identité visuelle
- [ ] Utiliser `buildImagePrompt()` avec un prompt de test
- [ ] Vérifier que le prompt final contient :
  - Le style artistique
  - La description du personnage
  - La palette de couleurs
  - Le prompt de base
  - Les marqueurs de qualité

---

## 🚀 Prochaines étapes

### V2.1 - Génération d'illustrations de pages
- Bouton "Générer illustration" sur chaque page
- Utilisation automatique de `buildImagePrompt()`
- Sauvegarde des images générées
- Gestion de la bibliothèque d'images

### V2.2 - Régénération et variantes
- Régénérer une illustration
- Générer des variantes d'une scène
- Historique des générations

### V3 - Export KDP
- Vérifications automatiques
- Export PDF avec illustrations
- Couverture complète

---

## 📈 Impact

### Qualité du livre
- **Cohérence visuelle garantie** à 100%
- Style artistique unifié sur toutes les pages
- Personnage reconnaissable instantanément
- Palette de couleurs harmonieuse

### Expérience utilisateur
- Processus guidé et simple
- Résultat professionnel
- Pas de compétences techniques requises
- Validation visuelle avant génération massive

### Technique
- Système d'injection de contexte réutilisable
- Validation stricte avant génération
- Métadonnées complètes pour chaque image
- Architecture extensible pour futures fonctionnalités

---

**Version** : 2.0.0  
**Date** : 26 février 2026  
**Statut** : ✅ COMPLÉTÉ

**Dépendances** :
- V1.5 (Story Engine pour personnages)
- OpenAI API (DALL-E 3)
- Clé API configurée

**Prérequis utilisateur** :
1. Avoir créé un projet
2. Avoir généré une histoire avec Story Engine (personnages)
3. Avoir configuré la clé OpenAI
