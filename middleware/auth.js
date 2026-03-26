const jwt = require('jsonwebtoken');
const supabase = require('../config/supabase');

const requireAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ fejl: 'Ingen token angivet.' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const { data: bruger, error } = await supabase
      .from('brugere')
      .select('id, navn, email, rolle, klass, status')
      .eq('id', payload.id)
      .single();
    if (error || !bruger) return res.status(401).json({ fejl: 'Bruger ikke fundet.' });
    if (bruger.status === 'afventer') return res.status(403).json({ fejl: 'Din konto afventer godkendelse.' });
    req.bruger = bruger;
    next();
  } catch {
    return res.status(401).json({ fejl: 'Ugyldig eller udløbet token.' });
  }
};

const requireLaerer = (req, res, next) => {
  if (req.bruger?.rolle !== 'laerer') {
    return res.status(403).json({ fejl: 'Kun lærere har adgang.' });
  }
  next();
};

const requireAdmin = (req, res, next) => {
  if (req.bruger?.rolle !== 'admin') {
    return res.status(403).json({ fejl: 'Kun administratorer har adgang.' });
  }
  next();
};

module.exports = { requireAuth, requireLaerer, requireAdmin };
