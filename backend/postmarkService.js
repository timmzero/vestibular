const fetch = require('node-fetch'); // or native fetch in Node 18+

async function sendPostmarkEmail({ name, email, message }) {
  const postmarkToken = process.env.POSTMARK_TOKEN;
  if (!postmarkToken) {
    throw new Error('POSTMARK_TOKEN is not set in environment variables');
  }

  const payload = {
    From: 'noreply@yourdomain.com', // Replace with your verified sender
    To: 'consult@yourdomain.com', // Replace with your recipient
    Subject: `Contact form submission — ${name}`,
    HtmlBody: `<p><strong>Name:</strong> ${name}</p><p><strong>Email:</strong> ${email}</p><p>${message}</p>`,
    TextBody: `Name: ${name}
Email: ${email}

${message}`,
    MessageStream: 'outbound'
  };

  const response = await fetch('https://api.postmarkapp.com/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Postmark-Server-Token': postmarkToken
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('Postmark send failed:', response.status, errorBody);
    throw new Error(`Postmark send failed with status ${response.status}`);
  }

  const data = await response.json();
  console.log('Postmark send success:', data.MessageID);
  return data.MessageID;
}

module.exports = { sendPostmarkEmail };