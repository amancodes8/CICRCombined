const Project = require('../models/Project');
const Meeting = require('../models/Meeting');
const User = require('../models/User');
const Post = require('../models/Post');
const mongoose = require('mongoose');
const { buildUserInsights } = require('../utils/userInsights');

/**
 * @desc    Summarize a page (project or meeting)
 * @route   POST /api/chatbot/summarize
 * @access  Private
 */
const summarizePage = async (req, res) => {
    const { pageType, pageId } = req.body; // e.g., pageType: 'project', pageId: '...'

    if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ message: 'Gemini API key not configured.' });
    }

    try {
        let contextText = '';
        if (pageType === 'project') {
            const project = await Project.findById(pageId).populate('lead', 'name').populate('team', 'name');
            if (!project) return res.status(404).json({ message: 'Project not found.' });
            contextText = `Project Title: ${project.title}. Description: ${project.description}. Lead by: ${project.lead.name}. Team members: ${project.team.map(m => m.name).join(', ')}. Status: ${project.status}.`;
        } else if (pageType === 'meeting') {
            const meeting = await Meeting.findById(pageId).populate('organizedBy', 'name');
            if (!meeting) return res.status(404).json({ message: 'Meeting not found.' });
            contextText = `Meeting: ${meeting.title}. Type: ${meeting.meetingType}. Topic: ${meeting.details.topic}. Organized by: ${meeting.organizedBy.name}. Scheduled for: ${new Date(meeting.startTime).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}.`;
        } else {
            return res.status(400).json({ message: 'Invalid page type.' });
        }

        const prompt = `Provide a concise, one-paragraph summary of the following: ${contextText}`;
        
        // --- Gemini API Call ---
        // Using fetch to call the Gemini API
        const apiKey = process.env.GEMINI_API_KEY;
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`;

        const payload = {
            contents: [{ parts: [{ text: prompt }] }],
        };

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Gemini API Error:', errorData);
            return res.status(response.status).json({ message: 'Failed to get summary from Gemini API.', details: errorData });
        }

        const result = await response.json();
        const summary = result.candidates?.[0]?.content?.parts?.[0]?.text || "Sorry, I couldn't generate a summary for this.";

        res.status(200).json({ summary });

    } catch (err) {
        console.error('Summarize Endpoint Error:', err);
        res.status(500).send('Server Error');
    }
};

const resolveUserIdentifierFromQuestion = (question) => {
    const emailMatch = question.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
    if (emailMatch) return emailMatch[0];

    const idMatch = question.match(/\b[A-Za-z0-9-]{6,}\b/g);
    if (!idMatch) return null;
    return idMatch.find((token) => token.includes('-')) || idMatch[0];
};

const findMember = async (identifier) => {
    if (!identifier) return null;
    if (identifier.includes('@')) {
        return User.findOne({ email: identifier }).select('-password');
    }
    if (mongoose.Types.ObjectId.isValid(identifier)) {
        return User.findById(identifier).select('-password');
    }
    return User.findOne({ collegeId: identifier }).select('-password');
};

const getSocietySnapshot = async () => {
    const [memberCount, projectCount, meetingCount, postCount, roles] = await Promise.all([
        User.countDocuments({}),
        Project.countDocuments({}),
        Meeting.countDocuments({}),
        Post.countDocuments({}),
        User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
    ]);

    const roleBreakdown = roles.reduce((acc, role) => {
        acc[role._id] = role.count;
        return acc;
    }, {});

    return { memberCount, projectCount, meetingCount, postCount, roleBreakdown };
};

const askCicrAssistant = async (req, res) => {
    try {
        const { question = '', identifier } = req.body;
        const trimmed = String(question).trim();
        if (!trimmed) {
            return res.status(400).json({ message: 'Question is required' });
        }

        const lower = trimmed.toLowerCase();
        const requestedIdentifier = identifier || resolveUserIdentifierFromQuestion(trimmed);
        const isMemberSpecific =
            lower.includes('member') ||
            lower.includes('registration') ||
            lower.includes('college id') ||
            lower.includes('contribution') ||
            Boolean(requestedIdentifier);

        let memberInsights = null;
        if (isMemberSpecific) {
            if (!['Admin', 'Head'].includes(req.user.role)) {
                return res.status(403).json({
                    answer: 'Member-level details are restricted to Admin/Head accounts.',
                });
            }

            const member = await findMember(requestedIdentifier);
            if (!member) {
                return res.status(404).json({
                    answer: 'I could not find a member with that identifier.',
                });
            }
            memberInsights = await buildUserInsights(member);
        }

        const society = await getSocietySnapshot();

        // deterministic answer for speed/stability without LLM dependency
        if (!process.env.GEMINI_API_KEY) {
            if (memberInsights) {
                const m = memberInsights.member;
                const metrics = memberInsights.metrics;
                return res.json({
                    answer: `${m.name} (${m.collegeId}) is a ${m.role} member. Contributions: ${metrics.projectsLed} projects led, ${metrics.projectsInTeam} project team roles, ${metrics.suggestionsAdded} suggestions, ${metrics.totalEvents} events, ${metrics.postsCreated} posts, ${metrics.totalAchievements} achievements. Joined ${new Date(m.joinedAt).toLocaleDateString()}.`,
                    member: memberInsights,
                    society,
                });
            }
            return res.json({
                answer: `CICR currently has ${society.memberCount} members, ${society.projectCount} projects, ${society.meetingCount} meetings, and ${society.postCount} community posts. Role breakdown: ${Object.entries(society.roleBreakdown).map(([role, count]) => `${role}: ${count}`).join(', ')}.`,
                society,
            });
        }

        const context = [
            `Society snapshot: members=${society.memberCount}, projects=${society.projectCount}, meetings=${society.meetingCount}, posts=${society.postCount}.`,
            `Role breakdown: ${JSON.stringify(society.roleBreakdown)}.`,
            memberInsights ? `Member details: ${JSON.stringify(memberInsights)}` : '',
        ].join('\n');

        const prompt = `You are CICR internal assistant. Answer accurately and concisely based only on provided context.\nContext:\n${context}\nQuestion:\n${trimmed}`;
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${process.env.GEMINI_API_KEY}`;
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            return res.status(response.status).json({ message: 'AI response failed', details: errorData });
        }

        const result = await response.json();
        const answer = result.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated.';
        return res.json({ answer, member: memberInsights, society });
    } catch (err) {
        console.error('askCicrAssistant error:', err);
        return res.status(500).json({ message: 'Server error while handling assistant query' });
    }
};

module.exports = { summarizePage, askCicrAssistant };
