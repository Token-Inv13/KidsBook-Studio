# Plan de développement - KidsBook Studio

## Vue d'ensemble

Le développement est organisé en 5 milestones progressives, de V0 à V4.  
Chaque version ajoute des fonctionnalités tout en maintenant la stabilité.

---

## ✅ V0 - Fondations (COMPLÉTÉ)

**Objectif** : Structure de base + gestion de projets

### Fonctionnalités

- [x] Configuration Electron + React + TailwindCSS
- [x] Service OpenAI sécurisé (localhost)
- [x] Stockage sécurisé de la clé API (keytar)
- [x] Navigation entre vues (Sidebar)
- [x] TopBar avec informations projet
- [x] Modal de paramètres
- [x] Context API pour état global
- [x] Persistance locale (electron-store)

### Livrables

- [x] Structure complète du repo
- [x] Configuration package.json
- [x] Electron main process
- [x] OpenAI service local
- [x] Preload script sécurisé
- [x] Composants UI de base

### Tests V0

- [x] Application démarre sans erreur
- [x] Clé API peut être enregistrée
- [x] Navigation fonctionne
- [x] Autosave activé par défaut

---

## ✅ V1 - Écriture & IA (COMPLÉTÉ)

**Objectif** : Espace d'écriture complet avec assistant IA

### Fonctionnalités

- [x] Vue Projets avec wizard de création
- [x] Gestion complète des projets (créer, ouvrir, dupliquer, supprimer)
- [x] Assistant de création en 3 étapes
- [x] Validation des formats KDP
- [x] Vue Écriture avec 3 panneaux
- [x] Liste de pages avec drag & drop
- [x] Éditeur WYSIWYG avec guides (bleed, safe area)
- [x] Blocs de texte éditables
- [x] Styles de texte (narration, dialogue, titre, morale)
- [x] Chat IA avec GPT-4
- [x] Actions rapides IA
- [x] Insertion automatique dans pages
- [x] Auto-découpage de l'histoire en pages
- [x] Historique de conversation persistant
- [x] Tracking de consommation OpenAI

### Livrables

- [x] ProjectsView + ProjectWizard
- [x] WritingView
- [x] PageList avec react-beautiful-dnd
- [x] PageEditor avec canvas
- [x] AIChat avec intégration OpenAI
- [x] Système de sauvegarde automatique

### Tests V1

- [x] Créer un projet via wizard
- [x] Ouvrir un projet existant
- [x] Ajouter/supprimer des pages
- [x] Réorganiser pages par drag & drop
- [x] Ajouter blocs de texte
- [x] Éditer texte inline
- [x] Changer styles de texte
- [x] Envoyer message à l'IA
- [x] Utiliser actions rapides
- [x] Insérer réponse IA dans page
- [x] Auto-découper une histoire
- [x] Vérifier autosave (attendre 2s)
- [x] Fermer et rouvrir projet (données persistées)

---

## 🚧 V2 - Personnages & Illustrations (EN COURS)

**Objectif** : Gestion de l'univers + génération d'images

### Fonctionnalités à implémenter

#### Vue Personnages & Univers

- [ ] Gestion des personnages
  - [ ] Nom, âge, description physique
  - [ ] Vêtements, personnalité
  - [ ] Image de référence (upload)
  - [ ] Formulaire d'édition
- [ ] Gestion des lieux
  - [ ] Lieux prédéfinis (maison, école, forêt, etc.)
  - [ ] Ajout de lieux personnalisés
  - [ ] Description détaillée
- [ ] Style artistique global
  - [ ] Sélection du style (aquarelle, pastel, cartoon, etc.)
  - [ ] Prévisualisation
  - [ ] Application automatique aux générations

#### Vue Illustrations

- [ ] Générateur d'images intégré
  - [ ] Sélection de la page cible
  - [ ] Construction du prompt
  - [ ] Sélection personnage(s)
  - [ ] Sélection lieu
  - [ ] Ratio automatique selon format page
  - [ ] Génération 1-4 variantes
  - [ ] Bouton "Placer dans la page"
- [ ] Bibliothèque d'images
  - [ ] Toutes les images du projet
  - [ ] Historique des versions
  - [ ] Recherche et filtres
  - [ ] Suppression d'images
- [ ] Fonction globale
  - [ ] "Générer illustrations pour toutes les pages sans image"
  - [ ] Utilise les prompts d'illustration des pages
  - [ ] Barre de progression

#### Intégration

- [ ] Injection automatique des personnages/lieux dans prompts
- [ ] Cohérence visuelle entre illustrations
- [ ] Stockage images dans dossier projet
- [ ] Optimisation taille/qualité pour KDP

### Livrables V2

- [ ] CharactersView complète
- [ ] IllustrationsView complète
- [ ] Composant CharacterForm
- [ ] Composant LocationManager
- [ ] Composant ImageGenerator
- [ ] Composant ImageLibrary
- [ ] Service de génération d'images
- [ ] Système de cache d'images

### Tests V2

- [ ] Créer un personnage
- [ ] Modifier un personnage
- [ ] Supprimer un personnage
- [ ] Ajouter un lieu personnalisé
- [ ] Changer le style artistique
- [ ] Générer une image pour une page
- [ ] Générer 4 variantes
- [ ] Placer une image dans une page
- [ ] Voir la bibliothèque d'images
- [ ] Générer toutes les illustrations manquantes
- [ ] Vérifier cohérence visuelle
- [ ] Vérifier stockage dans dossier projet

---

## 🚧 V3 - Export KDP (PLANIFIÉ)

**Objectif** : Vérifications + export PDF print-ready

### Fonctionnalités à implémenter

#### Vérifications automatiques

- [ ] Analyse pré-export
  - [ ] Texte hors safe area
  - [ ] Images basse résolution (<300 DPI)
  - [ ] Pages vides
  - [ ] Polices non embarquées
  - [ ] Bleed incorrect
  - [ ] Format incompatible KDP
- [ ] Statut visuel
  - [ ] VERT : Prêt à publier
  - [ ] ORANGE : Avertissements
  - [ ] ROUGE : Erreurs bloquantes
- [ ] Liste détaillée des problèmes
  - [ ] Description
  - [ ] Page concernée
  - [ ] Suggestion de correction

#### Export PDF

- [ ] PDF intérieur print-ready
  - [ ] Polices embarquées
  - [ ] Images 300 DPI minimum
  - [ ] Bleed correct (0.125")
  - [ ] Trim marks optionnels
  - [ ] Couleurs CMYK
- [ ] PDF couverture
  - [ ] Full spread (back + spine + front)
  - [ ] Calcul automatique du spine
  - [ ] Template KDP importable
  - [ ] Guides de sécurité
- [ ] Package ZIP complet
  - [ ] PDF intérieur
  - [ ] PDF couverture
  - [ ] Métadonnées
  - [ ] README

#### Outils supplémentaires

- [ ] Calculateur de spine
- [ ] Prévisualisation 3D du livre
- [ ] Checklist de publication KDP
- [ ] Export des métadonnées (titre, auteur, ISBN, etc.)

### Livrables V3

- [ ] ExportView complète
- [ ] Composant VerificationPanel
- [ ] Composant PDFExporter
- [ ] Service de génération PDF (PDFKit)
- [ ] Service de vérification
- [ ] Composant CoverDesigner
- [ ] Calculateur de spine

### Tests V3

- [ ] Lancer vérification automatique
- [ ] Voir liste des problèmes
- [ ] Corriger un problème
- [ ] Re-vérifier
- [ ] Exporter PDF intérieur
- [ ] Vérifier PDF dans Adobe Reader
- [ ] Exporter PDF couverture
- [ ] Vérifier dimensions couverture
- [ ] Créer package ZIP
- [ ] Vérifier contenu du ZIP
- [ ] Importer template KDP
- [ ] Calculer spine pour 32 pages

---

## 🚧 V4 - Polish & Optimisations (PLANIFIÉ)

**Objectif** : Finitions + expérience utilisateur optimale

### Fonctionnalités à implémenter

#### Améliorations UX

- [ ] Raccourcis clavier
  - [ ] Ctrl+S : Sauvegarde manuelle
  - [ ] Ctrl+Z : Undo
  - [ ] Ctrl+Y : Redo
  - [ ] Ctrl+N : Nouveau projet
  - [ ] Ctrl+O : Ouvrir projet
- [ ] Undo/Redo global
  - [ ] Historique des actions
  - [ ] Timeline visuelle
  - [ ] Restauration de versions
- [ ] Thèmes
  - [ ] Mode clair/sombre
  - [ ] Personnalisation couleurs
- [ ] Tutoriel interactif
  - [ ] Premier lancement
  - [ ] Tooltips contextuels
  - [ ] Vidéos d'aide

#### Bibliothèque de ressources

- [ ] Polices
  - [ ] Polices pré-installées
  - [ ] Import de polices personnalisées
  - [ ] Prévisualisation
- [ ] Backgrounds
  - [ ] Textures pour pages
  - [ ] Patterns
  - [ ] Dégradés
- [ ] Templates
  - [ ] Templates de pages
  - [ ] Templates de livres complets
  - [ ] Import/Export de templates

#### Performance

- [ ] Optimisation du rendu
  - [ ] Virtualisation de la liste de pages
  - [ ] Lazy loading des images
  - [ ] Debouncing de l'autosave
- [ ] Compression d'images
  - [ ] Optimisation automatique
  - [ ] Choix qualité/taille
- [ ] Cache intelligent
  - [ ] Cache des réponses IA
  - [ ] Cache des images générées

#### Fonctionnalités avancées

- [ ] Collaboration
  - [ ] Export/Import de projets
  - [ ] Commentaires sur pages
  - [ ] Historique de versions détaillé
- [ ] Analytics
  - [ ] Statistiques d'utilisation OpenAI
  - [ ] Coût par projet
  - [ ] Temps de travail
- [ ] Backup automatique
  - [ ] Sauvegarde cloud optionnelle
  - [ ] Backup local automatique
  - [ ] Restauration de backup

### Livrables V4

- [ ] Système de raccourcis
- [ ] Undo/Redo manager
- [ ] Theme switcher
- [ ] Tutorial component
- [ ] Resource library
- [ ] Performance optimizations
- [ ] Analytics dashboard
- [ ] Backup system

### Tests V4

- [ ] Tester tous les raccourcis clavier
- [ ] Undo/Redo plusieurs actions
- [ ] Changer de thème
- [ ] Suivre le tutoriel complet
- [ ] Importer une police personnalisée
- [ ] Utiliser un template de page
- [ ] Vérifier performance avec 50+ pages
- [ ] Exporter un projet
- [ ] Importer un projet
- [ ] Voir analytics de consommation
- [ ] Créer un backup
- [ ] Restaurer un backup

---

## 📊 Métriques de succès

### V0-V1 (Actuel)
- ✅ Application démarre en <3 secondes
- ✅ Aucun crash pendant 30 minutes d'utilisation
- ✅ Clé API stockée de manière sécurisée
- ✅ Autosave fonctionne sans perte de données

### V2
- [ ] Génération d'image en <30 secondes
- [ ] Cohérence visuelle >80% (évaluation manuelle)
- [ ] Bibliothèque supporte 100+ images

### V3
- [ ] Export PDF en <10 secondes
- [ ] 100% de compatibilité KDP
- [ ] Vérifications détectent 95%+ des problèmes

### V4
- [ ] Temps de réponse UI <100ms
- [ ] Satisfaction utilisateur >4.5/5
- [ ] Taux de complétion tutoriel >70%

---

## 🎯 Prochaines étapes

**Priorité immédiate** : V2 - Personnages & Illustrations

1. Implémenter CharactersView
2. Créer le système de gestion des personnages
3. Implémenter IllustrationsView
4. Intégrer DALL-E 3 pour génération d'images
5. Créer la bibliothèque d'images
6. Tests complets V2

**Estimation** : 2-3 semaines de développement

---

**Dernière mise à jour** : 26 février 2026
