const jwt = require('jsonwebtoken');

/**
 * Generates a JSON Web Token for a given user ID.
 * @param {string} id The user's MongoDB ObjectId.
 * @returns {string} The generated JWT.
 */
const generateToken = (id) => {
    // This function signs the user's unique ID with your secret key from the .env file.
    // The token is set to expire in 30 days, after which the user will need to log in again.
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '30d',
    });
};

module.exports = generateToken;
