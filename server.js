const express = require('express');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;

const dataFile = path.join(__dirname, 'data', 'submissions.json');

const smtpConfig = process.env.SMTP_HOST
  ? {
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER
        ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          }
        : undefined,
    }
  : null;

const mailer = smtpConfig ? nodemailer.createTransport(smtpConfig) : null;

function ensureDataFile() {
  const dir = path.dirname(dataFile);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(dataFile)) {
    fs.writeFileSync(dataFile, '[]');
  }
}

ensureDataFile();

app.use(express.json());
app.use(express.static(__dirname));

app.post('/api/qualifier', (req, res) => {
  fs.readFile(dataFile, 'utf8', (readErr, content) => {
    let submissions = [];
    if (!readErr) {
      try {
        submissions = JSON.parse(content);
      } catch (e) {
        submissions = [];
      }
    }

    const entry = { ...req.body, submittedAt: new Date().toISOString() };
    submissions.push(entry);

    fs.writeFile(dataFile, JSON.stringify(submissions, null, 2), (writeErr) => {
      if (writeErr) {
        console.error(writeErr);
        return res.status(500).json({ error: 'Failed to save submission' });
      }

      if (mailer && process.env.NOTIFY_EMAIL) {
        mailer
          .sendMail({
            from: process.env.SMTP_FROM || process.env.SMTP_USER,
            to: process.env.NOTIFY_EMAIL,
            subject: 'New qualifier submission',
            text: `New qualifier submission:\n\n${JSON.stringify(entry, null, 2)}`,
          })
          .catch((err) => console.error('Notification error', err));
      }

      res.json({ status: 'ok' });
    });
  });
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
