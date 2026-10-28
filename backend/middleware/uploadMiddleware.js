const multer = require('multer');
const path = require('path');
const { randomUUID } = require('crypto');

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, '../uploads/'));
    },
    filename: function (req, file, cb) {
        cb(null, `${randomUUID()}${path.extname(file.originalname).toLowerCase()}`);
    }
});

// Legacy DOC cannot be parsed reliably; request DOCX instead.
const fileFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.pdf' || ext === '.docx' || ext === '.txt') {
        cb(null, true);
    } else {
        cb(Object.assign(new Error('Only PDF, DOCX, and TXT documents are permitted'), { status: 400 }), false);
    }
};

const upload = multer({ 
    storage, 
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

module.exports = upload;
