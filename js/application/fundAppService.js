const FundAppService = {
    getAllFunds() {
        return window.FundRepository.getAll();
    },

    getFund(fundId) {
        return window.FundRepository.getById(fundId);
    },

    addFund(fund) {
        const funds = window.FundRepository.getAll();
        funds.push(window.StorageSchema.createFundEntity(fund));
        return window.FundRepository.saveAll(funds);
    },

    updateFund(fundId, updates) {
        const now = new Date().toISOString();
        const funds = window.FundRepository.getAll();
        const index = funds.findIndex(fund => fund.id === fundId);

        if (index === -1) {
            return false;
        }

        funds[index] = window.StorageSchema.createFundEntity({
            ...funds[index],
            ...updates,
            updatedAt: now,
            updateTime: updates.updateTime || now
        });

        return window.FundRepository.saveAll(funds);
    },

    deleteFund(fundId) {
        const tradeSnapshot = window.LocalStorageAdapter.loadSnapshot();
        const now = new Date().toISOString();

        tradeSnapshot.trades = tradeSnapshot.trades.map(trade => {
            if (trade.fundId !== fundId) {
                return trade;
            }

            return {
                ...trade,
                deletedAt: now,
                updatedAt: now
            };
        });

        const fundDeleted = window.FundRepository.softDelete(fundId);
        const tradeDeleted = window.LocalStorageAdapter.saveSnapshot(tradeSnapshot);

        return fundDeleted && tradeDeleted;
    }
};

ModuleRegistry.register('FundAppService', FundAppService);
