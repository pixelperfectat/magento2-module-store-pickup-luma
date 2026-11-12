var config = {
    config: {
        mixins: {
            'Magento_Checkout/js/view/shipping': {
                'PixelPerfect_StorePickupLuma/js/view/shipping-mixin': true
            },
            'Magento_Checkout/js/view/billing-address': {
                'PixelPerfect_StorePickupLuma/js/view/billing-address-mixin': true
            },
            'Magento_Checkout/js/view/shipping-address/list': {
                'PixelPerfect_StorePickupLuma/js/view/shipping-address/list-mixin': true
            }
        }
    }
};
