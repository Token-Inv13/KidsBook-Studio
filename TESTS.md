# Checklists de tests - KidsBook Studio

## 🧪 Tests V0 - Fondations

### Installation

- [ ] Node.js 18+ installé
- [ ] `npm install` s'exécute sans erreur
- [ ] Aucune vulnérabilité critique dans les dépendances
- [ ] Tous les packages sont installés

### Démarrage

- [ ] `npm start` démarre sans erreur
- [ ] React dev server démarre sur port 3000
- [ ] OpenAI service démarre sur port 3001
- [ ] Fenêtre Electron s'ouvre en <5 secondes
- [ ] Aucune erreur dans la console Electron
- [ ] Aucune erreur dans la console React

### Configuration initiale

- [ ] Modal de paramètres s'ouvre automatiquement si pas de clé API
- [ ] Peut ouvrir les paramètres manuellement (icône ⚙️)
- [ ] Champ de clé API est de type password par défaut
- [ ] Bouton "Afficher/Masquer" fonctionne
- [ ] Clé API peut être enregistrée
- [ ] Message de succès s'affiche
- [ ] Modal se ferme après enregistrement
- [ ] Clé API persiste après redémarrage

### Navigation

- [ ] Sidebar affiche 5 vues
- [ ] Clic sur "Projets" affiche ProjectsView
- [ ] Clic sur "Écriture" affiche WritingView
- [ ] Clic sur "Personnages" affiche CharactersView
- [ ] Clic sur "Illustrations" affiche IllustrationsView
- [ ] Clic sur "Export KDP" affiche ExportView
- [ ] Vue active est mise en surbrillance
- [ ] Transition entre vues est fluide

### TopBar

- [ ] TopBar affiche "Aucun projet ouvert" par défaut
- [ ] Bouton paramètres fonctionne
- [ ] TopBar se met à jour quand projet ouvert

### Sécurité

- [ ] Clé API n'apparaît jamais en clair dans l'UI
- [ ] Clé API n'est pas dans le localStorage
- [ ] Clé API n'est pas dans electron-store
- [ ] Service OpenAI est sur localhost uniquement
- [ ] Aucune erreur CORS

---

## 🧪 Tests V1 - Écriture & IA

### Gestion de projets

#### Création de projet

- [ ] Bouton "Nouveau Projet" ouvre le wizard
- [ ] Wizard affiche 3 étapes avec indicateur de progression
- [ ] **Étape 1** : Tous les champs sont requis
- [ ] **Étape 1** : Validation empêche de passer à l'étape 2 si incomplet
- [ ] **Étape 1** : 3 âges cibles disponibles (3-5, 5-7, 7-9)
- [ ] **Étape 2** : 5 formats prédéfinis disponibles
- [ ] **Étape 2** : Format personnalisé permet de saisir dimensions
- [ ] **Étape 2** : Checkbox bleed fonctionne
- [ ] **Étape 2** : Avertissement si format non-KDP
- [ ] **Étape 3** : 4 types de livres disponibles
- [ ] **Étape 3** : Bouton "Parcourir" ouvre sélecteur de dossier
- [ ] **Étape 3** : Chemin sélectionné s'affiche
- [ ] Bouton "Créer le projet" crée le projet
- [ ] Projet apparaît dans la liste
- [ ] Dossier projet créé sur le disque
- [ ] Sous-dossiers créés (images, exports, versions)
- [ ] Fichier project.json créé
- [ ] Projet s'ouvre automatiquement après création

#### Liste de projets

- [ ] Projets affichés en grille
- [ ] Carte projet affiche : titre, auteur, date, âge, type, nb pages
- [ ] Clic sur carte ouvre le projet
- [ ] Bouton "Dupliquer" fonctionne
- [ ] Projet dupliqué a "(Copy)" dans le titre
- [ ] Bouton "Supprimer" demande confirmation
- [ ] Projet supprimé disparaît de la liste
- [ ] Recherche filtre par titre
- [ ] Recherche filtre par auteur
- [ ] Message "Aucun projet" si liste vide

#### Ouverture de projet

- [ ] Clic sur projet l'ouvre
- [ ] TopBar se met à jour avec infos projet
- [ ] Données du projet sont chargées
- [ ] Navigation vers "Écriture" fonctionne
- [ ] Projet reste ouvert après changement de vue

### Espace d'écriture

#### PageList (panneau gauche)

- [ ] Bouton "Nouvelle Page" ajoute une page
- [ ] Pages numérotées automatiquement
- [ ] Position gauche/droite calculée (pair/impair)
- [ ] Badge G/D affiché correctement
- [ ] Clic sur page la sélectionne
- [ ] Page sélectionnée mise en surbrillance
- [ ] Miniature d'image affichée si présente
- [ ] Aperçu texte affiché si présent
- [ ] Drag & drop fonctionne
- [ ] Ordre des pages se met à jour après drag
- [ ] Numéros se recalculent après réorganisation
- [ ] Bouton "Supprimer" demande confirmation
- [ ] Page supprimée disparaît
- [ ] Compteur de pages correct

#### PageEditor (panneau central)

- [ ] Message "Sélectionnez une page" si aucune sélection
- [ ] Numéro de page affiché
- [ ] Badge position (Gauche/Droite) affiché
- [ ] Canvas aux bonnes dimensions selon format
- [ ] Bouton "Guides" active/désactive les guides
- [ ] Guide bleed affiché si activé dans format
- [ ] Guide safe area affiché
- [ ] Bouton "Texte" ajoute un bloc de texte
- [ ] Bloc de texte apparaît sur le canvas
- [ ] Texte est éditable inline
- [ ] Clic sur bloc le sélectionne
- [ ] Bloc sélectionné a une bordure
- [ ] Panneau de propriétés apparaît en bas
- [ ] Changement de style fonctionne (4 styles)
- [ ] Changement de taille de police fonctionne
- [ ] Changement de couleur fonctionne
- [ ] Bouton "Supprimer" supprime le bloc
- [ ] Modifications sauvegardées automatiquement

#### AIChat (panneau droit)

- [ ] Chat affiche "Commencez une conversation" si vide
- [ ] 3 boutons rapides affichés
- [ ] Bouton "Écrire l'histoire" envoie le bon prompt
- [ ] Bouton "Simplifier" fonctionne
- [ ] Bouton "Découper en pages" fonctionne
- [ ] Champ de saisie fonctionne
- [ ] Bouton "Envoyer" envoie le message
- [ ] Touche Entrée envoie le message
- [ ] Message utilisateur affiché en bleu à droite
- [ ] Loader affiché pendant génération
- [ ] Réponse IA affichée en gris à gauche
- [ ] Timestamp affiché sur chaque message
- [ ] Bouton "Insérer" ajoute texte à la page active
- [ ] Bouton "Auto-découpe" crée les pages
- [ ] Historique de conversation persisté
- [ ] Scroll automatique vers le bas
- [ ] Erreur affichée si pas de clé API
- [ ] Erreur affichée si problème réseau

### Intégration OpenAI

- [ ] Service OpenAI répond sur localhost:3001
- [ ] Endpoint `/health` retourne status OK
- [ ] Endpoint `/api/chat` fonctionne
- [ ] Réponse contient le message
- [ ] Réponse contient les tokens utilisés
- [ ] Usage tokens trackés dans le projet
- [ ] Erreur 401 si pas de clé API
- [ ] Erreur 500 si problème OpenAI
- [ ] Timeout après 60 secondes

### Auto-découpage

- [ ] Format "Page X: [texte] | Illustration: [description]" reconnu
- [ ] Pages créées automatiquement
- [ ] Texte inséré dans chaque page
- [ ] Prompt d'illustration sauvegardé
- [ ] Numérotation correcte
- [ ] Position gauche/droite correcte
- [ ] Message de confirmation affiché

### Autosave

- [ ] Sauvegarde après 2 secondes d'inactivité
- [ ] Pas de sauvegarde si pas de changement
- [ ] Timestamp `updatedAt` mis à jour
- [ ] Fichier project.json mis à jour
- [ ] Données persistées après fermeture
- [ ] Données restaurées à la réouverture

---

## 🧪 Tests V2 - Personnages & Illustrations (À VENIR)

### Vue Personnages

- [ ] Liste des personnages affichée
- [ ] Bouton "Nouveau personnage" fonctionne
- [ ] Formulaire de personnage complet
- [ ] Tous les champs sauvegardés
- [ ] Image de référence uploadable
- [ ] Personnage modifiable
- [ ] Personnage supprimable
- [ ] Liste des lieux affichée
- [ ] Lieux prédéfinis disponibles
- [ ] Lieu personnalisé ajouté
- [ ] Style artistique sélectionnable
- [ ] 5+ styles disponibles

### Vue Illustrations

- [ ] Sélection de page fonctionne
- [ ] Construction de prompt
- [ ] Personnages disponibles dans dropdown
- [ ] Lieux disponibles dans dropdown
- [ ] Ratio calculé automatiquement
- [ ] Génération 1 image fonctionne
- [ ] Génération 4 variantes fonctionne
- [ ] Images affichées après génération
- [ ] Bouton "Placer" ajoute image à la page
- [ ] Bibliothèque affiche toutes les images
- [ ] Recherche dans bibliothèque
- [ ] Suppression d'image
- [ ] "Générer tout" fonctionne
- [ ] Barre de progression affichée
- [ ] Images stockées dans dossier projet

### Cohérence visuelle

- [ ] Personnages reconnaissables entre images
- [ ] Style artistique cohérent
- [ ] Lieux cohérents
- [ ] Couleurs harmonieuses

---

## 🧪 Tests V3 - Export KDP (À VENIR)

### Vérifications

- [ ] Analyse automatique au clic
- [ ] Détection texte hors safe area
- [ ] Détection images basse résolution
- [ ] Détection pages vides
- [ ] Détection polices non embarquées
- [ ] Détection bleed incorrect
- [ ] Détection format incompatible
- [ ] Statut VERT si OK
- [ ] Statut ORANGE si avertissements
- [ ] Statut ROUGE si erreurs
- [ ] Liste détaillée des problèmes
- [ ] Lien vers page concernée

### Export PDF

- [ ] Export PDF intérieur fonctionne
- [ ] PDF généré dans dossier exports
- [ ] PDF ouvrable dans Adobe Reader
- [ ] Polices embarquées
- [ ] Images 300 DPI minimum
- [ ] Bleed correct (0.125")
- [ ] Dimensions correctes
- [ ] Export PDF couverture fonctionne
- [ ] Couverture full spread
- [ ] Spine calculé correctement
- [ ] Package ZIP créé
- [ ] ZIP contient tous les fichiers

### Outils

- [ ] Calculateur de spine fonctionne
- [ ] Prévisualisation 3D
- [ ] Checklist KDP affichée
- [ ] Métadonnées exportées

---

## 🧪 Tests V4 - Polish (À VENIR)

### Raccourcis clavier

- [ ] Ctrl+S sauvegarde
- [ ] Ctrl+Z undo
- [ ] Ctrl+Y redo
- [ ] Ctrl+N nouveau projet
- [ ] Ctrl+O ouvrir projet
- [ ] Tous les raccourcis documentés

### Undo/Redo

- [ ] Undo annule dernière action
- [ ] Redo refait action annulée
- [ ] Historique complet
- [ ] Timeline visuelle
- [ ] Restauration de version

### Thèmes

- [ ] Mode clair disponible
- [ ] Mode sombre disponible
- [ ] Switch fonctionne
- [ ] Préférence sauvegardée

### Tutoriel

- [ ] Tutoriel au premier lancement
- [ ] Tooltips contextuels
- [ ] Vidéos d'aide accessibles
- [ ] Peut être relancé

### Bibliothèque

- [ ] Polices pré-installées
- [ ] Import police personnalisée
- [ ] Prévisualisation police
- [ ] Backgrounds disponibles
- [ ] Templates de pages
- [ ] Templates de livres

### Performance

- [ ] Liste de 50+ pages fluide
- [ ] Images chargent rapidement
- [ ] Autosave n'impacte pas l'UI
- [ ] Pas de memory leak
- [ ] CPU <30% en idle

### Collaboration

- [ ] Export projet fonctionne
- [ ] Import projet fonctionne
- [ ] Commentaires sur pages
- [ ] Historique de versions

### Analytics

- [ ] Stats OpenAI affichées
- [ ] Coût par projet calculé
- [ ] Temps de travail tracké
- [ ] Dashboard analytics

### Backup

- [ ] Backup automatique activable
- [ ] Backup créé régulièrement
- [ ] Restauration fonctionne
- [ ] Backup cloud optionnel

---

## 📋 Tests de régression (à chaque version)

### Fonctionnalités de base

- [ ] Application démarre
- [ ] Clé API fonctionne
- [ ] Navigation fonctionne
- [ ] Projet peut être créé
- [ ] Projet peut être ouvert
- [ ] Pages peuvent être ajoutées
- [ ] Texte peut être édité
- [ ] IA répond
- [ ] Autosave fonctionne
- [ ] Données persistées

### Performance

- [ ] Démarrage <5 secondes
- [ ] Pas de crash pendant 1 heure
- [ ] Mémoire <500 MB
- [ ] CPU <50% en utilisation normale

### Sécurité

- [ ] Clé API jamais exposée
- [ ] Service OpenAI sur localhost uniquement
- [ ] Pas de fuite de données

---

## 🐛 Tests de cas limites

### Données

- [ ] Projet avec 0 pages
- [ ] Projet avec 100+ pages
- [ ] Page avec 0 blocs de texte
- [ ] Page avec 20+ blocs de texte
- [ ] Texte très long (10000+ caractères)
- [ ] Caractères spéciaux (émojis, accents)
- [ ] Projet sans titre
- [ ] Projet sans auteur

### Réseau

- [ ] Perte de connexion pendant génération IA
- [ ] Timeout OpenAI
- [ ] Erreur 429 (rate limit)
- [ ] Erreur 500 OpenAI

### Fichiers

- [ ] Dossier projet supprimé manuellement
- [ ] Fichier project.json corrompu
- [ ] Permissions d'écriture refusées
- [ ] Disque plein

### UI

- [ ] Fenêtre redimensionnée très petite
- [ ] Zoom navigateur changé
- [ ] Plusieurs projets ouverts simultanément
- [ ] Changement rapide entre vues

---

## ✅ Critères d'acceptation

### V0-V1
- ✅ 100% des tests V0 passent
- ✅ 100% des tests V1 passent
- ✅ 0 crash pendant 30 minutes d'utilisation
- ✅ Autosave fonctionne sans perte de données

### V2
- [ ] 100% des tests V2 passent
- [ ] Génération d'image <30 secondes
- [ ] 0 crash pendant génération de 10 images

### V2.1
- [ ] 100% des tests V2.1 passent
- [ ] Scene Builder génère description en <10 secondes
- [ ] 4 variantes générées en <2 minutes
- [ ] Batch de 10 pages complété en <10 minutes
- [ ] 0 crash pendant génération batch
- [ ] Pause/reprise fonctionne sans perte

### V3
- [ ] 100% des tests V3 passent
- [ ] Export PDF <10 secondes
- [ ] PDF validé par KDP Previewer

### V4
- [ ] 100% des tests V4 passent
- [ ] Tous les raccourcis fonctionnent
- [ ] Performance optimale (critères ci-dessus)

---

## 🧪 Tests V2.1 - Génération d'Illustrations

### Génération Page Individuelle (depuis Écriture)

#### Prérequis
- [ ] Projet avec identité visuelle validée
- [ ] Page avec template `full_illustration`, `mixed`, ou `double_page`
- [ ] Page contient du texte (minimum 10 caractères)

#### Bouton "Générer illustration"
- [ ] Bouton visible uniquement sur pages avec zone image
- [ ] Bouton invisible sur template `short_text`
- [ ] Bouton désactivé pendant génération
- [ ] Bouton change en "Regénérer" après génération

#### Processus de génération
- [ ] Clic sur "Générer illustration" démarre le processus
- [ ] Message "Création de la description de scène..." s'affiche
- [ ] Scene Builder génère description en 5-10 secondes
- [ ] Message "Génération des variantes (0/4)..." s'affiche
- [ ] Compteur se met à jour (1/4, 2/4, 3/4, 4/4)
- [ ] 4 variantes générées en 1-2 minutes
- [ ] Modal ImageVariantSelector s'ouvre automatiquement

#### Sélection de variante
- [ ] Modal affiche 4 variantes en grille 2x2
- [ ] Clic sur variante la sélectionne (bordure bleue)
- [ ] Indicateur de sélection (✓) visible
- [ ] Bouton "Valider la sélection" activé après sélection
- [ ] Bouton "Annuler" ferme le modal sans sauvegarder
- [ ] Bouton "Regénérer" relance la génération
- [ ] Bouton téléchargement par variante fonctionne

#### Sauvegarde
- [ ] Variante sélectionnée insérée dans la page
- [ ] `page.imageUrl` mis à jour
- [ ] `page.illustration` contient toutes les métadonnées
- [ ] `allVariants` stocke les 4 variantes
- [ ] Illustration visible dans l'éditeur
- [ ] Autosave déclenché après sélection

#### Regénération
- [ ] Bouton "Regénérer" visible après première génération
- [ ] Regénération crée 4 nouvelles variantes
- [ ] Anciennes variantes conservées dans historique
- [ ] Même description de scène réutilisée

### Génération Batch (depuis Illustrations)

#### Interface IllustrationsManager
- [ ] Vue tableau affiche toutes les pages
- [ ] Colonnes : Page, Template, Texte, Statut, Aperçu
- [ ] Statistiques affichées : Total, Générées, Manquantes
- [ ] Bouton "Générer toutes les pages manquantes" visible

#### Statuts de page
- [ ] ✅ "Illustration générée" si page.illustration existe
- [ ] ⚠️ "Manquante" si template image mais pas d'illustration
- [ ] ⏳ "Génération en cours..." pendant traitement
- [ ] ❌ "Échec" après 3 tentatives ratées
- [ ] ⏱️ "En attente" pour pages dans la queue
- [ ] 🔄 "Nouvelle tentative..." pendant retry
- [ ] "Pas d'illustration" si template short_text

#### Lancement batch
- [ ] Clic "Générer toutes les pages manquantes" démarre
- [ ] Validation identité visuelle effectuée
- [ ] Erreur affichée si identité non validée
- [ ] Erreur si aucune page à générer
- [ ] Queue créée avec pages filtrées

#### Progression batch
- [ ] Barre de progression affichée
- [ ] Pourcentage mis à jour en temps réel
- [ ] Compteur "X/Y" affiché
- [ ] Statuts de pages mis à jour en direct
- [ ] Page en cours surlignée en bleu
- [ ] Délai 1 seconde entre chaque génération

#### Contrôles batch
- [ ] Bouton "Pause" visible pendant traitement
- [ ] Clic "Pause" arrête la queue
- [ ] Bouton "Reprendre" visible après pause
- [ ] Clic "Reprendre" continue depuis dernière page
- [ ] Bouton "Réinitialiser" efface la queue
- [ ] Message de fin affiché avec erreurs éventuelles

#### Gestion d'erreurs batch
- [ ] Retry automatique jusqu'à 3 tentatives
- [ ] Statut "Nouvelle tentative..." pendant retry
- [ ] Délai 2 secondes entre retries
- [ ] Statut "Échec" après 3 échecs
- [ ] Batch continue malgré échecs individuels
- [ ] Résumé des erreurs à la fin

### Scene Builder

#### Génération de scène
- [ ] Scene Builder utilise texte de page
- [ ] Scene Builder utilise résumé du livre
- [ ] Scene Builder utilise liste des personnages
- [ ] Scene Builder utilise âge cible
- [ ] Description générée en 2-5 phrases
- [ ] Description focalisée sur éléments visuels
- [ ] Description mentionne personnages, décor, ambiance

#### Validation de scène
- [ ] Description minimum 20 caractères
- [ ] Description maximum 1000 caractères
- [ ] Maximum 7 phrases
- [ ] Erreur si validation échoue

### Prompt Injection & Cohérence

#### Validation identité visuelle
- [ ] Génération bloquée si identité non validée
- [ ] Message d'erreur clair affiché
- [ ] Redirection vers Personnages suggérée

#### Construction du prompt
- [ ] `buildImagePrompt()` utilisé systématiquement
- [ ] Style artistique injecté
- [ ] Description personnage incluse
- [ ] Palette de couleurs incluse
- [ ] Marqueurs qualité ajoutés
- [ ] Scene description intégrée

#### Cohérence visuelle
- [ ] Toutes les illustrations utilisent même style
- [ ] Personnage principal identique sur toutes les pages
- [ ] Palette de couleurs cohérente
- [ ] Qualité professionnelle maintenue

### Ratios & Impression KDP

#### Calcul de dimensions
- [ ] Ratio calculé selon format livre
- [ ] Ratio ajusté selon template page
- [ ] Bleed ajouté (0.125" par côté)
- [ ] DPI calculé (300 minimum)

#### Sélection DALL-E size
- [ ] `1024x1024` pour ratio carré (0.77-1.3)
- [ ] `1792x1024` pour paysage (>1.3)
- [ ] `1024x1792` pour portrait (<0.77)
- [ ] Size optimal sélectionné automatiquement

#### Qualité d'impression
- [ ] Warning si DPI < 300
- [ ] Message "acceptable" si DPI 300-600
- [ ] Message "excellent" si DPI ≥ 600
- [ ] Dimensions affichées dans métadonnées

### Gestion des Variantes

#### Stockage
- [ ] `page.illustration.url` contient image sélectionnée
- [ ] `page.illustration.sceneDescription` sauvegardée
- [ ] `page.illustration.revised_prompt` sauvegardé
- [ ] `page.illustration.allVariants` contient les 4 variantes
- [ ] `page.illustration.variantIndex` indique choix
- [ ] `page.illustration.dalleParams` stockés
- [ ] `page.illustration.batchGenerated` correct

#### Métadonnées
- [ ] Timestamp `selectedAt` enregistré
- [ ] ID unique généré
- [ ] Paramètres DALL-E sauvegardés
- [ ] Dimensions calculées stockées

### Lock Identité Visuelle

#### Validation avant génération
- [ ] Page individuelle : vérifie identité avant génération
- [ ] Batch : vérifie identité avant démarrage
- [ ] Erreur claire si identité manquante
- [ ] Lien vers section Personnages fourni

#### Messages d'erreur
- [ ] "Identité visuelle non validée" affiché
- [ ] "Veuillez d'abord créer l'identité visuelle" affiché
- [ ] Redirection vers Personnages possible

### Templates de Page

#### Détection template
- [ ] `full_illustration` : Bouton visible
- [ ] `mixed` : Bouton visible
- [ ] `double_page` : Bouton visible
- [ ] `short_text` : Bouton invisible
- [ ] Template non défini : Bouton invisible

#### Adaptation ratio
- [ ] `full_illustration` : Page complète
- [ ] `short_text` : 30% hauteur
- [ ] `mixed` : 50% hauteur
- [ ] `double_page` : Double largeur

### Validation Texte

#### Vérification texte page
- [ ] Erreur si page sans texte
- [ ] Erreur si texte < 10 caractères
- [ ] Message clair affiché
- [ ] Génération bloquée

### Performance & Optimisation

#### Temps de génération
- [ ] Scene description : 5-10 secondes
- [ ] 1 variante DALL-E : 15-30 secondes
- [ ] 4 variantes : 1-2 minutes
- [ ] Batch 10 pages : 5-10 minutes

#### Gestion mémoire
- [ ] Pas de fuite mémoire après 20 générations
- [ ] Images chargées correctement
- [ ] Miniatures affichées sans lag

#### Gestion réseau
- [ ] Délai 1 seconde entre requêtes batch
- [ ] Retry automatique sur erreur réseau
- [ ] Timeout géré correctement
- [ ] Rate limit évité

### Cas d'Erreur

#### Erreurs API
- [ ] Erreur OpenAI affichée clairement
- [ ] Erreur 429 (rate limit) gérée
- [ ] Erreur 500 gérée avec retry
- [ ] Timeout géré avec message

#### Erreurs utilisateur
- [ ] Identité non validée : message clair
- [ ] Page sans texte : message clair
- [ ] Texte trop court : message clair
- [ ] Aucune page à générer : message clair

#### Récupération
- [ ] Pause/reprise fonctionne après erreur
- [ ] Retry automatique (3 tentatives)
- [ ] État queue préservé
- [ ] Progression sauvegardée

### Intégration avec V2

#### Utilisation identité visuelle
- [ ] Style artistique utilisé
- [ ] Personnage principal référencé
- [ ] Palette de couleurs appliquée
- [ ] Référence canonique mentionnée

#### Cohérence globale
- [ ] Toutes les pages du livre cohérentes
- [ ] Style uniforme
- [ ] Personnage reconnaissable
- [ ] Qualité constante

### Edge Cases

#### Projets spéciaux
- [ ] Livre sans personnages : génération fonctionne
- [ ] Livre sans résumé : génération fonctionne
- [ ] Format personnalisé : ratio calculé correctement
- [ ] Double page : largeur doublée

#### Comportements limites
- [ ] Génération pendant autosave
- [ ] Changement de page pendant génération
- [ ] Fermeture modal pendant génération
- [ ] Suppression page avec illustration

---

## 🧪 Tests V3 - KDP Print Engine

### Pagination Imprimeur

#### Calcul Gutter Margin
- [ ] Projet 50 pages : Gutter = 0.375"
- [ ] Projet 150 pages : Gutter = 0.375"
- [ ] Projet 151 pages : Gutter = 0.5"
- [ ] Projet 300 pages : Gutter = 0.5"
- [ ] Projet 301 pages : Gutter = 0.625"
- [ ] Projet 500 pages : Gutter = 0.625"
- [ ] Projet 501 pages : Gutter = 0.75"

#### Ordre des pages
- [ ] Page 1 toujours à droite
- [ ] Page 2 à gauche
- [ ] Page 3 à droite
- [ ] Pages impaires toujours à droite
- [ ] Pages paires toujours à gauche

#### Marges par page
- [ ] Page droite : gutter à gauche, outer à droite
- [ ] Page gauche : outer à gauche, gutter à droite
- [ ] Marges correctes pour chaque page

#### Page blanche automatique
- [ ] Projet 25 pages : Page 26 ajoutée automatiquement
- [ ] Page 26 est vide
- [ ] Page 26 à gauche
- [ ] Projet 24 pages : Pas de page ajoutée

#### Safe Area
- [ ] Safe area calculée correctement
- [ ] Safe area exclut bleed
- [ ] Safe area exclut marges
- [ ] Dimensions correctes

#### Gutter Danger Zone
- [ ] Zone de 0.25" détectée
- [ ] Éléments proches de la reliure détectés
- [ ] Avertissement affiché

### Cover Generator

#### Calcul Spine Width
- [ ] 100 pages papier white : Spine ≈ 0.252"
- [ ] 200 pages papier white : Spine ≈ 0.502"
- [ ] 100 pages papier cream : Spine ≈ 0.269"
- [ ] 24 pages : Spine = 0.06" (minimum KDP)

#### Dimensions Couverture
- [ ] Largeur totale = bleed×2 + trim×2 + spine
- [ ] Hauteur totale = bleed×2 + trim
- [ ] Calcul correct pour format 6"×9"
- [ ] Calcul correct pour format 8.5"×11"

#### Layout Couverture
- [ ] Back cover position correcte
- [ ] Spine position correcte
- [ ] Front cover position correcte
- [ ] Safe zones définies
- [ ] Barcode area en bas à droite du dos

#### Spine Text
- [ ] Spine < 0.25" : Pas de texte recommandé
- [ ] Spine 0.25"-0.5" : Font 10pt recommandé
- [ ] Spine 0.5"-0.75" : Font 12pt recommandé
- [ ] Spine > 0.75" : Font 14pt recommandé

#### Template Couverture
- [ ] Titre du projet utilisé
- [ ] Auteur du projet utilisé
- [ ] Nombre de pages correct
- [ ] Type de papier configurable

### Preflight Check

#### Vérification Pagination
- [ ] Erreur si < 24 pages
- [ ] Erreur si > 828 pages
- [ ] Info si nombre impair
- [ ] OK si 24-828 pages paires

#### Vérification Bleed
- [ ] Erreur critique si pas de bleed
- [ ] Warning si bleed < 0.125"
- [ ] OK si bleed = 0.125"

#### Vérification Safe Area
- [ ] Détecte texte hors safe area
- [ ] Indique numéro de page
- [ ] Indique numéro de bloc
- [ ] Suggère solution

#### Vérification Résolution
- [ ] Erreur critique si DPI < 300
- [ ] Warning si DPI < 600
- [ ] OK si DPI ≥ 600
- [ ] DPI calculé affiché

#### Vérification Contenu
- [ ] Warning si page vide
- [ ] Numéro de page indiqué
- [ ] Pas de warning pour pages intentionnellement vides

#### Vérification Gutter
- [ ] Détecte texte proche reliure
- [ ] Info pour images dans gutter
- [ ] Numéro de page indiqué
- [ ] Distance calculée

#### Rapport Preflight
- [ ] Statut READY si 0 erreur critique
- [ ] Statut WARNING si warnings seulement
- [ ] Statut CRITICAL si erreurs critiques
- [ ] Compteurs corrects (total, critical, warnings, info)
- [ ] Timestamp présent
- [ ] canExport = false si erreurs critiques
- [ ] canExport = true si OK

#### Catégories de problèmes
- [ ] Problèmes groupés par catégorie
- [ ] Pagination
- [ ] Bleed
- [ ] Safe Area
- [ ] Résolution
- [ ] Contenu
- [ ] Gutter
- [ ] Polices

#### Couleurs de statut
- [ ] READY : Vert
- [ ] WARNING : Orange
- [ ] CRITICAL : Rouge

### Print Rendering

#### Ajustement Couleur
- [ ] Brightness augmenté de 10%
- [ ] Contrast augmenté de 5%
- [ ] Saturation réduite de 5%
- [ ] Image plus claire après ajustement
- [ ] Qualité préservée

#### Préparation Image
- [ ] Redimensionnement haute qualité
- [ ] Lissage activé
- [ ] Résolution correcte (300 DPI)
- [ ] Format PNG

#### Calcul Pixels Print
- [ ] 6" × 300 DPI = 1800 pixels
- [ ] 9" × 300 DPI = 2700 pixels
- [ ] 8.5" × 600 DPI = 5100 pixels
- [ ] Calcul correct pour tous formats

#### Aplatissement Page
- [ ] Fond blanc
- [ ] Illustration intégrée
- [ ] Texte rendu
- [ ] Polices correctes
- [ ] Taille correcte
- [ ] Export PNG haute résolution

### PDF Exporter

#### Export Interior PDF
- [ ] PDF créé avec succès
- [ ] Toutes les pages présentes
- [ ] Page 1 à droite
- [ ] Ordre correct
- [ ] Dimensions exactes (trim + bleed)
- [ ] Résolution 300 DPI
- [ ] Images intégrées
- [ ] Texte rendu
- [ ] Fichier téléchargeable

#### Export Cover PDF
- [ ] PDF créé avec succès
- [ ] Back cover présent
- [ ] Spine présent
- [ ] Front cover présent
- [ ] Dimensions correctes
- [ ] Zone barcode visible
- [ ] Résolution 300 DPI
- [ ] Fichier téléchargeable

#### Nom de fichier
- [ ] Interior : {titre}_interior.pdf
- [ ] Cover : {titre}_cover.pdf
- [ ] Caractères spéciaux gérés

#### Compression PDF
- [ ] PDF optimisé
- [ ] Taille raisonnable
- [ ] Qualité préservée

### ExportView UI

#### Affichage Projet
- [ ] Titre affiché
- [ ] Auteur affiché
- [ ] Format affiché
- [ ] Nombre de pages affiché

#### Preflight Report
- [ ] Rapport affiché automatiquement
- [ ] Bouton "Revérifier" fonctionne
- [ ] Statut coloré (vert/orange/rouge)
- [ ] Statistiques affichées
- [ ] Problèmes listés par catégorie
- [ ] Sections repliables
- [ ] Messages clairs
- [ ] Solutions suggérées

#### Boutons Export
- [ ] "Exporter" (Interior) visible
- [ ] "Exporter" (Cover) visible
- [ ] "Tout exporter" visible
- [ ] Boutons désactivés si erreurs critiques
- [ ] Boutons désactivés pendant export
- [ ] Icônes affichées

#### Progression Export
- [ ] Message "Génération en cours..."
- [ ] Spinner animé
- [ ] Message "Enregistrement..."
- [ ] Message "Export terminé !"
- [ ] Message disparaît après 3 secondes

#### Configuration Couverture
- [ ] Largeur totale affichée
- [ ] Hauteur totale affichée
- [ ] Largeur spine affichée
- [ ] Type de papier affiché
- [ ] Valeurs correctes

#### Checklist KDP
- [ ] Aucune erreur critique (✓ ou ✕)
- [ ] Minimum 24 pages (✓ ou ✕)
- [ ] Marges perdues configurées (✓ ou ✕)
- [ ] Couverture configurée (✓ ou ✕)
- [ ] Résolution 300 DPI (✓ ou ✕)

#### Spécifications Export
- [ ] Résolution : 300 DPI affiché
- [ ] Marges perdues : 0.125" affiché
- [ ] Polices embarquées mentionné
- [ ] Ajustement couleur mentionné
- [ ] Format PDF/X-1a mentionné

### Workflow Complet

#### Scénario 1 : Export Réussi
1. [ ] Créer projet 24 pages
2. [ ] Ajouter illustrations
3. [ ] Aller dans Export KDP
4. [ ] Preflight : Statut READY
5. [ ] Exporter Interior PDF
6. [ ] PDF téléchargé
7. [ ] Exporter Cover PDF
8. [ ] PDF téléchargé
9. [ ] Les deux PDFs valides

#### Scénario 2 : Erreurs Critiques
1. [ ] Créer projet 10 pages
2. [ ] Aller dans Export KDP
3. [ ] Preflight : Statut CRITICAL
4. [ ] Erreur "< 24 pages" affichée
5. [ ] Export bloqué
6. [ ] Ajouter 14 pages
7. [ ] Revérifier
8. [ ] Statut READY
9. [ ] Export possible

#### Scénario 3 : Warnings
1. [ ] Créer projet 24 pages
2. [ ] Ajouter texte près du bord
3. [ ] Aller dans Export KDP
4. [ ] Preflight : Statut WARNING
5. [ ] Warning "Texte hors safe area"
6. [ ] Export possible mais non recommandé
7. [ ] Corriger position texte
8. [ ] Revérifier
9. [ ] Statut READY

#### Scénario 4 : Package Complet
1. [ ] Projet conforme
2. [ ] Clic "Tout exporter"
3. [ ] Message "Génération PDF intérieur..."
4. [ ] Message "Génération PDF couverture..."
5. [ ] Message "Enregistrement..."
6. [ ] Interior PDF téléchargé
7. [ ] Cover PDF téléchargé
8. [ ] Message "Package créé avec succès !"

### Formats KDP

#### Formats Standards
- [ ] 5" × 8" : Export OK
- [ ] 6" × 9" : Export OK
- [ ] 8.5" × 11" : Export OK
- [ ] 8" × 10" : Export OK

#### Format Personnalisé
- [ ] 7.5" × 9.5" : Export OK
- [ ] Spine calculé correctement
- [ ] Couverture générée correctement

### Cas Limites

#### Pagination
- [ ] 24 pages exactement : OK
- [ ] 828 pages exactement : OK
- [ ] 23 pages : Erreur
- [ ] 829 pages : Erreur

#### Spine
- [ ] Spine très étroit (< 0.06") : Minimum appliqué
- [ ] Spine très large (> 2") : Calculé correctement
- [ ] Spine 0.24" : Pas de texte recommandé
- [ ] Spine 0.26" : Texte possible

#### Résolution
- [ ] Image 299 DPI : Erreur critique
- [ ] Image 300 DPI : OK
- [ ] Image 599 DPI : Warning
- [ ] Image 600 DPI : OK

#### Bleed
- [ ] Bleed 0" : Erreur critique
- [ ] Bleed 0.1" : Warning
- [ ] Bleed 0.125" : OK
- [ ] Bleed 0.25" : OK

### Performance

#### Temps de génération
- [ ] Preflight 24 pages : < 2 secondes
- [ ] Preflight 100 pages : < 5 secondes
- [ ] Export Interior 24 pages : < 10 secondes
- [ ] Export Interior 100 pages : < 30 secondes
- [ ] Export Cover : < 5 secondes

#### Mémoire
- [ ] Pas de fuite mémoire après 10 exports
- [ ] Utilisation mémoire raisonnable
- [ ] Pas de crash

### Intégration avec V2.1

#### Illustrations générées
- [ ] Illustrations V2.1 dans PDF
- [ ] Résolution préservée
- [ ] Ajustement couleur appliqué
- [ ] Qualité print

#### Identité visuelle
- [ ] Cohérence visuelle dans PDF
- [ ] Style préservé
- [ ] Couleurs ajustées pour print

### Erreurs et Récupération

#### Erreurs Export
- [ ] Erreur réseau : Message clair
- [ ] Erreur écriture fichier : Message clair
- [ ] Erreur génération PDF : Message clair
- [ ] Boutons réactivés après erreur

#### Erreurs Preflight
- [ ] Projet invalide : Message clair
- [ ] Pas de pages : Message clair
- [ ] Pas de format : Message clair

### Compatibilité KDP

#### Vérification finale
- [ ] PDF Interior ouvre dans Adobe Reader
- [ ] PDF Cover ouvre dans Adobe Reader
- [ ] Dimensions exactes vérifiées
- [ ] Bleed présent
- [ ] Résolution suffisante
- [ ] Polices lisibles
- [ ] Images nettes
- [ ] Pas d'erreurs PDF

#### Upload KDP (Manuel)
- [ ] Interior PDF accepté par KDP
- [ ] Cover PDF accepté par KDP
- [ ] Previewer KDP fonctionne
- [ ] Pas d'erreurs de validation
- [ ] Rendu correct dans previewer

---

## 🧪 Patch UX - WritingView (Structure drawer / header sticky / scroll)

- [ ] **Test 1 — Structure fermée sans hitbox fantôme** : depuis Écriture, fermer Structure puis cliquer plusieurs fois sur le bouton "Structure" et sur les onglets adjacents. Aucun rail/handle invisible ne doit capter les clics.
- [ ] **Test 2 — Drawer totalement hors écran** : fermer Structure et vérifier visuellement qu'aucune portion latérale (ex: "Move"/poignée) ne reste visible ni superposée aux onglets.
- [ ] **Test 3 — Header onglets toujours visible** : ouvrir/fermer successivement Structure, Résumé, Assistant ; le header d'onglets reste sticky en haut du workspace (jamais hors viewport).
- [ ] **Test 4 — Pas de saut vertical à l'ouverture** : cliquer sur "Structure" depuis différentes positions d'usage ; l'app ne doit jamais se repositionner en bas de page et `body` ne doit pas scroller.
- [ ] **Test 5 — Scroll interne uniquement** : avec beaucoup de pages/messages, vérifier que seuls les contenus internes scrollent (liste Structure, chat, résumé), pas la fenêtre principale.

## 🧪 Patch UX - WritingView Assistant (indépendance / fermeture / viewport)

- [ ] **Test 1 — PanelManager exclusif** : cliquer sur "Assistant" ferme automatiquement Structure/Résumé ; cliquer sur "Résumé" ferme Assistant (un seul panel actif à la fois).
- [ ] **Test 2 — Assistant n'ouvre jamais Résumé** : en partant de `activePanel=none`, cliquer "Assistant" ne doit afficher que la modale Assistant.
- [ ] **Test 3 — Bouton X toujours visible** : en petite et grande fenêtre, vérifier que le header sticky de la modale affiche toujours le bouton X et qu'il ferme la modale.
- [ ] **Test 4 — ESC ferme l'assistant** : ouvrir la modale Assistant puis appuyer sur Échap ; la modale se ferme et les onglets restent accessibles.
- [ ] **Test 5 — Scroll interne uniquement** : avec historique chat long, le scroll se fait dans la modale/chat ; aucun scroll global `body`/application.

## 🧪 V1.7 — Auto Layout & Manual Editing (Writing / PageEditor)

- [ ] **Test 1 — Zones texte par template** : créer une page `illustration-pleine`, `mixte`, `texte-court`, `double-page` et vérifier que chaque template applique une zone texte cohérente avec son intention.
- [ ] **Test 2 — Safe areas respectées** : vérifier que le placement auto du texte reste dans la zone sûre (hors bleed + marges de sécurité).
- [ ] **Test 3 — Auto-fit taille police** : coller un texte long et vérifier que la police baisse automatiquement sans sortir du bloc.
- [ ] **Test 4 — Auto-fit interligne** : avec texte long, vérifier que l'interligne est ajusté automatiquement pour réduire l'overflow.
- [ ] **Test 5 — Overflow warning** : injecter un texte très long et vérifier l'avertissement "Texte trop long" si le minimum est atteint.
- [ ] **Test 6 — Couleur auto lisible (fond clair)** : sur image/fond clair, le texte passe automatiquement en sombre.
- [ ] **Test 7 — Couleur auto lisible (fond foncé)** : sur image/fond foncé, le texte passe automatiquement en clair.
- [ ] **Test 8 — Shadow/outline auto** : vérifier qu'un effet de lisibilité est appliqué automatiquement quand nécessaire.
- [ ] **Test 9 — Bandeau auto** : sur contraste limite, vérifier que le bandeau semi-transparent apparaît automatiquement.
- [ ] **Test 10 — Bandeau off** : forcer bandeau à `off` depuis la mini-toolbar et vérifier qu'il disparaît.
- [ ] **Test 11 — Bandeau on** : forcer bandeau à `on` et vérifier qu'il reste visible même sur fond homogène.
- [ ] **Test 12 — Sélection bloc texte** : cliquer un bloc pour afficher sélection + mini-toolbar.
- [ ] **Test 13 — Drag bloc texte** : déplacer un bloc et vérifier que position persistée dans `project.json`.
- [ ] **Test 14 — Resize bloc texte** : redimensionner un bloc via handle et vérifier taille persistée.
- [ ] **Test 15 — layoutMode manuel** : après drag/resize ou réglage manuel, vérifier `layoutMode='manual'` sur le bloc.
- [ ] **Test 16 — Auto-layout page n'écrase pas manuel** : cliquer "Réappliquer page active" et vérifier que les blocs manuels conservent position/taille.
- [ ] **Test 17 — Auto-layout global n'écrase pas manuel** : cliquer "Réappliquer tout le livre" et vérifier même protection sur toutes les pages.
- [ ] **Test 18 — Repasser en auto** : cliquer "Repasser en auto" sur un bloc manuel et vérifier qu'il se réaligne selon la zone template.
- [ ] **Test 19 — Couleur custom** : choisir une couleur custom dans la mini-toolbar et vérifier rendu + persistance.
- [ ] **Test 20 — Alignement texte** : basculer Gauche/Centré et vérifier rendu + persistance.
- [ ] **Test 21 — Zoom image** : ajuster le slider de zoom image et vérifier mise à jour visuelle et persistance.
- [ ] **Test 22 — Pan image** : drag de l'image active et vérifier offset appliqué + persistance.
- [ ] **Test 23 — Fit modes image** : tester `Remplir (cover)` puis `Ajuster (contain)` et vérifier comportement attendu.
- [ ] **Test 24 — Fond de page** : modifier la couleur de fond de page puis `Reset fond` et vérifier restauration.
- [ ] **Test 25 — Double-page fond gauche/droite** : sur template double-page, définir fonds distincts gauche/droite et vérifier rendu différencié.

**Dernière mise à jour** : 1 mars 2026
