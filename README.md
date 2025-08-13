# You Power You

Static website for promoting residential solar in Guilford County.

## Structure
- `index.html` – landing page with messaging about savings and energy freedom.
- `about.html` – background on the project and partners.
- `contact.html` – contact information and form.
- `css/style.css` – site styling.
- `js/main.js` – small script for the contact form.

## Development
Open `index.html` in a browser to view the site. No build step is required.

## Qualifier Form Backend
Run `npm start` to launch a small Express server that serves the site and stores
qualifier form submissions to `data/submissions.json` via the `/api/qualifier`
endpoint.

To receive an email when a submission is received, supply SMTP settings as
environment variables before starting the server:

```
SMTP_HOST=<host>       SMTP port defaults to 587 unless SMTP_PORT is set
SMTP_USER=<user>       SMTP_PASS=<password>
NOTIFY_EMAIL=<you@example.com>  # address to receive notifications
[SMTP_FROM=<from address>]      # optional
[SMTP_SECURE=true]              # set if your SMTP server requires TLS
```
