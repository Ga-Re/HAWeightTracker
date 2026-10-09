"""Buttons: start a pet weighing (e.g. from an NFC tag or an automation)."""

from __future__ import annotations

from homeassistant.components.button import DOMAIN as BUTTON_DOMAIN, ButtonEntity
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback

from . import WeightTrackerConfigEntry
from .entity import WeightTrackerEntity
from .manager import WeightTrackerManager


async def async_setup_entry(
    hass: HomeAssistant,
    entry: WeightTrackerConfigEntry,
    async_add_entities: AddConfigEntryEntitiesCallback,
) -> None:
    """Set up one "weigh" button per pet."""
    manager = entry.runtime_data
    async_add_entities(WeighPetButton(manager, pet_id) for pet_id in manager.pets)


class WeighPetButton(WeightTrackerEntity, ButtonEntity):
    """Pairs the next two readings: person alone and person holding the pet."""

    def __init__(self, manager: WeightTrackerManager, pet_id: str) -> None:
        """Initialize."""
        super().__init__(manager, BUTTON_DOMAIN, "weigh", pet_id=pet_id)

    async def async_press(self) -> None:
        """Start the pet weighing."""
        self.manager.async_start_pet_session(self._pet_id)
