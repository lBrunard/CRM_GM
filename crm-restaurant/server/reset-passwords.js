const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Connexion à la base de données
const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

// Fonction pour hasher un mot de passe
async function hashPassword(password) {
    return await bcrypt.hash(password, 10);
}

// Fonction pour mettre à jour le mot de passe d'un utilisateur
async function resetUserPassword(username, newPassword) {
    try {
        const hashedPassword = await hashPassword(newPassword);
        
        return new Promise((resolve, reject) => {
            db.run(
                'UPDATE users SET password = ? WHERE username = ?',
                [hashedPassword, username],
                function(err) {
                    if (err) {
                        reject(err);
                    } else if (this.changes === 0) {
                        reject(new Error(`Utilisateur '${username}' non trouvé`));
                    } else {
                        resolve({ username, newPassword });
                    }
                }
            );
        });
    } catch (error) {
        throw error;
    }
}

// Fonction pour réinitialiser tous les mots de passe avec un mot de passe par défaut
async function resetAllPasswords(defaultPassword = '123456') {
    try {
        const hashedPassword = await hashPassword(defaultPassword);
        
        return new Promise((resolve, reject) => {
            db.run(
                'UPDATE users SET password = ?',
                [hashedPassword],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({ count: this.changes, password: defaultPassword });
                    }
                }
            );
        });
    } catch (error) {
        throw error;
    }
}

// Fonction principale
async function main() {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.log('\n🔑 Script de réinitialisation des mots de passe');
        console.log('==========================================');
        console.log('\nUtilisation :');
        console.log('  node reset-passwords.js --all [motdepasse]           # Reset tous les mots de passe');
        console.log('  node reset-passwords.js --user username motdepasse   # Reset un utilisateur spécifique');
        console.log('  node reset-passwords.js --list                       # Lister tous les utilisateurs');
        console.log('\nExemples :');
        console.log('  node reset-passwords.js --all admin123               # Tous les mots de passe -> admin123');
        console.log('  node reset-passwords.js --user Gilles nouveaumotdepasse');
        console.log('  node reset-passwords.js --list');
        console.log('\n⚠️  Par défaut, si pas de mot de passe spécifié : 123456');
        return;
    }
    
    try {
        if (args[0] === '--all') {
            const password = args[1] || '123456';
            console.log(`🔄 Réinitialisation de tous les mots de passe...`);
            
            const result = await resetAllPasswords(password);
            console.log(`✅ ${result.count} mots de passe réinitialisés avec : "${result.password}"`);
            
        } else if (args[0] === '--user' && args[1] && args[2]) {
            const username = args[1];
            const password = args[2];
            
            console.log(`🔄 Réinitialisation du mot de passe pour : ${username}`);
            const result = await resetUserPassword(username, password);
            console.log(`✅ Mot de passe mis à jour pour "${result.username}" : "${result.newPassword}"`);
            
        } else if (args[0] === '--list') {
            console.log('\n👥 Liste des utilisateurs :');
            console.log('==========================');
            
            db.all('SELECT id, username, email, role FROM users ORDER BY role, username', (err, users) => {
                if (err) {
                    console.error('❌ Erreur :', err.message);
                } else {
                    users.forEach(user => {
                        const roleIcon = user.role === 'manager' ? '👑' : 
                                       user.role === 'responsable' ? '🛡️' : '👤';
                        console.log(`${roleIcon} ${user.username.padEnd(15)} | ${user.email.padEnd(25)} | ${user.role}`);
                    });
                    console.log(`\nTotal : ${users.length} utilisateurs`);
                }
                db.close();
            });
            return;
            
        } else {
            console.log('❌ Arguments invalides. Utilisez --help pour voir l\'aide.');
            return;
        }
        
    } catch (error) {
        console.error('❌ Erreur :', error.message);
    } finally {
        if (args[0] !== '--list') {
            db.close();
        }
    }
}

// Gérer la fermeture du processus
process.on('SIGINT', () => {
    console.log('\n👋 Arrêt du script...');
    db.close();
    process.exit(0);
});

// Lancer le script
main(); 