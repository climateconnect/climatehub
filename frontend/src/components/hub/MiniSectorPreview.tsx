import { Card, IconButton, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import React, { useContext } from "react";
import { getImageUrl } from "../../../public/lib/imageOperations";
import getTexts from "../../../public/texts/texts";
import UserContext from "../context/UserContext";
import SelectField from "../general/SelectField";

const SectorCard = styled(Card, {
  shouldForwardProp: (prop) => prop !== "$clickable",
})<{ $clickable?: boolean }>(({ $clickable }) => ({
  display: "flex",
  flexDirection: "column",
  cursor: $clickable ? "pointer" : "default",
  "-webkit-user-select": "none",
  "-moz-user-select": "none",
  "-ms-user-select": "none",
  userSelect: "none",
  position: "relative",
  borderRadius: 4,
  padding: 0,
  boxShadow: "none",
}));

const TextContainer = styled("div")(({ theme }) => ({
  boxShadow: "3px 3px 6px #00000017",
  border: "1px solid #E0E0E0",
  padding: theme.spacing(1),
  height: 60,
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
}));

const PlaceholderImage = styled("img")({
  visibility: "hidden",
  width: "100%",
});

// the background image URL is per-render, so it is set via inline style
const PlaceholderImageContainer = styled("div")({
  backgroundSize: "cover",
  width: "100%",
  height: 60,
  backgroundPosition: "center",
});

const SectorName = styled(Typography)({
  fontSize: 19,
  fontWeight: 600,
});

const SectorIcon = styled("img")(({ theme }) => ({
  height: 26,
  marginBottom: -3,
  marginRight: theme.spacing(0.25),
}));

const CloseIconButton = styled(IconButton)(({ theme }) => ({
  position: "absolute",
  top: theme.spacing(0.5),
  right: theme.spacing(0.5),
  color: "red",
  background: "rgba(255, 255, 255, 0.9)",
  "&:hover": {
    background: "rgba(255, 255, 255, 0.98)",
  },
}));

// Add a key to force re-render when sector changes
export default function MiniSectorPreview({
  sector,
  sectorsToSelectFrom,
  editMode,
  createMode = false,
  onSelect,
  onClickRemoveSector,
}) {
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "hub", locale: locale });
  const handleRemoveHub = (event) => {
    event.preventDefault();
    onClickRemoveSector(sector);
  };
  // TODO: Link to filtered projects instead to hub
  //  Case 1: Location hub (?hub=erlangen) -> link to hub page filtered by this sector
  //  Case 2: General platform -> link to browse page filtered by this sector

  return (
    <SectorCard $clickable={!!sector?.url_slug}>
      {editMode && (
        <CloseIconButton size="small" onClick={handleRemoveHub}>
          <CloseIcon />
        </CloseIconButton>
      )}
      <PlaceholderImageContainer
        style={{
          backgroundImage: createMode
            ? `url(/images/mini_hub_preview_background.jpg)`
            : `url(${getImageUrl(sector?.image)})`,
        }}
      >
        <PlaceholderImage
          src={createMode ? "/images/mini_hub_preview_background.jpg" : getImageUrl(sector?.image)}
          alt="mini sector preview"
        />
      </PlaceholderImageContainer>
      <TextContainer>
        {createMode ? (
          <SelectField
            label={texts.add_a_sector_where_you_are_active}
            size="small"
            color="contrast"
            options={sectorsToSelectFrom}
            onChange={(event) => event.target.value && onSelect(event)}
          />
        ) : (
          <SectorName color="text">
            {sector.icon && <SectorIcon src={getImageUrl(sector.icon)} alt="sector icon" />}
            {sector?.name}
          </SectorName>
        )}
      </TextContainer>
    </SectorCard>
  );
}
