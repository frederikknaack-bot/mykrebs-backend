const express = require('express');
const supabase = require('../config/supabase');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Hent grupper for en klasse
router.get('/', requireAuth, async (req, res) => {
  const klass = req.query.klass || req.bruger.klass;
  const { data, error } = await supabase.from('grupper')
    .select('id, navn, beskrivelse, klass, oprettet, medlemmer:gruppe_medlemmer(bruger:brugere(id, navn, avatar_url, rolle))')
    .eq('klass', klass).order('oprettet');
  if (error) return res.status(500).json({ fejl: 'Kunne ikke hente grupper.' });
  res.json({ grupper: data });
});

// Opret gruppe
router.post('/', requireAuth, async (req, res) => {
  const { navn, beskrivelse, klass } = req.body;
  if (!navn || !klass) return res.status(400).json({ fejl: 'Navn og klasse kræves.' });
  const { data, error } = await supabase.from('grupper')
    .insert({ navn, beskrivelse, klass, oprettet_af: req.bruger.id })
    .select('id, navn, beskrivelse, klass').single();
  if (error) return res.status(500).json({ fejl: 'Kunne ikke oprette gruppe.' });
  // Tilføj opretteren som medlem
  await supabase.from('gruppe_medlemmer').insert({ gruppe_id: data.id, bruger_id: req.bruger.id, rolle: 'admin' });
  res.status(201).json({ gruppe: data });
});

// Ansøg om at blive medlem
router.post('/:id/ansoeg', requireAuth, async (req, res) => {
  const { data: eks } = await supabase.from('gruppe_medlemmer')
    .select('id').eq('gruppe_id', req.params.id).eq('bruger_id', req.bruger.id).single();
  if (eks) return res.status(400).json({ fejl: 'Du er allerede medlem.' });
  await supabase.from('gruppe_medlemmer').insert({ gruppe_id: req.params.id, bruger_id: req.bruger.id, rolle: 'afventer' });
  res.json({ besked: 'Ansøgning sendt.' });
});

// Godkend medlem
router.patch('/:id/godkend/:brugerId', requireAuth, async (req, res) => {
  const { error } = await supabase.from('gruppe_medlemmer')
    .update({ rolle: 'medlem' })
    .eq('gruppe_id', req.params.id)
    .eq('bruger_id', req.params.brugerId);
  if (error) return res.status(500).json({ fejl: 'Kunne ikke godkende.' });
  res.json({ besked: 'Medlem godkendt.' });
});

// Forlad gruppe
router.delete('/:id/forlad', requireAuth, async (req, res) => {
  await supabase.from('gruppe_medlemmer')
    .delete().eq('gruppe_id', req.params.id).eq('bruger_id', req.bruger.id);
  res.json({ besked: 'Du har forladt gruppen.' });
});

// Hent gruppe-chat
router.get('/:id/chat', requireAuth, async (req, res) => {
  const { data, error } = await supabase.from('gruppe_beskeder')
    .select('id, tekst, sendt_kl, fra:brugere!gruppe_beskeder_fra_bruger_fkey(id, navn, avatar_url)')
    .eq('gruppe_id', req.params.id).order('sendt_kl').limit(100);
  if (error) return res.status(500).json({ fejl: 'Kunne ikke hente chat.' });
  res.json({ beskeder: data });
});

module.exports = router;
