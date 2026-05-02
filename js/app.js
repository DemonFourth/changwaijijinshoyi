/**
 * 应用入口
 * 初始化所有模块并启动应用
 */

/* global TooltipManager */

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

            // 初始化数据服务
            DataService.init();

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
     * 显示当前页面
     */
    showCurrentPage() {
        const route = Router.getCurrentRoute();

        // 隐藏所有页面
        document.querySelectorAll('.page').forEach(page => {
            page.classList.remove('active');
        });

        // 显示当前页面
        if (route.name === 'detail' && route.params.fundId) {
            const detailPage = document.getElementById('page-detail');
            if (detailPage) {
                detailPage.classList.add('active');
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
