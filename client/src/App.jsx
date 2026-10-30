import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { BrandProvider } from './contexts/BrandContext';
import { setLogoutHandler } from './lib/api';
import Layout, { homePath } from './components/Layout/Layout.jsx';
import Dashboard     from './pages/Dashboard.jsx';
import Conversations from './pages/Conversations.jsx';
import Simulator     from './pages/Simulator.jsx';
import KnowledgeBase from './pages/KnowledgeBase.jsx';
import Config        from './pages/Config.jsx';
import Labels        from './pages/Labels.jsx';
import Profile       from './pages/Profile.jsx';
import Stats         from './pages/Stats.jsx';
import Login         from './pages/Login.jsx';
import QuickReplies  from './pages/QuickReplies.jsx';
import Templates     from './pages/Templates.jsx';
import Costs         from './pages/Costs.jsx';
import Areas         from './pages/Areas.jsx';
import Users         from './pages/Users.jsx';
import Customers     from './pages/Customers.jsx';
import Campaigns     from './pages/Campaigns.jsx';
import Hub           from './pages/Hub.jsx';
import { AgenteProvider } from './agente/AgenteContext.jsx';
import AgenteSection, { AGENTE_SECTIONS } from './agente/AgenteSection.jsx';

export default function App() {
  return (
    <AuthProvider>
      <BrandProvider>
        <HashRouter>
          <AppRoutes />
        </HashRouter>
      </BrandProvider>
    </AuthProvider>
  );
}

function AppRoutes() {
  const { agent, loading, logout } = useAuth();
  setLogoutHandler(logout);

  if (loading) return null;
  const isAdmin = agent?.role === 'admin';

  return (
    <Routes>
        <Route path="/login" element={agent ? <Navigate to={homePath(agent.role)} replace /> : <Login />} />

        {/* Hub: los admins eligen entre el bot y el Agente (turnos, envíos y pauta de TURNOS-YOGA) */}
        <Route path="/hub" element={!agent ? <Navigate to="/login" replace /> : isAdmin ? <Hub /> : <Navigate to={homePath(agent.role)} replace />} />
        <Route
          path="/agente"
          element={!agent ? <Navigate to="/login" replace /> : isAdmin
            ? <AgenteProvider><Layout area="agente" /></AgenteProvider>
            : <Navigate to={homePath(agent.role)} replace />}
        >
          <Route index element={<Navigate to="/agente/lista" replace />} />
          {AGENTE_SECTIONS.map(s => <Route key={s.path} path={s.path} element={<AgenteSection section={s.path} />} />)}
        </Route>
        {/* Links guardados del panel viejo de TURNOS-YOGA (mismo dominio, yoga.techdi.com.ar) */}
        {AGENTE_SECTIONS.map(s => <Route key={`old-${s.path}`} path={`/${s.path}`} element={<Navigate to={`/agente/${s.path}`} replace />} />)}

        <Route path="/" element={agent ? <Layout /> : <Navigate to="/login" replace />}>
          <Route index element={<Navigate to={homePath(agent?.role)} replace />} />
          <Route path="dashboard"     element={<Dashboard />} />
          <Route path="conversations" element={<Conversations />} />
          <Route path="customers"     element={<Customers />} />
          <Route path="campaigns"     element={<Campaigns />} />
          <Route path="simulator"     element={<Simulator />} />
          <Route path="knowledge"     element={<KnowledgeBase />} />
          <Route path="config"        element={<Config />} />
          <Route path="labels"        element={<Labels />} />
          <Route path="profile"       element={<Profile />} />
          <Route path="stats"         element={<Stats />} />
          <Route path="quick-replies" element={<QuickReplies />} />
          <Route path="templates"     element={<Templates />} />
          <Route path="costs"         element={<Costs />} />
          <Route path="areas"         element={<Areas />} />
          <Route path="users"         element={<Users />} />
        </Route>
      </Routes>
  );
}
