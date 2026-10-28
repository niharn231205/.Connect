# Connect

A web application with a Node.js Express backend and a static HTML/JS/CSS frontend. The backend also utilizes a Python NLP engine for document processing and analysis.

## Project Structure

- `frontend/`: Contains static assets (HTML, CSS, JS) for the web interface.
- `backend/`: Node.js Express API server with Python integration.
- `venv/`: Python virtual environment (do not push to source control).

## Prerequisites

- Node.js (v22 or higher)
- Python (v3.10 or higher)

## Local Setup

### 1. Clone the repository

```bash
git clone <your-repository-url>
cd .Connect
```

### 2. Backend Setup

```bash
cd backend

# Install Node.js dependencies
npm install

# Set up Python virtual environment (if not already set up)
python -m venv ../venv

# Activate virtual environment
# On Windows:
..\\venv\\Scripts\\activate
# On macOS/Linux:
# source ../venv/bin/activate

# Install Python dependencies
pip install -r requirements.txt
```

### 3. Run the Backend

```bash
# Still in the backend directory
npm start
```
The server will start on `http://localhost:3000` (or whatever port is defined in `.env`).

### 4. Run the Frontend

Since the frontend consists of static files, you can serve them using any simple HTTP server. For example:
- **Using VS Code Live Server**: Right-click `frontend/index.html` and select "Open with Live Server".
- **Using Python**:
  ```bash
  cd frontend
  python -m http.server 8000
  ```
  Then open `http://localhost:8000` in your browser.

## Deployment Preparation

This project is structured for easy deployment to services like Heroku, Render, or DigitalOcean.

- The `.gitignore` is configured to ignore `node_modules/`, `venv/`, `__pycache__/`, and `.env`.
- `package.json` in the `backend` includes a `start` script.
- Ensure any secret keys or database connection strings are managed via Environment Variables on your hosting provider, not hardcoded in the source.

**Deployment Strategy:**
1. **Frontend**: Can be deployed to Netlify, Vercel, or GitHub Pages.
2. **Backend**: Can be deployed to Heroku, Render, or Railway. Ensure the environment supports both Node.js and Python, as the backend uses `nlp_engine.py` internally. Alternatively, Dockerize the backend for easier deployment across environments.

## Resume verification

1. Copy `backend/.env.example` to `backend/.env` and set a private `GEMINI_API_KEY` from Google AI Studio, plus a random `JWT_SECRET`.
2. `GEMINI_MODEL` defaults to `gemini-3.8-flash`; use a model available to your Google project that supports structured output. `PYTHON_BIN` may point to your virtual environment’s Python executable.
3. Install `backend/requirements.txt`. Start the backend and open `http://localhost:3000`; the backend serves the frontend too.

The upload pipeline extracts PDF/DOCX/TXT text, sends the full extracted text to Gemini, validates its structured verdict, and only then analyzes and saves an accepted resume. Acceptance requires `isResume: true` and confidence of at least 0.8. A low-confidence verdict asks the user for a clearer resume. Gemini classifies document type, not the truth of credentials.

Limits: 5 MB per upload, 50 PDF pages, 50,000 extracted characters. Legacy DOC, encrypted PDFs and image-only scans are unsupported; export DOCX or apply OCR first. Rejected and failed uploads are deleted and the previous profile is preserved. No keyword fallback or fabricated score is used when extraction or Gemini fails. Upload files are not publicly served. The UI discloses that extracted content is sent to Google.

The displayed structure score is an existing local heuristic, not a Gemini assessment or a prediction of ATS acceptance. Job-specific skill gaps remain in job matching; generic skill-gap guesses were removed from resume analysis. The upload page’s placeholder footer links were removed.

Run backend regression tests with `cd backend && npm test`. Run extraction tests with your virtual environment activated: `python -m unittest discover -s backend/test -p "test_*.py"`. Tests mock Gemini; a real end-to-end provider check requires your API key. API format reference: [Google structured output documentation](https://ai.google.dev/gemini-api/docs/generate-content/structured-output).

## Fixing document processing on Render

The backend requires Python **and** PDF/DOCX packages at runtime, before it can contact Gemini. Render native runtimes include Python tools ([Render runtime documentation](https://render.com/docs/native-runtimes)).

- Build command: `cd backend && npm ci`
- Start command: `cd backend && npm start`
- Leave `PYTHON_BIN` unset unless intentionally using a different installed interpreter.
- Set `GEMINI_API_KEY` in the Render service's Environment settings. Local `.env` files are ignored by Git and are not deployed.

On Render, npm's postinstall hook creates `backend/.venv` and installs the Python requirements there. Both resume extraction and job matching use this environment. `npm start` verifies PDF/DOCX dependencies before starting the web server; a missing interpreter or dependency now fails deployment with an actionable log instead of silently breaking uploads.

For an existing service, deploy these changes with **Clear build cache & deploy**. If the service is not managed by a Blueprint, verify the build/start commands in its dashboard; changing `render.yaml` alone does not update manual service settings. If the service Root Directory is already `backend`, omit `cd backend &&` from both commands.

For local setup, run `cd backend && npm run setup:python` before `npm start`. This installs into a project-local virtual environment without modifying system Python. A stale `PYTHON_BIN=python3` override can bypass this environment; remove it or point it to the intended interpreter.
