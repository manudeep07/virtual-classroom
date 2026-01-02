const mongoose = require('mongoose');
const Material = require('./server/models/Material');
const Classroom = require('./server/models/Classroom');

const run = async () => {
    try {
        await mongoose.connect('mongodb://localhost:27017/virtual-classroom');
        console.log('Connected');

        const id = '69542cff8aab09e5c4a05de5'; // The ID from user error
        console.log('Querying for classroomId:', id);

        const materials = await Material.find({ classroomId: id });
        console.log('Materials found:', materials);

    } catch (e) {
        console.error('ERROR CAUGHT:', e);
    } finally {
        mongoose.disconnect();
    }
};

run();
