const express = require('express');
const supabase = require('../lib/supabase');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Customer: get own messages
router.get('/', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });

  // Mark admin messages as read
  await supabase
    .from('messages')
    .update({ is_read: true })
    .eq('user_id', req.user.id)
    .eq('sender_role', 'admin')
    .eq('is_read', false);

  res.json(data || []);
});

// Customer: send message
router.post('/', requireAuth, async (req, res) => {
  const { content } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: 'Nội dung trống' });

  const { data, error } = await supabase
    .from('messages')
    .insert({ user_id: req.user.id, sender_role: 'customer', content: content.trim() })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// Customer: unread count (messages from admin not yet read)
router.get('/unread', requireAuth, async (req, res) => {
  const { count, error } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', req.user.id)
    .eq('sender_role', 'admin')
    .eq('is_read', false);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ count: count || 0 });
});

// Admin: list conversations (one row per user)
router.get('/admin/conversations', requireAdmin, async (req, res) => {
  // Get latest message per user
  const { data, error } = await supabase
    .from('messages')
    .select('user_id, content, sender_role, created_at, is_read, users(pharmacy_name, phone)')
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  // Deduplicate: keep latest per user_id, also count unread from customer
  const map = new Map();
  const unreadMap = new Map();

  (data || []).forEach(m => {
    if (!map.has(m.user_id)) map.set(m.user_id, m);
    if (m.sender_role === 'customer' && !m.is_read) {
      unreadMap.set(m.user_id, (unreadMap.get(m.user_id) || 0) + 1);
    }
  });

  const conversations = Array.from(map.values()).map(m => ({
    user_id: m.user_id,
    pharmacy_name: m.users?.pharmacy_name,
    phone: m.users?.phone,
    last_message: m.content,
    last_sender: m.sender_role,
    last_at: m.created_at,
    unread: unreadMap.get(m.user_id) || 0,
  }));

  // Sort by latest message
  conversations.sort((a, b) => new Date(b.last_at) - new Date(a.last_at));
  res.json(conversations);
});

// Admin: get messages for a specific user
router.get('/admin/messages/:userId', requireAdmin, async (req, res) => {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('user_id', req.params.userId)
    .order('created_at', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });

  // Mark customer messages as read
  await supabase
    .from('messages')
    .update({ is_read: true })
    .eq('user_id', req.params.userId)
    .eq('sender_role', 'customer')
    .eq('is_read', false);

  res.json(data || []);
});

// Admin: send message to a user
router.post('/admin/messages/:userId', requireAdmin, async (req, res) => {
  const { content } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: 'Nội dung trống' });

  const { data, error } = await supabase
    .from('messages')
    .insert({ user_id: req.params.userId, sender_role: 'admin', content: content.trim() })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

module.exports = router;
