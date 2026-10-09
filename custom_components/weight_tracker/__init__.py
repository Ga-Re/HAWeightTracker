"""Weight Tracker: assigns scale readings to persons and tracks their weight."""

from __future__ import annotations

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import Platform
from homeassistant.core import HomeAssistant
from homeassistant.helpers import (
    config_validation as cv,
    device_registry as dr,
    entity_registry as er,
)
from homeassistant.helpers.dispatcher import async_dispatcher_send
from homeassistant.helpers.typing import ConfigType

from .const import CONF_CREATE_SENSORS, DOMAIN, SIGNAL_UPDATED
from .settings import migrate_options
from .entity import hub_device_info
from .manager import WeightTrackerManager
from .panel import async_register_panel, async_remove_panel, async_setup_frontend
from .services import async_setup_services

PLATFORMS = [Platform.BUTTON, Platform.SENSOR]

CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)

type WeightTrackerConfigEntry = ConfigEntry[WeightTrackerManager]


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Register the actions, the websocket API and the panel code."""
    async_setup_services(hass)
    await async_setup_frontend(hass)
    return True


async def async_setup_entry(hass: HomeAssistant, entry: WeightTrackerConfigEntry) -> bool:
    """Set up a scale."""
    if (migrated := migrate_options(dict(entry.options))) is not None:
        # Before the update listener exists, so this does not trigger a reload.
        hass.config_entries.async_update_entry(entry, options=migrated)
    manager = WeightTrackerManager(hass, entry)
    await manager.async_setup()
    entry.runtime_data = manager

    device_registry = dr.async_get(hass)
    # Create the hub device first so person devices can reference it.
    device_registry.async_get_or_create(
        config_entry_id=entry.entry_id, **hub_device_info(entry)
    )
    valid = {(DOMAIN, entry.entry_id)} | {
        (DOMAIN, f"{entry.entry_id}_{person_id}")
        for person_id, person in manager.persons.items()
        if person.get(CONF_CREATE_SENSORS)
    } | {(DOMAIN, f"{entry.entry_id}_pet_{pet_id}") for pet_id in manager.pets}
    for device in dr.async_entries_for_config_entry(device_registry, entry.entry_id):
        if not device.identifiers & valid:
            device_registry.async_update_device(
                device.id, remove_config_entry_id=entry.entry_id
            )

    # Entities of platforms this version no longer provides (e.g. the old select)
    entity_registry = er.async_get(hass)
    for reg_entry in er.async_entries_for_config_entry(entity_registry, entry.entry_id):
        if reg_entry.domain not in PLATFORMS:
            entity_registry.async_remove(reg_entry.entity_id)

    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    entry.async_on_unload(entry.add_update_listener(_async_update_listener))
    await async_register_panel(hass)
    async_dispatcher_send(hass, SIGNAL_UPDATED)
    return True


async def _async_update_listener(hass: HomeAssistant, entry: WeightTrackerConfigEntry) -> None:
    """Reload after the options changed."""
    await hass.config_entries.async_reload(entry.entry_id)


async def async_unload_entry(hass: HomeAssistant, entry: WeightTrackerConfigEntry) -> bool:
    """Unload a scale."""
    if unload_ok := await hass.config_entries.async_unload_platforms(entry, PLATFORMS):
        await entry.runtime_data.async_unload()
        async_dispatcher_send(hass, SIGNAL_UPDATED)
    return unload_ok


async def async_remove_entry(hass: HomeAssistant, entry: WeightTrackerConfigEntry) -> None:
    """Delete stored measurements when the scale is removed."""
    await WeightTrackerManager(hass, entry).async_remove_storage()
    if not any(
        other.entry_id != entry.entry_id
        for other in hass.config_entries.async_entries(DOMAIN)
    ):
        async_remove_panel(hass)
