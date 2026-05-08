/**
 * 通用分页组件
 * 支持分页显示和多条件筛选
 */

const Paginator = {
    /**
     * 创建分页实例
     * @param {Object} config
     * @returns {Object} 分页实例
     */
    create(config) {
        const instance = {
            data: config.data || [],
            filteredData: config.data || [],
            pageSize: config.pageSize || 10,
            currentPage: 1,
            totalPage: 1,
            filters: {
                type: null,
                startDate: null,
                endDate: null
            },
            containerId: config.containerId || '',
            onPageChange: config.onPageChange || function() {},
            onFilterChange: config.onFilterChange || function() {}
        };

        instance.totalPage = Math.max(1, Math.ceil(instance.filteredData.length / instance.pageSize));
        return instance;
    },

    /**
     * 应用筛选条件
     * @param {Object} instance
     * @param {Object} filters - {type, startDate, endDate}
     */
    applyFilters(instance, filters) {
        instance.filters = { ...instance.filters, ...filters };
        instance.currentPage = 1;

        instance.filteredData = instance.data.filter(item => {
            // 按类型筛选
            if (instance.filters.type && item.type !== instance.filters.type) {
                return false;
            }
            // 按日期范围筛选
            if (instance.filters.startDate && item.date < instance.filters.startDate) {
                return false;
            }
            if (instance.filters.endDate && item.date > instance.filters.endDate) {
                return false;
            }
            return true;
        });

        instance.totalPage = Math.max(1, Math.ceil(instance.filteredData.length / instance.pageSize));
        instance.onFilterChange(instance);
    },

    /**
     * 清除筛选条件
     * @param {Object} instance
     */
    clearFilters(instance) {
        Paginator.applyFilters(instance, { type: null, startDate: null, endDate: null });
    },

    /**
     * 跳转到指定页
     * @param {Object} instance
     * @param {number} page
     */
    goToPage(instance, page) {
        if (page < 1) page = 1;
        if (page > instance.totalPage) page = instance.totalPage;
        instance.currentPage = page;
        instance.onPageChange(Paginator.getCurrentPageData(instance));
    },

    /**
     * 设置每页条数
     * @param {Object} instance
     * @param {number} pageSize
     */
    setPageSize(instance, pageSize) {
        instance.pageSize = pageSize;
        instance.currentPage = 1;
        instance.totalPage = Math.max(1, Math.ceil(instance.filteredData.length / instance.pageSize));
        instance.onPageChange(Paginator.getCurrentPageData(instance));
    },

    /**
     * 获取当前页数据
     * @param {Object} instance
     * @returns {Array}
     */
    getCurrentPageData(instance) {
        const start = (instance.currentPage - 1) * instance.pageSize;
        const end = start + instance.pageSize;
        return instance.filteredData.slice(start, end);
    },

    /**
     * 渲染分页控件
     * @param {Object} instance
     * @returns {string} HTML
     */
    renderControls(instance) {
        const total = instance.filteredData.length;
        if (total === 0) return '';

        const current = instance.currentPage;
        const totalPage = instance.totalPage;
        const start = (current - 1) * instance.pageSize + 1;
        const end = Math.min(current * instance.pageSize, total);

        let html = '<div class="pagination">';
        html += `<span class="page-info">${start}-${end} / 共${total}条</span>`;

        // 上一页
        html += `<button class="page-btn" data-action="prev" ${current <= 1 ? 'disabled' : ''}>上一页</button>`;

        // 页码
        const maxVisible = 5;
        let startPage = Math.max(1, current - Math.floor(maxVisible / 2));
        const endPage = Math.min(totalPage, startPage + maxVisible - 1);
        if (endPage - startPage < maxVisible - 1) {
            startPage = Math.max(1, endPage - maxVisible + 1);
        }

        if (startPage > 1) {
            html += '<button class="page-btn" data-page="1">1</button>';
            if (startPage > 2) html += '<span class="page-ellipsis">...</span>';
        }

        for (let i = startPage; i <= endPage; i++) {
            html += `<button class="page-btn ${i === current ? 'active' : ''}" data-page="${i}">${i}</button>`;
        }

        if (endPage < totalPage) {
            if (endPage < totalPage - 1) html += '<span class="page-ellipsis">...</span>';
            html += `<button class="page-btn" data-page="${totalPage}">${totalPage}</button>`;
        }

        // 下一页
        html += `<button class="page-btn" data-action="next" ${current >= totalPage ? 'disabled' : ''}>下一页</button>`;

        // 每页条数
        html += '<select class="page-size-select">';
        [10, 20, 50].forEach(size => {
            html += `<option value="${size}" ${instance.pageSize === size ? 'selected' : ''}>${size}条/页</option>`;
        });
        html += '</select>';

        html += '</div>';
        return html;
    }
};

// 注册到模块系统
ModuleRegistry.register('Paginator', Paginator);
