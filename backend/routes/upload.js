const express = require('express');
const multer = require('multer');
const supabase = require('../lib/supabase');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'];
    cb(null, allowed.includes(file.mimetype));
  },
});

router.post('/', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'File không hợp lệ hoặc thiếu file' });

  const ext = req.file.originalname.split('.').pop().toLowerCase();
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const { error } = await supabase.storage
    .from('licenses')
    .upload(filename, req.file.buffer, { contentType: req.file.mimetype, upsert: false });

  if (error) return res.status(500).json({ error: error.message });

  const { data } = supabase.storage.from('licenses').getPublicUrl(filename);
  res.json({ url: data.publicUrl });
});

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    cb(null, allowed.includes(file.mimetype));
  },
});

router.post('/product', requireAdmin, imageUpload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'File ảnh không hợp lệ' });

  const ext = req.file.originalname.split('.').pop().toLowerCase();
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const { error } = await supabase.storage
    .from('products')
    .upload(filename, req.file.buffer, { contentType: req.file.mimetype, upsert: false });

  if (error) return res.status(500).json({ error: error.message });

  const { data } = supabase.storage.from('products').getPublicUrl(filename);
  res.json({ url: data.publicUrl });
});

module.exports = router;
