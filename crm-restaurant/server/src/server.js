const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// Charger les variables d'environnement
dotenv.config();

// Importer les routes
const userRoutes = require('./routes/userRoutes');
const shiftRoutes = require('./routes/shiftRoutes');
const timeclockRoutes = require('./routes/timeclockRoutes');
const availabilityRoutes = require('./routes/availabilityRoutes');

const app = express();

const PORT = process.env.PORT || 5000; 

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
app.use('/api/availability', availabilityRoutes);

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
app.listen(PORT, () => {
  console.log(`Server runing on port ${PORT}`);
});

module.exports = app;
