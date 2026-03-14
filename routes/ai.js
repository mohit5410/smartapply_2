const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');

router.use(auth);

// POST /api/ai/generate — proxy to Anthropic API (keeps key on server)
router.post('/generate', async (req, res) => {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return res.status(503).json({ error: 'AI service not configured' });

    const { prompt, system } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Prompt required' });

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: system || 'You are a helpful assistant.',
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await response.json();
    const text = data.content && data.content[0] ? data.content[0].text : 'AI unavailable.';
    res.json({ text });
  } catch (err) {
    res.status(500).json({ error: 'AI service error', text: 'AI temporarily unavailable.' });
  }
});

module.exports = router;
