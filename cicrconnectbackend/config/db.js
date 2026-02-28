const mongoose = require('mongoose');
const logger = require('../utils/logger');

const connectionStates = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
};

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        logger.info('mongodb_connected');
    } catch (err) {
        logger.error('mongodb_connection_failed', { error: err.message });
        // Exit process with failure
        process.exit(1);
    }
};

const getDbHealth = () => {
    const stateCode = mongoose.connection.readyState;
    const state = connectionStates[stateCode] || 'unknown';
    return {
        state,
        stateCode,
        host: mongoose.connection.host || null,
        name: mongoose.connection.name || null,
    };
};

module.exports = {
    connectDB,
    getDbHealth,
};
