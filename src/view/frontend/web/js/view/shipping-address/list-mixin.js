/**
 * Luma saved-address list: `visible` becomes an observable, so the shipping mixin can hide the list while a pickup
 * rate is selected and show it again on switching back.
 */
define([], function () {
    'use strict';

    return function (Component) {
        return Component.extend({
            /**
             * @inheritdoc
             */
            initObservable: function () {
                this._super();
                this.observe('visible');

                return this;
            }
        });
    };
});
