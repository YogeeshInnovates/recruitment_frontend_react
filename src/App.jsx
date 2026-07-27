import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect, createContext } from 'react';
import Layout from './components/Layout';
import OrganizationSetup from './components/OrganizationSetup';
import Dashboard from './components/Dashboard';
import JobPostList from './components/JobPostList';
import JobPostForm from './components/JobPostForm';
import JobPostDetail from './components/JobPostDetail';
import CandidateList from './components/CandidateList';
import CandidateForm from './components/CandidateForm';
import CandidateDetail from './components/CandidateDetail';
import ApplicationList from './components/ApplicationList';
import ApplicationDetail from './components/ApplicationDetail';
import InterviewSetup from './components/InterviewSetup';
import AiAgentInterview from './components/AiAgentInterview';
import InterviewResults from './components/InterviewResults';

export const OrgContext = createContext(null);

function App() {
  const [org, setOrg] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedOrg = localStorage.getItem('recruit_org');
    if (savedOrg) {
      setOrg(JSON.parse(savedOrg));
    }
    setLoading(false);
  }, []);

  const setOrganization = (orgData) => {
    localStorage.setItem('recruit_org', JSON.stringify(orgData));
    setOrg(orgData);
  };

  const clearOrganization = () => {
    localStorage.removeItem('recruit_org');
    setOrg(null);
  };

  if (loading) {
    return <div className="loading"><div className="spinner-sm"></div></div>;
  }

  return (
    <OrgContext.Provider value={{ org, setOrganization, clearOrganization }}>
      <BrowserRouter>
        <Routes>
          {!org ? (
            <>
              <Route path="*" element={<OrganizationSetup />} />
            </>
          ) : (
            <>
              <Route path="/" element={<Layout />}>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="jobs" element={<JobPostList />} />
                <Route path="jobs/new" element={<JobPostForm />} />
                <Route path="jobs/:id" element={<JobPostDetail />} />
                <Route path="jobs/:id/edit" element={<JobPostForm />} />
                <Route path="candidates" element={<CandidateList />} />
                <Route path="candidates/new" element={<CandidateForm />} />
                <Route path="candidates/:id" element={<CandidateDetail />} />
                <Route path="applications" element={<ApplicationList />} />
                <Route path="applications/:id" element={<ApplicationDetail />} />
                <Route path="interview/setup/:applicationId" element={<InterviewSetup />} />
              </Route>
              <Route path="interview/agent/:applicationId" element={<AiAgentInterview />} />
              <Route path="interview/results/:interviewId" element={<InterviewResults />} />
            </>
          )}
        </Routes>
      </BrowserRouter>
    </OrgContext.Provider>
  );
}

export default App;
