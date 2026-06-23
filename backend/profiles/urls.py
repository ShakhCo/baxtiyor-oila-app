from django.urls import path

from profiles import admin_views, views

urlpatterns = [
    path("anketa", views.my_anketa),
    path("anketa/matches", views.my_matches),
    path("admin/anketas", admin_views.list_anketas),
    path("admin/anketas/<int:telegram_id>", admin_views.get_anketa),
    path("admin/anketas/<int:telegram_id>/approve", admin_views.approve_anketa),
    path("admin/anketas/<int:telegram_id>/reject", admin_views.reject_anketa),
    path("admin/anketas/<int:telegram_id>/status", admin_views.set_anketa_status),
]
