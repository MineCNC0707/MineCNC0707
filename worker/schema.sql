PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS users (
 id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL,
 password_hash TEXT NOT NULL, salt TEXT NOT NULL, created_at INTEGER NOT NULL,
 last_seen INTEGER NOT NULL, tutorial_step INTEGER NOT NULL DEFAULT 0,
 player_exp INTEGER NOT NULL DEFAULT 0, currency INTEGER NOT NULL DEFAULT 0 CHECK(currency>=0),
 equipped TEXT NOT NULL DEFAULT 'pistol', last_invite INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS session_user ON sessions(user_id);
CREATE TABLE IF NOT EXISTS weapons (user_id TEXT NOT NULL REFERENCES users(id), weapon TEXT NOT NULL, exp INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(user_id,weapon));
CREATE TABLE IF NOT EXISTS friendships (sender TEXT NOT NULL REFERENCES users(id), recipient TEXT NOT NULL REFERENCES users(id), accepted INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(sender,recipient));
CREATE TABLE IF NOT EXISTS invites (id TEXT PRIMARY KEY, sender TEXT NOT NULL REFERENCES users(id), recipient TEXT NOT NULL REFERENCES users(id), room_id TEXT NOT NULL, expires_at INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pending');
CREATE INDEX IF NOT EXISTS recipient_invites ON invites(recipient,status,expires_at);
CREATE TABLE IF NOT EXISTS limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL DEFAULT 0, reset_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS receipts (match_id TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES users(id), score INTEGER NOT NULL, currency INTEGER NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY(match_id,user_id));
