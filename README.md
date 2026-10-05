# Connect

A web application with a Node.js Express backend and a static HTML/JS/CSS frontend. The backend also utilizes a Python NLP engine for document processing and analysis.

## Project Structure

- `frontend/`: Contains static assets (HTML, CSS, JS) for the web interface.
- `backend/`: Node.js Express API server with Python integration.
- `venv/`: Python virtual environment (do not push to source control).

## Prerequisites

- Node.js (v14 or higher)
- Python (v3.8 or higher)

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
