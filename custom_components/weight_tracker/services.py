"""Actions of Weight Tracker (with permission checks per user)."""

from __future__ import annotations

from typing import TYPE_CHECKING

import voluptuous as vol

from homeassistant.auth.models import User
from homeassistant.core import HomeAssistant, ServiceCall, callback
from homeassistant.exceptions import ServiceValidationError, Unauthorized
from homeassistant.helpers import config_validation as cv
from homeassistant.util import dt as dt_util

from .access import can_manage, is_unrestricted
from .panel import active_entries
from .const import (
    DISCARD_OPTION,
    DOMAIN,
    PENDING_OPTION,
    STATUS_ASSIGNED,
    STATUS_PENDING,
)

if TYPE_CHECKING:
    from .manager import Measurement, WeightTrackerManager

ATTR_CONFIG_ENTRY_ID = "config_entry_id"
ATTR_MEASUREMENT_ID = "measurement_id"
ATTR_PERSON = "person"
ATTR_WEIGHT = "weight"
ATTR_TIMESTAMP = "timestamp"

SERVICE_ASSIGN = "assign_measurement"
SERVICE_ADD = "add_measurement"
SERVICE_DELETE = "delete_measurement"
SERVICE_WEIGH_PET = "weigh_pet"
ATTR_PET = "pet"

_BASE = {vol.Optional(ATTR_CONFIG_ENTRY_ID): cv.string}

ASSIGN_SCHEMA = vol.Schema(
    {
        **_BASE,
        vol.Optional(ATTR_MEASUREMENT_ID): cv.string,
        vol.Required(ATTR_PERSON): cv.string,
    }
)
ADD_SCHEMA = vol.Schema(
    {
        **_BASE,
        vol.Required(ATTR_PERSON): cv.string,
        vol.Required(ATTR_WEIGHT): vol.All(vol.Coerce(float), vol.Range(min=1, max=500)),
        vol.Optional(ATTR_TIMESTAMP): cv.datetime,
        vol.Optional("note"): vol.All(cv.string, vol.Length(max=200)),
    }
)
DELETE_SCHEMA = vol.Schema({**_BASE, vol.Optional(ATTR_MEASUREMENT_ID): cv.string})
WEIGH_PET_SCHEMA = vol.Schema({**_BASE, vol.Optional(ATTR_PET): cv.string})


def _manager(hass: HomeAssistant, call: ServiceCall) -> WeightTrackerManager:
    entries = active_entries(hass)
    if entry_id := call.data.get(ATTR_CONFIG_ENTRY_ID):
        entries = [entry for entry in entries if entry.entry_id == entry_id]
    if not entries:
        raise ServiceValidationError("No loaded Weight Tracker scale found")
    if len(entries) > 1:
        raise ServiceValidationError("Several scales configured, set config_entry_id")
    return entries[0].runtime_data


async def _user(hass: HomeAssistant, call: ServiceCall) -> User | None:
    """The calling user, None for internal calls (automations, scripts)."""
    if call.context.user_id is None:
        return None
    if (user := await hass.auth.async_get_user(call.context.user_id)) is None:
        raise Unauthorized(context=call.context)
    return user


def _person(manager: WeightTrackerManager, user: User | None, value: str) -> str:
    person_id = manager.find_person(value)
    # Unknown and forbidden persons look the same to non-admins (no name leak).
    if person_id is None or not can_manage(user, manager.persons[person_id]):
        if is_unrestricted(user):
            names = ", ".join(p["name"] for p in manager.persons.values())
            raise ServiceValidationError(f"Unknown person '{value}' (known: {names})")
        raise ServiceValidationError(f"Unknown person '{value}'")
    return person_id


def _measurement(
    manager: WeightTrackerManager, user: User | None, call: ServiceCall
) -> Measurement:
    """Return the measurement if the user may change it."""
    measurement_id = call.data.get(ATTR_MEASUREMENT_ID)
    measurement = manager.get_measurement(measurement_id)
    allowed = measurement is not None and (
        is_unrestricted(user)
        or (
            measurement.status == STATUS_ASSIGNED
            and measurement.person_id in manager.persons
            and can_manage(user, manager.persons[measurement.person_id])
        )
        or (
            measurement.status == STATUS_PENDING
            and manager.pending_visible_to(user, measurement)
        )
    )
    if not allowed or measurement is None:
        raise ServiceValidationError(f"Measurement '{measurement_id}' not found")
    return measurement


@callback
def async_setup_services(hass: HomeAssistant) -> None:
    """Register the actions."""

    async def assign(call: ServiceCall) -> None:
        manager = _manager(hass, call)
        user = await _user(hass, call)
        measurement = _measurement(manager, user, call)
        value = call.data[ATTR_PERSON]
        if value == PENDING_OPTION:
            manager.async_unassign(measurement)
        elif value == DISCARD_OPTION:
            # Non-admins may only throw away their own readings.
            if not is_unrestricted(user) and measurement.status != STATUS_ASSIGNED:
                raise Unauthorized(context=call.context)
            manager.async_assign(measurement, None)
        else:
            manager.async_assign(measurement, _person(manager, user, value))

    async def add(call: ServiceCall) -> None:
        manager = _manager(hass, call)
        user = await _user(hass, call)
        timestamp = call.data.get(ATTR_TIMESTAMP) or dt_util.now()
        if timestamp.tzinfo is None:
            timestamp = timestamp.replace(tzinfo=dt_util.get_default_time_zone())
        # Pets belong to the household: every user may add their weight.
        if (pet_id := manager.find_pet(call.data[ATTR_PERSON])) is not None:
            # "weighed by": the person linked to the calling user, if any
            by = next(
                (pid for pid, p in manager.persons.items() if user and p.get("user_id") == user.id),
                None,
            )
            added = manager.async_add_pet_measurement(
                pet_id, call.data[ATTR_WEIGHT], dt_util.as_utc(timestamp), by
            )
        else:
            person_id = _person(manager, user, call.data[ATTR_PERSON])
            added = manager.async_add(person_id, call.data[ATTR_WEIGHT], dt_util.as_utc(timestamp))
        if note := call.data.get("note"):
            manager.async_set_note(added, note)

    async def delete(call: ServiceCall) -> None:
        manager = _manager(hass, call)
        user = await _user(hass, call)
        measurement = _measurement(manager, user, call)
        if not is_unrestricted(user) and measurement.status != STATUS_ASSIGNED:
            raise Unauthorized(context=call.context)
        manager.async_delete(measurement)

    hass.services.async_register(DOMAIN, SERVICE_ASSIGN, assign, schema=ASSIGN_SCHEMA)
    hass.services.async_register(DOMAIN, SERVICE_ADD, add, schema=ADD_SCHEMA)
    hass.services.async_register(DOMAIN, SERVICE_DELETE, delete, schema=DELETE_SCHEMA)

    async def weigh_pet(call: ServiceCall) -> None:
        manager = _manager(hass, call)
        if not manager.pets:
            raise ServiceValidationError("No pets configured")
        pet_id = None
        if value := call.data.get(ATTR_PET):
            if (pet_id := manager.find_pet(value)) is None:
                raise ServiceValidationError(f"Unknown pet '{value}'")
        manager.async_start_pet_session(pet_id)

    hass.services.async_register(DOMAIN, SERVICE_WEIGH_PET, weigh_pet, schema=WEIGH_PET_SCHEMA)
