# Raceapp · Course sur Quadrillage

Jeu de course sur quadrillage pour 2 à 4 joueurs. Le menu Raceapp propose la course en direct, le solo et une course contre une IA locale sur le circuit choisi. En direct, créez ou rejoignez une salle. Le lien « Jouer sur le même écran » ouvre la version locale.

## Mettre les fichiers sur GitHub depuis Windows

1. Extraire le ZIP dans un dossier.
2. Ouvrir le dépôt Raceapp sur github.com. Dans l’onglet Code, choisir Add file → Upload files (ou uploading an existing file dans un dépôt vide).
3. Glisser ensemble tous les fichiers extraits directement à la racine du dépôt. Vérifier que package.json et server.mjs apparaissent à la racine du dépôt.
4. Inclure aussi tutorial.html, stats.html, stats.js et guide.css. Cliquer sur Commit changes sur la branche principale.

## Héberger le jeu sur Render

1. Ouvrir https://dashboard.render.com et choisir New → Web Service.
2. Connecter GitHub et autoriser Render à lire Raceapp. Sélectionner ce dépôt et la branche contenant les fichiers.
3. Choisir Node, laisser Root Directory vide, saisir npm install comme Build Command et npm start comme Start Command. Utiliser une seule instance. Le projet demande Node 24 et ne dépend d’aucun paquet externe.
4. Pour un premier essai, choisir l’instance Free et cliquer sur Deploy Web Service. Une fois le statut Live affiché, ouvrir le lien HTTPS du service.
5. Entrer un pseudo et choisir un ou deux tours. Créer une salle et copier son lien. Chaque invité ouvre ce lien, saisit son pseudo et clique sur Rejoindre la salle. L’hôte lance la course dès que le groupe est prêt.

GitHub Pages peut héberger la démo locale. Pour les courses à distance, ouvrir l’adresse du service Node sur Render. Le serveur vérifie les coups et gère le temps de 15 secondes. Le navigateur récupère régulièrement les coups adverses. Utiliser le même navigateur pour reprendre sa place après un rechargement.

## Stockage

Les salles sont stockées dans une base SQLite créée au lancement. Le disque de l’offre gratuite de Render est éphémère. Une mise en veille, un redémarrage ou un déploiement peut effacer les parties. Pour conserver les salles avec une instance payante compatible, monter un disque persistant sur /var/data et régler RACE_DATABASE sur /var/data/race.sqlite. Cette version propose les parties en direct. Le mode différé avec notifications push reste à développer.

## Test sur PC

Avec Node.js 24, ouvrir un terminal dans le dossier qui contient package.json et exécuter npm start. Accéder à http://localhost:3000. Une fenêtre normale et une fenêtre privée permettent de tester deux pilotes distincts.

## Fichiers
- server.mjs sert le site et enregistre les salles dans SQLite.
- api.mjs contrôle les invitations, les tours et les déplacements.
- game.mjs est le moteur partagé par le serveur et le navigateur.
- index.html affiche le menu. online.html et app.mjs affichent la course en ligne.
- local.html contient le jeu autonome sur un seul écran.


Le tutoriel en cinq étapes débouche sur un tour du petit ovale. Les statistiques par pseudo et mode sont stockées dans le navigateur. Forfait retire la voiture des collisions et passe la main aux pilotes encore engagés.

23 circuits sélectionnables en solo, contre l’IA, sur un même écran et en salle. Le créateur choisit le tracé en ligne. Le petit ovale reste accessible depuis le tutoriel.

## Atelier de circuits

Depuis le menu, choisir Créer un circuit. Dessiner en maintenant la souris ou le doigt, revenir au départ ou utiliser Fermer la boucle. Déplacer les points en mode Retoucher et régler leur arrondi individuellement. La largeur de 3 à 6 cases s’applique à toute la piste. La ligne de départ est placée automatiquement. Les circuits enregistrés sur ce navigateur figurent dans Mes circuits du sélecteur. En ligne, la salle reçoit une copie du circuit de son hôte.
