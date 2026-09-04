import express from 'express';
import fetch from 'node-fetch';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { renderReadinessRadar } from './radar_image.js';
import { renderReadinessTable } from './readiness_table.js';
import cors from 'cors';
import dotenv from 'dotenv';


dotenv.config();

const app = express();

// The static site answers on BOTH the apex and the www host (both return 200),
// and sitemap.xml advertises the www URLs. Allowing only the apex silently
// blocked every submission made from www. Both hosts must be listed.
const ALLOWED_ORIGINS = [
  'https://vestibular.nexus',
  'https://www.vestibular.nexus',
];

// Cloudflare Pages builds a preview for every branch and every commit on this
// project, and a preview you cannot submit from is only half a preview — the
// contact form is the one thing most worth testing before merge.
//
// Anchored to THIS project's subdomain, not *.pages.dev, which would open the
// endpoint to every site on the platform. The `vestibular-5rj` label is
// globally unique to this Pages project, so nobody else can mint a hostname
// that matches. Both ^ and $ are load-bearing: without $, an attacker-owned
// `vestibular-5rj.pages.dev.example.com` would pass.
const PREVIEW_ORIGIN = /^https:\/\/[a-z0-9-]+\.vestibular-5rj\.pages\.dev$/;

const isAllowedOrigin = (origin) =>
  ALLOWED_ORIGINS.includes(origin) || PREVIEW_ORIGIN.test(origin);

app.use(cors({
  origin(origin, callback) {
    // Non-browser callers (curl, uptime pings) send no Origin header.
    if (!origin || isAllowedOrigin(origin)) return callback(null, true);
    // Omit the header rather than throwing: the browser blocks the response
    // either way, and throwing turns every stray origin into a 500 that buries
    // real errors in the log. Log it so the rejection is still visible.
    console.warn('CORS: rejected origin', origin);
    return callback(null, false);
  },
}));
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

// GET /api/health — pinged by contact.html on page load to wake the instance.
// Render's free tier spins down when idle; a measured cold start took 22.7s,
// which no reasonable client-side submit timeout can absorb. Warming on load
// means the instance is already up by the time the visitor hits Send.
// Deliberately outside the /api/contact rate limiter and does no work.
app.get('/api/health', (req, res) => res.status(200).json({ ok: true }));

// POST /api/contact — matches your front-end fetch('/api/contact')
app.post('/api/contact', async (req, res) => {
  const { name, email, message, website, scorecard_result, ba_readiness_result, ba_readiness_shape } = req.body || {};
  // Submissions from a branch preview are tests, not leads. Tag them so a
  // trial run never lands in the inbox looking like a real enquiry.
  const isPreview = PREVIEW_ORIGIN.test(req.get('origin') || '');
  console.log('Received contact form submission');

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
  // Optional — only present when the visitor arrived from the diagnostic scorecard.
  const safeScorecard = scorecard_result
    ? String(scorecard_result).replace(/</g, '&lt;')
    : '';
  // Likewise from the AI readiness check. Separate field, not folded into
  // scorecard_result: they come from different instruments with different
  // dimensions, and a visitor can send both in one enquiry.
  const safeReadiness = ba_readiness_result
    ? String(ba_readiness_result).replace(/</g, '&lt;')
    : '';

  // Chart and breakdown are enhancements: both degrade on any fault and the
  // enquiry goes out with its text summary regardless. Neither may ever cost
  // an email.
  //
  // ⛔ BUT A DEGRADED EMAIL MUST SAY WHY IT DEGRADED. These used to return a
  // bare null, so a text-only enquiry was the output of four distinct faults
  // and the only trace was a console.warn in a server log. Diagnosing one
  // meant reproducing it. The reason now travels with the result and is
  // printed beside the summary, so the NEXT failure explains itself in the
  // inbox where it is actually noticed.
  const radar = await renderReadinessRadar(ba_readiness_shape);
  const table = await renderReadinessTable(ba_readiness_shape);

  // Only worth a line when a readiness result arrived and its visuals did not.
  // With no readiness result there is nothing missing to explain.
  const visualsNote = safeReadiness && (!radar.image || !table.html)
    ? `<p style="color:#94a3b8;font-size:12px">Radar: ${radar.reason}. Breakdown: ${table.reason}.</p>`
    : '';

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
          Subject: `${isPreview ? '[PREVIEW] ' : ''}Contact form submission from ${safeName}`,
          HtmlBody: `<p><strong>Name:</strong> ${safeName}</p>
                     <p><strong>Email:</strong> ${safeEmail}</p>
                     ${safeScorecard ? `<p><strong>Scorecard:</strong> ${safeScorecard}</p>` : ''}
                     ${safeReadiness ? `<p><strong>AI readiness:</strong> ${safeReadiness}</p>` : ''}
                     ${radar.image ? `<p><img src="cid:readiness-radar" alt="Readiness radar" width="420" /></p>` : ''}
                     ${table.html || ''}
                     ${visualsNote}
                     <p><strong>Message:</strong></p>
                     <p>${safeMessage}</p>`,
          TextBody: `Name: ${safeName}\nEmail: ${safeEmail}\n`
                  + (safeScorecard ? `Scorecard: ${String(scorecard_result)}\n` : '')
                  + (safeReadiness ? `AI readiness: ${String(ba_readiness_result)}\n` : '')
                  + `\n${String(message)}`,
          ReplyTo: safeEmail,
          MessageStream: 'outbound',
          // ContentID makes it render inline in the body rather than as a
          // download. Gmail strips inline SVG, so this is raster by necessity.
          Attachments: radar.image
            ? [{
                Name: 'readiness-radar.png',
                Content: radar.image.base64,
                ContentType: radar.image.contentType,
                ContentID: 'cid:readiness-radar',
              }]
            : [],
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
      // Mirrors the fields the Postmark branch sends — if these two drift,
      // local testing stops telling the truth about production.
      console.log('Contact submission (DEV):', {
        preview: isPreview,
        name: safeName,
        email: safeEmail,
        scorecard: safeScorecard || '(none)',
        readiness: safeReadiness || '(none)',
        radar: radar ? `${Math.round(radar.base64.length / 1024)}KB png` : '(none)',
        message: safeMessage,
      });
      return res.status(200).json({ success: true, note: 'logged to server console (no provider configured)' });
    }
  } catch (err) {
    console.error('Contact handler error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
