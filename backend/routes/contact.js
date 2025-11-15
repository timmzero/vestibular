const express = require('express');
const { sendPostmarkEmail } = require('../postmarkService');
const router = express.Router();

// Middleware to parse JSON body
router.use(express.json());

router.post('/contact', async (req, res) => {
  try {
    const { name, email, message } = req.body;
    const { body, validationResult } = require('express-validator');

// Validation and sanitization middleware
const validateContactForm = [
  body('name')
    .trim()
    .isLength({ min: 2 }).withMessage('Name must be at least 2 characters long.')
    .escape(),
  body('email')
    .trim()
    .isEmail().withMessage('A valid email address is required.')
    .normalizeEmail(),
  body('message')
    .trim()
    .isLength({ min: 5 }).withMessage('Message must be at least 5 characters long.')
    .escape()
];

router.post('/contact', validateContactForm, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array().map(e => e.msg) });
  }

  try {
    const { name, email, message } = req.body;
    const messageId = await sendPostmarkEmail({ name, email, message });

    res.status(200).json({ success: true, messageId });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

    const messageId = await sendPostmarkEmail({ name, email, message });

    res.status(200).json({ success: true, messageId });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;