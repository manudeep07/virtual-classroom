const express = require('express');
const router = express.Router();
const User = require('../models/User');
const upload = require('../middleware/upload');

// Upload Avatar
router.post('/:id/avatar', upload, async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ msg: 'No file uploaded' });
        }

        const fileUrl = `/uploads/${req.file.filename}`;

        // Update user avatar in DB
        const user = await User.findByIdAndUpdate(
            req.params.id,
            { avatar: fileUrl },
            { new: true }
        ).select('-password');

        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }

        res.json({ user, fileUrl });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
