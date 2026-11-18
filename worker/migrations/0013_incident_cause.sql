-- Root cause of an incident, from diagnose.js: a cause code (database, php_memory, wordpress_fatal, ...), the
-- component that failed and a one-line fix hint. Empty when the failure could not be diagnosed.
ALTER TABLE incidents ADD COLUMN cause TEXT;
ALTER TABLE incidents ADD COLUMN component TEXT;
ALTER TABLE incidents ADD COLUMN hint TEXT;
