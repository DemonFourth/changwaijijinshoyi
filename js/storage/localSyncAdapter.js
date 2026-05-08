const LocalSyncAdapter = {
    getStatus() {
        const syncMeta = window.LocalStorageAdapter.getSyncMeta();
        return {
            provider: syncMeta.provider || 'local',
            deviceId: syncMeta.deviceId || '',
            lastSyncAt: syncMeta.lastSyncAt || null,
            canPush: false,
            canPull: false
        };
    },

    markSyncComplete(timestamp = new Date().toISOString()) {
        const snapshot = window.LocalStorageAdapter.loadSnapshot();
        snapshot.syncMeta = {
            ...snapshot.syncMeta,
            provider: snapshot.syncMeta.provider || 'local',
            lastSyncAt: timestamp
        };
        return window.LocalStorageAdapter.saveSnapshot(snapshot);
    },

    push() {
        return {
            success: false,
            reason: 'not_configured'
        };
    },

    pull() {
        return {
            success: false,
            reason: 'not_configured'
        };
    }
};

ModuleRegistry.register('LocalSyncAdapter', LocalSyncAdapter);
