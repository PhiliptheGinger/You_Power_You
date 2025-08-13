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
