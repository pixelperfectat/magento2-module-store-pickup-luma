<?php declare(strict_types=1);

require __DIR__ . '/../vendor/autoload.php';

// Generated factories only exist in a generated Magento installation.
if (!class_exists(\Magento\Directory\Model\CountryFactory::class)) {
    require __DIR__ . '/Stubs/CountryFactory.php';
}
