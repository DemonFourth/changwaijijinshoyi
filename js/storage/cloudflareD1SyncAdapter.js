const CloudflareD1SyncAdapter = {
    _config: {
        workerUrl: null,
        timeout: 10000
    },

    init(config = {}) {
        CloudflareD1SyncAdapter._config = {
            ...CloudflareD1SyncAdapter._config,
            ...config
        };
    },

    isConfigured() {
        return !!CloudflareD1SyncAdapter._config.workerUrl;
    },

    getStatus() {
        if (!CloudflareD1SyncAdapter.isConfigured()) {
            return {
                provider: 'cloudflare',
                deviceId: window.LocalStorageAdapter.getSyncMeta().deviceId,
                lastSyncAt: window.LocalStorageAdapter.getSyncMeta().lastSyncAt,
                canPush: false,
                canPull: false,
                configured: false
            };
        }

        const syncMeta = window.LocalStorageAdapter.getSyncMeta();
        return {
            provider: 'cloudflare',
            deviceId: syncMeta.deviceId,
            lastSyncAt: syncMeta.lastSyncAt,
            canPush: true,
            canPull: true,
            configured: true,
            syncStatus: syncMeta.syncStatus || 'idle'
        };
    },

    async checkAuthStatus() {
        if (!CloudflareD1SyncAdapter.isConfigured()) {
            return { authEnabled: false, authenticated: false };
        }

        try {
            const response = await CloudflareD1SyncAdapter._request('/auth/status', 'GET');
            return response;
        } catch (error) {
            console.error('Auth status check failed:', error);
            return { authEnabled: false, authenticated: false, error: error.message };
        }
    },

    async login(password) {
        if (!CloudflareD1SyncAdapter.isConfigured()) {
            return { success: false, reason: 'not_configured' };
        }

        try {
            const response = await CloudflareD1SyncAdapter._request('/auth/login', 'POST', { password });
            return response;
        } catch (error) {
            return { success: false, reason: error.message };
        }
    },

    async pull() {
        if (!CloudflareD1SyncAdapter.isConfigured()) {
            return { success: false, reason: 'not_configured' };
        }

        const syncMeta = window.LocalStorageAdapter.getSyncMeta();

        try {
            const response = await CloudflareD1SyncAdapter._request('/sync/pull', 'GET', {
                deviceId: syncMeta.deviceId,
                cloudRevision: syncMeta.cloudRevision,
                lastPulledAt: syncMeta.lastPulledAt
            });

            if (response.success) {
                window.LocalStorageAdapter.updateSyncMeta({
                    lastPulledAt: new Date().toISOString(),
                    cloudRevision: response.revision,
                    syncStatus: 'idle'
                });
            }

            return response;
        } catch (error) {
            window.LocalStorageAdapter.updateSyncMeta({
                syncStatus: 'error',
                lastError: error.message
            });
            return { success: false, reason: error.message };
        }
    },

    async push(funds, trades) {
        if (!CloudflareD1SyncAdapter.isConfigured()) {
            return { success: false, reason: 'not_configured' };
        }

        const syncMeta = window.LocalStorageAdapter.getSyncMeta();

        try {
            const response = await CloudflareD1SyncAdapter._request('/sync/push', 'POST', {
                deviceId: syncMeta.deviceId,
                baseRevision: syncMeta.cloudRevision,
                funds: funds,
                trades: trades
            });

            if (response.success) {
                window.LocalStorageAdapter.updateSyncMeta({
                    lastPushedAt: new Date().toISOString(),
                    cloudRevision: response.revision,
                    syncStatus: 'idle',
                    pendingChanges: 0
                });
            } else if (response.conflict) {
                window.LocalStorageAdapter.updateSyncMeta({
                    syncStatus: 'conflict'
                });
            }

            return response;
        } catch (error) {
            window.LocalStorageAdapter.updateSyncMeta({
                syncStatus: 'error',
                lastError: error.message
            });
            return { success: false, reason: error.message };
        }
    },

    async resolve(conflicts, resolution) {
        if (!CloudflareD1SyncAdapter.isConfigured()) {
            return { success: false, reason: 'not_configured' };
        }

        const syncMeta = window.LocalStorageAdapter.getSyncMeta();

        try {
            const response = await CloudflareD1SyncAdapter._request('/sync/resolve', 'POST', {
                deviceId: syncMeta.deviceId,
                baseRevision: syncMeta.cloudRevision,
                conflicts: conflicts,
                resolution: resolution
            });

            if (response.success) {
                window.LocalStorageAdapter.updateSyncMeta({
                    lastPushedAt: new Date().toISOString(),
                    cloudRevision: response.revision,
                    syncStatus: 'idle'
                });
            }

            return response;
        } catch (error) {
            return { success: false, reason: error.message };
        }
    },

    markSyncComplete(timestamp = new Date().toISOString()) {
        return window.LocalStorageAdapter.updateSyncMeta({
            lastSyncAt: timestamp,
            syncStatus: 'idle'
        });
    },

    async _request(endpoint, method, body = null) {
        const { workerUrl, timeout } = CloudflareD1SyncAdapter._config;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const options = {
            method,
            headers: {
                'Content-Type': 'application/json'
            },
            signal: controller.signal,
            credentials: 'include'
        };

        if (body) {
            options.body = JSON.stringify(body);
        }

        try {
            const url = workerUrl + endpoint;
            const response = await fetch(url, options);
            clearTimeout(timeoutId);

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || `HTTP ${response.status}`);
            }

            return data;
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }
};

ModuleRegistry.register('CloudflareD1SyncAdapter', CloudflareD1SyncAdapter);
