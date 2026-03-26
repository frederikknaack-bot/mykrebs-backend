const express = require('express');
const supabase = require('../config/supabase');
const { requireAuth, requireLaerer } = require('../middleware/auth');

const router = express.Router();

// Hent ugeplan for en klasse
router.get('/:klass', requireAuth, async (req, res) => {
  const { data, error } = await supabase.from('ugeplan')
    .select('id, dag, tidspunkt, fag, lokale, klass')
    .eq('klass', req.params.klass)
    .order('dag').order('tidspunkt');
  if (error) return res.status(500).json({ fejl: 'Kunne ikke hente ugeplan.' });

  // Grupper efter dag (0=mandag, 4=fredag)
  const dage = [[], [], [], [], []];
  data.forEach(l => {
    if (l.dag >= 0 && l.dag <= 4) dage[l.dag].push(l);
  });
  res.json({ dage });
});

// Gem ugeplan for en klasse (kun lærere)
router.post('/:klass', requireAuth, requireLaerer, async (req, res) => {
  const { dage } = req.body;
  if (!dage || !Array.isArray(dage)) return res.status(400).json({ fejl: 'Dage mangler.' });
  try {
    // Slet eksisterende ugeplan
    await supabase.from('ugeplan').delete().eq('klass', req.params.klass);
    // Indsæt nye lektioner
    const rows = [];
    dage.forEach((dag, dagIdx) => {
      dag.forEach(lektion => {
        if (lektion.name?.trim()) {
          rows.push({
            klass: req.params.klass,
            dag: dagIdx,
            tidspunkt: lektion.time || '08:00',
            fag: lektion.name,
            lokale: lektion.room || '',
            laerer_id: req.bruger.id,
          });
        }
      });
    });
    if (rows.length) {
      const { error } = await supabase.from('ugeplan').insert(rows);
      if (error) throw error;
    }
    res.json({ besked: 'Ugeplan gemt.' });
  } catch { res.status(500).json({ fejl: 'Kunne ikke gemme ugeplan.' }); }
});

module.exports = router;
