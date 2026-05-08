const LocalStorageAdapter = {
    loadSnapshot() {
        const snapshotKey = Config.get('storage.snapshotKey');
        const rawSnapshot = Storage.load(snapshotKey);
        const snapshot = window.StorageMigrations.migrateSnapshot(rawSnapshot);

        if (!rawSnapshot || rawSnapshot.schemaVersion !== window.StorageSchema.VERSION) {
            Storage.save(snapshotKey, snapshot);
        }

        return snapshot;
    },

    saveSnapshot(snapshot) {
        const normalizedSnapshot = window.StorageMigrations.migrateSnapshot(snapshot);
        return Storage.save(Config.get('storage.snapshotKey'), normalizedSnapshot);
    },

    loadFunds() {
        return LocalStorageAdapter.loadSnapshot().funds.filter(fund => !fund.deletedAt);
    },

    saveFunds(funds) {
        const snapshot = LocalStorageAdapter.loadSnapshot();
        snapshot.funds = funds.map(fund => window.StorageSchema.createFundEntity(fund));
        return LocalStorageAdapter.saveSnapshot(snapshot);
    },

    loadTrades() {
        return LocalStorageAdapter.loadSnapshot().trades.filter(trade => !trade.deletedAt);
    },

    saveTrades(trades) {
        const snapshot = LocalStorageAdapter.loadSnapshot();
        snapshot.trades = trades.map(trade => window.StorageSchema.createTradeEntity(trade));
        return LocalStorageAdapter.saveSnapshot(snapshot);
    },

    getSyncMeta() {
        return LocalStorageAdapter.loadSnapshot().syncMeta;
    },

    updateSyncMeta(updates) {
        const snapshot = LocalStorageAdapter.loadSnapshot();
        snapshot.syncMeta = {
            ...snapshot.syncMeta,
            ...updates
        };
        return LocalStorageAdapter.saveSnapshot(snapshot);
    },

    getCurrentSyncAdapter() {
        return window.SyncAdapterRegistry.getCurrentAdapter();
    }
};

ModuleRegistry.register('LocalStorageAdapter', LocalStorageAdapter);
