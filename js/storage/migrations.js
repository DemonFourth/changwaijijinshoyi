const StorageMigrations = {
    migrateSnapshot(snapshot) {
        if (snapshot && snapshot.schemaVersion === window.StorageSchema.VERSION) {
            const defaultMeta = window.StorageSchema.createEmptySnapshot().syncMeta;
            return {
                ...snapshot,
                funds: Array.isArray(snapshot.funds)
                    ? snapshot.funds.map(fund => window.StorageSchema.createFundEntity(fund))
                    : [],
                trades: Array.isArray(snapshot.trades)
                    ? snapshot.trades.map(trade => window.StorageSchema.createTradeEntity(trade))
                    : [],
                syncMeta: {
                    ...defaultMeta,
                    ...(snapshot.syncMeta || {})
                }
            };
        }

        return StorageMigrations.migrateLegacyData();
    },

    migrateLegacyData() {
        const snapshot = window.StorageSchema.createEmptySnapshot();
        const legacyFunds = Storage.load(Config.get('storage.fundsKey')) || [];
        const legacyTrades = Storage.load(Config.get('storage.tradesKey')) || [];

        snapshot.funds = legacyFunds.map(fund => window.StorageSchema.createFundEntity(fund));
        snapshot.trades = legacyTrades.map(trade => window.StorageSchema.createTradeEntity(trade));

        return snapshot;
    }
};

ModuleRegistry.register('StorageMigrations', StorageMigrations);
