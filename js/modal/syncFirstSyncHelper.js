const SyncFirstSyncHelper = {
    show: function (syncStatus, onChoice) {
        const container = document.getElementById('modal-container');
        const title = document.getElementById('modal-title');
        const body = document.getElementById('modal-body');
        const footer = document.getElementById('modal-footer');

        title.textContent = '首次同步 - 选择处理方式';

        body.innerHTML =
            '<p>检测到本地与云端均有数据，请选择首次同步的处理方式：</p>' +
            '<div class="first-sync-options">' +
                '<label class="first-sync-option">' +
                    '<input type="radio" name="first-sync-choice" value="local" checked />' +
                    '<div class="first-sync-option-content">' +
                        '<strong>保留本地数据</strong>' +
                        '<p class="first-sync-desc">保留本地数据不变，标记已同步状态，覆盖云端</p>' +
                    '</div>' +
                '</label>' +
                '<label class="first-sync-option">' +
                    '<input type="radio" name="first-sync-choice" value="cloud" />' +
                    '<div class="first-sync-option-content">' +
                        '<strong>使用云端数据</strong>' +
                        '<p class="first-sync-desc">用云端数据替换全部本地数据</p>' +
                    '</div>' +
                '</label>' +
                '<label class="first-sync-option">' +
                    '<input type="radio" name="first-sync-choice" value="merge" />' +
                    '<div class="first-sync-option-content">' +
                        '<strong>合并</strong>' +
                        '<p class="first-sync-desc">尝试自动合并数据，有冲突时进入冲突解决流程</p>' +
                    '</div>' +
                '</label>' +
            '</div>' +
            '<div class="first-sync-info">' +
                '<span>本地: ' + (syncStatus.localFunds || 0) + ' 基金, ' + (syncStatus.localTrades || 0) + ' 交易</span>' +
                '<span> | </span>' +
                '<span>云端: ' + (syncStatus.cloudFunds || 0) + ' 基金, ' + (syncStatus.cloudTrades || 0) + ' 交易</span>' +
            '</div>';

        footer.innerHTML =
            '<button class="btn btn-primary" id="btn-first-sync-confirm">确认</button>';

        container.classList.remove('hidden');
        container.classList.add('modal-sync-first');
        SyncFirstSyncHelper._bindEvents(onChoice);
    },

    _bindEvents: function (onChoice) {
        const btnConfirm = document.getElementById('btn-first-sync-confirm');
        const btnClose = document.querySelector('.modal-close');
        const oldConfirm = btnConfirm._listener;

        if (oldConfirm) {
            btnConfirm.removeEventListener('click', oldConfirm);
        }

        const handler = function () {
            const checked = document.querySelector('input[name="first-sync-choice"]:checked');
            const choice = checked ? checked.value : 'local';
            SyncFirstSyncHelper.close();
            if (typeof onChoice === 'function') {
                onChoice(choice);
            }
        };

        btnConfirm._listener = handler;
        btnConfirm.addEventListener('click', handler);

        if (btnClose) {
            SyncFirstSyncHelper._removeCloseListener();
            SyncFirstSyncHelper._closeHandler = function () {
                SyncFirstSyncHelper.close();
            };
            btnClose.addEventListener('click', SyncFirstSyncHelper._closeHandler);
        }
    },

    _removeCloseListener: function () {
        const btnClose = document.querySelector('.modal-close');
        if (btnClose && SyncFirstSyncHelper._closeHandler) {
            btnClose.removeEventListener('click', SyncFirstSyncHelper._closeHandler);
        }
    },

    close: function () {
        window.Modal.hide();
    }
};

ModuleRegistry.register('SyncFirstSyncHelper', SyncFirstSyncHelper);
