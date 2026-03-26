const express = require('express');
const supabase = require('../config/supabase');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Hent notifikationer for den indloggede bruger
router.get('/', requireAuth, async (req, res) => {
  const { data, error } = await supabase.from('notifikationer')
    .select('id, type, titel, besked, læst, oprettet, data')
    .eq('bruger_id', req.bruger.id)
    .order('oprettet', { ascending: false })
    .limit(50);
  if (error) return res.status(500).json({ fejl: 'Kunne ikke hente notifikationer.' });
  res.json({ notifikationer: data, ulæste: data.filter(n => !n.læst).length });
});

// Markér notifikation som læst
router.patch('/:id/laest', requireAuth, async (req, res) => {
  const { error } = await supabase.from('notifikationer')
    .update({ læst: true }).eq('id', req.params.id).eq('bruger_id', req.bruger.id);
  if (error) return res.status(500).json({ fejl: 'Kunne ikke opdatere notifikation.' });
  res.json({ besked: 'Markeret som læst.' });
});

// Markér alle som læst
router.patch('/alle/laest', requireAuth, async (req, res) => {
  await supabase.from('notifikationer')
    .update({ læst: true }).eq('bruger_id', req.bruger.id).eq('læst', false);
  res.json({ besked: 'Alle markeret som læst.' });
});

// Slet notifikation
router.delete('/:id', requireAuth, async (req, res) => {
  await supabase.from('notifikationer')
    .delete().eq('id', req.params.id).eq('bruger_id', req.bruger.id);
  res.json({ besked: 'Notifikation slettet.' });
});

module.exports = router;
