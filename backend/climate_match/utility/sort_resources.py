from typing import List
from uuid import UUID

from django.contrib.auth.models import User
from django.db import connection


# TODO: when deleting ProjectTags, one should adjust the climate match sorting logic accordingly,
# as it uses project tags. One might need to add sector logic. Yet, climate match is not activly used
# and thus postponed.
def sort_user_resource_preferences(
    user: User, climatematch_token: UUID, hub_id: int
) -> List:
    user_resource_preferences = []
    if user.is_authenticated:
        personalized_filter = "user_id = {}".format(user.id)
    else:
        personalized_filter = "token = '{}'".format(climatematch_token)
    with connection.cursor() as cursor:
        cursor.execute(
            f"""
WITH hub_location_ids AS (
    SELECT location_id
    FROM hubs_hub_location
    WHERE hub_id= {hub_id}
),
projects AS (
    SELECT distinct OP.*, HLI.* FROM organization_project OP
    JOIN hub_location_ids HLI ON OP.loc_id = HLI.location_id
    WHERE is_draft = false
),
orgs AS (
    SELECT distinct O.*, HLI.*
    FROM organization_organization O
    JOIN hub_location_ids HLI ON O.location_id = HLI.location_id
    left JOIN organization_organizationtagging OTG ON OTG.organization_id = O.id
    left JOIN organization_organizationtags OTags ON OTags.id = OTG.organization_tag_id
    WHERE Otags.show_in_climatematch = true
),
ideas AS (
    SELECT *
    FROM ideas_idea
    JOIN hub_location_ids
    ON ideas_idea.location_id = hub_location_ids.location_id
),
get_user_resource_preference AS (
    select CMUQA.user_id as user_id
        , CMAMD.resource_type_id as resource_type_id
        , DCT.model as resource_model
        , sum(CMAMD.weight) as total_weight
    from climate_match_userquestionanswer CMUQA
    join climate_match_answer CMA on CMA.id = CMUQA.predefined_answer_id
    join climate_match_answer_answer_metadata CMAAMD on CMAAMD.answer_id = CMA.id
    join climate_match_answermetadata CMAMD on CMAMD.id = CMAAMD.answermetadata_id
    join django_content_type DCT on DCT.id = CMAMD.resource_type_id
    where CMUQA.predefined_answer_id is not null and CMUQA.{personalized_filter}
    group by 1, 2, 3
    order by total_weight desc
), get_user_skill_preference as (
    select cmu.user_id
        , cma.weight
        , cma.reference_id
        , cma.resource_type_id
        , dct.model
    from climate_match_userquestionanswer cmu
    join climate_match_userquestionanswer_answers cmua on cmua.userquestionanswer_id = cmu.id
    join climate_match_answermetadata cma on cma.id = cmua.answermetadata_id
    join django_content_type dct on dct.id = cma.resource_type_id
    where dct.model = 'skill' and cmu.{personalized_filter}
), get_user_hub_preference as (
    select cmu.user_id
        , cma.weight
        , cma.reference_id
        , cma.resource_type_id
        , dct.model
    from climate_match_userquestionanswer cmu
    join climate_match_userquestionanswer_answers cmua on cmua.userquestionanswer_id = cmu.id
    join climate_match_answermetadata cma on cma.id = cmua.answermetadata_id
    join django_content_type dct on dct.id = cma.resource_type_id
    where dct.model = 'hub' and cmu.{personalized_filter}
), get_user_reference_table_relevancy_score_by_skills AS (
    SELECT reference_table.table_name, reference_table.id as resource_id, SUM(coalesce (gusp.weight, 0)) as skill_weight
    FROM (
        (
            SELECT distinct op.id,
            CASE WHEN cs.parent_skill_id IS NULL
            THEN cs.id
            ELSE cs.parent_skill_id END as skill_id,
            'project' as table_name
            FROM projects op
            LEFT JOIN organization_project_skills ops on ops.project_id  = op.id
            LEFT JOIN climateconnect_skill cs on cs.id = ops.skill_id
        )
        union (
            SELECT distinct oo.id,
            CASE WHEN cs.parent_skill_id IS NULL
            THEN cs.id
            ELSE cs.parent_skill_id END as skill_id,
            'organization' as table_name
            FROM orgs oo
            LEFT JOIN organization_projectparents opp on opp.parent_organization_id = oo.id
            LEFT JOIN projects op on op.id = opp.project_id
            LEFT JOIN organization_project_skills ops on ops.project_id = op.id
            LEFT JOIN climateconnect_skill cs on cs.id = ops.skill_id
        )
    ) AS reference_table
    left join get_user_skill_preference as gusp on reference_table.skill_id = gusp.reference_id
    GROUP BY 1, 2
), get_user_reference_table_relevancy_score_by_hubs as (
    select reference_table.table_name, reference_table.id as resource_id, sum(coalesce (guhp.weight, 0)) as hub_weight
    from (
        (
            select op.id, hh.id as hub_id, 'project' as table_name
            from hubs_hub hh
            join hubs_hub_filter_parent_tags hhfpt on hhfpt.hub_id = hh.id
            join organization_projecttags optags on optags.id = hhfpt.projecttags_id
                or optags.parent_tag_id = hhfpt.projecttags_id
            join organization_projecttagging opt on opt.project_tag_id = optags.id
                or  opt.project_tag_id  = optags.parent_tag_id
            join projects op on op.id = opt.project_id
        ) union (
            select distinct oo.id, hh.id as hub_id, 'organization' as table_name
            from orgs oo
            left join organization_organization_hubs ooh on ooh.organization_id = oo.id
            left join hubs_hub hh on hh.id = ooh.hub_id
        ) union (
            select distinct ii.id, hh.id as hub_id, 'idea' as table_name
            from ideas ii
            join hubs_hub hh on hh.id = ii.hub_id
        )
    ) as reference_table
    left join get_user_hub_preference as guhp on reference_table.hub_id = guhp.reference_id
    group by 1, 2
), get_user_reference_relevancy_score as (
    select (
        case when gurtrs.resource_id is not null then gurtrs.resource_id else gurtrh.resource_id end
        ) as resource_id
        , (
        case when gurtrs.resource_id is not null then gurtrs.table_name else gurtrh.table_name end
        ) as table_name
        , sum(
            (
                case when gurtrs.skill_weight is not null and gurtrh.hub_weight is not null
                    then gurtrs.skill_weight + gurtrh.hub_weight
                when gurtrs.skill_weight is null and gurtrh.hub_weight is not null
                    then gurtrh.hub_weight
                when gurtrs.skill_weight is not null and gurtrh.hub_weight is null
                    then gurtrs.skill_weight
                else 0
                end
            ) +
            coalesce((
                select total_weight from get_user_resource_preference
                where resource_model = gurtrs.table_name
                    or resource_model = gurtrh.table_name
            ), 0)
        ) as total_score
    from get_user_reference_table_relevancy_score_by_skills as gurtrs
    full join get_user_reference_table_relevancy_score_by_hubs as gurtrh
        on gurtrh.resource_id = gurtrs.resource_id
            and gurtrh.table_name = gurtrs.table_name
    group by 1, 2
    order by total_score desc
)

select * from get_user_reference_relevancy_score;
        """
        )

        columns = [col[0] for col in cursor.description]
        user_resource_preferences = [
            dict(zip(columns, row)) for row in cursor.fetchall()
        ]

    return user_resource_preferences
