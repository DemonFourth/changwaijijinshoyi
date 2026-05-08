const FundRepository = {
    getAll() {
        return window.LocalStorageAdapter.loadFunds();
    },

    getById(fundId) {
        return FundRepository.getAll().find(fund => fund.id === fundId) || null;
    },

    saveAll(funds) {
        return window.LocalStorageAdapter.saveFunds(funds);
    },

    softDelete(fundId) {
        const now = new Date().toISOString();
        const snapshot = window.LocalStorageAdapter.loadSnapshot();
        snapshot.funds = snapshot.funds.map(fund => {
            if (fund.id !== fundId) {
                return fund;
            }

            return {
                ...fund,
                deletedAt: now,
                updatedAt: now
            };
        });
        return window.LocalStorageAdapter.saveSnapshot(snapshot);
    }
};

ModuleRegistry.register('FundRepository', FundRepository);
