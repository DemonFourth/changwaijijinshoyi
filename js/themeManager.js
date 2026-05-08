/**
 * 主题管理模块
 * 管理CSS设计令牌和主题切换逻辑
 */

const ThemeManager = {
    // 当前主题: 'light' | 'dark'
    currentTheme: 'light',

    /**
     * 初始化主题系统
     */
    init() {
        // 加载用户偏好或检测系统主题
        const savedTheme = Storage.loadTheme();
        if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark')) {
            ThemeManager.setTheme(savedTheme);
        } else {
            // 检测系统主题偏好
            const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
            ThemeManager.setTheme(prefersDark ? 'dark' : 'light');
        }

        // 监听系统主题变化
        ThemeManager.watchSystemTheme();

        console.log('ThemeManager initialized, current theme:', ThemeManager.currentTheme);
    },

    /**
     * 设置主题
     * @param {string} theme - 'light' | 'dark'
     */
    setTheme(theme) {
        if (theme !== 'light' && theme !== 'dark') return;

        ThemeManager.currentTheme = theme;
        document.documentElement.setAttribute('data-theme', theme);
        Storage.saveTheme(theme);
        EventBus.emit(EventType.THEME_CHANGED, { theme });
    },

    /**
     * 切换主题
     */
    toggleTheme() {
        const newTheme = ThemeManager.currentTheme === 'light' ? 'dark' : 'light';
        ThemeManager.setTheme(newTheme);
    },

    /**
     * 获取当前主题
     * @returns {string}
     */
    getTheme() {
        return ThemeManager.currentTheme;
    },

    /**
     * 监听系统主题偏好变化
     */
    watchSystemTheme() {
        if (!window.matchMedia) return;

        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        if (mediaQuery.addEventListener) {
            mediaQuery.addEventListener('change', (e) => {
                // 仅在用户未手动设置主题时跟随系统
                const savedTheme = Storage.loadTheme();
                if (!savedTheme) {
                    ThemeManager.setTheme(e.matches ? 'dark' : 'light');
                }
            });
        }
    },

    /**
     * 获取主题切换按钮图标
     * @returns {string}
     */
    getThemeIcon() {
        return ThemeManager.currentTheme === 'light' ? '🌙' : '☀️';
    }
};

// 注册到模块系统
ModuleRegistry.register('ThemeManager', ThemeManager);
