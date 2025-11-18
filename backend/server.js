import express from 'express';
import fetch from 'node-fetch';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cors from 'cors';
import dotenv from 'dotenv';


dotenv.config();

const app = express();

// If frontend is served from another origin, set the allowed origin here or use cors() carefully.
// Example: cors({ origin: 'https://vestibular.nexus' })
app.use(cors({ origin: 'https://vestibular.nexus' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(helmet());
app.set('trust proxy', 1);

// Rate limit contact form submissions on the API route
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // limit each IP to 5 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/contact', limiter);

// POST /api/contact — matches your front-end fetch('/api/contact')
app.post('/api/contact', async (req, res) => {
  const { name, email, message, website } = req.body || {};
  console.log('Received contact form submission:', { name, email, message, website });

  // Honeypot check
  if (website) {
    console.log('Honeypot triggered — spam detected');
    return res.status(400).json({ success: false, errors: ['Spam detected'] });
  }

  // Validation
  const errors = [];
  if (!name || String(name).trim().length < 2) errors.push('Name must be at least 2 characters');
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) errors.push('Valid email required');
  if (!message || String(message).trim().length < 5) errors.push('Message must be at least 5 characters');

  if (errors.length) {
    console.log('Validation errors:', errors);
    return res.status(400).json({ success: false, errors });
  }

  // Sanitization
  const safeName = String(name).replace(/</g, '&lt;');
  const safeEmail = String(email).replace(/</g, '&lt;');
  const safeMessage = String(message).replace(/</g, '&lt;').replace(/\n/g, '<br>');

  const POSTMARK_TOKEN = process.env.POSTMARK_TOKEN;
  console.log('Postmark token loaded:', !!POSTMARK_TOKEN);

  try {
    if (POSTMARK_TOKEN) {
      console.log('Sending email via Postmark...');
      const pmResponse = await fetch('https://api.postmarkapp.com/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Postmark-Server-Token': POSTMARK_TOKEN,
        },
        body: JSON.stringify({
          From: 'noreply@vestibular.nexus',
          To: 'consult@vestibular.nexus',
          Subject: `Contact form submission from ${safeName}`,
          HtmlBody: `<p><strong>Name:</strong> ${safeName}</p>
                     <p><strong>Email:</strong> ${safeEmail}</p>
                     <p><strong>Message:</strong></p>
                     <p>${safeMessage}</p>`,
          TextBody: `Name: ${safeName}\nEmail: ${safeEmail}\n\n${String(message)}`,
          MessageStream: 'outbound'
        }),
      });

      const pmText = await pmResponse.text();
      console.log('Postmark response:', pmResponse.status, pmText);

      if (!pmResponse.ok) {
        return res.status(502).json({ success: false, error: 'Email provider error' });
      }

      return res.status(200).json({ success: true });
    } else {
      console.log('No POSTMARK_TOKEN found — using dev fallback');
      console.log('Contact submission (DEV):', { name: safeName, email: safeEmail, message: safeMessage });
      return res.status(200).json({ success: true, note: 'logged to server console (no provider configured)' });
    }
  } catch (err) {
    console.error('Contact handler error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
