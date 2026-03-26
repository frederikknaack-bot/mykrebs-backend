const express = require('express');
const supabase = require('../config/supabase');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

router.get('/privat/:id', requireAuth, async (req, res) => {
  const id = req.params.id;
  const { data, error } = await supabase.from('beskeder')
    .select('id, tekst, sendt_kl, fra:brugere!beskeder_fra_bruger_fkey(id, navn, avatar_url)')
    .or(`and(fra_bruger.eq.${req.bruger.id},til_bruger.eq.${id}),and(fra_bruger.eq.${id},til_bruger.eq.${req.bruger.id})`)
    .order('sendt_kl');
  if (error) return res.status(500).json({ fejl: 'Fejl.' });
  res.json({ beskeder: data });
});

router.get('/samtaler', requireAuth, async (req, res) => {
  const { data, error } = await supabase.from('beskeder')
    .select('id, tekst, sendt_kl, fra:brugere!beskeder_fra_bruger_fkey(id, navn, avatar_url), til:brugere!beskeder_til_bruger_fkey(id, navn, avatar_url)')
    .or(`fra_bruger.eq.${req.bruger.id},til_bruger.eq.${req.bruger.id}`)
    .order('sendt_kl', { ascending: false });
  if (error) return res.status(500).json({ fejl: 'Fejl.' });
  const map = new Map();
  data.forEach(b => {
    const anden = b.fra.id === req.bruger.id ? b.til : b.fra;
    if (!map.has(anden.id)) map.set(anden.id, { bruger: anden, sidsteBesked: b.tekst, tid: b.sendt_kl });
  });
  res.json({ samtaler: [...map.values()] });
});

router.post('/privat', requireAuth, async (req, res) => {
  const { tilBrugerId, tekst } = req.body;
  if (!tilBrugerId || !tekst?.trim()) return res.status(400).json({ fejl: 'Mangler data.' });
  const { data, error } = await supabase.from('beskeder')
    .insert({ fra_bruger: req.bruger.id, til_bruger: tilBrugerId, tekst: tekst.trim() })
    .select('id, tekst, sendt_kl').single();
  if (error) return res.status(500).json({ fejl: 'Fejl.' });
  res.status(201).json({ besked: data });
});

router.get('/klass/:klass', requireAuth, async (req, res) => {
  const { data, error } = await supabase.from('klassechat_beskeder')
    .select('id, tekst, sendt_kl, fra:brugere!klassechat_beskeder_fra_bruger_fkey(id, navn, avatar_url, rolle)')
    .eq('klass', req.params.klass).order('sendt_kl').limit(100);
  if (error) return res.status(500).json({ fejl: 'Fejl.' });
  res.json({ beskeder: data });
});

module.exports = router;
