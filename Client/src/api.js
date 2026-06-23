import axios from 'axios';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
    headers: {
        'Content-Type': 'application/json'
    }
});

// Flag to prevent infinite loop if refreshing fails
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
    failedQueue.forEach(prom => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });
    failedQueue = [];
};

// Request Interceptor: Attach access token
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response Interceptor: Auto-refresh tokens on 401/403
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        // If the error status is 401 or 403, and the request hasn't been retried yet
        if ((error.response?.status === 401 || error.response?.status === 403) && !originalRequest._retry) {
            if (isRefreshing) {
                return new Promise((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                })
                .then(token => {
                    originalRequest.headers['Authorization'] = `Bearer ${token}`;
                    return api(originalRequest);
                })
                .catch(err => {
                    return Promise.reject(err);
                });
            }

            originalRequest._retry = true;
            isRefreshing = true;

            const refreshToken = localStorage.getItem('refreshToken');
            if (refreshToken) {
                try {
                    // Call the refresh token endpoint without interceptor header if possible (or using a clean axios instance)
                    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
                    const response = await axios.post(`${apiUrl}/token`, { refreshToken });
                    const newToken = response.data.token;

                    localStorage.setItem('token', newToken);
                    api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
                    originalRequest.headers['Authorization'] = `Bearer ${newToken}`;

                    processQueue(null, newToken);
                    isRefreshing = false;

                    return api(originalRequest);
                } catch (refreshError) {
                    processQueue(refreshError, null);
                    isRefreshing = false;

                    // Logout the user and trigger page reload/state clear
                    localStorage.removeItem('token');
                    localStorage.removeItem('refreshToken');
                    window.dispatchEvent(new Event('auth-expired'));
                    
                    return Promise.reject(refreshError);
                }
            } else {
                // No refresh token available, force logout
                localStorage.removeItem('token');
                window.dispatchEvent(new Event('auth-expired'));
            }
        }

        return Promise.reject(error);
    }
);

export default api;
