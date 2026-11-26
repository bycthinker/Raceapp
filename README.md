# Raceapp · Course sur Quadrillage

Jeu de course sur quadrillage pour 2 à 4 joueurs. Le menu Raceapp propose la course en direct, le solo et une course contre une IA locale sur le circuit choisi. En direct, créez ou rejoignez une salle. Le bouton « Sur le même écran » lance une partie locale.

## Versions

La première version publique de test est **0.1**. Chaque livraison de nouveautés fait avancer le numéro (0.2, 0.3…). La version 1.0 correspondra au lancement avec le mode différé.

Le numéro de référence se trouve dans `package.json`. Pour préparer la prochaine version de test, exécuter `npm --no-git-tag-version version minor` depuis le dossier du jeu. La commande met aussi à jour le numéro affiché sur le menu. Exécuter ensuite `npm run archive` pour créer automatiquement le ZIP correspondant, par exemple `Raceapp-0.2.zip`.

## Mettre les fichiers sur GitHub depuis Windows

1. Extraire le ZIP dans un dossier.
2. Ouvrir le dépôt Raceapp sur github.com. Dans l’onglet Code, choisir Add file → Upload files (ou uploading an existing file dans un dépôt vide).
3. Glisser ensemble tous les fichiers extraits directement à la racine du dépôt. Vérifier que package.json et server.mjs apparaissent à la racine du dépôt.
4. Inclure les feuilles de style, mainland.svg et les dossiers scripts et circuits. Cliquer sur Commit changes sur la branche principale.

## Héberger le jeu sur Render

1. Ouvrir https://dashboard.render.com et choisir New → Web Service.
2. Connecter GitHub et autoriser Render à lire Raceapp. Sélectionner ce dépôt et la branche contenant les fichiers.
3. Choisir Node, laisser Root Directory vide, saisir npm install comme Build Command et npm start comme Start Command. Utiliser une seule instance. Le projet demande Node 24 et ne dépend d’aucun paquet externe.
4. Pour un premier essai, choisir l’instance Free et cliquer sur Deploy Web Service. Une fois le statut Live affiché, ouvrir le lien HTTPS du service.
5. Créer un compte pilote ou se connecter, puis choisir un ou deux tours. Créer une salle et copier son lien. Chaque invité ouvre ce lien, saisit son pseudo et clique sur Rejoindre la salle. L’hôte lance la course dès que le groupe est prêt.

GitHub Pages peut héberger la démo locale. Pour les courses à distance, ouvrir l’adresse du service Node sur Render. Le serveur vérifie les coups et gère le temps de 15 secondes. Le navigateur récupère régulièrement les coups adverses. Utiliser le même navigateur pour reprendre sa place après un rechargement.

## Stockage

Les comptes, les sessions, les historiques, le catalogue officiel et les salles sont stockés dans la même base SQLite créée au lancement. Le disque de l’offre gratuite de Render est éphémère. Une mise en veille, un redémarrage ou un déploiement peut effacer les parties. Pour conserver les comptes et les courses au fil des déploiements, utiliser un disque persistant. Sur une instance Render compatible, monter un disque persistant sur /var/data et régler RACE_DATABASE sur /var/data/race.sqlite. Cette version propose les parties en direct. Le mode différé avec notifications push reste à développer.

## Test sur PC

Avec Node.js 24, ouvrir un terminal dans le dossier qui contient package.json et exécuter npm start. Accéder à http://localhost:3000. Une fenêtre normale et une fenêtre privée permettent de tester deux pilotes distincts.

## Fichiers
- server.mjs sert le site et enregistre les salles dans SQLite.
- api.mjs contrôle les invitations, les tours et les déplacements.
- game.mjs est le moteur partagé par le serveur et le navigateur.
- index.html affiche le menu. online.html et app.mjs affichent la course en ligne.
- local.html contient le jeu autonome sur un seul écran.


Le tutoriel en cinq étapes débouche sur un tour du petit ovale. En mode invité, les statistiques restent dans le navigateur. Un pilote connecté retrouve son historique par date, mode, circuit et résultat sur les appareils où il se connecte. Forfait retire la voiture des collisions et passe la main aux pilotes encore engagés.

Mainland est le circuit de base. Les circuits importés dans le catalogue s’ajoutent au menu de course. Le petit ovale est accessible depuis le tutoriel.

## Atelier de circuits

Depuis le menu, ouvrir **Créer un circuit** et dessiner une boucle. En mode **Retoucher**, sélectionner un point pour ajuster son arrondi, ou cliquer entre deux points pour régler la largeur de ce segment entre 3 et 6 carreaux. Cliquer sur **Placer l’arrivée**, puis sur la piste. **Inverser le sens** retourne la flèche. Les créations enregistrées figurent sous **Mes circuits** dans le navigateur. En ligne, la salle reçoit une copie du tracé de l’hôte.


## Nouveautés de la 0.2

Depuis le menu, **Invité · Se connecter** donne accès à l’inscription par pseudo et mot de passe. Une invitation fonctionne aussi en mode invité. Seul un pilote connecté peut créer un salon. Le mode invité donne accès au solo, à l’IA et aux parties sur le même écran.

Les courses en direct sont inscrites dans l’historique par le serveur dès le départ. En solo, contre l’IA et sur le même écran, la place du joueur 1 appartient au compte connecté au départ. Les résultats locaux sont synchronisés avec ce compte. En cas de coupure, rouvrir le jeu sur le même appareil avec ce compte permet de terminer un envoi en attente. Les statistiques invitées et celles de la 0.1 restent locales.

Les circuits personnels expirent sept jours après leur dernière sauvegarde sur l’appareil. Un circuit de la 0.1 reçoit sept jours au premier chargement dans la 0.2. Ouvrir un tracé ou l’utiliser en course ne renouvelle pas sa durée. **Exporter en JSON** produit une copie sans expiration.

## Alimenter le catalogue officiel

1. Ouvrir le fichier autonome `Raceapp-Createur-de-circuits.html`, également téléchargeable depuis la colonne latérale de l’atelier. Dessiner la boucle, régler ses virages et sa ligne de départ.
2. Cliquer sur **Exporter en JSON**. Le fichier contient le tracé, son identité, les largeurs par segment, les arrondis, le sens et l’arrivée. **Ouvrir un circuit JSON** permet de le retoucher.
3. Déposer le JSON dans le dossier `circuits/` du projet, à côté de son fichier README. Envoyer ce fichier sur GitHub avec le jeu puis redéployer. Au démarrage, le serveur importe les tracés nouveaux ou modifiés dans SQLite. Pour réviser un tracé, remplacer son JSON en conservant son identifiant.
4. Rouvrir le choix du circuit en solo, contre l’IA, sur le même écran ou dans un nouveau salon. Le tracé figure sous **Circuits officiels** et reste disponible sans expiration. Une course déjà lancée garde sa version du tracé.

Pour ajouter un tracé immédiatement sur le serveur en fonctionnement, exécuter `npm run circuit:import -- "Mon circuit.json"` sur la machine qui héberge le jeu. La commande doit utiliser le même chemin `RACE_DATABASE` que le serveur.


## Commandes à la manette en 0.3

Ouvrir l’adresse HTTPS habituelle du jeu. L’option **Commandes à la manette** est activée par défaut dans le menu et le formulaire de préparation. Le choix est mémorisé sur l’appareil. Appuyer sur un bouton et le relâcher pour que le navigateur détecte la manette. Sur Xbox dans Microsoft Edge, sélectionner **Utiliser les commandes de jeu** si le stick déplace encore le curseur du navigateur.

| Situation | Commandes Xbox |
| --- | --- |
| Menus | Croix ou stick gauche pour déplacer la surbrillance, A pour activer, B pour revenir. LB/RB parcourent aussi les boutons dans l’ordre. |
| Réglages de course | Gauche/droite sur une liste pour changer la valeur. A sur un champ de texte ouvre le clavier de Raceapp. |
| À ton tour | Croix ou stick gauche pour choisir une case autorisée. Le premier appui part de la position prévue par l’élan. LB/RB permettent de parcourir toutes les possibilités, diagonales comprises. |
| Validation | Appuyer sur **A** pour jouer la case en surbrillance. Relâcher avant la validation suivante. **B** efface le choix. Si toutes les destinations sont bloquées, **A** passe le tour. |
| Boutons pendant la course | **X** permet de rejoindre les boutons de zoom, de retour ou de forfait. B ou X ramène à la grille. |

En local à plusieurs, passer la manette au pilote suivant après chaque coup. Les règles, le délai du jeu en direct et les données de la version 0.2 sont conservés. Le dessin libre dans l’atelier se fait au tactile, à la souris ou au stylet.
