import { GraduationCap } from "lucide-react";

export default function Brand({ compact = false }) {
  return <div className={`brand${compact ? " brand-compact" : ""}`}>
    <span className="brand-icon"><GraduationCap size={26} strokeWidth={1.7} aria-hidden="true" /></span>
    <div><span className="brand-name">Student<span>Hub</span></span><p>Gestión que conecta.</p></div>
  </div>;
}
