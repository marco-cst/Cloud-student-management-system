import { useState } from "react";
import { Navigate } from "react-router-dom";
import { ArrowRight, BookOpen, Eye, EyeOff, GraduationCap, KeyRound, LoaderCircle, LockKeyhole, Mail, ShieldCheck, Users } from "lucide-react";
import { useAuth } from "../contexts/auth";
import { apiMessage } from "../services/api";
import Brand from "../components/Brand";
import CampusIllustration from "../components/CampusIllustration";
import SessionLoading from "../components/SessionLoading";
import { roles } from "../utils/permissions";
import FeedbackMessage from "../components/FeedbackMessage";
import AccessDialog from "../components/AccessDialog";

export default function Login() {
  const { user, loading, login, error: sessionError } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  if (loading) return <SessionLoading />;
  if (user && roles.includes(user.rol)) return <Navigate to={user.must_change_password ? "/change-password" : "/"} replace />;

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try { await login(email.trim(), password); }
    catch (err) { setError(err.response?.status === 401 ? "Credenciales inválidas" : apiMessage(err)); }
    finally { setBusy(false); }
  }

  return <div className="portal-page">
    <header className="portal-banner"><span><span className="status-dot" /> PORTAL ADMINISTRATIVO</span><span>Acceso para personal autorizado</span></header>
    <main className="login-page">
    <section className="login-story" aria-labelledby="login-story-title">
      <Brand />
      <div className="login-story-content">
        <span className="eyebrow"><span className="eyebrow-line" /> GESTIÓN ESTUDIANTIL</span>
        <h1 id="login-story-title">Menos gestión.<br />Más <em>educación.</em></h1>
        <p className="login-story-description">Estudiantes, carreras y niveles. La información de tu institución, en un solo lugar.</p>
        <div className="campus-scene"><CampusIllustration /><span className="campus-caption"><GraduationCap size={16} /> Un lugar para aprender. Un espacio para crecer.</span></div>
        <div className="login-features">
          <span><Users size={18} /> Estudiantes</span><span><BookOpen size={18} /> Organización</span><span><ShieldCheck size={18} /> Acceso por roles</span>
        </div>
      </div>
      <footer className="login-story-footer"><span>StudentHub · Gestión estudiantil</span><span>Conecta. Organiza. Acompaña.</span></footer>
    </section>

    <section className="login-access" aria-labelledby="login-title">
      <div className="login-mobile-brand"><Brand compact /></div>
      <div className="login-access-content">
        <span className="access-label"><span className="status-dot" /> PORTAL ADMINISTRATIVO</span>
        <div className="login-heading-icon"><KeyRound size={25} strokeWidth={1.6} /></div>
        <header className="login-heading"><h2 id="login-title">Bienvenido de nuevo<span>.</span></h2><p>Ingresa con tu cuenta para continuar.</p></header>
        <div className="portal-roles" aria-label="Roles con acceso"><span><ShieldCheck size={16} />Administrador</span><span><Users size={16} />Coordinador académico</span></div>
        <form className="login-form" onSubmit={submit} aria-busy={busy}>
          {(error || sessionError) && <FeedbackMessage type="error" title="No pudimos iniciar la sesión">{error || sessionError}</FeedbackMessage>}
          <div className="form-field"><label htmlFor="login-email">Email</label>
            <div className="input-with-icon"><Mail size={19} aria-hidden="true" /><input id="login-email" type="email" placeholder="tu.correo@institucion.edu" autoComplete="username" required maxLength={254} disabled={busy} value={email} onChange={e => setEmail(e.target.value)} /></div>
          </div>
          <div className="form-field"><label htmlFor="login-password">Contraseña</label>
            <div className="input-with-icon"><LockKeyhole size={19} aria-hidden="true" /><input id="login-password" type={showPassword ? "text" : "password"} placeholder="Ingresa tu contraseña" autoComplete="current-password" required maxLength={128} disabled={busy} value={password} onChange={e => setPassword(e.target.value)} />
              <button className="password-toggle" type="button" aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"} aria-controls="login-password" aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)}>{showPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button>
            </div>
          </div>
          <button className="primary-btn login-submit" disabled={busy}>{busy ? <><LoaderCircle size={19} className="spin" aria-hidden="true" />Ingresando…</> : <>Iniciar sesión<ArrowRight size={19} aria-hidden="true" /></>}</button>
        </form>
        <button type="button" className="portal-help" onClick={() => setHelpOpen(true)}>¿Necesitas ayuda para ingresar?</button>
        <div className="login-security"><ShieldCheck size={19} aria-hidden="true" /><p><strong>Un espacio para tu institución</strong><span>Acceso para administradores y coordinadores académicos.</span></p></div>
      </div>
      <footer className="login-access-footer"><LockKeyhole size={13} aria-hidden="true" /> Cuida tus credenciales. No compartas tu acceso.</footer>
    </section>
  </main><footer className="portal-footer">StudentHub · Portal de gestión estudiantil</footer>
  {helpOpen && <AccessDialog title="Ayuda para ingresar" onClose={() => setHelpOpen(false)}>
    <h3>Solicitar acceso</h3><p>El administrador crea las cuentas de administradores y coordinadores. No existe registro público.</p>
    <h3>¿Olvidaste tu contraseña?</h3><p>Contacta al administrador de tu institución. Después de verificar tu identidad, podrá entregarte una clave temporal por un canal privado. Vence en 24 horas y al ingresar deberás crear una contraseña nueva.</p>
    <p>No compartas tu contraseña personal ni envíes capturas de la clave temporal.</p><button className="primary-btn" onClick={() => setHelpOpen(false)}>Entendido</button>
  </AccessDialog>}</div>;
}
