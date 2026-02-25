const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');

dotenv.config();
connectDB();

const app = express();

const normalizeOrigin = (value) => String(value || '').trim().replace(/\/+$/, '');

const allowedOrigins = new Set([
    'http://localhost:5173',
    // 'https://cicrconnect.vercel.app',
]);

if (process.env.FRONTEND_URL) {
    process.env.FRONTEND_URL
        .split(',')
        .map((v) => normalizeOrigin(v))
        .filter(Boolean)
        .forEach((v) => allowedOrigins.add(v));
}

const corsOptions = {
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        const normalized = normalizeOrigin(origin);
        if (allowedOrigins.has(normalized)) {
            return callback(null, true);
        }
        return callback(new Error(`CORS policy: origin not allowed (${normalized})`));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
    res.send('CICR Connect API is running...');
});

app.get('/api/health', (req, res) => {
    res.json({ success: true, message: 'API healthy' });
});

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/projects', require('./routes/projectRoutes'));
app.use('/api/meetings', require('./routes/meetingRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/chatbot', require('./routes/chatbotRoutes'));
app.use('/api/inventory', require('./routes/inventoryRoutes')); 
app.use('/api/community', require('./routes/postRoutes'));
app.use('/api/communication', require('./routes/communicationRoutes'));

app.use((err, req, res, next) => {
    const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
    res.status(statusCode).json({
        message: err.message,
        stack: process.env.NODE_ENV === 'production' ? null : err.stack,
    });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📡 Inventory system active at /api/inventory`);
});
