"""Constants for the Weight Tracker integration."""

from __future__ import annotations

from datetime import timedelta

DOMAIN = "weight_tracker"

# Settings (stored in entry.options)
CONF_SOURCE = "source_entity"
# Optional extra sensors of the scale (only used when the scale provides them)
CONF_IMPEDANCE_ENTITY = "impedance_entity"
CONF_BODY_FAT_ENTITY = "body_fat_entity"
CONF_MUSCLE_ENTITY = "muscle_mass_entity"
CONF_WATER_ENTITY = "water_entity"
CONF_BONE_ENTITY = "bone_mass_entity"
CONF_BMR_ENTITY = "bmr_entity"
# value stored with a reading -> setting with the scale's sensor
EXTRA_ENTITIES = {
    "impedance": CONF_IMPEDANCE_ENTITY,
    "body_fat": CONF_BODY_FAT_ENTITY,
    "muscle_mass": CONF_MUSCLE_ENTITY,
    "water": CONF_WATER_ENTITY,
    "bone_mass": CONF_BONE_ENTITY,
    "bmr": CONF_BMR_ENTITY,
}
EXTRA_READING_MAX_AGE = timedelta(minutes=2)
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
CONF_BIRTH_MONTH = "birth_month"  # "YYYY-MM"
# Personal notifications (each person decides for themselves)
CONF_NOTIFY_SERVICE = "notify_service"  # name of a notify.* service
CONF_NOTIFY_WEIGH = "notify_weigh"
CONF_REMINDER_DAYS = "reminder_days"  # 0 = off
CONF_NOTIFY_PET_WARNINGS = "notify_pet_warnings"
# Clothes: each person can switch it on, mark measurements and set a start value
CONF_CLOTHES = "clothes"
CONF_CLOTHES_KG = "clothes_kg"
# Actionable notifications (companion app): ids of the buttons
CLOTHES_ACTION_PREFIX = "WEIGHT_TRACKER_CLOTHES_"
NO_CLOTHES_ACTION_PREFIX = "WEIGHT_TRACKER_NOCLOTHES_"
TEST_ACTION = "WEIGHT_TRACKER_TEST"
NOTIFICATION_TAG_PREFIX = "weight_tracker_"
PET_EVENT_CATEGORIES = ("vet", "vaccination", "food", "medication", "other")
CONF_SEX = "sex"
SEXES = ("male", "female")
REMINDER_HOUR = 18
LEGACY_BIRTH_DATE = "birth_date"  # before 1.5.0: "YYYY-MM-DD"

# Pets
CONF_PETS = "pets"
CONF_PET_ID = "pet_id"
CONF_SPECIES = "species"
SPECIES = ("cat", "dog", "rabbit", "guinea_pig", "other")
# Children are weighed like pets (held on the arm), with growth percentiles.
CONF_KIND = "kind"
KIND_PET = "pet"
KIND_CHILD = "child"
CONF_BIRTH_DATE = "birth_date"  # children: "YYYY-MM-DD"
# Access control
CONF_USER_ID = "user_id"
CONF_VIEWERS = "viewers"
CONF_CREATE_SENSORS = "create_sensors"  # before 2.0: all or nothing
# Sensors chosen per person / pet / child (Settings → Sensors)
CONF_SENSORS = "sensors"
PERSON_SENSOR_KEYS = (
    "weight", "trend", "change_last", "change_7d", "change_30d", "change_total",
    "rate", "bmi", "goal_distance", "goal_eta", "last_measured",
)
BODY_SENSOR_KEYS = ("body_fat", "muscle_mass", "body_water", "bone_mass", "bmr")
PET_SENSOR_KEYS = (
    "weight", "trend", "change_last", "change_7d", "change_30d", "change_total",
    "rate", "goal_distance", "goal_eta", "last_measured",
)

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
# Higher reading of a "person alone / person with pet" pair, waiting for the
# person to confirm that it was a pet weighing.
STATUS_PET_CANDIDATE = "pet_candidate"
# Reading "person with pet" that was used to compute a pet's weight.
STATUS_PET_COMBINED = "pet_combined"

# Explicit pet weighing ("weigh Mimi" button): the next two readings within
# this window are paired. Automatic suggestions use the same window.
PET_WINDOW = timedelta(minutes=3)
METHOD_PET_SESSION = "pet_session"
METHOD_PET_AUTO = "pet_auto"

METHOD_MANUAL = "manual"
METHOD_IMPORT = "import"

DISCARD_OPTION = "discard"
PENDING_OPTION = "pending"

EVENT_MEASUREMENT = f"{DOMAIN}_measurement"

STORAGE_VERSION = 1

SIGNAL_UPDATED = f"{DOMAIN}_updated"

PANEL_URL_PATH = "weight-tracker"
PANEL_COMPONENT = "weight-tracker-panel"
STATIC_URL = "/weight_tracker_static"
DATA_PANEL_REGISTERED = f"{DOMAIN}_panel_registered"
