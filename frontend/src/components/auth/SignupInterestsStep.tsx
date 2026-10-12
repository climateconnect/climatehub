import { Box, Button, IconButton, Typography } from "@mui/material";
import ArrowBack from "@mui/icons-material/ArrowBack";
import { ChangeEvent, useContext, useEffect, useRef, useState } from "react";
import getTexts from "../../../public/texts/texts";
import UserContext from "../context/UserContext";
import ActiveSectorsSelector from "../hub/ActiveSectorsSelector";
import { Sector } from "../../types";
import { getSectorOptions } from "../../../public/lib/getOptions";
import LoadingSpinner from "../general/LoadingSpinner";
import { trackAuthEvent } from "../../utils/analytics";
import { styled } from "@mui/material/styles";

interface SignupInterestsStepProps {
  email: string;
  onSubmit: (_data: { interest_sectors: string[] }) => void;
  onBack: () => void;
  hubUrl?: string;
  isLoading?: boolean;
  errorMessage?: string;
  showHeader?: boolean;
}

const Header = styled(Typography)(({ theme }) => ({
  color: theme.palette.background.default_contrastText,
  [theme.breakpoints.down("sm")]: {
    padding: theme.spacing(4),
    paddingBottom: theme.spacing(2),
    textAlign: "center",
    fontSize: 35,
    fontWeight: "bold",
  },
}));

export default function SignupInterestsStep({
  email: _email,
  onSubmit,
  onBack,
  hubUrl,
  isLoading = false,
  errorMessage,
  showHeader = true,
}: SignupInterestsStepProps) {
  const { locale, ReactGA } = useContext(UserContext);
  const texts = getTexts({ page: "profile", locale: locale, hubName: hubUrl });
  const [selectedSectors, setSelectedSectors] = useState<Sector[]>([]);
  const [sectorOptions, setSectorOptions] = useState<Sector[]>([]);
  const [isLoadingSectors, setIsLoadingSectors] = useState(true);

  const trackedFieldFilled = useRef(false);

  // Fetch sector options when component mounts
  useEffect(() => {
    const fetchSectors = async () => {
      setIsLoadingSectors(true);
      try {
        const sectors = await getSectorOptions(locale, hubUrl);
        setSectorOptions(sectors || []);
      } catch (err) {
        console.error("Error fetching sector options:", err);
        setSectorOptions([]);
      } finally {
        setIsLoadingSectors(false);
      }
    };

    fetchSectors();
  }, [locale, hubUrl]);

  const handleSectorSelection = (event: ChangeEvent<HTMLSelectElement | { value: string }>) => {
    event.preventDefault();
    const sectorName = event.target.value;
    const selectedSector = sectorOptions.find((s) => s.name === sectorName);

    if (selectedSector && !selectedSectors.some((s) => s.key === selectedSector.key)) {
      const updatedSectors = [...selectedSectors, selectedSector];
      setSelectedSectors(updatedSectors);

      if (!trackedFieldFilled.current) {
        trackedFieldFilled.current = true;
        trackAuthEvent(
          "auth_signup_field_filled",
          { locale, hub_slug: hubUrl, field_name: "interests", step: "interests" },
          ReactGA
        );
      }
    }
  };

  const handleSectorRemoval = (sectorToRemove: any) => {
    if (!sectorToRemove) {
      console.warn("handleSectorRemoval was called without a sector.");
      return;
    }
    const updatedSectors = selectedSectors.filter((sector) => sector.key !== sectorToRemove.key);
    setSelectedSectors(updatedSectors);
  };

  const handleCreateAccount = () => {
    const sectorIds = selectedSectors.map((sector) => sector.key);
    trackAuthEvent(
      "auth_signup_interests_submitted",
      { locale, hub_slug: hubUrl, sector_count: sectorIds.length },
      ReactGA
    );
    onSubmit({ interest_sectors: sectorIds });
  };

  // Filter out sectors that are already selected
  const availableSectors = sectorOptions.filter(
    (sector) => !selectedSectors.some((selected) => selected.key === sector.key)
  );

  return (
    <Box>
      {showHeader && (
        <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
          <IconButton aria-label="go back" onClick={onBack} size="small" style={{ marginRight: 8 }}>
            <ArrowBack />
          </IconButton>
          <Header variant="h1" gutterBottom>
            {texts.your_area_of_interest}
          </Header>
        </div>
      )}

      <Typography variant="body1" sx={{ mb: 3 }}>
        {texts.signup_step_3_headline}
      </Typography>
      {/* Interest sectors selection */}
      <Box sx={{ mb: 3 }}>
        {isLoadingSectors ? (
          <LoadingSpinner isLoading />
        ) : (
          <ActiveSectorsSelector
            selectedSectors={selectedSectors}
            sectorsToSelectFrom={availableSectors}
            onSelectNewSector={handleSectorSelection}
            onClickRemoveSector={handleSectorRemoval}
            hideTitle={false}
            title={texts.select_your_interest_areas}
          />
        )}
      </Box>

      {/* Error message */}
      {errorMessage && (
        <Typography color="error" variant="body2" sx={{ mb: 2 }}>
          {errorMessage}
        </Typography>
      )}

      {/* Action buttons */}
      <Box sx={{ display: "flex", gap: 2, mt: 4 }}>
        <Button
          variant="contained"
          color="primary"
          onClick={handleCreateAccount}
          disabled={isLoading}
          sx={{ flex: 1 }}
        >
          {isLoading ? texts.creating_account : texts.create_account}
        </Button>
      </Box>
    </Box>
  );
}
