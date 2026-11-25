from django.contrib.auth.models import User
from django.db import models

from climateconnect_api.models import Role
from ideas.models.ideas import Idea


class MessageParticipants(models.Model):
    chat_uuid = models.UUIDField(
        help_text="Unique ID for each message connection",
        verbose_name="Chat UUID",
        unique=True,
        null=True,
        blank=True,
    )

    name = models.CharField(
        help_text="Name of the chat",
        verbose_name="chat_name",
        max_length=128,
        default="",
    )

    # Making it a bit more future proof.
    # If we introduced a feature to block someone this might come handy.
    is_active = models.BooleanField(
        help_text="Check if the chat between participants are active or not."
        "If they are not active that means a user has blocked another person.",
        verbose_name="Is active?",
        default=True,
    )

    is_public = models.BooleanField(
        help_text="If this value is set to true, anybody can join this chat without being permitted or invited by an admin.",
        verbose_name="Is public?",
        default=False,
    )

    related_idea = models.ForeignKey(
        Idea,
        help_text="If this chat is about an idea, this points to the idea",
        verbose_name="Related idea",
        related_name="related_idea_message_participant",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )

    created_by = models.ForeignKey(
        User,
        related_name="created_by_user",
        help_text="Points to the user that created the chat",
        verbose_name="Created By",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
    )

    created_at = models.DateTimeField(
        help_text="Time when participants started a messaging",
        verbose_name="Created at",
        auto_now_add=True,
    )

    last_message_at = models.DateTimeField(
        help_text="Time when the last message in this chat was sent",
        verbose_name="Last message at",
        auto_now_add=True,
    )

    deactivated_at = models.DateTimeField(
        help_text="Time when one of the user has deactivated their chat.",
        verbose_name="Deactivated at",
        null=True,
        blank=True,
    )

    class Meta:
        verbose_name_plural = "Chats"
        ordering = ["-last_message_at", "-created_at"]

    def __str__(self):
        if self.name:
            return 'Chat: "%s"' % self.name
        else:
            participants = Participant.objects.filter(chat=self)
            first_participant_name = ""
            second_participant_name = ""
            if len(participants) > 0:
                first_participant_name = (
                    participants[0].user.first_name
                    + " "
                    + participants[0].user.last_name
                )
            if len(participants) > 1:
                second_participant_name = (
                    participants[1].user.first_name
                    + " "
                    + participants[1].user.last_name
                )
            return "Chat with %s and %s" % (
                first_participant_name,
                second_participant_name,
            )


class Message(models.Model):
    message_participant = models.ForeignKey(
        MessageParticipants,
        related_name="participant_message",
        help_text="Points to a table where chat was initialized between participants",
        verbose_name="Message participant",
        null=False,
        blank=False,
        on_delete=models.CASCADE,
    )

    content = models.TextField(
        help_text="Content of a message",
        verbose_name="Content",
        null=False,
        blank=False,
    )

    sender = models.ForeignKey(
        User,
        related_name="message_sender",
        help_text="Points to user who sent a message",
        verbose_name="Sender",
        on_delete=models.SET_NULL,
        null=True,
    )

    sent_at = models.DateTimeField(
        help_text="Time when message was sent",
        verbose_name="Sent at",
        null=True,
        blank=True,
    )

    updated_at = models.DateTimeField(
        help_text="Time when sender updated a message",
        verbose_name="Updated at",
        null=True,
        blank=True,
    )

    origin_type = models.CharField(
        max_length=32,
        blank=True,
        default="",
        help_text=(
            "Context that originated this message. "
            "Valid values: '' (no context), 'project', 'event_registration', "
            "'organization', 'membership_request', 'hub'. Blank means no origin context."
        ),
        verbose_name="Origin Type",
    )
    origin_id = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Primary key of the origin entity identified by origin_type.",
        verbose_name="Origin ID",
    )

    class Meta:
        verbose_name = "Message"
        verbose_name_plural = "Messages"
        ordering = ["-id"]

    def __str__(self):
        sender_name = (
            self.sender.first_name + " " + self.sender.last_name
            if self.sender
            else "deleted user"
        )
        return "Message %s from %s in chat %s" % (
            self.id,
            sender_name,
            self.message_participant_id,
        )


class MessageReceiver(models.Model):
    receiver = models.ForeignKey(
        User,
        related_name="messagereceiver_receiver",
        help_text="Points to the user who received the message",
        verbose_name="Receiver",
        null=False,
        blank=False,
        on_delete=models.CASCADE,
    )

    message = models.ForeignKey(
        Message,
        related_name="messacereceiver_message",
        help_text="Points to the message that was received",
        verbose_name="Message",
        null=False,
        blank=False,
        on_delete=models.CASCADE,
    )

    read_at = models.DateTimeField(
        help_text="Time when all participants have read a messages",
        verbose_name="Read at",
        null=True,
        blank=True,
    )

    class Meta:
        verbose_name = "Message Receiver"
        verbose_name_plural = "Message Receivers"

    def __str__(self):
        return "Message to %s %s" % (self.receiver.first_name, self.receiver.last_name)


class Participant(models.Model):
    user = models.ForeignKey(
        User,
        related_name="participant_user",
        help_text="Points to the user that is part of the chat",
        verbose_name="User",
        null=False,
        blank=False,
        on_delete=models.CASCADE,
    )

    chat = models.ForeignKey(
        MessageParticipants,
        related_name="participant_participants",
        help_text="Points to the chat that this user is a part of",
        verbose_name="Chat",
        null=False,
        blank="False",
        on_delete=models.CASCADE,
    )

    role = models.ForeignKey(
        Role,
        related_name="participant_role",
        verbose_name="Role(permissions)",
        help_text="Points to the user's role (creator, admin, member)",
        on_delete=models.PROTECT,
    )

    created_at = models.DateTimeField(
        help_text="Time when the user joined the chat created",
        verbose_name="Created At",
        auto_now_add=True,
    )

    is_active = models.BooleanField(
        help_text="Check if the user is still part of the chat.",
        verbose_name="Is active?",
        default=True,
    )

    updated_at = models.DateTimeField(
        help_text="Time when the user's role in the chat updated",
        verbose_name="Updated At",
        auto_now=True,
    )

    class Meta:
        verbose_name = "Chat Participant"
        verbose_name_plural = "Chat Participants"
        ordering = ["id"]
        unique_together = ("user", "chat")

    def __str__(self):
        return "User %s is part of chat %s" % (
            self.user.first_name + " " + self.user.last_name,
            self.chat.chat_uuid,
        )
