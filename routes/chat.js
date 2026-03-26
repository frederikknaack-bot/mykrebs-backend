const express = require('express');
const supabase = require('../config/supabase');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Hent private beskeder mellem to brugere
router.get('/privat/:tilBrugerId', requireAuth, async (req, res) => {
  const { tilBrugerId } = req.params;
  const { data, error } = await supabase.from('beskeder')
    .select('id, tekst, sendt_kl, fra:brugere!beskeder_fra_bruger_fkey(id, navn, avatar_url)')
    .or(`and(fra_bruger.eq.${req.bruger.id},til_bruger.eq.${tilBrugerId}),and(fra_bruger.eq.${tilBrugerId},til_bruger.eq.${req.bruger.id})`)
    .order('sendt_kl');
  if (error) return res.status(500).json({ fejl: 'Kunne ikke hente beskeder.' });
  res.json({ beskeder: data });
});

// Hent alle samtaler for en bruger
router.get('/samtaler', requireAuth, async (req, res) => {
  const { data, error } = await supabase.from('beskeder')
    .select('id, tekst, sendt_kl, fra:brugere!beskeder_fra_bruger_fkey(id, navn, avatar_url), til:brugere!beskeder_til_bruger_fkey(id, navn, avatar_url)')
    .or(`fra_bruger.eq.${req.bruger.id},til_bruger.eq.${req.bruger.id}`)
    .order('sendt_kl', { ascending: false });
  if (error) return res.status(500).json({ fejl: 'Kunne ikke hente samtaler.' });

  // Grupper efter samtalepartner
  const samtaler = new Map();
  data.forEach(b => {
    const anden = b.fra.id === req.bruger.id ? b.til : b.fra;
    if (!samtaler.has(anden.id)) {
      samtaler.set(anden.id, { bruger: anden, sidsteBesked: b.tekst, tid: b.sendt_kl, ulæste: 0 });
    }
  });
  res.json({ samtaler: [...samtaler.values()] });
});

// Send besked (fallback hvis socket ikke virker)
router.post('/privat', requireAuth, async (req, res) => {
  const { tilBrugerId, tekst } = req.body;
  if (!tilBrugerId || !tekst?.trim()) return res.status(400).json({ fejl: 'Modtager og tekst kræves.' });
  const { data, error } = await supabase.from('beskeder')
    .insert({ fra_bruger: req.bruger.id, til_bruger: tilBrugerId, tekst: tekst.trim() })
    .select('id, tekst, sendt_kl').single();
  if (error) return res.status(500).json({ fejl: 'Kunne ikke sende besked.' });
  res.status(201).json({ besked: data });
});

// Hent klassechat beskeder
router.get('/klass/:klass', requireAuth, async (req, res) => {
  const { data, error } = await supabase.from('klassechat_beskeder')
