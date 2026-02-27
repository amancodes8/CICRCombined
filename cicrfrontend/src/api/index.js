import axios from 'axios';


const API = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'https://cicrcombined.onrender.com/api',
  timeout: 20000,

  headers: {
    'Content-Type': 'application/json',
  },
});

let backendPrewarmed = false;

export const prewarmBackend = () => {
  // Browser prewarm intentionally disabled to avoid cross-site CORP/NotSameSite console errors.
  if (backendPrewarmed) return;
  backendPrewarmed = true;
};

API.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Auth
export const login = (formData) => API.post('/auth/login', formData);
export const register = (formData) => API.post('/auth/register', formData);
export const verifyEmail = (token) => API.get(`/auth/verifyemail/${token}`);
export const sendPasswordResetOtp = (payload) => API.post('/auth/password/send-otp', payload);
export const resetPasswordWithOtp = (payload) => API.post('/auth/password/reset-with-otp', payload);
export const resetPasswordWithCode = (payload) => API.post('/auth/password/reset-with-code', payload);
export const changePassword = (payload) => API.put('/auth/password/change', payload);

// Fetches the logged-in user's own data
export const getMe = () => API.get('/auth/me');

// Updates personal details (Year, Phone, Branch, Batch)
export const updateProfile = (data) => API.put('/auth/profile', data);
export const fetchDirectoryMembers = () => API.get('/users/directory');
export const fetchMyInsights = () => API.get('/users/insights/me');
export const fetchMemberInsights = (identifier) => API.get(`/users/insights/member/${encodeURIComponent(identifier)}`);
export const fetchPublicProfile = (collegeId) => API.get(`/users/public/${encodeURIComponent(collegeId)}`);
export const acknowledgeWarnings = () => API.post('/users/warnings/ack');


// User Management
export const fetchMembers = () => API.get('/admin/users'); 
export const updateUserByAdmin = (id, data) => API.put(`/admin/users/${id}`, data);
export const deleteUser = (id) => API.delete(`/admin/users/${id}`);
export const fetchPendingAdminActions = () => API.get('/admin/actions/pending');
export const approveAdminAction = (actionId) => API.post(`/admin/actions/${actionId}/approve`);
export const fetchAuditLogs = (params = {}) => {
  const query = new URLSearchParams(params);
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return API.get(`/admin/audit/logs${suffix}`);
};

// Invitation System
export const generateInvite = (data = {}) => API.post('/admin/invite', data);
export const sendInviteEmail = (data) => API.post('/admin/send-invite', data);
export const generatePasswordResetCode = (id) => API.post(`/admin/users/${id}/password-reset-code`);

// Project management
export const fetchProjects = (params = {}) => {
  const query = new URLSearchParams(params);
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return API.get(`/projects${suffix}`);
};
export const fetchProjectById = (id) => API.get(`/projects/${id}`);
export const createProject = (data) => API.post('/projects', data);
export const addProjectSuggestion = (id, text) => API.post(`/projects/${id}/suggestions`, { text });
export const addProjectUpdate = (id, payload) => API.post(`/projects/${id}/updates`, payload);
export const updateProjectDetails = (id, payload) => API.patch(`/projects/${id}/details`, payload);
export const updateProjectProgress = (id, payload) => API.patch(`/projects/${id}/progress`, payload);
export const updateProjectStatus = (id, payload) => API.patch(`/projects/${id}/status`, payload);
export const updateProjectTeam = (id, payload) => API.patch(`/projects/${id}/team`, payload);
export const deleteProject = (id) => API.delete(`/projects/${id}`);

// community
export const fetchPosts = () => API.get('/community/posts');
export const createPost = (data) => API.post('/community/posts', data);
export const likePost = (id) => API.post(`/community/posts/${id}/like`);
export const deletePost = (id) => API.delete(`/community/posts/${id}`);
export const warnPostUser = async (id, reason) => {
  const payload = { reason };
  try {
    return await API.post(`/community/posts/${id}/warn`, payload);
  } catch (err) {
    // If backend responded with a meaningful app-level error, don't fallback.
    if (err.response?.data?.message) {
      throw err;
    }
    try {
      return await API.post(`/community/warn/${id}`, payload);
    } catch (err2) {
      if (err2.response?.data?.message) {
        throw err2;
      }
      return await API.post(`/community/posts/warn/${id}`, payload);
    }
  }
};


   //MEETINGS & EVENTS
export const fetchMeetings = () => API.get('/meetings');
export const scheduleMeeting = (data) => API.post('/meetings', data);
export const deleteMeeting = (id) => API.delete(`/meetings/${id}`);

   //INVENTORY SYSTEM
export const fetchInventory = () => API.get('/inventory');
export const addInventoryItem = (data) => API.post('/inventory/add', data);
export const issueInventoryItem = (data) => API.post('/inventory/issue', data);
export const adjustInventoryStock = (data) => API.post('/inventory/adjust', data);
export const adjustInventoryStockById = (id, data) => API.post(`/inventory/${id}/adjust`, data);
export const updateInventoryItem = (id, data) => API.put(`/inventory/${id}`, data);
export const deleteInventoryItem = (id) => API.delete(`/inventory/${id}`);


  //  AI TOOLS
export const summarize = (data) => API.post('/chatbot/summarize', data);
export const askCicrAssistant = async (payload) => {
  const question = String(payload?.question || '').trim();
  const conversationId = 'admin-stream';
  try {
    return await API.post('/chatbot/query', payload);
  } catch (err) {
    try {
      return await API.post('/chatbot/ask', payload);
    } catch (err2) {
      try {
        return await API.post('/chatbot/assistant/query', payload);
      } catch (err3) {
        // Compatibility fallback: if chatbot routes are missing, proxy via communication AI mention.
        const all404 = [err, err2, err3].every((e) => e?.response?.status === 404);
        if (!all404 || !question) {
          throw err3;
        }

        const startTime = Date.now();
        await API.post('/communication/messages', { text: `@cicrai ${question}`, conversationId });

        const timeoutMs = 15000;
        const intervalMs = 1200;
        while (Date.now() - startTime < timeoutMs) {
          await new Promise((resolve) => setTimeout(resolve, intervalMs));
          const params = new URLSearchParams({
            limit: '60',
            conversationId,
          });
          const { data } = await API.get(`/communication/messages?${params.toString()}`);
          const rows = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
          const aiMessage = [...rows]
            .reverse()
            .find((m) => {
              const isAI =
                String(m?.sender?.collegeId || '').toLowerCase() === 'cicrai' ||
                m?.sender?.isAI === true ||
                String(m?.sender?.name || '').toLowerCase().includes('cicr ai');
              return isAI && new Date(m.createdAt).getTime() >= startTime - 1500;
            });

          if (aiMessage?.text) {
            const cleaned = String(aiMessage.text).replace(/^@cicrai\s*/i, '').trim();
            return { data: { answer: cleaned || aiMessage.text } };
          }
        }

        return {
          data: {
            answer:
              'Assistant request timed out. Chatbot routes are unavailable on backend and communication AI did not respond in time.',
          },
        };
      }
    }
  }
};

// Communication stream
export const fetchCommunicationMessages = (options = 100) => {
  const normalized =
    typeof options === 'number'
      ? { limit: options }
      : options && typeof options === 'object'
      ? options
      : {};

  const limitRaw = Number(normalized.limit ?? 100);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(200, limitRaw)) : 100;
  const query = new URLSearchParams({ limit: String(limit) });

  if (normalized.before) query.set('before', String(normalized.before));
  if (normalized.conversationId) query.set('conversationId', String(normalized.conversationId));

  return API.get(`/communication/messages?${query.toString()}`);
};
export const createCommunicationMessage = (payload) => API.post('/communication/messages', payload);
export const deleteCommunicationMessage = async (id) => {
  const attempts = [
    () => API.post('/communication/messages', { action: 'delete', id }),
    () => API.delete(`/communication/messages/${id}`),
    () => API.post(`/communication/messages/${id}/delete`),
    () => API.post(`/communication/delete/${id}`),
    () => API.delete(`/communication/${id}`),
    () => API.post(`/communication/${id}/remove`),
  ];

  let lastErr;
  for (const attempt of attempts) {
    try {
      return await attempt();
    } catch (err) {
      lastErr = err;
      const status = err?.response?.status;
      const message = String(err?.response?.data?.message || '').toLowerCase();
      const isCompat400 = status === 400 && message.includes('message text is required');
      if (status !== 404 && !isCompat400) {
        throw err;
      }
    }
  }

  // idempotent client fallback: treat pure-404 chain as already removed
  if (lastErr?.response?.status === 404) {
    return { data: { success: true, _id: id, alreadyDeleted: true } };
  }

  throw lastErr;
};
export const fetchMentionCandidates = (q = '') => API.get(`/communication/mentions?q=${encodeURIComponent(q)}`);
export const createCommunicationStream = (conversationId = 'admin-stream') => {
  const base = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api').replace(/\/+$/, '');
  const token = localStorage.getItem('token');
  const params = new URLSearchParams();
  if (token) params.set('token', token);
  if (conversationId) params.set('conversationId', conversationId);
  const query = params.toString();
  return new EventSource(`${base}/communication/stream${query ? `?${query}` : ''}`);
};

// Issue tickets
export const createIssueTicket = (payload) => API.post('/issues', payload);
export const fetchMyIssues = () => API.get('/issues/mine');
export const fetchAdminIssues = (status = '') =>
  API.get(`/issues${status ? `?status=${encodeURIComponent(status)}` : ''}`);
export const updateIssueTicket = (id, payload) => API.patch(`/issues/${id}`, payload);

// Notifications
export const fetchNotifications = (params = {}) => {
  const query = new URLSearchParams(params);
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return API.get(`/notifications${suffix}`);
};
export const markNotificationRead = (id) => API.post(`/notifications/${id}/read`);
export const markAllNotificationsRead = () => API.post('/notifications/read-all');
export const broadcastNotification = (payload) => API.post('/notifications/broadcast', payload);

// Hierarchy tasks
export const fetchHierarchyTasks = (params = {}) => {
  const query = new URLSearchParams(params);
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return API.get(`/hierarchy/tasks${suffix}`);
};
export const createHierarchyTask = (payload) => API.post('/hierarchy/tasks', payload);
export const updateHierarchyTask = (id, payload) => API.patch(`/hierarchy/tasks/${id}`, payload);
export const deleteHierarchyTask = (id) => API.delete(`/hierarchy/tasks/${id}`);

// Events
export const fetchEvents = (params = {}) => {
  const query = new URLSearchParams(params);
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return API.get(`/events${suffix}`);
};
export const fetchEventById = (id) => API.get(`/events/${id}`);
export const createEvent = (payload) => API.post('/events', payload);
export const updateEvent = (id, payload) => API.put(`/events/${id}`, payload);
export const deleteEvent = (id) => API.delete(`/events/${id}`);

// Recruitment applications
export const createApplication = (payload) => API.post('/applications', payload);
export const fetchApplications = (params = {}) => {
  const query = new URLSearchParams(params);
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return API.get(`/applications${suffix}`);
};
export const updateApplication = (id, payload) => API.patch(`/applications/${id}`, payload);
export const sendApplicationInvite = (id) => API.post(`/applications/${id}/send-invite`);

// Learning Hub
export const fetchLearningOverview = () => API.get('/learning/overview');
export const fetchLearningConfig = () => API.get('/learning/config');
export const updateLearningConfig = (payload) => API.put('/learning/config', payload);
export const fetchLearningTracks = (params = {}) => {
  const query = new URLSearchParams(params);
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return API.get(`/learning/tracks${suffix}`);
};
export const fetchLearningTrackById = (id) => API.get(`/learning/tracks/${id}`);
export const createLearningTrack = (payload) => API.post('/learning/tracks', payload);
export const updateLearningTrack = (id, payload) => API.put(`/learning/tracks/${id}`, payload);
export const setLearningTrackPublish = (id, payload) => API.patch(`/learning/tracks/${id}/publish`, payload);
export const setLearningTrackArchive = (id, payload) => API.patch(`/learning/tracks/${id}/archive`, payload);
export const submitLearningTask = (trackId, payload) =>
  API.post(`/learning/tracks/${trackId}/submissions`, payload);
export const fetchMyLearningSubmissions = () => API.get('/learning/submissions/mine');
export const fetchLearningSubmissions = (params = {}) => {
  const query = new URLSearchParams(params);
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return API.get(`/learning/submissions${suffix}`);
};
export const reviewLearningSubmission = (id, payload) =>
  API.patch(`/learning/submissions/${id}/review`, payload);

// Member programs
export const fetchProgramOverview = () => API.get('/programs/overview');
export const fetchProgramConfig = () => API.get('/programs/config');
export const updateProgramConfig = (payload) => API.put('/programs/config', payload);

export const fetchProgramQuests = (params = {}) => {
  const query = new URLSearchParams(params);
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return API.get(`/programs/quests${suffix}`);
};
export const createProgramQuest = (payload) => API.post('/programs/quests', payload);
export const updateProgramQuest = (id, payload) => API.patch(`/programs/quests/${id}`, payload);
export const submitProgramQuest = (id, payload) => API.post(`/programs/quests/${id}/submit`, payload);
export const fetchMyProgramQuestSubmissions = () => API.get('/programs/quests/submissions/mine');
export const fetchProgramQuestSubmissions = (params = {}) => {
  const query = new URLSearchParams(params);
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return API.get(`/programs/quests/submissions${suffix}`);
};
export const reviewProgramQuestSubmission = (id, payload) =>
  API.patch(`/programs/quests/submissions/${id}/review`, payload);

export const fetchMentorRequests = (params = {}) => {
  const query = new URLSearchParams(params);
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return API.get(`/programs/mentor-requests${suffix}`);
};
export const createMentorRequest = (payload) => API.post('/programs/mentor-requests', payload);
export const updateMentorRequest = (id, payload) => API.patch(`/programs/mentor-requests/${id}`, payload);

export const fetchBadgeRules = () => API.get('/programs/badges/rules');
export const createBadgeRule = (payload) => API.post('/programs/badges/rules', payload);
export const updateBadgeRule = (id, payload) => API.patch(`/programs/badges/rules/${id}`, payload);
export const fetchBadgeOverview = () => API.get('/programs/badges/overview');

export const fetchProgramIdeas = (params = {}) => {
  const query = new URLSearchParams(params);
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return API.get(`/programs/ideas${suffix}`);
};
export const createProgramIdea = (payload) => API.post('/programs/ideas', payload);
export const updateProgramIdea = (id, payload) => API.patch(`/programs/ideas/${id}`, payload);
export const toggleProgramIdeaJoin = (id) => API.post(`/programs/ideas/${id}/join`);
export const convertProgramIdea = (id, payload) => API.post(`/programs/ideas/${id}/convert`, payload);

export const fetchOfficeHourSlots = (params = {}) => {
  const query = new URLSearchParams(params);
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return API.get(`/programs/office-hours/slots${suffix}`);
};
export const createOfficeHourSlot = (payload) => API.post('/programs/office-hours/slots', payload);
export const updateOfficeHourSlot = (id, payload) => API.patch(`/programs/office-hours/slots/${id}`, payload);
export const bookOfficeHourSlot = (id, payload) => API.post(`/programs/office-hours/slots/${id}/book`, payload);
export const fetchMyOfficeHourBookings = () => API.get('/programs/office-hours/bookings/mine');
export const updateOfficeHourBooking = (id, payload) => API.patch(`/programs/office-hours/bookings/${id}`, payload);

export default API;
