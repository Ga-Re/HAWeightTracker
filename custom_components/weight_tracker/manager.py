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
    HassJob,
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
from .milestones import (
    Milestone,
    achieved,
    current_streak,
    direction,
    is_new_low,
    next_change_step,
)
from .notifications import milestone_message, reminder_message, test_message, weigh_message
from .pets import closest_pet, match_pet, split_pair
from .const import (
    CONF_AMBIGUITY_MARGIN,
    CONF_DEBOUNCE,
    CONF_GOAL_WEIGHT,
    CONF_HEIGHT,
    CONF_MAX_WEIGHT,
    CONF_MIN_WEIGHT,
    CONF_NOTIFY_MILESTONES,
    CONF_NOTIFY_SERVICE,
    CONF_NOTIFY_WEIGH,
    CONF_PERSON_ENTITY,
    CONF_PERSON_ID,
    CONF_PERSONS,
    CONF_PET_ID,
    CONF_PETS,
    CONF_REMINDER_DAYS,
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
    METHOD_PET_AUTO,
    METHOD_PET_SESSION,
    PET_WINDOW,
    REMINDER_HOUR,
    SAME_WEIGHT_EPSILON,
    SIGNAL_UPDATED,
    STATUS_ASSIGNED,
    STATUS_DISCARDED,
    STATUS_PENDING,
    STATUS_PET_CANDIDATE,
    STATUS_PET_COMBINED,
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
    # Pet candidates: the suggested pet and the "alone" reading of the pair.
    pet_id: str | None = None
    pair_id: str | None = None

    def as_dict(self) -> dict[str, Any]:
        """Serialize for storage."""
        data = {
            "id": self.id,
            "ts": self.ts.isoformat(),
            "weight": self.weight,
            "person_id": self.person_id,
            "status": self.status,
            "method": self.method,
        }
        if self.pet_id:
            data["pet_id"] = self.pet_id
        if self.pair_id:
            data["pair_id"] = self.pair_id
        return data

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
            pet_id=data.get("pet_id"),
            pair_id=data.get("pair_id"),
        )


@dataclass
class PetMeasurement:
    """A pet's weight, measured as difference "person with pet" - "person alone"."""

    id: str
    ts: datetime
    weight: float
    pet_id: str
    by_person_id: str | None  # who carried the pet
    method: str  # pet_session, pet_auto or manual

    def as_dict(self) -> dict[str, Any]:
        """Serialize for storage."""
        return {
            "id": self.id,
            "ts": self.ts.isoformat(),
            "weight": self.weight,
            "pet_id": self.pet_id,
            "by_person_id": self.by_person_id,
            "method": self.method,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> PetMeasurement:
        """Restore from storage."""
        return cls(
            id=data["id"],
            ts=dt_util.parse_datetime(data["ts"]) or dt_util.utcnow(),
            weight=float(data["weight"]),
            pet_id=data["pet_id"],
            by_person_id=data.get("by_person_id"),
            method=data.get("method", ""),
        )


@dataclass
class PetSession:
    """An explicit pet weighing waiting for its two readings."""

    pet_id: str | None
    started: datetime
    readings: list[tuple[float, datetime]]

    @property
    def expires(self) -> datetime:
        """End of the window."""
        return self.started + PET_WINDOW


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
        self.pet_measurements: list[PetMeasurement] = []
        self.pet_stats: dict[str, PersonStats] = {}
        self.pet_session: PetSession | None = None
        # person id -> milestone id -> ISO time it was reached
        self.achievements: dict[str, dict[str, str]] = {}
        # person id -> ISO time of the last reminder
        self._reminders: dict[str, str] = {}
        self._pet_session_unsub: CALLBACK_TYPE | None = None
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

    @property
    def pets(self) -> dict[str, dict[str, Any]]:
        """Return configured pets keyed by id."""
        return {p[CONF_PET_ID]: p for p in self.options.get(CONF_PETS, [])}

    def find_pet(self, value: str) -> str | None:
        """Find a pet id by id or (case insensitive) name."""
        needle = value.strip().casefold()
        for pet_id, pet in self.pets.items():
            if needle in (pet_id.casefold(), pet[CONF_NAME].casefold()):
                return pet_id
        return None

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
        self.pet_measurements = sorted(
            (PetMeasurement.from_dict(m) for m in data.get("pet_measurements", [])),
            key=lambda m: m.ts,
        )
        self.achievements = data.get("achievements", {})
        self._reminders = data.get("reminders", {})
        self._recalculate()
        # Record what was already reached before, without notifying.
        self._check_milestones(notify=False)
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
        self._unsubs.append(
            async_track_time_change(
                self.hass, self._async_send_reminders, hour=REMINDER_HOUR, minute=0, second=0
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
        if self._pet_session_unsub:
            self._pet_session_unsub()
            self._pet_session_unsub = None
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
        """Handle a settled reading: pet weighing or normal person measurement."""
        session = self.pet_session
        if session is not None and now <= session.expires:
            session.readings.append((weight, now))
            if len(session.readings) < 2:
                self._notify()  # panel shows "1 of 2"
                return
            self._async_finish_pet_session(session)
            return
        measurement = self._async_register_person_reading(weight, now)
        self._async_check_pet_suggestion(measurement)

    def _detect(self, weight: float, now: datetime) -> Detection:
        return detect(
            weight,
            self._candidates(),
            now,
            tolerance=self.options.get(CONF_TOLERANCE, DEFAULT_TOLERANCE),
            margin=self.options.get(CONF_AMBIGUITY_MARGIN, DEFAULT_AMBIGUITY_MARGIN),
        )

    @callback
    def _async_register_person_reading(self, weight: float, now: datetime) -> Measurement:
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
        self.measurements.sort(key=lambda m: m.ts)
        self._async_changed()
        self._fire_event(measurement)
        if measurement.person_id:
            self._notify_weighing(measurement)
        return measurement

    # --------------------------------------------------- personal notifications

    def _person_history(self, person_id: str) -> tuple[list[Measurement], list[float]]:
        """Assigned measurements of a person (oldest first) and their trend values."""
        assigned = [
            m for m in self.measurements
            if m.person_id == person_id and m.status == STATUS_ASSIGNED
        ]
        return assigned, [self.trend_by_id.get(m.id, m.weight) for m in assigned]

    def _german(self) -> bool:
        return (self.hass.config.language or "").startswith("de")

    @callback
    def _async_send(self, person_id: str, title: str, message: str) -> None:
        """Send a notification to the device the person chose for themselves."""
        service = self.persons.get(person_id, {}).get(CONF_NOTIFY_SERVICE)
        if not service:
            return
        if not self.hass.services.has_service("notify", service):
            _LOGGER.warning("Notify service notify.%s does not exist", service)
            return
        self.hass.async_create_task(
            self.hass.services.async_call(
                "notify", service, {"title": title, "message": message}
            )
        )

    @callback
    def _notify_weighing(self, measurement: Measurement) -> None:
        person_id = measurement.person_id
        person = self.persons.get(person_id or "")
        if person is None or not person.get(CONF_NOTIFY_WEIGH):
            return
        assigned, trends = self._person_history(person_id)
        if not assigned or assigned[-1] is not measurement:
            return  # only for the newest measurement
        stats = self.stats.get(person_id)
        sign = direction(assigned[0].weight, person.get(CONF_GOAL_WEIGHT))
        title, message = weigh_message(
            self._german(),
            measurement.weight,
            stats.change_last if stats else None,
            trends[-1],
            stats.change_7d if stats else None,
            is_new_low(trends, sign),
        )
        self._async_send(person_id, title, message)

    def person_milestones(self, person_id: str) -> list[Milestone]:
        """Milestones the history of a person reaches right now."""
        person = self.persons.get(person_id, {})
        assigned, trends = self._person_history(person_id)
        days = [dt_util.as_local(m.ts).date() for m in assigned]
        return achieved([m.weight for m in assigned], trends, days, person.get(CONF_GOAL_WEIGHT))

    def person_progress(self, person_id: str) -> dict[str, Any]:
        """Current streak and the next weight milestone, for the panel."""
        person = self.persons.get(person_id, {})
        assigned, trends = self._person_history(person_id)
        days = [dt_util.as_local(m.ts).date() for m in assigned]
        step = next_change_step([m.weight for m in assigned], trends, person.get(CONF_GOAL_WEIGHT))
        return {
            "streak": current_streak(days, dt_util.now().date()),
            "next_step": step[0] if step else None,
            "next_remaining": step[1] if step else None,
        }

    @callback
    def _check_milestones(self, notify: bool) -> None:
        """Remember newly reached milestones and tell the person (if wanted)."""
        changed = False
        for person_id, person in self.persons.items():
            reached = self.person_milestones(person_id)
            known = self.achievements.get(person_id)
            if known is None:
                # First run for this person: take over silently.
                self.achievements[person_id] = {m.id: dt_util.utcnow().isoformat() for m in reached}
                changed = True
                continue
            new = [m for m in reached if m.id not in known]
            for milestone in new:
                known[milestone.id] = dt_util.utcnow().isoformat()
                changed = True
            if notify and new and person.get(CONF_NOTIFY_MILESTONES):
                assigned, _ = self._person_history(person_id)
                sign = direction(assigned[0].weight, person.get(CONF_GOAL_WEIGHT)) if assigned else -1
                for milestone in new:
                    self._async_send(person_id, *milestone_message(self._german(), milestone, sign))
        if changed:
            self._save()

    @callback
    def _async_send_reminders(self, _now: datetime) -> None:
        """Daily: remind persons who have not weighed in for a while."""
        now = dt_util.utcnow()
        for person_id, person in self.persons.items():
            days = int(person.get(CONF_REMINDER_DAYS) or 0)
            stats = self.stats.get(person_id)
            if not days or stats is None or stats.latest_ts is None:
                continue
            since = (now - stats.latest_ts).days
            last = dt_util.parse_datetime(self._reminders.get(person_id, "") or "")
            if since < days or (last is not None and (now - last).days < days):
                continue
            self._reminders[person_id] = now.isoformat()
            self._async_send(person_id, *reminder_message(self._german(), since))
        self._save()

    @callback
    def async_send_test(self, service: str) -> None:
        """Send a test notification to a notify service."""
        title, message = test_message(self._german())
        self.hass.async_create_task(
            self.hass.services.async_call("notify", service, {"title": title, "message": message})
        )

    # ----------------------------------------------------------- pet weighing

    def _pet_references(self) -> dict[str, float]:
        """Current reference weight of every pet."""
        refs = {}
        for pet_id, pet in self.pets.items():
            stats = self.pet_stats.get(pet_id)
            refs[pet_id] = stats.trend if stats and stats.trend is not None else float(pet[CONF_START_WEIGHT])
        return refs

    @callback
    def async_start_pet_session(self, pet_id: str | None) -> None:
        """Pair the next two readings (person alone / person with pet)."""
        if self._pet_session_unsub:
            self._pet_session_unsub()
        self.pet_session = PetSession(pet_id, dt_util.utcnow(), [])
        self._pet_session_unsub = async_call_later(
            self.hass, PET_WINDOW.total_seconds() + 1, HassJob(self._async_pet_session_expired)
        )
        self._notify()

    @callback
    def async_cancel_pet_session(self) -> None:
        """Stop waiting; a single reading so far counts as a normal one."""
        if (session := self.pet_session) is None:
            return
        self.pet_session = None
        if self._pet_session_unsub:
            self._pet_session_unsub()
            self._pet_session_unsub = None
        for weight, ts in session.readings:
            self._async_register_person_reading(weight, ts)
        self._notify()

    @callback
    def _async_pet_session_expired(self, _now: datetime) -> None:
        self._pet_session_unsub = None
        self.async_cancel_pet_session()

    @callback
    def _async_finish_pet_session(self, session: PetSession) -> None:
        self.pet_session = None
        if self._pet_session_unsub:
            self._pet_session_unsub()
            self._pet_session_unsub = None
        alone_idx, with_idx = split_pair(session.readings[0][0], session.readings[1][0])
        alone_weight, alone_ts = session.readings[alone_idx]
        with_weight, with_ts = session.readings[with_idx]
        alone = self._async_register_person_reading(alone_weight, alone_ts)
        diff = round(with_weight - alone_weight, 2)
        pet_id = session.pet_id or closest_pet(diff, self._pet_references())
        combined = Measurement(
            uuid4().hex[:12], with_ts, with_weight, None, STATUS_PET_COMBINED,
            METHOD_PET_SESSION, pet_id=pet_id, pair_id=alone.id,
        )
        self.measurements.append(combined)
        self.measurements.sort(key=lambda m: m.ts)
        if pet_id is None:
            _LOGGER.warning("Pet weighing: difference %.2f kg does not fit any pet", diff)
            combined.status = STATUS_DISCARDED
            self._async_changed()
            return
        self._async_add_pet_measurement(
            PetMeasurement(uuid4().hex[:12], with_ts, diff, pet_id, alone.person_id, METHOD_PET_SESSION)
        )

    @callback
    def _async_check_pet_suggestion(self, new: Measurement) -> None:
        """Suggest a pet weighing for "alone" + "with pet" readings close in time."""
        if not self.pets:
            return
        previous = [
            m for m in self.measurements
            if m is not new
            and m.status in (STATUS_ASSIGNED, STATUS_PENDING)
            and abs((new.ts - m.ts).total_seconds()) <= PET_WINDOW.total_seconds()
        ]
        if not previous:
            return
        prev = max(previous, key=lambda m: m.ts)
        low, high = (prev, new) if prev.weight <= new.weight else (new, prev)
        # The lighter reading must belong to a known person. The heavier one must
        # not clearly belong to somebody else (two persons weighing in a row).
        if low.status != STATUS_ASSIGNED or low.person_id is None:
            return
        if high.status == STATUS_ASSIGNED and high.person_id != low.person_id:
            return
        diff = round(high.weight - low.weight, 2)
        if (pet_id := match_pet(diff, self._pet_references())) is None:
            return
        high.status = STATUS_PET_CANDIDATE
        high.person_id = None
        high.pet_id = pet_id
        high.pair_id = low.id
        _LOGGER.debug("Pet weighing suggested: %s %.2f kg", self.pets[pet_id][CONF_NAME], diff)
        self._async_changed()

    def candidate_pair(self, candidate: Measurement) -> Measurement | None:
        """The "alone" reading of a pet candidate."""
        return self.get_measurement(candidate.pair_id) if candidate.pair_id else None

    @callback
    def async_confirm_pet_candidate(self, candidate: Measurement, pet_id: str | None = None) -> None:
        """Turn a suggestion into a pet measurement."""
        alone = self.candidate_pair(candidate)
        pet_id = pet_id or candidate.pet_id
        if alone is None or pet_id not in self.pets:
            self.async_reject_pet_candidate(candidate)
            return
        candidate.status = STATUS_PET_COMBINED
        candidate.method = METHOD_PET_AUTO
        candidate.pet_id = pet_id
        self._async_add_pet_measurement(
            PetMeasurement(
                uuid4().hex[:12], candidate.ts, round(candidate.weight - alone.weight, 2),
                pet_id, alone.person_id, METHOD_PET_AUTO,
            )
        )

    @callback
    def async_reject_pet_candidate(self, candidate: Measurement) -> None:
        """Not a pet weighing: treat the reading like a normal one again."""
        detection = self._detect(candidate.weight, candidate.ts)
        candidate.person_id = detection.person_id
        candidate.status = STATUS_ASSIGNED if detection.person_id else STATUS_PENDING
        candidate.method = detection.reason
        candidate.pet_id = None
        candidate.pair_id = None
        self._async_changed()

    @callback
    def _async_add_pet_measurement(self, pet_measurement: PetMeasurement) -> None:
        self.pet_measurements.append(pet_measurement)
        self.pet_measurements.sort(key=lambda m: m.ts)
        self._async_changed()
        self.hass.bus.async_fire(
            f"{DOMAIN}_pet_measurement",
            {
                "entry_id": self.entry.entry_id,
                "measurement_id": pet_measurement.id,
                "pet_id": pet_measurement.pet_id,
                "pet": self.pets.get(pet_measurement.pet_id, {}).get(CONF_NAME),
                "weight": pet_measurement.weight,
                "method": pet_measurement.method,
            },
        )

    @callback
    def async_add_pet_measurement(
        self, pet_id: str, weight: float, ts: datetime, by_person_id: str | None = None
    ) -> PetMeasurement:
        """Add a manual pet measurement."""
        measurement = PetMeasurement(uuid4().hex[:12], ts, round(weight, 2), pet_id, by_person_id, METHOD_MANUAL)
        self._async_add_pet_measurement(measurement)
        return measurement

    def get_pet_measurement(self, measurement_id: str) -> PetMeasurement | None:
        """Return a pet measurement by id."""
        return next((m for m in self.pet_measurements if m.id == measurement_id), None)

    @callback
    def async_assign_pet_measurement(self, measurement: PetMeasurement, pet_id: str) -> None:
        """Move a pet measurement to another pet."""
        measurement.pet_id = pet_id
        self._async_changed()

    @callback
    def async_delete_pet_measurement(self, measurement: PetMeasurement) -> None:
        """Delete a pet measurement."""
        self.pet_measurements.remove(measurement)
        self._async_changed()

    @callback
    def async_delete_pet_data(self, pet_id: str) -> int:
        """Delete all measurements of a pet (pet is being removed)."""
        before = len(self.pet_measurements)
        self.pet_measurements = [m for m in self.pet_measurements if m.pet_id != pet_id]
        for m in self.measurements:
            if m.status == STATUS_PET_CANDIDATE and m.pet_id == pet_id:
                m.status, m.pet_id, m.pair_id = STATUS_PENDING, None, None
        self._async_changed()
        return before - len(self.pet_measurements)

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
        was_pending = measurement.status == STATUS_PENDING
        measurement.person_id = person_id
        measurement.status = STATUS_ASSIGNED if person_id else STATUS_DISCARDED
        measurement.method = METHOD_MANUAL
        self._async_changed()
        self._fire_event(measurement)
        if was_pending and person_id:
            self._notify_weighing(measurement)

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
        self._check_milestones(notify=True)
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
        self.pet_stats = {}
        for pet_id, pet in self.pets.items():
            measured = [m for m in self.pet_measurements if m.pet_id == pet_id]
            points = [Point(m.ts, m.weight) for m in measured]
            for measurement, (_, trend) in zip(measured, trend_series(points)):
                self.trend_by_id[measurement.id] = round(trend, 2)
            self.pet_stats[pet_id] = compute_stats(points, now, goal=pet.get(CONF_GOAL_WEIGHT))

    @callback
    def _notify(self) -> None:
        for update_callback in list(self._listeners):
            update_callback()
        async_dispatcher_send(self.hass, SIGNAL_UPDATED)

    def _as_storage(self) -> dict[str, Any]:
        data: dict[str, Any] = {
            "measurements": [m.as_dict() for m in self.measurements],
            "pet_measurements": [m.as_dict() for m in self.pet_measurements],
            "achievements": self.achievements,
            "reminders": self._reminders,
        }
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
