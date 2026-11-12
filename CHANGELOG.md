# Changelog

All notable changes to this project are documented in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Pickup locations in `window.checkoutConfig.ppStorePickup` for the Luma checkout.
- Pickup address in the Luma shipping step. Selecting a pickup rate fills the shipping address from the location and hides the address fields; first name, last name and phone stay. Customers with saved addresses get a small contact form in place of the address list.
- Client-side restore of the typed address when switching back to a delivery rate, kept in the `checkout-data` section and recovered once on page load. The address book is never written.
- Billing stays the customer's own: the "same as shipping" checkbox is hidden for pickup rates and billing is required.
- Location details under each pickup rate and "Pickup Location" in the checkout sidebar.
- Translations for `en_US`, `de_DE` and `it_IT`.
- README with requirements, installation, customising, known limits and screenshots.
