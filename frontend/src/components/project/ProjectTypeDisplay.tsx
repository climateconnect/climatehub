import { Typography, Tooltip } from "@mui/material";
import { styled } from "@mui/material/styles";
import LayersIcon from "@mui/icons-material/Layers";
import React, { useContext } from "react";
import getTexts from "../../../public/texts/texts";
import UserContext from "../context/UserContext";

const Root = styled("div")({
  display: "flex",
  alignItems: "center",
});

// The default icon size is only applied when no `iconClassName` is passed.
const TypeIcon = styled("img", {
  shouldForwardProp: (prop) => !(prop as string).startsWith("$"),
})<{ $useDefaultStyles: boolean }>(({ $useDefaultStyles }) =>
  $useDefaultStyles
    ? {
        width: 20,
        height: 20,
        marginLeft: 0,
        marginRight: 8,
      }
    : {}
);

const StyledLayersIcon = styled(LayersIcon)(({ theme }) => ({
  fontSize: 18,
  marginLeft: 4,
  color: theme.palette.primary.main,
}));

type Props = {
  projectType: any; //TODO: create projectType type
  className?: any;
  iconClassName?: any;
  textClassName?: any;
  hasChildren?: boolean;
};

export default function ProjectTypeDisplay({
  projectType,
  className,
  iconClassName,
  textClassName,
  hasChildren,
}: Props) {
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "project", locale: locale });

  // Get the localized name based on type_id
  const getLocalizedTypeName = () => {
    if (projectType?.type_id) {
      const translationKey = `project_type_${projectType.type_id}`;
      return texts[translationKey] || projectType.name;
    }
    return projectType?.name || "";
  };

  const typeName = getLocalizedTypeName();

  return (
    <Root className={className}>
      <TypeIcon
        src={`/images/project_types/${projectType.type_id}.png`}
        className={iconClassName}
        $useDefaultStyles={!iconClassName}
        alt={typeName}
      />
      <Typography className={textClassName}>{typeName}</Typography>
      {hasChildren && (
        <Tooltip title="This event contains multiple sub-events">
          <StyledLayersIcon />
        </Tooltip>
      )}
    </Root>
  );
}
