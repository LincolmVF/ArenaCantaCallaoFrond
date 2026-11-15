import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import {
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  QrCode,
  ShieldCheck,
  AlertTriangle,
  Package,
  LayoutGrid,
  RefreshCw,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

function ProductImage({ src, alt, className = 'w-full h-40 object-cover' }) {
  const [imgError, setImgError] = useState(false);

  if (!src || imgError) {
    return (
      <div
        className={`bg-slate-100 flex items-center justify-center text-slate-400 ${className}`}
      >
        <Package className="w-12 h-12" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      onError={() => setImgError(true)}
      className={className}
      loading="lazy"
    />
  );
}

export default function KioskPage() {
  const { user, logout } = useAuth();
  const [products, setProducts] = useState([]);
  const [pricingConfig, setPricingConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stockWarning, setStockWarning] = useState('');

  // Flujo Tablet Táctil: 'CATEGORIES' | 'PRODUCTS' | 'REVIEW' | 'QR_PAYMENT' | 'SUCCESS'
  const [step, setStep] = useState('CATEGORIES');
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [cart, setCart] = useState([]);

  const [submitting, setSubmitting] = useState(false);
  const [lastOrder, setLastOrder] = useState(null);
  const [mockQrRef, setMockQrRef] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const enterFullscreen = async () => {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
      setIsFullscreen(true);
    } catch {
      setIsFullscreen(true);
    }
  };

  const exitFullscreen = async () => {
    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen();
      }
      setIsFullscreen(false);
    } catch {
      setIsFullscreen(false);
    }
  };

  const loadCatalog = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await api.getKioskProducts();
      const loaded = data.products || [];
      setProducts(loaded);
      setPricingConfig(data.pricingConfig || null);

      // Sincronizar stock en carrito si ya hay productos cargados
      setCart((prev) =>
        prev.map((item) => {
          const fresh = loaded.find((p) => p.id === item.id);
          return fresh ? { ...fresh, quantity: item.quantity } : item;
        })
      );
    } catch (err) {
      setError(err.message || 'No se pudo conectar con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCatalog();
  }, []);

  // Categorías con imagen representativa y conteo de productos
  const categoryCards = useMemo(() => {
    const map = new Map();
    for (const p of products) {
      if (!map.has(p.category)) {
        map.set(p.category, {
          name: p.category,
          count: 0,
          imageUrl: p.imageUrl || '',
        });
      }
      const entry = map.get(p.category);
      entry.count += 1;
      if (!entry.imageUrl && p.imageUrl) {
        entry.imageUrl = p.imageUrl;
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [products]);

  const categoryProducts = useMemo(() => {
    if (selectedCategory === 'Todos') return products;
    return products.filter((p) => p.category === selectedCategory);
  }, [products, selectedCategory]);

  const cartTotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.effectivePrice * item.quantity, 0),
    [cart]
  );

  const cartCount = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart]
  );

  // Detectar productos sin stock o que exceden stock disponible en el carrito
  const stockIssues = useMemo(() => {
    return cart.filter((item) => item.stock <= 0 || item.quantity > item.stock);
  }, [cart]);

  const getCartQty = (productId) => {
    const found = cart.find((i) => i.id === productId);
    return found ? found.quantity : 0;
  };

  const showWarning = (msg) => {
    setStockWarning(msg);
    setTimeout(() => setStockWarning(''), 4000);
  };

  const handleSelectCategory = (catName) => {
    setSelectedCategory(catName);
    setStep('PRODUCTS');
  };

  const handleChangeQty = (product, delta) => {
    const currentQty = getCartQty(product.id);
    const nextQty = currentQty + delta;

    if (delta > 0 && product.stock <= 0) {
      showWarning(`"${product.name}" no cuenta con stock disponible en este momento.`);
      return;
    }

    if (delta > 0 && nextQty > product.stock) {
      showWarning(`Stock máximo alcanzado para "${product.name}" (${product.stock} disponibles).`);
      return;
    }

    setCart((prev) => {
      if (nextQty <= 0) {
        return prev.filter((i) => i.id !== product.id);
      }
      const exists = prev.find((i) => i.id === product.id);
      if (exists) {
        return prev.map((i) => (i.id === product.id ? { ...i, quantity: nextQty } : i));
      }
      return [...prev, { ...product, quantity: nextQty }];
    });
  };

  const removeFromCart = (productId) => {
    setCart((prev) => {
      const next = prev.filter((i) => i.id !== productId);
      if (next.length === 0 && step === 'REVIEW') {
        setStep('CATEGORIES');
      }
      return next;
    });
  };

  const handleGoToReview = async () => {
    await loadCatalog();
    setStep('REVIEW');
  };

  const handleGoToQr = () => {
    if (stockIssues.length > 0) {
      showWarning('Ajusta o retira los productos sin stock suficiente antes de continuar.');
      return;
    }
    const ref = `ACC-${Date.now().toString().slice(-6)}`;
    setMockQrRef(ref);
    setStep('QR_PAYMENT');
  };

  const handleFinalizeOrder = async () => {
    try {
      setSubmitting(true);
      setError('');
      const payload = {
        customerName: user?.fullName || 'Cliente Kiosco',
        paymentMethod: 'QR_MOCK',
        items: cart.map((item) => ({
          productId: item.id,
          quantity: item.quantity,
        })),
      };

      const res = await api.createOrder(payload);
      setLastOrder(res.order);
      setCart([]);
      setStep('SUCCESS');
    } catch (err) {
      setError(err.message || 'No se pudo registrar la compra.');
      await loadCatalog();
    } finally {
      setSubmitting(false);
    }
  };

  const resetKiosk = () => {
    setCart([]);
    setLastOrder(null);
    setSelectedCategory('Todos');
    setStep('CATEGORIES');
    loadCatalog();
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Botón flotante único para salir de Pantalla Completa */}
      {isFullscreen && (
        <button
          onClick={exitFullscreen}
          className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-slate-900/85 hover:bg-slate-900 text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-lg backdrop-blur-xs active:scale-95 transition"
          title="Volver al modo normal"
        >
          <Minimize2 className="w-4 h-4" />
          Salir Pantalla Completa
        </button>
      )}

      {/* Header Sobrio y Profesional (se oculta en Pantalla Completa) */}
      {!isFullscreen && (
        <header className="bg-slate-900 text-white px-5 py-4 shadow-md flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-emerald-600 flex items-center justify-center shadow-inner">
              <ShoppingBag className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
                Arena Canta Callao
              </h1>
              <p className="text-slate-400 text-xs sm:text-sm">
                Módulo de Autoservicio Táctil
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {pricingConfig?.globalMarkupActive && (
              <span className="hidden sm:inline-block bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs font-semibold px-3 py-1.5 rounded-lg">
                Tarifa Dinámica +{pricingConfig.globalMarkupPct}%
              </span>
            )}

            <button
              onClick={enterFullscreen}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2.5 rounded-xl text-sm active:scale-95 transition"
              title="Activar modo Kiosco Pantalla Completa"
            >
              <Maximize2 className="w-4 h-4" />
              <span className="hidden sm:inline">Pantalla Completa</span>
            </button>

            <button
              onClick={loadCatalog}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 active:scale-95 transition"
              title="Actualizar catálogo"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>

            {user?.role === 'ADMIN' ? (
              <Link
                to="/admin"
                className="flex items-center gap-2 bg-white text-slate-900 font-bold px-4 py-2.5 rounded-xl text-sm hover:bg-slate-100 active:scale-95 transition"
              >
                <ShieldCheck className="w-4 h-4" />
                Panel CRM
              </Link>
            ) : (
              <Link
                to="/login"
                className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold px-4 py-2.5 rounded-xl text-sm active:scale-95 transition"
              >
                <ShieldCheck className="w-4 h-4" />
                Acceso
              </Link>
            )}

            {user && (
              <button
                onClick={logout}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-2.5 rounded-xl text-sm font-semibold"
              >
                Salir
              </button>
            )}
          </div>
        </header>
      )}

      {/* Alertas */}
      {error && (
        <div className="mx-4 mt-4 bg-red-50 border border-red-300 text-red-800 px-5 py-4 rounded-2xl flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3 font-semibold">
            <AlertTriangle className="w-6 h-6 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError('')} className="font-bold px-3 py-1">
            Cerrar
          </button>
        </div>
      )}

      {stockWarning && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-amber-600 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 font-bold text-base max-w-md w-[90%]">
          <AlertTriangle className="w-6 h-6 shrink-0" />
          <span>{stockWarning}</span>
        </div>
      )}

      {/* PASO 1: SELECCIÓN DE CATEGORÍA (TABLET TOUCH) */}
      {step === 'CATEGORIES' && (
        <main className="flex-1 max-w-6xl w-full mx-auto p-5 sm:p-8 flex flex-col gap-6 pb-32">
          <div className="text-center space-y-1">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              ¿Qué deseas comprar hoy?
            </h2>
            <p className="text-slate-500 text-base sm:text-lg">
              Toca una categoría para elegir tus productos y cantidades
            </p>
          </div>

          {loading ? (
            <div className="bg-white rounded-3xl p-16 text-center text-slate-500 text-lg border border-slate-200">
              Cargando categorías...
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
              {/* Opción Ver Todo */}
              <button
                onClick={() => handleSelectCategory('Todos')}
                className="bg-slate-900 text-white rounded-3xl p-6 shadow-md hover:bg-slate-800 active:scale-95 transition flex flex-col items-center justify-center text-center gap-4 min-h-[210px]"
              >
                <div className="w-16 h-16 rounded-2xl bg-emerald-600 flex items-center justify-center">
                  <LayoutGrid className="w-9 h-9 text-white" />
                </div>
                <div>
                  <p className="text-xl font-extrabold">Todo el Catálogo</p>
                  <p className="text-slate-400 text-sm mt-1">{products.length} productos</p>
                </div>
              </button>

              {categoryCards.map((cat) => (
                <button
                  key={cat.name}
                  onClick={() => handleSelectCategory(cat.name)}
                  className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm hover:shadow-lg hover:border-slate-400 active:scale-95 transition flex flex-col text-left min-h-[210px]"
                >
                  <ProductImage
                    src={cat.imageUrl}
                    alt={cat.name}
                    className="w-full h-32 object-cover"
                  />
                  <div className="p-4 flex-1 flex flex-col justify-between w-full">
                    <p className="text-lg sm:text-xl font-extrabold text-slate-900">
                      {cat.name}
                    </p>
                    <p className="text-sm font-medium text-slate-500 mt-1">
                      {cat.count} {cat.count === 1 ? 'producto' : 'productos'}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </main>
      )}

      {/* PASO 2: SELECCIÓN DE PRODUCTOS Y CANTIDADES */}
      {step === 'PRODUCTS' && (
        <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 flex flex-col gap-5 pb-32">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <button
              onClick={() => setStep('CATEGORIES')}
              className="flex items-center gap-2 px-5 py-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold text-base active:scale-95 transition"
            >
              <ArrowLeft className="w-5 h-5" />
              Más Categorías
            </button>
            <div className="text-center">
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900">
                {selectedCategory === 'Todos' ? 'Todo el Catálogo' : selectedCategory}
              </h2>
              <p className="text-xs sm:text-sm text-emerald-700 font-semibold">
                Toca &quot;+ Agregar al Carrito&quot; en los productos que desees llevar
              </p>
            </div>
            <span className="text-sm font-semibold text-slate-500">
              {categoryProducts.length} disponibles
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {categoryProducts.map((product) => {
              const qty = getCartQty(product.id);
              const outOfStock = product.stock <= 0;

              return (
                <div
                  key={product.id}
                  className={`bg-white rounded-3xl border overflow-hidden shadow-sm flex flex-col justify-between transition ${
                    outOfStock
                      ? 'border-red-200 bg-red-50/30'
                      : qty > 0
                      ? 'border-emerald-600 ring-2 ring-emerald-500/30 shadow-md'
                      : 'border-slate-200'
                  }`}
                >
                  <div className="relative">
                    <ProductImage
                      src={product.imageUrl}
                      alt={product.name}
                      className={`w-full h-44 object-cover ${outOfStock ? 'grayscale opacity-60' : ''}`}
                    />
                    {outOfStock ? (
                      <span className="absolute top-3 right-3 bg-red-600 text-white text-xs font-extrabold uppercase px-3 py-1.5 rounded-lg shadow">
                        Sin Stock
                      </span>
                    ) : (
                      <span className="absolute top-3 right-3 bg-slate-900/80 text-white text-xs font-bold px-3 py-1 rounded-lg">
                        Stock: {product.stock}
                      </span>
                    )}
                  </div>

                  <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        {product.category} • {product.unit}
                      </p>
                      <h3 className="text-xl font-extrabold text-slate-900 mt-1 leading-snug">
                        {product.name}
                      </h3>
                      <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-2xl font-black text-emerald-700">
                          S/ {product.effectivePrice.toFixed(2)}
                        </span>
                        {product.activeRule !== 'BASE' && (
                          <span className="text-sm line-through text-slate-400">
                            S/ {product.basePrice.toFixed(2)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Botonera Táctil Grande y Clara */}
                    {outOfStock ? (
                      <div className="w-full py-4 rounded-2xl bg-red-100 text-red-800 font-bold text-center text-base">
                        Producto Agotado
                      </div>
                    ) : qty === 0 ? (
                      <button
                        onClick={() => handleChangeQty(product, 1)}
                        className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-lg flex items-center justify-center gap-2 shadow-sm active:scale-95 transition"
                      >
                        <Plus className="w-6 h-6" />
                        Agregar al Carrito
                      </button>
                    ) : (
                      <div className="flex items-center justify-between gap-2 bg-emerald-50 border border-emerald-200 p-2 rounded-2xl">
                        <button
                          onClick={() => handleChangeQty(product, -1)}
                          className="w-16 h-14 rounded-xl bg-white text-slate-900 font-black flex items-center justify-center shadow-sm active:scale-90 transition"
                          title="Quitar 1"
                        >
                          <Minus className="w-6 h-6" />
                        </button>
                        <div className="text-center">
                          <span className="text-2xl font-black text-emerald-900">{qty}</span>
                          <p className="text-[11px] font-bold uppercase text-emerald-700">
                            en carrito
                          </p>
                        </div>
                        <button
                          onClick={() => handleChangeQty(product, 1)}
                          className="w-16 h-14 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black flex items-center justify-center shadow-sm active:scale-90 transition"
                          title="Agregar 1 más"
                        >
                          <Plus className="w-6 h-6" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </main>
      )}

      {/* BARRA INFERIOR PERSISTENTE DEL CARRITO (EN PASOS 1 y 2) */}
      {(step === 'CATEGORIES' || step === 'PRODUCTS') && cart.length > 0 && (
        <div className="fixed bottom-0 inset-x-0 bg-slate-900 text-white border-t border-slate-800 p-4 shadow-2xl z-40">
          <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="bg-emerald-600 px-4 py-2 rounded-xl font-black text-lg">
                {cartCount} {cartCount === 1 ? 'ítem' : 'ítems'}
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase font-bold">Total Acumulado</p>
                <p className="text-2xl font-black text-white">S/ {cartTotal.toFixed(2)}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => setCart([])}
                className="p-4 rounded-2xl bg-slate-800 hover:bg-red-600 text-slate-300 hover:text-white active:scale-95 transition"
                title="Vaciar carrito"
              >
                <Trash2 className="w-6 h-6" />
              </button>
              {step === 'PRODUCTS' && (
                <button
                  onClick={() => setStep('CATEGORIES')}
                  className="px-6 py-4 rounded-2xl bg-slate-700 hover:bg-slate-600 text-white font-bold text-base sm:text-lg flex items-center gap-2 active:scale-95 transition"
                >
                  <ArrowLeft className="w-5 h-5" />
                  Seguir Comprando
                </button>
              )}
              <button
                onClick={handleGoToReview}
                className="px-7 py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-base sm:text-lg flex items-center gap-2 shadow-lg active:scale-95 transition"
              >
                Ya Terminé • Ir a Pagar
                <ArrowRight className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PASO 3: CONFIRMACIÓN DEL PEDIDO Y VALIDACIÓN DE STOCK */}
      {step === 'REVIEW' && (
        <main className="flex-1 flex items-center justify-center p-4 sm:p-8">
          <div className="bg-white rounded-3xl shadow-xl border border-slate-200 max-w-2xl w-full p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                  Confirma tu Pedido
                </h2>
                <p className="text-slate-500">Verifica productos, cantidades y stock antes de pagar</p>
              </div>
              <span className="bg-slate-900 text-white font-bold px-4 py-2 rounded-xl text-sm">
                {cartCount} {cartCount === 1 ? 'producto' : 'productos'}
              </span>
            </div>

            {stockIssues.length > 0 && (
              <div className="bg-red-50 border border-red-300 text-red-800 p-4 rounded-2xl flex items-start gap-3">
                <AlertTriangle className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-extrabold">Atención: Productos sin stock suficiente</p>
                  <p className="mt-1">
                    Algunos productos en tu carrito no tienen stock disponible para la cantidad
                    seleccionada. Ajústalos o retíralos para continuar.
                  </p>
                </div>
              </div>
            )}

            <ul className="divide-y divide-slate-100 max-h-[380px] overflow-y-auto">
              {cart.map((item) => {
                const hasIssue = item.stock <= 0 || item.quantity > item.stock;
                return (
                  <li
                    key={item.id}
                    className={`py-4 flex items-center justify-between gap-4 ${
                      hasIssue ? 'bg-red-50/60 px-3 rounded-xl' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <ProductImage
                        src={item.imageUrl}
                        alt={item.name}
                        className="w-14 h-14 rounded-xl object-cover shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="font-bold text-lg text-slate-900 truncate">{item.name}</p>
                        <p className="text-sm text-slate-500">
                          S/ {item.effectivePrice.toFixed(2)} c/u
                        </p>
                        {hasIssue && (
                          <p className="text-xs font-extrabold text-red-600 mt-0.5">
                            {item.stock <= 0
                              ? 'Sin stock disponible'
                              : `Solo quedan ${item.stock} unidades`}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
                        <button
                          onClick={() => handleChangeQty(item, -1)}
                          className="w-10 h-10 rounded-lg bg-white flex items-center justify-center font-bold shadow-sm"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="w-8 text-center font-black">{item.quantity}</span>
                        <button
                          onClick={() => handleChangeQty(item, 1)}
                          className="w-10 h-10 rounded-lg bg-white flex items-center justify-center font-bold shadow-sm"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                      <span className="text-lg font-black text-slate-900 w-24 text-right">
                        S/ {(item.effectivePrice * item.quantity).toFixed(2)}
                      </span>
                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="p-2.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 active:scale-90 transition"
                        title="Descartar producto"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="bg-slate-900 text-white rounded-2xl p-5 flex items-center justify-between">
              <span className="text-lg font-semibold text-slate-300">Total a Pagar</span>
              <span className="text-3xl font-black">S/ {cartTotal.toFixed(2)}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                onClick={resetKiosk}
                className="py-5 rounded-2xl bg-red-50 hover:bg-red-100 text-red-700 font-bold text-base flex items-center justify-center gap-2 active:scale-95 transition"
              >
                <Trash2 className="w-5 h-5" />
                Cancelar Compra
              </button>
              <button
                onClick={() => setStep('CATEGORIES')}
                className="py-5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold text-base flex items-center justify-center gap-2 active:scale-95 transition"
              >
                <ArrowLeft className="w-5 h-5" />
                Agregar Más
              </button>
              <button
                disabled={cart.length === 0 || stockIssues.length > 0}
                onClick={handleGoToQr}
                className="py-5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-black text-lg flex items-center justify-center gap-2 shadow-lg active:scale-95 transition"
              >
                <QrCode className="w-6 h-6" />
                Generar QR
              </button>
            </div>
          </div>
        </main>
      )}

      {/* PASO 4: CÓDIGO QR SIMULADO (MOCK) */}
      {step === 'QR_PAYMENT' && (
        <main className="flex-1 flex items-center justify-center p-4 sm:p-8">
          <div className="bg-white rounded-3xl shadow-xl border border-slate-200 max-w-xl w-full p-6 sm:p-8 text-center space-y-6">
            <div>
              <span className="inline-block bg-slate-100 text-slate-700 font-bold text-xs uppercase tracking-wider px-3 py-1 rounded-full mb-2">
                Pago Digital QR (Simulado)
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                Escanea el Código QR
              </h2>
              <p className="text-slate-500 mt-1 text-lg">
                Monto total:{' '}
                <strong className="text-emerald-700 text-2xl">S/ {cartTotal.toFixed(2)}</strong>
              </p>
            </div>

            <div className="bg-slate-50 border-2 border-slate-200 rounded-3xl p-7 inline-flex flex-col items-center gap-3">
              <QRCodeSVG
                value={`ARENA_CANTA_CALLAO|REF:${mockQrRef}|MONTO:${cartTotal.toFixed(2)}`}
                size={230}
                level="M"
              />
              <span className="text-xs font-mono text-slate-500">REF: {mockQrRef}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <button
                onClick={() => setStep('REVIEW')}
                disabled={submitting}
                className="py-5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-lg flex items-center justify-center gap-2 active:scale-95 transition"
              >
                <ArrowLeft className="w-5 h-5" />
                Atrás
              </button>
              <button
                onClick={handleFinalizeOrder}
                disabled={submitting}
                className="py-5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-black text-xl flex items-center justify-center gap-2 shadow-lg active:scale-95 transition"
              >
                <CheckCircle2 className="w-6 h-6" />
                {submitting ? 'Procesando...' : 'Finalizar'}
              </button>
            </div>
          </div>
        </main>
      )}

      {/* PASO 5: COMPRA FINALIZADA */}
      {step === 'SUCCESS' && (
        <main className="flex-1 flex items-center justify-center p-4 sm:p-8">
          <div className="bg-white rounded-3xl shadow-xl border border-slate-200 max-w-lg w-full p-8 text-center space-y-6">
            <div className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-12 h-12" />
            </div>
            <div>
              <h2 className="text-3xl font-extrabold text-slate-900">Pedido Registrado</h2>
              <p className="text-slate-600 mt-2">
                Gracias por comprar en <strong>Arena Canta Callao</strong>.
              </p>
            </div>

            {lastOrder && (
              <div className="bg-slate-50 rounded-2xl p-5 text-left space-y-1.5 border border-slate-200">
                <p className="text-sm text-slate-500">
                  Comprobante: <strong className="text-slate-900">{lastOrder.orderNumber}</strong>
                </p>
                <p className="text-sm text-slate-500">
                  Importe Pagado:{' '}
                  <strong className="text-emerald-700">
                    S/ {Number(lastOrder.totalAmount).toFixed(2)}
                  </strong>
                </p>
              </div>
            )}

            <button
              onClick={resetKiosk}
              className="w-full py-5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xl active:scale-95 transition shadow-lg"
            >
              Nueva Compra
            </button>
          </div>
        </main>
      )}
    </div>
  );
}
