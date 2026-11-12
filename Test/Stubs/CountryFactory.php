<?php declare(strict_types=1);

namespace Magento\Directory\Model;

/**
 * Stand-in for the auto-generated country factory, which only exists in a generated Magento installation.
 * Loaded by Test/bootstrap.php when the real class is absent.
 */
class CountryFactory
{
    /**
     * @param array<string, mixed> $data
     * @return Country
     */
    public function create(array $data = []): Country
    {
        return new Country();
    }
}
