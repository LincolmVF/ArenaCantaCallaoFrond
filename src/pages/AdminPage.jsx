import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Package,
  TrendingUp,
  BarChart3,
  Download,
  Upload,
  Plus,
  Pencil,
  Trash2,
  Printer,
  LogOut,
  Store,
  Zap,
  Check,
  X,
  RotateCcw,
  Image as ImageIcon,
  AlertTriangle,
  ClipboardList,
  Minus,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

const EMPTY_PRODUCT = {
  sku: '',
  name: '',
  description: '',
  category: 'Abarrotes',
  unit: 'unidad',
  basePrice: '',
  stock: 0,
  imageUrl: '',
  isActive: true,
  overrideGlobalPrice: false,
  individualMarkupPct: 0,
};

function ThumbImage({ src, alt }) {
  const [err, setErr] = useState(false);
  if (!src || err) {
    return (
      <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
        <ImageIcon className="w-4 h-4" />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      onError={() => setErr(true)}
      className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0"
    />
  );
}

function SortableHeader({ label, sortKey, sortState, onSort, align = 'left' }) {
  const isActive = sortState.key === sortKey;
  return (
    <th
      onClick={() => onSort(sortKey)}
      className={`p-3 cursor-pointer select-none hover:bg-slate-100 transition ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
    >
      <div
        className={`inline-flex items-center gap-1.5 ${
          align === 'right' ? 'justify-end' : 'justify-start'
        }`}
      >
        <span>{label}</span>
        {isActive ? (
          sortState.dir === 'asc' ? (
            <ArrowUp className="w-3.5 h-3.5 text-slate-900" />
          ) : (
            <ArrowDown className="w-3.5 h-3.5 text-slate-900" />
          )
        ) : (
          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
        )}
      </div>
    </th>
  );
}

function applySortAndFilter(rows, filters, sortState, accessors) {
  const filtered = rows.filter((row) =>
    Object.entries(filters).every(([key, query]) => {
      if (!query || String(query).trim() === '') return true;
      const raw = accessors[key] ? accessors[key](row) : row[key];
      return String(raw ?? '')
        .toLowerCase()
        .includes(String(query).trim().toLowerCase());
    })
  );

  if (!sortState.key) return filtered;

  return [...filtered].sort((a, b) => {
    const valA = accessors[sortState.key] ? accessors[sortState.key](a) : a[sortState.key];
    const valB = accessors[sortState.key] ? accessors[sortState.key](b) : b[sortState.key];

    if (typeof valA === 'number' && typeof valB === 'number') {
      return sortState.dir === 'asc' ? valA - valB : valB - valA;
    }
    const strA = String(valA ?? '');
    const strB = String(valB ?? '');
    return sortState.dir === 'asc'
      ? strA.localeCompare(strB, 'es', { numeric: true })
      : strB.localeCompare(strA, 'es', { numeric: true });
  });
}

export default function AdminPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('inventory'); // 'inventory' | 'pricing' | 'reports'
  const [products, setProducts] = useState([]);
  const [pricingConfig, setPricingConfig] = useState({
    globalMarkupActive: false,
    globalMarkupPct: 10,
    label: 'Aumento Temporal General',
  });

  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  // Modal Producto
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formProduct, setFormProduct] = useState(EMPTY_PRODUCT);

  // Modal de Confirmación Personalizado (reemplaza window.confirm)
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    title: '',
    message: '',
    confirmLabel: 'Confirmar',
    variant: 'danger',
    onConfirm: null,
  });

  // Precios Dinámicos por Categoría
  const [selectedPricingCat, setSelectedPricingCat] = useState('');
  const [catMarkupPct, setCatMarkupPct] = useState(10);
  const [pricingFilterCat, setPricingFilterCat] = useState('Todas');

  // Reportes Dinámicos
  const todayStr = new Date().toISOString().slice(0, 10);
  const currentMonthStr = todayStr.slice(0, 7);
  const [reportFilter, setReportFilter] = useState({
    mode: 'all', // Por defecto muestra todos los registros del más reciente al más antiguo
    date: todayStr,
    week: '',
    month: currentMonthStr,
    from: todayStr,
    to: todayStr,
  });
  const [reportData, setReportData] = useState(null);

  // Asientos / Movimientos de Compras
  const [ordersList, setOrdersList] = useState([]);
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('ALL');
  const [editingOrder, setEditingOrder] = useState(null);

  // Estados de ordenamiento y filtros por columna para todas las tablas
  const toggleSort = (setter) => (key) =>
    setter((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: 'asc' }
    );

  const [invSort, setInvSort] = useState({ key: 'id', dir: 'desc' });
  const [invFilters, setInvFilters] = useState({});

  const [priceSort, setPriceSort] = useState({ key: 'name', dir: 'asc' });
  const [priceFilters, setPriceFilters] = useState({});

  const [repOrdSort, setRepOrdSort] = useState({ key: 'createdAt', dir: 'desc' });
  const [repOrdFilters, setRepOrdFilters] = useState({});

  const [movSort, setMovSort] = useState({ key: 'createdAt', dir: 'desc' });
  const [movFilters, setMovFilters] = useState({});

  const notify = (type, text) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback({ type: '', text: '' }), 5000);
  };

  const loadProductsAndPricing = async () => {
    try {
      setLoading(true);
      const data = await api.getAdminProducts();
      setProducts(data.products || []);
      if (data.pricingConfig) {
        setPricingConfig(data.pricingConfig);
      }
    } catch (err) {
      notify('error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadReport = async (filter = reportFilter) => {
    try {
      const data = await api.getSalesReport(filter);
      setReportData(data);
    } catch (err) {
      notify('error', err.message);
    }
  };

  const loadOrders = async (status = orderStatusFilter, search = orderSearch) => {
    try {
      const data = await api.getAdminOrders({ status, search });
      setOrdersList(data.orders || []);
    } catch (err) {
      notify('error', err.message);
    }
  };

  useEffect(() => {
    if (!user || user.role !== 'ADMIN') {
      navigate('/login');
      return;
    }
    loadProductsAndPricing();
  }, [user, navigate]);

  useEffect(() => {
    if (activeTab === 'reports') {
      loadReport(reportFilter);
    }
    if (activeTab === 'movements') {
      loadOrders(orderStatusFilter, orderSearch);
    }
  }, [activeTab, reportFilter, orderStatusFilter]);

  // CRUD Producto
  const openCreateModal = () => {
    setEditingId(null);
    setFormProduct(EMPTY_PRODUCT);
    setShowModal(true);
  };

  const openEditModal = (product) => {
    setEditingId(product.id);
    setFormProduct({
      sku: product.sku,
      name: product.name,
      description: product.description || '',
      category: product.category,
      unit: product.unit,
      basePrice: product.basePrice,
      stock: product.stock,
      imageUrl: product.imageUrl || '',
      isActive: product.isActive,
      overrideGlobalPrice: product.overrideGlobalPrice,
      individualMarkupPct: product.individualMarkupPct,
    });
    setShowModal(true);
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await api.updateProduct(editingId, formProduct);
        notify('success', 'Producto actualizado correctamente.');
      } else {
        await api.createProduct(formProduct);
        notify('success', 'Producto creado correctamente.');
      }
      setShowModal(false);
      await loadProductsAndPricing();
    } catch (err) {
      notify('error', err.message);
    }
  };

  const handleDeleteProduct = (id, name) => {
    setConfirmDialog({
      open: true,
      title: 'Eliminar Producto',
      message: `¿Estás seguro de que deseas eliminar "${name}" del inventario? Si tiene ventas asociadas, se desactivará automáticamente.`,
      confirmLabel: 'Sí, Eliminar',
      variant: 'danger',
      onConfirm: async () => {
        try {
          const res = await api.deleteProduct(id);
          notify('success', res.message || 'Producto eliminado.');
          await loadProductsAndPricing();
        } catch (err) {
          notify('error', err.message);
        }
      },
    });
  };

  // Excel Carga Masiva
  const handleDownloadTemplate = async () => {
    try {
      await api.downloadExcelTemplate();
    } catch (err) {
      notify('error', err.message);
    }
  };

  const handleUploadExcel = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await api.uploadExcel(file);
      const errMsg =
        res.errors?.length > 0 ? ` (${res.errors.length} filas omitidas por error)` : '';
      notify(
        'success',
        `Excel procesado: ${res.summary.created} creados, ${res.summary.updated} actualizados${errMsg}.`
      );
      await loadProductsAndPricing();
    } catch (err) {
      notify('error', err.message);
    } finally {
      e.target.value = '';
    }
  };

  // Motor de Precios Dinámicos
  const handleToggleGlobalPricing = async () => {
    try {
      const nextActive = !pricingConfig.globalMarkupActive;
      const res = await api.updateGlobalPricing({
        globalMarkupActive: nextActive,
        globalMarkupPct: Number(pricingConfig.globalMarkupPct),
        label: pricingConfig.label,
      });
      setPricingConfig(res.pricingConfig);
      notify('success', res.message);
      await loadProductsAndPricing();
    } catch (err) {
      notify('error', err.message);
    }
  };

  const handleSaveGlobalPct = async (e) => {
    e.preventDefault();
    try {
      const res = await api.updateGlobalPricing({
        globalMarkupActive: pricingConfig.globalMarkupActive,
        globalMarkupPct: Number(pricingConfig.globalMarkupPct),
        label: pricingConfig.label,
      });
      setPricingConfig(res.pricingConfig);
      notify('success', 'Porcentaje global actualizado.');
      await loadProductsAndPricing();
    } catch (err) {
      notify('error', err.message);
    }
  };

  const handleSaveProductOverride = async (productId, overrideGlobalPrice, individualMarkupPct) => {
    try {
      await api.updateProductPricing(productId, {
        overrideGlobalPrice,
        individualMarkupPct: Number(individualMarkupPct),
      });
      notify('success', 'Regla individual aplicada.');
      await loadProductsAndPricing();
    } catch (err) {
      notify('error', err.message);
    }
  };

  const handleResetAllIndividuals = () => {
    setConfirmDialog({
      open: true,
      title: 'Desactivar Reglas Individuales',
      message:
        '¿Desactivar todas las reglas individuales activas? Todos los productos volverán a seguir la regla general de precios.',
      confirmLabel: 'Sí, Desactivar Todas',
      variant: 'danger',
      onConfirm: async () => {
        try {
          const res = await api.resetIndividualPricing();
          notify('success', res.message);
          await loadProductsAndPricing();
        } catch (err) {
          notify('error', err.message);
        }
      },
    });
  };

  const handleApplyCategoryPricing = async (active) => {
    const targetCat = selectedPricingCat || categories[0];
    if (!targetCat) return;
    try {
      const res = await api.updateCategoryPricing({
        category: targetCat,
        overrideGlobalPrice: active,
        individualMarkupPct: active ? Number(catMarkupPct) : 0,
      });
      notify('success', res.message);
      await loadProductsAndPricing();
    } catch (err) {
      notify('error', err.message);
    }
  };

  const handleExportReportExcel = async () => {
    try {
      await api.downloadSalesReportExcel(reportFilter);
    } catch (err) {
      notify('error', err.message);
    }
  };

  const handleSaveEditedOrder = async (e) => {
    e.preventDefault();
    if (!editingOrder) return;
    try {
      const res = await api.updateAdminOrder(editingOrder.id, {
        paymentMethod: editingOrder.paymentMethod,
        items: editingOrder.items.map((it) => ({
          productId: it.productId,
          quantity: it.quantity,
        })),
      });
      notify('success', res.message);
      setEditingOrder(null);
      await loadOrders(orderStatusFilter, orderSearch);
      await loadProductsAndPricing();
    } catch (err) {
      notify('error', err.message);
    }
  };

  const handleRevertOrder = (ord) => {
    setConfirmDialog({
      open: true,
      title: `Revertir Operación ${ord.orderNumber}`,
      message: `¿Deseas anular esta venta por S/ ${ord.totalAmount.toFixed(
        2
      )}? El stock de sus ${ord.itemsCount} productos será devuelto automáticamente al inventario y dejará de contar en los reportes.`,
      confirmLabel: 'Sí, Revertir Venta',
      variant: 'danger',
      onConfirm: async () => {
        try {
          const res = await api.revertAdminOrder(ord.id);
          notify('success', res.message);
          await loadOrders(orderStatusFilter, orderSearch);
          await loadProductsAndPricing();
        } catch (err) {
          notify('error', err.message);
        }
      },
    });
  };

  const categories = Array.from(new Set(products.map((p) => p.category))).sort();
  const filteredPricingProducts = applySortAndFilter(
    pricingFilterCat === 'Todas'
      ? products
      : products.filter((p) => p.category === pricingFilterCat),
    priceFilters,
    priceSort,
    {
      name: (p) => p.name,
      category: (p) => p.category,
      basePrice: (p) => Number(p.basePrice),
      individualMarkupPct: (p) => Number(p.individualMarkupPct),
      activeRule: (p) => p.activeRule,
      effectivePrice: (p) => Number(p.effectivePrice),
    }
  );

  const displayedInventory = applySortAndFilter(products, invFilters, invSort, {
    id: (p) => p.id,
    sku: (p) => p.sku,
    name: (p) => p.name,
    category: (p) => p.category,
    basePrice: (p) => Number(p.basePrice),
    effectivePrice: (p) => Number(p.effectivePrice),
    stock: (p) => Number(p.stock),
    isActive: (p) => (p.isActive ? 'activo' : 'inactivo'),
  });

  const displayedReportOrders = applySortAndFilter(
    reportData?.orders || [],
    repOrdFilters,
    repOrdSort,
    {
      orderNumber: (o) => o.orderNumber,
      createdAt: (o) => new Date(o.createdAt).getTime(),
      createdAtText: (o) => new Date(o.createdAt).toLocaleString('es-PE'),
      itemsCount: (o) => Number(o.itemsCount),
      paymentMethod: (o) => o.paymentMethod,
      totalAmount: (o) => Number(o.totalAmount),
    }
  );

  const displayedMovements = applySortAndFilter(ordersList, movFilters, movSort, {
    orderNumber: (o) => o.orderNumber,
    createdAt: (o) => new Date(o.createdAt).getTime(),
    createdAtText: (o) => new Date(o.createdAt).toLocaleString('es-PE'),
    itemsText: (o) => o.items.map((it) => `${it.quantity}x ${it.productName}`).join(' '),
    paymentMethod: (o) => o.paymentMethod,
    status: (o) => (o.status === 'CANCELLED' ? 'revertida' : 'completada'),
    totalAmount: (o) => Number(o.totalAmount),
  });
  const activeIndividualCount = products.filter((p) => p.overrideGlobalPrice).length;

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Navbar Admin */}
      <header className="no-print bg-slate-900 text-white px-6 py-4 flex flex-wrap items-center justify-between gap-4 shadow">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">
              CRM & Backoffice — Arena Canta Callao
            </h1>
            <p className="text-xs text-slate-400">Administrador: {user?.fullName}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 px-4 py-2 rounded-xl text-sm font-bold transition"
          >
            <Store className="w-4 h-4" />
            Vista Kiosco
          </Link>
          <button
            onClick={() => {
              logout();
              navigate('/login');
            }}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 px-3 py-2 rounded-xl text-sm font-semibold"
          >
            <LogOut className="w-4 h-4" />
            Salir
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6 print-container">
        {/* Pestañas */}
        <div className="no-print flex flex-wrap gap-2 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm w-fit">
          <button
            onClick={() => setActiveTab('inventory')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition ${
              activeTab === 'inventory'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Package className="w-4 h-4" />
            Inventario & Excel
          </button>
          <button
            onClick={() => setActiveTab('pricing')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition ${
              activeTab === 'pricing'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            Precios Dinámicos
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition ${
              activeTab === 'reports'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Dashboard & Reportes
          </button>
          <button
            onClick={() => setActiveTab('movements')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition ${
              activeTab === 'movements'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            Asientos / Movimientos
          </button>
        </div>

        {/* Notificaciones */}
        {feedback.text && (
          <div
            className={`no-print px-4 py-3 rounded-xl font-semibold text-sm border ${
              feedback.type === 'error'
                ? 'bg-red-50 border-red-200 text-red-700'
                : 'bg-emerald-50 border-emerald-200 text-emerald-800'
            }`}
          >
            {feedback.text}
          </div>
        )}

        {/* TAB 1: INVENTARIO Y CARGA MASIVA EXCEL */}
        {activeTab === 'inventory' && (
          <section className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-wrap items-center justify-between gap-4 shadow-sm">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Gestión de Inventario</h2>
                <p className="text-sm text-slate-500">
                  En la plantilla Excel solo las columnas en{' '}
                  <span className="bg-yellow-200 text-slate-900 font-bold px-1.5 py-0.5 rounded">
                    amarillo
                  </span>{' '}
                  (<code>name</code>, <code>category</code>, <code>basePrice</code>,{' '}
                  <code>stock</code>) son obligatorias; las demás se completan por defecto.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleDownloadTemplate}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-sm"
                >
                  <Download className="w-4 h-4" />
                  Plantilla Excel
                </button>
                <label className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm cursor-pointer">
                  <Upload className="w-4 h-4" />
                  Cargar Excel / CSV
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleUploadExcel}
                    className="hidden"
                  />
                </label>
                <button
                  onClick={openCreateModal}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm"
                >
                  <Plus className="w-4 h-4" />
                  Nuevo Producto
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500">
                    <SortableHeader label="SKU" sortKey="sku" sortState={invSort} onSort={toggleSort(setInvSort)} />
                    <SortableHeader label="Producto" sortKey="name" sortState={invSort} onSort={toggleSort(setInvSort)} />
                    <SortableHeader label="Categoría" sortKey="category" sortState={invSort} onSort={toggleSort(setInvSort)} />
                    <SortableHeader label="Precio Base" sortKey="basePrice" sortState={invSort} onSort={toggleSort(setInvSort)} />
                    <SortableHeader label="Precio Kiosco" sortKey="effectivePrice" sortState={invSort} onSort={toggleSort(setInvSort)} />
                    <SortableHeader label="Stock" sortKey="stock" sortState={invSort} onSort={toggleSort(setInvSort)} />
                    <SortableHeader label="Estado" sortKey="isActive" sortState={invSort} onSort={toggleSort(setInvSort)} />
                    <th className="p-3 text-right">Acciones</th>
                  </tr>
                  <tr className="bg-slate-50/70 border-b border-slate-200">
                    <th className="px-3 py-2">
                      <input
                        type="text"
                        placeholder="Filtrar SKU..."
                        value={invFilters.sku || ''}
                        onChange={(e) => setInvFilters({ ...invFilters, sku: e.target.value })}
                        className="w-full px-2 py-1 text-xs rounded-lg border border-slate-200 bg-white font-normal"
                      />
                    </th>
                    <th className="px-3 py-2">
                      <input
                        type="text"
                        placeholder="Filtrar nombre..."
                        value={invFilters.name || ''}
                        onChange={(e) => setInvFilters({ ...invFilters, name: e.target.value })}
                        className="w-full px-2 py-1 text-xs rounded-lg border border-slate-200 bg-white font-normal"
                      />
                    </th>
                    <th className="px-3 py-2">
                      <input
                        type="text"
                        placeholder="Categoría..."
                        value={invFilters.category || ''}
                        onChange={(e) => setInvFilters({ ...invFilters, category: e.target.value })}
                        className="w-full px-2 py-1 text-xs rounded-lg border border-slate-200 bg-white font-normal"
                      />
                    </th>
                    <th className="px-3 py-2" colSpan={3} />
                    <th className="px-3 py-2">
                      <select
                        value={invFilters.isActive || ''}
                        onChange={(e) => setInvFilters({ ...invFilters, isActive: e.target.value })}
                        className="w-full px-2 py-1 text-xs rounded-lg border border-slate-200 bg-white font-normal"
                      >
                        <option value="">Todos</option>
                        <option value="activo">Activo</option>
                        <option value="inactivo">Inactivo</option>
                      </select>
                    </th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {loading ? (
                    <tr>
                      <td colSpan="8" className="p-8 text-center text-slate-400">
                        Cargando inventario...
                      </td>
                    </tr>
                  ) : (
                    displayedInventory.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="p-4 font-mono text-xs font-bold text-slate-600">{p.sku}</td>
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <ThumbImage src={p.imageUrl} alt={p.name} />
                            <span className="font-bold text-slate-900">{p.name}</span>
                          </div>
                        </td>
                        <td className="p-4 text-slate-600">{p.category}</td>
                        <td className="p-4 font-semibold">S/ {p.basePrice.toFixed(2)}</td>
                        <td className="p-4 font-black text-emerald-700">
                          S/ {p.effectivePrice.toFixed(2)}
                        </td>
                        <td className="p-4">
                          <span
                            className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                              p.stock <= 5
                                ? 'bg-red-100 text-red-700'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {p.stock} {p.unit}
                          </span>
                        </td>
                        <td className="p-4">
                          {p.isActive ? (
                            <span className="text-emerald-700 font-bold text-xs">Activo</span>
                          ) : (
                            <span className="text-slate-400 font-bold text-xs">Inactivo</span>
                          )}
                        </td>
                        <td className="p-4 text-right space-x-2">
                          <button
                            onClick={() => openEditModal(p)}
                            className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
                            title="Editar"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteProduct(p.id, p.name)}
                            className="p-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-600"
                            title="Eliminar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* TAB 2: MOTOR DE PRECIOS DINÁMICOS */}
        {activeTab === 'pricing' && (
          <section className="space-y-6">
            {/* Nivel 1 y 2: Global + Por Categoría en Grid Ordenado */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Control Global */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between gap-5">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Zap
                      className={`w-5 h-5 ${
                        pricingConfig.globalMarkupActive ? 'text-amber-500' : 'text-slate-400'
                      }`}
                    />
                    <h2 className="text-lg font-bold text-slate-900">
                      1. Regla Global (Todo el Catálogo)
                    </h2>
                  </div>
                  <p className="text-sm text-slate-500">
                    Aplica un aumento porcentual temporal a todos los productos que no tengan
                    excepción individual.
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
                  <form onSubmit={handleSaveGlobalPct} className="flex items-center gap-2">
                    <label className="text-xs font-bold uppercase text-slate-500">% Global:</label>
                    <input
                      type="number"
                      step="0.5"
                      value={pricingConfig.globalMarkupPct}
                      onChange={(e) =>
                        setPricingConfig((prev) => ({ ...prev, globalMarkupPct: e.target.value }))
                      }
                      className="w-20 px-2.5 py-2 rounded-xl border border-slate-300 font-bold text-center text-sm"
                    />
                    <button
                      type="submit"
                      className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold"
                    >
                      Guardar
                    </button>
                  </form>

                  <button
                    onClick={handleToggleGlobalPricing}
                    className={`px-4 py-2.5 rounded-xl font-bold text-xs transition shadow-sm ${
                      pricingConfig.globalMarkupActive
                        ? 'bg-amber-500 hover:bg-amber-600 text-white'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    }`}
                  >
                    {pricingConfig.globalMarkupActive
                      ? `DESACTIVAR Global (+${pricingConfig.globalMarkupPct}%)`
                      : `ACTIVAR Global (+${pricingConfig.globalMarkupPct}%)`}
                  </button>
                </div>
              </div>

              {/* Control por Categoría */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between gap-5">
                <div className="space-y-1">
                  <h2 className="text-lg font-bold text-slate-900">
                    2. Regla por Categoría
                  </h2>
                  <p className="text-sm text-slate-500">
                    Aplica o quita un porcentaje específico a todos los productos de una categoría en
                    un solo paso.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-slate-100">
                  <select
                    value={selectedPricingCat || categories[0] || ''}
                    onChange={(e) => setSelectedPricingCat(e.target.value)}
                    className="px-3 py-2 rounded-xl border border-slate-300 text-sm font-bold bg-white"
                  >
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    step="0.5"
                    value={catMarkupPct}
                    onChange={(e) => setCatMarkupPct(e.target.value)}
                    className="w-20 px-2.5 py-2 rounded-xl border border-slate-300 font-bold text-center text-sm"
                    title="Porcentaje %"
                  />
                  <button
                    type="button"
                    onClick={() => handleApplyCategoryPricing(true)}
                    className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold"
                  >
                    Aplicar %
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyCategoryPricing(false)}
                    className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
                  >
                    Quitar
                  </button>
                </div>
              </div>
            </div>

            {/* Nivel 3: Excepciones Individuales */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
              <div className="p-5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="font-bold text-slate-900">
                    3. Excepciones Individuales por Producto
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Los productos con &quot;Sobresalir Global&quot; activo usan su porcentaje propio
                    por encima de la regla general.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <select
                    value={pricingFilterCat}
                    onChange={(e) => setPricingFilterCat(e.target.value)}
                    className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold bg-white"
                  >
                    <option value="Todas">Todas las categorías</option>
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={handleResetAllIndividuals}
                    disabled={activeIndividualCount === 0}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs transition"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Desactivar Todos los Individuales ({activeIndividualCount})
                  </button>
                </div>
              </div>

              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500">
                    <SortableHeader label="Producto" sortKey="name" sortState={priceSort} onSort={toggleSort(setPriceSort)} />
                    <SortableHeader label="Categoría" sortKey="category" sortState={priceSort} onSort={toggleSort(setPriceSort)} />
                    <SortableHeader label="Precio Base" sortKey="basePrice" sortState={priceSort} onSort={toggleSort(setPriceSort)} />
                    <th className="p-3">Sobresalir Global</th>
                    <SortableHeader label="% Individual" sortKey="individualMarkupPct" sortState={priceSort} onSort={toggleSort(setPriceSort)} />
                    <SortableHeader label="Regla Activa" sortKey="activeRule" sortState={priceSort} onSort={toggleSort(setPriceSort)} />
                    <SortableHeader label="Precio Final" sortKey="effectivePrice" sortState={priceSort} onSort={toggleSort(setPriceSort)} />
                    <th className="p-3 text-right">Aplicar</th>
                  </tr>
                  <tr className="bg-slate-50/70 border-b border-slate-200">
                    <th className="px-3 py-2">
                      <input
                        type="text"
                        placeholder="Filtrar producto..."
                        value={priceFilters.name || ''}
                        onChange={(e) => setPriceFilters({ ...priceFilters, name: e.target.value })}
                        className="w-full px-2 py-1 text-xs rounded-lg border border-slate-200 bg-white font-normal"
                      />
                    </th>
                    <th className="px-3 py-2">
                      <input
                        type="text"
                        placeholder="Categoría..."
                        value={priceFilters.category || ''}
                        onChange={(e) => setPriceFilters({ ...priceFilters, category: e.target.value })}
                        className="w-full px-2 py-1 text-xs rounded-lg border border-slate-200 bg-white font-normal"
                      />
                    </th>
                    <th colSpan={3} />
                    <th className="px-3 py-2">
                      <select
                        value={priceFilters.activeRule || ''}
                        onChange={(e) => setPriceFilters({ ...priceFilters, activeRule: e.target.value })}
                        className="w-full px-2 py-1 text-xs rounded-lg border border-slate-200 bg-white font-normal"
                      >
                        <option value="">Todas</option>
                        <option value="BASE">BASE</option>
                        <option value="GLOBAL">GLOBAL</option>
                        <option value="INDIVIDUAL">INDIVIDUAL</option>
                      </select>
                    </th>
                    <th colSpan={2} />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredPricingProducts.map((p) => (
                    <PricingRow
                      key={p.id}
                      product={p}
                      onSave={handleSaveProductOverride}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* TAB 3: DASHBOARD & REPORTES IMPRIMIBLES + EXCEL */}
        {activeTab === 'reports' && (
          <section className="space-y-6">
            <div className="no-print bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  {[
                    { id: 'day', label: 'Por Día' },
                    { id: 'week', label: 'Por Semana' },
                    { id: 'month', label: 'Por Mes' },
                    { id: 'custom', label: 'Rango Fechas' },
                    { id: 'all', label: 'Todo el Histórico' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => setReportFilter((prev) => ({ ...prev, mode: opt.id }))}
                      className={`px-4 py-2 rounded-xl font-bold text-sm transition ${
                        reportFilter.mode === opt.id
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={handleExportReportExcel}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm"
                  >
                    <Download className="w-4 h-4" />
                    Excel Más Vendidos
                  </button>
                  <button
                    onClick={() => window.print()}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm"
                  >
                    <Printer className="w-4 h-4" />
                    Imprimir Reporte
                  </button>
                </div>
              </div>

              {/* Selectores dinámicos según el modo */}
              <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-100">
                {reportFilter.mode === 'day' && (
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-bold uppercase text-slate-500">
                      Seleccionar Día:
                    </label>
                    <input
                      type="date"
                      value={reportFilter.date}
                      onChange={(e) =>
                        setReportFilter((prev) => ({ ...prev, date: e.target.value }))
                      }
                      className="px-3 py-2 rounded-xl border border-slate-300 text-sm font-semibold"
                    />
                  </div>
                )}

                {reportFilter.mode === 'week' && (
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-bold uppercase text-slate-500">
                      Seleccionar Semana:
                    </label>
                    <input
                      type="week"
                      value={reportFilter.week}
                      onChange={(e) =>
                        setReportFilter((prev) => ({ ...prev, week: e.target.value }))
                      }
                      className="px-3 py-2 rounded-xl border border-slate-300 text-sm font-semibold"
                    />
                    <span className="text-xs text-slate-400">
                      (Vacío = últimos 7 días)
                    </span>
                  </div>
                )}

                {reportFilter.mode === 'month' && (
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-bold uppercase text-slate-500">
                      Seleccionar Mes:
                    </label>
                    <input
                      type="month"
                      value={reportFilter.month}
                      onChange={(e) =>
                        setReportFilter((prev) => ({ ...prev, month: e.target.value }))
                      }
                      className="px-3 py-2 rounded-xl border border-slate-300 text-sm font-semibold"
                    />
                  </div>
                )}

                {reportFilter.mode === 'custom' && (
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-bold uppercase text-slate-500">Desde:</label>
                      <input
                        type="date"
                        value={reportFilter.from}
                        onChange={(e) =>
                          setReportFilter((prev) => ({ ...prev, from: e.target.value }))
                        }
                        className="px-3 py-2 rounded-xl border border-slate-300 text-sm font-semibold"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-bold uppercase text-slate-500">Hasta:</label>
                      <input
                        type="date"
                        value={reportFilter.to}
                        onChange={(e) =>
                          setReportFilter((prev) => ({ ...prev, to: e.target.value }))
                        }
                        className="px-3 py-2 rounded-xl border border-slate-300 text-sm font-semibold"
                      />
                    </div>
                  </div>
                )}

                {reportData?.label && (
                  <span className="ml-auto text-xs font-bold bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg">
                    Mostrando: {reportData.label}
                  </span>
                )}
              </div>
            </div>

            {reportData && (
              <div className="space-y-6">
                <div className="hidden print-only border-b pb-4 mb-4">
                  <h1 className="text-2xl font-black">
                    Arena Canta Callao — Reporte de Ventas ({reportData.label})
                  </h1>
                  <p className="text-sm text-slate-600">
                    Generado el: {new Date().toLocaleString('es-PE')}
                  </p>
                </div>

                {/* KPIs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                    <p className="text-xs font-bold uppercase text-slate-500">Ingresos Totales</p>
                    <p className="text-3xl font-black text-emerald-700 mt-1">
                      S/ {reportData.summary.totalRevenue.toFixed(2)}
                    </p>
                  </div>
                  <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                    <p className="text-xs font-bold uppercase text-slate-500">Órdenes Totales</p>
                    <p className="text-3xl font-black text-slate-900 mt-1">
                      {reportData.summary.totalOrders}
                    </p>
                  </div>
                  <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                    <p className="text-xs font-bold uppercase text-slate-500">Ítems Vendidos</p>
                    <p className="text-3xl font-black text-slate-900 mt-1">
                      {reportData.summary.totalItemsSold}
                    </p>
                  </div>
                  <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                    <p className="text-xs font-bold uppercase text-slate-500">Ticket Promedio</p>
                    <p className="text-3xl font-black text-slate-900 mt-1">
                      S/ {reportData.summary.averageTicket.toFixed(2)}
                    </p>
                  </div>
                </div>

                {/* Top Productos */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                  <h3 className="font-bold text-slate-900 mb-3">Productos Más Vendidos</h3>
                  {reportData.topProducts.length === 0 ? (
                    <p className="text-sm text-slate-400">Sin ventas en este periodo.</p>
                  ) : (
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b text-xs uppercase text-slate-500">
                          <th className="py-2">Producto</th>
                          <th className="py-2">Unidades</th>
                          <th className="py-2 text-right">Ingresos</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {reportData.topProducts.map((tp) => (
                          <tr key={tp.productName}>
                            <td className="py-2.5 font-bold">{tp.productName}</td>
                            <td className="py-2.5">{tp.quantity}</td>
                            <td className="py-2.5 text-right font-extrabold text-emerald-700">
                              S/ {tp.revenue.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Detalle de Órdenes (sin columna Cliente) */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm overflow-x-auto">
                  <h3 className="font-bold text-slate-900 mb-3">
                    Historial de Órdenes ({reportData.orders.length})
                  </h3>
                  {reportData.orders.length === 0 ? (
                    <p className="text-sm text-slate-400">No hay órdenes registradas.</p>
                  ) : (
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b text-xs uppercase text-slate-500">
                          <SortableHeader label="N° Orden" sortKey="orderNumber" sortState={repOrdSort} onSort={toggleSort(setRepOrdSort)} />
                          <SortableHeader label="Fecha" sortKey="createdAt" sortState={repOrdSort} onSort={toggleSort(setRepOrdSort)} />
                          <SortableHeader label="Ítems" sortKey="itemsCount" sortState={repOrdSort} onSort={toggleSort(setRepOrdSort)} />
                          <SortableHeader label="Pago" sortKey="paymentMethod" sortState={repOrdSort} onSort={toggleSort(setRepOrdSort)} />
                          <SortableHeader label="Total" sortKey="totalAmount" sortState={repOrdSort} onSort={toggleSort(setRepOrdSort)} align="right" />
                        </tr>
                        <tr className="no-print bg-slate-50/70 border-b border-slate-200">
                          <th className="px-2 py-1.5">
                            <input
                              type="text"
                              placeholder="Filtrar orden..."
                              value={repOrdFilters.orderNumber || ''}
                              onChange={(e) => setRepOrdFilters({ ...repOrdFilters, orderNumber: e.target.value })}
                              className="w-full px-2 py-1 text-xs rounded-lg border border-slate-200 bg-white font-normal"
                            />
                          </th>
                          <th className="px-2 py-1.5">
                            <input
                              type="text"
                              placeholder="Fecha..."
                              value={repOrdFilters.createdAtText || ''}
                              onChange={(e) => setRepOrdFilters({ ...repOrdFilters, createdAtText: e.target.value })}
                              className="w-full px-2 py-1 text-xs rounded-lg border border-slate-200 bg-white font-normal"
                            />
                          </th>
                          <th />
                          <th className="px-2 py-1.5">
                            <input
                              type="text"
                              placeholder="Pago..."
                              value={repOrdFilters.paymentMethod || ''}
                              onChange={(e) => setRepOrdFilters({ ...repOrdFilters, paymentMethod: e.target.value })}
                              className="w-full px-2 py-1 text-xs rounded-lg border border-slate-200 bg-white font-normal"
                            />
                          </th>
                          <th />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {displayedReportOrders.map((ord) => (
                          <tr key={ord.id}>
                            <td className="py-2.5 font-mono text-xs font-bold">{ord.orderNumber}</td>
                            <td className="py-2.5 text-slate-500">
                              {new Date(ord.createdAt).toLocaleString('es-PE')}
                            </td>
                            <td className="py-2.5">{ord.itemsCount}</td>
                            <td className="py-2.5 text-xs font-semibold">{ord.paymentMethod}</td>
                            <td className="py-2.5 text-right font-black">
                              S/ {ord.totalAmount.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}
          </section>
        )}

        {/* TAB 4: ASIENTOS / MOVIMIENTOS DE COMPRAS (EDICIÓN Y REVERSIÓN) */}
        {activeTab === 'movements' && (
          <section className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-wrap items-center justify-between gap-4 shadow-sm">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Asientos y Movimientos de Compras
                </h2>
                <p className="text-sm text-slate-500">
                  Audita, edita cantidades/método de pago o revierte operaciones devolviendo el
                  stock al inventario.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <input
                  type="text"
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') loadOrders(orderStatusFilter, orderSearch);
                  }}
                  placeholder="Buscar N° Orden..."
                  className="px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                />
                <select
                  value={orderStatusFilter}
                  onChange={(e) => setOrderStatusFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-slate-300 text-sm font-bold bg-white"
                >
                  <option value="ALL">Todos los estados</option>
                  <option value="COMPLETED">Completadas</option>
                  <option value="CANCELLED">Revertidas / Anuladas</option>
                </select>
                <button
                  onClick={() => loadOrders(orderStatusFilter, orderSearch)}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold"
                >
                  Buscar
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500">
                    <SortableHeader label="N° Orden" sortKey="orderNumber" sortState={movSort} onSort={toggleSort(setMovSort)} />
                    <SortableHeader label="Fecha" sortKey="createdAt" sortState={movSort} onSort={toggleSort(setMovSort)} />
                    <th className="p-3">Detalle de Productos</th>
                    <SortableHeader label="Pago" sortKey="paymentMethod" sortState={movSort} onSort={toggleSort(setMovSort)} />
                    <SortableHeader label="Estado" sortKey="status" sortState={movSort} onSort={toggleSort(setMovSort)} />
                    <SortableHeader label="Total" sortKey="totalAmount" sortState={movSort} onSort={toggleSort(setMovSort)} />
                    <th className="p-3 text-right">Acciones</th>
                  </tr>
                  <tr className="bg-slate-50/70 border-b border-slate-200">
                    <th className="px-3 py-2">
                      <input
                        type="text"
                        placeholder="Filtrar N°..."
                        value={movFilters.orderNumber || ''}
                        onChange={(e) => setMovFilters({ ...movFilters, orderNumber: e.target.value })}
                        className="w-full px-2 py-1 text-xs rounded-lg border border-slate-200 bg-white font-normal"
                      />
                    </th>
                    <th className="px-3 py-2">
                      <input
                        type="text"
                        placeholder="Fecha (dd/mm)..."
                        value={movFilters.createdAtText || ''}
                        onChange={(e) => setMovFilters({ ...movFilters, createdAtText: e.target.value })}
                        className="w-full px-2 py-1 text-xs rounded-lg border border-slate-200 bg-white font-normal"
                      />
                    </th>
                    <th className="px-3 py-2">
                      <input
                        type="text"
                        placeholder="Filtrar producto..."
                        value={movFilters.itemsText || ''}
                        onChange={(e) => setMovFilters({ ...movFilters, itemsText: e.target.value })}
                        className="w-full px-2 py-1 text-xs rounded-lg border border-slate-200 bg-white font-normal"
                      />
                    </th>
                    <th className="px-3 py-2">
                      <input
                        type="text"
                        placeholder="Pago..."
                        value={movFilters.paymentMethod || ''}
                        onChange={(e) => setMovFilters({ ...movFilters, paymentMethod: e.target.value })}
                        className="w-full px-2 py-1 text-xs rounded-lg border border-slate-200 bg-white font-normal"
                      />
                    </th>
                    <th className="px-3 py-2">
                      <select
                        value={movFilters.status || ''}
                        onChange={(e) => setMovFilters({ ...movFilters, status: e.target.value })}
                        className="w-full px-2 py-1 text-xs rounded-lg border border-slate-200 bg-white font-normal"
                      >
                        <option value="">Todos</option>
                        <option value="completada">COMPLETADA</option>
                        <option value="revertida">REVERTIDA</option>
                      </select>
                    </th>
                    <th colSpan={2} />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {displayedMovements.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="p-8 text-center text-slate-400">
                        No se encontraron movimientos registrados.
                      </td>
                    </tr>
                  ) : (
                    displayedMovements.map((ord) => {
                      const isCancelled = ord.status === 'CANCELLED';
                      return (
                        <tr
                          key={ord.id}
                          className={`hover:bg-slate-50 ${isCancelled ? 'opacity-65 bg-red-50/20' : ''}`}
                        >
                          <td className="p-4 font-mono text-xs font-bold text-slate-800">
                            {ord.orderNumber}
                          </td>
                          <td className="p-4 text-xs text-slate-500 whitespace-nowrap">
                            {new Date(ord.createdAt).toLocaleString('es-PE')}
                          </td>
                          <td className="p-4">
                            <ul className="space-y-0.5 text-xs text-slate-700">
                              {ord.items.map((it) => (
                                <li key={it.id}>
                                  <strong>{it.quantity}x</strong> {it.productName} (S/{' '}
                                  {it.unitPriceApplied.toFixed(2)})
                                </li>
                              ))}
                            </ul>
                          </td>
                          <td className="p-4 text-xs font-semibold text-slate-600">
                            {ord.paymentMethod}
                          </td>
                          <td className="p-4">
                            <span
                              className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                                isCancelled
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-emerald-100 text-emerald-700'
                              }`}
                            >
                              {isCancelled ? 'REVERTIDA' : 'COMPLETADA'}
                            </span>
                          </td>
                          <td className="p-4 font-black text-slate-900 whitespace-nowrap">
                            S/ {ord.totalAmount.toFixed(2)}
                          </td>
                          <td className="p-4 text-right whitespace-nowrap space-x-2">
                            <button
                              disabled={isCancelled}
                              onClick={() =>
                                setEditingOrder({
                                  ...ord,
                                  items: ord.items.map((it) => ({ ...it })),
                                })
                              }
                              className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700"
                              title="Editar movimiento"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              disabled={isCancelled}
                              onClick={() => handleRevertOrder(ord)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 disabled:opacity-40 text-red-700 font-bold text-xs"
                              title="Revertir operación y devolver stock"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              Revertir
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>

      {/* MODAL CREAR / EDITAR PRODUCTO */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-lg font-bold">
                {editingId ? 'Editar Producto' : 'Nuevo Producto'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-600">SKU *</label>
                  <input
                    required
                    value={formProduct.sku}
                    onChange={(e) => setFormProduct({ ...formProduct, sku: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                    placeholder="ACC-015"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600">Categoría *</label>
                  <input
                    required
                    value={formProduct.category}
                    onChange={(e) => setFormProduct({ ...formProduct, category: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600">Nombre *</label>
                <input
                  required
                  value={formProduct.name}
                  onChange={(e) => setFormProduct({ ...formProduct, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600">
                  URL de Imagen (https://...)
                </label>
                <input
                  type="url"
                  value={formProduct.imageUrl}
                  onChange={(e) => setFormProduct({ ...formProduct, imageUrl: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  placeholder="https://..."
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-600">Unidad</label>
                  <input
                    value={formProduct.unit}
                    onChange={(e) => setFormProduct({ ...formProduct, unit: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600">Precio Base (S/) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={formProduct.basePrice}
                    onChange={(e) => setFormProduct({ ...formProduct, basePrice: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600">Stock *</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formProduct.stock}
                    onChange={(e) => setFormProduct({ ...formProduct, stock: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm font-semibold pt-1">
                <input
                  type="checkbox"
                  checked={formProduct.isActive}
                  onChange={(e) => setFormProduct({ ...formProduct, isActive: e.target.checked })}
                />
                Visible en Kiosco (Activo)
              </label>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 font-bold text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* MODAL EDITAR ASIENTO / MOVIMIENTO */}
      {editingOrder && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Editar Movimiento {editingOrder.orderNumber}
                </h3>
                <p className="text-xs text-slate-500">
                  Los cambios en cantidades ajustan el stock automáticamente en inventario.
                </p>
              </div>
              <button
                onClick={() => setEditingOrder(null)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSaveEditedOrder} className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase text-slate-600">
                  Método de Pago
                </label>
                <select
                  value={editingOrder.paymentMethod}
                  onChange={(e) =>
                    setEditingOrder({ ...editingOrder, paymentMethod: e.target.value })
                  }
                  className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-300 text-sm font-semibold bg-white"
                >
                  <option value="QR_MOCK">QR_MOCK</option>
                  <option value="YAPE_PLIN">YAPE / PLIN</option>
                  <option value="EFECTIVO">EFECTIVO</option>
                  <option value="TARJETA">TARJETA</option>
                </select>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                <label className="text-xs font-bold uppercase text-slate-600">
                  Productos del Movimiento
                </label>
                {editingOrder.items.map((item, idx) => (
                  <div
                    key={item.productId}
                    className="flex items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-sm text-slate-900 truncate">
                        {item.productName}
                      </p>
                      <p className="text-xs text-slate-500">
                        S/ {item.unitPriceApplied.toFixed(2)} c/u
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const next = editingOrder.items.map((it, i) =>
                            i === idx ? { ...it, quantity: Math.max(1, it.quantity - 1) } : it
                          );
                          setEditingOrder({ ...editingOrder, items: next });
                        }}
                        className="w-8 h-8 rounded-lg bg-white border border-slate-300 flex items-center justify-center font-bold"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-7 text-center font-black text-sm">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => {
                          const next = editingOrder.items.map((it, i) =>
                            i === idx ? { ...it, quantity: it.quantity + 1 } : it
                          );
                          setEditingOrder({ ...editingOrder, items: next });
                        }}
                        className="w-8 h-8 rounded-lg bg-white border border-slate-300 flex items-center justify-center font-bold"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <span className="font-black text-sm text-slate-900 w-20 text-right">
                      S/ {(item.unitPriceApplied * item.quantity).toFixed(2)}
                    </span>

                    {editingOrder.items.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setEditingOrder({
                            ...editingOrder,
                            items: editingOrder.items.filter((_, i) => i !== idx),
                          })
                        }
                        className="p-1.5 rounded-lg text-red-600 hover:bg-red-100"
                        title="Quitar ítem"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="bg-slate-900 text-white rounded-xl p-4 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-300">Nuevo Total</span>
                <span className="text-xl font-black">
                  S/{' '}
                  {editingOrder.items
                    .reduce((sum, it) => sum + it.unitPriceApplied * it.quantity, 0)
                    .toFixed(2)}
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setEditingOrder(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 font-bold text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN PERSONALIZADO */}
      {confirmDialog.open && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl border border-slate-200">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-slate-900">{confirmDialog.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {confirmDialog.message}
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setConfirmDialog((prev) => ({ ...prev, open: false }))}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-sm transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  const fn = confirmDialog.onConfirm;
                  setConfirmDialog((prev) => ({ ...prev, open: false }));
                  if (fn) await fn();
                }}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm transition shadow-sm"
              >
                {confirmDialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PricingRow({ product, onSave }) {
  const [override, setOverride] = useState(product.overrideGlobalPrice);
  const [pct, setPct] = useState(product.individualMarkupPct);

  useEffect(() => {
    setOverride(product.overrideGlobalPrice);
    setPct(product.individualMarkupPct);
  }, [product]);

  return (
    <tr className="hover:bg-slate-50">
      <td className="p-4">
        <div className="flex items-center gap-3">
          <ThumbImage src={product.imageUrl} alt={product.name} />
          <span className="font-bold text-slate-900">{product.name}</span>
        </div>
      </td>
      <td className="p-4 text-slate-600 text-xs font-semibold">{product.category}</td>
      <td className="p-4 font-semibold">S/ {product.basePrice.toFixed(2)}</td>
      <td className="p-4">
        <input
          type="checkbox"
          checked={override}
          onChange={(e) => setOverride(e.target.checked)}
          className="w-5 h-5 accent-slate-900"
        />
      </td>
      <td className="p-4">
        <input
          type="number"
          step="0.5"
          disabled={!override}
          value={pct}
          onChange={(e) => setPct(e.target.value)}
          className="w-24 px-2.5 py-1.5 rounded-lg border border-slate-300 disabled:bg-slate-100 text-center font-bold"
        />
      </td>
      <td className="p-4">
        <span
          className={`px-2.5 py-1 rounded-full text-xs font-bold ${
            product.activeRule === 'INDIVIDUAL'
              ? 'bg-purple-100 text-purple-800'
              : product.activeRule === 'GLOBAL'
              ? 'bg-amber-100 text-amber-800'
              : 'bg-slate-100 text-slate-600'
          }`}
        >
          {product.activeRule} (
          {product.appliedPct >= 0 ? `+${product.appliedPct}%` : `${product.appliedPct}%`})
        </span>
      </td>
      <td className="p-4 font-black text-emerald-700">
        S/ {product.effectivePrice.toFixed(2)}
      </td>
      <td className="p-4 text-right">
        <button
          onClick={() => onSave(product.id, override, pct)}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold"
        >
          <Check className="w-3.5 h-3.5" />
          Aplicar
        </button>
      </td>
    </tr>
  );
}
