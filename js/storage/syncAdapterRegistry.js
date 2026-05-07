const SyncAdapterRegistry = {
    adapters: {
        local: window.LocalSyncAdapter
    },

    getAdapter(provider = 'local') {
        return SyncAdapterRegistry.adapters[provider] || null;
    },

    registerAdapter(provider, adapter) {
        SyncAdapterRegistry.adapters[provider] = adapter;
    },

    registerCloudflareAdapter() {
        if (typeof window.CloudflareD1SyncAdapter !== 'undefined') {
            SyncAdapterRegistry.registerAdapter('cloudflare', window.CloudflareD1SyncAdapter);
        }
    },

    getCurrentAdapter() {
        const syncMeta = window.LocalStorageAdapter.getSyncMeta();
        const provider = syncMeta.provider || 'local';

        if (provider === 'cloudflare') {
            const adapter = SyncAdapterRegistry.getAdapter('cloudflare');
            if (!adapter || !adapter.isConfigured()) {
                console.warn('Cloudflare sync not configured, falling back to local');
                return SyncAdapterRegistry.getAdapter('local');
            }
        }

        return SyncAdapterRegistry.getAdapter(provider) || SyncAdapterRegistry.getAdapter('local');
    }
};

ModuleRegistry.register('SyncAdapterRegistry', SyncAdapterRegistry);
