CREATE TABLE gym_sessions (
 id TEXT PRIMARY KEY NOT NULL,
 owner TEXT NOT NULL,
 last_seen INTEGER NOT NULL,
 mode TEXT NOT NULL,
 joints INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX gym_sessions_owner_seen ON gym_sessions(owner,last_seen);
--> statement-breakpoint
CREATE TABLE gym_commands (
 id TEXT PRIMARY KEY NOT NULL,
 session_id TEXT NOT NULL,
 owner TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 expires_at INTEGER NOT NULL,
 payload TEXT NOT NULL,
 status TEXT NOT NULL,
 result TEXT
);
--> statement-breakpoint
CREATE INDEX gym_commands_pending ON gym_commands(session_id,owner,status,created_at);
