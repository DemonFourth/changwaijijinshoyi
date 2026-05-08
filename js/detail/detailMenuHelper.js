const DetailMenuHelper = {
    renderEditMenuHtml() {
        return '<div class="edit-menu-overlay" id="edit-menu-overlay">' +
            '<div class="edit-menu">' +
            '<div class="edit-menu-item" id="menu-edit-name">✏️ 编辑名称</div>' +
            '<div class="edit-menu-item" id="menu-edit-remark">📝 编辑备注</div>' +
            '<div class="edit-menu-item" id="menu-refresh-name">🔄 刷新名称</div>' +
            '</div></div>';
    }
};

ModuleRegistry.register('DetailMenuHelper', DetailMenuHelper);
