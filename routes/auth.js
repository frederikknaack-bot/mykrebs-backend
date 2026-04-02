const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const supabase = require('../config/supabase');

const router = express.Router();

const genToken = (bruger) => jwt.sign(
  { id: bruger.id, email: bruger.email, rolle: bruger.rolle },
  process.env.JWT_SECRET,
  { expiresIn: '30d' }
);

router.post('/login/elev', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ fejl: 'Email og adgangskode kræves.' });
  const { data: bruger } = await supabase.from('brugere').select('*').eq('email', email).eq('rolle', 'elev').single();
  if (!bruger) return res.status(401).json({ fejl: 'Forkert email eller adgangskode.' });
  if (bruger.status === 'afventer') return res.status(403).json({ fejl: 'Din konto afventer godkendelse fra din klasselærer.' });
  const ok = await bcrypt.compare(password, bruger.password_hash);
  if (!ok) return res.status(401).json({ fejl: 'Forkert email eller adgangskode.' });
  await supabase.from('brugere').update({ sidst_aktiv: new Date(), status: 'Online' }).eq('id', bruger.id);
  res.json({ token: genToken(bruger), bruger: { id: bruger.id, navn: bruger.navn, email: bruger.email, rolle: bruger.rolle, klass: bruger.klass, avatar_url: bruger.avatar_url } });
});

router.post('/login/laerer', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ fejl: 'Email og adgangskode kræves.' });
  const { data: bruger } = await supabase.from('brugere').select('*').eq('email', email).eq('rolle', 'laerer').single();
  if (!bruger) return res.status(401).json({ fejl: 'Forkert email eller adgangskode.' });
  const ok = await bcrypt.compare(password, bruger.password_hash);
  if (!ok) return res.status(401).json({ fejl: 'Forkert email eller adgangskode.' });
  await supabase.from('brugere').update({ sidst_aktiv: new Date(), status: 'Online' }).eq('id', bruger.id);
  res.json({ token: genToken(bruger), bruger: { id: bruger.id, navn: bruger.navn, email: bruger.email, rolle: bruger.rolle, klass: bruger.klass, avatar_url: bruger.avatar_url } });
});

router.post('/login/foraelder', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ fejl: 'Email og adgangskode kræves.' });
  const { data: bruger } = await supabase.from('brugere').select('*').eq('email', email).eq('rolle', 'foraelder').single();
  if (!bruger) return res.status(401).json({ fejl: 'Forkert email eller adgangskode.' });
  const ok = await bcrypt.compare(password, bruger.password_hash);
  if (!ok) return res.status(401).json({ fejl: 'Forkert email eller adgangskode.' });
  res.json({ token: genToken(bruger), bruger: { id: bruger.id, navn: bruger.navn, email: bruger.email, rolle: bruger.rolle, avatar_url: bruger.avatar_url } });
});

router.post('/registrer/elev', async (req, res) => {
  const { navn, email, password, klass } = req.body;
  if (!navn || !email || !password || !klass) return res.status(400).json({ fejl: 'Udfyld alle felter.' });
  const { data: eks } = await supabase.from('brugere').select('id').eq('email', email).single();
  if (eks) return res.status(400).json({ fejl: 'Email er allerede i brug.' });
  const hash = await bcrypt.hash(password, 12);
  const { data, error } = await supabase.from('brugere').insert({ navn, email, password_hash: hash, rolle: 'elev', klass, status: 'Offline' }).select('id, navn, email, rolle, klass').single();
  if (error) {
    console.error('Registrer elev fejl:', error);
    return res.status(500).json({ fejl: 'Kunne ikke oprette konto.', detaljer: error.message });
  }
  res.status(201).json({ besked: 'Konto oprettet! Afventer godkendelse fra klasselærer.', bruger: data });
});

router.post('/registrer/laerer', async (req, res) => {
  const { navn, email, password, klass, laererKode } = req.body;
  if (!navn || !email || !password || !laererKode) return res.s
