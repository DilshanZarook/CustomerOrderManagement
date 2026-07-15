import React, { useState, useEffect, useCallback } from "react";
import { Users, Package, ClipboardList, Plus, Pencil, Trash2, X, Search, Circle, AlertTriangle, Loader2, LogOut, Lock } from "lucide-react";

const API_BASE = "http://localhost:5077/api";
const TOKEN_KEY = "orderConsole.token";

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

// Fired whenever a request comes back 401, so the app shell can drop back to the login screen
const AUTH_EVENT = "orderConsole.unauthorized";
function notifyUnauthorized() {
  window.dispatchEvent(new Event(AUTH_EVENT));
}

function authHeaders(extra = {}) {
  const token = getToken();
  return token ? { ...extra, Authorization: `Bearer ${token}` } : extra;
}

function useApi(path, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}${path}`, { headers: authHeaders() });
      if (res.status === 401) { notifyUnauthorized(); throw new Error("Session expired"); }
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError(e.message || "Could not reach the API");
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => { reload(); }, deps);
  return { data, loading, error, reload };
}

async function apiCall(path, method, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: authHeaders(body ? { "Content-Type": "application/json" } : undefined),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) { notifyUnauthorized(); throw new Error("Session expired. Please log in again."); }
  let payload = null;
  const text = await res.text();
  try { payload = text ? JSON.parse(text) : null; } catch { payload = text; }
  if (!res.ok) {
    const msg = typeof payload === "string" ? payload : payload?.title || payload?.message || "Request failed";
    throw new Error(msg);
  }
  return payload;
}

function money(n) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n ?? 0);
}

function Banner({ kind = "error", children, onClose }) {
  const styles = kind === "error"
    ? "bg-rose-950 border-rose-800 text-rose-200"
    : "bg-emerald-950 border-emerald-800 text-emerald-200";
  return (
    <div className={`flex items-start gap-2 border rounded-md px-3 py-2 text-sm mb-4 ${styles}`}>
      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
      <div className="flex-1">{children}</div>
      {onClose && (
        <button onClick={onClose} className="text-current opacity-60 hover:opacity-100">
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

function ConnectionPing() {
  const [ok, setOk] = useState(null);
  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/customers`, { headers: authHeaders() }).then(r => { if (!cancelled) setOk(r.ok); }).catch(() => { if (!cancelled) setOk(false); });
    return () => { cancelled = true; };
  }, []);
  return (
    <div className="flex items-center gap-1.5 text-xs font-mono">
      <Circle className={`w-2 h-2 ${ok === null ? "fill-slate-500 text-slate-500" : ok ? "fill-emerald-400 text-emerald-400" : "fill-rose-500 text-rose-500"}`} />
      <span className="text-slate-400">{ok === null ? "checking" : ok ? "api connected" : "api unreachable"}</span>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block mb-3">
      <span className="block text-xs font-medium text-slate-400 mb-1">{label}</span>
      {children}
    </label>
  );
}

const inputCls = "w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500";

function Drawer({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={onClose}>
      <div className="w-full max-w-md h-full bg-slate-900 border-l border-slate-700 p-5 overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-slate-100">{title}</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-200"><X className="w-5 h-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function PrimaryButton({ children, className = "", ...props }) {
  return (
    <button
      {...props}
      className={`inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-medium text-sm px-3 py-2 rounded-md transition disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  );
}

function GhostButton({ children, className = "", ...props }) {
  return (
    <button
      {...props}
      className={`inline-flex items-center gap-1.5 border border-slate-700 hover:border-slate-500 text-slate-300 text-sm px-3 py-2 rounded-md transition disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  );
}

/* ---------------- Customers ---------------- */

function CustomersTab() {
  const { data, loading, error, reload } = useApi("/customers");
  const [search, setSearch] = useState("");
  const [drawer, setDrawer] = useState(null); // { mode: 'add'|'edit', customer }
  const [form, setForm] = useState({ name: "", email: "", phone: "", address: "" });
  const [saveError, setSaveError] = useState(null);
  const [saving, setSaving] = useState(false);

  const openAdd = () => { setForm({ name: "", email: "", phone: "", address: "" }); setSaveError(null); setDrawer({ mode: "add" }); };
  const openEdit = (c) => { setForm({ name: c.name, email: c.email, phone: c.phone, address: c.address || "" }); setSaveError(null); setDrawer({ mode: "edit", customer: c }); };

  const submit = async () => {
    setSaving(true); setSaveError(null);
    try {
      if (drawer.mode === "add") await apiCall("/customers", "POST", form);
      else await apiCall(`/customers/${drawer.customer.id}`, "PUT", form);
      setDrawer(null);
      reload();
    } catch (e) { setSaveError(e.message); } finally { setSaving(false); }
  };

  const remove = async (c) => {
    if (!confirm(`Delete ${c.name}?`)) return;
    try { await apiCall(`/customers/${c.id}`, "DELETE"); reload(); }
    catch (e) { alert(e.message); }
  };

  const rows = (data || []).filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="w-4 h-4 text-slate-500 absolute left-2.5 top-2.5" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name" className={`${inputCls} pl-8`} />
        </div>
        <PrimaryButton onClick={openAdd}><Plus className="w-4 h-4" /> Add customer</PrimaryButton>
      </div>

      {error && <Banner>{error}</Banner>}

      <div className="border border-slate-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-900 text-left text-xs text-slate-500 uppercase tracking-wide">
              <th className="px-4 py-2.5 font-medium">Name</th>
              <th className="px-4 py-2.5 font-medium">Email</th>
              <th className="px-4 py-2.5 font-medium">Phone</th>
              <th className="px-4 py-2.5 font-medium">Address</th>
              <th className="px-4 py-2.5 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500"><Loader2 className="w-4 h-4 animate-spin inline mr-2" />Loading</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500">No customers found</td></tr>}
            {rows.map(c => (
              <tr key={c.id} className="border-t border-slate-800 hover:bg-slate-900/60">
                <td className="px-4 py-2.5 text-slate-100">{c.name}</td>
                <td className="px-4 py-2.5 text-slate-400 font-mono text-xs">{c.email}</td>
                <td className="px-4 py-2.5 text-slate-400 font-mono text-xs">{c.phone}</td>
                <td className="px-4 py-2.5 text-slate-400">{c.address || "—"}</td>
                <td className="px-4 py-2.5 text-right">
                  <button onClick={() => openEdit(c)} className="text-slate-500 hover:text-amber-400 p-1"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => remove(c)} className="text-slate-500 hover:text-rose-400 p-1"><Trash2 className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {drawer && (
        <Drawer title={drawer.mode === "add" ? "Add customer" : "Edit customer"} onClose={() => setDrawer(null)}>
          {saveError && <Banner>{saveError}</Banner>}
          <Field label="Name"><input className={inputCls} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Email"><input className={inputCls} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Phone"><input className={inputCls} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></Field>
          <Field label="Address"><input className={inputCls} value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></Field>
          <div className="flex gap-2 mt-4">
            <PrimaryButton onClick={submit} disabled={saving}>{saving ? "Saving…" : "Save"}</PrimaryButton>
            <GhostButton onClick={() => setDrawer(null)}>Cancel</GhostButton>
          </div>
        </Drawer>
      )}
    </div>
  );
}

/* ---------------- Products ---------------- */

function ProductsTab() {
  const { data, loading, error, reload } = useApi("/products");
  const [drawer, setDrawer] = useState(null);
  const [form, setForm] = useState({ name: "", price: "", stock: "" });
  const [saveError, setSaveError] = useState(null);
  const [saving, setSaving] = useState(false);

  const openAdd = () => { setForm({ name: "", price: "", stock: "" }); setSaveError(null); setDrawer({ mode: "add" }); };
  const openEdit = (p) => { setForm({ name: p.name, price: String(p.price), stock: String(p.stock) }); setSaveError(null); setDrawer({ mode: "edit", product: p }); };

  const submit = async () => {
    setSaving(true); setSaveError(null);
    const body = { name: form.name, price: parseFloat(form.price), stock: parseInt(form.stock, 10) };
    try {
      if (drawer.mode === "add") await apiCall("/products", "POST", body);
      else await apiCall(`/products/${drawer.product.id}`, "PUT", body);
      setDrawer(null);
      reload();
    } catch (e) { setSaveError(e.message); } finally { setSaving(false); }
  };

  const remove = async (p) => {
    if (!confirm(`Delete ${p.name}?`)) return;
    try { await apiCall(`/products/${p.id}`, "DELETE"); reload(); }
    catch (e) { alert(e.message); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-500">{(data || []).length} products</p>
        <PrimaryButton onClick={openAdd}><Plus className="w-4 h-4" /> Add product</PrimaryButton>
      </div>

      {error && <Banner>{error}</Banner>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {loading && <p className="text-slate-500 text-sm col-span-full"><Loader2 className="w-4 h-4 animate-spin inline mr-2" />Loading</p>}
        {!loading && (data || []).length === 0 && <p className="text-slate-500 text-sm col-span-full">No products yet</p>}
        {(data || []).map(p => (
          <div key={p.id} className="border border-slate-800 rounded-lg p-4 bg-slate-900/40">
            <div className="flex items-start justify-between mb-2">
              <p className="text-slate-100 font-medium">{p.name}</p>
              <div className="flex gap-1">
                <button onClick={() => openEdit(p)} className="text-slate-500 hover:text-amber-400 p-1"><Pencil className="w-3.5 h-3.5" /></button>
                <button onClick={() => remove(p)} className="text-slate-500 hover:text-rose-400 p-1"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
            <p className="font-mono text-lg text-slate-100">{money(p.price)}</p>
            <p className={`font-mono text-xs mt-1 ${p.stock === 0 ? "text-rose-400" : p.stock < 5 ? "text-amber-400" : "text-emerald-400"}`}>
              {p.stock} in stock
            </p>
          </div>
        ))}
      </div>

      {drawer && (
        <Drawer title={drawer.mode === "add" ? "Add product" : "Edit product"} onClose={() => setDrawer(null)}>
          {saveError && <Banner>{saveError}</Banner>}
          <Field label="Name"><input className={inputCls} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Price"><input type="number" step="0.01" className={inputCls} value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} /></Field>
          <Field label="Stock"><input type="number" className={inputCls} value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })} /></Field>
          <div className="flex gap-2 mt-4">
            <PrimaryButton onClick={submit} disabled={saving}>{saving ? "Saving…" : "Save"}</PrimaryButton>
            <GhostButton onClick={() => setDrawer(null)}>Cancel</GhostButton>
          </div>
        </Drawer>
      )}
    </div>
  );
}

/* ---------------- Orders ---------------- */

function OrdersTab() {
  const { data, loading, error, reload } = useApi("/orders");
  const { data: customers } = useApi("/customers");
  const { data: products } = useApi("/products");

  const [drawer, setDrawer] = useState(false);
  const [detail, setDetail] = useState(null);
  const [customerId, setCustomerId] = useState("");
  const [lines, setLines] = useState([{ productId: "", quantity: 1 }]);
  const [saveError, setSaveError] = useState(null);
  const [saving, setSaving] = useState(false);

  const openAdd = () => {
    setCustomerId(""); setLines([{ productId: "", quantity: 1 }]); setSaveError(null); setDrawer(true);
  };

  const addLine = () => setLines([...lines, { productId: "", quantity: 1 }]);
  const removeLine = (i) => setLines(lines.filter((_, idx) => idx !== i));
  const updateLine = (i, field, value) => setLines(lines.map((l, idx) => idx === i ? { ...l, [field]: value } : l));

  const runningTotal = lines.reduce((sum, l) => {
    const p = (products || []).find(p => String(p.id) === String(l.productId));
    return sum + (p ? p.price * (parseInt(l.quantity, 10) || 0) : 0);
  }, 0);

  const submit = async () => {
    setSaving(true); setSaveError(null);
    const body = {
      customerId: parseInt(customerId, 10),
      items: lines.filter(l => l.productId).map(l => ({ productId: parseInt(l.productId, 10), quantity: parseInt(l.quantity, 10) })),
    };
    try {
      await apiCall("/orders", "POST", body);
      setDrawer(false);
      reload();
    } catch (e) { setSaveError(e.message); } finally { setSaving(false); }
  };

  const openDetail = async (o) => {
    try {
      const d = await apiCall(`/orders/${o.id}`, "GET");
      setDetail(d);
    } catch (e) { alert(e.message); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-500">{(data || []).length} orders</p>
        <PrimaryButton onClick={openAdd}><Plus className="w-4 h-4" /> New order</PrimaryButton>
      </div>

      {error && <Banner>{error}</Banner>}

      <div className="border border-slate-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-900 text-left text-xs text-slate-500 uppercase tracking-wide">
              <th className="px-4 py-2.5 font-medium">Order</th>
              <th className="px-4 py-2.5 font-medium">Customer</th>
              <th className="px-4 py-2.5 font-medium">Date</th>
              <th className="px-4 py-2.5 font-medium text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-500"><Loader2 className="w-4 h-4 animate-spin inline mr-2" />Loading</td></tr>}
            {!loading && (data || []).length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-500">No orders yet</td></tr>}
            {(data || []).map(o => (
              <tr key={o.id} onClick={() => openDetail(o)} className="border-t border-slate-800 hover:bg-slate-900/60 cursor-pointer">
                <td className="px-4 py-2.5 font-mono text-slate-300">#{o.id}</td>
                <td className="px-4 py-2.5 text-slate-100">{o.customerName}</td>
                <td className="px-4 py-2.5 text-slate-400 text-xs">{new Date(o.orderDate).toLocaleString()}</td>
                <td className="px-4 py-2.5 text-right font-mono text-slate-100">{money(o.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {drawer && (
        <Drawer title="New order" onClose={() => setDrawer(false)}>
          {saveError && <Banner>{saveError}</Banner>}
          <Field label="Customer">
            <select className={inputCls} value={customerId} onChange={e => setCustomerId(e.target.value)}>
              <option value="">Select a customer</option>
              {(customers || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>

          <span className="block text-xs font-medium text-slate-400 mb-1.5 mt-4">Items</span>
          {lines.map((l, i) => (
            <div key={i} className="flex gap-2 mb-2">
              <select className={`${inputCls} flex-1`} value={l.productId} onChange={e => updateLine(i, "productId", e.target.value)}>
                <option value="">Select product</option>
                {(products || []).map(p => <option key={p.id} value={p.id}>{p.name} · {money(p.price)} · {p.stock} left</option>)}
              </select>
              <input type="number" min="1" className={`${inputCls} w-16`} value={l.quantity} onChange={e => updateLine(i, "quantity", e.target.value)} />
              <button onClick={() => removeLine(i)} className="text-slate-500 hover:text-rose-400 px-1"><X className="w-4 h-4" /></button>
            </div>
          ))}
          <GhostButton onClick={addLine} className="mb-4"><Plus className="w-3.5 h-3.5" /> Add item</GhostButton>

          <div className="border-t border-slate-800 pt-3 mb-4 flex items-center justify-between">
            <span className="text-sm text-slate-400">Running total</span>
            <span className="font-mono text-lg text-amber-400">{money(runningTotal)}</span>
          </div>

          <div className="flex gap-2">
            <PrimaryButton onClick={submit} disabled={saving || !customerId}>{saving ? "Placing…" : "Place order"}</PrimaryButton>
            <GhostButton onClick={() => setDrawer(false)}>Cancel</GhostButton>
          </div>
        </Drawer>
      )}

      {detail && (
        <Drawer title={`Order #${detail.id}`} onClose={() => setDetail(null)}>
          <div className="mb-4">
            <p className="text-slate-100 font-medium">{detail.customer.name}</p>
            <p className="text-xs text-slate-500 font-mono">{detail.customer.email} · {detail.customer.phone}</p>
            <p className="text-xs text-slate-500 mt-1">{detail.customer.address}</p>
          </div>
          <div className="border border-slate-800 rounded-lg overflow-hidden mb-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-900 text-left text-xs text-slate-500 uppercase">
                  <th className="px-3 py-2 font-medium">Product</th>
                  <th className="px-3 py-2 font-medium text-right">Qty</th>
                  <th className="px-3 py-2 font-medium text-right">Unit</th>
                  <th className="px-3 py-2 font-medium text-right">Line total</th>
                </tr>
              </thead>
              <tbody>
                {detail.items.map((it, i) => (
                  <tr key={i} className="border-t border-slate-800">
                    <td className="px-3 py-2 text-slate-200">{it.productName}</td>
                    <td className="px-3 py-2 text-right font-mono text-slate-400">{it.quantity}</td>
                    <td className="px-3 py-2 text-right font-mono text-slate-400">{money(it.unitPrice)}</td>
                    <td className="px-3 py-2 text-right font-mono text-slate-100">{money(it.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-slate-800 pt-3">
            <span className="text-sm text-slate-400">Order total</span>
            <span className="font-mono text-xl text-amber-400">{money(detail.total)}</span>
          </div>
        </Drawer>
      )}
    </div>
  );
}

/* ---------------- Login ---------------- */

function LoginScreen({ onLoggedIn }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Invalid username or password");
      }
      const data = await res.json();
      setToken(data.token);
      onLoggedIn();
    } catch (e2) {
      setError(e2.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <form onSubmit={submit} className="w-full max-w-sm border border-slate-800 rounded-lg p-6 bg-slate-900/40">
        <div className="flex items-center gap-2 mb-1">
          <Lock className="w-4 h-4 text-amber-400" />
          <h1 className="text-base font-semibold text-slate-100">Order console</h1>
        </div>
        <p className="text-sm text-slate-500 mb-5">Sign in to manage customers, products, and orders.</p>

        {error && <Banner>{error}</Banner>}

        <Field label="Username">
          <input className={inputCls} value={username} onChange={e => setUsername(e.target.value)} autoFocus />
        </Field>
        <Field label="Password">
          <input type="password" className={inputCls} value={password} onChange={e => setPassword(e.target.value)} />
        </Field>

        <PrimaryButton type="submit" disabled={loading || !username || !password} className="w-full justify-center mt-2">
          {loading ? "Signing in…" : "Sign in"}
        </PrimaryButton>
      </form>
    </div>
  );
}

/* ---------------- App shell ---------------- */

const TABS = [
  { key: "customers", label: "Customers", icon: Users },
  { key: "products", label: "Products", icon: Package },
  { key: "orders", label: "Orders", icon: ClipboardList },
];

export default function OrderManagementConsole() {
  const [tab, setTab] = useState("customers");
  const [authed, setAuthed] = useState(() => !!getToken());

  useEffect(() => {
    const onUnauthorized = () => { setToken(null); setAuthed(false); };
    window.addEventListener(AUTH_EVENT, onUnauthorized);
    return () => window.removeEventListener(AUTH_EVENT, onUnauthorized);
  }, []);

  const logout = () => { setToken(null); setAuthed(false); };

  if (!authed) {
    return <LoginScreen onLoggedIn={() => setAuthed(true)} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex">
      <aside className="w-56 border-r border-slate-800 flex flex-col shrink-0">
        <div className="px-5 py-5 border-b border-slate-800">
          <p className="text-sm font-semibold text-slate-100 tracking-tight">Order console</p>
          <p className="text-xs text-slate-500 mt-0.5">Customer Order Management</p>
        </div>
        <nav className="flex-1 py-3">
          {TABS.map(t => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`w-full flex items-center gap-2.5 px-5 py-2.5 text-sm text-left transition ${
                  active ? "text-amber-400 bg-amber-500/10 border-r-2 border-amber-500" : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                }`}
              >
                <Icon className="w-4 h-4" />
                {t.label}
              </button>
            );
          })}
        </nav>
        <div className="px-5 py-4 border-t border-slate-800 space-y-3">
          <ConnectionPing />
          <button onClick={logout} className="w-full flex items-center gap-2 text-xs text-slate-500 hover:text-rose-400 transition">
            <LogOut className="w-3.5 h-3.5" /> Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 p-6 max-w-5xl">
        <h1 className="text-lg font-semibold text-slate-100 mb-1">
          {TABS.find(t => t.key === tab)?.label}
        </h1>
        <p className="text-sm text-slate-500 mb-5">
          {tab === "customers" && "Manage customer records"}
          {tab === "products" && "Manage catalog and stock levels"}
          {tab === "orders" && "Place and review orders"}
        </p>
        {tab === "customers" && <CustomersTab />}
        {tab === "products" && <ProductsTab />}
        {tab === "orders" && <OrdersTab />}
      </main>
    </div>
  );
}
