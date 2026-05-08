const DetailEditHelper = {
    renderNameEditHtml(currentName) {
        return '<input type="text" id="input-edit-fund-name" class="form-input" value="' + currentName + '" style="font-size:inherit;font-weight:inherit;width:300px;">' +
            '<button class="btn btn-primary btn-sm" id="btn-save-fund-name">保存</button>' +
            '<button class="btn btn-secondary btn-sm" id="btn-cancel-fund-name">取消</button>';
    },

    renderRemarkEditHtml(currentRemark) {
        return '<input type="text" id="input-edit-fund-remark" class="form-input" value="' + currentRemark + '" style="font-size:inherit;font-weight:inherit;width:300px;" maxlength="50">' +
            '<button class="btn btn-primary btn-sm" id="btn-save-fund-remark">保存</button>' +
            '<button class="btn btn-secondary btn-sm" id="btn-cancel-fund-remark">取消</button>';
    }
};

ModuleRegistry.register('DetailEditHelper', DetailEditHelper);
