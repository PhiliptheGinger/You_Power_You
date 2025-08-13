const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const dataFile = path.join(__dirname, 'data', 'submissions.json');

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

    submissions.push({ ...req.body, submittedAt: new Date().toISOString() });

    fs.writeFile(dataFile, JSON.stringify(submissions, null, 2), (writeErr) => {
      if (writeErr) {
        console.error(writeErr);
        return res.status(500).json({ error: 'Failed to save submission' });
      }
      res.json({ status: 'ok' });
    });
  });
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
