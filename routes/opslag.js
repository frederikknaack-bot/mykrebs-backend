const express = require('express');
const supabase = require('../config/supabase');
const { requireAuth, requireLaerer } = require('../middleware/auth');

const router = express.Router();

// Hent opslag for en klasse
router.get('/', requireAuth, async (req, res) => {
  const klass = req.query.klass || req.bruger.klass;
  const { data, error } = await supabase.from('opslag')
    .select('id, titel, indhold, farve, klass, oprettet, laerer:brugere!opslag_laerer_id_fkey(id, navn)')
    .or(`klass.eq.alle,klass.eq.${klass}`)
    .order('oprettet', { ascending: false });
  if (error) return res.status(500).json({ fejl: 'Kunne ikke hente opslag.' });
  res.json({ opslag: data });
});

// Opret opslag (kun lærere)
router.post('/', requireAuth, requireLaerer, async (req, res) => {
  const { titel, indhold, farve, klass } = req.body;
  if (!titel || !indhold) return res.status(400).json({ fejl: 'Titel og indhold kræves.' });
  const { data, error } = await supabase.from('opslag')
    .insert({ titel, indhold, farve: farve || '#4a6fa5', klass: klass || 'alle', laerer_id: req.bruger.id })
    .select('id, titel, indhold, farve, klass, oprettet').single();
  if (error) return res.status(500).json({ fejl: 'Kunne ikke oprette opslag.' });
  res.status(201).json({ opslag: data });
});

// Slet opslag (kun lærere)
router.delete('/:id', requireAuth, requireLaerer, async (req, res) => {
  const { error } = await supabase.from('opslag')
    .delete().eq('id', req.params.id).eq('laerer_id', req.bruger.id);
  if (error) return res.status(500).json({ fejl: 'Kunne ikke slette opslag.' });
  res.json({ besked: 'Opslag slettet.' });
});

module.exports = router;
