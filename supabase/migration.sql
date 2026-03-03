-- ═══════════════════════════════════════════════════════
-- PokerAI V1 Schema — Run in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════

-- 1. SESSIONS (rooms)
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code VARCHAR(10) UNIQUE NOT NULL,
  name VARCHAR(120) NOT NULL DEFAULT 'Planning Session',
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('waiting', 'active', 'completed')),
  voting_scale VARCHAR(20) NOT NULL DEFAULT 'fibonacci',
  current_ticket_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sessions_room_code ON sessions (room_code);

-- 2. SESSION PARTICIPANTS
CREATE TABLE IF NOT EXISTS session_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  participant_id VARCHAR(64) NOT NULL,
  display_name VARCHAR(48) NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_observer BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(session_id, participant_id)
);

CREATE INDEX IF NOT EXISTS idx_participants_session ON session_participants (session_id);

-- 3. TICKETS
CREATE TABLE IF NOT EXISTS tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT DEFAULT '',
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'voting', 'revealed', 'complete')),
  final_estimate VARCHAR(10),
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  external_url VARCHAR(512),
  jira_key VARCHAR(20),
  ai_assessment JSONB
);

CREATE INDEX IF NOT EXISTS idx_tickets_session ON tickets (session_id);

-- 4. VOTES
CREATE TABLE IF NOT EXISTS votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  participant_id VARCHAR(64) NOT NULL,
  value VARCHAR(10) NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_ai_vote BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(ticket_id, participant_id)
);

CREATE INDEX IF NOT EXISTS idx_votes_ticket ON votes (ticket_id);
CREATE INDEX IF NOT EXISTS idx_votes_session ON votes (session_id);

-- 5. DISABLE RLS FOR NOW (will enable with Auth in next iteration)
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;

-- Open policies (replaced with proper auth policies later)
CREATE POLICY "Allow all on sessions" ON sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on session_participants" ON session_participants FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on tickets" ON tickets FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on votes" ON votes FOR ALL USING (true) WITH CHECK (true);

-- 6. ENABLE REALTIME
ALTER PUBLICATION supabase_realtime ADD TABLE sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE session_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE tickets;
ALTER PUBLICATION supabase_realtime ADD TABLE votes;

-- 7. ROOM CODE GENERATOR (called via supabase.rpc)
CREATE OR REPLACE FUNCTION generate_room_code()
RETURNS VARCHAR AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code TEXT := '';
  i INTEGER;
BEGIN
  LOOP
    code := '';
    FOR i IN 1..3 LOOP
      code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    code := code || '-';
    FOR i IN 1..3 LOOP
      code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    IF NOT EXISTS (SELECT 1 FROM sessions WHERE room_code = code) THEN
      RETURN code;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;
