import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { BarChart3, CalendarDays, Download, List, Mail, Megaphone, RefreshCw } from 'lucide-react';
import { useAgente } from './AgenteContext.jsx';
import { fetchTurnos } from './api.js';
import { downloadCSV, matchesQuery } from './utils.js';
import ListView from './components/ListView.jsx';
import CalendarView from './components/CalendarView.jsx';
import PautaView from './components/pauta/PautaView.jsx';
import ReportsView from './components/reports/ReportsView.jsx';
import EnviosView from './components/EnviosView.jsx';
import './agente.css';

// Secciones del Agente (las mismas que el panel de TURNOS-YOGA). `needs`: solo si
// el backend del Agente tiene esa parte prendida (/api/me).
export const AGENTE_SECTIONS = [
  { path: 'lista',      label: 'Turnos',     icon: List },
  { path: 'calendario', label: 'Calendario', icon: CalendarDays },
  { path: 'envios',     label: 'Envíos',     icon: Mail,      needs: 'entradas' },
  { path: 'pauta',      label: 'Pauta',      icon: Megaphone, needs: 'pauta' },
  { path: 'reportes',   label: 'Reportes',   icon: BarChart3, needs: 'pauta' },
];

export default function AgenteSection({ section }) {
  const { token, me, storeKey, switchStore, error, setError, handleError } = useAgente();
  const info = AGENTE_SECTIONS.find((s) => s.path === section);
  const isTurnos = section === 'lista' || section === 'calendario';
  const stores = me?.stores ?? [];
  const currentStore = stores.find((s) => s.key === storeKey);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');

  const load = useCallback(async (fresh = false) => {
    if (!token || !storeKey || !isTurnos) return;
    setLoading(true);
    setError('');
    try {
      setData(await fetchTurnos(token, storeKey, fresh));
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  }, [token, storeKey, isTurnos, setError, handleError]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setData(null); }, [storeKey]);

  // Filtra anotados por búsqueda; si hay búsqueda, oculta horarios sin coincidencias
  const slots = useMemo(() => {
    if (!data) return [];
    if (!query.trim()) return data.slots;
    return data.slots
      .map((s) => ({ ...s, attendees: s.attendees.filter((a) => matchesQuery(a, query.trim())) }))
      .filter((s) => s.attendees.length);
  }, [data, query]);

  if (me && info?.needs && !me[info.needs]) return <Navigate to="/agente/lista" replace />;

  return (
    <div className="agente">
      <header className="page-header">
        <div className="titles">
          <h1>{info?.label ?? 'Agente'}</h1>
          <p className="subtitle">{currentStore?.name || 'Cargando…'}</p>
        </div>
        <div className="actions">
          {isTurnos && (
            <button
              className="btn ghost icon"
              onClick={() => load(true)}
              disabled={loading || !token}
              aria-label="Actualizar"
              title="Traer lo último de Tienda Nube"
            >
              <RefreshCw size={18} className={loading ? 'spin' : ''} />
            </button>
          )}
        </div>
      </header>

      <div className="content">
        {stores.length > 1 && (
          <div className="store-switch">
            {stores.map((s) => (
              <button key={s.key} className={s.key === storeKey ? 'active' : ''} onClick={() => switchStore(s.key)}>
                {s.name}
              </button>
            ))}
          </div>
        )}

        {isTurnos && (
          <div className="toolbar">
            <input
              className="search"
              type="search"
              placeholder="Buscar por nombre, mail, teléfono u orden…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button className="btn" onClick={() => downloadCSV(slots, `turnos-${storeKey}.csv`)} disabled={!slots.length}>
              <Download size={16} aria-hidden /> Descargar CSV
            </button>
          </div>
        )}

        {error && <div className="alert">{error}</div>}
        {!token && !error && <div className="empty">Abriendo el Agente…</div>}
        {isTurnos && token && !data && loading && <div className="empty">Cargando turnos…</div>}

        {token && storeKey && section === 'envios' && <EnviosView key={storeKey} token={token} store={storeKey} onError={handleError} />}
        {token && storeKey && section === 'pauta' && <PautaView key={storeKey} token={token} store={storeKey} onError={handleError} />}
        {token && storeKey && section === 'reportes' && (
          <ReportsView key={storeKey} token={token} store={storeKey} storeName={currentStore?.name} onError={handleError} />
        )}

        {isTurnos && data && (
          <main>
            {section === 'lista'
              ? <ListView slots={slots} searching={!!query.trim()} />
              : <CalendarView key={storeKey} slots={slots} />}
            <p className="updated">Actualizado {new Date(data.updatedAt).toLocaleString('es-AR')}</p>
          </main>
        )}
      </div>
    </div>
  );
}
