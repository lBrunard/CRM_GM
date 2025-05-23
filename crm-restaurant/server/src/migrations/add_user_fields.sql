-- Migration pour ajouter les nouveaux champs utilisateur
ALTER TABLE users ADD COLUMN first_name TEXT;
ALTER TABLE users ADD COLUMN last_name TEXT;
ALTER TABLE users ADD COLUMN phone TEXT;
ALTER TABLE users ADD COLUMN national_number TEXT;
ALTER TABLE users ADD COLUMN address TEXT;
ALTER TABLE users ADD COLUMN iban TEXT;
ALTER TABLE users ADD COLUMN hourly_rate DECIMAL(10,2) DEFAULT 0.00; 