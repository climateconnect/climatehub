import { Container } from "@mui/material";
import { styled } from "@mui/material/styles";
import React, { useContext } from "react";
import getTexts from "../../../public/texts/texts";
import UserContext from "../context/UserContext";
import NavigationButtons from "../general/NavigationButtons";
import ActiveSectorsSelector from "../hub/ActiveSectorsSelector";

const Block = styled("div")(({ theme }) => ({
  marginBottom: theme.spacing(4),
  marginTop: theme.spacing(4),
}));

export default function SelectSectors({
  project,
  goToNextStep,
  goToPreviousStep,
  sectorsToSelectFrom,
  onSelectNewSector,
  onClickRemoveSector,
}) {
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "project", locale: locale });

  const onClickNextStep = () => {
    if (project.sectors.length <= 0) alert(texts.please_choose_at_least_one_sector);
    else if (project.sectors.length > 3) alert(texts.you_can_only_choose_up_to_3_sectors);
    else {
      goToNextStep();
    }
  };

  const onClickPreviousStep = () => {
    goToPreviousStep();
  };

  //(Share Project step 2)
  return (
    <Container maxWidth="lg">
      <Block>
        <Container maxWidth="md">
          <ActiveSectorsSelector
            selectedSectors={project.sectors ? project.sectors : []}
            sectorsToSelectFrom={sectorsToSelectFrom}
            maxSelectedNumber={3}
            onSelectNewSector={onSelectNewSector}
            onClickRemoveSector={onClickRemoveSector}
          />
        </Container>
      </Block>
      <NavigationButtons
        onClickPreviousStep={onClickPreviousStep}
        onClickNextStep={onClickNextStep}
        sticky
      />
    </Container>
  );
}
