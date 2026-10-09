"""Base entity for Weight Tracker."""

from __future__ import annotations

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import CONF_NAME
from homeassistant.helpers.device_registry import DeviceEntryType, DeviceInfo
from homeassistant.helpers.entity import Entity
from homeassistant.util import slugify

from .const import DOMAIN
from .manager import WeightTrackerManager


def hub_device_info(entry: ConfigEntry) -> DeviceInfo:
    """Device of the scale itself."""
    return DeviceInfo(
        identifiers={(DOMAIN, entry.entry_id)},
        name=entry.title,
        manufacturer="Weight Tracker",
        model="Waage",
        entry_type=DeviceEntryType.SERVICE,
    )


class WeightTrackerEntity(Entity):
    """Entity belonging to the scale or to one person."""

    _attr_has_entity_name = True
    _attr_should_poll = False

    def __init__(
        self,
        manager: WeightTrackerManager,
        platform: str,
        key: str,
        person_id: str | None = None,
        pet_id: str | None = None,
    ) -> None:
        """Initialize."""
        self.manager = manager
        self._person_id = person_id
        self._pet_id = pet_id
        self._attr_translation_key = key
        entry = manager.entry
        if pet_id is not None:
            name = manager.pets[pet_id][CONF_NAME]
            self._attr_unique_id = f"{entry.entry_id}_pet_{pet_id}_{key}"
            self._attr_device_info = DeviceInfo(
                identifiers={(DOMAIN, f"{entry.entry_id}_pet_{pet_id}")},
                name=name,
                manufacturer="Weight Tracker",
                model="Haustier",
                entry_type=DeviceEntryType.SERVICE,
                via_device=(DOMAIN, entry.entry_id),
            )
            object_id = f"{slugify(name)}_{key}"
        elif person_id is None:
            self._attr_unique_id = f"{entry.entry_id}_{key}"
            self._attr_device_info = hub_device_info(entry)
            object_id = f"{slugify(entry.title)}_{key}"
        else:
            name = manager.persons[person_id][CONF_NAME]
            self._attr_unique_id = f"{entry.entry_id}_{person_id}_{key}"
            self._attr_device_info = DeviceInfo(
                identifiers={(DOMAIN, f"{entry.entry_id}_{person_id}")},
                name=name,
                manufacturer="Weight Tracker",
                model="Person",
                entry_type=DeviceEntryType.SERVICE,
                via_device=(DOMAIN, entry.entry_id),
            )
            object_id = f"{slugify(name)}_{key}"
        # Predictable entity ids (e.g. sensor.anna_weight) independent of the
        # UI language, so the example dashboard works out of the box.
        self.entity_id = f"{platform}.{object_id}"

    async def async_added_to_hass(self) -> None:
        """Subscribe to updates."""
        await super().async_added_to_hass()
        self.async_on_remove(self.manager.async_add_listener(self.async_write_ha_state))
