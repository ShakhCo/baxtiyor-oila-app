from django.conf import settings
from django.conf.urls.static import static
from django.urls import include, path

urlpatterns = [
    path("api/", include("accounts.urls")),
    path("api/", include("profiles.urls")),
    path("api/", include("chat.urls")),
]

# In production nginx serves /media/ from the shared volume; in local dev Django
# serves it so uploaded photos are reachable.
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
