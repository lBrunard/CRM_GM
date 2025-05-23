-- Migration pour ajouter une table d'audit des modifications des heures
CREATE TABLE IF NOT EXISTS hours_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_shift_id INTEGER NOT NULL,
  modified_by INTEGER NOT NULL,
  action TEXT NOT NULL, -- 'UPDATE_HOURS', 'VALIDATE', 'REVALIDATE'
  old_clock_in TEXT,
  new_clock_in TEXT,
  old_clock_out TEXT,
  new_clock_out TEXT,
  old_validated INTEGER DEFAULT 0,
  new_validated INTEGER DEFAULT 0,
  reason TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_shift_id) REFERENCES user_shifts(id),
  FOREIGN KEY (modified_by) REFERENCES users(id)
); 