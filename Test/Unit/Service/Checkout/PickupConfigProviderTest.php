<?php declare(strict_types=1);

namespace PixelPerfect\StorePickupLuma\Test\Unit\Service\Checkout;

use Magento\Directory\Model\Country;
use Magento\Directory\Model\CountryFactory;
use Magento\Store\Api\Data\StoreInterface;
use Magento\Store\Model\StoreManagerInterface;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use PixelPerfect\StorePickup\Api\Data\PickupLocationInterface;
use PixelPerfect\StorePickup\Api\Service\LocationProviderInterface;
use PixelPerfect\StorePickupLuma\Service\Checkout\PickupConfigProvider;
use Psr\Log\LoggerInterface;

class PickupConfigProviderTest extends TestCase
{
    private LocationProviderInterface&MockObject $provider;
    private CountryFactory&MockObject $countryFactory;
    private LoggerInterface&MockObject $logger;
    private StoreManagerInterface&MockObject $storeManager;
    private PickupConfigProvider $configProvider;

    protected function setUp(): void
    {
        $this->provider = $this->createMock(LocationProviderInterface::class);
        $this->countryFactory = $this->createMock(CountryFactory::class);
        $this->logger = $this->createMock(LoggerInterface::class);
        $this->storeManager = $this->createMock(StoreManagerInterface::class);
        $store = $this->createMock(StoreInterface::class);
        $store->method('getId')->willReturn('7');
        $this->storeManager->method('getStore')->willReturn($store);
        $this->configProvider = new PickupConfigProvider(
            $this->provider,
            $this->storeManager,
            $this->countryFactory,
            $this->logger
        );
    }

    public function testTwoLocationsAreKeyedByCodeWithAllFields(): void
    {
        $this->countryNames(['AT' => 'Austria', 'DE' => 'Germany']);
        $this->provider->expects(self::once())->method('getLocations')->with(7)->willReturn([
            'main' => $this->location('main', 'Main Store', ['Main Street 1', 'Floor 2'], '1010', 'Vienna', 'AT', 5, 'Wien', '+43 1 000', '9-17', 'Ring the bell'),
            '8' => $this->location('8', 'Second', ['Side Road 3'], '10115', 'Berlin', 'DE', null, null, null, null, null),
        ]);

        $config = $this->configProvider->getConfig();

        self::assertSame(['ppStorePickup'], array_keys($config));
        self::assertSame('pppickup', $config['ppStorePickup']['carrierCode']);
        self::assertSame(['main', '8'], array_map('strval', array_keys($config['ppStorePickup']['locations'])));
        self::assertSame([
            'code' => 'main',
            'name' => 'Main Store',
            'street' => ['Main Street 1', 'Floor 2'],
            'postcode' => '1010',
            'city' => 'Vienna',
            'countryId' => 'AT',
            'regionId' => 5,
            'region' => 'Wien',
            'telephone' => '+43 1 000',
            'openingHours' => '9-17',
            'note' => 'Ring the bell',
            'addressLines' => ['Main Street 1', 'Floor 2', '1010 Vienna', 'Austria'],
        ], $config['ppStorePickup']['locations']['main']);
        self::assertSame([
            'code' => '8',
            'name' => 'Second',
            'street' => ['Side Road 3'],
            'postcode' => '10115',
            'city' => 'Berlin',
            'countryId' => 'DE',
            'regionId' => null,
            'region' => null,
            'telephone' => null,
            'openingHours' => null,
            'note' => null,
            'addressLines' => ['Side Road 3', '10115 Berlin', 'Germany'],
        ], $config['ppStorePickup']['locations'][8]);
    }

    public function testNoLocationsGiveAnEmptyList(): void
    {
        $this->provider->method('getLocations')->willReturn([]);

        $config = $this->configProvider->getConfig();

        self::assertSame([], $config['ppStorePickup']['locations']);
        self::assertSame('pppickup', $config['ppStorePickup']['carrierCode']);
    }

    public function testAddressLinesTrimDropBlanksAndFallBackToTheCountryCode(): void
    {
        $this->countryNames([]);
        $this->provider->method('getLocations')->willReturn([
            'a' => $this->location('a', 'A', [' Street 1 ', ''], '', '', 'XX', null, null, null, null, null),
        ]);

        $config = $this->configProvider->getConfig();

        self::assertSame(['Street 1', 'XX'], $config['ppStorePickup']['locations']['a']['addressLines']);
    }

    public function testAThrowingProviderGivesNoLocationsAndIsLogged(): void
    {
        $exception = new \RuntimeException('boom');
        $this->provider->method('getLocations')->willThrowException($exception);
        $this->logger->expects(self::once())->method('error')->with(
            'Store pickup: reading the pickup locations for the Luma checkout failed: boom',
            ['exception' => $exception]
        );

        $config = $this->configProvider->getConfig();

        self::assertSame([], $config['ppStorePickup']['locations']);
        self::assertSame('pppickup', $config['ppStorePickup']['carrierCode']);
    }

    /**
     * @param array<string, string> $names
     */
    private function countryNames(array $names): void
    {
        $this->countryFactory->method('create')->willReturnCallback(function () use ($names): Country {
            $country = $this->getMockBuilder(Country::class)
                ->disableOriginalConstructor()
                ->onlyMethods(['loadByCode', 'getName'])
                ->getMock();
            $loaded = null;
            $country->method('loadByCode')->willReturnCallback(
                function (string $code) use ($country, &$loaded) {
                    $loaded = $code;

                    return $country;
                }
            );
            $country->method('getName')->willReturnCallback(function () use ($names, &$loaded) {
                return $names[$loaded] ?? null;
            });

            return $country;
        });
    }

    /**
     * @param list<string> $street
     */
    private function location(
        string $code,
        string $name,
        array $street,
        string $postcode,
        string $city,
        string $countryId,
        ?int $regionId,
        ?string $region,
        ?string $telephone,
        ?string $hours,
        ?string $note
    ): PickupLocationInterface {
        $location = $this->createMock(PickupLocationInterface::class);
        $location->method('getCode')->willReturn($code);
        $location->method('getName')->willReturn($name);
        $location->method('getStreet')->willReturn($street);
        $location->method('getPostcode')->willReturn($postcode);
        $location->method('getCity')->willReturn($city);
        $location->method('getCountryId')->willReturn($countryId);
        $location->method('getRegionId')->willReturn($regionId);
        $location->method('getRegion')->willReturn($region);
        $location->method('getTelephone')->willReturn($telephone);
        $location->method('getOpeningHours')->willReturn($hours);
        $location->method('getNote')->willReturn($note);

        return $location;
    }
}
