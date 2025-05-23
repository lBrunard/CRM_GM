const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// Charger les variables d'environnement
dotenv.config();

// Importer les routes
const userRoutes = require('./routes/userRoutes');
const shiftRoutes = require('./routes/shiftRoutes');
const timeclockRoutes = require('./routes/timeclockRoutes');

const app = express();
// Changer de port pour éviter le conflit avec AirTunes d'Apple (port 5000)
const PORT = process.env.PORT || 5050; 

// Middleware d'inspection des requêtes (doit être avant tout autre middleware)
app.use((req, res, next) => {
  console.log('='.repeat(50));
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  console.log('Headers:', req.headers);
  
  if (req.method === 'POST' || req.method === 'PUT') {
    console.log('Body brut:', req.body); // Sera undefined à ce stade
    
    // Sauvegarder la fonction res.send originale
    const originalSend = res.send;
    
    // Modifier res.send pour logguer la réponse
    res.send = function(body) {
      console.log('Réponse:', {
        statusCode: res.statusCode,
        body: typeof body === 'object' ? body : body?.toString().substring(0, 200)
      });
      // Appeler la fonction originale
      return originalSend.apply(this, arguments);
    };
  }
  
  console.log('-'.repeat(50));
  next();
});

// Configuration CORS standard
app.use(cors({
  origin: '*', // Permettre toutes les origines pour le développement
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Middleware pour parser le JSON (après l'inspection)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Maintenant, on peut accéder au corps parsé
app.use((req, res, next) => {
  if (req.method === 'POST' || req.method === 'PUT') {
    console.log('Body parsé:', req.body);
  }
  next();
});

// Routes
app.use('/api/users', userRoutes);
app.use('/api/shifts', shiftRoutes);
app.use('/api/timeclock', timeclockRoutes);

// Route de base
app.get('/', (req, res) => {
  res.send('API de Gestion du Personnel de Restaurant');
});

// Gestion des erreurs 404
app.use((req, res) => {
  res.status(404).json({ message: 'Route non trouvée' });
});

// Gestion des erreurs globales
app.use((err, req, res, next) => {
  console.error('ERREUR:', err.stack);
  res.status(500).json({ 
    message: 'Une erreur est survenue sur le serveur',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Démarrer le serveur
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
  console.log(`Accessible localement sur: http://localhost:${PORT}`);
  console.log(`Accessible sur le réseau sur: http://[VOTRE_IP]:${PORT}`);
});

module.exports = app;
