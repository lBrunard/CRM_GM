#!/bin/bash

# start-fixed.sh - Script corrigé pour lancer le client et le serveur
# Usage: ./start-fixed.sh

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Détection du chemin du script
SCRIPT_PATH="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_PATH"

# Afficher l'en-tête
echo -e "${BLUE}==============================================${NC}"
echo -e "${GREEN}  Restaurant Staff Manager (Version Fixée)  ${NC}"
echo -e "${BLUE}==============================================${NC}"
echo

# Vérifier que Node.js est installé
if ! command -v node &> /dev/null; then
    echo -e "${RED}Erreur: Node.js n'est pas installé.${NC}"
    exit 1
fi

# Chemin vers les dossiers client et serveur
CLIENT_DIR="${SCRIPT_PATH}/client"
SERVER_DIR="${SCRIPT_PATH}/server"

# Vérifier que les dossiers existent
if [ ! -d "$CLIENT_DIR" ] || [ ! -d "$SERVER_DIR" ]; then
    echo -e "${RED}Erreur: Les dossiers client ou server n'existent pas.${NC}"
    exit 1
fi

# Vérifier et installer les dépendances
echo -e "${YELLOW}Vérification des dépendances...${NC}"

# Vérifier et installer les dépendances du serveur
if [ ! -d "$SERVER_DIR/node_modules" ] || [ ! -f "$SERVER_DIR/node_modules/.package-lock.json" ]; then
    echo -e "${YELLOW}Installation des dépendances serveur...${NC}"
    cd "$SERVER_DIR"
    npm install
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Erreur lors de l'installation des dépendances serveur${NC}"
        exit 1
    fi
    cd "$SCRIPT_PATH"
    echo -e "${GREEN}✅ Dépendances serveur installées${NC}"
fi

# Vérifier et installer les dépendances du client
if [ ! -d "$CLIENT_DIR/node_modules" ] || [ ! -f "$CLIENT_DIR/node_modules/.package-lock.json" ]; then
    echo -e "${YELLOW}Installation des dépendances client...${NC}"
    cd "$CLIENT_DIR"
    npm install
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Erreur lors de l'installation des dépendances client${NC}"
        exit 1
    fi
    cd "$SCRIPT_PATH"
    echo -e "${GREEN}✅ Dépendances client installées${NC}"
fi

# Vérifier que react-scripts est disponible
if ! cd "$CLIENT_DIR" && npm list react-scripts &>/dev/null; then
    echo -e "${RED}❌ react-scripts non trouvé, réinstallation...${NC}"
    cd "$CLIENT_DIR"
    npm install react-scripts@5.0.1
    cd "$SCRIPT_PATH"
fi

# Fonction pour nettoyer et quitter
cleanup() {
    echo -e "\n${YELLOW}Arrêt des processus...${NC}"
    
    # Tuer spécifiquement les processus Node.js
    pkill -f "nodemon.*server" 2>/dev/null
    pkill -f "react-scripts" 2>/dev/null
    pkill -f "node.*server.js" 2>/dev/null
    
    # Attendre un peu avant de tuer plus agressivement
    sleep 2
    
    # Si des processus persistent, les tuer plus agressivement
    lsof -ti:5050 | xargs kill -9 2>/dev/null
    lsof -ti:3000 | xargs kill -9 2>/dev/null
    
    echo -e "${GREEN}Application terminée.${NC}"
    exit 0
}

# Attacher la fonction de nettoyage au signal d'interruption
trap cleanup SIGINT SIGTERM

# Nettoyer les processus existants d'abord
echo -e "${YELLOW}Nettoyage des processus existants...${NC}"
pkill -f "nodemon.*server" 2>/dev/null
pkill -f "react-scripts" 2>/dev/null
pkill -f "node.*server.js" 2>/dev/null
sleep 2

# Vérifier si les ports sont libres
SERVER_PORT=5050
CLIENT_PORT=3000

if lsof -i:$SERVER_PORT -t &> /dev/null; then
    echo -e "${YELLOW}Port $SERVER_PORT occupé, libération...${NC}"
    lsof -ti:$SERVER_PORT | xargs kill -9 2>/dev/null
    sleep 2
fi

if lsof -i:$CLIENT_PORT -t &> /dev/null; then
    echo -e "${YELLOW}Port $CLIENT_PORT occupé, libération...${NC}"
    lsof -ti:$CLIENT_PORT | xargs kill -9 2>/dev/null
    sleep 2
fi

# Démarrer le serveur backend
echo -e "${BLUE}Démarrage du serveur backend...${NC}"
cd "$SERVER_DIR"

# Démarrer le serveur avec les variables d'environnement spécifiques
HOST=0.0.0.0 PORT=5050 npm run dev > ../server.log 2>&1 &
SERVER_PID=$!
cd "$SCRIPT_PATH"

echo -e "${GREEN}Serveur backend démarré (PID: $SERVER_PID)${NC}"
echo -e "${GREEN}URL du serveur: http://localhost:5050${NC}"

# Attendre que le serveur soit prêt
echo -e "${YELLOW}Attente du démarrage du serveur...${NC}"
for i in {1..10}; do
    if curl -s http://localhost:5050 > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Serveur prêt!${NC}"
        break
    fi
    echo -e "${YELLOW}Attente... ($i/10)${NC}"
    sleep 1
done

# Démarrer le client frontend
echo -e "${BLUE}Démarrage du client frontend...${NC}"
cd "$CLIENT_DIR"

# Vérifier une dernière fois que react-scripts fonctionne
if ! ./node_modules/.bin/react-scripts --version &>/dev/null; then
    echo -e "${RED}❌ react-scripts ne fonctionne pas correctement${NC}"
    echo -e "${YELLOW}💡 Essayez de supprimer node_modules et relancer: rm -rf node_modules && npm install${NC}"
    exit 1
fi

# Démarrer le client avec les variables d'environnement spécifiques
BROWSER=none CI=false SKIP_PREFLIGHT_CHECK=true HOST=0.0.0.0 npm start > ../client.log 2>&1 &
CLIENT_PID=$!
cd "$SCRIPT_PATH"

echo -e "${GREEN}Client frontend démarré (PID: $CLIENT_PID)${NC}"

# Attendre que le client soit prêt
echo -e "${YELLOW}Attente du démarrage du client...${NC}"
for i in {1..15}; do
    if curl -s http://localhost:3000 > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Client prêt!${NC}"
        break
    fi
    echo -e "${YELLOW}Attente... ($i/15)${NC}"
    sleep 2
done

echo -e "${GREEN}URL du client: http://localhost:3000${NC}"

echo
echo -e "${GREEN}🎉 Application démarrée avec succès!${NC}"
echo -e "${YELLOW}📱 Interface web: http://localhost:3000${NC}"
echo -e "${YELLOW}🔧 API Backend: http://localhost:5050${NC}"
echo
echo -e "${YELLOW}📋 Logs disponibles:${NC}"
echo -e "${YELLOW}   - Serveur: tail -f server.log${NC}"
echo -e "${YELLOW}   - Client: tail -f client.log${NC}"
echo
echo -e "${RED}❌ Pour arrêter: Appuyez sur Ctrl+C${NC}"
echo

# Attendre les processus enfants
wait 