from organization.models.members import ProjectMember
from climateconnect_api.models.language import Language
from organization.models.tags import OrganizationTags
from organization.models.project import ProjectParents
from django.core.management.base import BaseCommand
import random

from django.utils import timezone
from django.contrib.auth.models import User

from climateconnect_api.models import (
    Availability,
    Role,
    UserProfile,
    Skill,
)
from organization.models import Project, Organization, ProjectSectorMapping, Sector


def create_language_test_data():
    print("creating languages...")
    if not Language.objects.filter(language_code="en").exists():
        Language.objects.create(
            name="english", native_name="english", language_code="en", currency="$"
        )
        print("English language created")
    else:
        print("English language already exists")

    if not Language.objects.filter(language_code="de").exists():
        Language.objects.create(
            name="german", native_name="Deutsch", language_code="de", currency="€"
        )
        print("German language created")
    else:
        print("German language already exists")


def create_test_user_data(number_of_rows: int):
    print("Creating users...")
    english_language = Language.objects.filter(language_code="en")[0]
    for i in range(number_of_rows):
        username = "test{}@test.com".format(i)
        name = "test {}".format(i)
        url_slug = name.replace(" ", "")
        if not User.objects.filter(email=username).exists():
            user = User.objects.create(
                username=username, email=username, first_name="Test", last_name=str(i)
            )
            UserProfile.objects.create(
                user=user,
                name=name,
                url_slug=url_slug,
                country="Germany",
                is_profile_verified=True,
                city="Test {}".format(i),
                language=english_language,
            )
            print("{} User created".format(username))
        else:
            print("{} User already exists".format(username))


def create_availability_test_data(number_of_rows: int):
    # Based on number of rows you can create test data for availability table.
    print("Creating user availabilities...")
    for i in range(number_of_rows):
        name = "{}-{} hours per week".format(i, i + 1)
        key = name.replace(" ", "")
        if not Availability.objects.filter(name=name).exists():
            Availability.objects.create(name=name, key=key)
        else:
            print("{} user availability already exists.".format(name))


def create_roles_test_data():
    # Creating 2 roles here
    print("Creating project roles...")

    if not Role.objects.filter(name="Super-Admin").exists():
        Role.objects.create(name="Super-Admin", role_type=Role.ALL_TYPE)
        print("Super-Admin role is successfully created.")
    else:
        print("Super-Admin role already exists.")

    if not Role.objects.filter(name="Member").exists():
        Role.objects.create(name="Member", role_type=Role.READ_ONLY_TYPE)
        print("Member role successfully created.")
    else:
        print("Member role already exists.")

    if not Role.objects.filter(name="Administrator").exists():
        Role.objects.create(name="Administrator", role_type=Role.READ_WRITE_TYPE)
        print("Administrator role successfully created.")
    else:
        print("Administrator role already exists.")


def create_organization_test_data(number_of_rows: int):
    print("Creating orgranization data...")
    english_language = Language.objects.filter(language_code="en")[0]
    for i in range(number_of_rows):
        name = "Test Org {}".format(i)
        url_slug = name.replace(" ", "")
        if not Organization.objects.filter(name=name).exists():
            Organization.objects.create(
                name=name,
                url_slug=url_slug,
                country="Germany",
                short_description="This is a test organization",
                city="Test {}".format(i),
                language=english_language,
            )
            print("{} organization created.".format(name))
        else:
            print("{} orgranization already exists.".format(name))


# Mirrors the real sector taxonomy (name/key/translation as they exist in
# production) so that seeded projects line up with the sector filters and the
# sector hubs instead of inventing a parallel set of test-only sectors.
TEST_SECTOR_DEFINITIONS = [
    {
        "key": "food",
        "name": "Food & Agriculture",
        "name_de_translation": "Ernährung & Landwirtschaft",
    },
    {"key": "energy", "name": "Energy", "name_de_translation": "Energie"},
    {"key": "mobility", "name": "Mobility", "name_de_translation": "Mobilität"},
    {"key": "education", "name": "Education", "name_de_translation": "Bildung"},
    {
        "key": "nature",
        "name": "Nature & Biodiversity",
        "name_de_translation": "Natur und Biodiversität",
    },
]


def create_sectors_test_data():
    print("Creating sector test data...")
    for definition in TEST_SECTOR_DEFINITIONS:
        if not Sector.objects.filter(key=definition["key"]).exists():
            Sector.objects.create(**definition)
            print("{} sector created.".format(definition["name"]))
        else:
            print("{} sector already exists.".format(definition["name"]))
    print("finished creating sector test data!")


def create_organization_tags_test_data():
    print("Creating organization tags test data...")
    if not OrganizationTags.objects.filter(name="Volunteer group").exists():
        OrganizationTags.objects.create(
            name="Volunteer group",
            name_de_translation="Ehrenamtliche Gruppe",
            show_in_climatematch=True,
            key="volunteergroup",
        )
    if not OrganizationTags.objects.filter(name="Non-profit company").exists():
        OrganizationTags.objects.create(
            name="Non-profit company",
            name_de_translation="non-profitcompany",
            show_in_climatematch=True,
            key="encouragingaplantbasedlifestyle",
        )
    print("finished creating organization tags test data!")


def create_project_test_data(number_of_rows: int):
    print("Creating project data...")
    english_language = Language.objects.filter(language_code="en")[0]
    sectors = list(
        Sector.objects.filter(
            key__in=[definition["key"] for definition in TEST_SECTOR_DEFINITIONS]
        )
    )
    if not sectors:
        print("No test sectors found - run create_sectors_test_data() first.")

    for i in range(number_of_rows):
        name = "Test project {}".format(i)
        url_slug = name.replace(" ", "")

        if not Project.objects.filter(name=name).exists():
            # Buffer some start date to create more
            # sense of older projects. This originated out of
            # fixing a bug around the "timeago" utility, where
            # timeago would round up to 2 years, when a project
            # is only 1 year and 1 day old. This should create the
            # UTC timestamp, e.g. 2020-02-04T01:33:45.276997Z
            one_year_and_one_day_ago = timezone.now() - timezone.timedelta(days=366)

            project = Project.objects.create(
                name=name,
                city="Test {}".format(i),
                collaborators_welcome=True,
                country="Germany",
                short_description="This is a test project.",
                start_date=one_year_and_one_day_ago,
                url_slug=url_slug,
                language=english_language,
            )

            parent_user = UserProfile.objects.all()[i].user

            ProjectParents.objects.create(project=project, parent_user=parent_user)
            admin_role = Role.objects.get(role_type=Role.ALL_TYPE)
            all_availabilities = list(Availability.objects.all())
            example_availability = random.choice(all_availabilities)
            ProjectMember.objects.create(
                project=project,
                user=parent_user,
                role=admin_role,
                availability=example_availability,
                role_in_project="Project manager",
            )

            # Spread the seeded sectors over the projects so that sector filters
            # and the "total_sectors" ranking factor have something to work with.
            # Every third project gets a second sector so that the ordering of
            # multiple sectors is exercised too.
            if sectors:
                project_sectors = [sectors[i % len(sectors)]]
                if i % 3 == 0 and len(sectors) > 1:
                    project_sectors.append(sectors[(i + 1) % len(sectors)])
                ProjectSectorMapping.objects.bulk_create(
                    [
                        # the bigger the order, the further to the top a sector
                        # is displayed - so the first one gets the highest value
                        ProjectSectorMapping(
                            project=project,
                            sector=sector,
                            order=len(project_sectors) - index,
                        )
                        for index, sector in enumerate(project_sectors)
                    ]
                )

            print("{} project created.".format(name))
        else:
            print("{} project already exists.".format(name))


def create_skills():
    skills = [
        {"id": 3, "name": "Communication & Marketing", "parent_skill_id": None},
        {"id": 4, "name": "Advertising", "parent_skill_id": 3},
        {"id": 5, "name": "Business Storytelling", "parent_skill_id": 3},
        {"id": 6, "name": "Written Communication", "parent_skill_id": 3},
        {"id": 7, "name": "Customer Service", "parent_skill_id": 3},
        {"id": 8, "name": "Digital Media", "parent_skill_id": 3},
        {"id": 9, "name": "Marketing campaigns", "parent_skill_id": 3},
        {"id": 10, "name": "Creating presentations", "parent_skill_id": 3},
        {"id": 11, "name": "Public Speaking", "parent_skill_id": 3},
        {"id": 12, "name": "Journalism", "parent_skill_id": 3},
        {"id": 13, "name": "Social Media", "parent_skill_id": 3},
        {"id": 14, "name": "Automated Marketing Software", "parent_skill_id": 3},
        {"id": 15, "name": "Email Marketing (Newsletters)", "parent_skill_id": 3},
        {"id": 16, "name": "Website Analytics", "parent_skill_id": 3},
        {"id": 17, "name": "Search Engine Optimization (SEO)", "parent_skill_id": 3},
        {"id": 18, "name": "Languages", "parent_skill_id": 3},
        {"id": 19, "name": "Event planning", "parent_skill_id": 3},
        {"id": 20, "name": "Management", "parent_skill_id": None},
        {"id": 21, "name": "Business Management", "parent_skill_id": 20},
        {"id": 22, "name": "Human Resources", "parent_skill_id": 20},
        {"id": 23, "name": "Compliance", "parent_skill_id": 20},
        {"id": 24, "name": "Product Management", "parent_skill_id": 20},
        {"id": 25, "name": "Project Management", "parent_skill_id": 20},
        {"id": 26, "name": "Administration", "parent_skill_id": 20},
        {"id": 27, "name": "Strategic Planning", "parent_skill_id": 20},
        {"id": 28, "name": "Risk Management", "parent_skill_id": 20},
        {"id": 29, "name": "Scheduling", "parent_skill_id": 20},
        {"id": 30, "name": "Business & finance", "parent_skill_id": None},
        {"id": 31, "name": "Insurance", "parent_skill_id": 30},
        {"id": 32, "name": "Budgeting", "parent_skill_id": 30},
        {"id": 33, "name": "Accounting", "parent_skill_id": 30},
        {"id": 34, "name": "Bookkeeping", "parent_skill_id": 30},
        {"id": 35, "name": "Market Research", "parent_skill_id": 30},
        {"id": 36, "name": "Business Analysis", "parent_skill_id": 30},
        {"id": 37, "name": "Business Development", "parent_skill_id": 30},
        {"id": 38, "name": "Quality Control", "parent_skill_id": 30},
        {"id": 39, "name": "Networking", "parent_skill_id": 30},
        {"id": 40, "name": "Logical Thinking", "parent_skill_id": 30},
        {"id": 41, "name": "Negotiation", "parent_skill_id": 30},
        {"id": 42, "name": "Statistics & Analysis", "parent_skill_id": 30},
        {"id": 43, "name": "Business Analysis", "parent_skill_id": 30},
        {"id": 44, "name": "Business Strategy", "parent_skill_id": 30},
        {"id": 45, "name": "Productivity Software", "parent_skill_id": None},
        {"id": 46, "name": "Spreadsheeting software", "parent_skill_id": 45},
        {"id": 47, "name": "Text software", "parent_skill_id": 45},
        {"id": 48, "name": "Presentation software", "parent_skill_id": 45},
        {"id": 49, "name": "CRM", "parent_skill_id": 45},
        {"id": 50, "name": "Project Management software", "parent_skill_id": 45},
        {"id": 51, "name": "Creative work", "parent_skill_id": None},
        {"id": 52, "name": "Web Design", "parent_skill_id": 51},
        {"id": 53, "name": "Application Design", "parent_skill_id": 51},
        {"id": 54, "name": "Product Design", "parent_skill_id": 51},
        {"id": 55, "name": "Photography", "parent_skill_id": 51},
        {"id": 56, "name": "Photo editing", "parent_skill_id": 51},
        {"id": 57, "name": "Filming", "parent_skill_id": 51},
        {"id": 58, "name": "Video editing", "parent_skill_id": 51},
        {"id": 59, "name": "Illustration", "parent_skill_id": 51},
        {"id": 60, "name": "Animation", "parent_skill_id": 51},
        {"id": 61, "name": "Print design", "parent_skill_id": 51},
        {"id": 62, "name": "Writing", "parent_skill_id": 51},
        {"id": 63, "name": "IT & Programming", "parent_skill_id": None},
        {"id": 64, "name": "Cybersecurity", "parent_skill_id": 63},
        {"id": 65, "name": "DevOps", "parent_skill_id": 63},
        {"id": 66, "name": "Website Development", "parent_skill_id": 63},
        {"id": 68, "name": "App Development: IOS", "parent_skill_id": 63},
        {"id": 69, "name": "App Development: Android", "parent_skill_id": 63},
        {"id": 70, "name": "Analytics and data management", "parent_skill_id": 63},
        {"id": 71, "name": "Machine learning", "parent_skill_id": 63},
        {"id": 72, "name": "Tech support", "parent_skill_id": 63},
        {"id": 73, "name": "Software testing", "parent_skill_id": 63},
        {"id": 74, "name": "Software engineering", "parent_skill_id": 63},
        {"id": 75, "name": "Databases & Big Data", "parent_skill_id": None},
        {"id": 76, "name": "SQL databases", "parent_skill_id": 75},
        {"id": 77, "name": "Non-SQL databases", "parent_skill_id": 75},
        {"id": 78, "name": "Big Data", "parent_skill_id": 75},
        {"id": 79, "name": "Data analysis", "parent_skill_id": 75},
        {"id": 80, "name": "Data Mining", "parent_skill_id": 75},
        {"id": 81, "name": "Data Visualization", "parent_skill_id": 75},
        {"id": 82, "name": "Manual Competencies", "parent_skill_id": None},
        {"id": 83, "name": "Electrical", "parent_skill_id": 82},
        {"id": 84, "name": "Plumbing", "parent_skill_id": 82},
        {"id": 85, "name": "Gardening", "parent_skill_id": 82},
        {"id": 86, "name": "Farming", "parent_skill_id": 82},
        {"id": 87, "name": "Upcycling", "parent_skill_id": 82},
        {"id": 88, "name": "DIY / Restoration", "parent_skill_id": 82},
        {"id": 89, "name": "Manufacturing", "parent_skill_id": 82},
        {"id": 90, "name": "Other", "parent_skill_id": 82},
        {"id": 91, "name": "Education", "parent_skill_id": None},
        {"id": 92, "name": "Psychology", "parent_skill_id": 91},
        {"id": 93, "name": "Teaching", "parent_skill_id": 91},
        {"id": 94, "name": "Climate change sensibilisation", "parent_skill_id": 91},
        {"id": 95, "name": "Law & Legislation", "parent_skill_id": None},
        {"id": 96, "name": "Law", "parent_skill_id": 95},
        {"id": 97, "name": "Legislation", "parent_skill_id": 96},
        {"id": 98, "name": "Data protection", "parent_skill_id": 95},
        {"id": 99, "name": "Intellectual Property", "parent_skill_id": 95},
        {"id": 100, "name": "Tax law", "parent_skill_id": 95},
        {"id": 101, "name": "International law", "parent_skill_id": 95},
        {"id": 102, "name": "Environmental Law", "parent_skill_id": 95},
        {"id": 103, "name": "Non-profit law", "parent_skill_id": 95},
        {"id": 104, "name": "Business Law", "parent_skill_id": 95},
        {"id": 105, "name": "Policy Analysis", "parent_skill_id": 95},
        {"id": 106, "name": "Industry", "parent_skill_id": None},
        {"id": 107, "name": "Industrial design", "parent_skill_id": 106},
        {"id": 108, "name": "Industrial safety", "parent_skill_id": 106},
        {"id": 109, "name": "Industrial process management", "parent_skill_id": 106},
        {"id": 110, "name": "Industrial automatisation", "parent_skill_id": 106},
        {"id": 111, "name": "Industrial planning", "parent_skill_id": 106},
        {"id": 112, "name": "Industrial process control", "parent_skill_id": 106},
        {"id": 113, "name": "Supply chain management", "parent_skill_id": 106},
        {"id": 114, "name": "Environment", "parent_skill_id": None},
        {"id": 115, "name": "Forest management", "parent_skill_id": 114},
        {"id": 116, "name": "Waste and pollution management", "parent_skill_id": 114},
        {"id": 117, "name": "Sustainable development", "parent_skill_id": 114},
        {"id": 118, "name": "EHS", "parent_skill_id": 114},
        {"id": 119, "name": "Energy", "parent_skill_id": None},
        {"id": 120, "name": "Energy perfomance optimisation", "parent_skill_id": 119},
        {"id": 121, "name": "Energy policy compliance", "parent_skill_id": 119},
        {"id": 122, "name": "Energy diagnostic", "parent_skill_id": 119},
        {"id": 123, "name": "Electrical network maintenance", "parent_skill_id": 119},
        {"id": 124, "name": "Renewable energy expertise", "parent_skill_id": 119},
        {"id": 125, "name": "Food & Resources", "parent_skill_id": None},
        {"id": 126, "name": "Agriculture", "parent_skill_id": 125},
        {"id": 127, "name": "Livestock farming", "parent_skill_id": 125},
        {"id": 128, "name": "Water management", "parent_skill_id": 125},
        {"id": 129, "name": "Food technology", "parent_skill_id": 125},
        {"id": 130, "name": "Transport & logistic", "parent_skill_id": None},
        {
            "id": 131,
            "name": "Air and space transport expertise",
            "parent_skill_id": 130,
        },
        {"id": 132, "name": "Land transport expertise", "parent_skill_id": 130},
        {"id": 133, "name": "Water transport expertise", "parent_skill_id": 130},
        {"id": 134, "name": "Logistic", "parent_skill_id": 130},
        {
            "id": 135,
            "name": "Transport infrastructure expertise",
            "parent_skill_id": 130,
        },
        {"id": 136, "name": "Science & Research", "parent_skill_id": None},
        {"id": 137, "name": "Humanities", "parent_skill_id": 136},
        {"id": 138, "name": "Social and behavioural sciences", "parent_skill_id": 136},
        {"id": 139, "name": "Chemistry", "parent_skill_id": 136},
        {"id": 140, "name": "Physics and mathematics", "parent_skill_id": 136},
        {"id": 141, "name": "Earth Science", "parent_skill_id": 136},
        {"id": 142, "name": "Life Science", "parent_skill_id": 136},
        {"id": 143, "name": "Engineering Science", "parent_skill_id": 136},
        {"id": 144, "name": "Climate Science", "parent_skill_id": 136},
        {"id": 145, "name": "Scientific research", "parent_skill_id": 136},
        {"id": 146, "name": "Construction", "parent_skill_id": None},
        {"id": 147, "name": "Archictecture", "parent_skill_id": 146},
        {"id": 148, "name": "Statics", "parent_skill_id": 146},
        {"id": 149, "name": "Construction", "parent_skill_id": 146},
        {"id": 150, "name": "Urbanism", "parent_skill_id": 146},
        {"id": 151, "name": "Infrastructure", "parent_skill_id": 146},
    ]

    for skill_record in skills:
        if not Skill.objects.filter(name=skill_record["name"]).exists():
            Skill.objects.create(
                id=skill_record["id"],
                name=skill_record["name"],
                created_at=timezone.now(),
                updated_at=timezone.now(),
                parent_skill_id=skill_record["parent_skill_id"],
            )


class Command(BaseCommand):
    help = "Creates test data of user's availability to volunteer to an organization."

    def add_arguments(self, parser) -> None:
        parser.add_argument("--number_of_rows", dest="number_of_rows", type=int)

    def handle(self, *args, **options) -> str:
        number_of_rows = options["number_of_rows"]

        create_language_test_data()
        create_test_user_data(number_of_rows=number_of_rows)
        create_availability_test_data(number_of_rows=number_of_rows)
        create_roles_test_data()
        create_organization_test_data(number_of_rows=number_of_rows)
        create_sectors_test_data()
        create_organization_tags_test_data()
        create_project_test_data(number_of_rows=number_of_rows)
        create_skills()
