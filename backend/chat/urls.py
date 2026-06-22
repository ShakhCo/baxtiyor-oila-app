from django.urls import path

from chat import admin_views, views

urlpatterns = [
    path("chat", views.my_chat),
    path("admin/chats", admin_views.list_conversations),
    path("admin/labels", admin_views.labels),
    path("admin/chats/<int:telegram_id>", admin_views.admin_chat),
    path("admin/chats/<int:telegram_id>/labels", admin_views.set_labels),
]
