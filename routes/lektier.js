const express = require('express');
const supabase = require('../config/supabase');
const { requireAuth, requireLaerer } = require('../middleware/auth');

const router = express.Router();

// Hent lektier for en klasse
router.get('/', requireAuth, async (req, res) => {
  const klass = req.query.klass || req.bruger.klass;
  if (!klass) return res.status(400).json({ fejl: 'Klasse mangler.' });
  const { data, error } = await supabase.from('lektier')
    .select('id, titel, beskrivelse, klass, forfaldsdato, oprettet, laerer:brugere!lektier_laerer_id_fkey(id, navn)')
    .eq('klass', klass).order('forfaldsdato');
  if (error) return res.status(500).json({ fejl: 'Kunne ikke hente lektier.' });
  res.json({ lektier: data });
});

// Opret lektie (kun lærere)
router.post('/', requireAuth, requireLaerer, async (req, res) => {
  const { titel, beskrivelse, klass, forfaldsdato } = req.body;
  if (!titel || !klass || !forfaldsdato) return res.status(400).json({ fejl: 'Titel, klasse og forfaldsdato kræves.' });
  const { data, error } = await supabase.from('lektier')
    .insert({ titel, beskrivelse, klass, forfaldsdato, laerer_id: req.bruger.id })
    .select('id, titel, beskrivelse, klass, forfaldsdato').single();
  if (error) return res.status(500).json({ fejl: 'Kunne ikke oprette lektie.' });
  res.status(201).json({ lektie: data });
});

// Opdater lektie (kun lærere)
router.patch('/:id', requireAuth, requireLaerer, async (req, res) => {
  const { titel, beskrivelse, forfaldsdato } = req.body;
  const opdatering = {};
  if (titel) opdatering.titel = titel;
  if (beskrivelse !== undefined) opdatering.beskrivelse = beskrivelse;
  if (forfaldsdato) opdatering.forfaldsdato = forfaldsdato;
  const { data, error } = await supabase.from('lektier')
    .update(opdatering).eq('id', req.params.id).eq('laerer_id', req.bruger.id)
    .select('id, titel, beskrivelse, klass, forfaldsdato').single();
  if (error || !data) return res.status(404).json({ fejl: 'Lektie ikke fundet.' });
  res.json({ lektie: data });
});

// Slet lektie (kun lærere)
router.delete('/:id', requireAuth, requireLaerer, async (req, res) => {
  const { error } = await supabase.from('lektier')
    .delete().eq('id', req.params.id).eq('laerer_id', req.bruger.id);
  if (error) return res.status(404).json({ fejl: 'Lektie ikke fundet.' });
  res.json({ besked: 'Lektie slettet.' });
});

// Markér lektie færdig/ikke færdig (elever)
router.post('/:id/status', requireAuth, async (req, res) => {
  const { faerdig } = req.body;
  const { data: eksisterende } = await supabase.from('lektie_status')
    .select('id').eq('lektie_id', req.params.id).eq('elev_id', req.bruger.id).single();
  if (eksisterende) {
    await supabase.from('lektie_status').update({ faerdig }).eq('id', eksisterende.id);
  } else {
    await supabase.from('lektie_status').insert({ lektie_id: req.params.id, elev_id: req.bruger.id, faerdig });
  }
  res.json({ besked: faerdig ? 'Markeret færdig.' : 'Markering fjernet.' });
});

// Hent fremgang for en lektie (kun lærere)
router.get('/:id/fremgang', requireAuth, requireLaerer, async (req, res) => {
  const { data, error } = await supabase.from('lektie_status')
    .select('faerdig, elev:brugere!lektie_status_elev_id_fkey(id, navn)')
    .eq('lektie_id', req.params.id).eq('faerdig', true);
  if (error) return res.status(500).json({ fejl: 'Kunne ikke hente fremgang.' });
  res.json({ faerdige: data });
});

module.exports = router;
