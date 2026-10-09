"""Validation and normalization of scale settings and persons.

Used by the panel's websocket API and by the config flow.
"""

from __future__ import annotations

from datetime import date
from typing import Any

import voluptuous as vol

from homeassistant.const import CONF_NAME
from homeassistant.helpers import config_validation as cv

from .const import (
    CONF_AMBIGUITY_MARGIN,
    CONF_BIRTH_DATE,
    CONF_BIRTH_MONTH,
    CONF_CREATE_SENSORS,
    CONF_DEBOUNCE,
    CONF_GOAL_WEIGHT,
    CONF_BODY_FAT_ENTITY,
    CONF_HEIGHT,
    CONF_IMPEDANCE_ENTITY,
    CONF_KIND,
    CONF_MAX_WEIGHT,
    CONF_MIN_WEIGHT,
    CONF_NOTIFY_MILESTONES,
    CONF_NOTIFY_PET_WARNINGS,
    CONF_NOTIFY_SERVICE,
    CONF_NOTIFY_WEIGH,
    CONF_PERSON_ENTITY,
    CONF_PERSON_ID,
    CONF_PERSONS,
    CONF_PET_ID,
    CONF_PETS,
    CONF_REMINDER_DAYS,
    CONF_SEX,
    CONF_SOURCE,
    CONF_SPECIES,
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
    KIND_CHILD,
    KIND_PET,
    LEGACY_BIRTH_DATE,
    PENDING_OPTION,
    SEXES,
    SPECIES,
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


def _birth_month(value: Any) -> str | None:
    """Accept "YYYY-MM" (or empty). Month and year are enough for the age."""
    if value in (None, ""):
        return None
    try:
        year, month = (int(part) for part in str(value).split("-")[:2])
    except ValueError as err:
        raise vol.Invalid("expected YYYY-MM") from err
    today = date.today()
    if not 1 <= month <= 12 or not 1900 <= year or (year, month) > (today.year, today.month):
        raise vol.Invalid("birth month out of range")
    return f"{year:04d}-{month:02d}"


# Fields a person may change about themselves (see ws update_profile).
PROFILE_SCHEMA = vol.Schema(
    {
        vol.Optional(CONF_HEIGHT): _optional_number(50, 250),
        vol.Optional(CONF_GOAL_WEIGHT): _optional_number(1, 300),
        vol.Optional(CONF_BIRTH_MONTH): _birth_month,
        vol.Optional(CONF_NOTIFY_SERVICE): vol.Any(None, "", vol.All(cv.string, vol.Match(r"^[a-z0-9_]+$"))),
        vol.Optional(CONF_NOTIFY_WEIGH): cv.boolean,
        vol.Optional(CONF_NOTIFY_MILESTONES): cv.boolean,
        vol.Optional(CONF_NOTIFY_PET_WARNINGS): cv.boolean,
        vol.Optional(CONF_REMINDER_DAYS): vol.All(vol.Coerce(int), vol.Range(min=0, max=60)),
        vol.Optional(CONF_SEX): vol.Any(None, "", vol.In(SEXES)),
    }
)

PROFILE_KEYS = (
    CONF_HEIGHT,
    CONF_GOAL_WEIGHT,
    CONF_BIRTH_MONTH,
    CONF_NOTIFY_SERVICE,
    CONF_NOTIFY_WEIGH,
    CONF_NOTIFY_MILESTONES,
    CONF_NOTIFY_PET_WARNINGS,
    CONF_REMINDER_DAYS,
    CONF_SEX,
)


SETTINGS_SCHEMA = vol.Schema(
    {
        vol.Optional(CONF_NAME): vol.All(cv.string, vol.Strip, vol.Length(min=1, max=50)),
        vol.Required(CONF_SOURCE): cv.entity_domain("sensor"),
        vol.Required(CONF_MIN_WEIGHT): _number(1, 300),
        vol.Required(CONF_MAX_WEIGHT): _number(1, 500),
        vol.Required(CONF_TOLERANCE): _number(0.5, 20),
        vol.Required(CONF_AMBIGUITY_MARGIN): _number(0.1, 10),
        vol.Required(CONF_DEBOUNCE): vol.All(vol.Coerce(int), vol.Range(min=0, max=120)),
        vol.Optional(CONF_IMPEDANCE_ENTITY): vol.Any(None, "", cv.entity_domain("sensor")),
        vol.Optional(CONF_BODY_FAT_ENTITY): vol.Any(None, "", cv.entity_domain("sensor")),
    }
)

PERSON_SCHEMA = vol.Schema(
    {
        vol.Optional(CONF_PERSON_ID): vol.Any(None, cv.string),
        vol.Required(CONF_NAME): vol.All(cv.string, vol.Strip, vol.Length(min=1, max=50)),
        vol.Required(CONF_START_WEIGHT): _number(1, 300),
        vol.Optional(CONF_HEIGHT): _optional_number(50, 250),
        vol.Optional(CONF_GOAL_WEIGHT): _optional_number(1, 300),
        vol.Optional(CONF_BIRTH_MONTH): _birth_month,
        vol.Optional(CONF_SEX): vol.Any(None, "", vol.In(SEXES)),
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
    name: str, subjects: list[dict[str, Any]], exclude_id: str | None = None
) -> str | None:
    """Return an error key for an invalid or duplicate name.

    `subjects` are persons and pets: names must be unique across both because
    actions accept a name for either.
    """
    name = name.strip()
    if not name or name.casefold() in (DISCARD_OPTION, PENDING_OPTION):
        return "invalid_name"
    if any(
        p[CONF_NAME].casefold() == name.casefold()
        for p in subjects
        if (p.get(CONF_PERSON_ID) or p.get(CONF_PET_ID)) != exclude_id
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
    if data.get(CONF_BIRTH_MONTH):
        person[CONF_BIRTH_MONTH] = data[CONF_BIRTH_MONTH]
    if data.get(CONF_SEX):
        person[CONF_SEX] = data[CONF_SEX]
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


def keep_personal_settings(new: dict[str, Any], old: dict[str, Any]) -> dict[str, Any]:
    """Settings a person made for themselves survive an admin edit of the person."""
    for key in (CONF_NOTIFY_SERVICE, CONF_NOTIFY_WEIGH, CONF_NOTIFY_MILESTONES, CONF_NOTIFY_PET_WARNINGS, CONF_REMINDER_DAYS):
        if key in old and key not in new:
            new[key] = old[key]
    return new


def apply_profile(person: dict[str, Any], profile: dict[str, Any]) -> None:
    """Apply validated profile changes; None removes a value."""
    for key in PROFILE_KEYS:
        if key not in profile:
            continue
        if profile[key] in (None, ""):
            person.pop(key, None)
        else:
            person[key] = profile[key]


def _child_birth_date(value: Any) -> str | None:
    """Full birth date of a child (days matter for babies)."""
    if value in (None, ""):
        return None
    parsed = cv.date(value)
    if not date(1990, 1, 1) <= parsed <= date.today():
        raise vol.Invalid("birth date out of range")
    return parsed.isoformat()


PET_SCHEMA = vol.Schema(
    {
        vol.Optional(CONF_PET_ID): vol.Any(None, cv.string),
        vol.Optional(CONF_KIND, default=KIND_PET): vol.In([KIND_PET, KIND_CHILD]),
        vol.Optional(CONF_SEX): vol.Any(None, "", vol.In(SEXES)),
        vol.Optional(CONF_BIRTH_DATE): _child_birth_date,
        vol.Required(CONF_NAME): vol.All(cv.string, vol.Strip, vol.Length(min=1, max=50)),
        vol.Optional(CONF_SPECIES, default="other"): vol.In(SPECIES),
        vol.Required(CONF_START_WEIGHT): _number(0.2, 80),
        vol.Optional(CONF_GOAL_WEIGHT): _optional_number(0.2, 80),
        vol.Optional(CONF_BIRTH_MONTH): _birth_month,
        vol.Optional(CONF_CREATE_SENSORS, default=False): cv.boolean,
    }
)


def build_pet(data: dict[str, Any], pet_id: str) -> dict[str, Any]:
    """Create the stored representation of a pet."""
    pet: dict[str, Any] = {
        CONF_PET_ID: pet_id,
        CONF_NAME: data[CONF_NAME].strip(),
        CONF_SPECIES: data.get(CONF_SPECIES) or "other",
        CONF_START_WEIGHT: float(data[CONF_START_WEIGHT]),
        CONF_CREATE_SENSORS: bool(data.get(CONF_CREATE_SENSORS, False)),
    }
    if data.get(CONF_GOAL_WEIGHT) not in (None, ""):
        pet[CONF_GOAL_WEIGHT] = float(data[CONF_GOAL_WEIGHT])
    if data.get(CONF_BIRTH_MONTH):
        pet[CONF_BIRTH_MONTH] = data[CONF_BIRTH_MONTH]
    if data.get(CONF_KIND) == KIND_CHILD:
        pet[CONF_KIND] = KIND_CHILD
        pet.pop(CONF_GOAL_WEIGHT, None)  # children: percentiles instead of goals
        if data.get(CONF_SEX):
            pet[CONF_SEX] = data[CONF_SEX]
        if data.get(CONF_BIRTH_DATE):
            pet[CONF_BIRTH_DATE] = data[CONF_BIRTH_DATE]
    return pet


def migrate_options(options: dict[str, Any]) -> dict[str, Any] | None:
    """Return updated options if stored data uses an old format, else None.

    1.5.0: birth date -> birth month ("YYYY-MM"), pets list.
    """
    changed = False
    new = {**options, CONF_PERSONS: [dict(p) for p in options.get(CONF_PERSONS, [])]}
    for person in new[CONF_PERSONS]:
        if (legacy := person.pop(LEGACY_BIRTH_DATE, None)) is not None:
            changed = True
            if legacy and CONF_BIRTH_MONTH not in person:
                person[CONF_BIRTH_MONTH] = str(legacy)[:7]
    if CONF_PETS not in new:
        new[CONF_PETS] = []
        changed = True
    return new if changed else None
