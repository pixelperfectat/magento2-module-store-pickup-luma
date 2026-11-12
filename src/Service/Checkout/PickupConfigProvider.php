<?php declare(strict_types=1);

namespace PixelPerfect\StorePickupLuma\Service\Checkout;

use Magento\Checkout\Model\ConfigProviderInterface;
use Magento\Directory\Model\CountryFactory;
use Magento\Store\Model\StoreManagerInterface;
use PixelPerfect\StorePickup\Api\Data\PickupLocationInterface;
use PixelPerfect\StorePickup\Api\Service\LocationProviderInterface;
use PixelPerfect\StorePickup\Api\Service\PickupMethodResolverInterface;
use Psr\Log\LoggerInterface;

/**
 * Ships the pickup locations of the current store view to `window.checkoutConfig.ppStorePickup`.
 *
 * The Luma checkout is a full page load, so the request's store is the store of the quote.
 */
class PickupConfigProvider implements ConfigProviderInterface
{
    /**
     * Constructor.
     *
     * @param LocationProviderInterface $locationProvider
     * @param StoreManagerInterface $storeManager
     * @param CountryFactory $countryFactory
     * @param LoggerInterface $logger
     * @param string $carrierCode
     */
    public function __construct(
        private readonly LocationProviderInterface $locationProvider,
        private readonly StoreManagerInterface $storeManager,
        private readonly CountryFactory $countryFactory,
        private readonly LoggerInterface $logger,
        private readonly string $carrierCode = PickupMethodResolverInterface::CARRIER_CODE
    ) {
    }

    /**
     * Carrier code and the active locations of the current store view, keyed by code.
     *
     * @return array<string, mixed>
     */
    public function getConfig(): array
    {
        return [
            'ppStorePickup' => [
                'carrierCode' => $this->carrierCode,
                'locations' => $this->getLocations(),
            ],
        ];
    }

    /**
     * Locations as plain data for the checkout; empty when they cannot be read, so the checkout stays usable.
     *
     * @return array<string, array<string, mixed>>
     */
    private function getLocations(): array
    {
        try {
            $locations = [];
            $storeId = (int) $this->storeManager->getStore()->getId();
            foreach ($this->locationProvider->getLocations($storeId) as $location) {
                $locations[$location->getCode()] = $this->toArray($location);
            }

            return $locations;
        } catch (\Throwable $exception) {
            $this->logger->error(
                'Store pickup: reading the pickup locations for the Luma checkout failed: '
                . $exception->getMessage(),
                ['exception' => $exception]
            );

            return [];
        }
    }

    /**
     * One location as the JS contract of the checkout components.
     *
     * @param PickupLocationInterface $location
     * @return array<string, mixed>
     */
    private function toArray(PickupLocationInterface $location): array
    {
        return [
            'code' => $location->getCode(),
            'name' => $location->getName(),
            'street' => $location->getStreet(),
            'postcode' => $location->getPostcode(),
            'city' => $location->getCity(),
            'countryId' => $location->getCountryId(),
            'regionId' => $location->getRegionId(),
            'region' => $location->getRegion(),
            'telephone' => $location->getTelephone(),
            'openingHours' => $location->getOpeningHours(),
            'note' => $location->getNote(),
            'addressLines' => $this->getAddressLines($location),
        ];
    }

    /**
     * Address lines: street lines, "<postcode> <city>" and the country name.
     *
     * @param PickupLocationInterface $location
     * @return list<string>
     */
    private function getAddressLines(PickupLocationInterface $location): array
    {
        $lines = [];
        foreach ($location->getStreet() as $street) {
            $lines[] = $street;
        }
        $lines[] = $location->getPostcode() . ' ' . $location->getCity();
        $lines[] = $this->countryName($location->getCountryId());

        return array_values(array_filter(array_map('trim', $lines), static fn (string $line): bool => $line !== ''));
    }

    /**
     * Country display name; falls back to the ISO code when the directory does not know it.
     *
     * @param string $countryId
     * @return string
     */
    private function countryName(string $countryId): string
    {
        $name = (string) $this->countryFactory->create()->loadByCode($countryId)->getName();

        return $name !== '' ? $name : $countryId;
    }
}
