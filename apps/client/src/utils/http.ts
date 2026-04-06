import axios, {AxiosRequestConfig} from 'axios';
import { CONFIG } from '../apis/config';

const DEFAULT_TIMEOUT = 5000;

const axiosInstance = axios.create({
  baseURL: CONFIG.API_URL || undefined,
  timeout: DEFAULT_TIMEOUT,
});

axiosInstance.interceptors.response.use(
  response => response,
  error => {
    const status = error.response?.status;
    const url = error.config?.url;
    const message = error.response?.data?.message || error.message;
    console.error(`[API Error] ${error.config?.method?.toUpperCase()} ${url} → ${status || 'Network Error'}: ${message}`);
    return Promise.reject(error);
  },
);

export const http = {
  get: async function get<Response = unknown>(url: string, options: AxiosRequestConfig = {}) {
    const res = await axiosInstance.get<Response>(url, options);
    return res.data;
  },
  post: async function post<Request extends Record<string, unknown> | undefined, Response = unknown>(url: string, data?: Request) {
    const res = await axiosInstance.post<Response>(url, data);
    return res.data;
  },
  put: async function put<Request extends Record<string, unknown>, Response = unknown>(url: string, data?: Request) {
    const res = await axiosInstance.put<Response>(url, data);
    return res.data;
  },
};
