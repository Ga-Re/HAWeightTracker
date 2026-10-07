"""Measurement storage, person detection and statistics."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime
import logging
from typing import Any
from uuid import uuid4

from homeassistant.components import persistent_notification
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import (
    ATTR_UNIT_OF_MEASUREMENT,
    CONF_NAME,
    STATE_HOME,
    STATE_UNAVAILABLE,
    STATE_UNKNOWN,
    UnitOfMass,
)
from homeassistant.core import (
    CALLBACK_TYPE,
    Event,
    EventStateChangedData,
    HomeAssistant,
    State,
    callback,
)
from homeassistant.helpers.dispatcher import async_dispatcher_send
from homeassistant.helpers.event import (
    async_call_later,
    async_track_state_change_event,
    async_track_time_change,
)
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util
from homeassistant.util.unit_conversion import MassConverter

from .analytics import PersonStats, Point, compute_stats, trend_series
from .const import (
    CONF_AMBIGUITY_MARGIN,
    CONF_DEBOUNCE,
    CONF_GOAL_WEIGHT,
    CONF_HEIGHT,
    CONF_MAX_WEIGHT,
    CONF_MIN_WEIGHT,
    CONF_PERSON_ENTITY,
    CONF_PERSON_ID,
    CONF_PERSONS,
    CONF_SOURCE,
    CONF_START_WEIGHT,
    CONF_TOLERANCE,
    DEFAULT_AMBIGUITY_MARGIN,
    DEFAULT_DEBOUNCE,
    DEFAULT_MAX_WEIGHT,
    DEFAULT_MIN_WEIGHT,
    DEFAULT_TOLERANCE,
    DOMAIN,
    DUPLICATE_WINDOW,
    EVENT_MEASUREMENT,
    METHOD_MANUAL,
    SAME_WEIGHT_EPSILON,
    SIGNAL_UPDATED,
    STATUS_ASSIGNED,
    STATUS_DISCARDED,
    STATUS_PENDING,
    STORAGE_VERSION,
)
from .access import UserLike, can_manage, is_unrestricted
from .detector import Candidate, Detection, allowed_deviation, detect

_LOGGER = logging.getLogger(__name__)


@dataclass
class Measurement:
    """A single reading of the scale."""

    id: str
    ts: datetime
    weight: float
    person_id: str | None
    status: str
    method: str

    def as_dict(self) -> dict[str, Any]:
        """Serialize for storage."""
        return {
            "id": self.id,
            "ts": self.ts.isoformat(),
            "weight": self.weight,
            "person_id": self.person_id,
            "status": self.status,
            "method": self.method,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Measurement:
        """Restore from storage."""
        return cls(
            id=data["id"],
            ts=dt_util.parse_datetime(data["ts"]) or dt_util.utcnow(),
            weight=float(data["weight"]),
            person_id=data.get("person_id"),
            status=data["status"],
            method=data.get("method", ""),
        )


class WeightTrackerManager:
    """Keeps the measurements of one scale and its persons."""

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        """Initialize."""
        self.hass = hass
        self.entry = entry
        self.measurements: list[Measurement] = []
        self.stats: dict[str, PersonStats] = {}
        # Trend value after each assigned measurement, for the panel chart
        self.trend_by_id: dict[str, float] = {}
        self.last_detection: Detection | None = None
        self._store: Store[dict[str, Any]] = Store(
            hass, STORAGE_VERSION, f"{DOMAIN}.{entry.entry_id}"
        )
        self._last_source: tuple[float, datetime] | None = None
        self._pending_weight: float | None = None
        self._debounce_unsub: CALLBACK_TYPE | None = None
        self._unsubs: list[CALLBACK_TYPE] = []
        self._listeners: list[Callable[[], None]] = []
        # True between async_setup and async_unload. The config entry state is
        # not usable for this: it only becomes LOADED after async_setup_entry
        # returned, i.e. after the update signal was already sent.
        self.active = False

    # ------------------------------------------------------------------ config

    @property
    def options(self) -> dict[str, Any]:
        """Return the entry options."""
        return dict(self.entry.options)

    @property
    def persons(self) -> dict[str, dict[str, Any]]:
        """Return configured persons keyed by id."""
        return {p[CONF_PERSON_ID]: p for p in self.options.get(CONF_PERSONS, [])}

    def person_name(self, person_id: str | None) -> str | None:
        """Return the display name of a person."""
        if person_id is None or (person := self.persons.get(person_id)) is None:
            return None
        return person[CONF_NAME]

    def find_person(self, value: str) -> str | None:
        """Find a person id by id or (case insensitive) name."""
        needle = value.strip().casefold()
        for person_id, person in self.persons.items():
            if needle in (person_id.casefold(), person[CONF_NAME].casefold()):
                return person_id
        return None

    # --------------------------------------------------------------- lifecycle

    async def async_setup(self) -> None:
        """Load stored data and start listening to the scale."""
        data = await self._store.async_load() or {}
        self.measurements = sorted(
            (Measurement.from_dict(m) for m in data.get("measurements", [])),
            key=lambda m: m.ts,
        )
        if (last := data.get("last_source")) and (
            ts := dt_util.parse_datetime(last["ts"])
        ):
            self._last_source = (float(last["weight"]), ts)
        self._recalculate()
        self._update_notification()
        self.active = True

        self._unsubs.append(
            async_track_state_change_event(
                self.hass, [self.options[CONF_SOURCE]], self._async_source_changed
            )
        )
        # Time based values (7/30 day change, goal ETA) move on without new data.
        self._unsubs.append(
            async_track_time_change(
                self.hass, self._async_refresh, hour=0, minute=0, second=10
            )
        )

    async def async_unload(self) -> None:
        """Stop listening and flush data."""
        self.active = False
        for unsub in self._unsubs:
            unsub()
        self._unsubs.clear()
        if self._debounce_unsub:
            self._debounce_unsub()
            self._debounce_unsub = None
        await self._store.async_save(self._as_storage())

    async def async_remove_storage(self) -> None:
        """Delete stored data (entry removed)."""
        await self._store.async_remove()

    @callback
    def async_add_listener(self, update_callback: Callable[[], None]) -> CALLBACK_TYPE:
        """Register an entity update callback."""
        self._listeners.append(update_callback)

        @callback
        def remove() -> None:
            self._listeners.remove(update_callback)

        return remove

    # ------------------------------------------------------------- scale input

    def _parse_weight(self, state: State | None) -> float | None:
        """Convert a state of the scale sensor to kg, None if not usable."""
        if state is None or state.state in (STATE_UNKNOWN, STATE_UNAVAILABLE):
            return None
        try:
            value = float(state.state)
        except ValueError:
            return None
        unit = state.attributes.get(ATTR_UNIT_OF_MEASUREMENT)
        if unit and unit != UnitOfMass.KILOGRAMS:
            if unit not in MassConverter.VALID_UNITS:
                _LOGGER.warning(
                    "Unknown unit '%s' of %s, assuming kg", unit, state.entity_id
                )
            else:
                value = MassConverter.convert(value, unit, UnitOfMass.KILOGRAMS)
        low = self.options.get(CONF_MIN_WEIGHT, DEFAULT_MIN_WEIGHT)
        high = self.options.get(CONF_MAX_WEIGHT, DEFAULT_MAX_WEIGHT)
        if not low <= value <= high:
            _LOGGER.debug("Ignoring %.2f kg outside %s-%s kg", value, low, high)
            return None
        return round(value, 2)

    @callback
    def _async_source_changed(self, event: Event[EventStateChangedData]) -> None:
        """Handle a new value of the scale sensor."""
        weight = self._parse_weight(event.data["new_state"])
        if weight is None:
            return
        old_state = event.data["old_state"]
        old_valid = old_state is not None and old_state.state not in (
            STATE_UNKNOWN,
            STATE_UNAVAILABLE,
        )
        if (
            not old_valid
            and self._last_source is not None
            and abs(weight - self._last_source[0]) < SAME_WEIGHT_EPSILON
        ):
            # Sensor came back (restart, reconnect) with the already known value
            _LOGGER.debug("Ignoring restored value %.2f kg", weight)
            return

        # Many scales send intermediate values while the reading settles;
        # wait until the value is stable for a few seconds.
        self._pending_weight = weight
        if self._debounce_unsub:
            self._debounce_unsub()
        self._debounce_unsub = async_call_later(
            self.hass,
            self.options.get(CONF_DEBOUNCE, DEFAULT_DEBOUNCE),
            self._async_debounce_done,
        )

    @callback
    def _async_debounce_done(self, _now: datetime) -> None:
        """Process the settled value."""
        self._debounce_unsub = None
        weight, self._pending_weight = self._pending_weight, None
        if weight is None:
            return
        now = dt_util.utcnow()
        last, self._last_source = self._last_source, (weight, now)
        if (
            last is not None
            and abs(weight - last[0]) < SAME_WEIGHT_EPSILON
            and now - last[1] < DUPLICATE_WINDOW
        ):
            _LOGGER.debug("Ignoring duplicate value %.2f kg", weight)
            self._save()
            return
        self._async_register(weight, now)

    def _candidates(self) -> list[Candidate]:
        """Build detection candidates from the current state."""
        candidates = []
        for person_id, person in self.persons.items():
            stats = self.stats.get(person_id)
            if stats and stats.trend is not None and stats.latest_weight is not None:
                references: tuple[float, ...] = (stats.trend, stats.latest_weight)
                last_measured = stats.latest_ts
            else:
                references = (float(person[CONF_START_WEIGHT]),)
                last_measured = None
            at_home = None
            if (entity_id := person.get(CONF_PERSON_ENTITY)) and (
                state := self.hass.states.get(entity_id)
            ):
                if state.state not in (STATE_UNKNOWN, STATE_UNAVAILABLE):
                    at_home = state.state == STATE_HOME
            candidates.append(Candidate(person_id, references, last_measured, at_home))
        return candidates

    @callback
    def _async_register(self, weight: float, now: datetime) -> None:
        """Detect the person and store a new automatic measurement."""
        detection = detect(
            weight,
            self._candidates(),
            now,
            tolerance=self.options.get(CONF_TOLERANCE, DEFAULT_TOLERANCE),
            margin=self.options.get(CONF_AMBIGUITY_MARGIN, DEFAULT_AMBIGUITY_MARGIN),
        )
        self.last_detection = detection
        measurement = Measurement(
            id=uuid4().hex[:12],
            ts=now,
            weight=weight,
            person_id=detection.person_id,
            status=STATUS_ASSIGNED if detection.person_id else STATUS_PENDING,
            method=detection.reason,
        )
        _LOGGER.debug(
            "New measurement %.2f kg -> %s (%s, distances %s)",
            weight,
            self.person_name(detection.person_id),
            detection.reason,
            detection.distances,
        )
        self.measurements.append(measurement)
        self._async_changed()
        self._fire_event(measurement)

    # ------------------------------------------------------- manual operations

    @property
    def latest(self) -> Measurement | None:
        """Return the newest measurement."""
        return self.measurements[-1] if self.measurements else None

    @property
    def pending(self) -> list[Measurement]:
        """Return measurements waiting for manual assignment."""
        return [m for m in self.measurements if m.status == STATUS_PENDING]

    def get_measurement(self, measurement_id: str | None) -> Measurement | None:
        """Return a measurement by id, the newest one if no id is given."""
        if measurement_id is None:
            return self.latest
        return next((m for m in self.measurements if m.id == measurement_id), None)

    @callback
    def async_assign(self, measurement: Measurement, person_id: str | None) -> None:
        """Assign a measurement to a person, or discard it (person_id None)."""
        measurement.person_id = person_id
        measurement.status = STATUS_ASSIGNED if person_id else STATUS_DISCARDED
        measurement.method = METHOD_MANUAL
        self._async_changed()
        self._fire_event(measurement)

    @callback
    def async_unassign(self, measurement: Measurement) -> None:
        """Put a measurement back to the pending list ("that wasn't me")."""
        measurement.person_id = None
        measurement.status = STATUS_PENDING
        measurement.method = METHOD_MANUAL
        self._async_changed()
        self._fire_event(measurement)

    def pending_visible_to(self, user: UserLike | None, measurement: Measurement) -> bool:
        """Return True if a pending measurement may be shown to the user.

        Admins see all of them. Other users only see readings that are plausible
        for a person they manage, so nobody learns the weight of somebody else.
        """
        if is_unrestricted(user):
            return True
        now = dt_util.utcnow()
        tolerance = self.options.get(CONF_TOLERANCE, DEFAULT_TOLERANCE)
        for candidate in self._candidates():
            if not can_manage(user, self.persons[candidate.person_id]):
                continue
            distance = min(abs(measurement.weight - ref) for ref in candidate.references)
            if distance <= 2 * allowed_deviation(candidate, now, tolerance):
                return True
        return False

    @callback
    def async_add(self, person_id: str, weight: float, ts: datetime) -> Measurement:
        """Add a manual measurement."""
        measurement = Measurement(
            uuid4().hex[:12], ts, round(weight, 2), person_id, STATUS_ASSIGNED, METHOD_MANUAL
        )
        self.measurements.append(measurement)
        self.measurements.sort(key=lambda m: m.ts)
        self._async_changed()
        self._fire_event(measurement)
        return measurement

    @callback
    def async_delete_person_data(self, person_id: str) -> int:
        """Delete all measurements of a person (person is being removed)."""
        before = len(self.measurements)
        self.measurements = [m for m in self.measurements if m.person_id != person_id]
        self._async_changed()
        return before - len(self.measurements)

    @callback
    def async_delete(self, measurement: Measurement) -> None:
        """Delete a measurement."""
        self.measurements.remove(measurement)
        self._async_changed()

    # ---------------------------------------------------------------- internal

    @callback
    def _async_refresh(self, _now: datetime) -> None:
        """Recalculate time dependent values."""
        self._recalculate()
        self._notify()

    @callback
    def _async_changed(self) -> None:
        self._recalculate()
        self._save()
        self._notify()
        self._update_notification()

    def _recalculate(self) -> None:
        now = dt_util.utcnow()
        self.stats = {}
        self.trend_by_id = {}
        for person_id, person in self.persons.items():
            assigned = [
                m
                for m in self.measurements
                if m.person_id == person_id and m.status == STATUS_ASSIGNED
            ]
            points = [Point(m.ts, m.weight) for m in assigned]
            for measurement, (_, trend) in zip(assigned, trend_series(points)):
                self.trend_by_id[measurement.id] = round(trend, 2)
            self.stats[person_id] = compute_stats(
                points,
                now,
                height_cm=person.get(CONF_HEIGHT),
                goal=person.get(CONF_GOAL_WEIGHT),
            )

    @callback
    def _notify(self) -> None:
        for update_callback in list(self._listeners):
            update_callback()
        async_dispatcher_send(self.hass, SIGNAL_UPDATED)

    def _as_storage(self) -> dict[str, Any]:
        data: dict[str, Any] = {"measurements": [m.as_dict() for m in self.measurements]}
        if self._last_source:
            data["last_source"] = {
                "weight": self._last_source[0],
                "ts": self._last_source[1].isoformat(),
            }
        return data

    def _save(self) -> None:
        self._store.async_delay_save(self._as_storage, 2)

    def _fire_event(self, measurement: Measurement) -> None:
        self.hass.bus.async_fire(
            EVENT_MEASUREMENT,
            {
                "entry_id": self.entry.entry_id,
                "measurement_id": measurement.id,
                "weight": measurement.weight,
                "measured_at": measurement.ts.isoformat(),
                "person_id": measurement.person_id,
                "person": self.person_name(measurement.person_id),
                "status": measurement.status,
                "method": measurement.method,
            },
        )

    @callback
    def _update_notification(self) -> None:
        """Show a notification while measurements wait for assignment.

        Persistent notifications are visible to every user, so no weights here.
        """
        notification_id = f"{DOMAIN}_{self.entry.entry_id}_pending"
        count = len(self.pending)
        if not count:
            persistent_notification.async_dismiss(self.hass, notification_id)
            return
        if (self.hass.config.language or "").startswith("de"):
            title = f"{self.entry.title}: Messung zuordnen"
            message = (
                f"{count} Messung(en) konnten keiner Person sicher zugeordnet werden. "
                "Bitte im Panel **Gewicht** in der Seitenleiste zuordnen."
            )
        else:
            title = f"{self.entry.title}: assign measurement"
            message = (
                f"{count} measurement(s) could not be assigned automatically. "
                "Please assign them in the **Weight** panel in the sidebar."
            )
        persistent_notification.async_create(
            self.hass, message, title=title, notification_id=notification_id
        )
