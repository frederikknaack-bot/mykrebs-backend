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

// Login elev
router.post('/login/elev', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ fejl: 'Email og adgangskode kræves.' });
  const { data: bruger } = await supabase.from('brugere').select('*').eq('email', email).eq('rolle', 'elev').single();
  if (!bruger) return res.status(401).json({ fejl: 'Forkert email eller adgangskode.' });
  if (bruger.status === 'afventer') return res.status(403).json({ fejl: 'Din konto afventer godkendelse fra din klasselærer.' });
  const ok = await bcrypt.compare(password, bruger.adgangskode_hash);
  if (!ok) return res.status(401).json({ fejl: 'Forkert email eller adgangskode.' });
  await supabase.from('brugere').update({ sidst_aktiv: new Date(), status: 'Online' }).eq('id', bruger.id);
  res.json({ token: genToken(bruger), bruger: { id: bruger.id, navn: bruger.navn, email: bruger.email, rolle: bruger.rolle, klass: bruger.klass, avatar_url: bruger.avatar_url } });
});

// Login lærer
router.post('/login/laerer', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ fejl: 'Email og adgangskode kræves.' });
  const { data: bruger } = await supabase.from('brugere').select('*').eq('email', email).eq('rolle', 'laerer').single();
  if (!bruger) return res.status(401).json({ fejl: 'Forkert email eller adgangskode.' });
  const ok = await bcrypt.compare(password, bruger.adgangskode_hash);
  if (!ok) return res.status(401).json({ fejl: 'Forkert email eller adgangskode.' });
  await supabase.from('brugere').update({ sidst_aktiv: new Date(), status: 'Online' }).eq('id', bruger.id);
  res.json({ token: genToken(bruger), bruger: { id: bruger.id, navn: bruger.navn, email: bruger.email, rolle: bruger.rolle, klass: bruger.klass, avatar_url: bruger.avatar_url } });
});

// Login forælder
router.post('/login/foraelder', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ fejl: 'Email og adgangskode kræves.' });
  const { data: bruger } = await supabase.from('brugere').select('*').eq('email', email).eq('rolle', 'foraelder').single();
  if (!bruger) return res.status(401).json({ fejl: 'Forkert email eller adgangskode.' });
  const ok = await bcrypt.compare(password, bruger.adgangskode_hash);
  if (!ok) return res.status(401).json({ fejl: 'Forkert email eller adgangskode.' });
  res.json({ token: genToken(bruger), bruger: { id: bruger.id, navn: bruger.navn, email: bruger.email, rolle: bruger.rolle, avatar_url: bruger.avatar_url } });
});

// Registrer elev
router.post('/registrer/elev', async (req, res) => {
  const { navn, email, password, klass } = req.body;
  if (!navn || !email || !password || !klass) return res.status(400).json({ fejl: 'Udfyld alle felter.' });
  const { data: eks } = await supabase.from('brugere').select('id').eq('email', email).single();
  if (eks) return res.status(400).json({ fejl: 'Email er allerede i brug.' });
  const hash = await bcrypt.hash(password, 12);
  const { data, error } = await supabase.from('brugere').insert({ navn, email, adgangskode_hash: hash, rolle: 'elev', klass, status: 'afventer' }).select('id, navn, email, rolle, klass').single();
  if (error) return res.status(500).json({ fejl: 'Kunne ikke oprette konto.' });
  res.status(201).json({ besked: 'Konto oprettet! Afventer godkendelse fra klasselærer.', bruger: data });
});

// Registrer lærer
router.post('/registrer/laerer', async (req, res) => {
  const { navn, email, password, klass, laererKode } = req.body;
  if (!navn || !email || !password || !laererKode) return res.status(400).json({ fejl: 'Udfyld alle felter.' });
  if (laererKode !== process.env.LAERER_KODE) return res.status(403).json({ fejl: 'Forkert lærer-kode.' });
  const { data: eks } = await supabase.from('brugere').select('id').eq('email', email).single();
  if (eks) return res.status(400).json({ fejl: 'Email er allerede i brug.' });
  const hash = await bcrypt.hash(password, 12);
  const { data, error } = await supabase.from('brugere').insert({ navn, email, adgangskode_hash: hash, rolle: 'laerer', klass: klass || null, status: 'aktiv' }).select('id, navn, email, rolle, klass').single();
  if (error) return res.status(500).json({ fejl: 'Kunne ikke oprette konto.' });
  const token = genToken(data);
  res.status(201).json({ token, bruger: data });
});

// Registrer forælder
router.post('/registrer/foraelder', async (req, res) => {
  const { navn, email, password } = req.body;
  if (!navn || !email || !password) return res.status(400).json({ fejl: 'Udfyld alle felter.' });
  const { data: eks } = await supabase.from('brugere').select('id').eq('email', email).single();
  if (eks) return res.status(400).json({ fejl: 'Email er allerede i brug.' });
  const hash = await bcrypt.hash(password, 12);
  const { data, error } = await supabase.from('brugere').insert({ navn, email, adgangskode_hash: hash, rolle: 'foraelder', status: 'aktiv' }).select('id, navn, email, rolle').single();
  if (error) return res.status(500).json({ fejl: 'Kunne ikke oprette konto.' });
  const token = genToken(data);
  res.status(201).json({ token, bruger: data });
});

// Hent mig selv
router.get('/mig', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ fejl: 'Ingen token.' });
  try {
    const payload = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
    const { data } = await supabase.from('brugere').select('id, navn, email, rolle, klass, avatar_url, status').eq('id', payload.id).single();
    if (!data) return res.status(404).json({ fejl: 'Bruger ikke fundet.' });
    res.json({ bruger: data });
  } catch { res.status(401).json({ fejl: 'Ugyldig token.' }); }
});

module.exports = router;
