# Guide du Développeur - Restaurant Staff Manager

Ce document fournit des détails techniques sur l'architecture du projet et comment l'étendre.

## Architecture

### Backend (Node.js/Express)

- **Dossier `/server/src`** : Code source du backend
  - **`/config`** : Configuration de la base de données (SQLite)
  - **`/controllers`** : Logique métier de l'API
  - **`/routes`** : Définition des routes de l'API
  - **`/middleware`** : Middleware d'authentification et autorisations
  - **`/models`** : Modèles de données (implicites via les contrôleurs)
  - **`server.js`** : Point d'entrée de l'application

### Frontend (React)

- **Dossier `/client/src`** : Code source du frontend
  - **`/components`** : Composants React réutilisables
  - **`/pages`** : Pages complètes de l'application
  - **`/context`** : Contextes React (notamment AuthContext)
  - **`/services`** : Services pour communiquer avec l'API
  - **`App.js`** : Configuration des routes frontend

## Base de données

La structure de la base de données SQLite comprend :

1. **`users`** : Stocke les informations des utilisateurs
   - `id`, `username`, `email`, `password`, `role`, `created_at`

2. **`shifts`** : Stocke les informations sur les plannings
   - `id`, `title`, `date`, `start_time`, `end_time`, `created_at`

3. **`user_shifts`** : Table de liaison qui associe utilisateurs et shifts, gère le pointage
   - `id`, `user_id`, `shift_id`, `clock_in`, `clock_out`, `validated`, `validated_by`, `comment`

## Authentification et Autorisation

- Utilise JWT (JSON Web Tokens) pour l'authentification
- Middleware d'autorisation basé sur les rôles (personnel, responsable, manager)
- Le token JWT est stocké dans localStorage et envoyé dans l'en-tête Authorization

## Comment ajouter de nouvelles fonctionnalités

### 1. Ajouter une nouvelle route API

1. Créez un nouveau contrôleur dans `/server/src/controllers/`
2. Définissez vos fonctions de gestion dans ce contrôleur
3. Créez un fichier de route dans `/server/src/routes/`
4. Importez et enregistrez ces routes dans `server.js`

### 2. Ajouter une nouvelle page frontend

1. Créez un nouveau composant de page dans `/client/src/pages/`
2. Ajoutez la route dans `/client/src/App.js`
3. Si nécessaire, créez un service API dans `/client/src/services/api.js`

### 3. Ajouter une nouvelle table en base de données

1. Modifiez la fonction `initializeDatabase()` dans `/server/src/config/db.js`
2. Ajoutez le code SQL CREATE TABLE pour votre nouvelle table
3. Redémarrez le serveur pour que la nouvelle table soit créée

## Conseils pour le déploiement

### Migration vers une autre base de données

Pour passer de SQLite à une autre base de données comme MySQL ou PostgreSQL :

1. Installez le package npm correspondant (mysql2, pg, etc.)
2. Modifiez le fichier `/server/src/config/db.js` pour utiliser le nouveau client
3. Adaptez les requêtes SQL si nécessaire (elles sont généralement compatibles)
4. Mettez à jour le schéma de base de données

### Déploiement sur un serveur

1. Configurez les variables d'environnement (notamment JWT_SECRET)
2. Construisez l'application client avec `npm run build`
3. Servez les fichiers statiques depuis Express ou un serveur web
4. Configurez un reverse proxy comme Nginx pour rediriger vers votre API

## Tests

Actuellement, le projet n'inclut pas de tests automatisés. Pour en ajouter :

1. Installez Jest pour les tests unitaires
2. Utilisez Supertest pour les tests d'API
3. Utilisez React Testing Library pour les tests de composants React

## Améliorations futures suggérées

- Ajouter des statistiques et des rapports pour les managers
- Implémenter des notifications pour rappeler les shifts à venir
- Ajouter un système de gestion des absences et congés
- Développer une fonctionnalité de chat intégré entre les employés
- Créer une version mobile native avec React Native 