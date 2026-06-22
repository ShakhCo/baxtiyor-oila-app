import json

from django.core.management.base import BaseCommand
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from accounts.models import User


def _parse(value):
    dt = parse_datetime(value) if value else None
    if dt and timezone.is_naive(dt):
        dt = timezone.make_aware(dt)
    return dt


class Command(BaseCommand):
    help = "Import users from a JSON dump (a dict keyed by telegram id)."

    def add_arguments(self, parser):
        parser.add_argument("path", nargs="?", default="/app/users.json")

    def handle(self, *args, **opts):
        with open(opts["path"], encoding="utf-8") as f:
            data = json.load(f)

        created = updated = 0
        for key, u in data.items():
            tid = u.get("id") or int(key)
            full = (u.get("full_name") or "").strip()
            username = (u.get("username") or "").strip()
            joined = _parse(u.get("date_joined"))
            last = _parse(u.get("last_interaction"))

            _, was_created = User.objects.update_or_create(
                telegram_id=tid,
                defaults={
                    "first_name": (full or username or str(tid))[:128],
                    "username": username[:64],
                },
            )
            # created_at (auto_now_add = join date) and last_seen_at (auto_now)
            # ignore assigned values, so set them with a direct UPDATE.
            stamps = {}
            if joined:
                stamps["created_at"] = joined
            stamps["last_seen_at"] = last or joined
            if stamps["last_seen_at"]:
                User.objects.filter(telegram_id=tid).update(**stamps)

            created += int(was_created)
            updated += int(not was_created)

        self.stdout.write(self.style.SUCCESS(
            f"Imported {created + updated} users ({created} created, {updated} updated)."
        ))
