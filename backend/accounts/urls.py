from django.urls import path

from accounts import views

urlpatterns = [
    path("health", views.health),
    path("me", views.me),
    path("users/register", views.register_user),
]
