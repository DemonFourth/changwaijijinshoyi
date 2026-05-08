/**
 * 路由管理器
 * 管理页面导航和URL状态
 * 使用hash路由以支持file://协议
 */

const Router = {
    // 当前路由
    currentRoute: null,

    // 路由配置
    routes: {
        overview: {
            path: '',
            title: '汇总页'
        },
        detail: {
            path: 'detail',
            title: '详情页'
        },
        tools: {
            path: 'tools',
            title: '工具箱'
        }
    },

    /**
     * 初始化路由
     */
    init() {
        // 监听hash变化
        window.addEventListener('hashchange', () => {
            this.handleHashChange();
        });

        // 解析初始路由
        this.parseRoute();

        console.log('Router initialized');
    },

    /**
     * 导航到指定页面
     * @param {string} routeName - 路由名称
     * @param {object} params - 路由参数
     */
    navigate(routeName, params = {}) {
        const route = this.routes[routeName];

        if (!route) {
            console.error('Route not found:', routeName);
            return;
        }

        // 构建hash
        let hash = route.path;
        if (params.fundId) {
            hash += `?fundId=${params.fundId}`;
        }

        // 更新hash（支持file://协议）
        window.location.hash = hash;

        // 更新当前路由
        this.currentRoute = {
            name: routeName,
            params
        };

        // 触发页面切换事件
        EventBus.emit(EventType.PAGE_CHANGED, {
            route: routeName,
            params
        });
    },

    /**
     * 返回上一页
     */
    back() {
        window.history.back();
    },

    /**
     * 处理hash变化
     */
    handleHashChange() {
        this.parseRoute();

        EventBus.emit(EventType.PAGE_CHANGED, {
            route: this.currentRoute.name,
            params: this.currentRoute.params
        });
    },

    /**
     * 解析当前hash路由
     */
    parseRoute() {
        const hash = window.location.hash.slice(1); // 移除#
        const [path, queryString] = hash.split('?');

        // 解析路由名称
        let routeName = 'overview';
        for (const [name, route] of Object.entries(this.routes)) {
            if (route.path === path) {
                routeName = name;
                break;
            }
        }

        // 解析参数
        const params = {};
        if (queryString) {
            const searchParams = new URLSearchParams(queryString);
            for (const [key, value] of searchParams) {
                params[key] = value;
            }
        }

        this.currentRoute = {
            name: routeName,
            params
        };
    },

    /**
     * 获取当前路由
     * @returns {object}
     */
    getCurrentRoute() {
        return this.currentRoute;
    },

    /**
     * 获取路由参数
     * @param {string} key - 参数键
     * @returns {any}
     */
    getParam(key) {
        return this.currentRoute && this.currentRoute.params[key];
    },

    /**
     * 检查是否在指定路由
     * @param {string} routeName - 路由名称
     * @returns {boolean}
     */
    isRoute(routeName) {
        return this.currentRoute && this.currentRoute.name === routeName;
    }
};

// 注册到模块系统
ModuleRegistry.register('Router', Router);
