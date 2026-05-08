const TradeAppService = {
    getTradesByFund(fundId) {
        return window.TradeRepository.getByFundId(fundId);
    },

    getTrade(tradeId) {
        return window.TradeRepository.getById(tradeId);
    },

    addTrade(trade) {
        const trades = window.TradeRepository.getAll();
        trades.push(window.StorageSchema.createTradeEntity(trade));
        return window.TradeRepository.saveAll(trades);
    },

    updateTrade(tradeId, updates) {
        const now = new Date().toISOString();
        const trades = window.TradeRepository.getAll();
        const index = trades.findIndex(trade => trade.id === tradeId);

        if (index === -1) {
            return false;
        }

        trades[index] = window.StorageSchema.createTradeEntity({
            ...trades[index],
            ...updates,
            updatedAt: now,
            updateTime: updates.updateTime || now
        });

        return window.TradeRepository.saveAll(trades);
    },

    deleteTrade(tradeId) {
        return window.TradeRepository.softDelete(tradeId);
    }
};

ModuleRegistry.register('TradeAppService', TradeAppService);
