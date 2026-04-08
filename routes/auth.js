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

const tjekToken = (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  try { return jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET); }
  catch { return null; }
};

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
  const hash = await bcrypt.hash(password, 10);
  const { data, error } = await supabase.from('brugere').insert({ navn, email, password_hash: hash, rolle: 'elev', klass, status: 'afventer' }).select('id, navn, email, rolle, klass').single();
  if (error) return res.status(500).json({ fejl: 'Kunne ikke oprette konto.', detaljer: error.message });
  res.status(201).json({ besked: 'Konto oprettet! Afventer godkendelse fra klasselærer.', bruger: data });
});

router.post('/registrer/laerer', async (req, res) => {
  const { navn, email, password, klass, laererKode } = req.body;
  if (!navn || !email || !password || !laererKode) return res.status(400).json({ fejl: 'Udfyld alle felter.' });
  if (laererKode !== process.env.LAERER_KODE) return res.status(403).json({ fejl: 'Forkert lærer-kode.' });
  const { data: eks } = await supabase.from('brugere').select('id').eq('email', email).single();
  if (eks) return res.status(400).json({ fejl: 'Email er allerede i brug.' });
  const hash = await bcrypt.hash(password, 10);
  const { data, error } = await supabase.from('brugere').insert({ navn, email, password_hash: hash, rolle: 'laerer', klass: klass || null, status: 'Online' }).select('id, navn, email, rolle, klass').single();
  if (error) return res.status(500).json({ fejl: 'Kunne ikke oprette konto.', detaljer: error.message });
  res.status(201).json({ token: genToken(data), bruger: data });
});

router.post('/registrer/foraelder', async (req, res) => {
  const { navn, email, password } = req.body;
  if (!navn || !email || !password) return res.status(400).json({ fejl: 'Udfyld alle felter.' });
  const { data: eks } = await supabase.from('brugere').select('id').eq('email', email).single();
  if (eks) return res.status(400).json({ fejl: 'Email er allerede i brug.' });
  const hash = await bcrypt.hash(password, 10);
  const { data, error } = await supabase.from('brugere').insert({ navn, email, password_hash: hash, rolle: 'foraelder', status: 'Online' }).select('id, navn, email, rolle').single();
  if (error) return res.status(500).json({ fejl: 'Kunne ikke oprette konto.', detaljer: error.message });
  res.status(201).json({ token: genToken(data), bruger: data });
});

router.post('/godkend/elev', async (req, res) => {
  const payload = tjekToken(req);
  if (!payload) return res.status(401).json({ fejl: 'Ingen token.' });
  if (payload.rolle !== 'laerer') return res.status(403).json({ fejl: 'Kun lærere kan godkende elever.' });
  const { elevId } = req.body;
  if (!elevId) return res.status(400).json({ fejl: 'elevId kræves.' });
  const { data, error } = await supabase.from('brugere').update({ status: 'Offline' }).eq('id', elevId).eq('rolle', 'elev').eq('status', 'afventer').select('id, navn, email, rolle, klass').single();
  if (error || !data) return res.status(404).json({ fejl: 'Elev ikke fundet eller allerede godkendt.' });
  res.json({ besked: 'Elev godkendt!', bruger: data });
});

router.get('/afventende/elever', async (req, res) => {
  const payload = tjekToken(req);
  if (!payload) return res.status(401).json({ fejl: 'Ingen token.' });
  if (payload.rolle !== 'laerer') return res.status(403).json({ fejl: 'Kun lærere kan se afventende elever.' });
  const { data: laerer } = await supabase.from('brugere').select('klass').eq('id', payload.id).single();
  const { data, error } = await supabase.from('brugere').select('id, navn, email, klass').eq('rolle', 'elev').eq('status', 'afventer').eq('klass', laerer.klass);
  if (error) return res.status(500).json({ fejl: 'Kunne ikke hente elever.' });
  res.json({ elever: data || [] });
});

// ══════════════════════════════════════
// FORÆLDRE-BARN TILKNYTNING
// ══════════════════════════════════════

router.get('/soeg/barn', async (req, res) => {
  const payload = tjekToken(req);
  if (!payload) return res.status(401).json({ fejl: 'Ingen token.' });
  if (payload.rolle !== 'foraelder') return res.status(403).json({ fejl: 'Kun forældre kan søge efter børn.' });
  const { navn, klass } = req.query;
  if (!navn) return res.status(400).json({ fejl: 'Navn kræves.' });
  let query = supabase.from('brugere').select('id, navn, klass').eq('rolle', 'elev').neq('status', 'afventer').ilike('navn', `%${navn}%`);
  if (klass) query = query.eq('klass', klass);
  const { data, error } = await query;
  if (error) return res.status(500).json({ fejl: 'Søgning fejlede.' });
  res.json({ resultater: data || [] });
});

router.post('/tilknyt/barn', async (req, res) => {
  const payload = tjekToken(req);
  if (!payload) return res.status(401).json({ fejl: 'Ingen token.' });
  if (payload.rolle !== 'foraelder') return res.status(403).json({ fejl: 'Kun forældre kan tilknytte børn.' });
  const { barnId } = req.body;
  if (!barnId) return res.status(400).json({ fejl: 'barnId kræves.' });
  const { data: barn } = await supabase.from('brugere').select('id, navn, klass').eq('id', barnId).eq('rolle', 'elev').single();
  if (!barn) return res.status(404).json({ fejl: 'Elev ikke fundet.' });
  const { data: eks } = await supabase.from('foraeldre_boern').select('id, status').eq('foraelder_id', payload.id).eq('barn_id', barnId).single();
  if (eks) {
    if (eks.status === 'godkendt') return res.status(400).json({ fejl: 'Du er allerede tilknyttet dette barn.' });
    return res.status(400).json({ fejl: 'Anmodning er allerede sendt og afventer godkendelse.' });
  }
  const { data, error } = await supabase.from('foraeldre_boern').insert({ foraelder_id: payload.id, barn_id: barnId, status: 'afventer' }).select('id, status').single();
  if (error) return res.status(500).json({ fejl: 'Kunne ikke sende anmodning.', detaljer: error.message });
  res.status(201).json({ besked: 'Anmodning sendt! Barnets klasselærer skal godkende den.', tilknytning: data });
});

router.get('/mine/boern', async (req, res) => {
  const payload = tjekToken(req);
  if (!payload) return res.status(401).json({ fejl: 'Ingen token.' });
  if (payload.rolle !== 'foraelder') return res.status(403).json({ fejl: 'Kun forældre kan hente børn.' });
  const { data, error } = await supabase.from('foraeldre_boern')
    .select('id, status, barn:brugere!foraeldre_boern_barn_id_fkey(id, navn, klass, avatar_url)')
    .eq('foraelder_id', payload.id)
    .eq('status', 'godkendt');
  if (error) return res.status(500).json({ fejl: 'Kunne ikke hente børn.' });
  const boern = (data || []).map(t => ({ ...t.barn, tilknytning_id: t.id }));
  res.json({ boern });
});

// Lærer ser afventende tilknytningsanmodninger (status = 'afventer')
router.get('/afventende/tilknytninger', async (req, res) => {
  const payload = tjekToken(req);
  if (!payload) return res.status(401).json({ fejl: 'Ingen token.' });
  if (payload.rolle !== 'laerer') return res.status(403).json({ fejl: 'Kun lærere kan se tilknytningsanmodninger.' });
  const { data: laerer } = await supabase.from('brugere').select('klass').eq('id', payload.id).single();
  if (!laerer?.klass) return res.json({ anmodninger: [] });
  const { data, error } = await supabase.from('foraeldre_boern')
    .select('id, status, foraelder:brugere!foraeldre_boern_foraelder_id_fkey(id, navn, email), barn:brugere!foraeldre_boern_barn_id_fkey(id, navn, klass)')
    .eq('status', 'afventer');
  if (error) return res.status(500).json({ fejl: 'Kunne ikke hente anmodninger.' });
  const filtrerede = (data || []).filter(a => a.barn?.klass === laerer.klass);
  res.json({ anmodninger: filtrerede });
});

// Elev ser sine afventende forældreanmodninger (status = 'laerer_godkendt')
router.get('/mine/foraeldre/afventende', async (req, res) => {
  const payload = tjekToken(req);
  if (!payload) return res.status(401).json({ fejl: 'Ingen token.' });
  if (payload.rolle !== 'elev') return res.status(403).json({ fejl: 'Kun elever kan se dette.' });
  const { data, error } = await supabase.from('foraeldre_boern')
    .select('id, status, foraelder:brugere!foraeldre_boern_foraelder_id_fkey(id, navn, email)')
    .eq('barn_id', payload.id)
    .eq('status', 'laerer_godkendt');
  if (error) return res.status(500).json({ fejl: 'Kunne ikke hente anmodninger.' });
  res.json({ anmodninger: data || [] });
});

// Lærer godkender tilknytning — sætter status til 'laerer_godkendt' så eleven kan bekræfte
router.post('/godkend/tilknytning', async (req, res) => {
  const payload = tjekToken(req);
  if (!payload) return res.status(401).json({ fejl: 'Ingen token.' });
  if (payload.rolle !== 'laerer') return res.status(403).json({ fejl: 'Kun lærere kan godkende tilknytninger.' });
  const { tilknytningId } = req.body;
  if (!tilknytningId) return res.status(400).json({ fejl: 'tilknytningId kræves.' });
  const { data, error } = await supabase.from('foraeldre_boern')
    .update({ status: 'laerer_godkendt', laerer_godkendt_af: payload.id, laerer_godkendt_tidspunkt: new Date() })
    .eq('id', tilknytningId)
    .eq('status', 'afventer')
    .select('id, status')
    .single();
  if (error || !data) return res.status(404).json({ fejl: 'Anmodning ikke fundet.' });
  res.json({ besked: 'Godkendt af lærer — afventer nu elevens bekræftelse.' });
});

// Elev bekræfter forælder — sætter status til 'godkendt'
router.post('/bekraeft/foraelder', async (req, res) => {
  const payload = tjekToken(req);
  if (!payload) return res.status(401).json({ fejl: 'Ingen token.' });
  if (payload.rolle !== 'elev') return res.status(403).json({ fejl: 'Kun elever kan bekræfte forældre.' });
  const { tilknytningId } = req.body;
  if (!tilknytningId) return res.status(400).json({ fejl: 'tilknytningId kræves.' });
  const { data, error } = await supabase.from('foraeldre_boern')
    .update({ status: 'godkendt' })
    .eq('id', tilknytningId)
    .eq('barn_id', payload.id)
    .eq('status', 'laerer_godkendt')
    .select('id, status')
    .single();
  if (error || !data) return res.status(404).json({ fejl: 'Anmodning ikke fundet.' });
  res.json({ besked: 'Forælder bekræftet og tilknyttet!' });
});

// Elev afviser forælder
router.post('/afvis/foraelder', async (req, res) => {
  const payload = tjekToken(req);
  if (!payload) return res.status(401).json({ fejl: 'Ingen token.' });
  if (payload.rolle !== 'elev') return res.status(403).json({ fejl: 'Kun elever kan afvise forældre.' });
  const { tilknytningId } = req.body;
  if (!tilknytningId) return res.status(400).json({ fejl: 'tilknytningId kræves.' });
  const { error } = await supabase.from('foraeldre_boern').delete().eq('id', tilknytningId).eq('barn_id', payload.id);
  if (error) return res.status(500).json({ fejl: 'Kunne ikke afvise anmodning.' });
  res.json({ besked: 'Anmodning afvist.' });
});

// Lærer eller elev afviser tilknytning
router.post('/afvis/tilknytning', async (req, res) => {
  const payload = tjekToken(req);
  if (!payload) return res.status(401).json({ fejl: 'Ingen token.' });
  if (!['laerer','elev'].includes(payload.rolle)) return res.status(403).json({ fejl: 'Ikke tilladt.' });
  const { tilknytningId } = req.body;
  if (!tilknytningId) return res.status(400).json({ fejl: 'tilknytningId kræves.' });
  const { error } = await supabase.from('foraeldre_boern').delete().eq('id', tilknytningId);
  if (error) return res.status(500).json({ fejl: 'Kunne ikke afvise anmodning.' });
  res.json({ besked: 'Anmodning afvist.' });
});

router.get('/mig', async (req, res) => {
  const payload = tjekToken(req);
  if (!payload) return res.status(401).json({ fejl: 'Ingen token.' });
  const { data } = await supabase.from('brugere').select('id, navn, email, rolle, klass, avatar_url, status').eq('id', payload.id).single();
  if (!data) return res.status(404).json({ fejl: 'Bruger ikke fundet.' });
  res.json({ bruger: data });
});

module.exports = router;
