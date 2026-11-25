import { UserPlus } from "lucide-react";
import { useState } from "react";
import { api } from "../api";
import { Card, ErrorBox, Modal, PageHeader, Select, Spinner, Tag } from "../components/ui";
import { useAuth } from "../lib/auth";
import { fmtDate } from "../lib/format";
import { useAsync } from "../lib/useAsync";

const ROLES = [
  { value: "SUPER_ADMIN", label: "Super Admin — full access" }, { value: "ADMIN", label: "Admin — manage feedback & reports" },
  { value: "ANALYST", label: "Analyst — analyze & validate" }, { value: "VIEWER", label: "Viewer — read-only dashboard" },
];

export default function Users() {
  const { user: me } = useAuth();
  const { data, loading, error, reload } = useAsync(() => api.users(), []);
  const [adding, setAdding] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const [form, setForm] = useState({ email: "", full_name: "", role: "ANALYST", password: "" });
  const upd = async (id: string, patch: any) => { setErr(null); try { await api.updateUser(id, patch); reload(); } catch (e) { setErr(e); } };
  const create = async () => { setErr(null); try { await api.createUser(form); setAdding(false); setForm({ email: "", full_name: "", role: "ANALYST", password: "" }); reload(); } catch (e) { setErr(e); } };
  return (
    <>
      <PageHeader title="User Management" description="Role-based access: Super Admin, Admin, Analyst and Viewer. Passwords are stored as bcrypt hashes and every change is written to the audit log."
        actions={<button className="btn-primary" onClick={() => setAdding(true)}><UserPlus className="h-4 w-4" />Add user</button>} />
      <ErrorBox error={error || (!adding && err)} />
      <Card>
        {loading ? <Spinner /> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[760px]"><thead><tr>{["Name", "Email", "Role", "Status", "Last login", ""].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
            <tbody>{data?.map((u) => (
              <tr key={u.id}>
                <td className="td font-medium">{u.full_name}{u.id === me?.id && <span className="ml-1 text-xs text-slate-400">(you)</span>}</td>
                <td className="td text-sm text-slate-600">{u.email}</td>
                <td className="td w-64"><Select value={u.role} placeholder={null} onChange={(v) => upd(u.id, { role: v })} options={ROLES} /></td>
                <td className="td">{u.is_active ? <Tag tone="green">Active</Tag> : <Tag tone="red">Deactivated</Tag>}</td>
                <td className="td text-sm text-slate-500">{fmtDate(u.last_login_at)}</td>
                <td className="td whitespace-nowrap text-right">
                  <button className="btn-ghost text-xs" onClick={() => { const p = prompt(`New password for ${u.email} (10+ characters with letters and numbers):`); if (p) upd(u.id, { password: p }); }}>Reset password</button>
                  <button className="btn-ghost text-xs" onClick={() => upd(u.id, { is_active: !u.is_active })}>{u.is_active ? "Deactivate" : "Activate"}</button>
                </td>
              </tr>
            ))}</tbody></table></div>
        )}
      </Card>
      <Modal open={adding} onClose={() => setAdding(false)} title="Add user">
        <div className="space-y-3">
          <label className="block"><span className="label">Full name</span><input className="input" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></label>
          <label className="block"><span className="label">Email</span><input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
          <Select label="Role" placeholder={null} value={form.role} onChange={(v) => setForm({ ...form, role: v })} options={ROLES} />
          <label className="block"><span className="label">Temporary password</span><input className="input" type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /><span className="text-xs text-slate-500">At least 10 characters with letters and numbers.</span></label>
          <ErrorBox error={err} />
          <div className="flex justify-end gap-2"><button className="btn-secondary" onClick={() => setAdding(false)}>Cancel</button><button className="btn-primary" onClick={create}>Create user</button></div>
        </div>
      </Modal>
    </>
  );
}
