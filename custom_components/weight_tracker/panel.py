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
from homeassistant.helpers.dispatcher import async_dispatcher_connect

from .access import async_assignable_users, can_manage, can_view, is_unrestricted
from .settings import (
    PERSON_SCHEMA,
    SETTING_DEFAULTS,
    SETTINGS_SCHEMA,
    build_person,
    person_name_error,
    settings_error,
)
from .const import (
    CONF_CREATE_SENSORS,
    CONF_GOAL_WEIGHT,
    CONF_HEIGHT,
    CONF_PERSON_ENTITY,
    CONF_PERSON_ID,
    CONF_PERSONS,
    CONF_SOURCE,
    CONF_START_WEIGHT,
    CONF_USER_ID,
    CONF_VIEWERS,
    DATA_PANEL_REGISTERED,
    DOMAIN,
    PANEL_COMPONENT,
    PANEL_URL_PATH,
    SIGNAL_UPDATED,
    STATIC_URL,
    STATUS_ASSIGNED,
    STATUS_PENDING,
)


_LOGGER = logging.getLogger(__name__)

FRONTEND_DIR = Path(__file__).parent / "frontend"
PANEL_FILE = FRONTEND_DIR / f"{PANEL_COMPONENT}.js"
DATA_PANEL_HASH = f"{DOMAIN}_panel_hash"


def _panel_file_hash() -> str | None:
    """Content hash of the panel code (cache busting), None if missing."""
    try:
        return hashlib.sha1(PANEL_FILE.read_bytes()).hexdigest()[:10]
    except OSError:
        return None


async def async_setup_frontend(hass: HomeAssistant) -> None:
    """Serve the panel code and register the websocket commands (once)."""
    websocket_api.async_register_command(hass, ws_subscribe)
    websocket_api.async_register_command(hass, ws_set_access)
    websocket_api.async_register_command(hass, ws_update_settings)
    websocket_api.async_register_command(hass, ws_save_person)
    websocket_api.async_register_command(hass, ws_delete_person)
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
        await hass.http.async_register_static_paths(
            [StaticPathConfig(STATIC_URL, str(FRONTEND_DIR), False)]
        )


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
                "stats": {k: _jsonable(v) for k, v in asdict(stats).items()} if stats else {},
            }
            if admin:
                data["user_id"] = person.get(CONF_USER_ID)
                data["viewers"] = person.get(CONF_VIEWERS, [])
                data["create_sensors"] = person.get(CONF_CREATE_SENSORS, False)
                data["person_entity"] = person.get(CONF_PERSON_ENTITY)
            persons.append(data)

        measurements = []
        for m in manager.measurements:
            if not admin:
                if m.status == STATUS_ASSIGNED:
                    if m.person_id not in visible:
                        continue
                elif m.status == STATUS_PENDING:
                    if not manager.pending_visible_to(user, m):
                        continue
                else:
                    continue
            measurements.append(
                {
                    "id": m.id,
                    "ts": int(m.ts.timestamp() * 1000),
                    "weight": m.weight,
                    "person_id": m.person_id,
                    "status": m.status,
                    "method": m.method,
                    "trend": manager.trend_by_id.get(m.id),
                }
            )
        entry_data: dict[str, Any] = {
            "entry_id": entry.entry_id,
            "title": entry.title,
            "persons": persons,
            "measurements": measurements,
        }
        if admin:
            entry_data["settings"] = {
                CONF_SOURCE: entry.options.get(CONF_SOURCE),
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
        vol.Optional("create_sensors"): bool,
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
    if "create_sensors" in msg:
        person[CONF_CREATE_SENSORS] = msg["create_sensors"]

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
    if error := person_name_error(data[CONF_NAME], persons, exclude_id=person_id):
        connection.send_error(msg["id"], error, error)
        return
    known_users = {u.id for u in await async_assignable_users(hass)}
    if index is None:
        person_id = uuid4().hex[:8]
        persons.append(build_person(data, person_id, known_users))
    else:
        persons[index] = build_person(data, person_id, known_users)
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
