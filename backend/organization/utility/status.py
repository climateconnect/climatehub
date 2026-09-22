from climateconnect_main.utility.general import get_prop_in_language
from organization.models.type import ProjectType


def get_project_type_name(type: ProjectType, language_code: str) -> str:
    return get_prop_in_language(type, "name", language_code)


def get_project_type_helptext(type: ProjectType, language_code: str) -> str:
    return get_prop_in_language(type, "help_text", language_code)
