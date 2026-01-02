const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure Storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        // Create unique filename: fieldname-timestamp.ext
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
});

// Init upload
const upload = multer({
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
    fileFilter: function (req, file, cb) {
        checkFileType(file, cb);
    }
}).single('file'); // 'file' is the field name

// Check File Type
function checkFileType(file, cb) {
    // Allowed ext
    const filetypes = /jpeg|jpg|png|gif|pdf|doc|docx|ppt|pptx|txt|zip|rar|mp4|webm/;
    // Check ext matches the end of the original filename
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

    // Also check mimetype for safety if possible, but extname is often sufficient for basic check
    // const mimetype = filetypes.test(file.mimetype);

    if (extname) {
        return cb(null, true);
    } else {
        cb(new Error('Error: Files Only! (Invalid Type)'));
    }
}

module.exports = upload;
