#!/bin/bash

# start.sh - Script pour lancer le client et le serveur de l'application Restaurant Staff Manager
# Usage: ./start.sh

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
echo -e "${GREEN}      Restaurant Staff Manager Starter      ${NC}"
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
    echo -e "${YELLOW}Chemin actuel: $(pwd)${NC}"
    echo -e "${YELLOW}Dossier client recherché: ${CLIENT_DIR}${NC}"
    echo -e "${YELLOW}Dossier server recherché: ${SERVER_DIR}${NC}"
    exit 1
fi

# Vérifier si le serveur est déjà en cours d'exécution
SERVER_PORT=5050
if command -v lsof &> /dev/null && lsof -i:$SERVER_PORT -t &> /dev/null; then
    echo -e "${YELLOW}Avertissement: Un processus utilise déjà le port $SERVER_PORT.${NC}"
    echo -e "${YELLOW}Le serveur backend pourrait ne pas démarrer correctement.${NC}"
fi

# Fonction pour nettoyer et quitter
cleanup() {
    echo -e "\n${YELLOW}Arrêt des processus...${NC}"
    
    # Tuer tous les processus de ce groupe
    kill -15 0 &>/dev/null
    
    echo -e "${GREEN}Application terminée.${NC}"
    exit 0
}

# Attacher la fonction de nettoyage au signal d'interruption
trap cleanup SIGINT SIGTERM

# Démarrer le serveur backend
echo -e "${BLUE}Démarrage du serveur backend...${NC}"
(cd "$SERVER_DIR" && npm run dev) &
SERVER_PID=$!
echo -e "${GREEN}Serveur backend démarré (PID: $SERVER_PID)${NC}"
echo -e "${GREEN}URL du serveur: http://localhost:5050${NC}"

# Attendre quelques secondes pour que le serveur démarre
echo -e "${YELLOW}Attente du démarrage du serveur...${NC}"
sleep 5

# Démarrer le client frontend
echo -e "${BLUE}Démarrage du client frontend...${NC}"
(cd "$CLIENT_DIR" && npm start) &
CLIENT_PID=$!
echo -e "${GREEN}Client frontend démarré (PID: $CLIENT_PID)${NC}"

echo
echo -e "${GREEN}L'application est en cours d'exécution!${NC}"
echo -e "${YELLOW}Appuyez sur Ctrl+C pour arrêter tous les processus.${NC}"

# Attendre les processus enfants
wait 