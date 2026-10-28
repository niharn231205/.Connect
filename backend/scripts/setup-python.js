const { spawnSync } = require('child_process');
const path = require('path');
const { existsSync } = require('fs');

// Render's existing "npm install" build command also runs this hook.
// Local npm installs do not modify the user's Python environment.
if (process.argv.includes('--render-only') && process.env.RENDER !== 'true') process.exit(0);
const backendDir = path.resolve(__dirname, '..');
const venv = path.join(backendDir, '.venv');
const python = path.join(venv, process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
function run(command, args) {
    const result = spawnSync(command, args, { cwd: backendDir, stdio: 'inherit' });
    if (result.error || result.status !== 0) {
        console.error('Python setup failed. Ensure Python 3 with venv is installed.');
        process.exit(1);
    }
}
if (!existsSync(python)) run(process.env.PYTHON_BUILD_BIN || 'python3', ['-m', 'venv', venv]);
run(python, ['-m', 'pip', 'install', '--disable-pip-version-check', '-r', 'requirements.txt']);
run(python, ['-c', 'import PyPDF2, docx; print("PDF and DOCX parsers ready")']);
