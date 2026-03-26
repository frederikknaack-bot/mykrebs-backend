const express = require('express');
const supabase = require('../config/supabase');
const { requireAuth, requireLaerer } = require('../middleware/auth');

const router = express.Router();

// Hent fremmøde for en klasse og dato
router.get('/', requireAuth, async (req, res) => {
  const { klass, dato } = req.query;
  if (!klass) return res.status(400).json({ fejl: 'Klasse mangler.' });
  let query = supabase.from('fravaer')
    .select('id, dato, status, fag, elev:brugere!fravaer_elev_id_fkey(id, navn)')
    .eq('klass', klass).order('dato', { ascending: false });
  if (dato) query = query.eq('dato', dato);
  const { data, error } = await query;
  if (error) return res.status(500).json({ fejl: 'Kunne ikke hente fremmøde.' });
  res.json({ fravaer: data });
});

// Gem fremmøde for en hel klasse (kun lærere)
router.post('/', requireAuth, requireLaerer, async (req, res) => {
  const { klass, dato, fag, records } = req.body;
  if (!klass || !dato || !records) return res.status(400).json({ fejl: 'Klasse, dato og records kræves.' });
  try {
    // Slet eksisterende for den dato
    await supabase.from('fravaer').delete().eq('klass', klass).eq('dato', dato).eq('fag', fag || '');
    // Indsæt nye
    const rows = Object.entries(records).map(([elev_id, status]) => ({
      klass, dato, fag: fag || '', elev_id, status, laerer_id: req.bruger.id
    }));
    if (rows.length) {
      const { error } = await supabase.from('fravaer').insert(rows);
      if (error) throw error;
    }
    res.json({ besked: 'Fremmøde gemt.' });
  } catch { res.status(500).json({ fejl: 'Kunne ikke gemme fremmøde.' }); }
});

// Hent mit eget fravær (elever)
router.get('/mit', requireAuth, async (req, res) => {
  const { data, error } = await supabase.from('fravaer')
    .select('id, dato, status, fag, klass')
    .eq('elev_id', req.bruger.id).order('dato', { ascending: false });
  if (error) return res.status(500).json({ fejl: 'Kunne ikke hente fravær.' });
  const total = data.length;
  const fraværende = data.filter(r => r.status === 'absent').length;
  const pct = total ? Math.round((fraværende / total) * 100) : 0;
  res.json({ fravaer: data, statistik: { total, fraværende, pct } });
});

module.exports = router;
