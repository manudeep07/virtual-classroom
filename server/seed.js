const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

dotenv.config();

const seedDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/virtual-classroom');
        console.log('Connected to MongoDB...');

        // check if user exists
        const user = await User.findOne({ email: 'admin@school.com' });
        if (user) {
            console.log('Test user already exists.');
        } else {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash('password123', salt);

            const newUser = new User({
                name: 'Admin Teacher',
                email: 'admin@school.com',
                password: hashedPassword,
                role: 'teacher'
            });

            await newUser.save();
            console.log('Database created! Test User inserted: admin@school.com');
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

seedDB();
