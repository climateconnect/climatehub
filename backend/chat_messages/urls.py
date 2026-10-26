from django.urls import path

from chat_messages.views import message_origin_views, message_views

app_name = "chat_messages"
urlpatterns = [
    path(
        "chat/<str:chat_uuid>/",
        message_views.GetChatView.as_view(),
        name="connect-participants-api",
    ),
    path(
        "chat/<str:chat_uuid>/update_member/<int:pk>/",
        message_views.UpdateChatMemberView.as_view(),
        name="connect-participants-api",
    ),
    path(
        "chat/<str:chat_uuid>/add_members/",
        message_views.AddChatMembersView.as_view(),
        name="connect-participants-api",
    ),
    path(
        "chat/<str:chat_uuid>/change_creator/",
        message_views.ChangeChatCreatorView.as_view(),
        name="connect-participants-api",
    ),
    path(
        "chat/<str:chat_uuid>/leave/",
        message_views.LeaveChatView.as_view(),
        name="leave-chat-api",
    ),
    path(
        "chat/<str:chat_uuid>/send_message/",
        message_views.SendChatMessage.as_view(),
        name="send-chat-message-api",
    ),
    path(
        "start_group_chat/",
        message_views.StartGroupChatView.as_view(),
        name="start-group-chat-api",
    ),
    path(
        "start_private_chat/",
        message_views.StartPrivateChat.as_view(),
        name="start-private-chat-api",
    ),
    path("chats/", message_views.GetChatsView.as_view(), name="get-chats-api"),
    path(
        "messages/",
        message_views.GetChatMessages.as_view(),
        name="get-chat-messages-api",
    ),
    path(
        "message/<int:id>/",
        message_views.GetChatMessage.as_view(),
        name="get-chat-message-api",
    ),
    path(
        "chat/", message_views.GetSearchedChat.as_view(), name="get-searched-chats-api"
    ),
    path(
        "event-registration-origin/<int:registration_id>/",
        message_origin_views.EventRegistrationOriginView.as_view(),
        name="event-registration-origin",
    ),
    path(
        "project-origin/<int:project_id>/",
        message_origin_views.ProjectOriginView.as_view(),
        name="project-origin",
    ),
]
