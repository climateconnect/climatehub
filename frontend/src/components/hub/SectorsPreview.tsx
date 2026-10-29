import Grid from "@mui/material/Grid";
import { Theme } from "@mui/material/styles";
import React from "react";
import MiniSectorPreview from "./MiniSectorPreview";

// reset + root: both applied to the same element; `margin: 0` came first, then `marginLeft` wins
const sectorsGridSx = (theme: Theme) => ({
  margin: 0,
  padding: 0,
  listStyleType: "none",
  width: "100%",
  marginLeft: theme.spacing(-1),
});

export default function SectorsPreview({
  sectors,
  sectorsToSelectFrom,
  allowCreate,
  maxSelectedNumber = -1,
  editMode,
  onSelectNewSector,
  onClickRemoveSector,
}) {
  return (
    <Grid container component="ul" spacing={2} sx={sectorsGridSx}>
      {sectors &&
        sectors.map((sector) => (
          <GridItem
            sector={sector}
            key={sector.key}
            editMode={editMode}
            onClickRemoveSector={onClickRemoveSector}
          />
        ))}
      {allowCreate && (maxSelectedNumber == -1 || sectors?.length < maxSelectedNumber) && (
        <GridItem
          key={`create-${sectorsToSelectFrom?.length || 0}`}
          createMode
          sectorsToSelectFrom={sectorsToSelectFrom}
          onSelectNewSector={onSelectNewSector}
        />
      )}
    </Grid>
  );
}

function GridItem({
  sector,
  createMode,
  editMode,
  sectorsToSelectFrom,
  onSelectNewSector,
  onClickRemoveSector,
}: any) {
  return (
    <Grid
      key={sector ? sector.url_slug : "create"}
      size={{ xs: 12, sm: editMode ? 6 : 12, md: 8, lg: 6 }}
      component="li"
    >
      <MiniSectorPreview
        sector={sector}
        createMode={createMode}
        editMode={editMode}
        sectorsToSelectFrom={sectorsToSelectFrom}
        onSelect={onSelectNewSector}
        onClickRemoveSector={onClickRemoveSector}
      />
    </Grid>
  );
}
