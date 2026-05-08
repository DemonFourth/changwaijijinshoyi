const TradeRepository = {
    getAll() {
        return window.LocalStorageAdapter.loadTrades();
    },

    getByFundId(fundId) {
        return TradeRepository.getAll().filter(trade => trade.fundId === fundId);
    },

    getById(tradeId) {
        return TradeRepository.getAll().find(trade => trade.id === tradeId) || null;
    },

    saveAll(trades) {
        return window.LocalStorageAdapter.saveTrades(trades);
    },

    softDelete(tradeId) {
        const now = new Date().toISOString();
        const snapshot = window.LocalStorageAdapter.loadSnapshot();
        snapshot.trades = snapshot.trades.map(trade => {
            if (trade.id !== tradeId) {
                return trade;
            }

            return {
                ...trade,
                deletedAt: now,
                updatedAt: now
            };
        });
        return window.LocalStorageAdapter.saveSnapshot(snapshot);
    }
};

ModuleRegistry.register('TradeRepository', TradeRepository);
