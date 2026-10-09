"""Sidebar panel and websocket API of Weight Tracker.

Every websocket client only receives the data its user may see (see access.py).
"""

from __future__ import annotations

from copy import deepcopy
from uuid import uuid4
from dataclasses import asdict
from datetime import date, datetime
import hashlib
import logging
from pathlib import Path
from typing import Any

import voluptuous as vol

from homeassistant.auth.models import User
from homeassistant.components import (
    frontend,
    panel_custom,
    persistent_notification,
    websocket_api,
)
from homeassistant.components.http import StaticPathConfig
from homeassistant.const import CONF_NAME
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.util import dt as dt_util

from .access import async_assignable_users, can_manage, can_view, is_unrestricted
from .settings import (
    PERSON_SCHEMA,
    PET_SCHEMA,
    PROFILE_SCHEMA,
    SETTING_DEFAULTS,
    apply_profile,
    build_pet,
    keep_personal_settings,
    valid_sensor_keys,
    SETTINGS_SCHEMA,
    build_person,
    person_name_error,
    settings_error,
)
from .const import (
    CONF_BIRTH_MONTH,
    CONF_BODY_FAT_ENTITY,
    CONF_CLOTHES,
    CONF_CLOTHES_KG,
    CONF_SENSORS,
    CONF_GOAL_WEIGHT,
    CONF_HEIGHT,
    CONF_IMPEDANCE_ENTITY,
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
    CONF_USER_ID,
    CONF_VIEWERS,
    DATA_PANEL_REGISTERED,
    DOMAIN,
    PANEL_COMPONENT,
    PET_EVENT_CATEGORIES,
    PANEL_URL_PATH,
    SIGNAL_UPDATED,
    STATIC_URL,
    STATUS_ASSIGNED,
    STATUS_PENDING,
    STATUS_PET_CANDIDATE,
)


_LOGGER = logging.getLogger(__name__)

FRONTEND_DIR = Path(__file__).parent / "frontend"
PANEL_FILE = FRONTEND_DIR / f"{PANEL_COMPONENT}.js"
CARD_FILE = FRONTEND_DIR / "weight-tracker-card.js"
BRAND_DIR = Path(__file__).parent / "brand"
BRAND_URL = "/weight_tracker_brand"
DATA_PANEL_HASH = f"{DOMAIN}_panel_hash"


def _file_hash(path: Path) -> str | None:
    """Content hash of a frontend file (cache busting), None if missing."""
    try:
        return hashlib.sha1(path.read_bytes()).hexdigest()[:10]
    except OSError:
        return None


def _panel_file_hash() -> str | None:
    return _file_hash(PANEL_FILE)


async def async_setup_frontend(hass: HomeAssistant) -> None:
    """Serve the panel code and register the websocket commands (once)."""
    websocket_api.async_register_command(hass, ws_subscribe)
    websocket_api.async_register_command(hass, ws_set_access)
    websocket_api.async_register_command(hass, ws_update_settings)
    websocket_api.async_register_command(hass, ws_save_person)
    websocket_api.async_register_command(hass, ws_delete_person)
    websocket_api.async_register_command(hass, ws_update_profile)
    websocket_api.async_register_command(hass, ws_pet_session)
    websocket_api.async_register_command(hass, ws_pet_candidate)
    websocket_api.async_register_command(hass, ws_pet_measurement)
    websocket_api.async_register_command(hass, ws_save_pet)
    websocket_api.async_register_command(hass, ws_delete_pet)
    websocket_api.async_register_command(hass, ws_notify_test)
    websocket_api.async_register_command(hass, ws_waist)
    websocket_api.async_register_command(hass, ws_set_note)
    websocket_api.async_register_command(hass, ws_import)
    websocket_api.async_register_command(hass, ws_pet_event)
    websocket_api.async_register_command(hass, ws_set_sensors)
    websocket_api.async_register_command(hass, ws_set_clothes)
    file_hash = await hass.async_add_executor_job(_panel_file_hash)
    hass.data[DATA_PANEL_HASH] = file_hash
    if file_hash is None:
        _LOGGER.error(
            "Panel file %s is missing. Copy the complete folder "
            "custom_components/weight_tracker including the subfolder 'frontend'",
            PANEL_FILE,
        )
        persistent_notification.async_create(
            hass,
            "The file `custom_components/weight_tracker/frontend/"
            f"{PANEL_COMPONENT}.js` is missing, so the sidebar panel cannot be "
            "shown. Copy the complete `weight_tracker` folder including the "
            "subfolder `frontend` and restart Home Assistant.\n\n"
            "Die Datei fehlt – bitte den kompletten Ordner `weight_tracker` "
            "inklusive Unterordner `frontend` kopieren und Home Assistant neu starten.",
            title="Weight Tracker",
            notification_id=f"{DOMAIN}_frontend_missing",
        )
        return
    if hass.http is not None:
        paths = [StaticPathConfig(STATIC_URL, str(FRONTEND_DIR), False)]
        # The icon without authentication, e.g. as entity_picture of the HACS
        # update entity (HACS still points it at the brands CDN).
        if await hass.async_add_executor_job(BRAND_DIR.is_dir):
            paths.append(StaticPathConfig(BRAND_URL, str(BRAND_DIR), True))
        await hass.http.async_register_static_paths(paths)
    # Dashboard card: loaded on every frontend page, no manual resource needed.
    if card_hash := await hass.async_add_executor_job(_file_hash, CARD_FILE):
        frontend.add_extra_js_url(hass, f"{STATIC_URL}/{CARD_FILE.name}?v={card_hash}")


async def async_register_panel(hass: HomeAssistant) -> None:
    """Add the panel to the sidebar."""
    if hass.data.get(DATA_PANEL_REGISTERED):
        return
    if not (file_hash := hass.data.get(DATA_PANEL_HASH)):
        return  # file missing, already reported in async_setup_frontend
    hass.data[DATA_PANEL_REGISTERED] = True
    german = (hass.config.language or "").startswith("de")
    await panel_custom.async_register_panel(
        hass,
        frontend_url_path=PANEL_URL_PATH,
        webcomponent_name=PANEL_COMPONENT,
        sidebar_title="Gewicht" if german else "Weight",
        sidebar_icon="mdi:scale-bathroom",
        module_url=f"{STATIC_URL}/{PANEL_COMPONENT}.js?v={file_hash}",
        require_admin=False,
        config={},
    )


@callback
def async_remove_panel(hass: HomeAssistant) -> None:
    """Remove the panel from the sidebar."""
    if hass.data.pop(DATA_PANEL_REGISTERED, False):
        frontend.async_remove_panel(hass, PANEL_URL_PATH)


def _person_sensor_ids(hass: HomeAssistant, entry_id: str) -> dict[str, dict[str, str]]:
    """Map person id -> sensor key -> current entity id (from the registry)."""
    result: dict[str, dict[str, str]] = {}
    prefix = f"{entry_id}_"
    for reg_entry in er.async_entries_for_config_entry(er.async_get(hass), entry_id):
        if reg_entry.domain != "sensor" or reg_entry.disabled_by:
            continue
        rest = reg_entry.unique_id.removeprefix(prefix)
        if rest.startswith("pet_"):
            pet_id, _, key = rest.removeprefix("pet_").partition("_")
            if key and hass.states.get(reg_entry.entity_id) is not None:
                result.setdefault(f"pet:{pet_id}", {})[key] = reg_entry.entity_id
            continue
        person_id, _, key = rest.partition("_")
        if key and hass.states.get(reg_entry.entity_id) is not None:
            result.setdefault(person_id, {})[key] = reg_entry.entity_id
    return result


def _person_picture(hass: HomeAssistant, person: dict[str, Any]) -> str | None:
    """Picture of the Home Assistant person behind a tracked person.

    The person entity chosen for presence, otherwise the person entity of the
    linked Home Assistant user.
    """
    entity_id = person.get(CONF_PERSON_ENTITY)
    if entity_id and entity_id.startswith("person.") and (state := hass.states.get(entity_id)):
        if picture := state.attributes.get("entity_picture"):
            return picture
    if user_id := person.get(CONF_USER_ID):
        for state in hass.states.async_all("person"):
            if state.attributes.get("user_id") == user_id and (picture := state.attributes.get("entity_picture")):
                return picture
    return None


def _jsonable(value: Any) -> Any:
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    return value


def active_entries(hass: HomeAssistant) -> list[Any]:
    """Entries whose manager is running (also during the end of a setup)."""
    return [
        entry
        for entry in hass.config_entries.async_entries(DOMAIN)
        if getattr(getattr(entry, "runtime_data", None), "active", False)
    ]


async def _snapshot(hass: HomeAssistant, user: User) -> dict[str, Any]:
    """All data the panel may show to this user."""
    admin = is_unrestricted(user)
    entries = []
    for entry in active_entries(hass):
        manager = entry.runtime_data
        sensor_ids = _person_sensor_ids(hass, entry.entry_id)
        persons = []
        visible: set[str] = set()
        for index, (person_id, person) in enumerate(manager.persons.items()):
            if not can_view(user, person):
                continue
            visible.add(person_id)
            stats = manager.stats.get(person_id)
            data = {
                "id": person_id,
                "name": person[CONF_NAME],
                # stable color for everybody, independent of what a user can see
                "color_index": index,
                "can_manage": can_manage(user, person),
                "is_me": person.get(CONF_USER_ID) == user.id,
                "start_weight": person.get(CONF_START_WEIGHT),
                "height": person.get(CONF_HEIGHT),
                "goal": person.get(CONF_GOAL_WEIGHT),
                "birth_month": person.get(CONF_BIRTH_MONTH),
                "picture": _person_picture(hass, person),
                "sex": person.get(CONF_SEX),
                # only present if the scale provides impedance / body fat
                "body": manager.body.get(person_id),
                "waist": [
                    {"id": w.id, "ts": int(w.ts.timestamp() * 1000), "cm": w.cm}
                    for w in manager.waist
                    if w.person_id == person_id
                ],
                # entity ids of the person's sensors (for HA's more-info dialog)
                "entities": sensor_ids.get(person_id, {}),
                "stats": {k: _jsonable(v) for k, v in asdict(stats).items()} if stats else {},
            }
            if data["can_manage"]:
                learned, samples = manager.clothes_estimate(person_id)
                data["clothes"] = {
                    "enabled": bool(person.get(CONF_CLOTHES, False)),
                    "start": person.get(CONF_CLOTHES_KG, 0.8),
                    "learned": learned,
                    "samples": samples,
                }
                data["notify"] = {
                    "service": person.get(CONF_NOTIFY_SERVICE),
                    "weigh": person.get(CONF_NOTIFY_WEIGH, False),
                    "pet_warnings": person.get(CONF_NOTIFY_PET_WARNINGS, False),
                    "reminder_days": person.get(CONF_REMINDER_DAYS, 0),
                }
            if admin:
                data["user_id"] = person.get(CONF_USER_ID)
                data["viewers"] = person.get(CONF_VIEWERS, [])
                data["sensors"] = person.get(CONF_SENSORS, [])
                data["person_entity"] = person.get(CONF_PERSON_ENTITY)
            persons.append(data)

        measurements = []
        for m in manager.measurements:
            extra: dict[str, Any] = {}
            if m.status == STATUS_PET_CANDIDATE:
                # Suggestion "was that a pet weighing?": only for whoever may
                # manage the person of the "alone" reading.
                alone = manager.candidate_pair(m)
                owner = manager.persons.get(alone.person_id) if alone and alone.person_id else None
                if alone is None or owner is None or not can_manage(user, owner):
                    continue
                extra = {
                    "pet_id": m.pet_id,
                    "pet_weight": round(m.weight - alone.weight, 2),
                    "pair_person_id": alone.person_id,
                }
            elif not admin:
                if m.status == STATUS_ASSIGNED:
                    if m.person_id not in visible:
                        continue
                elif m.status == STATUS_PENDING:
                    if not manager.pending_visible_to(user, m):
                        continue
                else:
                    continue
            elif m.status not in (STATUS_ASSIGNED, STATUS_PENDING, "discarded"):
                continue  # readings "with pet" are part of the pet measurement
            measurements.append(
                {
                    "id": m.id,
                    "ts": int(m.ts.timestamp() * 1000),
                    "weight": m.weight,
                    "person_id": m.person_id,
                    "status": m.status,
                    "method": m.method,
                    "trend": manager.trend_by_id.get(m.id),
                    "note": m.note,
                    "clothes_kg": m.clothes_kg,
                    **extra,
                }
            )

        # Pets belong to the household: everybody with panel access sees them.
        pets = []
        for index, (pet_id, pet) in enumerate(manager.pets.items()):
            stats = manager.pet_stats.get(pet_id)
            pet_data = {
                "id": pet_id,
                "name": pet[CONF_NAME],
                "species": pet.get(CONF_SPECIES, "other"),
                "kind": pet.get("kind", "pet"),
                "sex": pet.get(CONF_SEX),
                "birth_date": pet.get("birth_date"),
                "growth": manager.growth.get(pet_id),
                "color_index": len(manager.persons) + index,
                "start_weight": pet.get(CONF_START_WEIGHT),
                "goal": pet.get(CONF_GOAL_WEIGHT),
                "birth_month": pet.get(CONF_BIRTH_MONTH),
                "entities": sensor_ids.get(f"pet:{pet_id}", {}),
                "warning": (
                    {"code": manager.pet_warnings[pet_id][0], "percent": manager.pet_warnings[pet_id][1]}
                    if pet_id in manager.pet_warnings
                    else None
                ),
                "events": [
                    {"id": e.id, "ts": int(e.ts.timestamp() * 1000), "category": e.category, "text": e.text}
                    for e in manager.pet_events
                    if e.pet_id == pet_id
                ],
                "stats": {k: _jsonable(v) for k, v in asdict(stats).items()} if stats else {},
            }
            if admin:
                pet_data["sensors"] = pet.get(CONF_SENSORS, [])
            pets.append(pet_data)
        pet_measurements = []
        for m in manager.pet_measurements:
            carrier = manager.persons.get(m.by_person_id) if m.by_person_id else None
            # Who weighed the pet is always shown (only the name, never their weight).
            pet_measurements.append(
                {
                    "id": m.id,
                    "ts": int(m.ts.timestamp() * 1000),
                    "weight": m.weight,
                    "pet_id": m.pet_id,
                    "method": m.method,
                    "trend": manager.trend_by_id.get(m.id),
                    "note": m.note,
                    # who carried the pet, only if that person is visible
                    "by": carrier[CONF_NAME] if carrier else None,
                    "can_edit": admin or bool(carrier and can_manage(user, carrier)),
                }
            )
        session = manager.pet_session
        pet_session = None
        if session is not None:
            pet_session = {
                "pet_id": session.pet_id,
                "expires": int(session.expires.timestamp() * 1000),
                "readings": len(session.readings),
            }
        entry_data: dict[str, Any] = {
            "entry_id": entry.entry_id,
            "title": entry.title,
            "persons": persons,
            "measurements": measurements,
            "pets": pets,
            "pet_measurements": pet_measurements,
            "pet_session": pet_session,
        }
        if admin:
            entry_data["settings"] = {
                CONF_SOURCE: entry.options.get(CONF_SOURCE),
                CONF_IMPEDANCE_ENTITY: entry.options.get(CONF_IMPEDANCE_ENTITY) or None,
                CONF_BODY_FAT_ENTITY: entry.options.get(CONF_BODY_FAT_ENTITY) or None,
                **{k: entry.options.get(k, v) for k, v in SETTING_DEFAULTS.items()},
            }
        entries.append(entry_data)

    users = []
    if admin:
        users = [
            {"id": u.id, "name": u.name or u.id, "is_admin": u.is_admin}
            for u in await async_assignable_users(hass)
        ]
    return {
        "user": {"id": user.id, "name": user.name, "is_admin": user.is_admin},
        "users": users,
        "entries": entries,
    }


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/subscribe"})
@callback
def ws_subscribe(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """Send the user's data now and again after every change."""

    async def send() -> None:
        snapshot = await _snapshot(hass, connection.user)
        connection.send_message(websocket_api.event_message(msg["id"], snapshot))

    @callback
    def forward() -> None:
        hass.async_create_task(send())

    connection.subscriptions[msg["id"]] = async_dispatcher_connect(
        hass, SIGNAL_UPDATED, forward
    )
    connection.send_result(msg["id"])
    forward()


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/set_access",
        vol.Required("entry_id"): str,
        vol.Required("person_id"): str,
        vol.Optional("user_id"): vol.Any(None, str),
        vol.Optional("viewers"): [str],
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_set_access(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """Change who is linked to / may see a person (admins only)."""
    if (entry := _admin_entry(hass, connection, msg)) is None:
        return
    known_users = {u.id for u in await async_assignable_users(hass)}
    options = deepcopy(dict(entry.options))
    person = next(
        (p for p in options[CONF_PERSONS] if p[CONF_PERSON_ID] == msg["person_id"]), None
    )
    if person is None:
        connection.send_error(msg["id"], websocket_api.ERR_NOT_FOUND, "Person not found")
        return

    if "user_id" in msg:
        if msg["user_id"] is None:
            person.pop(CONF_USER_ID, None)
        elif msg["user_id"] in known_users:
            person[CONF_USER_ID] = msg["user_id"]
        else:
            connection.send_error(msg["id"], websocket_api.ERR_INVALID_FORMAT, "Unknown user")
            return
    if "viewers" in msg:
        person[CONF_VIEWERS] = sorted(
            {u for u in msg["viewers"] if u in known_users and u != person.get(CONF_USER_ID)}
        )

    # Triggers a reload of the entry, which pushes fresh data to all panels.
    hass.config_entries.async_update_entry(entry, options=options)
    connection.send_result(msg["id"])


def _admin_entry(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> Any | None:
    entry = hass.config_entries.async_get_entry(msg["entry_id"])
    if entry is None or entry.domain != DOMAIN:
        connection.send_error(msg["id"], websocket_api.ERR_NOT_FOUND, "Scale not found")
        return None
    return entry


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/update_settings",
        vol.Required("entry_id"): str,
        vol.Required("settings"): dict,
    }
)
@websocket_api.require_admin
@callback
def ws_update_settings(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """Change the scale settings (admins only)."""
    if (entry := _admin_entry(hass, connection, msg)) is None:
        return
    try:
        settings = SETTINGS_SCHEMA(msg["settings"])
    except vol.Invalid as err:
        connection.send_error(msg["id"], websocket_api.ERR_INVALID_FORMAT, str(err))
        return
    if error := settings_error(settings):
        connection.send_error(msg["id"], error, error)
        return
    title = settings.pop(CONF_NAME, None)
    options = {**entry.options, **settings}
    if title and title != entry.title:
        hass.config_entries.async_update_entry(entry, title=title, options=options)
    else:
        hass.config_entries.async_update_entry(entry, options=options)
    connection.send_result(msg["id"])


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/save_person",
        vol.Required("entry_id"): str,
        vol.Required("person"): dict,
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_save_person(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """Create or update a person (admins only)."""
    if (entry := _admin_entry(hass, connection, msg)) is None:
        return
    try:
        data = PERSON_SCHEMA(msg["person"])
    except vol.Invalid as err:
        connection.send_error(msg["id"], websocket_api.ERR_INVALID_FORMAT, str(err))
        return
    options = deepcopy(dict(entry.options))
    persons: list[dict[str, Any]] = options.setdefault(CONF_PERSONS, [])
    person_id = data.get(CONF_PERSON_ID)
    index = next(
        (i for i, p in enumerate(persons) if p[CONF_PERSON_ID] == person_id), None
    )
    if person_id and index is None:
        connection.send_error(msg["id"], websocket_api.ERR_NOT_FOUND, "Person not found")
        return
    if error := person_name_error(
        data[CONF_NAME], persons + options.get(CONF_PETS, []), exclude_id=person_id
    ):
        connection.send_error(msg["id"], error, error)
        return
    service = data.get(CONF_NOTIFY_SERVICE)
    if service and not hass.services.has_service("notify", service):
        connection.send_error(msg["id"], "unknown_service", "Unknown notify service")
        return
    known_users = {u.id for u in await async_assignable_users(hass)}
    if index is None:
        person_id = uuid4().hex[:8]
        persons.append(build_person(data, person_id, known_users))
    else:
        persons[index] = keep_personal_settings(
            build_person(data, person_id, known_users), persons[index]
        )
    hass.config_entries.async_update_entry(entry, options=options)
    connection.send_result(msg["id"], {"person_id": person_id})


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/delete_person",
        vol.Required("entry_id"): str,
        vol.Required("person_id"): str,
    }
)
@websocket_api.require_admin
@callback
def ws_delete_person(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """Remove a person and all of their measurements (admins only)."""
    if (entry := _admin_entry(hass, connection, msg)) is None:
        return
    options = deepcopy(dict(entry.options))
    persons = options.get(CONF_PERSONS, [])
    remaining = [p for p in persons if p[CONF_PERSON_ID] != msg["person_id"]]
    if len(remaining) == len(persons):
        connection.send_error(msg["id"], websocket_api.ERR_NOT_FOUND, "Person not found")
        return
    deleted = 0
    if getattr(getattr(entry, "runtime_data", None), "active", False):
        deleted = entry.runtime_data.async_delete_person_data(msg["person_id"])
    options[CONF_PERSONS] = remaining
    hass.config_entries.async_update_entry(entry, options=options)
    connection.send_result(msg["id"], {"deleted_measurements": deleted})


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/update_profile",
        vol.Required("entry_id"): str,
        vol.Required("person_id"): str,
        vol.Required("profile"): dict,
    }
)
@callback
def ws_update_profile(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """Let a person change their own height, goal and birth date (admins: anyone)."""
    entry = hass.config_entries.async_get_entry(msg["entry_id"])
    options = deepcopy(dict(entry.options)) if entry and entry.domain == DOMAIN else {}
    person = next(
        (p for p in options.get(CONF_PERSONS, []) if p[CONF_PERSON_ID] == msg["person_id"]),
        None,
    )
    # Unknown and foreign persons give the same answer (no information leak).
    if entry is None or person is None or not can_manage(connection.user, person):
        connection.send_error(msg["id"], websocket_api.ERR_NOT_FOUND, "Person not found")
        return
    try:
        profile = PROFILE_SCHEMA(msg["profile"])
    except vol.Invalid as err:
        connection.send_error(msg["id"], websocket_api.ERR_INVALID_FORMAT, str(err))
        return
    apply_profile(person, profile)
    hass.config_entries.async_update_entry(entry, options=options)
    connection.send_result(msg["id"])


def _entry_manager(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> Any | None:
    """The running manager of the requested scale (any user)."""
    entry = hass.config_entries.async_get_entry(msg["entry_id"])
    manager = getattr(entry, "runtime_data", None) if entry and entry.domain == DOMAIN else None
    if manager is None or not getattr(manager, "active", False):
        connection.send_error(msg["id"], websocket_api.ERR_NOT_FOUND, "Scale not found")
        return None
    return manager


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/pet_session",
        vol.Required("entry_id"): str,
        vol.Required("action"): vol.In(["start", "cancel"]),
        vol.Optional("pet_id"): vol.Any(None, str),
    }
)
@callback
def ws_pet_session(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """Start or cancel a pet weighing (every user: pets belong to the household)."""
    if (manager := _entry_manager(hass, connection, msg)) is None:
        return
    if msg["action"] == "cancel":
        manager.async_cancel_pet_session()
    else:
        pet_id = msg.get("pet_id")
        if not manager.pets or (pet_id and pet_id not in manager.pets):
            connection.send_error(msg["id"], websocket_api.ERR_NOT_FOUND, "Pet not found")
            return
        manager.async_start_pet_session(pet_id)
    connection.send_result(msg["id"])


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/pet_candidate",
        vol.Required("entry_id"): str,
        vol.Required("measurement_id"): str,
        vol.Required("action"): vol.In(["confirm", "reject"]),
        vol.Optional("pet_id"): vol.Any(None, str),
    }
)
@callback
def ws_pet_candidate(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """Confirm or reject a suggested pet weighing."""
    if (manager := _entry_manager(hass, connection, msg)) is None:
        return
    candidate = manager.get_measurement(msg["measurement_id"])
    alone = manager.candidate_pair(candidate) if candidate else None
    owner = manager.persons.get(alone.person_id) if alone and alone.person_id else None
    if (
        candidate is None
        or candidate.status != STATUS_PET_CANDIDATE
        or owner is None
        or not can_manage(connection.user, owner)
    ):
        connection.send_error(msg["id"], websocket_api.ERR_NOT_FOUND, "Measurement not found")
        return
    if msg["action"] == "reject":
        manager.async_reject_pet_candidate(candidate)
    else:
        pet_id = msg.get("pet_id")
        if pet_id and pet_id not in manager.pets:
            connection.send_error(msg["id"], websocket_api.ERR_NOT_FOUND, "Pet not found")
            return
        manager.async_confirm_pet_candidate(candidate, pet_id)
    connection.send_result(msg["id"])


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/pet_measurement",
        vol.Required("entry_id"): str,
        vol.Required("measurement_id"): str,
        vol.Required("action"): vol.In(["delete", "assign"]),
        vol.Optional("pet_id"): str,
    }
)
@callback
def ws_pet_measurement(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """Delete a pet measurement or move it to another pet (admin or carrier)."""
    if (manager := _entry_manager(hass, connection, msg)) is None:
        return
    measurement = manager.get_pet_measurement(msg["measurement_id"])
    carrier = (
        manager.persons.get(measurement.by_person_id)
        if measurement and measurement.by_person_id
        else None
    )
    allowed = is_unrestricted(connection.user) or (
        carrier is not None and can_manage(connection.user, carrier)
    )
    if measurement is None or not allowed:
        connection.send_error(msg["id"], websocket_api.ERR_NOT_FOUND, "Measurement not found")
        return
    if msg["action"] == "delete":
        manager.async_delete_pet_measurement(measurement)
    else:
        if msg.get("pet_id") not in manager.pets:
            connection.send_error(msg["id"], websocket_api.ERR_NOT_FOUND, "Pet not found")
            return
        manager.async_assign_pet_measurement(measurement, msg["pet_id"])
    connection.send_result(msg["id"])


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/save_pet",
        vol.Required("entry_id"): str,
        vol.Required("pet"): dict,
    }
)
@websocket_api.require_admin
@callback
def ws_save_pet(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """Create or update a pet (admins only)."""
    if (entry := _admin_entry(hass, connection, msg)) is None:
        return
    try:
        data = PET_SCHEMA(msg["pet"])
    except vol.Invalid as err:
        connection.send_error(msg["id"], websocket_api.ERR_INVALID_FORMAT, str(err))
        return
    options = deepcopy(dict(entry.options))
    pets: list[dict[str, Any]] = options.setdefault(CONF_PETS, [])
    pet_id = data.get(CONF_PET_ID)
    index = next((i for i, p in enumerate(pets) if p[CONF_PET_ID] == pet_id), None)
    if pet_id and index is None:
        connection.send_error(msg["id"], websocket_api.ERR_NOT_FOUND, "Pet not found")
        return
    if error := person_name_error(
        data[CONF_NAME], options.get(CONF_PERSONS, []) + pets, exclude_id=pet_id
    ):
        connection.send_error(msg["id"], error, error)
        return
    if index is None:
        pet_id = uuid4().hex[:8]
        pets.append(build_pet(data, pet_id))
    else:
        sensors = pets[index].get(CONF_SENSORS)
        pets[index] = build_pet(data, pet_id)
        if sensors is not None:
            pets[index][CONF_SENSORS] = sensors
    hass.config_entries.async_update_entry(entry, options=options)
    connection.send_result(msg["id"], {"pet_id": pet_id})


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/delete_pet",
        vol.Required("entry_id"): str,
        vol.Required("pet_id"): str,
    }
)
@websocket_api.require_admin
@callback
def ws_delete_pet(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """Remove a pet and its measurements (admins only)."""
    if (entry := _admin_entry(hass, connection, msg)) is None:
        return
    options = deepcopy(dict(entry.options))
    pets = options.get(CONF_PETS, [])
    remaining = [p for p in pets if p[CONF_PET_ID] != msg["pet_id"]]
    if len(remaining) == len(pets):
        connection.send_error(msg["id"], websocket_api.ERR_NOT_FOUND, "Pet not found")
        return
    deleted = 0
    if getattr(getattr(entry, "runtime_data", None), "active", False):
        deleted = entry.runtime_data.async_delete_pet_data(msg["pet_id"])
    options[CONF_PETS] = remaining
    hass.config_entries.async_update_entry(entry, options=options)
    connection.send_result(msg["id"], {"deleted_measurements": deleted})


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/notify_test",
        vol.Required("entry_id"): str,
        vol.Required("person_id"): str,
        vol.Optional("service"): vol.Match(r"^[a-z0-9_]+$"),
    }
)
@callback
def ws_notify_test(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """Send a test notification (to set up one's own notifications)."""
    if (manager := _entry_manager(hass, connection, msg)) is None:
        return
    person = manager.persons.get(msg["person_id"])
    if person is None or not can_manage(connection.user, person):
        connection.send_error(msg["id"], websocket_api.ERR_NOT_FOUND, "Person not found")
        return
    # Only admins choose devices; everybody else tests the one set for them.
    service = msg.get("service") if is_unrestricted(connection.user) else None
    service = service or person.get(CONF_NOTIFY_SERVICE)
    if not service or not hass.services.has_service("notify", service):
        connection.send_error(msg["id"], "unknown_service", "Unknown notify service")
        return
    manager.async_send_test(service)
    connection.send_result(msg["id"])


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/waist",
        vol.Required("entry_id"): str,
        vol.Required("action"): vol.In(["add", "delete"]),
        vol.Optional("person_id"): str,
        vol.Optional("cm"): vol.All(vol.Coerce(float), vol.Range(min=30, max=250)),
        vol.Optional("waist_id"): str,
    }
)
@callback
def ws_waist(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """Add or delete a waist circumference (the person itself or an admin)."""
    if (manager := _entry_manager(hass, connection, msg)) is None:
        return
    if msg["action"] == "add":
        person = manager.persons.get(msg.get("person_id", ""))
        if person is None or "cm" not in msg or not can_manage(connection.user, person):
            connection.send_error(msg["id"], websocket_api.ERR_NOT_FOUND, "Person not found")
            return
        manager.async_add_waist(msg["person_id"], msg["cm"], dt_util.utcnow())
    else:
        entry = manager.get_waist(msg.get("waist_id", ""))
        person = manager.persons.get(entry.person_id) if entry else None
        if entry is None or person is None or not can_manage(connection.user, person):
            connection.send_error(msg["id"], websocket_api.ERR_NOT_FOUND, "Not found")
            return
        manager.async_delete_waist(entry)
    connection.send_result(msg["id"])


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/set_note",
        vol.Required("entry_id"): str,
        vol.Required("measurement_id"): str,
        vol.Required("kind"): vol.In(["person", "pet"]),
        vol.Optional("note"): vol.Any(None, vol.All(str, vol.Length(max=200))),
    }
)
@callback
def ws_set_note(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """Note on a measurement. Pets: everybody; persons: the person itself or admins."""
    if (manager := _entry_manager(hass, connection, msg)) is None:
        return
    if msg["kind"] == "pet":
        measurement = manager.get_pet_measurement(msg["measurement_id"])
        allowed = measurement is not None
    else:
        measurement = manager.get_measurement(msg["measurement_id"])
        person = (
            manager.persons.get(measurement.person_id)
            if measurement and measurement.status == STATUS_ASSIGNED and measurement.person_id
            else None
        )
        allowed = is_unrestricted(connection.user) or (
            person is not None and can_manage(connection.user, person)
        )
    if measurement is None or not allowed:
        connection.send_error(msg["id"], websocket_api.ERR_NOT_FOUND, "Measurement not found")
        return
    manager.async_set_note(measurement, msg.get("note"))
    connection.send_result(msg["id"])


IMPORT_ROW = vol.Schema(
    {
        vol.Required("ts"): vol.All(vol.Coerce(int), vol.Range(min=0)),  # ms since epoch
        vol.Required("weight"): vol.All(vol.Coerce(float), vol.Range(min=0.1, max=500)),
        vol.Optional("body_fat"): vol.Any(None, vol.All(vol.Coerce(float), vol.Range(min=1, max=75))),
        vol.Optional("note"): vol.Any(None, vol.All(str, vol.Length(max=200))),
    }
)


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/import",
        vol.Required("entry_id"): str,
        vol.Exclusive("person_id", "target"): str,
        vol.Exclusive("pet_id", "target"): str,
        vol.Required("rows"): vol.All([IMPORT_ROW], vol.Length(min=1, max=2000)),
    }
)
@callback
def ws_import(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """Import measurements (CSV parsed in the panel). Persons: own/admin; pets: everybody."""
    if (manager := _entry_manager(hass, connection, msg)) is None:
        return
    person_id, pet_id = msg.get("person_id"), msg.get("pet_id")
    if pet_id is not None:
        allowed = pet_id in manager.pets
    else:
        person = manager.persons.get(person_id or "")
        allowed = person is not None and can_manage(connection.user, person)
    if not allowed:
        connection.send_error(msg["id"], websocket_api.ERR_NOT_FOUND, "Not found")
        return
    rows = [
        {**row, "ts": dt_util.utc_from_timestamp(row["ts"] / 1000)}
        for row in msg["rows"]
    ]
    added, skipped = manager.async_import(rows, person_id=person_id, pet_id=pet_id)
    connection.send_result(msg["id"], {"added": added, "skipped": skipped})


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/pet_event",
        vol.Required("entry_id"): str,
        vol.Required("action"): vol.In(["add", "delete"]),
        vol.Optional("pet_id"): str,
        vol.Optional("ts"): vol.All(vol.Coerce(int), vol.Range(min=0)),
        vol.Optional("category"): vol.In(PET_EVENT_CATEGORIES),
        vol.Optional("text"): vol.All(str, vol.Length(min=1, max=300)),
        vol.Optional("event_id"): str,
    }
)
@callback
def ws_pet_event(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """Vet visits, vaccinations, food changes … (every user: pets belong to the household)."""
    if (manager := _entry_manager(hass, connection, msg)) is None:
        return
    if msg["action"] == "add":
        if msg.get("pet_id") not in manager.pets or not msg.get("text"):
            connection.send_error(msg["id"], websocket_api.ERR_NOT_FOUND, "Pet not found")
            return
        ts = dt_util.utc_from_timestamp(msg["ts"] / 1000) if "ts" in msg else dt_util.utcnow()
        manager.async_add_pet_event(msg["pet_id"], ts, msg.get("category", "other"), msg["text"])
    elif not manager.async_delete_pet_event(msg.get("event_id", "")):
        connection.send_error(msg["id"], websocket_api.ERR_NOT_FOUND, "Not found")
        return
    connection.send_result(msg["id"])


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/set_sensors",
        vol.Required("entry_id"): str,
        vol.Required("kind"): vol.In(["person", "pet"]),
        vol.Required("id"): str,
        vol.Required("sensors"): [str],
    }
)
@websocket_api.require_admin
@callback
def ws_set_sensors(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """Choose which sensors exist for a person, pet or child (admins only)."""
    if (entry := _admin_entry(hass, connection, msg)) is None:
        return
    allowed = set(valid_sensor_keys(msg["kind"]))
    options = deepcopy(dict(entry.options))
    key, id_key = (CONF_PERSONS, CONF_PERSON_ID) if msg["kind"] == "person" else (CONF_PETS, CONF_PET_ID)
    subject = next((s for s in options.get(key, []) if s[id_key] == msg["id"]), None)
    if subject is None:
        connection.send_error(msg["id"], websocket_api.ERR_NOT_FOUND, "Not found")
        return
    subject[CONF_SENSORS] = [k for k in valid_sensor_keys(msg["kind"]) if k in set(msg["sensors"]) & allowed]
    hass.config_entries.async_update_entry(entry, options=options)
    connection.send_result(msg["id"])


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/set_clothes",
        vol.Required("entry_id"): str,
        vol.Required("measurement_id"): str,
        vol.Required("clothes"): bool,
    }
)
@callback
def ws_set_clothes(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """Mark a measurement as weighed with clothes (the person itself or an admin)."""
    if (manager := _entry_manager(hass, connection, msg)) is None:
        return
    measurement = manager.get_measurement(msg["measurement_id"])
    person = (
        manager.persons.get(measurement.person_id)
        if measurement and measurement.status == STATUS_ASSIGNED and measurement.person_id
        else None
    )
    if person is None or not can_manage(connection.user, person):
        connection.send_error(msg["id"], websocket_api.ERR_NOT_FOUND, "Measurement not found")
        return
    manager.async_set_clothes(measurement, msg["clothes"])
    connection.send_result(msg["id"])
