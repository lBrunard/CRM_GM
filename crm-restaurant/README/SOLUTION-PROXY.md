# 🔧 Solution au Problème de Proxy Réseau

## 🚨 **Problème identifié :**

```
Proxy error: Could not proxy request /api/users/login from 192.168.1.32:3000 to http://localhost:5050.
```

**Cause :** Le client React fonctionne sur votre IP réseau (`192.168.1.32:3000`) mais essaie de communiquer avec `localhost:5050`, ce qui ne fonctionne pas.

## ✅ **Solutions appliquées :**

### 1. **Configuration du proxy mise à jour**
Le `client/package.json` a été modifié pour pointer vers votre IP réseau :
```json
"proxy": "http://192.168.1.32:5050"
```

### 2. **Serveur configuré pour écouter sur toutes les interfaces**
Le serveur écoute maintenant sur `0.0.0.0:5050` (toutes les interfaces réseau).

### 3. **Script de démarrage amélioré**
Le `start-fixed.sh` configure automatiquement les bonnes variables d'environnement.

## 🚀 **Comment résoudre le problème :**

### **Étape 1 : Arrêter tous les processus**
```bash
# Tuer tous les processus Node.js
pkill -f node
# Ou plus spécifiquement
pkill -f "react-scripts"
pkill -f "nodemon"
```

### **Étape 2 : Redémarrer avec le script corrigé**
```bash
./start-fixed.sh
```

### **Étape 3 : Vérification manuelle si problème persiste**

#### **Démarrer le serveur manuellement :**
```bash
cd server
export HOST=0.0.0.0
export PORT=5050
npm run dev
```

#### **Dans un autre terminal, démarrer le client :**
```bash
cd client
export HOST=0.0.0.0
npm start
```

### **Étape 4 : Tests de vérification**

#### **Test 1 : Serveur sur IP réseau**
```bash
curl http://192.168.1.32:5050/
```
Devrait retourner : "API de Gestion du Personnel de Restaurant"

#### **Test 2 : Connexion API**
```bash
curl -X POST http://192.168.1.32:5050/api/users/login \
  -H "Content-Type: application/json" \
  -d '{"username":"Gilles","password":"admin123"}'
```
Devrait retourner un JSON avec token et user.

#### **Test 3 : Client accessible**
Ouvrir : http://192.168.1.32:3000

## 🔧 **Configuration manuelle alternative :**

Si le problème persiste, modifiez manuellement :

### **client/package.json :**
```json
{
  "proxy": "http://192.168.1.32:5050"
}
```

### **Ou créez un fichier `.env` dans le dossier client :**
```
HOST=0.0.0.0
REACT_APP_API_URL=http://192.168.1.32:5050
```

## 🌐 **URLs finales :**
- **Client (Interface)** : http://192.168.1.32:3000
- **Serveur (API)** : http://192.168.1.32:5050

## 🚨 **Si votre IP change :**

Votre IP réseau peut changer. Pour la détecter :
```bash
# Sur macOS/Linux
ifconfig | grep "inet " | grep -v 127.0.0.1

# Ou plus simple
hostname -I | awk '{print $1}'
```

Puis mettez à jour le proxy dans `client/package.json`.

## 🛠️ **Vérification du pare-feu :**

Assurez-vous que le port 5050 n'est pas bloqué :
```bash
# Test si le port est ouvert
lsof -i :5050

# Vérifier les processus qui utilisent le port
sudo netstat -tulpn | grep :5050
```

---

## 📋 **Checklist de résolution :**

- [ ] ✅ Serveur écoute sur `0.0.0.0:5050`
- [ ] ✅ Client configuré pour proxy vers `192.168.1.32:5050`
- [ ] ✅ Variables d'environnement `HOST=0.0.0.0` définies
- [ ] ✅ Aucun autre processus n'utilise les ports 3000/5050
- [ ] ✅ Tests curl fonctionnent
- [ ] ✅ Application accessible sur l'IP réseau

**Une fois ces étapes complétées, votre problème de connexion devrait être résolu !** 🎉 