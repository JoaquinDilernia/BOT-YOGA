import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useBrand } from '../contexts/BrandContext';
import { botHomePath } from '../components/Layout/Layout.jsx';
import styles from './Hub.module.css';

// Pantalla de entrada para los admins (mismo patrón que Selvaggio): el bot de
// WhatsApp o el Agente (turnos, envíos y pauta, que viene de TURNOS-YOGA).
export default function Hub() {
  const { agent, logout } = useAuth();
  const { businessName } = useBrand();
  const navigate = useNavigate();

  const areas = [
    {
      key: 'bot',
      title: 'Bot de WhatsApp',
      desc: 'Conversaciones, contactos, difusiones, base de conocimiento y estadísticas.',
      to: botHomePath(agent?.role),
    },
    {
      key: 'agente',
      title: 'Agente',
      desc: 'Turnos y anotados por clase, envío de entradas, pauta en Meta y reportes.',
      to: '/agente/lista',
    },
  ];

  return (
    <div className={styles.wrap}>
      <div className={styles.inner}>
        <header className={styles.head}>
          <span className={styles.brand}>{businessName}</span>
          <h1 className={styles.title}>Hola, {agent?.name ?? 'equipo'}</h1>
          <p className={styles.sub}>¿Con qué querés trabajar hoy?</p>
        </header>

        <div className={styles.grid}>
          {areas.map((a) => (
            <button key={a.key} className={styles.card} onClick={() => navigate(a.to)}>
              <span className={styles.cardTitle}>{a.title}</span>
              <span className={styles.cardDesc}>{a.desc}</span>
              <span className={styles.cardGo}>Entrar →</span>
            </button>
          ))}
        </div>

        <button className={styles.logout} onClick={logout}>
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
