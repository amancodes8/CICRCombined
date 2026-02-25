import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';

// Pages
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import ProjectDetails from './pages/ProjectDetails';
import Meetings from './pages/Meetings';
import ScheduleMeeting from './pages/ScheduleMeeting';
import AdminPanel from './pages/AdminPanel';
import CreateProject from './pages/CreateProject';
import Community from './pages/Community';
import Profile from './pages/Profile'; // Import the new Profile page
import PublicProfile from './pages/PublicProfile';
import VerifyEmail from './pages/VerifyEmail';
import Guidelines from './pages/Guidelines';
import Communication from './pages/Communication';

// Inventory Pages
import Inventory from './pages/Inventory'; 
import AddComponent from './pages/AddComponent';
import InventoryDetail from './pages/InventoryDetail';
import MyInventory from './pages/MyInventory';

// Middleware: Prevent access if not logged in
const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  if (!token) return <Navigate to="/login" replace />;
  return children;
};

// Middleware: Prevent access if not Admin/Head
const AdminRoute = ({ children }) => {
  const profile = JSON.parse(localStorage.getItem('profile') || '{}');
  const user = profile.result || profile; 
  const isAdmin = user.role?.toLowerCase() === 'admin' || user.role?.toLowerCase() === 'head';
  
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return children;
};

function App() {
  return (
    <Router>
      <Routes>
        {/* Public Route */}
        <Route path="/login" element={<Auth />} />
        <Route path="/verify-email/:token" element={<VerifyEmail />} />
        <Route path="/profile/:collegeId" element={<PublicProfile />} />

        {/* Protected Application Routes */}
        <Route 
          path="/*" 
          element={
            <ProtectedRoute>
              <Layout>
                <Routes>
                  {/* Main Dashboard & Profile */}
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/profile" element={<Profile />} />
                  
                  {/* Project Management */}
                  <Route path="/projects" element={<Projects />} />
                  <Route path="/projects/:id" element={<ProjectDetails />} />
                  <Route path="/create-project" element={<CreateProject />} />
                  
                  {/* Meetings & Collaboration */}
                  <Route path="/meetings" element={<Meetings />} />
                  <Route path="/schedule" element={<ScheduleMeeting />} />
                  
                  {/* Community & AI Tools */}
                  <Route path="/community" element={<Community />} />
                  <Route path="/communication" element={<Communication />} />
                  <Route path="/ai" element={<Navigate to="/communication" replace />} />
                  <Route path="/guidelines" element={<Guidelines />} />
                  
                  {/* Inventory Management System */}
                  <Route path="/inventory" element={<Inventory />} />
                  <Route path="/inventory/add" element={<AddComponent />} />
                  <Route path="/inventory/my-items" element={<MyInventory />} />
                  <Route path="/inventory/:id" element={<InventoryDetail />} />
                  
                  {/* Admin Specific Control Panel */}
                  <Route 
                    path="/admin" 
                    element={
                      <AdminRoute>
                        <AdminPanel />
                      </AdminRoute>
                    } 
                  />

                  {/* Fallback to Dashboard */}
                  <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>
              </Layout>
            </ProtectedRoute>
          } 
        />
      </Routes>
    </Router>
  );
}

export default App;
