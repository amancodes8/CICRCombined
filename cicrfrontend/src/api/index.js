import axios from 'axios';


const API = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'https://cicrcombined.onrender.com/api',

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

// Fetches the logged-in user's own data
export const getMe = () => API.get('/auth/me');

// Updates personal details (Year, Phone, Branch, Batch)
export const updateProfile = (data) => API.put('/auth/profile', data);
export const fetchMyInsights = () => API.get('/users/insights/me');
export const fetchMemberInsights = (identifier) => API.get(`/users/insights/member/${encodeURIComponent(identifier)}`);
export const acknowledgeWarnings = () => API.post('/users/warnings/ack');


// User Management
export const fetchMembers = () => API.get('/admin/users'); 
export const updateUserByAdmin = (id, data) => API.put(`/admin/users/${id}`, data);
export const deleteUser = (id) => API.delete(`/admin/users/${id}`);

// Invitation System
export const generateInvite = () => API.post('/admin/invite');
export const sendInviteEmail = (data) => API.post('/admin/send-invite', data);

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
export const askCicrAssistant = (payload) => API.post('/chatbot/query', payload);

export default API;
