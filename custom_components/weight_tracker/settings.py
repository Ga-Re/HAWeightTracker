"""Validation and normalization of scale settings and persons.

Used by the panel's websocket API and by the config flow.
"""

from __future__ import annotations

from typing import Any

import voluptuous as vol

from homeassistant.const import CONF_NAME
from homeassistant.helpers import config_validation as cv

from .const import (
    CONF_AMBIGUITY_MARGIN,
    CONF_CREATE_SENSORS,
    CONF_DEBOUNCE,
    CONF_GOAL_WEIGHT,
    CONF_HEIGHT,
    CONF_MAX_WEIGHT,
    CONF_MIN_WEIGHT,
    CONF_PERSON_ENTITY,
    CONF_PERSON_ID,
    CONF_SOURCE,
    CONF_START_WEIGHT,
    CONF_TOLERANCE,
    CONF_USER_ID,
    CONF_VIEWERS,
    DEFAULT_AMBIGUITY_MARGIN,
    DEFAULT_DEBOUNCE,
    DEFAULT_MAX_WEIGHT,
    DEFAULT_MIN_WEIGHT,
    DEFAULT_TOLERANCE,
    DISCARD_OPTION,
    PENDING_OPTION,
)

SETTING_DEFAULTS: dict[str, Any] = {
    CONF_MIN_WEIGHT: DEFAULT_MIN_WEIGHT,
    CONF_MAX_WEIGHT: DEFAULT_MAX_WEIGHT,
    CONF_TOLERANCE: DEFAULT_TOLERANCE,
    CONF_AMBIGUITY_MARGIN: DEFAULT_AMBIGUITY_MARGIN,
    CONF_DEBOUNCE: DEFAULT_DEBOUNCE,
}


def _number(low: float, high: float) -> vol.All:
    return vol.All(vol.Coerce(float), vol.Range(min=low, max=high))


def _optional_number(low: float, high: float) -> vol.Any:
    return vol.Any(None, _number(low, high))


SETTINGS_SCHEMA = vol.Schema(
    {
        vol.Optional(CONF_NAME): vol.All(cv.string, vol.Strip, vol.Length(min=1, max=50)),
        vol.Required(CONF_SOURCE): cv.entity_domain("sensor"),
        vol.Required(CONF_MIN_WEIGHT): _number(1, 300),
        vol.Required(CONF_MAX_WEIGHT): _number(1, 500),
        vol.Required(CONF_TOLERANCE): _number(0.5, 20),
        vol.Required(CONF_AMBIGUITY_MARGIN): _number(0.1, 10),
        vol.Required(CONF_DEBOUNCE): vol.All(vol.Coerce(int), vol.Range(min=0, max=120)),
    }
)

PERSON_SCHEMA = vol.Schema(
    {
        vol.Optional(CONF_PERSON_ID): vol.Any(None, cv.string),
        vol.Required(CONF_NAME): vol.All(cv.string, vol.Strip, vol.Length(min=1, max=50)),
        vol.Required(CONF_START_WEIGHT): _number(1, 300),
        vol.Optional(CONF_HEIGHT): _optional_number(50, 250),
        vol.Optional(CONF_GOAL_WEIGHT): _optional_number(1, 300),
        vol.Optional(CONF_PERSON_ENTITY): vol.Any(
            None, "", cv.entity_domain(["person", "device_tracker"])
        ),
        vol.Optional(CONF_USER_ID): vol.Any(None, "", cv.string),
        vol.Optional(CONF_VIEWERS, default=list): [cv.string],
        vol.Optional(CONF_CREATE_SENSORS, default=False): cv.boolean,
    }
)


def settings_error(settings: dict[str, Any]) -> str | None:
    """Return an error key for invalid settings."""
    if settings[CONF_MIN_WEIGHT] >= settings[CONF_MAX_WEIGHT]:
        return "invalid_range"
    return None


def person_name_error(
    name: str, persons: list[dict[str, Any]], exclude_id: str | None = None
) -> str | None:
    """Return an error key for an invalid or duplicate person name."""
    name = name.strip()
    if not name or name.casefold() in (DISCARD_OPTION, PENDING_OPTION):
        return "invalid_name"
    if any(
        p[CONF_NAME].casefold() == name.casefold()
        for p in persons
        if p[CONF_PERSON_ID] != exclude_id
    ):
        return "name_exists"
    return None


def build_person(
    data: dict[str, Any], person_id: str, known_users: set[str] | None = None
) -> dict[str, Any]:
    """Create the stored representation of a person."""
    person: dict[str, Any] = {
        CONF_PERSON_ID: person_id,
        CONF_NAME: data[CONF_NAME].strip(),
        CONF_START_WEIGHT: float(data[CONF_START_WEIGHT]),
    }
    for key in (CONF_HEIGHT, CONF_GOAL_WEIGHT):
        if data.get(key) not in (None, ""):
            person[key] = float(data[key])
    if data.get(CONF_PERSON_ENTITY):
        person[CONF_PERSON_ENTITY] = data[CONF_PERSON_ENTITY]

    def known(user_id: str) -> bool:
        return known_users is None or user_id in known_users

    owner = data.get(CONF_USER_ID) or None
    if owner and known(owner):
        person[CONF_USER_ID] = owner
    else:
        owner = None
    person[CONF_VIEWERS] = sorted(
        {u for u in data.get(CONF_VIEWERS) or [] if known(u) and u != owner}
    )
    person[CONF_CREATE_SENSORS] = bool(data.get(CONF_CREATE_SENSORS, False))
    return person
