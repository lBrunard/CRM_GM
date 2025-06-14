-- Tables pour le système de disponibilité et remplacements

-- Table pour les indisponibilités déclarées
CREATE TABLE IF NOT EXISTS shift_unavailabilities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    shift_id INTEGER NOT NULL,
    reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    FOREIGN KEY (shift_id) REFERENCES shifts (id) ON DELETE CASCADE,
    UNIQUE(user_id, shift_id)
);

-- Table pour les demandes de remplacement
CREATE TABLE IF NOT EXISTS shift_replacements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shift_id INTEGER NOT NULL,
    original_user_id INTEGER NOT NULL,
    replacement_user_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    approved_by INTEGER,
    approved_at TIMESTAMP,
    rejected_by INTEGER,
    rejected_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (shift_id) REFERENCES shifts (id) ON DELETE CASCADE,
    FOREIGN KEY (original_user_id) REFERENCES users (id) ON DELETE CASCADE,
    FOREIGN KEY (replacement_user_id) REFERENCES users (id) ON DELETE CASCADE,
    FOREIGN KEY (approved_by) REFERENCES users (id),
    FOREIGN KEY (rejected_by) REFERENCES users (id),
    UNIQUE(shift_id, replacement_user_id)
); 