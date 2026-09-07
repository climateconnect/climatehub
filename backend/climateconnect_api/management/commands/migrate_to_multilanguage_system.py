from organization.models.tags import OrganizationTags
from climateconnect_api.models.common import Skill
from typing import Any
from django.core.management.base import BaseCommand

skills_translation_map = [
    {"name_en": "Communication & Marketing", "name_de": "Kommunikation & Marketing"},
    {"name_en": "Advertising", "name_de": "Werbung"},
    {"name_en": "Business Storytelling", "name_de": "Business Storytelling"},
    {"name_en": "Written Communication", "name_de": "Schriftliche Kommunikation"},
    {"name_en": "Customer Service", "name_de": "Customer Service"},
    {"name_en": "Digital Media", "name_de": "Digitale Medien"},
    {"name_en": "Marketing campaigns", "name_de": "Marketing-Kampagnen"},
    {"name_en": "Creating presentations", "name_de": "Erstellung von Präsentationen"},
    {"name_en": "Public Speaking", "name_de": "Reden halten"},
    {"name_en": "Journalism", "name_de": "Journalismus"},
    {"name_en": "Social Media", "name_de": "Social Media"},
    {
        "name_en": "Automated Marketing Software",
        "name_de": "Software für automatisiertes Marketing",
    },
    {
        "name_en": "Email Marketing (Newsletters)",
        "name_de": "E-Mail-Marketing (Newsletter)",
    },
    {"name_en": "Website Analytics", "name_de": "Website Analytics"},
    {
        "name_en": "Search Engine Optimization (SEO)",
        "name_de": "Search Engine Optimization (SEO)",
    },
    {"name_en": "Languages", "name_de": "Sprachen"},
    {"name_en": "Event planning", "name_de": "Veranstaltungsplanung"},
    {"name_en": "Management", "name_de": "Management"},
    {"name_en": "Business Management", "name_de": "Unternehmensführung"},
    {"name_en": "Human Resources", "name_de": "Personalwesen"},
    {"name_en": "Compliance", "name_de": "Compliance"},
    {"name_en": "Product Management", "name_de": "Produktmanagement"},
    {"name_en": "Project Management", "name_de": "Projektleitung"},
    {"name_en": "Administration", "name_de": "Verwaltung"},
    {"name_en": "Strategic Planning", "name_de": "Strategische Planung"},
    {"name_en": "Risk Management", "name_de": "Risikomanagement"},
    {"name_en": "Scheduling", "name_de": "Terminierung"},
    {"name_en": "Business & finance", "name_de": "Wirtschaft & Finanzen"},
    {"name_en": "Insurance", "name_de": "Versicherung"},
    {"name_en": "Budgeting", "name_de": "Budgetierung"},
    {"name_en": "Accounting", "name_de": "Rechnungsführung"},
    {"name_en": "Bookkeeping", "name_de": "Buchhaltung"},
    {"name_en": "Market Research", "name_de": "Marktforschung"},
    {"name_en": "Business Analysis", "name_de": "Business Analysis"},
    {"name_en": "Business Development", "name_de": "Geschäftsentwicklung"},
    {"name_en": "Quality Control", "name_de": "Qualitätskontrolle"},
    {"name_en": "Networking", "name_de": "Netzwerken"},
    {"name_en": "Logical Thinking", "name_de": "Logisches Denken"},
    {"name_en": "Negotiation", "name_de": "Verhandlungen"},
    {"name_en": "Statistics & Analysis", "name_de": "Statistik & Analyse"},
    {"name_en": "Business Strategy", "name_de": "Geschäftsstrategie"},
    {"name_en": "Productivity Software", "name_de": "Produktivitätssoftware"},
    {
        "name_en": "Spreadsheeting software",
        "name_de": "Software für Tabellenkalkulation",
    },
    {"name_en": "Text software", "name_de": "Text-Software"},
    {"name_en": "Presentation software", "name_de": "Präsentations-Software"},
    {"name_en": "CRM", "name_de": "CRM"},
    {"name_en": "Project Management software", "name_de": "Projektmanagementsoftware"},
    {"name_en": "Creative work", "name_de": "Kreatives Arbeiten"},
    {"name_en": "Web Design", "name_de": "Web Design"},
    {"name_en": "Application Design", "name_de": "App Design"},
    {"name_en": "Product Design", "name_de": "Produktdesign"},
    {"name_en": "Photography", "name_de": "Fotografie"},
    {"name_en": "Photo editing", "name_de": "Fotobearbeitung"},
    {"name_en": "Filming", "name_de": "Verfilmung"},
    {"name_en": "Video editing", "name_de": "Videobearbeitung"},
    {"name_en": "Illustration", "name_de": "Illustration"},
    {"name_en": "Animation", "name_de": "Animation"},
    {"name_en": "Print design", "name_de": "Print Design"},
    {"name_en": "Writing", "name_de": "Schreiben"},
    {"name_en": "IT & Programming", "name_de": "IT & Programmierung"},
    {"name_en": "Cybersecurity", "name_de": "Cybersecurity"},
    {"name_en": "DevOps", "name_de": "DevOps"},
    {"name_en": "Website Development", "name_de": "Webentwicklung"},
    {"name_en": "App Development: IOS", "name_de": "App-Entwicklung: IOS"},
    {"name_en": "App Development: Android", "name_de": "App-Entwicklung: Android"},
    {
        "name_en": "Analytics and data management",
        "name_de": "Analytics und Datenmanagement",
    },
    {"name_en": "Machine learning", "name_de": "Maschinelles Lernen"},
    {"name_en": "Tech support", "name_de": "Technischer Support"},
    {"name_en": "Software testing", "name_de": "Softwaretest"},
    {"name_en": "Software engineering", "name_de": "Softwareentwicklung"},
    {"name_en": "Databases & Big Data", "name_de": "Datenbanken & Big Data"},
    {"name_en": "SQL databases", "name_de": "SQL-Datenbanken"},
    {"name_en": "Non-SQL databases", "name_de": "Non-SQL-Datenbanken"},
    {"name_en": "Big Data", "name_de": "Big Data"},
    {"name_en": "Data analysis", "name_de": "Datenanalyse"},
    {"name_en": "Data Mining", "name_de": "Data Mining"},
    {"name_en": "Data Visualization", "name_de": "Datenvisualisierung"},
    {"name_en": "Manual Competencies", "name_de": "Handwerkliche Fähigkeiten"},
    {"name_en": "Electrical", "name_de": "Elektriker-Tätigkeiten"},
    {"name_en": "Plumbing", "name_de": "Klempnerarbeiten"},
    {"name_en": "Gardening", "name_de": "Gartenarbeit"},
    {"name_en": "Farming", "name_de": "Landwirtschaft"},
    {"name_en": "Upcycling", "name_de": "Upcycling"},
    {"name_en": "DIY / Restoration", "name_de": "DIY / Restaurierung"},
    {"name_en": "Manufacturing", "name_de": "Fertigung"},
    {"name_en": "Other", "name_de": "Andere"},
    {"name_en": "Education", "name_de": "Bildung"},
    {"name_en": "Psychology", "name_de": "Psychologie"},
    {"name_en": "Teaching", "name_de": "Lehre"},
    {
        "name_en": "Climate change sensibilisation",
        "name_de": "Sensibilisierung für den Klimawandel",
    },
    {"name_en": "Law & Legislation", "name_de": "Recht & Gesetzgebung"},
    {"name_en": "Law", "name_de": "Recht"},
    {"name_en": "Legislation", "name_de": "Gesetzgebung"},
    {"name_en": "Data protection", "name_de": "Datenschutz"},
    {"name_en": "Intellectual Property", "name_de": "Geistiges Eigentum"},
    {"name_en": "Tax law", "name_de": "Steuerrecht"},
    {"name_en": "International law", "name_de": "Internationales Recht"},
    {"name_en": "Environmental Law", "name_de": "Umweltrecht"},
    {"name_en": "Non-profit law", "name_de": "Gemeinnützigkeitsrecht"},
    {"name_en": "Business Law", "name_de": "Wirtschaftsrecht"},
    {"name_en": "Policy Analysis", "name_de": "Politikanalyse"},
    {"name_en": "Industry", "name_de": "Industrie"},
    {"name_en": "Industrial design", "name_de": "Industriedesign"},
    {"name_en": "Industrial safety", "name_de": "Arbeitssicherheit"},
    {
        "name_en": "Industrial process management",
        "name_de": "Industrielles Prozessmanagement",
    },
    {"name_en": "Industrial automatisation", "name_de": "Industrieautomatisierung"},
    {"name_en": "Industrial planning", "name_de": "Industrieplanung"},
    {
        "name_en": "Industrial process control",
        "name_de": "Industrielle Prozesssteuerung",
    },
    {"name_en": "Supply chain management", "name_de": "Supply Chain Management"},
    {"name_en": "Environment", "name_de": "Umwelt"},
    {"name_en": "Forest management", "name_de": "Forstwirtschaft"},
    {
        "name_en": "Waste and pollution management",
        "name_de": "Abfall- und Verschmutzungsmanagement",
    },
    {"name_en": "Sustainable development", "name_de": "Nachhaltige Entwicklung"},
    {"name_en": "EHS", "name_de": "EHS"},
    {"name_en": "Energy", "name_de": "Energie"},
    {
        "name_en": "Energy perfomance optimisation",
        "name_de": "Optimierung von Energieeffizienz",
    },
    {
        "name_en": "Energy policy compliance",
        "name_de": "Compliance in der Energiegesetzgebung",
    },
    {"name_en": "Energy diagnostic", "name_de": "Energy diagnostic"},
    {"name_en": "Electrical network maintenance", "name_de": "Elektrische Netzwartung"},
    {
        "name_en": "Renewable energy expertise",
        "name_de": "Expertise für erneuerbare Energien",
    },
    {"name_en": "Food & Resources", "name_de": "Lebensmittel & Ressourcen"},
    {"name_en": "Agriculture", "name_de": "Landwirtschaft"},
    {"name_en": "Livestock farming", "name_de": "Viehzucht"},
    {"name_en": "Water management", "name_de": "Wasserwirtschaft"},
    {"name_en": "Food technology", "name_de": "Lebensmitteltechnologie"},
    {"name_en": "Transport & logistic", "name_de": "Transport & Logistik"},
    {
        "name_en": "Air and space transport expertise",
        "name_de": "Kompetenz in Luft- und Raumfahrt",
    },
    {"name_en": "Land transport expertise", "name_de": "Kompetenz im Landverkehr"},
    {"name_en": "Water transport expertise", "name_de": "Kompetenz im Wassertransport"},
    {"name_en": "Logistic", "name_de": "Logistik"},
    {
        "name_en": "Transport infrastructure expertise",
        "name_de": "Expertise in Verkehrsinfrastruktur",
    },
    {"name_en": "Science & Research", "name_de": "Wissenschaft & Forschung"},
    {"name_en": "Humanities", "name_de": "Geisteswissenschaften"},
    {
        "name_en": "Social and behavioural sciences",
        "name_de": "Sozial- und Verhaltenswissenschaften",
    },
    {"name_en": "Chemistry", "name_de": "Chemie"},
    {"name_en": "Physics and mathematics", "name_de": "Physik und Mathematik"},
    {"name_en": "Earth Science", "name_de": "Geowissenschaft"},
    {"name_en": "Life Science", "name_de": "Biowissenschaften"},
    {"name_en": "Engineering Science", "name_de": "Ingenieurwissenschaft"},
    {"name_en": "Climate Science", "name_de": "Klimawissenschaft"},
    {"name_en": "Scientific research", "name_de": "Wissenschaftliche Forschung"},
    {"name_en": "Construction", "name_de": "Bau"},
    {"name_en": "Archictecture", "name_de": "Architektur"},
    {"name_en": "Statics", "name_de": "Statik"},
    {"name_en": "Construction", "name_de": "Bau"},
    {"name_en": "Urbanism", "name_de": "Urbanismus"},
    {"name_en": "Infrastructure", "name_de": "Infrastruktur"},
]

organizationtags_translation_map = [
    {"name_en": "Volunteer group", "name_de": "Ehrenamtliche Gruppe"},
    {"name_en": "NGO", "name_de": "Nichtregierungsorganisation"},
    {"name_en": "Student organization", "name_de": "Hochschulgruppe"},
    {"name_en": "Social movement", "name_de": "Soziale Bewegung"},
    {"name_en": "For-profit company", "name_de": "Unternehmen"},
    {"name_en": "Non-profit company", "name_de": "Gemeinnütziges Unternehmen"},
    {"name_en": "Governmental organization", "name_de": "Staatliche Organisation"},
    {"name_en": "City government", "name_de": "Stadtregierung"},
    {"name_en": "State", "name_de": "Landesregierung"},
    {"name_en": "Federal government", "name_de": "Staatsregierung"},
    {
        "name_en": "Intergovernmental organization",
        "name_de": "Transnationale Organisation",
    },
    {"name_en": "Educational facility", "name_de": "Bildungseinrichtung"},
    {"name_en": "Research facility", "name_de": "Forschungseinrichtung"},
    {"name_en": "Association", "name_de": "Verein"},
    {"name_en": "Political party", "name_de": "Politische Partei"},
    {"name_en": "Public institution", "name_de": "Öffentliche Einrichtung"},
]


class Command(BaseCommand):
    help = "Migrate tables to multilanguage system"

    def handle(self, *args: Any, **options: Any) -> None:
        for skill in skills_translation_map:
            print(skill["name_en"])
            query_result = Skill.objects.filter(name=skill["name_en"])
            if query_result.exists():
                cur_skill = query_result[0]
                cur_skill.name_de_translation = skill["name_de"]
                cur_skill.save()
            print(
                "Added translations to "
                + str(skills_translation_map.index(skill))
                + " out of "
                + str(len(skills_translation_map))
                + " skills."
            )

        for tag in organizationtags_translation_map:
            print(tag["name_en"])
            query_result = OrganizationTags.objects.filter(name=tag["name_en"])
            if query_result.exists():
                cur_tag = query_result[0]
                cur_tag.name_de_translation = tag["name_de"]
                cur_tag.save()
            print(
                "Added translations to "
                + str(organizationtags_translation_map.index(tag))
                + " out of "
                + str(len(organizationtags_translation_map))
                + " organization tags."
            )
