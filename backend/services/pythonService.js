const { execFile } = require('child_process');
const { promisify } = require('util');
const { existsSync } = require('fs');
const path = require('path');
const execute = promisify(execFile);
const backendDir = path.resolve(__dirname, '..');

function pythonExecutable() {
    if (process.env.PYTHON_BIN?.trim()) return process.env.PYTHON_BIN.trim();
    const localPython = path.join(backendDir, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
    return existsSync(localPython) ? localPython : 'python3';
}

async function runPython(args) {
    try {
        const { stdout } = await execute(pythonExecutable(), [path.join(backendDir, 'nlp_engine.py'), ...args], {
            cwd: backendDir, timeout: 30000, maxBuffer: 2 * 1024 * 1024,
            env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
        });
        return stdout;
    } catch (error) {
        // Log only a classification; stderr can contain filenames and document text.
        const reason = error.code === 'ENOENT' ? 'PYTHON_NOT_FOUND'
            : error.killed ? 'PARSER_TIMEOUT'
            : /parser is not installed|ModuleNotFoundError|ImportError/.test(error.stderr || '') ? 'PARSER_DEPENDENCY_MISSING'
            : 'PARSER_PROCESS_FAILED';
        console.error(`[document-parser] ${reason}. Run npm run setup:python and check PYTHON_BIN.`);
        throw Object.assign(new Error('Document processing is unavailable. Please try again later.'), {
            status: 503, code: 'EXTRACTION_UNAVAILABLE', reason
        });
    }
}

async function checkPython() {
    const result = JSON.parse(await runPython(['--test']));
    if (!result.has_pypdf2 || !result.has_docx) {
        throw new Error('PDF/DOCX dependencies are missing. Run npm run setup:python and check PYTHON_BIN.');
    }
    return result;
}

module.exports = { pythonExecutable, runPython, checkPython };
