-- Migration pour ajouter les champs rejected_by et rejected_at à la table shift_replacements

-- Ajouter la colonne rejected_by
ALTER TABLE shift_replacements 
ADD COLUMN rejected_by INTEGER;

-- Ajouter la colonne rejected_at
ALTER TABLE shift_replacements 
ADD COLUMN rejected_at TIMESTAMP;

-- Ajouter la contrainte de clé étrangère pour rejected_by
-- Note: En SQLite, on ne peut pas ajouter de contraintes de clé étrangère après coup
-- mais les contraintes sont optionnelles pour le fonctionnement 