import { CircleCheck, CircleHelp, KeyRound, LogIn, LogOut, Pencil, Plus, ShieldAlert, SlidersHorizontal, Trash2 } from "lucide-react";

const actions = {
  LOGIN_SUCCESS: ["success", LogIn], LOGIN_FAILURE: ["danger", ShieldAlert], LOGOUT: ["neutral", LogOut],
  STUDENT_CREATE: ["success", Plus], USER_CREATE: ["success", Plus], CAREER_CREATE: ["success", Plus],
  STUDENT_UPDATE: ["info", Pencil], USER_UPDATE: ["info", Pencil], CAREER_UPDATE: ["info", Pencil],
  STUDENT_DELETE: ["danger", Trash2], ACCESS_DENIED: ["danger", ShieldAlert],
  CAREER_STATUS: ["warning", SlidersHorizontal], PASSWORD_RESET: ["warning", KeyRound],
  PASSWORD_CHANGE: ["success", CircleCheck], USER_CLEANUP: ["warning", Trash2], ACADEMIC_MIGRATION: ["info", SlidersHorizontal],
};

export default function AuditAction({ action, label, denied = false }) {
  const [tone, Icon] = denied ? ["danger", ShieldAlert] : actions[action] || ["neutral", CircleHelp];
  return <span className={`audit-action audit-action-${tone}`}><Icon size={17} aria-hidden="true" /><span>{label || action}</span></span>;
}
