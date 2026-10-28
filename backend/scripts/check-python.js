require('dotenv').config({ path: require('path').join(__dirname, '../.env'), quiet: true });
const { checkPython } = require('../services/pythonService');
checkPython().then(() => {
    console.log('Document parser ready (PDF, DOCX, TXT).');
}).catch(error => {
    console.error('Document parser startup check failed:', error.reason || error.message);
    console.error('Run npm run setup:python. Remove a stale PYTHON_BIN override to use backend/.venv.');
    process.exitCode = 1;
});
