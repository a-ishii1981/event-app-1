-- ワークスペース（バイト用・事業用）
CREATE TABLE IF NOT EXISTS workspaces (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('business', 'part_time')),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  date DATE NOT NULL,
  location VARCHAR(200),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sales (
  id SERIAL PRIMARY KEY,
  event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
  product_name VARCHAR(200) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  unit_price INTEGER NOT NULL DEFAULT 0,
  subtotal INTEGER GENERATED ALWAYS AS (quantity * unit_price) STORED,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS expenses (
  id SERIAL PRIMARY KEY,
  event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
  description VARCHAR(200) NOT NULL,
  amount INTEGER NOT NULL DEFAULT 0,
  category VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS memos (
  id SERIAL PRIMARY KEY,
  event_id INTEGER UNIQUE REFERENCES events(id) ON DELETE CASCADE,
  customer_reaction TEXT,
  faq TEXT,
  pop_feedback TEXT,
  next_improvement TEXT,
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS photos (
  id SERIAL PRIMARY KEY,
  event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
  file_path VARCHAR(500),
  caption VARCHAR(200),
  created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO workspaces (name, type) VALUES
  ('自分の事業', 'business'),
  ('バイト', 'part_time')
ON CONFLICT DO NOTHING;
