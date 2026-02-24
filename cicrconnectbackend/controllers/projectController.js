const Project = require('../models/Project');
const User = require('../models/User');

/**
 * @desc    Create a new project
 * @route   POST /api/projects
 * @access  Private (Heads, Admins)
 */
const createProject = async (req, res) => {
    const { title, description, domain, team, lead } = req.body;

    try {
        const project = new Project({
            title,
            description,
            domain,
            team,
            lead: lead || req.user.id, // If no lead specified, creator is lead
        });

        const createdProject = await project.save();
        res.status(201).json(createdProject);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

/**
 * @desc    Get all projects
 * @route   GET /api/projects
 * @access  Private
 */
const getAllProjects = async (req, res) => {
    try {
        const projects = await Project.find({})
            .populate('lead', 'name email')
            .populate('team', 'name email');
        res.json(projects);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

/**
 * @desc    Get a single project by ID
 * @route   GET /api/projects/:id
 * @access  Private
 */
const getProjectById = async (req, res) => {
    try {
        const project = await Project.findById(req.params.id)
            .populate('lead', 'name email')
            .populate('team', 'name email')
            .populate('suggestions.author', 'name role');

        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }
        res.json(project);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

/**
 * @desc    Add a suggestion to a project
 * @route   POST /api/projects/:id/suggestions
 * @access  Private (Alumni, Heads, Admins)
 */
const addSuggestion = async (req, res) => {
    const { text } = req.body;

    try {
        const project = await Project.findById(req.params.id);
        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }

        const newSuggestion = {
            text,
            author: req.user.id,
        };

        project.suggestions.unshift(newSuggestion);
        await project.save();
        res.status(201).json(project.suggestions);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

module.exports = {
    createProject,
    getAllProjects,
    getProjectById,
    addSuggestion,
};
