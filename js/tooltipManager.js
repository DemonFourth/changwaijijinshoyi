/**
 * TooltipManager - 统一 Tooltip 管理器
 *
 * 特性：
 * 1. 使用 position: fixed 定位，脱离文档流，不受父容器 overflow 限制
 * 2. 自动检测视口边界，智能切换上下位置
 * 3. 单例模式，同一时间只显示一个 tooltip
 * 4. 支持延迟显示/隐藏，防止闪烁
 *
 * 参考项目：https://github.com/DemonFourth/gupiaoshouyi-clac
 * @version 1.0.0
 */

const TooltipManager = {
    // 配置
    config: {
        offset: 10, // 与触发元素的间距(px)
        padding: 10, // 视口边距(px)
        showDelay: 100, // 显示延迟(ms)
        hideDelay: 200, // 隐藏延迟(ms)
        maxWidth: 400, // 最大宽度(px)
        className: 'tooltip-fixed' // CSS 类名
    },

    // 状态
    _current: null, // 当前显示的 tooltip 信息
    _tooltipEl: null, // 单例 tooltip DOM 元素
    _showTimer: null, // 显示定时器
    _hideTimer: null, // 隐藏定时器
    _initialized: false, // 是否已初始化

    /**
     * 初始化 TooltipManager
     * 创建单例 tooltip 元素并绑定全局事件
     */
    init() {
        if (this._initialized) return;

        this._createTooltipElement();
        this._bindGlobalEvents();
        this._initialized = true;
    },

    /**
     * 创建单例 tooltip DOM 元素
     */
    _createTooltipElement() {
        if (this._tooltipEl) return;

        const el = document.createElement('div');
        el.className = this.config.className;
        el.setAttribute('role', 'tooltip');
        el.setAttribute('aria-hidden', 'true');
        document.body.appendChild(el);

        this._tooltipEl = el;
    },

    /**
     * 绑定全局事件
     */
    _bindGlobalEvents() {
        // 滚动时隐藏 tooltip
        window.addEventListener('scroll', () => {
            if (this._current) {
                TooltipManager.hide();
            }
        }, { passive: true });

        // 窗口大小变化时重新定位
        window.addEventListener('resize', () => {
            if (this._current) {
                TooltipManager._updatePosition();
            }
        }, { passive: true });

        // 点击空白处关闭
        document.addEventListener('click', (e) => {
            if (this._current && !this._current.trigger.contains(e.target)) {
                TooltipManager.hide();
            }
        });
    },

    /**
     * 显示 tooltip
     * @param {HTMLElement} triggerEl - 触发元素
     * @param {string} content - tooltip 内容（HTML）
     * @param {Object} options - 可选配置
     */
    show(triggerEl, content, options = {}) {
        this.init();

        // 清除定时器
        this._clearTimers();

        // 显示延迟
        this._showTimer = setTimeout(() => {
            this._showNow(triggerEl, content, options);
        }, options.showDelay || this.config.showDelay);
    },

    /**
     * 立即显示 tooltip
     */
    _showNow(triggerEl, content, options) {
        // 设置内容
        this._tooltipEl.innerHTML = content;
        this._current = {
            trigger: triggerEl,
            options,
            content
        };

        // 先让 tooltip 可见以便测量尺寸
        this._tooltipEl.style.visibility = 'hidden';
        this._tooltipEl.style.display = 'block';

        // 计算并设置位置
        const pos = this._calculatePosition(triggerEl, this._tooltipEl);
        this._setPosition(pos);

        // 显示动画
        this._tooltipEl.style.visibility = 'visible';
        this._tooltipEl.style.opacity = '1';
        this._tooltipEl.setAttribute('aria-hidden', 'false');
    },

    /**
     * 隐藏 tooltip
     * @param {number} delay - 可选的延迟时间(ms)
     */
    hide(delay) {
        this._clearTimers();

        const hideDelay = delay !== undefined ? delay : this.config.hideDelay;

        this._hideTimer = setTimeout(() => {
            this._hideNow();
        }, hideDelay);
    },

    /**
     * 立即隐藏 tooltip
     */
    _hideNow() {
        if (!this._tooltipEl) return;

        this._tooltipEl.style.opacity = '0';
        this._tooltipEl.setAttribute('aria-hidden', 'true');

        setTimeout(() => {
            if (this._tooltipEl.style.opacity === '0') {
                this._tooltipEl.style.visibility = 'hidden';
                this._tooltipEl.style.display = 'none';
            }
        }, 200);

        this._current = null;
    },

    /**
     * 清除所有定时器
     */
    _clearTimers() {
        if (this._showTimer) {
            clearTimeout(this._showTimer);
            this._showTimer = null;
        }
        if (this._hideTimer) {
            clearTimeout(this._hideTimer);
            this._hideTimer = null;
        }
    },

    /**
     * 计算最佳位置
     * @param {HTMLElement} triggerEl - 触发元素
     * @param {HTMLElement} tooltipEl - tooltip 元素
     * @returns {Object} 位置信息 {x, y, placement}
     */
    _calculatePosition(triggerEl, tooltipEl) {
        const triggerRect = triggerEl.getBoundingClientRect();
        const tooltipRect = tooltipEl.getBoundingClientRect();
        const viewport = {
            width: window.innerWidth,
            height: window.innerHeight
        };

        // 计算各方向可用空间
        const space = {
            top: triggerRect.top - this.config.padding,
            bottom: viewport.height - triggerRect.bottom - this.config.padding,
            left: triggerRect.left - this.config.padding,
            right: viewport.width - triggerRect.right - this.config.padding
        };

        // 选择最佳方向（优先下方，避免盖住标题）
        let placement = 'bottom';
        const tooltipHeight = tooltipRect.height || 100;

        if (space.bottom < tooltipHeight + this.config.offset + 10) {
            // 下方空间不足，尝试上方
            if (space.top >= tooltipHeight + this.config.offset + 10) {
                placement = 'top';
            } else {
                // 上下都不足，选择空间较大的一方
                placement = space.bottom > space.top ? 'bottom' : 'top';
            }
        }

        // 计算位置
        let x, y;
        const halfWidth = (tooltipRect.width || 200) / 2;

        if (placement === 'top') {
            x = triggerRect.left + triggerRect.width / 2;
            y = triggerRect.top - this.config.offset;
        } else {
            x = triggerRect.left + triggerRect.width / 2;
            y = triggerRect.bottom + this.config.offset;
        }

        // 水平边界约束
        x = Math.max(halfWidth + this.config.padding,
            Math.min(x, viewport.width - halfWidth - this.config.padding));

        return { x, y, placement };
    },

    /**
     * 设置 tooltip 位置
     * @param {Object} pos - 位置信息 {x, y, placement}
     */
    _setPosition(pos) {
        const el = this._tooltipEl;

        // 设置位置类
        el.classList.remove('placement-top', 'placement-bottom');
        el.classList.add(`placement-${pos.placement}`);

        // 设置坐标
        el.style.left = `${pos.x}px`;

        if (pos.placement === 'top') {
            el.style.top = `${pos.y}px`;
            el.style.bottom = 'auto';
            el.style.transform = 'translate(-50%, -100%)';
        } else {
            el.style.top = `${pos.y}px`;
            el.style.bottom = 'auto';
            el.style.transform = 'translate(-50%, 0)';
        }
    },

    /**
     * 更新当前位置（用于窗口 resize）
     */
    _updatePosition() {
        if (!this._current) return;

        const pos = this._calculatePosition(this._current.trigger, this._tooltipEl);
        this._setPosition(pos);
    },

    /**
     * 销毁 TooltipManager
     */
    destroy() {
        this._clearTimers();

        if (this._tooltipEl) {
            this._tooltipEl.remove();
            this._tooltipEl = null;
        }

        this._current = null;
        this._initialized = false;
    },

    /**
     * 绑定现有 tooltip 容器
     * 将页面上的 [data-tooltip] 元素绑定到 TooltipManager
     */
    bindExistingTooltips() {
        this.init();

        const elements = document.querySelectorAll('[data-tooltip]');

        elements.forEach(el => {
            if (el.classList.contains('tooltip-manager-bound')) return;

            const tooltipText = el.getAttribute('data-tooltip');
            if (!tooltipText) return;

            el.classList.add('tooltip-manager-bound');

            el.addEventListener('mouseenter', (e) => {
                e.stopPropagation();
                TooltipManager.show(el, tooltipText);
            });

            el.addEventListener('mouseleave', (e) => {
                e.stopPropagation();
                TooltipManager.hide();
            });

            // 触摸设备支持
            el.addEventListener('touchstart', (e) => {
                e.stopPropagation();
                e.preventDefault();
                if (this._current && this._current.trigger === el) {
                    TooltipManager.hide();
                } else {
                    TooltipManager.show(el, tooltipText);
                }
            });
        });
    },

    /**
     * 重新绑定 tooltip（用于动态内容更新后）
     */
    rebind() {
        this.bindExistingTooltips();
    },

    /**
     * 绑定大数字转换 tooltip
     * 使用事件委托，监听所有 [data-full-value] 元素
     */
    bindLargeNumberTooltips() {
        this.init();

        // 使用事件委托，避免每个元素单独绑定
        document.addEventListener('mouseenter', (e) => {
            // 检查 e.target 是否为 Element 节点
            if (!(e.target instanceof Element)) return;

            // 大数字转换 tooltip
            const target = e.target.closest('[data-full-value]');
            if (target) {
                const fullValue = target.getAttribute('data-full-value');
                TooltipManager.show(target, fullValue);
                return;
            }

            // 其他带 data-tooltip 的元素
            const tooltipEl = e.target.closest('[data-tooltip]');
            if (tooltipEl && !tooltipEl.classList.contains('tooltip-manager-bound')) {
                const tooltipText = tooltipEl.getAttribute('data-tooltip');
                TooltipManager.show(tooltipEl, tooltipText);
            }
        }, true);

        document.addEventListener('mouseleave', (e) => {
            // 检查 e.target 是否为 Element 节点
            if (!(e.target instanceof Element)) return;
            if (e.target.closest('[data-full-value], [data-tooltip]')) {
                TooltipManager.hide();
            }
        }, true);
    }
};

// 注册到模块系统
ModuleRegistry.register('TooltipManager', TooltipManager);
