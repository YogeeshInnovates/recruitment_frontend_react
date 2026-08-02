import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useContext } from 'react';
import { AuthProvider, AuthContext } from './context/AuthContext';
import { OrgContext, OrgProvider } from './context/OrgContext';
export { OrgContext };
import WakeUpGate from './components/WakeUpGate';
import Layout from './components/Layout';
import HomePage from './components/HomePage';
import LoginPage from './components/LoginPage';
import SignupPage from './components/SignupPage';
import UserDashboard from './components/UserDashboard';
import Dashboard from './components/Dashboard';
import JobPostList from './components/JobPostList';
import JobPostForm from './components/JobPostForm';
import JobPostDetail from './components/JobPostDetail';
import CandidateList from './components/CandidateList';
import CandidateForm from './components/CandidateForm';
import CandidateDetail from './components/CandidateDetail';
import ApplicationList from './components/ApplicationList';
import ApplicationForm from './components/ApplicationForm';
import ApplicationDetail from './components/ApplicationDetail';
import InterviewLauncher from './components/InterviewLauncher';
import InterviewSetup from './components/InterviewSetup';
import AiAgentInterview from './components/AiAgentInterview';
import InterviewResults from './components/InterviewResults';
import OrganizationSetup from './components/OrganizationSetup';
import TeamPage from './components/TeamPage';

function RequireAuth({ children }) {
  const { user, loading } = useContext(AuthContext);
  if (loading) return <div className="loading"><div className="spinner" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function RecruiterRoute({ children }) {
  const { user, loading, isRecruiter } = useContext(AuthContext);
  if (loading) return <div className="loading"><div className="spinner" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!isRecruiter) return <Navigate to="/user/dashboard" replace />;
  return children;
}

function AppRoutes() {
  const { user, loading, isRecruiter } = useContext(AuthContext);

  if (loading) {
    return <div className="loading" style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="spinner" /></div>;
  }

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={user ? <Navigate to={isRecruiter ? '/dashboard' : '/user/dashboard'} replace /> : <LoginPage />} />
      <Route path="/signup" element={user ? <Navigate to={isRecruiter ? '/dashboard' : '/user/dashboard'} replace /> : <SignupPage />} />
      <Route path="/user/dashboard" element={<RequireAuth><UserDashboard /></RequireAuth>} />

      <Route path="/org/setup" element={<OrganizationSetup />} />
      <Route path="/interview" element={<InterviewLauncher />} />
      <Route path="/interview/setup/demo" element={<InterviewLauncher />} />
      <Route path="/interview/setup/:applicationId" element={<InterviewSetup />} />
      <Route path="/interview/:interviewId" element={<AiAgentInterview />} />
      <Route path="/interview/results/:interviewId" element={<InterviewResults />} />

      <Route element={<RecruiterRoute><Layout /></RecruiterRoute>}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/jobs" element={<JobPostList />} />
        <Route path="/jobs/new" element={<JobPostForm />} />
        <Route path="/jobs/:id" element={<JobPostDetail />} />
        <Route path="/candidates" element={<CandidateList />} />
        <Route path="/candidates/new" element={<CandidateForm />} />
        <Route path="/candidates/:id" element={<CandidateDetail />} />
        <Route path="/applications" element={<ApplicationList />} />
        <Route path="/applications/new" element={<ApplicationForm />} />
        <Route path="/applications/:appId" element={<ApplicationDetail />} />
        <Route path="/team" element={<TeamPage />} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <WakeUpGate>
        <AuthProvider>
          <OrgProvider>
            <AppRoutes />
          </OrgProvider>
        </AuthProvider>
      </WakeUpGate>
    </BrowserRouter>
  );
}

export default App;
