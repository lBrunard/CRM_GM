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

# Vérifier les dépendances
echo -e "${YELLOW}Vérification des dépendances...${NC}"
if [ ! -d "$SERVER_DIR/node_modules" ]; then
    echo -e "${RED}❌ Dépendances serveur manquantes.${NC}"
    echo -e "${YELLOW}Exécutez: cd server && npm install${NC}"
    exit 1
fi

if [ ! -d "$CLIENT_DIR/node_modules" ]; then
    echo -e "${RED}❌ Dépendances client manquantes.${NC}"
    echo -e "${YELLOW}Exécutez: cd client && npm install${NC}"
    exit 1
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
npm run dev > ../server.log 2>&1 &
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

# Définir les variables d'environnement pour éviter les problèmes
export BROWSER=none
export CI=false

npm start &
CLIENT_PID=$!
cd "$SCRIPT_PATH"

echo -e "${GREEN}Client frontend démarré (PID: $CLIENT_PID)${NC}"
echo -e "${GREEN}URL du client: http://localhost:3000${NC}"

echo
echo -e "${GREEN}🎉 Application démarrée avec succès!${NC}"
echo -e "${YELLOW}📱 Interface web: http://localhost:3000${NC}"
echo -e "${YELLOW}🔧 API Backend: http://localhost:5050${NC}"
echo
echo -e "${RED}❌ Pour arrêter: Appuyez sur Ctrl+C${NC}"
echo

# Attendre les processus enfants
wait 