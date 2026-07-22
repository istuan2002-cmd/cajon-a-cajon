'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Package, Users, DollarSign, Calendar, Plus, Trash2, Check, ChevronDown, ChevronUp, TrendingUp, X, AlertCircle, Loader2, Wallet, Truck } from 'lucide-react';

const C = {
  bg: '#1B1812',
  card: '#252017',
  cardBorder: '#3B331F',
  paper: '#F3EBD6',
  paperBorder: '#DFCFA3',
  accent: '#E3A73B',
  accentDark: '#B9822A',
  accentSoft: '#3A2F1A',
  success: '#7FA06B',
  successBg: '#26301F',
  successBorder: '#4C5E38',
  danger: '#C15A3E',
  dangerBg: '#332019',
  dangerBorder: '#5C3527',
  text: '#F1E9D6',
  textMuted: '#A79A7C',
  textFaint: '#786C50',
};

const DEFAULT_CATEGORIAS = [
  { id: 'super', nombre: 'Súper', precioCosto: 0 },
  { id: 'n1', nombre: 'N1', precioCosto: 0 },
  { id: 'n2', nombre: 'N2', precioCosto: 0 },
  { id: 'n3', nombre: 'N3', precioCosto: 0 },
  { id: 'manchado', nombre: 'Manchado', precioCosto: 0 },
];

function storageGet(key) {
  try {
    const v = window.localStorage.getItem(key);
    return v ? { value: v } : null;
  } catch (e) {
    return null;
  }
}
function storageSet(key, value) {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch (e) {
    return false;
  }
}

function todayISO() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

function formatMoney(n) {
  return '$' + (Number(n) || 0).toLocaleString('es-AR', { maximumFractionDigits: 0 });
}

function formatFecha(iso) {
  if (!iso) return '';
  if (iso.includes('T')) {
    const d = new Date(iso);
    return d.toLocaleDateString('es-AR') + ' ' + d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  }
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function formatCantidad(cajones, medios, maples) {
  const parts = [];
  if (cajones) parts.push(`${cajones} cajón${cajones > 1 ? 'es' : ''}`);
  if (medios) parts.push(`${medios} medio${medios > 1 ? 's' : ''}`);
  if (maples) parts.push(`${maples} maple${maples > 1 ? 's' : ''}`);
  return parts.length ? parts.join(' + ') : '—';
}

function emptyItem() {
  return { id: Math.random().toString(36).slice(2), catId: '', cajones: '', medios: '', maples: '' };
}

function calcItem(item, categorias, cliente) {
  const cajones = Number(item.cajones) || 0;
  const medios = Number(item.medios) || 0;
  const maples = Number(item.maples) || 0;
  const totalMaples = cajones * 12 + medios * 6 + maples;
  const cat = categorias.find((c) => c.id === item.catId);
  const costoCajon = cat ? Number(cat.precioCosto) || 0 : 0;
  const ventaCajon = cliente && cliente.precios ? Number(cliente.precios[item.catId]) || 0 : 0;
  const costoTotal = (costoCajon / 12) * totalMaples;
  const ventaTotal = (ventaCajon / 12) * totalMaples;
  return { totalMaples, costoCajon, ventaCajon, costoTotal, ventaTotal, ganancia: ventaTotal - costoTotal };
}

function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wider" style={{ color: C.textMuted }}>{label}</span>
      {children}
    </label>
  );
}

function inputStyle() {
  return {
    backgroundColor: C.paper,
    color: '#2A2415',
    border: `1px solid ${C.paperBorder}`,
    fontSize: '16px',
  };
}

export default function GestionHuevosMayorista() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [categorias, setCategorias] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [pagos, setPagos] = useState([]);
  const [pagosProveedor, setPagosProveedor] = useState([]);
  const [tab, setTab] = useState('pedidos');

  const [nuevoPedido, setNuevoPedido] = useState({ clienteId: '', fecha: todayISO(), items: [emptyItem()] });
  const [expanded, setExpanded] = useState({});
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [nuevoClienteNombre, setNuevoClienteNombre] = useState('');
  const [nuevoClienteTel, setNuevoClienteTel] = useState('');
  const [nuevaCategoriaNombre, setNuevaCategoriaNombre] = useState('');
  const [resumenPeriodo, setResumenPeriodo] = useState('todo');
  const [pagoClienteInputs, setPagoClienteInputs] = useState({});
  const [pagoProveedorInput, setPagoProveedorInput] = useState('');
  const [deudasAbierto, setDeudasAbierto] = useState({});

  useEffect(() => { loadAll(); }, []);

  function loadAll() {
    setLoading(true);
    try {
      let cats = null;
      const rc = storageGet('huevos-categorias');
      cats = rc ? JSON.parse(rc.value) : null;
      if (!cats) {
        cats = DEFAULT_CATEGORIAS;
        storageSet('huevos-categorias', JSON.stringify(cats));
      }

      let cli = null;
      const rcli = storageGet('huevos-clientes');
      cli = rcli ? JSON.parse(rcli.value) : null;
      if (!cli) cli = [];

      let ped = null;
      const rped = storageGet('huevos-pedidos');
      ped = rped ? JSON.parse(rped.value) : null;
      if (!ped) ped = [];

      let pg = null;
      const rpg = storageGet('huevos-pagos');
      pg = rpg ? JSON.parse(rpg.value) : null;

      // Migración: si venía del sistema viejo (pagos guardados dentro de cada pedido)
      // y todavía no existe la lista general de pagos, la reconstruimos una vez.
      if (!pg) {
        pg = [];
        let huboMigracion = false;
        ped.forEach((p) => {
          if (Array.isArray(p.pagos) && p.pagos.length > 0) {
            huboMigracion = true;
            p.pagos.forEach((pago) => {
              pg.push({
                id: Math.random().toString(36).slice(2) + Date.now().toString(36) + Math.random().toString(36).slice(2),
                clienteId: p.clienteId,
                monto: pago.monto,
                fecha: pago.fecha || new Date().toISOString(),
              });
            });
          }
        });
        if (huboMigracion) {
          storageSet('huevos-pagos', JSON.stringify(pg));
        }
      }
      // Limpiamos los campos viejos de los pedidos (ya no se usan)
      const pedLimpios = ped.map((p) => {
        const { pagos: _pagos, montoPagado: _mp, saldo: _saldo, ...resto } = p;
        return resto;
      });
      if (JSON.stringify(pedLimpios) !== JSON.stringify(ped)) {
        storageSet('huevos-pedidos', JSON.stringify(pedLimpios));
      }

      setCategorias(cats);
      setClientes(cli);
      setPedidos(pedLimpios);
      setPagos(pg);

      let pgProv = null;
      const rpgProv = storageGet('huevos-pagos-proveedor');
      pgProv = rpgProv ? JSON.parse(rpgProv.value) : null;
      if (!pgProv) pgProv = [];
      setPagosProveedor(pgProv);
    } catch (e) {
      setError('No se pudieron cargar los datos guardados.');
    } finally {
      setLoading(false);
    }
  }

  function persist(key, value, setter) {
    setter(value);
    const ok = storageSet(key, JSON.stringify(value));
    if (!ok) setError('No se pudo guardar el cambio. Probá de nuevo.');
  }

  const clienteActual = clientes.find((c) => c.id === nuevoPedido.clienteId);

  function updateItem(id, field, value) {
    setNuevoPedido((p) => ({ ...p, items: p.items.map((it) => (it.id === id ? { ...it, [field]: value } : it)) }));
  }
  function addItemRow() {
    setNuevoPedido((p) => ({ ...p, items: [...p.items, emptyItem()] }));
  }
  function removeItemRow(id) {
    setNuevoPedido((p) => ({ ...p, items: p.items.length > 1 ? p.items.filter((it) => it.id !== id) : p.items }));
  }

  const itemsCalculados = nuevoPedido.items.map((it) => ({ ...it, calc: calcItem(it, categorias, clienteActual) }));
  const totalesPreview = itemsCalculados.reduce(
    (acc, it) => ({
      costo: acc.costo + it.calc.costoTotal,
      venta: acc.venta + it.calc.ventaTotal,
      ganancia: acc.ganancia + it.calc.ganancia,
    }),
    { costo: 0, venta: 0, ganancia: 0 }
  );

  function handleGuardarPedido() {
    setError('');
    if (!nuevoPedido.clienteId) { setError('Elegí un cliente antes de guardar.'); return; }
    const cliente = clientes.find((c) => c.id === nuevoPedido.clienteId);
    const validos = nuevoPedido.items.filter((it) => it.catId && ((Number(it.cajones) || 0) + (Number(it.medios) || 0) + (Number(it.maples) || 0) > 0));
    if (validos.length === 0) { setError('Agregá al menos una categoría con cantidad mayor a cero.'); return; }

    const itemsFinal = validos.map((it) => {
      const cat = categorias.find((c) => c.id === it.catId);
      const calc = calcItem(it, categorias, cliente);
      return {
        catId: it.catId,
        catNombre: cat ? cat.nombre : it.catId,
        cajones: Number(it.cajones) || 0,
        medios: Number(it.medios) || 0,
        maples: Number(it.maples) || 0,
        ...calc,
      };
    });
    const totalCosto = itemsFinal.reduce((s, i) => s + i.costoTotal, 0);
    const totalVenta = itemsFinal.reduce((s, i) => s + i.ventaTotal, 0);
    const totalGanancia = totalVenta - totalCosto;

    const pedido = {
      id: Math.random().toString(36).slice(2) + Date.now().toString(36),
      clienteId: cliente.id,
      clienteNombre: cliente.nombre,
      fecha: nuevoPedido.fecha,
      items: itemsFinal,
      totalCosto,
      totalVenta,
      totalGanancia,
    };
    persist('huevos-pedidos', [pedido, ...pedidos], setPedidos);
    setNuevoPedido({ clienteId: cliente.id, fecha: nuevoPedido.fecha, items: [emptyItem()] });
  }

  function eliminarPedido(id) {
    persist('huevos-pedidos', pedidos.filter((p) => p.id !== id), setPedidos);
    setConfirmDelete(null);
  }

  function addCliente() {
    if (!nuevoClienteNombre.trim()) return;
    const precios = {};
    categorias.forEach((c) => (precios[c.id] = 0));
    const nuevo = { id: Math.random().toString(36).slice(2), nombre: nuevoClienteNombre.trim(), telefono: nuevoClienteTel.trim(), precios };
    persist('huevos-clientes', [...clientes, nuevo], setClientes);
    setNuevoClienteNombre('');
    setNuevoClienteTel('');
  }

  function updateClientePrecio(clienteId, catId, valor) {
    const updated = clientes.map((c) => (c.id === clienteId ? { ...c, precios: { ...c.precios, [catId]: Number(valor) || 0 } } : c));
    persist('huevos-clientes', updated, setClientes);
  }

  function eliminarCliente(id) {
    persist('huevos-clientes', clientes.filter((c) => c.id !== id), setClientes);
    setConfirmDelete(null);
  }

  function updateCategoriaCosto(catId, valor) {
    const updated = categorias.map((c) => (c.id === catId ? { ...c, precioCosto: Number(valor) || 0 } : c));
    persist('huevos-categorias', updated, setCategorias);
  }

  function addCategoria() {
    if (!nuevaCategoriaNombre.trim()) return;
    const id = nuevaCategoriaNombre.trim().toLowerCase().replace(/\s+/g, '-') + '-' + Date.now().toString(36);
    const nueva = { id, nombre: nuevaCategoriaNombre.trim(), precioCosto: 0 };
    persist('huevos-categorias', [...categorias, nueva], setCategorias);
    persist('huevos-clientes', clientes.map((c) => ({ ...c, precios: { ...c.precios, [id]: 0 } })), setClientes);
    setNuevaCategoriaNombre('');
  }

  // --- Cuenta corriente / deuda acumulada por cliente ---
  function totalVentasCliente(clienteId) {
    return pedidos.filter((p) => p.clienteId === clienteId).reduce((s, p) => s + p.totalVenta, 0);
  }
  function totalPagadoCliente(clienteId) {
    return pagos.filter((pg) => pg.clienteId === clienteId).reduce((s, pg) => s + pg.monto, 0);
  }
  function deudaCliente(clienteId) {
    return totalVentasCliente(clienteId) - totalPagadoCliente(clienteId);
  }

  function registrarPagoCliente(clienteId) {
    const monto = Number(pagoClienteInputs[clienteId]);
    if (!monto || monto <= 0) return;
    const nuevoPago = { id: Math.random().toString(36).slice(2) + Date.now().toString(36), clienteId, monto, fecha: new Date().toISOString() };
    persist('huevos-pagos', [nuevoPago, ...pagos], setPagos);
    setPagoClienteInputs((s) => ({ ...s, [clienteId]: '' }));
  }

  function eliminarPago(id) {
    persist('huevos-pagos', pagos.filter((pg) => pg.id !== id), setPagos);
    setConfirmDelete(null);
  }

  // --- Deuda con el proveedor (lo que vos le debés a él) ---
  const totalComprado = useMemo(() => pedidos.reduce((s, p) => s + p.totalCosto, 0), [pedidos]);
  const totalPagadoProveedor = useMemo(() => pagosProveedor.reduce((s, pg) => s + pg.monto, 0), [pagosProveedor]);
  const deudaProveedor = totalComprado - totalPagadoProveedor;

  function registrarPagoProveedor() {
    const monto = Number(pagoProveedorInput);
    if (!monto || monto <= 0) return;
    const nuevoPago = { id: Math.random().toString(36).slice(2) + Date.now().toString(36), monto, fecha: new Date().toISOString() };
    persist('huevos-pagos-proveedor', [nuevoPago, ...pagosProveedor], setPagosProveedor);
    setPagoProveedorInput('');
  }

  function eliminarPagoProveedor(id) {
    persist('huevos-pagos-proveedor', pagosProveedor.filter((pg) => pg.id !== id), setPagosProveedor);
    setConfirmDelete(null);
  }

  const pedidosPorFecha = useMemo(() => {
    const map = {};
    pedidos.forEach((p) => { (map[p.fecha] = map[p.fecha] || []).push(p); });
    return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]));
  }, [pedidos]);

  const pedidosFiltradosResumen = useMemo(() => {
    if (resumenPeriodo === 'todo') return pedidos;
    const hoy = new Date(todayISO());
    return pedidos.filter((p) => {
      const f = new Date(p.fecha);
      const diff = (hoy - f) / (1000 * 60 * 60 * 24);
      if (resumenPeriodo === 'hoy') return p.fecha === todayISO();
      if (resumenPeriodo === 'semana') return diff >= 0 && diff < 7;
      if (resumenPeriodo === 'mes') return diff >= 0 && diff < 31;
      return true;
    });
  }, [pedidos, resumenPeriodo]);

  const totales = useMemo(() => ({
    costo: pedidosFiltradosResumen.reduce((s, p) => s + p.totalCosto, 0),
    venta: pedidosFiltradosResumen.reduce((s, p) => s + p.totalVenta, 0),
    ganancia: pedidosFiltradosResumen.reduce((s, p) => s + p.totalGanancia, 0),
  }), [pedidosFiltradosResumen]);

  const clientesConSaldo = useMemo(
    () => clientes.map((c) => ({ ...c, deuda: deudaCliente(c.id) })).sort((a, b) => b.deuda - a.deuda),
    [clientes, pedidos, pagos]
  );
  const deudaTotal = useMemo(
    () => clientesConSaldo.reduce((s, c) => s + Math.max(0, c.deuda), 0),
    [clientesConSaldo]
  );
  const clientesConDeuda = useMemo(() => clientesConSaldo.filter((c) => c.deuda > 0), [clientesConSaldo]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: C.bg, color: C.text }}>
        <Loader2 className="animate-spin" size={28} />
      </div>
    );
  }

  const tabs = [
    { id: 'pedidos', label: 'Pedidos', icon: Package },
    { id: 'deudas', label: 'Deudas', icon: Wallet },
    { id: 'proveedor', label: 'Proveedor', icon: Truck },
    { id: 'clientes', label: 'Clientes', icon: Users },
    { id: 'precios', label: 'Costos', icon: DollarSign },
    { id: 'resumen', label: 'Resumen', icon: TrendingUp },
  ];

  return (
    <div className="min-h-screen" style={{ backgroundColor: C.bg, color: C.text, fontFamily: "system-ui, sans-serif" }}>
      <div className="max-w-2xl mx-auto pb-24">
        <header className="px-5 pt-6 pb-4" style={{ borderBottom: `1px solid ${C.cardBorder}` }}>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: C.accent }}>
              <Package size={18} color={C.bg} />
            </div>
            <div>
              <h1 className="text-xl font-bold leading-tight">Cajón a Cajón</h1>
              <p className="text-xs" style={{ color: C.textMuted }}>Venta mayorista de huevos por cliente</p>
            </div>
          </div>
        </header>

        {error && (
          <div className="mx-5 mt-4 px-3 py-2 rounded flex items-start gap-2 text-sm" style={{ backgroundColor: C.dangerBg, border: `1px solid ${C.dangerBorder}`, color: C.text }}>
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 2, color: C.danger }} />
            <span className="flex-1">{error}</span>
            <button onClick={() => setError('')}><X size={14} /></button>
          </div>
        )}

        <nav className="flex px-2 gap-1 mt-4 sticky top-0 z-10 py-2 overflow-x-auto" style={{ backgroundColor: C.bg }}>
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="flex-1 flex flex-col items-center gap-1 py-2 rounded-lg text-xs font-medium"
                style={{
                  backgroundColor: active ? C.accentSoft : 'transparent',
                  color: active ? C.accent : C.textMuted,
                  border: active ? `1px solid ${C.accentDark}` : '1px solid transparent',
                  minWidth: '64px',
                }}
              >
                <Icon size={16} />
                {t.label}
              </button>
            );
          })}
        </nav>

        <main className="px-5 mt-2">
          {tab === 'pedidos' && (
            <PedidosTab
              categorias={categorias}
              clientes={clientes}
              nuevoPedido={nuevoPedido}
              setNuevoPedido={setNuevoPedido}
              clienteActual={clienteActual}
              itemsCalculados={itemsCalculados}
              totalesPreview={totalesPreview}
              updateItem={updateItem}
              addItemRow={addItemRow}
              removeItemRow={removeItemRow}
              handleGuardarPedido={handleGuardarPedido}
              pedidosPorFecha={pedidosPorFecha}
              expanded={expanded}
              setExpanded={setExpanded}
              confirmDelete={confirmDelete}
              setConfirmDelete={setConfirmDelete}
              eliminarPedido={eliminarPedido}
            />
          )}

          {tab === 'deudas' && (
            <DeudasTab
              clientesConSaldo={clientesConSaldo}
              pagos={pagos}
              pagoClienteInputs={pagoClienteInputs}
              setPagoClienteInputs={setPagoClienteInputs}
              registrarPagoCliente={registrarPagoCliente}
              deudasAbierto={deudasAbierto}
              setDeudasAbierto={setDeudasAbierto}
              confirmDelete={confirmDelete}
              setConfirmDelete={setConfirmDelete}
              eliminarPago={eliminarPago}
              totalVentasCliente={totalVentasCliente}
              totalPagadoCliente={totalPagadoCliente}
            />
          )}

          {tab === 'proveedor' && (
            <ProveedorTab
              deudaProveedor={deudaProveedor}
              totalComprado={totalComprado}
              totalPagadoProveedor={totalPagadoProveedor}
              pagosProveedor={pagosProveedor}
              pagoProveedorInput={pagoProveedorInput}
              setPagoProveedorInput={setPagoProveedorInput}
              registrarPagoProveedor={registrarPagoProveedor}
              confirmDelete={confirmDelete}
              setConfirmDelete={setConfirmDelete}
              eliminarPagoProveedor={eliminarPagoProveedor}
            />
          )}

          {tab === 'clientes' && (
            <ClientesTab
              clientes={clientes}
              categorias={categorias}
              nuevoClienteNombre={nuevoClienteNombre}
              setNuevoClienteNombre={setNuevoClienteNombre}
              nuevoClienteTel={nuevoClienteTel}
              setNuevoClienteTel={setNuevoClienteTel}
              addCliente={addCliente}
              updateClientePrecio={updateClientePrecio}
              deudaCliente={deudaCliente}
              confirmDelete={confirmDelete}
              setConfirmDelete={setConfirmDelete}
              eliminarCliente={eliminarCliente}
            />
          )}

          {tab === 'precios' && (
            <PreciosTab
              categorias={categorias}
              updateCategoriaCosto={updateCategoriaCosto}
              nuevaCategoriaNombre={nuevaCategoriaNombre}
              setNuevaCategoriaNombre={setNuevaCategoriaNombre}
              addCategoria={addCategoria}
            />
          )}

          {tab === 'resumen' && (
            <ResumenTab
              resumenPeriodo={resumenPeriodo}
              setResumenPeriodo={setResumenPeriodo}
              totales={totales}
              deudaTotal={deudaTotal}
              clientesConDeuda={clientesConDeuda}
              pedidosFiltradosResumen={pedidosFiltradosResumen}
              pedidos={pedidos}
            />
          )}
        </main>
      </div>
    </div>
  );
}

function PedidosTab(props) {
  const {
    categorias, clientes, nuevoPedido, setNuevoPedido, clienteActual, itemsCalculados, totalesPreview,
    updateItem, addItemRow, removeItemRow, handleGuardarPedido, pedidosPorFecha, expanded, setExpanded,
    confirmDelete, setConfirmDelete, eliminarPedido,
  } = props;

  const sinClientes = clientes.length === 0;

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-xl p-4" style={{ backgroundColor: C.card, border: `1px solid ${C.cardBorder}` }}>
        <h2 className="text-base font-bold mb-3">Nuevo pedido</h2>

        {sinClientes ? (
          <p className="text-sm" style={{ color: C.textMuted }}>Primero agregá un cliente en la pestaña "Clientes" para poder cargar pedidos.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <Field label="Cliente">
                <select
                  value={nuevoPedido.clienteId}
                  onChange={(e) => setNuevoPedido((p) => ({ ...p, clienteId: e.target.value }))}
                  className="px-2 py-2 rounded text-sm"
                  style={inputStyle()}
                >
                  <option value="">Elegir...</option>
                  {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </Field>
              <Field label="Fecha">
                <input
                  type="date"
                  value={nuevoPedido.fecha}
                  onChange={(e) => setNuevoPedido((p) => ({ ...p, fecha: e.target.value }))}
                  className="px-2 py-2 rounded text-sm"
                  style={inputStyle()}
                />
              </Field>
            </div>

            <div className="flex flex-col gap-3">
              {itemsCalculados.map((it, idx) => {
                const catSinPrecio = it.catId && clienteActual && (!clienteActual.precios || !clienteActual.precios[it.catId]);
                return (
                  <div key={it.id} className="rounded-lg p-3" style={{ backgroundColor: C.accentSoft, border: `1px solid ${C.cardBorder}` }}>
                    <div className="flex items-center gap-2 mb-2">
                      <select
                        value={it.catId}
                        onChange={(e) => updateItem(it.id, 'catId', e.target.value)}
                        className="flex-1 px-2 py-2 rounded text-sm"
                        style={inputStyle()}
                      >
                        <option value="">Categoría...</option>
                        {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                      </select>
                      {itemsCalculados.length > 1 && (
                        <button onClick={() => removeItemRow(it.id)} className="p-2 rounded" style={{ color: C.danger }}>
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <Field label="Cajones">
                        <input type="number" min="0" inputMode="numeric" placeholder="0" value={it.cajones}
                          onChange={(e) => updateItem(it.id, 'cajones', e.target.value)}
                          className="px-2 py-1.5 rounded text-sm" style={inputStyle()} />
                      </Field>
                      <Field label="Medios">
                        <input type="number" min="0" inputMode="numeric" placeholder="0" value={it.medios}
                          onChange={(e) => updateItem(it.id, 'medios', e.target.value)}
                          className="px-2 py-1.5 rounded text-sm" style={inputStyle()} />
                      </Field>
                      <Field label="Maples">
                        <input type="number" min="0" inputMode="numeric" placeholder="0" value={it.maples}
                          onChange={(e) => updateItem(it.id, 'maples', e.target.value)}
                          className="px-2 py-1.5 rounded text-sm" style={inputStyle()} />
                      </Field>
                    </div>
                    {catSinPrecio && (
                      <p className="text-xs mt-2" style={{ color: C.danger }}>Este cliente no tiene precio cargado para esta categoría (configuralo en "Clientes").</p>
                    )}
                    {it.calc.totalMaples > 0 && (
                      <p className="text-xs mt-2" style={{ color: C.textMuted }}>
                        {it.calc.totalMaples} maples · costo {formatMoney(it.calc.costoTotal)} · venta {formatMoney(it.calc.ventaTotal)}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            <button onClick={addItemRow} className="mt-3 flex items-center gap-1 text-sm font-medium" style={{ color: C.accent }}>
              <Plus size={16} /> Agregar otra categoría
            </button>

            {totalesPreview.venta > 0 && (
              <div className="mt-4 rounded-lg p-3 grid grid-cols-3 gap-2 text-center" style={{ backgroundColor: C.paper }}>
                <div>
                  <p className="text-xs" style={{ color: '#5c5236' }}>Costo</p>
                  <p className="font-bold text-sm" style={{ color: '#2A2415' }}>{formatMoney(totalesPreview.costo)}</p>
                </div>
                <div>
                  <p className="text-xs" style={{ color: '#5c5236' }}>Venta</p>
                  <p className="font-bold text-sm" style={{ color: '#2A2415' }}>{formatMoney(totalesPreview.venta)}</p>
                </div>
                <div>
                  <p className="text-xs" style={{ color: '#5c5236' }}>Ganancia</p>
                  <p className="font-bold text-sm" style={{ color: C.accentDark }}>{formatMoney(totalesPreview.ganancia)}</p>
                </div>
              </div>
            )}

            <p className="text-xs mt-3" style={{ color: C.textMuted }}>El total de venta se suma a la cuenta corriente del cliente. Los pagos se registran aparte, en la pestaña "Deudas".</p>

            <button
              onClick={handleGuardarPedido}
              className="w-full mt-3 py-3 rounded-lg font-bold text-sm"
              style={{ backgroundColor: C.accent, color: '#2A2010' }}
            >
              Guardar pedido
            </button>
          </>
        )}
      </section>

      <section>
        <h2 className="text-base font-bold mb-3">Historial</h2>
        {pedidosPorFecha.length === 0 && <p className="text-sm" style={{ color: C.textMuted }}>Todavía no cargaste pedidos.</p>}
        <div className="flex flex-col gap-4">
          {pedidosPorFecha.map(([fecha, lista]) => {
            const diaTotales = lista.reduce((acc, p) => ({ costo: acc.costo + p.totalCosto, venta: acc.venta + p.totalVenta, ganancia: acc.ganancia + p.totalGanancia }), { costo: 0, venta: 0, ganancia: 0 });
            return (
              <div key={fecha}>
                <div className="flex items-baseline justify-between mb-2">
                  <h3 className="text-sm font-bold flex items-center gap-1" style={{ color: C.accent }}>
                    <Calendar size={14} /> {formatFecha(fecha)}
                  </h3>
                  <p className="text-xs" style={{ color: C.textMuted }}>
                    Venta {formatMoney(diaTotales.venta)} · Gan. {formatMoney(diaTotales.ganancia)}
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  {lista.map((p) => {
                    const isOpen = expanded[p.id];
                    const deleteKey = `pedido:${p.id}`;
                    return (
                      <div key={p.id} className="rounded-lg p-3" style={{ backgroundColor: C.card, border: `1px solid ${C.cardBorder}` }}>
                        <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpanded((s) => ({ ...s, [p.id]: !s[p.id] }))}>
                          <div>
                            <p className="font-semibold text-sm">{p.clienteNombre}</p>
                            <p className="text-xs" style={{ color: C.textMuted }}>{p.items.map((i) => i.catNombre).join(', ')}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-sm">{formatMoney(p.totalVenta)}</p>
                            {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </div>
                        </div>

                        {isOpen && (
                          <div className="mt-3 pt-3 flex flex-col gap-2" style={{ borderTop: `1px solid ${C.cardBorder}` }}>
                            {p.items.map((it, i) => (
                              <div key={i} className="flex justify-between text-xs" style={{ color: C.textMuted }}>
                                <span>{it.catNombre}: {formatCantidad(it.cajones, it.medios, it.maples)}</span>
                                <span>{formatMoney(it.ventaTotal)}</span>
                              </div>
                            ))}
                            <div className="flex justify-between text-xs font-semibold mt-1">
                              <span>Costo {formatMoney(p.totalCosto)}</span>
                              <span style={{ color: C.accent }}>Ganancia {formatMoney(p.totalGanancia)}</span>
                            </div>

                            {confirmDelete === deleteKey ? (
                              <div className="flex gap-2 mt-1 text-xs items-center">
                                <span style={{ color: C.danger }}>¿Eliminar este pedido?</span>
                                <button onClick={() => eliminarPedido(p.id)} className="underline" style={{ color: C.danger }}>Sí, eliminar</button>
                                <button onClick={() => setConfirmDelete(null)} style={{ color: C.textMuted }}>Cancelar</button>
                              </div>
                            ) : (
                              <button onClick={() => setConfirmDelete(deleteKey)} className="text-xs self-start mt-1 flex items-center gap-1" style={{ color: C.textFaint }}>
                                <Trash2 size={12} /> Eliminar pedido
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function ProveedorTab(props) {
  const {
    deudaProveedor, totalComprado, totalPagadoProveedor, pagosProveedor,
    pagoProveedorInput, setPagoProveedorInput, registrarPagoProveedor,
    confirmDelete, setConfirmDelete, eliminarPagoProveedor,
  } = props;

  const historial = [...pagosProveedor].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-xl p-4" style={{ backgroundColor: C.card, border: `1px solid ${C.cardBorder}` }}>
        <h2 className="text-base font-bold mb-1">Tu deuda con el proveedor</h2>
        <p className="text-xs mb-3" style={{ color: C.textMuted }}>
          Se acumula sola con el costo de cada pedido que cargás, y baja con cada pago que le hagas a tu proveedor.
        </p>
        <p className="text-3xl font-bold mb-4" style={{ color: deudaProveedor > 0 ? C.danger : C.success }}>
          {deudaProveedor > 0 ? formatMoney(deudaProveedor) : deudaProveedor < 0 ? `A favor ${formatMoney(-deudaProveedor)}` : '$0'}
        </p>

        <div className="flex gap-2">
          <input
            type="number" min="0" inputMode="numeric" placeholder="Monto que le pagás"
            value={pagoProveedorInput}
            onChange={(e) => setPagoProveedorInput(e.target.value)}
            className="flex-1 px-2 py-1.5 rounded text-sm" style={inputStyle()}
          />
          <button onClick={registrarPagoProveedor} className="px-3 rounded flex items-center gap-1 text-sm font-medium" style={{ backgroundColor: C.successBg, color: C.success, border: `1px solid ${C.successBorder}` }}>
            <Check size={14} /> Registrar pago
          </button>
        </div>

        <div className="flex justify-between text-xs mt-4 pt-3" style={{ borderTop: `1px solid ${C.cardBorder}`, color: C.textMuted }}>
          <span>Total comprado (histórico)</span>
          <span>{formatMoney(totalComprado)}</span>
        </div>
        <div className="flex justify-between text-xs mt-1" style={{ color: C.textMuted }}>
          <span>Total pagado (histórico)</span>
          <span>{formatMoney(totalPagadoProveedor)}</span>
        </div>
      </section>

      <section>
        <h2 className="text-base font-bold mb-3">Historial de pagos al proveedor</h2>
        {historial.length === 0 ? (
          <p className="text-sm" style={{ color: C.textMuted }}>Todavía no registraste pagos.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {historial.map((pg) => {
              const deleteKey = `pagoProveedor:${pg.id}`;
              return (
                <div key={pg.id} className="rounded-lg p-3 flex items-center justify-between" style={{ backgroundColor: C.card, border: `1px solid ${C.cardBorder}` }}>
                  <span className="text-xs" style={{ color: C.textMuted }}>{formatFecha(pg.fecha)}</span>
                  <span className="font-semibold text-sm">{formatMoney(pg.monto)}</span>
                  {confirmDelete === deleteKey ? (
                    <span className="flex gap-2 items-center text-xs">
                      <button onClick={() => eliminarPagoProveedor(pg.id)} className="underline" style={{ color: C.danger }}>Sí, eliminar</button>
                      <button onClick={() => setConfirmDelete(null)} style={{ color: C.textMuted }}>Cancelar</button>
                    </span>
                  ) : (
                    <button onClick={() => setConfirmDelete(deleteKey)} style={{ color: C.textFaint }}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function DeudasTab(props) {
  const {
    clientesConSaldo, pagos, pagoClienteInputs, setPagoClienteInputs, registrarPagoCliente,
    deudasAbierto, setDeudasAbierto, confirmDelete, setConfirmDelete, eliminarPago,
    totalVentasCliente, totalPagadoCliente,
  } = props;

  if (clientesConSaldo.length === 0) {
    return <p className="text-sm" style={{ color: C.textMuted }}>Todavía no cargaste clientes.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs mb-1" style={{ color: C.textMuted }}>
        La deuda se acumula con cada pedido y baja con cada pago que registrés, sin importar a qué pedido corresponda.
      </p>
      {clientesConSaldo.map((c) => {
        const isOpen = deudasAbierto[c.id];
        const historialPagos = pagos.filter((pg) => pg.clienteId === c.id).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        return (
          <div key={c.id} className="rounded-lg p-3" style={{ backgroundColor: C.card, border: `1px solid ${C.cardBorder}` }}>
            <div className="flex items-center justify-between cursor-pointer" onClick={() => setDeudasAbierto((s) => ({ ...s, [c.id]: !s[c.id] }))}>
              <p className="font-semibold text-sm">{c.nombre}</p>
              <div className="flex items-center gap-2">
                {c.deuda > 0 ? (
                  <span className="font-bold text-sm" style={{ color: C.danger }}>Debe {formatMoney(c.deuda)}</span>
                ) : c.deuda < 0 ? (
                  <span className="font-bold text-sm" style={{ color: C.success }}>A favor {formatMoney(-c.deuda)}</span>
                ) : (
                  <span className="text-sm" style={{ color: C.success }}>Al día</span>
                )}
                {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>
            </div>

            <div className="flex gap-2 mt-3">
              <input
                type="number" min="0" inputMode="numeric" placeholder="Monto que paga"
                value={pagoClienteInputs[c.id] || ''}
                onChange={(e) => setPagoClienteInputs((s) => ({ ...s, [c.id]: e.target.value }))}
                className="flex-1 px-2 py-1.5 rounded text-sm" style={inputStyle()}
              />
              <button onClick={() => registrarPagoCliente(c.id)} className="px-3 rounded flex items-center gap-1 text-sm font-medium" style={{ backgroundColor: C.successBg, color: C.success, border: `1px solid ${C.successBorder}` }}>
                <Check size={14} /> Registrar pago
              </button>
            </div>

            {isOpen && (
              <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${C.cardBorder}` }}>
                <div className="flex justify-between text-xs mb-2" style={{ color: C.textMuted }}>
                  <span>Total vendido (histórico)</span>
                  <span>{formatMoney(totalVentasCliente(c.id))}</span>
                </div>
                <div className="flex justify-between text-xs mb-2" style={{ color: C.textMuted }}>
                  <span>Total pagado (histórico)</span>
                  <span>{formatMoney(totalPagadoCliente(c.id))}</span>
                </div>
                <p className="text-xs uppercase tracking-wider mt-2 mb-1" style={{ color: C.textMuted }}>Historial de pagos</p>
                {historialPagos.length === 0 ? (
                  <p className="text-xs" style={{ color: C.textFaint }}>Todavía no registró pagos.</p>
                ) : (
                  <div className="flex flex-col gap-1">
                    {historialPagos.map((pg) => {
                      const deleteKey = `pago:${pg.id}`;
                      return (
                        <div key={pg.id} className="flex items-center justify-between text-xs">
                          <span style={{ color: C.textMuted }}>{formatFecha(pg.fecha)}</span>
                          <span className="font-semibold">{formatMoney(pg.monto)}</span>
                          {confirmDelete === deleteKey ? (
                            <span className="flex gap-1 items-center">
                              <button onClick={() => eliminarPago(pg.id)} className="underline" style={{ color: C.danger }}>Sí</button>
                              <button onClick={() => setConfirmDelete(null)} style={{ color: C.textMuted }}>No</button>
                            </span>
                          ) : (
                            <button onClick={() => setConfirmDelete(deleteKey)} style={{ color: C.textFaint }}>
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ClientesTab(props) {
  const {
    clientes, categorias, nuevoClienteNombre, setNuevoClienteNombre, nuevoClienteTel, setNuevoClienteTel,
    addCliente, updateClientePrecio, deudaCliente, confirmDelete, setConfirmDelete, eliminarCliente,
  } = props;
  const [abierto, setAbierto] = useState({});

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-xl p-4" style={{ backgroundColor: C.card, border: `1px solid ${C.cardBorder}` }}>
        <h2 className="text-base font-bold mb-3">Agregar cliente</h2>
        <div className="flex flex-col gap-2">
          <input placeholder="Nombre" value={nuevoClienteNombre} onChange={(e) => setNuevoClienteNombre(e.target.value)} className="px-3 py-2 rounded text-sm" style={inputStyle()} />
          <input placeholder="Teléfono (opcional)" value={nuevoClienteTel} onChange={(e) => setNuevoClienteTel(e.target.value)} className="px-3 py-2 rounded text-sm" style={inputStyle()} />
          <button onClick={addCliente} className="py-2 rounded font-bold text-sm flex items-center justify-center gap-1" style={{ backgroundColor: C.accent, color: '#2A2010' }}>
            <Plus size={16} /> Agregar cliente
          </button>
        </div>
      </section>

      <section>
        <h2 className="text-base font-bold mb-3">Clientes y precios de venta</h2>
        {clientes.length === 0 && <p className="text-sm" style={{ color: C.textMuted }}>Todavía no cargaste clientes.</p>}
        <div className="flex flex-col gap-2">
          {clientes.map((c) => {
            const isOpen = abierto[c.id];
            const deuda = deudaCliente(c.id);
            return (
              <div key={c.id} className="rounded-lg p-3" style={{ backgroundColor: C.card, border: `1px solid ${C.cardBorder}` }}>
                <div className="flex items-center justify-between cursor-pointer" onClick={() => setAbierto((s) => ({ ...s, [c.id]: !s[c.id] }))}>
                  <div>
                    <p className="font-semibold text-sm">{c.nombre}</p>
                    {c.telefono && <p className="text-xs" style={{ color: C.textMuted }}>{c.telefono}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    {deuda > 0 ? (
                      <span className="text-xs font-bold" style={{ color: C.danger }}>Debe {formatMoney(deuda)}</span>
                    ) : (
                      <span className="text-xs" style={{ color: C.success }}>Al día</span>
                    )}
                    {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </div>

                {isOpen && (
                  <div className="mt-3 pt-3 flex flex-col gap-2" style={{ borderTop: `1px solid ${C.cardBorder}` }}>
                    <p className="text-xs uppercase tracking-wider" style={{ color: C.textMuted }}>Precio de venta por cajón</p>
                    {categorias.map((cat) => (
                      <div key={cat.id} className="flex items-center justify-between gap-2">
                        <span className="text-sm flex-1">{cat.nombre}</span>
                        <input
                          type="number" min="0" inputMode="numeric"
                          value={c.precios && c.precios[cat.id] !== undefined ? c.precios[cat.id] : 0}
                          onChange={(e) => updateClientePrecio(c.id, cat.id, e.target.value)}
                          className="w-24 px-2 py-1.5 rounded text-sm text-right" style={inputStyle()}
                        />
                      </div>
                    ))}

                    {confirmDelete === `cliente:${c.id}` ? (
                      <div className="flex gap-2 mt-1 text-xs items-center">
                        <span style={{ color: C.danger }}>¿Eliminar este cliente?</span>
                        <button onClick={() => eliminarCliente(c.id)} className="underline" style={{ color: C.danger }}>Sí, eliminar</button>
                        <button onClick={() => setConfirmDelete(null)} style={{ color: C.textMuted }}>Cancelar</button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmDelete(`cliente:${c.id}`)} className="text-xs self-start mt-1 flex items-center gap-1" style={{ color: C.textFaint }}>
                        <Trash2 size={12} /> Eliminar cliente
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function PreciosTab({ categorias, updateCategoriaCosto, nuevaCategoriaNombre, setNuevaCategoriaNombre, addCategoria }) {
  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-xl p-4" style={{ backgroundColor: C.card, border: `1px solid ${C.cardBorder}` }}>
        <h2 className="text-base font-bold mb-1">Precio de costo por cajón</h2>
        <p className="text-xs mb-3" style={{ color: C.textMuted }}>Lo que a vos te sale comprar cada cajón, por categoría.</p>
        <div className="flex flex-col gap-2">
          {categorias.map((cat) => (
            <div key={cat.id} className="flex items-center justify-between gap-2">
              <span className="text-sm flex-1">{cat.nombre}</span>
              <input
                type="number" min="0" inputMode="numeric"
                value={cat.precioCosto}
                onChange={(e) => updateCategoriaCosto(cat.id, e.target.value)}
                className="w-28 px-2 py-1.5 rounded text-sm text-right" style={inputStyle()}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl p-4" style={{ backgroundColor: C.card, border: `1px solid ${C.cardBorder}` }}>
        <h2 className="text-base font-bold mb-3">Agregar categoría</h2>
        <div className="flex gap-2">
          <input placeholder="Ej: Jumbo" value={nuevaCategoriaNombre} onChange={(e) => setNuevaCategoriaNombre(e.target.value)} className="flex-1 px-3 py-2 rounded text-sm" style={inputStyle()} />
          <button onClick={addCategoria} className="px-4 rounded font-bold text-sm" style={{ backgroundColor: C.accent, color: '#2A2010' }}>
            <Plus size={16} />
          </button>
        </div>
      </section>
    </div>
  );
}

function resumenPorMes(pedidos) {
  const map = {};
  pedidos.forEach((p) => {
    const mes = p.fecha.slice(0, 7); // YYYY-MM
    if (!map[mes]) map[mes] = { costo: 0, venta: 0, ganancia: 0 };
    map[mes].costo += p.totalCosto;
    map[mes].venta += p.totalVenta;
    map[mes].ganancia += p.totalGanancia;
  });
  return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]));
}

function formatMes(key) {
  const [y, m] = key.split('-');
  const d = new Date(Number(y), Number(m) - 1, 1);
  const label = d.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function ResumenTab({ resumenPeriodo, setResumenPeriodo, totales, deudaTotal, clientesConDeuda, pedidosFiltradosResumen, pedidos }) {
  const meses = useMemo(() => resumenPorMes(pedidos), [pedidos]);
  const periodos = [
    { id: 'hoy', label: 'Hoy' },
    { id: 'semana', label: '7 días' },
    { id: 'mes', label: '30 días' },
    { id: 'todo', label: 'Todo' },
  ];
  return (
    <div className="flex flex-col gap-6">
      <section>
        <div className="flex gap-2 mb-4">
          {periodos.map((p) => (
            <button
              key={p.id}
              onClick={() => setResumenPeriodo(p.id)}
              className="flex-1 py-2 rounded-lg text-xs font-medium"
              style={{
                backgroundColor: resumenPeriodo === p.id ? C.accentSoft : 'transparent',
                color: resumenPeriodo === p.id ? C.accent : C.textMuted,
                border: `1px solid ${resumenPeriodo === p.id ? C.accentDark : C.cardBorder}`,
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="rounded-xl p-4 grid grid-cols-3 gap-2 text-center mb-3" style={{ backgroundColor: C.paper }}>
          <div>
            <p className="text-xs" style={{ color: '#5c5236' }}>Costo total</p>
            <p className="font-bold" style={{ color: '#2A2415' }}>{formatMoney(totales.costo)}</p>
          </div>
          <div>
            <p className="text-xs" style={{ color: '#5c5236' }}>Venta total</p>
            <p className="font-bold" style={{ color: '#2A2415' }}>{formatMoney(totales.venta)}</p>
          </div>
          <div>
            <p className="text-xs" style={{ color: '#5c5236' }}>Ganancia</p>
            <p className="font-bold" style={{ color: C.accentDark }}>{formatMoney(totales.ganancia)}</p>
          </div>
        </div>

        <p className="text-xs" style={{ color: C.textMuted }}>{pedidosFiltradosResumen.length} pedido{pedidosFiltradosResumen.length !== 1 ? 's' : ''} en este período</p>
      </section>

      <section className="rounded-xl p-4" style={{ backgroundColor: C.dangerBg, border: `1px solid ${C.dangerBorder}` }}>
        <h2 className="text-base font-bold mb-1" style={{ color: C.danger }}>Deuda total pendiente</h2>
        <p className="text-2xl font-bold mb-3" style={{ color: C.danger }}>{formatMoney(deudaTotal)}</p>
        {clientesConDeuda.length === 0 ? (
          <p className="text-sm" style={{ color: C.textMuted }}>Ningún cliente tiene deuda pendiente.</p>
        ) : (
          <div className="flex flex-col gap-1">
            {clientesConDeuda.map((c) => (
              <div key={c.id} className="flex justify-between text-sm">
                <span>{c.nombre}</span>
                <span className="font-semibold" style={{ color: C.danger }}>{formatMoney(c.deuda)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-base font-bold mb-1">Resumen mensual</h2>
        <p className="text-xs mb-3" style={{ color: C.textMuted }}>Cada mes va del día 1 al último día de ese mes calendario.</p>
        {meses.length === 0 ? (
          <p className="text-sm" style={{ color: C.textMuted }}>Todavía no hay pedidos cargados.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {meses.map(([key, m]) => (
              <div key={key} className="rounded-lg p-3" style={{ backgroundColor: C.card, border: `1px solid ${C.cardBorder}` }}>
                <p className="text-sm font-bold mb-2" style={{ color: C.accent }}>{formatMes(key)}</p>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-xs" style={{ color: C.textMuted }}>Costo (a pagar al proveedor)</p>
                    <p className="font-bold text-sm">{formatMoney(m.costo)}</p>
                  </div>
                  <div>
                    <p className="text-xs" style={{ color: C.textMuted }}>Venta total</p>
                    <p className="font-bold text-sm">{formatMoney(m.venta)}</p>
                  </div>
                  <div>
                    <p className="text-xs" style={{ color: C.textMuted }}>Ganancia</p>
                    <p className="font-bold text-sm" style={{ color: C.success }}>{formatMoney(m.ganancia)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
