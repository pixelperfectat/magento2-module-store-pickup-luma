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
     * Compares address values tolerant of type and surrounding whitespace.
     *
     * @param {*} left
     * @param {*} right
     * @return {Boolean}
     */
    function same(left, right) {
        var normalise = function (value) {
            return value === null || value === undefined ? '' : String(value).trim();
        };

        return normalise(left) === normalise(right);
    }

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

                if (location && this.isSameAddress(
                    {street: (location.street || [])[0], postcode: location.postcode, city: location.city},
                    street,
                    postcode,
                    city
                )) {
                    return location;
                }
            }

            return null;
        },

        /**
         * @param {Object} address - {street: first line, postcode, city}
         * @param {*} street
         * @param {*} postcode
         * @param {*} city
         * @return {Boolean}
         */
        isSameAddress: function (address, street, postcode, city) {
            return same(address.street, street) && same(address.postcode, postcode) && same(address.city, city);
        },

        isSameValue: same,

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
                // never ask to save the location in the address book (core sets 1 for customers on the inline form)
                address.saveInAddressBook = 0;
                address['save_in_address_book'] = 0;
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
