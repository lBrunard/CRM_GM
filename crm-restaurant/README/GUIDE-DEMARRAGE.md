# 🚀 Guide de Démarrage Rapide - Restaurant Staff Manager

## ✅ **Problème résolu : Connexion impossible**

Le problème venait de deux sources :
1. **Serveur non démarré** - Le serveur backend n'était pas en cours d'exécution
2. **Mots de passe incorrects** - Les anciens mots de passe ne fonctionnaient plus

## 🔧 **Solutions appliquées :**

### 1. **Mots de passe réinitialisés**
Tous les utilisateurs peuvent maintenant se connecter avec le mot de passe : `admin123`

### 2. **Scripts de démarrage corrigés**
- Le script `start-fixed.sh` installe automatiquement les dépendances manquantes
- Les scripts npm dans `package.json` ont été ajoutés

### 3. **Interface de connexion mise à jour**
Les comptes de démonstration affichent maintenant les bons identifiants.

## 🎯 **Comment démarrer l'application :**

### **Option 1 : Script automatique (Recommandé)**
```bash
./start-fixed.sh
```

### **Option 2 : Scripts npm**
```bash
# Démarrer seulement le serveur
npm run server:dev

# Démarrer seulement le client
npm run client:start

# Démarrer les deux simultanément
npm run dev
```

### **Option 3 : Manuel**
```bash
# Terminal 1 : Serveur
cd server
npm run dev

# Terminal 2 : Client
cd client
npm start
```

## 👥 **Comptes de test disponibles :**

| Rôle | Nom d'utilisateur | Mot de passe | Description |
|------|------------------|--------------|-------------|
| 👑 **Manager** | `Gilles` | `admin123` | Accès complet à toutes les fonctionnalités |
| 👑 **Manager** | `Pedro` | `admin123` | Accès complet à toutes les fonctionnalités |
| 🛡️ **Responsable** | `Luis` | `admin123` | Gestion des équipes et validations |
| 🛡️ **Responsable** | `Baptiste` | `admin123` | Gestion des équipes et validations |
| 👤 **Personnel** | `Raja` | `admin123` | Pointage et consultation des plannings |

**Note :** Tous les 33 utilisateurs utilisent le même mot de passe `admin123`

## 🌐 **URLs de l'application :**

- **Interface web (Client)** : http://localhost:3000
- **API Backend** : http://localhost:5050

## 🔧 **Outils de gestion :**

### **Réinitialiser les mots de passe :**
```bash
cd server
node reset-passwords.js --all nouveaumotdepasse
```

### **Lister tous les utilisateurs :**
```bash
cd server
node reset-passwords.js --list
```

### **Réinitialiser un utilisateur spécifique :**
```bash
cd server
node reset-passwords.js --user Gilles nouveaumotdepasse
```

## 📋 **Vérification du bon fonctionnement :**

1. ✅ **Serveur backend** : Visitez http://localhost:5050 → devrait afficher "API de Gestion du Personnel de Restaurant"
2. ✅ **Client frontend** : Visitez http://localhost:3000 → devrait afficher la page de connexion
3. ✅ **Connexion** : Utilisez `Gilles` / `admin123` pour tester la connexion

## 🚨 **En cas de problème :**

### **Le serveur ne démarre pas :**
```bash
cd server
npm install
npm run dev
```

### **Le client ne démarre pas :**
```bash
cd client
npm install
npm start
```

### **Erreur "react-scripts not found" :**
```bash
cd client
npm install react-scripts@5.0.1
```

## 📝 **Logs de débogage :**

Les logs sont sauvegardés dans :
- `server.log` : Logs du serveur backend
- `client.log` : Logs du client frontend

Pour les consulter en temps réel :
```bash
tail -f server.log
tail -f client.log
```

---

🎉 **Votre application est maintenant prête à être utilisée !** 