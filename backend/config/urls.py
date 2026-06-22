from django.urls import include, path

urlpatterns = [
    path("api/", include("accounts.urls")),
    path("api/", include("profiles.urls")),
    path("api/", include("chat.urls")),
]
