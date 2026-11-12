/**
 * Luma shipping step: while a pickup rate is selected the shipping address is the pickup location.
 *
 * - Inline form (guests, customers without saved addresses): the address fields are snapshotted, overwritten with
 *   the location (company = location name) and hidden. First name, last name and phone stay visible and required,
 *   because Luma collects billing only on the payment step. Luma's checkout data then holds the location (its
 *   "Next" merges that data back into the form), so the typed values are kept under their own storage key and
 *   come back after a reload, even when the pickup rate is gone by then.
 * - Saved addresses: the selected address is remembered, the list and the "New Address" button are hidden, and a
 *   small contact form (first name, last name, phone) feeds a new address built from the location.
 *
 * Switching back to a delivery rate restores the snapshot or re-selects the remembered address. The core
 * `beforeSaveAddressInformation` plugin rewrites the posted address to the location server-side anyway.
 */
define([
    'jquery',
    'ko',
    'uiRegistry',
    'uiLayout',
    'Magento_Customer/js/model/customer',
    'Magento_Customer/js/model/address-list',
    'Magento_Checkout/js/model/quote',
    'Magento_Checkout/js/model/address-converter',
    'Magento_Checkout/js/model/checkout-data-resolver',
    'Magento_Checkout/js/action/select-shipping-address',
    'Magento_Checkout/js/checkout-data',
    'PixelPerfect_StorePickupLuma/js/model/pickup',
    'Magento_Ui/js/lib/view/utils/async',
    'jquery/jquery-storageapi',
    'mage/validation'
], function (
    $,
    ko,
    registry,
    layout,
    customer,
    addressList,
    quote,
    addressConverter,
    checkoutDataResolver,
    selectShippingAddress,
    checkoutData,
    pickup
) {
    'use strict';

    var PROVIDER = 'checkoutProvider',
        SCOPE = 'shippingAddress',
        FIELDSET = 'checkout.steps.shipping-step.shippingAddress.shipping-address-fieldset',
        // country first: the region fields follow the country when it changes
        ADDRESS_FIELDS = ['country_id', 'region_id', 'region', 'street', 'postcode', 'city', 'company'],
        CONTACT_FORM = 'form[data-role=pp-pickup-contact]',
        // the frontend group template ignores the group's `visible`, so its legend is toggled on the node
        STREET_FIELDSET = '#shipping-new-address-form fieldset.street',
        STORAGE_KEY = 'typed-shipping-address',
        storage = $.initNamespaceStorage('pp-store-pickup').localStorage;

    /**
     * @param {*} value
     * @return {*}
     */
    function copy(value) {
        if (Array.isArray(value)) {
            return $.extend(true, [], value);
        }

        return $.isPlainObject(value) ? $.extend(true, {}, value) : value;
    }

    /**
     * @param {*} value
     * @return {String}
     */
    function text(value) {
        return value === null || value === undefined ? '' : String(value);
    }

    return function (Component) {
        return Component.extend({
            /**
             * @inheritdoc
             */
            initialize: function () {
                var self = this,
                    newAddressAdded;

                this._super();

                this.ppApplied = false;
                this.ppLocationCode = null;
                this.ppSnapshot = null;
                this.ppRememberedAddress = null;
                this.ppContact = {
                    firstname: ko.observable(''),
                    lastname: ko.observable(''),
                    telephone: ko.observable('')
                };
                this.ppContactVisible = ko.observable(false);

                // the "New Address" button is bound to !isNewAddressAdded(); hide it while pickup is selected
                newAddressAdded = this.isNewAddressAdded;
                this.isNewAddressAdded = ko.pureComputed({
                    read: function () {
                        return newAddressAdded() || self.ppContactVisible();
                    },
                    write: newAddressAdded
                });

                if (this.isFormInline) {
                    this.ppStreetHidden = false;
                    $.async(STREET_FIELDSET, function (node) {
                        $(node).toggle(!self.ppStreetHidden);
                    });
                } else {
                    layout([{
                        parent: this.name,
                        name: 'pp-pickup-contact',
                        displayArea: 'before-form',
                        component: 'uiComponent',
                        template: 'PixelPerfect_StorePickupLuma/shipping-address/pickup-contact',
                        contact: this.ppContact,
                        isVisible: this.ppContactVisible
                    }]);
                }

                quote.shippingMethod.subscribe(this.ppOnShippingMethod, this);
                this.ppOnShippingMethod(quote.shippingMethod());

                return this;
            },

            /**
             * @inheritdoc
             */
            validateShippingInformation: function () {
                var address,
                    result;

                if (pickup.selectedLocation() && !this.isFormInline) {
                    if (!this.ppValidateContact()) {
                        return false;
                    }
                    address = quote.shippingAddress();

                    if (pickup.isPickupAddress(address)) {
                        address.firstname = this.ppContact.firstname();
                        address.lastname = this.ppContact.lastname();
                        address.telephone = this.ppContact.telephone();
                    }
                }

                result = this._super();

                if (result && pickup.selectedLocation()) {
                    // the inline form path may have selected a fresh address object built from the form
                    pickup.markPickupAddress(quote.shippingAddress());
                }

                return result;
            },

            /**
             * Applies or restores on every rate selection; an empty selection (rates reloading) changes nothing.
             *
             * @param {Object|null} method
             */
            ppOnShippingMethod: function (method) {
                var location;

                if (!method) {
                    return;
                }
                location = pickup.isPickup(method) ? pickup.getLocation(method['method_code']) : null;

                if (location) {
                    this.ppApply(location);
                } else if (this.ppApplied) {
                    this.ppRestore();
                } else if (this.isFormInline) {
                    this.ppRecoverTypedAddress();
                }
            },

            /**
             * @param {Object} location
             */
            ppApply: function (location) {
                if (this.ppApplied && this.ppLocationCode === location.code) {
                    return;
                }
                this.ppApplied = true;
                this.ppLocationCode = location.code;

                if (this.isFormInline) {
                    this.ppApplyToForm(location);
                } else {
                    this.ppApplyToSavedAddress(location);
                }
            },

            /**
             * Restores the address the customer had before pickup (D3).
             */
            ppRestore: function () {
                this.ppApplied = false;
                this.ppLocationCode = null;

                if (this.isFormInline) {
                    this.ppRestoreForm();
                } else {
                    this.ppRestoreSavedAddress();
                }
            },

            /**
             * @param {Function} callback - receives the checkout provider once the form fields exist
             */
            ppWithForm: function (callback) {
                registry.get([PROVIDER, FIELDSET + '.country_id', FIELDSET + '.street'], callback);
            },

            /**
             * @param {Object} location
             */
            ppApplyToForm: function (location) {
                var self = this;

                this.ppWithForm(function (provider) {
                    if (!self.ppApplied) {
                        return;
                    }

                    if (!self.ppSnapshot) {
                        self.ppSnapshot = self.ppTakeSnapshot(provider);
                        storage.set(STORAGE_KEY, self.ppSnapshot.values);
                    }
                    self.ppWriteFields(provider, {
                        'country_id': text(location.countryId),
                        'region_id': text(location.regionId),
                        region: text(location.region),
                        street: location.street || [],
                        postcode: text(location.postcode),
                        city: text(location.city),
                        company: text(location.name)
                    });
                    ADDRESS_FIELDS.forEach(function (field) {
                        self.ppSetVisible(field, {self: false, children: []});
                    });
                });
            },

            /**
             * Puts the typed values and the field visibility back.
             */
            ppRestoreForm: function () {
                var self = this,
                    snapshot = this.ppSnapshot;

                this.ppSnapshot = null;
                storage.remove(STORAGE_KEY);

                if (!snapshot) {
                    return;
                }
                this.ppWithForm(function (provider) {
                    self.ppWriteFields(provider, snapshot.values);
                    ADDRESS_FIELDS.forEach(function (field) {
                        self.ppSetVisible(field, snapshot.visible[field]);
                    });
                });
            },

            /**
             * @param {Object} provider
             * @return {Object}
             */
            ppTakeSnapshot: function (provider) {
                var snapshot = {values: {}, visible: {}},
                    stored = this.ppStoredTypedAddress(provider);

                ADDRESS_FIELDS.forEach(function (field) {
                    var element = registry.get(FIELDSET + '.' + field);

                    snapshot.values[field] = copy(stored ? stored[field] : provider.get(SCOPE + '.' + field));
                    snapshot.visible[field] = element ? {
                        self: element.visible(),
                        children: element.elems ? element.elems().map(function (child) {
                            return child.visible();
                        }) : []
                    } : null;
                });

                return snapshot;
            },

            /**
             * Writes through the form elements, so Luma's own listeners (rates, region, postcode) react as on typing.
             *
             * @param {Object} provider
             * @param {Object} values - keyed by ADDRESS_FIELDS
             */
            ppWriteFields: function (provider, values) {
                ADDRESS_FIELDS.forEach(function (field) {
                    var element = registry.get(FIELDSET + '.' + field),
                        value = values[field];

                    if (field === 'street' && element && element.elems) {
                        element.elems().forEach(function (line, index) {
                            line.value(value && value[index] !== undefined ? text(value[index]) : '');
                        });
                    } else if (element && ko.isObservable(element.value)) {
                        element.value(value === undefined ? '' : value);
                    } else {
                        provider.set(SCOPE + '.' + field, copy(value));
                    }
                });
            },

            /**
             * @param {String} field
             * @param {Object|null} state - {self: Boolean, children: Boolean[]}; a missing child flag means hidden
             */
            ppSetVisible: function (field, state) {
                var element = registry.get(FIELDSET + '.' + field);

                if (!element || !state) {
                    return;
                }
                element.visible(state.self);

                if (field === 'street') {
                    this.ppStreetHidden = !state.self;
                    $(STREET_FIELDSET).toggle(state.self);
                }

                if (element.elems) {
                    element.elems().forEach(function (child, index) {
                        child.visible(state.children[index] === undefined ? state.self : state.children[index]);
                    });
                }
            },

            /**
             * The typed values stored before pickup, but only while the form still holds a location address
             * (after a reload Luma refills it from its checkout data, which then holds the location).
             *
             * @param {Object} provider
             * @return {Object|null}
             */
            ppStoredTypedAddress: function (provider) {
                var stored = storage.get(STORAGE_KEY),
                    data = provider.get(SCOPE) || {},
                    street = data.street || {};

                if (!$.isPlainObject(stored)) {
                    return null;
                }

                return pickup.findLocationByAddress(street[0], data.postcode, data.city) ? stored : null;
            },

            /**
             * A delivery rate is selected without pickup applied in this page view (for example the pickup rate is
             * gone after a reload): put the stored typed values back once, if the form still holds a location.
             */
            ppRecoverTypedAddress: function () {
                var self = this;

                if (this.ppRecoveryDone) {
                    return;
                }
                this.ppRecoveryDone = true;
                this.ppWithForm(function (provider) {
                    var stored = self.ppStoredTypedAddress(provider);

                    storage.remove(STORAGE_KEY);

                    if (stored && !self.ppApplied) {
                        self.ppWriteFields(provider, stored);
                    }
                });
            },

            /**
             * @param {Object} location
             */
            ppApplyToSavedAddress: function (location) {
                var current = quote.shippingAddress();

                if (!pickup.isPickupAddress(current)) {
                    this.ppRememberedAddress = current;
                    this.ppPrefillContact(current);
                }
                this.ppToggleSavedAddresses(false);
                selectShippingAddress(pickup.markPickupAddress(addressConverter.formAddressDataToQuoteAddress({
                    firstname: this.ppContact.firstname(),
                    lastname: this.ppContact.lastname(),
                    telephone: this.ppContact.telephone(),
                    street: (location.street || []).slice(),
                    postcode: text(location.postcode),
                    city: text(location.city),
                    'country_id': text(location.countryId),
                    'region_id': text(location.regionId),
                    region: text(location.region),
                    company: text(location.name),
                    'save_in_address_book': 0
                })));
            },

            /**
             * Re-selects the saved address that was selected before pickup.
             */
            ppRestoreSavedAddress: function () {
                var address = this.ppRememberedAddress || checkoutDataResolver.getShippingAddressFromCustomerAddressList();

                this.ppRememberedAddress = null;
                this.ppToggleSavedAddresses(true);

                if (address) {
                    selectShippingAddress(address);
                    checkoutData.setSelectedShippingAddress(address.getKey());
                }
            },

            /**
             * @param {Object|null} address - the address selected before pickup
             */
            ppPrefillContact: function (address) {
                var data = customer.customerData || {},
                    contact = this.ppContact;

                contact.firstname(contact.firstname() || data.firstname || (address && address.firstname) || '');
                contact.lastname(contact.lastname() || data.lastname || (address && address.lastname) || '');
                contact.telephone(contact.telephone() || (address && address.telephone) || '');
            },

            /**
             * @param {Boolean} visible - true shows the saved addresses, false the pickup contact form
             */
            ppToggleSavedAddresses: function (visible) {
                var list = registry.get(this.name + '.address-list');

                this.ppContactVisible(!visible);

                if (list && ko.isObservable(list.visible)) {
                    list.visible(visible && addressList().length > 0);
                }
            },

            /**
             * @return {Boolean}
             */
            ppValidateContact: function () {
                var form = $(CONTACT_FORM),
                    contact = this.ppContact;

                if (form.length) {
                    form.validation();

                    return Boolean(form.validation('isValid'));
                }

                return !!(contact.firstname() && contact.lastname() && contact.telephone());
            }
        });
    };
});
