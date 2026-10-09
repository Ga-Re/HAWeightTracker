"""Constants for the Weight Tracker integration."""

from __future__ import annotations

from datetime import timedelta

DOMAIN = "weight_tracker"

# Settings (stored in entry.options)
CONF_SOURCE = "source_entity"
CONF_MIN_WEIGHT = "min_weight"
CONF_MAX_WEIGHT = "max_weight"
CONF_TOLERANCE = "tolerance"
CONF_AMBIGUITY_MARGIN = "ambiguity_margin"
CONF_DEBOUNCE = "debounce_seconds"
CONF_PERSONS = "persons"

# Person fields
CONF_PERSON_ID = "person_id"
CONF_START_WEIGHT = "start_weight"
CONF_HEIGHT = "height"
CONF_GOAL_WEIGHT = "goal_weight"
CONF_PERSON_ENTITY = "person_entity"
CONF_BIRTH_DATE = "birth_date"
# Access control
CONF_USER_ID = "user_id"
CONF_VIEWERS = "viewers"
CONF_CREATE_SENSORS = "create_sensors"

DEFAULT_NAME = "Waage"
DEFAULT_MIN_WEIGHT = 30.0
DEFAULT_MAX_WEIGHT = 250.0
DEFAULT_TOLERANCE = 3.0
DEFAULT_AMBIGUITY_MARGIN = 1.0
DEFAULT_DEBOUNCE = 5

# The same value reported again within this window is treated as a duplicate.
DUPLICATE_WINDOW = timedelta(minutes=10)
SAME_WEIGHT_EPSILON = 0.05

STATUS_ASSIGNED = "assigned"
STATUS_PENDING = "pending"
STATUS_DISCARDED = "discarded"

METHOD_MANUAL = "manual"

DISCARD_OPTION = "discard"
PENDING_OPTION = "pending"

EVENT_MEASUREMENT = f"{DOMAIN}_measurement"

STORAGE_VERSION = 1

SIGNAL_UPDATED = f"{DOMAIN}_updated"

PANEL_URL_PATH = "weight-tracker"
PANEL_COMPONENT = "weight-tracker-panel"
STATIC_URL = "/weight_tracker_static"
DATA_PANEL_REGISTERED = f"{DOMAIN}_panel_registered"
