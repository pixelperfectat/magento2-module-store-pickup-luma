/**
 * Store pickup on the Luma checkout: reads the locations the config provider ships in
 * `window.checkoutConfig.ppStorePickup` and tells whether a shipping method is a pickup rate.
 *
 * `locations` is keyed by location code. PHP serialises it as a JSON array when the codes are "0".."n-1", so
 * locations are always looked up by key, never iterated as an object.
 */
define([
    'ko',
    'Magento_Checkout/js/model/quote'
], function (ko, quote) {
    'use strict';

    var config = (window.checkoutConfig && window.checkoutConfig.ppStorePickup) || {},
        carrierCode = config.carrierCode || 'pppickup',
        locations = config.locations || {};

    /**
     * @param {Object|null} method - a shipping rate or quote shipping method
     * @return {Boolean}
     */
    function isPickup(method) {
        return !!method && method['carrier_code'] === carrierCode;
    }

    /**
     * @param {String|null} code - location code (the rate's method code)
     * @return {Object|null}
     */
    function getLocation(code) {
        if (code === null || code === undefined || !Object.prototype.hasOwnProperty.call(locations, code)) {
            return null;
        }

        return locations[code] || null;
    }

    return {
        carrierCode: carrierCode,
        isPickup: isPickup,
        getLocation: getLocation,

        /**
         * The location of the selected pickup rate, or null for any other method or an unknown code.
         */
        selectedLocation: ko.pureComputed(function () {
            var method = quote.shippingMethod();

            return isPickup(method) ? getLocation(method['method_code']) : null;
        }),

        /**
         * The location whose address matches, or null.
         *
         * @param {String|undefined} street - first street line
         * @param {String|undefined} postcode
         * @param {String|undefined} city
         * @return {Object|null}
         */
        findLocationByAddress: function (street, postcode, city) {
            var codes = Object.keys(locations),
                i,
                location;

            for (i = 0; i < codes.length; i++) {
                location = getLocation(codes[i]);

                if (location && (location.street || [])[0] === street &&
                    location.postcode === postcode && location.city === city
                ) {
                    return location;
                }
            }

            return null;
        },

        /**
         * Marks a quote address as a pickup address: Luma must never copy it to billing, so the resolver and the
         * shipping save processor leave billing empty and the "same as shipping" checkbox stays hidden.
         *
         * @param {Object} address
         * @return {Object}
         */
        markPickupAddress: function (address) {
            if (address) {
                // not enumerable: the address object is posted as is, and the API rejects unknown fields
                Object.defineProperty(address, 'ppPickup', {value: true, configurable: true});
                address.canUseForBilling = function () {
                    return false;
                };
            }

            return address;
        },

        /**
         * @param {Object|null} address
         * @return {Boolean}
         */
        isPickupAddress: function (address) {
            return !!address && address.ppPickup === true;
        }
    };
});
