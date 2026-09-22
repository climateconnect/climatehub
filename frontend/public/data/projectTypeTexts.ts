export default function getProjectTypeTexts(texts) {
  return {
    name: {
      project: texts.project_name,
      idea: texts.idea_name,
      event: texts.event_name,
    },
    allow: {
      project: texts.allow_collaboration_on_your_project,
      idea: texts.are_you_looking_for_more_people_to_help_implement_the_idea,
      event: texts.are_you_looking_for_people_to_help_with_the_event,
    },
    connections: {
      project: texts.add_connections_that_would_be_beneficial_for_collaborators_to_have,
      idea: texts.add_connections_that_would_be_beneficial_for_collaborators_to_have_idea,
      event: texts.add_connections_that_would_be_beneficial_for_collaborators_to_have_event,
    },
    website: {
      project: texts.project_website,
      idea: texts.idea_website,
      event: texts.event_website,
    },
    website_helper: {
      project: texts.if_your_project_has_a_website_you_can_enter_it_here,
      idea: texts.if_your_idea_has_a_website_you_can_enter_it_here,
      event: texts.if_your_event_has_a_website_you_can_enter_it_here,
    },
    organizations: {
      project: texts.organizations_project,
      idea: texts.organizations_idea,
      event: texts.organizations_event,
    },
    personal: {
      project: texts.personal_project,
      idea: texts.personal_idea,
      event: texts.personal_event,
    },
    selectSector: {
      project: texts.select_1_to_3_sectors_that_fit_your_project,
      idea: texts.select_1_to_3_sectors_that_fit_your_idea,
      event: texts.select_1_to_3_sectors_that_fit_your_event,
    },
    addPhoto: {
      project: texts.add_photo_helptext_project,
      idea: texts.add_photo_helptext_idea,
      event: texts.add_photo_helptext_event,
    },
    shortDescription: {
      project: texts.short_description_helptext_project,
      idea: texts.short_description_helptext_idea,
      event: texts.short_description_helptext_event,
    },
    description: {
      project: texts.description_helptext_project,
      idea: texts.description_helptext_idea,
      event: texts.description_helptext_event,
    },
    collaboration: {
      project: texts.collaboration_helptext_project,
      idea: texts.collaboration_helptext_idea,
      event: texts.collaboration_helptext_event,
    },
    projectIsPartOfPrio1: {
      project: texts.my_project_is_part_of_the_prio1_project,
      idea: texts.my_idea_is_part_of_the_prio1_project,
      event: texts.my_event_is_part_of_the_prio1_project,
    },
    tooltipProjectIsPartOfPrio1: {
      project: texts.tooltip_my_project_is_part_of_the_prio1_project,
      idea: texts.tooltip_my_idea_is_part_of_the_prio1_project,
      event: texts.tooltip_my_event_is_part_of_the_prio1_project,
    },
    videoDescription: {
      project: texts.if_you_want_to_include_a_video_in_your_project_description,
      idea: texts.if_you_want_to_include_a_video_in_your_idea_description,
      event: texts.if_you_want_to_include_a_video_in_your_event_description,
    },
    searchMembers: {
      project: texts.use_the_search_bar_to_add_members_to_your_project,
      idea: texts.use_the_search_bar_to_add_members_to_your_idea,
      event: texts.use_the_search_bar_to_add_members_to_your_event,
    },
    deleteProject: {
      project: texts.delete_project,
      idea: texts.delete_idea,
      event: texts.delete_event,
    },
    draftProject: {
      project: texts.your_project_has_been_saved_as_a_draft,
      idea: texts.your_idea_has_been_saved_as_a_draft,
      event: texts.your_event_has_been_saved_as_a_draft,
    },
    editAndPublishDraftProject: {
      project: texts.you_can_view_edit_and_publish_your_project_drafts_in_the,
      idea: texts.you_can_view_edit_and_publish_your_idea_drafts_in_the,
      event: texts.you_can_view_edit_and_publish_your_event_drafts_in_the,
    },
    publishProject: {
      project: texts.congratulations_your_project_has_been_published,
      idea: texts.congratulations_your_idea_has_been_published,
      event: texts.congratulations_your_event_has_been_published,
    },
    viewProject: {
      project: texts.you_can_view_your_project_here,
      idea: texts.you_can_view_your_idea_here,
      event: texts.you_can_view_your_event_here,
    },
    yourPageTitle: {
      project: texts.your_page_title_project,
      idea: texts.your_page_title_idea,
      event: texts.your_page_title_event,
    },
    contentIsLiveHeadline: {
      project: texts.content_is_live_headline_project,
      idea: texts.content_is_live_headline_idea,
      event: texts.content_is_live_headline_event,
    },
    contentPreviewCaption: {
      project: texts.content_preview_caption_project,
      idea: texts.content_preview_caption_idea,
      event: texts.content_preview_caption_event,
    },
    shareCtaHeadline: {
      project: texts.share_cta_headline_project,
      idea: texts.share_cta_headline_idea,
      event: texts.share_cta_headline_event,
    },
    shareCtaSubtitle: {
      project: texts.share_cta_subtitle_project,
      idea: texts.share_cta_subtitle_idea,
      event: texts.share_cta_subtitle_event,
    },
    shareMessageTitle: {
      project: texts.share_own_content_message_title_project,
      idea: texts.share_own_content_message_title_idea,
      event: texts.share_own_content_message_title_event,
    },
  };
}
