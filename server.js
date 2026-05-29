const express = require("express");
const path = require("path");
const fs = require("fs");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const multer = require("multer");
const { Pool } = require("pg");
const session = require("express-session");
const pgSession = require("connect-pg-simple")(session);
const cookieParser = require("cookie-parser");
const bcrypt = require("bcryptjs");

// Cloudinary設定
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "event-app",
    allowed_formats: ["jpg", "jpeg", "png", "gif", "webp"],
  },
});

const upload = multer({ storage: storage });
const app = express();
const PORT = process.env.PORT || 3001;

// Render / Heroku などリバースプロキシ環境でsecure cookieを正しく動かす
app.set("trust proxy", 1);

// ─── PostgreSQL 接続（UTF-8 を明示）────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// 接続のたびに client_encoding を UTF-8 に固定
pool.on("connect", (client) => {
  client.query("SET client_encoding = 'UTF8'").catch(() => {});
});

// ─── 起動時テーブル初期化 & 文字化けデータ修正 ────────────────────
async function initDB() {
  // storage テーブル（キーバリュー）
  await pool.query(`
    CREATE TABLE IF NOT EXISTS storage (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);

  // workspaces テーブルが旧コードで作られていた場合の文字化け修正
  const { rows: tables } = await pool.query(`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'workspaces'
  `);

  if (tables.length > 0) {
    await pool.query(`
      UPDATE workspaces SET name = 'バイト用'
      WHERE slug = 'baito' OR id = 1
    `);
    await pool.query(`
      UPDATE workspaces SET name = '自分の事業用'
      WHERE slug = 'jigyou' OR id = 2
    `);
    console.log("workspaces テーブルの文字化けを修正しました");
  }
}

initDB().catch((e) => console.error("DB初期化エラー:", e.message));


// ─── ミドルウェア ─────────────────────────────────────────────────
app.use(cookieParser());
app.use(express.json({ limit: "20mb" }));

app.use(session({
  store: new pgSession({
    pool,
    createTableIfMissing: true
  }),
  secret: process.env.SESSION_SECRET || "event-app-secret-key-change-in-production",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax"
    // maxAge はログイン時に rememberMe に応じて設定
  }
}));

// 静的ファイルに charset=utf-8 を明示して配信
app.use(express.static(path.join(__dirname, "public"), {
  setHeaders(res, filePath) {
    if (filePath.endsWith(".html")) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
    } else if (filePath.endsWith(".js")) {
      res.setHeader("Content-Type", "application/javascript; charset=utf-8");
    } else if (filePath.endsWith(".css")) {
      res.setHeader("Content-Type", "text/css; charset=utf-8");
    }
  }
}));

// ─── 認証ミドルウェア ─────────────────────────────────────────────
function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) return next();
  res.status(401).json({ error: "Unauthorized" });
}

// ─── 認証状態確認 ────────────────────────────────────────────────
app.get("/api/auth-check", (req, res) => {
  res.json({ authenticated: !!(req.session && req.session.authenticated) });
});

// ─── ログイン ─────────────────────────────────────────────────────
app.post("/api/login", async (req, res) => {
  const { id, password, rememberMe } = req.body;
  const adminUser = process.env.ADMIN_USER;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminUser || !adminPassword) {
    return res.status(500).json({ error: "認証設定が未構成です（ADMIN_USER / ADMIN_PASSWORD を環境変数に設定してください）" });
  }

  if (!id || !password) {
    return res.status(401).json({ error: "IDとパスワードを入力してください" });
  }

  if (id !== adminUser) {
    return res.status(401).json({ error: "IDまたはパスワードが正しくありません" });
  }

  // bcryptハッシュ or プレーンテキスト両対応
  let passwordMatch;
  if (adminPassword.startsWith("$2b$") || adminPassword.startsWith("$2a$")) {
    passwordMatch = await bcrypt.compare(password, adminPassword);
  } else {
    passwordMatch = password === adminPassword;
  }

  if (!passwordMatch) {
    return res.status(401).json({ error: "IDまたはパスワードが正しくありません" });
  }

  req.session.authenticated = true;
  if (rememberMe) {
    req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; // 30日
  }

  res.json({ ok: true });
});

// ─── ログアウト ───────────────────────────────────────────────────
app.post("/api/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.json({ ok: true });
  });
});

// ─── ストレージ API（認証必須）───────────────────────────────────
app.get("/api/storage/:key", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT value FROM storage WHERE key = $1",
      [req.params.key]
    );
    if (result.rows.length === 0) return res.json({ value: null });
    res.json({ value: result.rows[0].value });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/storage/:key", requireAuth, async (req, res) => {
  try {
    await pool.query(
      "INSERT INTO storage (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2",
      [req.params.key, req.body.value]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── DB 診断エンドポイント（認証必須）────────────────────────────
app.get("/api/db-info", requireAuth, async (req, res) => {
  try {
    const { rows: tables } = await pool.query(`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
    `);
    const { rows: encoding } = await pool.query(
      "SHOW client_encoding"
    );
    const info = { client_encoding: encoding[0]?.client_encoding, tables: tables.map(r => r.tablename) };

    if (info.tables.includes("workspaces")) {
      const { rows: ws } = await pool.query("SELECT * FROM workspaces ORDER BY id");
      info.workspaces = ws;
    }

    if (info.tables.includes("storage")) {
      const { rows: st } = await pool.query(
        "SELECT key, octet_length(value) AS bytes FROM storage ORDER BY key"
      );
      info.storage_keys = st;
    }

    res.json(info);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── ファイルアップロード API（認証必須）─────────────────────────
app.post("/api/upload", requireAuth, upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "ファイルがありません" });
  res.json({
    url: req.file.path,
    filename: req.file.originalname,
    public_id: req.file.filename,
  });
});

// ─── ファイル削除 API（認証必須）─────────────────────────────────
app.delete("/api/upload/:public_id", requireAuth, async (req, res) => {
  try {
    const public_id = "event-app/" + req.params.public_id;
    await cloudinary.uploader.destroy(public_id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`イベント販売記録アプリ起動 ポート:${PORT}`);
});
