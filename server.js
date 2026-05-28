const express = require("express");
const path = require("path");
const fs = require("fs");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const multer = require("multer");
const { Pool } = require("pg");
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
    // slug や id を使って確実に正しい日本語へ上書き
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

// ─── アップロードフォルダの確保 ───────────────────────────────────
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// ─── multer 設定 ──────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
    cb(null, `${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("画像ファイルのみアップロード可能です"));
  }
});

// ─── ミドルウェア ─────────────────────────────────────────────────
app.use(express.json({ limit: "20mb" }));

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
app.use("/uploads", express.static(uploadDir));

// ─── ストレージ API ───────────────────────────────────────────────
app.get("/api/storage/:key", async (req, res) => {
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

app.post("/api/storage/:key", async (req, res) => {
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

// ─── DB 診断エンドポイント（文字化け確認用）──────────────────────
app.get("/api/db-info", async (req, res) => {
  try {
    const { rows: tables } = await pool.query(`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
    `);
    const { rows: encoding } = await pool.query(
      "SHOW client_encoding"
    );
    const info = { client_encoding: encoding[0]?.client_encoding, tables: tables.map(r => r.tablename) };

    // workspaces テーブルが存在すれば中身を返す
    if (info.tables.includes("workspaces")) {
      const { rows: ws } = await pool.query("SELECT * FROM workspaces ORDER BY id");
      info.workspaces = ws;
    }

    // storage テーブルのキー一覧
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

// ─── ファイルアップロード API ─────────────────────────────────────
app.post("/api/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "ファイルがありません" });
  res.json({
    url: req.file.path,
    filename: req.file.originalname,
    public_id: req.file.filename,
  });
});

// ─── ファイル削除 API ─────────────────────────────────────────────
app.delete("/api/upload/:public_id", async (req, res) => {
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
