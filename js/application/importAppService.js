const ImportAppService = {
    normalizeImportPayload(data) {
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
            return {
                success: false,
                reason: 'invalid_payload'
            };
        }

        return {
            success: true,
            funds: Array.isArray(data.funds)
                ? data.funds.map(fund => window.StorageSchema.createFundEntity(fund))
                : [],
            trades: Array.isArray(data.trades)
                ? data.trades.map(trade => window.StorageSchema.createTradeEntity(trade))
                : [],
            settings: data.settings && typeof data.settings === 'object' && !Array.isArray(data.settings)
                ? data.settings
                : {},
            syncMeta: data.syncMeta && typeof data.syncMeta === 'object' && !Array.isArray(data.syncMeta)
                ? data.syncMeta
                : {},
            schemaVersion: data.schemaVersion || window.StorageSchema.VERSION
        };
    },

    mergeBusinessData(existingSnapshot, incomingPayload) {
        return {
            funds: Storage.mergeArrays(existingSnapshot.funds || [], incomingPayload.funds || [], 'id'),
            trades: Storage.mergeArrays(existingSnapshot.trades || [], incomingPayload.trades || [], 'id'),
            settings: {
                ...(existingSnapshot.settings || {}),
                ...(incomingPayload.settings || {})
            }
        };
    },

    _sanitizeSyncMeta(currentSyncMeta) {
        return {
            provider: currentSyncMeta.provider,
            deviceId: currentSyncMeta.deviceId,
            cloudRevision: currentSyncMeta.cloudRevision || 0,
            lastSyncAt: currentSyncMeta.lastSyncAt || null,
            lastPulledAt: currentSyncMeta.lastPulledAt || null,
            lastPushedAt: currentSyncMeta.lastPushedAt || null,
            pendingChanges: 0,
            syncStatus: currentSyncMeta.syncStatus || 'idle',
            lastError: null
        };
    },

    async importData(data, options = {}) {
        const { merge = false } = options;
        const normalized = ImportAppService.normalizeImportPayload(data);

        if (!normalized.success) {
            return {
                success: false,
                mode: merge ? 'merge' : 'overwrite',
                importedFunds: 0,
                importedTrades: 0,
                mergedFunds: 0,
                mergedTrades: 0,
                reason: normalized.reason
            };
        }

        const existingSnapshot = {
            funds: window.FundRepository.getAll(),
            trades: window.TradeRepository.getAll(),
            settings: Storage.loadSettings()
        };

        const nextData = merge
            ? ImportAppService.mergeBusinessData(existingSnapshot, normalized)
            : {
                funds: normalized.funds,
                trades: normalized.trades,
                settings: normalized.settings
            };

        const fundsSaved = window.FundRepository.saveAll(nextData.funds);
        const tradesSaved = window.TradeRepository.saveAll(nextData.trades);
        const settingsSaved = Object.keys(nextData.settings).length > 0
            ? Storage.saveSettings(nextData.settings)
            : true;

        if (!fundsSaved || !tradesSaved || !settingsSaved) {
            return {
                success: false,
                mode: merge ? 'merge' : 'overwrite',
                importedFunds: 0,
                importedTrades: 0,
                mergedFunds: 0,
                mergedTrades: 0,
                reason: 'save_failed'
            };
        }

        if (typeof window.LocalStorageAdapter !== 'undefined' && typeof window.LocalStorageAdapter.getSyncMeta === 'function') {
            const currentSyncMeta = window.LocalStorageAdapter.getSyncMeta();
            window.LocalStorageAdapter.updateSyncMeta(ImportAppService._sanitizeSyncMeta(currentSyncMeta));
        }

        EventBus.emit(EventType.DATA_IMPORTED, { merge, data: normalized });
        if (typeof window.SyncAppService !== 'undefined') {
            await window.SyncAppService.notifyBusinessDataChanged('import');
        }

        return {
            success: true,
            mode: merge ? 'merge' : 'overwrite',
            importedFunds: normalized.funds.length,
            importedTrades: normalized.trades.length,
            mergedFunds: nextData.funds.length,
            mergedTrades: nextData.trades.length,
            reason: ''
        };
    },

    async clearAll() {
        const fundsSaved = window.FundRepository.saveAll([]);
        const tradesSaved = window.TradeRepository.saveAll([]);

        if (!fundsSaved || !tradesSaved) {
            return {
                success: false,
                mode: 'clear',
                importedFunds: 0,
                importedTrades: 0,
                mergedFunds: 0,
                mergedTrades: 0,
                reason: 'clear_failed'
            };
        }

        if (typeof window.LocalStorageAdapter !== 'undefined' && typeof window.LocalStorageAdapter.getSyncMeta === 'function') {
            const currentSyncMeta = window.LocalStorageAdapter.getSyncMeta();
            window.LocalStorageAdapter.updateSyncMeta(ImportAppService._sanitizeSyncMeta(currentSyncMeta));
        }

        EventBus.emit(EventType.DATA_CLEARED);
        if (typeof window.SyncAppService !== 'undefined') {
            await window.SyncAppService.notifyBusinessDataChanged('clear');
        }

        return {
            success: true,
            mode: 'clear',
            importedFunds: 0,
            importedTrades: 0,
            mergedFunds: 0,
            mergedTrades: 0,
            reason: ''
        };
    }
};

ModuleRegistry.register('ImportAppService', ImportAppService);
