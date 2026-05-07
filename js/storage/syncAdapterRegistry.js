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

    getCurrentAdapter() {
        const syncMeta = window.LocalStorageAdapter.getSyncMeta();
        return SyncAdapterRegistry.getAdapter(syncMeta.provider || 'local');
    }
};

ModuleRegistry.register('SyncAdapterRegistry', SyncAdapterRegistry);
