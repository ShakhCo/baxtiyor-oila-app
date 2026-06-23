from django.urls import path

from profiles import admin_views, photo_views, views

urlpatterns = [
    path("anketa", views.my_anketa),
    path("anketa/matches", views.my_matches),
    path("anketa/matches/<int:telegram_id>", views.match_detail),
    path("anketa/photos", photo_views.my_photos),
    path("anketa/photos/<int:photo_id>", photo_views.my_photo),
    path("admin/anketas", admin_views.list_anketas),
    path("admin/anketas/<int:telegram_id>", admin_views.get_anketa),
    path("admin/anketas/<int:telegram_id>/approve", admin_views.approve_anketa),
    path("admin/anketas/<int:telegram_id>/reject", admin_views.reject_anketa),
    path("admin/anketas/<int:telegram_id>/status", admin_views.set_anketa_status),
    path("admin/anketas/<int:telegram_id>/matches", admin_views.anketa_matches),
    path("admin/anketas/<int:telegram_id>/matches/<int:candidate_id>", admin_views.anketa_match_remove),
    path("admin/anketas/<int:telegram_id>/suggestions", admin_views.anketa_suggestions),
]
