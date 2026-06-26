import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "dev-insecure-change-me")
DEBUG = os.environ.get("DJANGO_DEBUG", "True") == "True"
ALLOWED_HOSTS = ["*"]

INSTALLED_APPS = [
    "django.contrib.contenttypes",
    "django.contrib.auth",
    "django.contrib.staticfiles",
    "rest_framework",
    "accounts",
    "profiles",
    "chat",
]

MIDDLEWARE = [
    "django.middleware.common.CommonMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {"context_processors": []},
    },
]

WSGI_APPLICATION = "config.wsgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.environ.get("DB_NAME", "baxtiyor_dev"),
        "USER": os.environ.get("DB_USER", "baxtiyor"),
        "PASSWORD": os.environ.get("DB_PASSWORD", "dev_password"),
        "HOST": os.environ.get("DB_HOST", "postgres"),
        "PORT": os.environ.get("DB_PORT", "5432"),
    }
}

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"

# Uploaded anketa photos (stored as AVIF). Served from /media/ by nginx in
# production (shared volume) and by Django when DEBUG.
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"
# cap an uploaded image we'll read into Pillow (matches nginx client_max_body_size)
DATA_UPLOAD_MAX_MEMORY_SIZE = 25 * 1024 * 1024

CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        "LOCATION": "baxtiyor-default",
    }
}

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "accounts.authentication.TelegramInitDataAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "UNAUTHENTICATED_USER": None,
}

# --- Telegram ---
BOT_TOKEN = os.environ.get("BOT_TOKEN", "")
TELEGRAM_ADMIN_GROUP_ID = os.environ.get("TELEGRAM_ADMIN_GROUP_ID", "")
# Direct link to the Mini App, e.g. https://t.me/BaxtiyorOilaBot/app — used to
# build deep links (?startapp=…) in admin-group notifications. Without it, the
# group still gets notified but without the "open chat" button.
MINIAPP_URL = os.environ.get("MINIAPP_URL", "")
# Shared secret the bot sends (X-Bot-Secret) to the server-to-server user-register
# endpoint. Empty ⇒ the endpoint is disabled (rejects everything).
BOT_INTERNAL_SECRET = os.environ.get("BOT_INTERNAL_SECRET", "")
ADMIN_CACHE_TTL_SECONDS = int(os.environ.get("ADMIN_CACHE_TTL_SECONDS", "300"))
INIT_DATA_MAX_AGE_SECONDS = int(os.environ.get("INIT_DATA_MAX_AGE_SECONDS", str(24 * 3600)))
