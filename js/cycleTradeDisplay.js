/**
 * 持仓轮次分组展示控制器
 * 协调数据获取、分组计算、筛选、分页、展开折叠的完整生命周期
 */

const CycleTradeDisplay = {
    CYCLE_COLORS: [
        'var(--color-cycle-1)',
        'var(--color-cycle-2)',
        'var(--color-cycle-3)',
        'var(--color-cycle-4)'
    ],

    _fundId: null,
    _containerEl: null,
    _cycles: [],
    _allTrades: [],
    _tradeCycleMap: {},
    _displayMode: 'flat',
    _cycleExpandState: {},
    _groupedPaginator: null,
    _currentFilters: { type: null, startDate: null, endDate: null, cycleId: null },
    _toggleDebounceTimer: null,
    _initialized: false,
    _uncategorizedTrades: null,

    init(fundId, containerEl) {
        CycleTradeDisplay._fundId = fundId;
        CycleTradeDisplay._containerEl = containerEl;
        CycleTradeDisplay._uncategorizedTrades = null;

        var trades = TradeManager.getTradesByFund(fundId);
        if (!trades || trades.length === 0) {
            CycleTradeDisplay._cycles = [];
            CycleTradeDisplay._allTrades = [];
            CycleTradeDisplay._tradeCycleMap = {};
            CycleTradeDisplay._displayMode = 'flat';
            CycleTradeDisplay._initialized = false;
            return;
        }

        CycleTradeDisplay._allTrades = trades.slice().sort(function(a, b) {
            return new Date(b.date) - new Date(a.date);
        });

        var sortedAsc = trades.slice().sort(function(a, b) {
            return new Date(a.date) - new Date(b.date);
        });
        CycleTradeDisplay._cycles = CalculatorV2.identifyHoldingCycles(sortedAsc);

        if (!CycleTradeDisplay._cycles || CycleTradeDisplay._cycles.length === 0) {
            CycleTradeDisplay._displayMode = 'flat';
            CycleTradeDisplay._initialized = false;
            return;
        }

        CycleTradeDisplay._tradeCycleMap = CycleTradeDisplay.buildTradeCycleMap(CycleTradeDisplay._cycles);
        CycleTradeDisplay.checkUncategorizedTrades(trades);
        CycleTradeDisplay.loadViewPrefs();

        if (!CycleTradeDisplay._displayMode || CycleTradeDisplay._displayMode === 'flat') {
            CycleTradeDisplay._displayMode = CycleTradeDisplay.determineDefaultMode(CycleTradeDisplay._cycles);
        }

        if (Object.keys(CycleTradeDisplay._cycleExpandState).length === 0) {
            CycleTradeDisplay._cycleExpandState = CycleTradeDisplay.getDefaultExpandState(CycleTradeDisplay._cycles);
        }

        CycleTradeDisplay._initialized = true;
    },

    buildTradeCycleMap(cycles) {
        var map = {};
        for (var i = 0; i < cycles.length; i++) {
            var cycle = cycles[i];
            if (cycle.trades) {
                for (var j = 0; j < cycle.trades.length; j++) {
                    map[cycle.trades[j].id] = cycle.id;
                }
            }
        }
        return map;
    },

    checkUncategorizedTrades(allTrades) {
        var categorizedCount = 0;
        for (var i = 0; i < CycleTradeDisplay._cycles.length; i++) {
            categorizedCount += (CycleTradeDisplay._cycles[i].trades || []).length;
        }
        if (categorizedCount < allTrades.length) {
            var uncategorized = [];
            for (var k = 0; k < allTrades.length; k++) {
                if (!CycleTradeDisplay._tradeCycleMap[allTrades[k].id]) {
                    uncategorized.push(allTrades[k]);
                }
            }
            if (uncategorized.length > 0) {
                CycleTradeDisplay._uncategorizedTrades = uncategorized;
            }
        }
    },

    determineDefaultMode(cycles) {
        return cycles.length >= 2 ? 'grouped' : 'flat';
    },

    getDefaultExpandState(cycles) {
        var state = {};
        if (cycles.length === 1) {
            state[cycles[0].id] = true;
        } else {
            for (var i = 0; i < cycles.length; i++) {
                state[cycles[i].id] = (cycles[i].status === 'active');
            }
        }
        return state;
    },

    getCycleColor(cycleId) {
        var index = (cycleId - 1) % CycleTradeDisplay.CYCLE_COLORS.length;
        return CycleTradeDisplay.CYCLE_COLORS[index];
    },

    sortTradesDesc(a, b) {
        var dateDiff = new Date(b.date) - new Date(a.date);
        if (dateDiff !== 0) return dateDiff;

        var typeOrder = { sell: 3, buy: 2, dividend: 1 };
        var typeDiff = (typeOrder[b.type] || 0) - (typeOrder[a.type] || 0);
        if (typeDiff !== 0) return typeDiff;

        if (b.id > a.id) return 1;
        if (b.id < a.id) return -1;
        return 0;
    },

    computeCycleSummaryWithProfit(cycle) {
        var tradeCount = (cycle.trades || []).length;
        var totalInvest = 0;
        for (var i = 0; i < (cycle.trades || []).length; i++) {
            if (cycle.trades[i].type === 'buy') {
                totalInvest += parseFloat(cycle.trades[i].amount || 0);
            }
        }

        var fund = FundManager.getFund(CycleTradeDisplay._fundId);
        var netValue = fund ? parseFloat(fund.netValue || 0) : 0;
        var profitResult = CalculatorV2.calculateCycleProfit(cycle, netValue);

        return {
            tradeCount: tradeCount,
            totalInvest: totalInvest,
            realizedProfit: profitResult.realizedProfit
        };
    },

    loadViewPrefs() {
        var prefs = Storage.loadViewPrefs();
        if (prefs.tradeDisplayMode) {
            CycleTradeDisplay._displayMode = prefs.tradeDisplayMode;
        }
        if (prefs.cycleExpandState && Object.keys(prefs.cycleExpandState).length > 0) {
            CycleTradeDisplay._cycleExpandState = prefs.cycleExpandState;
        }
    },

    saveViewPrefs() {
        try {
            var prefs = Storage.loadViewPrefs();
            prefs.tradeDisplayMode = CycleTradeDisplay._displayMode;
            prefs.cycleExpandState = CycleTradeDisplay._cycleExpandState;
            Storage.saveViewPrefs(prefs);
        } catch (e) {
            console.warn('CycleTradeDisplay: saveViewPrefs failed', e);
        }
    },

    renderTradeSection() {
        if (!CycleTradeDisplay._initialized) return;
        if (CycleTradeDisplay._displayMode === 'grouped') {
            CycleTradeDisplay.renderGroupedMode();
        } else {
            CycleTradeDisplay.renderFlatMode();
        }
    },

    renderGroupedMode() {
        var tradeList = document.getElementById('trade-list');
        var paginationContainer = document.getElementById('trade-pagination-container');
        if (!tradeList) return;

        var filterBar = document.querySelector('.trade-filter-bar');
        CycleTradeDisplay.renderFilterBarControls(filterBar);

        var filteredCycles = CycleTradeDisplay.applyFiltersToCycles();

        var cyclesDescOrder = filteredCycles.slice().sort(function(a, b) {
            return b.id - a.id;
        });

        var flatTrades = [];
        for (var i = 0; i < cyclesDescOrder.length; i++) {
            var cycleTrades = cyclesDescOrder[i].filteredTrades || cyclesDescOrder[i].trades;
            var tradesDesc = cycleTrades.slice().sort(CycleTradeDisplay.sortTradesDesc);
            for (var j = 0; j < tradesDesc.length; j++) {
                flatTrades.push(tradesDesc[j]);
            }
        }

        if (flatTrades.length === 0) {
            tradeList.innerHTML = CycleGroupRenderer.renderEmptyState('没有匹配的交易记录');
            if (paginationContainer) paginationContainer.innerHTML = '';
            var filterCount = document.getElementById('filter-result-count');
            if (filterCount) filterCount.textContent = '共 0 条记录';
            return;
        }

        CycleTradeDisplay._groupedPaginator = Paginator.create({
            data: flatTrades,
            pageSize: Config.get('ui.defaultPageSize', 10),
            onPageChange: function(pageData) {
                CycleTradeDisplay.renderGroupedPage(pageData, filteredCycles);
            }
        });

        var pageData = Paginator.getCurrentPageData(CycleTradeDisplay._groupedPaginator);
        CycleTradeDisplay.renderGroupedPage(pageData, filteredCycles);

        if (paginationContainer) {
            paginationContainer.innerHTML = Paginator.renderControls(CycleTradeDisplay._groupedPaginator);
            CycleTradeDisplay.bindPaginationEvents();
        }

        var filterCount = document.getElementById('filter-result-count');
        if (filterCount) {
            filterCount.textContent = '共 ' + CycleTradeDisplay._groupedPaginator.filteredData.length + ' 条记录';
        }
    },

    renderFilterBarControls(filterBar) {
        if (!filterBar) return;

        var existingToggle = filterBar.querySelector('.display-mode-toggle');
        if (!existingToggle) {
            var toggleHtml = CycleGroupRenderer.renderModeToggle(CycleTradeDisplay._displayMode);
            var tempDiv = document.createElement('div');
            tempDiv.innerHTML = toggleHtml;
            filterBar.insertBefore(tempDiv.firstChild, filterBar.firstChild);
        } else {
            existingToggle.outerHTML = CycleGroupRenderer.renderModeToggle(CycleTradeDisplay._displayMode);
        }

        var existingCycleFilter = filterBar.querySelector('#filter-cycle');
        var cycleFilterHtml = CycleGroupRenderer.renderCycleFilter(CycleTradeDisplay._cycles, CycleTradeDisplay._currentFilters.cycleId);
        if (cycleFilterHtml) {
            if (!existingCycleFilter) {
                var tempDiv2 = document.createElement('div');
                tempDiv2.innerHTML = cycleFilterHtml;
                var cycleFilterEl = tempDiv2.firstChild;
                var clearBtn = filterBar.querySelector('#btn-clear-filter');
                if (clearBtn) {
                    filterBar.insertBefore(cycleFilterEl, clearBtn);
                } else {
                    filterBar.appendChild(cycleFilterEl);
                }
            } else {
                existingCycleFilter.outerHTML = cycleFilterHtml;
            }
        }
    },

    renderGroupedPage(pageTrades, filteredCycles) {
        var tradeList = document.getElementById('trade-list');
        if (!tradeList) return;

        if (!pageTrades || pageTrades.length === 0) {
            tradeList.innerHTML = CycleGroupRenderer.renderEmptyState('没有匹配的交易记录');
            return;
        }

        var renderItems = CycleTradeDisplay.rebuildGroupsFromPageData(pageTrades);
        tradeList.innerHTML = CycleGroupRenderer.renderGroupedView(renderItems);

        CycleTradeDisplay.bindGroupedEvents();
        Detail.bindTradeActions();
    },

    rebuildGroupsFromPageData(pageTrades) {
        var items = [];

        var cyclesDesc = CycleTradeDisplay._cycles.slice().sort(function(a, b) {
            return b.id - a.id;
        });

        var cycleOrderMap = {};
        for (var ci = 0; ci < cyclesDesc.length; ci++) {
            cycleOrderMap[cyclesDesc[ci].id] = ci;
        }

        var prevCycleId = null;
        for (var i = 0; i < pageTrades.length; i++) {
            var trade = pageTrades[i];
            var cycleId = CycleTradeDisplay._tradeCycleMap[trade.id];

            if (cycleId && cycleId !== prevCycleId) {
                var cycle = null;
                for (var k = 0; k < CycleTradeDisplay._cycles.length; k++) {
                    if (CycleTradeDisplay._cycles[k].id === cycleId) {
                        cycle = CycleTradeDisplay._cycles[k];
                        break;
                    }
                }
                if (cycle) {
                    var isExpanded = CycleTradeDisplay._cycleExpandState[cycleId] !== false;
                    var color = CycleTradeDisplay.getCycleColor(cycleId);
                    var summary = CycleTradeDisplay.computeCycleSummaryWithProfit(cycle);
                    var cycleIndex = cycleOrderMap[cycleId] !== undefined ? cycleOrderMap[cycleId] : 0;

                    items.push({
                        type: 'cycle-header',
                        cycle: cycle,
                        isExpanded: isExpanded,
                        color: color,
                        summary: summary,
                        cycleIndex: cycleIndex
                    });
                }
                prevCycleId = cycleId;
            }

            var color2 = cycleId ? CycleTradeDisplay.getCycleColor(cycleId) : 'var(--color-warning)';
            var isExpanded2 = cycleId ? (CycleTradeDisplay._cycleExpandState[cycleId] !== false) : true;
            var cycleIndex2 = (cycleId && cycleOrderMap[cycleId] !== undefined) ? cycleOrderMap[cycleId] : 0;
            items.push({
                type: 'trade',
                trade: trade,
                cycleId: cycleId,
                color: color2,
                isExpanded: isExpanded2,
                cycleIndex: cycleIndex2
            });
        }

        return items;
    },

    renderFlatMode() {
        var filterBar = document.querySelector('.trade-filter-bar');
        if (filterBar) {
            var existingToggle = filterBar.querySelector('.display-mode-toggle');
            if (!existingToggle) {
                var toggleHtml = CycleGroupRenderer.renderModeToggle('flat');
                var tempDiv = document.createElement('div');
                tempDiv.innerHTML = toggleHtml;
                filterBar.insertBefore(tempDiv.firstChild, filterBar.firstChild);
            } else {
                existingToggle.outerHTML = CycleGroupRenderer.renderModeToggle('flat');
            }

            var existingCycleFilter = filterBar.querySelector('#filter-cycle');
            if (existingCycleFilter) {
                existingCycleFilter.remove();
            }
        }
    },

    applyFiltersToCycles() {
        var filters = CycleTradeDisplay._currentFilters;
        var result = [];

        for (var i = 0; i < CycleTradeDisplay._cycles.length; i++) {
            var cycle = CycleTradeDisplay._cycles[i];

            if (filters.cycleId && cycle.id !== filters.cycleId) {
                continue;
            }

            var filteredTrades = (cycle.trades || []).slice();

            if (filters.type) {
                filteredTrades = filteredTrades.filter(function(t) { return t.type === filters.type; });
            }
            if (filters.startDate) {
                filteredTrades = filteredTrades.filter(function(t) { return t.date >= filters.startDate; });
            }
            if (filters.endDate) {
                filteredTrades = filteredTrades.filter(function(t) { return t.date <= filters.endDate; });
            }

            if (filteredTrades.length > 0) {
                result.push({
                    id: cycle.id,
                    startDate: cycle.startDate,
                    endDate: cycle.endDate,
                    status: cycle.status,
                    trades: cycle.trades,
                    filteredTrades: filteredTrades
                });
            }
        }

        return result;
    },

    toggleDisplayMode() {
        CycleTradeDisplay._displayMode = (CycleTradeDisplay._displayMode === 'grouped') ? 'flat' : 'grouped';
        CycleTradeDisplay.saveViewPrefs();

        var filterBar = document.querySelector('.trade-filter-bar');
        if (filterBar) {
            var toggle = filterBar.querySelector('.display-mode-toggle');
            if (toggle) {
                toggle.outerHTML = CycleGroupRenderer.renderModeToggle(CycleTradeDisplay._displayMode);
            }
        }

        Detail.updateTradeList(FundManager.getFund(CycleTradeDisplay._fundId));
    },

    toggleCycleExpand(cycleId) {
        if (CycleTradeDisplay._toggleDebounceTimer) return;

        CycleTradeDisplay._toggleDebounceTimer = setTimeout(function() {
            CycleTradeDisplay._toggleDebounceTimer = null;
        }, 200);

        var currentState = CycleTradeDisplay._cycleExpandState[cycleId];
        var newState = (currentState === undefined) ? false : !currentState;
        CycleTradeDisplay._cycleExpandState[cycleId] = newState;
        CycleTradeDisplay.saveViewPrefs();

        var tradeList = document.getElementById('trade-list');
        if (!tradeList) return;

        var headerRow = tradeList.querySelector('.cycle-group-header-row[data-cycle-id="' + cycleId + '"]');
        if (headerRow) {
            if (newState) {
                headerRow.classList.remove('cycle-group--collapsed');
                headerRow.classList.add('cycle-group--expanded');
            } else {
                headerRow.classList.remove('cycle-group--expanded');
                headerRow.classList.add('cycle-group--collapsed');
            }
        }

        var summaryRow = tradeList.querySelector('.cycle-group-summary-row[data-cycle-id="' + cycleId + '"]');
        if (summaryRow) {
            if (newState) {
                summaryRow.classList.remove('cycle-group--collapsed');
                summaryRow.classList.add('cycle-group--expanded');
            } else {
                summaryRow.classList.remove('cycle-group--expanded');
                summaryRow.classList.add('cycle-group--collapsed');
            }
        }

        var tradeRows = tradeList.querySelectorAll('.cycle-group-trade-row[data-cycle-id="' + cycleId + '"]');
        for (var i = 0; i < tradeRows.length; i++) {
            tradeRows[i].style.display = newState ? '' : 'none';
        }
    },

    applyFilters(filters) {
        if (filters.type !== undefined) CycleTradeDisplay._currentFilters.type = filters.type || null;
        if (filters.startDate !== undefined) CycleTradeDisplay._currentFilters.startDate = filters.startDate || null;
        if (filters.endDate !== undefined) CycleTradeDisplay._currentFilters.endDate = filters.endDate || null;
        if (filters.cycleId !== undefined) CycleTradeDisplay._currentFilters.cycleId = filters.cycleId || null;

        if (CycleTradeDisplay._displayMode === 'grouped') {
            CycleTradeDisplay.renderGroupedMode();
        }
    },

    clearFilters() {
        CycleTradeDisplay._currentFilters = { type: null, startDate: null, endDate: null, cycleId: null };

        var filterTradeType = document.getElementById('filter-trade-type');
        var filterStartDate = document.getElementById('filter-start-date');
        var filterEndDate = document.getElementById('filter-end-date');
        var filterCycle = document.getElementById('filter-cycle');

        if (filterTradeType) filterTradeType.value = '';
        if (filterStartDate) filterStartDate.value = '';
        if (filterEndDate) filterEndDate.value = '';
        if (filterCycle) filterCycle.value = '';

        if (CycleTradeDisplay._displayMode === 'grouped') {
            CycleTradeDisplay.renderGroupedMode();
        }
    },

    refresh() {
        if (!CycleTradeDisplay._fundId) return;

        var trades = TradeManager.getTradesByFund(CycleTradeDisplay._fundId);
        if (!trades || trades.length === 0) {
            CycleTradeDisplay._cycles = [];
            CycleTradeDisplay._allTrades = [];
            CycleTradeDisplay._tradeCycleMap = {};
            CycleTradeDisplay._initialized = false;
            return;
        }

        CycleTradeDisplay._allTrades = trades.slice().sort(function(a, b) {
            return new Date(b.date) - new Date(a.date);
        });

        var sortedAsc = trades.slice().sort(function(a, b) {
            return new Date(a.date) - new Date(b.date);
        });
        CycleTradeDisplay._cycles = CalculatorV2.identifyHoldingCycles(sortedAsc);
        CycleTradeDisplay._tradeCycleMap = CycleTradeDisplay.buildTradeCycleMap(CycleTradeDisplay._cycles);
        CycleTradeDisplay._initialized = true;
    },

    destroy() {
        CycleTradeDisplay._fundId = null;
        CycleTradeDisplay._containerEl = null;
        CycleTradeDisplay._cycles = [];
        CycleTradeDisplay._allTrades = [];
        CycleTradeDisplay._tradeCycleMap = {};
        CycleTradeDisplay._displayMode = 'flat';
        CycleTradeDisplay._cycleExpandState = {};
        CycleTradeDisplay._groupedPaginator = null;
        CycleTradeDisplay._currentFilters = { type: null, startDate: null, endDate: null, cycleId: null };
        CycleTradeDisplay._initialized = false;
        CycleTradeDisplay._uncategorizedTrades = null;
    },

    getDisplayMode() {
        return CycleTradeDisplay._displayMode;
    },

    getCycleCount() {
        return CycleTradeDisplay._cycles.length;
    },

    bindGroupedEvents() {
        var tradeList = document.getElementById('trade-list');
        if (!tradeList) return;

        tradeList.querySelectorAll('.cycle-group-header-row').forEach(function(headerRow) {
            headerRow.addEventListener('click', function(e) {
                var cycleId = parseInt(e.currentTarget.dataset.cycleId);
                if (cycleId) {
                    CycleTradeDisplay.toggleCycleExpand(cycleId);
                }
            });
        });
    },

    bindPaginationEvents() {
        var paginationContainer = document.getElementById('trade-pagination-container');
        if (!paginationContainer || !CycleTradeDisplay._groupedPaginator) return;

        paginationContainer.querySelectorAll('.page-btn[data-page]').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var page = parseInt(btn.dataset.page);
                Paginator.goToPage(CycleTradeDisplay._groupedPaginator, page);
                paginationContainer.innerHTML = Paginator.renderControls(CycleTradeDisplay._groupedPaginator);
                CycleTradeDisplay.bindPaginationEvents();
            });
        });

        paginationContainer.querySelectorAll('.page-btn[data-action]').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var action = btn.dataset.action;
                if (action === 'prev') {
                    Paginator.goToPage(CycleTradeDisplay._groupedPaginator, CycleTradeDisplay._groupedPaginator.currentPage - 1);
                } else if (action === 'next') {
                    Paginator.goToPage(CycleTradeDisplay._groupedPaginator, CycleTradeDisplay._groupedPaginator.currentPage + 1);
                }
                paginationContainer.innerHTML = Paginator.renderControls(CycleTradeDisplay._groupedPaginator);
                CycleTradeDisplay.bindPaginationEvents();
            });
        });

        paginationContainer.querySelectorAll('.page-size-select').forEach(function(select) {
            select.addEventListener('change', function() {
                Paginator.setPageSize(CycleTradeDisplay._groupedPaginator, parseInt(select.value));
                paginationContainer.innerHTML = Paginator.renderControls(CycleTradeDisplay._groupedPaginator);
                CycleTradeDisplay.bindPaginationEvents();
            });
        });
    }
};

ModuleRegistry.register('CycleTradeDisplay', CycleTradeDisplay);
