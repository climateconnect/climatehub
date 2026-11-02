import { Typography } from "@mui/material";
import React, { useContext } from "react";
import getTexts from "../../../public/texts/texts";
import UserContext from "../context/UserContext";
import SectorsPreview from "./SectorsPreview";

type selectedSector = {
  hub_type?: string;
  icon?: string;
  landing_page_component?: string;
  name: string;
  quick_info?: string;
  thumbnail_image?: string;
  url_slug?: string;
};

type ActiveSectorsSelectorProps = {
  selectedSectors: selectedSector[];
  sectorsToSelectFrom: selectedSector[];
  maxSelectedNumber?: number;
  // eslint-disable-next-line no-unused-vars
  onSelectNewSector: (event: any) => void;
  // eslint-disable-next-line no-unused-vars
  onClickRemoveSector: (sector: selectedSector) => void;
  hideTitle?: boolean;
  title?: string;
};

export default function ActiveSectorsSelector({
  selectedSectors,
  sectorsToSelectFrom,
  maxSelectedNumber = 3,
  onSelectNewSector,
  onClickRemoveSector,
  hideTitle = false,
  title,
}: ActiveSectorsSelectorProps) {
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "project", locale: locale });
  return (
    <div>
      {!hideTitle && (
        <Typography color="text" sx={{ fontWeight: 700 }}>
          {title || texts.add_sectors_that_fit}
        </Typography>
      )}
      <SectorsPreview
        allowCreate={true}
        editMode={true}
        maxSelectedNumber={maxSelectedNumber}
        sectorsToSelectFrom={sectorsToSelectFrom}
        sectors={selectedSectors}
        onSelectNewSector={onSelectNewSector}
        onClickRemoveSector={onClickRemoveSector}
      />
    </div>
  );
}
