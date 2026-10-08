import json
import logging
from django.utils import timezone
from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from chat_messages.models import (
    Message,
    MessageParticipants,
    Participant,
    MessageReceiver,
)
from django.contrib.auth.models import User
from rest_framework.exceptions import ValidationError
from chat_messages.utility.message_origin import resolve_project_origin
from chat_messages.utility.notification import create_chat_message_notification
from climateconnect_api.utility.notification import (
    create_user_notification,
    create_email_notification,
)


logger = logging.getLogger(__name__)


class DirectMessageConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.user = self.scope["user"]
        if not self.user.is_anonymous:
            await self.channel_layer.group_add(
                "user-" + str(self.user.id), self.channel_name
            )
            await self.accept()
        else:
            await self.close()

    async def disconnect(self, close_code):
        self.user = self.scope["user"]
        await self.channel_layer.group_discard(
            "user-" + str(self.user.id), self.channel_name
        )

    # Receive message from WebSocket
    async def receive(self, text_data, bytes_data=None):
        text_data_json = json.loads(text_data)
        message = text_data_json["message"]
        chat_uuid = text_data_json["chat_uuid"]
        self.user = self.scope["user"]
        # Send message to room group
        message_object = await self.new_message(
            chat_uuid,
            self.user,
            message,
            text_data_json.get("origin_project_url_slug"),
        )
        for receiver in message_object["receivers"]:
            await self.channel_layer.group_send(
                "user-" + str(receiver.id),
                {
                    "type": "chat_message",
                    "message": message,
                    "chat_uuid": chat_uuid,
                    "message_id": message_object["message"].id,
                },
            )

    @database_sync_to_async
    def new_message(
        self, chat_uuid, user, message_content, origin_project_url_slug=None
    ):
        try:
            chat = MessageParticipants.objects.get(chat_uuid=chat_uuid)
        except MessageParticipants.DoesNotExist:
            chat = None
        # Only select active participant IDs
        receiver_user_ids = Participant.objects.filter(
            chat=chat, is_active=True
        ).values_list("user", flat=True)
        receiver_users = list(User.objects.filter(id__in=receiver_user_ids))
        origin_type, origin_id = "", None
        if origin_project_url_slug:
            try:
                origin_type, origin_id = resolve_project_origin(
                    user, chat, origin_project_url_slug
                )
            except ValidationError:
                # No clean error path on a socket; keep the message, drop the origin.
                logger.warning(
                    "Ignoring invalid message origin %s for chat %s",
                    origin_project_url_slug,
                    chat_uuid,
                )
        message = Message.objects.create(
            content=message_content,
            sender=user,
            message_participant=chat,
            sent_at=timezone.now(),
            origin_type=origin_type,
            origin_id=origin_id,
        )
        chat.last_message_at = timezone.now()
        chat.save()
        notification = create_chat_message_notification(chat)
        for receiver in receiver_users:
            if not receiver.id == user.id:
                MessageReceiver.objects.create(receiver=receiver, message=message)
                create_email_notification(
                    receiver, chat, message_content, user, notification
                )
                create_user_notification(receiver, notification)
        return {"message": message, "receivers": receiver_users}

    # Receive message from room group
    async def chat_message(self, event):
        if not self.user.is_anonymous:
            message = event["message"]
            # Send message to WebSocket
            await self.send(
                text_data=json.dumps(
                    {
                        "message": message,
                        "type": event["type"],
                        "chat_uuid": event["chat_uuid"],
                        "message_id": event["message_id"],
                    }
                )
            )

    async def notification(self, event):
        if not self.user.is_anonymous:
            await self.send(text_data=json.dumps({"type": event["type"]}))
