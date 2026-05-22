// In-memory SSE client registry: userId → Set<res>
const clients = new Map();

function pushToUser(userId, data) {
  const conns = clients.get(userId);
  if (!conns || conns.size === 0) return;
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  conns.forEach(res => {
    try { res.write(payload); } catch { /* client disconnected */ }
  });
}

function addClient(userId, res) {
  if (!clients.has(userId)) clients.set(userId, new Set());
  clients.get(userId).add(res);
}

function removeClient(userId, res) {
  const conns = clients.get(userId);
  if (!conns) return;
  conns.delete(res);
  if (conns.size === 0) clients.delete(userId);
}

module.exports = { pushToUser, addClient, removeClient };
