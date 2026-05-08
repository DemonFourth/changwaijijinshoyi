const StorageSchema = {
    VERSION: 1,

    generateDeviceId() {
        const key = 'fund_calculator_device_id';
        let deviceId = localStorage.getItem(key);
        if (!deviceId) {
            deviceId = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem(key, deviceId);
        }
        return deviceId;
    },

    createEmptySnapshot() {
        return {
            schemaVersion: StorageSchema.VERSION,
            funds: [],
            trades: [],
            syncMeta: {
                provider: 'local',
                deviceId: StorageSchema.generateDeviceId(),
                lastSyncAt: null,
                lastPulledAt: null,
                lastPushedAt: null,
                cloudRevision: 0,
                syncStatus: 'idle',
                pendingChanges: 0,
                lastError: null
            }
        };
    },

    normalizeFeeTiers(feeTiers) {
        return feeTiers || {
            buyTiers: [],
            sellTiers: []
        };
    },

    createFundEntity(fund) {
        const now = new Date().toISOString();

        return {
            ...fund,
            id: fund.id,
            code: fund.code,
            name: fund.name,
            remark: fund.remark || '',
            feeTiers: StorageSchema.normalizeFeeTiers(fund.feeTiers),
            createdAt: fund.createdAt || fund.createTime || now,
            updatedAt: fund.updatedAt || fund.updateTime || now,
            deletedAt: fund.deletedAt || null,
            syncId: fund.syncId || fund.id,
            lastSyncedAt: fund.lastSyncedAt || null
        };
    },

    createTradeEntity(trade) {
        const now = new Date().toISOString();

        return {
            ...trade,
            id: trade.id,
            fundId: trade.fundId,
            date: trade.date,
            type: trade.type,
            netValue: Number(trade.netValue || 0),
            shares: Number(trade.shares || 0),
            amount: Number(trade.amount || 0),
            fee: Number(trade.fee || 0),
            remark: trade.remark || '',
            dividendMode: trade.dividendMode || null,
            createdAt: trade.createdAt || trade.createTime || now,
            updatedAt: trade.updatedAt || trade.updateTime || now,
            deletedAt: trade.deletedAt || null,
            syncId: trade.syncId || trade.id,
            lastSyncedAt: trade.lastSyncedAt || null
        };
    }
};

ModuleRegistry.register('StorageSchema', StorageSchema);
