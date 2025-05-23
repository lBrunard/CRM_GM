# 🛠️ Guide de dépannage - Restaurant Staff Manager

## Problème : L'application ne se lance plus

### 1. 🔍 Diagnostic rapide

```bash
# Vérifier si Node.js fonctionne
node --version
npm --version

# Vérifier la structure
ls -la
ls -la server/
ls -la client/
```

### 2. 🧹 Solution : Réparation complète des dépendances

```bash
# Rendre les scripts exécutables
chmod +x fix-dependencies.sh
chmod +x start-simple.sh

# Réparer les dépendances
./fix-dependencies.sh

# Démarrer l'application
./start-simple.sh
```

### 3. 📋 Étapes manuelles si les scripts ne marchent pas

#### Serveur Backend :
```bash
cd server
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
npm start
```

#### Client Frontend :
```bash
cd client
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
npm start
```

### 4. 🐛 Problèmes courants

#### Erreur de port :
```bash
# Tuer les processus existants
pkill -f "react-scripts"
pkill -f "nodemon"
pkill -f "node.*server"
```

#### Erreur de permissions :
```bash
sudo chown -R $(whoami) ~/.npm
```

#### Cache corrompu :
```bash
npm cache clean --force
rm -rf ~/.npm/_cacache
```

### 5. 🗄️ Problème de base de données

Si la base de données pose problème :
```bash
# Vérifier la DB
ls -la server/database.sqlite

# Si besoin, recréer la DB (ATTENTION: perte de données)
cd server
rm database.sqlite
npm start  # Recréera la DB automatiquement
```

### 6. 🌐 Test de fonctionnement

Une fois démarré, testez :
- Serveur : http://localhost:5050
- Client : http://localhost:3000
- Login : Gilles / password

### 7. 📞 Aide supplémentaire

Si le problème persiste :
1. Redémarrer complètement le terminal
2. Vérifier l'espace disque disponible
3. Mettre à jour Node.js si nécessaire
4. Vérifier les logs : `tail -f server.log`

## 🚀 Démarrage normal

```bash
./start.sh
# ou
./start-simple.sh
``` 