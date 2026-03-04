const Project = require('../models/Project');
const Meeting = require('../models/Meeting');
const User = require('../models/User');
const Post = require('../models/Post');
const Event = require('../models/Event');
const mongoose = require('mongoose');
const { buildUserInsights } = require('../utils/userInsights');
const { geminiGenerate } = require('../utils/geminiClient');
const { normalizeEmail, normalizeCollegeId } = require('../utils/fieldCrypto');

/* ─── Response cache (in-memory, keyed by normalised question) ─── */
const CACHE = new Map();
const CACHE_TTL = 15 * 60 * 1000;   // 15 minutes
const CACHE_MAX = 500;

const normaliseKey = (text) => text.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();

const cacheGet = (key) => {
  const entry = CACHE.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL) { CACHE.delete(key); return null; }
  return entry.data;
};

const cacheSet = (key, data) => {
  if (CACHE.size >= CACHE_MAX) {
    const oldest = CACHE.keys().next().value;
    CACHE.delete(oldest);
  }
  CACHE.set(key, { data, ts: Date.now() });
};

/* ─── Simple per-user rate limiter ─── */
const RATE = new Map();
const RATE_WINDOW = 60_000;  // 1 minute
const RATE_LIMIT = 12;        // max 12 questions per minute

const checkRate = (userId) => {
  const now = Date.now();
  const entry = RATE.get(userId) || { count: 0, reset: now + RATE_WINDOW };
  if (now > entry.reset) { entry.count = 0; entry.reset = now + RATE_WINDOW; }
  entry.count++;
  RATE.set(userId, entry);
  return entry.count <= RATE_LIMIT;
};

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

        /* ─── Rate limit ─── */
        if (!checkRate(req.user.id)) {
            return res.status(429).json({ message: 'Too many requests. Please wait a moment before asking again.' });
        }

        /* ─── Cache check ─── */
        const cacheKey = normaliseKey(trimmed);
        const cached = cacheGet(cacheKey);
        if (cached) {
            return res.json(cached);
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
            `CICR (Centre for Innovation in Computing and Robotics) Connect is a comprehensive society management platform for the CICR technical society at Chandigarh University.`,
            `\n=== ABOUT CICR ===`,
            `CICR is a premier technical society at Chandigarh University focused on computing, robotics, IoT, and emerging tech.`,
            `It organises hackathons, coding contests, robotics workshops, speaker sessions, and collaborative projects.`,
            `Members work across domains: Web Development, AI/ML, IoT, Robotics, App Development, Cybersecurity, Cloud Computing, Blockchain, and more.`,
            `The society has a structured hierarchy: Head → Admin → Senior Members → Members. New members join through an application process.`,
            `CICR Connect is the custom-built platform that manages everything: projects, meetings, events, learning, mentorship, inventory, community feed, programs (quests, badges, contests, ideas), and admin tools.`,
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
            const navigationLinks = matchedRoutes.slice(0, 3).map(r => ({
                label: r.label,
                path: r.path,
                description: r.description,
            }));

            const fallback = {
                answer: memberInsights
                    ? `${memberInsights.member.name} (${memberInsights.member.collegeId}) is a ${memberInsights.member.role} member with ${memberInsights.metrics.totalProjectContributions} project contributions.`
                    : `CICR has ${society.memberCount} members, ${society.projectCount} projects, ${society.meetingCount} meetings. Ask me anything!`,
                navigation: navigationLinks,
                actions: matchedActions.slice(0, 3),
                society,
                member: memberInsights,
            };
            cacheSet(cacheKey, fallback);
            return res.json(fallback);
        }

        const systemPrompt = `You are the CICR Connect Assistant — an AI built exclusively for the CICR Connect platform at Chandigarh University.

STRICT SCOPE — CRITICAL:
- You ONLY answer questions related to CICR, CICR Connect platform, its features, pages, members, projects, events, meetings, tech domains, society activities, and how to use the platform.
- If the user asks about politics, news, entertainment, sports, general knowledge, other colleges, other companies, coding problems, or ANYTHING not related to CICR or the CICR Connect platform: politely decline and redirect them.
  Example response for off-topic: "I'm the CICR Connect assistant and I can only help with CICR-related questions! 😊 Ask me about our projects, events, features, or how to navigate the platform."
- NEVER answer general knowledge, trivia, opinions, advice unrelated to CICR, or act as a general-purpose AI.
- You may help with CICR-related tech questions (e.g., "what domains does CICR work in?", "how do I submit a project?") but NOT general coding tutoring.

PERSONALITY:
- Friendly, energetic, concise. You love CICR.
- Vary your language — never repeat the same phrasing.
- Use short paragraphs, bullet points where helpful.
- Keep answers 2-5 sentences for simple questions.

NAVIGATION RULES:
When mentioning a page/feature, include navigation tags:
  [[LINK:/path|Label Text]]     — for pages
  [[ACTION:/path|Action Label]] — for actions
Examples:
  Check out [[LINK:/projects|Projects]] for all society work.
  [[ACTION:/create-project|Create a new project]] to get started.

ANSWER QUALITY:
1. Use real data from context when available — project names, member counts, dates.
2. Structure longer answers with bullets or numbered steps.
3. Bold key terms with **term**.
4. Always provide at least one [[LINK:...]] when the question relates to a feature.
5. NEVER make up data. If you don't know, say so.

${contextParts}

Now answer the user's question. Remember: CICR-related topics ONLY.`;

        const ai = await geminiGenerate(`${systemPrompt}\n\nUser Question: ${trimmed}`);

        if (!ai.ok) {
            const navigationLinks = matchedRoutes.slice(0, 3).map(r => ({
                label: r.label,
                path: r.path,
                description: r.description,
            }));

            const fallback = {
                answer: `I'm having trouble connecting to my AI engine right now, but I can still help! ${
                    navigationLinks.length > 0
                        ? `Based on your question, you might want to check: ${navigationLinks.map(n => n.label).join(', ')}.`
                        : `CICR has ${society.memberCount} members and ${society.projectCount} active projects.`
                }`,
                navigation: navigationLinks,
                actions: matchedActions.slice(0, 3),
                society,
                member: memberInsights,
            };
            return res.json(fallback);
        }

        const answer = ai.text || 'No response generated.';

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

        const cleanAnswer = answer
            .replace(/\[\[LINK:([^|]+)\|([^\]]+)\]\]/g, '**$2**')
            .replace(/\[\[ACTION:([^|]+)\|([^\]]+)\]\]/g, '**$2**');

        const response = {
            answer: cleanAnswer,
            navigation: suggestedLinks.length > 0 ? suggestedLinks : matchedRoutes.slice(0, 3).map(r => ({ label: r.label, path: r.path })),
            actions: suggestedActions.length > 0 ? suggestedActions : matchedActions.slice(0, 3),
            society,
            member: memberInsights,
        };

        /* ─── Cache the result ─── */
        cacheSet(cacheKey, response);

        return res.json(response);
    } catch (err) {
        console.error('askCicrAssistant error:', err);
        return res.status(500).json({ message: 'Server error while handling assistant query' });
    }
};

module.exports = { summarizePage, askCicrAssistant };
