/**
 * 应用入口
 * 初始化所有模块并启动应用
 */

/* global TooltipManager, SyncAppService, SyncConflictModalHelper, RuntimeConfigLoader */

const App = {
    /**
     * 初始化应用
     */
    async init() {
        console.log('='.repeat(50));
        console.log('场外基金收益计算器 v' + Config.get('app.version'));
        console.log('='.repeat(50));

        try {
            // 显示加载提示
            Utils.showLoading();

            // 加载运行时配置（从 /api/runtime-config 获取环境配置）
            await RuntimeConfigLoader.load();

            // 初始化数据服务
            DataService.init();

            // 初始化同步服务（使用运行时配置）
            const syncEnabled = Config.get('sync.enabled', false);
            const syncBasePath = Config.get('sync.basePath', '');
            await SyncAppService.init({ enabled: syncEnabled, basePath: syncBasePath, timeout: Config.get('sync.timeout') });

            // 显示存储模式提示
            const storageMode = RuntimeConfigLoader.getStorageMode();
            if (storageMode === 'hybrid') {
                Utils.showToast('当前使用混合存储（本地 + 云端同步）', 'info');
            } else {
                Utils.showToast('当前使用本地数据', 'info');
            }

            // 启动后台同步（不阻塞页面渲染）
            setTimeout(async () => {
                try {
                    const syncResult = await SyncAppService.startBackgroundSync();

                    if (syncResult.hasConflicts) {
                        // 有冲突，显示冲突处理
                        SyncConflictModalHelper.show(syncResult.conflicts, async (resolutions) => {
                            await SyncAppService.resolveConflicts(syncResult.conflicts, resolutions);
                            Overview.refresh();
                        });
                    } else {
                        // 同步完成，刷新页面
                        Overview.refresh();
                    }
                } catch (error) {
                    console.error('Background sync failed:', error);
                    // 静默失败，不阻塞用户体验
                }
            }, 100);

            // 初始化主题管理器
            ThemeManager.init();

            // 初始化基金管理器
            FundManager.init();

            // 初始化交易管理器
            TradeManager.init();

            // 初始化图表管理器
            ChartManager.init();

            // 初始化路由
            Router.init();

            // 初始化UI组件
            Overview.init();
            Detail.init();
            ToolPage.init();

            // 初始化 TooltipManager
            if (TooltipManager) {
                TooltipManager.init();
                TooltipManager.bindExistingTooltips();
                TooltipManager.bindLargeNumberTooltips();
            }

            // 绑定主题切换按钮
            this.setupThemeToggle();

            // 绑定工具箱按钮
            this.setupToolsButton();

            // 绑定设置按钮
            this.setupSettingsButton();

            // 绑定 header 返回按钮
            this.setupHeaderBackButton();

            // 监听路由变化
            this.setupRouteListener();

            // 根据当前路由显示页面
            this.showCurrentPage();

            // 隐藏加载提示
            Utils.hideLoading();

            console.log('Application initialized successfully');
        } catch (error) {
            console.error('Application initialization failed:', error);
            Utils.hideLoading();
            Utils.showToast('应用初始化失败', 'error');
        }
    },

    /**
     * 设置主题切换
     */
    setupThemeToggle() {
        const btnTheme = document.getElementById('btn-theme');
        if (btnTheme) {
            // 设置初始图标
            btnTheme.textContent = ThemeManager.getThemeIcon();

            // 点击切换主题
            btnTheme.addEventListener('click', () => {
                ThemeManager.toggleTheme();
            });

            // 监听主题变化事件，更新按钮图标
            EventBus.on(EventType.THEME_CHANGED, () => {
                btnTheme.textContent = ThemeManager.getThemeIcon();
            });
        }
    },

    /**
     * 设置路由监听
     */
    setupRouteListener() {
        EventBus.on(EventType.PAGE_CHANGED, () => {
            this.showCurrentPage();
        });
    },

    /**
     * 设置工具箱按钮
     */
    setupToolsButton() {
        const btnTools = document.getElementById('btn-tools');
        if (btnTools) {
            btnTools.addEventListener('click', () => {
                Router.navigate('tools');
            });
        }
    },

    /**
     * 设置设置按钮
     */
    setupSettingsButton() {
        const btnSettings = document.getElementById('btn-settings');
        if (btnSettings) {
            btnSettings.addEventListener('click', () => {
                Modal.show('settings');
            });
        }
    },

    /**
     * 设置 header 返回按钮
     */
    setupHeaderBackButton() {
        const btnBack = document.getElementById('btn-header-back');
        if (btnBack) {
            btnBack.addEventListener('click', () => {
                Router.navigate('overview');
            });
        }
    },

    /**
     * 更新 header 状态
     */
    updateHeader(route) {
        const btnBack = document.getElementById('btn-header-back');
        const headerTitle = document.getElementById('header-title');

        if (!btnBack || !headerTitle) return;

        if (route.name === 'detail') {
            btnBack.classList.remove('hidden');
            const fund = FundManager.getFund(route.params.fundId);
            if (fund) {
                headerTitle.textContent = `${fund.name}（${fund.code}）`;
            }
        } else if (route.name === 'tools') {
            btnBack.classList.remove('hidden');
            headerTitle.textContent = '工具箱';
        } else {
            btnBack.classList.add('hidden');
            headerTitle.textContent = '场外基金收益计算器';
        }
    },

    /**
     * 显示当前页面
     */
    showCurrentPage() {
        const route = Router.getCurrentRoute();

        // 更新 header 状态
        this.updateHeader(route);

        // 隐藏所有页面
        document.querySelectorAll('.page').forEach(page => {
            page.classList.remove('active');
        });

        // 显示当前页面
        if (route.name === 'detail' && route.params.fundId) {
            const detailPage = document.getElementById('page-detail');
            if (detailPage) {
                detailPage.classList.add('active');
                window.scrollTo(0, 0);
                Detail.load(route.params.fundId);
            }
        } else if (route.name === 'tools') {
            const toolsPage = document.getElementById('page-tools');
            if (toolsPage) {
                toolsPage.classList.add('active');
                ToolPage.init();
            }
        } else {
            const overviewPage = document.getElementById('page-overview');
            if (overviewPage) {
                overviewPage.classList.add('active');
                Overview.refresh();
            }
        }
    },

    /**
     * 处理全局错误
     */
    setupErrorHandler() {
        window.onerror = (message, source, lineno, colno, error) => {
            console.error('Global error:', {
                message,
                source,
                lineno,
                colno,
                error
            });

            EventBus.emit(EventType.ERROR_OCCURRED, {
                message,
                source,
                lineno,
                colno,
                error
            });

            return false;
        };

        window.onunhandledrejection = (event) => {
            console.error('Unhandled promise rejection:', event.reason);

            EventBus.emit(EventType.ERROR_OCCURRED, {
                message: 'Unhandled promise rejection',
                error: event.reason
            });
        };
    }
};

// 设置全局错误处理
App.setupErrorHandler();

// 页面加载完成后初始化应用
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

// 注册到模块系统
ModuleRegistry.register('App', App);
