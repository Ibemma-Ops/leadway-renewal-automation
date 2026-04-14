import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL || "";

const api = axios.create({
  baseURL: `${BASE_URL}/api/v1`,
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("mras_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("mras_token");
      localStorage.removeItem("mras_user");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

// ─── Auth ──────────────────────────────────────────────────────────────────
export const authAPI = {
 login: (email, password) => {
  const form = new URLSearchParams();
  form.append("grant_type", "password");
  form.append("username", email);
  form.append("password", password);

  return api.post("/auth/login", form, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
},
  me:        ()     => api.get("/auth/me"),
  register:  (data) => api.post("/auth/register", data),
  seedAdmin: ()     => api.post("/auth/seed-admin"),
};

// ─── Dashboard ────────────────────────────────────────────────────────────
export const dashboardAPI = {
  stats:           () => api.get("/dashboard/stats"),
  heatmap:         (params) => api.get("/dashboard/heatmap", { params }),
  portfolio:       () => api.get("/dashboard/portfolio"),
  timeline:        () => api.get("/dashboard/renewal-timeline"),
  rateDistribution:() => api.get("/dashboard/rate-distribution"),
  riskFlags:       () => api.get("/dashboard/risk-flags"),
  sectorLR:        () => api.get("/dashboard/sector-lr"),
};

// ─── Policies ─────────────────────────────────────────────────────────────
export const policiesAPI = {
  list:        (params)       => api.get("/policies", { params }),
  get:         (id)           => api.get(`/policies/${id}`),
  update:      (id, data)     => api.patch(`/policies/${id}`, data),
  generateDoc: (id)           => api.post(`/policies/${id}/generate-document`),
  downloadDoc: (id, type = "docx") =>
    api.get(`/policies/${id}/download-document`, { params: { file_type: type }, responseType: "blob" }),
  triggerEmail:(id, triggerType) =>
    api.post(`/policies/${id}/trigger-email`, null, { params: { trigger_type: triggerType } }),
  exportCsv:   (params)       => api.get("/policies/export/csv", { params, responseType: "blob" }),
};

// ─── Upload ────────────────────────────────────────────────────────────────
export const uploadAPI = {
  upload: (file, onProgress) => {
    const form = new FormData();
    form.append("file", file);
    return api.post("/upload", form, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: onProgress,
    });
  },
  list: () => api.get("/upload"),
  get:  (id) => api.get(`/upload/${id}`),
};

// ─── Approvals ────────────────────────────────────────────────────────────
export const approvalsAPI = {
  list:           (params) => api.get("/approvals", { params }),
  action:         (stepId, data) => api.post(`/approvals/${stepId}/action`, data),
  summary:        () => api.get("/approvals/queue/summary"),
  tpaQueue:       () => api.get("/approvals/tpa-queue"),
  pendingAtRisk:  (days) => api.get("/approvals/pending-near-expiry", { params: { days } }),
};

// ─── Audit ────────────────────────────────────────────────────────────────
export const auditAPI = {
  list: (params) => api.get("/audit", { params }),
};

// ─── Users ────────────────────────────────────────────────────────────────
export const usersAPI = {
  list:   ()          => api.get("/users"),
  update: (id, data)  => api.patch(`/users/${id}`, data),
};

export default api;
