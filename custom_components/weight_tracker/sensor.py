"""Sensors of Weight Tracker."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from datetime import date, datetime
from typing import Any

from homeassistant.components.sensor import (
    DOMAIN as SENSOR_DOMAIN,
    SensorDeviceClass,
    SensorEntity,
    SensorEntityDescription,
    SensorStateClass,
)
from homeassistant.const import PERCENTAGE, UnitOfMass
from homeassistant.core import HomeAssistant
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback
from homeassistant.helpers.typing import StateType

from . import WeightTrackerConfigEntry
from .analytics import PersonStats
from .const import (
    CONF_BMR_ENTITY,
    CONF_BODY_FAT_ENTITY,
    CONF_BONE_ENTITY,
    CONF_MUSCLE_ENTITY,
    CONF_WATER_ENTITY,
    CONF_SENSORS,
    CONF_GOAL_WEIGHT,
    CONF_HEIGHT,
    CONF_HEART_RATE_ENTITY,
    CONF_IMPEDANCE_ENTITY,
    CONF_IMPEDANCE_HIGH_ENTITY,
)

# Sensors that make sense for pets (no BMI)
PET_SENSOR_KEYS = {
    "weight", "trend", "change_last", "change_7d", "change_30d",
    "change_total", "rate", "goal_distance", "goal_eta", "last_measured",
}
from .entity import WeightTrackerEntity
from .manager import WeightTrackerManager

KG = UnitOfMass.KILOGRAMS


def _iso(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


def _weight_attrs(stats: PersonStats) -> dict[str, Any]:
    return {
        "measured_at": _iso(stats.latest_ts),
        "previous_weight": stats.previous_weight,
        "min_weight": stats.min_weight,
        "max_weight": stats.max_weight,
        "first_weight": stats.first_weight,
        "first_measured_at": _iso(stats.first_ts),
        "measurement_count": stats.count,
    }


def _goal_attrs(stats: PersonStats) -> dict[str, Any]:
    direction = None
    if stats.goal_remaining is not None and not stats.goal_reached:
        direction = "gain" if stats.goal_remaining > 0 else "lose"
    return {
        "goal_weight": stats.goal,
        "direction": direction,
        "reached": stats.goal_reached,
    }


@dataclass(frozen=True, kw_only=True)
class PersonSensorDescription(SensorEntityDescription):
    """Describes a per-person sensor."""

    value_fn: Callable[[PersonStats], StateType | date | datetime]
    attrs_fn: Callable[[PersonStats], dict[str, Any]] | None = None
    exists_fn: Callable[[dict[str, Any]], bool] = lambda _: True


def _kg(key: str, value_fn: Callable[[PersonStats], float | None], **kwargs: Any) -> PersonSensorDescription:
    return PersonSensorDescription(
        key=key,
        device_class=SensorDeviceClass.WEIGHT,
        state_class=SensorStateClass.MEASUREMENT,
        native_unit_of_measurement=KG,
        suggested_display_precision=1,
        value_fn=value_fn,
        **kwargs,
    )


PERSON_SENSORS: tuple[PersonSensorDescription, ...] = (
    _kg("weight", lambda s: s.latest_weight, attrs_fn=_weight_attrs),
    _kg("trend", lambda s: s.trend),
    _kg("change_last", lambda s: s.change_last),
    _kg("change_7d", lambda s: s.change_7d),
    _kg("change_30d", lambda s: s.change_30d),
    _kg("change_total", lambda s: s.change_total),
    PersonSensorDescription(
        key="rate",
        native_unit_of_measurement="kg/wk",
        state_class=SensorStateClass.MEASUREMENT,
        suggested_display_precision=2,
        value_fn=lambda s: s.rate_per_week,
    ),
    PersonSensorDescription(
        key="bmi",
        native_unit_of_measurement="kg/m²",
        state_class=SensorStateClass.MEASUREMENT,
        suggested_display_precision=1,
        value_fn=lambda s: s.bmi,
        exists_fn=lambda p: bool(p.get(CONF_HEIGHT)),
    ),
    _kg(
        "goal_distance",
        lambda s: None if s.goal_remaining is None else abs(s.goal_remaining),
        attrs_fn=_goal_attrs,
        exists_fn=lambda p: p.get(CONF_GOAL_WEIGHT) is not None,
    ),
    PersonSensorDescription(
        key="goal_eta",
        device_class=SensorDeviceClass.DATE,
        value_fn=lambda s: s.goal_eta,
        exists_fn=lambda p: p.get(CONF_GOAL_WEIGHT) is not None,
    ),
    PersonSensorDescription(
        key="last_measured",
        device_class=SensorDeviceClass.TIMESTAMP,
        value_fn=lambda s: s.latest_ts,
    ),
)


@dataclass(frozen=True, kw_only=True)
class BodySensorDescription(SensorEntityDescription):
    """Body composition value (only with impedance / body fat from the scale)."""

    field: str
    needs_impedance: bool = True
    # where the value lives in manager.body: "latest", "analysis", "metrics" or "heart_rate"
    source: str = "latest"
    # heart rate zone: state "low–high" with the bounds as attributes
    zone: str | None = None
    # what the scale must provide: "impedance" (body composition), "heart_rate" or nothing
    needs: str = "impedance"
    # what the person must have entered (height, birth_month, sex)
    requires: tuple[str, ...] = ("height", "birth_month", "sex")


BODY_SENSORS: tuple[BodySensorDescription, ...] = (
    BodySensorDescription(
        key="body_fat", field="body_fat", needs_impedance=False,
        native_unit_of_measurement=PERCENTAGE, state_class=SensorStateClass.MEASUREMENT,
        suggested_display_precision=1,
    ),
    BodySensorDescription(
        key="muscle_mass", field="muscle_mass", device_class=SensorDeviceClass.WEIGHT,
        native_unit_of_measurement=KG, state_class=SensorStateClass.MEASUREMENT,
        suggested_display_precision=1,
    ),
    BodySensorDescription(
        key="body_water", field="water", native_unit_of_measurement=PERCENTAGE,
        state_class=SensorStateClass.MEASUREMENT, suggested_display_precision=1,
    ),
    BodySensorDescription(
        key="bone_mass", field="bone_mass", device_class=SensorDeviceClass.WEIGHT,
        native_unit_of_measurement=KG, state_class=SensorStateClass.MEASUREMENT,
        suggested_display_precision=1,
    ),
    BodySensorDescription(
        key="bmr", field="bmr", native_unit_of_measurement="kcal",
        state_class=SensorStateClass.MEASUREMENT, suggested_display_precision=0,
    ),
    BodySensorDescription(
        key="body_score", field="body_score", source="analysis",
        state_class=SensorStateClass.MEASUREMENT, suggested_display_precision=0,
    ),
    BodySensorDescription(
        key="visceral_fat", field="visceral_fat", source="analysis",
        state_class=SensorStateClass.MEASUREMENT, suggested_display_precision=1,
    ),
    BodySensorDescription(
        key="protein", field="protein", source="analysis", native_unit_of_measurement=PERCENTAGE,
        state_class=SensorStateClass.MEASUREMENT, suggested_display_precision=1,
    ),
    BodySensorDescription(
        key="metabolic_age", field="metabolic_age", source="analysis", native_unit_of_measurement="a",
        state_class=SensorStateClass.MEASUREMENT, suggested_display_precision=0,
    ),
    BodySensorDescription(
        key="skeletal_muscle", field="skeletal_muscle", source="analysis", device_class=SensorDeviceClass.WEIGHT,
        native_unit_of_measurement=KG, state_class=SensorStateClass.MEASUREMENT,
        suggested_display_precision=1,
    ),
    BodySensorDescription(
        key="heart_rate", field="value", source="heart_rate", native_unit_of_measurement="bpm",
        state_class=SensorStateClass.MEASUREMENT, suggested_display_precision=0, needs="heart_rate", requires=(),
    ),
    # values derived from the basic values
    BodySensorDescription(
        key="fat_mass", field="fat_mass", source="analysis", device_class=SensorDeviceClass.WEIGHT,
        native_unit_of_measurement=KG, state_class=SensorStateClass.MEASUREMENT, suggested_display_precision=1,
    ),
    BodySensorDescription(
        key="lean_mass", field="lean_mass", source="analysis", device_class=SensorDeviceClass.WEIGHT,
        native_unit_of_measurement=KG, state_class=SensorStateClass.MEASUREMENT, suggested_display_precision=1,
    ),
    BodySensorDescription(
        key="water_mass", field="water_mass", source="analysis", native_unit_of_measurement="L",
        state_class=SensorStateClass.MEASUREMENT, suggested_display_precision=1,
    ),
    BodySensorDescription(
        key="ponderal_index", field="ponderal_index", source="metrics", native_unit_of_measurement="kg/m³",
        state_class=SensorStateClass.MEASUREMENT, suggested_display_precision=2, needs="", requires=("height",),
    ),
    BodySensorDescription(
        key="bsa", field="bsa", source="metrics", native_unit_of_measurement="m²",
        state_class=SensorStateClass.MEASUREMENT, suggested_display_precision=2, needs="", requires=("height",),
    ),
    BodySensorDescription(
        key="broca_weight", field="broca_weight", source="metrics", device_class=SensorDeviceClass.WEIGHT,
        native_unit_of_measurement=KG, state_class=SensorStateClass.MEASUREMENT, suggested_display_precision=1, needs="", requires=("height", "sex"),
    ),
    BodySensorDescription(
        key="bmr_mifflin", field="bmr_mifflin", source="metrics", native_unit_of_measurement="kcal",
        state_class=SensorStateClass.MEASUREMENT, suggested_display_precision=0, needs="", requires=("height", "birth_month", "sex"),
    ),
    BodySensorDescription(
        key="bmr_katch", field="bmr_katch", source="metrics", native_unit_of_measurement="kcal",
        state_class=SensorStateClass.MEASUREMENT, suggested_display_precision=0,
    ),
    BodySensorDescription(
        key="tdee", field="tdee", source="metrics", native_unit_of_measurement="kcal",
        state_class=SensorStateClass.MEASUREMENT, suggested_display_precision=0, needs="", requires=("height", "birth_month", "sex"),
    ),
    BodySensorDescription(
        key="hr_max", field="hr_max", source="metrics", native_unit_of_measurement="bpm",
        state_class=SensorStateClass.MEASUREMENT, suggested_display_precision=0, needs="", requires=("birth_month",),
    ),
    BodySensorDescription(
        key="hr_reserve", field="hr_reserve", source="metrics", native_unit_of_measurement="bpm",
        state_class=SensorStateClass.MEASUREMENT, suggested_display_precision=0, needs="heart_rate", requires=("birth_month",),
    ),
    BodySensorDescription(
        key="vo2max", field="vo2max", source="metrics", native_unit_of_measurement="mL/kg/min",
        state_class=SensorStateClass.MEASUREMENT, suggested_display_precision=1, needs="heart_rate", requires=("birth_month",),
    ),
    BodySensorDescription(
        key="impedance_index", field="impedance_index", source="metrics", native_unit_of_measurement="cm²/Ω",
        state_class=SensorStateClass.MEASUREMENT, suggested_display_precision=1, requires=("height",),
    ),
    *(
        BodySensorDescription(key=f"zone_{zone}", field="zones", source="metrics", zone=zone, needs="heart_rate", requires=("birth_month",))
        for zone in ("health", "fat_burn", "aerobic", "anaerobic")
    ),
)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: WeightTrackerConfigEntry,
    async_add_entities: AddConfigEntryEntitiesCallback,
) -> None:
    """Set up the sensors."""
    manager = entry.runtime_data
    entities: list[SensorEntity] = [PendingSensor(manager)]
    # Entity states are readable by every Home Assistant user, so person
    # sensors only exist if the admin explicitly enabled them for that person.
    # Only the sensors chosen under Settings → Sensors.
    entities.extend(
        PersonSensor(manager, person_id, description)
        for person_id, person in manager.persons.items()
        for description in PERSON_SENSORS
        if description.key in person.get(CONF_SENSORS, []) and description.exists_fn(person)
    )
    # Body composition only if the scale provides impedance or that value.
    has_impedance = bool(manager.options.get(CONF_IMPEDANCE_ENTITY) or manager.options.get(CONF_IMPEDANCE_HIGH_ENTITY))
    direct = {
        "body_fat": CONF_BODY_FAT_ENTITY, "muscle_mass": CONF_MUSCLE_ENTITY,
        "body_water": CONF_WATER_ENTITY, "bone_mass": CONF_BONE_ENTITY, "bmr": CONF_BMR_ENTITY,
        # derived values need the impedance, the pulse its own sensor
        "heart_rate": CONF_HEART_RATE_ENTITY,
    }
    entities.extend(
        BodySensor(manager, person_id, description)
        for person_id, person in manager.persons.items()
        for description in BODY_SENSORS
        if description.key in person.get(CONF_SENSORS, [])
        # only what can be calculated for this person (a value the scale reports
        # directly needs no profile data)
        and (
            all(person.get(field) for field in description.requires)
            or (not has_impedance and bool(manager.options.get(direct.get(description.key, ""))))
        )
        and (
            True if not description.needs
            else bool(manager.options.get(CONF_HEART_RATE_ENTITY)) if description.needs == "heart_rate"
            else has_impedance or bool(manager.options.get(direct.get(description.key, "")))
        )
    )
    entities.extend(
        PersonSensor(manager, None, description, pet_id=pet_id)
        for pet_id, pet in manager.pets.items()
        for description in PERSON_SENSORS
        if description.key in PET_SENSOR_KEYS
        and description.key in pet.get(CONF_SENSORS, [])
        and description.exists_fn(pet)
    )

    # Remove sensors that are no longer configured (e.g. goal removed).
    entity_registry = er.async_get(hass)
    wanted = {entity.unique_id for entity in entities}
    for reg_entry in er.async_entries_for_config_entry(entity_registry, entry.entry_id):
        if reg_entry.domain == SENSOR_DOMAIN and reg_entry.unique_id not in wanted:
            entity_registry.async_remove(reg_entry.entity_id)

    async_add_entities(entities)


class PersonSensor(WeightTrackerEntity, SensorEntity):
    """A statistic of one person."""

    entity_description: PersonSensorDescription

    def __init__(
        self,
        manager: WeightTrackerManager,
        person_id: str | None,
        description: PersonSensorDescription,
        pet_id: str | None = None,
    ) -> None:
        """Initialize (for a person or, with pet_id, for a pet)."""
        super().__init__(manager, SENSOR_DOMAIN, description.key, person_id, pet_id)
        self.entity_description = description

    @property
    def _stats(self) -> PersonStats | None:
        if self._pet_id is not None:
            return self.manager.pet_stats.get(self._pet_id)
        return self.manager.stats.get(self._person_id or "")

    @property
    def available(self) -> bool:
        """Person still configured."""
        return self._stats is not None

    @property
    def native_value(self) -> StateType | date | datetime:
        """Return the value."""
        if (stats := self._stats) is None:
            return None
        return self.entity_description.value_fn(stats)

    @property
    def extra_state_attributes(self) -> dict[str, Any] | None:
        """Return extra attributes."""
        if (stats := self._stats) is None or self.entity_description.attrs_fn is None:
            return None
        return self.entity_description.attrs_fn(stats)


class PendingSensor(WeightTrackerEntity, SensorEntity):
    """Number of measurements waiting for manual assignment."""

    def __init__(self, manager: WeightTrackerManager) -> None:
        """Initialize."""
        super().__init__(manager, SENSOR_DOMAIN, "pending")

    @property
    def native_value(self) -> int:
        """Return the number of pending measurements."""
        return len(self.manager.pending)


class BodySensor(WeightTrackerEntity, SensorEntity):
    """Estimated body composition of a person."""

    entity_description: BodySensorDescription

    def __init__(
        self, manager: WeightTrackerManager, person_id: str, description: BodySensorDescription
    ) -> None:
        """Initialize."""
        super().__init__(manager, SENSOR_DOMAIN, description.key, person_id)
        self.entity_description = description

    @property
    def native_value(self) -> float | None:
        """Latest estimated value."""
        values = (self.manager.body.get(self._person_id or "") or {}).get(self.entity_description.source) or {}
        if self.entity_description.zone:
            bounds = (values.get("zones") or {}).get(self.entity_description.zone)
            return f"{bounds[0]}–{bounds[1]}" if bounds else None
        return values.get(self.entity_description.field)

    @property
    def extra_state_attributes(self) -> dict[str, Any] | None:
        """Heart rate zones: lower and upper bound in bpm."""
        if not self.entity_description.zone:
            return None
        values = (self.manager.body.get(self._person_id or "") or {}).get("metrics") or {}
        bounds = (values.get("zones") or {}).get(self.entity_description.zone)
        return {"min": bounds[0], "max": bounds[1], "unit": "bpm"} if bounds else None
