const express = require('express');
const supabase = require('../config/supabase');
const { requireAuth, requireLaerer } = require('../middleware/auth');

const router = express.Router();

// Søg efter brugere
router.get('/soeg', requireAuth, async (req, res) => {
  const { q, klass } = req.query;
  try {
    let query = supabase.from('brugere')
      .select('id, navn, klass, rolle, avatar_url, status, beskrivelse')
      .neq('id', req.bruger.id)
      .order('navn');
    if (q) query = query.ilike('navn', `%${q}%`);
    if (klass) query = query.eq('klass', klass);
    const { data, error } = await query;
    if (error) throw error;
    res.json({ brugere: data });
  } catch { res.status(500).json({ fejl: 'Kunne ikke hente brugere.' }); }
});

// Hent én bruger
router.get('/:id', requireAuth, async (req, res) => {
  const { data, error } = await supabase.from('brugere')
    .select('id, navn, klass, rolle, avatar_url, status, beskrivelse, hobbyer, oprettet')
    .eq('id', req.params.id).single();
  if (error || !data) return res.status(404).json({ fejl: 'Bruger ikke fundet.' });
  res.json({ bruger: data });
});

// Opdater profil
router.patch('/mig', requireAuth, async (req, res) => {
  const { navn, beskrivelse, hobbyer, avatar_url } = req.body;
  const opdatering = {};
  if (navn) opdatering.navn = navn;
  if (beskrivelse !== undefined) opdatering.beskrivelse = beskrivelse;
  if (hobbyer !== undefined) opdatering.hobbyer = hobbyer;
  if (avatar_url !== undefined) opdatering.avatar_url = avatar_url;
  const { data, error } = await supabase.from('brugere').update(opdatering).eq('id', req.bruger.id).select('id, navn, klass, rolle, avatar_url, beskrivelse, hobbyer').single();
  if (error) return res.status(500).json({ fejl: 'Kunne ikke opdatere profil.' });
  res.json({ bruger: data });
});

// Hent elever i en klasse (kun lærere)
router.get('/klass/:klass', requireAuth, requireLaerer, async (req, res) => {
  const { data, error } = await supabase.from('brugere')
    .select('id, navn, klass, avatar_url, status, sidst_aktiv')
    .eq('klass', req.params.klass).eq('rolle', 'elev').order('navn');
  if (error) return res.status(500).json({ fejl: 'Kunne ikke hente elever.' });
  res.json({ elever: data });
});

// Godkend elev (kun lærere)
router.patch('/:id/godkend', requireAuth, requireLaerer, async (req, res) => {
  const { data, error } = await supabase.from('brugere')
    .update({ status: 'aktiv' }).eq('id', req.params.id).eq('rolle', 'elev').select('id, navn, status').single();
  if (error || !data) return res.status(404).json({ fejl: 'Elev ikke fundet.' });
  res.json({ besked: 'Elev godkendt!', bruger: data });
});

// Hent afventende elever (kun lærere)
router.get('/afventende/:klass', requireAuth, requireLaerer, async (req, res) => {
  const { data, error } = await supabase.from('brugere')
    .select('id, navn, email, klass, oprettet')
    .eq('klass', req.params.klass).eq('rolle', 'elev').eq('status', 'afventer').order('oprettet');
  if (error) return res.status(500).json({ fejl: 'Kunne ikke hente afventende elever.' });
  res.json({ elever: data });
});

module.exports = router;
