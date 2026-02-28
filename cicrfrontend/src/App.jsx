import { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import GlobalToastHost from './components/GlobalToastHost';

const Auth = lazy(() => import('./pages/Auth'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Projects = lazy(() => import('./pages/Projects'));
const ProjectDetails = lazy(() => import('./pages/ProjectDetails'));
const ProjectReview = lazy(() => import('./pages/ProjectReview'));
const Meetings = lazy(() => import('./pages/Meetings'));
const ScheduleMeeting = lazy(() => import('./pages/ScheduleMeeting'));
const Hierarchy = lazy(() => import('./pages/Hierarchy'));
const AdminPanel = lazy(() => import('./pages/AdminPanel'));
const CreateProject = lazy(() => import('./pages/CreateProject'));
const Community = lazy(() => import('./pages/Community'));
const Profile = lazy(() => import('./pages/Profile'));
const PublicProfile = lazy(() => import('./pages/PublicProfile'));
const LearningHub = lazy(() => import('./pages/LearningHub'));
const ProgramsHub = lazy(() => import('./pages/ProgramsHub'));
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'));
const Guidelines = lazy(() => import('./pages/Guidelines'));
const Communication = lazy(() => import('./pages/Communication'));
const Events = lazy(() => import('./pages/Events'));
const EventDetails = lazy(() => import('./pages/EventDetails'));
const Apply = lazy(() => import('./pages/Apply'));
const Inventory = lazy(() => import('./pages/Inventory'));
const AddComponent = lazy(() => import('./pages/AddComponent'));
const InventoryDetail = lazy(() => import('./pages/InventoryDetail'));
const MyInventory = lazy(() => import('./pages/MyInventory'));

const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  if (!token) return <Navigate to="/login" replace />;
  return children;
};

const AdminRoute = ({ children }) => {
  const profile = JSON.parse(localStorage.getItem('profile') || '{}');
  const user = profile.result || profile;
  const isAdmin = user.role?.toLowerCase() === 'admin' || user.role?.toLowerCase() === 'head';

  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return children;
};

const StrictAdminRoute = ({ children }) => {
  const profile = JSON.parse(localStorage.getItem('profile') || '{}');
  const user = profile.result || profile;
  const isStrictAdmin = user.role?.toLowerCase() === 'admin';

  if (!isStrictAdmin) return <Navigate to="/dashboard" replace />;
  return children;
};

function App() {
  return (
    <Router>
      <GlobalToastHost />
      <Suspense fallback={<RouteLoader />}>
        <Routes>
          <Route path="/login" element={<Auth />} />
          <Route path="/verify-email/:token" element={<VerifyEmail />} />
          <Route path="/profile/:collegeId" element={<PublicProfile />} />
          <Route path="/apply" element={<Apply />} />

          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/profile" element={<Profile />} />

            <Route path="/projects" element={<Projects />} />
            <Route path="/projects/:id" element={<ProjectDetails />} />
            <Route path="/projects/:id/review" element={<ProjectReview />} />
            <Route path="/create-project" element={<CreateProject />} />

            <Route path="/meetings" element={<Meetings />} />
            <Route path="/schedule" element={<ScheduleMeeting />} />
            <Route path="/hierarchy" element={<Hierarchy />} />
            <Route path="/events" element={<Events />} />
            <Route path="/events/:id" element={<EventDetails />} />

            <Route path="/community" element={<Community />} />
            <Route path="/learning" element={<LearningHub />} />
            <Route path="/programs" element={<ProgramsHub />} />
            <Route path="/ai" element={<Navigate to="/communication" replace />} />
            <Route
              path="/communication"
              element={
                <StrictAdminRoute>
                  <Communication />
                </StrictAdminRoute>
              }
            />
            <Route path="/guidelines" element={<Guidelines />} />

            <Route path="/inventory" element={<Inventory />} />
            <Route path="/inventory/add" element={<AddComponent />} />
            <Route path="/inventory/my-items" element={<MyInventory />} />
            <Route path="/inventory/:id" element={<InventoryDetail />} />

            <Route
              path="/admin"
              element={
                <AdminRoute>
                  <AdminPanel />
                </AdminRoute>
              }
            />
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Suspense>
    </Router>
  );
}

export default App;

function RouteLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center mesh-bg">
      <div className="flex flex-col items-center gap-4">
        <div className="relative w-10 h-10">
          <span className="absolute inset-0 rounded-full border-2 border-blue-500/30 animate-ping" />
          <span className="absolute inset-1 rounded-full border-2 border-t-blue-400 border-r-purple-400 border-b-transparent border-l-transparent animate-spin" />
        </div>
        <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-blue-300 font-black">
          Loading Workspace
        </div>
      </div>
    </div>
  );
}
