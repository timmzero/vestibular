const express = require('express');
const contactRouter = require('./routes/contact');

const app = express();
const PORT = process.env.PORT || 3000;

app.use('/api', contactRouter);

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});