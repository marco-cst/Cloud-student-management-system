import { LoaderCircle } from "lucide-react";
import Brand from "./Brand";

export default function SessionLoading() {
  return <main className="session-loading"><Brand /><p role="status"><LoaderCircle className="spin" size={20} aria-hidden="true" /> Comprobando sesión…</p></main>;
}
