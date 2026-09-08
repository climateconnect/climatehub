from django.core.management.base import BaseCommand
from hubs.models import Hub, HubTranslation
from climateconnect_api.models.language import Language
from typing import Any


class Command(BaseCommand):
    help = "Create sector hub data"

    def handle(self, *args: Any, **options: Any) -> None:
        english_language = Language.objects.filter(language_code="en")[0]
        german_language = Language.objects.filter(language_code="de")[0]
        hubs = [
            {
                "name": "Building & housing",
                "url_slug": "construction",
                "headline": "Eco-building as a climate solution",
                "sub_headline": "How to Combat Climate Change with Alternative Construction Methods",
                "hub_type": Hub.HUB_TYPES[Hub.SECTOR_HUB_TYPE][0],
                "segway_text": ".",
                "language": english_language,
                "translations": [
                    {
                        "language": german_language,
                        "name_translation": "Bauen & Wohnen",
                        "headline_translation": "Ökologisches Bauen als Klimalösung",
                        "sub_headline_translation": "Wie man mit alternativen Bauweisen den Klimawandel bekämpft",
                    }
                ],
            },
            {
                "name": "Policy & Governance",
                "url_slug": "policy",
                "headline": "Climate Policies to change the world",
                "sub_headline": "The Importance of Environmental Legislation to Combat the Climate Crisis",
                "hub_type": Hub.HUB_TYPES[Hub.SECTOR_HUB_TYPE][0],
                "segway_text": ".",
                "language": english_language,
                "translations": [
                    {
                        "language": german_language,
                        "name_translation": "Politik und Verwaltung",
                        "headline_translation": "Klimapolitik, die die Welt verändert",
                        "sub_headline_translation": "test",
                    }
                ],
            },
            {
                "name": "Mobility & Transport",
                "url_slug": "mobility",
                "headline": "Mobility of the Future",
                "sub_headline": "Mobility Solutions to Combat Climate Change",
                "hub_type": Hub.HUB_TYPES[Hub.SECTOR_HUB_TYPE][0],
                "segway_text": ".",
                "language": english_language,
                "translations": [
                    {
                        "language": german_language,
                        "name_translation": "Mobilität & Verkehr",
                        "headline_translation": "Mobilität der Zukunft",
                        "sub_headline_translation": "Mobilitätslösungen zur Bekämpfung des Klimawandels",
                    }
                ],
            },
            {
                "name": "Food & Agriculture",
                "url_slug": "food",
                "headline": "Sustainable Food Production",
                "sub_headline": "How to Combat Climate Change with Sustainable Agriculture",
                "hub_type": Hub.HUB_TYPES[Hub.SECTOR_HUB_TYPE][0],
                "segway_text": ".",
                "language": english_language,
                "translations": [
                    {
                        "language": german_language,
                        "name_translation": "Ernährung & Landwirtschaft",
                        "headline_translation": "Nachhaltige Lebensmittelproduktion",
                        "sub_headline_translation": "Nachhaltige Landwirtschaft",
                    }
                ],
            },
            {
                "name": "Biodiversity",
                "url_slug": "biodiversity",
                "headline": "Protecting & restoring biodiversity ecosystems",
                "sub_headline": "How to combat the climate crisis by preserving our ecosystems",
                "hub_type": Hub.HUB_TYPES[Hub.SECTOR_HUB_TYPE][0],
                "segway_text": ".",
                "language": english_language,
                "translations": [
                    {
                        "language": german_language,
                        "name_translation": "Biodiversität",
                        "headline_translation": "Schutz und Wiederherstellung von Biodiversität",
                        "sub_headline_translation": "Biodiversität und Klimawandel",
                    }
                ],
            },
            {
                "name": "Education and Social Action",
                "url_slug": "education",
                "headline": "Education for a Sustainable Future",
                "sub_headline": "How to Combat Climate Change with Education and Social Action",
                "hub_type": Hub.HUB_TYPES[Hub.SECTOR_HUB_TYPE][0],
                "segway_text": ".",
                "language": english_language,
                "translations": [
                    {
                        "language": german_language,
                        "name_translation": "Bildung und soziales Engagement",
                        "headline_translation": "Bildung für eine nachhaltige Zukunft",
                        "sub_headline_translation": "Bildung und soziales Engagement",
                    }
                ],
            },
            {
                "name": "Energy",
                "url_slug": "energy",
                "headline": "Renewable Energy Solutions",
                "sub_headline": "How to Combat Climate Change with Renewable Energy",
                "hub_type": Hub.HUB_TYPES[Hub.SECTOR_HUB_TYPE][0],
                "segway_text": ".",
                "language": english_language,
                "translations": [
                    {
                        "language": german_language,
                        "name_translation": "Energie",
                        "headline_translation": "Erneuerbare Energien",
                        "sub_headline_translation": "Erneuerbare Energien und Klimawandel",
                    }
                ],
            },
        ]
        for hub in hubs:
            hub_in_db = Hub.objects.create(
                name=hub["name"],
                url_slug=hub["url_slug"],
                headline=hub["headline"],
                sub_headline=hub["sub_headline"],
                hub_type=hub["hub_type"],
                segway_text=hub["segway_text"],
                language=hub["language"],
            )
            for translation in hub["translations"]:
                HubTranslation.objects.create(
                    hub=hub_in_db,
                    language=translation["language"],
                    name_translation=translation["name_translation"],
                    headline_translation=translation["headline_translation"],
                    sub_headline_translation=translation["sub_headline_translation"],
                )
            print("Inserted hub {}".format(hub["name"]))
