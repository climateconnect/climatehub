export type ProjectType = {
  type_id: string;
  name: string;
  original_name: string;
  help_text: string;
  icon: string;
};

const PROJECT_TYPES: ProjectType[] = [
  {
    type_id: "idea",
    name: "Idea",
    original_name: "Idea",
    help_text: "Share your climate idea to find help and knowledge",
    icon: "",
  },
  {
    type_id: "event",
    name: "Event",
    original_name: "Event",
    help_text: "Your Project will show up in the Event calendar",
    icon: "",
  },
  {
    type_id: "project",
    name: "Project",
    original_name: "Project",
    help_text: "Not an Idea or Event? Click here.",
    icon: "",
  },
];

const PROJECT_TYPES_DE: ProjectType[] = [
  {
    type_id: "idea",
    name: "Idee",
    original_name: "Idea",
    help_text: "Teile deine Klimaidee, um Mitstreiter:innen zu finden",
    icon: "",
  },
  {
    type_id: "event",
    name: "Event",
    original_name: "Event",
    help_text: "Dein Projekt wird im Eventkalender angezeigt",
    icon: "",
  },
  {
    type_id: "project",
    name: "Projekt",
    original_name: "Project",
    help_text: "Keine Idee oder Event? Klick hier!",
    icon: "",
  },
];

export function getProjectTypes(locale?: string): ProjectType[] {
  if (locale === "de") return PROJECT_TYPES_DE;
  return PROJECT_TYPES;
}
