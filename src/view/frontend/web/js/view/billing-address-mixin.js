/**
 * Luma billing address: while a pickup rate is selected the shipping address is the pickup location, so it can
 * never be the billing address. The "My billing and shipping address are the same" checkbox is hidden and billing
 * (with phone) must be entered or picked on the payment step.
 */
define([
    'ko',
    'Magento_Checkout/js/model/quote',
    'PixelPerfect_StorePickupLuma/js/model/pickup'
], function (ko, quote, pickup) {
    'use strict';

    return function (Component) {
        var canUseShippingAddress = Component.prototype.canUseShippingAddress;

        return Component.extend({
            canUseShippingAddress: ko.pureComputed(function () {
                return !pickup.isPickup(quote.shippingMethod()) && Boolean(canUseShippingAddress());
            }),

            /**
             * @inheritdoc
             */
            initObservable: function () {
                this._super();

                pickup.selectedLocation.subscribe(this.ppSeparateBilling, this);
                quote.billingAddress.subscribe(this.ppSeparateBilling, this);
                this.ppSeparateBilling();

                return this;
            },

            /**
             * Unchecks "same as shipping", drops a billing address that is the shipping (location) address and
             * shows the billing form while there is no billing address (Luma shows the empty details otherwise).
             */
            ppSeparateBilling: function () {
                var billing = quote.billingAddress(),
                    shipping = quote.shippingAddress();

                if (!pickup.isPickup(quote.shippingMethod())) {
                    return;
                }
                this.isAddressSameAsShipping(false);

                if (billing && shipping && billing.getCacheKey() === shipping.getCacheKey()) {
                    quote.billingAddress(null);
                    billing = null;
                }

                if (!billing) {
                    this.isAddressDetailsVisible(false);
                }
            }
        });
    };
});
