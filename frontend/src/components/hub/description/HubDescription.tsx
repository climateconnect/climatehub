import { Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import FashionDescription from "./FashionDescription";
import FoodDescription from "./FoodDescription";

const MoreInfoSoon = styled(Typography)(({ theme }) => ({
  fontWeight: 600,
  maxWidth: 800,
  marginTop: theme.spacing(2),
  textAlign: "center",
}));

export const HubDescription = ({ hub, texts }) => {
  if (hub === "food") return <FoodDescription />;
  if (hub === "fashion") return <FashionDescription />;
  return <MoreInfoSoon>{texts.more_info_about_hub_coming_soon}</MoreInfoSoon>;
};
