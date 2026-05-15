const CloudflareD1SyncAdapter = {
    _config: {
        basePath: null,
        timeout: 10000
    },

    init(config = {}) {
        CloudflareD1SyncAdapter._config = {
            ...CloudflareD1SyncAdapter._config,
            ...config
        };
    },

    isConfigured() {
        return !!CloudflareD1SyncAdapter._config.basePath;
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

    /**
     * 检查认证状态（无鉴权模式，始终返回无需密码）
     */
    async checkAuthStatus() {
        return { authEnabled: false, authenticated: true };
    },

    /**
     * 登录（无鉴权模式，始终返回成功）
     */
    async login() {
        return { success: true };
    },

    async pull() {
        if (!CloudflareD1SyncAdapter.isConfigured()) {
            return { success: false, reason: 'not_configured' };
        }

        const syncMeta = window.LocalStorageAdapter.getSyncMeta();

        try {
            const response = await CloudflareD1SyncAdapter._request('/pull', 'GET', {
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

    async push(funds, trades, options) {
        if (!CloudflareD1SyncAdapter.isConfigured()) {
            return { success: false, reason: 'not_configured' };
        }

        const syncMeta = window.LocalStorageAdapter.getSyncMeta();

        const body = {
            deviceId: syncMeta.deviceId,
            baseRevision: syncMeta.cloudRevision,
            funds: funds,
            trades: trades
        };

        if (options && options.source) {
            body.source = options.source;
        }

        try {
            const response = await CloudflareD1SyncAdapter._request('/push', 'POST', body);

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
            const response = await CloudflareD1SyncAdapter._request('/resolve', 'POST', {
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

    _buildUrl(endpoint) {
        const { basePath } = CloudflareD1SyncAdapter._config;
        const normalizedBasePath = String(basePath || '').replace(/\/+$/, '');
        const normalizedEndpoint = String(endpoint || '').replace(/^\/+/, '');
        return normalizedBasePath + '/' + normalizedEndpoint;
    },

    async _request(endpoint, method, body = null) {
        const { timeout } = CloudflareD1SyncAdapter._config;
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

        // GET/HEAD 请求不能带 body，改为 URL 查询参数
        const GET_OR_HEAD_METHODS = ['GET', 'HEAD'];
        if (body && GET_OR_HEAD_METHODS.includes(method.toUpperCase())) {
            const queryString = Object.entries(body)
                .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
                .join('&');
            const url = CloudflareD1SyncAdapter._buildUrl(endpoint) + (queryString ? '?' + queryString : '');
            const response = await fetch(url, options);
            clearTimeout(timeoutId);

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || `HTTP ${response.status}`);
            }

            return data;
        }

        if (body) {
            options.body = JSON.stringify(body);
        }

        try {
            const url = CloudflareD1SyncAdapter._buildUrl(endpoint);
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
