# Restaurant Staff Manager

Application de gestion du personnel de restaurant permettant de gérer les plannings, le pointage des heures et leur validation.

## Fonctionnalités

- **Système d'authentification** avec trois rôles : personnel, responsable et manager
- **Gestion des plannings (shifts)** pour le personnel
- **Système de pointage** des heures de travail
- **Validation des heures** par les responsables et managers
- **Interface responsive** compatible mobile et desktop

## Prérequis

- Node.js (v14+)
- npm ou yarn

## Structure du projet

Le projet est divisé en deux parties :

- `client` : Application frontend React
- `server` : API backend Node.js/Express avec base de données SQLite

## Installation

### Backend (server)

```bash
cd crm-restaurant/server
npm install
```

### Frontend (client)

```bash
cd crm-restaurant/client
npm install
```

## Lancement de l'application

### Démarrer le serveur backend

```bash
cd crm-restaurant/server
npm run dev
```

Le serveur démarre sur http://localhost:5050

### Démarrer l'application frontend

```bash
cd crm-restaurant/client
npm start
```

L'application client démarre sur http://localhost:3000 ou http://localhost:3001

## Utilisation

1. Créez un compte utilisateur avec l'un des trois rôles :
   - personnel : peut pointer et consulter ses shifts
   - responsable : peut valider les heures du personnel
   - manager : peut tout gérer (utilisateurs, planning, etc.)

2. Connectez-vous avec vos identifiants

3. Le tableau de bord s'adapte automatiquement selon le rôle de l'utilisateur

## Base de données

Le projet utilise SQLite pour le développement. La base de données est créée automatiquement au démarrage du serveur.

Pour passer à une autre base de données en production, modifiez le fichier de configuration dans `/server/src/config/db.js`.


## Auteur

[Votre nom]

## Licence

[Votre licence] 