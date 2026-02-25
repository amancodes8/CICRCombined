import axios from 'axios';


const API = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'https://cicrcombined.onrender.com/api',
  timeout: 20000,

  headers: {
    'Content-Type': 'application/json',
  },
});

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

// Invitation System
export const generateInvite = () => API.post('/admin/invite');
export const sendInviteEmail = (data) => API.post('/admin/send-invite', data);
export const generatePasswordResetCode = (id) => API.post(`/admin/users/${id}/password-reset-code`);

// Project management
export const fetchProjects = () => API.get('/projects');
export const fetchProjectById = (id) => API.get(`/projects/${id}`);
export const createProject = (data) => API.post('/projects', data);
export const addProjectSuggestion = (id, text) => API.post(`/projects/${id}/suggestions`, { text });

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
        await API.post('/communication/messages', { text: `@cicrai ${question}` });

        const timeoutMs = 15000;
        const intervalMs = 1200;
        while (Date.now() - startTime < timeoutMs) {
          await new Promise((resolve) => setTimeout(resolve, intervalMs));
          const { data } = await API.get('/communication/messages?limit=60');
          const rows = Array.isArray(data) ? data : [];
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
export const fetchCommunicationMessages = (limit = 100) => API.get(`/communication/messages?limit=${limit}`);
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
export const createCommunicationStream = () => {
  const base = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api').replace(/\/+$/, '');
  const token = localStorage.getItem('token');
  const query = token ? `?token=${encodeURIComponent(token)}` : '';
  return new EventSource(`${base}/communication/stream${query}`);
};

// Issue tickets
export const createIssueTicket = (payload) => API.post('/issues', payload);
export const fetchMyIssues = () => API.get('/issues/mine');
export const fetchAdminIssues = (status = '') =>
  API.get(`/issues${status ? `?status=${encodeURIComponent(status)}` : ''}`);
export const updateIssueTicket = (id, payload) => API.patch(`/issues/${id}`, payload);

// Events
export const fetchEvents = (params = {}) => {
  const query = new URLSearchParams(params);
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return API.get(`/events${suffix}`);
};
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

export default API;
