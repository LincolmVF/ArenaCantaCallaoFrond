const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

function getToken() {
  return localStorage.getItem('acc_token');
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = { ...(options.headers || {}) };

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  const isJson = response.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await response.json() : null;

  if (!response.ok) {
    throw new Error(data?.error || `Error HTTP ${response.status}`);
  }

  return data;
}

export const api = {
  // Auth
  login: (username, password) =>
    request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  me: () => request('/auth/me'),

  // Kiosco (Cliente)
  getKioskProducts: (category = 'Todos', search = '') => {
    const params = new URLSearchParams();
    if (category && category !== 'Todos') params.set('category', category);
    if (search) params.set('search', search);
    const qs = params.toString();
    return request(`/kiosk/products${qs ? `?${qs}` : ''}`);
  },
  createOrder: (payload) =>
    request('/orders', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Admin: Productos
  getAdminProducts: () => request('/admin/products'),
  createProduct: (product) =>
    request('/admin/products', {
      method: 'POST',
      body: JSON.stringify(product),
    }),
  updateProduct: (id, product) =>
    request(`/admin/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(product),
    }),
  deleteProduct: (id) =>
    request(`/admin/products/${id}`, {
      method: 'DELETE',
    }),

  // Admin: Precios Dinámicos
  getPricingConfig: () => request('/admin/pricing'),
  updateGlobalPricing: (data) =>
    request('/admin/pricing/global', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  updateCategoryPricing: (data) =>
    request('/admin/pricing/category', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  updateProductPricing: (id, data) =>
    request(`/admin/pricing/product/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  resetIndividualPricing: () =>
    request('/admin/pricing/reset-individuals', {
      method: 'PUT',
    }),

  // Admin: Excel
  downloadExcelTemplate: async () => {
    const token = getToken();
    const res = await fetch(`${API_URL}/admin/products/excel/template`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('No se pudo descargar la plantilla.');
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'plantilla_inventario_arena_canta_callao.xlsx';
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  },
  uploadExcel: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return request('/admin/products/excel/upload', {
      method: 'POST',
      body: formData,
    });
  },

  // Admin: Reportes
  getSalesReport: (params = { mode: 'day' }) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== '')
    ).toString();
    return request(`/admin/reports/sales${qs ? `?${qs}` : ''}`);
  },
  downloadSalesReportExcel: async (params = { mode: 'day' }) => {
    const token = getToken();
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== '')
    ).toString();
    const res = await fetch(`${API_URL}/admin/reports/sales/excel${qs ? `?${qs}` : ''}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('No se pudo exportar el reporte Excel.');
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'reporte_ventas_arena_canta_callao.xlsx';
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  },

  // Admin: Asientos / Movimientos
  getAdminOrders: (params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== '')
    ).toString();
    return request(`/admin/orders${qs ? `?${qs}` : ''}`);
  },
  updateAdminOrder: (id, data) =>
    request(`/admin/orders/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  revertAdminOrder: (id) =>
    request(`/admin/orders/${id}/revert`, {
      method: 'POST',
    }),
};
