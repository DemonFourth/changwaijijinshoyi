/**
 * 事件总线
 * 用于模块间的通信和解耦
 */

const EventBus = {
    // 事件监听器存储
    events: {},

    // 一次性监听器存储
    onceEvents: {},

    /**
     * 订阅事件
     * @param {string} event - 事件名称
     * @param {function} handler - 事件处理函数
     * @returns {function} 取消订阅的函数
     */
    on(event, handler) {
        if (!event || typeof event !== 'string') {
            console.error('Event name must be a non-empty string');
            return () => {};
        }

        if (typeof handler !== 'function') {
            console.error('Handler must be a function');
            return () => {};
        }

        if (!this.events[event]) {
            this.events[event] = [];
        }

        this.events[event].push(handler);

        // 返回取消订阅函数
        return () => this.off(event, handler);
    },

    /**
     * 订阅一次性事件
     * @param {string} event - 事件名称
     * @param {function} handler - 事件处理函数
     */
    once(event, handler) {
        if (!event || typeof event !== 'string') {
            console.error('Event name must be a non-empty string');
            return;
        }

        if (typeof handler !== 'function') {
            console.error('Handler must be a function');
            return;
        }

        if (!this.onceEvents[event]) {
            this.onceEvents[event] = [];
        }

        this.onceEvents[event].push(handler);
    },

    /**
     * 取消订阅事件
     * @param {string} event - 事件名称
     * @param {function} handler - 事件处理函数
     */
    off(event, handler) {
        if (!this.events[event]) {
            return;
        }

        if (handler) {
            // 移除特定处理函数
            const index = this.events[event].indexOf(handler);
            if (index > -1) {
                this.events[event].splice(index, 1);
            }
        } else {
            // 移除所有处理函数
            delete this.events[event];
        }
    },

    /**
     * 触发事件
     * @param {string} event - 事件名称
     * @param {any} data - 事件数据
     */
    emit(event, data) {
        // 触发普通监听器
        if (this.events[event]) {
            this.events[event].forEach(handler => {
                try {
                    handler(data);
                } catch (error) {
                    console.error(`Error in event handler for ${event}:`, error);
                }
            });
        }

        // 触发一次性监听器
        if (this.onceEvents[event]) {
            const handlers = this.onceEvents[event];
            delete this.onceEvents[event]; // 先删除，防止递归调用

            handlers.forEach(handler => {
                try {
                    handler(data);
                } catch (error) {
                    console.error(`Error in once event handler for ${event}:`, error);
                }
            });
        }
    },

    /**
     * 清空所有事件监听器
     */
    clear() {
        this.events = {};
        this.onceEvents = {};
    },

    /**
     * 获取事件的监听器数量
     * @param {string} event - 事件名称
     * @returns {number}
     */
    listenerCount(event) {
        const normalCount = this.events[event] ? this.events[event].length : 0;
        const onceCount = this.onceEvents[event] ? this.onceEvents[event].length : 0;
        return normalCount + onceCount;
    }
};

// 事件类型定义
const EventType = {
    // 基金相关事件
    FUND_ADDED: 'fund:added',
    FUND_UPDATED: 'fund:updated',
    FUND_DELETED: 'fund:deleted',
    FUND_REFRESHED: 'fund:refreshed',

    // 交易相关事件
    TRADE_ADDED: 'trade:added',
    TRADE_UPDATED: 'trade:updated',
    TRADE_DELETED: 'trade:deleted',

    // 计算相关事件
    CALCULATION_UPDATED: 'calculation:updated',

    // UI相关事件
    PAGE_CHANGED: 'page:changed',
    MODAL_OPENED: 'modal:opened',
    MODAL_CLOSED: 'modal:closed',
    THEME_CHANGED: 'theme:changed',
    VIEW_CHANGED: 'view:changed',
    GROUP_TOGGLED: 'group:toggled',
    FILTER_CHANGED: 'filter:changed',
    PAGE_SIZE_CHANGED: 'page:sizeChanged',

    // 数据相关事件
    DATA_IMPORTED: 'data:imported',
    DATA_EXPORTED: 'data:exported',
    DATA_CLEARED: 'data:cleared',

    // 错误事件
    ERROR_OCCURRED: 'error:occurred'
};

// 注册到模块系统
ModuleRegistry.register('EventBus', EventBus);
ModuleRegistry.register('EventType', EventType);
