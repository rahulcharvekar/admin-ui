import axios, { AxiosError } from 'axios';
import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { API_CONFIG } from '../config/api.config';

/**
 * API Client with JWT token management and error handling
 */
class ApiClient {
  private instance: AxiosInstance;

  constructor() {
    this.instance = axios.create({
      baseURL: API_CONFIG.baseURL,
      timeout: API_CONFIG.timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor - add JWT token to headers
    this.instance.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        const token = this.getToken();
        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error: AxiosError) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor - handle errors globally
    this.instance.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response) {
          const status = error.response.status;

          switch (status) {
            case 401:
              // Unauthorized - clear token and redirect to login
              this.clearAuth();
              if (window.location.pathname !== '/login') {
                window.location.href = '/login';
              }
              break;
            case 403:
              // Forbidden - user doesn't have permission
              console.error('Access forbidden:', error.response.data);
              break;
            case 404:
              console.error('Resource not found:', error.response.data);
              break;
            case 500:
              console.error('Server error:', error.response.data);
              break;
            default:
              console.error('API error:', error.response.data);
          }
        } else if (error.request) {
          // Request was made but no response received
          console.error('Network error - no response received');
        } else {
          // Something else happened
          console.error('Error:', error.message);
        }

        return Promise.reject(error);
      }
    );
  }

  /**
   * Get the axios instance for making requests
   */
  public getInstance(): AxiosInstance {
    return this.instance;
  }

  /**
   * Get JWT token from localStorage
   */
  public getToken(): string | null {
    return localStorage.getItem(API_CONFIG.tokenKey);
  }

  /**
   * Save JWT token to localStorage
   */
  public setToken(token: string): void {
    localStorage.setItem(API_CONFIG.tokenKey, token);
  }

  /**
   * Remove JWT token from localStorage
   */
  public clearToken(): void {
    localStorage.removeItem(API_CONFIG.tokenKey);
  }

  /**
   * Get user info from localStorage
   */
  public getUser(): unknown {
    const userStr = localStorage.getItem(API_CONFIG.userKey);
    return userStr ? JSON.parse(userStr) : null;
  }

  /**
   * Save user info to localStorage
   */
  public setUser(user: unknown): void {
    localStorage.setItem(API_CONFIG.userKey, JSON.stringify(user));
  }

  /**
   * Remove user info from localStorage
   */
  public clearUser(): void {
    localStorage.removeItem(API_CONFIG.userKey);
  }

  /**
   * Clear all auth data
   */
  public clearAuth(): void {
    this.clearToken();
    this.clearUser();
  }

  /**
   * Check if user is authenticated
   */
  public isAuthenticated(): boolean {
    return !!this.getToken();
  }
}

// Export a singleton instance
export const apiClient = new ApiClient();
export const api = apiClient.getInstance();
