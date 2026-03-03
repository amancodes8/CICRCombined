const Project = require('../models/Project');
const Meeting = require('../models/Meeting');
const User = require('../models/User');
const Post = require('../models/Post');
const Event = require('../models/Event');
const mongoose = require('mongoose');
const { buildUserInsights } = require('../utils/userInsights');
const { geminiGenerate } = require('../utils/geminiClient');
const { normalizeEmail, normalizeCollegeId } = require('../utils/fieldCrypto');

/* ─── Complete route & feature map for CICR Connect ─── */
const CICR_ROUTE_MAP = {
    pages: [
        { path: '/dashboard', label: 'Dashboard', description: 'Main dashboard with overview of projects, meetings, events, and activity feed', keywords: ['home', 'overview', 'main', 'dashboard', 'start', 'landing'] },
        { path: '/projects', label: 'Projects', description: 'Browse all CICR projects, filter by domain/status, view project cards', keywords: ['projects', 'all projects', 'project list', 'browse projects'] },
        { path: '/projects/:id', label: 'Project Details', description: 'View detailed info about a specific project including team, progress, milestones', keywords: ['project detail', 'project info', 'specific project', 'project page'] },
        { path: '/create-project', label: 'Create Project', description: 'Start a new project by filling in title, description, domain, team members', keywords: ['create project', 'new project', 'start project', 'initiate project', 'propose project'] },
        { path: '/projects/:id/review', label: 'Project Review', description: 'Review and provide feedback on a project submission', keywords: ['review project', 'project review', 'feedback', 'approve project'] },
        { path: '/meetings', label: 'Meetings', description: 'View all scheduled meetings, upcoming and past meetings calendar', keywords: ['meetings', 'all meetings', 'meeting list', 'scheduled meetings', 'upcoming meetings'] },
        { path: '/schedule', label: 'Schedule Meeting', description: 'Schedule a new meeting with date, time, topic, and attendees', keywords: ['schedule meeting', 'new meeting', 'create meeting', 'book meeting', 'plan meeting'] },
        { path: '/events', label: 'Events', description: 'Browse CICR events, workshops, hackathons, recruitment drives, and tech talks', keywords: ['events', 'workshops', 'hackathons', 'tech talks', 'recruitment', 'event list'] },
        { path: '/events/:id', label: 'Event Details', description: 'View detailed information about a specific event', keywords: ['event detail', 'event info', 'specific event'] },
        { path: '/hierarchy', label: 'Mentorship Ops', description: 'Mentorship operations - view mentor-mentee hierarchy, request mentors, manage mentorship tasks', keywords: ['mentorship', 'mentor', 'mentee', 'hierarchy', 'guidance', 'mentor request', 'mentorship ops'] },
        { path: '/learning', label: 'Learning Hub', description: 'Learning tracks, skill tasks, upskilling resources, and progress tracking for members', keywords: ['learning', 'learn', 'skills', 'upskill', 'tracks', 'education', 'training', 'learning hub', 'courses'] },
        { path: '/programs', label: 'Programs Hub', description: 'Weekly quests, mentor desk, badges, project ideas board, office hours booking', keywords: ['programs', 'quests', 'badges', 'ideas', 'office hours', 'mentor desk', 'programs hub'] },
        { path: '/community', label: 'Community', description: 'Community feed with posts, discussions, issue tickets, and member interactions', keywords: ['community', 'posts', 'feed', 'discussions', 'social', 'forum'] },
        { path: '/community?tab=issues&quick=create-issue', label: 'Create Issue Ticket', description: 'Raise an issue ticket for admin review and support', keywords: ['issue', 'ticket', 'bug', 'problem', 'report issue', 'support ticket', 'create issue'] },
        { path: '/inventory', label: 'Inventory', description: 'Browse CICR hardware inventory - components, sensors, boards, and equipment', keywords: ['inventory', 'hardware', 'components', 'equipment', 'sensors', 'boards', 'parts'] },
        { path: '/inventory/add', label: 'Add Component', description: 'Add a new hardware component to the CICR inventory', keywords: ['add component', 'new component', 'add hardware', 'register component'] },
        { path: '/inventory/my-items', label: 'My Inventory', description: 'View components you have borrowed or are responsible for', keywords: ['my inventory', 'my components', 'borrowed', 'my items', 'checked out'] },
        { path: '/inventory/:id', label: 'Component Details', description: 'Detailed view of a specific inventory component', keywords: ['component detail', 'component info', 'part detail'] },
        { path: '/profile', label: 'My Profile', description: 'View and edit your personal profile, achievements, contributions, and settings', keywords: ['profile', 'my profile', 'account', 'settings', 'edit profile', 'personal'] },
        { path: '/profile/:collegeId', label: 'Public Profile', description: 'View public profile of any CICR member by their college ID', keywords: ['public profile', 'member profile', 'view member', 'user profile'] },
        { path: '/guidelines', label: 'Guidelines', description: 'CICR society rules, code of conduct, contribution guidelines, and policies', keywords: ['guidelines', 'rules', 'policies', 'code of conduct', 'regulations'] },
        { path: '/communication', label: 'Collab Stream', description: 'Admin collaborative communication stream for real-time messaging (Admin only)', keywords: ['communication', 'chat', 'collab stream', 'messaging', 'admin chat'] },
        { path: '/admin', label: 'Admin Panel', description: 'Admin panel for user management, approvals, recruitment, audit logs, and system configuration (Admin/Head only)', keywords: ['admin', 'admin panel', 'manage users', 'approvals', 'recruitment', 'audit', 'administration'] },
        { path: '/apply', label: 'Apply to CICR', description: 'Submit an application to join CICR society', keywords: ['apply', 'application', 'join', 'register', 'signup', 'join cicr', 'become member'] },
        { path: '/login', label: 'Login', description: 'Sign in to your CICR Connect account', keywords: ['login', 'sign in', 'signin', 'authenticate'] },
    ],
    actions: [
        { action: 'Create a new project', navigateTo: '/create-project', keywords: ['create project', 'new project', 'start project'] },
        { action: 'Schedule a meeting', navigateTo: '/schedule', keywords: ['schedule meeting', 'new meeting', 'book meeting'] },
        { action: 'Create an event', navigateTo: '/events?quick=create', keywords: ['create event', 'new event', 'organize event'] },
        { action: 'Raise an issue ticket', navigateTo: '/community?tab=issues&quick=create-issue', keywords: ['raise issue', 'create ticket', 'report bug'] },
        { action: 'Add inventory component', navigateTo: '/inventory/add', keywords: ['add component', 'add hardware'] },
        { action: 'View notifications', navigateTo: '/dashboard', keywords: ['notifications', 'alerts', 'updates'] },
        { action: 'Edit my profile', navigateTo: '/profile', keywords: ['edit profile', 'update profile', 'change settings'] },
        { action: 'Browse learning tracks', navigateTo: '/learning', keywords: ['learning tracks', 'courses', 'upskill'] },
        { action: 'Submit weekly quest', navigateTo: '/programs', keywords: ['quest', 'weekly quest', 'submit quest'] },
        { action: 'Book office hours', navigateTo: '/programs', keywords: ['office hours', 'book slot', 'mentor time'] },
        { action: 'Request a mentor', navigateTo: '/hierarchy', keywords: ['request mentor', 'find mentor', 'mentorship'] },
        { action: 'Apply to join CICR', navigateTo: '/apply', keywords: ['apply', 'join cicr', 'application'] },
    ],
    features: {
        dashboard: 'Overview of activity, quick stats, recent projects/meetings/events, contribution summary.',
        projects: 'Create, manage, and collaborate on technical projects. Track status (proposed/active/completed), assign teams, set milestones, and review project submissions.',
        meetings: 'Schedule and manage meetings with agenda, attendees, and minutes. Supports different meeting types.',
        events: 'Organize and attend workshops, hackathons, tech talks, and recruitment drives. RSVP and track participation.',
        mentorship: 'Mentor-mentee pairing, mentorship tasks, guidance tracking, and hierarchy visualization.',
        learning: 'Structured learning tracks with tasks, skill assessments, and progress tracking for upskilling members.',
        programs: 'Weekly quests for engagement, badge system for achievements, project ideas board, mentor desk for guidance, and office hours booking.',
        community: 'Social feed with posts, discussions, and issue tickets. Members can share updates, ask questions, and report issues.',
        inventory: 'Track CICR hardware inventory - sensors, boards, components. Borrow, return, and manage equipment.',
        admin: 'User management, application approvals, role assignments, engagement configuration, audit logs, and system settings.',
        communication: 'Real-time collaborative messaging stream for admin coordination.',
    }
};

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
        const result = await geminiGenerate(prompt);
        if (!result.ok) {
            return res.status(502).json({ message: `Failed to get summary from Gemini API: ${result.error}` });
        }

        const summary = result.text || "Sorry, I couldn't generate a summary for this.";

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
        return User.findOneByEmail(normalizeEmail(identifier)).select('-password');
    }
    if (mongoose.Types.ObjectId.isValid(identifier)) {
        return User.findById(identifier).select('-password');
    }
    return User.findOneByCollegeId(normalizeCollegeId(identifier)).select('-password');
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

        /* ─── Route / navigation detection ─── */
        const matchedRoutes = [];
        for (const page of CICR_ROUTE_MAP.pages) {
            const score = page.keywords.reduce((acc, kw) => acc + (lower.includes(kw) ? 1 : 0), 0);
            if (score > 0 || lower.includes(page.label.toLowerCase())) {
                matchedRoutes.push({ ...page, score: score + (lower.includes(page.label.toLowerCase()) ? 2 : 0) });
            }
        }
        matchedRoutes.sort((a, b) => b.score - a.score);

        const matchedActions = [];
        for (const action of CICR_ROUTE_MAP.actions) {
            if (action.keywords.some(kw => lower.includes(kw))) {
                matchedActions.push(action);
            }
        }

        /* ─── Member lookup (admin/head only) ─── */
        const requestedIdentifier = identifier || resolveUserIdentifierFromQuestion(trimmed);
        const isMemberSpecific =
            lower.includes('member') ||
            lower.includes('registration') ||
            lower.includes('college id') ||
            lower.includes('contribution') ||
            Boolean(requestedIdentifier);

        let memberInsights = null;
        if (isMemberSpecific && requestedIdentifier) {
            if (['Admin', 'Head'].includes(req.user.role)) {
                const member = await findMember(requestedIdentifier);
                if (member) {
                    memberInsights = await buildUserInsights(member);
                }
            }
        }

        /* ─── Gather live context ─── */
        const [society, projectHighlights, recentEvents, recentMeetings] = await Promise.all([
            getSocietySnapshot(),
            Project.find({}).sort({ updatedAt: -1 }).limit(10).select('title domain status description').lean(),
            Event.find({}).sort({ date: -1 }).limit(5).select('title type date').lean().catch(() => []),
            Meeting.find({}).sort({ startTime: -1 }).limit(5).select('title meetingType startTime').lean().catch(() => []),
        ]);

        /* ─── Build comprehensive route knowledge ─── */
        const routeMapText = CICR_ROUTE_MAP.pages
            .map(p => `• ${p.label} → ${p.path} : ${p.description}`)
            .join('\n');

        const actionsText = CICR_ROUTE_MAP.actions
            .map(a => `• ${a.action} → ${a.navigateTo}`)
            .join('\n');

        const featuresText = Object.entries(CICR_ROUTE_MAP.features)
            .map(([key, desc]) => `• ${key}: ${desc}`)
            .join('\n');

        const projectContext = projectHighlights
            .map(p => `- ${p.title} [${p.domain}] (${p.status}): ${String(p.description || '').slice(0, 200)}`)
            .join('\n');

        const eventContext = recentEvents
            .map(e => `- ${e.title} (${e.type}) on ${e.date ? new Date(e.date).toLocaleDateString() : 'TBD'}`)
            .join('\n');

        const meetingContext = recentMeetings
            .map(m => `- ${m.title} (${m.meetingType}) at ${m.startTime ? new Date(m.startTime).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'TBD'}`)
            .join('\n');

        const contextParts = [
            `=== CICR CONNECT PLATFORM KNOWLEDGE ===`,
            `CICR (Centre for Innovation in Computing and Robotics) Connect is a comprehensive society management platform for the CICR technical society.`,
            `\n=== ALL PAGES & NAVIGATION ROUTES ===\n${routeMapText}`,
            `\n=== QUICK ACTIONS ===\n${actionsText}`,
            `\n=== FEATURE DESCRIPTIONS ===\n${featuresText}`,
            `\n=== LIVE SOCIETY STATS ===`,
            `Members: ${society.memberCount}, Projects: ${society.projectCount}, Meetings: ${society.meetingCount}, Posts: ${society.postCount}`,
            `Role breakdown: ${JSON.stringify(society.roleBreakdown)}`,
            `\n=== RECENT PROJECTS ===\n${projectContext || 'No project data.'}`,
            `\n=== RECENT EVENTS ===\n${eventContext || 'No events data.'}`,
            `\n=== RECENT MEETINGS ===\n${meetingContext || 'No meeting data.'}`,
            memberInsights ? `\n=== MEMBER DETAILS ===\n${JSON.stringify(memberInsights)}` : '',
        ].filter(Boolean).join('\n');

        /* ─── Gemini prompt ─── */
        if (!process.env.GEMINI_API_KEY) {
            // Fallback without Gemini
            const navigationLinks = matchedRoutes.slice(0, 3).map(r => ({
                label: r.label,
                path: r.path,
                description: r.description,
            }));

            return res.json({
                answer: memberInsights
                    ? `${memberInsights.member.name} (${memberInsights.member.collegeId}) is a ${memberInsights.member.role} member with ${memberInsights.metrics.totalProjectContributions} project contributions.`
                    : `CICR has ${society.memberCount} members, ${society.projectCount} projects, ${society.meetingCount} meetings. Ask me anything!`,
                navigation: navigationLinks,
                actions: matchedActions.slice(0, 3),
                society,
                member: memberInsights,
            });
        }

        const systemPrompt = `You are CICR Connect Assistant — the ultimate one-stop AI helper for the CICR Connect platform.

YOUR CAPABILITIES:
1. NAVIGATION: You know every page, route, and feature. When users ask "where can I...", "how do I...", "take me to...", provide the exact route path.
2. INFORMATION: You have live data about projects, meetings, events, members, and society stats.
3. GUIDANCE: You can explain how to use any feature, what each page does, and guide users step-by-step.
4. ROUTING: When a user wants to do something, tell them exactly where to go and what to click.

RESPONSE FORMAT RULES:
- Always be helpful, concise, and friendly.
- When suggesting navigation, include the route path in this exact format: [[LINK:/path|Label Text]] so the frontend can make it clickable.
  Examples: [[LINK:/projects|Projects Page]], [[LINK:/create-project|Create a New Project]], [[LINK:/learning|Learning Hub]]
- For actions, use: [[ACTION:/path|Action Description]]
  Examples: [[ACTION:/schedule|Schedule a Meeting]], [[ACTION:/community?tab=issues&quick=create-issue|Create Issue Ticket]]
- You can suggest multiple links and actions in one response.
- Answer ANY question the user asks — about CICR, its features, how to use the platform, technology, robotics, coding, or anything related.
- If the question is about navigation, always include relevant [[LINK:...]] tags.
- If the user asks something completely unrelated to CICR or tech, still try to help but gently guide them back to CICR topics.
- Use markdown formatting for clarity (bold, lists, etc.) but keep it readable.
- Never refuse to answer. Always provide value.

${contextParts}

Remember: You are the BEST assistant. Help with EVERYTHING. Provide links for EVERYTHING navigable. Be the one-stop solution.`;

        const ai = await geminiGenerate(`${systemPrompt}\n\nUser Question: ${trimmed}`);

        if (!ai.ok) {
            // Fallback response with navigation
            const navigationLinks = matchedRoutes.slice(0, 3).map(r => ({
                label: r.label,
                path: r.path,
                description: r.description,
            }));

            return res.json({
                answer: `I'm having trouble connecting to my AI engine right now, but I can still help! ${
                    navigationLinks.length > 0
                        ? `Based on your question, you might want to check: ${navigationLinks.map(n => n.label).join(', ')}.`
                        : `CICR has ${society.memberCount} members and ${society.projectCount} active projects.`
                }`,
                navigation: navigationLinks,
                actions: matchedActions.slice(0, 3),
                society,
                member: memberInsights,
            });
        }

        const answer = ai.text || 'No response generated.';

        // Extract navigation suggestions from the AI response
        const linkMatches = answer.match(/\[\[LINK:([^\]]+)\]\]/g) || [];
        const actionMatches = answer.match(/\[\[ACTION:([^\]]+)\]\]/g) || [];

        const suggestedLinks = linkMatches.map(m => {
            const inner = m.replace('[[LINK:', '').replace(']]', '');
            const [path, label] = inner.split('|');
            return { path: path.trim(), label: (label || path).trim() };
        });

        const suggestedActions = actionMatches.map(m => {
            const inner = m.replace('[[ACTION:', '').replace(']]', '');
            const [path, label] = inner.split('|');
            return { navigateTo: path.trim(), action: (label || path).trim() };
        });

        // Clean the answer of link/action tags for display
        const cleanAnswer = answer
            .replace(/\[\[LINK:([^|]+)\|([^\]]+)\]\]/g, '**$2**')
            .replace(/\[\[ACTION:([^|]+)\|([^\]]+)\]\]/g, '🚀 **$2**');

        return res.json({
            answer: cleanAnswer,
            navigation: suggestedLinks.length > 0 ? suggestedLinks : matchedRoutes.slice(0, 3).map(r => ({ label: r.label, path: r.path })),
            actions: suggestedActions.length > 0 ? suggestedActions : matchedActions.slice(0, 3),
            society,
            member: memberInsights,
        });
    } catch (err) {
        console.error('askCicrAssistant error:', err);
        return res.status(500).json({ message: 'Server error while handling assistant query' });
    }
};

module.exports = { summarizePage, askCicrAssistant };
