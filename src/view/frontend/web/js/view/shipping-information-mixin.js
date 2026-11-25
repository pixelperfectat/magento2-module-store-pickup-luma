/**
 * Luma sidebar "Ship To" block: tells the template whether a pickup rate is selected, so it can show
 * "Pickup Location" instead of "Ship To".
 */
define([
    'Magento_Checkout/js/model/quote',
    'PixelPerfect_StorePickupLuma/js/model/pickup'
], function (quote, pickup) {
    'use strict';

    return function (Component) {
        return Component.extend({
            /**
             * @return {Boolean}
             */
            isPickup: function () {
                return pickup.isPickup(quote.shippingMethod());
            }
        });
    };
});
