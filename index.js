require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const supabase = require('./config/supabase');

const authRoutes = require('./routes/auth');
const brugerRoutes = require('./routes/brugere');
const lektierRoutes = require('./routes/lektier');
const fravaerRoutes = require('./routes/fravaer');
const chatRoutes = require('./routes/chat');
const grupperRoutes = require('./routes/grupper');
const opslagRoutes = require('./routes/opslag');
const ugeplanRoutes = require('./routes/ugeplan');
const notifRoutes = require('./routes/notifikationer');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: process.env.FRONTEND_URL || '*', methods: ['GET', 'POST'] },
});

io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('Ingen token'));
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    socket.bruger = payload;
    next();
  } catch { next(new Error('Ugyldig token')); }
});

const aktiveBrugere = new Map();

io.on('connection', (socket) => {
  const bruger = socket.bruger;
  aktiveBrugere.set(socket.id, bruger);
  socket.join(`bruger:${bruger.id}`);

  socket.on('privat:send', async ({ tilBrugerId, tekst }) => {
    if (!tekst?.trim() || !tilBrugerId) return;
    try {
      const { data } = await supabase.from('beskeder')
        .insert({ fra_bruger: bruger.id, til_bruger: tilBrugerId, tekst: tekst.trim() })
        .select('id, tekst, sendt_kl, fra:brugere!beskeder_fra_bruger_fkey(id, navn, avatar_url)')
        .single();
      io.to(`bruger:${tilBrugerId}`).emit('privat:ny', { ...data, type: 'privat' });
      socket.emit('privat:ny', { ...data, type: 'privat' });
    } catch (err) { console.error('Socket privat fejl:', err); }
  });

  socket.on('klass:send', async ({ klass, tekst }) => {
    if (!tekst?.trim() || !klass || bruger.rolle === 'laerer') return;
    try {
      const { data } = await supabase.from('klassechat_beskeder')
        .insert({ klass, fra_bruger: bruger.id, tekst: tekst.trim() })
        .select('id, tekst, sendt_kl, fra:brugere!klassechat_beskeder_fra_bruger_fkey(id, navn, avatar_url, rolle)')
        .single();
      io.to(`klassechat:${klass}`).emit('klass:ny', data);
    } catch (err) { console.error('Socket klassechat fejl:', err); }
  });

  socket.on('klass:join', ({ klass }) => socket.join(`klassechat:${klass}`));

  socket.on('disconnect', async () => {
    aktiveBrugere.delete(socket.id);
    const harAndre = [...aktiveBrugere.values()].some(b => b.id === bruger.id);
    if (!harAndre) {
      await supabase.from('brugere').update({ status: 'Offline', sidst_aktiv: new Date() }).eq('id', bruger.id);
      io.emit('status:ændret', { brugerId: bruger.id, status: 'Offline' });
    }
  });
});

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: function(origin, callback) {
    const tilladt = (process.env.FRONTEND_URL || '*').split(',').map(s => s.trim());
    if (tilladt.includes('*') || !origin || tilladt.includes(origin)) callback(null, true);
    else callback(new Error('CORS ikke tilladt'));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
if (process.env.NODE_ENV !== 'production') app.use(morgan('dev'));

app.use('/api/', rateLimit({ windowMs: 15*60*1000, max: 100, message: { fejl: 'For mange forespørgsler.' } }));
app.use('/api/auth/login', rateLimit({ windowMs: 15*60*1000, max: 10, message: { fejl: 'For mange loginforsøg.' } }));

app.use('/api/auth', authRoutes);
app.use('/api/brugere', brugerRoutes);
app.use('/api/lektier', lektierRoutes);
app.use('/api/fravaer', fravaerRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/grupper', grupperRoutes);
app.use('/api/opslag', opslagRoutes);
app.use('/api/ugeplan', ugeplanRoutes);
app.use('/api/notifikationer', notifRoutes);

app.get('/api/helbred', (req, res) => res.json({ status: 'OK', version: '2.0.0', navn: 'MyKrebs API', tid: new Date().toISOString() }));
app.use((req, res) => res.status(404).json({ fejl: `Ruten ${req.method} ${req.path} findes ikke.` }));
app.use((err, req, res, next) => res.status(500).json({ fejl: 'Intern serverfejl.' }));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🎓 MyKrebs Backend kører på port ${PORT}`));

module.exports = { app, server, io };
