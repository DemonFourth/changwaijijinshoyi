const SyncAppService = {
    _syncInProgress: false,
    _listenersPaused: false,
    _pausedChanges: 0,
    _pendingChanges: [],
    _pushTimeout: null,
    _retryCount: 0,
    _maxRetryCount: 3,
    _retryBaseDelay: 3000,
    _firstSyncCloudData: null,
    _firstSyncCloudRevision: 0,

    _FUND_SYNC_SKIP_FIELDS: new Set([
        'netValue', 'netValueDate', 'estimatedValue', 'estimatedGrowth',
        'updateTime', 'nameSource', 'nameUpdateTime'
    ]),

    _isRetryableError(reason) {
        if (!reason) return false;
        const patterns = ['aborted', 'timeout', 'network', 'fetch', 'etimedout', '连接'];
        const lowerReason = reason.toLowerCase();
        return patterns.some(p => lowerReason.includes(p.toLowerCase()));
    },

    _sanitizeFundsForSync(funds) {
        return (funds || []).map(function (fund) {
            const sanitized = {};
            for (const key of Object.keys(fund)) {
                if (!SyncAppService._FUND_SYNC_SKIP_FIELDS.has(key)) {
                    sanitized[key] = fund[key];
                }
            }
            return sanitized;
        });
    },

    _getNowIso() {
        return new Date().toISOString();
    },

    _toLogText(label, value) {
        if (value === undefined) {
            console.log(label);
            return;
        }

        try {
            console.log(label + ' ' + JSON.stringify(value));
        } catch (_error) {
            console.log(label + ' [日志序列化失败]');
        }
    },

    _finalizePushSuccess(result, prePushPendingCount) {
        const now = SyncAppService._getNowIso();
        const snapshot = window.LocalStorageAdapter.loadSnapshot();
        const currentSyncMeta = window.LocalStorageAdapter.getSyncMeta();

        snapshot.funds = (snapshot.funds || []).map(fund => ({
            ...fund,
            lastSyncedAt: now
        }));
        snapshot.trades = (snapshot.trades || []).map(trade => ({
            ...trade,
            lastSyncedAt: now
        }));

        // 递减 pendingChanges：只减去已推送的变更数
        const remainingChanges = Math.max(0, (currentSyncMeta.pendingChanges || 0) - (prePushPendingCount || 0));

        window.LocalStorageAdapter.saveSnapshot(snapshot);
        const currentCloudFunds = (snapshot.funds || []).length;
        const currentCloudTrades = (snapshot.trades || []).length;
        window.LocalStorageAdapter.updateSyncMeta({
            lastSyncAt: now,
            lastPushedAt: now,
            cloudRevision: result.revision || currentSyncMeta.cloudRevision,
            syncStatus: 'idle',
            pendingChanges: remainingChanges,
            cloudFunds: currentCloudFunds,
            cloudTrades: currentCloudTrades,
            lastError: null
        });
        if (window.Utils && typeof window.Utils.showToast === 'function' && prePushPendingCount > 0) {
            window.Utils.showToast('同步成功', 'success');
        }
        SyncAppService._emitSyncApplied({ mode: 'push', hasChanges: prePushPendingCount > 0 });
    },

    async init(config = {}) {
        const { enabled, basePath, timeout, syncKey } = config;

        if (enabled && basePath) {
            window.CloudflareD1SyncAdapter.init({
                basePath: basePath,
                timeout: timeout || 30000,
                syncKey: syncKey || null
            });
            window.SyncAdapterRegistry.registerCloudflareAdapter();

            const snapshot = window.LocalStorageAdapter.loadSnapshot();
            snapshot.syncMeta = { ...snapshot.syncMeta, provider: 'cloudflare' };
            window.LocalStorageAdapter.saveSnapshot(snapshot);
        } else {
            const snapshot = window.LocalStorageAdapter.loadSnapshot();
            snapshot.syncMeta = { ...snapshot.syncMeta, provider: 'local' };
            window.LocalStorageAdapter.saveSnapshot(snapshot);
        }

        this._setupEventListeners();
        this._setupVisibilitySync();
        this._setupPeriodicSync(5 * 60 * 1000);
    },

    _setupVisibilitySync() {
        if (!document || typeof document.addEventListener !== 'function') return;

        document.addEventListener('visibilitychange', async function () {
            const syncMeta = window.LocalStorageAdapter.getSyncMeta();

            if (document.hidden) {
                if ((syncMeta.pendingChanges || 0) > 0 && syncMeta.syncStatus === 'pending') {
                    SyncAppService._executePush();
                }
                return;
            }

            if (syncMeta.provider !== 'cloudflare') return;

            const lastSync = syncMeta.lastSyncAt;
            const now = Date.now();
            const minInterval = 30 * 1000;

            if (!lastSync || now - new Date(lastSync).getTime() > minInterval) {
                console.log('[Sync] 页面重新可见，触发同步检查');

                try {
                    const result = await SyncAppService._executePull();
                    if (result?.success && result?.pulledChanges) {
                        const pc = result.pulledChanges;
                        const totalChanges = (pc.fundsAdded || 0) + (pc.tradesAdded || 0) +
                            (pc.fundsUpdated || 0) + (pc.tradesUpdated || 0);
                        if (totalChanges > 0) {
                            window.Utils?.showToast(`从云端同步了 ${totalChanges} 条更新`, 'success');
                            window.Overview?.refresh();
                        }
                    }
                } catch (error) {
                    console.error('[Sync] 可见性同步失败:', error);
                }
            }
        });
    },

    _setupPeriodicSync(interval) {
        if (!interval || interval <= 0) return;

        setInterval(async () => {
            if (document.visibilityState !== 'visible') return;

            const syncMeta = window.LocalStorageAdapter.getSyncMeta();
            if (syncMeta.provider !== 'cloudflare') return;

            console.log('[Sync] 定时同步检查');
            try {
                await SyncAppService._executePull();
            } catch (error) {
                console.error('[Sync] 定时同步失败:', error);
            }
        }, interval);
    },

    _dataChangePending: false,

    _setupEventListeners() {
        EventBus.on(EventType.FUND_ADDED, () => SyncAppService._onDataChanged('event'));
        EventBus.on(EventType.FUND_UPDATED, () => SyncAppService._onDataChanged('event'));
        EventBus.on(EventType.FUND_DELETED, () => SyncAppService._onDataChanged('event'));

        EventBus.on(EventType.TRADE_ADDED, () => SyncAppService._onDataChanged('event'));
        EventBus.on(EventType.TRADE_UPDATED, (data) => {
            const isBatchDelete = data?.reason === 'batch-delete';
            SyncAppService._onDataChanged(isBatchDelete ? 'batch-delete' : 'event');
        });
        EventBus.on(EventType.TRADE_DELETED, () => SyncAppService._onDataChanged('event'));
        EventBus.on(EventType.DATA_IMPORTED, () => SyncAppService._onDataChanged('import'));
        EventBus.on(EventType.DATA_CLEARED, () => SyncAppService._onDataChanged('clear'));
    },

    pauseEventListeners() {
        SyncAppService._listenersPaused = true;
        SyncAppService._pausedChanges = 0;
    },

    resumeEventListeners() {
        SyncAppService._listenersPaused = false;
        if (SyncAppService._pausedChanges > 0) {
            SyncAppService.notifyBusinessDataChanged('batch-resume');
        }
        SyncAppService._pausedChanges = 0;
    },

    async notifyBusinessDataChanged(source = 'unknown') {
        const adapter = window.SyncAdapterRegistry.getCurrentAdapter();
        if (!adapter || typeof adapter.getStatus !== 'function') {
            console.log('[同步调试] 未找到可用同步适配器，跳过待同步标记');
            return;
        }

        const status = adapter.getStatus();
        if (!status || !status.canPush) {
            SyncAppService._toLogText('[同步调试] 当前适配器不可推送，跳过同步', status || null);
            return;
        }

        const syncMeta = window.LocalStorageAdapter.getSyncMeta();
        const delay = SyncAppService._getPushDelay(source);
        const nextPendingChanges = (syncMeta.pendingChanges || 0) + 1;
        window.LocalStorageAdapter.updateSyncMeta({
            pendingChanges: nextPendingChanges,
            syncStatus: 'pending',
            lastPendingAt: new Date().toISOString(),
            pendingSource: source
        });

        clearTimeout(SyncAppService._pushTimeout);
        SyncAppService._pushTimeout = setTimeout(() => {
            SyncAppService._executePush();
        }, delay);

        SyncAppService._toLogText('[同步调试] 已标记业务变更，等待推送', {
            source,
            delay,
            provider: status.provider || 'unknown',
            pendingChanges: nextPendingChanges,
            cloudRevision: syncMeta.cloudRevision || 0
        });
    },

    _onDataChanged(source = 'event') {
        if (SyncAppService._listenersPaused) {
            SyncAppService._pausedChanges++;
            return;
        }
        if (SyncAppService._dataChangePending) return;
        SyncAppService._dataChangePending = true;
        setTimeout(() => {
            SyncAppService._dataChangePending = false;
            SyncAppService.notifyBusinessDataChanged(source);
        }, 0);
    },

    _getPushDelay(source) {
        const delayMap = {
            import: 0,
            clear: 0,
            'batch-delete': 1000,
            'batch-resume': 0,
            event: 2000,
            unknown: 5000
        };

        return delayMap[source] ?? 5000;
    },

    _emitSyncApplied(payload = {}) {
        EventBus.emit(EventType.SYNC_DATA_APPLIED, {
            source: 'sync',
            ...payload
        });
    },

    _scheduleRetry(reason) {
        if (SyncAppService._retryCount >= SyncAppService._maxRetryCount) {
            SyncAppService._syncInProgress = false;
            SyncAppService._retryCount = 0;
            window.LocalStorageAdapter.updateSyncMeta({
                syncStatus: 'error',
                lastError: reason || 'push_failed'
            });
            if (window.Utils && typeof window.Utils.showToast === 'function') {
                window.Utils.showToast('同步失败，请检查网络后重试', 'error', 0);
            }
            return;
        }

        SyncAppService._retryCount += 1;
        const delay = SyncAppService._retryBaseDelay * SyncAppService._retryCount;
        if (window.Utils && typeof window.Utils.showToast === 'function' && SyncAppService._retryCount > 0) {
            window.Utils.showToast('网络较慢，正在重试（第' + SyncAppService._retryCount + '次）...', 'warning');
        }
        clearTimeout(SyncAppService._pushTimeout);
        SyncAppService._pushTimeout = setTimeout(() => {
            SyncAppService._executePush();
        }, delay);
    },

    async startBackgroundSync() {
        const adapter = window.LocalStorageAdapter.getCurrentSyncAdapter();

        // 检查 adapter 是否支持 checkAuthStatus 方法（CloudflareD1SyncAdapter 特有）
        if (typeof adapter.checkAuthStatus === 'function') {
            const authStatus = await adapter.checkAuthStatus();
            if (authStatus.authEnabled && !authStatus.authenticated) {
                return { needPassword: true, authStatus };
            }
        }

        return this._executePull();
    },

    async _executePull() {
        if (SyncAppService._syncInProgress) {
            console.log('[同步调试] pull 跳过：已有同步进行中');
            return { success: true, reason: 'sync_in_progress' };
        }

        const adapter = window.LocalStorageAdapter.getCurrentSyncAdapter();
        if (!adapter || typeof adapter.getStatus !== 'function') {
            console.log('[同步调试] pull 跳过：未找到可用同步适配器');
            return { success: false, reason: 'not_configured' };
        }

        const status = adapter.getStatus();

        if (!status.canPull) {
            SyncAppService._toLogText('[同步调试] pull 跳过：当前适配器不可拉取', status);
            return { success: true, reason: 'not_configured' };
        }

        SyncAppService._syncInProgress = true;

        try {
            SyncAppService._toLogText('[同步调试] 开始执行 pull', {
                provider: status.provider || 'unknown',
                cloudRevision: window.LocalStorageAdapter.getSyncMeta().cloudRevision || 0
            });
            window.LocalStorageAdapter.updateSyncMeta({ syncStatus: 'syncing' });

            const result = await SyncAppService._pullWithRetry(adapter);

            if (!result.success) {
                SyncAppService._toLogText('[同步调试] pull 失败', result);
                if (window.Utils && typeof window.Utils.showToast === 'function') {
                    window.Utils.showToast('同步失败：' + (result.reason || 'pull_failed'), 'error', 0);
                }
                return result;
            }

            SyncAppService._toLogText('[同步调试] pull 成功', {
                revision: result.revision || 0,
                funds: (result.funds || []).length,
                trades: (result.trades || []).length
            });

            const localSnapshot = window.LocalStorageAdapter.loadSnapshot();
            const localFunds = localSnapshot.funds || [];
            const localTrades = localSnapshot.trades || [];
            const cloudFunds = result.funds || [];
            const cloudTrades = result.trades || [];

            window.LocalStorageAdapter.updateSyncMeta({
                cloudFunds: cloudFunds.length,
                cloudTrades: cloudTrades.length
            });

            // 本地空，云端有数据 → 直接填充
            if ((localFunds.length === 0 && localTrades.length === 0) &&
                (cloudFunds.length > 0 || cloudTrades.length > 0)) {
                const now = SyncAppService._getNowIso();
                const newSnapshot = {
                    ...localSnapshot,
                    funds: cloudFunds.map(function (f) { return { ...window.StorageSchema.createFundEntity(f), lastSyncedAt: now }; }),
                    trades: cloudTrades.map(function (t) { return { ...window.StorageSchema.createTradeEntity(t), lastSyncedAt: now }; }),
                    syncMeta: {
                        ...localSnapshot.syncMeta,
                        cloudFunds: cloudFunds.length,
                        cloudTrades: cloudTrades.length,
                        pendingChanges: 0,
                        lastSyncAt: now,
                        lastPulledAt: now,
                        syncStatus: 'idle',
                        lastError: null
                    }
                };
                window.LocalStorageAdapter.saveSnapshot(newSnapshot);
                SyncAppService._emitSyncApplied({ mode: 'pull', hasChanges: true });
                return { success: true, reason: 'filled_from_cloud', pulledChanges: { fundsAdded: cloudFunds.length, fundsUpdated: 0, tradesAdded: cloudTrades.length, tradesUpdated: 0 } };
            }

            // 本地有数据，云端为空（且 revision 有更新）→ 云端被清空了，用空数据覆盖本地
            const syncMeta = window.LocalStorageAdapter.getSyncMeta();
            const localCloudRevision = syncMeta.cloudRevision || 0;
            if ((localFunds.length > 0 || localTrades.length > 0) &&
                (cloudFunds.length === 0 && cloudTrades.length === 0) &&
                result.revision > localCloudRevision) {
                const now = SyncAppService._getNowIso();
                const newSnapshot = {
                    ...localSnapshot,
                    funds: [],
                    trades: [],
                    syncMeta: {
                        ...localSnapshot.syncMeta,
                        cloudFunds: 0,
                        cloudTrades: 0,
                        pendingChanges: 0,
                        lastSyncAt: now,
                        lastPulledAt: now,
                        syncStatus: 'idle',
                        lastError: null
                    }
                };
                window.LocalStorageAdapter.saveSnapshot(newSnapshot);
                SyncAppService._emitSyncApplied({ mode: 'pull', hasChanges: true });
                return { success: true, reason: 'cleared_by_cloud' };
            }

            // 首次同步检测：双方有数据且所有本地实体均未标记 lastSyncedAt
            const firstSyncMeta = window.LocalStorageAdapter.getSyncMeta();
            const anyEntitySynced = localFunds.some(function (f) { return f.lastSyncedAt; }) ||
                localTrades.some(function (t) { return t.lastSyncedAt; });
            const isFirstSync = !firstSyncMeta.lastSyncAt && !anyEntitySynced &&
                (localFunds.length > 0 || localTrades.length > 0) &&
                (cloudFunds.length > 0 || cloudTrades.length > 0);

            if (isFirstSync) {
                SyncAppService._firstSyncCloudData = { funds: cloudFunds, trades: cloudTrades };
                SyncAppService._firstSyncCloudRevision = result.revision || firstSyncMeta.cloudRevision || 0;
                return {
                    success: true,
                    firstSync: true,
                    localFunds: localFunds.length,
                    localTrades: localTrades.length,
                    cloudFunds: cloudFunds.length,
                    cloudTrades: cloudTrades.length
                };
            }

            // 本地有数据 → 差异检测与合并
            const mergeResult = this._mergeData(localSnapshot, result);

            if (mergeResult.hasConflicts) {
                return {
                    success: true,
                    hasConflicts: true,
                    conflicts: mergeResult.conflicts
                };
            }

            if (mergeResult.hasChanges) {
                window.LocalStorageAdapter.saveSnapshot(mergeResult.snapshot);
                SyncAppService._emitSyncApplied({ mode: 'pull', hasChanges: true });
                window.Utils?.showToast(`从云端同步了 ${mergeResult.pulledChanges.fundsAdded + mergeResult.pulledChanges.tradesAdded + mergeResult.pulledChanges.fundsUpdated + mergeResult.pulledChanges.tradesUpdated} 条更新`, 'success');
                window.Overview?.refresh();
            } else {
                // 无变化：给用户明确反馈
                SyncAppService._emitSyncApplied({ mode: 'pull', hasChanges: false });
                window.Utils?.showToast('数据已是最新', 'info');
            }

            window.LocalStorageAdapter.updateSyncMeta({
                cloudFunds: cloudFunds.length,
                cloudTrades: cloudTrades.length
            });

            adapter.markSyncComplete();

            return { success: true, pulledChanges: mergeResult.pulledChanges };
        } finally {
            SyncAppService._syncInProgress = false;
        }
    },

    async _executePush() {
        if (SyncAppService._syncInProgress) {
            console.log('[同步调试] push 跳过：已有同步进行中');
            return { success: false, reason: 'sync_in_progress' };
        }

        const adapter = window.LocalStorageAdapter.getCurrentSyncAdapter();
        if (!adapter || typeof adapter.getStatus !== 'function') {
            console.log('[同步调试] push 跳过：未找到可用同步适配器');
            return { success: false, reason: 'not_configured' };
        }

        const status = adapter.getStatus();

        if (!status.canPush) {
            SyncAppService._toLogText('[同步调试] push 跳过：当前适配器不可推送', status);
            return { success: true, reason: 'not_configured' };
        }

        SyncAppService._syncInProgress = true;
        window.LocalStorageAdapter.updateSyncMeta({ syncStatus: 'syncing' });

        try {
            const localSnapshot = window.LocalStorageAdapter.loadSnapshot();
            SyncAppService._toLogText('[同步调试] 开始执行 push', {
                provider: status.provider || 'unknown',
                funds: (localSnapshot.funds || []).length,
                trades: (localSnapshot.trades || []).length,
                pendingChanges: localSnapshot.syncMeta && localSnapshot.syncMeta.pendingChanges || 0,
                cloudRevision: localSnapshot.syncMeta && localSnapshot.syncMeta.cloudRevision || 0
            });
            const prePushPendingCount = (localSnapshot.syncMeta && localSnapshot.syncMeta.pendingChanges) || 0;
            const sanitizedFunds = SyncAppService._sanitizeFundsForSync(localSnapshot.funds);
            const result = await adapter.push(sanitizedFunds, localSnapshot.trades);

            if (result.conflict) {
                SyncAppService._toLogText('[同步调试] push 检测到冲突', {
                    conflicts: (result.conflicts || []).length
                });
                return {
                    success: false,
                    reason: 'conflict',
                    conflicts: result.conflicts
                };
            }

            if (!result.success) {
                SyncAppService._toLogText('[同步调试] push 失败，准备重试', result);
                if (SyncAppService._isRetryableError(result.reason)) {
                    SyncAppService._scheduleRetry(result.reason);
                } else {
                    if (window.Utils && typeof window.Utils.showToast === 'function') {
                        window.Utils.showToast('同步失败：' + (result.reason || 'push_failed'), 'error', 0);
                    }
                    SyncAppService._scheduleRetry(result.reason);
                }
                return result;
            }

            if (result.success) {
                SyncAppService._toLogText('[同步调试] push 成功', {
                    revision: result.revision || 0
                });
                SyncAppService._retryCount = 0;
                SyncAppService._finalizePushSuccess(result, prePushPendingCount);
            }

            return result;
        } finally {
            SyncAppService._syncInProgress = false;
        }
    },

    _mergeData(localSnapshot, cloudSnapshot) {
        const localFunds = localSnapshot.funds || [];
        const localTrades = localSnapshot.trades || [];
        const cloudFunds = cloudSnapshot.funds || [];
        const cloudTrades = cloudSnapshot.trades || [];

        const conflicts = [];
        const mergedFunds = this._mergeEntities(localFunds, cloudFunds, 'fund', conflicts);
        const mergedTrades = this._mergeEntities(localTrades, cloudTrades, 'trade', conflicts);

        const hasChanges = mergedFunds.hasChanges || mergedTrades.hasChanges;

        // 合并后，所有实体标记 lastSyncedAt
        const now = SyncAppService._getNowIso();
        const finalFunds = (mergedFunds.result || []).map(f => ({ ...f, lastSyncedAt: now }));
        const finalTrades = (mergedTrades.result || []).map(t => ({ ...t, lastSyncedAt: now }));

        return {
            hasChanges,
            hasConflicts: conflicts.length > 0,
            conflicts,
            pulledChanges: {
                fundsAdded: mergedFunds.addedCount || 0,
                fundsUpdated: mergedFunds.updatedCount || 0,
                tradesAdded: mergedTrades.addedCount || 0,
                tradesUpdated: mergedTrades.updatedCount || 0
            },
            snapshot: {
                ...localSnapshot,
                funds: finalFunds,
                trades: finalTrades
            }
        };
    },

    _isEntityDataChanged(local, cloud) {
        const skipKeys = new Set(['updatedAt', 'createdAt', 'deletedAt', 'lastSyncedAt', 'updateTime', 'createTime', 'deleteTime', 'syncId', 'id',
            'netValue', 'netValueDate', 'estimatedValue', 'estimatedGrowth', 'nameSource', 'nameUpdateTime']);
        const keys = new Set([...Object.keys(local), ...Object.keys(cloud)]);
        for (const key of keys) {
            if (skipKeys.has(key)) continue;
            if (JSON.stringify(local[key]) !== JSON.stringify(cloud[key])) return true;
        }
        return false;
    },

    async _pullWithRetry(adapter, attempt) {
        if (attempt === undefined) attempt = 1;
        try {
            return await adapter.pull();
        } catch (error) {
            SyncAppService._toLogText('[同步调试] pull 重试 ' + attempt + '/3', { error: error.message });
            if (attempt >= 3) {
                return { success: false, reason: error.message };
            }
            await new Promise(function (resolve) { setTimeout(resolve, 2000 * attempt); });
            return SyncAppService._pullWithRetry(adapter, attempt + 1);
        }
    },

    _mergeEntities(localEntities, cloudEntities, entityType, conflicts) {
        const localMap = new Map(localEntities.map(function (e) { return [e.syncId, e]; }));
        const cloudMap = new Map(cloudEntities.map(function (e) { return [e.syncId, e]; }));

        const result = [];
        let hasChanges = false;
        let addedCount = 0;
        let updatedCount = 0;
        const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

        for (const [syncId, localEntity] of localMap) {
            const cloudEntity = cloudMap.get(syncId);

            if (!cloudEntity) {
                result.push(localEntity);
                continue;
            }

            const lastSyncedTime = localEntity.lastSyncedAt ? new Date(localEntity.lastSyncedAt).getTime() : 0;
            const cloudLastSyncedTime = cloudEntity.lastSyncedAt ? new Date(cloudEntity.lastSyncedAt).getTime() : 0;
            const localTime = new Date(localEntity.updatedAt).getTime();
            const cloudTime = new Date(cloudEntity.updatedAt).getTime();
            // lastSyncedAt=0 表示从未同步，不视为"有变更"
            const localModifiedAfterSync = lastSyncedTime > 0 && localTime > lastSyncedTime;
            const cloudModifiedAfterSync = cloudLastSyncedTime > 0 && cloudTime > cloudLastSyncedTime;

            if (localModifiedAfterSync && cloudModifiedAfterSync) {
                if (this._isEntityDataChanged(localEntity, cloudEntity)) {
                    conflicts.push({
                        entityType: entityType,
                        syncId: syncId,
                        local: localEntity,
                        cloud: cloudEntity
                    });
                    hasChanges = true;
                }
                // 如果云端已删除且本地未同步该删除，保留本地（冲突由用户决定）
                if (cloudEntity.deletedAt && !localEntity.deletedAt) {
                    result.push(localEntity);
                } else {
                    result.push(localEntity);
                }
            } else if (cloudModifiedAfterSync) {
                // 云端有变更：如果云端标记了删除，本地也应删除
                if (cloudEntity.deletedAt) {
                    result.push({ ...localEntity, deletedAt: cloudEntity.deletedAt, lastSyncedAt: null });
                    hasChanges = true;
                } else if (this._isEntityDataChanged(localEntity, cloudEntity)) {
                    result.push(cloudEntity);
                    hasChanges = true;
                    updatedCount++;
                } else {
                    result.push(localEntity);
                }
            } else if (lastSyncedTime === 0 && cloudLastSyncedTime === 0 && localTime > thirtyDaysAgo && cloudTime > thirtyDaysAgo && localTime !== cloudTime) {
                // 双方都未同步：30 天阈值内且数据不同
                if (this._isEntityDataChanged(localEntity, cloudEntity)) {
                    conflicts.push({
                        entityType: entityType,
                        syncId: syncId,
                        local: localEntity,
                        cloud: cloudEntity
                    });
                    hasChanges = true;
                }
                result.push(localEntity);
            } else {
                result.push(localEntity);
            }
        }

        for (const [syncId, cloudEntity] of cloudMap) {
            if (!localMap.has(syncId)) {
                // 跳过云端已删除的实体（墓碑传播）
                if (cloudEntity.deletedAt) {
                    hasChanges = true;
                    continue;
                }
                result.push(cloudEntity);
                hasChanges = true;
                addedCount++;
            }
        }

        return { result: result, hasChanges: hasChanges, addedCount: addedCount, updatedCount: updatedCount };
    },

    async resolveConflicts(conflicts, resolutions) {
        const adapter = window.LocalStorageAdapter.getCurrentSyncAdapter();

        const resolvedFunds = [];
        const resolvedTrades = [];

        conflicts.forEach((conflict, index) => {
            const resolution = resolutions[index];
            if (resolution === 'local') {
                if (conflict.entityType === 'fund') {
                    resolvedFunds.push(conflict.local);
                } else {
                    resolvedTrades.push(conflict.local);
                }
            } else if (resolution === 'cloud') {
                if (conflict.entityType === 'fund') {
                    resolvedFunds.push(conflict.cloud);
                } else {
                    resolvedTrades.push(conflict.cloud);
                }
            }
        });

        const result = await adapter.resolve(conflicts, resolutions);
        if (result && result.success) {
            // 将用户选择的解决结果写回本地 snapshot
            const now = SyncAppService._getNowIso();
            const localSnapshot = window.LocalStorageAdapter.loadSnapshot();
            const localFundMap = new Map((localSnapshot.funds || []).map(f => [f.syncId, f]));
            const localTradeMap = new Map((localSnapshot.trades || []).map(t => [t.syncId, t]));

            for (const entity of resolvedFunds) {
                localFundMap.set(entity.syncId, { ...entity, lastSyncedAt: now });
            }
            for (const entity of resolvedTrades) {
                localTradeMap.set(entity.syncId, { ...entity, lastSyncedAt: now });
            }

            window.LocalStorageAdapter.saveSnapshot({
                ...localSnapshot,
                funds: Array.from(localFundMap.values()),
                trades: Array.from(localTradeMap.values())
            });

            if (result.revision) {
                window.LocalStorageAdapter.updateSyncMeta({
                    cloudRevision: result.revision,
                    syncStatus: 'idle'
                });
            }
            SyncAppService._emitSyncApplied({ mode: 'resolve', hasChanges: true });
        }
        return result;
    },

    async manualSync() {
        const pullResult = await this._executePull();
        if (pullResult && pullResult.firstSync) {
            return pullResult;
        }
        return this._executePush();
    },

    async forcePushLocal() {
        const adapter = window.LocalStorageAdapter.getCurrentSyncAdapter();
        const snapshot = window.LocalStorageAdapter.loadSnapshot();

        // 先拉取最新云端 revision，再用正确版本推送
        const cloudMeta = await adapter.pull();
        if (cloudMeta && cloudMeta.success) {
            window.LocalStorageAdapter.updateSyncMeta({ cloudRevision: cloudMeta.revision || 0 });
        }

        const sanitizedFunds = SyncAppService._sanitizeFundsForSync(snapshot.funds);
        return adapter.push(sanitizedFunds, snapshot.trades);
    },

    async forcePullCloud() {
        window.LocalStorageAdapter.updateSyncMeta({ cloudRevision: 0 });
        return this._executePull();
    },

    async forceOverwriteLocal() {
        const adapter = window.LocalStorageAdapter.getCurrentSyncAdapter();
        if (!adapter || typeof adapter.getStatus !== 'function') {
            return { success: false, reason: 'not_configured' };
        }

        const status = adapter.getStatus();
        if (!status.canPull) {
            SyncAppService._toLogText('[同步调试] forceOverwriteLocal 跳过：当前适配器不可拉取', status);
            return { success: false, reason: 'not_configured' };
        }

        SyncAppService._syncInProgress = true;
        window.LocalStorageAdapter.updateSyncMeta({ syncStatus: 'syncing' });

        try {
            const result = await adapter.pull();
            if (!result.success) {
                return result;
            }

            const now = SyncAppService._getNowIso();
            const cloudFunds = result.funds || [];
            const cloudTrades = result.trades || [];
            const localSnapshot = window.LocalStorageAdapter.loadSnapshot();

            const newSnapshot = {
                ...localSnapshot,
                funds: cloudFunds.map(function (f) { return { ...f, lastSyncedAt: now }; }),
                trades: cloudTrades.map(function (t) { return { ...t, lastSyncedAt: now }; }),
                syncMeta: {
                    ...localSnapshot.syncMeta,
                    cloudFunds: cloudFunds.length,
                    cloudTrades: cloudTrades.length,
                    cloudRevision: result.revision || localSnapshot.syncMeta.cloudRevision || 0,
                    pendingChanges: 0,
                    lastSyncAt: now,
                    lastPulledAt: now,
                    syncStatus: 'idle',
                    lastError: null
                }
            };

            window.LocalStorageAdapter.saveSnapshot(newSnapshot);
            SyncAppService._emitSyncApplied({ mode: 'overwrite', hasChanges: true });

            SyncAppService._toLogText('[同步调试] forceOverwriteLocal 成功', {
                funds: cloudFunds.length,
                trades: cloudTrades.length
            });

            return { success: true, reason: 'overwritten_from_cloud' };
        } finally {
            SyncAppService._syncInProgress = false;
        }
    },

    async _handleFirstSyncChoice(choice) {
        const cloudData = SyncAppService._firstSyncCloudData;
        const cloudRevision = SyncAppService._firstSyncCloudRevision;
        const localSnapshot = window.LocalStorageAdapter.loadSnapshot();
        const now = SyncAppService._getNowIso();

        if (choice === 'local') {
            const newSnapshot = {
                ...localSnapshot,
                funds: localSnapshot.funds.map(function (f) { return { ...f, lastSyncedAt: now }; }),
                trades: localSnapshot.trades.map(function (t) { return { ...t, lastSyncedAt: now }; }),
                syncMeta: {
                    ...localSnapshot.syncMeta,
                    cloudRevision: cloudRevision,
                    cloudFunds: cloudData ? cloudData.funds.length : localSnapshot.funds.length,
                    cloudTrades: cloudData ? cloudData.trades.length : localSnapshot.trades.length,
                    pendingChanges: 0,
                    lastSyncAt: now,
                    lastPulledAt: now,
                    syncStatus: 'idle',
                    lastError: null
                }
            };
            window.LocalStorageAdapter.saveSnapshot(newSnapshot);
            SyncAppService._firstSyncCloudData = null;
            SyncAppService._emitSyncApplied({ mode: 'first-sync-local', hasChanges: false });
            return { success: true, reason: 'first_sync_keep_local' };
        }

        if (choice === 'cloud') {
            const cloudFunds = (cloudData && cloudData.funds) || [];
            const cloudTrades = (cloudData && cloudData.trades) || [];
            const newSnapshot = {
                ...localSnapshot,
                funds: cloudFunds.map(function (f) { return { ...f, lastSyncedAt: now }; }),
                trades: cloudTrades.map(function (t) { return { ...t, lastSyncedAt: now }; }),
                syncMeta: {
                    ...localSnapshot.syncMeta,
                    cloudRevision: cloudRevision,
                    cloudFunds: cloudFunds.length,
                    cloudTrades: cloudTrades.length,
                    pendingChanges: 0,
                    lastSyncAt: now,
                    lastPulledAt: now,
                    syncStatus: 'idle',
                    lastError: null
                }
            };
            window.LocalStorageAdapter.saveSnapshot(newSnapshot);
            SyncAppService._firstSyncCloudData = null;
            SyncAppService._emitSyncApplied({ mode: 'first-sync-cloud', hasChanges: true });
            return { success: true, reason: 'first_sync_use_cloud' };
        }

        if (choice === 'merge') {
            if (!cloudData) {
                return { success: false, reason: 'no_cloud_data' };
            }
            const mergeResult = SyncAppService._mergeData(localSnapshot, cloudData);
            if (mergeResult.hasConflicts) {
                SyncAppService._firstSyncCloudData = null;
                return { success: true, hasConflicts: true, conflicts: mergeResult.conflicts };
            }
            if (mergeResult.hasChanges) {
                const mergedSnapshot = {
                    ...mergeResult.snapshot,
                    syncMeta: {
                        ...mergeResult.snapshot.syncMeta,
                        cloudRevision: cloudRevision,
                        cloudFunds: mergeResult.snapshot.funds.length,
                        cloudTrades: mergeResult.snapshot.trades.length,
                        pendingChanges: 0,
                        lastSyncAt: now,
                        lastPulledAt: now,
                        syncStatus: 'idle',
                        lastError: null
                    }
                };
                window.LocalStorageAdapter.saveSnapshot(mergedSnapshot);
            } else {
                window.LocalStorageAdapter.updateSyncMeta({
                    cloudRevision: cloudRevision,
                    cloudFunds: localSnapshot.funds.length,
                    cloudTrades: localSnapshot.trades.length,
                    pendingChanges: 0,
                    lastSyncAt: now,
                    lastPulledAt: now,
                    syncStatus: 'idle'
                });
            }
            SyncAppService._firstSyncCloudData = null;
            SyncAppService._emitSyncApplied({ mode: 'first-sync-merge', hasChanges: true });
            return { success: true, reason: 'first_sync_merge' };
        }

        if (choice === 'cancel') {
            SyncAppService._firstSyncCloudData = null;
            SyncAppService._syncInProgress = false;
            window.LocalStorageAdapter.updateSyncMeta({
                syncStatus: 'idle',
                lastError: '首次同步已取消'
            });
            return { success: false, reason: 'cancelled' };
        }

        SyncAppService._firstSyncCloudData = null;
        return { success: false, reason: 'invalid_choice' };
    },

    async refreshCloudMeta() {
        const adapter = window.LocalStorageAdapter.getCurrentSyncAdapter();
        if (!adapter || typeof adapter.getStatus !== 'function') return;
        const status = adapter.getStatus();
        if (!status || !status.canPull) return;
        const result = await adapter.pull();
        if (result && result.success) {
            window.LocalStorageAdapter.updateSyncMeta({
                cloudRevision: result.revision || 0,
                cloudFunds: (result.funds || []).length,
                cloudTrades: (result.trades || []).length
            });
        }
    },

    getSyncStatus() {
        return window.LocalStorageAdapter.getSyncMeta();
    }
};

ModuleRegistry.register('SyncAppService', SyncAppService);
