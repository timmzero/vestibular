import express from 'express';
import fetch from 'node-fetch';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(helmet());

// Rate limit contact form submissions
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // limit each IP to 5 requests per minute
});
app.use('/contact', limiter);

app.post('/contact', async (req, res) => {
  const { name, email, message, website } = req.body;

  // Honeypot check
  if (website) {
    return res.status(400).send('Spam detected');
  }

  // Basic sanitization
  const safeName = String(name).replace(/</g, "&lt;");
  const safeEmail = String(email).replace(/</g, "&lt;");
  const safeMessage = String(message).replace(/</g, "&lt;");

  try {
    const response = await fetch('https://api.postmarkapp.com/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Postmark-Server-Token': process.env.POSTMARK_TOKEN
      },
      body: JSON.stringify({
        From: 'noreply@vestibular.nexus',
        To: 'consult@vestibular.nexus',
        Subject: `Contact form submission from ${safeName}`,
        HtmlBody: `
          <p><strong>Name:</strong> ${safeName}</p>
          <p><strong>Email:</strong> ${safeEmail}</p>
          <p><strong>Message:</strong></p>
          <p>${safeMessage}</p>
        `
      })
    });

    if (!response.ok) throw new Error('Postmark send failed');

    res.status(200).send('Message sent successfully');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error sending message');
  }
});

app.listen(3000, () => console.log('Server running on port 3000'));
