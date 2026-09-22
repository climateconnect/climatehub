from django.db import models
from django.utils.translation import gettext as _


class ProjectType(object):
    def __init__(
        self,
        name: str,
        name_de_translation: str,
        help_text: str,
        help_text_de_translation: str,
        icon,
        type_id: str,
        type_id_short: str,
    ):
        self.name = name
        self.name_de_translation = name_de_translation
        self.help_text = help_text
        self.help_text_de_translation = help_text_de_translation
        self.icon = icon
        self.type_id = type_id
        self.type_id_short = type_id_short

    def __repr__(self):
        return "Type %s" % (self.name)


idea_type = ProjectType(
    name="Idea",
    name_de_translation="Idee",
    help_text="Share your climate idea to find help and knowledge",
    help_text_de_translation="Teile deine Klimaidee, um Mitstreiter:innen zu finden",
    icon="",
    type_id="idea",
    type_id_short="ID",
)

event_type = ProjectType(
    name="Event",
    name_de_translation="Event",
    help_text="Your Project will show up in the Event calendar",
    help_text_de_translation="Dein Projekt wird im Eventkalender angezeigt",
    icon="",
    type_id="event",
    type_id_short="EV",
)

project_type = ProjectType(
    name="Project",
    name_de_translation="Projekt",
    help_text="Not an Idea or Event? Click here.",
    help_text_de_translation="Keine Idee oder Event? Klick hier!",
    icon="",
    type_id="project",
    type_id_short="PR",
)

# These types are mirrored in the frontend at
# frontend/public/data/projectTypes.ts — if you add, remove, or rename a type
# here, update the frontend file as well.
PROJECT_TYPES = {
    "idea_type": idea_type,
    "event_type": event_type,
    "project_type": project_type,
}


class ProjectTypesChoices(models.TextChoices):
    idea = (
        PROJECT_TYPES["idea_type"].type_id_short,
        _(PROJECT_TYPES["idea_type"].name),
    )
    event = (
        PROJECT_TYPES["event_type"].type_id_short,
        _(PROJECT_TYPES["event_type"].name),
    )
    project = PROJECT_TYPES["project_type"].type_id_short, _(
        PROJECT_TYPES["project_type"].name
    )
