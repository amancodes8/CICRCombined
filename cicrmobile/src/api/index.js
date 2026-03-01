/**
 * CICR Mobile API layer – mirrors cicrfrontend/src/api/index.js
 * Uses the same backend endpoints with token-based auth.
 */
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const BASE_URL = 'https://cicrcombined.onrender.com/api';

const API = axios.create({
  baseURL: BASE_URL,
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
});

// Auth interceptor – inject Bearer token
API.interceptors.request.use(async (config) => {
  try {
    const token = await SecureStore.getItemAsync('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch {
    // SecureStore may fail in some environments; silently continue
  }
  return config;
});

// ── Auth ──────────────────────────────────────────────────
export const login = (formData) => API.post('/auth/login', formData);
export const register = (formData) => API.post('/auth/register', formData);
export const sendPasswordResetOtp = (payload) => API.post('/auth/password/send-otp', payload);
export const resetPasswordWithOtp = (payload) => API.post('/auth/password/reset-with-otp', payload);
export const resetPasswordWithCode = (payload) => API.post('/auth/password/reset-with-code', payload);
export const changePassword = (payload) => API.put('/auth/password/change', payload);
export const getMe = () => API.get('/auth/me');
export const updateProfile = (data) => API.put('/auth/profile', data);

// ── Users & Directory ─────────────────────────────────────
export const fetchDirectoryMembers = () => API.get('/users/directory');
export const fetchMyInsights = () => API.get('/users/insights/me');
export const fetchPublicProfile = (collegeId) => API.get(`/users/public/${collegeId}`);

// ── Projects ──────────────────────────────────────────────
export const fetchProjects = (params) => API.get('/projects', { params });
export const fetchProjectById = (id) => API.get(`/projects/${id}`);
export const createProject = (data) => API.post('/projects', data);

// ── Community ─────────────────────────────────────────────
export const fetchPosts = () => API.get('/community/posts');
export const createPost = (data) => API.post('/community/posts', data);
export const likePost = (id) => API.post(`/community/posts/${id}/like`);
export const deletePost = (id) => API.delete(`/community/posts/${id}`);

// ── Meetings ──────────────────────────────────────────────
export const fetchMeetings = () => API.get('/meetings');
export const scheduleMeeting = (data) => API.post('/meetings', data);
export const deleteMeeting = (id) => API.delete(`/meetings/${id}`);

// ── Events ────────────────────────────────────────────────
export const fetchEvents = (params) => API.get('/events', { params });
export const fetchEventById = (id) => API.get(`/events/${id}`);

// ── Inventory ─────────────────────────────────────────────
export const fetchInventory = () => API.get('/inventory');

// ── Learning Hub ──────────────────────────────────────────
export const fetchLearningOverview = () => API.get('/learning/overview');
export const fetchLearningTracks = (params) => API.get('/learning/tracks', { params });

// ── Programs Hub ──────────────────────────────────────────
export const fetchProgramOverview = () => API.get('/programs/overview');

// ── Notifications ─────────────────────────────────────────
export const fetchNotifications = (params) => API.get('/notifications', { params });
export const markNotificationRead = (id) => API.post(`/notifications/${id}/read`);
export const markAllNotificationsRead = () => API.post('/notifications/read-all');

// ── Hierarchy Tasks ───────────────────────────────────────
export const fetchHierarchyTasks = (params) => API.get('/hierarchy/tasks', { params });

export default API;
