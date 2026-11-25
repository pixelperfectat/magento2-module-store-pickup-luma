# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-11-25

### Added

- Pickup locations in `window.checkoutConfig.ppStorePickup` for the Luma checkout.
- Pickup address in the Luma shipping step. Selecting a pickup rate fills the shipping address from the location and hides the address fields; first name, last name and phone stay. Customers with saved addresses get a small contact form in place of the address list.
- Client-side restore of the typed address when switching back to a delivery rate, kept in the `checkout-data` section and recovered once on page load. The address book is never written.
- Billing stays the customer's own: the "same as shipping" checkbox is hidden for pickup rates and billing is required.
- Location details under each pickup rate and "Pickup Location" in the checkout sidebar.
- Translations for `en_US`, `de_DE` and `it_IT`.
- README with requirements, installation, customising, known limits and screenshots.

[Unreleased]: https://github.com/pixelperfectat/magento2-module-store-pickup-luma/compare/0.1.0...HEAD
[0.1.0]: https://github.com/pixelperfectat/magento2-module-store-pickup-luma/releases/tag/0.1.0
